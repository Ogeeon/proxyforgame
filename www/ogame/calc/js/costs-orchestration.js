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

    // 5. Show the robot/nanite factory disclaimer once if applicable
    this._maybeShowRobotNaniteDisclaimer();

    // 6. Save state
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

    // LifeForm research bonuses full table modal
    this._bindLfResearchTableEvents();

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

    document.getElementById('max-planet-temp')._constrains = { 'min': -134, 'def': 0, 'allowNegative': true };
    document.getElementById('planet-pos')._constrains = { 'min': 1, 'max': 16, 'def': 8, 'allowNegative': false };

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

    removeAllEvents('#max-planet-temp', 'blur');
    addEvent('#max-planet-temp', 'blur', (event) => {
      validateInputNumberOnBlurNative(event);
      this._handleParamChange('max-planet-temp');
    });

    removeAllEvents('#planet-pos', 'blur');
    addEvent('#planet-pos', 'blur', (event) => {
      validateInputNumberOnBlurNative(event);
      this._handleParamChange('planet-pos');
    });

    // Lifeform reduction inputs
    const lfInputs = [
      '#research-cost-reduction',
      '#research-time-reduction',
      '#researcher-class-bonus',
      '#mineral-res-cntr-lvl',
      '#lf-terraformer-rdc',
      '#sc-capacity-increase',
      '#lc-capacity-increase'
    ];

    // Research cost/time reduction are capped (cost ≤ 50%, time ≤ 99%);
    // clamp the entered value to the max on blur, like the temperature field.
    document.getElementById('research-cost-reduction')._constrains = { min: 0, max: 50, def: 0, allowFloat: true, allowNegative: false };
    document.getElementById('research-time-reduction')._constrains = { min: 0, max: 99, def: 0, allowFloat: true, allowNegative: false };
    document.getElementById('researcher-class-bonus')._constrains = { min: 0, max: 100, def: 0, allowFloat: true, allowNegative: false };
    document.getElementById('sc-capacity-increase')._constrains = { min: 0, max: 1000, def: 0, allowFloat: true, allowNegative: false };
    document.getElementById('lc-capacity-increase')._constrains = { min: 0, max: 1000, def: 0, allowFloat: true, allowNegative: false };

    lfInputs.forEach(selector => {
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange(selector.substring(1));
      });
      removeAllEvents(selector, 'blur');
      addEvent(selector, 'blur', (event) => {
        if (typeof validateInputNumberOnBlurNative === 'function') {
          validateInputNumberOnBlurNative(event);
        }
        this._handleParamChange(selector.substring(1));
      });
    });

    // Exchange rate inputs
    const rateInputs = ['#exchange-rates-m', '#exchange-rates-c', '#exchange-rates-d'];
    document.getElementById('exchange-rates-m')._constrains = { min: 0.1, max: 100, def: 1,   allowFloat: true, allowNegative: false };
    document.getElementById('exchange-rates-c')._constrains = { min: 0.1, max: 100, def: 1.5, allowFloat: true, allowNegative: false };
    document.getElementById('exchange-rates-d')._constrains = { min: 0.1, max: 100, def: 3,   allowFloat: true, allowNegative: false };
    rateInputs.forEach(selector => {
      removeAllEvents(selector, 'keyup');
      addEvent(selector, 'keyup', (event) => {
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
        this._handleParamChange('exchange-rates');
      });
      removeAllEvents(selector, 'blur');
      addEvent(selector, 'blur', (event) => {
        if (typeof validateInputNumberOnBlurNative === 'function') {
          validateInputNumberOnBlurNative(event);
        }
        this._handleParamChange('exchange-rates');
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
   * Storage key for the LifeForm research bonuses table
   */
  static LF_TABLE_STORAGE_KEY = 'costs_lf_research_table';

  /**
   * Bind the LifeForm research bonuses full table modal:
   *  - the opener button on the LifeForms tab
   *  - per-row cost/time inputs (fractional 0..100 validation)
   *  - the OK button (copy column minimums to the two reduction fields + persist)
   *  - the "Get" button (open the paste-from-OGame modal)
   *  - the Import button (parse pasted OGame text into the table)
   * @private
   */
  _bindLfResearchTableEvents() {
    // Restore a previously saved table so the modal always reflects it
    this._loadLfResearchTable();

    // Show the "values differ" warning next to the fields if the saved table
    // carries per-research values that the single reduction field can't capture
    this._updateLfResearchWarnings();

    // Fractional 0..100 validation on every cost/time input
    const inputs = $$('#lf-research-bonuses-tbody input[type="text"]');
    inputs.forEach(input => {
      input._constrains = { min: 0, max: 100, def: 0, allowFloat: true, allowNegative: false };
      removeAllEvents(input, 'keyup');
      addEvent(input, 'keyup', (event) => {
        if (typeof validateInputNumber === 'function') {
          validateInputNumber.call(event.target, event);
        }
      });
      removeAllEvents(input, 'blur');
      addEvent(input, 'blur', (event) => {
        if (typeof validateInputNumberOnBlurNative === 'function') {
          validateInputNumberOnBlurNative(event);
        }
      });
    });

    // Open the table modal
    removeAllEvents('#lf-research-table-open', 'click');
    addEvent('#lf-research-table-open', 'click', () => {
      const el = document.getElementById('lf-research-table');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    });

    // OK: copy the minimum of each column to the reduction fields, persist, close
    removeAllEvents('#lf-research-table-ok', 'click');
    addEvent('#lf-research-table-ok', 'click', () => {
      this._applyLfResearchTable();
      const el = document.getElementById('lf-research-table');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).hide();
      }
    });

    // Clear: reset every cost/time input in the table to zero
    removeAllEvents('#lf-research-table-clear', 'click');
    addEvent('#lf-research-table-clear', 'click', () => {
      $$('#lf-research-bonuses-tbody input[type="text"]').forEach(input => {
        input.value = this._formatDecimal(0);
      });
    });

    // Get: open the paste-from-OGame modal on top of the table modal
    removeAllEvents('#lf-research-table-get', 'click');
    addEvent('#lf-research-table-get', 'click', () => {
      const el = document.getElementById('lf-research-paste');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    });

    // Import: parse the pasted text into the table, then close the paste modal
    removeAllEvents('#lf-research-paste-import', 'click');
    addEvent('#lf-research-paste-import', 'click', () => {
      const txtarea = document.getElementById('lf-research-paste-txtarea');
      if (!txtarea) return;
      if (this._importLfResearchBonuses(txtarea.value)) {
        txtarea.value = '';
        const el = document.getElementById('lf-research-paste');
        if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          bootstrap.Modal.getOrCreateInstance(el).hide();
        }
      }
    });
  }

  /**
   * Read the cost/time value pairs currently entered in the table.
   * @returns {{cost: number, time: number}[]}
   * @private
   */
  _readLfResearchTable() {
    const rows = Array.from($$('#lf-research-bonuses-tbody tr'));
    return rows.map(row => ({
      cost: this._parsePercent(row.querySelector('.lf-research-cost-input')),
      time: this._parsePercent(row.querySelector('.lf-research-time-input'))
    }));
  }

  /**
   * The decimal separator for the current language (falls back to '.').
   * @private
   */
  _decimalSeparator() {
    return (typeof options !== 'undefined' && options.decimalSeparator) || '.';
  }

  /**
   * Parse a number written with the current language's decimal separator.
   * The "other" separator is treated as grouping and dropped.
   * @private
   */
  _parseLocaleFloat(str) {
    const ds = this._decimalSeparator();
    const grouping = ds === '.' ? ',' : '.';
    const normalized = String(str).split(grouping).join('').replace(ds, '.');
    return parseFloat(normalized);
  }

  /**
   * Format a number for display using the current language's decimal separator.
   * @private
   */
  _formatDecimal(num) {
    return String(num).replace('.', this._decimalSeparator());
  }

  /**
   * Parse a percentage input's value into a non-negative float (0 on failure).
   * @private
   */
  _parsePercent(input) {
    if (!input) return 0;
    const val = this._parseLocaleFloat(input.value);
    return isNaN(val) || val < 0 ? 0 : val;
  }

  /**
   * Copy the minimum of each column into the two reduction fields (clamped to
   * their own maximums), then persist the whole table to localStorage and
   * trigger a recalculation. The reduction fields apply to every research, so
   * only the smallest per-research bonus is guaranteed across all of them.
   * @private
   */
  _applyLfResearchTable() {
    const data = this._readLfResearchTable();
    if (data.length === 0) return;

    const minCost = Math.min(...data.map(d => d.cost));
    const minTime = Math.min(...data.map(d => d.time));

    // Respect the reduction fields' own caps (cost ≤ 50%, time ≤ 99%)
    setVal('#research-cost-reduction', this._formatDecimal(Math.min(50, minCost)));
    setVal('#research-time-reduction', this._formatDecimal(Math.min(99, minTime)));

    this._saveLfResearchTable(data);
    this._updateLfResearchWarnings(data);

    this._handleParamChange('research-cost-reduction');
    this._handleParamChange('research-time-reduction');
  }

  /**
   * Show or hide the "values differ" warning icon next to each reduction field.
   * The field only holds the column minimum, so when a column contains values
   * above that minimum the icon signals that the single value is a simplification.
   * @param {{cost: number, time: number}[]} [data]
   * @private
   */
  _updateLfResearchWarnings(data) {
    const rows = data || this._readLfResearchTable();
    const differs = (values) => values.length > 0 && Math.max(...values) > Math.min(...values);
    this._toggleWarnIcon('research-cost-reduction-warn', differs(rows.map(d => d.cost)));
    this._toggleWarnIcon('research-time-reduction-warn', differs(rows.map(d => d.time)));
  }

  /**
   * Toggle a warning icon's visibility by id.
   * @private
   */
  _toggleWarnIcon(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  }

  /**
   * Persist the research bonuses table to localStorage.
   * @param {{cost: number, time: number}[]} [data]
   * @private
   */
  _saveLfResearchTable(data) {
    if (!this._isStorageAvailable()) return;
    try {
      const payload = (data || this._readLfResearchTable()).map(d => [d.cost, d.time]);
      localStorage.setItem(CostsCalculator.LF_TABLE_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save LF research table:', e.message);
    }
  }

  /**
   * Restore the research bonuses table from localStorage into the inputs.
   * @private
   */
  _loadLfResearchTable() {
    if (!this._isStorageAvailable()) return;
    let payload = null;
    try {
      const json = localStorage.getItem(CostsCalculator.LF_TABLE_STORAGE_KEY);
      if (json) payload = JSON.parse(json);
    } catch {
      return;
    }
    if (!Array.isArray(payload)) return;

    const rows = $$('#lf-research-bonuses-tbody tr');
    rows.forEach((row, i) => {
      const entry = payload[i];
      if (!Array.isArray(entry)) return;
      const costInput = row.querySelector('.lf-research-cost-input');
      const timeInput = row.querySelector('.lf-research-time-input');
      if (costInput) costInput.value = this._formatDecimal(entry[0]);
      if (timeInput) timeInput.value = this._formatDecimal(entry[1]);
    });
  }

  /**
   * Parse a research bonuses table copied from OGame and fill the modal table.
   *
   * The pasted text is a flat list of lines. Each research is a group:
   *   <name>
   *   <cost>   (either "-" for none, or "X%" followed by a "Max. Y%" line)
   *   <time>   (either "-" for none, or "X%" followed by a "Max. Y%" line)
   * Only the value line is meaningful; the "Max." line that always follows a
   * real value is skipped. Researches are matched to rows by position (the
   * OGame overview lists them in the same fixed order as the table).
   *
   * Two sanity checks guard the positional parsing:
   *  1. the pasted text must contain the first research's name in the current
   *     language (used as the anchor to start parsing), and
   *  2. complete data must be present for all standard researches.
   * Either failure aborts the import (nothing is written) and warns the user.
   *
   * @param {string} text
   * @returns {boolean} true when the whole table was parsed and applied
   * @private
   */
  _importLfResearchBonuses(text) {
    const lines = String(text || '').split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const rows = Array.from($$('#lf-research-bonuses-tbody tr'));
    if (rows.length === 0) return false;

    // The first research's localized name, taken from the table itself
    const firstName = rows[0].cells[0] ? rows[0].cells[0].textContent.trim() : '';
    const firstLower = firstName.toLowerCase();

    // Check 1: the paste must contain the first research name (current language).
    // It also anchors where the research list starts (skipping any header rows).
    let start = -1;
    if (firstLower) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === firstLower) { start = i; break; }
      }
    }
    if (start === -1) {
      alert((options.lfImportErrNotFound || '').replace('{0}', firstName));
      return false;
    }

    let p = start;
    // Read one column: "-" => 0 (one line); a numeric value consumes the value
    // line plus the "Max. Y%" line that always follows it. Returns null at EOF.
    const readColumn = () => {
      if (p >= lines.length) return null;
      const line = lines[p];
      if (line === '-') { p++; return 0; }
      // OGame always exports numbers with a dot decimal separator
      const m = line.match(/-?\d+(?:\.\d+)?/);
      p++;
      if (m) {
        if (p < lines.length) p++; // skip the trailing "Max. Y%" line
        const val = parseFloat(m[0]);
        return isNaN(val) || val < 0 ? 0 : val;
      }
      return 0;
    };

    // Parse into a buffer first; only apply once every research is complete
    const parsedRows = [];
    for (let i = 0; i < rows.length; i++) {
      if (p >= lines.length) break; // no name line left => incomplete
      p++; // research name line
      const cost = readColumn();
      const time = readColumn();
      if (cost === null || time === null) break; // truncated columns => incomplete
      parsedRows.push([cost, time]);
    }

    // Check 2: data must be present for every standard research
    if (parsedRows.length < rows.length) {
      alert(options.lfImportErrIncomplete || '');
      return false;
    }

    rows.forEach((row, i) => {
      const costInput = row.querySelector('.lf-research-cost-input');
      const timeInput = row.querySelector('.lf-research-time-input');
      if (costInput) costInput.value = this._formatDecimal(parsedRows[i][0]);
      if (timeInput) timeInput.value = this._formatDecimal(parsedRows[i][1]);
    });

    return true;
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
   * Show the robot/nanite factory disclaimer modal once (per month) when the
   * user is building a Robotics/Nanite factory in the tables: a non-zero level
   * on the single-level tab (0) or a non-zero "to-level" on the multi-level
   * tab (1). Build time calculations ignore construction order, so those rows
   * can make the shown times misleading (see the queue calculator for accurate
   * figures).
   * @private
   */
  _maybeShowRobotNaniteDisclaimer() {
    if (getCookie(CostsCalculator.RN_DISCLAIMER_COOKIE) === '1') return;
    if (!this._isRobotNaniteFactoryBuilt()) return;

    const el = document.getElementById('robot-nanite-disclaimer');
    if (!el || typeof bootstrap === 'undefined' || !bootstrap.Modal) return;

    bootstrap.Modal.getOrCreateInstance(el).show();
    setCookie(CostsCalculator.RN_DISCLAIMER_COOKIE, '1', 30); // remember for ~1 month
  }

  /**
   * Scan the Robotics/Nanite factory rows and report whether any of them is
   * being built: a non-zero level on tab 0 or a non-zero "to-level" on tab 1.
   * @private
   */
  _isRobotNaniteFactoryBuilt() {
    const factoryIds = new Set([14, 15]); // robot factory (14, moon 10014), nanite factory (15)
    // { tableId, multi } — on multi-level tables the "to-level" input is checked
    const specs = [
      { tableId: 'table-0-2', multi: false },
      { tableId: 'table-0-3', multi: false },
      { tableId: 'table-1-2', multi: true },
      { tableId: 'table-1-3', multi: true }
    ];

    for (const spec of specs) {
      const table = document.getElementById(spec.tableId);
      if (!table) continue;

      for (const row of table.querySelectorAll('tr')) {
        if (!row.cells || row.cells.length === 0) continue;

        let techId = Number.parseInt(row.cells[0].innerHTML);
        if (!techId) continue;
        if (techId > 10000) techId -= 10000; // moon buildings are offset by 10000
        if (!factoryIds.has(techId)) continue;

        // Single-level row: level input at children[2]; multi-level: to-level at children[3]
        const cell = row.children[spec.multi ? 3 : 2];
        const input = cell && cell.children[0];
        if (!input) continue;

        const value = parseFloat(String(input.value).replace(',', '.'));
        if (!isNaN(value) && value > 0) return true;
      }
    }

    return false;
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

      // Show the robot/nanite factory disclaimer once if applicable
      this._maybeShowRobotNaniteDisclaimer();
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
  static RN_DISCLAIMER_COOKIE = 'costs_rn_disclaimer_shown';

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
      lfTerraformerRdc: this.currentParams.lfTerraformerRdc,
      scCapacityIncrease: this.currentParams.scCapacityIncrease,
      lcCapacityIncrease: this.currentParams.lcCapacityIncrease,
      rates: this.currentParams.rates
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
      scCapacityIncrease: '#sc-capacity-increase',
      lcCapacityIncrease: '#lc-capacity-increase',
      booster: '#booster',
      irnLevel: '#irn-level',
    };

    for (const [key, selector] of Object.entries(fieldMap)) {
      if (state[key] !== undefined) {
        setVal(selector, state[key]);
      }
    }

    // Exchange rates (stored as array)
    if (Array.isArray(state.rates) && state.rates.length === 3) {
      setVal('#exchange-rates-m', state.rates[0]);
      setVal('#exchange-rates-c', state.rates[1]);
      setVal('#exchange-rates-d', state.rates[2]);
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

    // Exchange rates
    setVal('#exchange-rates-m', 1);
    setVal('#exchange-rates-c', 1.5);
    setVal('#exchange-rates-d', 3);

    // Cargo capacity increase
    setVal('#sc-capacity-increase', 0);
    setVal('#lc-capacity-increase', 0);

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

    const hasPlanetQtyCol = tableId === 'table-0-2' || tableId === 'table-0-3';
    const firstDataCol = (isMultiLevel || hasPlanetQtyCol) ? 4 : 3;
    const isBuildingTable = tableId.endsWith('-2') || tableId.endsWith('-3');

    // Clear data rows (skip header and 6 footer rows)
    for (let i = 1; i < rows.length - 6; i++) {
      // Clear data cells (metal, crystal, deuterium, MSU, energy, time, points, DM)
      rows[i].cells[firstDataCol].innerHTML = '0';
      rows[i].cells[firstDataCol + 1].innerHTML = '0';
      rows[i].cells[firstDataCol + 2].innerHTML = '0';
      rows[i].cells[firstDataCol + 3].innerHTML = '0';
      rows[i].cells[firstDataCol + 4].innerHTML = '0';
      rows[i].cells[firstDataCol + 5].innerHTML = '0' + datetimeS;
      rows[i].cells[firstDataCol + 6].innerHTML = '0';
      if (!isMultiLevel) {
        rows[i].cells[firstDataCol + 7].innerHTML = '0';
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
    rows[subtotalRow].cells[subtotalStartCol + 4].innerHTML = '<b>0</b>';
    rows[subtotalRow].cells[subtotalStartCol + 5].innerHTML = '<b>0' + datetimeS + '</b>';
    rows[subtotalRow].cells[subtotalStartCol + 6].innerHTML = '<b>0</b>';
    if (!isMultiLevel) {
      rows[subtotalRow].cells[subtotalStartCol + 7].innerHTML = '<b>0</b>';
    }

    // Clear grand total row
    const grandTotalStartCol = 2;
    rows[grandTotalRow].cells[grandTotalStartCol].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 1].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 2].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 3].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 4].innerHTML = '<b>0</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 5].innerHTML = '<b>0' + datetimeS + '</b>';
    rows[grandTotalRow].cells[grandTotalStartCol + 6].innerHTML = '<b>0</b>';
    if (!isMultiLevel) {
      rows[grandTotalRow].cells[grandTotalStartCol + 7].innerHTML = '<b>0</b>';
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
    remainingRows[totalsRow].cells[5].innerHTML = '<b>0</b>';
    remainingRows[totalsRow].cells[6].innerHTML = '<b>0' + datetimeS + '</b>';
    remainingRows[totalsRow].cells[7].innerHTML = '<b>0</b>';

    // Check if this is a producer table with extra columns
    if (remainingRows[totalsRow].cells.length > 8) {
      remainingRows[totalsRow].cells[8].innerHTML = '<b>0</b>';
      remainingRows[totalsRow].cells[9].innerHTML = '<b>0</b>';
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
    setupPlanetsSpin(planetsSpinInput, planetsSpinUp, planetsSpinDown);
  }

  // Initialize IRN dialog handlers
  setupIrnInputHandlers();

  // Add Bootstrap modal event handler for IRN dialog
  const irnModal = document.getElementById('irn-calc');
  if (irnModal) {
    setupIrnModalHandlers(irnModal, planetsSpinInput);
  }

  // Handle Done button in IRN dialog
  const irnDoneBtn = document.getElementById('irn-done-btn');
  if (irnDoneBtn) {
    addEvent(irnDoneBtn, 'click', () => {
      if (irnModal) {
        irnModal._irnExecute = true;
        const modal = bootstrap.Modal.getInstance(irnModal);
        if (modal) { irnDoneBtn.blur(); modal.hide(); }
      }
    });
  }

  // Expose to globalThis for debugging
  globalThis.calculatorApp = calculatorApp;
}

/**
 * Set up the planet count spin buttons for the IRN dialog.
 * @param {HTMLElement} planetsSpinInput
 * @param {HTMLElement} planetsSpinUp
 * @param {HTMLElement} planetsSpinDown
 */
function setupPlanetsSpin(planetsSpinInput, planetsSpinUp, planetsSpinDown) {
  planetsSpinInput.value = options.currPlanetsCount || options.prm.planetsSpin || 8;

  const onPlanetsChange = function (newVal, oldVal) {
    if (newVal < 1 || newVal > 99) return;

    options.prm.planetsSpin = newVal;
    options.currPlanetsCount = newVal;

    if (newVal < oldVal) {
      if (oldVal >= 2) {
        const tbody = document.querySelector('#lab-levels-table tbody');
        tbody?.lastElementChild?.remove();
        options.prm.labLevels.pop();
      }
    } else {
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

    calculatorApp._updateResultingLevel();
    if (calculatorApp) {
      calculatorApp.recalculateAll();
    }
  };

  addEvent(planetsSpinUp, 'click', () => {
    const oldVal = Number.parseInt(planetsSpinInput.value) || 0;
    const newVal = oldVal + 1;
    if (newVal <= 99) {
      planetsSpinInput.value = newVal;
      onPlanetsChange(newVal, oldVal);
    }
  });

  addEvent(planetsSpinDown, 'click', () => {
    const oldVal = Number.parseInt(planetsSpinInput.value) || 0;
    const newVal = oldVal - 1;
    if (newVal >= 1) {
      planetsSpinInput.value = newVal;
      onPlanetsChange(newVal, oldVal);
    }
  });
}

/**
 * Bind keyup/click handlers for the IRN dialog inputs.
 */
function setupIrnInputHandlers() {
  const labInputs = document.querySelectorAll('#irn-calc input[type="text"]');
  labInputs.forEach(input => {
    removeAllEvents(input, 'keyup');
    addEvent(input, 'keyup', validateAndChangeLabLevel);
  });

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

  const irnLevelInput = document.getElementById('irn-level');
  if (irnLevelInput) {
    removeAllEvents(irnLevelInput, 'keyup');
    addEvent(irnLevelInput, 'keyup', (e) => {
      validateInputNumber.call(irnLevelInput, e);
      if (calculatorApp) {
        calculatorApp._updateResultingLevel();
        calculatorApp.recalculateAll();
      }
    });
  }

  const researchLabInput = document.getElementById('research-lab-level');
  if (researchLabInput) {
    removeAllEvents(researchLabInput, 'keyup');
    addEvent(researchLabInput, 'keyup', (e) => {
      validateInputNumber.call(researchLabInput, e);
      options.resultingLabLevelComputed = false;
      if (calculatorApp) {
        calculatorApp._handleParamChange('research-lab-level');
      }
    });
  }
}

/**
 * Bind the hidden.bs.modal handler for the IRN dialog.
 * @param {HTMLElement} irnModal
 * @param {HTMLElement|null} planetsSpinInput
 */
function setupIrnModalHandlers(irnModal, planetsSpinInput) {
  addEvent(irnModal, 'hidden.bs.modal', () => {
    if (irnModal._irnExecute && calculatorApp) {
      applyIrnResult();
    } else {
      cancelIrnDialog(irnModal, planetsSpinInput);
    }

    delete irnModal._irnBackup;
    delete irnModal._irnExecute;
  });
}

/**
 * Apply the IRN dialog result to the research-lab-level input.
 */
function applyIrnResult() {
  const resultingLevelText = getTextContent('#resulting-level');
  const resultingLevel = Number.parseInt(resultingLevelText, 10);

  if (!Number.isNaN(resultingLevel)) {
    setVal('#research-lab-level', resultingLevel);
    options.resultingLabLevel = resultingLevel;
    options.resultingLabLevelComputed = true;
    calculatorApp.currentParams.researchLabLevel = resultingLevel;
  }

  calculatorApp.currentParams = calculatorApp.collector.collectGlobalParams();
  calculatorApp.recalculateAll();
}

/**
 * Restore the IRN dialog state when the user cancels.
 * @param {HTMLElement} irnModal
 * @param {HTMLElement|null} planetsSpinInput
 */
function cancelIrnDialog(irnModal, planetsSpinInput) {
  const backup = irnModal._irnBackup;
  if (!backup || !calculatorApp) return;

  calculatorApp.currentParams.irnLevel = backup.irnLevel;
  calculatorApp.currentParams.labLevels = [...backup.labLevels];
  calculatorApp.currentParams.labChoice = backup.labChoice;

  options.prm.irnLevel = backup.irnLevel;
  options.prm.planetsSpin = backup.labLevels.length;
  options.prm.labLevels = [...backup.labLevels];
  options.prm.labChoice = backup.labChoice;
  options.currPlanetsCount = backup.labLevels.length;

  setVal('#irn-level', backup.irnLevel);
  if (planetsSpinInput) {
    planetsSpinInput.value = backup.labLevels.length;
  }

  rebuildLabTable(backup);
  calculatorApp._updateResultingLevel();
}

/**
 * Rebuild the lab levels table from a backup snapshot.
 * @param {Object} backup
 */
function rebuildLabTable(backup) {
  const table = document.getElementById('lab-levels-table');
  if (!table) return;

  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

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
    if (radioEl) {
      if (backup.labLevels[i - 1] > 0) {
        radioEl.disabled = false;
      }
      if (backup.labChoice === i - 1) {
        radioEl.checked = true;
      }
    }

    addEvent('#lablevel_' + i, 'keyup', validateAndChangeLabLevel);
    addEvent('#labchoice_' + i, 'click', () => {
      if (calculatorApp) {
        calculatorApp._updateResultingLevel();
        calculatorApp.recalculateAll();
      }
    });
  }
}

/**
 * Handler for lab level input changes in IRN dialog
 * Replicates the old changeLabLevel function behavior
 */
function changeLabLevel() {
  // Extract lab number from input id (format: lablevel_N)
  const parts = this.id.split(/_/);
  const num = Number.parseInt(parts[1], 10);
  const radioEl = document.getElementById('labchoice_' + num);

  if (this.value == 0) {
    // Disable and uncheck radio button when level is 0
    if (radioEl) {
      radioEl.disabled = true;
      radioEl.checked = false;
    }
  } else {
    // Enable radio button when level > 0
    radioEl?.removeAttribute('disabled');
  }

  // Update the lab levels array (array is 0-indexed, rows are 1-indexed)
  if (options.prm && options.prm.labLevels) {
    options.prm.labLevels[num - 1] = Number.parseInt(this.value, 10) || 0;
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

// Expose to globalThis for direct access
if (typeof globalThis.window !== 'undefined') {
  globalThis.CostsCalculator = CostsCalculator;
  globalThis.initializeCostsCalculator = initializeCostsCalculator;
}
