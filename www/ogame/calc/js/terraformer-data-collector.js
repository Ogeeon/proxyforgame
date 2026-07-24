// ============================================================================
// TERRAFORMER CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form/input state from the DOM into a plain params object the core
// can consume. No DOM mutation happens here.

'use strict';

class TerraformerDataCollector {
  /**
   * Read every calculator input into a params object.
   * getInputNumber() applies the locale-aware decimal handling, so fractional
   * fields (e.g. the LF energy bonus) survive comma locales unchanged.
   */
  static readParams() {
    return {
      robotsFactoryLevel: getInputNumber($('#robots-factory-level')),
      shipyardLevel: getInputNumber($('#shipyard-level')),
      nanitesFactoryLevel: getInputNumber($('#nanites-factory-level')),
      universeSpeed: Number.parseFloat(getVal('#universe-speed')) || 1,
      energyTechLevel: getInputNumber($('#energy-tech-level')),
      hyperTechLevel: getInputNumber($('#hyper-tech-level')),
      maxPlanetTemp: getInputNumber($('#max-planet-temp')),
      energyBonus: TerraformerDataCollector.readEnergyBonus(),
      solarPlantLevel: getInputNumber($('#solar-plant-level')),
      solarPlantPercent: Number.parseInt(getVal('#solar-plant-percent'), 10) || 0,
      fusionPlantLevel: getInputNumber($('#fusion-plant-level')),
      fusionPlantPercent: Number.parseInt(getVal('#fusion-plant-percent'), 10) || 0,
      solarSatellitesCount: getInputNumber($('#solar-satellites-count')),
      solarSatellitesPercent: Number.parseInt(getVal('#solar-satellites-percent'), 10) || 0,
      playerClass: TerraformerDataCollector.readPlayerClass(),
      isTrader: getChecked('#trader-bonus'),
      energyBoost: Number.parseInt(getVal('#energy-boost'), 10) || 0,
      disChLevel: getInputNumber($('#disr-chamber-level')),
      totalLFEnrgBonus: getInputNumber($('#total-lf-energy-bonus')),
      scCapacityIncrease: getInputNumber($('#sc-capacity-increase')),
      lcCapacityIncrease: getInputNumber($('#lc-capacity-increase')),
      tfSingleLevel: getChecked('#single-level'),
      tfLevelFrom: getInputNumber($('#tf-level-from')),
      tfLevelTo: getInputNumber($('#tf-level-to')),
      crysAvailable: getInputNumber($('#crystal-available')),
      deutAvailable: getInputNumber($('#deuterium-available')),
    };
  }

  /**
   * Read the selected energy officer bonus radio (0 = none, 1 = engineer,
   * 2 = all officers). Falls back to 0 when nothing is checked.
   */
  static readEnergyBonus() {
    const checked = document.querySelector('input[name="energy-bonus"]:checked');
    return checked ? (Number.parseInt(checked.value, 10) || 0) : 0;
  }

  /**
   * Read the selected player class radio (0 = none, 1 = collector, 2 = general).
   * Falls back to 0 (none) when nothing is checked.
   */
  static readPlayerClass() {
    const checked = document.querySelector('input[name="player-class"]:checked');
    return checked ? (Number.parseInt(checked.value, 10) || 0) : 0;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { TerraformerDataCollector });
}
