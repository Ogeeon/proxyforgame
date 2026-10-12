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

/** @type {ProfileConvField[]} */
const GRAVITON_ACCOUNT_FIELDS = [
  pfConvNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  pfConvNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  ...pfOfficerFields(GRAVITON_OFFICERS),
  // The calculator has no discoverer: one shows as no class.
  pfClassField('playerClass', 'player-class-', GRAVITON_CLASS.NONE),
  pfTraderField('isTrader', '#trader-bonus'),
  pfConvNumField('lf.prod.energy', 'totalLFEnrgBonus', '#total-lf-energy-bonus'),
  pfConvNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  pfConvNumField('lf.ship.209.cargo', 'rcCapacityIncrease', '#rc-capacity-increase'),
];

/** The fields of the planet picked in #pf-planet. */
const GRAVITON_PLANET_FIELDS = [
  pfConvNumField('building.21', 'shipyardLevel', '#shipyard-level'),
  pfConvNumField('building.15', 'nanitesFactoryLevel', '#nanites-factory-level'),
  pfConvNumField('temperature.max', 'maxPlanetTemp', '#max-planet-temp'),
  pfConvNumField('energyBooster', 'energyBoost', '#energy-boost'),
  pfConvNumField('building.4', 'solarPlantLevel', '#solar-plant-level'),
  pfConvNumField('production.4', 'solarPlantPercent', '#solar-plant-percent', 100),
  pfConvNumField('building.12', 'fusionPlantLevel', '#fusion-plant-level'),
  pfConvNumField('production.12', 'fusionPlantPercent', '#fusion-plant-percent', 100),
  pfConvNumField('ship.212', 'solarSatellitesCount', '#solar-satellites-count'),
  pfConvNumField('production.212', 'solarSatellitesPercent', '#solar-satellites-percent', 100),
  // A Rocktal building: a planet of another life form has none.
  pfConvNumField('lf.building.' + lfBuildingGameId(2, 7), 'disChLevel', '#disr-chamber-level'),
];

/** The options.prm keys of the settings that come from the profile's universe. */
const GRAVITON_UNIVERSE_KEYS = ['universeSpeed', 'debrisPercent', 'deutInDebris'];

/** @extends {PlanetPrmBinder<GravitonApp>} */
class GravitonProfiles extends PlanetPrmBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {GravitonApp} app
   */
  constructor(pf, app) {
    super(pf, app, {
      accountFields: GRAVITON_ACCOUNT_FIELDS,
      planetFields: GRAVITON_PLANET_FIELDS,
      cookie: 'options_graviton',
      lastKey: 'graviton',
      universe: [
        [PF_UNIVERSE_SPEED, '#universe-speed'],
        [PF_UNIVERSE_DEBRIS, '#debris-percent'],
        [PF_UNIVERSE_DEUT_IN_DEBRIS, '#deut-in-debris'],
      ],
      universeKeys: GRAVITON_UNIVERSE_KEYS,
      // The officers' bonus follows the officers.
      extraOwnedKeys: ['energyBonus'],
    });
  }
}

/**
 * Connect the graviton calculator to the profiles, when the page has the selector.
 *
 * @returns {?GravitonProfiles}
 */
function initGravitonProfiles() {
  gravitonProfiles = pfBind(GravitonProfiles, gravitonApp);
  return gravitonProfiles;
}

/** @type {?GravitonProfiles} Set once the page is wired. */
let gravitonProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initGravitonProfiles = initGravitonProfiles;
}
