// ============================================================================
// PLAYER PROFILES - storage
// ============================================================================
// Where profiles live in the browser (ADR-0004):
//   pfg_profiles          the index: id, label, universe, player id per profile
//   pfg_profile_<id>      one profile, so saving one never rewrites the others
//   pfg_active_profile    the last choice, read by a tab that has none yet
//   pfg_profile_planets   the last planet picked, per calculator and profile
// The active profile itself is per tab (sessionStorage), so two accounts can be
// open side by side. Storage can be missing or full - a private window, blocked
// site data - so every access is guarded and the page keeps working without it.

'use strict';

const PROFILE_STORAGE_KEYS = {
  index: 'pfg_profiles',
  prefix: 'pfg_profile_',
  active: 'pfg_active_profile',
  planets: 'pfg_profile_planets',
};

/**
 * @typedef {Object} ProfileIndexEntry
 * @property {string} id
 * @property {string} label
 * @property {?ProfileUniverse} universe
 * @property {?number} playerId
 */

/**
 * The subset of the Storage interface the store uses, so a test can hand in a
 * plain object.
 *
 * @typedef {Object} ProfileStorageLike
 * @property {(key: string) => ?string} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * @param {() => ProfileStorageLike} get
 * @returns {?ProfileStorageLike}
 */
function safeStorage(get) {
  try {
    return get() || null;
  } catch {
    return null;
  }
}

class ProfileStore {
  /**
   * @param {?ProfileStorageLike} [local] Defaults to window.localStorage.
   * @param {?ProfileStorageLike} [session] Defaults to window.sessionStorage.
   */
  constructor(local, session) {
    this.local = local === undefined ? safeStorage(() => window.localStorage) : local;
    this.session = session === undefined ? safeStorage(() => window.sessionStorage) : session;
    /** @type {Array<(key?: ?string) => void>} */
    this.listeners = [];
    /** @type {?{text: string, entries: ProfileIndexEntry[]}} The index as last parsed, by its stored text. */
    this.indexCache = null;
  }

  /**
   * @param {?ProfileStorageLike} storage
   * @param {string} key
   * @returns {*} The parsed value, or null.
   */
  read(storage, key) {
    if (!storage) return null;
    try {
      const text = storage.getItem(key);
      return text === null ? null : JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * @param {?ProfileStorageLike} storage
   * @param {string} key
   * @param {*} value
   * @returns {boolean} False when the browser refused the write.
   */
  write(storage, key, value) {
    if (!storage) return false;
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {?ProfileStorageLike} storage
   * @param {string} key
   */
  drop(storage, key) {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // Nothing to do: the key stays, and the index no longer points at it.
    }
  }

  /** True when profiles can be stored at all. */
  get available() {
    return this.local !== null;
  }

  /**
   * The index, parsed again only when its stored text changed - this tab's
   * writes and another tab's alike, since the text is read every time.
   *
   * @returns {ProfileIndexEntry[]} Sorted by label; copies, so a caller may change them.
   */
  list() {
    let text = null;
    try {
      text = this.local ? this.local.getItem(PROFILE_STORAGE_KEYS.index) : null;
    } catch {
      text = null;
    }
    if (text === null) return [];
    if (this.indexCache?.text !== text) {
      let raw = null;
      try {
        raw = JSON.parse(text);
      } catch {
        raw = null;
      }
      /** @type {ProfileIndexEntry[]} */
      const entries = Array.isArray(raw)
        ? raw.filter((e) => e && typeof e.id === 'string').sort((a, b) => String(a.label).localeCompare(String(b.label)))
        : [];
      this.indexCache = { text, entries };
    }
    return this.indexCache.entries.map((e) => ({ ...e, universe: e.universe ? { ...e.universe } : e.universe }));
  }

  /**
   * @param {string} id
   * @returns {?Profile}
   */
  get(id) {
    return readProfile(this.read(this.local, PROFILE_STORAGE_KEYS.prefix + id));
  }

  /** @returns {Profile[]} Every stored profile that reads back cleanly. */
  getAll() {
    return /** @type {Profile[]} */ (this.list().map((e) => this.get(e.id)).filter((p) => p !== null));
  }

  /**
   * Save a profile and its index entry.
   *
   * @param {Profile} profile
   * @returns {boolean} False when the browser refused the write.
   */
  save(profile) {
    if (!this.write(this.local, PROFILE_STORAGE_KEYS.prefix + profile.id, profile)) return false;
    const entry = { id: profile.id, label: profile.label, universe: profile.universe, playerId: profile.playerId };
    const list = this.list();
    const old = list.find((e) => e.id === profile.id);
    // Most saves are value edits: an unchanged entry spares the index write,
    // and the second storage event it would raise in every other tab.
    const ok = (old !== undefined && JSON.stringify(old) === JSON.stringify(entry))
      || this.write(this.local, PROFILE_STORAGE_KEYS.index, [...list.filter((e) => e.id !== profile.id), entry]);
    this.notify();
    return ok;
  }

  /** @param {string} id */
  remove(id) {
    this.drop(this.local, PROFILE_STORAGE_KEYS.prefix + id);
    this.write(this.local, PROFILE_STORAGE_KEYS.index, this.list().filter((e) => e.id !== id));
    if (this.getActiveId() === id) this.setActive(null);
    const planets = this.read(this.local, PROFILE_STORAGE_KEYS.planets);
    if (planets && typeof planets === 'object') {
      Object.values(planets).forEach((byProfile) => { if (byProfile) delete byProfile[id]; });
      this.write(this.local, PROFILE_STORAGE_KEYS.planets, planets);
    }
    this.notify();
  }

  /**
   * The active profile of this tab: its own choice, otherwise the last choice
   * made in any tab. An id whose profile is gone counts as none.
   *
   * @returns {?string}
   */
  getActiveId() {
    const own = this.read(this.session, PROFILE_STORAGE_KEYS.active);
    const candidate = typeof own === 'string' ? own : this.read(this.local, PROFILE_STORAGE_KEYS.active);
    if (typeof candidate !== 'string' || !candidate) return null;
    return this.list().some((e) => e.id === candidate) ? candidate : null;
  }

  /** @returns {?Profile} */
  getActive() {
    const id = this.getActiveId();
    return id ? this.get(id) : null;
  }

  /**
   * Choose the profile for this tab, and remember it for new tabs. Null means
   * "no profile", which is remembered too: an empty string, so a tab that
   * chose none does not fall back to the last choice of another tab.
   *
   * @param {?string} id
   */
  setActive(id) {
    this.write(this.session, PROFILE_STORAGE_KEYS.active, id || '');
    this.write(this.local, PROFILE_STORAGE_KEYS.active, id || '');
    this.notify();
  }

  /**
   * @param {string} calc
   * @param {string} profileId
   * @returns {?string} Our id of the planet last picked there.
   */
  getLastPlanet(calc, profileId) {
    const map = this.read(this.local, PROFILE_STORAGE_KEYS.planets);
    const id = map?.[calc] ? map[calc][profileId] : null;
    return typeof id === 'string' ? id : null;
  }

  /**
   * @param {string} calc
   * @param {string} profileId
   * @param {string} planetId
   */
  setLastPlanet(calc, profileId, planetId) {
    const raw = this.read(this.local, PROFILE_STORAGE_KEYS.planets);
    const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    map[calc] = { ...map[calc], [profileId]: planetId };
    this.write(this.local, PROFILE_STORAGE_KEYS.planets, map);
  }

  /**
   * Call back when profiles change, in this tab or in another one. A change
   * made in another tab comes with the storage key it wrote (null when that
   * tab cleared the storage); one made here comes with none.
   *
   * @param {(key?: ?string) => void} listener
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  /** @param {?string} [key] The key another tab wrote. */
  notify(key) {
    this.listeners.forEach((listener) => listener(key));
  }

  /**
   * Forward profile changes made in other tabs. The `storage` event fires only
   * in the tabs that did not write.
   *
   * @param {Window} win
   */
  listenToOtherTabs(win) {
    win.addEventListener('storage', (e) => {
      // The last-planet map shares the profiles' prefix but changes no profile.
      if (e.key === PROFILE_STORAGE_KEYS.planets) return;
      if (e.key === null || e.key === PROFILE_STORAGE_KEYS.index || e.key.startsWith(PROFILE_STORAGE_KEYS.prefix)) {
        this.notify(e.key);
      }
    });
  }

  /**
   * Ask the browser not to evict the site's storage on its own (Safari clears
   * it after about a week unused). Best effort: the answer only lowers the risk,
   * and nothing waits for it.
   */
  requestPersistence() {
    // An old browser without the Storage API has nothing to ask.
    const storage = typeof navigator === 'undefined' ? null : navigator.storage;
    if (typeof storage?.persist === 'function') storage.persist().catch(() => undefined);
  }
}

/**
 * The shared universe cache (ADR-0004), `pfg_universe_<country>_<number>`: a
 * universe's settings as `serverdata` reports them, and the ones the player
 * picked instead. They are not part of a profile, so every profile of the
 * universe shares them. The rules live in profiles-core.js; this class only
 * reads, writes and fetches. A universe's settings come in one request,
 * whichever field asks first.
 */
class UniverseCache {
  /**
   * @param {?ProfileStorageLike} [local] Defaults to window.localStorage.
   * @param {(universe: ProfileUniverse) => Promise<?Record<string, any>>} [fetcher] The `serverdata`
   *   answer of a universe; defaults to the AJAX service.
   * @param {() => number} [now] Defaults to Date.now.
   */
  constructor(local, fetcher, now) {
    this.local = local === undefined ? safeStorage(() => window.localStorage) : local;
    this.fetcher = fetcher || ((universe) => apiGet('serverdata', { country: universe.country, universe: universe.number }));
    this.now = now || Date.now;
    /** @type {Map<string, Promise<?Record<string, any>>>} The request of each universe still out. */
    this.requests = new Map();
  }

  /**
   * @param {ProfileUniverse} universe
   * @returns {?UniverseEntry}
   */
  get(universe) {
    if (!this.local) return null;
    try {
      return readUniverseEntry(JSON.parse(this.local.getItem(universeCacheKey(universe)) || 'null'));
    } catch {
      return null;
    }
  }

  /**
   * @param {ProfileUniverse} universe
   * @param {UniverseEntry} entry
   */
  put(universe, entry) {
    if (!this.local) return;
    try {
      this.local.setItem(universeCacheKey(universe), JSON.stringify(entry));
    } catch {
      // Without storage the settings are simply fetched again next time.
    }
  }

  /**
   * The universe's entry when it can be used as it is, so a field can show it
   * at once instead of after refresh() settles.
   *
   * @param {ProfileUniverse} universe
   * @param {string} key
   * @returns {?UniverseEntry} Null when it has to be fetched first.
   */
  fresh(universe, key) {
    const entry = this.get(universe);
    return isUniverseEntryFresh(entry, key, this.now()) ? entry : null;
  }

  /**
   * The universe's entry, fetched again once a day or when it never held this
   * setting. An unreachable universe leaves the entry as it was: a stale value
   * is still the best guess.
   *
   * @param {ProfileUniverse} universe
   * @param {string} key The setting the caller is about to show.
   * @returns {Promise<?UniverseEntry>} Null when nothing is known about the universe.
   */
  async refresh(universe, key) {
    const entry = this.get(universe);
    if (isUniverseEntryFresh(entry, key, this.now())) return entry;
    const data = await this.fetchSettings(universe);
    if (!data) return entry;
    // Read again: another field of the page may have written the entry meanwhile.
    /** @type {UniverseEntry} */
    const fresh = { ...this.get(universe), at: this.now(), ...parseUniverseSettings(data) };
    this.put(universe, fresh);
    return fresh;
  }

  /**
   * @param {ProfileUniverse} universe
   * @returns {Promise<?Record<string, any>>} Null when the universe cannot be reached.
   */
  fetchSettings(universe) {
    const key = universeCacheKey(universe);
    let request = this.requests.get(key);
    if (!request) {
      request = this.fetcher(universe)
        .catch(() => null)
        .finally(() => this.requests.delete(key));
      this.requests.set(key, request);
    }
    return request;
  }

  /**
   * Remember the player's choice of a setting, or drop it when it is the
   * game's value again.
   *
   * @param {ProfileUniverse} universe
   * @param {string} key
   * @param {*} chosen
   * @returns {?UniverseEntry} The entry; null while the game value is unknown, when nothing is kept.
   */
  choose(universe, key, chosen) {
    const entry = this.get(universe);
    if (!entry || !('game' in universeLayer(entry, key))) return null;
    if (setUniverseChoice(entry, key, chosen)) this.put(universe, entry);
    return entry;
  }

  /**
   * Drop the player's choices of these settings, back to the game's.
   *
   * @param {ProfileUniverse} universe
   * @param {string[]} keys
   * @returns {number} How many choices were dropped.
   */
  reset(universe, keys) {
    const entry = this.get(universe);
    const count = entry ? resetUniverseChoices(entry, keys) : 0;
    if (entry && count > 0) this.put(universe, entry);
    return count;
  }

  /**
   * The settings the player picked for the universes of these profiles, for
   * the backup file.
   *
   * @param {Profile[]} profiles
   * @returns {UniverseChoices[]}
   */
  choicesOf(profiles) {
    /** @type {UniverseChoices[]} */
    const choices = [];
    profiles.forEach((p) => {
      const universe = p.universe;
      if (!universe || choices.some((c) => sameUniverse(c.universe, universe))) return;
      const overrides = this.get(universe)?.overrides;
      if (overrides && Object.keys(overrides).length > 0) choices.push({ universe: { ...universe }, overrides: { ...overrides } });
    });
    return choices;
  }

  /**
   * Put a backup's choices back, over the ones there.
   *
   * @param {UniverseChoices} choices
   */
  restoreChoices(choices) {
    this.put(choices.universe, mergeUniverseChoices(this.get(choices.universe), choices.overrides));
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ProfileStore, PROFILE_STORAGE_KEYS, UniverseCache });
}
