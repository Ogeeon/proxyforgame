#!/usr/bin/env node
/**
 * Prints the `make` target list by scraping `## ` comments out of the Makefile.
 *
 * This lives in a script rather than an inline `awk`/`sed` recipe because the
 * Makefile runs under cmd.exe on Windows, where neither tool exists and quoting
 * an inline one-liner portably is a losing battle. Node is already a hard
 * dependency of every other target.
 *
 * Recognised syntax:
 *   `##@ Section name`      - starts a new group
 *   `target: deps ## text`  - a documented target
 */

const fs = require('node:fs');
const path = require('node:path');

const makefile = path.join(__dirname, '..', 'Makefile');

let source;
try {
    source = fs.readFileSync(makefile, 'utf8');
} catch {
    console.error(`Cannot read ${makefile}`);
    process.exit(1);
}

/**
 * @typedef {{type: 'section', text: string}} HelpSection
 * @typedef {{type: 'target', name: string, text: string}} HelpTarget
 */

/** @type {(HelpSection|HelpTarget)[]} */
const entries = [];
for (const line of source.split(/\r?\n/)) {
    const section = /^##@(.*)$/.exec(line);
    if (section) {
        entries.push({ type: 'section', text: section[1].trim() });
        continue;
    }
    const target = /^([a-zA-Z0-9_.-]+):[^=#]*##(.*)$/.exec(line);
    if (target) {
        entries.push({ type: 'target', name: target[1], text: target[2].trim() });
    }
}

// Narrowed inside the reduce rather than by a preceding .filter(): a filter
// callback does not narrow the element type, so `e.name` would still be
// possibly-undefined afterwards.
const width = entries.reduce(
    (max, e) => (e.type === 'target' ? Math.max(max, e.name.length) : max), 0);

console.log('\nProxyForGame - available make targets\n');
for (const entry of entries) {
    if (entry.type === 'section') {
        console.log(`${entry.text}`);
    } else {
        console.log(`  ${entry.name.padEnd(width)}  ${entry.text}`);
    }
}
console.log('\nVariables: PHP, PFG_BASE_URL, PORT, PW_REPORTER, PW_DEPS,');
console.log('           DB_HOST/DB_USER/DB_PASS/DB_NAME');
console.log('Examples:  make test-one spec=flight');
console.log('           make test-e2e PFG_BASE_URL=http://pfg.wmp\n');
