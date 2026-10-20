'use strict';

// Hourly production of one planet - the production calculator's one-planet
// tab, computed by its own production-core.js and ogame-production.js.
//
// production-core.js reads its settings from the page-wide `options` object
// production.tpl declares, not from arguments. The tool builds that object in
// the scripts' sandbox right before each call: calls are synchronous, so no
// other call can see it half-built.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const common = require('./common');

const scope = loadBrowserScripts(
    ['ogame/calc/js/ogame-production.js', 'ogame/calc/js/production-core.js'],
    ['calculateProduction', 'lfBuildingEffects', 'maxCrawlers', 'LF_BUILDINGS_PER_RACE'],
);
const { calculateProduction, lfBuildingEffects, maxCrawlers } = scope;

/** @type {Record<string, any[]>} */
const LF_TECHS = readWwwJson('ogame/calc/data/lf-techs.json');
const NAMES = common.englishNames('lfcosts');

// The first two buildings of every race neither produce nor draw energy, so
// the page leaves them out; the tool takes the same ten.
const FIRST_PRODUCTION_BUILDING = 3;

/** id => [base energy, growth], as production.php hands it to the page. */
const LF_ENERGY = Object.fromEntries(Object.entries(LF_TECHS)
    .filter(([id, row]) => row[1] === 1 && Number(id) % 1000 >= FIRST_PRODUCTION_BUILDING)
    .map(([id, row]) => [id, [row[5], row[10]]]));
const LF_BONUS = readWwwJson('ogame/calc/data/lf-building-bonuses.json');

/** Keys of the life form buildings the tool takes, with their race and position. */
const LF_BUILDINGS = Object.keys(LF_ENERGY).map((id) => ({
    key: LF_TECHS[id][0], race: Math.floor(Number(id) / 1000), position: Number(id) % 1000,
}));

/** The rows production.tpl maps its table onto: what tech each one is. */
const ROWS_TO_TECHS = [1, 2, 3, 4, 12, 212, 218, 0, 0, 0, 0, 0, 0, 0];

const mine = (/** @type {string} */ what) => ({
    type: 'object',
    properties: {
        level: common.level(`${what} level`),
        percent: { type: 'integer', minimum: 0, maximum: 100, default: 100, description: 'Production setting, %.' },
        boosterPercent: { type: 'integer', enum: [0, 10, 20, 30, 40], default: 0, description: 'Resource booster item, %.' },
    },
    additionalProperties: false,
});

const inputSchema = {
    type: 'object',
    properties: {
        maxTemperature: common.maxTemperatureSchema,
        position: { type: 'integer', minimum: 1, maximum: 15, default: 8, description: 'Planet position, 1-15: crystal favours the inner slots, metal the middle ones.' },
        metalMine: mine('Metal Mine'),
        crystalMine: mine('Crystal Mine'),
        deuteriumSynthesizer: mine('Deuterium Synthesizer'),
        solarPlant: common.solarPlantSchema,
        fusionReactor: common.fusionReactorSchema,
        solarSatellites: common.solarSatellitesSchema,
        crawlers: {
            type: 'object',
            properties: {
                count: { type: 'integer', minimum: 0, default: 0 },
                percent: {
                    type: 'integer', minimum: 0, maximum: 150, default: 100,
                    description: 'Production setting, %. Above 100 overloads them: more output, double the energy.',
                },
            },
            additionalProperties: false,
        },
        energyBoosterPercent: { type: 'integer', enum: [0, 20, 40, 60, 80], default: 0, description: 'Energy booster item, %.' },
        energyTechnology: common.level('Energy Technology level', 50),
        plasmaTechnology: common.level('Plasma Technology level', 50),
        officers: common.officersSchema,
        playerClass: common.playerClassSchema,
        allianceClass: { ...common.allianceClassSchema, description: 'trader: +5% production and energy.' },
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        lifeforms: common.lifeformsSchema(
            ['metalBonus', 'crystalBonus', 'deuteriumBonus', 'energyBonus', 'crawlerBonus', 'collectorClassBonus'], [], {
                buildings: common.keyedMap(LF_BUILDINGS.map((b) => b.key), { type: 'integer', minimum: 0, maximum: 200 },
                    'Levels of the life form buildings on the planet - one race\'s only. '
                    + LF_BUILDINGS.map((b) => `${b.key}: ${NAMES[b.key] ?? b.key}`).join(', ') + '.'),
            }),
    },
    additionalProperties: false,
};

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createProductionTool({ siteApi }) {
    return {
        name: 'ogame_production',
        title: 'OGame planet production',
        description: 'Hourly and daily metal, crystal and deuterium production of one OGame planet, its energy '
            + 'balance and where every part of the output comes from: mines, crawlers, plasma, officers, class, '
            + 'boosters, life form research and buildings. Uses the ProxyForGame production calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            const universeSpeed = await common.economySpeed(args, siteApi);

            // The life form buildings, as the positional array the core expects.
            const lf = args.lifeforms;
            const given = LF_BUILDINGS.filter((b) => (lf.buildings?.[b.key] ?? 0) > 0);
            const races = new Set(given.map((b) => b.race));
            if (races.size > 1) {
                throw new ToolError('lifeforms.buildings mixes races: a planet carries the buildings of one life form only.');
            }
            const race = races.size ? [...races][0] : 0;
            const levels = new Array(scope.LF_BUILDINGS_PER_RACE).fill(0);
            for (const b of given) {
                levels[b.position - 1] = lf.buildings[b.key];
            }

            // The core finds the commanding staff bonus itself, from all five flags set.
            const { geologist, engineer, technocrat, admiral, commander } = args.officers;
            const crawlerCap = maxCrawlers(args.metalMine.level, args.crystalMine.level, args.deuteriumSynthesizer.level, geologist);
            const crawlers = Math.min(args.crawlers.count, crawlerCap);

            scope.options = {
                rowsToTechs: ROWS_TO_TECHS,
                lfEnergy: LF_ENERGY,
                lfBonus: LF_BONUS,
                prm: {
                    energyTechLevel: args.energyTechnology,
                    plasmaTechLevel: args.plasmaTechnology,
                    universeSpeed,
                    geologist,
                    engineer,
                    technocrat,
                    admiral,
                    commander,
                    playerClass: common.classId(args.playerClass),
                    isTrader: args.allianceClass === 'trader',
                    lfMetProdBonus: lf.metalBonus,
                    lfCrysProdBonus: lf.crystalBonus,
                    lfDeutProdBonus: lf.deuteriumBonus,
                    lfEnergyProdBonus: lf.energyBonus,
                    lfCrawlerBonus: lf.crawlerBonus,
                    lfCollectorBonus: lf.collectorClassBonus,
                },
            };

            const rows = [
                [args.metalMine.level, args.metalMine.percent, args.metalMine.boosterPercent / 10],
                [args.crystalMine.level, args.crystalMine.percent, args.crystalMine.boosterPercent / 10],
                [args.deuteriumSynthesizer.level, args.deuteriumSynthesizer.percent, args.deuteriumSynthesizer.boosterPercent / 10],
                [args.solarPlant.level, args.solarPlant.percent, 0],
                [args.fusionReactor.level, args.fusionReactor.percent, 0],
                [args.solarSatellites.count, args.solarSatellites.percent, 0],
                [crawlers, args.crawlers.percent, 0],
            ];
            const planet = [args.maxTemperature, args.position, args.energyBoosterPercent / 10];
            const lfEff = lfBuildingEffects(race, levels);
            const [results, perHour, energyProduced, energyUsed, factor, lfBld] =
                calculateProduction(rows, planet, false, lfEff);

            const row = (/** @type {number} */ i) => ({ metal: results[i][0], crystal: results[i][1], deuterium: results[i][2] });
            const lfBuildings = { metal: 0, crystal: 0, deuterium: 0 };
            for (const b of lfBld) {
                lfBuildings.metal += b[0];
                lfBuildings.crystal += b[1];
                lfBuildings.deuterium += b[2];
            }
            const hourly = { metal: perHour[0], crystal: perHour[1], deuterium: perHour[2] };

            /** @type {Record<string, unknown>} */
            const result = {
                perHour: hourly,
                perDay: { metal: hourly.metal * 24, crystal: hourly.crystal * 24, deuterium: hourly.deuterium * 24 },
                energy: { produced: energyProduced, used: energyUsed, balance: energyProduced - energyUsed },
                productionFactor: Math.round(factor * 10000) / 10000,
                breakdownPerHour: {
                    natural: row(0),
                    mines: { metal: results[1][0], crystal: results[2][1], deuterium: results[3][2] },
                    fusionReactorConsumption: { metal: 0, crystal: 0, deuterium: results[5][2] },
                    crawlers: row(7),
                    plasmaTechnology: row(8),
                    boosters: row(9),
                    geologist: row(10),
                    engineer: row(11),
                    commandingStaff: row(12),
                    playerClass: row(13),
                    allianceClass: row(14),
                    lifeformResearch: row(15),
                    lifeformBuildings: lfBuildings,
                },
                universeSpeed,
            };
            if (args.crawlers.count > crawlerCap) {
                result.note = `Only ${crawlerCap} crawlers can work on these mines (8 per mine level, 8.8 with a `
                    + `Geologist); the count was capped from ${args.crawlers.count}.`;
            }
            return result;
        },
    };
}

module.exports = { createProductionTool };
