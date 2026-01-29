#!/usr/bin/env node

/**
 * Test Coverage Checker for ProxyForGame
 *
 * Checks that all calculators have corresponding test files.
 * Run: node scripts/check-test-coverage.js
 * Or via pre-commit hook when adding new calculators
 */

const fs = require('fs');
const path = require('path');

const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');
const TESTS_DIR = path.join(__dirname, '..', 'playwright-tests', 'tests');

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
 * Get all calculator PHP files (excluding helpers)
 */
function getCalculators() {
  const files = fs.readdirSync(CALC_DIR)
    .filter(file => file.endsWith('.php') && !file.startsWith('h_'));

  return files.map(file => file.replace('.php', ''));
}

/**
 * Get all test files
 */
function getTests() {
  const files = fs.readdirSync(TESTS_DIR)
    .filter(file => file.endsWith('.spec.js'));

  return files.map(file => file.replace('.spec.js', ''));
}

/**
 * Check test coverage
 */
function checkCoverage() {
  const calculators = getCalculators();
  const tests = getTests();

  const results = {
    covered: [],
    missing: [],
    extra: []
  };

  for (const calc of calculators) {
    if (tests.includes(calc)) {
      results.covered.push(calc);
    } else {
      results.missing.push(calc);
    }
  }

  for (const test of tests) {
    if (!calculators.includes(test)) {
      results.extra.push(test);
    }
  }

  return results;
}

/**
 * Print coverage report
 */
function printReport(results) {
  const total = results.covered.length + results.missing.length;
  const coverage = total > 0 ? ((results.covered.length / total) * 100).toFixed(1) : '0.0';

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('                 Test Coverage Report', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  console.log(`\nTotal calculators: ${colorize(total.toString(), colors.blue)}`);
  console.log(`Covered by tests: ${colorize(results.covered.length.toString(), colors.green)} (${colorize(coverage + '%', colors.green)})`);
  console.log(`Missing tests: ${colorize(results.missing.length.toString(), results.missing.length > 0 ? colors.red : colors.green)}`);

  if (results.covered.length > 0) {
    console.log('\n' + colorize('✓ Calculators with tests:', colors.green));
    results.covered.forEach(calc => {
      console.log(colorize(`  • ${calc}`, colors.gray));
    });
  }

  if (results.missing.length > 0) {
    console.log('\n' + colorize('✗ Calculators missing tests:', colors.red));
    results.missing.forEach(calc => {
      console.log(colorize(`  • ${calc}`, colors.gray));
    });
    console.log(colorize(`\nGenerate tests with:`, colors.yellow));
    results.missing.forEach(calc => {
      console.log(colorize(`  npm run generate-test ${calc}`, colors.gray));
    });
  }

  if (results.extra.length > 0) {
    console.log('\n' + colorize('○ Extra tests (no matching calculator):', colors.blue));
    results.extra.forEach(test => {
      console.log(colorize(`  • ${test}`, colors.gray));
    });
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));

  return results.missing.length === 0;
}

/**
 * Main function
 */
function main() {
  const results = checkCoverage();
  const success = printReport(results);

  if (!success) {
    console.log(colorize('\n⚠ Some calculators are missing tests!', colors.yellow));
    console.log(colorize('Run /add-test <calculator> to generate test templates.', colors.gray));
  }

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkCoverage };
