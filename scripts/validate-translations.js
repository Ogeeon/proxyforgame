#!/usr/bin/env node

/**
 * Translation Validator for ProxyForGame
 *
 * Validates that all locale files have matching keys with the source (en.json).
 * Run manually: node scripts/validate-translations.js
 * Or via pre-commit hook
 */

const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, '..', 'www', 'locale');
const SOURCE_FILE = path.join(LOCALE_DIR, 'en.json');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

/**
 * Recursively get all keys from a nested object
 * Returns array of key paths like ['common.title', 'sidebar.header']
 */
function getKeyPaths(obj, prefix = '') {
  const paths = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      paths.push(...getKeyPaths(value, fullPath));
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
}

/**
 * Get value from nested object by key path
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Check if value exists at path (not null, not undefined)
 */
function hasValueAtPath(obj, path) {
  return getValueByPath(obj, path) !== undefined;
}

/**
 * Load and parse a JSON file
 */
function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(colorize(`Error reading ${filePath}: ${error.message}`, colors.red));
    return null;
  }
}

/**
 * Get all locale files
 */
function getLocaleFiles() {
  const files = fs.readdirSync(LOCALE_DIR)
    .filter(file => file.endsWith('.json') && file !== 'en.json');

  return files.map(file => ({
    name: file,
    fullPath: path.join(LOCALE_DIR, file),
    langCode: file.replace('.json', '')
  }));
}

/**
 * Validate translations against source
 */
function validateTranslations(sourceData, localeData, localeName) {
  const sourceKeys = getKeyPaths(sourceData);
  const issues = {
    missing: [],      // Keys in source but not in locale
    extra: [],        // Keys in locale but not in source
    empty: []         // Keys with empty/null values
  };

  for (const key of sourceKeys) {
    if (!hasValueAtPath(localeData, key)) {
      issues.missing.push(key);
    } else {
      const value = getValueByPath(localeData, key);
      if (value === null || value === '' || value === undefined) {
        issues.empty.push(key);
      }
    }
  }

  // Check for extra keys (optional, can be disabled)
  const localeKeys = getKeyPaths(localeData);
  for (const key of localeKeys) {
    if (!hasValueAtPath(sourceData, key)) {
      issues.extra.push(key);
    }
  }

  return issues;
}

/**
 * Print validation results
 */
function printResults(results) {
  let hasErrors = false;
  let totalMissing = 0;
  let totalEmpty = 0;

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.blue));
  console.log(colorize('         Translation Validation Report', colors.blue));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.blue));

  for (const [locale, issues] of Object.entries(results)) {
    const localeName = locale === 'source' ? 'English (Source)' : locale.toUpperCase();

    if (issues.missing.length === 0 && issues.empty.length === 0 && issues.extra.length === 0) {
      console.log(`\n${colorize('✓', colors.green)} ${colorize(localeName, colors.green)}: All translations present`);
    } else {
      hasErrors = true;

      console.log(`\n${colorize('✗', colors.red)} ${colorize(localeName, colors.red)}:`);

      if (issues.missing.length > 0) {
        totalMissing += issues.missing.length;
        console.log(colorize(`  Missing keys (${issues.missing.length}):`, colors.red));
        issues.missing.slice(0, 10).forEach(key => {
          console.log(colorize(`    - ${key}`, colors.gray));
        });
        if (issues.missing.length > 10) {
          console.log(colorize(`    ... and ${issues.missing.length - 10} more`, colors.gray));
        }
      }

      if (issues.empty.length > 0) {
        totalEmpty += issues.empty.length;
        console.log(colorize(`  Empty values (${issues.empty.length}):`, colors.yellow));
        issues.empty.slice(0, 5).forEach(key => {
          console.log(colorize(`    - ${key}`, colors.gray));
        });
        if (issues.empty.length > 5) {
          console.log(colorize(`    ... and ${issues.empty.length - 5} more`, colors.gray));
        }
      }

      if (issues.extra.length > 0) {
        console.log(colorize(`  Extra keys (${issues.extra.length}):`, colors.blue));
        issues.extra.slice(0, 5).forEach(key => {
          console.log(colorize(`    - ${key}`, colors.gray));
        });
        if (issues.extra.length > 5) {
          console.log(colorize(`    ... and ${issues.extra.length - 5} more`, colors.gray));
        }
      }
    }
  }

  console.log('\n' + colorize('───────────────────────────────────────────────────────', colors.blue));

  if (hasErrors) {
    console.log(colorize(`Total: ${totalMissing} missing, ${totalEmpty} empty translations`, colors.red));
    console.log('\nRun /sync-translations to fix missing keys automatically.');
    return false;
  } else {
    console.log(colorize('✓ All translations validated successfully!', colors.green));
    return true;
  }
}

/**
 * Main validation function
 */
function main() {
  // Load source file
  const sourceData = loadJsonFile(SOURCE_FILE);
  if (!sourceData) {
    console.error(colorize('Failed to load source file (en.json)', colors.red));
    process.exit(1);
  }

  // Get all locale files
  const localeFiles = getLocaleFiles();
  const results = {};

  // Validate each locale file
  for (const { name, fullPath, langCode } of localeFiles) {
    const localeData = loadJsonFile(fullPath);
    if (!localeData) continue;

    results[langCode] = validateTranslations(sourceData, localeData, langCode);
  }

  // Print results
  const success = printResults(results);
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validateTranslations, getKeyPaths, getValueByPath };
