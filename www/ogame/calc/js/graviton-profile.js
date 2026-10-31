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
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a
//     discoverer shows as no class here) never becomes an override.
// A profile with no planet leaves the planet's fields to the calculator. The
// graviton level and the available resources are the calculator's own and
// keep going to options_graviton; the profile-owned keys are written there
// with the values they had before the profile, so "no profile" shows them
// untouched. The economy speed, the debris share and whether deuterium goes to
// the debris field come from the profile's universe; a profile with no
// universe leaves them to the calculator. The crystal and deuterium on the
// planet, as the game last reported them, fill the available resources
// (PfBodyResources).

'use strict';

/** @type {ProfilePrmField[]} */
const GRAVITON_ACCOUNT_FIELDS = [
  ...PF_ENERGY_ACCOUNT_FIELDS,
  pfConvNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  pfConvNumField('lf.ship.209.cargo', 'rcCapacityIncrease', '#rc-capacity-increase'),
];

/** The fields of the planet picked in #pf-planet. */
const GRAVITON_PLANET_FIELDS = [
  pfConvNumField('building.21', 'shipyardLevel', '#shipyard-level'),
  pfConvNumField('building.15', 'nanitesFactoryLevel', '#nanites-factory-level'),
  ...PF_ENERGY_PLANET_FIELDS,
];

/** @type {PfUniverseField[]} The settings that come from the profile's universe. */
const GRAVITON_UNIVERSE_FIELDS = [
  { kind: PF_UNIVERSE_SPEED, input: '#universe-speed', prm: 'universeSpeed' },
  { kind: PF_UNIVERSE_DEBRIS, input: '#debris-percent', prm: 'debrisPercent' },
  { kind: PF_UNIVERSE_DEUT_IN_DEBRIS, input: '#deut-in-debris', prm: 'deutInDebris' },
];

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
      universe: GRAVITON_UNIVERSE_FIELDS,
      // The officers' bonus follows the officers.
      accountAlsoOwns: ['energyBonus'],
      resources: [{
        crystal: '#crystal-available', deuterium: '#deuterium-available',
        caption: '#resources-age', captionBox: '#resources-age-row',
      }],
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
