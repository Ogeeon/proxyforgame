// ============================================================================
// SCRAP MERCHANT CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (the saved settings, the strings and
// the unit prices the template fills in), wires the DOM events, recalculates on
// every change and reads the API 2 export into the count and cargo fields.
//
// Saved in options_scrap: the "full numbers" box, the cargo fields - the
// hyperspace technology, the Collector box, the Collector Enhancement and the two
// cargo bonuses - and the fields of the "sell now or wait" accordion - the
// event, the fleet save, the drives, the fuel discount and the exchange rates -
// which describe the player, not the sale. The counts describe one sale and the
// rate one visit to the merchant: both start over on every load (the rate at
// SCRAP_RATE.def).

'use strict';

/**
 * The cargo settings as they start, and as the reset puts them back: no
 * bonus at all, so a fresh page hauls at the base holds, as the MCP tool
 * does by default.
 */
const SCRAP_CARGO_DEFAULTS = Object.freeze({
  hyperTechLevel: 0, isCollector: false, collectorClassBonus: 0, scCapacityIncrease: 0, lcCapacityIncrease: 0,
});

/**
 * The "sell now or wait" settings as they start, and as the reset puts them
 * back: an event at 81% in 180 days, a fleet save to the next galaxy at 10%
 * once a day, no drive research, no fuel discount, rates 1 : 1.5 : 3.
 */
const SCRAP_SELL_TIMING_DEFAULTS = Object.freeze({
  eventRate: SCRAP_EVENT_RATE.def,
  eventDays: SCRAP_EVENT_DAYS.def,
  routeKind: SCRAP_FLEETSAVE_DEFAULTS.routeKind,
  routeDelta: SCRAP_FLEETSAVE_DEFAULTS.routeDelta,
  fsSpeed: SCRAP_FLEETSAVE_DEFAULTS.speedPercent,
  fsTimes: SCRAP_FLEETSAVE_DEFAULTS.times,
  fsDays: SCRAP_FLEETSAVE_DEFAULTS.days,
  cmbDrive: 0,
  impDrive: 0,
  hypDrive: 0,
  fuelDiscount: 0,
  rateMetal: SCRAP_EXCHANGE_RATES.metal,
  rateCrystal: SCRAP_EXCHANGE_RATES.crystal,
  rateDeut: SCRAP_EXCHANGE_RATES.deuterium,
});

/** The drive fields, in flight's order: combustion, impulse, hyperspace. */
const SCRAP_DRIVE_KEYS = Object.freeze(['cmbDrive', 'impDrive', 'hypDrive']);

/** The three exchange rate fields, metal first. */
const SCRAP_RATE_KEYS = Object.freeze(['rateMetal', 'rateCrystal', 'rateDeut']);

/**
 * What a player profile adds to the fleet save: the class, its enhancements,
 * the ships' own life form bonuses and the universe (ScrapFleetsaveSettings).
 *
 * @typedef {object} ScrapFleetsaveProfile
 * @property {number} playerClass flight-core.js PLAYER_CLASS.
 * @property {number} lfMechanGE
 * @property {number} lfRocktalCE
 * @property {Object<string, {speed: number, fuel: number}>} shipBonuses
 * @property {ScrapUniverse} universe
 */

/**
 * A saved setting read back, held to the range its field takes - the ranges
 * of the cost calculator's settings (costs-core.js). Every value is stored as
 * a plain number, so nothing locale-formatted reaches the storage.
 *
 * @param {string} prm
 * @param {string} value
 * @returns {*}
 */
function scrapValidatePrm(prm, value) {
  switch (prm) {
    case 'fullNumbers':
    case 'isCollector':
      return value === 'true';
    case 'hyperTechLevel': return validateNumber(Number.parseInt(value, 10), 0, Infinity, SCRAP_CARGO_DEFAULTS.hyperTechLevel);
    case 'collectorClassBonus':
    case 'scCapacityIncrease':
    case 'lcCapacityIncrease':
      return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
    default: return scrapValidateSellTimingPrm(prm, value);
  }
}

/**
 * A saved "sell now or wait" setting read back, held to the range its field
 * takes (_applyConstraints).
 *
 * @param {string} prm
 * @param {string} value
 * @returns {*}
 */
function scrapValidateSellTimingPrm(prm, value) {
  const def = /** @type {Record<string, any>} */ (SCRAP_SELL_TIMING_DEFAULTS)[prm];
  const int = (/** @type {number} */ min, /** @type {number} */ max) =>
    validateNumber(Number.parseInt(value, 10), min, max, def);
  const float = (/** @type {number} */ min, /** @type {number} */ max) =>
    validateNumber(Number.parseFloat(value), min, max, def);
  switch (prm) {
    case 'eventRate': return float(SCRAP_EVENT_RATE.min, SCRAP_EVENT_RATE.max);
    case 'eventDays': return int(SCRAP_EVENT_DAYS.min, Infinity);
    case 'routeKind': return Object.hasOwn(SCRAP_ROUTES, value) ? value : def;
    case 'routeDelta': return int(1, SCRAP_ROUTES.galaxies.max);
    case 'fsSpeed': return int(5, 100);
    case 'fsTimes':
    case 'fsDays':
      return int(1, Infinity);
    case 'cmbDrive':
    case 'impDrive':
    case 'hypDrive':
      return int(0, Infinity);
    case 'fuelDiscount': return float(0, DEUT_REDUCTION_CAP);
    case 'rateMetal':
    case 'rateCrystal':
    case 'rateDeut':
      return float(SCRAP_EXCHANGE_RATES.min, SCRAP_EXCHANGE_RATES.max);
    default: return value;
  }
}

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  /** @type {Record<string, number[]>} Unit prices by tech id, filled in by the template. */
  prices: {},
  /** Shown when the pasted text is not an API 2 export; filled in by the template. */
  ownApiBadJsonMsg: '',
  dialogOk: 'OK',

  /** The verdicts of the advice, filled in by the template. */
  verdictWait: 'wait',
  verdictSell: 'sell',

  /** @type {{fullNumbers: boolean, validate: (prm: string, value: string) => any} & ScrapCargoValues & ScrapSellTimingValues} */
  prm: {
    fullNumbers: false,
    ...SCRAP_CARGO_DEFAULTS,
    eventRate: SCRAP_SELL_TIMING_DEFAULTS.eventRate,
    eventDays: SCRAP_SELL_TIMING_DEFAULTS.eventDays,
    routeKind: SCRAP_SELL_TIMING_DEFAULTS.routeKind,
    routeDelta: SCRAP_SELL_TIMING_DEFAULTS.routeDelta,
    fsSpeed: SCRAP_SELL_TIMING_DEFAULTS.fsSpeed,
    fsTimes: SCRAP_SELL_TIMING_DEFAULTS.fsTimes,
    fsDays: SCRAP_SELL_TIMING_DEFAULTS.fsDays,
    cmbDrive: SCRAP_SELL_TIMING_DEFAULTS.cmbDrive,
    impDrive: SCRAP_SELL_TIMING_DEFAULTS.impDrive,
    hypDrive: SCRAP_SELL_TIMING_DEFAULTS.hypDrive,
    fuelDiscount: SCRAP_SELL_TIMING_DEFAULTS.fuelDiscount,
    rateMetal: SCRAP_SELL_TIMING_DEFAULTS.rateMetal,
    rateCrystal: SCRAP_SELL_TIMING_DEFAULTS.rateCrystal,
    rateDeut: SCRAP_SELL_TIMING_DEFAULTS.rateDeut,
    validate: scrapValidatePrm,
  },

  load: function () {
    try {
      loadFromCookie('options_scrap', options.prm);
    } catch (e) { console.error(e); }
  },
  save: function () { saveToCookie('options_scrap', options.prm); }
};

/**
 * The counts an API 2 export gives the page: every unit the page has a field
 * for, 0 for one the export does not list. Null when it lists none of them -
 * the fields are overwritten wholesale, so an export that matches nothing must
 * be refused rather than wipe them.
 *
 * @param {OwnApiPayload} data
 * @returns {?Record<string, number>}
 */
function scrapCountsFromOwnApi(data) {
  /** @type {Record<string, number>} */
  const counts = {};
  let matched = false;
  SCRAP_FLEET_IDS.forEach((id) => {
    const ship = data.ships[id];
    if (ship !== undefined) matched = true;
    counts[id] = ship?.amount ?? 0;
  });
  SCRAP_DEFENSE_IDS.forEach((id) => {
    // The defense ids are listed under `ships` too, always at 0: only the
    // defenses and missiles blocks carry their counts (own-api.js).
    const amount = data.defenses[id] ?? data.missiles[id];
    if (amount !== undefined) matched = true;
    counts[id] = amount ?? 0;
  });
  return matched ? counts : null;
}

/**
 * The character class ids of the API 2 export (1 Collector, 2 General,
 * 3 Discoverer), as the Collector box shows them.
 */
const SCRAP_OWN_API_COLLECTOR = Object.freeze({ 1: true, 2: false, 3: false });

/** The index of the Collector Enhancement among the export's class boosters. */
const SCRAP_OWN_API_COLLECTOR_BOOSTER = '1';

class ScrapApp {
  /**
   * True while a player profile is shown: it owns the cargo fields then, so
   * the reset leaves them alone (scrap-profile.js sets it).
   */
  cargoOwnedByProfile = false;

  /**
   * While a player profile is shown: what it adds to the fleet save - the
   * class, the enhancements, the ships' life form bonuses and the universe.
   * Null without a profile, when the one fuel discount field stands for the
   * class and the life forms (scrap-profile.js sets it).
   *
   * @type {?() => ScrapFleetsaveProfile}
   */
  fleetsaveProfile = null;

  /** The class whose speed steps #fs-speed offers, flight-core.js PLAYER_CLASS. */
  speedClass = PLAYER_CLASS.DISCOVERER;

  init() {
    options.load();
    this.restoreFromState();
    setVal('#scrap-rate', localizeFloat(SCRAP_RATE.def));
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  _applyConstraints() {
    setConstrains('scrap-rate', { min: SCRAP_RATE.min, max: SCRAP_RATE.max, def: SCRAP_RATE.def, allowFloat: true });
    SCRAP_UNIT_IDS.forEach((id) => setConstrains('unit-' + id, { min: 0, def: 0 }));
    // The ranges scrapValidatePrm reads a saved value back with.
    setConstrains('hyper-tech-level', { min: 0, def: 0 });
    ['lf-collector-class-bonus', 'sc-capacity-increase', 'lc-capacity-increase'].forEach((id) =>
      setConstrains(id, { min: 0, def: 0, allowFloat: true }));
    // The ranges scrapValidateSellTimingPrm reads a saved value back with.
    const d = SCRAP_SELL_TIMING_DEFAULTS;
    setConstrains('event-rate', { min: SCRAP_EVENT_RATE.min, max: SCRAP_EVENT_RATE.max, def: d.eventRate, allowFloat: true });
    setConstrains('event-days', { min: SCRAP_EVENT_DAYS.min, def: d.eventDays });
    setConstrains('fs-times', { min: 1, def: d.fsTimes });
    setConstrains('fs-days', { min: 1, def: d.fsDays });
    ['cmb-drive', 'imp-drive', 'hyp-drive'].forEach((id) => setConstrains(id, { min: 0, def: 0 }));
    setConstrains('fuel-discount', { min: 0, max: DEUT_REDUCTION_CAP, def: d.fuelDiscount, allowFloat: true });
    [['exchange-rates-m', d.rateMetal], ['exchange-rates-c', d.rateCrystal], ['exchange-rates-d', d.rateDeut]]
      .forEach(([id, def]) => setConstrains(String(id), {
        min: SCRAP_EXCHANGE_RATES.min, max: SCRAP_EXCHANGE_RATES.max, def, allowFloat: true,
      }));
    this._applyRouteConstraint();
  }

  /** The route's steps: 1 up to what the picked kind allows. */
  _applyRouteConstraint() {
    const kind = /** @type {keyof typeof SCRAP_ROUTES} */ (
      Object.hasOwn(SCRAP_ROUTES, getVal(SCRAP_ROUTE_KIND)) ? getVal(SCRAP_ROUTE_KIND) : SCRAP_FLEETSAVE_DEFAULTS.routeKind);
    setConstrains('route-delta', { min: 1, max: SCRAP_ROUTES[kind].max, def: SCRAP_FLEETSAVE_DEFAULTS.routeDelta });
  }

  _bindEvents() {
    // Numeric text inputs: validate characters while typing, clamp on blur.
    ['#scrap-rate', ...SCRAP_UNIT_IDS.map(scrapCountSelector), ...Object.values(SCRAP_CARGO_FIELDS),
      ...Object.values(SCRAP_SELL_TIMING_FIELDS)].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
      addEvent(el, 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });
    });
    addEvent(SCRAP_ROUTE_KIND, 'change', () => {
      // A delta the new kind does not reach is brought back into its range.
      this._applyRouteConstraint();
      const delta = inputEl('#route-delta');
      if (delta) validateInputNumberOnBlurNative({ currentTarget: delta });
      this.recalc();
    });
    addEvent(SCRAP_FS_SPEED, 'change', () => this.recalc());
    addEvent('#full-numbers', 'change', () => this.recalc());
    addEvent(SCRAP_COLLECTOR_BOX, 'change', () => this.recalc());
    addEvent('#own-api-import', 'click', () => { void this.importOwnApi(getVal('#own-api-input')); });
    addEvent('#reset', 'click', () => this.reset());

    // Click the count a profile's planet has, beside a field, to copy it in.
    // The renderer keeps the raw integer in data-planet-count; a hidden label
    // carries none.
    SCRAP_UNIT_IDS.forEach((id) => {
      const label = $(`#unit-${id}-planet`);
      if (!label) return;
      addEvent(label, 'click', () => {
        const raw = label.dataset.planetCount;
        if (raw === undefined) return;
        setVal(scrapCountSelector(id), raw);
        this.recalc();
      });
    });

    // Theme toggle (rendered inside topbar).
    const lightCb = inputEl('#cb-light-theme');
    if (lightCb) {
      lightCb.addEventListener('click', () => {
        if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
      });
    }
  }

  _applyTheme() {
    const theme = { value: 'light', validate: (/** @type {string} */ _k, /** @type {string} */ v) => v };
    loadFromCookie('theme', theme);
    if (typeof toggleLightBS === 'function') {
      toggleLightBS(theme.value === 'light');
    }
  }

  /** Show the saved settings in the form: the "full numbers" box, the cargo and the sell-or-wait fields. */
  restoreFromState() {
    const prm = options.prm;
    setChecked('#full-numbers', prm.fullNumbers);
    this.showCargo(prm);
    this.showSellTiming(prm);
  }

  /**
   * Fill the fields of the "sell now or wait" accordion; the fractions with
   * the locale's decimal separator.
   *
   * @param {ScrapSellTimingValues} s
   * @param {boolean} [withDrives] False leaves the drive fields alone, for a profile that owns them.
   */
  showSellTiming(s, withDrives = true) {
    const f = SCRAP_SELL_TIMING_FIELDS;
    setNumVal(f.eventRate, s.eventRate);
    setVal(f.eventDays, s.eventDays);
    setVal(SCRAP_ROUTE_KIND, s.routeKind);
    this._applyRouteConstraint();
    setVal(f.routeDelta, s.routeDelta);
    this.showSpeedSteps(this.speedClass, s.fsSpeed);
    setVal(f.fsTimes, s.fsTimes);
    setVal(f.fsDays, s.fsDays);
    if (withDrives) SCRAP_DRIVE_KEYS.forEach((key) => setVal(f[key], s[key]));
    setNumVal(f.fuelDiscount, s.fuelDiscount);
    SCRAP_RATE_KEYS.forEach((key) => setNumVal(f[key], s[key]));
  }

  /**
   * Offer the speed steps of a class - every 5% for the General, every 10%
   * otherwise - and pick `percent`, or the nearest step below it that is
   * offered (10% when none is).
   *
   * @param {number} playerClass flight-core.js PLAYER_CLASS.
   * @param {number} percent
   */
  showSpeedSteps(playerClass, percent) {
    this.speedClass = playerClass;
    const select = selectEl(SCRAP_FS_SPEED);
    if (!select) return;
    const steps = new FlightCalculator().speedPercents(playerClass);
    const offered = steps.find((step) => step <= percent) ?? SCRAP_FLEETSAVE_DEFAULTS.speedPercent;
    select.replaceChildren(...steps.map((step) => new Option(step + '%', String(step))));
    select.value = String(offered);
  }

  /**
   * Fill the cargo fields; the percentages with the locale's decimal separator.
   *
   * @param {ScrapCargoValues} cargo
   */
  showCargo(cargo) {
    setVal(SCRAP_CARGO_FIELDS.hyperTechLevel, cargo.hyperTechLevel);
    setChecked(SCRAP_COLLECTOR_BOX, cargo.isCollector);
    setNumVal(SCRAP_CARGO_FIELDS.collectorClassBonus, cargo.collectorClassBonus);
    setNumVal(SCRAP_CARGO_FIELDS.scCapacityIncrease, cargo.scCapacityIncrease);
    setNumVal(SCRAP_CARGO_FIELDS.lcCapacityIncrease, cargo.lcCapacityIncrease);
  }

  /** Read the form, compute, render and save the settings kept. */
  recalc() {
    const p = ScrapDataCollector.readParams();
    const prm = options.prm;
    prm.fullNumbers = p.fullNumbers;
    prm.hyperTechLevel = p.hyperTechLevel;
    prm.isCollector = p.isCollector;
    prm.collectorClassBonus = p.collectorClassBonus;
    prm.scCapacityIncrease = p.scCapacityIncrease;
    prm.lcCapacityIncrease = p.lcCapacityIncrease;
    const s = ScrapDataCollector.readSellTiming();
    Object.assign(prm, s);
    ScrapRenderer.render(calculateScrap(p, options.prices));
    ScrapRenderer.renderSellTiming(this.sellTiming(p, s));
    options.save();
  }

  /**
   * The "sell now or wait" advice for the counts and the rate on the page.
   *
   * @param {{counts: Record<string, number>, rate: number}} p
   * @param {ScrapSellTimingValues} s
   * @returns {ScrapSellTimingResult}
   */
  sellTiming(p, s) {
    const profile = this.fleetsaveProfile ? this.fleetsaveProfile() : null;
    const playerClass = profile ? profile.playerClass : PLAYER_CLASS.DISCOVERER;
    if (playerClass !== this.speedClass) {
      this.showSpeedSteps(playerClass, s.fsSpeed);
      s.fsSpeed = Number(getVal(SCRAP_FS_SPEED));
      options.prm.fsSpeed = s.fsSpeed;
    }
    const fuel = scrapFleetsaveFuel(p.counts, {
      route: { kind: s.routeKind, delta: s.routeDelta },
      speedPercent: s.fsSpeed,
      driveLevels: SCRAP_DRIVE_KEYS.map((key) => s[key]),
      playerClass,
      // With a profile the class and the life forms come apart from it, and
      // the one discount of the form stands for neither.
      fuelDiscount: profile ? 0 : s.fuelDiscount,
      lfMechanGE: profile?.lfMechanGE,
      lfRocktalCE: profile?.lfRocktalCE,
      shipBonuses: profile?.shipBonuses,
      universe: profile?.universe,
    });
    return scrapSellTiming({
      counts: p.counts,
      rate: p.rate,
      eventRate: s.eventRate,
      days: s.eventDays,
      exchangeRates: { metal: s.rateMetal, crystal: s.rateCrystal, deuterium: s.rateDeut },
      fuelPerDay: scrapFuelPerDay(fuel.perSave, s.fsTimes, s.fsDays),
    }, options.prices);
  }

  /**
   * Fill the counts from a pasted API 2 export, and the cargo fields from
   * what it says of the player. A text that is not one, or one that names
   * none of the units, gets the error dialog and changes nothing.
   *
   * @param {string} text
   * @returns {Promise<boolean>} True when the counts were filled.
   */
  async importOwnApi(text) {
    const data = parseOwnApi(text);
    const counts = data ? scrapCountsFromOwnApi(data) : null;
    if (!data || !counts) {
      await showAlertModal(options.ownApiBadJsonMsg, options.dialogOk);
      return false;
    }
    Object.entries(counts).forEach(([id, count]) => setVal(scrapCountSelector(id), String(count)));
    this._importOwnApiCargo(data);
    this.recalc();
    return true;
  }

  /**
   * The cargo fields from an API 2 export: hyperspace technology, the class
   * (the Collector ticks the box, another class clears it), the Collector
   * Enhancement and the two cargo ships' bonuses - and the three drive levels
   * of the fleet save. What the export leaves out -
   * no class, no booster block - keeps its field as it was.
   *
   * @param {OwnApiPayload} data
   */
  _importOwnApiCargo(data) {
    const level = data.researches[114];
    if (level !== undefined) setVal(SCRAP_CARGO_FIELDS.hyperTechLevel, level);
    // The drives of the fleet save, as flight takes them from the export.
    [115, 117, 118].forEach((tech, i) => {
      const drive = data.researches[tech];
      if (drive !== undefined) setVal(SCRAP_SELL_TIMING_FIELDS[SCRAP_DRIVE_KEYS[i]], drive);
    });
    // An export may carry no class (0) or one this map does not know, so the
    // lookup can miss even though the map's own type says otherwise.
    /** @type {Record<number, boolean | undefined>} */
    const collectors = SCRAP_OWN_API_COLLECTOR;
    const collector = collectors[data.characterClassId];
    if (collector !== undefined) setChecked(SCRAP_COLLECTOR_BOX, collector);
    const booster = data.classBoosters[SCRAP_OWN_API_COLLECTOR_BOOSTER];
    if (booster !== undefined) setNumVal(SCRAP_CARGO_FIELDS.collectorClassBonus, booster);
    const small = data.ships[202]?.cargo;
    if (small !== undefined) setNumVal(SCRAP_CARGO_FIELDS.scCapacityIncrease, small);
    const large = data.ships[203]?.cargo;
    if (large !== undefined) setNumVal(SCRAP_CARGO_FIELDS.lcCapacityIncrease, large);
  }

  /**
   * Every count back to 0 and the rate to the merchant's default; the cargo
   * and the sell-or-wait fields to theirs too - except what a profile shown
   * owns: the cargo fields and the drives.
   */
  reset() {
    SCRAP_UNIT_IDS.forEach((id) => setVal(scrapCountSelector(id), '0'));
    setVal('#scrap-rate', localizeFloat(SCRAP_RATE.def));
    if (!this.cargoOwnedByProfile) this.showCargo(SCRAP_CARGO_DEFAULTS);
    this.showSellTiming(SCRAP_SELL_TIMING_DEFAULTS, !this.cargoOwnedByProfile);
    this.recalc();
  }
}

/** @type {?ScrapApp} */
let scrapApp = null;

function initializeScrapCalculator() {
  scrapApp = new ScrapApp();
  scrapApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  globalThisRecord().scrapApp = scrapApp;
}

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initializeScrapCalculator = initializeScrapCalculator;
  globalThisRecord().ScrapApp = ScrapApp;
}
