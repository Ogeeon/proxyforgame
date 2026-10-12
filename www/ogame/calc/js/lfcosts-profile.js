// ============================================================================
// LF COSTS CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the life-form cost calculator to the active player profile
// (ADR-0004). The calculator keeps working on options.prm; this file projects
// the profile into the form and writes the changes back:
//   - apply(): profile -> form - the account (ion and hyperspace technology,
//     the class, the cargo bonuses of the transports, the exchange rates, the
//     global life-form research reductions) and
//     one planet of the profile, picked in #pf-planet: its factories, its
//     life form and the life-form buildings that cut costs and times (the
//     Megalith, the Mineral Research Centre and each race's research building);
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// A profile with no planet leaves the planet's fields to the calculator, and so
// does a planet with no life form for the race. The build tables and the
// available resources are the calculator's own
// and keep going to options_lfcosts; the profile-owned keys are written there
// with the values they had before the profile, so "no profile" shows them
// untouched. The economy speed comes from the profile's universe.

'use strict';

/**
 * @typedef {Object} LfCostsField
 * @property {string} key Profile value key.
 * @property {string} prm Key in options.prm.
 * @property {string} input Selector of the field that shows it.
 * @property {(prm: Record<string, any>) => *} get The profile value the prm holds.
 * @property {(value: *) => void} show Put a profile value (or undefined) into the form.
 * @property {(value: *) => string} [display] The game value as shown in the mark.
 */

const lfCostsNum = (/** @type {*} */ v) => Number(v) || 0;

/**
 * A whole-number field.
 *
 * @param {string} key
 * @param {string} prm
 * @param {string} input
 * @returns {LfCostsField}
 */
function lfCostsLevelField(key, prm, input) {
  return {
    key, prm, input,
    get: (p) => lfCostsNum(p[prm]),
    show: (v) => setVal(input, lfCostsNum(v)),
  };
}

/**
 * A percentage field, shown with the locale's decimal separator.
 *
 * @param {string} key
 * @param {string} prm
 * @param {string} input
 * @returns {LfCostsField}
 */
function lfCostsPercentField(key, prm, input) {
  return {
    key, prm, input,
    get: (p) => lfCostsNum(p[prm]),
    show: (v) => setNumVal(input, lfCostsNum(v)),
  };
}

/**
 * The text of the label for an id, or a dash.
 *
 * @param {string} id
 */
function lfCostsLabelText(id) {
  const label = document.querySelector('label[for="' + id + '"]');
  return label ? (label.textContent || '').trim() : '—';
}

/** @type {LfCostsField[]} */
const LFCOSTS_ACCOUNT_FIELDS = [
  lfCostsLevelField('research.121', 'ionTechLevel', '#ion-tech-level'),
  lfCostsLevelField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  {
    // The calculator has no "no class": a profile without one shows as collector.
    key: 'class', prm: 'playerClass', input: '#class-0',
    get: (p) => lfCostsNum(p.playerClass) + 1,
    show: (v) => setChecked('#class-' + Math.min(2, Math.max(0, lfCostsNum(v) - 1)), true),
    display: (v) => lfCostsLabelText('class-' + (lfCostsNum(v) - 1)),
  },
  lfCostsPercentField('lf.ship.202.cargo', 'capIncrSC', '#sc-capacity-increase'),
  lfCostsPercentField('lf.ship.203.cargo', 'capIncrLC', '#lc-capacity-increase'),
  // The game lists the reduction of life-form research under one of them,
  // 11201, and sums only the global bonuses there (Research Speed techs): the
  // planet's third building is not in it, the calculator adds that itself.
  lfCostsPercentField('lf.cost.11201.cost', 'researchCostReduction', '#research-cost-reduction'),
  lfCostsPercentField('lf.cost.11201.time', 'researchTimeReduction', '#research-time-reduction'),
  {
    key: 'rates', prm: 'rates', input: '#exchange-rates-m',
    get: (p) => (Array.isArray(p.rates) ? p.rates.map(Number) : DEFAULT_RATES.slice()),
    show: (v) => {
      const rates = Array.isArray(v) && v.length === 3 ? v.map(Number) : DEFAULT_RATES;
      setNumVal('#exchange-rates-m', rates[0]);
      setNumVal('#exchange-rates-c', rates[1]);
      setNumVal('#exchange-rates-d', rates[2]);
    },
  },
];

/** The fields of the planet picked in #pf-planet, its life form aside. */
const LFCOSTS_PLANET_FIELDS = [
  lfCostsLevelField('building.14', 'robotFactoryLevel', '#robot-factory-level'),
  lfCostsLevelField('building.15', 'naniteFactoryLevel', '#nanite-factory-level'),
  lfCostsLevelField('lf.building.' + lfBuildingGameId(2, 8), 'megalithLvl', '#megalith-level'),
  lfCostsLevelField('lf.building.' + lfBuildingGameId(2, 11), 'mineralResCntrLvl', '#mrc-level'),
  // Each race's third building cuts the cost and time of life-form research.
  lfCostsLevelField('lf.building.' + lfBuildingGameId(1, 3), 'resCentreLvl', '#research-centre-level'),
  lfCostsLevelField('lf.building.' + lfBuildingGameId(2, 3), 'runeTechLvl', '#rune-tech-level'),
  lfCostsLevelField('lf.building.' + lfBuildingGameId(3, 3), 'rbtResCentreLvl', '#rbt-res-centre-level'),
  lfCostsLevelField('lf.building.' + lfBuildingGameId(4, 3), 'vortexChamberLvl', '#vortex-chamber-level'),
];

/** The planet's life form: a race, or 0 when none lives there. */
const LFCOSTS_RACE_KEY = 'lf.race';

/**
 * A planet's label in the select: its name and, when known, its coordinates.
 *
 * @param {ProfilePlanet} body
 */
function lfCostsPlanetLabel(body) {
  const c = body.coords;
  const where = c && c.galaxy !== null && c.system !== null ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
  return (body.name || '—') + where;
}

/**
 * The race of a profile planet, or null when it has no life form.
 *
 * @param {ProfilePlanet} planet
 * @returns {?number}
 */
function lfCostsPlanetRace(planet) {
  const race = lfCostsNum(getProfileValue(planet, LFCOSTS_RACE_KEY, 0));
  return race >= 1 && race <= 4 ? race : null;
}

class LfCostsProfiles {
  /**
   * @param {ProfilesUi} pf
   * @param {LfCostsOrchestrator} app
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
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.handleParamChange());
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

  /** The options.prm keys the profile may own. */
  static ownedKeys() {
    return [...LFCOSTS_ACCOUNT_FIELDS, ...LFCOSTS_PLANET_FIELDS].map((f) => f.prm).concat('race');
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
      if (this.profileId === null) {
        /** @type {Record<string, any>} */
        const prm = options.prm;
        // The race is not one of the stored settings: take the form's.
        prm.race = Number(getVal('#race-selector')) || 1;
        this.ownPrm = {};
        LfCostsProfiles.ownedKeys().forEach((key) => { this.ownPrm[key] = cloneData(prm[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      LFCOSTS_ACCOUNT_FIELDS.forEach((f) => f.show(getProfileValue(profile.account, f.key)));
      // The calculator's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.renderPlanetSelect(profile);
      this.showPlanet(profile);
      this.recalculate();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    void this.speed?.attach(profile);
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
      planets.forEach((p) => select.appendChild(new Option(lfCostsPlanetLabel(p), p.id)));
    }
    pfShow('#pf-planet-box', planets.length > 0);
    const last = this.pf.store.getLastPlanet('lfcosts', profile.id);
    const chosen = planets.find((p) => p.id === this.planetId) || planets.find((p) => p.id === last) || planets[0];
    this.planetId = chosen ? chosen.id : null;
    if (select) select.value = this.planetId || '';
  }

  /**
   * Show the planet's values. With no planet - or, for the race, a planet with
   * no life form - the calculator's own values show.
   *
   * @param {Profile} profile
   */
  showPlanet(profile) {
    const planet = this.planet(profile);
    LFCOSTS_PLANET_FIELDS.forEach((f) => f.show(planet ? getProfileValue(planet, f.key, 0) : this.ownPrm[f.prm]));
    const race = planet ? lfCostsPlanetRace(planet) : null;
    setVal('#race-selector', race ?? (lfCostsNum(this.ownPrm.race) || 1));
  }

  /** Recalculate every table after the form was filled from outside. */
  recalculate() {
    this.app.renderer.renderHideNShow(Number(getVal('#race-selector')));
    this.app.handleParamChange();
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.applying = true;
    try {
      this.profileId = null;
      this.planetId = null;
      this.pf.clearMarks();
      this.speed?.detach();
      pfShow('#reset', true);
      pfShow('#pf-planet-box', false);
      Object.assign(options.prm, cloneData(this.ownPrm));
      /** @type {Record<string, any>} */
      const prm = options.prm;
      setVal('#ion-tech-level', prm.ionTechLevel);
      setVal('#hyper-tech-level', prm.hyperTechLevel);
      setChecked('#class-' + prm.playerClass, true);
      setNumVal('#sc-capacity-increase', prm.capIncrSC);
      setNumVal('#lc-capacity-increase', prm.capIncrLC);
      LFCOSTS_ACCOUNT_FIELDS.find((f) => f.key === 'rates')?.show(prm.rates);
      LFCOSTS_PLANET_FIELDS.forEach((f) => f.show(prm[f.prm]));
      setVal('#race-selector', lfCostsNum(prm.race) || 1);
    } finally {
      this.applying = false;
    }
    this.recalculate();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot = {};
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.get(prm); });
    LFCOSTS_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.get(prm); });
    this.snapshot['planet:' + LFCOSTS_RACE_KEY] = lfCostsNum(prm.race);
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
     * @param {string} key
     * @param {string} snapKey
     * @param {*} value
     */
    const syncValue = (entity, key, snapKey, value) => {
      if (sameValue(value, this.snapshot[snapKey])) return;
      this.snapshot[snapKey] = value;
      changed = setProfileValue(entity, key, value) || changed;
    };
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => syncValue(profile.account, f.key, f.key, f.get(prm)));
    if (planet) {
      LFCOSTS_PLANET_FIELDS.forEach((f) => syncValue(planet, f.key, 'planet:' + f.key, f.get(prm)));
      syncValue(planet, LFCOSTS_RACE_KEY, 'planet:' + LFCOSTS_RACE_KEY, lfCostsNum(prm.race));
    }
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_lfcosts gets the calculator's own fields as they are, and the
   * profile-owned ones as they were before the profile. With no planet the
   * planet's fields are the calculator's own, so they are taken as they are.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    if (this.planetId === null) {
      LFCOSTS_PLANET_FIELDS.forEach((f) => { this.ownPrm[f.prm] = prm[f.prm]; });
      this.ownPrm.race = prm.race;
    }
    saveToCookie('options_lfcosts', { ...prm, ...cloneData(this.ownPrm) });
  }

  /** The player picked another planet. */
  planetChosen() {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the planet shown so far is saved first.
    this.save();
    this.planetId = getVal('#pf-planet') || null;
    if (this.planetId) this.pf.store.setLastPlanet('lfcosts', profile.id, this.planetId);
    this.applying = true;
    try {
      this.showPlanet(profile);
      this.recalculate();
      this.takeSnapshot();
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
    [...LFCOSTS_ACCOUNT_FIELDS, ...LFCOSTS_PLANET_FIELDS].forEach((f) => this.pf.describeField(f.key, pfFieldLabel($(f.input)), f.display));
    this.pf.describeField(LFCOSTS_RACE_KEY, pfFieldLabel($('#race-selector')), pfOptionText(selectEl('#race-selector')));
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
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, restoreTo(null, f.key));
    });
    this.speed?.mark();
    const planet = this.planet(profile);
    if (!planet) return;
    LFCOSTS_PLANET_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, planet, f.key, restoreTo(planet.id, f.key));
    });
    // A planet with no life form leaves the race to the calculator: nothing to mark.
    if (lfCostsPlanetRace(planet) !== null) {
      this.pf.markField($('#race-selector'), profile, planet, LFCOSTS_RACE_KEY, restoreTo(planet.id, LFCOSTS_RACE_KEY));
    }
  }
}

/**
 * Connect the LF cost calculator to the profiles, when the page has the selector.
 *
 * @returns {?LfCostsProfiles}
 */
function initLfCostsProfiles() {
  if (!pfgProfiles || !lfCostsApp) return null;
  lfCostsProfiles = new LfCostsProfiles(pfgProfiles, lfCostsApp);
  lfCostsProfiles.init();
  return lfCostsProfiles;
}

/** @type {?LfCostsProfiles} Set once the page is wired. */
let lfCostsProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initLfCostsProfiles = initLfCostsProfiles;
}
