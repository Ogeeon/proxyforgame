#!/usr/bin/env node

/**
 * Database Schema Validator for ProxyForGame
 *
 * Validates database schema against actual usage in the codebase.
 * Checks for missing tables, unused tables, and inconsistencies.
 *
 * Run: node scripts/validate-database-schema.js
 */

const fs = require('fs');
const path = require('path');

const WWW_DIR = path.join(__dirname, '..', 'www');

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
        const content = fs.readFileSync(fullPath, 'utf8');

        // Find SqlQuery calls
        const queryMatches = content.matchAll(/SqlQuery\s*\(\s*["']([^"']+)["']/g);
        for (const match of queryMatches) {
          const query = match[1];
          usage.queries.push({
            file: path.relative(WWW_DIR, fullPath),
            query: query
          });

          // Extract table names (basic pattern matching)
          const tableMatches = query.matchAll(/\b(FROM|INTO|UPDATE|JOIN)\s+(\w+)/gi);
          for (const tableMatch of tableMatches) {
            if (tableMatch[2]) {
              usage.tables.add(tableMatch[2].toLowerCase());
            }
          }
        }

        // Find SqlQuery calls with variables
        const varMatches = content.matchAll(/SqlQuery\s*\(\s*\$?\w+\s*\.\s*["']([^"']+)["']/g);
        for (const match of varMatches) {
          const query = match[1];
          usage.queries.push({
            file: path.relative(WWW_DIR, fullPath),
            query: query
          });
        }
      }
    }
  }

  scanDir(WWW_DIR);
  return usage;
}

/**
 * Parse schema.sql file to extract table definitions
 */
function parseSchemaFile() {
  const schemaPath = path.join(WWW_DIR, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  const content = fs.readFileSync(schemaPath, 'utf8');
  const tables = [];

  // Match CREATE TABLE statements
  const createTableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/gi);
  for (const match of createTableMatches) {
    tables.push({
      name: match[1].toLowerCase(),
      definedIn: 'schema.sql'
    });
  }

  return tables;
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
    console.log(colorize('  2. Save it as www/schema.sql', colors.gray));
    return false;
  }

  console.log(colorize(`\n✓ Found schema.sql with ${schemaTables.length} tables`, colors.green));

  // Find database usage in code
  console.log(colorize('\nScanning for database usage...', colors.gray));
  const usage = findDatabaseUsage();

  console.log(colorize(`Found ${usage.queries.length} SQL queries`, colors.blue));
  console.log(colorize(`Found ${usage.tables.size} unique tables referenced`, colors.blue));

  // Compare schema with usage
  const schemaTableNames = new Set(schemaTables.map(t => t.name));
  const usedTables = usage.tables;

  const missingInSchema = [...usedTables].filter(t => !schemaTableNames.has(t));
  const unusedInSchema = [...schemaTableNames].filter(t => !usedTables.has(t));

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

  // Check for db.connect.inc.php
  const dbFiles = findDatabaseFiles();
  console.log(colorize(`\n📄 Database-related files: ${dbFiles.length}`, colors.blue));
  dbFiles.forEach(file => {
    console.log(colorize(`  - ${path.relative(WWW_DIR, file)}`, colors.gray));
  });

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  return missingInSchema.length === 0;
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

module.exports = { validateDatabaseSchema };
