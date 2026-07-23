// ============================================================================
// GRAVITON CALCULATOR - CORE
// ============================================================================
// Pure energy / satellite / cost computations for the graviton technology.
// No DOM access here: everything is derived from a plain params object and
// returned as a plain result object the renderer can display.

'use strict';

// Player classes relevant to the graviton calculator. Discoverer is omitted
// because it grants no energy or cargo bonus here, so it would behave as NONE.
const GRAVITON_CLASS = { NONE: 0, COLLECTOR: 1, GENERAL: 2 };

class GravitonCalculator {
  /**
   * Cargo capacity, matching the costs calculator formula:
   *   base * (1 + 0.05 * hyperTech)  +  base * classBonus  +  floor(base * cap%/100)
   * where the class bonus and the life-form capacity increase are additive.
   *
   * @param {number} base Base cargo capacity (5000 SC / 25000 LC / 20000 recycler).
   * @param {number} hyperTechLevel Hyperspace technology level.
   * @param {number} classBonus Additive class fraction: 0.25 for a Collector's
   *   transports, 0.20 for a General's recyclers, 0 otherwise.
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
   *   shipyardLevel, nanitesFactoryLevel, universeSpeed, energyTechLevel,
   *   hyperTechLevel, maxPlanetTemp, energyBonus (0/1/2),
   *   solarPlantLevel, solarPlantPercent, fusionPlantLevel, fusionPlantPercent,
   *   solarSatellitesCount, solarSatellitesPercent, debrisPercent,
   *   playerClass (0 none / 1 collector / 2 general), isTrader, energyBoost,
   *   disChLevel, gravitonLevel, totalLFEnrgBonus, scCapacityIncrease,
   *   lcCapacityIncrease, rcCapacityIncrease
   * @returns {Object} Result with the per-source energy breakdown, the
   *   available/required energy, and — when the satellites can cover the
   *   shortfall — the resource, transport, recycling and time figures.
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

    const isCollector = p.playerClass === GRAVITON_CLASS.COLLECTOR;
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
    const energyRequirement = p.gravitonLevel > 0
      ? 300000 * Math.pow(3, p.gravitonLevel - 1)
      : 0;

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
      energyPerSat,
      // Filled in below when the satellites can actually contribute energy.
      feasible: energyPerSat > 0,
      neededSats: Infinity,
      crysNeeded: 0,
      deutNeeded: 0,
      scNeeded: 0,
      lcNeeded: 0,
      dfAmount: 0,
      rcNeeded: 0,
      scNeededForDF: 0,
      lcNeededForDF: 0,
      secsTotal: 0,
    };

    // Satellites at 0 %, or a planet so cold that a satellite yields nothing,
    // can never close the gap — leave the placeholder Infinity/zero values.
    if (!result.feasible) {
      return result;
    }

    const neededSats = Math.ceil(missingEnergy / energyPerSat);
    result.neededSats = neededSats;

    const crysNeeded = neededSats * 2000;
    const deutNeeded = neededSats * 500;
    result.crysNeeded = crysNeeded;
    result.deutNeeded = deutNeeded;

    // Cargo capacity mirrors the (canonical) costs calculator: the Collector
    // +25% and the life-form capacity increase are added to the base, not
    // multiplied onto the hyperspace-boosted value. The Collector bonus applies
    // to transports only.
    const collectorCargoBonus = isCollector ? 0.25 : 0;
    const capSC = GravitonCalculator.cargoCapacity(5000, p.hyperTechLevel, collectorCargoBonus, p.scCapacityIncrease);
    const capLC = GravitonCalculator.cargoCapacity(25000, p.hyperTechLevel, collectorCargoBonus, p.lcCapacityIncrease);

    const sumResources = crysNeeded + deutNeeded;
    result.lcNeeded = Math.ceil(sumResources / capLC);
    result.scNeeded = Math.ceil(sumResources / capSC);

    // Round to 2 decimals so the debris percentage doesn't grow a long tail.
    const dfPercent = dropFraction(0.01 * p.debrisPercent, 2);
    const dfAmount = Math.floor((crysNeeded + p.solarSatellitesCount * 2000) * dfPercent);
    result.dfAmount = dfAmount;

    // Recyclers get the General +20% bonus (never the Collector one), plus the
    // hyperspace tech and the life-form recycler capacity increase.
    const generalCargoBonus = p.playerClass === GRAVITON_CLASS.GENERAL ? 0.20 : 0;
    const capRc = GravitonCalculator.cargoCapacity(20000, p.hyperTechLevel, generalCargoBonus, p.rcCapacityIncrease);
    result.rcNeeded = Math.ceil(dfAmount / capRc);
    result.lcNeededForDF = Math.ceil(dfAmount / capLC);
    result.scNeededForDF = Math.ceil(dfAmount / capSC);

    const secsPerSat = Math.max(1, Math.floor(
      ((2000 * 60 * 60) / (2500 * (p.shipyardLevel + 1) * Math.pow(2, p.nanitesFactoryLevel))) / p.universeSpeed
    ));
    result.secsTotal = neededSats * secsPerSat;

    return result;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { GravitonCalculator, GRAVITON_CLASS });
}
