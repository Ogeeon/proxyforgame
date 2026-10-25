'use strict';

// Runs browser scripts from www/ in a vm context and lifts their globals out.
// The loader itself lives with the MCP server (mcp/lib/browser-scripts.js),
// which computes with the same files; the tests keep their short name for it.
//
//   const { GravitonCalculator } = load(['ogame/calc/js/graviton-core.js'],
//                                       ['GravitonCalculator']);

const { loadBrowserScripts } = require('../mcp/lib/browser-scripts');

module.exports = { load: loadBrowserScripts };
