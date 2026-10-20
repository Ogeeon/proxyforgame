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
        location: {
            type: 'string', enum: ['planet', 'moon'], default: 'planet',
            description: 'Where it is built. Moon-only buildings are always built on the moon.',
        },
        facilities: common.facilitiesSchema(['roboticsFactory', 'naniteFactory', 'shipyard', 'researchLab']),
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        researchSpeed: {
            type: 'number', minimum: 1, maximum: 100,
            description: 'Research speed - the economy speed times the universe\'s research divisor. '
                + 'Defaults to universeSpeed.',
        },
        playerClass: common.playerClassSchema,
        officers: { ...common.officersSchema, description: 'Officers hired. The Technocrat: research 25% faster.' },
        ionTechnology: common.ionTechnologySchema,
        hyperspaceTechnology: common.hyperspaceTechnologySchema,
        lifeforms: common.lifeformsSchema(['itemCostReduction', 'itemTimeReduction', 'mineralResearchCentre',
            'terraformerReduction', 'discovererClassBonus']),
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
        const universeSpeed = await common.economySpeed(args, siteApi);
        if (args.researchSpeed !== undefined) {
            return { universeSpeed, researchSpeed: args.researchSpeed };
        }
        // The live universe's own research speed, its divisor included; the site API caches the read.
        const live = args.universe
            ? universeSpeeds(await siteApi.serverData(common.universeRef(args.universe)))
            : null;
        return { universeSpeed, researchSpeed: live?.researchSpeed ?? universeSpeed };
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
            const onMoon = tech.type === 3 || args.location === 'moon';
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
            Object.assign(params, args.officers);
            params.ionTechLevel = args.ionTechnology;
            params.hyperTechLevel = args.hyperspaceTechnology;
            const lf = args.lifeforms;
            params.discovererClassBonus = lf.discovererClassBonus;
            // The costs page keys these by research; the tool's reductions are the requested item's.
            params.lfResCostRdcMap = { [id]: lf.itemCostReduction };
            params.lfResTimeRdcMap = { [id]: lf.itemTimeReduction };
            params.mineralResCntrLvl = lf.mineralResearchCentre;
            params.lfTerraformerRdc = lf.terraformerReduction;

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
