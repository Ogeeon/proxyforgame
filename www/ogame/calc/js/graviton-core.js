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

// Energy production added by each level of the Kaelesh Disruption Chamber, %.
const DISRUPTION_CHAMBER_ENERGY = 1.5;

class GravitonCalculator {
  /**
   * The officers' energy bonus the core expects: 2 for the whole commanding
   * staff (+12%), 1 for an engineer alone (+10%), 0 otherwise.
   *
   * @param {{engineer: boolean, geologist: boolean, technocrat: boolean, admiral: boolean, commander: boolean}} o
   */
  static officerEnergyBonus(o) {
    if (o.engineer && o.geologist && o.technocrat && o.admiral && o.commander) return 2;
    return o.engineer ? 1 : 0;
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
   *   lcCapacityIncrease, rcCapacityIncrease, crysAvailable, deutAvailable,
   *   deutInDebris
   * @returns {Object} Result with the per-source energy breakdown, the
   *   available/required energy, and — when the satellites can cover the
   *   shortfall — the resource, transport, recycling and time figures.
   */
  compute(p) {
    const isCollector = p.playerClass === GRAVITON_CLASS.COLLECTOR;
    /** @type {PlanetEnergyParams} */
    const planet = {
      solarPlantLevel: p.solarPlantLevel, solarPlantPercent: p.solarPlantPercent,
      fusionPlantLevel: p.fusionPlantLevel, fusionPlantPercent: p.fusionPlantPercent,
      energyTechLevel: p.energyTechLevel, maxTemp: p.maxPlanetTemp,
      satellites: p.solarSatellitesCount, satellitesPercent: p.solarSatellitesPercent,
      booster: p.energyBoost, engineer: p.energyBonus >= 1, fullCrew: p.energyBonus === 2,
      collector: isCollector, trader: p.isTrader,
      lfTechBonus: p.totalLFEnrgBonus, lfBuildingBonus: DISRUPTION_CHAMBER_ENERGY * p.disChLevel,
    };
    const energy = planetEnergy(planet);
    const availableEnergy = energy.total;
    // What a freshly built satellite adds, its share of every bonus included.
    const energyPerSat = satelliteEnergyYield(planet);
    const energyRequirement = p.gravitonLevel > 0
      ? 300000 * Math.pow(3, p.gravitonLevel - 1)
      : 0;


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
      energyPerSat,
      // Filled in below when the satellites can actually contribute energy.
      feasible: energyPerSat > 0,
      neededSats: Infinity,
      crysNeeded: 0,
      deutNeeded: 0,
      crysToDeliver: 0,
      deutToDeliver: 0,
      scNeeded: 0,
      lcNeeded: 0,
      dfAmount: 0,
      dfCrystal: 0,
      dfDeuterium: 0,
      netCrysNeeded: 0,
      netDeutNeeded: 0,
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

    const neededSats = satellitesForEnergy(planet, energyRequirement);
    result.neededSats = neededSats;

    const crysNeeded = neededSats * 2000;
    const deutNeeded = neededSats * 500;
    result.crysNeeded = crysNeeded;
    result.deutNeeded = deutNeeded;

    // The Collector bonus applies to transports only.
    const collectorCargoBonus = isCollector ? HOLD_CLASS_BONUS.COLLECTOR : 0;
    const capSC = shipHold(5000, {
      hyperTechLevel: p.hyperTechLevel, classBonus: collectorCargoBonus, lfBonus: p.scCapacityIncrease,
    });
    const capLC = shipHold(25000, {
      hyperTechLevel: p.hyperTechLevel, classBonus: collectorCargoBonus, lfBonus: p.lcCapacityIncrease,
    });

    // Resources already sitting on the planet cut down what has to be shipped
    // in. Each resource is offset on its own: a crystal surplus never covers a
    // deuterium shortage, so the two are clamped separately before summing.
    const crysToDeliver = Math.max(0, crysNeeded - (p.crysAvailable || 0));
    const deutToDeliver = Math.max(0, deutNeeded - (p.deutAvailable || 0));
    result.crysToDeliver = crysToDeliver;
    result.deutToDeliver = deutToDeliver;

    const sumResources = crysToDeliver + deutToDeliver;
    result.lcNeeded = Math.ceil(sumResources / capLC);
    result.scNeeded = Math.ceil(sumResources / capSC);

    // Round to 2 decimals so the debris percentage doesn't grow a long tail.
    const dfPercent = dropFraction(0.01 * p.debrisPercent, 2);

    // The debris field covers every satellite in orbit — the ones being built
    // plus the ones already there — because a raid shoots down all of them.
    // Some universes drop deuterium into the debris field as well.
    const dfCrystal = Math.floor((crysNeeded + p.solarSatellitesCount * 2000) * dfPercent);
    const dfDeuterium = p.deutInDebris
      ? Math.floor((deutNeeded + p.solarSatellitesCount * 500) * dfPercent)
      : 0;
    const dfAmount = dfCrystal + dfDeuterium;
    result.dfCrystal = dfCrystal;
    result.dfDeuterium = dfDeuterium;
    result.dfAmount = dfAmount;

    // Net cost of this build alone: what recycling the new satellites gives
    // back. Satellites already in orbit are excluded here — their debris shows
    // up in dfAmount for the recycler figures, but it is not a rebate on the
    // satellites being built now.
    result.netCrysNeeded = crysNeeded - Math.floor(crysNeeded * dfPercent);
    result.netDeutNeeded = deutNeeded - (p.deutInDebris ? Math.floor(deutNeeded * dfPercent) : 0);

    // Recyclers get the General +20% bonus (never the Collector one), plus the
    // hyperspace tech and the life-form recycler capacity increase.
    const generalCargoBonus = p.playerClass === GRAVITON_CLASS.GENERAL ? HOLD_CLASS_BONUS.GENERAL : 0;
    const capRc = shipHold(20000, {
      hyperTechLevel: p.hyperTechLevel, classBonus: generalCargoBonus, lfBonus: p.rcCapacityIncrease,
    });
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
