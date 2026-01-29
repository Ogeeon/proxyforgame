#!/usr/bin/env node

/**
 * Calculator Generator for ProxyForGame
 *
 * Generates all necessary files for a new calculator:
 * - PHP controller
 * - TPL template
 * - JS file (skeleton)
 * - CSS file (basic)
 * - Test file template
 * - Translation keys (with sync)
 * - Sidebar navigation update
 *
 * Run: node scripts/new-calculator.js <calculator-name> --title="Display Title"
 * Example: node scripts/new-calculator.js fleet-optimizer --title="Fleet Optimizer"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CALC_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc');
const JS_DIR = path.join(CALC_DIR, 'js');
const CSS_DIR = path.join(CALC_DIR, 'css');
const LOCALE_DIR = path.join(__dirname, '..', 'www', 'locale');
const SIDEBAR_FILE = path.join(__dirname, '..', 'www', 'sidebar.tpl');
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
 * Format display name from calculator name
 */
function formatDisplayName(calcName) {
  return calcName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Generate PHP controller content
 */
function generatePHP(calcName, title) {
  return `<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/${calcName}.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, '${calcName}');

require_once('${calcName}.tpl');

?>
`;
}

/**
 * Generate TPL template content
 */
function generateTPL(calcName, title) {
  const displayName = formatDisplayName(calcName);
  const cssName = calcName;

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
		$pfgPath = "D:\\\\Programming\\\\JS\\\\pfg.wmp\\\\www";
	};
?>
	<link id="light-theme" type="text/css" href="/css/redmond/jquery.ui.all.css" rel="stylesheet"/>
	<link id="dark-theme" type="text/css" href="/css/dark-hive/jquery.ui.all.css" rel="stylesheet" disabled="disabled"/>
	<link type="text/css" href="/css/langs.css?v=<?php echo filemtime($pfgPath.'/css/langs.css'); ?>" rel="stylesheet" />
	<link type="text/css" href="/css/common.css?v=<?php echo filemtime($pfgPath.'/css/common.css'); ?>" rel="stylesheet"/>
	<link type="text/css" href="/ogame/calc/css/${cssName}.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/${cssName}.css'); ?>" rel="stylesheet"/>

<?php if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com'): ?>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.min.js"></script>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jqueryui/1.8.11/jquery-ui.min.js"></script>
<?php elseif ( $_SERVER['SERVER_NAME'] == 'pfg.wmp'): ?>
	<script type="text/javascript" src="/js/jquery.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui.min.js"></script>
<?php else: ?>
	<script type="text/javascript" src="/js/jquery-1.5.1.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui-1.8.11.min.js"></script>
<?php endif; ?>
	<script type="text/javascript" src="/js/jquery.cookie.js"></script>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/${calcName}.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/${calcName}.js'); ?>"></script>

	<script type="text/javascript">
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator='<?= $l['decimal-separator'] ?>';
		options.datetimeW = '<?= $l['datetime-w'] ?>';
		options.datetimeD = '<?= $l['datetime-d'] ?>';
		options.datetimeH = '<?= $l['datetime-h'] ?>';
		options.datetimeM = '<?= $l['datetime-m'] ?>';
		options.datetimeS = '<?= $l['datetime-s'] ?>';
		options.scShort = '<?= $l['sc-short'] ?>';
		options.lcShort = '<?= $l['lc-short'] ?>';
		options.warnindDivId = 'warning';
		options.warnindMsgDivId = 'warning-message';
		options.fieldHint = '<?= $l['field-hint'] ?>';
		options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
		options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="${calcName}">
	<div class="ui-widget-content ui-corner-all no-mp">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['parameters'] ?></b></p>
				<div id="general-settings">
					<!-- Add your calculator inputs here -->
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="input1"><?= $l['input1'] ?></label></td>
							<td><input id="input1" type="text" name="input1" class="ui-state-default ui-corner-all ui-input ui-input-margin" value="0" /></td>
						</tr>
					</table>
				</div>
			</div>

			<div id="results-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['results'] ?></b></p>
				<div id="results">
					<!-- Results will be displayed here -->
				</div>
			</div>
		</div>
	</div>
</div>

</td>
</tr></table>
</body>

</html>
`;
}

/**
 * Generate JS file content (skeleton)
 */
function generateJS(calcName) {
  const displayName = formatDisplayName(calcName);

  return `// ${displayName} Calculator
// Auto-generated - Customize this file for your calculator logic

var options = {
	prm: {
		input1: 0,

		validate: function(field, value) {
			switch (field) {
				case 'input1': return validateNumber(parseFloat(value), 0, Infinity, 0);
				default: return value;
			}
		}
	},

	load: function() {
		try {
			loadFromCookie('options_${calcName}', options.prm);
		} catch(e) {
			alert(e);
		}
	},

	save: function() {
		saveToCookie('options_${calcName}', options.prm);
	}
};

function resetParams() {
	options.prm.input1 = 0;

	$('#input1').val(options.prm.input1);

	calculate();
}

function calculate() {
	// Add your calculation logic here
	// Update the results div with calculated values

	// Example:
	// var result = options.prm.input1 * 2;
	// $('#results').html('Result: ' + result);
}

$(document).ready(function() {
	options.load();
	resetParams();

	$('#reset').click(function() {
		resetParams();
	});

	// Add input change handlers
	$('input').change(function() {
		var fieldName = $(this).attr('id');
		var fieldValue = $(this).val();

		if (options.prm.validate(fieldName, fieldValue) !== undefined) {
			options.prm[fieldName] = options.prm.validate(fieldName, fieldValue);
			$(this).val(options.prm[fieldName]);
		} else {
			$(this).val(options.prm[fieldName]);
		}

		calculate();
		options.save();
	});
});
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

.ui-panel {
	margin: 5px;
	padding: 10px;
}

.ui-subheader {
	margin: 0 0 10px 0;
	padding: 5px;
}

.ui-input-margin {
	margin: 0 5px;
}

#results-panel {
	margin-top: 10px;
}
`;
}

/**
 * Generate translation keys
 */
function generateTranslations(calcName, title) {
  const displayName = formatDisplayName(calcName);

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
 * Update sidebar navigation
 */
function updateSidebar(calcName, title) {
  const content = fs.readFileSync(SIDEBAR_FILE, 'utf8');

  // Check if already exists
  if (content.includes(`/${calcName}.php`)) {
    return false; // Already exists
  }

  // Find the expeditions line and add after it
  const newEntry = `\tarray('/ogame/calc/${calcName}.php', '${calcName}-title')\n`;
  const updatedContent = content.replace(
    /(array\('\/ogame\/calc\/expeditions\.php', 'expeditions-title'\)\n)/,
    `$1${newEntry}`
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
    { path: path.join(JS_DIR, `${calcName}.js`), name: 'JavaScript file' },
    { path: path.join(CSS_DIR, `${calcName}.css`), name: 'CSS file' },
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

  // PHP
  if (!checkFileExists(path.join(CALC_DIR, `${calcName}.php`))) {
    const phpContent = generatePHP(calcName, title);
    fs.writeFileSync(path.join(CALC_DIR, `${calcName}.php`), phpContent, 'utf8');
    console.log(colorize(`  ✓ PHP controller created`, colors.green));
    created++;
  } else {
    console.log(colorize(`  ○ PHP controller already exists, skipping`, colors.yellow));
    skipped++;
  }

  // TPL
  if (!checkFileExists(path.join(CALC_DIR, `${calcName}.tpl`))) {
    const tplContent = generateTPL(calcName, title);
    fs.writeFileSync(path.join(CALC_DIR, `${calcName}.tpl`), tplContent, 'utf8');
    console.log(colorize(`  ✓ TPL template created`, colors.green));
    created++;
  } else {
    console.log(colorize(`  ○ TPL template already exists, skipping`, colors.yellow));
    skipped++;
  }

  // JS
  if (!checkFileExists(path.join(JS_DIR, `${calcName}.js`))) {
    const jsContent = generateJS(calcName);
    fs.writeFileSync(path.join(JS_DIR, `${calcName}.js`), jsContent, 'utf8');
    console.log(colorize(`  ✓ JavaScript file created`, colors.green));
    created++;
  } else {
    console.log(colorize(`  ○ JavaScript file already exists, skipping`, colors.yellow));
    skipped++;
  }

  // CSS
  if (!checkFileExists(path.join(CSS_DIR, `${calcName}.css`))) {
    const cssContent = generateCSS(calcName);
    fs.writeFileSync(path.join(CSS_DIR, `${calcName}.css`), cssContent, 'utf8');
    console.log(colorize(`  ✓ CSS file created`, colors.green));
    created++;
  } else {
    console.log(colorize(`  ○ CSS file already exists, skipping`, colors.yellow));
    skipped++;
  }

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
  const sidebarUpdated = updateSidebar(calcName, title);
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
  console.log(`  1. Customize the calculator logic in ${colorize(`www/ogame/calc/js/${calcName}.js`, colors.blue)}`);
  console.log(`  2. Update the HTML structure in ${colorize(`www/ogame/calc/${calcName}.tpl`, colors.blue)}`);
  console.log(`  3. Adjust styles in ${colorize(`www/ogame/calc/css/${calcName}.css`, colors.blue)}`);
  console.log(`  4. Translate placeholder keys in all locale files`);
  console.log(`  5. Implement test scenarios in ${colorize(`playwright-tests/tests/${calcName}.spec.js`, colors.blue)}`);
  console.log(`  6. Test the calculator at ${colorize(`http://pfg.wmp/ogame/calc/${calcName}.php`, colors.blue)}`);

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generatePHP, generateTPL, generateJS, generateCSS };
