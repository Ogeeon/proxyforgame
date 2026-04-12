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

    // console.log('Initializing CostsCalculator...');

    // Load saved state from cookies
    this.loadState();

    // Bind all event handlers
    this.bindEvents();

    // Initial calculation
    this.recalculateAll();

    this.isInitialized = true;
    // console.log('CostsCalculator initialized');
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

    // console.log('Recalculating all tables...');

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
    // console.log(`Recalculation complete in ${elapsed.toFixed(2)}ms`);
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

    // console.log(`Recalculating tables: ${tableIds.join(', ')}`);

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

    // console.log(`Tables recalculated in ${elapsed.toFixed(2)}ms`);
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

    // Update producer-only control visibility regardless of range validity
    this.renderer.updateRangeControlVisibility(rangeData.techId);

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
    // console.log('Binding event handlers...');

    // Global parameter inputs - trigger full recalculation
    this._bindGlobalParamEvents();

    // Table inputs - trigger table-specific recalculation
    this._bindTableEvents();

    // Range tab - trigger range recalculation
    this._bindRangeTabEvents();

    // Special buttons
    this._bindSpecialEvents();

    // console.log('Event handlers bound');
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
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
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
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
        // Validate input first (if function exists from utils.js)
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange(selector.substring(1));
      });
    });

    // Lifeform reduction inputs
    const lfInputs = [
      '#research-cost-reduction',
      '#research-time-reduction',
      '#mineral-res-cntr-lvl',
      '#lf-terraformer-rdc'
    ];

    lfInputs.forEach(selector => {
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange(selector.substring(1));
      });
    });

    // Selects
    ['#universe-speed', '#research-speed', '#booster'].forEach(selector => {
      removeAllEvents(selector, 'change');
      addEvent(selector, 'change', () => {
        this._handleParamChange('speed');
      });
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
      removeAllEvents(selector, 'click');
      // Bind new handler
      addEvent(selector, 'click', () => this._handleParamChange(selector.substring(1)));
    });

    // Radio buttons (class)
    $$('input[name="class"]').forEach(input => {
      removeAllEvents(input, 'click');
      addEvent(input, 'click', () => this._handleParamChange('class'));
    });
  }

  /**
   * Bind table input events
   * @private
   */
  _bindTableEvents() {
    // Clear any existing keyup handlers
    $$('#tab-0 input[type="text"]').forEach(el => removeAllEvents(el, 'keyup'));
    $$('#tab-1 input[type="text"]').forEach(el => removeAllEvents(el, 'keyup'));

    // Single-level and multi-level tab inputs - new handlers with validation
    $$('#tab-0 input[type="text"], #tab-1 input[type="text"]').forEach(el => {
      addEvent(el, 'keyup', (event) => {
        // Validate input first (if function exists from utils.js)
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        // Enforce integer >= 1 for qty inputs
        if (event.target.classList.contains('qty-input')) {
          const val = Math.floor(Number.parseFloat(event.target.value) || 1);
          event.target.value = Math.max(1, val);
        }
        this._handleTableInputChange(event);
      });
    });
  }

  /**
   * Bind range tab events
   * @private
   */
  _bindRangeTabEvents() {
    // Unbind old handlers first
    removeAllEvents('#tech-types-select', 'change');
    removeAllEvents('#tech-types-select', 'keyup');
    removeAllEvents('#tab2-from-level', 'keyup');
    removeAllEvents('#tab2-to-level', 'keyup');
    removeAllEvents('#tab2-from-level', 'blur');
    removeAllEvents('#tab2-to-level', 'blur');

    addEvent('#tech-types-select', 'change', () => {
      this.recalculateRangeTab();
    });

    ['#tab2-from-level', '#tab2-to-level'].forEach(selector => {
      addEvent(selector, 'keyup', (event) => {
        // Validate input first (if function exists from utils.js)
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this.recalculateRangeTab();
      });

      addEvent(selector, 'blur', (event) => {
        // Validate on blur (if function exists from utils.js)
        if (typeof validateInputNumberOnBlur === 'function') {
          validateInputNumberOnBlur.call(event.target, event);
        }
        this.recalculateRangeTab();
      });
    });

    // Available resources inputs — recalculate needed and transport on change
    const availableInputs = [
      '#prods-metal-available', '#prods-crystal-available', '#prods-deut-available',
      '#commons-metal-available', '#commons-crystal-available', '#commons-deut-available'
    ];
    availableInputs.forEach(selector => {
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this.recalculateRangeTab();
      });
    });
  }

  /**
   * Bind special events
   * @private
   */
  _bindSpecialEvents() {
    // Unbind old handlers first
    removeAllEvents('#reset', 'click');
    removeAllEvents('#open-llc-dialog', 'click');

    // Reset button
    addEvent('#reset', 'click', () => this.reset());

    // IRN calculator dialog
    addEvent('#open-llc-dialog', 'click', () => {
      this._openIRNDialog();
    });

    // Theme toggle
    const cbLightTheme = document.getElementById('cb-light-theme');
    if (cbLightTheme) {
      let theme = { value: 'light', validate: function (key, val) { return val; } };
      loadFromCookie('theme', theme);
      toggleLightBS(theme.value === 'light');
      cbLightTheme.addEventListener('click', function () { toggleLightBS(this.checked); });
    }
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
      return 'localStorage' in globalThis && globalThis['localStorage'] !== null;
    } catch {
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
      fullNumbers: this.currentParams.fullNumbers,
      lfResCostRdc: this.currentParams.lfResCostRdc,
      lfResTimeRdc: this.currentParams.lfResTimeRdc,
      mineralResCntrLvl: this.currentParams.mineralResCntrLvl,
      lfTerraformerRdc: this.currentParams.lfTerraformerRdc
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
        for (const rawCookie of cookies) {
          const cookie = rawCookie.trim();
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
        } catch {
          console.warn('Failed to parse saved state');
        }
      }

      if (state) {
        // console.log('Loading state from storage...');

        // Apply state to UI elements
        this._applyStateToUI(state);

        // Collect params after applying state
        this.currentParams = this.collector.collectGlobalParams();

        // console.log('State loaded');
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
    const fieldMap = {
      shipyardLevel: '#shipyard-level',
      robotFactoryLevelPlanet: '#robot-factory-level',
      robotFactoryLevelMoon: '#robot-factory-level-moon',
      naniteFactoryLevel: '#nanite-factory-level',
      universeSpeed: '#universe-speed',
      researchSpeed: '#research-speed',
      researchLabLevel: '#research-lab-level',
      ionTechLevel: '#ion-tech-level',
      hyperTechLevel: '#hyper-tech-level',
      energyTechLevel: '#energy-tech-level',
      plasmaTechLevel: '#plasma-tech-level',
      maxPlanetTemp: '#max-planet-temp',
      planetPos: '#planet-pos',
      lfResCostRdc: '#research-cost-reduction',
      lfResTimeRdc: '#research-time-reduction',
      mineralResCntrLvl: '#mineral-res-cntr-lvl',
      lfTerraformerRdc: '#lf-terraformer-rdc',
      booster: '#booster',
      irnLevel: '#irn-level',
    };

    for (const [key, selector] of Object.entries(fieldMap)) {
      if (state[key] !== undefined) {
        setVal(selector, state[key]);
      }
    }

    // Officers/bonuses
    setChecked('#geologist', state.geologist === true);
    setChecked('#engineer', state.engineer === true);
    setChecked('#technocrat', state.technocrat === true);
    setChecked('#admiral', state.admiral === true);
    setChecked('#commander', state.commander === true);
    setChecked('#research-bonus', state.researchBonus === true);
    setChecked('#full-numbers', state.fullNumbers === true);

    // Class
    if (state.playerClass !== undefined) {
      setChecked(`#class-${state.playerClass}`, true);
    }

    // IRN lab levels
    if (state.labLevels && state.labLevels.length > 0) {
      this._applyLabLevels(state);
    }
  }

  /**
   * Apply saved lab levels to the UI
   * @param {Object} state
   * @private
   */
  _applyLabLevels(state) {
    const planetCount = state.labLevels.length;
    setVal('#planetsSpin', planetCount);
    options.currPlanetsCount = planetCount;
    options.prm.planetsSpin = planetCount;

    // Trim table rows to match saved planet count
    const tbody = document.querySelector('#lab-levels-table tbody');
    if (tbody) {
      while (tbody.rows.length > planetCount) {
        tbody.deleteRow(tbody.rows.length - 1);
      }
    }

    // Set lab levels
    state.labLevels.forEach((level, index) => {
      const planetNum = index + 1;
      setVal(`#lablevel_${planetNum}`, level);

      if (level > 0) {
        removeAttr(`#labchoice_${planetNum}`, 'disabled');
      }

      if (state.labChoice === index) {
        setChecked(`#labchoice_${planetNum}`, true);
      }
    });
  }

  /**
   * Reset all values to defaults
   */
  reset() {
    // console.log('Resetting calculator...');

    // Reset to default params
    this.currentParams = new GlobalParams();

    // Clear all UI inputs
    this._resetUI();

    // Recalculate everything
    this.recalculateAll();

    // console.log('Calculator reset');
  }

  /**
   * Reset UI to defaults
   * @private
   */
  _resetUI() {
    // Building levels
    setVal('#shipyard-level', 0);
    setVal('#robot-factory-level', 0);
    setVal('#robot-factory-level-moon', 0);
    setVal('#nanite-factory-level', 0);

    // Speeds
    setVal('#universe-speed', 1);
    setVal('#research-speed', 1);

    // Technologies
    setVal('#research-lab-level', 0);
    setVal('#ion-tech-level', 0);
    setVal('#hyper-tech-level', 0);
    setVal('#energy-tech-level', 0);
    setVal('#plasma-tech-level', 0);
    setVal('#max-planet-temp', 0);
    setVal('#planet-pos', 8);

    // Officers/bonuses
    setChecked('#geologist', false);
    setChecked('#engineer', false);
    setChecked('#technocrat', false);
    setChecked('#admiral', false);
    setChecked('#commander', false);
    setChecked('#research-bonus', false);
    setChecked('#full-numbers', false);

    // Class
    setChecked('#class-0', true);

    // Booster
    setVal('#booster', 0);

    // IRN
    setVal('#irn-level', 0);
    setVal('#planetsSpin', 8);
    this._resetIRNDialog();

    // Clear all table inputs (except qty inputs which default to 1)
    $$('#tab-0 input[type="text"], #tab-1 input[type="text"]').forEach(el => {
      el.value = el.classList.contains('qty-input') ? 1 : 0;
    });

    // Clear all table data cells (including totals)
    this._clearAllTablesData();

    // Clear range tab
    setVal('#tech-types-select', 1);
    setVal('#tab2-from-level', 0);
    setVal('#tab2-to-level', 0);
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
    const rows = getTableRows(`#${tableId}`);
    if (rows.length === 0) return;

    const hasPlanetQtyCol = tableId === 'table-0-2';
    const firstDataCol = (isMultiLevel || hasPlanetQtyCol) ? 4 : 3;
    const isBuildingTable = tableId.endsWith('-2') || tableId.endsWith('-3');

    // Clear data rows (skip header and 6 footer rows)
    for (let i = 1; i < rows.length - 6; i++) {
      // Clear data cells (metal, crystal, deuterium, energy, time, points, DM)
      rows[i].cells[firstDataCol].innerHTML = '0';
      rows[i].cells[firstDataCol + 1].innerHTML = '0';
      rows[i].cells[firstDataCol + 2].innerHTML = '0';
      rows[i].cells[firstDataCol + 3].innerHTML = '0';
      rows[i].cells[firstDataCol + 4].innerHTML = '0' + datetimeS;
      rows[i].cells[firstDataCol + 5].innerHTML = '0';
      if (!isMultiLevel) {
        rows[i].cells[firstDataCol + 6].innerHTML = '0';
      }
    }

    // Footer row indices — must match costs-renderer.js:
    // length-6: subtotal, length-5: spacer, length-4: grand total,
    // length-3: resources available, length-2: resources to deliver, length-1: transport
    const subtotalRow = rows.length - 6;
    const grandTotalRow = rows.length - 4;
    const resNeededRow = rows.length - 2;
    const deliveryTransportRow = rows.length - 1;

    // Clear subtotal row (subtotalStartCol=3, or 4 for planet buildings with qty col)
    const subtotalStartCol = hasPlanetQtyCol ? 4 : 3;
    if (isBuildingTable) {
      rows[subtotalRow].cells[2].innerHTML = '<b>0</b>';
    }
    rows[subtotalRow].cells[subtotalStartCol].innerHTML = '<b>0</b>';
    rows[subtotalRow].cells[subtotalStartCol + 1].innerHTML = '<b>0</b>';
    rows[subtotalRow].cells[subtotalStartCol + 2].innerHTML = '<b>0</b>';
    rows[subtotalRow].cells[subtotalStartCol + 3].innerHTML = '<b>0</b>';
    rows[subtotalRow].cells[subtotalStartCol + 4].innerHTML = '<b>0' + datetimeS + '</b>';
    rows[subtotalRow].cells[subtotalStartCol + 5].innerHTML = '<b>0</b>';
    if (!isMultiLevel) {
      rows[subtotalRow].cells[subtotalStartCol + 6].innerHTML = '<b>0</b>';
    }

    // Clear grand total row
    const grandTotalStartCol = 2;
    rows[grandTotalRow].cells[grandTotalStartCol].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 1].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 2].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 3].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 4].innerHTML = '<b>0' + datetimeS + '</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 5].innerHTML = '<b>0</b>';
    if (!isMultiLevel) {
      rows[grandTotalRow].cells[grandTotalStartCol + 6].innerHTML = '<b>0</b>';
    }

    // Clear resources-to-deliver row
    rows[resNeededRow].cells[2].innerHTML = '0';
    rows[resNeededRow].cells[3].innerHTML = '0';
    rows[resNeededRow].cells[4].innerHTML = '0';

    // Clear delivery transport row
    rows[deliveryTransportRow].cells[2].innerHTML = '0 <abbr title="' + scFull + '">' + scShort + '</abbr>';
    rows[deliveryTransportRow].cells[3].innerHTML = '0 <abbr title="' + lcFull + '">' + lcShort + '</abbr>';
  }

  /**
   * Clear range table data
   * @private
   */
  _clearRangeTable(tableId) {
    const table = $(`#${tableId}`);
    if (!table) return;

    const rows = getTableRows(`#${tableId}`);
    const datetimeS = options.datetimeS || 's';

    // Remove all data rows (keep header and footer)
    for (let i = rows.length - 1; i > 0; i--) {
      const row = rows[i];
      const firstCell = row.cells[0].innerHTML;
      // Check if it's a data row (has level in first cell)
      if (firstCell && !Number.isNaN(Number.parseInt(firstCell))) {
        row.remove();
      }
    }

    // Re-read rows after data deletion to get correct footer positions
    const remainingRows = getTableRows(`#${tableId}`);
    const totalsRow = remainingRows.length - 4;
    const neededRow = remainingRows.length - 2;
    const transportRow = remainingRows.length - 1;

    remainingRows[totalsRow].cells[1].innerHTML = '<b>0</b>';
    remainingRows[totalsRow].cells[2].innerHTML = '<b>0</b>';
    remainingRows[totalsRow].cells[3].innerHTML = '<b>0</b>';
    remainingRows[totalsRow].cells[4].innerHTML = '<b>0</b>';
    remainingRows[totalsRow].cells[5].innerHTML = '<b>0' + datetimeS + '</b>';
    remainingRows[totalsRow].cells[6].innerHTML = '<b>0</b>';

    // Check if this is a producer table with extra columns
    if (remainingRows[totalsRow].cells.length > 7) {
      remainingRows[totalsRow].cells[7].innerHTML = '<b>0</b>';
      remainingRows[totalsRow].cells[8].innerHTML = '<b>0</b>';
    }

    // Reset needed row
    remainingRows[neededRow].cells[1].innerHTML = '0';
    remainingRows[neededRow].cells[2].innerHTML = '0';
    remainingRows[neededRow].cells[3].innerHTML = '0';

    // Reset transport row
    const scShort = options.scShort || 'SC';
    const lcShort = options.lcShort || 'LC';
    const scFull = options.scFull || 'Small Cargo';
    const lcFull = options.lcFull || 'Large Cargo';

    remainingRows[transportRow].cells[1].innerHTML = '0 <abbr title="' + scFull + '">' + scShort + '</abbr>';
    remainingRows[transportRow].cells[2].innerHTML = '0 <abbr title="' + lcFull + '">' + lcShort + '</abbr>';
  }

  /**
   * Reset IRN dialog to defaults
   * @private
   */
  _resetIRNDialog() {
    // Reset IRN level
    setVal('#irn-level', 0);

    // Reset planets spin to default (8)
    setVal('#planetsSpin', 8);

    // Rebuild lab levels table with default values
    const tbl = $('#lab-levels-table');
    if (tbl) {
      // Remove all existing rows (except header)
      const rows = getTableRows('#lab-levels-table');
      for (let i = rows.length - 1; i > 0; i--) {
        rows[i].remove();
      }

      // Add 8 default rows with level 0
      for (let i = 1; i <= 8; i++) {
        append('#lab-levels-table',
          '<tr class="' + ((i % 2) === 1 ? 'odd' : 'even') + '">' +
          '<td align="center">' + options.planetNumStr + i + '</td>' +
          '<td align="center" width="20%;"><input type="text" id="lablevel_' + i +
          '" name="lablevel_' + i + '" class="form-control form-control-sm input-3columns input-in-table" value="0" /></td>' +
          '<td align="center" width="20%;"><input type="radio" id="labchoice_' + i +
          '" name="start-pln" value="0" disabled/></td>' +
          '</tr>'
        );

        // Re-bind event handlers for new elements
        removeAllEvents('#lablevel_' + i, 'keyup');
        addEvent('#lablevel_' + i, 'keyup', validateAndChangeLabLevel);

        removeAllEvents('#labchoice_' + i, 'click');
        addEvent('#labchoice_' + i, 'click', () => {
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
    const val = getVal(selector);
    return val ? Number.parseInt(val, 10) || 0 : 0;
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
      if (getChecked(`#labchoice_${i}`)) {
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
      setHtml('#resulting-level', '<b>?</b>');
      return;
    }

    // Collect lab levels
    const labs = [];
    for (let i = 1; i <= planetCount; i++) {
      const level = this._getInputNumber(`#lablevel_${i}`);
      if (level > 0) {
        const isSelected = getChecked(`#labchoice_${i}`);
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
    setHtml('#resulting-level', `<b>${resultingLevel}</b>`);
  }

  /**
   * Get tech name from ID
   * @private
   */
  _getTechName(techId) {
    // Look up in the table to get the name
    const tables = ['table-0-4', 'table-1-4']; // Research tables

    for (const tableId of tables) {
      const rows = getTableRows(`#${tableId}`);
      for (let i = 1; i < rows.length - 5; i++) {
        const rowTechId = Number.parseInt(rows[i].cells[0].innerHTML);
        if (rowTechId === techId) {
          return rows[i].cells[1].innerHTML;
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

    // Store backup on the dialog element for Bootstrap modal
    const modalEl = document.getElementById('irn-calc');
    modalEl._irnBackup = irnBackup;
    modalEl._irnExecute = false; // Reset execute flag

    // Open the Bootstrap modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

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

  // Initialize planets spin button for IRN dialog (native implementation)
  const planetsSpinInput = document.getElementById('planetsSpin');
  const planetsSpinUp = document.getElementById('planetsSpin-up');
  const planetsSpinDown = document.getElementById('planetsSpin-down');

  if (planetsSpinInput && planetsSpinUp && planetsSpinDown) {
    // Set initial value
    planetsSpinInput.value = options.currPlanetsCount || options.prm.planetsSpin || 8;

    // Handler for changing planet count
    const onPlanetsChange = function (newVal, oldVal) {
      // Validate range
      if (newVal < 1 || newVal > 99) return;

      // Update options
      options.prm.planetsSpin = newVal;
      options.currPlanetsCount = newVal;

      // Update lab levels array
      if (newVal < oldVal) {
        if (oldVal >= 2) {
          const tbody = document.querySelector('#lab-levels-table tbody');
          if (tbody && tbody.lastElementChild) {
            tbody.lastElementChild.remove();
          }
          options.prm.labLevels.pop();
        }
      } else {
        // Add new row for additional planet
        append('#lab-levels-table',
          '<tr class="' + ((newVal % 2) === 1 ? 'odd' : 'even') + '">' +
          '<td align="center">' + options.planetNumStr + newVal + '</td>' +
          '<td align="center" width="20%;"><input type="text" id="lablevel_' + newVal +
          '" name="lablevel_' + newVal + '" class="form-control input-3columns input-in-table" value="0" /></td>' +
          '<td align="center" width="20%;"><input type="radio" id="labchoice_' + newVal +
          '" name="start-pln" value="0" disabled="disabled"/></td>' +
          '</tr>'
        );
        addEvent('#lablevel_' + newVal, 'keyup', validateAndChangeLabLevel);
        addEvent('#labchoice_' + newVal, 'click', () => calculatorApp._updateResultingLevel());
        options.prm.labLevels.push(0);
      }

      // Update resulting level display
      calculatorApp._updateResultingLevel();

      // Notify new calculator system to recalculate
      if (calculatorApp) {
        calculatorApp.recalculateAll();
      }
    };

    // Up button handler
    addEvent(planetsSpinUp, 'click', () => {
      const oldVal = parseInt(planetsSpinInput.value) || 0;
      const newVal = oldVal + 1;
      if (newVal <= 99) {
        planetsSpinInput.value = newVal;
        onPlanetsChange(newVal, oldVal);
      }
    });

    // Down button handler
    addEvent(planetsSpinDown, 'click', () => {
      const oldVal = parseInt(planetsSpinInput.value) || 0;
      const newVal = oldVal - 1;
      if (newVal >= 1) {
        planetsSpinInput.value = newVal;
        onPlanetsChange(newVal, oldVal);
      }
    });
  }

  // Initialize IRN dialog handlers
  // Lab level inputs - validate on change
  const labInputs = document.querySelectorAll('#irn-calc input[type="text"]');
  labInputs.forEach(input => {
    removeAllEvents(input, 'keyup');
    addEvent(input, 'keyup', validateAndChangeLabLevel);
  });

  // Radio buttons for lab choice - update resulting level
  const radioInputs = document.querySelectorAll('#irn-calc input[type="radio"]');
  radioInputs.forEach(radio => {
    removeAllEvents(radio, 'click');
    addEvent(radio, 'click', () => {
      if (calculatorApp) {
        calculatorApp._updateResultingLevel();
        calculatorApp.recalculateAll();
      }
    });
  });

  // IRN level field - validate and update resulting level
  const irnLevelInput = document.getElementById('irn-level');
  if (irnLevelInput) {
    removeAllEvents(irnLevelInput, 'keyup');
    addEvent(irnLevelInput, 'keyup', (e) => {
      // Validate input
      validateInputNumber.call(irnLevelInput, e);

      // Update resulting level display and notify new calculator system to recalculate
      if (calculatorApp) {
        calculatorApp._updateResultingLevel();
        calculatorApp.recalculateAll();
      }
    });
  }

  // Research lab level - mark as not computed when changed
  const researchLabInput = document.getElementById('research-lab-level');
  if (researchLabInput) {
    removeAllEvents(researchLabInput, 'keyup');
    addEvent(researchLabInput, 'keyup', (e) => {
      // Validate input first
      validateInputNumber.call(researchLabInput, e);
      options.resultingLabLevelComputed = false;
      if (calculatorApp) {
        calculatorApp._handleParamChange('research-lab-level');
      }
    });
  }

  // Add Bootstrap modal event handler for IRN dialog
  const irnModal = document.getElementById('irn-calc');
  if (irnModal) {
    addEvent(irnModal, 'hidden.bs.modal', () => {
      if (!irnModal._irnExecute) {
        // User cancelled - restore from backup
        const backup = irnModal._irnBackup;
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
          setVal('#irn-level', backup.irnLevel);
          if (planetsSpinInput) {
            planetsSpinInput.value = backup.labLevels.length;
          }

          // Rebuild lab levels table
          const table = document.getElementById('lab-levels-table');
          if (table) {
            // Remove all rows except header
            while (table.rows.length > 1) {
              table.deleteRow(1);
            }

            // Re-add rows from backup
            for (let i = 1; i <= backup.labLevels.length; i++) {
              append('#lab-levels-table',
                '<tr class="' + ((i % 2) === 1 ? 'odd' : 'even') + '">' +
                '<td align="center">' + options.planetNumStr + i + '</td>' +
                '<td align="center" width="20%;"><input type="text" id="lablevel_' + i +
                '" name="lablevel_' + i + '" class="form-control input-3columns input-in-table" value="' +
                backup.labLevels[i - 1] + '" /></td>' +
                '<td align="center" width="20%;"><input type="radio" id="labchoice_' + i +
                '" name="start-pln" disabled="disabled"/></td>' +
                '</tr>'
              );

              const radioEl = document.getElementById('labchoice_' + i);
              if (backup.labLevels[i - 1] > 0 && radioEl) {
                radioEl.disabled = false;
              }
              if (backup.labChoice === i - 1 && radioEl) {
                radioEl.checked = true;
              }

              // Re-bind event handlers
              addEvent('#lablevel_' + i, 'keyup', validateAndChangeLabLevel);
              addEvent('#labchoice_' + i, 'click', () => {
                if (calculatorApp) {
                  calculatorApp._updateResultingLevel();
                  calculatorApp.recalculateAll();
                }
              });
            }
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
          const resultingLevelText = getTextContent('#resulting-level');
          const resultingLevel = parseInt(resultingLevelText, 10);

          // Only update if we have a valid resulting level (not "?")
          if (!isNaN(resultingLevel)) {
            // Update the research-lab-level input
            setVal('#research-lab-level', resultingLevel);

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
      delete irnModal._irnBackup;
      delete irnModal._irnExecute;
    });
  }

  // Handle Done button in IRN dialog
  const irnDoneBtn = document.getElementById('irn-done-btn');
  if (irnDoneBtn) {
    addEvent(irnDoneBtn, 'click', () => {
      if (irnModal) {
        irnModal._irnExecute = true;
        const modal = bootstrap.Modal.getInstance(irnModal);
        if (modal) modal.hide();
      }
    });
  }

  // Expose to window for debugging
  window.calculatorApp = calculatorApp;

  // console.log('CostsCalculator ready!');
  // console.log('Access via window.calculatorApp');
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
    const radioEl = document.getElementById('labchoice_' + num);
    if (radioEl) {
      radioEl.disabled = true;
      radioEl.checked = false;
    }
  } else {
    // Enable radio button when level > 0
    const radioEl = document.getElementById('labchoice_' + num);
    if (radioEl) {
      radioEl.disabled = false;
    }
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
