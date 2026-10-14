'use strict';

// What resources buy at given exchange rates - the trade calculator, computed
// by its own trade-core.js.

const { loadBrowserScripts } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const common = require('./common');

const { TradeCalculator, TRADE_RATE_LIMITS, tradeMcRate, tradeDefaultRates } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/trade-core.js'],
    ['TradeCalculator', 'TRADE_RATE_LIMITS', 'tradeMcRate', 'tradeDefaultRates'],
);

const RESOURCES = ['metal', 'crystal', 'deuterium'];
/** Source type numbers trade-core.js uses, keyed by the resources sold. */
const SOURCE_TYPES = { metal: 0, crystal: 1, deuterium: 2, 'metal+crystal': 3, 'metal+deuterium': 4, 'crystal+deuterium': 5 };
const CLASS_IDS = { collector: 0, general: 1, discoverer: 2, none: -1 };

const DEFAULT_RATES = tradeDefaultRates();

/** @param {string} what */
const byResource = (what) => ({
    type: 'object',
    description: what,
    properties: Object.fromEntries(RESOURCES.map((r) => [r, { type: 'number', minimum: 0 }])),
    additionalProperties: false,
});

const inputSchema = {
    type: 'object',
    properties: {
        sell: {
            type: 'object',
            description: 'What is offered: one resource, or two to buy the third.',
            properties: Object.fromEntries(RESOURCES.map((r) => [r, { type: 'integer', minimum: 0 }])),
            additionalProperties: false,
        },
        buy: {
            type: 'string', enum: [...RESOURCES, 'both'],
            description: 'What is wanted in return. Selling one resource, name either other one or `both`; '
                + 'selling two, it can only be the third, and may be left out.',
        },
        split: {
            type: 'object',
            description: 'With buy = both: how the return is divided, by exactly one of these. Default: half of '
                + 'the returned units each.',
            properties: {
                receivePercent: byResource('Share of the returned amount one resource makes up, counted in units, '
                    + 'in percent, e.g. {"crystal": 70}.'),
                ratio: byResource('Amounts of the two resources in this proportion, e.g. {"crystal": 2, "deuterium": 1}.'),
                fixed: byResource('A fixed amount of one resource; the rest goes on the other, e.g. {"deuterium": 100000}.'),
                sellPercent: byResource('Share of what is sold that goes on one resource, in percent, e.g. {"crystal": 50}.'),
            },
            additionalProperties: false,
        },
        rates: {
            type: 'object',
            description: `Exchange rates, as metal:deuterium and crystal:deuterium. Default ${DEFAULT_RATES.md}:1 and `
                + `${DEFAULT_RATES.cd}:1, the middle of the usual ranges (metal ${TRADE_RATE_LIMITS.md.min}-`
                + `${TRADE_RATE_LIMITS.md.max}, crystal ${TRADE_RATE_LIMITS.cd.min}-${TRADE_RATE_LIMITS.cd.max}).`,
            properties: {
                metalPerDeuterium: { type: 'number', minimum: 1, maximum: 5 },
                crystalPerDeuterium: { type: 'number', minimum: 1, maximum: 5 },
            },
            additionalProperties: false,
        },
        hyperspaceTechnology: common.level('Hyperspace Technology level: cargo capacity', 50),
        playerClass: { type: 'string', enum: Object.keys(CLASS_IDS), default: 'none' },
        cargoIncrease: {
            type: 'object',
            description: 'Life form cargo capacity increases, in percent.',
            properties: {
                smallCargo: { type: 'number', minimum: 0, default: 0 },
                largeCargo: { type: 'number', minimum: 0, default: 0 },
            },
            additionalProperties: false,
        },
    },
    required: ['sell'],
    additionalProperties: false,
};

/**
 * The mix fields of trade-core's params for a buy = both trade.
 * @param {any} split
 * @param {string[]} pair the two resources received, in metal-crystal-deuterium order
 */
function mixParams(split, pair) {
    const given = Object.entries(split ?? {}).filter(([, v]) => v && Object.keys(v).length > 0);
    if (given.length > 1) {
        throw new ToolError('split takes one of receivePercent, ratio, fixed or sellPercent, not several.');
    }
    const [first, second] = pair;
    const none = { dstMixType: 0, mixBalance: 50, mixProp1: 1, mixProp2: 1, fix1: 0, fix2: 0, mixSrcBalance: 50 };
    if (given.length === 0) {
        return none;
    }
    const [mode, value] = /** @type {[string, Record<string, number>]} */ (given[0]);
    const keys = Object.keys(value);
    for (const key of keys) {
        if (!pair.includes(key)) {
            throw new ToolError(`split.${mode} names ${key}, which is not being bought: the trade returns ${first} and ${second}.`);
        }
    }
    if (mode === 'ratio') {
        if (keys.length !== 2) {
            throw new ToolError(`split.ratio needs both ${first} and ${second}.`);
        }
        if (value[first] + value[second] === 0) {
            throw new ToolError('split.ratio cannot be 0 to 0.');
        }
        return { ...none, dstMixType: 1, mixProp1: value[first], mixProp2: value[second] };
    }
    if (keys.length !== 1) {
        throw new ToolError(`split.${mode} names one resource, ${first} or ${second}.`);
    }
    const [key] = keys;
    const amount = value[key];
    if (mode === 'fixed') {
        return key === first ? { ...none, dstMixType: 2, fix1: amount } : { ...none, dstMixType: 3, fix2: amount };
    }
    if (amount > 100) {
        throw new ToolError(`split.${mode} is a percentage: at most 100.`);
    }
    const firstShare = key === first ? amount : 100 - amount;
    return mode === 'receivePercent'
        ? { ...none, dstMixType: 0, mixBalance: firstShare }
        : { ...none, dstMixType: 4, mixSrcBalance: firstShare };
}

/** @returns {import('../lib/protocol').Tool} */
function createTradeTool() {
    return {
        name: 'ogame_trade',
        title: 'OGame resource trade',
        description: 'What metal, crystal or deuterium buys at given exchange rates - one resource for another, '
            + 'for a mix of both others, or two for the third - and the cargo ships each side of the deal needs. '
            + 'Uses the ProxyForGame trade calculator.',
        inputSchema,
        run(args) {
            const sold = RESOURCES.filter((r) => (args.sell[r] ?? 0) > 0);
            if (sold.length === 0 || sold.length === 3) {
                throw new ToolError('sell one resource, or two of them to buy the third.');
            }
            const srcType = SOURCE_TYPES[/** @type {keyof typeof SOURCE_TYPES} */ (sold.join('+'))];
            const pair = RESOURCES.filter((r) => !sold.includes(r));

            let dstType = 0;
            if (sold.length === 2) {
                if (args.buy !== undefined && args.buy !== pair[0]) {
                    throw new ToolError(`Selling ${sold.join(' and ')} buys ${pair[0]} only.`);
                }
            } else if (args.buy === undefined || args.buy === sold[0]) {
                throw new ToolError(`Selling ${sold[0]}, buy ${pair[0]}, ${pair[1]} or both.`);
            } else {
                dstType = args.buy === 'both' ? 2 : pair.indexOf(args.buy);
            }
            if (args.split && dstType !== 2) {
                throw new ToolError('split only applies to buy = both.');
            }

            const md = args.rates?.metalPerDeuterium ?? DEFAULT_RATES.md;
            const cd = args.rates?.crystalPerDeuterium ?? DEFAULT_RATES.cd;
            const rates = { md, cd, mc: tradeMcRate(md, cd) };
            const r = new TradeCalculator(rates).compute({
                metal: args.sell.metal ?? 0,
                crystal: args.sell.crystal ?? 0,
                deuterium: args.sell.deuterium ?? 0,
                srcType,
                dstType,
                ...(dstType === 2 ? mixParams(args.split, pair) : mixParams(undefined, pair)),
                hyperTech: args.hyperspaceTechnology,
                playerClass: CLASS_IDS[/** @type {keyof typeof CLASS_IDS} */ (args.playerClass)],
                scCapacityIncrease: args.cargoIncrease.smallCargo,
                lcCapacityIncrease: args.cargoIncrease.largeCargo,
            });

            const inRange = (/** @type {number} */ v, /** @type {{min: number, max: number}} */ l) => v >= l.min && v <= l.max;
            return {
                sell: Object.fromEntries(sold.map((res) => [res, args.sell[res]])),
                receive: Object.fromEntries([['metal', r.dm], ['crystal', r.dc], ['deuterium', r.dd]]
                    .filter(([, n]) => /** @type {number} */ (n) > 0)),
                rates: {
                    metalPerDeuterium: rates.md,
                    crystalPerDeuterium: rates.cd,
                    metalPerCrystal: rates.mc,
                    withinUsualRanges: inRange(rates.md, TRADE_RATE_LIMITS.md) && inRange(rates.cd, TRADE_RATE_LIMITS.cd)
                        && inRange(rates.mc, TRADE_RATE_LIMITS.mc),
                },
                cargoShips: {
                    toDeliverSold: { smallCargo: r.srcCargo.sc, largeCargo: r.srcCargo.lc },
                    toCarryReceived: { smallCargo: r.dstCargo.sc, largeCargo: r.dstCargo.lc },
                },
            };
        },
    };
}

module.exports = { createTradeTool };
