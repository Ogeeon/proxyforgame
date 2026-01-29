#!/usr/bin/env node

/**
 * Code Quality Checker for ProxyForGame
 *
 * Analyzes calculator code for consistency issues, potential bugs,
 * and deviations from established patterns.
 *
 * Run: node scripts/check-code-quality.js [calculator-name]
 * Example: node scripts/check-code-quality.js
 *          node scripts/check-code-quality.js flight
 */

const fs = require('fs');
const path = require('path');

const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');
const JS_DIR = path.join(CALC_DIR, 'js');

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
 * Get all calculator JavaScript files
 */
function getCalculatorFiles() {
  const files = fs.readdirSync(JS_DIR)
    .filter(file => file.endsWith('.js') && !file.includes('-core') && !file.includes('-data') && !file.includes('-renderer') && !file.includes('-orchestration'));

  return files.map(file => file.replace('.js', ''));
}

/**
 * Analyze a single calculator file for quality issues
 */
function analyzeCalculator(calcName) {
  const filePath = path.join(JS_DIR, `${calcName}.js`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const issues = {
    errors: [],
    warnings: [],
    info: [],
    metrics: {
      totalLines: lines.length,
      blankLines: 0,
      commentLines: 0,
      codeLines: 0,
      functionCount: 0
    }
  };

  // Count lines
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === '') {
      issues.metrics.blankLines++;
    } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      issues.metrics.commentLines++;
    } else {
      issues.metrics.codeLines++;
    }
  });

  // Check for jQuery 1.5.1 compatibility issues
  if (content.includes('.prop(')) {
    issues.warnings.push({
      type: 'jquery-compatibility',
      message: 'Uses .prop() which may not be available in jQuery 1.5.1',
      line: findLineNumber(content, '.prop(')
    });
  }

  if (content.includes('.on(')) {
    issues.warnings.push({
      type: 'jquery-compatibility',
      message: 'Uses .on() which may not be available in jQuery 1.5.1 (use .bind(), .click(), etc.)',
      line: findLineNumber(content, '.on(')
    });
  }

  // Check for console.log statements (should be removed in production)
  const consoleLogMatches = content.match(/console\.log/g);
  if (consoleLogMatches) {
    issues.warnings.push({
      type: 'debug-code',
      message: `Found ${consoleLogMatches.length} console.log() statement(s) - remove for production`,
      line: findLineNumber(content, 'console.log')
    });
  }

  // Check for alert() statements (use UI dialogs instead)
  const alertMatches = content.match(/alert\(/g);
  if (alertMatches) {
    issues.errors.push({
      type: 'user-experience',
      message: `Found ${alertMatches.length} alert() statement(s) - use UI dialogs instead`,
      line: findLineNumber(content, 'alert(')
    });
  }

  // Check for options object
  if (!content.includes('var options') && !content.includes('const options')) {
    issues.errors.push({
      type: 'structure',
      message: 'Missing options object - calculators should have an options object for state management'
    });
  }

  // Check for validate function
  if (!content.includes('validate:')) {
    issues.warnings.push({
      type: 'validation',
      message: 'Options object missing validate function - input validation may not occur'
    });
  }

  // Check for load/save functions
  if (!content.includes('loadFromCookie')) {
    issues.warnings.push({
      type: 'persistence',
      message: 'Missing loadFromCookie call - user settings may not persist'
    });
  }

  if (!content.includes('saveToCookie')) {
    issues.warnings.push({
      type: 'persistence',
      message: 'Missing saveToCookie call - user settings may not be saved'
    });
  }

  // Check for reset function
  if (!content.includes('function resetParams') && !content.includes('resetParams')) {
    issues.info.push({
      type: 'usability',
      message: 'No resetParams function found - consider adding for better UX'
    });
  }

  // Count functions
  const functionMatches = content.match(/function\s+\w+/g);
  issues.metrics.functionCount = functionMatches ? functionMatches.length : 0;

  // Check file size
  if (issues.metrics.totalLines > 1000) {
    issues.warnings.push({
      type: 'maintainability',
      message: `File is large (${issues.metrics.totalLines} lines) - consider modularization`
    });
  }

  // Check for TODO/FIXME comments
  const todoMatches = content.match(/\/\/\s*(TODO|FIXME):?\s*(.+)/g);
  if (todoMatches) {
    issues.info.push({
      type: 'todos',
      message: `Found ${todoMatches.length} TODO/FIXME comment(s) - review and address`,
      items: todoMatches.map(m => m.trim())
    });
  }

  // Check for magic numbers
  const numberPattern = /\b\d{4,}\b/g;
  const largeNumbers = content.match(numberPattern);
  if (largeNumbers && largeNumbers.length > 5) {
    issues.info.push({
      type: 'code-quality',
      message: 'Found magic numbers - consider using named constants'
    });
  }

  return issues;
}

/**
 * Find line number for a pattern
 */
function findLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      return i + 1;
    }
  }
  return null;
}

/**
 * Print quality report for a single calculator
 */
function printReport(calcName, analysis) {
  if (!analysis) {
    console.log(colorize(`\n✗ Calculator not found: ${calcName}`, colors.red));
    return;
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
  console.log(colorize(`${calcName.toUpperCase()}`, colors.cyan));
  console.log(colorize('──────────────────────────────────────────────────────────', colors.gray));

  // Metrics
  console.log(`\n${colorize('Metrics:', colors.blue)}`);
  console.log(`  Total lines: ${analysis.metrics.totalLines}`);
  console.log(`  Code lines: ${analysis.metrics.codeLines}`);
  console.log(`  Comment lines: ${analysis.metrics.commentLines}`);
  console.log(`  Blank lines: ${analysis.metrics.blankLines}`);
  console.log(`  Functions: ${analysis.metrics.functionCount}`);

  const commentRatio = analysis.metrics.totalLines > 0
    ? ((analysis.metrics.commentLines / analysis.metrics.totalLines) * 100).toFixed(1)
    : 0;
  console.log(`  Comment ratio: ${commentRatio}%`);

  // Errors
  if (analysis.errors.length > 0) {
    console.log(colorize(`\n❌ Errors (${analysis.errors.length}):`, colors.red));
    analysis.errors.forEach((error, i) => {
      const lineInfo = error.line ? ` (line ${error.line})` : '';
      console.log(`  ${i + 1}. [${error.type}] ${error.message}${lineInfo}`);
    });
  }

  // Warnings
  if (analysis.warnings.length > 0) {
    console.log(colorize(`\n⚠️  Warnings (${analysis.warnings.length}):`, colors.yellow));
    analysis.warnings.forEach((warning, i) => {
      const lineInfo = warning.line ? ` (line ${warning.line})` : '';
      console.log(`  ${i + 1}. [${warning.type}] ${warning.message}${lineInfo}`);
    });
  }

  // Info
  if (analysis.info.length > 0) {
    console.log(colorize(`\nℹ️  Info (${analysis.info.length}):`, colors.blue));
    analysis.info.forEach((info, i) => {
      if (info.items) {
        console.log(`  ${i + 1}. [${info.type}] ${info.message}`);
        info.items.forEach(item => {
          console.log(`     - ${item}`);
        });
      } else {
        console.log(`  ${i + 1}. [${info.type}] ${info.message}`);
      }
    });
  }

  if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
    console.log(colorize(`\n✅ No issues found!`, colors.green));
  }
}

/**
 * Print summary across all calculators
 */
function printSummary(allResults) {
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = allResults.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalInfo = allResults.reduce((sum, r) => sum + r.info.length, 0);

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('                    Overall Summary', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  console.log(`\nCalculators analyzed: ${allResults.length}`);
  console.log(colorize(`Total errors: ${totalErrors}`, totalErrors > 0 ? colors.red : colors.green));
  console.log(colorize(`Total warnings: ${totalWarnings}`, totalWarnings > 0 ? colors.yellow : colors.green));
  console.log(colorize(`Total info: ${totalInfo}`, colors.blue));

  // Show worst offenders
  const byWarnings = [...allResults].sort((a, b) => b.warnings.length - a.warnings.length);
  const byErrors = [...allResults].sort((a, b) => b.errors.length - a.errors.length);

  if (byErrors[0].errors.length > 0) {
    console.log(colorize(`\nMost errors: ${byErrors[0].name} (${byErrors[0].errors.length})`, colors.red));
  }

  if (byWarnings[0].warnings.length > 0) {
    console.log(colorize(`Most warnings: ${byWarnings[0].name} (${byWarnings[0].warnings.length})`, colors.yellow));
  }

  // Best quality
  const bestQuality = allResults
    .filter(r => r.errors.length === 0 && r.warnings.length === 0)
    .map(r => r.name);

  if (bestQuality.length > 0) {
    console.log(colorize(`\n✅ Best quality: ${bestQuality.join(', ')}`, colors.green));
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const specificCalc = args[0] ? args[0].toLowerCase().replace('.js', '') : null;

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('                 Code Quality Checker', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  if (specificCalc) {
    // Check specific calculator
    const analysis = analyzeCalculator(specificCalc);
    printReport(specificCalc, analysis);

    const exitCode = analysis && (analysis.errors.length > 0) ? 1 : 0;
    process.exit(exitCode);
  } else {
    // Check all calculators
    const calculators = getCalculatorFiles();
    const allResults = [];

    for (const calc of calculators) {
      const analysis = analyzeCalculator(calc);
      if (analysis) {
        analysis.name = calc;
        allResults.push(analysis);
        printReport(calc, analysis);
      }
    }

    printSummary(allResults);

    const hasErrors = allResults.some(r => r.errors.length > 0);
    process.exit(hasErrors ? 1 : 0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeCalculator };
