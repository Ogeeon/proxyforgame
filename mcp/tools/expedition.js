'use strict';

// What an expedition can bring home - the expeditions calculator, computed by
// its own expeditions-core.js, with the "strongest player" tiers its page
// renders from www/ogame/calc/data/expedition-top-tiers.json.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const common = require('./common');

const { ExpeditionsCalculator, EXPEDITION_SHIPS, EXPEDITION_CLASS } = loadBrowserScripts(
    ['ogame/calc/js/expeditions-core.js'],
    ['ExpeditionsCalculator', 'EXPEDITION_SHIPS', 'EXPEDITION_CLASS'],
);

/** @type {{upTo: number|null, highTop: number}[]} */
const TOP_TIERS = readWwwJson('ogame/calc/data/expedition-top-tiers.json');

/** @type {{id: string, abbrev: string, cargo: number}[]} */
const SHIPS = EXPEDITION_SHIPS;
const NAMES = common.englishNames('expeditions');

// The core compares the class for equality only; a number none of its
// constants carries is a player with no class, who gets none of the bonuses.
const CLASSES = {
    discoverer: EXPEDITION_CLASS.DISCOVERER,
    collector: EXPEDITION_CLASS.COLLECTOR,
    general: EXPEDITION_CLASS.OTHER,
    none: -1,
};

const inputSchema = {
    type: 'object',
    properties: {
        ships: common.keyedMap(SHIPS.map((ship) => ship.id), { type: 'integer', minimum: 0 }, 'How many of each ship are sent.'),
        topPlayerPoints: {
            type: 'integer', minimum: 0,
            description: 'Points of the strongest player in the universe; it caps what an expedition finds. '
                + 'Read from `universe` when that is given. Leave both out for the highest tier.',
        },
        playerClass: common.playerClassSchema,
        universe: common.universeSchema,
        universeSpeed: { ...common.universeSpeedSchema, description: 'Economy speed: scales a Discoverer\'s finds. ' + common.universeSpeedSchema.description },
        hyperspaceTechnology: common.hyperspaceTechnologySchema,
        lifeforms: common.lifeformsSchema(['resourceFindBonus', 'shipFindBonus', 'darkMatterFindBonus',
            'collectorClassBonus', 'discovererClassBonus'], SHIPS.map((ship) => ship.id)),
        resourceBoosterPercent: {
            type: 'integer', enum: [0, 5, 10, 15, 20, 25, 30, 35, 40], default: 0,
            description: 'Resource discovery booster item, in percent.',
        },
    },
    required: ['ships'],
    additionalProperties: false,
};

/**
 * The tier a top score falls in: the first whose limit it does not exceed, the
 * last beyond them all - as expeditions.php and the profiles pick it.
 * @param {number} points
 */
function highTopFor(points) {
    const tier = TOP_TIERS.find((t) => t.upTo !== null && points <= t.upTo) ?? TOP_TIERS.at(-1);
    return /** @type {{highTop: number}} */ (tier).highTop;
}

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createExpeditionTool({ siteApi }) {
    const calc = new ExpeditionsCalculator();
    return {
        name: 'ogame_expedition',
        title: 'OGame expedition finds',
        description: 'The most an OGame expedition can find with a given fleet: resources, dark matter, how many '
            + 'ships of each findable type, and whether the fleet has the cargo to carry a top find. Uses the '
            + 'ProxyForGame expeditions calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            const counts = Object.fromEntries(SHIPS.map((ship) => [ship.abbrev, args.ships[ship.id] ?? 0]));
            if (!Object.values(counts).some((n) => n > 0)) {
                throw new ToolError('The fleet is empty: give at least one ship in `ships`.');
            }

            let topPoints = args.topPlayerPoints;
            let universeSpeed = args.universeSpeed;
            if (args.universe && (topPoints === undefined || universeSpeed === undefined)) {
                const data = await siteApi.serverData(common.universeRef(args.universe));
                const top = Number.parseFloat(data.topScore);
                topPoints ??= Number.isFinite(top) ? Math.floor(top) : undefined;
                universeSpeed ??= Number.parseInt(String(data.speed), 10) || 1;
            }
            const highTop = topPoints === undefined ? /** @type {{highTop: number}} */ (TOP_TIERS.at(-1)).highTop : highTopFor(topPoints);

            const lf = args.lifeforms;
            const r = calc.compute({
                highTop,
                playerClass: CLASSES[/** @type {keyof typeof CLASSES} */ (args.playerClass)],
                universeSpeed: universeSpeed ?? 1,
                hyperTechLevel: args.hyperspaceTechnology,
                percentRes: lf.resourceFindBonus,
                percentShips: lf.shipFindBonus,
                classBonusCollector: lf.collectorClassBonus,
                classBonusDiscoverer: lf.discovererClassBonus,
                resourceDiscoveryBooster: args.resourceBoosterPercent,
                darkMatterDiscoveryBonus: lf.darkMatterFindBonus,
                lfShipsBonuses: SHIPS.map((ship) => common.shipCargoBonus(lf, ship.id)),
                counts,
            });

            const abbrevToId = Object.fromEntries(SHIPS.map((ship) => [ship.abbrev, ship.id]));
            const findableShips = Object.fromEntries(Object.entries(r.findCounts)
                .filter(([abbrev]) => r.canFind[abbrev])
                .map(([abbrev, n]) => [abbrevToId[abbrev], { name: NAMES[abbrevToId[abbrev]], max: n }]));

            return {
                fleetCargoCapacity: r.capacity,
                maxExpeditionPoints: r.maxPoints,
                largeCargosForTopFind: r.minLC,
                maxFind: { metal: r.maxFindMetal, crystal: r.maxFindCrystal, deuterium: r.maxFindDeuterium },
                findLimitedByCargo: r.capacityExceeded,
                darkMatter: r.darkMatter,
                findableShips,
                assumptions: {
                    topPlayerPoints: topPoints ?? null,
                    topTierValue: highTop,
                    universeSpeed: universeSpeed ?? 1,
                },
            };
        },
    };
}

module.exports = { createExpeditionTool };
