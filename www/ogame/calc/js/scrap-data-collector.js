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
 * The fields of the "sell now or wait" accordion, by the options.prm key each
 * is saved under; the route kind and the speed are selects.
 */
const SCRAP_SELL_TIMING_FIELDS = Object.freeze({
  eventRate: '#event-rate',
  eventDays: '#event-days',
  routeDelta: '#route-delta',
  fsTimes: '#fs-times',
  fsDays: '#fs-days',
  cmbDrive: '#cmb-drive',
  impDrive: '#imp-drive',
  hypDrive: '#hyp-drive',
  fuelDiscount: '#fuel-discount',
  rateMetal: '#exchange-rates-m',
  rateCrystal: '#exchange-rates-c',
  rateDeut: '#exchange-rates-d',
});

/** The route kind select and the speed select of the fleet save. */
const SCRAP_ROUTE_KIND = '#route-kind';
const SCRAP_FS_SPEED = '#fs-speed';

/**
 * @typedef {object} ScrapSellTimingValues
 * @property {number} eventRate %
 * @property {number} eventDays
 * @property {string} routeKind A SCRAP_ROUTES key.
 * @property {number} routeDelta
 * @property {number} fsSpeed %
 * @property {number} fsTimes
 * @property {number} fsDays
 * @property {number} cmbDrive
 * @property {number} impDrive
 * @property {number} hypDrive
 * @property {number} fuelDiscount %
 * @property {number} rateMetal
 * @property {number} rateCrystal
 * @property {number} rateDeut
 */

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
   * The fields of the "sell now or wait" accordion; the fractions through the
   * locale's decimal separator.
   *
   * @returns {ScrapSellTimingValues}
   */
  static readSellTiming() {
    /** @type {Record<string, number>} */
    const nums = {};
    Object.entries(SCRAP_SELL_TIMING_FIELDS).forEach(([key, sel]) => {
      const el = $(sel);
      nums[key] = el instanceof HTMLInputElement ? getInputNumber(el) : 0;
    });
    return /** @type {ScrapSellTimingValues} */ ({
      ...nums,
      routeKind: getVal(SCRAP_ROUTE_KIND),
      fsSpeed: Number(getVal(SCRAP_FS_SPEED)),
    });
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
  Object.assign(window, {
    ScrapDataCollector, SCRAP_UNIT_IDS, SCRAP_CARGO_FIELDS, SCRAP_COLLECTOR_BOX, scrapCountSelector,
    SCRAP_SELL_TIMING_FIELDS, SCRAP_ROUTE_KIND, SCRAP_FS_SPEED,
  });
}
