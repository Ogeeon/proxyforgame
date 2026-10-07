#!/usr/bin/env node
// Stages only some of a file's changes: the added lines that contain one of the
// given substrings, plus the removed lines of any hunk that has such an added
// line (so rewording your own line stages as a replacement). Everything else in
// the working tree - typically someone else's edits to CHANGELOG.md - stays
// unstaged. `git add -p` would do this, but it is interactive.
//
//   node scripts/stage-lines.js <file> <substring>... [--dry-run]
//
// --dry-run prints the patch instead of applying it. Exits 1 when no added line
// matches, so a typo in the substring cannot pass for success.
'use strict';

const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [file, ...needles] = args.filter(a => a !== '--dry-run');
if (!file || needles.length === 0) {
    console.error('Usage: node scripts/stage-lines.js <file> <substring>... [--dry-run]');
    process.exit(2);
}

const diff = execFileSync('git', ['diff', '-U0', '--no-color', '--', file], { encoding: 'utf8' });
const lines = diff.split('\n');
const headerEnd = lines.findIndex(l => l.startsWith('@@'));
if (headerEnd < 0) {
    console.error(`No unstaged changes in ${file}`);
    process.exit(1);
}

/** @type {{ a: number, b: number, body: string[] }[]} */
const hunks = [];
for (const line of lines.slice(headerEnd)) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(line);
    if (m) {
        hunks.push({ a: Number(m[1]), b: m[2] === undefined ? 1 : Number(m[2]), body: [] });
    } else if (line !== '') {
        hunks.at(-1)?.body.push(line);
    }
}

const out = lines.slice(0, headerEnd);
let delta = 0;
let matched = 0;
for (const h of hunks) {
    const wanted = (/** @type {string} */ l) => l.startsWith('+') && needles.some(n => l.includes(n));
    if (!h.body.some(wanted)) continue;
    /** @type {string[]} */
    const kept = [];
    let prevKept = false;
    for (const l of h.body) {
        if (l.startsWith('\\')) {
            // "\ No newline at end of file" belongs to the line before it.
            if (prevKept) kept.push(l);
            continue;
        }
        prevKept = l.startsWith('-') || wanted(l);
        if (prevKept) kept.push(l);
    }
    // Every removed line of the hunk is kept, so the old side is unchanged; only
    // the added side shrinks. In a -U0 header a pure insertion names the line it
    // follows, hence the +1 on the new side.
    const newD = kept.filter(l => l.startsWith('+')).length;
    matched += newD;
    const newStart = h.a + delta + (h.b === 0 ? 1 : 0);
    out.push(`@@ -${h.a},${h.b} +${newStart},${newD} @@`, ...kept);
    delta += newD - h.b;
}

if (matched === 0) {
    console.error(`No added line in ${file} contains ${needles.map(n => JSON.stringify(n)).join(' or ')}`);
    process.exit(1);
}

const patch = out.join('\n') + '\n';
if (dryRun) {
    process.stdout.write(patch);
} else {
    execFileSync('git', ['apply', '--cached', '--unidiff-zero', '-'], { input: patch, stdio: ['pipe', 'inherit', 'inherit'] });
    console.log(`Staged ${matched} added line(s) of ${file}`);
}
