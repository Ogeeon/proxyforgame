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
    
    // Intergalactic Research Network
    params.irnLevel = this._getInputNumber('#irn-level');
    this._collectLabLevels(params);
    
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

    // Determine whether to use direct lab level input or IRN calculation
    // If resultingLabLevelComputed is false, user manually entered the lab level
    params.useDirectLabLevel = !options.resultingLabLevelComputed;
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

    // Skip header row (0) and footer rows (last 5)
    for (let i = 1; i < rows.length - 5; i++) {
      const row = rows[i];
      const rowRequests = this._parseTableRow(row, isMultiLevel, isMoonTable);

      // rowRequests may be a single BuildRequest or an array of them
      if (rowRequests) {
        if (Array.isArray(rowRequests)) {
          // Multi-level: add each level's request separately
          for (const req of rowRequests) {
            if (req && req.isValid) {
              requests.push(req);
            }
          }
        } else if (rowRequests.isValid) {
          // Single-level or single request
          requests.push(rowRequests);
        }
      }
    }

    return requests;
  }
  
  /**
   * Parse a single table row into one or more BuildRequests
   * For multi-level, creates one request per level (e.g., 10→15 = 5 requests)
   * @private
   */
  _parseTableRow(row, isMultiLevel, defaultIsMoon) {
    // First cell contains tech ID (hidden)
    const techIdCell = $(row.children[0]).html();
    let techId = parseInt(techIdCell);

    if (!techId || techId === 0) {
      return null; // Empty or invalid row
    }

    // Moon buildings have +10000 in table
    let isMoon = defaultIsMoon;
    if (techId > 10000) {
      techId -= 10000;
      isMoon = true;
    }

    // Get levels from input fields
    let fromLevel, toLevel;

    if (isMultiLevel) {
      // Multi-level tab: has both from and to inputs
      fromLevel = this._getInputNumberFromElement(row.children[2].children[0]);
      toLevel = this._getInputNumberFromElement(row.children[3].children[0]);
    } else {
      // Single-level tab: only has target level
      toLevel = this._getInputNumberFromElement(row.children[2].children[0]);

      // For ships/defense, fromLevel is always 0
      // For buildings, it's toLevel - 1 (unless toLevel is 0)
      if (techId >= 200) {
        fromLevel = 0; // Ships and defense
      } else {
        fromLevel = (toLevel === 0) ? 0 : toLevel - 1;
      }
    }

    // For multi-level tab with multiple levels, create one request per level
    if (isMultiLevel && Math.abs(toLevel - fromLevel) > 1) {
      const requests = [];
      const direction = toLevel > fromLevel ? 1 : -1;

      for (let level = fromLevel; level !== toLevel; level += direction) {
        requests.push(new BuildRequest(techId, level, level + direction, isMoon));
      }

      return requests;
    }

    // Single-level or single-step change: return one request
    return new BuildRequest(techId, fromLevel, toLevel, isMoon);
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
    const select = $('#tech-types-select')[0];
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
      'full-numbers': ['*']
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
      'class-0', 'class-1', 'class-2', 'full-numbers'
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
    const element = $(selector)[0];
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
    const element = $(selector)[0];
    if (!element) return 0;
    return parseInt(element.value) || 0;
  }
  
  /**
   * Get boolean value from checkbox
   * @private
   */
  _getCheckbox(selector) {
    const element = $(selector)[0];
    if (!element) return false;
    return element.checked === true;
  }
  
  /**
   * Get boolean value from radio button
   * @private
   */
  _getRadioChecked(selector) {
    const element = $(selector)[0];
    if (!element) return false;
    return element.checked === true;
  }
  
  /**
   * Get table rows
   * @private
   */
  _getTableRows(tableId) {
    const selector = `#${tableId} tr`;
    return $(selector);
  }
  
  /**
   * Cache and retrieve jQuery selector
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
// SPECIALIZED COLLECTORS
// ============================================================================

/**
 * Collects data specifically for validation purposes
 */
class ValidationDataCollector extends DataCollector {
  /**
   * Collect data and validate it
   * @returns {{params: GlobalParams, validation: ValidationResult}}
   */
  collectAndValidate() {
    const params = this.collectGlobalParams();
    const validation = Validator.validateParams(params);
    
    return { params, validation };
  }
  
  /**
   * Collect table requests and validate each one
   * @param {string} tableId
   * @param {GlobalParams} params
   * @returns {{requests: BuildRequest[], validations: ValidationResult[]}}
   */
  collectAndValidateTable(tableId, params) {
    const requests = this.collectTableRequests(tableId);
    const validations = requests.map(req => 
      Validator.validateRequest(req, params, options.techReqs)
    );
    
    return { requests, validations };
  }
}

/**
 * Collects data for export/import functionality
 */
class ExportDataCollector extends DataCollector {
  /**
   * Collect all data for export
   * @returns {Object} Complete application state
   */
  collectForExport() {
    const globalParams = this.collectGlobalParams();
    const singleLevel = this.collectAllTabRequests(0);
    const multiLevel = this.collectAllTabRequests(1);
    const range = this.collectRangeData();
    
    return {
      version: '1.0',
      timestamp: Date.now(),
      globalParams: this._paramsToJSON(globalParams),
      tabs: {
        singleLevel: this._requestsToJSON(singleLevel),
        multiLevel: this._requestsToJSON(multiLevel),
        range: this._rangeToJSON(range)
      }
    };
  }
  
  /**
   * Convert params to plain JSON
   * @private
   */
  _paramsToJSON(params) {
    return {
      shipyardLevel: params.shipyardLevel,
      robotFactoryLevelPlanet: params.robotFactoryLevelPlanet,
      robotFactoryLevelMoon: params.robotFactoryLevelMoon,
      naniteFactoryLevel: params.naniteFactoryLevel,
      universeSpeed: params.universeSpeed,
      researchSpeed: params.researchSpeed,
      researchLabLevel: params.researchLabLevel,
      energyTechLevel: params.energyTechLevel,
      plasmaTechLevel: params.plasmaTechLevel,
      ionTechLevel: params.ionTechLevel,
      hyperTechLevel: params.hyperTechLevel,
      maxPlanetTemp: params.maxPlanetTemp,
      planetPos: params.planetPos,
      geologist: params.geologist,
      engineer: params.engineer,
      technocrat: params.technocrat,
      admiral: params.admiral,
      commander: params.commander,
      researchBonus: params.researchBonus,
      playerClass: params.playerClass,
      booster: params.booster,
      irnLevel: params.irnLevel,
      labLevels: params.labLevels,
      labChoice: params.labChoice,
      fullNumbers: params.fullNumbers
    };
  }
  
  /**
   * Convert requests to plain JSON
   * @private
   */
  _requestsToJSON(requestsMap) {
    const result = {};
    for (const [key, requests] of Object.entries(requestsMap)) {
      result[key] = requests.map(req => ({
        techId: req.techId,
        fromLevel: req.fromLevel,
        toLevel: req.toLevel,
        isMoon: req.isMoon
      }));
    }
    return result;
  }
  
  /**
   * Convert range data to plain JSON
   * @private
   */
  _rangeToJSON(rangeData) {
    return {
      techId: rangeData.techId,
      fromLevel: rangeData.fromLevel,
      toLevel: rangeData.toLevel,
      techName: rangeData.techName
    };
  }
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Tracks what changed to optimize recalculation
 */
class ChangeDetector {
  constructor() {
    this.lastParams = null;
    this.lastRequests = {};
  }
  
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
// EXPORT FOR USE
// ============================================================================

if (typeof window !== 'undefined') {
  window.DataCollector = DataCollector;
  window.ValidationDataCollector = ValidationDataCollector;
  window.ExportDataCollector = ExportDataCollector;
  window.ChangeDetector = ChangeDetector;
}
