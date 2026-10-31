// ============================================================================
// GRAVITON CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores the saved state on load.

'use strict';

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    shipyardLevel: 1,
    nanitesFactoryLevel: 0,
    universeSpeed: 1,
    energyTechLevel: 0,
    hyperTechLevel: 0,
    maxPlanetTemp: 0,
    // Derived from the officers; kept so an older cookie's value can be read.
    energyBonus: 0,
    engineer: false,
    geologist: false,
    technocrat: false,
    admiral: false,
    commander: false,
    solarPlantLevel: 0,
    solarPlantPercent: 100,
    fusionPlantLevel: 0,
    fusionPlantPercent: 100,
    solarSatellitesCount: 0,
    solarSatellitesPercent: 100,
    debrisPercent: 30,
    playerClass: 0,
    isTrader: false,
    energyBoost: 0,
    disChLevel: 0,
    gravitonLevel: 1,
    totalLFEnrgBonus: 0,
    collectorClassBonus: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    rcCapacityIncrease: 0,
    crysAvailable: 0,
    deutAvailable: 0,
    deutInDebris: false,

    validate: function (field, value) {
      switch (field) {
        case 'shipyardLevel': return validateNumber(Number.parseFloat(value), 1, 100, 1);
        case 'nanitesFactoryLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'universeSpeed': return validateNumber(Number.parseFloat(value), 0, 10, 0);
        case 'energyTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'maxPlanetTemp': return validateNumber(Number.parseFloat(value), -134, Infinity, 0);
        case 'energyBonus': return validateNumber(Number.parseFloat(value), 0, 2, 0);
        case 'engineer':
        case 'geologist':
        case 'technocrat':
        case 'admiral':
        case 'commander': return value === 'true';
        case 'solarPlantLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'solarPlantPercent': return validateNumber(Number.parseFloat(value), 0, 100, 100);
        case 'fusionPlantLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'fusionPlantPercent': return validateNumber(Number.parseFloat(value), 0, 100, 100);
        case 'solarSatellitesCount': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'debrisPercent': return validateNumber(Number.parseFloat(value), 0, 100, 30);
        case 'playerClass': return validateNumber(Number.parseInt(value), 0, 2, 0);
        case 'isTrader': return value === 'true';
        case 'energyBoost': return validateNumber(Number.parseInt(value), 0, 8, 0);
        case 'disChLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'gravitonLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        // Same 0..999 range the field's own _constrains enforce on blur: a
        // narrower range here would silently cut back a value the form accepted.
        // The life-form energy bonus has no ceiling in the game.
        case 'totalLFEnrgBonus': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        // The Rock'tal Collector Enhancement total, uncapped as in the cost calculator.
        case 'collectorClassBonus': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'scCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'lcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'rcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'crysAvailable': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'deutAvailable': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'deutInDebris': return value === 'true';
        default: return value;
      }
    }
  },

  load: function () {
    try { loadFromCookie('options_graviton', options.prm); } catch (e) { console.error(e); }
    // Settings saved before the officers had a checkbox each carry only the
    // bonus (0 none, 1 engineer, 2 all five): a bonus that disagrees with the
    // officers can only come from there.
    const prm = options.prm;
    if (prm.energyBonus !== GravitonCalculator.officerEnergyBonus(prm)) {
      prm.engineer = prm.energyBonus >= 1;
      prm.geologist = prm.technocrat = prm.admiral = prm.commander = prm.energyBonus === 2;
    }
  },
  save: function () { saveToCookie('options_graviton', options.prm); }
};

/** The officer checkboxes, by id and options.prm key alike: the profile's officers (profiles-core.js). */
const GRAVITON_OFFICERS = PROFILE_OFFICERS;

class GravitonApp {
  constructor() {
    this.calc = new GravitonCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow.
    this.numericInputs = [
      '#shipyard-level', '#nanites-factory-level', '#energy-tech-level',
      '#hyper-tech-level', '#max-planet-temp', '#solar-plant-level',
      '#fusion-plant-level', '#solar-satellites-count', '#disr-chamber-level',
      '#graviton-level', '#total-lf-energy-bonus', '#lf-collector-class-bonus',
      '#sc-capacity-increase', '#lc-capacity-increase', '#rc-capacity-increase',
      '#crystal-available', '#deuterium-available'
    ];
    this.selects = [
      '#universe-speed', '#solar-plant-percent', '#fusion-plant-percent',
      '#solar-satellites-percent', '#debris-percent', '#energy-boost'
    ];
  }

  init() {
    options.load();
    this.restoreFromState();
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  restoreFromState() {
    setVal('#shipyard-level', options.prm.shipyardLevel);
    setVal('#nanites-factory-level', options.prm.nanitesFactoryLevel);
    setVal('#universe-speed', options.prm.universeSpeed);
    setVal('#energy-tech-level', options.prm.energyTechLevel);
    setVal('#hyper-tech-level', options.prm.hyperTechLevel);
    setNumVal('#max-planet-temp', options.prm.maxPlanetTemp);
    GRAVITON_OFFICERS.forEach((name) => setChecked('#' + name, options.prm[name]));
    setVal('#solar-plant-level', options.prm.solarPlantLevel);
    setVal('#solar-plant-percent', options.prm.solarPlantPercent);
    setVal('#fusion-plant-level', options.prm.fusionPlantLevel);
    setVal('#fusion-plant-percent', options.prm.fusionPlantPercent);
    setVal('#solar-satellites-count', options.prm.solarSatellitesCount);
    setVal('#solar-satellites-percent', options.prm.solarSatellitesPercent);
    setVal('#debris-percent', options.prm.debrisPercent);
    const classRadio = inputEl(`#player-class-${options.prm.playerClass}`);
    if (classRadio) classRadio.checked = true;
    setChecked('#trader-bonus', options.prm.isTrader);
    setVal('#energy-boost', options.prm.energyBoost);
    setVal('#disr-chamber-level', options.prm.disChLevel);
    setVal('#graviton-level', options.prm.gravitonLevel);
    setNumVal('#total-lf-energy-bonus', options.prm.totalLFEnrgBonus);
    setNumVal('#lf-collector-class-bonus', options.prm.collectorClassBonus);
    setNumVal('#sc-capacity-increase', options.prm.scCapacityIncrease);
    setNumVal('#lc-capacity-increase', options.prm.lcCapacityIncrease);
    setNumVal('#rc-capacity-increase', options.prm.rcCapacityIncrease);
    setVal('#crystal-available', options.prm.crysAvailable);
    setVal('#deuterium-available', options.prm.deutAvailable);
    setChecked('#deut-in-debris', options.prm.deutInDebris);
  }

  /**
   * Declare the blur-time constraints for every numeric field. The ranges
   * deliberately mirror options.prm.validate(): without a `_constrains` object a
   * field falls back to options.defConstraints, whose min/max are infinite, so
   * the form would accept a value the cookie validator then silently clamps on
   * the next page load.
   */
  _applyConstraints() {
    // The life-form percentages are the only fractional fields on the page.
    const percent = () => ({ min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true });
    const constraints = {
      'shipyard-level': { min: 1, max: 100, def: 1 },
      'nanites-factory-level': { min: 0, max: 100, def: 0 },
      'energy-tech-level': { min: 0, max: 50, def: 0 },
      'hyper-tech-level': { min: 0, max: 50, def: 0 },
      // The coldest planet in the game sits at -134 degrees; there is no upper
      // bound worth enforcing, so the field is only clamped from below.
      'max-planet-temp': { min: -134, def: 0, allowNegative: true },
      'solar-plant-level': { min: 0, max: 100, def: 0 },
      'fusion-plant-level': { min: 0, max: 100, def: 0 },
      'solar-satellites-count': { min: 0, max: Infinity, def: 0 },
      'disr-chamber-level': { min: 0, max: 100, def: 0 },
      'graviton-level': { min: 0, max: 100, def: 0 },
      'crystal-available': { min: 0, max: Infinity, def: 0 },
      'deuterium-available': { min: 0, max: Infinity, def: 0 },
      // Unlike the capacity bonuses, this one is uncapped.
      'total-lf-energy-bonus': { ...percent(), max: Infinity },
      'lf-collector-class-bonus': { ...percent(), max: Infinity },
      'sc-capacity-increase': percent(),
      'lc-capacity-increase': percent(),
      'rc-capacity-increase': percent()
    };
    Object.entries(constraints).forEach(([id, constrains]) => {
      const el = document.getElementById(id);
      if (el) el._constrains = constrains;
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

    // Selects recompute on change.
    this.selects.forEach((sel) => {
      const el = $(sel);
      if (el) addEvent(el, 'change', () => this.recalc());
    });

    // Officer checkboxes.
    GRAVITON_OFFICERS.forEach((name) => addEvent('#' + name, 'change', () => this.recalc()));

    // Player class radios and the alliance checkbox.
    document.querySelectorAll('input[name="player-class"]').forEach((radio) => {
      radio.addEventListener('change', () => this.recalc());
    });
    addEvent('#trader-bonus', 'change', () => this.recalc());
    addEvent('#deut-in-debris', 'change', () => this.recalc());

    // Reset button.
    addEvent('#reset', 'click', () => this._resetParams());

    // Theme toggle (rendered inside topbar).
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
    }
  }

  /**
   * Read the form, run the core computation, render the result and persist it.
   */
  recalc() {
    const p = GravitonDataCollector.readParams();
    Object.assign(options.prm, p);
    const result = this.calc.compute(p);
    GravitonRenderer.render(result);
    options.save();
  }

  _resetParams() {
    options.prm.shipyardLevel = 1;
    options.prm.nanitesFactoryLevel = 0;
    options.prm.universeSpeed = 1;
    options.prm.energyTechLevel = 0;
    options.prm.hyperTechLevel = 0;
    options.prm.maxPlanetTemp = 0;
    options.prm.energyBonus = 0;
    GRAVITON_OFFICERS.forEach((name) => { options.prm[name] = false; });
    options.prm.solarPlantLevel = 0;
    options.prm.solarPlantPercent = 100;
    options.prm.fusionPlantLevel = 0;
    options.prm.fusionPlantPercent = 100;
    options.prm.solarSatellitesCount = 0;
    options.prm.solarSatellitesPercent = 100;
    options.prm.debrisPercent = 30;
    options.prm.playerClass = 0;
    options.prm.isTrader = false;
    options.prm.energyBoost = 0;
    options.prm.disChLevel = 0;
    options.prm.gravitonLevel = 1;
    options.prm.totalLFEnrgBonus = 0;
    options.prm.collectorClassBonus = 0;
    options.prm.scCapacityIncrease = 0;
    options.prm.lcCapacityIncrease = 0;
    options.prm.rcCapacityIncrease = 0;
    options.prm.crysAvailable = 0;
    options.prm.deutAvailable = 0;
    options.prm.deutInDebris = false;

    this.restoreFromState();
    // restoreFromState only checks the radio matching the restored class;
    // make sure "none" is explicitly selected after a reset.
    setChecked('#player-class-0', true);
    this.recalc();
  }
}

let gravitonApp = null;

function initializeGravitonCalculator() {
  gravitonApp = new GravitonApp();
  gravitonApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThisRecord().gravitonApp = gravitonApp;
}

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initializeGravitonCalculator = initializeGravitonCalculator;
  globalThisRecord().GravitonApp = GravitonApp;
}
