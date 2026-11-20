// ============================================================================
// SCRAP MERCHANT CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (the one saved setting, the strings and
// the unit prices the template fills in), wires the DOM events, recalculates on
// every change and reads the API 2 export into the count fields.
//
// Only the "full numbers" box is saved, in options_scrap. The counts describe
// one sale and the rate one visit to the merchant: both start over on every
// load (the rate at SCRAP_RATE.def).

'use strict';

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  /** @type {Record<string, number[]>} Unit prices by tech id, filled in by the template. */
  prices: {},
  /** Shown when the pasted text is not an API 2 export; filled in by the template. */
  ownApiBadJsonMsg: '',
  dialogOk: 'OK',

  /** @type {{fullNumbers: boolean, validate: (prm: string, value: string) => any}} */
  prm: {
    fullNumbers: false,
    validate: (/** @type {string} */ prm, /** @type {string} */ value) => (prm === 'fullNumbers' ? value === 'true' : value),
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

class ScrapApp {
  init() {
    options.load();
    setChecked('#full-numbers', options.prm.fullNumbers);
    setVal('#scrap-rate', localizeFloat(SCRAP_RATE.def));
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  _applyConstraints() {
    setConstrains('scrap-rate', { min: SCRAP_RATE.min, max: SCRAP_RATE.max, def: SCRAP_RATE.def, allowFloat: true });
    SCRAP_UNIT_IDS.forEach((id) => setConstrains('unit-' + id, { min: 0, def: 0 }));
  }

  _bindEvents() {
    // Numeric text inputs: validate characters while typing, clamp on blur.
    ['#scrap-rate', ...SCRAP_UNIT_IDS.map(scrapCountSelector)].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
      addEvent(el, 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });
    });
    addEvent('#full-numbers', 'change', () => this.recalc());
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

  /** Read the form, compute, render and save the one setting kept. */
  recalc() {
    const p = ScrapDataCollector.readParams();
    options.prm.fullNumbers = p.fullNumbers;
    ScrapRenderer.render(calculateScrap({ counts: p.counts, rate: p.rate }, options.prices));
    options.save();
  }

  /**
   * Fill the counts from a pasted API 2 export. A text that is not one, or
   * one that names none of the units, gets the error dialog and changes nothing.
   *
   * @param {string} text
   * @returns {Promise<boolean>} True when the counts were filled.
   */
  async importOwnApi(text) {
    const data = parseOwnApi(text);
    const counts = data ? scrapCountsFromOwnApi(data) : null;
    if (!counts) {
      await showAlertModal(options.ownApiBadJsonMsg, options.dialogOk);
      return false;
    }
    Object.entries(counts).forEach(([id, count]) => setVal(scrapCountSelector(id), String(count)));
    this.recalc();
    return true;
  }

  /** Every count back to 0 and the rate to the merchant's default. */
  reset() {
    SCRAP_UNIT_IDS.forEach((id) => setVal(scrapCountSelector(id), '0'));
    setVal('#scrap-rate', localizeFloat(SCRAP_RATE.def));
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
