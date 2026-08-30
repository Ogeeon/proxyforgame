#!/usr/bin/env node

/**
 * Database Schema Validator for ProxyForGame
 *
 * Validates database schema against actual usage in the codebase.
 * Checks for missing tables, unused tables, and inconsistencies.
 *
 * When a database is configured in .env it also compares the column
 * definitions in schema.sql against the live ones, which is the only check
 * that catches a schema.sql that has drifted: `change_descriptions.description`
 * sat at varchar(255) in the file while production had grown to varchar(1024).
 * The live read goes through scripts/dump-db-columns.php - Node has no MySQL
 * driver here, and the credentials already live behind db.connect.inc.php.
 *
 * Run: node scripts/validate-database-schema.js [--no-db]
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const WWW_DIR = path.join(ROOT, 'www');
const SCHEMA_PATH = path.join(ROOT, 'schema.sql');
const DUMP_SCRIPT = path.join(__dirname, 'dump-db-columns.php');
const PHP = process.env.PFG_PHP || 'php';

// Infrastructure tables with no sqlQuery() caller by design - the deploy tooling
// owns them, not the app. Kept out of the "in schema but not used in code" list.
const NON_APP_TABLES = new Set(['schema_migrations']);

// ANSI color codes
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
 * Extracts table names referenced by a query into usage.tables
 */
function extractTablesFromQuery(query, usage) {
  const tableMatches = query.matchAll(/\b(FROM|INTO|UPDATE|JOIN)\s+(\w+)/gi);
  for (const tableMatch of tableMatches) {
    if (tableMatch[2]) {
      usage.tables.add(tableMatch[2].toLowerCase());
    }
  }
}

/**
 * Scans a single PHP file for SqlQuery() calls and records them (and their tables) into usage
 */
function scanPhpFileForDbUsage(fullPath, usage) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const relFile = path.relative(WWW_DIR, fullPath);

  // Find sqlQuery calls. Case-insensitive: the helper in db.connect.inc.php is
  // `sqlQuery`, and matching only `SqlQuery` found nothing at all.
  const queryMatches = content.matchAll(/sqlQuery\s*\(\s*["']([^"']+)["']/gi);
  for (const match of queryMatches) {
    const query = match[1];
    usage.queries.push({ file: relFile, query: query });
    extractTablesFromQuery(query, usage);
  }

  // Find sqlQuery calls with variables
  const varMatches = content.matchAll(/sqlQuery\s*\(\s*\$?\w+\s*\.\s*["']([^"']+)["']/gi);
  for (const match of varMatches) {
    usage.queries.push({ file: relFile, query: match[1] });
  }
}

/**
 * Find all SQL queries in PHP files
 */
function findDatabaseUsage() {
  const usage = {
    tables: new Set(),
    queries: []
  };

  function scanDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
        scanDir(fullPath);
      } else if (item.endsWith('.php')) {
        scanPhpFileForDbUsage(fullPath, usage);
      }
    }
  }

  scanDir(WWW_DIR);
  return usage;
}

// Lines inside a CREATE TABLE body that define an index rather than a column.
const KEY_LINE_RE = /^\s*(PRIMARY\s+KEY|UNIQUE\s+KEY|UNIQUE|KEY|INDEX|FULLTEXT|SPATIAL|CONSTRAINT|FOREIGN\s+KEY)\b/i;

// `name type[(width)] [unsigned] [zerofill] [rest]`, backticked or not, read in
// two steps: the column name and the remainder of the line, then the type at the
// head of that remainder. One pattern for the whole shape ran past the regex
// complexity SonarQube allows (javascript:S5843).
//
// Both are written to keep their quantifiers from overlapping (javascript:S8786),
// which is why neither reads quite the way you would write it by hand:
//   - no `$` after `(.*)`. `\s+` matches a newline and `.` does not, so an end
//     that never arrives makes the two grind against each other. Greedy `.*`
//     already runs to the end of the line, which is the whole input here.
//   - no `\s*` after `\(`. `[^)]*` matches whitespace too, so the two split the
//     same run between them once the closing paren is missing.
// Measured before the change: 16k characters of the shapes above took ~200 ms
// each, quadrupling for every doubling. Both are flat now.
const COLUMN_NAME_RE = /^\s*`?(\w+)`?\s+(.*)/;
const COLUMN_TYPE_RE = /^\w+(?:\s*\([^)]*\))?(?:\s+unsigned)?(?:\s+zerofill)?/i;

/**
 * Normalizes a column type for comparison. The display width of an integer is
 * cosmetic - MySQL reports `bigint(20) unsigned` for a column declared
 * `BIGINT UNSIGNED`, and dropped the width entirely in 8.0 - so it is stripped.
 * The width of a varchar is the actual constraint and is kept.
 *
 * @param {string} type
 * @returns {string}
 */
function normalizeType(type) {
  return type
    .toLowerCase()
    // Every whitespace run is a single space from here on, so the patterns below
    // can bound their quantifiers instead of backtracking over `\s*`.
    .replace(/\s+/g, ' ')
    .replace(/ ?\( ?/g, '(')
    // Only the space before `)`; the one after it separates `unsigned`.
    .replace(/ ?\)/g, ')')
    .replace(/^(tinyint|smallint|mediumint|int|integer|bigint|year)\(\d+\)/, '$1')
    .trim();
}

/**
 * @typedef {object} SchemaColumn
 * @property {string} name
 * @property {string} type      Normalized type, e.g. `varchar(1024)`.
 * @property {boolean} nullable
 * @property {number} line      1-based line number in schema.sql.
 */

/**
 * @typedef {object} SchemaTable
 * @property {string} name
 * @property {string} definedIn
 * @property {SchemaColumn[]} columns
 */

/**
 * Parse schema.sql file to extract table definitions and their columns
 *
 * @returns {SchemaTable[]|null}
 */
function parseSchemaFile() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    return null;
  }

  const lines = fs.readFileSync(SCHEMA_PATH, 'utf8').split(/\r?\n/);
  /** @type {SchemaTable[]} */
  const tables = [];
  /** @type {SchemaTable|null} */
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const createMatch = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i.exec(line);
    if (createMatch) {
      current = { name: createMatch[1].toLowerCase(), definedIn: 'schema.sql', columns: [] };
      tables.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    // `) ENGINE=...` closes the body.
    if (/^\s*\)/.test(line)) {
      current = null;
      continue;
    }

    if (KEY_LINE_RE.test(line)) {
      continue;
    }

    const nameMatch = COLUMN_NAME_RE.exec(line);
    if (!nameMatch) {
      continue;
    }

    const typeMatch = COLUMN_TYPE_RE.exec(nameMatch[2]);
    if (typeMatch) {
      current.columns.push({
        name: nameMatch[1].toLowerCase(),
        type: normalizeType(typeMatch[0]),
        // A type holds neither `NOT` nor `NULL`, so testing the whole remainder
        // of the line is the same test as testing only what follows the type.
        nullable: !/\bNOT\s+NULL\b/i.test(nameMatch[2]),
        line: i + 1
      });
    }
  }

  return tables;
}

/**
 * Reads the live column definitions through the PHP helper.
 *
 * @returns {{ available: boolean, reason?: string, columns?: Map<string, Map<string, { type: string, nullable: boolean }>> }}
 */
function readLiveColumns() {
  const result = spawnSync(PHP, [DUMP_SCRIPT], { encoding: 'utf8' });

  if (result.error) {
    return { available: false, reason: `could not run ${PHP}: ${result.error.message}` };
  }
  if (result.status === 2) {
    return { available: false, reason: 'no database configured in .env, or it is unreachable' };
  }
  if (result.status !== 0) {
    return { available: false, reason: `dump-db-columns.php exited ${result.status}: ${(result.stderr || '').trim()}` };
  }

  let rows;
  try {
    // No PHP file in the repository carries a BOM any more, but an editor can
    // put one back, and php echoes it ahead of any output of its own - where
    // JSON.parse chokes on it.
    const body = result.stdout.codePointAt(0) === 0xFEFF ? result.stdout.slice(1) : result.stdout;
    rows = JSON.parse(body);
  } catch (e) {
    return { available: false, reason: `could not parse the column dump: ${e instanceof Error ? e.message : String(e)}` };
  }

  /** @type {Map<string, Map<string, { type: string, nullable: boolean }>>} */
  const columns = new Map();
  for (const row of rows) {
    // Key case varies between MySQL builds for information_schema.
    /** @type {Record<string, string>} */
    const lower = {};
    for (const [key, value] of Object.entries(row)) {
      lower[key.toLowerCase()] = String(value);
    }

    const table = lower.table_name.toLowerCase();
    if (!columns.has(table)) {
      columns.set(table, new Map());
    }
    const map = columns.get(table);
    if (map) {
      map.set(lower.column_name.toLowerCase(), {
        type: normalizeType(lower.column_type),
        nullable: lower.is_nullable.toUpperCase() === 'YES'
      });
    }
  }

  return { available: true, columns };
}

/**
 * @param {boolean} nullable
 * @returns {string} the wording used in the drift messages
 */
function nullabilityLabel(nullable) {
  return nullable ? 'nullable' : 'NOT NULL';
}

/**
 * Compares one table's declared columns against the live ones, in both
 * directions: a column missing from the database and a column the database has
 * but schema.sql does not are both drift.
 *
 * @param {SchemaTable} table
 * @param {Map<string, { type: string, nullable: boolean }>} liveTable
 * @param {string[]} problems
 * @returns {number} how many columns were actually compared
 */
function compareTableColumns(table, liveTable, problems) {
  let checked = 0;

  for (const column of table.columns) {
    const liveColumn = liveTable.get(column.name);
    if (!liveColumn) {
      problems.push(`schema.sql:${column.line} ${table.name}.${column.name} is not in the database`);
      continue;
    }

    checked++;

    if (liveColumn.type !== column.type) {
      problems.push(`schema.sql:${column.line} ${table.name}.${column.name} is ${column.type} in the file but ${liveColumn.type} in the database`);
    }
    if (liveColumn.nullable !== column.nullable) {
      problems.push(`schema.sql:${column.line} ${table.name}.${column.name} is ${nullabilityLabel(column.nullable)} in the file but ${nullabilityLabel(liveColumn.nullable)} in the database`);
    }
  }

  for (const name of liveTable.keys()) {
    if (!table.columns.some((c) => c.name === name)) {
      problems.push(`${table.name}.${name} exists in the database but not in schema.sql`);
    }
  }

  return checked;
}

/**
 * Compares the columns declared in schema.sql against the live ones.
 *
 * @param {SchemaTable[]} schemaTables
 * @returns {{ skipped: boolean, reason?: string, problems: string[], checked: number }}
 */
function validateColumnTypes(schemaTables) {
  const live = readLiveColumns();
  if (!live.available || !live.columns) {
    return { skipped: true, reason: live.reason, problems: [], checked: 0 };
  }

  /** @type {string[]} */
  const problems = [];
  let checked = 0;

  for (const table of schemaTables) {
    const liveTable = live.columns.get(table.name);
    if (!liveTable) {
      // Not a drift in the definitions: the table simply is not in this
      // database. `db-seed` creates them all, a partial local copy does not.
      continue;
    }

    checked += compareTableColumns(table, liveTable, problems);
  }

  return { skipped: false, problems, checked };
}

/**
 * Find database connection files
 */
function findDatabaseFiles() {
  const files = [];

  function scanDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
          scanDir(fullPath);
        } else if (item.includes('db.') || item.includes('database')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Skip directories we can't read
      console.error(colorize(`  Skipped ${dir}: ${e.message}`, colors.gray));
    }
  }

  scanDir(WWW_DIR);
  return files;
}

/**
 * Main validation function
 */
function validateDatabaseSchema() {
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Database Schema Validator', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  // Check for schema.sql
  const schemaTables = parseSchemaFile();
  if (!schemaTables) {
    console.log(colorize('\n⚠️  No schema.sql file found', colors.yellow));
    console.log(colorize('Database schema validation requires a schema.sql file', colors.gray));
    console.log(colorize('\nTo create one:', colors.cyan));
    console.log(colorize('  1. Export your database schema', colors.gray));
    console.log(colorize(`  2. Save it as ${path.relative(ROOT, SCHEMA_PATH)}`, colors.gray));
    return false;
  }

  const columnCount = schemaTables.reduce((sum, t) => sum + t.columns.length, 0);
  console.log(colorize(`\n✓ Found schema.sql with ${schemaTables.length} tables and ${columnCount} columns`, colors.green));

  // Find database usage in code
  console.log(colorize('\nScanning for database usage...', colors.gray));
  const usage = findDatabaseUsage();

  console.log(colorize(`Found ${usage.queries.length} SQL queries`, colors.blue));
  console.log(colorize(`Found ${usage.tables.size} unique tables referenced`, colors.blue));

  // Compare schema with usage
  const schemaTableNames = new Set(schemaTables.map(t => t.name));
  const usedTables = usage.tables;

  const missingInSchema = [...usedTables].filter(t => !schemaTableNames.has(t));
  const unusedInSchema = [...schemaTableNames].filter(t => !usedTables.has(t) && !NON_APP_TABLES.has(t));

  // Print results
  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  if (missingInSchema.length > 0) {
    console.log(colorize(`\n⚠️  Tables used in code but missing in schema (${missingInSchema.length}):`, colors.yellow));
    missingInSchema.forEach(table => {
      console.log(colorize(`  - ${table}`, colors.gray));
    });
  }

  if (unusedInSchema.length > 0) {
    console.log(colorize(`\nℹ️  Tables in schema but not used in code (${unusedInSchema.length}):`, colors.blue));
    unusedInSchema.forEach(table => {
      console.log(colorize(`  - ${table}`, colors.gray));
    });
  }

  if (missingInSchema.length === 0 && unusedInSchema.length === 0) {
    console.log(colorize('\n✅ Schema is consistent with code usage!', colors.green));
  }

  // Column types, against the live database
  let columnProblems = 0;
  if (process.argv.includes('--no-db')) {
    console.log(colorize('\nℹ️  Column types not checked (--no-db)', colors.blue));
  } else {
    const types = validateColumnTypes(schemaTables);
    if (types.skipped) {
      console.log(colorize(`\nℹ️  Column types not checked: ${types.reason}`, colors.blue));
      console.log(colorize('   Only a live database can catch a schema.sql that has drifted.', colors.gray));
    } else if (types.problems.length > 0) {
      columnProblems = types.problems.length;
      console.log(colorize(`\n⚠️  Column definitions that differ from the database (${types.problems.length}):`, colors.yellow));
      types.problems.forEach((problem) => {
        console.log(colorize(`  - ${problem}`, colors.gray));
      });
    } else {
      console.log(colorize(`\n✅ All ${types.checked} columns match the database!`, colors.green));
    }
  }

  // Check for db.connect.inc.php
  const dbFiles = findDatabaseFiles();
  console.log(colorize(`\n📄 Database-related files: ${dbFiles.length}`, colors.blue));
  dbFiles.forEach(file => {
    console.log(colorize(`  - ${path.relative(WWW_DIR, file)}`, colors.gray));
  });

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  return missingInSchema.length === 0 && columnProblems === 0;
}

/**
 * Main function
 */
function main() {
  const success = validateDatabaseSchema();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateDatabaseSchema, parseSchemaFile, normalizeType, validateColumnTypes };
