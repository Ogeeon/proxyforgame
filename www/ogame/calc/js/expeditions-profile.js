// ============================================================================
// EXPEDITIONS CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the expeditions calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> form - the account (the character class, hyperspace
//     technology, the life-form expedition bonuses to resources and ships, the
//     collector and discoverer class boosters, the active Expedition Resource
//     Booster item, and the cargo bonus of every ship in the table);
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as "other" here) never becomes an override.
// The cargo bonuses are one array in options.prm (lfShipsBonuses, in the order
// of EXPEDITION_SHIPS), not a key per ship, so they are handled here rather
// than by the field list of the base binder.
// The fleet and the dark matter discovery bonus are the calculator's own and
// keep going to options_expeditions, and so does the resource discovery booster
// of a calculator with no profile; the
// profile-owned keys are written there with the values they had before the
// profile, so "no profile" shows them untouched. The economy speed and the
// "strongest player" class come from the profile's universe; a profile with no
// universe leaves them to the calculator. There is no planet to pick: the
// calculator has no planet fields.
// A link opened with a profile active wins over it, once: the values the link
// names stay shown - the universe ones without being attached to the universe -
// and nothing from it is written into the profile until the player edits a value.

'use strict';

/** The calculator's class select: 0 discoverer, 1 collector, 2 any other class or none. */
const EXPEDITIONS_CLASS_OTHER = 2;

/** @param {*} v A profile class. */
function expeditionsClassToPrm(v) {
  const cls = pfNum(v);
  if (cls === PROFILE_CLASS.DISCOVERER) return 0;
  return cls === PROFILE_CLASS.COLLECTOR ? 1 : EXPEDITIONS_CLASS_OTHER;
}

/** @type {ProfilePrmField[]} */
const EXPEDITIONS_ACCOUNT_FIELDS = [
  // The calculator has no "no class": a profile without one shows as "other".
  pfPrmField('class', 'playerClass', '#player-class',
    expeditionsClassToPrm,
    (v) => [PROFILE_CLASS.DISCOVERER, PROFILE_CLASS.COLLECTOR][pfNum(v)] ?? PROFILE_CLASS.GENERAL,
    { display: (v) => pfOptionText(selectEl('#player-class'))(expeditionsClassToPrm(v)) }),
  pfConvNumField('research.114', 'hyperTechLevel', '#tech-hyper-level'),
  pfConvNumField('lf.expedition.resources', 'percentRes', '#percent-resources'),
  pfConvNumField('lf.expedition.ships', 'percentShips', '#percent-ships'),
  pfConvNumField('lf.classBooster.1', 'classBonusCollector', '#class-bonus-collector'),
  pfConvNumField('lf.classBooster.3', 'classBonusDiscoverer', '#class-bonus-discoverer'),
  pfConvNumField('item.expeditionResources', 'resourceDiscoveryBooster', '#resource-discovery-booster'),
];

/** @type {PfUniverseField[]} The settings that come from the profile's universe. */
const EXPEDITIONS_UNIVERSE_FIELDS = [
  { kind: PF_UNIVERSE_SPEED, input: '#universe-speed', prm: 'universeSpeed' },
  { kind: PF_UNIVERSE_TOP_SCORE, input: '#highTop', prm: 'highTop' },
];

/** The profile value key of a ship's life-form cargo bonus. */
const expeditionsCargoKey = (/** @type {{techId: number}} */ ship) => 'lf.ship.' + ship.techId + '.cargo';

/** @extends {PlanetPrmBinder<ExpeditionsApp>} */
class ExpeditionsProfiles extends PlanetPrmBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {ExpeditionsApp} app
   */
  constructor(pf, app) {
    super(pf, app, {
      accountFields: EXPEDITIONS_ACCOUNT_FIELDS,
      planetFields: [],
      cookie: 'options_expeditions',
      lastKey: 'expeditions',
      universe: EXPEDITIONS_UNIVERSE_FIELDS,
      // The array of cargo bonuses: stored with the values from before the profile.
      extraOwnedKeys: ['lfShipsBonuses'],
    });
    /** @type {Set<string>} The prm keys the page's link named, until the first apply has used them. */
    this.linkKeys = new Set();
    /** @type {Record<string, *>} The link's values of the account keys among them. */
    this.linkValues = {};
  }

  init() {
    this.describeFieldList(EXPEDITION_SHIPS.map((ship) => ({ key: expeditionsCargoKey(ship), input: '#lf-cargo-' + ship.techId })));
    // The link was applied before the binder existed: take what it named, once.
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.linkKeys = this.app.linkKeys;
    this.app.linkKeys = new Set();
    this.config.accountFields.forEach((f) => {
      if (this.linkKeys.has(f.prm)) this.linkValues[f.prm] = prm[f.prm];
    });
    super.init();
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {?Profile} profile */
  apply(profile) {
    if (this.linkKeys.size === 0) {
      super.apply(profile);
      return;
    }
    // A universe setting would replace the link's value as soon as its fetch is
    // back: the ones the link named are left out of this apply, unattached,
    // unmarked, and with nothing of theirs written to the universe's cache.
    const all = this.universeSettings;
    this.universeSettings = all.filter((setting) => !this.linkKeys.has(setting.prm));
    try {
      super.apply(profile);
    } finally {
      this.universeSettings = all;
      this.linkKeys = new Set();
      this.linkValues = {};
    }
  }

  /** The cargo bonuses of the profile, and the link's values over the account. */
  afterShowPlanet() {
    const profile = this.profile();
    if (!profile) return;
    // A new array: the one in ownPrm is the calculator's own and stays as it is.
    options.prm.lfShipsBonuses = EXPEDITION_SHIPS.map((ship) => pfNum(getProfileValue(profile.account, expeditionsCargoKey(ship))));
    Object.assign(options.prm, this.linkValues);
  }

  takeSnapshot() {
    super.takeSnapshot();
    EXPEDITION_SHIPS.forEach((ship, i) => { this.snapshot[expeditionsCargoKey(ship)] = pfNum(options.prm.lfShipsBonuses[i]); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  /**
   * The cargo bonuses, into the profile the base is syncing.
   *
   * @param {Profile} profile
   * @returns {boolean} True when the profile changed.
   */
  syncExtra(profile) {
    let changed = false;
    EXPEDITION_SHIPS.forEach((ship, i) => {
      const key = expeditionsCargoKey(ship);
      changed = this.syncValue(profile.account, key, key, pfNum(options.prm.lfShipsBonuses[i])) || changed;
    });
    return changed;
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    super.markAll();
    const profile = this.profile();
    if (!profile) return;
    EXPEDITION_SHIPS.forEach((ship) => {
      const key = expeditionsCargoKey(ship);
      this.pf.markField($('#lf-cargo-' + ship.techId), profile, profile.account, key, this.restoreAccount(key));
    });
  }
}

/**
 * Connect expeditions to the profiles, when the page has the selector.
 *
 * @returns {?ExpeditionsProfiles}
 */
function initExpeditionsProfiles() {
  expeditionsProfiles = pfBind(ExpeditionsProfiles, expeditionsApp);
  return expeditionsProfiles;
}

/** @type {?ExpeditionsProfiles} Set once the page is wired. */
let expeditionsProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initExpeditionsProfiles = initExpeditionsProfiles;
}
