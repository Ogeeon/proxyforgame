'use strict';

// What the Scrap Merchant pays for a fleet and a defense - the scrap
// calculator, computed by its own scrap-core.js with the unit prices of
// data/costs-techs.json.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const common = require('./common');

const { calculateScrap, SCRAP_FLEET_IDS, SCRAP_DEFENSE_IDS, SCRAP_RATE } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/scrap-core.js'],
    ['calculateScrap', 'SCRAP_FLEET_IDS', 'SCRAP_DEFENSE_IDS', 'SCRAP_RATE'],
);

/** @type {{techs: Record<string, {key: string, cost: number[]}>}} */
const TECHS = readWwwJson('ogame/calc/data/costs-techs.json');
/** @type {Record<string, number[]>} */
const PRICES = Object.fromEntries(Object.entries(TECHS.techs).map(([id, tech]) => [id, tech.cost]));

const SATELLITE = 212;
const CRAWLER = 217;

/** The ships the fleet tools take, by their kebab keys: every ship but the satellite and the crawler. */
const SHIP_IDS = /** @type {number[]} */ (SCRAP_FLEET_IDS).filter((id) => id !== SATELLITE && id !== CRAWLER);
const keyOf = (/** @type {number} */ id) => TECHS.techs[id].key;
const DEFENSE_IDS = /** @type {number[]} */ (SCRAP_DEFENSE_IDS);

const count = { type: 'integer', minimum: 0 };

const inputSchema = {
    type: 'object',
    properties: {
        ships: common.keyedMap(SHIP_IDS.map(keyOf), count, 'Ships sold.'),
        // The account import's shape ({count, percent}); the percent is not read.
        solarSatellites: { type: 'object', properties: { count } },
        crawlers: { type: 'object', properties: { count } },
        defenses: common.keyedMap(DEFENSE_IDS.map(keyOf), count, 'Defenses and missiles sold.'),
        rate: {
            type: 'number', minimum: SCRAP_RATE.min, maximum: SCRAP_RATE.max, default: SCRAP_RATE.def,
            description: 'Merchant\'s rate, % of the cost.',
        },
        // The cargo holds, as ogame_build_cost takes them.
        hyperspaceTechnology: common.hyperspaceTechnologySchema,
        playerClass: common.playerClassSchema,
        lifeforms: common.lifeformsSchema(['collectorClassBonus'], ['small-cargo', 'large-cargo']),
    },
    additionalProperties: false,
};

/**
 * @param {any} r a ScrapSection
 */
const section = (r) => ({ cost: r.cost, payback: r.payback, costTotal: r.costSum, paybackTotal: r.paybackSum, points: r.points });

/** @returns {import('../lib/protocol').Tool} */
function createScrapTool() {
    return {
        name: 'ogame_scrap',
        title: 'OGame Scrap Merchant',
        description: 'What the Scrap Merchant pays for ships, defenses and missiles: cost and return per resource, '
            + 'fleet and defense apart and in total, points lost, cargo ships to haul it. '
            + 'Uses the ProxyForGame scrap calculator.',
        inputSchema,
        run(args) {
            /** @type {Record<string, number>} */
            const counts = {};
            SHIP_IDS.forEach((id) => { counts[id] = args.ships?.[keyOf(id)] ?? 0; });
            counts[SATELLITE] = args.solarSatellites?.count ?? 0;
            counts[CRAWLER] = args.crawlers?.count ?? 0;
            DEFENSE_IDS.forEach((id) => { counts[id] = args.defenses?.[keyOf(id)] ?? 0; });
            const r = calculateScrap({
                counts,
                rate: args.rate ?? SCRAP_RATE.def,
                hyperTechLevel: args.hyperspaceTechnology,
                // The cost calculator's class numbers, the scrap core's too: 'none' is -1.
                playerClass: common.classId(args.playerClass),
                collectorClassBonus: args.lifeforms?.collectorClassBonus,
                scCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'small-cargo'),
                lcCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'large-cargo'),
            }, PRICES);
            return {
                ratePercent: r.rate,
                fleet: section(r.fleet),
                defense: section(r.defense),
                total: section(r.total),
                cargoShipsToHaulReturn: {
                    smallCargo: r.transport.small, largeCargo: r.transport.large,
                    smallCargoHold: r.transport.smallHold, largeCargoHold: r.transport.largeHold,
                },
            };
        },
    };
}

module.exports = { createScrapTool };
