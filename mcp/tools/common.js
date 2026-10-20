'use strict';

// Pieces several tools share: the universe argument, level fields, the
// English names the pages show, and the planet energy inputs the graviton and
// terraformer calculators both take.

const { readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');

/**
 * @typedef {ReturnType<typeof import('../lib/site-api').createSiteApi>} SiteApi
 */

/** The `universe` argument: a live universe whose settings are read from the game. */
const universeSchema = {
    type: 'object',
    description: 'A live universe, e.g. {"country": "en", "number": 152} for s152-en.ogame.gameforge.com. '
        + 'Its settings are read from the game; anything given by hand overrides them.',
    properties: {
        country: { type: 'string', description: 'Two or three letters: en, de, ru, us, ...' },
        number: { type: 'integer', minimum: 1 },
    },
    required: ['country', 'number'],
    additionalProperties: false,
};

/**
 * The site-api reference for a `universe` argument, or a ToolError for a
 * country that could not be one.
 * @param {{country: string, number: number}} universe
 */
function universeRef(universe) {
    const country = String(universe.country).toLowerCase();
    if (!/^[a-z]{2,3}$/.test(country)) {
        throw new ToolError('universe.country must be two or three letters, like "en" or "de".');
    }
    return { country, universe: universe.number };
}

/**
 * Economy speed: given by hand, else the live universe's, else 1.
 * @param {{universe?: {country: string, number: number}, universeSpeed?: number}} args
 * @param {SiteApi} siteApi
 * @returns {Promise<number>}
 */
async function economySpeed(args, siteApi) {
    if (args.universeSpeed !== undefined) {
        return args.universeSpeed;
    }
    if (args.universe) {
        const data = await siteApi.serverData(universeRef(args.universe));
        return Number.parseInt(String(data.speed), 10) || 1;
    }
    return 1;
}

/**
 * How a universe makes debris: the share of destroyed ships and of destroyed
 * defence that becomes debris, in percent, and whether deuterium is part of
 * it. Each comes from the argument when given, else from the live universe,
 * else from the game's defaults (30%, none, no).
 * @param {{universe?: {country: string, number: number}, debrisPercent?: number,
 *          defenceDebrisPercent?: number, deuteriumInDebris?: boolean}} args
 * @param {SiteApi} siteApi
 */
async function debrisSettings(args, siteApi) {
    /** @type {Record<string, string>} */
    let live = {};
    if (args.universe && (args.debrisPercent === undefined || args.defenceDebrisPercent === undefined
        || args.deuteriumInDebris === undefined)) {
        live = await siteApi.serverData(universeRef(args.universe));
    }
    const share = (/** @type {string|undefined} */ value) => {
        const n = Number.parseFloat(value ?? '');
        return Number.isFinite(n) ? Math.round(n * 100) : undefined;
    };
    return {
        debrisPercent: args.debrisPercent ?? share(live.debrisFactor) ?? 30,
        defenceDebrisPercent: args.defenceDebrisPercent ?? share(live.debrisFactorDef) ?? 0,
        deuteriumInDebris: args.deuteriumInDebris ?? (live.deuteriumInDebris ? live.deuteriumInDebris === '1' : false),
    };
}

/** The debris arguments debrisSettings() reads. */
const debrisSchema = {
    debrisPercent: {
        type: 'integer', minimum: 0, maximum: 100,
        description: 'Share of destroyed ships that becomes debris, in percent. Read from `universe` when given, else 30.',
    },
    deuteriumInDebris: {
        type: 'boolean',
        description: 'Whether debris fields hold deuterium too. Read from `universe` when given, else no.',
    },
};

/** The `defenceDebrisPercent` argument, for the tools that count destroyed defence. */
const defenceDebrisSchema = {
    type: 'integer', minimum: 0, maximum: 100,
    description: 'Share of destroyed defence that becomes debris, in percent. Read from `universe` when given, else 0.',
};

/** The `universeSpeed` argument. */
const universeSpeedSchema = {
    type: 'number', minimum: 1, maximum: 10,
    description: 'Economy speed. Read from `universe` when that is given, else 1.',
};

/**
 * An integer level field defaulting to 0.
 * @param {string} what
 * @param {number} [max]
 */
const level = (what, max = 100) => ({ type: 'integer', minimum: 0, maximum: max, default: 0, description: what });

/**
 * A percentage field defaulting to 0.
 * @param {string} what
 * @param {number} [max]
 */
const percent = (what, max) => ({
    type: 'number', minimum: 0, ...(max === undefined ? {} : { maximum: max }), default: 0, description: `${what}, in percent`,
});

/**
 * A map from a fixed set of keys - ships, units, buildings - to one kind of
 * value. The keys are listed once, however many there are.
 * @param {string[]} keys
 * @param {import('../lib/schema').JsonSchema} value
 * @param {string} [description]
 */
const keyedMap = (keys, value, description) => ({
    type: 'object',
    ...(description ? { description } : {}),
    propertyNames: { enum: keys },
    additionalProperties: value,
});

/**
 * The key of an item named either by its key or by its English name, ignoring
 * case: a model often has only the name the player used. The item fields list
 * every key with its name in their description rather than as an enum, which
 * would repeat each key a second time in the schema.
 * @param {string} given
 * @param {Iterable<string>} keys
 * @param {Record<string, string>} names
 * @param {string} field the argument, for the error message
 * @returns {string}
 */
function resolveKey(given, keys, names, field) {
    const wanted = given.trim().toLowerCase();
    for (const key of keys) {
        if (key === wanted || (names[key] ?? '').toLowerCase() === wanted) {
            return key;
        }
    }
    throw new ToolError(`Unknown ${field} "${given}": use one of the keys its description lists.`);
}

/**
 * English names, the way the pages show them: `common` overlaid with one page's keys.
 * @param {string} [page]
 * @returns {Record<string, string>}
 */
function englishNames(page) {
    const en = readWwwJson('locale/en.json');
    return { ...en.common, ...(page ? en[page] : {}) };
}

/**
 * The planet's energy sources and every bonus on them: what the graviton and
 * terraformer calculators both start from.
 */
const energySchema = {
    maxTemperature: {
        type: 'integer', minimum: -200, maximum: 300, default: 0,
        description: 'Maximum temperature of the planet, °C. Decides what a solar satellite yields.',
    },
    solarPlant: {
        type: 'object',
        properties: { level: level('Solar Plant level'), percent: { type: 'integer', minimum: 0, maximum: 100, default: 100 } },
        additionalProperties: false,
    },
    fusionReactor: {
        type: 'object',
        properties: { level: level('Fusion Reactor level'), percent: { type: 'integer', minimum: 0, maximum: 100, default: 100 } },
        additionalProperties: false,
    },
    solarSatellites: {
        type: 'object',
        description: 'Satellites already in orbit, and the output they run at - new ones are built to run at it too.',
        properties: {
            count: { type: 'integer', minimum: 0, default: 0 },
            percent: { type: 'integer', minimum: 0, maximum: 100, default: 100 },
        },
        additionalProperties: false,
    },
    energyTechnology: level('Energy Technology level', 50),
    officers: {
        type: 'string', enum: ['none', 'engineer', 'all'], default: 'none',
        description: 'engineer: +10% energy. all: the whole commanding staff, +12%.',
    },
    playerClass: {
        type: 'string', enum: ['none', 'collector', 'general', 'discoverer'], default: 'none',
        description: 'The Collector gets +10% energy and +25% transport cargo; the General +20% recycler cargo.',
    },
    allianceTrader: { type: 'boolean', default: false, description: 'Alliance class Trader: +5% energy.' },
    energyBoosterPercent: {
        type: 'integer', enum: [0, 20, 40, 60, 80], default: 0, description: 'Energy booster item, in percent.',
    },
    disruptionChamber: level('Rock\'tal Disruption Chamber level: +1.5% energy per level'),
    lifeformEnergyBonus: percent('Life form research energy bonus, as the game shows it'),
    hyperspaceTechnology: level('Hyperspace Technology level: cargo capacity of the transports', 50),
    cargoIncrease: {
        type: 'object',
        description: 'Life form cargo capacity increases, in percent.',
        properties: {
            smallCargo: { type: 'number', minimum: 0, default: 0 },
            largeCargo: { type: 'number', minimum: 0, default: 0 },
            recycler: { type: 'number', minimum: 0, default: 0 },
        },
        additionalProperties: false,
    },
};

/** Class numbers the graviton and terraformer cores use: 0 none, 1 collector, 2 general. */
const ENERGY_CLASS = { none: 0, discoverer: 0, collector: 1, general: 2 };

/**
 * The energy half of the graviton and terraformer parameter objects.
 * @param {any} args validated against energySchema
 */
function energyParams(args) {
    return {
        energyTechLevel: args.energyTechnology,
        hyperTechLevel: args.hyperspaceTechnology,
        maxPlanetTemp: args.maxTemperature,
        energyBonus: { none: 0, engineer: 1, all: 2 }[/** @type {'none'|'engineer'|'all'} */ (args.officers)],
        solarPlantLevel: args.solarPlant.level,
        solarPlantPercent: args.solarPlant.percent,
        fusionPlantLevel: args.fusionReactor.level,
        fusionPlantPercent: args.fusionReactor.percent,
        solarSatellitesCount: args.solarSatellites.count,
        solarSatellitesPercent: args.solarSatellites.percent,
        playerClass: ENERGY_CLASS[/** @type {keyof typeof ENERGY_CLASS} */ (args.playerClass)],
        isTrader: args.allianceTrader,
        energyBoost: args.energyBoosterPercent / 10,
        disChLevel: args.disruptionChamber,
        totalLFEnrgBonus: args.lifeformEnergyBonus,
        scCapacityIncrease: args.cargoIncrease.smallCargo,
        lcCapacityIncrease: args.cargoIncrease.largeCargo,
        rcCapacityIncrease: args.cargoIncrease.recycler,
    };
}

/**
 * The energy breakdown both cores return, under readable names.
 * @param {any} r a graviton or terraformer core result
 */
function energyBreakdown(r) {
    return {
        solarPlant: r.solarPlantEnergy,
        fusionReactor: r.fusionPlantEnergy,
        solarSatellites: r.solarSatsEnergy,
        officers: r.officerBonus,
        playerClass: r.classEnergyBonus,
        allianceClass: r.allianceEnergyBonus,
        booster: r.boostEnergyBonus,
        disruptionChamber: r.disChEnergyBonus,
        lifeformResearch: r.lfTechBonus,
        total: r.availableEnergy,
    };
}

module.exports = {
    universeSchema,
    universeSpeedSchema,
    universeRef,
    economySpeed,
    debrisSettings,
    defenceDebrisSchema,
    debrisSchema,
    level,
    percent,
    keyedMap,
    resolveKey,
    englishNames,
    energySchema,
    energyParams,
    energyBreakdown,
};
