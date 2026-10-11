// ============================================================================
// FLIGHT CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the flight calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> options.prm (drives, class, alliance class,
//     life-form bonuses) and the profile's universe into the universe picker;
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// Everything else - departure, destination, ships, times, the universe
// settings - is the calculator's own and keeps going to options_flight. The
// profile-owned keys are written there with the values they had before the
// profile, so "no profile" shows them untouched.
// Two conveniences read the profile without binding: #pf-departure copies a
// planet's or moon's coordinates into the departure point, and #pf-take-fleet
// copies the ships stationed there into the ship counts.

'use strict';

/**
 * @typedef {Object} FlightAccountField
 * @property {string} key Profile value key.
 * @property {() => ?HTMLElement} input The field that shows it.
 * @property {(prm: Record<string, any>) => *} get The profile value the prm holds.
 * @property {(prm: Record<string, any>, value: *) => void} set Put a profile value (or undefined) into the prm.
 * @property {(value: *) => string} [display] The game value as shown in the mark.
 */

const flightNum = (/** @type {*} */ v) => Number(v) || 0;

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
  const row = $$('#lf-ships-bonuses tr')[i + 1];
  return row ? row.querySelectorAll('input')[j] || null : null;
}

/**
 * The text of the radio label for an id, or a dash.
 *
 * @param {string} id
 */
function flightRadioLabel(id) {
  const label = document.querySelector('label[for="' + id + '"]');
  return label ? (label.textContent || '').trim() : '—';
}

/** @type {FlightAccountField[]} */
const FLIGHT_ACCOUNT_FIELDS = [
  ...[['research.115', '#cmb-drive'], ['research.117', '#imp-drive'], ['research.118', '#hyp-drive']].map(([key, input], i) => ({
    key,
    input: () => $(input),
    get: (/** @type {Record<string, any>} */ prm) => flightNum(prm.driveLevels[i]),
    set: (/** @type {Record<string, any>} */ prm, /** @type {*} */ v) => { prm.driveLevels[i] = flightNum(v); },
  })),
  {
    key: 'research.114', input: () => $('#hypertech-lvl'),
    get: (prm) => flightNum(prm.hyperTechLvl), set: (prm, v) => { prm.hyperTechLvl = flightNum(v); },
  },
  {
    // Flight has no "no class": a profile without one shows as collector.
    key: 'class', input: () => $('#class-0'),
    get: (prm) => flightNum(prm.playerClass) + 1,
    set: (prm, v) => { prm.playerClass = Math.min(2, Math.max(0, flightNum(v) - 1)); },
    display: (v) => flightRadioLabel('class-' + (flightNum(v) - 1)),
  },
  {
    // The researcher alliance brings the fleet nothing and has no radio: it shows as none.
    key: 'allianceClass', input: () => $('#alliance-class-none'),
    get: (prm) => {
      if (prm.traderBonus === true) return PROFILE_ALLIANCE_CLASS.TRADER;
      return prm.warriorBonus === true ? PROFILE_ALLIANCE_CLASS.WARRIOR : PROFILE_ALLIANCE_CLASS.NONE;
    },
    set: (prm, v) => {
      prm.traderBonus = flightNum(v) === PROFILE_ALLIANCE_CLASS.TRADER;
      prm.warriorBonus = flightNum(v) === PROFILE_ALLIANCE_CLASS.WARRIOR;
    },
    display: (v) => {
      if (flightNum(v) === PROFILE_ALLIANCE_CLASS.TRADER) return flightRadioLabel('trader-bonus');
      return flightRadioLabel(flightNum(v) === PROFILE_ALLIANCE_CLASS.WARRIOR ? 'warrior-bonus' : 'alliance-class-none');
    },
  },
  {
    key: 'lf.classBooster.1', input: () => $('#lf-rocktal-collector-enh'),
    get: (prm) => flightNum(prm.lfRocktalCE), set: (prm, v) => { prm.lfRocktalCE = flightNum(v); },
  },
  {
    key: 'lf.classBooster.2', input: () => $('#lf-mechan-general-enh'),
    get: (prm) => flightNum(prm.lfMechanGE), set: (prm, v) => { prm.lfMechanGE = flightNum(v); },
  },
  ...FLIGHT_SHIP_IDS.flatMap((shipId, i) => FLIGHT_LF_STATS.map((stat, j) => ({
    key: 'lf.ship.' + shipId + '.' + stat,
    input: () => flightLfBonusInput(i, j),
    get: (/** @type {Record<string, any>} */ prm) => flightNum(prm.lfShipsBonuses[i]?.[j]),
    set: (/** @type {Record<string, any>} */ prm, /** @type {*} */ v) => { prm.lfShipsBonuses[i][j] = flightNum(v); },
  }))),
];

/** The options.prm keys the account fields above live in. */
const FLIGHT_ACCOUNT_PRM_KEYS = ['driveLevels', 'hyperTechLvl', 'playerClass', 'traderBonus', 'warriorBonus',
  'lfRocktalCE', 'lfMechanGE', 'lfShipsBonuses'];

/**
 * A planet or moon of a profile, with the coordinates a flight can start from.
 *
 * @param {ProfilePlanet} body
 * @returns {?number[]}
 */
function flightBodyCoords(body) {
  const c = body.coords;
  return c && c.galaxy !== null && c.system !== null && c.position !== null ? [c.galaxy, c.system, c.position] : null;
}

class FlightProfiles {
  /**
   * @param {ProfilesUi} pf
   * @param {*} orchestrator The FlightOrchestrator of the page.
   */
  constructor(pf, orchestrator) {
    this.pf = pf;
    this.orch = orchestrator;
    /** @type {?string} The active profile's id while one is applied. */
    this.profileId = null;
    /** @type {Record<string, *>} Account values (by profile key) at the last apply or sync. */
    this.snapshot = {};
    /** @type {Record<string, *>} The profile-owned prm keys as they were before a profile. */
    this.ownPrm = {};
    /** @type {?{country: string, universe: *}} The universe picked before a profile set its own. */
    this.ownUniverse = null;
    this.ownSave = options.save;
    this.applying = false;
    /** @type {*} The spy report waiting for the player to say where it goes. */
    this.pendingReport = null;
    /** @type {?(ready: boolean) => void} Settles makeRoomForReport(). */
    this.reportChoice = null;
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    addEvent('#pf-departure', 'change', () => this.departureChosen());
    addEvent('#pf-take-fleet', 'click', () => this.takeFleet());
    this.bindReportChoice();
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
  }

  /** @returns {?Profile} */
  profile() {
    return this.profileId ? this.pf.store.get(this.profileId) : null;
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
    const prm = options.prm;
    this.applying = true;
    try {
      if (this.profileId === null) {
        this.ownPrm = {};
        FLIGHT_ACCOUNT_PRM_KEYS.forEach((key) => { this.ownPrm[key] = cloneData(prm[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      prm.driveLevels = Array.isArray(prm.driveLevels) ? prm.driveLevels.slice() : [0, 0, 0];
      prm.lfShipsBonuses = FLIGHT_SHIP_IDS.map((_, i) => (Array.isArray(prm.lfShipsBonuses[i]) ? prm.lfShipsBonuses[i].slice() : [0, 0, 0]));
      FLIGHT_ACCOUNT_FIELDS.forEach((f) => f.set(prm, getProfileValue(profile.account, f.key)));
      this.orch.populateParams();
      this.applyUniverse(profile);
      // Flight's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.renderDepartureSelect(profile);
      // The recalculation reads the fields back: the snapshot then holds the
      // values exactly as the form gives them, and the next edit compares like with like.
      this.orch.recalc();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  /**
   * Show the profile's universe in the picker, locked: the profile says where
   * it plays. A profile with no universe leaves the picker to the player.
   *
   * @param {Profile} profile
   */
  applyUniverse(profile) {
    const prm = options.prm;
    const country = selectEl('#country');
    const universe = selectEl('#universe');
    if (!profile.universe) {
      this.unlockUniverse();
      return;
    }
    this.ownUniverse ??= { country: prm.country, universe: prm.universe };
    const wanted = profile.universe;
    if (prm.country !== wanted.country || String(prm.universe) !== String(wanted.number)) {
      prm.country = wanted.country;
      prm.universe = wanted.number;
      setVal('#country', wanted.country);
      this.orch.setUniList(wanted.country, wanted.number);
    }
    [country, universe].forEach((el) => {
      if (!el) return;
      el.disabled = true;
      el.title = getOptionValue('universeFromProfile', '');
    });
  }

  /** Give the universe picker back, on the universe it showed before the profile. */
  unlockUniverse() {
    [selectEl('#country'), selectEl('#universe')].forEach((el) => {
      if (!el) return;
      el.disabled = false;
      el.removeAttribute('title');
    });
    const own = this.ownUniverse;
    this.ownUniverse = null;
    if (!own) return;
    const prm = options.prm;
    if (prm.country === own.country && String(prm.universe) === String(own.universe)) return;
    prm.country = own.country;
    prm.universe = own.universe;
    setVal('#country', own.country);
    this.orch.setUniList(own.country, own.universe);
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.profileId = null;
    this.pf.clearMarks();
    pfShow('#reset', true);
    pfShow('#pf-departure', false);
    pfShow('#pf-take-fleet', false);
    Object.assign(options.prm, cloneData(this.ownPrm));
    this.orch.populateParams();
    this.unlockUniverse();
    this.orch.recalc();
  }

  takeSnapshot() {
    this.snapshot = {};
    FLIGHT_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.get(options.prm); });
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
    this.syncDepartureSelect();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    let changed = false;
    FLIGHT_ACCOUNT_FIELDS.forEach((f) => {
      const value = f.get(options.prm);
      if (!sameValue(value, this.snapshot[f.key])) {
        changed = setProfileValue(profile.account, f.key, value) || changed;
        this.snapshot[f.key] = value;
      }
    });
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_flight gets the calculator's own fields as they are, and the
   * profile-owned ones - and a universe the profile dictates - as they were
   * before the profile.
   */
  saveOwn() {
    /** @type {Record<string, *>} */
    const stored = { ...options.prm, ...cloneData(this.ownPrm) };
    if (this.ownUniverse) {
      stored.country = this.ownUniverse.country;
      stored.universe = this.ownUniverse.universe;
    }
    saveToCookie('options_flight', stored);
  }

  // -------------------------------------------------------------------------
  // Departure body and its fleet
  // -------------------------------------------------------------------------

  /**
   * Every planet and moon with full coordinates, planets first.
   *
   * @param {Profile} profile
   * @returns {Array<{body: ProfilePlanet, coords: number[], label: string}>}
   */
  bodies(profile) {
    /** @type {Array<{body: ProfilePlanet, coords: number[], label: string}>} */
    const list = [];
    /**
     * @param {ProfilePlanet} body
     * @param {boolean} isMoon
     */
    const add = (body, isMoon) => {
      const coords = flightBodyCoords(body);
      if (!coords) return;
      const name = (body.name || '') + (isMoon ? ' (' + getOptionValue('moonLabel', '') + ')' : '');
      list.push({ body, coords, label: name + ' [' + coords.join(':') + ']' });
    };
    profile.planets.forEach((p) => add(p, false));
    profile.moons.forEach((m) => add(m, true));
    return list;
  }

  /**
   * Fill the departure select. The departure point itself is the calculator's:
   * it moves to a body only when it matches none, to the one picked last time
   * in this profile or else to the first planet.
   *
   * @param {Profile} profile
   */
  renderDepartureSelect(profile) {
    const select = selectEl('#pf-departure');
    if (!select) return;
    const bodies = this.bodies(profile);
    select.innerHTML = '';
    select.appendChild(new Option('—', ''));
    bodies.forEach((b) => select.appendChild(new Option(b.label, b.body.id)));
    pfShow('#pf-departure', bodies.length > 0);
    pfShow('#pf-take-fleet', bodies.length > 0);
    const departure = options.prm.departure.map(Number);
    const last = this.pf.store.getLastPlanet('flight', profile.id);
    const matching = bodies.filter((b) => sameValue(b.coords, departure));
    let chosen = matching.find((b) => b.body.id === last) || matching[0];
    if (!chosen && bodies.length > 0) {
      chosen = bodies.find((b) => b.body.id === last) || bodies[0];
      this.setDeparture(chosen.coords);
    }
    select.value = chosen ? chosen.body.id : '';
    this.syncTakeFleet();
  }

  /** @param {number[]} coords */
  setDeparture(coords) {
    setVal('#departure-g', coords[0]);
    setVal('#departure-s', coords[1]);
    setVal('#departure-p', coords[2]);
  }

  departureChosen() {
    const profile = this.profile();
    const id = getVal('#pf-departure');
    if (!profile) return;
    const body = this.bodies(profile).find((b) => b.body.id === id);
    if (body) {
      this.setDeparture(body.coords);
      this.pf.store.setLastPlanet('flight', profile.id, body.body.id);
      this.orch.recalc();
    }
    this.syncTakeFleet();
  }

  /** Keep the select on the body the departure point is at, or on the dash. */
  syncDepartureSelect() {
    const profile = this.profile();
    const select = selectEl('#pf-departure');
    if (!profile || !select) return;
    const departure = options.prm.departure.map(Number);
    const bodies = this.bodies(profile);
    const current = bodies.find((b) => b.body.id === select.value);
    if (current && sameValue(current.coords, departure)) return;
    const match = bodies.find((b) => sameValue(b.coords, departure));
    select.value = match ? match.body.id : '';
    this.syncTakeFleet();
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
    FLIGHT_TECH_MAPPING.forEach(([shipId, name]) => setVal('#' + name, flightNum(getProfileValue(body, 'ship.' + shipId, 0))));
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
   * Make a profile for the spied player and switch to it: the report's universe
   * and the spied planet or moon, so the departure select offers it. The
   * account values stay empty here - the import then writes them as it would
   * into any profile entered by hand.
   *
   * @param {*} rd
   * @param {string} label
   * @returns {boolean} False when the profile could not be saved.
   */
  createReportProfile(rd, label) {
    const number = Number(rd?.universes?.universe);
    const country = String(rd?.universes?.domain || '');
    const profile = createProfile({ label, universe: country && number > 0 ? { country, number } : null });
    const coords = String(rd?.generic?.defender_planet_coordinates || '').split(':').map(Number);
    if (coords.length === 3 && coords.every((n) => Number.isInteger(n) && n > 0)) {
      const body = createPlanet({
        name: String(rd.generic.defender_planet_name || ''),
        coords: { galaxy: coords[0], system: coords[1], position: coords[2] },
      });
      // The game's planet types: 1 planet, 3 moon.
      if (Number(rd.generic.defender_planet_type) === 3) profile.moons.push({ ...body, planetId: null });
      else profile.planets.push(body);
    }
    if (!this.pf.store.save(profile)) return false;
    this.pf.store.requestPersistence();
    this.pf.store.setActive(profile.id);
    return true;
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    const headers = $$('#lf-ships-bonuses tr:first-child th');
    FLIGHT_ACCOUNT_FIELDS.forEach((f) => {
      const input = f.input();
      let label = pfFieldLabel(input);
      const cell = input ? input.closest('td') : null;
      if (cell instanceof HTMLTableCellElement && cell.parentElement instanceof HTMLTableRowElement) {
        const ship = (cell.parentElement.cells[0]?.textContent || '').trim();
        label = ship + ': ' + (headers[cell.cellIndex]?.textContent || '').trim();
      }
      this.pf.describeField(f.key, label, f.display);
    });
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    FLIGHT_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField(f.input(), profile, profile.account, f.key, () => {
        // Restore on a fresh copy: the one marked may be stale by now.
        const fresh = this.pf.store.get(profile.id);
        if (fresh && resetProfileValue(fresh.account, f.key)) this.pf.store.save(fresh);
      });
    });
  }
}

/**
 * Connect flight to the profiles, when the page has the selector.
 *
 * @returns {?FlightProfiles}
 */
function initFlightProfiles() {
  if (!pfgProfiles || !window.flightOrchestrator) return null;
  flightProfiles = new FlightProfiles(pfgProfiles, window.flightOrchestrator);
  flightProfiles.init();
  return flightProfiles;
}

/** @type {?FlightProfiles} Set once the page is wired. */
let flightProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initFlightProfiles = initFlightProfiles;
}
