#!/usr/bin/env node

/**
 * Calculator Generator for ProxyForGame
 *
 * Generates all necessary files for a new calculator (Bootstrap 5 stack):
 * - PHP controller
 * - TPL template
 * - JS modules (core / data-collector / renderer / orchestration skeletons)
 * - CSS file (basic)
 * - Test file template
 * - Translation keys (with sync)
 * - Sidebar navigation update
 *
 * Run: node scripts/new-calculator.js <calculator-name> --title="Display Title"
 * Example: node scripts/new-calculator.js fleet-optimizer --title="Fleet Optimizer"
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');
const JS_DIR = path.join(CALC_DIR, 'js');
const CSS_DIR = path.join(CALC_DIR, 'css');
const LOCALE_DIR = path.join(__dirname, '..', 'www', 'locale');
const SIDEBAR_FILE = path.join(__dirname, '..', 'www', 'sidebar_bs.tpl');
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
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    name: null,
    title: null,
    skipExisting: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--title=')) {
      result.title = args[i].split('=')[1];
    } else if (args[i] === '--skip-existing') {
      result.skipExisting = true;
    } else if (!args[i].startsWith('--')) {
      result.name = args[i];
    }
  }

  if (!result.name) {
    return null;
  }

  // Generate title from name if not provided
  if (!result.title) {
    result.title = result.name.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  return result;
}

/**
 * Format display name from calculator name, e.g. "fleet-optimizer" -> "Fleet Optimizer"
 */
function formatDisplayName(calcName) {
  return calcName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Format PascalCase identifier from calculator name, e.g. "fleet-optimizer" -> "FleetOptimizer"
 */
function formatPascalName(calcName) {
  return calcName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
}

/**
 * Format camelCase identifier from calculator name, e.g. "fleet-optimizer" -> "fleetOptimizer"
 */
function formatCamelName(calcName) {
  const pascal = formatPascalName(calcName);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Generate PHP controller content
 */
function generatePHP(calcName) {
  return `<?php

require_once '../../langs.php';
$lang = getLang();
$currUrl = '/ogame/calc/${calcName}.php';

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, '${calcName}');

require_once '${calcName}.tpl';
`;
}

/**
 * Generate TPL template content (Bootstrap 5 stack, no jQuery)
 */
function generateTPL(calcName) {
  const pascalName = formatPascalName(calcName);

  return `<!DOCTYPE html>
<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
  <meta http-equiv="Cache-Control" content="no-cache" />
  <title><?= $l['title'] ?></title>
  <meta name="description" content="<?= $l['title'] ?>"/>
  <meta name="keywords" content="<?= $l['keywords'] ?>"/>
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
  <link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<?php
  if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com') {
    $pfgPath = $_SERVER['DOCUMENT_ROOT'];
  } else {
    $pfgPath = "D:\\Programming\\JS\\pfg.wmp\\www";
  };
?>
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet"/>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet" />
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet"/>
  <link type="text/css" href="/ogame/calc/css/${calcName}_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/${calcName}_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries and calculator modules -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/${calcName}-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/${calcName}-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/${calcName}-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/${calcName}-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/${calcName}-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/${calcName}-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/${calcName}-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/${calcName}-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // \`options\` is defined in ${calcName}-orchestration.js; here we only fill in
    // the translation strings the renderer and validators read.
    options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = '<?= $l['field-hint'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
  </script>
<?php require_once '../../cookies.tpl'; ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once '../../sidebar_bs.tpl'; ?></div>
    <div class="col-md-10">
    <?php require_once '../../topbar_bs.tpl'; ?>

<div id="${calcName}">
  <div class="border rounded position-relative">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['title'] ?></div>
      <div id="reset" class="d-flex align-items-center justify-content-center bg-danger-subtle" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <!-- Parameters -->
    <div id="general-settings-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['parameters'] ?></b></p>
      <div id="general-settings" class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
        <!-- Add your calculator inputs here -->
        <div class="d-flex align-items-center gap-1">
          <label for="input1"><?= $l['input1'] ?></label>
          <input id="input1" type="text" name="input1" class="form-control form-control-sm" value="0" alt="<?= $l['input1'] ?>"/>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div id="results-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['results'] ?></b></p>
      <div id="results">
        <!-- Results will be displayed here -->
      </div>
    </div>
  </div>

  <div id="warning">
    <div id="warning-message"></div>
  </div>
</div>

    </div> <!-- End col-md-10 -->
  </div> <!-- End row -->
</div> <!-- End container-fluid -->
<?php
  require_once '../../analitics.tpl';
?>

<script type="text/javascript">
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
    bootstrap.Tooltip.getOrCreateInstance(el);
  });
  initialize${pascalName}Calculator();
});
</script>

</body>
</html>
`;
}

/**
 * Generate the core module content (pure calculation logic, no DOM access)
 */
function generateCoreJS(calcName) {
  const pascalName = formatPascalName(calcName);
  const displayName = formatDisplayName(calcName);

  return `// ============================================================================
// ${displayName.toUpperCase()} CALCULATOR - CORE
// ============================================================================
// Pure calculation logic. No DOM access here - keep this module testable
// from node:test via unit-tests/${calcName}-core.test.js.

'use strict';

/**
 * Calculates the results for the ${displayName} calculator.
 * @param {Object} params - collected input values (see collect${pascalName}Params)
 * @returns {Object} computed results
 */
function calculate${pascalName}(params) {
  // Add your calculation logic here
  return {
    result: params.input1 * 2
  };
}
`;
}

/**
 * Generate the data-collector module content (reads inputs from the DOM)
 */
function generateDataCollectorJS(calcName) {
  const pascalName = formatPascalName(calcName);
  const displayName = formatDisplayName(calcName);

  return `// ============================================================================
// ${displayName.toUpperCase()} CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads calculator inputs from the DOM.

'use strict';

/**
 * Reads the general settings panel into a plain params object.
 */
function collect${pascalName}Params() {
  return {
    input1: getInputNumber($('#input1'))
  };
}
`;
}

/**
 * Generate the renderer module content (writes results back into the DOM)
 */
function generateRendererJS(calcName) {
  const pascalName = formatPascalName(calcName);
  const displayName = formatDisplayName(calcName);

  return `// ============================================================================
// ${displayName.toUpperCase()} CALCULATOR - RENDERER
// ============================================================================
// Writes computed results back into the DOM.

'use strict';

/**
 * Renders the results object (see calculate${pascalName}) into #results.
 * @param {Object} results
 */
function render${pascalName}Results(results) {
  setTextContent('#results', String(results.result));
}
`;
}

/**
 * Generate the orchestration module content (options, event wiring, init)
 */
function generateOrchestrationJS(calcName) {
  const pascalName = formatPascalName(calcName);
  const camelName = formatCamelName(calcName);
  const displayName = formatDisplayName(calcName);

  return `// ============================================================================
// ${displayName.toUpperCase()} CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns \`options\` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores the saved state on load.

'use strict';

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  prm: {
    input1: 0,

    validate: function (field, value) {
      switch (field) {
        case 'input1': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
        default: return value;
      }
    }
  },

  load: function () {
    try { loadFromCookie('options_${calcName}', options.prm); } catch (e) { console.error(e); }
  },
  save: function () { saveToCookie('options_${calcName}', options.prm); }
};

class ${pascalName}App {
  init() {
    options.load();
    this._restoreFromState();
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  _restoreFromState() {
    setVal('#input1', options.prm.input1);
  }

  _applyConstraints() {
    const input1 = document.getElementById('input1');
    if (input1) input1._constrains = { min: 0, def: 0 };
  }

  _bindEvents() {
    addEvent('#input1', 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
    addEvent('#input1', 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });

    addEvent('#reset', 'click', () => this._resetParams());

    // Theme toggle (rendered inside topbar_bs).
    const lightCb = $('#cb-light-theme');
    if (lightCb) {
      lightCb.addEventListener('click', () => {
        if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
      });
    }
  }

  _applyTheme() {
    const theme = { value: 'light', validate: (k, v) => v };
    loadFromCookie('theme', theme);
    if (typeof toggleLightBS === 'function') {
      toggleLightBS(theme.value === 'light');
    }
  }

  _resetParams() {
    options.prm.input1 = 0;
    this._restoreFromState();
    this.recalc();
  }

  recalc() {
    const params = collect${pascalName}Params();
    options.prm.input1 = params.input1;
    options.save();
    const results = calculate${pascalName}(params);
    render${pascalName}Results(results);
  }
}

let ${camelName}App = null;

function initialize${pascalName}Calculator() {
  ${camelName}App = new ${pascalName}App();
  ${camelName}App.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThis.${camelName}App = ${camelName}App;
}

if (typeof globalThis !== 'undefined') {
  globalThis.initialize${pascalName}Calculator = initialize${pascalName}Calculator;
  globalThis.${pascalName}App = ${pascalName}App;
}
`;
}

/**
 * Generate CSS file content
 */
function generateCSS(calcName) {
  return `/* ${calcName} calculator styles */
/* Auto-generated - Customize for your calculator */

#${calcName} {
  /* Add calculator-specific styles here */
}
`;
}

/**
 * Generate translation keys
 */
function generateTranslations(calcName, title) {
  return {
    [calcName]: {
      title: `OGame - ${title}`,
      keywords: `proxyforgame,proxy,online,calc,calculator,ogame,${calcName}`,
      parameters: "Parameters",
      input1: "Input 1",
      results: "Results"
    }
  };
}

/**
 * Add translation keys to en.json
 */
function addTranslationKeys(calcName, translations) {
  const enFile = path.join(LOCALE_DIR, 'en.json');
  const content = fs.readFileSync(enFile, 'utf8');
  const data = JSON.parse(content);

  // Add new section
  data[calcName] = translations[calcName];

  // Write back with proper formatting
  fs.writeFileSync(enFile, JSON.stringify(data, null, 2) + '\n', 'utf8');

  return true;
}

/**
 * Update sidebar navigation (www/sidebar_bs.tpl's $ogamePages array)
 */
function updateSidebar(calcName) {
  const content = fs.readFileSync(SIDEBAR_FILE, 'utf8');

  // Check if already exists
  if (content.includes(`/${calcName}.php`)) {
    return false; // Already exists
  }

  // Find the expeditions line and add after it
  const newEntry = `    array('/ogame/calc/${calcName}.php', '${calcName}-title'),\n`;
  const updatedContent = content.replace(
    /(    array\('\/ogame\/calc\/expeditions\.php', 'expeditions-title'\)\n)/,
    `${newEntry}$1`
  );

  fs.writeFileSync(SIDEBAR_FILE, updatedContent, 'utf8');
  return true;
}

/**
 * Generate test file (using existing script)
 */
function generateTest(calcName) {
  const testScript = path.join(__dirname, 'generate-test.js');

  try {
    execSync(`node "${testScript}" ${calcName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(colorize(`Warning: Test generation failed: ${error.message}`, colors.yellow));
    return false;
  }
}

/**
 * Check if files already exist
 */
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Main function
 */
function main() {
  const args = parseArgs();

  if (!args) {
    console.error(colorize('Usage: node scripts/new-calculator.js <name> [--title="Display Title"] [--skip-existing]', colors.yellow));
    console.error(colorize('Example: node scripts/new-calculator.js fleet-optimizer --title="Fleet Optimizer"', colors.gray));
    process.exit(1);
  }

  const { name: calcName, title, skipExisting } = args;

  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize('              New Calculator Generator', colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  console.log(`\n${colorize('Calculator:', colors.gray)} ${calcName}`);
  console.log(`${colorize('Title:', colors.gray)} ${title}`);

  // Check for existing files
  const filesToCreate = [
    { path: path.join(CALC_DIR, `${calcName}.php`), name: 'PHP controller' },
    { path: path.join(CALC_DIR, `${calcName}.tpl`), name: 'TPL template' },
    { path: path.join(JS_DIR, `${calcName}-core.js`), name: 'Core JS module' },
    { path: path.join(JS_DIR, `${calcName}-data-collector.js`), name: 'Data-collector JS module' },
    { path: path.join(JS_DIR, `${calcName}-renderer.js`), name: 'Renderer JS module' },
    { path: path.join(JS_DIR, `${calcName}-orchestration.js`), name: 'Orchestration JS module' },
    { path: path.join(CSS_DIR, `${calcName}_bs.css`), name: 'CSS file' },
    { path: path.join(TESTS_DIR, `${calcName}.spec.js`), name: 'Test file' }
  ];

  const existingFiles = filesToCreate.filter(f => checkFileExists(f.path));

  if (existingFiles.length > 0 && !skipExisting) {
    console.error(colorize('\n✗ Error: Some files already exist:', colors.red));
    existingFiles.forEach(f => {
      console.error(colorize(`  • ${f.name}: ${f.path}`, colors.gray));
    });
    console.error(colorize('\nUse --skip-existing to skip existing files and continue.', colors.yellow));
    process.exit(1);
  }

  const filesToActuallyCreate = skipExisting
    ? filesToCreate.filter(f => !checkFileExists(f.path))
    : filesToCreate;

  if (filesToActuallyCreate.length === 0) {
    console.log(colorize('\n○ All files already exist. Nothing to create.', colors.yellow));
    process.exit(0);
  }

  // Create files
  let created = 0;
  let skipped = 0;

  const writeIfMissing = (filePath, content, label) => {
    if (!checkFileExists(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(colorize(`  ✓ ${label} created`, colors.green));
      created++;
    } else {
      console.log(colorize(`  ○ ${label} already exists, skipping`, colors.yellow));
      skipped++;
    }
  };

  writeIfMissing(path.join(CALC_DIR, `${calcName}.php`), generatePHP(calcName), 'PHP controller');
  writeIfMissing(path.join(CALC_DIR, `${calcName}.tpl`), generateTPL(calcName), 'TPL template');
  writeIfMissing(path.join(JS_DIR, `${calcName}-core.js`), generateCoreJS(calcName), 'Core JS module');
  writeIfMissing(path.join(JS_DIR, `${calcName}-data-collector.js`), generateDataCollectorJS(calcName), 'Data-collector JS module');
  writeIfMissing(path.join(JS_DIR, `${calcName}-renderer.js`), generateRendererJS(calcName), 'Renderer JS module');
  writeIfMissing(path.join(JS_DIR, `${calcName}-orchestration.js`), generateOrchestrationJS(calcName), 'Orchestration JS module');
  writeIfMissing(path.join(CSS_DIR, `${calcName}_bs.css`), generateCSS(calcName), 'CSS file');

  // Add translation keys
  console.log(colorize(`\n  Adding translation keys to en.json...`, colors.gray));
  const translations = generateTranslations(calcName, title);
  addTranslationKeys(calcName, translations);
  console.log(colorize(`  ✓ Translation keys added`, colors.green));

  // Sync translations to all locales
  console.log(colorize(`\n  Syncing translations to all locale files...`, colors.gray));
  try {
    execSync('node scripts/sync-translations.js --fix', { stdio: 'pipe' });
    console.log(colorize(`  ✓ Translations synced to all locales`, colors.green));
  } catch (error) {
    console.error(colorize(`  ⚠ Translation sync failed: ${error.message}`, colors.yellow));
  }

  // Update sidebar
  console.log(colorize(`\n  Updating sidebar navigation...`, colors.gray));
  const sidebarUpdated = updateSidebar(calcName);
  if (sidebarUpdated) {
    console.log(colorize(`  ✓ Sidebar navigation updated`, colors.green));
  } else {
    console.log(colorize(`  ○ Sidebar already has entry, skipping`, colors.yellow));
  }

  // Generate test
  console.log(colorize(`\n  Generating test file...`, colors.gray));
  if (!checkFileExists(path.join(TESTS_DIR, `${calcName}.spec.js`))) {
    generateTest(calcName);
    console.log(colorize(`  ✓ Test file created`, colors.green));
    created++;
  } else {
    console.log(colorize(`  ○ Test file already exists, skipping`, colors.yellow));
    skipped++;
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
  console.log(colorize(`\n✓ Calculator "${calcName}" created successfully!`, colors.green));
  console.log(colorize(`\nFiles created: ${created}`, colors.green));
  if (skipped > 0) {
    console.log(colorize(`Files skipped: ${skipped}`, colors.yellow));
  }

  console.log(colorize(`\nNext steps:`, colors.yellow));
  console.log(`  1. Customize the calculation logic in ${colorize(`www/ogame/calc/js/${calcName}-core.js`, colors.blue)}`);
  console.log(`  2. Customize input reading in ${colorize(`www/ogame/calc/js/${calcName}-data-collector.js`, colors.blue)}`);
  console.log(`  3. Customize result rendering in ${colorize(`www/ogame/calc/js/${calcName}-renderer.js`, colors.blue)}`);
  console.log(`  4. Add params/fields and event wiring in ${colorize(`www/ogame/calc/js/${calcName}-orchestration.js`, colors.blue)}`);
  console.log(`  5. Update the HTML structure in ${colorize(`www/ogame/calc/${calcName}.tpl`, colors.blue)}`);
  console.log(`  6. Adjust styles in ${colorize(`www/ogame/calc/css/${calcName}_bs.css`, colors.blue)}`);
  console.log(`  7. Translate placeholder keys in all locale files`);
  console.log(`  8. Implement test scenarios in ${colorize(`playwright-tests/tests/${calcName}.spec.js`, colors.blue)}`);
  console.log(`  9. Test the calculator at ${colorize(`http://pfg.wmp/ogame/calc/${calcName}.php`, colors.blue)}`);

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generatePHP, generateTPL, generateCoreJS, generateDataCollectorJS, generateRendererJS, generateOrchestrationJS, generateCSS };
