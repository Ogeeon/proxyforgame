#!/usr/bin/env node

/**
 * HTML Validator for ProxyForGame.
 *
 * Renders every page in every locale through scripts/render-page.php and runs
 * the Nu Html Checker (vnu-jar) over the result. Strict gate: any `error`,
 * `warning` or `info` message fails the run.
 *
 * Usage:
 *   node scripts/validate-html.js                 # all pages, all locales
 *   node scripts/validate-html.js --lang en       # single locale
 *   node scripts/validate-html.js --page flight   # single page
 *   node scripts/validate-html.js --page flight --lang en
 *   node scripts/validate-html.js --render-only   # render, skip the vnu pass
 *
 * The PHP binary comes from the PFG_PHP environment variable (make sets it),
 * and defaults to `php`. Java must be on PATH.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const WWW_ROOT = path.join(REPO_ROOT, 'www');
const CHECK_DIR = path.join(REPO_ROOT, '.html-check');
const RENDER_SCRIPT = path.join(__dirname, 'render-page.php');
const VNU_JAR = path.join(REPO_ROOT, 'node_modules', 'vnu-jar', 'build', 'dist', 'vnu.jar');

const PAGES = [
    'index',
    'policy',
    'costs',
    'expeditions',
    'flight',
    'graviton',
    'lfcosts',
    'moon',
    'production',
    'queue',
    'terraformer',
    'trade'
];

// policy.php is static markup; render it once under `en` rather than once per
// locale (13 identical copies would only slow the run down).
const SINGLE_LOCALE_PAGES = new Set(['policy']);

const PHP = process.env.PFG_PHP || 'php';
const CONCURRENCY = 4;

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

const colorize = (text, color) => `${color}${text}${colors.reset}`;

function parseArgs() {
    const args = process.argv.slice(2);
    const pick = (flag) => {
        const i = args.indexOf(flag);
        return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
    };
    return {
        lang: pick('--lang'),
        page: pick('--page'),
        renderOnly: args.includes('--render-only')
    };
}

function getLocales() {
    return fs.readdirSync(path.join(WWW_ROOT, 'locale'))
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
}

function listCombos({ lang, page }) {
    const locales = getLocales();
    const combos = [];
    for (const pg of PAGES) {
        if (page && pg !== page) continue;
        const langs = SINGLE_LOCALE_PAGES.has(pg) ? ['en'] : locales;
        for (const lg of langs) {
            if (lang && lg !== lang) continue;
            combos.push({ page: pg, lang: lg });
        }
    }
    return combos;
}

/**
 * Renders a single page/lang pair into .html-check/<lang>/<page>.html
 * @returns {Promise<void>}
 */
function render({ page, lang }) {
    return new Promise((resolve, reject) => {
        const dir = path.join(CHECK_DIR, lang);
        fs.mkdirSync(dir, { recursive: true });
        const out = fs.openSync(path.join(dir, `${page}.html`), 'w');
        const child = spawn(PHP, [RENDER_SCRIPT, page, lang], {
            cwd: REPO_ROOT,
            stdio: ['ignore', out, 'pipe']
        });
        let err = '';
        // Piped by the stdio triple above; the optional call is for the type,
        // which does not know that.
        child.stderr?.on('data', (chunk) => { err += chunk; });
        child.on('error', (error) => { fs.closeSync(out); reject(error); });
        child.on('close', (code) => {
            fs.closeSync(out);
            if (code === 0) resolve();
            else reject(new Error(`render-page.php ${page} ${lang} exited ${code}: ${err.trim()}`));
        });
    });
}

async function renderAll(combos) {
    const queue = [...combos];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
            await render(queue.shift());
        }
    });
    await Promise.all(workers);
}

/** One vnu run over the whole .html-check/ tree; returns parsed JSON messages. */
function runVnu() {
    const jar = path.resolve(VNU_JAR);
    if (!fs.existsSync(jar)) {
        console.error(colorize(`vnu.jar not found at ${jar} - run \`make install\` first`, colors.red));
        process.exit(1);
    }
    const result = spawnSync('java', ['-jar', jar, '--format', 'json', '--exit-zero-always', '.html-check/'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    if (result.error) {
        console.error(colorize(`Failed to run java: ${result.error.message}`, colors.red));
        process.exit(1);
    }
    // vnu writes its JSON report to stdout on some platforms and to stderr on
    // others; parse whichever stream carries it.
    for (const stream of [result.stdout, result.stderr]) {
        if (!stream?.trim()) continue;
        try {
            return JSON.parse(stream);
        } catch {
            // not the report stream; fall through
        }
    }
    console.error(colorize('vnu produced no parseable JSON output', colors.red));
    process.exit(1);
}

/** Group messages by rendered file. */
function groupMessages(messages) {
    /** @type {Map<string, Array<object>>} */
    const byFile = new Map();
    for (const msg of messages) {
        const url = msg.url || '(unknown)';
        const key = url.startsWith('file:') ? url.replace(/^file:\/\/?/, '') : url;
        const rel = key.startsWith(REPO_ROOT) ? key.slice(REPO_ROOT.length).replace(/^[/\\]/, '') : key;
        const forFile = byFile.get(rel);
        if (forFile) forFile.push(msg);
        else byFile.set(rel, [msg]);
    }
    return { byFile };
}

function printReport(byFile) {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    console.log('\n' + colorize('═══════════════════════════════════════════════', colors.blue));
    console.log(colorize('              HTML Validation Report', colors.blue));
    console.log(colorize('═══════════════════════════════════════════════', colors.blue));

    for (const [file, messages] of byFile.entries()) {
        console.log(`\n${colorize(file, colors.yellow)} (${messages.length})`);
        for (const msg of messages) {
            const line = msg.lastLine ?? 0;
            const col = msg.lastColumn ?? 0;
            if (msg.type === 'error') {
                errorCount += 1;
                console.log(colorize(`  [error]   ${line}:${col} ${msg.message}`, colors.red));
            } else if (msg.type === 'warning') {
                warningCount += 1;
                console.log(colorize(`  [warning] ${line}:${col} ${msg.message}`, colors.yellow));
            } else {
                infoCount += 1;
                console.log(colorize(`  [info]    ${line}:${col} ${msg.message}`, colors.gray));
            }
        }
    }

    console.log('\n' + colorize('───────────────────────────────────────────────', colors.blue));
    console.log(`Total: ${colorize(String(errorCount), colors.red)} errors, ` +
        `${colorize(String(warningCount), colors.yellow)} warnings, ` +
        `${colorize(String(infoCount), colors.gray)} info`);
    return errorCount === 0 && warningCount === 0 && infoCount === 0;
}

function main() {
    const { lang, page, renderOnly } = parseArgs();
    const combos = listCombos({ lang, page });
    if (combos.length === 0) {
        console.error(colorize(`No page/lang combos to validate (--page ${page}, --lang ${lang})`, colors.red));
        process.exit(1);
    }

    fs.rmSync(CHECK_DIR, { recursive: true, force: true });
    fs.mkdirSync(CHECK_DIR, { recursive: true });

    console.log(`Rendering ${combos.length} page/lang pairs (PHP: ${PHP}, concurrency ${CONCURRENCY})...`);
    renderAll(combos)
        .then(() => {
            if (renderOnly) {
                console.log(colorize(`\nRendered ${combos.length} page/lang pairs into ${CHECK_DIR}`, colors.green));
                return;
            }
            console.log('Running vnu over .html-check/...');
            const parsed = runVnu();
            const { byFile } = groupMessages(parsed.messages || []);
            const clean = printReport(byFile);
            if (!clean) {
                console.error(colorize('\nRun make html-audit for the same report.', colors.gray));
                process.exit(1);
            }
            console.log(colorize('\n✓ No HTML errors, warnings or info messages.', colors.green));
        })
        .catch((error) => {
            console.error(colorize(`\nRender failed: ${error.message}`, colors.red));
            process.exit(1);
        });
}

if (require.main === module) {
    main();
}

module.exports = { PAGES, listCombos };
