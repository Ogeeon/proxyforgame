#!/usr/bin/env node

/**
 * Documentation Generator for ProxyForGame Calculators
 *
 * Generates markdown documentation for calculators by analyzing
 * their PHP, JavaScript, and template files.
 *
 * Run: node scripts/generate-docs.js [calculator-name]
 * Example: node scripts/generate-docs.js
 *          node scripts/generate-docs.js graviton
 */

const fs = require('fs');
const path = require('path');

const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'calculators');

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
 * Get all calculator names
 */
function getCalculators() {
  const files = fs.readdirSync(CALC_DIR)
    .filter(file => file.endsWith('.php') && !file.startsWith('h_'));

  return files.map(file => file.replace('.php', ''));
}

/**
 * Extract information from calculator files
 */
function extractCalculatorInfo(calcName) {
  const info = {
    name: calcName,
    title: '',
    description: '',
    url: `/ogame/calc/${calcName}.php`,
    hasTest: false,
    features: [],
    options: [],
    outputs: []
  };

  // Read PHP file
  const phpPath = path.join(CALC_DIR, `${calcName}.php`);
  if (fs.existsSync(phpPath)) {
    const phpContent = fs.readFileSync(phpPath, 'utf8');
    const match = phpContent.match(/Intl::getTranslations\(\$lang,\s*['"]([^'"]+)['"]\)/);
    if (match) {
      info.translationKey = match[1];
    }
  }

  // Read JS file to extract options
  const jsPath = path.join(CALC_DIR, 'js', `${calcName}.js`);
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // Extract options object properties
    const optionsMatch = jsContent.match(/prm:\s*{([^}]+)}/s);
    if (optionsMatch) {
      const optionsContent = optionsMatch[1];
      const propertyMatches = optionsContent.matchAll(/(\w+)\s*:/g);
      for (const match of propertyMatches) {
        info.options.push(match[1]);
      }
    }

    // Count functions
    const functionMatches = jsContent.match(/function\s+(\w+)/g);
    if (functionMatches) {
      info.functions = functionMatches.length;
    }
  }

  // Check for test file
  const testPath = path.join(__dirname, '..', 'playwright-tests', 'tests', `${calcName}.spec.js`);
  info.hasTest = fs.existsSync(testPath);

  return info;
}

/**
 * Read translations for description
 */
function getTranslations(calcName) {
  const localePath = path.join(__dirname, '..', 'www', 'locale', 'en.json');
  if (!fs.existsSync(localePath)) {
    return { title: calcName, description: '' };
  }

  const content = fs.readFileSync(localePath, 'utf8');
  const data = JSON.parse(content);

  if (data[calcName]) {
    return {
      title: data[calcName].title || calcName,
      description: data[calcName].description || '',
      keywords: data[calcName].keywords || ''
    };
  }

  return { title: calcName, description: '', keywords: '' };
}

/**
 * Generate documentation for a calculator
 */
function generateCalculatorDocs(calcName) {
  const info = extractCalculatorInfo(calcName);
  const translations = getTranslations(info.translationKey || calcName);

  const displayName = translations.title || calcName;
  const docs = [];

  docs.push(`# ${displayName}`);
  docs.push('');
  docs.push(`**URL:** \`http://pfg.wmp${info.url}\``);
  docs.push('');

  if (translations.description) {
    docs.push(`## Description`);
    docs.push('');
    docs.push(translations.description);
    docs.push('');
  }

  if (translations.keywords) {
    docs.push(`**Keywords:** ${translations.keywords}`);
    docs.push('');
  }

  // Technical details
  docs.push(`## Technical Details`);
  docs.push('');
  docs.push(`| Property | Value |`);
  docs.push(`|----------|-------|`);
  docs.push(`| PHP Controller | \`www/ogame/calc/${calcName}.php\` |`);
  docs.push(`| Template | \`www/ogame/calc/${calcName}.tpl\` |`);
  docs.push(`| JavaScript | \`www/ogame/calc/js/${calcName}.js\` |`);
  docs.push(`| CSS | \`www/ogame/calc/css/${calcName}.css\` |`);
  docs.push(`| Tests | ${info.hasTest ? '✅' : '❌'} \`playwright-tests/tests/${calcName}.spec.js\` |`);
  docs.push('');

  if (info.options.length > 0) {
    docs.push(`## Configuration Options`);
    docs.push('');
    docs.push('The calculator supports the following options (stored in cookies):');
    docs.push('');
    info.options.forEach(opt => {
      docs.push(`- \`${opt}\``);
    });
    docs.push('');
  }

  if (info.functions) {
    docs.push(`## Code Statistics`);
    docs.push('');
    docs.push(`- JavaScript functions: ${info.functions}`);
    docs.push('');
  }

  // Usage
  docs.push(`## Usage`);
  docs.push('');
  docs.push(`1. Navigate to [${displayName}](http://pfg.wmp${info.url})`);
  docs.push(`2. Configure input parameters`);
  docs.push(`3. View calculated results`);
  docs.push('');

  // Development notes
  docs.push(`## Development Notes`);
  docs.push('');
  docs.push(`### File Structure`);
  docs.push('');
  docs.push('```');
  docs.push(`www/ogame/calc/`);
  docs.push(`├── ${calcName}.php      # Controller`);
  docs.push(`├── ${calcName}.tpl      # Template`);
  docs.push(`├── js/${calcName}.js    # Logic`);
  docs.push(`└── css/${calcName}.css  # Styles`);
  docs.push('```');
  docs.push('');

  docs.push(`### Testing`);
  docs.push('');
  if (info.hasTest) {
    docs.push(`Run tests:`);
    docs.push('```bash');
    docs.push(`npx playwright test ${calcName}`);
    docs.push('```');
  } else {
    docs.push(colorize('⚠️ No tests available', colors.yellow));
  }
  docs.push('');

  docs.push(`### Translation`);
  docs.push('');
  docs.push(`Translation key: \`${info.translationKey || calcName}\``);
  docs.push(`Translation files: \`www/locale/*.json\``);
  docs.push('');

  docs.push('---');
  docs.push('');
  docs.push(`*Documentation generated automatically by scripts/generate-docs.js*`);
  docs.push('');

  return docs.join('\n');
}

/**
 * Generate index of all calculators
 */
function generateIndex(calculators) {
  const lines = [];

  lines.push('# ProxyForGame Calculators');
  lines.push('');
  lines.push('This directory contains documentation for all OGame calculators.');
  lines.push('');
  lines.push('## Available Calculators');
  lines.push('');

  calculators.forEach(calc => {
    const translations = getTranslations(calc);
    lines.push(`### [${translations.title || calc}](${calc}.md)`);
    lines.push('');
    if (translations.description) {
      lines.push(`${translations.description}`);
      lines.push('');
    }
    lines.push(`**View:** [${translations.title || calc}](http://pfg.wmp/ogame/calc/${calc}.php)`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const specificCalc = args[0] ? args[0].toLowerCase().replace('.php', '') : null;

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              Documentation Generator', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  // Create docs directory
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  if (specificCalc) {
    // Generate docs for specific calculator
    console.log(colorize(`\nGenerating documentation for: ${specificCalc}`, colors.gray));

    const docs = generateCalculatorDocs(specificCalc);
    const outputPath = path.join(DOCS_DIR, `${specificCalc}.md`);
    fs.writeFileSync(outputPath, docs, 'utf8');

    console.log(colorize(`✓ Created: ${outputPath}`, colors.green));
  } else {
    // Generate docs for all calculators
    const calculators = getCalculators();
    console.log(colorize(`\nFound ${calculators.length} calculators`, colors.gray));

    for (const calc of calculators) {
      const docs = generateCalculatorDocs(calc);
      const outputPath = path.join(DOCS_DIR, `${calc}.md`);
      fs.writeFileSync(outputPath, docs, 'utf8');
      console.log(colorize(`  ✓ ${calc}.md`, colors.green));
    }

    // Generate index
    const index = generateIndex(calculators);
    fs.writeFileSync(path.join(DOCS_DIR, 'README.md'), index, 'utf8');
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

module.exports = { generateCalculatorDocs };
