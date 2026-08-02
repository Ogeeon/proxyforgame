#!/usr/bin/env node

/**
 * Changelog tool for ProxyForGame
 *
 * CHANGELOG.md is the single source of truth for the project's history. The
 * bullets marked `<!-- site -->` are the subset users see in the sidebar
 * changelog; the exact Russian text that was published for a release is quoted
 * at the end of its section, which makes the file the archive the database is
 * not (changelog.sql is overwritten for every entry and is git-ignored).
 *
 * Run: node scripts/changelog.js [--validate]
 *      node scripts/changelog.js --release [--date=YYYY-MM-DD]
 *
 * --validate  Check the structure of CHANGELOG.md. Gates `make check`.
 * --release   Turn [Unreleased] into a dated section and regenerate
 *             changelog.sql. /translate-changelog fills in the eleven
 *             non-Russian rows afterwards.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT, 'CHANGELOG.md');
const SQL_FILE = path.join(ROOT, 'changelog.sql');

/** The canonical Keep a Changelog groups, in the order they must appear. */
const SECTION_ORDER = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/** Marks a bullet as published to the in-app changelog. */
const SITE_MARK = '<!-- site -->';

/**
 * Width of change_descriptions.description in production. schema.sql carries
 * the same number; a published text longer than this is silently truncated by
 * MySQL, which is how entries 12 and 28 lost their tails back when the column
 * was varchar(255).
 */
const MAX_DESCRIPTION = 1024;

/** Warn well before the hard limit - the translations run longer than the Russian source. */
const WARN_DESCRIPTION = 900;

/**
 * Languages of change_descriptions, in the order changelog.sql lists them.
 * `us` is absent on purpose: ajax.php maps it onto `en` before querying.
 */
const LANGS = ['ru', 'en', 'pt', 'de', 'pl', 'es', 'fr', 'it', 'nl', 'sk', 'tr', 'bs'];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

/**
 * @param {string} text
 * @param {string} color
 * @returns {string}
 */
function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

const UNRELEASED_RE = /^## \[Unreleased\]\s*$/;
const RELEASE_RE = /^## \[(\d{4}-\d{2}-\d{2})\](?: - site entry (\d+))?\s*$/;
const SECTION_RE = /^### (.+?)\s*$/;
const BULLET_RE = /^- (.+?)\s*$/;
const QUOTE_RE = /^> \*\*RU:\*\* (.+?)\s*$/;
const HEADING_RE = /^#{1,6} /;

/**
 * @typedef {object} Bullet
 * @property {string} text     Bullet text with the site marker stripped.
 * @property {boolean} site    Whether the bullet is published to the site.
 * @property {number} line     1-based line number.
 */

/**
 * @typedef {object} Section
 * @property {string} name     Heading text as written.
 * @property {Bullet[]} bullets
 * @property {number} line     1-based line number.
 */

/**
 * @typedef {object} Release
 * @property {string|null} date  ISO date, or null for [Unreleased].
 * @property {number|null} id    Site entry id, or null when the release has none.
 * @property {Section[]} sections
 * @property {string|null} quote The published Russian text.
 * @property {number} quoteLine  1-based line number of the quote, 0 when absent.
 * @property {number} line       1-based line number of the heading.
 * @property {number} endLine    1-based line number of the last line of the section.
 */

/**
 * Parses CHANGELOG.md into releases. Structural problems are collected rather
 * than thrown so that validate() can report all of them at once.
 *
 * @param {string} content
 * @returns {{ releases: Release[], errors: string[] }}
 */
function parse(content) {
  const lines = content.split(/\r?\n/);
  /** @type {Release[]} */
  const releases = [];
  /** @type {string[]} */
  const errors = [];

  /** @type {Release|null} */
  let release = null;
  /** @type {Section|null} */
  let section = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const no = i + 1;

    if (release) {
      release.endLine = no;
    }

    if (line.startsWith('## ')) {
      section = null;
      const unreleased = UNRELEASED_RE.exec(line);
      const dated = RELEASE_RE.exec(line);

      if (!unreleased && !dated) {
        errors.push(`line ${no}: malformed release heading "${line}" - expected "## [Unreleased]" or "## [YYYY-MM-DD] - site entry N"`);
        release = null;
        continue;
      }

      release = {
        date: dated ? dated[1] : null,
        id: dated && dated[2] !== undefined ? Number.parseInt(dated[2], 10) : null,
        sections: [],
        quote: null,
        quoteLine: 0,
        line: no,
        endLine: no
      };
      releases.push(release);
      continue;
    }

    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      if (!release) {
        errors.push(`line ${no}: "### ${sectionMatch[1]}" appears before any release heading`);
        continue;
      }
      section = { name: sectionMatch[1], bullets: [], line: no };
      release.sections.push(section);
      continue;
    }

    const quoteMatch = QUOTE_RE.exec(line);
    if (quoteMatch) {
      if (!release) {
        errors.push(`line ${no}: a "> **RU:**" quote appears before any release heading`);
        continue;
      }
      if (release.quote !== null) {
        errors.push(`line ${no}: a second "> **RU:**" quote in the same release`);
        continue;
      }
      release.quote = quoteMatch[1];
      release.quoteLine = no;
      continue;
    }

    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      if (!section) {
        errors.push(`line ${no}: bullet "${bulletMatch[1]}" is not under a "###" group`);
        continue;
      }
      const raw = bulletMatch[1];
      const site = raw.includes(SITE_MARK);
      section.bullets.push({
        text: raw.replace(SITE_MARK, '').trim(),
        site,
        line: no
      });
      continue;
    }

    // Anything else must be blank or belong to the file header. A stray heading
    // level inside a release would silently swallow bullets, so reject it.
    if (release && HEADING_RE.test(line)) {
      errors.push(`line ${no}: unexpected heading "${line}" inside a release section`);
    }
  }

  return { releases, errors };
}

/**
 * @param {Release} release
 * @returns {boolean}
 */
function hasSiteBullets(release) {
  return release.sections.some((s) => s.bullets.some((b) => b.site));
}

/**
 * @param {Release} release
 * @returns {string}
 */
function describe(release) {
  return release.date === null ? '[Unreleased]' : `[${release.date}]`;
}

/**
 * Applies every structural rule to a parsed file.
 *
 * @param {string} content
 * @returns {{ errors: string[], warnings: string[], releases: Release[] }}
 */
function validate(content) {
  const { releases, errors } = parse(content);
  /** @type {string[]} */
  const warnings = [];

  // Split rather than startsWith: .gitattributes normalizes to LF in the
  // repository, but a clone with core.autocrlf on has CRLF in the working tree.
  if (content.split(/\r?\n/, 1)[0] !== '# Changelog') {
    errors.push('line 1: the file must start with "# Changelog"');
  }

  const unreleasedCount = releases.filter((r) => r.date === null).length;
  if (unreleasedCount !== 1) {
    errors.push(`the file must hold exactly one "## [Unreleased]" section, found ${unreleasedCount}`);
  } else if (releases.length > 0 && releases[0].date !== null) {
    errors.push(`line ${releases[0].line}: "## [Unreleased]" must be the first release section`);
  }

  /** @type {Release|null} */
  let previous = null;

  for (const release of releases) {
    const where = describe(release);
    const site = hasSiteBullets(release);

    // A release with no groups at all is fine only for [Unreleased], which sits
    // empty between releases.
    if (release.sections.length === 0 && release.date !== null) {
      errors.push(`line ${release.line}: ${where} has no "###" group`);
    }

    /** @type {string[]} */
    const seen = [];
    let lastIndex = -1;
    for (const section of release.sections) {
      const index = SECTION_ORDER.indexOf(section.name);
      if (index === -1) {
        errors.push(`line ${section.line}: "${section.name}" is not a Keep a Changelog group (${SECTION_ORDER.join(', ')})`);
      } else if (seen.includes(section.name)) {
        errors.push(`line ${section.line}: "${section.name}" appears twice in ${where}`);
      } else if (index < lastIndex) {
        errors.push(`line ${section.line}: "${section.name}" is out of order in ${where} - keep the groups in the order ${SECTION_ORDER.join(', ')}`);
      } else {
        lastIndex = index;
      }
      seen.push(section.name);

      if (section.bullets.length === 0) {
        errors.push(`line ${section.line}: "${section.name}" in ${where} has no bullets`);
      }
    }

    if (release.date !== null) {
      if (site && release.id === null) {
        errors.push(`line ${release.line}: ${where} publishes bullets to the site but its heading carries no "- site entry N"`);
      }
      if (!site && release.id !== null) {
        errors.push(`line ${release.line}: ${where} carries "- site entry ${release.id}" but no bullet is marked "${SITE_MARK}"`);
      }
      if (site && release.quote === null) {
        errors.push(`line ${release.line}: ${where} publishes bullets to the site but has no "> **RU:**" quote`);
      }
      if (!site && release.quote !== null) {
        errors.push(`line ${release.quoteLine}: ${where} has a "> **RU:**" quote but no bullet marked "${SITE_MARK}"`);
      }
    }

    if (release.quote !== null) {
      const length = release.quote.length;
      if (length > MAX_DESCRIPTION) {
        errors.push(`line ${release.quoteLine}: the quote of ${where} is ${length} characters, over the ${MAX_DESCRIPTION} the database column holds`);
      } else if (length > WARN_DESCRIPTION) {
        warnings.push(`line ${release.quoteLine}: the quote of ${where} is ${length} characters - translations run longer than the Russian source and the column holds ${MAX_DESCRIPTION}`);
      }
    }

    if (previous && release.date !== null) {
      if (previous.id !== null && release.id !== null && release.id >= previous.id) {
        errors.push(`line ${release.line}: site entry ${release.id} must be smaller than ${previous.id} above it - the sidebar orders entries by id`);
      }
      // Dates are not enforced: the published history has real inversions, such
      // as entry 32 dated 2023-04-26 sitting below entries 33 and 34 dated
      // February 2023. Worth a look, not worth failing a build over.
      if (previous.date !== null && release.date > previous.date) {
        warnings.push(`line ${release.line}: ${where} is dated after ${describe(previous)} above it`);
      }
    }

    if (release.date !== null) {
      previous = release;
    }
  }

  return { errors, warnings, releases };
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeSql(value) {
  return value.replace(/'/g, "''");
}

/**
 * Builds changelog.sql. Every language row gets the Russian text: that is the
 * input /translate-changelog expects, and it rewrites the eleven non-Russian
 * rows in place.
 *
 * @param {number} id
 * @param {string} date
 * @param {string} text
 * @returns {string}
 */
function buildSql(id, date, text) {
  const escaped = escapeSql(text);
  const rows = LANGS.map(
    (lang) => `insert into change_descriptions (id, lang, description) values (${id}, '${lang}', '${escaped}');`
  );
  return `insert into change_headers (id, ts) values (${id}, '${date}');\n\n${rows.join('\n')}\n`;
}

/**
 * @returns {string} today in YYYY-MM-DD, local time
 */
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Cuts [Unreleased] into a dated section and regenerates changelog.sql.
 *
 * @param {string} content
 * @param {string} date
 * @returns {{ content: string, sql: string, id: number }}
 */
function release(content, date) {
  const { errors, releases } = validate(content);
  if (errors.length > 0) {
    throw new Error(`CHANGELOG.md does not validate:\n  ${errors.join('\n  ')}`);
  }

  const unreleased = releases.find((r) => r.date === null);
  if (!unreleased) {
    throw new Error('no "## [Unreleased]" section to release');
  }
  if (!hasSiteBullets(unreleased)) {
    throw new Error(`[Unreleased] holds nothing marked "${SITE_MARK}" - there is no entry to publish`);
  }
  if (unreleased.quote === null) {
    throw new Error('[Unreleased] has no "> **RU:**" quote - write the Russian announcement before releasing');
  }
  if (releases.some((r) => r.date === date)) {
    throw new Error(`a release dated ${date} already exists - pass --date=YYYY-MM-DD to use another date`);
  }

  const ids = releases.map((r) => r.id).filter((/** @type {number|null} */ id) => id !== null);
  const nextId = ids.length === 0 ? 0 : Math.max(...(/** @type {number[]} */ (ids))) + 1;

  const lines = content.split(/\r?\n/);
  lines[unreleased.line - 1] = `## [${date}] - site entry ${nextId}`;
  lines.splice(unreleased.line - 1, 0, '## [Unreleased]', '');

  return {
    content: lines.join('\n'),
    sql: buildSql(nextId, date, unreleased.quote),
    id: nextId
  };
}

/**
 * @param {string[]} argv
 */
function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node scripts/changelog.js [--validate]');
    console.log('       node scripts/changelog.js --release [--date=YYYY-MM-DD]');
    return;
  }

  const content = fs.readFileSync(CHANGELOG_FILE, 'utf8');

  if (argv.includes('--release')) {
    const dateArg = argv.find((a) => a.startsWith('--date='));
    const date = dateArg ? dateArg.slice('--date='.length) : today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error(colorize(`Not a date: ${date}`, colors.red));
      process.exit(1);
    }

    let result;
    try {
      result = release(content, date);
    } catch (error) {
      console.error(colorize(String(error instanceof Error ? error.message : error), colors.red));
      process.exit(1);
      return;
    }

    fs.writeFileSync(CHANGELOG_FILE, result.content, 'utf8');
    fs.writeFileSync(SQL_FILE, result.sql, 'utf8');
    console.log(colorize(`Released site entry ${result.id} dated ${date}.`, colors.green));
    console.log(`  ${colorize('CHANGELOG.md', colors.blue)}  [Unreleased] cut into a dated section`);
    console.log(`  ${colorize('changelog.sql', colors.blue)} rewritten, all ${LANGS.length} rows holding the Russian text`);
    console.log(`\nNext: run ${colorize('/translate-changelog', colors.blue)}, then apply changelog.sql to the database.`);
    return;
  }

  const { errors, warnings, releases } = validate(content);

  for (const warning of warnings) {
    console.log(colorize(`warning  ${warning}`, colors.yellow));
  }
  for (const error of errors) {
    console.log(colorize(`error    ${error}`, colors.red));
  }

  if (errors.length > 0) {
    console.log(colorize(`\nCHANGELOG.md has ${errors.length} problem(s).`, colors.red));
    process.exit(1);
  }

  const published = releases.filter((r) => r.date !== null && hasSiteBullets(r)).length;
  console.log(colorize(`CHANGELOG.md is valid.`, colors.green));
  console.log(colorize(`  ${releases.length - 1} releases, ${published} of them published to the site.`, colors.gray));
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  parse,
  validate,
  release,
  buildSql,
  escapeSql,
  hasSiteBullets,
  SECTION_ORDER,
  SITE_MARK,
  MAX_DESCRIPTION,
  LANGS
};
