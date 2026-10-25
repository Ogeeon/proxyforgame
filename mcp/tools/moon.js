'use strict';

// The moon calculator's three panels as three tools - destroying a moon,
// creating one out of a debris field, and the sensor phalanx's range - all
// computed by its own moon-core.js.

const { loadBrowserScripts } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const common = require('./common');

const { MoonCalculator, MOON_UNITS } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/moon-core.js'],
    ['MoonCalculator', 'MOON_UNITS'],
);

/** @type {{id: string, group: string}[]} */
const UNITS = MOON_UNITS;
const NAMES = common.englishNames('moon');

/** Rounds a percentage for reading, without pretending to more precision than it has. */
const pct = (/** @type {number} */ fraction) => Math.round(fraction * 100 * 1000) / 1000;

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool[]}
 */
function createMoonTools({ siteApi }) {
    const calc = new MoonCalculator();

    /** @type {import('../lib/protocol').Tool} */
    const destruction = {
        name: 'ogame_moon_destruction',
        title: 'OGame moon destruction chances',
        description: 'The chance that Death Stars destroy a moon of a given diameter, and the chance that the '
            + 'Death Stars blow up instead. Uses the ProxyForGame moon calculator.',
        inputSchema: {
            type: 'object',
            properties: {
                moonDiameter: { type: 'integer', minimum: 1, maximum: 20000, description: 'Diameter of the moon, km.' },
                deathStars: { type: 'integer', minimum: 1, description: 'Number of Death Stars sent.' },
            },
            required: ['moonDiameter', 'deathStars'],
            additionalProperties: false,
        },
        run(args) {
            const r = calc.computeDestroy({ moonSize: args.moonDiameter, dsCount: args.deathStars });
            return {
                moonDestroyedPercent: Math.round(r.destroyChance * 1000) / 1000,
                deathStarsLostPercent: Math.round(r.blowChance * 1000) / 1000,
            };
        },
    };

    /** @type {import('../lib/protocol').Tool} */
    const creation = {
        name: 'ogame_moon_creation',
        title: 'OGame moon creation chance',
        description: 'The chance that a battle creates a moon, from the units destroyed over the planet; the '
            + 'diameters such a moon can have; the debris field and the recyclers to clear it; and how many of '
            + 'each unit it takes to reach the maximum chance. Uses the ProxyForGame moon calculator.',
        inputSchema: {
            type: 'object',
            properties: {
                destroyed: common.keyedMap(UNITS.map((unit) => unit.id), { type: 'integer', minimum: 0 },
                    'Units destroyed in the battle, ships and defence alike. Ships and solar satellites feed the '
                    + 'debris field at the ships\' share, defence at its own.'),
                universe: common.universeSchema,
                ...common.debrisSchema,
                defenceDebrisPercent: common.defenceDebrisSchema,
                moonEvent: { type: 'boolean', default: false, description: 'A moon event is on: the chance caps at 40% instead of 20%.' },
                hyperspaceTechnology: common.hyperspaceTechnologySchema,
                playerClass: { ...common.playerClassSchema, description: 'Of the player recycling. The General: +20% recycler capacity.' },
                lifeforms: common.lifeformsSchema(['supraRefractor'], ['recycler']),
            },
            required: ['destroyed'],
            additionalProperties: false,
        },
        openWorld: true,
        async run(args) {
            const counts = Object.fromEntries(UNITS.map((unit) => [unit.id, args.destroyed[unit.id] ?? 0]));
            if (!Object.values(counts).some((n) => n > 0)) {
                throw new ToolError('Nothing was destroyed: give at least one unit in `destroyed`.');
            }
            const debris = await common.debrisSettings(args, siteApi);

            const r = calc.computeCreate({
                counts,
                debrisPercent: debris.debrisPercent,
                defenseDebrisPercent: debris.defenceDebrisPercent,
                hyperTechLevel: args.hyperspaceTechnology,
                isGeneral: args.playerClass === 'general',
                rcCapacityIncrease: common.shipCargoBonus(args.lifeforms, 'recycler'),
                deutToDebris: debris.deuteriumInDebris,
                promoMoon: args.moonEvent,
                supraRefractorLevel: args.lifeforms.supraRefractor,
            });

            const unitsForMaxChance = Object.fromEntries(Object.entries(r.maxCounts)
                .filter(([, n]) => n !== null)
                .map(([id, n]) => [id, n]));
            return {
                moonChancePercent: pct(r.createChance),
                maxChancePercent: pct(r.chanceCap),
                debris: {
                    metal: r.recyclableMetal,
                    crystal: r.recyclableCrystal,
                    deuterium: r.recyclableDeut,
                    total: r.debrisTotal,
                },
                moonDiameterKm: r.moonSizes.length
                    ? { min: r.moonSizeMin, max: r.moonSizeMax, equallyLikely: [...r.moonSizes] }
                    : null,
                recyclersNeeded: r.recyclers,
                recyclerCapacity: r.recyclerCapacity,
                unitsCost: { metal: r.metalRequired, crystal: r.crystalRequired, deuterium: r.deuteriumRequired },
                unitsForMaxChance,
                assumptions: debris,
                unitNames: Object.fromEntries(UNITS.map((u) => [u.id, NAMES[u.id] ?? u.id])
                    .filter(([id]) => counts[id] > 0)),
            };
        },
    };

    /** @type {import('../lib/protocol').Tool} */
    const phalanx = {
        name: 'ogame_phalanx',
        title: 'OGame sensor phalanx range',
        description: 'How many systems a Sensor Phalanx sees, which systems that covers from a given one, and the '
            + 'level it takes to reach a target system. Uses the ProxyForGame moon calculator.',
        inputSchema: {
            type: 'object',
            properties: {
                phalanxLevel: { type: 'integer', minimum: 1, maximum: 50, description: 'Sensor Phalanx level.' },
                moonSystem: { type: 'integer', minimum: 1, maximum: 999, description: 'System the moon with the phalanx is in.' },
                targetSystem: { type: 'integer', minimum: 1, maximum: 999, description: 'A system to reach; the answer says what level it needs.' },
                playerClass: { ...common.playerClassSchema, description: 'The Discoverer: +20% phalanx range.' },
                lifeforms: common.lifeformsSchema(['analysisNetworkBonus', 'discovererClassBonus']),
                universe: common.universeSchema,
                universeSettings: {
                    type: 'object',
                    description: 'Galaxy shape given by hand. Unset ones come from `universe` when given, else 499 '
                        + 'systems that do not wrap around.',
                    properties: {
                        systems: { type: 'integer', minimum: 1, maximum: 999 },
                        circularSystems: { type: 'boolean' },
                    },
                    additionalProperties: false,
                },
            },
            required: ['phalanxLevel', 'moonSystem'],
            additionalProperties: false,
        },
        openWorld: true,
        async run(args) {
            let systems = args.universeSettings?.systems;
            let circular = args.universeSettings?.circularSystems;
            if (args.universe && (systems === undefined || circular === undefined)) {
                const data = await siteApi.serverData(common.universeRef(args.universe));
                systems ??= Number.parseInt(String(data.systems), 10) || undefined;
                circular ??= data.donutSystem === '1';
            }
            systems ??= 499;
            circular ??= false;
            if (args.moonSystem > systems || (args.targetSystem ?? 1) > systems) {
                throw new ToolError(`A galaxy here has ${systems} systems.`);
            }

            const r = calc.computePhalanx({
                phalanxLevel: args.phalanxLevel,
                phalanxRangeBonus: args.lifeforms.analysisNetworkBonus,
                isDiscoverer: args.playerClass === 'discoverer',
                discovererBonus: args.lifeforms.discovererClassBonus,
                ownSystem: args.moonSystem,
                targetSystem: args.targetSystem ?? args.moonSystem,
                circularSystems: circular,
                numberOfSystems: systems,
            });
            /** @type {Record<string, unknown>} */
            const result = {
                rangeSystems: r.phalanxRange,
                covers: r.phalanxSegments.map((/** @type {number[]} */ [from, to]) => ({ from, to })),
                systemsCovered: r.phalanxSystemsInRange,
                galaxy: { systems, circular },
            };
            if (args.targetSystem !== undefined) {
                result.target = {
                    system: args.targetSystem,
                    distance: r.phalanxDistance,
                    inRange: r.phalanxDistance <= r.phalanxRange,
                    levelNeeded: r.phalanxLevelRequired,
                };
            }
            return result;
        },
    };

    return [destruction, creation, phalanx];
}

module.exports = { createMoonTools };
