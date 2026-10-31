// ============================================================================
// TERRAFORMER CALCULATOR - CORE
// ============================================================================
// Pure energy / satellite / cost computations for the terraformer building.
// No DOM access here: everything is derived from a plain params object and
// returned as a plain result object the renderer can display.
//
// The energy production part is shared with the graviton calculator; the
// terraformer-specific part upgrades a *range* of terraformer levels and reports
// the building cost, the satellite cost and their total.

'use strict';

// Player classes relevant to the terraformer calculator. Discoverer is omitted
// because it grants no energy or cargo bonus here, so it would behave as NONE.
// General is kept for parity with the sibling calculators even though it grants
// no terraformer-specific bonus (no recyclers here), so it also behaves as NONE.
const TERRAFORMER_CLASS = { NONE: 0, COLLECTOR: 1, GENERAL: 2 };

// Energy production added by each level of the Kaelesh Disruption Chamber, %.
const DISRUPTION_CHAMBER_ENERGY = 1.5;

// Tech id / cost table shared by the cost helpers in ogame-costs.js:
//   id => [cost_met, cost_crys, cost_deut, growth_coeff].
// 33 = Terraformer building, 212 = Solar satellite.
const TF_TECH_DATA = { 33: [0, 50000, 100000, 2], 212: [0, 2000, 500, 1] };
const TF_TECH_ID = 33;
const SAT_TECH_ID = 212;

class TerraformerCalculator {
  /**
   * The officers' energy bonus level the core expects: 2 for the whole
   * commanding staff (+12%), 1 for an engineer alone (+10%), 0 otherwise.
   *
   * @param {{engineer: boolean, geologist: boolean, technocrat: boolean, admiral: boolean, commander: boolean}} o
   */
  static officerBonusLevel(o) {
    if (o.engineer && o.geologist && o.technocrat && o.admiral && o.commander) return 2;
    return o.engineer ? 1 : 0;
  }

  /**
   * Crystal, deuterium and build time of the terraformer from one level to
   * another, with the life-form cost reduction. As in the cost calculator, the
   * reduction (capped at 50%) applies to each level on its own, rounded down,
   * and to the time as well as to the resources.
   *
   * @param {{robotsFactoryLevel: number, nanitesFactoryLevel: number, universeSpeed: number, lfTerraformerRdc?: number}} p
   * @param {number} from
   * @param {number} to
   * @returns {{crystal: number, deuterium: number, secs: number}}
   */
  static terraformerCost(p, from, to) {
    const factor = 1 - Math.min(0.5, (p.lfTerraformerRdc || 0) / 100);
    /** @param {number} v */
    const reduce = (v) => (factor < 1 ? Math.floor(v * factor) : v);
    const total = { crystal: 0, deuterium: 0, secs: 0 };
    for (let level = from + 1; level <= to; level++) {
      const cost = getBuildCost_C(TF_TECH_ID, level - 1, level, TF_TECH_DATA);
      total.crystal += reduce(cost[1]);
      total.deuterium += reduce(cost[2]);
      total.secs += reduce(getBuildTime_C({
        techID: TF_TECH_ID, techLevelFrom: level - 1, techLevelTo: level,
        techData: TF_TECH_DATA,
        robotsLevel: p.robotsFactoryLevel, nanitesLevel: p.nanitesFactoryLevel,
        researchLabLevel: 0, technocratFactor: 0, shipyardLevel: 0,
        uniSpeed: p.universeSpeed
      }));
    }
    return total;
  }

  /** Planet fields added by upgrading the terraformer: 5 on even levels, 4 on odd. */
  static addedFields(tfLevelFrom, tfLevelTo) {
    if (tfLevelTo <= 0) return 0;
    let fields = 0;
    for (let i = tfLevelFrom + 1; i <= tfLevelTo; i++) {
      fields += (i % 2 === 0) ? 5 : 4;
    }
    return fields;
  }

  /**
   * Run the full computation for a set of parameters.
   *
   * @param {Object} p Parameters collected from the form:
   *   robotsFactoryLevel, shipyardLevel, nanitesFactoryLevel, universeSpeed,
   *   energyTechLevel, hyperTechLevel, maxPlanetTemp, energyBonus (0/1/2),
   *   solarPlantLevel, solarPlantPercent, fusionPlantLevel, fusionPlantPercent,
   *   solarSatellitesCount, solarSatellitesPercent, playerClass (0/1/2),
   *   isTrader, energyBoost, disChLevel, totalLFEnrgBonus, collectorClassBonus
   *   (the Rock'tal Collector Enhancement total, %), lfTerraformerRdc, scCapacityIncrease,
   *   lcCapacityIncrease, tfSingleLevel, tfLevelFrom, tfLevelTo,
   *   crysAvailable, deutAvailable
   * @returns {Object} Result with the per-source energy breakdown, the
   *   available/required energy, the added fields, and — when the satellites can
   *   cover the shortfall — the terraformer/satellite/total resource, transport
   *   and time figures.
   */
  compute(p) {
    const isCollector = p.playerClass === TERRAFORMER_CLASS.COLLECTOR;
    // The Collector Enhancement raises the Collector's own bonuses only, so it
    // counts for nothing under another class.
    const collectorEnhancement = isCollector ? (p.collectorClassBonus || 0) : 0;
    /** @type {PlanetEnergyParams} */
    const planet = {
      solarPlantLevel: p.solarPlantLevel, solarPlantPercent: p.solarPlantPercent,
      fusionPlantLevel: p.fusionPlantLevel, fusionPlantPercent: p.fusionPlantPercent,
      energyTechLevel: p.energyTechLevel, maxTemp: p.maxPlanetTemp,
      satellites: p.solarSatellitesCount, satellitesPercent: p.solarSatellitesPercent,
      booster: p.energyBoost, engineer: p.energyBonus >= 1, fullCrew: p.energyBonus === 2,
      collector: isCollector, collectorEnhancement, trader: p.isTrader,
      lfTechBonus: p.totalLFEnrgBonus, lfBuildingBonus: DISRUPTION_CHAMBER_ENERGY * p.disChLevel,
    };
    const energy = planetEnergy(planet);
    const availableEnergy = energy.total;
    // What a freshly built satellite adds, its share of every bonus included.
    const energyPerSat = satelliteEnergyYield(planet);

    // The single-level checkbox computes a single terraformer step, so the start
    // level is one below the target; otherwise the user gives an explicit range.
    const tfLevelFrom = p.tfSingleLevel ? (p.tfLevelTo - 1) : p.tfLevelFrom;
    const tfLevelTo = p.tfLevelTo;

    // Each new terraformer level adds planet fields: 5 on even levels, 4 on odd.
    const addedFields = TerraformerCalculator.addedFields(tfLevelFrom, tfLevelTo);

    const energyRequirement = getBuildEnergyCost_C(TF_TECH_ID, tfLevelTo, TF_TECH_DATA);

    const result = {
      solarPlantEnergy: energy.solarPlant,
      fusionPlantEnergy: energy.fusionPlant,
      solarSatsEnergy: energy.satellites,
      officerBonus: energy.engineer + energy.fullCrew,
      classEnergyBonus: energy.playerClass,
      allianceEnergyBonus: energy.trader,
      boostEnergyBonus: energy.booster,
      disChEnergyBonus: energy.lfBuildings,
      lfTechBonus: energy.lfTech,
      availableEnergy,
      energyRequirement,
      addedFields,
      energyPerSat,
      // Filled in below when the satellites can actually contribute energy.
      feasible: energyPerSat > 0,
      neededSats: Infinity,
      crysTF: 0,
      deutTF: 0,
      secsTF: 0,
      crysSS: 0,
      deutSS: 0,
      secsSS: 0,
      crysTotal: 0,
      deutTotal: 0,
      crysToDeliver: 0,
      deutToDeliver: 0,
      scNeeded: 0,
      lcNeeded: 0,
    };

    // Satellites at 0 %, or a planet so cold that a satellite yields nothing,
    // can never close the gap — leave the placeholder Infinity/zero values.
    if (!result.feasible) {
      return result;
    }

    const neededSats = satellitesForEnergy(planet, energyRequirement);
    result.neededSats = neededSats;

    // Terraformer building cost and time for the requested level range.
    const tfCost = TerraformerCalculator.terraformerCost(p, tfLevelFrom, tfLevelTo);
    result.crysTF = tfCost.crystal;
    result.deutTF = tfCost.deuterium;
    result.secsTF = tfCost.secs;

    // Satellite build cost and time (satellites are built at the shipyard).
    result.crysSS = neededSats * 2000;
    result.deutSS = neededSats * 500;
    result.secsSS = getBuildTime_C({
      techID: SAT_TECH_ID, techLevelFrom: 0, techLevelTo: neededSats,
      techData: TF_TECH_DATA,
      robotsLevel: 0, nanitesLevel: p.nanitesFactoryLevel,
      researchLabLevel: 0, technocratFactor: 0, shipyardLevel: p.shipyardLevel,
      uniSpeed: p.universeSpeed
    });

    result.crysTotal = result.crysSS + tfCost.crystal;
    result.deutTotal = result.deutSS + tfCost.deuterium;

    // The Collector bonus applies to transports only.
    const collectorCargoBonus = isCollector ? HOLD_CLASS_BONUS.COLLECTOR : 0;
    const capSC = shipHold(5000, {
      hyperTechLevel: p.hyperTechLevel, classBonus: collectorCargoBonus,
      classEnhancement: collectorEnhancement, lfBonus: p.scCapacityIncrease,
    });
    const capLC = shipHold(25000, {
      hyperTechLevel: p.hyperTechLevel, classBonus: collectorCargoBonus,
      classEnhancement: collectorEnhancement, lfBonus: p.lcCapacityIncrease,
    });

    // Resources already sitting on the planet cut down what has to be shipped
    // in. Each resource is offset on its own: a crystal surplus never covers a
    // deuterium shortage, so the two are clamped separately before summing.
    result.crysToDeliver = Math.max(0, result.crysTotal - (p.crysAvailable || 0));
    result.deutToDeliver = Math.max(0, result.deutTotal - (p.deutAvailable || 0));

    const sumResources = result.crysToDeliver + result.deutToDeliver;
    result.scNeeded = Math.ceil(sumResources / capSC);
    result.lcNeeded = Math.ceil(sumResources / capLC);

    return result;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { TerraformerCalculator, TERRAFORMER_CLASS, TF_TECH_DATA });
}
