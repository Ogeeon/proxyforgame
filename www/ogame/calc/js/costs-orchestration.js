// ============================================================================
// MAIN APPLICATION CONTROLLER
// ============================================================================

/**
 * Main application controller
 * Orchestrates DataCollector, Calculator, and Renderer
 */
class CostsCalculator {
  constructor(techCosts, techReqs) {
    // Core components
    this.calculator = new Calculator(techCosts, techReqs);
    this.collector = new DataCollector();
    this.renderer = new Renderer();
    this.changeDetector = new ChangeDetector();

    // State
    this.currentParams = null;
    this.isInitialized = false;

    // Performance tracking
    this.stats = {
      calculations: 0,
      renders: 0,
      totalTime: 0
    };
  }

  /**
   * Initialize the application
   */
  init() {
    if (this.isInitialized) {
      console.warn('CostsCalculator already initialized');
      return;
    }

    console.log('Initializing CostsCalculator...');

    // Load saved state from cookies
    this.loadState();

    // Bind all event handlers
    this.bindEvents();

    // Initial calculation
    this.recalculateAll();

    this.isInitialized = true;
    console.log('CostsCalculator initialized');
  }

  // ==========================================================================
  // MAIN CALCULATION METHODS
  // ==========================================================================

  /**
   * Recalculate everything from scratch
   * Called on page load and when many things change
   */
  recalculateAll() {
    const startTime = performance.now();

    console.log('Recalculating all tables...');

    // 1. Collect global parameters
    this.currentParams = this.collector.collectGlobalParams();

    // 2. Recalculate single-level tab (tab 0)
    this._recalculateTabGroup(0);

    // 3. Recalculate multi-level tab (tab 1)
    this._recalculateTabGroup(1);

    // 4. Recalculate range tab (tab 2)
    this.recalculateRangeTab();

    // 5. Save state
    this.saveState();

    const elapsed = performance.now() - startTime;
    this.stats.totalTime += elapsed;
    console.log(`Recalculation complete in ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Recalculate a specific tab group
   * @private
   */
  _recalculateTabGroup(outerTab) {
    const tableIds = this._getTableIdsForTab(outerTab);
    const batchRenderer = new BatchRenderer();

    const allRequests = {};
    const allResults = {};

    // Calculate all tables
    tableIds.forEach(tableId => {
      const requests = this.collector.collectTableRequests(tableId);
      const results = this._calculateRequests(requests);

      allRequests[tableId] = requests;
      allResults[tableId] = results;
    });

    // Render all tables in one batch
    batchRenderer.renderAllTables(outerTab, allRequests, allResults, this.currentParams);

    this.stats.calculations++;
    this.stats.renders++;
  }

  /**
   * Recalculate only specific tables
   * @param {string[]} tableIds - Array of table IDs to recalculate
   */
  recalculateTables(tableIds) {
    const startTime = performance.now();

    console.log(`Recalculating tables: ${tableIds.join(', ')}`);

    // Ensure we have current params
    if (!this.currentParams) {
      this.currentParams = this.collector.collectGlobalParams();
    }

    tableIds.forEach(tableId => {
      const requests = this.collector.collectTableRequests(tableId);
      const results = this._calculateRequests(requests);

      this.renderer.renderTable(tableId, requests, results, this.currentParams);
    });

    // Update grand totals for affected tab groups
    const affectedTabs = new Set();
    tableIds.forEach(id => {
      if (id.startsWith('table-0-')) affectedTabs.add(0);
      if (id.startsWith('table-1-')) affectedTabs.add(1);
    });

    affectedTabs.forEach(tab => this._updateGrandTotals(tab));

    const elapsed = performance.now() - startTime;
    this.stats.totalTime += elapsed;
    this.stats.calculations++;
    this.stats.renders++;

    console.log(`Tables recalculated in ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Update grand totals for a tab group
   * @private
   */
  _updateGrandTotals(outerTab) {
    const tableIds = this._getTableIdsForTab(outerTab);
    let grandTotal = BuildCost.zero();
    let maxEnergy = 0;

    // Collect all results from all tables
    tableIds.forEach(tableId => {
      const requests = this.collector.collectTableRequests(tableId);
      const results = this._calculateRequests(requests);

      results.forEach(result => {
        grandTotal = grandTotal.add(result);
        maxEnergy = Math.max(maxEnergy, result.energy);
      });
    });

    grandTotal.energy = maxEnergy;
    this.renderer.renderGrandTotals(outerTab, grandTotal, this.currentParams);
  }

  /**
   * Recalculate range tab (tab 3)
   */
  recalculateRangeTab() {
    const rangeData = this.collector.collectRangeData();

    if (rangeData.requests.length === 0) {
      return; // Nothing to calculate
    }

    const { techId, requests } = rangeData;

    // Calculate costs for each level
    const results = this._calculateRequests(requests);

    // Calculate production/consumption if applicable
    const isProducer = [1, 2, 3, 4, 12, 212].includes(techId);
    const isConsumer = [1, 2, 3, 12].includes(techId);

    const productions = {};
    const consumptions = {};

    if (isProducer || isConsumer) {
      requests.forEach((req, index) => {
        const level = req.toLevel;

        if (isProducer) {
          productions[level] = this.calculator.calculateProduction(
            techId, level, this.currentParams
          );
        }

        if (isConsumer) {
          consumptions[level] = this.calculator.calculateConsumption(
            techId, level, this.currentParams
          );
        }
      });
    }

    // Render
    this.renderer.renderRangeTable(
      rangeData,
      results,
      isProducer ? productions : null,
      isConsumer ? consumptions : null,
      this.currentParams
    );
  }

  /**
   * Calculate array of requests
   * @private
   */
  _calculateRequests(requests) {
    return requests.map(req => {
      const result = this.calculator.calculate(req, this.currentParams);

      // Check if research is impossible
      if (result.isZero && req.isValid && req.techType === 'research') {
        // Research requirements not met
        const techName = this._getTechName(req.techId);
        if (techName) {
          this.renderer.showResearchImpossibleError(techName);
        }
      }

      return result;
    });
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Bind all event handlers
   */
  bindEvents() {
    console.log('Binding event handlers...');

    // Global parameter inputs - trigger full recalculation
    this._bindGlobalParamEvents();

    // Table inputs - trigger table-specific recalculation
    this._bindTableEvents();

    // Range tab - trigger range recalculation
    this._bindRangeTabEvents();

    // Special buttons
    this._bindSpecialEvents();

    console.log('Event handlers bound');
  }

  /**
   * Bind global parameter events
   * @private
   */
  _bindGlobalParamEvents() {
    // Building level inputs
    const buildingInputs = [
      '#shipyard-level',
      '#robot-factory-level',
      '#robot-factory-level-moon',
      '#nanite-factory-level'
    ];

    buildingInputs.forEach(selector => {
      $(selector).unbind('keyup');
      $(selector).keyup((event) => {
        // Validate input first (if function exists from utils.js)
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange(selector.substring(1));
      });
    });

    // Technology level inputs
    const techInputs = [
      '#research-lab-level',
      '#ion-tech-level',
      '#hyper-tech-level',
      '#energy-tech-level',
      '#plasma-tech-level',
      '#max-planet-temp',
      '#planet-pos'
    ];

    techInputs.forEach(selector => {
      $(selector).unbind('keyup');
      $(selector).keyup((event) => {
        // Validate input first (if function exists from utils.js)
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange(selector.substring(1));
      });
    });

    // Selects
    $('#universe-speed, #research-speed, #booster').unbind('change');
    $('#universe-speed, #research-speed, #booster').change(() => {
      this._handleParamChange('speed');
    });

    // Checkboxes
    const checkboxes = [
      '#technocrat',
      '#research-bonus',
      '#full-numbers',
      '#geologist',
      '#engineer',
      '#admiral',
      '#commander'
    ];

    // Unbind old click handlers from costs.js to prevent conflicts
    checkboxes.forEach(selector => {
      $(selector).unbind('click');
      // Bind new handler
      $(selector).click(() => this._handleParamChange(selector.substring(1)));
    });

    // Radio buttons (class)
    $('input[name="class"]').unbind('click');
    $('input[name="class"]').click(() => this._handleParamChange('class'));
  }

  /**
   * Bind table input events
   * @private
   */
  _bindTableEvents() {
    // Clear any existing keyup handlers
    $('#tab-0 input:text').unbind('keyup');
    $('#tab-1 input:text').unbind('keyup');

    // Single-level and multi-level tab inputs - new handlers with validation
    $('#tab-0 input:text, #tab-1 input:text').bind('keyup', (event) => {
      // Validate input first (if function exists from utils.js)
      if (typeof validateInputNumber === 'function') {
        validateInputNumber.call(event.target, event);
      }
      this._handleTableInputChange(event);
    });
  }

  /**
   * Bind range tab events
   * @private
   */
  _bindRangeTabEvents() {
    // Unbind old handlers first
    $('#tech-types-select').unbind('change').unbind('keyup');
    $('#tab2-from-level, #tab2-to-level').unbind('keyup').unbind('blur');
    // Also unbind old handler namespaced events
    $('#tech-types-select').unbind('keyup.updateOneMultTab');
    $('#tab2-from-level, #tab2-to-level').unbind('keyup.updateOneMultTab');
    $('#tab2-from-level, #tab2-to-level').unbind('blur.updateOneMultTab');

    $('#tech-types-select').change(() => {
      this.recalculateRangeTab();
    });

    $('#tab2-from-level, #tab2-to-level').keyup((event) => {
      // Validate input first (if function exists from utils.js)
      if (typeof validateInputNumber === 'function') {
        validateInputNumber.call(event.target, event);
      }
      this.recalculateRangeTab();
    });

    $('#tab2-from-level, #tab2-to-level').blur((event) => {
      // Validate on blur (if function exists from utils.js)
      if (typeof validateInputNumberOnBlur === 'function') {
        validateInputNumberOnBlur.call(event.target, event);
      }
      this.recalculateRangeTab();
    });
  }

  /**
   * Bind special events
   * @private
   */
  _bindSpecialEvents() {
    // Unbind old handlers first
    $('#reset').unbind('click');
    $('#open-llc-dialog').unbind('click');

    // Reset button
    $('#reset').click(() => this.reset());

    // IRN calculator dialog
    $('#open-llc-dialog').click(() => {
      this._openIRNDialog();
    });
  }

  /**
   * Handle global parameter change
   * @private
   */
  _handleParamChange(fieldId) {
    // Collect current params
    this.currentParams = this.collector.collectGlobalParams();

    // Determine affected tables
    const affectedTables = this.collector.getAffectedTables(fieldId);

    if (affectedTables.length === 0 || affectedTables.includes('*')) {
      // Recalculate everything
      this.recalculateAll();
    } else {
      // Recalculate only affected tables
      this.recalculateTables(affectedTables);
    }

    // Check if range tab is affected
    if (this.collector.isRangeTabAffected(fieldId)) {
      this.recalculateRangeTab();
    }

    // Save state
    this.saveState();
  }

  /**
   * Handle table input change
   * @private
   */
  _handleTableInputChange(event) {
    // Get the table this input belongs to
    const tableId = this._getTableIdFromInput(event.target);

    if (tableId) {
      this.recalculateTables([tableId]);

      // Update grand totals for the tab group
      const outerTab = tableId.startsWith('table-1-') ? 1 : 0;
      this._updateGrandTotals(outerTab);
    }
  }

  /**
   * Get table ID from an input element
   * @private
   */
  _getTableIdFromInput(inputElement) {
    // Walk up the DOM to find the table
    let element = inputElement;
    while (element && element.tagName !== 'TABLE') {
      element = element.parentElement;
    }

    return element ? element.id : null;
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Storage key for this calculator
   */
  static STORAGE_KEY = 'costs_calculator_state';

  /**
   * Check if localStorage is available
   * @private
   */
  _isStorageAvailable() {
    try {
      return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Save current state to localStorage
   * Uses native JSON serialization
   */
  saveState() {
    if (!this.currentParams) {
      this.currentParams = this.collector.collectGlobalParams();
    }

    // Convert params to plain object for JSON serialization
    const state = {
      shipyardLevel: this.currentParams.shipyardLevel,
      robotFactoryLevelPlanet: this.currentParams.robotFactoryLevelPlanet,
      robotFactoryLevelMoon: this.currentParams.robotFactoryLevelMoon,
      naniteFactoryLevel: this.currentParams.naniteFactoryLevel,
      universeSpeed: this.currentParams.universeSpeed,
      researchSpeed: this.currentParams.researchSpeed,
      researchLabLevel: this.currentParams.researchLabLevel,
      energyTechLevel: this.currentParams.energyTechLevel,
      plasmaTechLevel: this.currentParams.plasmaTechLevel,
      ionTechLevel: this.currentParams.ionTechLevel,
      hyperTechLevel: this.currentParams.hyperTechLevel,
      maxPlanetTemp: this.currentParams.maxPlanetTemp,
      planetPos: this.currentParams.planetPos,
      geologist: this.currentParams.geologist,
      engineer: this.currentParams.engineer,
      technocrat: this.currentParams.technocrat,
      admiral: this.currentParams.admiral,
      commander: this.currentParams.commander,
      researchBonus: this.currentParams.researchBonus,
      playerClass: this.currentParams.playerClass,
      booster: this.currentParams.booster,
      irnLevel: this.currentParams.irnLevel,
      labLevels: this.currentParams.labLevels,
      labChoice: this.currentParams.labChoice,
      fullNumbers: this.currentParams.fullNumbers
    };

    try {
      const json = JSON.stringify(state);
      if (this._isStorageAvailable()) {
        localStorage.setItem(CostsCalculator.STORAGE_KEY, json);
      } else {
        // Fallback to cookie for browsers without localStorage
        const d = new Date();
        d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
        document.cookie = CostsCalculator.STORAGE_KEY + '=' + encodeURIComponent(json) +
          '; expires=' + d.toUTCString() + '; path=/';
      }
    } catch (e) {
      console.error('Failed to save state:', e.message);
    }
  }

  /**
   * Load state from localStorage
   * Uses native JSON deserialization
   */
  loadState() {
    try {
      let json = null;

      // Try localStorage first
      if (this._isStorageAvailable()) {
        json = localStorage.getItem(CostsCalculator.STORAGE_KEY);
      }

      // Fallback to cookie if localStorage is empty
      if (!json) {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].trim();
          if (cookie.startsWith(CostsCalculator.STORAGE_KEY + '=')) {
            json = decodeURIComponent(cookie.substring(CostsCalculator.STORAGE_KEY.length + 1));
            break;
          }
        }
      }

      let state = null;

      // Parse saved state
      if (json) {
        try {
          state = JSON.parse(json);
        } catch (e) {
          console.warn('Failed to parse saved state');
        }
      }

      if (state) {
        console.log('Loading state from storage...');

        // Apply state to UI elements
        this._applyStateToUI(state);

        // Collect params after applying state
        this.currentParams = this.collector.collectGlobalParams();

        console.log('State loaded');
      }
    } catch (e) {
      console.error('Failed to load state:', e.message, e.stack);
    }
  }

  /**
   * Apply saved state to UI elements
   * @private
   */
  _applyStateToUI(state) {
    // Building levels
    if (state.shipyardLevel !== undefined) {
      $('#shipyard-level').val(state.shipyardLevel);
    }
    if (state.robotFactoryLevelPlanet !== undefined) {
      $('#robot-factory-level').val(state.robotFactoryLevelPlanet);
    }
    if (state.robotFactoryLevelMoon !== undefined) {
      $('#robot-factory-level-moon').val(state.robotFactoryLevelMoon);
    }
    if (state.naniteFactoryLevel !== undefined) {
      $('#nanite-factory-level').val(state.naniteFactoryLevel);
    }

    // Speeds
    if (state.universeSpeed !== undefined) {
      $('#universe-speed').val(state.universeSpeed);
    }
    if (state.researchSpeed !== undefined) {
      $('#research-speed').val(state.researchSpeed);
    }

    // Technologies
    if (state.researchLabLevel !== undefined) {
      $('#research-lab-level').val(state.researchLabLevel);
    }
    if (state.ionTechLevel !== undefined) {
      $('#ion-tech-level').val(state.ionTechLevel);
    }
    if (state.hyperTechLevel !== undefined) {
      $('#hyper-tech-level').val(state.hyperTechLevel);
    }
    if (state.energyTechLevel !== undefined) {
      $('#energy-tech-level').val(state.energyTechLevel);
    }
    if (state.plasmaTechLevel !== undefined) {
      $('#plasma-tech-level').val(state.plasmaTechLevel);
    }
    if (state.maxPlanetTemp !== undefined) {
      $('#max-planet-temp').val(state.maxPlanetTemp);
    }
    if (state.planetPos !== undefined) {
      $('#planet-pos').val(state.planetPos);
    }

    // Officers/bonuses
    if (state.geologist === true) { $('#geologist').attr('checked', 'checked'); } else { $('#geologist').removeAttr('checked'); }
    if (state.engineer === true) { $('#engineer').attr('checked', 'checked'); } else { $('#engineer').removeAttr('checked'); }
    if (state.technocrat === true) { $('#technocrat').attr('checked', 'checked'); } else { $('#technocrat').removeAttr('checked'); }
    if (state.admiral === true) { $('#admiral').attr('checked', 'checked'); } else { $('#admiral').removeAttr('checked'); }
    if (state.commander === true) { $('#commander').attr('checked', 'checked'); } else { $('#commander').removeAttr('checked'); }
    if (state.researchBonus === true) { $('#research-bonus').attr('checked', 'checked'); } else { $('#research-bonus').removeAttr('checked'); }
    if (state.fullNumbers === true) { $('#full-numbers').attr('checked', 'checked'); } else { $('#full-numbers').removeAttr('checked'); }

    // Class
    if (state.playerClass !== undefined) {
      $(`#class-${state.playerClass}`).attr('checked', 'checked');
    }

    // Booster
    if (state.booster !== undefined) {
      $('#booster').val(state.booster);
    }

    // IRN
    if (state.irnLevel !== undefined) {
      $('#irn-level').val(state.irnLevel);
    }
    if (state.labLevels && state.labLevels.length > 0) {
      const planetCount = state.labLevels.length;
      $('#planetsSpin').val(planetCount);

      // Set lab levels
      state.labLevels.forEach((level, index) => {
        const planetNum = index + 1;
        $(`#lablevel_${planetNum}`).val(level);

        if (level > 0) {
          $(`#labchoice_${planetNum}`).removeAttr('disabled');
        }

        if (state.labChoice === index) {
          $(`#labchoice_${planetNum}`).attr('checked', 'checked');
        }
      });
    }
  }

  /**
   * Reset all values to defaults
   */
  reset() {
    console.log('Resetting calculator...');

    // Reset to default params
    this.currentParams = new GlobalParams();

    // Clear all UI inputs
    this._resetUI();

    // Recalculate everything
    this.recalculateAll();

    console.log('Calculator reset');
  }

  /**
   * Reset UI to defaults
   * @private
   */
  _resetUI() {
    // Building levels
    $('#shipyard-level').val(0);
    $('#robot-factory-level').val(0);
    $('#robot-factory-level-moon').val(0);
    $('#nanite-factory-level').val(0);

    // Speeds
    $('#universe-speed').val(1);
    $('#research-speed').val(1);

    // Technologies
    $('#research-lab-level').val(0);
    $('#ion-tech-level').val(0);
    $('#hyper-tech-level').val(0);
    $('#energy-tech-level').val(0);
    $('#plasma-tech-level').val(0);
    $('#max-planet-temp').val(0);
    $('#planet-pos').val(8);

    // Officers/bonuses
    $('#geologist').removeAttr('checked');
    $('#engineer').removeAttr('checked');
    $('#technocrat').removeAttr('checked');
    $('#admiral').removeAttr('checked');
    $('#commander').removeAttr('checked');
    $('#research-bonus').removeAttr('checked');
    $('#full-numbers').removeAttr('checked');

    // Class
    $('#class-0').attr('checked', 'checked');

    // Booster
    $('#booster').val(0);

    // IRN
    $('#irn-level').val(0);
    $('#planetsSpin').val(8);
    this._resetIRNDialog();

    // Clear all table inputs
    $('#tab-0 input:text, #tab-1 input:text').val(0);

    // Clear all table data cells (including totals)
    this._clearAllTablesData();

    // Clear range tab
    $('#tech-types-select').val(1);
    $('#tab2-from-level').val(0);
    $('#tab2-to-level').val(0);
  }

  /**
   * Clear all table data cells (including totals) across all tables
   * @private
   */
  _clearAllTablesData() {
    const datetimeS = options.datetimeS || 's';
    const scShort = options.scShort || 'SC';
    const lcShort = options.lcShort || 'LC';
    const scFull = options.scFull || 'Small Cargo';
    const lcFull = options.lcFull || 'Large Cargo';

    // Clear all tab 0 tables (single-level)
    const tab0Tables = ['table-0-2', 'table-0-3', 'table-0-4', 'table-0-5', 'table-0-6'];
    tab0Tables.forEach(tableId => this._clearTableData(tableId, false, datetimeS, scShort, lcShort, scFull, lcFull));

    // Clear all tab 1 tables (multi-level)
    const tab1Tables = ['table-1-2', 'table-1-3', 'table-1-4'];
    tab1Tables.forEach(tableId => this._clearTableData(tableId, true, datetimeS, scShort, lcShort, scFull, lcFull));

    // Clear range tables
    this._clearRangeTable('prods-table');
    this._clearRangeTable('commons-table');
  }

  /**
   * Clear data cells in a specific table
   * @private
   */
  _clearTableData(tableId, isMultiLevel, datetimeS, scShort, lcShort, scFull, lcFull) {
    const rows = $(`#${tableId} tr`);
    if (rows.length === 0) return;

    const firstDataCol = isMultiLevel ? 4 : 3;
    const isBuildingTable = tableId.endsWith('-2') || tableId.endsWith('-3');

    // Clear data rows (skip header and footer rows)
    for (let i = 1; i < rows.length - 5; i++) {
      // Clear data cells (metal, crystal, deuterium, energy, time, points, DM)
      $(rows[i].children[firstDataCol]).html('0');
      $(rows[i].children[firstDataCol + 1]).html('0');
      $(rows[i].children[firstDataCol + 2]).html('0');
      $(rows[i].children[firstDataCol + 3]).html('0');
      $(rows[i].children[firstDataCol + 4]).html('0' + datetimeS);
      $(rows[i].children[firstDataCol + 5]).html('0');
      if (!isMultiLevel) {
        $(rows[i].children[firstDataCol + 6]).html('0');
      }
    }

    // Clear subtotal row
    const subtotalRow = rows.length - 5;
    const transportRow = rows.length - 4;
    const grandTotalRow = rows.length - 2;
    const grandTransportRow = rows.length - 1;

    const subtotalStartCol = isBuildingTable ? 3 : (isMultiLevel ? 3 : 2);
    $(rows[subtotalRow].children[subtotalStartCol]).html('<b>0</b>');
    $(rows[subtotalRow].children[subtotalStartCol + 1]).html('<b>0</b>');
    $(rows[subtotalRow].children[subtotalStartCol + 2]).html('<b>0</b>');
    $(rows[subtotalRow].children[subtotalStartCol + 3]).html('<b>0</b>');
    $(rows[subtotalRow].children[subtotalStartCol + 4]).html('<b>0' + datetimeS + '</b>');
    $(rows[subtotalRow].children[subtotalStartCol + 5]).html('<b>0</b>');
    if (!isMultiLevel && tableId.includes('-0-') && (tableId.endsWith('-2') || tableId.endsWith('-3'))) {
      $(rows[subtotalRow].children[subtotalStartCol + 6]).html('<b>0</b>');
    }

    // Clear transport row for subtotal
    $(rows[transportRow].children[2]).html('0 <abbr title="' + scFull + '">' + scShort + '</abbr>');
    $(rows[transportRow].children[3]).html('0 <abbr title="' + lcFull + '">' + lcShort + '</abbr>');

    // Clear grand total row
    const grandTotalStartCol = isMultiLevel ? 3 : 2;
    $(rows[grandTotalRow].children[grandTotalStartCol]).html('<b>0</b>');
    $(rows[grandTotalRow].children[grandTotalStartCol + 1]).html('<b>0</b>');
    $(rows[grandTotalRow].children[grandTotalStartCol + 2]).html('<b>0</b>');
    $(rows[grandTotalRow].children[grandTotalStartCol + 3]).html('<b>0</b>');
    $(rows[grandTotalRow].children[grandTotalStartCol + 4]).html('<b>0' + datetimeS + '</b>');
    $(rows[grandTotalRow].children[grandTotalStartCol + 5]).html('<b>0</b>');
    if (!isMultiLevel) {
      $(rows[grandTotalRow].children[grandTotalStartCol + 6]).html('<b>0</b>');
    }

    // Clear transport row for grand total
    $(rows[grandTransportRow].children[2]).html('0 <abbr title="' + scFull + '">' + scShort + '</abbr>');
    $(rows[grandTransportRow].children[3]).html('0 <abbr title="' + lcFull + '">' + lcShort + '</abbr>');
  }

  /**
   * Clear range table data
   * @private
   */
  _clearRangeTable(tableId) {
    const table = $(`#${tableId}`)[0];
    if (!table) return;

    const rows = $(`#${tableId} tr`);
    const datetimeS = options.datetimeS || 's';

    // Remove all data rows (keep header and footer)
    for (let i = rows.length - 1; i > 0; i--) {
      const row = rows[i];
      const firstCell = $(row.children[0]).html();
      // Check if it's a data row (has level in first cell)
      if (firstCell && !isNaN(parseInt(firstCell))) {
        $(row).remove();
      }
    }

    // Reset totals row to zeros
    const totalsRow = rows.length - 2;
    const transportRow = rows.length - 1;

    $(rows[totalsRow].children[1]).html('<b>0</b>');
    $(rows[totalsRow].children[2]).html('<b>0</b>');
    $(rows[totalsRow].children[3]).html('<b>0</b>');
    $(rows[totalsRow].children[4]).html('<b>0</b>');
    $(rows[totalsRow].children[5]).html('<b>0' + datetimeS + '</b>');
    $(rows[totalsRow].children[6]).html('<b>0</b>');

    // Check if this is a producer table with extra columns
    if (rows[totalsRow].children.length > 7) {
      $(rows[totalsRow].children[7]).html('<b>0</b>');
      $(rows[totalsRow].children[8]).html('<b>0</b>');
    }

    // Reset transport row
    const scShort = options.scShort || 'SC';
    const lcShort = options.lcShort || 'LC';
    const scFull = options.scFull || 'Small Cargo';
    const lcFull = options.lcFull || 'Large Cargo';

    $(rows[transportRow].children[1]).html('0 <abbr title="' + scFull + '">' + scShort + '</abbr>');
    $(rows[transportRow].children[2]).html('0 <abbr title="' + lcFull + '">' + lcShort + '</abbr>');
  }

  /**
   * Reset IRN dialog to defaults
   * @private
   */
  _resetIRNDialog() {
    // Reset IRN level
    $('#irn-level').val(0);

    // Reset planets spin to default (8)
    $('#planetsSpin').val(8);

    // Rebuild lab levels table with default values
    const tbl = $('#lab-levels-table')[0];
    if (tbl) {
      // Remove all existing rows
      for (let i = tbl.rows.length - 1; i > 0; i--) {
        $(tbl.rows[i]).remove();
      }

      // Add 8 default rows with level 0
      for (let i = 1; i <= 8; i++) {
        $('#lab-levels-table').append(
          '<tr class="' + ((i % 2) === 1 ? 'odd' : 'even') + '">' +
          '<td align="center">' + options.planetNumStr + i + '</td>' +
          '<td align="center" width="20%;"><input type="text" id="lablevel_' + i +
          '" name="lablevel_' + i + '" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="0" /></td>' +
          '<td align="center" width="20%;"><input type="radio" id="labchoice_' + i +
          '" name="start-pln" value="0" disabled="disabled"/></td>' +
          '</tr>'
        );

        // Re-bind event handlers for new elements
        $('#lablevel_' + i).unbind('keyup');
        $('#lablevel_' + i).bind('keyup', validateAndChangeLabLevel);

        $('#labchoice_' + i).unbind('click');
        $('#labchoice_' + i).click(function () {
          if (calculatorApp) {
            calculatorApp._updateResultingLevel();
            calculatorApp.recalculateAll();
          }
        });
      }
    }

    // Update options object for consistency
    if (typeof options !== 'undefined' && options.prm) {
      options.prm.irnLevel = 0;
      options.prm.planetsSpin = 8;
      options.prm.labLevels = [0, 0, 0, 0, 0, 0, 0, 0];
      options.prm.labChoice = 0;
      options.currPlanetsCount = 8;
    }

    // Update resulting level display if function exists
    this._updateResultingLevel();
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Get table IDs for a tab group
   * @private
   */
  _getTableIdsForTab(outerTab) {
    if (outerTab === 0) {
      return ['table-0-2', 'table-0-3', 'table-0-4', 'table-0-5', 'table-0-6'];
    } else if (outerTab === 1) {
      return ['table-1-2', 'table-1-3', 'table-1-4'];
    }
    return [];
  }

  /**
   * Get a number value from an input element
   * @private
   */
  _getInputNumber(selector) {
    const val = $(selector).val();
    return val ? parseInt(val, 10) || 0 : 0;
  }

  /**
   * Calculate and display IRN resulting lab level
   * @private
   */
  _updateResultingLevel() {
    const irnLevel = this._getInputNumber('#irn-level');
    const planetCount = this._getInputNumber('#planetsSpin');

    // First check if any radio button is selected
    let haveSelection = false;
    for (let i = 1; i <= planetCount; i++) {
      if ($(`#labchoice_${i}`)[0].checked) {
        haveSelection = true;
        // Update lab choice in options
        if (options.prm) {
          options.prm.labChoice = i - 1;
        }
        break;
      }
    }

    // If no lab is selected, display "?" and return
    if (!haveSelection) {
      $('#resulting-level').html('<b>?</b>');
      return;
    }

    // Collect lab levels
    const labs = [];
    for (let i = 1; i <= planetCount; i++) {
      const level = this._getInputNumber(`#lablevel_${i}`);
      if (level > 0) {
        const isSelected = $(`#labchoice_${i}`)[0].checked;
        labs.push([level, isSelected]);
      }
    }

    // Sort: selected lab first, then by level descending
    labs.sort((a, b) => {
      if (b[1] === true) return 1;
      if (a[1] === true) return -1;
      return b[0] - a[0];
    });

    // Calculate resulting level (sum of top IRN labs)
    const limit = Math.min(irnLevel + 1, labs.length);
    let resultingLevel = 0;
    for (let i = 0; i < limit; i++) {
      resultingLevel += Number(labs[i][0]);
    }

    // Update display
    $('#resulting-level').html(`<b>${resultingLevel}</b>`);
  }

  /**
   * Get tech name from ID
   * @private
   */
  _getTechName(techId) {
    // Look up in the table to get the name
    const tables = ['table-0-4', 'table-1-4']; // Research tables

    for (const tableId of tables) {
      const rows = $(`#${tableId} tr`);
      for (let i = 1; i < rows.length - 5; i++) {
        const rowTechId = parseInt($(rows[i].children[0]).html());
        if (rowTechId === techId) {
          return $(rows[i].children[1]).html();
        }
      }
    }

    return null;
  }

  /**
   * Open IRN calculator dialog
   * @private
   */
  _openIRNDialog() {
    // Ensure current params are up to date
    if (!this.currentParams) {
      this.currentParams = this.collector.collectGlobalParams();
    }

    // Create backup of IRN-related state from new system
    const irnBackup = {
      irnLevel: this.currentParams.irnLevel,
      labLevels: [...this.currentParams.labLevels], // Clone array
      labChoice: this.currentParams.labChoice
    };

    // Store backup on the dialog element
    $("#irn-calc").data('irnBackup', irnBackup);

    // Reset execute option and open the dialog
    $("#irn-calc").dialog("option", "execute", false);
    $("#irn-calc").dialog("open");

    // Update resulting level display after dialog opens
    this._updateResultingLevel();
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      avgTime: this.stats.calculations > 0 ?
        this.stats.totalTime / this.stats.calculations : 0
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats() {
    this.stats = {
      calculations: 0,
      renders: 0,
      totalTime: 0
    };
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Global instance of the calculator
 */
let calculatorApp = null;

/**
 * Initialize the application when DOM is ready
 */
function initializeCostsCalculator() {
  // Wait for options.techCosts and options.techReqs to be available
  if (typeof options === 'undefined' ||
    !options.techCosts ||
    !options.techReqs) {
    console.error('Cannot initialize: options.techCosts or options.techReqs not available');
    return;
  }

  // Create and initialize the app
  calculatorApp = new CostsCalculator(options.techCosts, options.techReqs);
  calculatorApp.init();

  // Initialize planets spin button for IRN dialog
  if (typeof $.fn.SpinButton === 'function') {
    $("#planetsSpin").unbind();

    // Create a callback that works with the new calculator system
    const onPlanetsChange = function (newVal, oldVal) {
      // Validate range
      if (newVal < 1 || newVal > 99) return;

      // Update options
      options.prm.planetsSpin = newVal;
      options.currPlanetsCount = newVal;

      // Update lab levels array
      if (newVal < oldVal) {
        if (oldVal >= 2) {
          $('#lab-levels-table tr:last').remove();
          options.prm.labLevels.pop();
        }
      } else {
        $('#lab-levels-table').append(
          '<tr class="' + ((newVal % 2) === 1 ? 'odd' : 'even') + '">' +
          '<td align="center">' + options.planetNumStr + newVal + '</td>' +
          '<td align="center" width="20%;"><input type="text" id="lablevel_' + newVal +
          '" name="lablevel_' + newVal + '" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="0" /></td>' +
          '<td align="center" width="20%;"><input type="radio" id="labchoice_' + newVal +
          '" name="start-pln" value="0" disabled="disabled"/></td>' +
          '</tr>'
        );
        $('#lablevel_' + newVal).bind('keyup', validateAndChangeLabLevel);
        $('#labchoice_' + newVal).click(() => this._updateResultingLevel());
        options.prm.labLevels.push(0);
      }

      // Update resulting level display
      calculatorApp._updateResultingLevel();

      // Notify new calculator system to recalculate
      if (calculatorApp) {
        calculatorApp.recalculateAll();
      }
    };

    let spinOptions = { min: 1, max: 99, step: 1, reset: 1, lock: true, onChange: onPlanetsChange };
    $("#planetsSpin").SpinButton(spinOptions);
    $('#planetsSpin')[0].value = options.currPlanetsCount || options.prm.planetsSpin || 8;
  }

  // Initialize IRN dialog handlers
  // Lab level inputs - validate on change
  $('#irn-calc input:text').unbind('keyup');
  $('#irn-calc input:text').bind('keyup', validateAndChangeLabLevel);

  // Radio buttons for lab choice - update resulting level
  $('#irn-calc input:radio').unbind('click');
  $('#irn-calc input:radio').click(function () {
    if (calculatorApp) {
      calculatorApp._updateResultingLevel();
      calculatorApp.recalculateAll();
    }
  });

  // IRN level field - validate and update resulting level
  $('#irn-level').unbind();
  $('#irn-level').keyup(function (e) {
    // Validate input
    validateInputNumber.call(this, e);

    // Update resulting level display and notify new calculator system to recalculate
    if (calculatorApp) {
      calculatorApp._updateResultingLevel();
      calculatorApp.recalculateAll();
    }
  });

  // Research lab level - mark as not computed when changed
  $('#research-lab-level').unbind('keyup');
  $('#research-lab-level').keyup(function (e) {
    // Validate input first
    validateInputNumber.call(this, e);
    options.resultingLabLevelComputed = false;
    if (calculatorApp) {
      calculatorApp._handleParamChange('research-lab-level');
    }
  });

  // Add close handler to IRN dialog to restore state on cancel or trigger recalc on done
  $('#irn-calc').bind('dialogclose', function () {
    if (!$(this).dialog("option", "execute")) {
      // User cancelled - restore from backup
      const backup = $(this).data('irnBackup');
      if (backup && calculatorApp) {
        // Restore new system's currentParams
        calculatorApp.currentParams.irnLevel = backup.irnLevel;
        calculatorApp.currentParams.labLevels = [...backup.labLevels];
        calculatorApp.currentParams.labChoice = backup.labChoice;

        // Also update options.prm for IRN dialog UI helpers
        options.prm.irnLevel = backup.irnLevel;
        options.prm.planetsSpin = backup.labLevels.length;
        options.prm.labLevels = [...backup.labLevels];
        options.prm.labChoice = backup.labChoice;
        options.currPlanetsCount = backup.labLevels.length;

        // Restore UI elements
        $('#irn-level').val(backup.irnLevel);
        $('#planetsSpin').val(backup.labLevels.length);

        // Rebuild lab levels table
        let tbl = $('#lab-levels-table')[0];
        for (let i = tbl.rows.length - 1; i > 0; i--) {
          $(tbl.rows[i]).remove();
        }
        for (let i = 1; i <= backup.labLevels.length; i++) {
          $('#lab-levels-table').append(
            '<tr class="' + ((i % 2) === 1 ? 'odd' : 'even') + '">' +
            '<td align="center">' + options.planetNumStr + i + '</td>' +
            '<td align="center" width="20%;"><input type="text" id="lablevel_' + i +
            '" name="lablevel_' + i + '" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="' +
            backup.labLevels[i - 1] + '" /></td>' +
            '<td align="center" width="20%;"><input type="radio" id="labchoice_' + i +
            '" name="start-pln" disabled="disabled"/></td>' +
            '</tr>'
          );
          if (backup.labLevels[i - 1] > 0) {
            $('#labchoice_' + i)[0].disabled = false;
          }
          if (backup.labChoice === i - 1) {
            $('#labchoice_' + i)[0].checked = 'checked';
          }

          // Re-bind event handlers
          $('#lablevel_' + i).bind('keyup', validateAndChangeLabLevel);
          $('#labchoice_' + i).click(function () {
            if (calculatorApp) {
              calculatorApp._updateResultingLevel();
              calculatorApp.recalculateAll();
            }
          });
        }

        // Update resulting level display
        if (calculatorApp) {
          calculatorApp._updateResultingLevel();
        }
      }
    } else {
      // User clicked done - copy resulting lab level to research-lab-level input
      if (calculatorApp) {
        // Get the resulting lab level from the display
        const resultingLevelText = $('#resulting-level').text();
        const resultingLevel = parseInt(resultingLevelText, 10);

        // Only update if we have a valid resulting level (not "?")
        if (!isNaN(resultingLevel)) {
          // Update the research-lab-level input
          $('#research-lab-level').val(resultingLevel);

          // Store the resulting level
          options.resultingLabLevel = resultingLevel;
          options.resultingLabLevelComputed = true;

          // Update the currentParams
          calculatorApp.currentParams.researchLabLevel = resultingLevel;
        }

        // Collect new params from DOM
        calculatorApp.currentParams = calculatorApp.collector.collectGlobalParams();
        calculatorApp.recalculateAll();
      }
    }

    // Remove backup in all cases
    $(this).removeData('irnBackup');
  });

  // Expose to window for debugging
  window.calculatorApp = calculatorApp;

  console.log('CostsCalculator ready!');
  console.log('Access via window.calculatorApp');
}

/**
 * Handler for lab level input changes in IRN dialog
 * Replicates the old changeLabLevel function behavior
 */
function changeLabLevel() {
  // Extract lab number from input id (format: lablevel_N)
  const parts = this.id.split(/_/);
  const num = parseInt(parts[1], 10);

  if (this.value == 0) {
    // Disable and uncheck radio button when level is 0
    $('#labchoice_' + num)[0].disabled = true;
    $('#labchoice_' + num)[0].checked = false;
  } else {
    // Enable radio button when level > 0
    $('#labchoice_' + num)[0].disabled = false;
  }

  // Update the lab levels array (array is 0-indexed, rows are 1-indexed)
  if (options.prm && options.prm.labLevels) {
    options.prm.labLevels[num - 1] = parseInt(this.value, 10) || 0;
  }

  // Update resulting level display
  if (calculatorApp) {
    calculatorApp._updateResultingLevel();
  }
}

/**
 * Wrapper function that calls validateInputNumber followed by changeLabLevel
 * Replicates the old behavior where event.data indicated which function to call
 */
function validateAndChangeLabLevel(event) {
  // First validate the input
  validateInputNumber.call(this, event);
  // Then update the IRN dialog UI
  changeLabLevel.call(this, event);
}

// Expose to window for direct access
if (typeof window !== 'undefined') {
  window.CostsCalculator = CostsCalculator;
  window.initializeCostsCalculator = initializeCostsCalculator;
}
