// ============================================================================
// DATA COLLECTION LAYER
// ============================================================================

/**
 * Main data collector - reads all data from DOM
 * This class bridges the gap between jQuery UI and pure data models
 */
class DataCollector {
  constructor() {
    // Cache jQuery selectors for performance
    this._selectorCache = {};
  }

  // ==========================================================================
  // GLOBAL PARAMETERS COLLECTION
  // ==========================================================================

  /**
   * Collect all global parameters from UI
   * @returns {GlobalParams} Complete global settings
   */
  collectGlobalParams() {
    const params = new GlobalParams();

    // Building levels
    params.shipyardLevel = this._getInputNumber('#shipyard-level');
    params.robotFactoryLevelPlanet = this._getInputNumber('#robot-factory-level');
    params.robotFactoryLevelMoon = this._getInputNumber('#robot-factory-level-moon');
    params.naniteFactoryLevel = this._getInputNumber('#nanite-factory-level');

    // Speed settings
    params.universeSpeed = this._getSelectNumber('#universe-speed');
    params.researchSpeed = this._getSelectNumber('#research-speed');

    // Technology levels
    params.researchLabLevel = this._getInputNumber('#research-lab-level');
    params.energyTechLevel = this._getInputNumber('#energy-tech-level');
    params.plasmaTechLevel = this._getInputNumber('#plasma-tech-level');
    params.ionTechLevel = this._getInputNumber('#ion-tech-level');
    params.hyperTechLevel = this._getInputNumber('#hyper-tech-level');

    // Planet settings
    params.maxPlanetTemp = this._getInputNumber('#max-planet-temp');
    params.planetPos = this._getInputNumber('#planet-pos');

    // Officers/bonuses (checkboxes)
    params.geologist = this._getCheckbox('#geologist');
    params.engineer = this._getCheckbox('#engineer');
    params.technocrat = this._getCheckbox('#technocrat');
    params.admiral = this._getCheckbox('#admiral');
    params.commander = this._getCheckbox('#commander');
    params.researchBonus = this._getCheckbox('#research-bonus');
    params.fullNumbers = this._getCheckbox('#full-numbers');

    // Booster
    params.booster = this._getSelectNumber('#booster');

    // Player class (radio buttons)
    params.playerClass = this._getPlayerClass();
    params.isTrader = this._getCheckbox('#is-trader');

    // Intergalactic Research Network
    params.irnLevel = this._getInputNumber('#irn-level');
    this._collectLabLevels(params);

    // Lifeform reductions
    // Per-research cost/time reductions come straight from the "Research bonuses" table
    this._collectLfResearchReductions(params);
    params.mineralResCntrLvl = this._getInputNumber('#mineral-res-cntr-lvl');
    params.lfTerraformerRdc = this._getInputNumber('#lf-terraformer-rdc');
    params.discovererClassBonus = this._getInputNumber('#discoverer-class-bonus');
    params.collectorClassBonus = this._getInputNumber('#lf-collector-class-bonus');

    // Cargo capacity increase
    params.scCapacityIncrease = this._getInputNumber('#sc-capacity-increase');
    params.lcCapacityIncrease = this._getInputNumber('#lc-capacity-increase');

    // Exchange rates
    params.rates = [
      this._getInputNumber('#exchange-rates-m') || 1,
      this._getInputNumber('#exchange-rates-c') || 1.5,
      this._getInputNumber('#exchange-rates-d') || 3,
    ];

    return params;
  }

  /**
   * Collect lab levels from IRN dialog
   * @private
   */
  _collectLabLevels(params) {
    const planetCount = this._getInputNumber('#planetsSpin');
    params.labLevels = [];
    params.labChoice = -1;

    for (let i = 1; i <= planetCount; i++) {
      const level = this._getInputNumber(`#lablevel_${i}`);
      params.labLevels.push(level);

      // Check if this planet is selected for research start
      const isSelected = this._getRadioChecked(`#labchoice_${i}`);
      if (isSelected) {
        params.labChoice = i - 1; // 0-indexed
      }
    }

    // The research lab field is one planet's lab; the network counts only
    // when the player switched it on
    params.useIrn = this._getCheckbox('#use-irn');
  }

  /**
   * Read the per-research cost/time reductions from the "Research bonuses" table
   * into maps keyed by tech id. This table is the only source of the research
   * cost/time bonuses.
   * @private
   */
  _collectLfResearchReductions(params) {
    params.lfResCostRdcMap = {};
    params.lfResTimeRdcMap = {};
    const rows = $$('#lf-research-bonuses-tbody tr');
    rows.forEach(row => {
      const techId = Number.parseInt(row.dataset.techId ?? '', 10);
      if (!techId) return;
      params.lfResCostRdcMap[techId] = this._getInputNumberFromElement(row.querySelector('.lf-research-cost-input'));
      params.lfResTimeRdcMap[techId] = this._getInputNumberFromElement(row.querySelector('.lf-research-time-input'));
    });
  }

  /**
   * Get player class from radio buttons
   * @private
   */
  _getPlayerClass() {
    if (this._getRadioChecked('#class-2')) return 2; // Discoverer
    if (this._getRadioChecked('#class-1')) return 1; // General
    return 0; // Collector (default)
  }

  // ==========================================================================
  // TABLE DATA COLLECTION
  // ==========================================================================

  /**
   * Collect build requests from a table (tabs 1 and 2)
   * @param {string} tableId - Table element ID (e.g., 'table-0-2')
   * @returns {BuildRequest[]} Array of build requests
   */
  collectTableRequests(tableId) {
    const requests = [];
    const rows = this._getTableRows(tableId);

    // Determine table type from ID
    const isMultiLevel = tableId.includes('-1-'); // table-1-* are multi-level
    const isMoonTable = tableId.endsWith('-3'); // table-*-3 are moon buildings
    const hasQtyCol = ['table-0-2', 'table-0-3', 'table-1-2', 'table-1-3'].includes(tableId); // planet and moon buildings on both tabs have qty column

    // Skip header row (0) and footer rows (last 5)
    for (let i = 1; i < rows.length - 5; i++) {
      const rowRequests = this._parseTableRow(rows[i], isMultiLevel, isMoonTable, hasQtyCol);
      this._collectRowRequests(rowRequests, requests);
    }

    return requests;
  }

  /**
   * Push valid requests from a parsed row result into the accumulator
   * @private
   */
  _collectRowRequests(rowRequests, requests) {
    for (const req of rowRequests) {
      if (req?.isValid) {
        requests.push(req);
      }
    }
  }

  /**
   * Parse a single table row into zero or more BuildRequests
   * For multi-level, creates one request per level (e.g., 10→15 = 5 requests)
   * @returns {BuildRequest[]}
   * @private
   */
  _parseTableRow(row, isMultiLevel, defaultIsMoon, hasQtyCol = false) {
    // First cell contains tech ID (hidden)
    const techIdCell = row.cells[0].innerHTML;
    let techId = Number.parseInt(techIdCell);

    if (!techId || techId === 0) {
      return []; // Empty or invalid row
    }

    // Moon buildings have +10000 in table
    let isMoon = defaultIsMoon;
    if (techId > 10000) {
      techId -= 10000;
      isMoon = true;
    }

    // Get levels from input fields
    const toLevel = this._getInputNumberFromElement(row.children[isMultiLevel ? 3 : 2].children[0]);
    const fromLevel = isMultiLevel
      ? this._getInputNumberFromElement(row.children[2].children[0])
      : this._resolveFromLevel(techId, toLevel);

    // Get quantity for planet/moon buildings. The qty input sits after the level
    // inputs, so it is at children[4] on the multi-level tab and children[3] on the single-level tab.
    let quantity = 1;
    if (hasQtyCol) {
      const qtyIdx = isMultiLevel ? 4 : 3;
      const qtyVal = this._getInputNumberFromElement(row.children[qtyIdx].children[0]);
      quantity = Math.max(1, Math.floor(qtyVal || 1));
    }

    // For multi-level tab with multiple levels, create one request per level
    if (isMultiLevel && Math.abs(toLevel - fromLevel) > 1) {
      return this._expandToLevelRequests(techId, fromLevel, toLevel, isMoon, quantity);
    }

    // Single-level or single-step change: return one request
    return [new BuildRequest(techId, fromLevel, toLevel, isMoon, quantity)];
  }

  /**
   * Resolve the implicit fromLevel for single-level rows
   * @private
   */
  _resolveFromLevel(techId, toLevel) {
    if (techId >= 200) return 0; // Ships and defense always start at 0
    return toLevel === 0 ? 0 : toLevel - 1;
  }

  /**
   * Expand a multi-step range into individual per-level BuildRequests
   * @private
   */
  _expandToLevelRequests(techId, fromLevel, toLevel, isMoon, quantity = 1) {
    const requests = [];
    const direction = toLevel > fromLevel ? 1 : -1;
    for (let level = fromLevel; direction > 0 ? level < toLevel : level > toLevel; level += direction) {
      requests.push(new BuildRequest(techId, level, level + direction, isMoon, quantity));
    }
    return requests;
  }

  /**
   * Collect all requests from all tables in a tab group
   * @param {number} outerTab - 0 for single-level, 1 for multi-level
   * @returns {Object} Map of table type to requests
   */
  collectAllTabRequests(outerTab) {
    const result = {};

    if (outerTab === 0) {
      // Single-level tab
      result.buildingsPlanet = this.collectTableRequests('table-0-2');
      result.buildingsMoon = this.collectTableRequests('table-0-3');
      result.research = this.collectTableRequests('table-0-4');
      result.fleet = this.collectTableRequests('table-0-5');
      result.defense = this.collectTableRequests('table-0-6');
    } else if (outerTab === 1) {
      // Multi-level tab
      result.buildingsPlanet = this.collectTableRequests('table-1-2');
      result.buildingsMoon = this.collectTableRequests('table-1-3');
      result.research = this.collectTableRequests('table-1-4');
    }

    return result;
  }

  // ==========================================================================
  // RANGE TAB COLLECTION (Tab 3)
  // ==========================================================================

  /**
   * Collect data from range calculation tab
   * @returns {Object} Range calculation data
   */
  collectRangeData() {
    const techId = this._getSelectNumber('#tech-types-select');
    const fromLevel = this._getInputNumber('#tab2-from-level');
    const toLevel = this._getInputNumber('#tab2-to-level');

    // Generate requests for each level in range
    const requests = [];
    for (let level = fromLevel; level < toLevel; level++) {
      requests.push(new BuildRequest(techId, level, level + 1, false));
    }

    return {
      techId,
      fromLevel,
      toLevel,
      requests,
      techName: this._getSelectedTechName()
    };
  }

  /**
   * Get the name of the selected technology in range tab
   * @private
   */
  _getSelectedTechName() {
    const select = selectEl('#tech-types-select');
    if (!select) return '';
    return select.options[select.selectedIndex]?.text || '';
  }

  // ==========================================================================
  // CHANGED FIELD DETECTION
  // ==========================================================================

  /**
   * Determine which tables are affected by a parameter change
   * This enables optimized recalculation
   * @param {string} fieldId - ID of the changed field
   * @returns {string[]} Array of affected table IDs
   */
  getAffectedTables(fieldId) {
    const affectedMap = {
      // Robot factory affects planet buildings
      'robot-factory-level': [
        'table-0-2', 'table-1-2' // Planet buildings
      ],

      // Moon robot factory affects moon buildings
      'robot-factory-level-moon': [
        'table-0-3', 'table-1-3' // Moon buildings
      ],

      // Nanite affects all construction
      'nanite-factory-level': [
        'table-0-2', 'table-0-3', 'table-0-5', 'table-0-6',
        'table-1-2', 'table-1-3'
      ],

      // Shipyard affects ships and defense
      'shipyard-level': [
        'table-0-5', 'table-0-6'
      ],

      // Ion tech affects deconstruction costs
      'ion-tech-level': [
        'table-0-2', 'table-1-2' // Planet buildings
      ],

      // Hyper tech affects all (cargo capacity in totals)
      'hyper-tech-level': [
        'table-0-2', 'table-0-3', 'table-0-4', 'table-0-5', 'table-0-6',
        'table-1-2', 'table-1-3', 'table-1-4'
      ],

      // Research lab affects research
      'research-lab-level': [
        'table-0-4', 'table-1-4'
      ],

      // Technocrat affects research only
      'technocrat': [
        'table-0-4', 'table-1-4'
      ],

      // The research network decides the lab level research runs at
      'use-irn': ['table-0-4', 'table-1-4'],

      // Research bonus affects research only
      'research-bonus': [
        'table-0-4', 'table-1-4'
      ],

      // Speed affects all
      'universe-speed': [
        'table-0-2', 'table-0-3', 'table-0-5', 'table-0-6',
        'table-1-2', 'table-1-3'
      ],

      'research-speed': [
        'table-0-4', 'table-1-4'
      ],

      // Class affects all (time reduction for discoverer, cargo for collector)
      'class-0': ['*'],
      'class-1': ['*'],
      'class-2': ['*'],

      // Display option - affects all
      'full-numbers': ['*'],

      // The "Research bonuses" table drives all research cost/time reductions
      'lf-research-table': ['table-0-4', 'table-1-4'],

      // The Discoverer class bonus raises the Discoverer research-speed bonus
      'discoverer-class-bonus': ['table-0-4', 'table-1-4'],

      // The Collector class bonus feeds the +25% cargo capacity, so it moves
      // the transports-needed row under every table
      'lf-collector-class-bonus': ['*'],

      // Mineral Research Centre affects planet building tables (mines)
      'mineral-res-cntr-lvl': ['table-0-2', 'table-1-2'],

      // LF Terraformer reduction affects planet building tables
      'lf-terraformer-rdc': ['table-0-2', 'table-1-2'],

      // Cargo capacity increase affects the transports-needed row under every table
      'sc-capacity-increase': ['*'],
      'lc-capacity-increase': ['*'],

      // Exchange rates affect MSU in all tables
      'exchange-rates': ['*']
    };

    const affected = affectedMap[fieldId];

    if (!affected) {
      return []; // No specific tables affected
    }

    if (affected.includes('*')) {
      // All tables affected
      return [
        'table-0-2', 'table-0-3', 'table-0-4', 'table-0-5', 'table-0-6',
        'table-1-2', 'table-1-3', 'table-1-4'
      ];
    }

    return affected;
  }

  /**
   * Check if range tab is affected by a parameter change
   * @param {string} fieldId - ID of the changed field
   * @returns {boolean}
   */
  isRangeTabAffected(fieldId) {
    const rangeAffecting = [
      'energy-tech-level', 'plasma-tech-level', 'max-planet-temp',
      'planet-pos', 'geologist', 'engineer', 'admiral', 'commander',
      'booster', 'universe-speed', 'research-speed', 'technocrat',
      'research-bonus', 'robot-factory-level', 'nanite-factory-level',
      'shipyard-level', 'ion-tech-level', 'hyper-tech-level',
      'class-0', 'class-1', 'class-2', 'is-trader', 'full-numbers', 'use-irn',
      'lf-research-table', 'discoverer-class-bonus', 'lf-collector-class-bonus',
      'mineral-res-cntr-lvl', 'lf-terraformer-rdc',
      'sc-capacity-increase', 'lc-capacity-increase',
      'exchange-rates'
    ];

    return rangeAffecting.includes(fieldId);
  }

  // ==========================================================================
  // HELPER METHODS - jQuery DOM Access
  // ==========================================================================

  /**
   * Get numeric value from input field
   * @private
   */
  _getInputNumber(selector) {
    const element = typeof selector === 'string' ? $(selector) : selector;
    if (!element) return 0;
    return getInputNumber(element) || 0;
  }

  /**
   * Get numeric value from input element (not selector)
   * @private
   */
  _getInputNumberFromElement(element) {
    if (!element) return 0;
    return getInputNumber(element) || 0;
  }

  /**
   * Get numeric value from select field
   * @private
   */
  _getSelectNumber(selector) {
    const element = typeof selector === 'string' ? $(selector) : selector;
    if (!element) return 0;
    return Number.parseInt(element.value) || 0;
  }

  /**
   * Get boolean value from checkbox
   * @private
   */
  _getCheckbox(selector) {
    const element = typeof selector === 'string' ? $(selector) : selector;
    if (!element) return false;
    return element.checked === true;
  }

  /**
   * Get boolean value from radio button
   * @private
   */
  _getRadioChecked(selector) {
    return this._getCheckbox(selector);
  }

  /**
   * Get table rows
   * @private
   */
  _getTableRows(tableId) {
    const table = typeof tableId === 'string' ? $(`#${tableId}`) : tableId;
    return table ? Array.from(table.querySelectorAll('tr')) : [];
  }

  /**
   * Cache and retrieve selector
   * @private
   */
  _cached$(selector) {
    if (!this._selectorCache[selector]) {
      this._selectorCache[selector] = $(selector);
    }
    return this._selectorCache[selector];
  }

  /**
   * Clear selector cache (call when DOM changes)
   */
  clearCache() {
    this._selectorCache = {};
  }
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Tracks what changed to optimize recalculation
 */
class ChangeDetector {
  /** @type {?GlobalParams} */
  lastParams = null;
  lastRequests = {};

  /**
   * Detect what changed since last collection
   * @param {GlobalParams} currentParams
   * @returns {string[]} Array of changed field names
   */
  detectParamChanges(currentParams) {
    if (!this.lastParams) {
      this.lastParams = currentParams.clone();
      return ['*']; // Everything is new
    }

    const changes = [];
    const fields = Object.keys(currentParams);

    for (const field of fields) {
      if (field === 'labLevels') {
        // Special handling for arrays
        if (!this._arraysEqual(currentParams.labLevels, this.lastParams.labLevels)) {
          changes.push('labLevels');
        }
      } else if (currentParams[field] !== this.lastParams[field]) {
        changes.push(field);
      }
    }

    this.lastParams = currentParams.clone();
    return changes;
  }

  /**
   * Detect if table data changed
   * @param {string} tableId
   * @param {BuildRequest[]} currentRequests
   * @returns {boolean}
   */
  detectTableChanges(tableId, currentRequests) {
    const lastRequests = this.lastRequests[tableId];

    if (!lastRequests) {
      this.lastRequests[tableId] = currentRequests;
      return true; // New data
    }

    // Compare request arrays
    if (lastRequests.length !== currentRequests.length) {
      this.lastRequests[tableId] = currentRequests;
      return true;
    }

    for (let i = 0; i < currentRequests.length; i++) {
      const curr = currentRequests[i];
      const last = lastRequests[i];

      if (curr.techId !== last.techId ||
        curr.fromLevel !== last.fromLevel ||
        curr.toLevel !== last.toLevel) {
        this.lastRequests[tableId] = currentRequests;
        return true;
      }
    }

    return false; // No changes
  }

  /**
   * Clear change tracking
   */
  reset() {
    this.lastParams = null;
    this.lastRequests = {};
  }

  /**
   * Compare two arrays for equality
   * @private
   */
  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): the tabs the result was read on, and every field
// that feeds it next to its factory default - except the resources available,
// which the report leaves out by design. reportEntryOf() and
// cleanReportLabel() come from sidebar.js, which every page loads.

// The single-level tab's ships and defence: their one input is a quantity.
const REPORT_QTY_TABLES = new Set(['table-0-5', 'table-0-6']);
// The rows the renderer marks by their role rather than by an element.
const REPORT_SUMMARY_ROWS = new Set(['total', 'grand-total', 'res-needed']);

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function costsReportText(key) {
  return options.reportText?.[key] ?? key;
}

/**
 * The caption of a tab button, '' for a missing one.
 * @param {string} id
 * @returns {string}
 */
function costsTabLabel(id) {
  return cleanReportLabel(document.getElementById(id)?.textContent ?? '');
}

/**
 * The active tab button inside a tab list.
 * @param {string} listId
 * @returns {Element|null}
 */
function costsActiveTab(listId) {
  return document.querySelector(`#${listId} .nav-link.active`);
}

/**
 * The tabs the result is read on: the main tab, and its inner tab where it has
 * them.
 * @returns {ReportModePart[]}
 */
function costsReportMode() {
  /** @type {ReportModePart[]} */
  const mode = [];
  const outer = costsActiveTab('mainTabs');
  if (outer === null) {
    return mode;
  }
  mode.push({ key: outer.id, label: costsTabLabel(outer.id) });
  const inner = costsActiveTab(`innerTabs${outer.id.replace('tabtag-', '')}`);
  if (inner !== null) {
    mode.push({ key: inner.id, label: costsTabLabel(inner.id) });
  }
  return mode;
}

/**
 * Collects the report's entries; `add` reads one field by id.
 */
class CostsReportEntries {
  constructor() {
    /** @type {ReportEntry[]} */
    this.entries = [];
  }

  /**
   * @param {string} id
   * @param {string} group
   * @param {ReportFieldOptions} [opts]
   */
  add(id, group, opts = {}) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      this.entries.push(reportEntryOf(el, { group, ...opts }));
    }
  }

  /**
   * @param {string[]} ids
   * @param {string} group
   */
  addNumbers(ids, group) {
    for (const id of ids) {
      this.add(id, group, { numeric: true });
    }
  }
}

/**
 * The parameter panel: all four of its tabs, the hidden ones included - every
 * field there feeds the result whichever tab is open.
 * @param {CostsReportEntries} out
 */
function costsReportParameters(out) {
  const buildings = costsTabLabel('param-buildings-tab');
  out.addNumbers(['robot-factory-level', 'robot-factory-level-moon', 'nanite-factory-level',
    'shipyard-level', 'research-lab-level'], buildings);
  out.add('use-irn', buildings);
  if (getChecked('#use-irn')) {
    out.addNumbers(['irn-level', 'planetsSpin'], buildings);
    const planets = Number.parseInt(getVal('#planetsSpin'), 10) || 0;
    let start = 0;
    for (let i = 1; i <= planets; i++) {
      out.add(`lablevel_${i}`, buildings, {
        numeric: true,
        label: `${options.planetNumStr}${i} — ${costsReportText('level')}`,
      });
      if (getChecked(`#labchoice_${i}`)) {
        start = i;
      }
    }
    out.entries.push({
      key: 'labchoice', group: buildings, label: `${costsReportText('irn')} — ${costsReportText('start')}`,
      value: start, default: 0, display: `${options.planetNumStr}${start}`,
    });
  }

  out.addNumbers(['ion-tech-level', 'hyper-tech-level'], costsTabLabel('param-researches-tab'));

  const common = costsTabLabel('param-common-tab');
  out.add('country', common);
  out.add('universe', common);
  out.add('universe-speed', common);
  out.add('research-speed', common);
  out.add('research-bonus', common);
  out.add('technocrat', common);
  let playerClass = 0;
  if (getChecked('#class-2')) {
    playerClass = 2;
  } else if (getChecked('#class-1')) {
    playerClass = 1;
  }
  out.entries.push({
    key: 'class', group: common, label: costsReportText('class'),
    value: playerClass, default: 0,
    display: cleanReportLabel(document.querySelector(`label[for="class-${playerClass}"]`)?.textContent ?? ''),
  });
  out.add('is-trader', common);
  const rates = costsReportText('exchange-rates');
  out.add('exchange-rates-m', common, { numeric: true, label: `${rates} — ${costsReportText('metal')}` });
  out.add('exchange-rates-c', common, { numeric: true, label: `${rates} — ${costsReportText('crystal')}` });
  out.add('exchange-rates-d', common, { numeric: true, label: `${rates} — ${costsReportText('deuterium')}` });

  const lifeforms = costsTabLabel('param-lifeforms-tab');
  // The two class bonuses share the caption "Class bonus"; their
  // data-field-title says whose it is.
  for (const id of ['lf-collector-class-bonus', 'discoverer-class-bonus']) {
    const title = document.getElementById(id)?.dataset.fieldTitle;
    out.add(id, lifeforms, title ? { numeric: true, label: title } : { numeric: true });
  }
  out.addNumbers(['mineral-res-cntr-lvl', 'lf-terraformer-rdc'], lifeforms);
  const cargo = costsReportText('cargo-cap-increase');
  out.add('sc-capacity-increase', lifeforms, { numeric: true, label: `${cargo} — ${options.scFull}` });
  out.add('lc-capacity-increase', lifeforms, { numeric: true, label: `${cargo} — ${options.lcFull}` });
  costsReportResearchBonuses(out, lifeforms);
}

/**
 * The "Research bonuses" dialog: a cost and a time reduction per research.
 * @param {CostsReportEntries} out
 * @param {string} group
 */
function costsReportResearchBonuses(out, group) {
  for (const row of document.querySelectorAll('#lf-research-bonuses-tbody tr[data-report-key]')) {
    if (!(row instanceof HTMLTableRowElement)) {
      continue;
    }
    const name = cleanReportLabel(row.cells[0]?.textContent ?? '');
    const slug = row.dataset.reportKey ?? '';
    for (const [suffix, selector] of [['cost', '.lf-research-cost-input'], ['time', '.lf-research-time-input']]) {
      const input = row.querySelector(selector);
      if (input instanceof HTMLInputElement) {
        out.entries.push(reportEntryOf(input, {
          key: `lf-research.${slug}.${suffix}`, group, numeric: true,
          label: `${name} — ${reportLabelOf(input)}`,
        }));
      }
    }
  }
}

/**
 * The element tables of one of the two "all items" tabs: every inner table,
 * not only the open one, because the grand total adds them all up.
 * @param {CostsReportEntries} out
 * @param {number} outerTab - 0 single level, 1 several levels
 */
function costsReportTables(out, outerTab) {
  for (const table of document.querySelectorAll(`#tab-${outerTab} table[id^="table-${outerTab}-"]`)) {
    const inner = table.id.split('-')[2];
    const group = costsTabLabel(`tabtag-${outerTab}-${inner}`);
    let suffixes = ['level', 'qty'];
    if (outerTab === 1) {
      suffixes = ['from', 'to', 'qty'];
    } else if (REPORT_QTY_TABLES.has(table.id)) {
      suffixes = ['qty'];
    }
    for (const row of table.querySelectorAll('tr[data-report-key]')) {
      if (!(row instanceof HTMLTableRowElement)) {
        continue;
      }
      const name = cleanReportLabel(row.cells[1]?.textContent ?? '');
      row.querySelectorAll('input').forEach((input, i) => {
        out.entries.push(reportEntryOf(input, {
          key: `${row.dataset.reportKey}.${suffixes[i] ?? i}`, group, numeric: true,
          label: `${name} — ${reportLabelOf(input)}`,
        }));
      });
    }
  }
}

/**
 * The "one item, several levels" tab: the item and its range, and for a
 * producer the production settings shown under it.
 * @param {CostsReportEntries} out
 * @param {string} group
 */
function costsReportRange(out, group) {
  const select = document.getElementById('tech-types-select');
  if (select instanceof HTMLSelectElement) {
    // The item is what the whole tab is about, so it is named even at its
    // default; the option's group ("Buildings (planet)") is its caption.
    const optgroup = select.selectedOptions[0]?.parentElement;
    const label = optgroup instanceof HTMLOptGroupElement ? cleanReportLabel(optgroup.label) : '';
    const entry = reportEntryOf(select, label === '' ? { group } : { group, label });
    delete entry.default;
    out.entries.push(entry);
  }
  out.addNumbers(['tab2-from-level', 'tab2-to-level'], group);
  if (!hasClass('#range-producer-row', 'd-none')) {
    out.add('booster', group);
    out.addNumbers(['energy-tech-level', 'plasma-tech-level', 'max-planet-temp', 'planet-pos'], group);
    for (const id of ['engineer', 'admiral', 'geologist', 'commander']) {
      out.add(id, group);
    }
  }
}

/**
 * The report hook: the open tabs and every field the result there depends
 * on, defaults included.
 * @returns {ReportSnapshot}
 */
function costsReportSnapshot() {
  const mode = costsReportMode();
  const out = new CostsReportEntries();
  const outer = mode[0]?.key ?? '';
  if (outer === 'tabtag-0' || outer === 'tabtag-1') {
    costsReportTables(out, outer === 'tabtag-0' ? 0 : 1);
  } else if (outer === 'tabtag-2') {
    costsReportRange(out, mode[0].label);
  }
  costsReportParameters(out);
  return { mode, entries: out.entries };
}

/**
 * The caption of a result cell the renderer marked: "<row>, <column>", the
 * row being an element's name, a summary row or a level of the range tab.
 * @param {string} key - e.g. "grand-total.metal", "moon.lunar-base.time", "level-11.metal"
 * @returns {string}
 */
function costsDescribeCell(key) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  const rowKey = key.slice(0, dot);
  const column = costsReportText(key.slice(dot + 1));
  let row = REPORT_SUMMARY_ROWS.has(rowKey) ? costsReportText(rowKey) : '';
  const level = /^level-(\d+)$/.exec(rowKey);
  if (level !== null) {
    row = `${costsReportText('level')} ${level[1]}`;
  } else if (row === '') {
    const tr = document.querySelector(`#mainTabContent tr[data-report-key="${CSS.escape(rowKey)}"]`);
    row = tr instanceof HTMLTableRowElement ? cleanReportLabel(tr.cells[1]?.textContent ?? '') : '';
    if (row !== '' && rowKey.startsWith('moon.')) {
      row = `${row} (${costsReportText('moon')})`;
    }
  }
  return row === '' ? column : `${row}, ${column}`;
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

if (typeof window !== 'undefined') {
  // Cast for the same reason as in costs-core.js: class declarations live in
  // the script's lexical scope, not as globalThis properties.
  const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));
  g.DataCollector = DataCollector;
  g.ChangeDetector = ChangeDetector;
  globalThis.reportSnapshot = costsReportSnapshot;
  globalThis.describeCell = costsDescribeCell;
}
