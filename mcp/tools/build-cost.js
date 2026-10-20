'use strict';

// Cost, time and points of building, researching or demolishing one item - the
// costs calculator's arithmetic, from its own costs-core.js and the tech table
// costs.php renders the page from (www/ogame/calc/data/costs-techs.json).

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const { formatDuration } = require('../lib/format');
const common = require('./common');

const { GlobalParams, BuildRequest, Calculator, universeSpeeds } = loadBrowserScripts(
    ['ogame/calc/js/ogame-production.js', 'ogame/calc/js/ogame-costs.js', 'ogame/calc/js/costs-core.js'],
    ['GlobalParams', 'BuildRequest', 'Calculator', 'universeSpeeds'],
);

/**
 * @typedef {object} TechEntry
 * @property {string} key
 * @property {number} type 1 any building, 2 planet only, 3 moon only, 4 research, 5 ship, 6 defence
 * @property {number[]} cost
 * @property {number} growth
 */

/** @type {{techs: Record<string, TechEntry>, labRequirements: Record<string, number>}} */
const TECHS = readWwwJson('ogame/calc/data/costs-techs.json');

/** English names, the way the costs page shows them. */
const NAMES = (() => {
    const en = readWwwJson('locale/en.json');
    return { ...en.common, ...en.costs };
})();

/** @type {Map<string, number>} item key → tech id */
const IDS = new Map(Object.entries(TECHS.techs).map(([id, tech]) => [tech.key, Number(id)]));

/** The cost table costs-core.js expects: id → [metal, crystal, deuterium, growth]. */
const TECH_COSTS = Object.fromEntries(Object.entries(TECHS.techs)
    .map(([id, tech]) => [id, [...tech.cost, tech.growth]]));

const KIND = { 1: 'building', 2: 'building', 3: 'building', 4: 'research', 5: 'ship', 6: 'defence' };

/** @param {string} what */
const level = (what) => ({ type: 'integer', minimum: 0, maximum: 100, default: 0, description: what });

const itemList = [...IDS.keys()].map((key) => `${key} (${NAMES[key] ?? key})`).join(', ');

const inputSchema = {
    type: 'object',
    properties: {
        item: {
            type: 'string',
            description: `What to build, by key or English name. Buildings, research, ships and defence: ${itemList}.`,
        },
        fromLevel: {
            type: 'integer', minimum: 0, maximum: 100, default: 0,
            description: 'Buildings and research: the level it is at now.',
        },
        toLevel: {
            type: 'integer', minimum: 0, maximum: 100,
            description: 'Buildings and research: the level to reach. Below fromLevel demolishes a building.',
        },
        quantity: {
            type: 'integer', minimum: 1, maximum: 100_000_000,
            description: 'Ships and defence: how many to build.',
        },
        onMoon: {
            type: 'boolean', default: false,
            description: 'Build on a moon. Moon-only buildings are always built there.',
        },
        facilities: {
            type: 'object',
            description: 'Levels of the facilities that shorten the build, on the planet or moon it is built on.',
            properties: {
                roboticsFactory: level('Robotics Factory'),
                naniteFactory: level('Nanite Factory (planets only)'),
                shipyard: level('Shipyard'),
                researchLab: {
                    type: 'integer', minimum: 0, maximum: 100_000, default: 0,
                    description: 'Research Lab level - with an Intergalactic Research Network, the combined '
                        + 'level of the labs taking part.',
                },
            },
            additionalProperties: false,
        },
        universe: common.universeSchema,
        universeSpeed: { type: 'number', minimum: 1, maximum: 10, description: 'Economy speed. Default 1.' },
        researchSpeed: {
            type: 'number', minimum: 1, maximum: 100,
            description: 'Research speed - the economy speed times the universe\'s research divisor. '
                + 'Defaults to universeSpeed.',
        },
        playerClass: common.playerClassSchema,
        technocrat: { type: 'boolean', default: false, description: 'Technocrat officer: research 25% faster.' },
        discovererClassBonus: {
            type: 'number', minimum: 0, default: 0,
            description: 'Kaelesh "Discoverer Enhancement" total in percent, as the life form panel shows it.',
        },
        ionTechnology: level('Ion Technology level: makes demolition cheaper.'),
        hyperspaceTechnology: level('Hyperspace Technology level: for the cargo ships needed.'),
        lifeforms: {
            type: 'object',
            description: 'Life form reductions, in percent, for this item.',
            properties: {
                researchCostReduction: { type: 'number', minimum: 0, maximum: 50, default: 0 },
                researchTimeReduction: { type: 'number', minimum: 0, maximum: 99, default: 0 },
                mineralResearchCentre: level('Rock\'tal Mineral Research Centre level: cheaper mines and power plants.'),
                terraformerReduction: { type: 'number', minimum: 0, maximum: 50, default: 0 },
            },
            additionalProperties: false,
        },
    },
    required: ['item'],
    additionalProperties: false,
};

/**
 * The level range a request covers - from 0 to the quantity for ships and
 * defence - refusing what the game would not allow.
 * @param {any} args
 * @param {number} id
 * @param {string} kind
 * @returns {{from: number, to: number}}
 */
function buildRange(args, id, kind) {
    if (kind === 'ship' || kind === 'defence') {
        if (args.quantity === undefined) {
            throw new ToolError(`${args.item} is a ${kind}: give quantity, not levels.`);
        }
        return { from: 0, to: args.quantity };
    }
    if (args.toLevel === undefined) {
        throw new ToolError(`${args.item} is a ${kind}: give toLevel (and fromLevel when it is not 0).`);
    }
    const from = args.fromLevel;
    const to = args.toLevel;
    if (from === to) {
        throw new ToolError('fromLevel and toLevel are the same: there is nothing to build.');
    }
    if (to < from && kind !== 'building') {
        throw new ToolError('Research cannot be lowered: toLevel must be above fromLevel.');
    }
    if (to < from && (id === 33 || id === 41)) {
        throw new ToolError(`The ${NAMES[args.item]} cannot be demolished.`);
    }
    return { from, to };
}

/**
 * @param {{siteApi: ReturnType<typeof import('../lib/site-api').createSiteApi>}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createBuildCostTool({ siteApi }) {
    const calculator = new Calculator(TECH_COSTS, TECHS.labRequirements);

    /**
     * Economy and research speed: the live universe's, unless given by hand.
     * @param {any} args
     */
    async function speeds(args) {
        const live = args.universe
            ? universeSpeeds(await siteApi.serverData(common.universeRef(args.universe)))
            : null;
        const universeSpeed = args.universeSpeed ?? live?.universeSpeed ?? 1;
        return { universeSpeed, researchSpeed: args.researchSpeed ?? live?.researchSpeed ?? universeSpeed };
    }

    return {
        name: 'ogame_build_cost',
        title: 'OGame build and research cost',
        description: 'Metal, crystal, deuterium, energy, build time and points of an OGame building, research, '
            + 'ship or defence, using the formulas of the ProxyForGame costs calculator. Buildings and research '
            + 'take fromLevel/toLevel and sum every level in between; ships and defence take quantity.',
        inputSchema,
        openWorld: true,
        async run(args) {
            args.item = common.resolveKey(args.item, IDS.keys(), NAMES, 'item');
            const id = /** @type {number} */ (IDS.get(args.item));
            const tech = TECHS.techs[id];
            const kind = KIND[/** @type {keyof typeof KIND} */ (tech.type)];
            const isUnit = kind === 'ship' || kind === 'defence';
            const { from, to } = buildRange(args, id, kind);
            const onMoon = tech.type === 3 || args.onMoon;
            if (onMoon && tech.type === 2) {
                throw new ToolError(`The ${NAMES[args.item]} cannot be built on a moon.`);
            }

            const { universeSpeed, researchSpeed } = await speeds(args);
            const params = new GlobalParams();
            // No research network: research runs at the one lab given, 0 included.
            params.useIrn = false;
            params.researchLabLevel = args.facilities.researchLab;
            params.robotFactoryLevelPlanet = args.facilities.roboticsFactory;
            params.robotFactoryLevelMoon = args.facilities.roboticsFactory;
            params.naniteFactoryLevel = args.facilities.naniteFactory;
            params.shipyardLevel = args.facilities.shipyard;
            params.universeSpeed = universeSpeed;
            params.researchSpeed = researchSpeed;
            params.playerClass = common.classId(args.playerClass);
            params.technocrat = args.technocrat;
            params.discovererClassBonus = args.discovererClassBonus;
            params.ionTechLevel = args.ionTechnology;
            params.hyperTechLevel = args.hyperspaceTechnology;
            const lf = args.lifeforms ?? {};
            params.lfResCostRdcMap = { [id]: lf.researchCostReduction ?? 0 };
            params.lfResTimeRdcMap = { [id]: lf.researchTimeReduction ?? 0 };
            params.mineralResCntrLvl = lf.mineralResearchCentre ?? 0;
            params.lfTerraformerRdc = lf.terraformerReduction ?? 0;

            if (kind === 'research' && !calculator.isResearchable(id, params)) {
                throw new ToolError(`${NAMES[args.item]} needs a Research Lab of level `
                    + `${calculator.getRequiredLabLevel(id)}; facilities.researchLab is ${params.researchLabLevel}.`);
            }

            const cost = calculator.calculate(new BuildRequest(id, from, to, onMoon), params);
            const resources = cost.metal + cost.crystal + cost.deuterium;
            const transport = calculator.calculateTransportNeeded(resources, params);

            /** @type {Record<string, unknown>} */
            const result = {
                item: { key: args.item, name: NAMES[args.item] ?? args.item, kind },
                ...(isUnit ? { quantity: to } : { fromLevel: from, toLevel: to, demolition: to < from }),
                location: onMoon ? 'moon' : 'planet',
                metal: cost.metal,
                crystal: cost.crystal,
                deuterium: cost.deuterium,
                durationSeconds: Math.round(cost.time),
                duration: formatDuration(cost.time),
                points: cost.points,
                cargoShipsNeeded: { smallCargo: transport.small, largeCargo: transport.large },
                speeds: { universeSpeed, researchSpeed },
            };
            // Halving prices a build or a research; a demolition or a shipyard order has none.
            if (!isUnit && to > from) {
                result.darkMatterToHalve = Calculator.halvingCost(id, cost.time, params);
            }
            if (cost.energy > 0) {
                result.energy = cost.energy;
            }
            return result;
        },
    };
}

module.exports = { createBuildCostTool };
