// ============================================================================
// TERRAFORMER CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the terraformer calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> form - the account (energy and hyperspace
//     technology, the officers, the character and alliance class, the
//     life-form energy bonus, the Rock'tal Collector Enhancement, the
//     Terraformer cost reduction and the cargo
//     bonuses of the transports) and one planet of the profile, picked in
//     #pf-planet: its robotics, shipyard and nanite factories, its
//     temperature, its power plants and solar satellites with their production
//     percentages, its energy booster and its Disruption Chamber;
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a
//     discoverer shows as no class here) never becomes an override.
// A profile with no planet leaves the planet's fields to the calculator. The
// planet's terraformer level is put into the "from" of the level range for
// convenience only: it is not bound, so an edit there is not written back to
// the profile, and "to" is raised above it when it is not. The level range,
// the single-level switch and the available resources are the calculator's own
// and keep going to options_terraformer; the profile-owned keys and the "from"
// are written there with the values they had before the profile, so "no
// profile" shows them untouched.
// The economy speed comes from the profile's universe; a profile with no
// universe leaves it to the calculator. The crystal and deuterium on the
// planet, as the game last reported them, fill the available resources
// (PfBodyResources).

'use strict';

/** @type {ProfilePrmField[]} */
const TERRAFORMER_ACCOUNT_FIELDS = [
  ...PF_ENERGY_ACCOUNT_FIELDS,
  // The game reports a cost reduction per technology; the calculator applies
  // one number to the Terraformer's cost and time, so it takes the cost one,
  // as the cost calculator does.
  pfConvNumField('lf.cost.33.cost', 'lfTerraformerRdc', '#lf-terraformer-rdc'),
  pfConvNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfConvNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
];

/**
 * The fields of the planet picked in #pf-planet.
 *
 * @type {ProfilePrmField[]}
 */
const TERRAFORMER_PLANET_FIELDS = [
  pfConvNumField('building.14', 'robotsFactoryLevel', '#robots-factory-level'),
  // The field takes no level below 1, so a planet with no shipyard shows 1.
  pfConvNumField('building.21', 'shipyardLevel', '#shipyard-level', 1, 1),
  pfConvNumField('building.15', 'nanitesFactoryLevel', '#nanites-factory-level'),
  ...PF_ENERGY_PLANET_FIELDS,
];

/** @extends {PlanetPrmBinder<TerraformerApp>} */
class TerraformerProfiles extends PlanetPrmBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {TerraformerApp} app
   */
  constructor(pf, app) {
    super(pf, app, {
      accountFields: TERRAFORMER_ACCOUNT_FIELDS,
      planetFields: TERRAFORMER_PLANET_FIELDS,
      cookie: 'options_terraformer',
      lastKey: 'terraformer',
      universe: [{ kind: PF_UNIVERSE_SPEED, input: '#universe-speed', prm: 'universeSpeed' }],
      // The officers' bonus follows the officers.
      accountAlsoOwns: ['energyBonus'],
      // The "from" level, filled in from the planet by afterShowPlanet().
      planetAlsoOwns: ['tfLevelFrom'],
      resources: [{
        crystal: '#crystal-available', deuterium: '#deuterium-available',
        caption: '#resources-age', captionBox: '#resources-age-row',
      }],
    });
  }

  /**
   * The planet's terraformer level goes into "from", and "to" is raised to the
   * next level when it is not above it.
   */
  afterShowPlanet() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(this.profile());
    if (!planet) return;
    prm.tfLevelFrom = pfNum(getProfileValue(planet, 'building.33', 0));
    if (pfNum(prm.tfLevelTo) <= prm.tfLevelFrom) prm.tfLevelTo = prm.tfLevelFrom + 1;
  }
}

/**
 * Connect the terraformer calculator to the profiles, when the page has the selector.
 *
 * @returns {?TerraformerProfiles}
 */
function initTerraformerProfiles() {
  terraformerProfiles = pfBind(TerraformerProfiles, terraformerApp);
  return terraformerProfiles;
}

/** @type {?TerraformerProfiles} Set once the page is wired. */
let terraformerProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initTerraformerProfiles = initTerraformerProfiles;
}
