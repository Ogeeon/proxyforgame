#!/usr/bin/env node

/**
 * Documentation generator for the calculator pages.
 *
 * What a page is made of is read from its .tpl: the `<script>` and `<link>`
 * tags are the only place that knows, and they are what scripts/generate-tsconfigs.js
 * reads as well. Nothing here assumes a naming scheme, because none holds any
 * more - `lfcosts` ships no stylesheet of its own and loads `costs_bs.css`,
 * `trade` still keeps its page code in one `trade.js` rather than in the
 * collector/renderer/orchestration trio, and `costs` persists no cookie at all.
 *
 * Run: node scripts/generate-docs.js [calculator-name]
 * Example: node scripts/generate-docs.js
 *          node scripts/generate-docs.js graviton
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CALC_DIR = path.join(ROOT, 'www', 'ogame', 'calc');
const DOCS_DIR = path.join(ROOT, 'docs', 'calculators');
const LOCALE_PATH = path.join(ROOT, 'www', 'locale', 'en.json');

// ANSI color codes. Console only - none of these may reach a generated file.
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

/**
 * The calculator pages: a template with a controller of the same name beside
 * it. That leaves out the `h_*` fragments and `lf-techdata.inc.php`, which is
 * data for lfcosts rather than a page.
 *
 * @returns {string[]}
 */
function getCalculators() {
  return fs.readdirSync(CALC_DIR)
    .filter((file) => file.endsWith('.tpl'))
    .map((file) => path.basename(file, '.tpl'))
    .filter((name) => fs.existsSync(path.join(CALC_DIR, `${name}.php`)))
    .sort();
}

/**
 * The repo-relative assets a template loads. Only site-absolute `/...` paths
 * match, which leaves out the Bootstrap that comes from the CDN.
 *
 * @param {string} tpl
 * @returns {{scripts: string[], styles: string[]}}
 */
function assetsOf(tpl) {
  return {
    scripts: [...tpl.matchAll(/src="\/([^"?]+\.js)/g)].map((m) => `www/${m[1]}`),
    styles: [...tpl.matchAll(/href="\/([^"?]+\.css)/g)].map((m) => `www/${m[1]}`)
  };
}

/**
 * Splits the scripts into the calculator's own modules and the shared ones.
 *
 * @param {string} calcName
 * @param {string[]} scripts
 * @returns {{own: string[], shared: string[]}}
 */
function splitScripts(calcName, scripts) {
  /** @type {string[]} */
  const own = [];
  /** @type {string[]} */
  const shared = [];
  for (const file of scripts) {
    const base = path.basename(file);
    if (base === `${calcName}.js` || base.startsWith(`${calcName}-`)) own.push(file);
    else shared.push(file);
  }
  return { own, shared };
}

/**
 * Collapses every nested `{...}` to `{}`, innermost first, so only the keys of
 * the outermost block are left standing at the start of a line.
 *
 * @param {string} block
 * @returns {string}
 */
function flattenNested(block) {
  let flat = block;
  let previous;
  do {
    previous = flat;
    flat = flat.replaceAll(/\{[^{}]*\}/g, '{}');
  } while (flat !== previous);
  return flat;
}

// The persisted settings sit under `prm` in nine calculators; `trade` has never
// been split that way and keeps them at the top level of its `options`. Try the
// narrower one first, or flight's outer object would answer for its own `prm`.
const SETTINGS_BLOCKS = [
  /\bprm:\s*\{/,
  /^[ \t]*(?:const|let|var) options\s*=\s*\{/m
];

/**
 * The keys declared directly inside the first block `opening` matches.
 *
 * The block is sliced by counting braces, because a regex ending at `}` stops
 * at the first nested object instead of at the end of the block. Keys are then
 * matched at the start of a line, which keeps the `HH:mm` inside a value like
 * `datetimeFormat: 'dd.MM.yyyy HH:mm'` from reading as one.
 *
 * @param {string} source
 * @param {RegExp} opening
 * @returns {string[]}
 */
function blockKeys(source, opening) {
  const start = opening.exec(source);
  if (!start) return [];

  const from = start.index + start[0].length;
  let depth = 1;
  let end = from;
  while (end < source.length && depth > 0) {
    if (source[end] === '{') depth++;
    else if (source[end] === '}') depth--;
    if (depth > 0) end++;
  }

  const block = flattenNested(source.slice(from, end));
  return [...block.matchAll(/^[ \t]*(\w{1,64})\s*:/gm)].map((m) => m[1]);
}

/**
 * The settings block lives in the orchestrator for most calculators, in
 * `trade.js` for trade, and in the template's own inline script for
 * `production` and `queue`.
 *
 * @param {string[]} sources
 * @returns {string[]}
 */
function optionsOf(sources) {
  for (const source of sources) {
    for (const opening of SETTINGS_BLOCKS) {
      const keys = blockKeys(source, opening);
      if (keys.length > 0) return keys;
    }
  }
  return [];
}

/**
 * The cookie the page reads and writes, if it keeps one.
 *
 * @param {string[]} sources
 * @returns {string|null}
 */
function cookieOf(sources) {
  for (const source of sources) {
    const match = /(?:save|load)(?:To|From)Cookie\('(options_\w+)'/.exec(source);
    if (match) return match[1];
  }
  return null;
}

/**
 * @param {string} relative
 * @returns {string}
 */
function readRepoFile(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

/**
 * @typedef {object} CalculatorInfo
 * @property {string} name
 * @property {string} url
 * @property {string} translationKey
 * @property {{file: string, lines: number}[]} modules
 * @property {string[]} shared
 * @property {string[]} styles
 * @property {string[]} options
 * @property {string|null} cookie
 * @property {boolean} hasTest
 * @property {string|null} unitTest
 */

/**
 * @param {string} calcName
 * @returns {CalculatorInfo}
 */
function extractCalculatorInfo(calcName) {
  const tpl = readRepoFile(`www/ogame/calc/${calcName}.tpl`);
  const { scripts, styles } = assetsOf(tpl);
  const { own, shared } = splitScripts(calcName, scripts);
  const sources = [...own.map(readRepoFile), tpl];

  const phpPath = path.join(CALC_DIR, `${calcName}.php`);
  const php = fs.existsSync(phpPath) ? fs.readFileSync(phpPath, 'utf8') : '';
  const key = /Intl::getTranslations\(\$lang,\s*['"]([^'"]+)['"]\)/.exec(php);

  const unitTest = `unit-tests/${calcName}-core.test.js`;
  return {
    name: calcName,
    url: `/ogame/calc/${calcName}.php`,
    translationKey: key ? key[1] : calcName,
    modules: own.map((file) => ({ file, lines: readRepoFile(file).split('\n').length })),
    shared,
    styles: styles.filter((file) => file.startsWith('www/ogame/calc/css/')),
    options: optionsOf(sources),
    cookie: cookieOf(sources),
    hasTest: fs.existsSync(path.join(ROOT, 'playwright-tests', 'tests', `${calcName}.spec.js`)),
    unitTest: fs.existsSync(path.join(ROOT, unitTest)) ? unitTest : null
  };
}

/**
 * Title, description and keywords, from the English locale.
 *
 * @param {string} translationKey
 * @returns {{title: string, description: string, keywords: string}}
 */
function getTranslations(translationKey) {
  if (!fs.existsSync(LOCALE_PATH)) {
    return { title: translationKey, description: '', keywords: '' };
  }

  const data = JSON.parse(fs.readFileSync(LOCALE_PATH, 'utf8'));
  const entry = data[translationKey];
  if (!entry) return { title: translationKey, description: '', keywords: '' };

  return {
    title: entry.title || translationKey,
    description: entry.description || '',
    keywords: entry.keywords || ''
  };
}

/**
 * @param {CalculatorInfo} info
 * @returns {string[]}
 */
function technicalDetails(info) {
  const stylesheets = info.styles.length > 0
    ? info.styles.map((file) => `\`${file}\``).join(', ')
    : 'none of its own';
  const rows = [
    ['PHP controller', `\`www/ogame/calc/${info.name}.php\``],
    ['Template', `\`www/ogame/calc/${info.name}.tpl\``],
    ['Stylesheet', stylesheets],
    ['Options cookie', info.cookie ? `\`${info.cookie}\`` : 'none'],
    ['E2E test', info.hasTest ? `✅ \`playwright-tests/tests/${info.name}.spec.js\`` : '❌ none'],
    ['Unit test', info.unitTest ? `✅ \`${info.unitTest}\`` : '❌ none']
  ];

  return [
    `## Technical Details`,
    '',
    `| Property | Value |`,
    `|----------|-------|`,
    ...rows.map(([property, value]) => `| ${property} | ${value} |`),
    '',
  ];
}

/**
 * @param {CalculatorInfo} info
 * @returns {string[]}
 */
function modulesSection(info) {
  const lines = [
    `## JavaScript Modules`,
    '',
    `| File | Lines |`,
    `|------|-------|`,
    ...info.modules.map((module) => `| \`${module.file}\` | ${module.lines} |`),
    '',
  ];

  if (info.shared.length > 0) {
    lines.push(
      `The page also loads these shared scripts:`,
      '',
      ...info.shared.map((file) => `- \`${file}\``),
      '',
    );
  }
  return lines;
}

/**
 * @param {CalculatorInfo} info
 * @returns {string[]}
 */
function optionsSection(info) {
  if (info.options.length === 0) return [];

  const where = info.cookie
    ? `The calculator keeps these settings in \`${info.cookie}\`:`
    : `The calculator holds these settings for the session:`;
  return [
    `## Configuration Options`,
    '',
    where,
    '',
    ...info.options.map((option) => `- \`${option}\``),
    '',
  ];
}

/**
 * @param {CalculatorInfo} info
 * @returns {string[]}
 */
function developmentNotes(info) {
  const testing = info.hasTest
    ? ['Run tests:', '```bash', `make test-one spec=${info.name}`, '```']
    : ['No end-to-end test covers this page yet.'];
  const unit = info.unitTest
    ? ['', 'Unit tests:', '```bash', `node --test ${path.basename(info.unitTest)}`, '```',
      '', '(from `unit-tests/`)']
    : [];

  return [
    `## Development Notes`,
    '',
    `### Testing`,
    '',
    ...testing,
    ...unit,
    '',
    `### Translation`,
    '',
    `Translation key: \`${info.translationKey}\``,
    `Translation files: \`www/locale/*.json\``,
    '',
    '---',
    '',
    `*Documentation generated automatically by scripts/generate-docs.js*`,
    '',
  ];
}

/**
 * Generate documentation for a calculator.
 *
 * @param {string} calcName
 * @returns {string}
 */
function generateCalculatorDocs(calcName) {
  const info = extractCalculatorInfo(calcName);
  const translations = getTranslations(info.translationKey);
  const displayName = translations.title || calcName;

  const docs = [
    `# ${displayName}`,
    '',
    `**URL:** \`http://pfg.wmp${info.url}\``,
    '',
  ];

  if (translations.description) {
    docs.push(`## Description`, '', translations.description, '');
  }
  if (translations.keywords) {
    docs.push(`**Keywords:** ${translations.keywords}`, '');
  }

  docs.push(
    ...technicalDetails(info),
    ...modulesSection(info),
    ...optionsSection(info),

    `## Usage`,
    '',
    `1. Navigate to [${displayName}](http://pfg.wmp${info.url})`,
    `2. Configure input parameters`,
    `3. View calculated results`,
    '',

    ...developmentNotes(info),
  );

  return docs.join('\n');
}

/**
 * Generate index of all calculators.
 *
 * @param {string[]} calculators
 * @returns {string}
 */
function generateIndex(calculators) {
  const lines = [
    '# ProxyForGame Calculators',
    '',
    'This directory contains documentation for all OGame calculators.',
    '',
    'Generated by `scripts/generate-docs.js` - run `make docs` rather than editing by hand.',
    '',
    '## Available Calculators',
    '',
  ];

  for (const calc of calculators) {
    const info = extractCalculatorInfo(calc);
    const translations = getTranslations(info.translationKey);
    const title = translations.title || calc;

    lines.push(`### [${title}](${calc}.md)`, '');
    if (translations.description) {
      lines.push(translations.description, '');
    }
    lines.push(`**View:** [${title}](http://pfg.wmp${info.url})`, '');
  }

  return lines.join('\n');
}

/**
 * @param {string} calc
 */
function writeDocs(calc) {
  const outputPath = path.join(DOCS_DIR, `${calc}.md`);
  fs.writeFileSync(outputPath, generateCalculatorDocs(calc), 'utf8');
  return outputPath;
}

function main() {
  const args = process.argv.slice(2);
  const specificCalc = args[0] ? args[0].toLowerCase().replace('.php', '') : null;

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Documentation Generator', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  fs.mkdirSync(DOCS_DIR, { recursive: true });

  if (specificCalc) {
    console.log(colorize(`\nGenerating documentation for: ${specificCalc}`, colors.gray));
    console.log(colorize(`✓ Created: ${writeDocs(specificCalc)}`, colors.green));
  } else {
    const calculators = getCalculators();
    console.log(colorize(`\nFound ${calculators.length} calculators`, colors.gray));

    for (const calc of calculators) {
      writeDocs(calc);
      console.log(colorize(`  ✓ ${calc}.md`, colors.green));
    }

    fs.writeFileSync(path.join(DOCS_DIR, 'README.md'), generateIndex(calculators), 'utf8');
    console.log(colorize(`  ✓ README.md`, colors.green));
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
  console.log(colorize(`\n✓ Documentation complete!`, colors.green));
  console.log(colorize(`\nDocs location: ${DOCS_DIR}`, colors.gray));
  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateCalculatorDocs, generateIndex, getCalculators };
