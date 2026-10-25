'use strict';

// The Terraformer's energy demand and what building it costs, satellites
// included - the terraformer calculator, computed by its own terraformer-core.js.

const { loadBrowserScripts } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const { formatDuration } = require('../lib/format');
const common = require('./common');

const { TerraformerCalculator } = loadBrowserScripts(
    ['js/utils.js', 'ogame/calc/js/ogame-costs.js', 'ogame/calc/js/terraformer-core.js'],
    ['TerraformerCalculator'],
);

const inputSchema = {
    type: 'object',
    properties: {
        fromLevel: { type: 'integer', minimum: 0, maximum: 100, default: 0, description: 'Terraformer level now.' },
        toLevel: { type: 'integer', minimum: 1, maximum: 100, description: 'Terraformer level to reach.' },
        ...common.energySchema,
        lifeforms: common.lifeformsSchema([...common.ENERGY_LIFEFORMS, 'terraformerReduction'], common.ENERGY_SHIPS),
        facilities: common.facilitiesSchema(['roboticsFactory', 'shipyard', 'naniteFactory']),
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        crystalAvailable: { type: 'integer', minimum: 0, default: 0, description: 'Crystal already on the planet.' },
        deuteriumAvailable: { type: 'integer', minimum: 0, default: 0, description: 'Deuterium already on the planet.' },
    },
    required: ['toLevel'],
    additionalProperties: false,
};

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createTerraformerTool({ siteApi }) {
    const calc = new TerraformerCalculator();
    return {
        name: 'ogame_terraformer',
        title: 'OGame Terraformer cost and energy',
        description: 'What raising the Terraformer from one level to another costs, the fields it adds, the energy '
            + 'its target level needs and how many solar satellites cover what the planet lacks - with their '
            + 'cost, build times and the transports to bring it all. Uses the ProxyForGame terraformer calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            if (args.toLevel <= args.fromLevel) {
                throw new ToolError('toLevel must be above fromLevel: the Terraformer cannot be demolished.');
            }
            const universeSpeed = await common.economySpeed(args, siteApi);
            const r = calc.compute({
                ...common.energyParams(args),
                robotsFactoryLevel: args.facilities.roboticsFactory,
                shipyardLevel: args.facilities.shipyard,
                nanitesFactoryLevel: args.facilities.naniteFactory,
                lfTerraformerRdc: args.lifeforms.terraformerReduction,
                universeSpeed,
                tfSingleLevel: false,
                tfLevelFrom: args.fromLevel,
                tfLevelTo: args.toLevel,
                crysAvailable: args.crystalAvailable,
                deutAvailable: args.deuteriumAvailable,
            });

            /** @type {Record<string, unknown>} */
            const result = {
                fromLevel: args.fromLevel,
                toLevel: args.toLevel,
                fieldsAdded: r.addedFields,
                energyRequired: r.energyRequirement,
                energyAvailable: common.energyBreakdown(r),
                energyMissing: Math.max(0, r.energyRequirement - r.availableEnergy),
                universeSpeed,
            };
            if (!r.feasible) {
                result.note = 'Solar satellites produce no energy here (the planet is too cold or they run at 0%), '
                    + 'so no number of them closes the gap.';
                return result;
            }
            return {
                ...result,
                terraformer: { crystal: r.crysTF, deuterium: r.deutTF, buildSeconds: r.secsTF, buildTime: formatDuration(r.secsTF) },
                satellites: {
                    count: r.neededSats,
                    crystal: r.crysSS,
                    deuterium: r.deutSS,
                    buildSeconds: r.secsSS,
                    buildTime: formatDuration(r.secsSS),
                },
                total: { crystal: r.crysTotal, deuterium: r.deutTotal },
                toDeliver: { crystal: r.crysToDeliver, deuterium: r.deutToDeliver },
                transportsNeeded: { smallCargo: r.scNeeded, largeCargo: r.lcNeeded },
            };
        },
    };
}

module.exports = { createTerraformerTool };
