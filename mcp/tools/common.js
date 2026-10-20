'use strict';

// Pieces several tools share: the universe argument, level fields, the
// English names the pages show, and the planet energy inputs the graviton and
// terraformer calculators both take.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');

const { GravitonCalculator } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/graviton-core.js'],
    ['GravitonCalculator'],
);

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

/**
 * Player class numbers the costs, LF costs, production and trade cores share;
 * the flight, expedition and energy cores have constants of their own.
 */
const CLASS_IDS = { none: -1, collector: 0, general: 1, discoverer: 2 };

/** The `playerClass` argument, the same in every tool. */
const playerClassSchema = { type: 'string', enum: Object.keys(CLASS_IDS), default: 'none' };

/**
 * The CLASS_IDS number of a validated `playerClass`.
 * @param {string} name
 * @returns {number}
 */
const classId = (name) => CLASS_IDS[/** @type {keyof typeof CLASS_IDS} */ (name)];

/** The `allianceClass` argument, the same in every tool. */
const allianceClassSchema = { type: 'string', enum: ['none', 'trader', 'warrior'], default: 'none' };

/**
 * The `officers` argument, the same in every tool. There is no separate
 * commanding staff flag: the staff is all five hired, as the cores read it.
 */
const officersSchema = {
    type: 'object',
    description: 'Officers hired. All five are the commanding staff.',
    properties: Object.fromEntries(['commander', 'admiral', 'engineer', 'geologist', 'technocrat']
        .map((officer) => [officer, { type: 'boolean', default: false }])),
    additionalProperties: false,
};

/**
 * The officers' energy bonus code the graviton and terraformer cores take:
 * 2 for the whole staff, 1 for an Engineer alone, 0 otherwise - the graviton
 * core's own rule, not a copy of it.
 * @param {{commander: boolean, admiral: boolean, engineer: boolean, geologist: boolean, technocrat: boolean}} officers
 * @returns {number}
 */
const officerEnergyBonus = (officers) => GravitonCalculator.officerEnergyBonus(officers);

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

/** One ship's life form bonuses, in percent: the value of `lifeforms.shipBonuses`. */
const shipBonusSchema = {
    type: 'object',
    properties: {
        speed: { type: 'number', minimum: 0, default: 0 },
        cargo: { type: 'number', minimum: 0, default: 0 },
        fuel: { type: 'number', minimum: 0, maximum: 90, default: 0, description: 'Fuel consumption reduction' },
    },
    additionalProperties: false,
};

/**
 * A life form percentage. The `lifeforms` description says they are percent,
 * so the field's own does not repeat it.
 * @param {string} what
 * @param {number} [max]
 */
const lfPercent = (what, max) => ({ ...percent(what, max), description: what });

/**
 * Every field the `lifeforms` argument can hold. A tool takes the subset its
 * calculator reads, under the same name and meaning wherever it appears.
 * @type {Record<string, import('../lib/schema').JsonSchema>}
 */
const LIFEFORM_FIELDS = {
    metalBonus: lfPercent('Metal production bonus'),
    crystalBonus: lfPercent('Crystal production bonus'),
    deuteriumBonus: lfPercent('Deuterium production bonus'),
    energyBonus: lfPercent('Energy production bonus'),
    crawlerBonus: lfPercent('Crawler bonus (Rock\'tal Ion Crystal Modules)'),
    collectorClassBonus: lfPercent('Rock\'tal Collector Enhancement total'),
    generalClassBonus: lfPercent('Mechas General Enhancement total'),
    discovererClassBonus: lfPercent('Kaelesh Discoverer Enhancement total'),
    resourceFindBonus: lfPercent('Expedition resource find bonus'),
    shipFindBonus: lfPercent('Expedition ship find bonus'),
    darkMatterFindBonus: lfPercent('Expedition dark matter find bonus'),
    analysisNetworkBonus: lfPercent('Kaelesh Interplanetary Analysis Network phalanx range bonus'),
    itemCostReduction: lfPercent('Cost reduction of the item asked about', 50),
    itemTimeReduction: lfPercent('Time reduction of the item asked about', 99),
    researchCostReduction: lfPercent('Life form research cost reduction from technologies', 50),
    researchTimeReduction: lfPercent('Life form research time reduction from technologies', 99),
    terraformerReduction: lfPercent('Terraformer cost and time reduction', 50),
    megalith: level('Rock\'tal Megalith level: cheaper and faster buildings'),
    mineralResearchCentre: level('Rock\'tal Mineral Research Centre level: cheaper mines and production buildings'),
    researchBuilding: level('Level of the planet race\'s research building - Research Centre, Rune Technologium, '
        + 'Robotics Research Centre or Vortex Chamber: cheaper and faster life form research'),
    disruptionChamber: level('Rock\'tal Disruption Chamber level: +1.5% energy per level'),
    supraRefractor: level('Kaelesh Supra Refractor level: +0.5% moon chance and diameter per level'),
};

/**
 * The `lifeforms` argument: life form bonuses and building levels, one
 * object in every tool.
 * @param {string[]} fields the LIFEFORM_FIELDS this tool reads
 * @param {string[]} [ships] ship keys whose `shipBonuses` it reads
 * @param {Record<string, import('../lib/schema').JsonSchema>} [extra] fields of this tool alone
 */
function lifeformsSchema(fields, ships = [], extra = {}) {
    /** @type {Record<string, import('../lib/schema').JsonSchema>} */
    const properties = {};
    for (const field of fields) {
        if (!LIFEFORM_FIELDS[field]) {
            throw new Error(`no life form field ${field}`);
        }
        properties[field] = LIFEFORM_FIELDS[field];
    }
    if (ships.length > 0) {
        properties.shipBonuses = keyedMap(ships, shipBonusSchema);
    }
    return {
        type: 'object',
        description: 'Life form bonuses in percent as the game shows them, and building levels.',
        properties: { ...properties, ...extra },
        additionalProperties: false,
    };
}

/**
 * One ship's life form cargo bonus out of a validated `lifeforms`, 0 when not given.
 * @param {any} lifeforms
 * @param {string} ship
 * @returns {number}
 */
const shipCargoBonus = (lifeforms, ship) => lifeforms?.shipBonuses?.[ship]?.cargo ?? 0;

/** The life form fields and ships the graviton and terraformer energy reads. */
const ENERGY_LIFEFORMS = ['energyBonus', 'disruptionChamber'];
const ENERGY_SHIPS = ['small-cargo', 'large-cargo', 'recycler'];

/**
 * The planet's energy sources and every bonus on them: what the graviton and
 * terraformer calculators both start from. Their life form fields are
 * ENERGY_LIFEFORMS and ENERGY_SHIPS, in each tool's own `lifeforms`.
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
        ...officersSchema,
        description: 'Officers hired. The Engineer: +10% energy; all five, the commanding staff: +12%.',
    },
    playerClass: {
        ...playerClassSchema,
        description: 'The Collector gets +10% energy and +25% transport cargo; the General +20% recycler cargo.',
    },
    allianceClass: { ...allianceClassSchema, description: 'trader: +5% energy.' },
    energyBoosterPercent: {
        type: 'integer', enum: [0, 20, 40, 60, 80], default: 0, description: 'Energy booster item, in percent.',
    },
    hyperspaceTechnology: level('Hyperspace Technology level: cargo capacity of the transports', 50),
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
        energyBonus: officerEnergyBonus(args.officers),
        solarPlantLevel: args.solarPlant.level,
        solarPlantPercent: args.solarPlant.percent,
        fusionPlantLevel: args.fusionReactor.level,
        fusionPlantPercent: args.fusionReactor.percent,
        solarSatellitesCount: args.solarSatellites.count,
        solarSatellitesPercent: args.solarSatellites.percent,
        playerClass: ENERGY_CLASS[/** @type {keyof typeof ENERGY_CLASS} */ (args.playerClass)],
        isTrader: args.allianceClass === 'trader',
        energyBoost: args.energyBoosterPercent / 10,
        disChLevel: args.lifeforms.disruptionChamber,
        totalLFEnrgBonus: args.lifeforms.energyBonus,
        scCapacityIncrease: shipCargoBonus(args.lifeforms, 'small-cargo'),
        lcCapacityIncrease: shipCargoBonus(args.lifeforms, 'large-cargo'),
        rcCapacityIncrease: shipCargoBonus(args.lifeforms, 'recycler'),
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
    playerClassSchema,
    classId,
    allianceClassSchema,
    officersSchema,
    officerEnergyBonus,
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
    lifeformsSchema,
    shipCargoBonus,
    ENERGY_LIFEFORMS,
    ENERGY_SHIPS,
    energySchema,
    energyParams,
    energyBreakdown,
};
