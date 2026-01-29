#!/usr/bin/env node

/**
 * Translation Synchronizer for ProxyForGame
 *
 * Synchronizes all locale files with the source (en.json) by:
 * - Adding missing keys with placeholder values
 * - Optionally auto-translating using a service (future feature)
 * - Generating completion reports
 *
 * Run: node scripts/sync-translations.js [--fix] [--report]
 */

const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, '..', 'www', 'locale');
const SOURCE_FILE = path.join(LOCALE_DIR, 'en.json');

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
 * Recursively get all keys from a nested object
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
 * Set value at path in nested object
 */
function setValueAtPath(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();

  const target = keys.reduce((current, key) => {
    if (!current[key]) {
      current[key] = {};
    }
    return current[key];
  }, obj);

  target[lastKey] = value;
}

/**
 * Get value from nested object by key path
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Check if path exists in object
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
 * Write JSON file with proper formatting
 */
function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(colorize(`Error writing ${filePath}: ${error.message}`, colors.red));
    return false;
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
 * Find missing keys between source and target
 */
function findMissingKeys(sourceData, targetData) {
  const sourceKeys = getKeyPaths(sourceData);
  const missing = [];

  for (const key of sourceKeys) {
    if (!hasValueAtPath(targetData, key)) {
      const sourceValue = getValueByPath(sourceData, key);
      missing.push({ key, sourceValue });
    }
  }

  return missing;
}

/**
 * Generate placeholder translation
 */
function generatePlaceholder(langCode, key, sourceValue) {
  const langNames = {
    'bs': 'Bosnian',
    'de': 'German',
    'es': 'Spanish',
    'fr': 'French',
    'it': 'Italian',
    'nl': 'Dutch',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'sk': 'Slovak',
    'tr': 'Turkish',
    'us': 'English (US)'
  };

  const langName = langNames[langCode] || langCode;

  if (typeof sourceValue === 'string') {
    return `[TODO: Translate to ${langName}] ${sourceValue}`;
  }

  return sourceValue;
}

/**
 * Synchronize a single locale file
 */
function syncLocaleFile(sourceData, localeFile, dryRun = false) {
  const localeData = loadJsonFile(localeFile.fullPath);
  if (!localeData) {
    return { success: false, added: 0, errors: ['Failed to load file'] };
  }

  const missingKeys = findMissingKeys(sourceData, localeData);

  if (missingKeys.length === 0) {
    return { success: true, added: 0, errors: [] };
  }

  let added = 0;
  const errors = [];

  for (const { key, sourceValue } of missingKeys) {
    try {
      const placeholder = generatePlaceholder(localeFile.langCode, key, sourceValue);
      setValueAtPath(localeData, key, placeholder);
      added++;
    } catch (error) {
      errors.push(`Failed to add key ${key}: ${error.message}`);
    }
  }

  if (!dryRun && added > 0) {
    if (writeJsonFile(localeFile.fullPath, localeData)) {
      console.log(`  ${colorize('✓', colors.green)} Added ${added} missing keys to ${localeFile.name}`);
    } else {
      return { success: false, added: 0, errors: ['Failed to write file'] };
    }
  } else if (dryRun && added > 0) {
    console.log(`  ${colorize('○', colors.yellow)} Would add ${added} keys to ${localeFile.name} (dry run)`);
  }

  return { success: true, added, errors };
}

/**
 * Generate completion report
 */
function generateReport(sourceData, localeFiles) {
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Translation Completion Report', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  const sourceKeys = getKeyPaths(sourceData);
  const totalKeys = sourceKeys.length;

  console.log(`\nTotal keys in source (en.json): ${colorize(totalKeys.toString(), colors.blue)}`);

  const results = [];

  for (const { name, fullPath, langCode } of localeFiles) {
    const localeData = loadJsonFile(fullPath);
    if (!localeData) continue;

    const missingKeys = findMissingKeys(sourceData, localeData);
    const presentKeys = totalKeys - missingKeys.length;
    const percentage = ((presentKeys / totalKeys) * 100).toFixed(1);

    const status = percentage === '100.0' ? colors.green : (percentage > '90' ? colors.yellow : colors.red);
    const statusIcon = percentage === '100.0' ? '✓' : (percentage > '90' ? '○' : '✗');

    results.push({
      lang: langCode.toUpperCase(),
      present: presentKeys,
      missing: missingKeys.length,
      percentage,
      statusIcon,
      status
    });
  }

  // Sort by completion percentage
  results.sort((a, b) => parseFloat(a.percentage) - parseFloat(b.percentage));

  console.log('\nCompletion by language:');
  console.log(colorize('──────────────────────────────────────────────────────────', colors.gray));

  for (const result of results) {
    const percentageColor = parseFloat(result.percentage) === 100 ? colors.green :
                           parseFloat(result.percentage) > 90 ? colors.yellow : colors.red;

    console.log(
      `${result.statusIcon} ${colorize(result.lang.padEnd(4), result.status)} ` +
      `${colorize(result.percentage + '%', percentageColor)} ` +
      colorize(`(${result.present}/${totalKeys})`, colors.gray) +
      (result.missing > 0 ? colorize(` [${result.missing} missing]`, colors.gray) : '')
    );
  }

  console.log(colorize('──────────────────────────────────────────────────────────', colors.gray));
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const reportOnly = args.includes('--report');
  const fix = args.includes('--fix');

  // Load source file
  const sourceData = loadJsonFile(SOURCE_FILE);
  if (!sourceData) {
    console.error(colorize('Failed to load source file (en.json)', colors.red));
    process.exit(1);
  }

  // Get all locale files
  const localeFiles = getLocaleFiles();

  // Generate report
  if (reportOnly || dryRun) {
    generateReport(sourceData, localeFiles);
    if (dryRun) {
      console.log('\n' + colorize('Dry run mode - no files will be modified', colors.yellow));
      console.log('Run with --fix to apply changes');
    }
    return;
  }

  // Sync mode
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Synchronizing Translations', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  if (!fix) {
    console.log(colorize('\nDry run mode - use --fix to apply changes', colors.yellow));
    console.log('');
  }

  let totalAdded = 0;
  let totalErrors = 0;

  for (const localeFile of localeFiles) {
    const result = syncLocaleFile(sourceData, localeFile, !fix);
    totalAdded += result.added;
    totalErrors += result.errors.length;

    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        console.error(colorize(`  Error: ${error}`, colors.red));
      });
    }
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  if (fix) {
    console.log(`\n${colorize('✓', colors.green)} Sync complete! ${colorize(totalAdded.toString(), colors.blue)} keys added across all locale files.`);
  } else {
    console.log(`\n${colorize('○', colors.yellow)} Dry run complete! Would add ${colorize(totalAdded.toString(), colors.blue)} keys.`);
    console.log(colorize('Run with --fix to apply changes', colors.gray));
  }

  if (totalErrors > 0) {
    console.error(colorize(`\n✗ ${totalErrors} errors occurred`, colors.red));
    process.exit(1);
  }

  // Show final report
  generateReport(sourceData, localeFiles);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { syncLocaleFile, findMissingKeys };
