'use strict';

// The tools the server offers, in the order tools/list presents them.

const { createFlightTool } = require('./flight');
const { createBuildCostTool } = require('./build-cost');

/**
 * @param {{siteApi: ReturnType<typeof import('../lib/site-api').createSiteApi>}} deps
 * @returns {import('../lib/protocol').Tool[]}
 */
function createTools(deps) {
    return [createFlightTool(deps), createBuildCostTool(deps)];
}

module.exports = { createTools };
