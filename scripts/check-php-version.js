#!/usr/bin/env node

/**
 * Warns when the local PHP does not match .php-version.
 *
 * .php-version holds production's PHP major.minor and is the single source of
 * truth (docs/adr/0001-php-version-alignment.md). Local dev is authoritative
 * only for the Node suite, lint and typecheck; anything PHP-shaped - including
 * `make html-validate` inside `make check` - runs against whatever PHP resolves
 * here, so a mismatch is worth surfacing.
 *
 * This is advisory: it prints a warning and always exits 0. The forcing
 * function against real drift is deploy/watchdog.sh, which checks the live
 * hosts. A contributor without the pinned build can still run `make check`.
 *
 * The PHP binary comes from PFG_PHP (make sets it), and defaults to `php`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(REPO_ROOT, '.php-version');

let want;
try {
    want = fs.readFileSync(VERSION_FILE, 'utf8').trim();
} catch {
    console.warn(`warn: could not read ${VERSION_FILE}`);
    process.exit(0);
}
const php = process.env.PFG_PHP || 'php';

const result = spawnSync(
    php,
    ['-r', 'echo PHP_MAJOR_VERSION, ".", PHP_MINOR_VERSION;'],
    { encoding: 'utf8' }
);

if (result.error || result.status !== 0) {
    console.warn(`warn: could not run "${php}" to check its version against .php-version (${want})`);
    process.exit(0);
}

const have = result.stdout.trim();
if (have !== want) {
    console.warn(`warn: local PHP is ${have}, but .php-version pins ${want} (production's version).`);
    console.warn('      `make check` still runs; see docs/adr/0001-php-version-alignment.md.');
}

process.exit(0);
