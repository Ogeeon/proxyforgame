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
 * A number field: a level, a count, a temperature or a percentage.
 *
 * @param {string} key
 * @param {string} prm
 * @param {string} input
 * @param {number} [def] The value when the profile has none.
 * @returns {ProfileConvField}
 */
function gravitonNumField(key, prm, input, def = 0) {
  return {
    key, prm, input,
    toPrm: (v) => (v === undefined || v === null ? def : pfNum(v)),
    fromPrm: pfNum,
  };
}

/** @type {ProfileConvField[]} */
const GRAVITON_ACCOUNT_FIELDS = [
  gravitonNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  gravitonNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  ...GRAVITON_OFFICERS.map((name) => ({
    key: 'officer.' + name, prm: name, input: '#' + name, toPrm: pfBool, fromPrm: pfBool,
  })),
  {
    // The calculator has no discoverer: one shows as no class.
    key: 'class', prm: 'playerClass', input: '#player-class-0',
    toPrm: (v) => {
      const cls = pfNum(v);
      return cls === PROFILE_CLASS.COLLECTOR || cls === PROFILE_CLASS.GENERAL ? cls : GRAVITON_CLASS.NONE;
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

/** @extends {ProfileBinder<GravitonApp>} */
class GravitonProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {GravitonApp} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    this.planetSelect = new PfBodySelect(pf, {
      select: '#pf-planet', box: '#pf-planet-box', bodies: (p) => p.planets, lastKey: 'graviton',
    });
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
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
    this.planetSelect.onChange(() => this.planetChosen());
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
      this.planetId = this.planetSelect.render(profile, this.planetId);
      this.showPlanet(profile);
    } finally {
      this.applying = false;
    }
    this.universeSettings.forEach((setting) => { void setting.attach(profile); });
    this.markAll();
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
    this.app.restoreFromState();
    this.app.recalc();
    this.takeSnapshot();
  }

  restoreOwn() {
    this.planetId = null;
    this.universeSettings.forEach((setting) => setting.detach());
    this.planetSelect.hide();
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
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.fromPrm(prm[f.prm]); });
    GRAVITON_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.fromPrm(prm[f.prm]); });
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
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.fromPrm(prm[f.prm])) || changed;
    });
    if (planet) {
      GRAVITON_PLANET_FIELDS.forEach((f) => {
        changed = this.syncValue(planet, f.key, 'planet:' + f.key, f.fromPrm(prm[f.prm])) || changed;
      });
    }
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
    this.planetId = this.planetSelect.chosen(profile);
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
    this.describeFieldList([...GRAVITON_ACCOUNT_FIELDS, ...GRAVITON_PLANET_FIELDS]);
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    GRAVITON_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.universeSettings.forEach((setting) => setting.mark());
    const planet = this.planet(profile);
    if (!planet) return;
    GRAVITON_PLANET_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, planet, f.key, this.restoreBody('planets', planet.id, f.key));
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
