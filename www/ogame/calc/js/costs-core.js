// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Global configuration and user settings
 */
class GlobalParams {
  constructor() {
    // Building levels
    this.shipyardLevel = 0;
    this.robotFactoryLevelPlanet = 0;
    this.robotFactoryLevelMoon = 0;
    this.naniteFactoryLevel = 0;

    // Speed settings
    this.universeSpeed = 1;
    this.researchSpeed = 1;

    // Technology levels
    this.researchLabLevel = 0;
    this.energyTechLevel = 0;
    this.plasmaTechLevel = 0;
    this.ionTechLevel = 0;
    this.hyperTechLevel = 0;

    // Planet settings
    this.maxPlanetTemp = 0;
    this.planetPos = 8;

    // Officers/bonuses
    this.geologist = false;
    this.engineer = false;
    this.technocrat = false;
    this.admiral = false;
    this.commander = false;
    this.researchBonus = false;

    // Player class: 0=collector, 1=general, 2=discoverer
    this.playerClass = 0;

    // Boosters: 0=0%, 1=10%, 2=20%, 3=30%, 4=40%
    this.booster = 0;

    // Intergalactic Research Network
    this.irnLevel = 0;
    this.labLevels = []; // Array of lab levels per planet
    this.labChoice = -1; // Index of planet that starts research
    this.useDirectLabLevel = false; // If true, use researchLabLevel directly instead of IRN calculation

    // Display options
    this.fullNumbers = false;
  }

  /**
   * Get technocrat time reduction factor
   * @returns {number} Multiplicative factor (0.75 = 25% reduction)
   */
  get technocratFactor() {
    let factor = 1.0;
    if (this.technocrat) factor *= 0.75;
    if (this.researchBonus) factor *= 0.75;
    if (this.playerClass === 2) factor *= 0.75; // Discoverer
    return factor;
  }

  /**
   * Calculate combined research lab level based on IRN
   * @param {number} minLevel - Minimum lab level required (for research requirements)
   * @returns {number} Total combined lab level
   */
  getResultingLabLevel(minLevel = 0) {
    // If user manually entered a lab level (not from IRN calculation), use that directly
    if (this.useDirectLabLevel && this.researchLabLevel > 0) {
      return this.researchLabLevel;
    }

    // Filter labs that meet minimum requirement
    const validLabs = this.labLevels
      .map((level, index) => ({
        level: Number(level),
        isSelected: index === this.labChoice
      }))
      .filter(lab => lab.level > 0 && (minLevel === 0 || lab.level >= minLevel));

    // If no valid labs (all levels are 0), fall back to research-lab-level
    // This matches the old system's behavior when IRN is not configured
    if (validLabs.length === 0) {
      return this.researchLabLevel;
    }

    // Sort: selected lab first, then by level descending
    validLabs.sort((a, b) => {
      if (b.isSelected) return 1;
      if (a.isSelected) return -1;
      return b.level - a.level;
    });

    // Sum top (IRN level + 1) labs
    const limit = Math.min(this.irnLevel + 1, validLabs.length);
    return validLabs
      .slice(0, limit)
      .reduce((sum, lab) => sum + lab.level, 0);
  }

  /**
   * Get small cargo ship capacity
   */
  get smallCargoCapacity() {
    const baseCapacity = 5000;
    const hyperBonus = 1 + 0.05 * this.hyperTechLevel;
    const classBonus = this.playerClass === 0 ? 1.25 : 1.0; // Collector +25%
    return baseCapacity * hyperBonus * classBonus;
  }

  /**
   * Get large cargo ship capacity
   */
  get largeCargoCapacity() {
    const baseCapacity = 25000;
    const hyperBonus = 1 + 0.05 * this.hyperTechLevel;
    const classBonus = this.playerClass === 0 ? 1.25 : 1.0; // Collector +25%
    return baseCapacity * hyperBonus * classBonus;
  }

  /**
   * Check if all officers are active (for full crew bonus)
   */
  get hasFullCrew() {
    return this.geologist && this.engineer && this.admiral &&
      this.commander && this.technocrat;
  }

  /**
   * Clone these params
   */
  clone() {
    const cloned = new GlobalParams();
    Object.assign(cloned, this);
    cloned.labLevels = [...this.labLevels];
    return cloned;
  }

  /**
   * Validate a parameter value
   */
  static validate(field, value) {
    const rules = {
      shipyardLevel: { min: 0, max: 100, default: 0 },
      robotFactoryLevelPlanet: { min: 0, max: 100, default: 0 },
      robotFactoryLevelMoon: { min: 0, max: 100, default: 0 },
      naniteFactoryLevel: { min: 0, max: 100, default: 0 },
      universeSpeed: { min: 1, max: 10, default: 1 },
      researchSpeed: { min: 1, max: 20, default: 1 },
      researchLabLevel: { min: 0, max: 999999, default: 0 },
      energyTechLevel: { min: 0, max: 50, default: 0 },
      plasmaTechLevel: { min: 0, max: 50, default: 0 },
      ionTechLevel: { min: 0, max: 50, default: 0 },
      hyperTechLevel: { min: 0, max: 50, default: 0 },
      maxPlanetTemp: { min: -134, max: Infinity, default: 0 },
      planetPos: { min: 1, max: 16, default: 8 },
      irnLevel: { min: 0, max: Infinity, default: 0 },
      booster: { min: 0, max: 4, default: 0 },
      playerClass: { min: 0, max: 2, default: 0 }
    };

    const rule = rules[field];
    if (!rule) return value;

    const num = Number(value);
    if (isNaN(num)) return rule.default;
    if (num < rule.min) return rule.min;
    if (num > rule.max) return rule.max;
    return num;
  }
}

/**
 * Individual build/research request
 */
class BuildRequest {
  constructor(techId, fromLevel, toLevel, isMoon = false) {
    this.techId = Number(techId);
    this.fromLevel = Number(fromLevel);
    this.toLevel = Number(toLevel);
    this.isMoon = Boolean(isMoon);
  }

  /**
   * Get technology type
   */
  get techType() {
    if (this.techId < 100) return 'building';
    if (this.techId <= 200) return 'research';
    if (this.techId < 400) return 'ship';
    return 'defense';
  }

  /**
   * Check if this is a valid request
   */
  get isValid() {
    // Must have valid tech ID
    if (!this.techId || this.techId <= 0) return false;

    // Levels must be non-negative
    if (this.fromLevel < 0 || this.toLevel < 0) return false;

    // No change = invalid
    if (this.fromLevel === this.toLevel) return false;

    // Buildings can be demolished (toLevel < fromLevel)
    if (this.techType === 'building') {
      return true;
    }

    // Research, ships, defense must increase
    return this.toLevel > this.fromLevel;
  }

  /**
   * Check if this is a demolition
   */
  get isDemolition() {
    return this.toLevel < this.fromLevel;
  }

  /**
   * Check if this is a multi-level request
   */
  get isMultiLevel() {
    return Math.abs(this.toLevel - this.fromLevel) > 1;
  }
}

/**
 * Calculation result for a build request
 */
class BuildCost {
  constructor(metal = 0, crystal = 0, deuterium = 0, energy = 0, time = 0, points = 0) {
    this.metal = Number(metal) || 0;
    this.crystal = Number(crystal) || 0;
    this.deuterium = Number(deuterium) || 0;
    this.energy = Number(energy) || 0;
    this.time = Number(time) || 0;
    this.points = Number(points) || 0;
  }

  /**
   * Get total resources (metal + crystal + deuterium)
   */
  get totalResources() {
    return this.metal + this.crystal + this.deuterium;
  }

  /**
   * Add another BuildCost to this one
   */
  add(other) {
    return new BuildCost(
      this.metal + other.metal,
      this.crystal + other.crystal,
      this.deuterium + other.deuterium,
      Math.max(this.energy, other.energy), // Energy is max, not sum
      this.time + other.time,
      this.points + other.points
    );
  }

  /**
   * Multiply all values by a factor
   */
  multiply(factor) {
    return new BuildCost(
      this.metal * factor,
      this.crystal * factor,
      this.deuterium * factor,
      this.energy * factor,
      this.time * factor,
      this.points * factor
    );
  }

  /**
   * Check if this is a zero cost
   */
  get isZero() {
    return this.totalResources === 0 && this.time === 0;
  }

  /**
   * Create a zero cost object
   */
  static zero() {
    return new BuildCost(0, 0, 0, 0, 0, 0);
  }

  /**
   * Clone this cost
   */
  clone() {
    return new BuildCost(
      this.metal,
      this.crystal,
      this.deuterium,
      this.energy,
      this.time,
      this.points
    );
  }
}

// ============================================================================
// CALCULATOR ENGINE
// ============================================================================

/**
 * Pure calculation engine with no DOM dependencies
 * All methods are pure functions that take inputs and return outputs
 */
class Calculator {
  constructor(techCosts, techReqs) {
    this.techCosts = techCosts; // Cost data for all technologies
    this.techReqs = techReqs;   // Research lab requirements for research
  }

  /**
   * Calculate cost for a single build request
   * @param {BuildRequest} request - What to build
   * @param {GlobalParams} params - Global settings
   * @returns {BuildCost} Calculated costs
   */
  calculate(request, params) {
    // Invalid request = zero cost
    if (!request.isValid) {
      return BuildCost.zero();
    }

    // Check research requirements for research techs
    if (request.techType === 'research') {
      const requiredLabLevel = this.techReqs[request.techId] || 0;
      const availableLabLevel = params.getResultingLabLevel(requiredLabLevel);

      if (availableLabLevel < requiredLabLevel) {
        // Cannot research - insufficient lab level
        return BuildCost.zero();
      }
    }

    // Calculate resource costs
    const resources = this._calculateResources(
      request.techId,
      request.fromLevel,
      request.toLevel,
      params.ionTechLevel
    );

    // Calculate energy cost (consumption or production)
    const energy = this._calculateEnergy(
      request.techId,
      request.toLevel
    );

    // Calculate build/research time
    const time = this._calculateTime(
      request.techId,
      request.fromLevel,
      request.toLevel,
      request.isMoon,
      params
    );

    // Calculate points gained/lost
    const points = this._calculatePoints(
      request.techId,
      request.fromLevel,
      request.toLevel,
      resources
    );

    return new BuildCost(
      resources.metal,
      resources.crystal,
      resources.deuterium,
      energy,
      time,
      points
    );
  }

  /**
   * Calculate costs for multiple requests
   * @param {BuildRequest[]} requests - Array of build requests
   * @param {GlobalParams} params - Global settings
   * @returns {BuildCost} Total costs
   */
  calculateBatch(requests, params) {
    return requests.reduce(
      (total, request) => total.add(this.calculate(request, params)),
      BuildCost.zero()
    );
  }

  /**
   * Calculate production rate for a producer building
   * @param {number} techId - Technology ID
   * @param {number} level - Building level
   * @param {GlobalParams} params - Global settings
   * @returns {number} Hourly production
   */
  calculateProduction(techId, level, params) {
    // Only certain buildings produce resources
    const producers = [1, 2, 3, 4, 12, 212]; // Metal, Crystal, Deut, Solar, Fusion, Sat
    if (!producers.includes(techId)) {
      return 0;
    }

    // Calculate production rate
    return getProductionRate(
      techId,
      level,
      params.energyTechLevel,
      params.plasmaTechLevel,
      params.maxPlanetTemp,
      params.planetPos,
      params.universeSpeed,
      params.geologist,
      params.engineer,
      1, // energyRatio - always 1 for max production
      1, // productionRatio - always 1 for calculation
      params.booster,
      params.hasFullCrew,
      params.playerClass
    );
  }

  /**
   * Calculate energy consumption for a building
   * @param {number} techId - Technology ID
   * @param {number} level - Building level
   * @param {GlobalParams} params - Global settings
   * @returns {number} Hourly energy consumption
   */
  calculateConsumption(techId, level, params) {
    // Only certain buildings consume energy
    const consumers = [1, 2, 3, 12]; // Metal, Crystal, Deut, Fusion
    if (!consumers.includes(techId)) {
      return 0;
    }

    return getHourlyConsumption(
      techId,
      level,
      params.universeSpeed,
      1 // energyRatio
    );
  }

  /**
   * Calculate dark matter cost to halve build time
   * @param {number} techId - Technology ID
   * @param {number} time - Build time in seconds
   * @returns {number} Dark matter cost
   */
  calculateDarkMatterCost(techId, time) {
    return getHalvingCost(techId, time);
  }

  /**
   * Calculate number of ships needed to transport resources
   * @param {number} totalResources - Total resources to transport
   * @param {GlobalParams} params - Global settings
   * @returns {{small: number, large: number}} Ships needed
   */
  calculateTransportNeeded(totalResources, params) {
    return {
      small: Math.ceil(totalResources / params.smallCargoCapacity),
      large: Math.ceil(totalResources / params.largeCargoCapacity)
    };
  }

  // ========================================================================
  // PRIVATE CALCULATION METHODS
  // ========================================================================

  /**
   * Calculate resource costs (metal, crystal, deuterium)
   * @private
   */
  _calculateResources(techId, fromLevel, toLevel, ionTechLevel) {
    const cost = getBuildCost_C(
      techId,
      fromLevel,
      toLevel,
      this.techCosts,
      ionTechLevel
    );

    return {
      metal: cost[0],
      crystal: cost[1],
      deuterium: cost[2]
    };
  }

  /**
   * Calculate energy cost/production
   * @private
   */
  _calculateEnergy(techId, level) {
    return getBuildEnergyCost_C(techId, level, this.techCosts);
  }

  /**
   * Calculate build/research time
   * @private
   */
  _calculateTime(techId, fromLevel, toLevel, isMoon, params) {
    // Determine speed multiplier
    const speed = (100 < techId && techId <= 200) ?
      params.researchSpeed : params.universeSpeed;

    // Get research lab level (for research only)
    let labLevel = 0;
    if (100 < techId && techId <= 200) {
      const requiredLabLevel = this.techReqs[techId] || 0;
      labLevel = params.getResultingLabLevel(requiredLabLevel);
    }

    // Get robot factory level
    const robotLevel = isMoon ?
      params.robotFactoryLevelMoon : params.robotFactoryLevelPlanet;

    // Nanite factory only on planets
    const naniteLevel = isMoon ? 0 : params.naniteFactoryLevel;

    // Calculate time
    return getBuildTime_C(
      techId,
      fromLevel,
      toLevel,
      this.techCosts,
      robotLevel,
      naniteLevel,
      labLevel,
      params.technocratFactor,
      params.shipyardLevel,
      speed,
      this.techReqs
    );
  }

  /**
   * Calculate points gained/lost
   * @private
   */
  _calculatePoints(techId, fromLevel, toLevel, resources) {
    // Special case: some buildings can't be demolished
    // Terraformer (33), Space Dock (36), Lunar Base (41)
    if (toLevel < fromLevel && (techId === 33 || techId === 36 || techId === 41)) {
      return 0;
    }

    if (toLevel > fromLevel) {
      // Building/researching = positive points
      return Math.floor((resources.metal + resources.crystal + resources.deuterium) / 1000);
    } else {
      // Demolishing = negative points
      const buildCost = this._calculateResources(techId, toLevel, fromLevel, 0);
      return -Math.floor((buildCost.metal + buildCost.crystal + buildCost.deuterium) / 1000);
    }
  }
}

// ============================================================================
// VALIDATION AND ERROR HANDLING
// ============================================================================

/**
 * Validation result
 */
class ValidationResult {
  constructor(isValid, errors = []) {
    this.isValid = isValid;
    this.errors = errors;
  }

  addError(error) {
    this.errors.push(error);
    this.isValid = false;
  }

  static success() {
    return new ValidationResult(true, []);
  }

  static failure(errors) {
    return new ValidationResult(false, Array.isArray(errors) ? errors : [errors]);
  }
}

/**
 * Validator for build requests and parameters
 */
class Validator {
  /**
   * Validate a build request
   */
  static validateRequest(request, params, techReqs) {
    const result = ValidationResult.success();

    if (!request.isValid) {
      result.addError('Invalid build request');
      return result;
    }

    // Validate research requirements
    if (request.techType === 'research') {
      const requiredLabLevel = techReqs[request.techId] || 0;
      const availableLabLevel = params.getResultingLabLevel(requiredLabLevel);

      if (availableLabLevel < requiredLabLevel) {
        result.addError(
          `Insufficient research lab level. Required: ${requiredLabLevel}, Available: ${availableLabLevel}`
        );
      }
    }

    return result;
  }

  /**
   * Validate global parameters
   */
  static validateParams(params) {
    const result = ValidationResult.success();

    // Validate numeric ranges
    const validations = [
      { field: 'universeSpeed', min: 1, max: 10 },
      { field: 'researchSpeed', min: 1, max: 20 },
      { field: 'playerClass', min: 0, max: 2 },
      { field: 'booster', min: 0, max: 4 },
      { field: 'planetPos', min: 1, max: 16 }
    ];

    validations.forEach(v => {
      if (params[v.field] < v.min || params[v.field] > v.max) {
        result.addError(`${v.field} must be between ${v.min} and ${v.max}`);
      }
    });

    return result;
  }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

// If using modules:
// export { GlobalParams, BuildRequest, BuildCost, Calculator, Validator };

// For browser globals (current setup):
if (typeof window !== 'undefined') {
  window.GlobalParams = GlobalParams;
  window.BuildRequest = BuildRequest;
  window.BuildCost = BuildCost;
  window.Calculator = Calculator;
  window.Validator = Validator;
  window.ValidationResult = ValidationResult;
}
