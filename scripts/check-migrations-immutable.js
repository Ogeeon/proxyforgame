#!/usr/bin/env node
// Fails when a change edits, renames or deletes a migration that already
// exists on the base: db/migrations/*.sql files are applied once per host and
// recorded in schema_migrations, so an edit never reaches a database that ran
// the old text. A fix is a new migration (db/migrations/README.md).
//
// The base is the first argument, else $MIGRATIONS_BASE, else origin/main. CI
// passes the commit before the push (or the pull request's base); on a push to
// main, origin/main is HEAD and the check would otherwise see nothing.
// Uncommitted changes count too, so the check fails before the commit.
//
// Usage: node scripts/check-migrations-immutable.js [base]

'use strict';

const { execFileSync } = require('node:child_process');

const ZERO_SHA = /^0+$/;

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** @returns {string} */
function resolveBase() {
  const candidates = [process.argv[2], process.env.MIGRATIONS_BASE, 'origin/main'];
  for (const candidate of candidates) {
    if (!candidate || ZERO_SHA.test(candidate)) continue;
    try {
      git(['rev-parse', '--verify', '--quiet', candidate + '^{commit}']);
      return candidate;
    } catch {
      console.error(`check-migrations: base ${candidate} is not a known commit, trying the next`);
    }
  }
  throw new Error('check-migrations: no base commit to compare against');
}

function main() {
  const base = resolveBase();
  const mergeBase = git(['merge-base', base, 'HEAD']);
  // Against the working tree, not HEAD: an uncommitted edit fails as well.
  const out = git(['diff', '--name-status', '--find-renames', mergeBase, '--', 'db/migrations/*.sql']);
  const touched = out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .filter(([status]) => !status.startsWith('A'));

  if (touched.length === 0) {
    console.log(`check-migrations: no existing migration changed since ${base}`);
    return;
  }
  console.error(`check-migrations: these migrations already exist on ${base} and must not change:`);
  for (const [status, ...paths] of touched) {
    console.error(`  ${status}\t${paths.join(' -> ')}`);
  }
  console.error('Add a new db/migrations/NNNN_*.sql instead (db/migrations/README.md).');
  process.exitCode = 1;
}

main();
