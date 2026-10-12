// ============================================================================
// TERRAFORMER CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the terraformer calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> form - the account (energy and hyperspace
//     technology, the officers, the character and alliance class, the
//     life-form energy bonus, the Terraformer cost reduction and the cargo
//     bonuses of the transports) and one planet of the profile, picked in
//     #pf-planet: its robotics, shipyard and nanite factories, its
//     temperature, its power plants and solar satellites with their production
//     percentages, its energy booster and its Disruption Chamber;
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a
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
// universe leaves it to the calculator.

'use strict';

/**
 * A number field: a level, a count, a temperature or a percentage.
 *
 * @param {string} key
 * @param {string} prm
 * @param {string} input
 * @param {number} [def] The value when the profile has none.
 * @returns {ProfileConvField}
 */
function terraformerNumField(key, prm, input, def = 0) {
  return {
    key, prm, input,
    toPrm: (v) => (v === undefined || v === null ? def : pfNum(v)),
    fromPrm: pfNum,
  };
}

/** @type {ProfileConvField[]} */
const TERRAFORMER_ACCOUNT_FIELDS = [
  terraformerNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  terraformerNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  ...TERRAFORMER_OFFICERS.map((name) => ({
    key: 'officer.' + name, prm: name, input: '#' + name, toPrm: pfBool, fromPrm: pfBool,
  })),
  {
    // The calculator has no discoverer: one shows as no class.
    key: 'class', prm: 'playerClass', input: '#player-class-0',
    toPrm: (v) => {
      const cls = pfNum(v);
      return cls === PROFILE_CLASS.COLLECTOR || cls === PROFILE_CLASS.GENERAL ? cls : TERRAFORMER_CLASS.NONE;
    },
    fromPrm: pfNum,
    display: (v) => {
      const label = document.querySelector('label[for="player-class-' + pfNum(v) + '"]');
      return label ? (label.textContent || '').trim() : '—';
    },
  },
  {
    key: 'allianceClass', prm: 'isTrader', input: '#trader-bonus',
    toPrm: (v) => pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER,
    fromPrm: (v) => (pfBool(v) ? PROFILE_ALLIANCE_CLASS.TRADER : PROFILE_ALLIANCE_CLASS.NONE),
    display: (v) => (pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER ? '✓' : '—'),
  },
  terraformerNumField('lf.prod.energy', 'totalLFEnrgBonus', '#total-lf-energy-bonus'),
  // The game reports a cost reduction per technology; the calculator applies
  // one number to the Terraformer's cost and time, so it takes the cost one,
  // as the cost calculator does.
  terraformerNumField('lf.cost.33.cost', 'lfTerraformerRdc', '#lf-terraformer-rdc'),
  terraformerNumField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  terraformerNumField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
];

/**
 * The fields of the planet picked in #pf-planet.
 *
 * @type {ProfileConvField[]}
 */
const TERRAFORMER_PLANET_FIELDS = [
  terraformerNumField('building.14', 'robotsFactoryLevel', '#robots-factory-level'),
  {
    // The field takes no level below 1, so a planet with no shipyard shows 1.
    key: 'building.21', prm: 'shipyardLevel', input: '#shipyard-level',
    toPrm: (v) => Math.max(1, v === undefined || v === null ? 1 : pfNum(v)),
    fromPrm: pfNum,
  },
  terraformerNumField('building.15', 'nanitesFactoryLevel', '#nanites-factory-level'),
  terraformerNumField('temperature.max', 'maxPlanetTemp', '#max-planet-temp'),
  terraformerNumField('energyBooster', 'energyBoost', '#energy-boost'),
  terraformerNumField('building.4', 'solarPlantLevel', '#solar-plant-level'),
  terraformerNumField('production.4', 'solarPlantPercent', '#solar-plant-percent', 100),
  terraformerNumField('building.12', 'fusionPlantLevel', '#fusion-plant-level'),
  terraformerNumField('production.12', 'fusionPlantPercent', '#fusion-plant-percent', 100),
  terraformerNumField('ship.212', 'solarSatellitesCount', '#solar-satellites-count'),
  terraformerNumField('production.212', 'solarSatellitesPercent', '#solar-satellites-percent', 100),
  // A Rocktal building: a planet of another life form has none.
  terraformerNumField('lf.building.' + lfBuildingGameId(2, 7), 'disChLevel', '#disr-chamber-level'),
];

/** The options.prm keys of the settings that come from the profile's universe. */
const TERRAFORMER_UNIVERSE_KEYS = ['universeSpeed'];

/** @extends {ProfileBinder<TerraformerApp>} */
class TerraformerProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {TerraformerApp} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
    /** @type {PfUniverseSetting[]} The universe's settings, set in init(). */
    this.universeSettings = [];
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    this.universeSettings = [
      new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.recalc()),
    ];
    addEvent('#pf-planet', 'change', () => this.planetChosen());
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

  /**
   * The options.prm keys the profile may own. The officers' bonus follows the
   * officers, the economy speed comes from the profile's universe, and the
   * "from" level is filled in from the planet.
   */
  static ownedKeys() {
    return [...TERRAFORMER_ACCOUNT_FIELDS, ...TERRAFORMER_PLANET_FIELDS].map((f) => f.prm).concat('energyBonus', 'tfLevelFrom', ...TERRAFORMER_UNIVERSE_KEYS);
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
        TerraformerProfiles.ownedKeys().forEach((key) => { this.ownPrm[key] = cloneData(prm[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      TERRAFORMER_ACCOUNT_FIELDS.forEach((f) => { prm[f.prm] = f.toPrm(getProfileValue(profile.account, f.key)); });
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
      planets.forEach((p) => select.appendChild(new Option(pfBodyLabel(p), p.id)));
    }
    pfShow('#pf-planet-box', planets.length > 0);
    const last = this.pf.store.getLastPlanet('terraformer', profile.id);
    const chosen = planets.find((p) => p.id === this.planetId) || planets.find((p) => p.id === last) || planets[0];
    this.planetId = chosen ? chosen.id : null;
    if (select) select.value = this.planetId || '';
  }

  /**
   * Put the planet's values - or, with no planet, the calculator's own - into
   * options.prm, show the whole form and recalculate. The planet's
   * terraformer level goes into "from", and "to" is raised to the next level
   * when it is not above it.
   *
   * @param {Profile} profile
   */
  showPlanet(profile) {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    TERRAFORMER_PLANET_FIELDS.forEach((f) => {
      prm[f.prm] = planet ? f.toPrm(getProfileValue(planet, f.key)) : cloneData(this.ownPrm[f.prm]);
    });
    prm.tfLevelFrom = planet ? pfNum(getProfileValue(planet, 'building.33', 0)) : cloneData(this.ownPrm.tfLevelFrom);
    if (planet && pfNum(prm.tfLevelTo) <= prm.tfLevelFrom) prm.tfLevelTo = prm.tfLevelFrom + 1;
    this.app.restoreFromState();
    this.app.recalc();
    this.takeSnapshot();
  }

  restoreOwn() {
    this.planetId = null;
    this.universeSettings.forEach((setting) => setting.detach());
    pfShow('#pf-planet-box', false);
    Object.assign(options.prm, cloneData(this.ownPrm));
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot = {};
    TERRAFORMER_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.fromPrm(prm[f.prm]); });
    TERRAFORMER_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.fromPrm(prm[f.prm]); });
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
    TERRAFORMER_ACCOUNT_FIELDS.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.fromPrm(prm[f.prm])) || changed;
    });
    if (planet) {
      TERRAFORMER_PLANET_FIELDS.forEach((f) => {
        changed = this.syncValue(planet, f.key, 'planet:' + f.key, f.fromPrm(prm[f.prm])) || changed;
      });
    }
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_terraformer gets the calculator's own fields as they are, and the
   * profile-owned ones as they were before the profile. With no planet the
   * planet's fields are the calculator's own, so they are taken as they are,
   * and so are "from" and the economy speed of a profile with no universe.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    if (this.planetId === null) {
      TERRAFORMER_PLANET_FIELDS.forEach((f) => { this.ownPrm[f.prm] = prm[f.prm]; });
      this.ownPrm.tfLevelFrom = prm.tfLevelFrom;
    }
    if (!this.profile()?.universe) {
      TERRAFORMER_UNIVERSE_KEYS.forEach((key) => { this.ownPrm[key] = prm[key]; });
    }
    saveToCookie('options_terraformer', { ...prm, ...cloneData(this.ownPrm) });
  }

  /** The player picked another planet. */
  planetChosen() {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the planet shown so far is saved first.
    this.save();
    this.planetId = getVal('#pf-planet') || null;
    if (this.planetId) this.pf.store.setLastPlanet('terraformer', profile.id, this.planetId);
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
    this.describeFieldList([...TERRAFORMER_ACCOUNT_FIELDS, ...TERRAFORMER_PLANET_FIELDS]);
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    TERRAFORMER_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.universeSettings.forEach((setting) => setting.mark());
    const planet = this.planet(profile);
    if (!planet) return;
    TERRAFORMER_PLANET_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, planet, f.key, this.restoreBody('planets', planet.id, f.key));
    });
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
