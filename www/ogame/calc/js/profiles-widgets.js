// ============================================================================
// PLAYER PROFILES - the profile widgets
// ============================================================================
// The controls a binder puts on a calculator page for the active profile: a
// universe setting's field tied to the shared universe cache, the select of
// the profile's planets or moons, the universe picker a profile locks, and
// the select that copies a body's coordinates into the calculator.

'use strict';

/**
 * Lock a select the profile decides (its universe), or give it back.
 *
 * The reason is a native title, not a Bootstrap tooltip, on purpose: a
 * disabled <select> gets no mouse events, so a tooltip would never show on it.
 *
 * @param {?HTMLSelectElement} el
 * @param {boolean} locked
 * @param {string} [title] Why it is locked.
 */
function pfLockSelect(el, locked, title = '') {
  if (!el) return;
  el.disabled = locked;
  if (locked) el.title = title;
  else el.removeAttribute('title');
}

/**
 * @typedef {Object} PfUniverseSettingKind
 * @property {string} key The setting's name in the cache entry.
 * @property {(selector: string) => *} get The value the field shows.
 * @property {(selector: string, value: *) => void} set Show a value in the field.
 * @property {(value: *) => string} display The game value as shown in the mark.
 */

/**
 * A select whose option values are numbers. A value the select does not
 * offer - a debris share no preset matches - is added as an option first.
 *
 * @param {(v: number) => string} label The text of an added option.
 * @returns {Pick<PfUniverseSettingKind, 'get'|'set'>}
 */
function pfNumberSelect(label) {
  return {
    get: (selector) => Number(getVal(selector)),
    set: (selector, value) => {
      const select = selectEl(selector);
      if (select && !Array.from(select.options).some((o) => o.value === String(value))) {
        const after = Array.from(select.options).find((o) => Number(o.value) > value);
        select.insertBefore(new Option(label(value), String(value)), after || null);
      }
      setVal(selector, value);
    },
  };
}

/** @type {PfUniverseSettingKind} The economy speed. */
const PF_UNIVERSE_SPEED = {
  key: 'speed',
  ...pfNumberSelect(String),
  display: String,
};

/** @type {PfUniverseSettingKind} The share of a destroyed fleet that goes to the debris field, in percent. */
const PF_UNIVERSE_DEBRIS = {
  key: 'debrisFactor',
  ...pfNumberSelect((v) => v + '%'),
  display: (v) => v + '%',
};

/** @type {PfUniverseSettingKind} Whether deuterium goes to the debris field too. */
const PF_UNIVERSE_DEUT_IN_DEBRIS = {
  key: 'deuteriumInDebris',
  get: (selector) => getChecked(selector),
  set: (selector, value) => setChecked(selector, value === true),
  display: (v) => pfDisplayValue(v === true),
};

/**
 * @type {PfUniverseSettingKind} The expeditions' "strongest player" class, kept as the value of the
 * #highTop option the universe's top score falls into (not as the score itself).
 */
const PF_UNIVERSE_TOP_SCORE = {
  key: 'topScore',
  get: (selector) => Number(getVal(selector)),
  // The value always comes from the select's own list, so no option is added.
  set: (selector, value) => setVal(selector, value),
  display: (v) => pfOptionText(selectEl('#highTop'))(v),
};

/** @type {PfUniverseSettingKind} The share of destroyed defenses that goes to the debris field, in percent. */
const PF_UNIVERSE_DEF_DEBRIS = {
  key: 'debrisFactorDef',
  ...pfNumberSelect((v) => v + '%'),
  display: (v) => v + '%',
};

/** @type {PfUniverseSettingKind} The number of systems per galaxy. */
const PF_UNIVERSE_SYSTEMS = {
  key: 'systems',
  get: (selector) => getInputNumber($(selector)),
  set: (selector, value) => setVal(selector, value),
  display: String,
};

/** @type {PfUniverseSettingKind} Whether the systems of a galaxy form a ring (the last one borders the first). */
const PF_UNIVERSE_DONUT_SYSTEM = {
  key: 'donutSystem',
  get: (selector) => getChecked(selector),
  set: (selector, value) => setChecked(selector, value === true),
  display: (v) => pfDisplayValue(v === true),
};

/**
 * One setting of the active profile's universe, for a calculator that has
 * the field but no universe picker: the economy speed of production, queue,
 * LF costs and graviton, and graviton's debris share. A universe setting is
 * not part of a profile: it lives in the shared universe cache (UniverseCache
 * in profiles-store.js, ADR-0004) together with the value the player picked
 * instead, shared by every profile of that universe. This class only ties the
 * field to the cache: it shows the value, remembers a change and marks it.
 */
class PfUniverseSetting {
  /**
   * @param {ProfilesUi} pf
   * @param {PfUniverseSettingKind} kind
   * @param {string} selector The field that shows the setting.
   * @param {() => void} recalc Recalculates the page after the setting was set.
   * @param {string} [prm] The key the calculator keeps the setting under, where a binder needs it.
   */
  constructor(pf, kind, selector, recalc, prm = '') {
    this.pf = pf;
    this.kind = kind;
    this.selector = selector;
    this.recalc = recalc;
    this.prm = prm;
    /** @type {?ProfileUniverse} The universe of the profile shown, if it has one. */
    this.universe = null;
    addEvent(selector, 'change', () => this.changed());
    // Named for the reset dialog, which lists the player's choice beside the profile's overrides.
    pf.describeField(kind.key, pfFieldLabel($(selector)), kind.display);
  }

  /** @returns {?string} */
  cacheKey() {
    return this.universe ? universeCacheKey(this.universe) : null;
  }

  /**
   * Take the setting from the profile's universe - the player's own choice if
   * they made one - fetching the settings again once a day, or when this one
   * was never fetched. A fresh entry is shown at once; nothing waits for the
   * network, and failures are handled by the cache.
   *
   * @param {Profile} profile
   */
  async attach(profile) {
    this.universe = profile.universe ? { ...profile.universe } : null;
    const key = this.cacheKey();
    this.mark();
    if (!key || !profile.universe) return;
    const cache = this.pf.universes;
    const entry = cache.fresh(profile.universe, this.kind.key) ?? await cache.refresh(profile.universe, this.kind.key);
    // Another profile may have been shown while the request was out.
    if (!entry || this.cacheKey() !== key) return;
    const value = universeValue(entry, this.kind.key);
    if (value === null) return;
    if (!sameValue(this.kind.get(this.selector), value)) {
      this.kind.set(this.selector, value);
      this.recalc();
    }
    this.mark(entry);
  }

  /** No profile: the setting is the calculator's own again. */
  detach() {
    this.universe = null;
    this.mark();
  }

  /** The player changed the field: remember it as theirs, or drop it when it is the game's again. */
  changed() {
    if (!this.universe) return;
    const entry = this.pf.universes.choose(this.universe, this.kind.key, this.kind.get(this.selector));
    if (!entry) return;
    this.mark(entry);
    this.pf.renderOverrides();
  }

  /**
   * Mark the field as the game's, with a restore button when the player changed it.
   *
   * @param {?UniverseEntry} [entry] The universe's cache entry, when the caller has just read or written it.
   */
  mark(entry) {
    /** @type {?UniverseEntry} */
    let known = null;
    if (this.universe) known = entry === undefined ? this.pf.universes.get(this.universe) : entry;
    // The value the field shows stands in for the choice, so the mark compares
    // what is on screen; a universe setting is marked whether or not the
    // profile has a game layer.
    const state = pfMarkState({ ...universeLayer(known, this.kind.key), override: this.kind.get(this.selector) }, true);
    const game = state.game;
    this.pf.markInput($(this.selector), state.bound, state.differs ? this.kind.display(game) : null, () => {
      this.kind.set(this.selector, game);
      this.changed();
      this.recalc();
    });
  }
}

/**
 * @typedef {object} PfBodySelectConfig
 * @property {string} select Selector of the <select>.
 * @property {string} box Selector of the element that holds it, hidden while there is nothing to pick.
 * @property {(profile: Profile) => ProfilePlanet[]} bodies The planets or moons it lists.
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 * @property {() => ?string} [planetOf] For a select of moons: the planet shown with it. Its moon is
 *   shown when neither the current moon nor the last pick is there, and follow() picks it.
 */

/**
 * The select that picks a planet or a moon of the active profile: its
 * options, the choice made last time in each profile, and the box around it.
 * A binder holds one per kind of body and keeps the chosen id itself.
 */
class PfBodySelect {
  /**
   * @param {ProfilesUi} pf
   * @param {PfBodySelectConfig} config
   */
  constructor(pf, config) {
    this.pf = pf;
    this.config = config;
  }

  /**
   * Fill the select and choose a body: the current one, else the one picked
   * last time in this profile, else the moon of the planet shown, else the first one.
   *
   * @param {Profile} profile
   * @param {?string} currentId
   * @returns {?string} The id of the body shown.
   */
  render(profile, currentId) {
    const { select: selector, box, bodies, lastKey } = this.config;
    const list = bodies(profile);
    const select = selectEl(selector);
    if (select) {
      select.innerHTML = '';
      list.forEach((b) => select.appendChild(new Option(pfBodyLabel(b), b.id)));
    }
    pfShow(box, list.length > 0);
    const last = this.pf.store.getLastPlanet(lastKey, profile.id);
    const chosen = list.find((b) => b.id === currentId)
      || list.find((b) => b.id === last)
      || this.moonOfPlanet(profile)
      || list[0];
    const id = chosen ? chosen.id : null;
    if (select) select.value = id || '';
    return id;
  }

  /**
   * The moon of the planet this select follows (planetOf), if it has one.
   *
   * @param {Profile} profile
   * @returns {ProfileMoon|undefined}
   */
  moonOfPlanet(profile) {
    const planetId = this.config.planetOf?.() ?? null;
    return planetId === null ? undefined : profile.moons.find((m) => m.planetId === planetId);
  }

  /**
   * The planet it follows was picked: pick its moon too, when it has one.
   *
   * @param {Profile} profile
   * @returns {?string} The id of the moon picked; null when the planet has none.
   */
  follow(profile) {
    const moon = this.moonOfPlanet(profile);
    if (!moon) return null;
    this.choose(profile, moon.id);
    return moon.id;
  }

  /**
   * The player picked a body: remember it.
   *
   * @param {Profile} profile
   * @returns {?string} The id picked.
   */
  chosen(profile) {
    const id = getVal(this.config.select) || null;
    if (id) this.pf.store.setLastPlanet(this.config.lastKey, profile.id, id);
    return id;
  }

  /**
   * Pick a body from code, and remember it.
   *
   * @param {Profile} profile
   * @param {string} id
   */
  choose(profile, id) {
    setVal(this.config.select, id);
    this.pf.store.setLastPlanet(this.config.lastKey, profile.id, id);
  }

  /** Call a handler when the player picks another body. */
  onChange(/** @type {() => void} */ handler) {
    addEvent(this.config.select, 'change', handler);
  }

  hide() {
    pfShow(this.config.box, false);
  }
}

/**
 * The universe a calculator shows, and whatever else it gives back with it (the cost
 * calculator's speeds).
 *
 * @typedef {{country: string, universe: *, [setting: string]: *}} PfShownUniverse
 */

/**
 * @typedef {object} PfLockedUniverseConfig
 * @property {() => PfShownUniverse} read The universe the calculator shows now.
 * @property {(country: string, universe: *) => void} write Show a universe: in the model and in the form.
 * @property {(own: PfShownUniverse) => void} [restore] Show the player's own universe again when the
 *   profile lets it go; write() by default.
 */

/**
 * The universe picker a profile decides: the profile's universe is shown and
 * the #country and #universe selects are locked, and the universe the player
 * had picked before is kept to give back. A profile with no universe leaves
 * the picker to the player. How a universe is read and shown is the page's.
 */
class PfLockedUniverse {
  /** @param {PfLockedUniverseConfig} config */
  constructor(config) {
    this.config = config;
    /** @type {?PfShownUniverse} The universe picked before a profile set its own. */
    this.own = null;
  }

  /**
   * Whether the calculator shows this universe.
   *
   * @param {string} country
   * @param {*} number
   * @returns {boolean}
   */
  matches(country, number) {
    const now = this.config.read();
    return now.country === country && String(now.universe) === String(number);
  }

  /**
   * Show the profile's universe, locked.
   *
   * @param {Profile} profile
   */
  apply(profile) {
    const wanted = profile.universe;
    if (!wanted) {
      this.release();
      return;
    }
    this.own ??= this.config.read();
    this.config.write(wanted.country, wanted.number);
    this.lock(true);
  }

  /** Give the picker back, on the universe it showed before the profile. */
  release() {
    this.lock(false);
    const own = this.own;
    this.own = null;
    if (!own) return;
    if (this.config.restore) this.config.restore(own);
    else this.config.write(own.country, own.universe);
  }

  /** @param {boolean} locked */
  lock(locked) {
    [selectEl('#country'), selectEl('#universe')].forEach((el) => pfLockSelect(el, locked, locked ? getOptionValue('universeFromProfile', '') : ''));
  }

  /**
   * Put the universe the player picked, not the profile's, into the values a
   * calculator stores as its own - with whatever else read() gave back with it.
   *
   * @param {Record<string, any>} stored
   */
  overlay(stored) {
    if (this.own) Object.assign(stored, this.own);
  }
}

/**
 * A planet or moon of a profile that has full coordinates, as PfCoordsSelect lists it.
 *
 * @typedef {object} PfCoordsBody
 * @property {ProfilePlanet} body
 * @property {number[]} coords Galaxy, system, position.
 * @property {boolean} isMoon
 * @property {string} label
 */

/**
 * @typedef {object} PfCoordsSelectConfig
 * @property {string} select Selector of the <select>.
 * @property {string[]} boxes Selectors of what is shown while there is a body to pick.
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 * @property {string} nameFallback The name of a body that has none.
 * @property {(b: PfCoordsBody) => boolean} isAt Whether the calculator's coordinates are at the body.
 * @property {(b: PfCoordsBody) => void} move Put the body's coordinates into the calculator.
 * @property {() => void} recalc Recalculate after the player picked a body.
 * @property {() => void} [changed] Called when what the select shows may have changed.
 */

/**
 * The select that copies the coordinates of a planet or moon of the active
 * profile into the calculator. The coordinates stay the calculator's own: the
 * select follows them, and moves them only to give them a body to start from.
 */
class PfCoordsSelect {
  /**
   * @param {ProfilesUi} pf
   * @param {PfCoordsSelectConfig} config
   */
  constructor(pf, config) {
    this.pf = pf;
    this.config = config;
  }

  /**
   * Every planet and moon with full coordinates, planets first.
   *
   * @param {Profile} profile
   * @returns {PfCoordsBody[]}
   */
  bodies(profile) {
    /** @type {PfCoordsBody[]} */
    const list = [];
    /**
     * @param {ProfilePlanet} body
     * @param {boolean} isMoon
     */
    const add = (body, isMoon) => {
      const c = body.coords;
      if (typeof c?.galaxy !== 'number' || typeof c.system !== 'number' || typeof c.position !== 'number') return;
      const coords = [c.galaxy, c.system, c.position];
      const name = (body.name || this.config.nameFallback) + (isMoon ? ' (' + getOptionValue('moonLabel', '') + ')' : '');
      list.push({ body, coords, isMoon, label: name + ' [' + coords.join(':') + ']' });
    };
    profile.planets.forEach((p) => add(p, false));
    profile.moons.forEach((m) => add(m, true));
    return list;
  }

  /**
   * Fill the select. The coordinates move to a body only when they match none:
   * to the one picked last time in this profile, else to the first planet -
   * unless the caller keeps them.
   *
   * @param {Profile} profile
   * @param {boolean} [keepCoords]
   */
  render(profile, keepCoords = false) {
    const { select: selector, boxes, lastKey, isAt, move } = this.config;
    const select = selectEl(selector);
    if (!select) return;
    const bodies = this.bodies(profile);
    select.innerHTML = '';
    select.appendChild(new Option('—', ''));
    bodies.forEach((b) => select.appendChild(new Option(b.label, b.body.id)));
    boxes.forEach((box) => pfShow(box, bodies.length > 0));
    const last = this.pf.store.getLastPlanet(lastKey, profile.id);
    const matching = bodies.filter(isAt);
    let chosen = matching.find((b) => b.body.id === last) || matching[0];
    if (!chosen && !keepCoords && bodies.length > 0) {
      chosen = bodies.find((b) => b.body.id === last) || bodies[0];
      move(chosen);
    }
    select.value = chosen ? chosen.body.id : '';
    this.config.changed?.();
  }

  /**
   * The player picked a body: move the coordinates to it, remember it and
   * recalculate. The dash leaves the coordinates where they are.
   *
   * @param {Profile} profile
   */
  chosen(profile) {
    const id = getVal(this.config.select);
    const body = this.bodies(profile).find((b) => b.body.id === id);
    if (body) {
      this.config.move(body);
      this.pf.store.setLastPlanet(this.config.lastKey, profile.id, body.body.id);
      this.config.recalc();
    }
    this.config.changed?.();
  }

  /**
   * Keep the select on the body the coordinates are at, or on the dash.
   *
   * @param {Profile} profile
   */
  follow(profile) {
    const select = selectEl(this.config.select);
    if (!select) return;
    const bodies = this.bodies(profile);
    const current = bodies.find((b) => b.body.id === select.value);
    if (current && this.config.isAt(current)) return;
    const match = bodies.find(this.config.isAt);
    select.value = match ? match.body.id : '';
    this.config.changed?.();
  }

  onChange(/** @type {() => void} */ handler) {
    addEvent(this.config.select, 'change', handler);
  }

  hide() {
    this.config.boxes.forEach((box) => pfShow(box, false));
  }
}

Object.assign(window, {
  PfUniverseSetting, PfBodySelect, PfLockedUniverse, PfCoordsSelect, PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS, PF_UNIVERSE_TOP_SCORE,
  PF_UNIVERSE_DEF_DEBRIS, PF_UNIVERSE_SYSTEMS, PF_UNIVERSE_DONUT_SYSTEM,
});
