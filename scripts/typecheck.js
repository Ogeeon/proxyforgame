#!/usr/bin/env node

/**
 * Runs tsc over every TypeScript project: the shared browser files, one project
 * per calculator (tsconfig/), and the Node-side code. Each is a separate
 * invocation because the browser projects must not share a global scope - see
 * scripts/generate-tsconfigs.js.
 *
 * Prints the diagnostics of whichever projects failed and exits non-zero if any
 * did, rather than stopping at the first one.
 *
 * Run: node scripts/typecheck.js [--strict-null]
 *   --strict-null  add --strictNullChecks on top of every project. A CLI flag
 *                  overrides the tsconfig, so measuring the not-yet-enabled
 *                  setting needs no second set of config files. Advisory while
 *                  .claude/plans/strict-null-checks.md is in progress; the flag
 *                  goes away once the setting moves into tsconfig.base.json.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// The tsc entry point rather than node_modules/.bin: the shim there is a .cmd
// on Windows, which execFileSync cannot spawn without a shell.
const TSC = require.resolve('typescript/bin/tsc');

const projects = [
  'tsconfig.json',
  ...fs.readdirSync(path.join(ROOT, 'tsconfig')).sort().map((f) => `tsconfig/${f}`),
  'tsconfig.node.json',
];

const strictNull = process.argv.includes('--strict-null');
const extraFlags = strictNull ? ['--strictNullChecks'] : [];

const failed = [];
for (const project of projects) {
  try {
    execFileSync(process.execPath, [TSC, '--noEmit', ...extraFlags, '-p', project], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`.trimEnd();
    failed.push({ project, output });
  }
}

/**
 * Every shared file sits in all ten calculator projects, so a diagnostic in one
 * is reported ten times. Counting distinct diagnostic lines is what makes the
 * number comparable between runs.
 * @param {{output: string}[]} results
 */
function summarise(results) {
  const lines = new Set();
  for (const { output } of results) {
    for (const line of output.split('\n')) {
      if (/error TS\d+/.test(line)) lines.add(line.trim());
    }
  }
  /** @type {Map<string, number>} */
  const perFile = new Map();
  for (const line of lines) {
    const file = line.split('(')[0];
    perFile.set(file, (perFile.get(file) || 0) + 1);
  }
  console.error(`\n${lines.size} distinct errors in ${perFile.size} files:`);
  for (const [file, count] of [...perFile].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(4)}  ${file}`);
  }
}

if (failed.length) {
  for (const { project, output } of failed) {
    console.error(`\n=== ${project} ===`);
    console.error(output);
  }
  if (strictNull) summarise(failed);
  console.error(`\n${failed.length} of ${projects.length} projects failed.`);
  process.exit(1);
}

console.log(`All ${projects.length} TypeScript projects are clean.`);
