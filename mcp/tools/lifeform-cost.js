'use strict';

// Cost, time and points of a life form building or research - the LF costs
// calculator, from its own lfcosts-core.js and ogame-lifeform.js, priced from
// the table both pages read (www/ogame/calc/data/lf-techs.json).

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const { formatDuration } = require('../lib/format');
const common = require('./common');

const { LfCalculator, getHalvingCost } = loadBrowserScripts(
    ['ogame/calc/js/ogame-costs.js', 'ogame/calc/js/ogame-lifeform.js', 'ogame/calc/js/lfcosts-core.js'],
    ['LfCalculator', 'getHalvingCost'],
);

/** @type {Record<string, any[]>} id => [key, type 1 building / 2 research, ...the cost columns] */
const LF_TECHS = readWwwJson('ogame/calc/data/lf-techs.json');
const NAMES = common.englishNames('lfcosts');

/** @type {Map<string, number>} item key → tech id */
const IDS = new Map(Object.entries(LF_TECHS).map(([id, row]) => [row[0], Number(id)]));

/** The cost table lfcosts.tpl hands the page: id → every column after the key and type. */
const TECH_COSTS = Object.fromEntries(Object.entries(LF_TECHS).map(([id, row]) => [id, row.slice(2)]));

const RACES = { humans: 1, rocktal: 2, mechas: 3, kaelesh: 4 };

// Grouped by race, so the race is named once rather than with every item.
const itemList = Object.entries(RACES).map(([race, n]) => `${race}: ` + [...IDS.entries()]
    .filter(([, id]) => Math.floor(id / 1000) === n)
    .map(([key]) => `${key} (${NAMES[key] ?? key})`).join(', ')).join('; ');

const inputSchema = {
    type: 'object',
    properties: {
        item: { type: 'string', description: `Life form building or research, by key or English name. ${itemList}.` },
        fromLevel: { type: 'integer', minimum: 0, maximum: 200, default: 0, description: 'Level now.' },
        toLevel: { type: 'integer', minimum: 0, maximum: 200, description: 'Level to reach. Below fromLevel demolishes a building.' },
        planetRace: {
            type: 'string', enum: Object.keys(RACES),
            description: 'Life form of the planet. Its buildings give the reductions below. Defaults to the item\'s own race.',
        },
        lifeforms: common.lifeformsSchema(['megalith', 'mineralResearchCentre', 'researchBuilding',
            'researchCostReduction', 'researchTimeReduction'], ['small-cargo', 'large-cargo']),
        roboticsFactory: common.level('Robotics Factory level'),
        naniteFactory: common.level('Nanite Factory level'),
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        ionTechnology: common.level('Ion Technology level: cheaper demolition', 50),
        hyperspaceTechnology: common.level('Hyperspace Technology level: for the cargo ships needed', 50),
        playerClass: common.playerClassSchema,
    },
    required: ['item', 'toLevel'],
    additionalProperties: false,
};

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createLifeformCostTool({ siteApi }) {
    const calc = new LfCalculator(TECH_COSTS);
    return {
        name: 'ogame_lifeform_cost',
        title: 'OGame life form building and research cost',
        description: 'Metal, crystal, deuterium, energy, time and points of an OGame life form building or research '
            + 'between two levels, with the Megalith, Mineral Research Centre and research building reductions. '
            + 'Uses the ProxyForGame LF costs calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            args.item = common.resolveKey(args.item, IDS.keys(), NAMES, 'item');
            const id = /** @type {number} */ (IDS.get(args.item));
            const isBuilding = LF_TECHS[id][1] === 1;
            const from = args.fromLevel;
            const to = args.toLevel;
            if (from === to) {
                throw new ToolError('fromLevel and toLevel are the same: there is nothing to build.');
            }
            if (to < from && !isBuilding) {
                throw new ToolError('Research cannot be lowered: toLevel must be above fromLevel.');
            }

            const race = args.planetRace ? RACES[/** @type {keyof typeof RACES} */ (args.planetRace)] : Math.floor(id / 1000);
            const lf = args.lifeforms;
            const params = {
                race,
                megalithLvl: lf.megalith,
                mineralResCntrLvl: lf.mineralResearchCentre,
                // Only the planet race's own research building counts; the core picks it by race.
                resCentreLvl: lf.researchBuilding,
                runeTechLvl: lf.researchBuilding,
                rbtResCentreLvl: lf.researchBuilding,
                vortexChamberLvl: lf.researchBuilding,
                researchCostReduction: lf.researchCostReduction,
                researchTimeReduction: lf.researchTimeReduction,
                robotFactoryLevel: args.roboticsFactory,
                naniteFactoryLevel: args.naniteFactory,
                universeSpeed: await common.economySpeed(args, siteApi),
                ionTechLevel: args.ionTechnology,
                hyperTechLevel: args.hyperspaceTechnology,
                playerClass: common.classId(args.playerClass),
                capIncrSC: common.shipCargoBonus(lf, 'small-cargo'),
                capIncrLC: common.shipCargoBonus(lf, 'large-cargo'),
            };

            // The same reductions the page applies: research cost from the race's
            // research building and technologies, building cost from the Megalith
            // and the Mineral Research Centre; ion technology only on a demolition.
            const rsrCostRdc = calc.computeRsrCostRdc(params);
            const bldCostRdc = calc.computeBldCostRdc(id, race, params.megalithLvl, params.mineralResCntrLvl);
            const ion = to > from ? 0 : params.ionTechLevel;
            const r = calc.calculate(id, from, to, ion, rsrCostRdc, bldCostRdc, params);
            const ships = calc.calculateShipCount(r.metal + r.crystal + r.deut, params);

            /** @type {Record<string, unknown>} */
            const result = {
                item: { key: args.item, name: NAMES[args.item] ?? args.item, kind: isBuilding ? 'building' : 'research' },
                fromLevel: from,
                toLevel: to,
                demolition: to < from,
                metal: r.metal,
                crystal: r.crystal,
                deuterium: r.deut,
                energy: r.energy,
                durationSeconds: Math.round(r.time),
                duration: formatDuration(r.time),
                points: r.points,
                cargoShipsNeeded: { smallCargo: ships.needSC, largeCargo: ships.needLC },
                reductions: { researchCostPercent: rsrCostRdc, buildingCostPercent: Math.round(bldCostRdc * 10000) / 100 },
                universeSpeed: params.universeSpeed,
            };
            // The page prices halving for a single level only.
            if (to === from + 1) {
                result.darkMatterToHalve = getHalvingCost(id, r.time);
            }
            return result;
        },
    };
}

module.exports = { createLifeformCostTool };
