// ============================================================================
// SCRAP MERCHANT CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form into the plain params object calculateScrap() takes. No DOM
// mutation happens here.

'use strict';

/** Every unit the page has a count field for: the fleet, then the defenses. */
const SCRAP_UNIT_IDS = [...SCRAP_FLEET_IDS, ...SCRAP_DEFENSE_IDS];

/**
 * The count field of a unit.
 *
 * @param {number|string} id Tech id.
 * @returns {string}
 */
function scrapCountSelector(id) {
  return '#unit-' + id;
}

class ScrapDataCollector {
  /**
   * @returns {{counts: Record<string, number>, rate: number, fullNumbers: boolean}}
   */
  static readParams() {
    const rateField = $('#scrap-rate');
    return {
      counts: ScrapDataCollector.readCounts(),
      rate: rateField instanceof HTMLInputElement ? getInputNumber(rateField) : SCRAP_RATE.def,
      fullNumbers: getChecked('#full-numbers'),
    };
  }

  /**
   * The count of every unit, by tech id; a field missing from the page counts as 0.
   *
   * @returns {Record<string, number>}
   */
  static readCounts() {
    /** @type {Record<string, number>} */
    const counts = {};
    SCRAP_UNIT_IDS.forEach((id) => {
      const el = $(scrapCountSelector(id));
      counts[id] = el instanceof HTMLInputElement ? getInputNumber(el) : 0;
    });
    return counts;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ScrapDataCollector, SCRAP_UNIT_IDS, scrapCountSelector });
}
