'use strict';

// How many solar satellites a planet needs to research Graviton Technology -
// the graviton calculator, computed by its own graviton-core.js.

const { loadBrowserScripts } = require('../lib/browser-scripts');
const { formatDuration } = require('../lib/format');
const common = require('./common');

const { GravitonCalculator } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/graviton-core.js'],
    ['GravitonCalculator'],
);

const inputSchema = {
    type: 'object',
    properties: {
        gravitonLevel: { type: 'integer', minimum: 1, maximum: 10, default: 1, description: 'Graviton Technology level to research.' },
        ...common.energySchema,
        shipyard: common.level('Shipyard level: satellite build time'),
        naniteFactory: common.level('Nanite Factory level: satellite build time'),
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        ...common.debrisSchema,
        crystalAvailable: { type: 'integer', minimum: 0, default: 0, description: 'Crystal already on the planet.' },
        deuteriumAvailable: { type: 'integer', minimum: 0, default: 0, description: 'Deuterium already on the planet.' },
    },
    additionalProperties: false,
};

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createGravitonTool({ siteApi }) {
    const calc = new GravitonCalculator();
    return {
        name: 'ogame_graviton',
        title: 'OGame Graviton Technology energy',
        description: 'The energy Graviton Technology needs against what a planet produces, and how many solar '
            + 'satellites close the gap: their cost, build time, the transports to bring the resources and the '
            + 'debris they leave if shot down. Uses the ProxyForGame graviton calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            const universeSpeed = await common.economySpeed(args, siteApi);
            const debris = await common.debrisSettings(args, siteApi);
            const r = calc.compute({
                ...common.energyParams(args),
                shipyardLevel: args.shipyard,
                nanitesFactoryLevel: args.naniteFactory,
                universeSpeed,
                gravitonLevel: args.gravitonLevel,
                debrisPercent: debris.debrisPercent,
                deutInDebris: debris.deuteriumInDebris,
                crysAvailable: args.crystalAvailable,
                deutAvailable: args.deuteriumAvailable,
            });

            /** @type {Record<string, unknown>} */
            const result = {
                gravitonLevel: args.gravitonLevel,
                energyRequired: r.energyRequirement,
                energyAvailable: common.energyBreakdown(r),
                energyMissing: Math.max(0, r.energyRequirement - r.availableEnergy),
                energyPerNewSatellite: r.energyPerSat,
                universeSpeed,
            };
            if (!r.feasible) {
                result.note = 'Solar satellites produce no energy here (the planet is too cold or they run at 0%), '
                    + 'so no number of them closes the gap.';
                return result;
            }
            return {
                ...result,
                satellitesNeeded: r.neededSats,
                cost: { crystal: r.crysNeeded, deuterium: r.deutNeeded },
                toDeliver: { crystal: r.crysToDeliver, deuterium: r.deutToDeliver },
                transportsNeeded: { smallCargo: r.scNeeded, largeCargo: r.lcNeeded },
                buildSeconds: r.secsTotal,
                buildTime: formatDuration(r.secsTotal),
                ifShotDown: {
                    debrisPercent: debris.debrisPercent,
                    debris: { crystal: r.dfCrystal, deuterium: r.dfDeuterium, total: r.dfAmount },
                    recyclersNeeded: r.rcNeeded,
                    netCost: { crystal: r.netCrysNeeded, deuterium: r.netDeutNeeded },
                },
            };
        },
    };
}

module.exports = { createGravitonTool };
