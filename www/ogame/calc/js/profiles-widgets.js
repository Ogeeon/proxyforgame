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

/**
 * A moment as a date and time in the page's language - the <html lang> the
 * site set from the URL (/ru/ -> ru) - rather than the browser's.
 *
 * @param {number} ms Unix milliseconds.
 * @returns {string}
 */
function pfPageDateTime(ms) {
  const date = new Date(ms);
  try {
    return date.toLocaleString(document.documentElement.lang || undefined);
  } catch {
    // A tag the browser does not take: its own language then.
    return date.toLocaleString();
  }
}

/** The resources a reading carries, as BodyResources names them. */
const PF_RESOURCE_KEYS = /** @type {const} */ (['metal', 'crystal', 'deuterium']);

/**
 * One set of a calculator's resource fields - whichever of metal, crystal and
 * deuterium it has a field for - and the caption that says how old the
 * reading in them is.
 *
 * @typedef {object} PfResourceGroup
 * @property {string} [metal] Selector of the metal field; a group without one leaves metal out.
 * @property {string} [crystal]
 * @property {string} [deuterium]
 * @property {string} caption Selector of the element the age caption is written into.
 * @property {string} [captionBox] Selector of what is hidden with the caption, such as its
 *   table row; the caption itself by default.
 */

/**
 * @typedef {object} PfBodyResourcesConfig
 * @property {PfResourceGroup[]} groups Every group gets the same reading.
 * @property {() => ?string} body Our own id of the body shown (the value of #pf-planet,
 *   #pf-moon...); null for none.
 * @property {() => void} recalc Recalculate after fields were filled.
 * @property {boolean} [linked] The calculator copies a value typed into one group into the
 *   same field of every other group: typing counts as an edit of them all.
 */

/**
 * @typedef {object} PfResourceField
 * @property {HTMLInputElement} el
 * @property {'metal'|'crystal'|'deuterium'} key
 * @property {boolean} edited Typed into by the player since it was last filled.
 * @property {?number} at The time of the reading it shows; null when it shows none.
 */

/**
 * The resources on the body a calculator shows, as the game last reported them
 * (profileBodyResources), in the calculator's resource fields. They stay the
 * calculator's fields - nothing is written back to the profile, nothing is
 * marked; the profile only fills them in (planResourceFill): every field when
 * another profile or body is shown or the page loads, and only the fields the
 * player has not touched when a Sync brings a newer reading. A caption under
 * each group says how old the reading is, in a warning colour after an hour,
 * and goes once the player types into one of its fields. A body without a
 * reading puts the fields that still show the reading of the body before back
 * to 0, and leaves the ones the player typed into alone; with no reading shown
 * before - a page load among them - the calculator's own values stay. A
 * binder calls show() whenever it showed a profile or another body, and
 * clear() when it leaves the profile: the values stay then too.
 */
class PfBodyResources {
  /**
   * @param {ProfilesUi} pf
   * @param {PfBodyResourcesConfig} config
   */
  constructor(pf, config) {
    this.pf = pf;
    this.config = config;
    /** @type {Array<{group: PfResourceGroup, fields: PfResourceField[]}>} */
    this.groups = config.groups.map((group) => ({ group, fields: PF_RESOURCE_KEYS.flatMap((key) => {
      const selector = group[key];
      const el = selector ? document.querySelector(selector) : null;
      return el instanceof HTMLInputElement ? [{ el, key, edited: false, at: null }] : [];
    }) }));
    /** @type {?ResourceFillShown} What the fields showed last; null while no profile is shown. */
    this.shown = null;
    /** @type {?ReturnType<typeof setInterval>} Repaints the captions while one is shown, as they age. */
    this.timer = null;
    this.groups.forEach((g) => g.fields.forEach((f) => {
      // `input` comes from the player only: the page's own writes do not raise it.
      f.el.addEventListener('input', () => {
        if (this.config.linked) {
          this.eachField((other) => { if (other.key === f.key) other.edited = true; });
          this.paintAll();
        } else {
          f.edited = true;
          this.paint(g);
        }
      });
    }));
  }

  /** @param {(f: PfResourceField) => void} fn */
  eachField(fn) {
    this.groups.forEach((g) => g.fields.forEach(fn));
  }

  /**
   * Fill the fields from the body the binder shows now, as far as the rules
   * say (planResourceFill), and recalculate when a field changed.
   *
   * @param {Profile} profile
   */
  show(profile) {
    const bodyId = this.config.body();
    const reading = bodyId === null ? null : profileBodyResources(profile, bodyId);
    const sameBody = this.shown?.profileId === profile.id && this.shown.bodyId === bodyId;
    const plan = planResourceFill(this.shown, profile.id, bodyId, reading);
    if (plan === 'keep') return;
    let changed = false;
    this.shown = { profileId: profile.id, bodyId, at: reading ? reading.at : null };
    if (!reading || plan === 'none') {
      // A field still showing the reading of the body before would pass it off
      // as this body's: it goes back to 0, its caption along. What the player
      // typed stays.
      this.eachField((f) => {
        if (f.at !== null && !f.edited && f.el.value !== '0') {
          f.el.value = '0';
          changed = true;
        }
        f.at = null;
        if (!sameBody) f.edited = false;
      });
    } else {
      if (!sameBody) this.forget();
      this.eachField((f) => {
        // A Sync does not take a field from under the player.
        if (plan === 'refresh' && (f.edited || f.el === document.activeElement)) return;
        const value = String(Math.max(0, Math.floor(reading[f.key])));
        if (f.el.value !== value) {
          f.el.value = value;
          changed = true;
        }
        f.edited = false;
        f.at = reading.at;
      });
    }
    this.paintAll();
    if (changed) this.config.recalc();
  }

  /** The profile is left: the fields stay as they are, the captions go. */
  clear() {
    this.shown = null;
    this.forget();
    this.paintAll();
  }

  /** Forget what the fields showed and what the player typed. */
  forget() {
    this.eachField((f) => {
      f.edited = false;
      f.at = null;
    });
  }

  paintAll() {
    let anyShown = false;
    this.groups.forEach((g) => { anyShown = this.paint(g) || anyShown; });
    if (anyShown && this.timer === null) {
      this.timer = setInterval(() => this.paintAll(), 60 * 1000);
    } else if (!anyShown && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Show a group's caption with the age of the oldest reading its fields show,
   * or hide it when a field shows none or was typed into.
   *
   * @param {{group: PfResourceGroup, fields: PfResourceField[]}} g
   * @returns {boolean} Whether the caption is shown.
   */
  paint(g) {
    const { caption, captionBox } = g.group;
    const shown = g.fields.length > 0 && g.fields.every((f) => !f.edited && f.at !== null);
    pfShow(captionBox ?? caption, shown);
    const el = $(caption);
    if (!shown || !el) return shown;
    const at = Math.min(...g.fields.map((f) => f.at ?? 0));
    el.textContent = formatString(this.pf.text.resourcesAsOf, pfPageDateTime(at));
    const stale = isResourceReadingStale(at, Date.now());
    el.classList.toggle('text-body-secondary', !stale);
    el.classList.toggle('text-warning-emphasis', stale);
    return shown;
  }
}

Object.assign(window, {
  PfBodyResources,
  PfUniverseSetting, PfBodySelect, PfLockedUniverse, PfCoordsSelect, PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS, PF_UNIVERSE_TOP_SCORE,
  PF_UNIVERSE_DEF_DEBRIS, PF_UNIVERSE_SYSTEMS, PF_UNIVERSE_DONUT_SYSTEM,
});
