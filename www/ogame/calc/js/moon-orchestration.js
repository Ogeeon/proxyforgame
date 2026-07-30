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

// Widest galaxy the calculator accepts, matching the flight calculator's own
// ceiling for the same setting.
const MOON_MAX_SYSTEMS = 550;

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    moonSize: 1,
    dsCount: 1,
    debrisPercent: 30,
    hyperTechLevel: 0,
    isGeneral: false,
    rcCapacityIncrease: 0,
    defenseToDebris: false,
    deutToDebris: false,
    promoMoon: false,
    supraRefractorLevel: 0,
    phalanxLevel: 1,
    phalanxRangeBonus: 0,
    isDiscoverer: false,
    discovererBonus: 0,
    ownSystem: 1,
    targetSystem: 1,
    // Unlike the flight calculator, which defaults to a galaxy that does not
    // wrap, the phalanx panel assumes it does: nearly every current universe is
    // circular, and the wrong assumption here silently hands the player a range
    // of systems they cannot actually see.
    circularSystems: true,
    numberOfSystems: 499,

    validate: function (field, value) {
      switch (field) {
        case 'moonSize': return validateNumber(Number.parseFloat(value), 1, 10000, 1);
        case 'dsCount': return validateNumber(Number.parseFloat(value), 1, Infinity, 1);
        case 'debrisPercent': return validateNumber(Number.parseFloat(value), 0, 100, 30);
        case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'isGeneral': return value === 'true';
        case 'rcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'defenseToDebris': return value === 'true';
        case 'deutToDebris': return value === 'true';
        case 'promoMoon': return value === 'true';
        case 'supraRefractorLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'phalanxLevel': return validateNumber(Number.parseFloat(value), 1, PHALANX_MAX_LEVEL, 1);
        case 'phalanxRangeBonus': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'isDiscoverer': return value === 'true';
        case 'discovererBonus': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        // The real ceiling is whatever `numberOfSystems` currently holds, which
        // is not known here; _applySystemLimits keeps the fields themselves in
        // step, and the core clamps anything that slips through either way.
        case 'ownSystem': return validateNumber(Number.parseFloat(value), 1, MOON_MAX_SYSTEMS, 1);
        case 'targetSystem': return validateNumber(Number.parseFloat(value), 1, MOON_MAX_SYSTEMS, 1);
        case 'circularSystems': return value === 'true';
        case 'numberOfSystems': return validateNumber(Number.parseFloat(value), 1, MOON_MAX_SYSTEMS, 499);
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
  'isGeneral', 'rcCapacityIncrease',
  'defenseToDebris', 'deutToDebris', 'promoMoon', 'supraRefractorLevel',
  'phalanxLevel', 'phalanxRangeBonus', 'isDiscoverer', 'discovererBonus',
  'ownSystem', 'targetSystem', 'circularSystems', 'numberOfSystems',
];

class MoonApp {
  constructor() {
    this.calc = new MoonCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow:
    // the two destruction fields, the hyperspace level and every unit count.
    this.numericInputs = [
      '#moon-size', '#ds-count', '#hypertech-lvl', '#rc-capacity-increase', '#supra-refractor',
      '#phalanx-lvl', '#phalanx-range-bonus', '#discoverer-bonus',
      '#own-system', '#target-system', '#systems-num',
    ].concat(MOON_UNITS.map((unit) => '#' + unit.id));
    this.checkboxes = [
      '#general-class', '#defense-to-debris', '#deut-to-debris', '#promo-moon',
      '#discoverer-class', '#circular-systems',
    ];
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
    setChecked('#general-class', options.prm.isGeneral);
    setNumVal('#rc-capacity-increase', options.prm.rcCapacityIncrease);
    setChecked('#defense-to-debris', options.prm.defenseToDebris);
    setChecked('#deut-to-debris', options.prm.deutToDebris);
    setChecked('#promo-moon', options.prm.promoMoon);
    setVal('#supra-refractor', options.prm.supraRefractorLevel);

    setVal('#phalanx-lvl', options.prm.phalanxLevel);
    setNumVal('#phalanx-range-bonus', options.prm.phalanxRangeBonus);
    setChecked('#discoverer-class', options.prm.isDiscoverer);
    setNumVal('#discoverer-bonus', options.prm.discovererBonus);
    setVal('#own-system', options.prm.ownSystem);
    setVal('#target-system', options.prm.targetSystem);
    setChecked('#circular-systems', options.prm.circularSystems);
    setVal('#systems-num', options.prm.numberOfSystems);
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
    const supra = document.getElementById('supra-refractor');
    if (supra) supra._constrains = { min: 0, max: 100, def: 0 };
    MOON_UNITS.forEach((unit) => {
      const el = document.getElementById(unit.id);
      if (el) el._constrains = { min: 0, def: 0 };
    });

    setConstrains('phalanx-lvl', { min: 1, max: PHALANX_MAX_LEVEL, def: 1 });
    // Both range bonuses are open-ended: the life form researches behind them
    // have no level cap and no bonus cap.
    setConstrains('phalanx-range-bonus', { min: 0, def: 0, allowNegative: false, allowFloat: true });
    setConstrains('discoverer-bonus', { min: 0, def: 0, allowNegative: false, allowFloat: true });
    setConstrains('systems-num', { min: 1, max: MOON_MAX_SYSTEMS, def: 499 });
    this._applySystemLimits(options.prm.numberOfSystems);
  }

  /**
   * Keep the two coordinate fields inside the galaxy the player described. The
   * ceiling moves with the "number of systems" field, so it cannot live in the
   * static constraints above.
   */
  _applySystemLimits(numberOfSystems) {
    const max = clampNumber(Math.floor(numberOfSystems || 1), 1, MOON_MAX_SYSTEMS);
    setConstrains('own-system', { min: 1, max: max, def: 1 });
    setConstrains('target-system', { min: 1, max: max, def: 1 });
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

    this.checkboxes.forEach((sel) => {
      addEvent(sel, 'change', () => this.recalc());
    });

    addEvent('#reset-ds', 'click', () => this._resetDestroyParams());
    addEvent('#reset-cr', 'click', () => this._resetCreateParams());
    addEvent('#reset-ph', 'click', () => this._resetPhalanxParams());

    // Click a per-unit "max" label to copy that count into the adjacent input.
    // The renderer stashes the raw integer in data-max-count; a dash (no
    // dataset) means the unit cannot contribute, so those clicks are ignored.
    MOON_UNITS.forEach((unit) => {
      const maxLabel = document.getElementById(unit.id + '-max');
      if (!maxLabel) return;
      addEvent(maxLabel, 'click', () => {
        const raw = maxLabel.dataset.maxCount;
        if (raw === undefined) return;
        setVal('#' + unit.id, raw);
        this.recalc();
      });
    });

    // Theme toggle (rendered inside topbar_bs).
    const lightCb = inputEl('#cb-light-theme');
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
    this._applySystemLimits(p.numberOfSystems);
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
    options.prm.isGeneral = false;
    options.prm.rcCapacityIncrease = 0;
    options.prm.defenseToDebris = false;
    options.prm.deutToDebris = false;
    options.prm.promoMoon = false;
    options.prm.supraRefractorLevel = 0;

    setVal('#debris-percent', options.prm.debrisPercent);
    setVal('#hypertech-lvl', options.prm.hyperTechLevel);
    setChecked('#general-class', false);
    setNumVal('#rc-capacity-increase', 0);
    setChecked('#defense-to-debris', false);
    setChecked('#deut-to-debris', false);
    setChecked('#promo-moon', false);
    setVal('#supra-refractor', 0);
    MOON_UNITS.forEach((unit) => setVal('#' + unit.id, 0));

    this.recalc();
  }

  _resetPhalanxParams() {
    options.prm.phalanxLevel = 1;
    options.prm.phalanxRangeBonus = 0;
    options.prm.isDiscoverer = false;
    options.prm.discovererBonus = 0;
    options.prm.ownSystem = 1;
    options.prm.targetSystem = 1;
    options.prm.circularSystems = true;
    options.prm.numberOfSystems = 499;

    setVal('#phalanx-lvl', options.prm.phalanxLevel);
    setNumVal('#phalanx-range-bonus', 0);
    setChecked('#discoverer-class', false);
    setNumVal('#discoverer-bonus', 0);
    setVal('#own-system', options.prm.ownSystem);
    setVal('#target-system', options.prm.targetSystem);
    setChecked('#circular-systems', true);
    setVal('#systems-num', options.prm.numberOfSystems);

    this.recalc();
  }
}

let moonApp = null;

function initializeMoonCalculator() {
  moonApp = new MoonApp();
  moonApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThisRecord().moonApp = moonApp;
}

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initializeMoonCalculator = initializeMoonCalculator;
  globalThisRecord().MoonApp = MoonApp;
}
