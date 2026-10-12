// ============================================================================
// GRAVITON CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the graviton calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> form - the account (energy and hyperspace
//     technology, the officers, the character and alliance class, the
//     life-form energy bonus and the cargo bonuses of the transports and the
//     recycler) and one planet of the profile, picked in #pf-planet: its
//     shipyard and nanite factory, its temperature, its power plants and solar
//     satellites with their production percentages, its energy booster and its
//     Disruption Chamber;
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a
//     discoverer shows as no class here) never becomes an override.
// A profile with no planet leaves the planet's fields to the calculator. The
// graviton level and the available resources are the calculator's own and
// keep going to options_graviton; the profile-owned keys are written there
// with the values they had before the profile, so "no profile" shows them
// untouched. The economy speed, the debris share and whether deuterium goes to
// the debris field come from the profile's universe; a profile with no
// universe leaves them to the calculator.

'use strict';

/**
 * @typedef {Object} GravitonField
 * @property {string} key Profile value key.
 * @property {string} prm Key in options.prm.
 * @property {string} input Selector of the field that shows it.
 * @property {(v: *) => *} toPrm Profile value (or undefined) to the prm value.
 * @property {(v: *) => *} fromPrm prm value to the profile value.
 * @property {(v: *) => string} [display] The game value as shown in the mark.
 */

const gravitonNum = (/** @type {*} */ v) => Number(v) || 0;
const gravitonBool = (/** @type {*} */ v) => v === true || v === 'true';

/**
 * A number field: a level, a count, a temperature or a percentage.
 *
 * @param {string} key
 * @param {string} prm
 * @param {string} input
 * @param {number} [def] The value when the profile has none.
 * @returns {GravitonField}
 */
function gravitonNumField(key, prm, input, def = 0) {
  return {
    key, prm, input,
    toPrm: (v) => (v === undefined || v === null ? def : gravitonNum(v)),
    fromPrm: gravitonNum,
  };
}

/** @type {GravitonField[]} */
const GRAVITON_ACCOUNT_FIELDS = [
  gravitonNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  gravitonNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  ...GRAVITON_OFFICERS.map((name) => ({
    key: 'officer.' + name, prm: name, input: '#' + name, toPrm: gravitonBool, fromPrm: gravitonBool,
  })),
  {
    // The calculator has no discoverer: one shows as no class.
    key: 'class', prm: 'playerClass', input: '#player-class-0',
    toPrm: (v) => {
      const cls = gravitonNum(v);
      return cls === PROFILE_CLASS.COLLECTOR || cls === PROFILE_CLASS.GENERAL ? cls : GRAVITON_CLASS.NONE;
    },
    fromPrm: gravitonNum,
    display: (v) => {
      const label = document.querySelector('label[for="player-class-' + gravitonNum(v) + '"]');
      return label ? (label.textContent || '').trim() : '—';
    },
  },
  {
    key: 'allianceClass', prm: 'isTrader', input: '#trader-bonus',
    toPrm: (v) => gravitonNum(v) === PROFILE_ALLIANCE_CLASS.TRADER,
    fromPrm: (v) => (gravitonBool(v) ? PROFILE_ALLIANCE_CLASS.TRADER : PROFILE_ALLIANCE_CLASS.NONE),
    display: (v) => (gravitonNum(v) === PROFILE_ALLIANCE_CLASS.TRADER ? '✓' : '—'),
  },
  gravitonNumField('lf.prod.energy', 'totalLFEnrgBonus', '#total-lf-energy-bonus'),
  gravitonNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  gravitonNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  gravitonNumField('lf.ship.209.cargo', 'rcCapacityIncrease', '#rc-capacity-increase'),
];

/** The fields of the planet picked in #pf-planet. */
const GRAVITON_PLANET_FIELDS = [
  gravitonNumField('building.21', 'shipyardLevel', '#shipyard-level'),
  gravitonNumField('building.15', 'nanitesFactoryLevel', '#nanites-factory-level'),
  gravitonNumField('temperature.max', 'maxPlanetTemp', '#max-planet-temp'),
  gravitonNumField('energyBooster', 'energyBoost', '#energy-boost'),
  gravitonNumField('building.4', 'solarPlantLevel', '#solar-plant-level'),
  gravitonNumField('production.4', 'solarPlantPercent', '#solar-plant-percent', 100),
  gravitonNumField('building.12', 'fusionPlantLevel', '#fusion-plant-level'),
  gravitonNumField('production.12', 'fusionPlantPercent', '#fusion-plant-percent', 100),
  gravitonNumField('ship.212', 'solarSatellitesCount', '#solar-satellites-count'),
  gravitonNumField('production.212', 'solarSatellitesPercent', '#solar-satellites-percent', 100),
  // A Rocktal building: a planet of another life form has none.
  gravitonNumField('lf.building.' + lfBuildingGameId(2, 7), 'disChLevel', '#disr-chamber-level'),
];

/** The options.prm keys of the settings that come from the profile's universe. */
const GRAVITON_UNIVERSE_KEYS = ['universeSpeed', 'debrisPercent', 'deutInDebris'];

/**
 * A planet's label in the select: its name and, when known, its coordinates.
 *
 * @param {ProfilePlanet} body
 */
function gravitonPlanetLabel(body) {
  const c = body.coords;
  const where = c && c.galaxy !== null && c.system !== null ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
  return (body.name || '—') + where;
}

class GravitonProfiles {
  /**
   * @param {ProfilesUi} pf
   * @param {GravitonApp} app
   */
  constructor(pf, app) {
    this.pf = pf;
    this.app = app;
    /** @type {?string} The active profile's id while one is applied. */
    this.profileId = null;
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    /** @type {Record<string, *>} Values (by profile key, planet ones prefixed) at the last apply or sync. */
    this.snapshot = {};
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
    this.applying = false;
    /** @type {PfUniverseSetting[]} The universe's settings, set in init(). */
    this.universeSettings = [];
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    /**
     * @param {PfUniverseSettingKind} kind
     * @param {string} selector
     */
    const setting = (kind, selector) => new PfUniverseSetting(this.pf, kind, selector, () => this.app.recalc());
    this.universeSettings = [
      setting(PF_UNIVERSE_SPEED, '#universe-speed'),
      setting(PF_UNIVERSE_DEBRIS, '#debris-percent'),
      setting(PF_UNIVERSE_DEUT_IN_DEBRIS, '#deut-in-debris'),
    ];
    addEvent('#pf-planet', 'change', () => this.planetChosen());
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
  }

  /** @returns {?Profile} */
  profile() {
    return this.profileId ? this.pf.store.get(this.profileId) : null;
  }

  /**
   * @param {?Profile} profile
   * @returns {?ProfilePlanet}
   */
  planet(profile) {
    return profile?.planets.find((p) => p.id === this.planetId) || null;
  }

  /**
   * The options.prm keys the profile may own. The officers' bonus follows the
   * officers, and the universe settings come from the profile's universe.
   */
  static ownedKeys() {
    return [...GRAVITON_ACCOUNT_FIELDS, ...GRAVITON_PLANET_FIELDS].map((f) => f.prm).concat('energyBonus', ...GRAVITON_UNIVERSE_KEYS);
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {?Profile} profile */
  apply(profile) {
    if (!profile) {
      this.leave();
      return;
    }
    this.applying = true;
    try {
      /** @type {Record<string, any>} */
      const prm = options.prm;
      if (this.profileId === null) {
        this.ownPrm = {};
        GravitonProfiles.ownedKeys().forEach((key) => { this.ownPrm[key] = cloneData(prm[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      GRAVITON_ACCOUNT_FIELDS.forEach((f) => { prm[f.prm] = f.toPrm(getProfileValue(profile.account, f.key)); });
      // The calculator's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.renderPlanetSelect(profile);
      this.showPlanet(profile);
    } finally {
      this.applying = false;
    }
    this.universeSettings.forEach((setting) => { void setting.attach(profile); });
    this.markAll();
  }

  /**
   * Fill the planet select and choose the planet: the one picked last time in
   * this profile, else the first one.
   *
   * @param {Profile} profile
   */
  renderPlanetSelect(profile) {
    const planets = profile.planets;
    const select = selectEl('#pf-planet');
    if (select) {
      select.innerHTML = '';
      planets.forEach((p) => select.appendChild(new Option(gravitonPlanetLabel(p), p.id)));
    }
    pfShow('#pf-planet-box', planets.length > 0);
    const last = this.pf.store.getLastPlanet('graviton', profile.id);
    const chosen = planets.find((p) => p.id === this.planetId) || planets.find((p) => p.id === last) || planets[0];
    this.planetId = chosen ? chosen.id : null;
    if (select) select.value = this.planetId || '';
  }

  /**
   * Put the planet's values - or, with no planet, the calculator's own - into
   * options.prm, show the whole form and recalculate.
   *
   * @param {Profile} profile
   */
  showPlanet(profile) {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    GRAVITON_PLANET_FIELDS.forEach((f) => {
      prm[f.prm] = planet ? f.toPrm(getProfileValue(planet, f.key)) : cloneData(this.ownPrm[f.prm]);
    });
    this.app._restoreFromState();
    this.app.recalc();
    this.takeSnapshot();
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.applying = true;
    try {
      this.profileId = null;
      this.planetId = null;
      this.pf.clearMarks();
      this.universeSettings.forEach((setting) => setting.detach());
      pfShow('#reset', true);
      pfShow('#pf-planet-box', false);
      Object.assign(options.prm, cloneData(this.ownPrm));
      this.app._restoreFromState();
    } finally {
      this.applying = false;
    }
    this.app.recalc();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot = {};
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.fromPrm(prm[f.prm]); });
    GRAVITON_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.fromPrm(prm[f.prm]); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  save() {
    if (this.profileId === null) {
      this.ownSave();
      return;
    }
    if (this.applying) return;
    this.sync();
    this.saveOwn();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    let changed = false;
    /**
     * @param {{values: LayeredValues}} entity
     * @param {GravitonField} f
     * @param {string} snapKey
     */
    const syncValue = (entity, f, snapKey) => {
      const value = f.fromPrm(prm[f.prm]);
      if (sameValue(value, this.snapshot[snapKey])) return;
      this.snapshot[snapKey] = value;
      changed = setProfileValue(entity, f.key, value) || changed;
    };
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => syncValue(profile.account, f, f.key));
    if (planet) GRAVITON_PLANET_FIELDS.forEach((f) => syncValue(planet, f, 'planet:' + f.key));
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_graviton gets the calculator's own fields as they are, and the
   * profile-owned ones as they were before the profile. With no planet the
   * planet's fields are the calculator's own, so they are taken as they are,
   * and so are the universe settings of a profile with no universe.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    if (this.planetId === null) {
      GRAVITON_PLANET_FIELDS.forEach((f) => { this.ownPrm[f.prm] = prm[f.prm]; });
    }
    if (!this.profile()?.universe) {
      GRAVITON_UNIVERSE_KEYS.forEach((key) => { this.ownPrm[key] = prm[key]; });
    }
    saveToCookie('options_graviton', { ...prm, ...cloneData(this.ownPrm) });
  }

  /** The player picked another planet. */
  planetChosen() {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the planet shown so far is saved first.
    this.save();
    this.planetId = getVal('#pf-planet') || null;
    if (this.planetId) this.pf.store.setLastPlanet('graviton', profile.id, this.planetId);
    this.applying = true;
    try {
      this.showPlanet(profile);
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    [...GRAVITON_ACCOUNT_FIELDS, ...GRAVITON_PLANET_FIELDS].forEach((f) => {
      const el = $(f.input);
      const display = f.display || (el instanceof HTMLSelectElement ? pfOptionText(el) : undefined);
      this.pf.describeField(f.key, pfFieldLabel(el), display);
    });
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    /**
     * Restore one game value on a fresh copy of the profile: the one marked
     * may be stale by the time the button is clicked.
     *
     * @param {?string} planetId Null for the account.
     * @param {string} key
     */
    const restoreTo = (planetId, key) => () => {
      const fresh = this.pf.store.get(profile.id);
      if (!fresh) return;
      const target = planetId ? fresh.planets.find((p) => p.id === planetId) : fresh.account;
      if (target && resetProfileValue(target, key)) this.pf.store.save(fresh);
    };
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, restoreTo(null, f.key));
    });
    this.universeSettings.forEach((setting) => setting.mark());
    const planet = this.planet(profile);
    if (!planet) return;
    GRAVITON_PLANET_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, planet, f.key, restoreTo(planet.id, f.key));
    });
  }
}

/**
 * Connect the graviton calculator to the profiles, when the page has the selector.
 *
 * @returns {?GravitonProfiles}
 */
function initGravitonProfiles() {
  if (!pfgProfiles || !gravitonApp) return null;
  gravitonProfiles = new GravitonProfiles(pfgProfiles, gravitonApp);
  gravitonProfiles.init();
  return gravitonProfiles;
}

/** @type {?GravitonProfiles} Set once the page is wired. */
let gravitonProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initGravitonProfiles = initGravitonProfiles;
}
