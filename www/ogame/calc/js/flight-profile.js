// ============================================================================
// FLIGHT CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the flight calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> options.prm (drives, class, alliance class,
//     life-form bonuses) and the profile's universe into the universe picker;
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// Everything else - departure, destination, ships, times, the universe
// settings - is the calculator's own and keeps going to options_flight. The
// profile-owned keys are written there with the values they had before the
// profile, so "no profile" shows them untouched.
// Two conveniences read the profile without binding: #pf-departure copies a
// planet's or moon's coordinates into the departure point, and #pf-take-fleet
// copies the ships stationed there into the ship counts.

'use strict';

/** Life-form bonus columns of #lf-ships-bonuses, in cell order. */
const FLIGHT_LF_STATS = ['speed', 'cargo', 'fuel'];

/**
 * The input of the per-ship bonus table for ship row `i` and stat column `j`.
 *
 * @param {number} i
 * @param {number} j
 * @returns {?HTMLElement}
 */
function flightLfBonusInput(i, j) {
  // The table is static, so its rows are reached by index rather than by a
  // selector query per field: a mark pass resolves all 45 of them.
  const table = document.getElementById('lf-ships-bonuses');
  const row = table instanceof HTMLTableElement ? table.rows[i + 1] : undefined;
  return row ? row.getElementsByTagName('input')[j] || null : null;
}

/** @type {ProfileField[]} */
const FLIGHT_ACCOUNT_FIELDS = [
  ...[['research.115', '#cmb-drive'], ['research.117', '#imp-drive'], ['research.118', '#hyp-drive']].map(([key, input], i) => ({
    key,
    input,
    read: (/** @type {Record<string, any>} */ prm) => pfNum(prm.driveLevels[i]),
    write: (/** @type {Record<string, any>} */ prm, /** @type {*} */ v) => { prm.driveLevels[i] = pfNum(v); },
  })),
  pfConvNumField('research.114', 'hyperTechLvl', '#hypertech-lvl'),
  // Flight has no "no class": a profile without one shows as collector.
  pfCollectorClassField('playerClass', 'class-'),
  {
    // The researcher alliance brings the fleet nothing and has no radio: it shows as none.
    key: 'allianceClass', input: '#alliance-class-none',
    read: (prm) => {
      if (prm.traderBonus === true) return PROFILE_ALLIANCE_CLASS.TRADER;
      return prm.warriorBonus === true ? PROFILE_ALLIANCE_CLASS.WARRIOR : PROFILE_ALLIANCE_CLASS.NONE;
    },
    write: (prm, v) => {
      prm.traderBonus = pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER;
      prm.warriorBonus = pfNum(v) === PROFILE_ALLIANCE_CLASS.WARRIOR;
    },
    display: (v) => {
      if (pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER) return pfLabelFor('trader-bonus');
      return pfLabelFor(pfNum(v) === PROFILE_ALLIANCE_CLASS.WARRIOR ? 'warrior-bonus' : 'alliance-class-none');
    },
  },
  pfConvNumField('lf.classBooster.1', 'lfRocktalCE', '#lf-rocktal-collector-enh'),
  pfConvNumField('lf.classBooster.2', 'lfMechanGE', '#lf-mechan-general-enh'),
  ...FLIGHT_SHIP_IDS.flatMap((shipId, i) => FLIGHT_LF_STATS.map((stat, j) => ({
    key: 'lf.ship.' + shipId + '.' + stat,
    input: () => flightLfBonusInput(i, j),
    read: (/** @type {Record<string, any>} */ prm) => pfNum(prm.lfShipsBonuses[i]?.[j]),
    write: (/** @type {Record<string, any>} */ prm, /** @type {*} */ v) => { prm.lfShipsBonuses[i][j] = pfNum(v); },
  }))),
];

/** The options.prm keys the account fields above live in. */
const FLIGHT_ACCOUNT_PRM_KEYS = ['driveLevels', 'hyperTechLvl', 'playerClass', 'traderBonus', 'warriorBonus',
  'lfRocktalCE', 'lfMechanGE', 'lfShipsBonuses'];

/** @extends {FlatSettingsBinder<ProfileField>} */
class FlightProfiles extends FlatSettingsBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {*} orchestrator The FlightOrchestrator of the page.
   */
  constructor(pf, orchestrator) {
    super(pf, orchestrator, {
      fields: FLIGHT_ACCOUNT_FIELDS,
      settings: () => options.prm,
      ownedKeys: FLIGHT_ACCOUNT_PRM_KEYS,
      cookie: 'options_flight',
    });
    this.orch = orchestrator;
    this.universe = new PfLockedUniverse({
      read: () => ({ country: options.prm.country, universe: options.prm.universe }),
      write: (country, number) => this.showUniverse(country, number),
    });
    this.coordsSelect = new PfCoordsSelect(pf, {
      select: '#pf-departure', boxes: ['#pf-departure', '#pf-take-fleet'], lastKey: 'flight', nameFallback: '',
      isAt: (b) => sameValue(b.coords, options.prm.departure.map(Number)),
      move: (b) => this.setDeparture(b.coords),
      recalc: () => this.orch.recalc(),
      changed: () => this.syncTakeFleet(),
    });
    /** @type {*} The spy report waiting for the player to say where it goes. */
    this.pendingReport = null;
    /** @type {?(ready: boolean) => void} Settles makeRoomForReport(). */
    this.reportChoice = null;
  }

  bindControls() {
    super.bindControls();
    addEvent('#pf-take-fleet', 'click', () => this.takeFleet());
    this.bindReportChoice();
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  prepareSettings() {
    const prm = options.prm;
    prm.driveLevels = Array.isArray(prm.driveLevels) ? prm.driveLevels.slice() : [0, 0, 0];
    prm.lfShipsBonuses = FLIGHT_SHIP_IDS.map((_, i) => (Array.isArray(prm.lfShipsBonuses[i]) ? prm.lfShipsBonuses[i].slice() : [0, 0, 0]));
  }

  /** @param {Profile} profile */
  showSettings(profile) {
    this.orch.populateParams();
    super.showSettings(profile);
  }

  /**
   * Show a universe in the model and in the picker; the picker's list is
   * rebuilt only when the universe changes.
   *
   * @param {string} country
   * @param {*} number
   */
  showUniverse(country, number) {
    const prm = options.prm;
    if (this.universe.matches(country, number)) return;
    prm.country = country;
    prm.universe = number;
    setVal('#country', country);
    this.orch.setUniList(country, number);
  }

  showOwn() {
    this.orch.populateParams();
    this.universe.release();
  }

  recalc() {
    this.orch.recalc();
  }

  // -------------------------------------------------------------------------
  // Departure body and its fleet
  // -------------------------------------------------------------------------

  /**
   * Write the model before the DOM so the first recalc()/follow() already sees
   * the fresh coordinates.
   *
   * @param {number[]} coords
   */
  setDeparture(coords) {
    options.prm.departure = coords.slice();
    setVal('#departure-g', coords[0]);
    setVal('#departure-s', coords[1]);
    setVal('#departure-p', coords[2]);
  }

  /**
   * The body picked in the departure select, if it has any ship of the fleet.
   *
   * @returns {?ProfilePlanet}
   */
  departureBodyWithFleet() {
    const profile = this.profile();
    if (!profile) return null;
    const id = getVal('#pf-departure');
    const body = [...profile.planets, ...profile.moons].find((b) => b.id === id);
    if (!body) return null;
    return FLIGHT_TECH_MAPPING.some(([shipId]) => body.values['ship.' + shipId] !== undefined) ? body : null;
  }

  syncTakeFleet() {
    const button = document.getElementById('pf-take-fleet');
    if (button instanceof HTMLButtonElement) button.disabled = this.departureBodyWithFleet() === null;
  }

  /** Copy the ships stationed at the departure body into the ship counts. */
  takeFleet() {
    const body = this.departureBodyWithFleet();
    if (!body) return;
    FLIGHT_TECH_MAPPING.forEach(([shipId, name]) => setVal('#' + name, pfNum(getProfileValue(body, 'ship.' + shipId, 0))));
    this.orch.recalc();
  }

  // -------------------------------------------------------------------------
  // A spy report while a profile is active
  // -------------------------------------------------------------------------

  /**
   * A spy report describes the spied player, so its research, class and
   * bonuses must not land in the active profile as edits. With a profile
   * active, ask where the report goes: back to "no profile", or into a new
   * profile made for it. Resolves true once the page is ready for the report,
   * false when the player cancelled.
   *
   * @param {*} rd The report, as the ogameAPI service returns it.
   * @returns {Promise<boolean>}
   */
  makeRoomForReport(rd) {
    if (this.profileId === null) return Promise.resolve(true);
    const modal = pfModal('flight-sr-profile-modal');
    if (!modal) return Promise.resolve(false);
    this.settleReport(false);
    this.pendingReport = rd;
    setChecked('#flight-sr-profile-none', true);
    setVal('#flight-sr-profile-name', String(rd?.generic?.defender_name || ''));
    this.pf.showError('#flight-sr-profile-error', '');
    return new Promise((resolve) => {
      this.reportChoice = resolve;
      modal.show();
    });
  }

  bindReportChoice() {
    // Typing a name is choosing the new profile.
    addEvent('#flight-sr-profile-name', 'input', () => setChecked('#flight-sr-profile-new', true));
    addEvent('#flight-sr-profile-go', 'click', () => {
      if (getChecked('#flight-sr-profile-new')) {
        const label = getVal('#flight-sr-profile-name').trim();
        if (!label) {
          this.pf.showError('#flight-sr-profile-error', this.pf.text.nameRequired);
          return;
        }
        if (!this.createReportProfile(this.pendingReport, label)) {
          this.pf.showError('#flight-sr-profile-error', this.pf.text.saveFailed);
          return;
        }
      } else {
        this.pf.store.setActive(null);
      }
      this.settleReport(true);
      pfModal('flight-sr-profile-modal')?.hide();
    });
    addEvent('#flight-sr-profile-modal', 'hidden.bs.modal', () => this.settleReport(false));
  }

  /** @param {boolean} ready */
  settleReport(ready) {
    const resolve = this.reportChoice;
    this.reportChoice = null;
    this.pendingReport = null;
    if (resolve) resolve(ready);
  }

  /**
   * Make a profile for the spied player (profileFromSpyReport) and switch to it.
   *
   * @param {*} rd
   * @param {string} label
   * @returns {boolean} False when the profile could not be saved.
   */
  createReportProfile(rd, label) {
    const profile = profileFromSpyReport(rd, label);
    if (!this.pf.store.save(profile)) return false;
    this.pf.store.requestPersistence();
    this.pf.store.setActive(profile.id);
    return true;
  }
}

/**
 * Connect flight to the profiles, when the page has the selector.
 *
 * @returns {?FlightProfiles}
 */
function initFlightProfiles() {
  flightProfiles = pfBind(FlightProfiles, window.flightOrchestrator);
  return flightProfiles;
}

/** @type {?FlightProfiles} Set once the page is wired. */
let flightProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initFlightProfiles = initFlightProfiles;
}
