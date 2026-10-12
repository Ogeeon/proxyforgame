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
// The planet's life-form building and research levels are filled in as the
// "from" levels of the build tables, for convenience only: they are not bound,
// so an edit there stays the calculator's. A profile with no planet leaves the
// planet's fields to the calculator, and so does a planet with no life form for
// the race. The build tables and the
// available resources are the calculator's own
// and keep going to options_lfcosts; the profile-owned keys are written there
// with the values they had before the profile, so "no profile" shows them
// untouched. The economy speed comes from the profile's universe.

'use strict';

/** @type {ProfilePrmField[]} */
const LFCOSTS_ACCOUNT_FIELDS = [
  pfLevelField('research.121', 'ionTechLevel', '#ion-tech-level'),
  pfLevelField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  {
    // The calculator has no "no class": a profile without one shows as collector.
    key: 'class', prm: 'playerClass', input: '#class-0',
    get: (p) => pfNum(p.playerClass) + 1,
    show: (v) => setChecked('#class-' + Math.min(2, Math.max(0, pfNum(v) - 1)), true),
    display: (v) => pfLabelFor('class-' + (pfNum(v) - 1)),
  },
  pfPercentField('lf.ship.202.cargo', 'capIncrSC', '#sc-capacity-increase'),
  pfPercentField('lf.ship.203.cargo', 'capIncrLC', '#lc-capacity-increase'),
  // The game lists the reduction of life-form research under one of them,
  // 11201, and sums only the global bonuses there (Research Speed techs): the
  // planet's third building is not in it, the calculator adds that itself.
  pfPercentField('lf.cost.11201.cost', 'researchCostReduction', '#research-cost-reduction'),
  pfPercentField('lf.cost.11201.time', 'researchTimeReduction', '#research-time-reduction'),
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
  pfLevelField('building.14', 'robotFactoryLevel', '#robot-factory-level'),
  pfLevelField('building.15', 'naniteFactoryLevel', '#nanite-factory-level'),
  pfLevelField('lf.building.' + lfBuildingGameId(2, 8), 'megalithLvl', '#megalith-level'),
  pfLevelField('lf.building.' + lfBuildingGameId(2, 11), 'mineralResCntrLvl', '#mrc-level'),
  // Each race's third building cuts the cost and time of life-form research.
  pfLevelField('lf.building.' + lfBuildingGameId(1, 3), 'resCentreLvl', '#research-centre-level'),
  pfLevelField('lf.building.' + lfBuildingGameId(2, 3), 'runeTechLvl', '#rune-tech-level'),
  pfLevelField('lf.building.' + lfBuildingGameId(3, 3), 'rbtResCentreLvl', '#rbt-res-centre-level'),
  pfLevelField('lf.building.' + lfBuildingGameId(4, 3), 'vortexChamberLvl', '#vortex-chamber-level'),
];

/**
 * A technology's game id is its id in this calculator plus this: building
 * 1001 is 11101, research 1101 is 11201.
 */
const LFCOSTS_GAME_ID_OFFSET = 10100;

/**
 * The profile key of a technology of this calculator: a building below x100,
 * a research from it.
 *
 * @param {number} techId
 */
function lfCostsProfileKey(techId) {
  return (techId % 1000 < 100 ? 'lf.building.' : 'lf.research.') + (techId + LFCOSTS_GAME_ID_OFFSET);
}

/** The multi-level build tables, buildings and researches, whose "from" levels the planet fills in. */
const LFCOSTS_START_TABLES = ['#table-1-1', '#table-1-2'];

/** The planet's life form: a race, or 0 when none lives there. */
const LFCOSTS_RACE_KEY = 'lf.race';

/**
 * The race of a profile planet, or null when it has no life form.
 *
 * @param {ProfilePlanet} planet
 * @returns {?number}
 */
function lfCostsPlanetRace(planet) {
  const race = pfNum(getProfileValue(planet, LFCOSTS_RACE_KEY, 0));
  return race >= 1 && race <= 4 ? race : null;
}

/** @extends {ProfileBinder<LfCostsOrchestrator>} */
class LfCostsProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {LfCostsOrchestrator} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.handleParamChange());
    addEvent('#pf-planet', 'change', () => this.planetChosen());
    // Runs after the calculator's own handler, which is bound first.
    addEvent('#tech-types-select', 'change', () => {
      const planet = this.planet(this.profile());
      if (!planet) return;
      this.fillRangeStart(planet);
      this.app.updateTab3();
    });
    // A research added to the multi-level table starts from the planet's level.
    const addResearchRow = this.app.addResearchRow.bind(this.app);
    this.app.addResearchRow = (outerTab) => {
      addResearchRow(outerTab);
      const planet = this.planet(this.profile());
      if (planet && outerTab === 1) this.fillStartLevels(planet);
    };
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
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
      this.fillPlanetStart(profile);
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
      planets.forEach((p) => select.appendChild(new Option(pfBodyLabel(p), p.id)));
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
    setVal('#race-selector', race ?? (pfNum(this.ownPrm.race) || 1));
  }

  /** @param {Profile} profile */
  fillPlanetStart(profile) {
    const planet = this.planet(profile);
    if (!planet) return;
    this.fillStartLevels(planet);
    this.fillRangeStart(planet);
    this.app.updateTab3();
  }

  /**
   * Fill in the planet's levels as the "from" levels of the multi-level
   * tables. A "to" below the new "from" is raised to it, so the row stays idle
   * rather than turning into a demolition. A row that changed is recalculated.
   *
   * @param {ProfilePlanet} planet
   */
  fillStartLevels(planet) {
    LFCOSTS_START_TABLES.forEach((table) => {
      getTableRows(table).forEach((row) => {
        if (!(row instanceof HTMLTableRowElement)) return;
        const techId = Number.parseInt(row.cells[0]?.textContent ?? '', 10);
        const from = row.cells[2]?.querySelector('input');
        const to = row.cells[3]?.querySelector('input');
        if (!techId || !from || !to) return;
        const level = pfNum(getProfileValue(planet, lfCostsProfileKey(techId), 0));
        const toLevel = Math.max(level, Number.parseInt(to.value, 10) || 0);
        if (String(level) === from.value && String(toLevel) === to.value) return;
        from.value = String(level);
        to.value = String(toLevel);
        this.app.handleRowChange(from);
      });
    });
  }

  /**
   * Fill in the range tab's "from" with the planet's level of the technology
   * picked there, and raise "to" to the next level when it is not above it.
   *
   * @param {ProfilePlanet} planet
   */
  fillRangeStart(planet) {
    const techId = Number.parseInt(getVal('#tech-types-select'), 10);
    if (!techId) return;
    const level = pfNum(getProfileValue(planet, lfCostsProfileKey(techId), 0));
    setVal('#tab2-from-level', level);
    if ((Number.parseInt(getVal('#tab2-to-level'), 10) || 0) <= level) setVal('#tab2-to-level', level + 1);
  }

  /** Recalculate every table after the form was filled from outside. */
  recalculate() {
    this.app.renderer.renderHideNShow(Number(getVal('#race-selector')));
    this.app.handleParamChange();
  }

  restoreOwn() {
    this.planetId = null;
    this.speed?.detach();
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
    setVal('#race-selector', pfNum(prm.race) || 1);
  }

  recalc() {
    this.recalculate();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot = {};
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.get(prm); });
    LFCOSTS_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.get(prm); });
    this.snapshot['planet:' + LFCOSTS_RACE_KEY] = pfNum(prm.race);
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    let changed = false;
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.get(prm)) || changed;
    });
    if (planet) {
      LFCOSTS_PLANET_FIELDS.forEach((f) => {
        changed = this.syncValue(planet, f.key, 'planet:' + f.key, f.get(prm)) || changed;
      });
      changed = this.syncValue(planet, LFCOSTS_RACE_KEY, 'planet:' + LFCOSTS_RACE_KEY, pfNum(prm.race)) || changed;
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
      this.fillPlanetStart(profile);
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
    this.describeFieldList([...LFCOSTS_ACCOUNT_FIELDS, ...LFCOSTS_PLANET_FIELDS]);
    this.pf.describeField(LFCOSTS_RACE_KEY, pfFieldLabel($('#race-selector')), pfOptionText(selectEl('#race-selector')));
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    LFCOSTS_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.speed?.mark();
    const planet = this.planet(profile);
    if (!planet) return;
    LFCOSTS_PLANET_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, planet, f.key, this.restoreBody('planets', planet.id, f.key));
    });
    // A planet with no life form leaves the race to the calculator: nothing to mark.
    if (lfCostsPlanetRace(planet) !== null) {
      this.pf.markField($('#race-selector'), profile, planet, LFCOSTS_RACE_KEY, this.restoreBody('planets', planet.id, LFCOSTS_RACE_KEY));
    }
  }
}

/**
 * Connect the LF cost calculator to the profiles, when the page has the selector.
 *
 * @returns {?LfCostsProfiles}
 */
function initLfCostsProfiles() {
  lfCostsProfiles = pfBind(LfCostsProfiles, lfCostsApp);
  return lfCostsProfiles;
}

/** @type {?LfCostsProfiles} Set once the page is wired. */
let lfCostsProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initLfCostsProfiles = initLfCostsProfiles;
}
