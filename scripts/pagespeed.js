#!/usr/bin/env node

/**
 * Measures the live site with the PageSpeed Insights API and prints the median
 * of several Lighthouse runs per page, so a performance change can be judged
 * against numbers rather than one noisy run.
 *
 * Every page is fetched from Google's servers, not from this machine: what is
 * measured is the public site as a first-time visitor gets it. A single PSI run
 * swings by several points, which is why each page/strategy pair is run --runs
 * times and every metric is reduced to its own median.
 *
 * PSI caches its answer per URL: asking for the same address again within a
 * minute or so returns the previous run unchanged, fetchTime and all, and the
 * median would be one run counted three times. Every request therefore gets a
 * query parameter of its own (_psi=...) that the site ignores.
 *
 * The origin's field data (CrUX - real Chrome users over a rolling 28 days) is
 * printed once at the end. It lags any change by up to four weeks.
 *
 * The key comes from PSI_API_KEY in the environment or in .env. Without one
 * the API falls back to a shared quota that answers 429 most of the day. The
 * key is never printed - not even inside an error message, which is why no
 * request URL is ever logged.
 *
 * Run:
 *   node scripts/pagespeed.js                          # all pages, mobile + desktop, 3 runs
 *   node scripts/pagespeed.js --pages flight,costs --strategy mobile --runs 5
 *   node scripts/pagespeed.js --out before.json        # keep the medians for later
 *   node scripts/pagespeed.js --compare before.json    # show the change against them
 *   node scripts/pagespeed.js --base https://proxyforgame.net --lang ru
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** The home page plus every calculator, in the order the sidebar lists them. */
const ALL_PAGES = [
  'home', 'costs', 'expeditions', 'flight', 'graviton', 'lfcosts',
  'moon', 'production', 'queue', 'terraformer', 'trade',
];
const STRATEGIES = ['mobile', 'desktop'];

/**
 * The Lighthouse audits reported, with how to show each one. `digits` applies
 * to the value after `scale`.
 * @type {{ key: string, audit: string, label: string, scale: number, unit: string, digits: number }[]}
 */
const METRICS = [
  { key: 'fcp', audit: 'first-contentful-paint', label: 'FCP', scale: 0.001, unit: 's', digits: 1 },
  { key: 'lcp', audit: 'largest-contentful-paint', label: 'LCP', scale: 0.001, unit: 's', digits: 1 },
  { key: 'tbt', audit: 'total-blocking-time', label: 'TBT', scale: 1, unit: 'ms', digits: 0 },
  { key: 'cls', audit: 'cumulative-layout-shift', label: 'CLS', scale: 1, unit: '', digits: 2 },
  { key: 'si', audit: 'speed-index', label: 'SI', scale: 0.001, unit: 's', digits: 1 },
];

/* -------------------------------------------------------------- environment */

/**
 * Reads KEY=VALUE pairs out of .env. The file is CRLF on the machine that
 * maintains it. Same reader as scripts/read-mail.js.
 * @returns {Record<string, string>}
 */
function loadEnv() {
  /** @type {Record<string, string>} */
  const env = {};
  let text;
  try {
    text = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return env;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/* -------------------------------------------------------------------- args */

const USAGE = `Usage: node scripts/pagespeed.js [options]

  --pages a,b,c      pages to measure (default: all). One of:
                     ${ALL_PAGES.join(', ')}
  --strategy s       mobile, desktop or both (default: both)
  --runs n           Lighthouse runs per page and strategy (default: 3)
  --concurrency n    requests in flight at once (default: 4)
  --base url         site to measure (default: https://proxyforgame.com)
  --lang xx          language prefix of every URL (default: en)
  --out file         also write the medians to a JSON file
  --compare file     show each median's change against an earlier --out file
  --json             print the medians as JSON instead of tables

Key: PSI_API_KEY in the environment or in .env.`;

/**
 * @typedef {object} Options
 * @property {string[]} pages
 * @property {string[]} strategies
 * @property {number} runs
 * @property {number} concurrency
 * @property {string} base
 * @property {string} lang
 * @property {string|null} out
 * @property {string|null} compare
 * @property {boolean} json
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
  /** @type {Options} */
  const opts = {
    pages: ALL_PAGES,
    strategies: STRATEGIES,
    runs: 3,
    concurrency: 4,
    base: 'https://proxyforgame.com',
    lang: 'en',
    out: null,
    compare: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`${arg} needs a value`);
      return value;
    };
    switch (arg) {
      case '--pages': {
        const pages = next().split(',').map((p) => p.trim()).filter(Boolean);
        const unknown = pages.filter((p) => !ALL_PAGES.includes(p));
        if (unknown.length > 0) fail(`unknown page: ${unknown.join(', ')}`);
        opts.pages = pages;
        break;
      }
      case '--strategy': {
        const value = next();
        if (value === 'both') opts.strategies = STRATEGIES;
        else if (STRATEGIES.includes(value)) opts.strategies = [value];
        else fail(`--strategy must be mobile, desktop or both, not ${value}`);
        break;
      }
      case '--runs': opts.runs = positiveInt(arg, next()); break;
      case '--concurrency': opts.concurrency = positiveInt(arg, next()); break;
      case '--base': opts.base = trimSlashes(next()); break;
      case '--lang': opts.lang = next(); break;
      case '--out': opts.out = next(); break;
      case '--compare': opts.compare = next(); break;
      case '--json': opts.json = true; break;
      case '--help': case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        fail(`unknown option ${arg}\n\n${USAGE}`);
    }
  }
  return opts;
}

/**
 * Drops trailing slashes, so the page paths can be appended with one.
 * @param {string} url
 * @returns {string}
 */
function trimSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

/**
 * @param {string} name
 * @param {string} value
 * @returns {number}
 */
function positiveInt(name, value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) fail(`${name} must be a positive integer`);
  return n;
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/* --------------------------------------------------------------------- api */

/**
 * The address measured for one run; `tag` makes it unique so PSI cannot hand
 * back a cached result (see the header).
 * @param {Options} opts
 * @param {string} page
 * @param {string} tag
 * @returns {string}
 */
function pageUrl(opts, page, tag) {
  const pagePath = page === 'home' ? '' : page;
  return `${opts.base}/${opts.lang}/${pagePath}?_psi=${tag}`;
}

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One PSI run. Retries what is worth retrying - a 429 from the per-100-second
 * quota and the 500s Lighthouse returns when a run times out on Google's side.
 * @param {string} url
 * @param {string} strategy
 * @param {string} key
 * @returns {Promise<any>}
 */
async function runPagespeed(url, strategy, key) {
  const query = new URLSearchParams({ url, strategy, category: 'performance', key });
  const attempts = 4;
  for (let attempt = 1; ; attempt++) {
    let status = 0;
    let message = '';
    try {
      const res = await fetch(`${API}?${query}`, { signal: AbortSignal.timeout(120_000) });
      const body = /** @type {any} */ (await res.json());
      if (res.ok) return body;
      status = res.status;
      message = body?.error?.message ?? res.statusText;
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt === attempts) {
      throw new Error(`${strategy} ${url}: ${status || 'network'} ${message}`);
    }
    await sleep(5000 * attempt);
  }
}

/**
 * Pulls the numbers this script reports out of one PSI response.
 * @param {any} body
 * @returns {Record<string, number>}
 */
function extractLab(body) {
  const lh = body.lighthouseResult;
  /** @type {Record<string, number>} */
  const values = { score: Math.round(lh.categories.performance.score * 100) };
  for (const m of METRICS) values[m.key] = lh.audits[m.audit].numericValue;
  return values;
}

/**
 * Runs `tasks` with at most `limit` of them in flight.
 * @template T
 * @param {(() => Promise<T>)[]} tasks
 * @param {number} limit
 * @returns {Promise<T[]>}
 */
async function pool(tasks, limit) {
  /** @type {T[]} */
  const results = new Array(tasks.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------ report */

/**
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @typedef {object} PageResult
 * @property {number} runs   how many runs succeeded
 * @property {Record<string, number>} median
 * @property {number} scoreMin
 * @property {number} scoreMax
 */

/**
 * @param {number} value
 * @param {{ scale: number, unit: string, digits: number }} m
 * @returns {string}
 */
function formatMetric(value, m) {
  const text = (value * m.scale).toFixed(m.digits);
  return m.unit ? `${text} ${m.unit}` : text;
}

/**
 * The change against an earlier run, signed, in the metric's own unit.
 * @param {number} value
 * @param {number|undefined} before
 * @param {{ scale: number, digits: number }} m
 * @returns {string}
 */
function formatDelta(value, before, m) {
  if (before === undefined) return '';
  const delta = (value - before) * m.scale;
  const text = delta.toFixed(m.digits);
  if (Number(text) === 0) return ' (=)';
  return ` (${delta > 0 ? '+' : ''}${text})`;
}

/**
 * @param {string[][]} rows
 * @returns {string}
 */
function table(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  return rows
    .map((r) => r.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]))).join('  '))
    .join('\n');
}

/**
 * @param {Record<string, Record<string, PageResult>>} results  strategy -> page -> result
 * @param {Record<string, Record<string, PageResult>>|null} before
 * @param {Options} opts
 */
function printTables(results, before, opts) {
  const SCORE = { scale: 1, digits: 0 };
  for (const strategy of opts.strategies) {
    /** @type {string[][]} */
    const rows = [['page', 'score', 'range', ...METRICS.map((m) => m.label)]];
    for (const page of opts.pages) {
      const r = results[strategy]?.[page];
      if (!r) {
        rows.push([page, 'failed', '', ...METRICS.map(() => '')]);
        continue;
      }
      const prev = before?.[strategy]?.[page]?.median;
      const runsNote = r.runs < opts.runs ? ` [${r.runs}/${opts.runs}]` : '';
      rows.push([
        page + runsNote,
        String(r.median.score) + formatDelta(r.median.score, prev?.score, SCORE),
        `${r.scoreMin}-${r.scoreMax}`,
        ...METRICS.map((m) => formatMetric(r.median[m.key], m) + formatDelta(r.median[m.key], prev?.[m.key], m)),
      ]);
    }
    console.log(`\n${strategy} - median of ${opts.runs} run${opts.runs === 1 ? '' : 's'}`);
    console.log(table(rows));
  }
}

/**
 * CrUX for the whole origin: the 75th percentile of each metric and the
 * category Google puts it in. PSI reports CLS multiplied by 100.
 * @param {any} field
 */
function printField(field) {
  if (!field?.metrics) {
    console.log('\nfield data (CrUX): none - not enough traffic in the last 28 days');
    return;
  }
  /** @type {Record<string, [string, (p: number) => string]>} */
  const names = {
    LARGEST_CONTENTFUL_PAINT_MS: ['LCP', (p) => `${p} ms`],
    INTERACTION_TO_NEXT_PAINT: ['INP', (p) => `${p} ms`],
    CUMULATIVE_LAYOUT_SHIFT_SCORE: ['CLS', (p) => (p / 100).toFixed(2)],
    FIRST_CONTENTFUL_PAINT_MS: ['FCP', (p) => `${p} ms`],
    EXPERIMENTAL_TIME_TO_FIRST_BYTE: ['TTFB', (p) => `${p} ms`],
  };
  /** @type {string[][]} */
  const rows = [['metric', 'p75', 'category']];
  for (const [id, [label, format]] of Object.entries(names)) {
    const metric = field.metrics[id];
    if (metric) rows.push([label, format(metric.percentile), metric.category]);
  }
  console.log(`\nfield data (CrUX), origin ${field.id}, rolling 28 days:`);
  console.log(table(rows));
}

/* -------------------------------------------------------------------- main */

/**
 * `table[a][b]`, created first if it is missing.
 * @template T
 * @param {Record<string, Record<string, T>>} table
 * @param {string} a
 * @param {string} b
 * @param {() => T} create
 * @returns {T}
 */
function entry(table, a, b, create) {
  if (!table[a]) table[a] = {};
  if (!(b in table[a])) table[a][b] = create();
  return table[a][b];
}

/**
 * The results of an earlier --out run, or null without --compare.
 * @param {string|null} file
 * @returns {Record<string, Record<string, PageResult>>|null}
 */
function readBaseline(file) {
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).results;
  } catch (err) {
    fail(`cannot read ${file}: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * One job per run, strategy and page. Runs come outermost, so the repeats of
 * one page are spread out rather than fired back to back.
 * @param {Options} opts
 * @returns {{ strategy: string, page: string, tag: string }[]}
 */
function buildJobs(opts) {
  const jobs = [];
  const stamp = Date.now().toString(36);
  for (let run = 0; run < opts.runs; run++) {
    for (const strategy of opts.strategies) {
      for (const page of opts.pages) jobs.push({ strategy, page, tag: `${stamp}${run}` });
    }
  }
  return jobs;
}

/**
 * Runs every job against PSI and collects the lab numbers of each run, the
 * origin's field data and the runs that failed.
 * @param {Options} opts
 * @param {string} key
 */
async function measure(opts, key) {
  const jobs = buildJobs(opts);
  /** @type {Record<string, Record<string, Record<string, number>[]>>} */
  const samples = {};
  /** @type {any} */
  let field = null;
  /** @type {string[]} */
  const failures = [];
  const showProgress = !opts.json && process.stderr.isTTY;
  let done = 0;
  const progress = (/** @type {string} */ note) => {
    if (showProgress) process.stderr.write(`\r${done}/${jobs.length} ${note}`.padEnd(60));
  };
  progress('');
  await pool(jobs.map(({ strategy, page, tag }) => async () => {
    try {
      const body = await runPagespeed(pageUrl(opts, page, tag), strategy, key);
      entry(samples, strategy, page, () => []).push(extractLab(body));
      field ??= body.originLoadingExperience;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
    done++;
    progress(`${strategy} ${page}`);
  }), opts.concurrency);
  if (showProgress) process.stderr.write('\r'.padEnd(61) + '\r');
  return { samples, field, failures };
}

/**
 * Reduces the runs of every page to the median of each metric.
 * @param {Record<string, Record<string, Record<string, number>[]>>} samples
 * @returns {Record<string, Record<string, PageResult>>}
 */
function summarize(samples) {
  /** @type {Record<string, Record<string, PageResult>>} */
  const results = {};
  const keys = ['score', ...METRICS.map((m) => m.key)];
  for (const [strategy, pages] of Object.entries(samples)) {
    for (const [page, runs] of Object.entries(pages)) {
      /** @type {Record<string, number>} */
      const med = {};
      for (const k of keys) med[k] = median(runs.map((r) => r[k]));
      const scores = runs.map((r) => r.score);
      entry(results, strategy, page, () => ({
        runs: runs.length,
        median: med,
        scoreMin: Math.min(...scores),
        scoreMax: Math.max(...scores),
      }));
    }
  }
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const key = process.env.PSI_API_KEY || loadEnv().PSI_API_KEY;
  if (!key) fail('PSI_API_KEY is not set. Add it to .env - see .env.example.');
  const before = readBaseline(opts.compare);

  const { samples, field, failures } = await measure(opts, key);
  const results = summarize(samples);

  const report = {
    date: new Date().toISOString(),
    base: opts.base,
    lang: opts.lang,
    runs: opts.runs,
    results,
    field,
  };
  if (opts.out) fs.writeFileSync(opts.out, `${JSON.stringify(report, null, 2)}\n`);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTables(results, before, opts);
    printField(field);
    if (opts.out) console.log(`\nmedians written to ${opts.out}`);
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} run(s) failed:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exitCode = 1;
  }
}

// A promise chain rather than top-level await (Sonar S7785): this is a
// CommonJS module, where top-level await is a syntax error.
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
