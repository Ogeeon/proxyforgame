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

/**
 * The cargo fields of the transport accordion, by the options.prm key each is
 * saved under: the level and the three percentages (the Collector is a
 * checkbox, SCRAP_COLLECTOR_BOX).
 */
const SCRAP_CARGO_FIELDS = Object.freeze({
  hyperTechLevel: '#hyper-tech-level',
  collectorClassBonus: '#lf-collector-class-bonus',
  scCapacityIncrease: '#sc-capacity-increase',
  lcCapacityIncrease: '#lc-capacity-increase',
});

/** The Collector checkbox: the only class that raises a cargo ship's hold. */
const SCRAP_COLLECTOR_BOX = '#collector-class';

/**
 * @typedef {object} ScrapCargoValues
 * @property {number} hyperTechLevel
 * @property {boolean} isCollector
 * @property {number} collectorClassBonus %
 * @property {number} scCapacityIncrease %
 * @property {number} lcCapacityIncrease %
 */

class ScrapDataCollector {
  /**
   * @returns {{counts: Record<string, number>, rate: number, fullNumbers: boolean} & ScrapCargoValues}
   */
  static readParams() {
    const rateField = $('#scrap-rate');
    return {
      counts: ScrapDataCollector.readCounts(),
      rate: rateField instanceof HTMLInputElement ? getInputNumber(rateField) : SCRAP_RATE.def,
      fullNumbers: getChecked('#full-numbers'),
      ...ScrapDataCollector.readCargo(),
    };
  }

  /**
   * The cargo fields. The fractions go through the locale's decimal
   * separator.
   *
   * @returns {ScrapCargoValues}
   */
  static readCargo() {
    const num = (/** @type {string} */ sel) => {
      const el = $(sel);
      return el instanceof HTMLInputElement ? getInputNumber(el) : 0;
    };
    return {
      hyperTechLevel: num(SCRAP_CARGO_FIELDS.hyperTechLevel),
      isCollector: getChecked(SCRAP_COLLECTOR_BOX),
      collectorClassBonus: num(SCRAP_CARGO_FIELDS.collectorClassBonus),
      scCapacityIncrease: num(SCRAP_CARGO_FIELDS.scCapacityIncrease),
      lcCapacityIncrease: num(SCRAP_CARGO_FIELDS.lcCapacityIncrease),
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
  Object.assign(window, { ScrapDataCollector, SCRAP_UNIT_IDS, SCRAP_CARGO_FIELDS, SCRAP_COLLECTOR_BOX, scrapCountSelector });
}
