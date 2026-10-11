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
    /** @type {Array<() => void>} */
    this.listeners = [];
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

  /** @returns {ProfileIndexEntry[]} Sorted by label. */
  list() {
    const raw = this.read(this.local, PROFILE_STORAGE_KEYS.index);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e.id === 'string')
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
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
    const index = this.list().filter((e) => e.id !== profile.id);
    index.push(entry);
    const ok = this.write(this.local, PROFILE_STORAGE_KEYS.index, index);
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
    map[calc] = { ...(map[calc] || {}), [profileId]: planetId };
    this.write(this.local, PROFILE_STORAGE_KEYS.planets, map);
  }

  /**
   * Call back when profiles change, in this tab or in another one.
   *
   * @param {() => void} listener
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Forward profile changes made in other tabs. The `storage` event fires only
   * in the tabs that did not write.
   *
   * @param {Window} win
   */
  listenToOtherTabs(win) {
    win.addEventListener('storage', (e) => {
      if (e.key === null || e.key === PROFILE_STORAGE_KEYS.index || e.key.startsWith(PROFILE_STORAGE_KEYS.prefix)) {
        this.notify();
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

if (typeof window !== 'undefined') {
  Object.assign(window, { ProfileStore, PROFILE_STORAGE_KEYS });
}
