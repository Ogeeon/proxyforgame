'use strict';

// The tools the server offers, in the order tools/list presents them: one per
// calculator, three for the moon calculator's three panels.

const { createBuildCostTool } = require('./build-cost');
const { createLifeformCostTool } = require('./lifeform-cost');
const { createBuildQueueTool } = require('./build-queue');
const { createProductionTool } = require('./production');
const { createFlightTool } = require('./flight');
const { createExpeditionTool } = require('./expedition');
const { createMoonTools } = require('./moon');
const { createGravitonTool } = require('./graviton');
const { createTerraformerTool } = require('./terraformer');
const { createTradeTool } = require('./trade');

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool[]}
 */
function createTools(deps) {
    return [
        createFlightTool(deps),
        createBuildCostTool(deps),
        createLifeformCostTool(deps),
        createBuildQueueTool(deps),
        createProductionTool(deps),
        createExpeditionTool(deps),
        ...createMoonTools(deps),
        createGravitonTool(deps),
        createTerraformerTool(deps),
        createTradeTool(),
    ];
}

module.exports = { createTools };
