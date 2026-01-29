#!/usr/bin/env node

/**
 * Calculator Refactoring Tool for ProxyForGame
 *
 * Analyzes monolithic calculator JS files and suggests modularization.
 * Can optionally create the modular file structure.
 *
 * Run: node scripts/refactor-calculator.js <calculator-name> [--analyze] [--apply]
 * Example: node scripts/refactor-calculator.js expeditions --analyze
 */

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'www', 'ogame', 'calc', 'js');

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
 * Analyze JS file structure
 */
function analyzeJSFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const analysis = {
    totalLines: lines.length,
    hasOptions: false,
    hasCalculations: false,
    hasUIHandlers: false,
    hasHelperFunctions: false,
    hasDataStructures: false,
    functionCount: 0,
    optionsObjectSize: 0,
    suggestions: []
  };

  // Check for patterns
  const contentLower = content.toLowerCase();

  analysis.hasOptions = content.includes('var options') || content.includes('const options');
  analysis.hasCalculations = contentLower.includes('calculate') || contentLower.includes('calc') || contentLower.includes('compute');
  analysis.hasUIHandlers = content.includes('$(\'#\'') || content.includes('click') || content.includes('change');
  analysis.hasHelperFunctions = content.includes('function ') && !content.includes('calculate');
  analysis.hasDataStructures = content.includes('array(') || (content.includes('var ') && content.includes('='));

  // Count functions
  const functionMatches = content.match(/function\s+\w+/g);
  analysis.functionCount = functionMatches ? functionMatches.length : 0;

  // Estimate options object size
  if (analysis.hasOptions) {
    const optionsMatch = content.match(/var options\s*=\s*{([^}]+)}/s);
    if (optionsMatch) {
      const optionsContent = optionsMatch[1];
      analysis.optionsObjectSize = optionsContent.split(',').length;
    }
  }

  // Generate suggestions
  if (analysis.totalLines > 500) {
    analysis.suggestions.push({
      type: 'size',
      priority: 'high',
      message: `File is large (${analysis.totalLines} lines). Consider splitting into modules.`
    });
  }

  if (analysis.functionCount > 10) {
    analysis.suggestions.push({
      type: 'functions',
      priority: 'medium',
      message: `${analysis.functionCount} functions detected. Group related functions into modules.`
    });
  }

  if (analysis.hasOptions && analysis.optionsObjectSize > 20) {
    analysis.suggestions.push({
      type: 'options',
      priority: 'medium',
      message: `Options object has ${analysis.optionsObjectSize} properties. Consider separate data module.`
    });
  }

  if (analysis.hasCalculations && analysis.hasUIHandlers) {
    analysis.suggestions.push({
      type: 'separation',
      priority: 'high',
      message: 'Mixed calculations and UI handlers. Separate into core and renderer modules.'
    });
  }

  if (content.includes('// TODO') || content.includes('// FIXME')) {
    analysis.suggestions.push({
      type: 'todos',
      priority: 'low',
      message: 'File contains TODO/FIXME comments. Review and address before refactoring.'
    });
  }

  return analysis;
}

/**
 * Suggest modular structure
 */
function suggestModularStructure(analysis, calcName) {
  const modules = [];

  // Always suggest core module
  modules.push({
    name: `${calcName}-core.js`,
    purpose: 'Core calculation logic and data structures',
    estimatedLines: Math.floor(analysis.totalLines * 0.3)
  });

  // Suggest data collector if has data structures
  if (analysis.hasDataStructures || analysis.optionsObjectSize > 15) {
    modules.push({
      name: `${calcName}-data-collector.js`,
      purpose: 'Data collection and validation',
      estimatedLines: Math.floor(analysis.totalLines * 0.2)
    });
  }

  // Suggest renderer if has UI handlers
  if (analysis.hasUIHandlers) {
    modules.push({
      name: `${calcName}-renderer.js`,
      purpose: 'UI rendering and DOM manipulation',
      estimatedLines: Math.floor(analysis.totalLines * 0.25)
    });
  }

  // Suggest orchestration
  modules.push({
    name: `${calcName}-orchestration.js`,
    purpose: 'Event handling and coordination between modules',
    estimatedLines: Math.floor(analysis.totalLines * 0.25)
  });

  return modules;
}

/**
 * Print analysis report
 */
function printAnalysisReport(calcName, analysis, modules) {
  console.log('\n' + colorize('═════════════════════════════════════════════════════════', colors.cyan));
  console.log(colorize(`           Analysis Report: ${calcName}.js`, colors.cyan));
  console.log(colorize('═════════════════════════════════════════════════════════', colors.cyan));

  console.log(`\n${colorize('File Statistics:', colors.blue)}`);
  console.log(`  Total lines: ${analysis.totalLines}`);
  console.log(`  Functions: ${analysis.functionCount}`);
  console.log(`  Options properties: ${analysis.optionsObjectSize}`);

  console.log(`\n${colorize('Detected Components:', colors.blue)}`);
  console.log(`  ${analysis.hasOptions ? '✓' : '✗'} Options object`);
  console.log(`  ${analysis.hasCalculations ? '✓' : '✗'} Calculation logic`);
  console.log(`  ${analysis.hasUIHandlers ? '✓' : '✗'} UI event handlers`);
  console.log(`  ${analysis.hasHelperFunctions ? '✓' : '✗'} Helper functions`);
  console.log(`  ${analysis.hasDataStructures ? '✓' : '✗'} Data structures`);

  if (analysis.suggestions.length > 0) {
    console.log(`\n${colorize('Suggestions:', colors.yellow)}`);
    analysis.suggestions.forEach((suggestion, index) => {
      const priorityIcon = suggestion.priority === 'high' ? colorize('⚠', colors.red) :
                           suggestion.priority === 'medium' ? colorize('○', colors.yellow) :
                           colorize('○', colors.gray);
      console.log(`  ${priorityIcon} ${suggestion.message}`);
    });
  }

  console.log(`\n${colorize('Recommended Modular Structure:', colors.green)}`);
  modules.forEach((module, index) => {
    console.log(`\n  ${colorize(`${index + 1}. ${module.name}`, colors.blue)}`);
    console.log(`     Purpose: ${module.purpose}`);
    console.log(`     Est. lines: ~${module.estimatedLines}`);
  });

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

/**
 * Generate module template
 */
function generateModuleTemplate(calcName, moduleName, moduleType) {
  const displayName = calcName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const templates = {
    core: `// ${displayName} - Core Module
// Core calculation logic and data structures
// Auto-generated from refactor-calculator.js

const ${calcName}Core = (function() {
	'use strict';

	// Private data structures
	const data = {
		// Add your core data here
	};

	// Private calculation functions
	function calculateCore(input) {
		// Add core calculation logic
		return input;
	}

	// Public API
	return {
		calculate: calculateCore,
		data: data
	};
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = ${calcName}Core;
}
`,
    'data-collector': `// ${displayName} - Data Collector Module
// Data collection and validation
// Auto-generated from refactor-calculator.js

const ${calcName}DataCollector = (function() {
	'use strict';

	// Validate input data
	function validate(input) {
		// Add validation logic
		return true;
	}

	// Collect data from form inputs
	function collect() {
		// Add data collection logic
		return {};
	}

	// Sanitize data
	function sanitize(data) {
		// Add sanitization logic
		return data;
	}

	// Public API
	return {
		validate: validate,
		collect: collect,
		sanitize: sanitize
	};
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = ${calcName}DataCollector;
}
`,
    renderer: `// ${displayName} - Renderer Module
// UI rendering and DOM manipulation
// Auto-generated from refactor-calculator.js

const ${calcName}Renderer = (function() {
	'use strict';

	// Render results to DOM
	function renderResults(data) {
		// Add rendering logic
		$('#results').html(JSON.stringify(data));
	}

	// Clear results
	function clearResults() {
		$('#results').empty();
	}

	// Render error message
	function renderError(message) {
		$('#warning-message').text(message);
		$('#warning').show();
	}

	// Public API
	return {
		renderResults: renderResults,
		clearResults: clearResults,
		renderError: renderError
	};
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
	module.exports = ${calcName}Renderer;
}
`,
    orchestration: `// ${displayName} - Orchestration Module
// Event handling and coordination between modules
// Auto-generated from refactor-calculator.js

$(document).ready(function() {
	'use strict';

	// Load options from cookie
	try {
		loadFromCookie('options_${calcName}', options.prm);
	} catch(e) {
		console.error('Failed to load options:', e);
	}

	// Initialize UI
	initializeUI();

	// Set up event handlers
	setupEventHandlers();

	// Initial calculation
	calculate();
});

function initializeUI() {
	// Initialize UI elements
	// Reset buttons, default values, etc.
}

function setupEventHandlers() {
	// Reset button
	$('#reset').click(function() {
		resetParams();
		calculate();
	});

	// Input change handlers
	$('input').change(function() {
		var fieldName = $(this).attr('id');
		var fieldValue = $(this).val();

		if (options.prm.validate && options.prm.validate(fieldName, fieldValue) !== undefined) {
			options.prm[fieldName] = options.prm.validate(fieldName, fieldValue);
			$(this).val(options.prm[fieldName]);
		}

		calculate();
		saveOptions();
	});
}

function calculate() {
	// Use modules to perform calculation
	// const data = ${calcName}DataCollector.collect();
	// const result = ${calcName}Core.calculate(data);
	// ${calcName}Renderer.renderResults(result);
}

function resetParams() {
	// Reset all parameters to defaults
	// Reset UI elements
}

function saveOptions() {
	// Save options to cookie
	saveToCookie('options_${calcName}', options.prm);
}
`
  };

  return templates[moduleType] || `// ${moduleName}\n// Module template\n`;
}

/**
 * Create modular files
 */
function createModularFiles(calcName, modules) {
  console.log(colorize('\nCreating modular file structure...', colors.cyan));

  const moduleTypes = {
    [`${calcName}-core.js`]: 'core',
    [`${calcName}-data-collector.js`]: 'data-collector',
    [`${calcName}-renderer.js`]: 'renderer',
    [`${calcName}-orchestration.js`]: 'orchestration'
  };

  modules.forEach(module => {
    const moduleType = moduleTypes[module.name];
    if (moduleType) {
      const content = generateModuleTemplate(calcName, module.name, moduleType);
      const filePath = path.join(JS_DIR, module.name);

      if (fs.existsSync(filePath)) {
        console.log(colorize(`  ○ ${module.name} already exists, skipping`, colors.yellow));
      } else {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(colorize(`  ✓ Created ${module.name}`, colors.green));
      }
    }
  });

  // Create migration guide
  const guideContent = generateMigrationGuide(calcName, modules);
  const guidePath = path.join(JS_DIR, `${calcName}-MIGRATION.md`);
  fs.writeFileSync(guidePath, guideContent, 'utf8');

  console.log(colorize(`  ✓ Created migration guide: ${calcName}-MIGRATION.md`, colors.green));
}

/**
 * Generate migration guide
 */
function generateMigrationGuide(calcName, modules) {
  return `# ${calcName.toUpperCase()} Calculator - Migration Guide

This guide helps you migrate from the monolithic \`${calcName}.js\` to the modular structure.

## New File Structure

\`\`\`
ogame/calc/js/
├── ${calcName}.js                    # Original file (keep as backup)
├── ${calcName}-core.js               # Core calculation logic
├── ${calcName}-data-collector.js     # Data collection and validation
├── ${calcName}-renderer.js           # UI rendering
├── ${calcname}-orchestration.js      # Event handling and coordination
└── ${calcName}-MIGRATION.md          # This file
\`\`\`

## Migration Steps

### Step 1: Identify Core Logic
Move pure calculation functions (no DOM access) to \`${calcName}-core.js\`.

**Before (${calcName}.js):**
\`\`\`javascript
function calculateResult(value) {
    return value * 2;
}
\`\`\`

**After (${calcName}-core.js):**
\`\`\`javascript
const ${calcName}Core = (function() {
    function calculateResult(value) {
        return value * 2;
    }

    return {
        calculate: calculateResult
    };
})();
\`\`\`

### Step 2: Extract Data Collection
Move data gathering and validation to \`${calcName}-data-collector.js\`.

### Step 3: Extract Rendering
Move all DOM manipulation to \`${calcName}-renderer.js\`.

### Step 4: Update Orchestration
Update \`${calcName}-orchestration.js\` to coordinate the modules.

### Step 5: Update Template
Update \`${calcName}.tpl\` to load the new modules:

\`\`\`html
<script type="text/javascript" src="/ogame/calc/js/${calcName}-core.js"></script>
<script type="text/javascript" src="/ogame/calc/js/${calcName}-data-collector.js"></script>
<script type="text/javascript" src="/ogame/calc/js/${calcName}-renderer.js"></script>
<script type="text/javascript" src="/ogame/calc/js/${calcName}-orchestration.js"></script>
\`\`\`

### Step 6: Test
Test thoroughly after each step. Run the Playwright tests:

\`\`\`bash
npx playwright test ${calcName}
\`\`\`

## Benefits of Modularization

1. **Maintainability**: Easier to locate and fix bugs
2. **Testability**: Can test individual modules separately
3. **Reusability**: Modules can be reused in other calculators
4. **Collaboration**: Multiple developers can work on different modules
5. **Performance**: Better code organization can lead to optimization opportunities

## Rollback Plan

If issues arise:
1. Keep \`${calcName}.js\` as a backup
2. Restore original script tags in template
3. Remove new module script tags

## Questions?

Refer to the existing modular implementations:
- \`costs-core.js\`, \`costs-data-collector.js\`, etc.
`;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(colorize('Usage: node scripts/refactor-calculator.js <calculator-name> [--analyze] [--apply]', colors.yellow));
    console.error(colorize('Example: node scripts/refactor-calculator.js expeditions --analyze', colors.gray));
    process.exit(1);
  }

  const calcName = args[0].toLowerCase().replace('.js', '');
  const analyzeMode = args.includes('--analyze');
  const applyMode = args.includes('--apply');

  const jsPath = path.join(JS_DIR, `${calcName}.js`);

  if (!fs.existsSync(jsPath)) {
    console.error(colorize(`Error: Calculator not found: ${calcName}.js`, colors.red));
    console.error(colorize(`Expected path: ${jsPath}`, colors.gray));
    process.exit(1);
  }

  // Analyze the file
  const analysis = analyzeJSFile(jsPath);

  // Suggest modular structure
  const modules = suggestModularStructure(analysis, calcName);

  // Print report
  printAnalysisReport(calcName, analysis, modules);

  // Apply if requested
  if (applyMode) {
    const response = require('readline-sync').question(
      colorize('\nCreate modular files? (yes/no): ', colors.yellow)
    );

    if (response.toLowerCase() === 'yes') {
      createModularFiles(calcName, modules);

      console.log(colorize('\n✓ Modularization complete!', colors.green));
      console.log(colorize(`\nNext steps:`, colors.yellow));
      console.log(`  1. Review the migration guide: ${colorize(`ogame/calc/js/${calcName}-MIGRATION.md`, colors.blue)}`);
      console.log(`  2. Migrate code from ${colorize(`${calcName}.js`, colors.blue)} to the new modules`);
      console.log(`  3. Update ${colorize(`${calcName}.tpl`, colors.blue)} to load the new modules`);
      console.log(`  4. Test the calculator`);
    } else {
      console.log(colorize('\n○ Modularization cancelled.', colors.yellow));
    }
  } else {
    console.log(colorize('\nRun with --apply to create the modular files.', colors.gray));
  }

  console.log('\n' + colorize('──────────────────────────────────────────────────────────', colors.gray));
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeJSFile, suggestModularStructure };
