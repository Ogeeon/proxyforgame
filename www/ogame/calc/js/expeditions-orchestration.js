// ============================================================================
// EXPEDITIONS CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores either the saved state or the parameters passed through the URL API.

'use strict';

// An empty fleet, in the JSON shape the cookie stores it in.
const EXPEDITIONS_EMPTY_FLEET =
  '{"202":0,"203":0,"204":0,"205":0,"206":0,"207":0,"208":0,"209":0,"210":0,"211":0,"213":0,"214":0,"215":0,"218":0,"219":0}';

var options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    highTop: 40000,
    playerClass: 0,
    // The select offers 1..10, so 0 would leave it without a selected option.
    universeSpeed: 1,
    hyperTechLevel: 0,
    percentRes: 0,
    percentShips: 0,
    classBonusCollector: 0,
    classBonusDiscoverer: 0,
    darkMatterDiscoveryBonus: 0,
    resourceDiscoveryBooster: 0,
    // The saved cookie is a comma-separated list of key;value pairs, so the
    // fleet JSON keeps its commas encoded as "~" while it is stored.
    fleet: EXPEDITIONS_EMPTY_FLEET,
    lfShipsBonuses: [],

    validate: function (field, value) {
      switch (field) {
        case 'highTop': return validateNumber(Number.parseFloat(value), 40000, 5000000, 40000);
        case 'playerClass': return validateNumber(Number.parseFloat(value), 0, 2, 0);
        case 'universeSpeed': return validateNumber(Number.parseFloat(value), 1, 10, 1);
        case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'percentRes': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'percentShips': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'classBonusCollector': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'classBonusDiscoverer': return validateNumber(Number.parseFloat(value), 0, 999, 0);
        case 'darkMatterDiscoveryBonus': return validateNumber(Number.parseFloat(value), 0, 9999, 0);
        case 'resourceDiscoveryBooster': return validateNumber(Number.parseFloat(value), 0, 40, 0);
        case 'fleet': return isValidExpeditionFleet(value) ? value.replaceAll('~', ',') : EXPEDITIONS_EMPTY_FLEET;
        case 'lfShipsBonuses': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        default: return value;
      }
    }
  },

  load: function () {
    try {
      loadFromCookie('options_expeditions', options.prm);
      if (!Array.isArray(options.prm.lfShipsBonuses)
          || options.prm.lfShipsBonuses.length !== EXPEDITION_SHIPS.length) {
        options.prm.lfShipsBonuses = EXPEDITION_SHIPS.map(() => 0);
      }
    } catch (e) {
      console.error(e);
    }
  },
  save: function () { saveToCookie('options_expeditions', options.prm); }
};

/** True when the stored value parses into a fleet object once decoded. */
function isValidExpeditionFleet(value) {
  try {
    const parsed = JSON.parse(value.replaceAll('~', ',').replace(/\\(.)/mg, '$1'));
    return !!parsed && typeof parsed === 'object';
  } catch (e) {
    return false;
  }
}

class ExpeditionsApp {
  constructor() {
    this.calc = new ExpeditionsCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow:
    // the parameters, every life-form cargo bonus and every fleet count.
    this.paramInputs = [
      '#tech-hyper-level', '#percent-resources', '#percent-ships',
      '#class-bonus-collector', '#class-bonus-discoverer', '#dark-matter-discovery-bonus',
    ];
    this.numericInputs = this.paramInputs
      .concat(EXPEDITION_SHIPS.map((ship) => '#lf-cargo-' + ship.techId))
      .concat(EXPEDITION_SHIPS.map((ship) => '#num' + ship.abbrev));
    this.selects = ['#highTop', '#player-class', '#universe-speed', '#resource-discovery-booster'];
  }

  init() {
    options.load();
    if (!this._applyApiParams()) {
      this._restoreFromState();
    }
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  /**
   * Apply the parameters passed through the URL API (see the API table on the
   * page). Any parameter that was not passed keeps its default, so the URL
   * fully describes the calculation instead of mixing with the saved cookie.
   *
   * @returns {boolean} True when the URL carried at least one parameter.
   */
  _applyApiParams() {
    const api = (typeof apiParams !== 'undefined') ? apiParams : null;
    if (!api) return false;

    const passed = [
      api.highTopIdx, api.universeSpeed, api.playerClass, api.hyperTechLevel,
      api.percentRes, api.percentShips, api.fleet,
      api.classBonusCollector, api.classBonusDiscoverer,
      api.resourceDiscoveryBooster, api.darkMatterDiscoveryBonus,
    ].some(Boolean);
    if (!passed) return false;

    this._resetParams(false);

    const highTop = $('#highTop');
    if (api.highTopIdx && highTop) highTop.selectedIndex = api.highTopIdx;
    if (api.universeSpeed) setVal('#universe-speed', api.universeSpeed);
    if (api.playerClass) setVal('#player-class', api.playerClass);
    if (api.hyperTechLevel) setVal('#tech-hyper-level', api.hyperTechLevel);
    if (api.percentRes) setNumVal('#percent-resources', api.percentRes);
    if (api.percentShips) setNumVal('#percent-ships', api.percentShips);
    if (api.classBonusCollector) setNumVal('#class-bonus-collector', api.classBonusCollector);
    if (api.classBonusDiscoverer) setNumVal('#class-bonus-discoverer', api.classBonusDiscoverer);
    if (api.resourceDiscoveryBooster) setVal('#resource-discovery-booster', api.resourceDiscoveryBooster);
    if (api.darkMatterDiscoveryBonus) setNumVal('#dark-matter-discovery-bonus', api.darkMatterDiscoveryBonus);
    // Already decoded by PHP, so it needs no parsing.
    if (api.fleet) this._populateFleet(api.fleet);

    return true;
  }

  _restoreFromState() {
    setVal('#highTop', options.prm.highTop);
    setVal('#player-class', options.prm.playerClass);
    setVal('#universe-speed', options.prm.universeSpeed);
    setVal('#tech-hyper-level', options.prm.hyperTechLevel);
    setNumVal('#percent-resources', options.prm.percentRes);
    setNumVal('#percent-ships', options.prm.percentShips);
    setNumVal('#class-bonus-collector', options.prm.classBonusCollector);
    setNumVal('#class-bonus-discoverer', options.prm.classBonusDiscoverer);
    setNumVal('#dark-matter-discovery-bonus', options.prm.darkMatterDiscoveryBonus);
    setVal('#resource-discovery-booster', options.prm.resourceDiscoveryBooster);

    this._renderShipsBonuses();
    try {
      this._populateFleet(JSON.parse(options.prm.fleet));
    } catch (e) {
      console.error(e);
    }
  }

  /** Write the internal bonus array into the life-form bonus table. */
  _renderShipsBonuses() {
    EXPEDITION_SHIPS.forEach((ship, index) => {
      setNumVal('#lf-cargo-' + ship.techId, options.prm.lfShipsBonuses[index] || 0);
    });
  }

  /** Fill the fleet count inputs from a {techId: count} object. */
  _populateFleet(fleet) {
    EXPEDITION_SHIPS.forEach((ship) => {
      const count = fleet[ship.techId];
      if (count !== undefined) setVal('#num' + ship.abbrev, count);
    });
  }

  /** Serialise the fleet count inputs into the {techId: count} JSON. */
  _collectFleet() {
    const fleet = {};
    EXPEDITION_SHIPS.forEach((ship) => {
      const el = $('#num' + ship.abbrev);
      fleet[ship.techId] = el ? (Number.parseInt(el.value, 10) || 0) : 0;
    });
    return fleet;
  }

  _applyConstraints() {
    const percentFields = {
      'percent-resources': 999,
      'percent-ships': 999,
      'class-bonus-collector': 999,
      'class-bonus-discoverer': 999,
      'dark-matter-discovery-bonus': 9999,
    };
    Object.keys(percentFields).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el._constrains = { min: 0, max: percentFields[id], def: 0, allowNegative: false, allowFloat: true };
    });

    const hyperTech = document.getElementById('tech-hyper-level');
    if (hyperTech) hyperTech._constrains = { min: 0, max: 999, def: 0 };

    EXPEDITION_SHIPS.forEach((ship) => {
      const bonus = document.getElementById('lf-cargo-' + ship.techId);
      if (bonus) bonus._constrains = { min: 0, max: Infinity, def: 0, allowNegative: false, allowFloat: true };
      const count = document.getElementById('num' + ship.abbrev);
      if (count) count._constrains = { min: 0, def: 0 };
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

    this.selects.forEach((sel) => {
      const el = $(sel);
      if (el) addEvent(el, 'change', () => this.recalc());
    });

    addEvent('#reset', 'click', () => this._resetParams(true));
    addEvent('#clear-fleet', 'click', () => this._clearFleet());

    // Life-form bonuses reader modal.
    addEvent('#open-lfbr', 'click', () => {
      setVal('#lf-bonuses-txtarea', '');
      bootstrap.Modal.getOrCreateInstance(document.getElementById('lf-bonuses-reader')).show();
    });
    addEvent('#lf-bonuses-read-btn', 'click', () => {
      if (this.readShipsBonuses()) {
        bootstrap.Modal.getInstance(document.getElementById('lf-bonuses-reader')).hide();
        this.recalc();
      }
    });

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
   * Parse the life-form bonus report pasted into the modal. The report lists
   * every unit as an eight-line block; the cargo bonus is the fifth line of a
   * block, counted from the small cargo the search anchors on.
   *
   * @returns {boolean} True when the report could be parsed.
   */
  readShipsBonuses() {
    const lines = getVal('#lf-bonuses-txtarea').split('\n');
    const scName = getOptionValue('smallCargoName', 'small cargo').toLowerCase();
    const scLine = lines.findIndex((line) => line.toLowerCase().includes(scName));
    if (scLine === -1) {
      alert(getOptionValue('missingSCName', '').replace('sc_name', getOptionValue('smallCargoName', '')));
      return false;
    }
    try {
      const bonuses = options.prm.lfShipsBonuses;
      let ship = 0;
      for (let block = 0; block < 17; block++) {
        bonuses[ship] = Number.parseFloat(lines[scLine + block * 8 + 4].replace('%', '').replace('-', '0'));
        if (block === 9 || block === 13) block++; // skip the lamp and the crawler
        ship++;
      }
      this._renderShipsBonuses();
    } catch (e) {
      alert(e);
      return false;
    }
    return true;
  }

  /**
   * Read the form, run the core computation, render the result and persist the
   * parameters.
   */
  recalc() {
    const p = ExpeditionsDataCollector.readParams();
    Object.keys(p).forEach((key) => {
      if (key !== 'counts') options.prm[key] = p[key];
    });
    options.prm.fleet = JSON.stringify(this._collectFleet()).replaceAll(',', '~');

    ExpeditionsRenderer.render(this.calc.compute(p));
    options.save();
  }

  _clearFleet() {
    EXPEDITION_SHIPS.forEach((ship) => setVal('#num' + ship.abbrev, 0));
    this.recalc();
  }

  /**
   * Reset every parameter to its default.
   *
   * @param {boolean} recalc Whether to recompute right away. The URL API resets
   *   first and then fills in its own values, so it skips the interim pass.
   */
  _resetParams(recalc) {
    options.prm.highTop = 40000;
    options.prm.playerClass = 0;
    options.prm.universeSpeed = 1;
    options.prm.hyperTechLevel = 0;
    options.prm.percentRes = 0;
    options.prm.percentShips = 0;
    options.prm.classBonusCollector = 0;
    options.prm.classBonusDiscoverer = 0;
    options.prm.darkMatterDiscoveryBonus = 0;
    options.prm.resourceDiscoveryBooster = 0;
    options.prm.fleet = EXPEDITIONS_EMPTY_FLEET;
    options.prm.lfShipsBonuses = EXPEDITION_SHIPS.map(() => 0);

    this._restoreFromState();
    if (recalc) this.recalc();
  }
}

let expeditionsApp = null;

function initializeExpeditionsCalculator() {
  expeditionsApp = new ExpeditionsApp();
  expeditionsApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThis.expeditionsApp = expeditionsApp;
}

if (typeof globalThis !== 'undefined') {
  globalThis.initializeExpeditionsCalculator = initializeExpeditionsCalculator;
  globalThis.ExpeditionsApp = ExpeditionsApp;
}
