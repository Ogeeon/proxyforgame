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
        hyperspaceTechnology: common.hyperspaceTechnologySchema,
        playerClass: common.playerClassSchema,
        lifeforms: common.lifeformsSchema([], ['small-cargo', 'large-cargo']),
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
    const none = { dstMixType: 0, mixBalance: 50, mixProp1: 1, mixProp2: 1, fix1: 0, fix2: 0, mixSrcBalance: 50 };
    const chosen = chosenSplit(split, pair);
    if (!chosen) {
        return none;
    }
    const [first, second] = pair;
    const { mode, value } = chosen;
    if (mode === 'ratio') {
        return { ...none, dstMixType: 1, mixProp1: value[first], mixProp2: value[second] };
    }
    const [key] = Object.keys(value);
    const amount = value[key];
    if (mode === 'fixed') {
        return key === first ? { ...none, dstMixType: 2, fix1: amount } : { ...none, dstMixType: 3, fix2: amount };
    }
    const firstShare = key === first ? amount : 100 - amount;
    return mode === 'receivePercent'
        ? { ...none, dstMixType: 0, mixBalance: firstShare }
        : { ...none, dstMixType: 4, mixSrcBalance: firstShare };
}

/**
 * The one way of splitting the split argument names, checked: it names only
 * the resources bought, both of them for a ratio, one for the others, and a
 * percentage stays at most 100. Null when none was given.
 * @param {any} split
 * @param {string[]} pair
 * @returns {{mode: string, value: Record<string, number>}|null}
 */
function chosenSplit(split, pair) {
    const given = Object.entries(split ?? {}).filter(([, v]) => v && Object.keys(v).length > 0);
    if (given.length > 1) {
        throw new ToolError('split takes one of receivePercent, ratio, fixed or sellPercent, not several.');
    }
    if (given.length === 0) {
        return null;
    }
    const [first, second] = pair;
    const [mode, value] = /** @type {[string, Record<string, number>]} */ (given[0]);
    const keys = Object.keys(value);
    const stranger = keys.find((key) => !pair.includes(key));
    if (stranger) {
        throw new ToolError(`split.${mode} names ${stranger}, which is not being bought: the trade returns ${first} and ${second}.`);
    }
    if (mode === 'ratio') {
        if (keys.length !== 2 || value[first] + value[second] === 0) {
            throw new ToolError(`split.ratio needs both ${first} and ${second}, not both 0.`);
        }
        return { mode, value };
    }
    if (keys.length !== 1) {
        throw new ToolError(`split.${mode} names one resource, ${first} or ${second}.`);
    }
    if (mode !== 'fixed' && value[keys[0]] > 100) {
        throw new ToolError(`split.${mode} is a percentage: at most 100.`);
    }
    return { mode, value };
}

/**
 * trade-core's destination type: for one resource sold, 0 or 1 for the first
 * or second of the other two, 2 for both; for two sold, 0 - the third.
 * @param {string[]} sold
 * @param {string[]} pair the resources not sold, in metal-crystal-deuterium order
 * @param {string|undefined} buy
 */
function destinationType(sold, pair, buy) {
    if (sold.length === 2) {
        if (buy !== undefined && buy !== pair[0]) {
            throw new ToolError(`Selling ${sold.join(' and ')} buys ${pair[0]} only.`);
        }
        return 0;
    }
    if (buy === undefined || buy === sold[0]) {
        throw new ToolError(`Selling ${sold[0]}, buy ${pair[0]}, ${pair[1]} or both.`);
    }
    return buy === 'both' ? 2 : pair.indexOf(buy);
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

            const dstType = destinationType(sold, pair, args.buy);
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
                ...mixParams(dstType === 2 ? args.split : undefined, pair),
                hyperTech: args.hyperspaceTechnology,
                playerClass: common.classId(args.playerClass),
                scCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'small-cargo'),
                lcCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'large-cargo'),
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
