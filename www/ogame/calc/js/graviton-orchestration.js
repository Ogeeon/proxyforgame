// ============================================================================
// GRAVITON CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores the saved state on load.

'use strict';

var options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    shipyardLevel: 1,
    nanitesFactoryLevel: 0,
    universeSpeed: 1,
    energyTechLevel: 0,
    hyperTechLevel: 0,
    maxPlanetTemp: 0,
    energyBonus: 0,
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
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    rcCapacityIncrease: 0,

    validate: function (field, value) {
      switch (field) {
        case 'shipyardLevel': return validateNumber(Number.parseFloat(value), 1, 100, 1);
        case 'nanitesFactoryLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'universeSpeed': return validateNumber(Number.parseFloat(value), 0, 10, 0);
        case 'energyTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
        case 'maxPlanetTemp': return validateNumber(Number.parseFloat(value), -134, Infinity, 0);
        case 'energyBonus': return validateNumber(Number.parseFloat(value), 0, 2, 0);
        case 'solarPlantLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'solarPlantPercent': return validateNumber(Number.parseFloat(value), 0, 100, 100);
        case 'fusionPlantLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'fusionPlantPercent': return validateNumber(Number.parseFloat(value), 0, 100, 100);
        case 'solarSatellitesCount': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        case 'debrisPercent': return validateNumber(Number.parseFloat(value), 0, 40, 100);
        case 'playerClass': return validateNumber(Number.parseInt(value), 0, 2, 0);
        case 'isTrader': return value === 'true';
        case 'energyBoost': return validateNumber(Number.parseInt(value), 0, 8, 0);
        case 'disChLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'gravitonLevel': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'totalLFEnrgBonus': return validateNumber(Number.parseFloat(value), 0, 100, 0);
        case 'scCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'lcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'rcCapacityIncrease': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        default: return value;
      }
    }
  },

  load: function () {
    try { loadFromCookie('options_graviton', options.prm); } catch (e) { console.error(e); }
  },
  save: function () { saveToCookie('options_graviton', options.prm); }
};

class GravitonApp {
  constructor() {
    this.calc = new GravitonCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow.
    this.numericInputs = [
      '#shipyard-level', '#nanites-factory-level', '#energy-tech-level',
      '#hyper-tech-level', '#max-planet-temp', '#solar-plant-level',
      '#fusion-plant-level', '#solar-satellites-count', '#disr-chamber-level',
      '#graviton-level', '#total-lf-energy-bonus',
      '#sc-capacity-increase', '#lc-capacity-increase', '#rc-capacity-increase'
    ];
    this.selects = [
      '#universe-speed', '#solar-plant-percent', '#fusion-plant-percent',
      '#solar-satellites-percent', '#debris-percent', '#energy-boost'
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
    setVal('#shipyard-level', options.prm.shipyardLevel);
    setVal('#nanites-factory-level', options.prm.nanitesFactoryLevel);
    setVal('#universe-speed', options.prm.universeSpeed);
    setVal('#energy-tech-level', options.prm.energyTechLevel);
    setVal('#hyper-tech-level', options.prm.hyperTechLevel);
    setNumVal('#max-planet-temp', options.prm.maxPlanetTemp);
    const bonusRadio = $(`#energy-bonus-${options.prm.energyBonus}`);
    if (bonusRadio) bonusRadio.checked = true;
    setVal('#solar-plant-level', options.prm.solarPlantLevel);
    setVal('#solar-plant-percent', options.prm.solarPlantPercent);
    setVal('#fusion-plant-level', options.prm.fusionPlantLevel);
    setVal('#fusion-plant-percent', options.prm.fusionPlantPercent);
    setVal('#solar-satellites-count', options.prm.solarSatellitesCount);
    setVal('#solar-satellites-percent', options.prm.solarSatellitesPercent);
    setVal('#debris-percent', options.prm.debrisPercent);
    const classRadio = $(`#player-class-${options.prm.playerClass}`);
    if (classRadio) classRadio.checked = true;
    setChecked('#trader-bonus', options.prm.isTrader);
    setVal('#energy-boost', options.prm.energyBoost);
    setVal('#disr-chamber-level', options.prm.disChLevel);
    setVal('#graviton-level', options.prm.gravitonLevel);
    setNumVal('#total-lf-energy-bonus', options.prm.totalLFEnrgBonus);
    setNumVal('#sc-capacity-increase', options.prm.scCapacityIncrease);
    setNumVal('#lc-capacity-increase', options.prm.lcCapacityIncrease);
    setNumVal('#rc-capacity-increase', options.prm.rcCapacityIncrease);
  }

  _applyConstraints() {
    const shipyard = document.getElementById('shipyard-level');
    if (shipyard) shipyard._constrains = { min: 1, def: 1 };
    const temp = document.getElementById('max-planet-temp');
    if (temp) temp._constrains = { min: -134, def: 0, allowNegative: true };
    const lfBonus = document.getElementById('total-lf-energy-bonus');
    if (lfBonus) lfBonus._constrains = { min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true };
    const scCap = document.getElementById('sc-capacity-increase');
    if (scCap) scCap._constrains = { min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true };
    const lcCap = document.getElementById('lc-capacity-increase');
    if (lcCap) lcCap._constrains = { min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true };
    const rcCap = document.getElementById('rc-capacity-increase');
    if (rcCap) rcCap._constrains = { min: 0, max: 999, def: 0, allowNegative: false, allowFloat: true };
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

    // Energy officer bonus radios.
    document.querySelectorAll('input[name="energy-bonus"]').forEach((radio) => {
      radio.addEventListener('change', () => this.recalc());
    });

    // Player class radios and the alliance checkbox.
    document.querySelectorAll('input[name="player-class"]').forEach((radio) => {
      radio.addEventListener('change', () => this.recalc());
    });
    addEvent('#trader-bonus', 'change', () => this.recalc());

    // Reset button.
    addEvent('#reset', 'click', () => this._resetParams());

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
    options.prm.scCapacityIncrease = 0;
    options.prm.lcCapacityIncrease = 0;
    options.prm.rcCapacityIncrease = 0;

    this._restoreFromState();
    // _restoreFromState only checks the radios matching the restored params;
    // make sure the "none" options are explicitly selected after a reset.
    setChecked('#energy-bonus-0', true);
    setChecked('#player-class-0', true);
    this.recalc();
  }
}

let gravitonApp = null;

function initializeGravitonCalculator() {
  gravitonApp = new GravitonApp();
  gravitonApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThis.gravitonApp = gravitonApp;
}

if (typeof globalThis !== 'undefined') {
  globalThis.initializeGravitonCalculator = initializeGravitonCalculator;
  globalThis.GravitonApp = GravitonApp;
}
