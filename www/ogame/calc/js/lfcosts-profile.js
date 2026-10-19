// ============================================================================
// LF COSTS CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the life-form cost calculator to the active player profile
// (ADR-0004). The calculator keeps working on options.prm; PlanetPrmBinder
// projects the profile into it and writes the changes back, this file gives
// the fields and what is the calculator's own:
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
// untouched. The economy speed comes from the profile's universe; a profile
// with no universe leaves it to the calculator.

'use strict';

/** @type {ProfileConvField[]} */
const LFCOSTS_ACCOUNT_FIELDS = [
  pfConvNumField('research.121', 'ionTechLevel', '#ion-tech-level'),
  pfConvNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  pfCollectorClassField('playerClass', 'class-'),
  pfConvNumField('lf.ship.202.cargo', 'capIncrSC', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'capIncrLC', '#lc-capacity-increase'),
  // The game lists the reduction of life-form research under one of them,
  // 11201, and sums only the global bonuses there (Research Speed techs): the
  // planet's third building is not in it, the calculator adds that itself.
  pfConvNumField('lf.cost.11201.cost', 'researchCostReduction', '#research-cost-reduction'),
  pfConvNumField('lf.cost.11201.time', 'researchTimeReduction', '#research-time-reduction'),
  pfRatesField('rates', '#exchange-rates-m'),
];

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

/**
 * The fields of the planet picked in #pf-planet.
 *
 * @type {ProfileConvField[]}
 */
const LFCOSTS_PLANET_FIELDS = [
  pfConvNumField('building.14', 'robotFactoryLevel', '#robot-factory-level'),
  pfConvNumField('building.15', 'naniteFactoryLevel', '#nanite-factory-level'),
  pfConvNumField('lf.building.' + lfBuildingGameId(2, 8), 'megalithLvl', '#megalith-level'),
  pfConvNumField('lf.building.' + lfBuildingGameId(2, 11), 'mineralResCntrLvl', '#mrc-level'),
  // Each race's third building cuts the cost and time of life-form research.
  pfConvNumField('lf.building.' + lfBuildingGameId(1, 3), 'resCentreLvl', '#research-centre-level'),
  pfConvNumField('lf.building.' + lfBuildingGameId(2, 3), 'runeTechLvl', '#rune-tech-level'),
  pfConvNumField('lf.building.' + lfBuildingGameId(3, 3), 'rbtResCentreLvl', '#rbt-res-centre-level'),
  pfConvNumField('lf.building.' + lfBuildingGameId(4, 3), 'vortexChamberLvl', '#vortex-chamber-level'),
  {
    // A planet with no life form leaves the race to the calculator (see afterShowPlanet),
    // and so has nothing to mark.
    key: LFCOSTS_RACE_KEY, prm: 'race', input: '#race-selector',
    toPrm: pfNum,
    fromPrm: pfNum,
    markIf: (planet) => lfCostsPlanetRace(planet) !== null,
  },
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

/** @extends {PlanetPrmBinder<LfCostsOrchestrator>} */
class LfCostsProfiles extends PlanetPrmBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {LfCostsOrchestrator} app
   */
  constructor(pf, app) {
    super(pf, app, {
      accountFields: LFCOSTS_ACCOUNT_FIELDS,
      planetFields: LFCOSTS_PLANET_FIELDS,
      cookie: 'options_lfcosts',
      lastKey: 'lfcosts',
      universe: [[PF_UNIVERSE_SPEED, '#universe-speed']],
      universeKeys: ['universeSpeed'],
      extraOwnedKeys: [],
    });
  }

  init() {
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
    super.init();
  }

  /** @param {?Profile} profile */
  apply(profile) {
    if (profile && this.profileId === null) {
      /** @type {Record<string, any>} */
      const prm = options.prm;
      // The race is not one of the stored settings: take the form's, before it is kept as the calculator's own.
      prm.race = Number(getVal('#race-selector')) || 1;
    }
    super.apply(profile);
  }

  /** @param {Profile} profile */
  showPlanet(profile) {
    super.showPlanet(profile);
    this.fillPlanetStart(profile);
  }

  /**
   * With no planet - or a planet with no life form - the race is the
   * calculator's own.
   */
  afterShowPlanet() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(this.profile());
    if (!planet || lfCostsPlanetRace(planet) === null) prm.race = pfNum(this.ownPrm.race) || 1;
  }

  /** @param {Profile} profile */
  fillPlanetStart(profile) {
    const planet = this.planet(profile);
    if (!planet) return;
    this.fillStartLevels(planet);
    const level = this.rangeLevel(planet);
    if (level !== null) pfFollowStart(inputEl('#tab2-from-level'), inputEl('#tab2-to-level'), level, 1);
    this.app.updateTab3();
  }

  /**
   * Fill in the planet's levels as the "from" levels of the multi-level
   * tables. A row the player left alone follows the new level; one whose "to"
   * was changed by hand keeps both its levels (pfStartRange). A row that
   * changed is recalculated.
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
        if (pfFollowStart(from, to, level, 0)) this.app.handleRowChange(from);
      });
    });
  }

  /**
   * The planet's level of the technology picked on the range tab, or null
   * when none is picked.
   *
   * @param {ProfilePlanet} planet
   * @returns {?number}
   */
  rangeLevel(planet) {
    const techId = Number.parseInt(getVal('#tech-types-select'), 10);
    return techId ? pfNum(getProfileValue(planet, lfCostsProfileKey(techId), 0)) : null;
  }

  /**
   * Fill in the range tab's "from" with the planet's level of the technology
   * picked there, and raise "to" to the next level when it is not above it.
   * Another technology was picked, so whatever the player typed was for the
   * old one.
   *
   * @param {ProfilePlanet} planet
   */
  fillRangeStart(planet) {
    const level = this.rangeLevel(planet);
    if (level === null) return;
    setVal('#tab2-from-level', level);
    if ((Number.parseInt(getVal('#tab2-to-level'), 10) || 0) <= level) setVal('#tab2-to-level', level + 1);
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
