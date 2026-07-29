#!/usr/bin/env node
// @ts-check

/**
 * Runs tsc over every TypeScript project: the shared browser files, one project
 * per calculator (tsconfig/), and the Node-side code. Each is a separate
 * invocation because the browser projects must not share a global scope - see
 * scripts/generate-tsconfigs.js.
 *
 * Prints the diagnostics of whichever projects failed and exits non-zero if any
 * did, rather than stopping at the first one.
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

const failed = [];
for (const project of projects) {
  try {
    execFileSync(process.execPath, [TSC, '--noEmit', '-p', project], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`.trimEnd();
    failed.push({ project, output });
  }
}

if (failed.length) {
  for (const { project, output } of failed) {
    console.error(`\n=== ${project} ===`);
    console.error(output);
  }
  console.error(`\n${failed.length} of ${projects.length} projects failed.`);
  process.exit(1);
}

console.log(`All ${projects.length} TypeScript projects are clean.`);
