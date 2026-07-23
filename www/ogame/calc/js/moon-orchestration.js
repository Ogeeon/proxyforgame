// ============================================================================
// MOON CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores the saved state on load.
//
// Unit counts are deliberately not persisted: they describe a single battle,
// not a lasting preference (this matches the pre-Bootstrap behaviour).

'use strict';

var options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    moonSize: 1,
    dsCount: 1,
    debrisPercent: 30,
    hyperTechLevel: 0,
    playerClass: 0,
    rcCapacityIncrease: 0,
    defenseToDebris: false,
    deutToDebris: false,
    promoMoon: false,

    validate: function (field, value) {
      switch (field) {
        case 'moonSize': return validateNumber(Number.parseFloat(value), 1, 10000, 1);
        case 'dsCount': return validateNumber(Number.parseFloat(value), 1, Infinity, 1);
        case 'debrisPercent': return validateNumber(Number.parseFloat(value), 0, 100, 30);
        case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'playerClass': return validateNumber(Number.parseInt(value), 0, 2, 0);
        case 'rcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'defenseToDebris': return value === 'true';
        case 'deutToDebris': return value === 'true';
        case 'promoMoon': return value === 'true';
        default: return value;
      }
    }
  },

  load: function () {
    try { loadFromCookie('options_moon', options.prm); } catch (e) { console.error(e); }
  },
  save: function () { saveToCookie('options_moon', options.prm); }
};

// Params carried over from the collected form state into the saved options.
// The unit counts are deliberately absent - see the note at the top.
const MOON_PERSISTED_PARAMS = [
  'moonSize', 'dsCount', 'debrisPercent', 'hyperTechLevel',
  'playerClass', 'rcCapacityIncrease',
  'defenseToDebris', 'deutToDebris', 'promoMoon',
];

class MoonApp {
  constructor() {
    this.calc = new MoonCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow:
    // the two destruction fields, the hyperspace level and every unit count.
    this.numericInputs = ['#moon-size', '#ds-count', '#hypertech-lvl', '#rc-capacity-increase']
      .concat(MOON_UNITS.map((unit) => '#' + unit.id));
    this.checkboxes = ['#defense-to-debris', '#deut-to-debris', '#promo-moon'];
  }

  init() {
    options.load();
    this._restoreFromState();
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  _restoreFromState() {
    setVal('#moon-size', options.prm.moonSize);
    setVal('#ds-count', options.prm.dsCount);
    setVal('#debris-percent', options.prm.debrisPercent);
    setVal('#hypertech-lvl', options.prm.hyperTechLevel);
    const classRadio = $(`#player-class-${options.prm.playerClass}`);
    if (classRadio) classRadio.checked = true;
    setNumVal('#rc-capacity-increase', options.prm.rcCapacityIncrease);
    setChecked('#defense-to-debris', options.prm.defenseToDebris);
    setChecked('#deut-to-debris', options.prm.deutToDebris);
    setChecked('#promo-moon', options.prm.promoMoon);
  }

  _applyConstraints() {
    const moonSize = document.getElementById('moon-size');
    if (moonSize) moonSize._constrains = { min: 1, max: 10000, def: 1 };
    const dsCount = document.getElementById('ds-count');
    if (dsCount) dsCount._constrains = { min: 1, def: 1 };
    const hyperTech = document.getElementById('hypertech-lvl');
    if (hyperTech) hyperTech._constrains = { min: 0, max: 50, def: 0 };
    const rcCap = document.getElementById('rc-capacity-increase');
    if (rcCap) rcCap._constrains = { min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true };
    MOON_UNITS.forEach((unit) => {
      const el = document.getElementById(unit.id);
      if (el) el._constrains = { min: 0, def: 0 };
    });
  }

  _bindEvents() {
    // Numeric text inputs: validate characters while typing, clamp on blur.
    this.numericInputs.forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
      addEvent(el, 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });
    });

    addEvent('#debris-percent', 'change', () => this.recalc());

    // Player class radios (only the General changes the recycler hold).
    document.querySelectorAll('input[name="player-class"]').forEach((radio) => {
      radio.addEventListener('change', () => this.recalc());
    });

    this.checkboxes.forEach((sel) => {
      addEvent(sel, 'change', () => this.recalc());
    });

    addEvent('#reset-ds', 'click', () => this._resetDestroyParams());
    addEvent('#reset-cr', 'click', () => this._resetCreateParams());

    // Theme toggle (rendered inside topbar_bs).
    const lightCb = $('#cb-light-theme');
    if (lightCb) {
      lightCb.addEventListener('click', () => {
        if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
      });
    }
  }

  _applyTheme() {
    const theme = { value: 'light', validate: (k, v) => v };
    loadFromCookie('theme', theme);
    if (typeof toggleLightBS === 'function') {
      toggleLightBS(theme.value === 'light');
    } else if (typeof toggleLight === 'function') {
      toggleLight(theme.value === 'light');
    }
  }

  /**
   * Read the form, run the core computation, render the result and persist the
   * (non-transient) parameters.
   */
  recalc() {
    const p = MoonDataCollector.readParams();
    MOON_PERSISTED_PARAMS.forEach((key) => { options.prm[key] = p[key]; });
    MoonRenderer.render(this.calc.compute(p));
    options.save();
  }

  _resetDestroyParams() {
    options.prm.moonSize = 1;
    options.prm.dsCount = 1;
    setVal('#moon-size', options.prm.moonSize);
    setVal('#ds-count', options.prm.dsCount);
    this.recalc();
  }

  _resetCreateParams() {
    options.prm.debrisPercent = 30;
    options.prm.hyperTechLevel = 0;
    options.prm.playerClass = 0;
    options.prm.rcCapacityIncrease = 0;
    options.prm.defenseToDebris = false;
    options.prm.deutToDebris = false;
    options.prm.promoMoon = false;

    setVal('#debris-percent', options.prm.debrisPercent);
    setVal('#hypertech-lvl', options.prm.hyperTechLevel);
    setChecked('#player-class-0', true);
    setNumVal('#rc-capacity-increase', 0);
    setChecked('#defense-to-debris', false);
    setChecked('#deut-to-debris', false);
    setChecked('#promo-moon', false);
    MOON_UNITS.forEach((unit) => setVal('#' + unit.id, 0));

    this.recalc();
  }
}

let moonApp = null;

function initializeMoonCalculator() {
  moonApp = new MoonApp();
  moonApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThis.moonApp = moonApp;
}

if (typeof globalThis !== 'undefined') {
  globalThis.initializeMoonCalculator = initializeMoonCalculator;
  globalThis.MoonApp = MoonApp;
}
