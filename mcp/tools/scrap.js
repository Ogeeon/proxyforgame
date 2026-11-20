'use strict';

// What the Scrap Merchant pays for a fleet and a defense - the scrap
// calculator, computed by its own scrap-core.js with the unit prices of
// data/costs-techs.json - and, with `sellTiming`, whether to sell each flying
// ship now or fleet-save it until the merchant's event: scrap-fleetsave.js
// prices the saves with flight-core.js, as the page does.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const common = require('./common');

const {
    calculateScrap, scrapSellTiming, scrapFleetsaveFuel, scrapFuelPerDay, SCRAP_FLEET_IDS, SCRAP_DEFENSE_IDS,
    SCRAP_RATE, SCRAP_EVENT_RATE, SCRAP_EVENT_DAYS, SCRAP_FLEETSAVE_DEFAULTS, SCRAP_FLIGHT_SHIP_IDS, PLAYER_CLASS,
} = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/ogame-universe.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/flight-core.js',
        'ogame/calc/js/scrap-core.js', 'ogame/calc/js/scrap-fleetsave.js'],
    ['calculateScrap', 'scrapSellTiming', 'scrapFleetsaveFuel', 'scrapFuelPerDay', 'SCRAP_FLEET_IDS',
        'SCRAP_DEFENSE_IDS', 'SCRAP_RATE', 'SCRAP_EVENT_RATE', 'SCRAP_EVENT_DAYS', 'SCRAP_FLEETSAVE_DEFAULTS',
        'SCRAP_FLIGHT_SHIP_IDS', 'PLAYER_CLASS'],
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

/** The classes as flight-core.js counts them; none flies like the Discoverer. */
const FLIGHT_CLASSES = {
    collector: PLAYER_CLASS.COLLECTOR,
    general: PLAYER_CLASS.GENERAL,
    discoverer: PLAYER_CLASS.DISCOVERER,
    none: PLAYER_CLASS.DISCOVERER,
};

const count = { type: 'integer', minimum: 0 };
const atLeastOne = { type: 'integer', minimum: 1 };
const exchangeRate = { type: 'number', minimum: 0.1, maximum: 100 };

// No defaults in here: the validator fills a left-out group with its members'
// defaults, and a call without the block must get the plain answer.
const sellTimingSchema = {
    type: 'object',
    description: 'Sell each flying ship now, or fleet-save it until the merchant event? '
        + 'Defaults: 81%, 180 days, next galaxy, 10%, daily, rates 1:1.5:3, 1x universe.',
    properties: {
        eventRate: { type: 'number', minimum: SCRAP_EVENT_RATE.min, maximum: SCRAP_EVENT_RATE.max },
        daysToEvent: { type: 'integer', minimum: SCRAP_EVENT_DAYS.min },
        route: {
            type: 'object',
            description: '`delta` positions/systems/galaxies away.',
            properties: { kind: { type: 'string', enum: ['system', 'systems', 'galaxies'] }, delta: atLeastOne },
            additionalProperties: false,
        },
        speedPercent: { type: 'integer', minimum: 5, maximum: 100 },
        timesPerDays: {
            type: 'object',
            description: 'Saves `times` every `days` days.',
            properties: { times: atLeastOne, days: atLeastOne },
            additionalProperties: false,
        },
        drives: {
            type: 'object',
            properties: { combustion: count, impulse: count, hyperspace: count },
            additionalProperties: false,
        },
        fuelDiscount: {
            type: 'number', minimum: 0, maximum: 90,
            description: 'Fuel %, added to each ship\'s shipBonuses fuel.',
        },
        exchangeRates: {
            type: 'object',
            properties: { metal: exchangeRate, crystal: exchangeRate, deuterium: exchangeRate },
            additionalProperties: false,
        },
        fleetSpeedPeaceful: { type: 'number', minimum: 1, maximum: 10 },
        deuteriumFactor: { type: 'number', minimum: 0.5, maximum: 1 },
    },
    additionalProperties: false,
};

// Every ship's bonuses are read, so the list of keys the schema would spell out is
// said in a few words instead; the keys are those of `ships`.
const lifeformsSchema = common.lifeformsSchema(['collectorClassBonus', 'generalClassBonus'], ['small-cargo']);
lifeformsSchema.properties.shipBonuses.description = 'By `ships` key: cargo for the haul, speed and fuel for sellTiming.';

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
        lifeforms: lifeformsSchema,
        sellTiming: sellTimingSchema,
    },
    additionalProperties: false,
};

/**
 * @param {any} r a ScrapSection
 */
const section = (r) => ({ cost: r.cost, payback: r.payback, costTotal: r.costSum, paybackTotal: r.paybackSum, points: r.points });

/** @param {number} n */
const tenths = (n) => Math.round(n * 10) / 10;

/**
 * The sell-or-wait advice: what one fleet save burns per ship type, then the
 * advice, as the page's accordion computes them.
 * @param {any} args validated
 * @param {Record<string, number>} counts by tech id
 * @param {number} rate the merchant's rate the return was computed at
 */
function sellTiming(args, counts, rate) {
    const s = args.sellTiming;
    const d = SCRAP_FLEETSAVE_DEFAULTS;
    const shipBonuses = args.lifeforms?.shipBonuses ?? {};
    const fuel = scrapFleetsaveFuel(counts, {
        route: { kind: s.route?.kind ?? d.routeKind, delta: s.route?.delta ?? d.routeDelta },
        speedPercent: s.speedPercent ?? d.speedPercent,
        driveLevels: [s.drives?.combustion, s.drives?.impulse, s.drives?.hyperspace],
        playerClass: FLIGHT_CLASSES[/** @type {keyof typeof FLIGHT_CLASSES} */ (args.playerClass)],
        lfMechanGE: args.lifeforms?.generalClassBonus,
        lfRocktalCE: args.lifeforms?.collectorClassBonus,
        shipBonuses: Object.fromEntries(/** @type {number[]} */ (SCRAP_FLIGHT_SHIP_IDS)
            .map((id) => [id, shipBonuses[keyOf(id)] ?? {}])),
        fuelDiscount: s.fuelDiscount,
        universe: {
            fleetSpeedPeaceful: s.fleetSpeedPeaceful,
            deutFactor: s.deuteriumFactor === undefined ? undefined : Math.round(s.deuteriumFactor * 10),
        },
    });
    const r = scrapSellTiming({
        counts,
        rate,
        eventRate: s.eventRate ?? SCRAP_EVENT_RATE.def,
        days: s.daysToEvent ?? SCRAP_EVENT_DAYS.def,
        exchangeRates: s.exchangeRates,
        fuelPerDay: scrapFuelPerDay(fuel.perSave, s.timesPerDays?.times ?? d.times, s.timesPerDays?.days ?? d.days),
    }, PRICES);
    return {
        eventRatePercent: r.eventRate,
        daysToEvent: r.days,
        fleetSave: { distance: fuel.distance, durationSeconds: fuel.duration, deuterium: fuel.total },
        ships: r.rows.map((/** @type {any} */ row) => ({
            ship: keyOf(row.id),
            count: row.count,
            valueMsu: Math.round(row.value),
            deuteriumPerDay: tenths(row.fuelPerDay),
            // JSON has no Infinity: null for ships that burn nothing.
            worthWaitingDays: Number.isFinite(row.threshold) ? tenths(row.threshold) : null,
            gainOfWaitingMsu: Math.round(row.gain),
            advice: row.wait ? 'wait' : 'sell',
        })),
        waitTypes: r.summary.wait,
        sellTypes: r.summary.sell,
        gainOfAdviceMsu: Math.round(r.summary.gain),
        note: 'Defenses, missiles, satellites and crawlers cost nothing to keep. Not counted: losing the fleet, '
            + 'the ships\' use before the sale, points, skipped empty systems.',
    };
}

/** @returns {import('../lib/protocol').Tool} */
function createScrapTool() {
    return {
        name: 'ogame_scrap',
        title: 'OGame Scrap Merchant',
        description: 'What the Scrap Merchant pays for ships, defenses and missiles: cost and return per resource, '
            + 'fleet and defense apart and in total, points lost, cargo ships to haul it; sell now or wait (sellTiming). '
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
                // Only the Collector raises a cargo ship's hold.
                isCollector: args.playerClass === 'collector',
                collectorClassBonus: args.lifeforms?.collectorClassBonus,
                scCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'small-cargo'),
                lcCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'large-cargo'),
            }, PRICES);
            /** @type {Record<string, unknown>} */
            const out = {
                ratePercent: r.rate,
                fleet: section(r.fleet),
                defense: section(r.defense),
                total: section(r.total),
                cargoShipsToHaulReturn: {
                    smallCargo: r.transport.small, largeCargo: r.transport.large,
                    smallCargoHold: r.transport.smallHold, largeCargoHold: r.transport.largeHold,
                },
            };
            if (args.sellTiming) {
                out.sellTiming = sellTiming(args, counts, r.rate);
            }
            return out;
        },
    };
}

module.exports = { createScrapTool };
