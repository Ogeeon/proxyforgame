#!/usr/bin/env node
// Lists the tools pinned in mise.toml that are behind their latest release.
// Dependabot does not read mise.toml, so nothing else notices: the monthly
// tool-updates workflow turns this output into an issue.
//
// Compares each pin with `mise latest` directly. `mise outdated` is not used:
// it only looks at installed versions and reports nothing for a pin that is
// not installed, which would read as "all up to date".
//
// Prints a Markdown table when something is behind and nothing otherwise.
// Exits non-zero only when a lookup fails, so a network problem is not
// mistaken for "no updates".
//
// Usage: node scripts/check-tool-updates.js

'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/**
 * @param {string[]} args
 * @returns {string}
 */
function mise(args) {
  return execFileSync('mise', args, { encoding: 'utf8' }).trim(); // NOSONAR(S4036) - a dev/CI tool resolved from the caller PATH
}

function main() {
  const repoToml = path.resolve(__dirname, '..', 'mise.toml');
  /** @type {Record<string, {requested_version?: string, source?: {path?: string}}[]>} */
  const current = JSON.parse(mise(['ls', '--current', '--json']));

  const behind = [];
  for (const [tool, entries] of Object.entries(current)) {
    for (const entry of entries) {
      const source = entry.source?.path;
      if (!source || path.resolve(source) !== repoToml || !entry.requested_version) continue;
      const latest = mise(['latest', tool]);
      if (!latest) throw new Error(`check-tool-updates: no latest version found for ${tool}`);
      if (latest !== entry.requested_version) {
        behind.push({ tool, pinned: entry.requested_version, latest });
      }
    }
  }

  if (behind.length === 0) return;
  console.log('| Tool | Pinned | Latest |');
  console.log('|------|--------|--------|');
  for (const { tool, pinned, latest } of behind) {
    console.log(`| \`${tool}\` | ${pinned} | ${latest} |`);
  }
}

main();
