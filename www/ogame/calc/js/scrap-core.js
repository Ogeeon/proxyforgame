// ============================================================================
// SCRAP MERCHANT CALCULATOR - CORE
// ============================================================================
// What a fleet and a defense cost, and what the Scrap Merchant pays back for
// them at a given rate. No DOM access: the page and the MCP tool
// (mcp/tools/scrap.js) both compute here, and unit-tests/scrap-core.test.js
// exercises it from node.
//
// The merchant pays each resource separately: a unit's metal, crystal and
// deuterium are each multiplied by the rate and dropped to a whole number per
// unit, and only then multiplied by the count. Defenses and the two missiles
// take the same rate as ships.
//
// The unit prices are a parameter, in the {id: [metal, crystal, deuterium, ...]}
// shape ogame-costs.js takes - the page passes them from data/costs-techs.json,
// so they are the cost calculator's prices.

'use strict';

/** The ships the merchant buys, in the game's order. 216 does not exist. */
const SCRAP_FLEET_IDS = Object.freeze([
  202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 217, 218, 219,
]);

/** The defenses and the two missiles, in the game's order. */
const SCRAP_DEFENSE_IDS = Object.freeze([401, 402, 403, 404, 405, 406, 407, 408, 502, 503]);

/** The rate the merchant starts at, and the range a rate is held to, in percent. */
const SCRAP_RATE = Object.freeze({ def: 35, min: 1, max: 100 });

/**
 * Digits kept after the point of a rate. The return is computed in whole
 * hundredths of a percent, so 57.3% of 1000 is exactly 573 rather than the
 * 572.99999... a float multiplication lands on.
 */
const SCRAP_RATE_DIGITS = 2;

/**
 * The base holds of the two cargo ships the return is hauled away in. They go
 * through shipHold() (ogame-cargo.js) with no technology and no bonus, and the
 * page labels the counts "at base capacity": the player's hyperspace
 * technology and class are inputs this calculator does not ask for.
 */
const SCRAP_CARGO_BASE_HOLD = Object.freeze({ small: 5000, large: 25000 });

/**
 * @typedef {object} ScrapResources
 * @property {number} metal
 * @property {number} crystal
 * @property {number} deuterium
 */

/**
 * @typedef {object} ScrapSection
 * @property {ScrapResources} cost What the units cost to build.
 * @property {ScrapResources} payback What the merchant pays for them.
 * @property {number} costSum Metal, crystal and deuterium of the cost, one for one.
 * @property {number} paybackSum The same of the payback.
 * @property {number} points The points the units are worth, lost when they are sold.
 */

/**
 * @typedef {object} ScrapResult
 * @property {number} rate The rate the return was computed at, as held to the range.
 * @property {Object<string, {cost: ScrapResources, payback: ScrapResources}>} units
 *   Per tech id with a count above 0.
 * @property {ScrapSection} fleet
 * @property {ScrapSection} defense
 * @property {ScrapSection} total
 * @property {{small: number, large: number, smallHold: number, largeHold: number}} transport
 *   Small or large cargoes needed to haul the whole return away, at base capacity.
 */

/**
 * Hold a rate to the merchant's range. Anything that is not a number is the
 * default rate; the rest is clamped and rounded to SCRAP_RATE_DIGITS.
 *
 * @param {unknown} rate In percent.
 * @returns {number}
 */
function scrapRate(rate) {
  const value = Number(rate);
  if (rate === null || rate === '' || !Number.isFinite(value)) return SCRAP_RATE.def;
  const pow = 10 ** SCRAP_RATE_DIGITS;
  return Math.round(Math.min(SCRAP_RATE.max, Math.max(SCRAP_RATE.min, value)) * pow) / pow;
}

/**
 * A count as the calculator takes it: a whole number, at least 0.
 *
 * @param {unknown} count
 * @returns {number}
 */
function scrapCount(count) {
  const value = Math.floor(Number(count));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** @returns {ScrapResources} */
function scrapZero() {
  return { metal: 0, crystal: 0, deuterium: 0 };
}

/**
 * @param {ScrapResources} r
 * @returns {number}
 */
function scrapSum(r) {
  return r.metal + r.crystal + r.deuterium;
}

/**
 * What one unit pays back, per resource: each resource at the rate, dropped
 * to a whole number.
 *
 * @param {number[]} price [metal, crystal, deuterium, ...]
 * @param {number} rate In percent, as scrapRate() returns it.
 * @returns {ScrapResources}
 */
function scrapUnitPayback(price, rate) {
  const pow = 10 ** SCRAP_RATE_DIGITS;
  const hundredths = Math.round(rate * pow);
  const share = (/** @type {number} */ cost) => Math.floor(cost * hundredths / (100 * pow));
  return { metal: share(price[0]), crystal: share(price[1]), deuterium: share(price[2]) };
}

/**
 * @param {readonly number[]} ids
 * @param {Object<string, unknown>} counts
 * @param {Object<string, number[]>} techData
 * @param {number} rate
 * @param {ScrapResult['units']} units Filled with the units that have a count.
 * @returns {ScrapSection}
 */
function scrapSection(ids, counts, techData, rate, units) {
  const cost = scrapZero();
  const payback = scrapZero();
  ids.forEach((id) => {
    const count = scrapCount(counts[id]);
    const price = techData[id];
    if (count === 0 || !price) return;
    const unitPayback = scrapUnitPayback(price, rate);
    /** @type {{cost: ScrapResources, payback: ScrapResources}} */
    const unit = {
      cost: { metal: price[0] * count, crystal: price[1] * count, deuterium: price[2] * count },
      payback: {
        metal: unitPayback.metal * count, crystal: unitPayback.crystal * count, deuterium: unitPayback.deuterium * count,
      },
    };
    units[id] = unit;
    /** @type {(keyof ScrapResources)[]} */ (['metal', 'crystal', 'deuterium']).forEach((res) => {
      cost[res] += unit.cost[res];
      payback[res] += unit.payback[res];
    });
  });
  return scrapSectionOf(cost, payback);
}

/**
 * @param {ScrapResources} cost
 * @param {ScrapResources} payback
 * @returns {ScrapSection}
 */
function scrapSectionOf(cost, payback) {
  const costSum = scrapSum(cost);
  return { cost, payback, costSum, paybackSum: scrapSum(payback), points: Math.floor(costSum / 1000) };
}

/**
 * What a fleet and a defense cost and what the merchant pays for them.
 *
 * @param {{counts: Object<string, unknown>, rate: unknown}} params Counts by tech
 *   id - ships, defenses and missiles in one map; an id the merchant does not
 *   buy is ignored - and the rate in percent.
 * @param {Object<string, number[]>} techData Unit prices, {id: [metal, crystal, deuterium, ...]}.
 * @returns {ScrapResult}
 */
function calculateScrap(params, techData) {
  const rate = scrapRate(params.rate);
  const counts = params.counts || {};
  /** @type {ScrapResult['units']} */
  const units = {};
  const fleet = scrapSection(SCRAP_FLEET_IDS, counts, techData, rate, units);
  const defense = scrapSection(SCRAP_DEFENSE_IDS, counts, techData, rate, units);
  const add = (/** @type {ScrapResources} */ a, /** @type {ScrapResources} */ b) => ({
    metal: a.metal + b.metal, crystal: a.crystal + b.crystal, deuterium: a.deuterium + b.deuterium,
  });
  const total = scrapSectionOf(add(fleet.cost, defense.cost), add(fleet.payback, defense.payback));
  const smallHold = shipHold(SCRAP_CARGO_BASE_HOLD.small, { hyperTechLevel: 0 });
  const largeHold = shipHold(SCRAP_CARGO_BASE_HOLD.large, { hyperTechLevel: 0 });
  return {
    rate,
    units,
    fleet,
    defense,
    total,
    transport: {
      small: Math.ceil(total.paybackSum / smallHold),
      large: Math.ceil(total.paybackSum / largeHold),
      smallHold,
      largeHold,
    },
  };
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    SCRAP_FLEET_IDS, SCRAP_DEFENSE_IDS, SCRAP_RATE, SCRAP_CARGO_BASE_HOLD, scrapRate, scrapCount, scrapUnitPayback,
    calculateScrap,
  });
}
