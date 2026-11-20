// ============================================================================
// SCRAP MERCHANT CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (the saved settings, the strings and
// the unit prices the template fills in), wires the DOM events, recalculates on
// every change and reads the API 2 export into the count and cargo fields.
//
// Saved in options_scrap: the "full numbers" box and the cargo fields - the
// hyperspace technology, the class, the Collector Enhancement and the two
// cargo bonuses - which describe the player, not the sale. The counts describe
// one sale and the rate one visit to the merchant: both start over on every
// load (the rate at SCRAP_RATE.def).

'use strict';

/**
 * The cargo settings as they start, and as the reset puts them back: the
 * cost calculator's defaults, the Collector included.
 */
const SCRAP_CARGO_DEFAULTS = Object.freeze({
  hyperTechLevel: 0, playerClass: SCRAP_CLASS.COLLECTOR, collectorClassBonus: 0, scCapacityIncrease: 0, lcCapacityIncrease: 0,
});

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
    case 'fullNumbers': return value === 'true';
    case 'hyperTechLevel': return validateNumber(Number.parseInt(value, 10), 0, Infinity, SCRAP_CARGO_DEFAULTS.hyperTechLevel);
    case 'playerClass': return validateNumber(Number.parseInt(value, 10), SCRAP_CLASS.COLLECTOR, SCRAP_CLASS.DISCOVERER, SCRAP_CARGO_DEFAULTS.playerClass);
    case 'collectorClassBonus':
    case 'scCapacityIncrease':
    case 'lcCapacityIncrease':
      return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
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

  /** @type {{fullNumbers: boolean, validate: (prm: string, value: string) => any} & ScrapCargoValues} */
  prm: {
    fullNumbers: false,
    ...SCRAP_CARGO_DEFAULTS,
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

/** The character class ids of the API 2 export (1 Collector, 2 General, 3 Discoverer), as SCRAP_CLASS. */
const SCRAP_OWN_API_CLASS = Object.freeze({ 1: SCRAP_CLASS.COLLECTOR, 2: SCRAP_CLASS.GENERAL, 3: SCRAP_CLASS.DISCOVERER });

/** The index of the Collector Enhancement among the export's class boosters. */
const SCRAP_OWN_API_COLLECTOR_BOOSTER = '1';

class ScrapApp {
  constructor() {
    /**
     * True while a player profile is shown: it owns the cargo fields then, so
     * the reset leaves them alone (scrap-profile.js sets it).
     */
    this.cargoOwnedByProfile = false;
  }

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
  }

  _bindEvents() {
    // Numeric text inputs: validate characters while typing, clamp on blur.
    ['#scrap-rate', ...SCRAP_UNIT_IDS.map(scrapCountSelector), ...Object.values(SCRAP_CARGO_FIELDS)].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
      addEvent(el, 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });
    });
    addEvent('#full-numbers', 'change', () => this.recalc());
    inputsAll('input[name="class"]').forEach((radio) => addEvent(radio, 'change', () => this.recalc()));
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

  /** Show the saved settings in the form: the "full numbers" box and the cargo fields. */
  restoreFromState() {
    const prm = options.prm;
    setChecked('#full-numbers', prm.fullNumbers);
    this.showCargo(prm);
  }

  /**
   * Fill the cargo fields; the percentages with the locale's decimal separator.
   *
   * @param {ScrapCargoValues} cargo
   */
  showCargo(cargo) {
    setVal(SCRAP_CARGO_FIELDS.hyperTechLevel, cargo.hyperTechLevel);
    setChecked('#class-' + cargo.playerClass, true);
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
    prm.playerClass = p.playerClass;
    prm.collectorClassBonus = p.collectorClassBonus;
    prm.scCapacityIncrease = p.scCapacityIncrease;
    prm.lcCapacityIncrease = p.lcCapacityIncrease;
    ScrapRenderer.render(calculateScrap(p, options.prices));
    options.save();
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
   * The cargo fields from an API 2 export: hyperspace technology, the class,
   * the Collector Enhancement and the two cargo ships' bonuses. What the
   * export leaves out - no class, no booster block - keeps its field as it was.
   *
   * @param {OwnApiPayload} data
   */
  _importOwnApiCargo(data) {
    const level = data.researches[114];
    if (level !== undefined) setVal(SCRAP_CARGO_FIELDS.hyperTechLevel, level);
    const playerClass = SCRAP_OWN_API_CLASS[/** @type {1|2|3} */ (data.characterClassId)];
    if (playerClass !== undefined) setChecked('#class-' + playerClass, true);
    const booster = data.classBoosters[SCRAP_OWN_API_COLLECTOR_BOOSTER];
    if (booster !== undefined) setNumVal(SCRAP_CARGO_FIELDS.collectorClassBonus, booster);
    const small = data.ships[202]?.cargo;
    if (small !== undefined) setNumVal(SCRAP_CARGO_FIELDS.scCapacityIncrease, small);
    const large = data.ships[203]?.cargo;
    if (large !== undefined) setNumVal(SCRAP_CARGO_FIELDS.lcCapacityIncrease, large);
  }

  /**
   * Every count back to 0 and the rate to the merchant's default; the cargo
   * fields to theirs too - unless a profile is shown, which owns them.
   */
  reset() {
    SCRAP_UNIT_IDS.forEach((id) => setVal(scrapCountSelector(id), '0'));
    setVal('#scrap-rate', localizeFloat(SCRAP_RATE.def));
    if (!this.cargoOwnedByProfile) this.showCargo(SCRAP_CARGO_DEFAULTS);
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
