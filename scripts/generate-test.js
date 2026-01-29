#!/usr/bin/env node

/**
 * Test Generator for ProxyForGame Calculators
 *
 * Generates Playwright test file templates for new calculators.
 * Run: node scripts/generate-test.js <calculator-name>
 * Example: node scripts/generate-test.js graviton
 */

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'playwright-tests', 'tests');
const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');

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
 * Get calculator info from PHP file
 */
function getCalculatorInfo(calcName) {
  const phpPath = path.join(CALC_DIR, `${calcName}.php`);

  if (!fs.existsSync(phpPath)) {
    return null;
  }

  const content = fs.readFileSync(phpPath, 'utf8');

  // Extract the translation key used (second argument to Intl::getTranslations)
  const match = content.match(/Intl::getTranslations\(\$lang,\s*['"]([^'"]+)['"]\)/);

  return {
    name: calcName,
    translationKey: match ? match[1] : calcName,
    phpPath
  };
}

/**
 * Format calculator name for display
 */
function formatDisplayName(calcName) {
  return calcName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Generate test file template
 */
function generateTestTemplate(calcInfo) {
  const displayName = formatDisplayName(calcInfo.name);
  const translationKey = calcInfo.translationKey;

  return `import { test, expect } from '@playwright/test';

test.describe('${displayName} Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/${calcInfo.name}.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/${displayName}/i);
    });

    test('calculator options are available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('basic functionality works', async ({ page }) => {
        // Add your specific test here
        // Example: fill in a form field and check the result

        // await page.locator('#some-input').fill('10');
        // await page.locator('#some-input').press('Enter');
        // await expect(page.locator('#some-result')).toContainText('expected value');
    });

    // Add more tests as needed
    // test('[specific scenario] calculates correctly', async ({ page }) => {
    //     // Test implementation
    // });
});
`;
}

/**
 * Check if test file already exists
 */
function testFileExists(calcName) {
  const testPath = path.join(TESTS_DIR, `${calcName}.spec.js`);
  return fs.existsSync(testPath);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(colorize('Usage: node scripts/generate-test.js <calculator-name>', colors.yellow));
    console.error(colorize('Example: node scripts/generate-test.js graviton', colors.gray));
    process.exit(1);
  }

  const calcName = args[0].toLowerCase().replace('.php', '');

  // Get calculator info
  const calcInfo = getCalculatorInfo(calcName);

  if (!calcInfo) {
    console.error(colorize(`Error: Calculator '${calcName}' not found in ${CALC_DIR}`, colors.red));
    process.exit(1);
  }

  // Check if test already exists
  if (testFileExists(calcName)) {
    console.error(colorize(`Error: Test file '${calcName}.spec.js' already exists!`, colors.yellow));
    console.error(colorize(`Location: ${path.join(TESTS_DIR, `${calcName}.spec.js`)}`, colors.gray));
    process.exit(1);
  }

  // Generate test content
  const testContent = generateTestTemplate(calcInfo);

  // Write test file
  const testPath = path.join(TESTS_DIR, `${calcName}.spec.js`);

  try {
    fs.writeFileSync(testPath, testContent, 'utf8');
  } catch (error) {
    console.error(colorize(`Error writing test file: ${error.message}`, colors.red));
    process.exit(1);
  }

  // Success message
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('                Test File Generated Successfully', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  console.log(`\n${colorize('✓', colors.green)} Created: ${colorize(testPath, colors.blue)}`);
  console.log(`\n${colorize('Calculator:', colors.gray)} ${calcName}`);
  console.log(`${colorize('Display name:', colors.gray)} ${formatDisplayName(calcName)}`);
  console.log(`${colorize('Translation key:', colors.gray)} ${calcInfo.translationKey}`);

  console.log(`\n${colorize('Next steps:', colors.yellow)}`);
  console.log(`  1. Review the generated test file`);
  console.log(`  2. Replace placeholder tests with actual test scenarios`);
  console.log(`  3. Run tests: ${colorize('npm test', colors.blue)}`);
  console.log(`  4. Run specific test: ${colorize(`npx playwright test ${calcName}`, colors.blue)}`);

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateTestTemplate, getCalculatorInfo };
