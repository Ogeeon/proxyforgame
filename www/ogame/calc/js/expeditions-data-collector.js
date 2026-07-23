// ============================================================================
// EXPEDITIONS CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form state from the DOM into a plain params object the core can
// consume. No DOM mutation happens here.

'use strict';

class ExpeditionsDataCollector {
  /** Read every calculator input into a params object. */
  static readParams() {
    return {
      highTop: Number.parseInt(getVal('#highTop'), 10) || 0,
      playerClass: Number.parseInt(getVal('#player-class'), 10) || 0,
      universeSpeed: Number.parseInt(getVal('#universe-speed'), 10) || 1,
      hyperTechLevel: getInputNumber($('#tech-hyper-level')),
      percentRes: getInputNumber($('#percent-resources')),
      percentShips: getInputNumber($('#percent-ships')),
      classBonusCollector: getInputNumber($('#class-bonus-collector')),
      classBonusDiscoverer: getInputNumber($('#class-bonus-discoverer')),
      darkMatterDiscoveryBonus: getInputNumber($('#dark-matter-discovery-bonus')),
      resourceDiscoveryBooster: Number.parseInt(getVal('#resource-discovery-booster'), 10) || 0,
      lfShipsBonuses: ExpeditionsDataCollector.readShipsBonuses(),
      counts: ExpeditionsDataCollector.readCounts(),
    };
  }

  /**
   * Read the life-form cargo capacity bonus of every ship, in the order of
   * EXPEDITION_SHIPS (the core addresses the array by index).
   *
   * @returns {number[]} One percentage per ship.
   */
  static readShipsBonuses() {
    return EXPEDITION_SHIPS.map((ship) => {
      const el = $('#lf-cargo-' + ship.techId);
      return el ? getInputNumber(el) : 0;
    });
  }

  /**
   * Read the fleet count inputs.
   *
   * @returns {Object} {abbrev: number}
   */
  static readCounts() {
    const counts = {};
    EXPEDITION_SHIPS.forEach((ship) => {
      const el = $('#num' + ship.abbrev);
      counts[ship.abbrev] = el ? getInputNumber(el) : 0;
    });
    return counts;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ExpeditionsDataCollector });
}
