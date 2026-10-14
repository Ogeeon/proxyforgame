'use strict';

// The calculator sources are classic browser scripts, not modules: they declare
// top-level classes and functions and rely on the page to have loaded their
// dependencies first. Rather than adding a build step or export statements, run
// them in a vm context the same way a <script> tag would, and lift the requested
// names out afterwards.
//
// Two readers: the node:test suite (through unit-tests/load.js) and the MCP
// server, which computes with exactly the files the site serves.
//
//   const { GravitonCalculator } = loadBrowserScripts(['ogame/calc/js/graviton-core.js'],
//                                                     ['GravitonCalculator']);

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const WWW = join(__dirname, '..', '..', 'www');

/**
 * @param {string[]} files Paths relative to `www/`, in load order.
 * @param {string[]} names Top-level names to return.
 * @returns {Record<string, any>} The lifted globals. `any` on purpose: the
 *   values are classes and functions from untyped browser scripts, and
 *   `unknown` would make every `new Calculator()` and `helper()` in the callers
 *   an error with nothing gained.
 */
function loadBrowserScripts(files, names) {
    /** @type {Record<string, any>} */
    const sandbox = { console, setTimeout, clearTimeout };
    // Scripts that end with `Object.assign(window, {...})` expect a window; point
    // it at the sandbox so those assignments land among the globals too.
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    // One concatenated script, not one per file: a `class` declaration lives in its
    // script's lexical scope, so separate runs would not see each other's classes.
    const source = files.map((f) => readFileSync(join(WWW, f), 'utf8')).join('\n;\n');
    const capture = `\n;Object.assign(globalThis, { ${names.join(', ')} });\n`;

    // The source is files from this repository's own www/, named by the caller
    // in code - never anything from a request - so there is nothing to inject.
    vm.runInContext(source + capture, sandbox, { filename: files.join('+') }); // NOSONAR(S1523)

    const missing = names.filter((n) => sandbox[n] === undefined);
    if (missing.length) {
        throw new Error(`not defined by ${files.join(', ')}: ${missing.join(', ')}`);
    }
    return sandbox;
}

/**
 * A JSON file under `www/`, parsed.
 * @param {string} file Path relative to `www/`.
 * @returns {any}
 */
function readWwwJson(file) {
    return JSON.parse(readFileSync(join(WWW, file), 'utf8'));
}

module.exports = { loadBrowserScripts, readWwwJson, WWW };
