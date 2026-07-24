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

// Tech id / cost table shared by the cost helpers in common.js:
//   id => [cost_met, cost_crys, cost_deut, growth_coeff].
// 33 = Terraformer building, 212 = Solar satellite.
const TF_TECH_DATA = { 33: [0, 50000, 100000, 2], 212: [0, 2000, 500, 1] };
const TF_TECH_ID = 33;
const SAT_TECH_ID = 212;

class TerraformerCalculator {
  /**
   * Cargo capacity, matching the costs calculator formula:
   *   base * (1 + 0.05 * hyperTech)  +  base * classBonus  +  floor(base * cap%/100)
   * where the class bonus and the life-form capacity increase are additive.
   *
   * @param {number} base Base cargo capacity (5000 SC / 25000 LC).
   * @param {number} hyperTechLevel Hyperspace technology level.
   * @param {number} classBonus Additive class fraction: 0.25 for a Collector's
   *   transports, 0 otherwise.
   * @param {number} capacityIncrease Life-form cargo capacity increase, %.
   */
  static cargoCapacity(base, hyperTechLevel, classBonus, capacityIncrease) {
    let cap = base * (1 + 0.05 * hyperTechLevel);
    cap += base * classBonus;
    cap += Math.floor(base * 0.01 * capacityIncrease);
    return cap;
  }

  /**
   * Run the full computation for a set of parameters.
   *
   * @param {Object} p Parameters collected from the form:
   *   robotsFactoryLevel, shipyardLevel, nanitesFactoryLevel, universeSpeed,
   *   energyTechLevel, hyperTechLevel, maxPlanetTemp, energyBonus (0/1/2),
   *   solarPlantLevel, solarPlantPercent, fusionPlantLevel, fusionPlantPercent,
   *   solarSatellitesCount, solarSatellitesPercent, playerClass (0/1/2),
   *   isTrader, energyBoost, disChLevel, totalLFEnrgBonus, scCapacityIncrease,
   *   lcCapacityIncrease, tfSingleLevel, tfLevelFrom, tfLevelTo,
   *   crysAvailable, deutAvailable
   * @returns {Object} Result with the per-source energy breakdown, the
   *   available/required energy, the added fields, and — when the satellites can
   *   cover the shortfall — the terraformer/satellite/total resource, transport
   *   and time figures.
   */
  compute(p) {
    const solarPlantEnergy = Math.floor(
      0.01 * p.solarPlantPercent *
      Math.floor(20 * p.solarPlantLevel * Math.pow(1.1, p.solarPlantLevel))
    );
    const fusionPlantEnergy = Math.floor(
      0.01 * p.fusionPlantPercent *
      Math.floor(30 * p.fusionPlantLevel * Math.pow(1.05 + p.energyTechLevel * 0.01, p.fusionPlantLevel))
    );
    const baseEnergyPerSat = 0.01 * p.solarSatellitesPercent * Math.floor((p.maxPlanetTemp + 140) / 6);
    const solarSatsEnergy = (p.solarSatellitesCount * baseEnergyPerSat) >= 0
      ? p.solarSatellitesCount * baseEnergyPerSat
      : 0;
    const totalEnergy = solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy;

    // The per-satellite yield accumulates every bonus at the same rate the
    // total energy does, so a freshly built satellite covers the same share.
    let energyPerSat = baseEnergyPerSat;

    const isCollector = p.playerClass === TERRAFORMER_CLASS.COLLECTOR;
    const classEnergyBonus = isCollector ? Math.floor(0.1 * totalEnergy) : 0;
    energyPerSat += isCollector ? 0.1 * baseEnergyPerSat : 0;

    const allianceEnergyBonus = p.isTrader ? Math.floor(0.05 * totalEnergy) : 0;
    energyPerSat += p.isTrader ? 0.05 * baseEnergyPerSat : 0;

    const disChEnergyBonus = Math.floor(p.disChLevel * 0.015 * totalEnergy);
    energyPerSat += Math.floor(p.disChLevel * 0.015 * baseEnergyPerSat);

    const lfTechBonus = Math.round(p.totalLFEnrgBonus * 0.01 * totalEnergy);
    energyPerSat += 0.01 * p.totalLFEnrgBonus * baseEnergyPerSat;

    let officerBonus = 0;
    if (p.energyBonus === 1) {
      officerBonus = Math.floor(0.1 * totalEnergy);
      energyPerSat += 0.1 * baseEnergyPerSat;
    } else if (p.energyBonus === 2) {
      officerBonus = Math.floor(0.12 * totalEnergy);
      energyPerSat += 0.12 * baseEnergyPerSat;
    }

    const boostEnergyBonus = Math.floor(0.1 * p.energyBoost * totalEnergy);
    energyPerSat += 0.1 * p.energyBoost * baseEnergyPerSat;

    const availableEnergy = Math.floor(
      solarPlantEnergy + fusionPlantEnergy + solarSatsEnergy + officerBonus +
      classEnergyBonus + allianceEnergyBonus + boostEnergyBonus + disChEnergyBonus + lfTechBonus
    );

    // The single-level checkbox computes a single terraformer step, so the start
    // level is one below the target; otherwise the user gives an explicit range.
    const tfLevelFrom = p.tfSingleLevel ? (p.tfLevelTo - 1) : p.tfLevelFrom;
    const tfLevelTo = p.tfLevelTo;

    // Each new terraformer level adds planet fields: 5 on even levels, 4 on odd.
    let addedFields = 0;
    if (tfLevelTo > 0) {
      for (let i = tfLevelFrom + 1; i <= tfLevelTo; i++) {
        addedFields += (i % 2 === 0) ? 5 : 4;
      }
    }

    const energyRequirement = getBuildEnergyCost_C(TF_TECH_ID, tfLevelTo, TF_TECH_DATA);
    let missingEnergy = energyRequirement - availableEnergy;
    if (missingEnergy < 0) missingEnergy = 0;

    const result = {
      solarPlantEnergy: Math.floor(solarPlantEnergy),
      fusionPlantEnergy: Math.floor(fusionPlantEnergy),
      solarSatsEnergy: Math.floor(solarSatsEnergy),
      officerBonus,
      classEnergyBonus,
      allianceEnergyBonus,
      boostEnergyBonus,
      disChEnergyBonus,
      lfTechBonus,
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

    const neededSats = Math.ceil(missingEnergy / energyPerSat);
    result.neededSats = neededSats;

    // Terraformer building cost and time for the requested level range.
    const tfCost = getBuildCost_C(TF_TECH_ID, tfLevelFrom, tfLevelTo, TF_TECH_DATA);
    result.crysTF = tfCost[1];
    result.deutTF = tfCost[2];
    result.secsTF = getBuildTime_C(
      TF_TECH_ID, tfLevelFrom, tfLevelTo, TF_TECH_DATA,
      p.robotsFactoryLevel, p.nanitesFactoryLevel, 0, 0, 0, p.universeSpeed
    );

    // Satellite build cost and time (satellites are built at the shipyard).
    result.crysSS = neededSats * 2000;
    result.deutSS = neededSats * 500;
    result.secsSS = getBuildTime_C(
      SAT_TECH_ID, 0, neededSats, TF_TECH_DATA,
      0, p.nanitesFactoryLevel, 0, 0, p.shipyardLevel, p.universeSpeed
    );

    result.crysTotal = result.crysSS + tfCost[1];
    result.deutTotal = result.deutSS + tfCost[2];

    // Cargo capacity mirrors the (canonical) costs calculator: the Collector
    // +25% and the life-form capacity increase are added to the base, not
    // multiplied onto the hyperspace-boosted value. The Collector bonus applies
    // to transports only.
    const collectorCargoBonus = isCollector ? 0.25 : 0;
    const capSC = TerraformerCalculator.cargoCapacity(5000, p.hyperTechLevel, collectorCargoBonus, p.scCapacityIncrease);
    const capLC = TerraformerCalculator.cargoCapacity(25000, p.hyperTechLevel, collectorCargoBonus, p.lcCapacityIncrease);

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
