'use strict';

// The calculator sources are classic browser scripts, not modules: they declare
// top-level classes and functions and rely on the page to have loaded their
// dependencies first. Rather than adding a build step or export statements, run
// them in a vm context the same way a <script> tag would, and lift the requested
// names out afterwards.
//
//   const { GravitonCalculator } = load(['ogame/calc/js/graviton-core.js'],
//                                       ['GravitonCalculator']);

const { readFileSync } = require('fs');
const { join } = require('path');
const vm = require('vm');

const WWW = join(__dirname, '..', 'www');

/**
 * @param {string[]} files Paths relative to `www/`, in load order.
 * @param {string[]} names Top-level names to return.
 * @returns {Record<string, unknown>}
 */
function load(files, names) {
    const sandbox = { console, setTimeout, clearTimeout };
    // Scripts that end with `Object.assign(window, {...})` expect a window; point
    // it at the sandbox so those assignments land among the globals too.
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    // One concatenated script, not one per file: a `class` declaration lives in its
    // script's lexical scope, so separate runs would not see each other's classes.
    const source = files.map((f) => readFileSync(join(WWW, f), 'utf8')).join('\n;\n');
    const capture = `\n;Object.assign(globalThis, { ${names.join(', ')} });\n`;

    vm.runInContext(source + capture, sandbox, { filename: files.join('+') });

    const missing = names.filter((n) => sandbox[n] === undefined);
    if (missing.length) {
        throw new Error(`not defined by ${files.join(', ')}: ${missing.join(', ')}`);
    }
    return sandbox;
}

module.exports = { load };
