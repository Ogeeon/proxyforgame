// ============================================================================
// MOON CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form state from the DOM into a plain params object the core can
// consume. No DOM mutation happens here.

'use strict';

class MoonDataCollector {
  /**
   * Read every calculator input into a params object shared by both
   * sub-calculators (destruction and creation).
   */
  static readParams() {
    return {
      moonSize: getInputNumber($('#moon-size')),
      dsCount: getInputNumber($('#ds-count')),
      debrisPercent: Number.parseInt(getVal('#debris-percent'), 10) || 0,
      hyperTechLevel: getInputNumber($('#hypertech-lvl')),
      playerClass: MoonDataCollector.readPlayerClass(),
      rcCapacityIncrease: getInputNumber($('#rc-capacity-increase')),
      defenseToDebris: getChecked('#defense-to-debris'),
      deutToDebris: getChecked('#deut-to-debris'),
      promoMoon: getChecked('#promo-moon'),
      counts: MoonDataCollector.readCounts(),
    };
  }

  /**
   * Read the selected player class radio (0 = none, 1 = collector, 2 = general).
   * Falls back to 0 (none) when nothing is checked.
   */
  static readPlayerClass() {
    const checked = document.querySelector('input[name="player-class"]:checked');
    return checked ? (Number.parseInt(checked.value, 10) || 0) : 0;
  }

  /**
   * Read the count input of every unit listed in MOON_UNITS. Units missing
   * from the page (should not happen) simply count as zero.
   *
   * @returns {Object} {unitId: number}
   */
  static readCounts() {
    const counts = {};
    MOON_UNITS.forEach((unit) => {
      const el = $('#' + unit.id);
      counts[unit.id] = el ? getInputNumber(el) : 0;
    });
    return counts;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { MoonDataCollector });
}
