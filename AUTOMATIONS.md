# ProxyForGame Automations

This directory contains automation scripts and tools for ProxyForGame development workflows.

## Overview

The automation system provides:
- **Translation management** - Synchronize and validate translations across 13 languages
- **Test management** - Generate test templates and track coverage
- **Calculator management** - Create and refactor calculators
- **Code quality & documentation** - Check code quality, manage assets, generate documentation

## Available Scripts

```bash
# Translation Management
npm run validate-translations       # Validate all locale files
npm run sync-translations:report    # Show translation completion
npm run sync-translations:fix       # Sync missing translation keys
npm run sync-translations:dry       # Preview changes

# Test Management
npm run check-test-coverage         # Check test coverage
npm run generate-test <calc>        # Generate test template

# Calculator Management
npm run new-calculator <name>       # Create new calculator
npm run refactor-calculator <calc>  # Analyze/refactor calculator

# Code Quality & Documentation
npm run check-code-quality          # Check code quality
npm run update-asset-versions      # Add asset versioning
npm run validate-database          # Validate database schema
npm run generate-docs               # Generate documentation
```

---

## Translation Management

### Pre-commit Translation Validator

**Location:** `.claude/hooks.json`

Automatically validates translation files before commits. Checks that all 13 locale files have matching keys with `en.json` and warns if missing translations are detected.

**Trigger:** Runs when committing changes to `www/locale/*.json` files

### /sync-translations Skill

**Implementation:** `scripts/sync-translations.js`

Synchronizes all locale JSON files with the source (en.json), adds missing translation keys with placeholder values, and generates completion reports.

**Usage:**
```bash
npm run sync-translations:report   # Show completion status
npm run sync-translations:fix      # Add missing keys to all locales
```

### Translation Validation Script

**Implementation:** `scripts/validate-translations.js`

Scans locale files for missing translation keys, reports empty/null values, and detects extra keys.

**Current Status:**
- **Total keys:** 658 across 13 languages
- **Best coverage:** US (100%), DE (97.7%)
- **Needs attention:** PT, SK (96.4%)

---

## Test Management

### Pre-commit Test Coverage Checker

**Location:** `.claude/hooks.json` (updated)

Automatically checks test coverage when calculator PHP files are modified.

### /add-test Skill

**Implementation:** `scripts/generate-test.js`

Generates Playwright test file templates for calculators with standard boilerplate.

**Usage:**
```bash
npm run generate-test graviton
```

### Test Coverage Checker Script

**Implementation:** `scripts/check-test-coverage.js`

Scans calculators and checks for corresponding test files.

**Current Status:**
- **Coverage:** 100% (11/11 calculators)
- **Calculators:** costs, lfcosts, queue, trade, graviton, moon, terraformer, production, expeditions, flight, flight_t

---

## Calculator Management

### /new-calculator Skill

**Implementation:** `scripts/new-calculator.js`

Generates complete calculator structure: PHP controller, TPL template, JavaScript skeleton, CSS file, test template, translation keys, and navigation entry.

**Usage:**
```bash
npm run new-calculator fleet-optimizer --title="Fleet Optimizer"
```

**Options:**
- `--title="Display Title"` - Custom display title
- `--skip-existing` - Skip files that already exist

### /refactor-calculator Skill

**Implementation:** `scripts/refactor-calculator.js`

Analyzes monolithic JavaScript files for refactoring opportunities, detects code patterns, and generates modular file templates.

**Usage:**
```bash
npm run refactor-calculator flight --analyze  # Analyze only
npm run refactor-calculator flight --apply    # Create modules
```

**Refactoring Candidates:**
- **High priority:** `flight.js` (1505 lines, 44 functions)
- **Medium priority:** `expeditions.js` (483 lines, 8 functions)
- **Already modularized:** `costs.js`

---

## Code Quality & Documentation

### /check-code-quality Skill

**Implementation:** `scripts/check-code-quality.js`

Analyzes calculator JavaScript files for quality issues, jQuery 1.5.1 compatibility problems, debug code, and structural issues.

**Usage:**
```bash
npm run check-code-quality          # Check all calculators
npm run check-code-quality graviton # Check specific calculator
```

### /update-asset-versions Skill

**Implementation:** `scripts/update-asset-versions.js`

Scans template files for CSS/JS assets and adds filemtime() versioning for browser cache busting.

**Usage:**
```bash
npm run update-asset-versions --check  # Check for unversioned assets
npm run update-asset-versions --apply  # Add versioning
```

### /validate-database Skill

**Implementation:** `scripts/validate-database-schema.js`

Validates database schema (schema.sql) against actual database usage in PHP code.

**Usage:**
```bash
npm run validate-database
```

**Requirements:** Requires `www/schema.sql` file

### /generate-docs Skill

**Implementation:** `scripts/generate-docs.js`

Analyzes calculator files and generates comprehensive markdown documentation.

**Usage:**
```bash
npm run generate-docs              # Generate docs for all calculators
npm run generate-docs graviton      # Generate specific calculator docs
```

**Output:** `docs/calculators/<calculator>.md`, `docs/calculators/README.md`

---

## Workflows

### Creating a New Calculator

1. Generate structure:
   ```bash
   npm run new-calculator mycalc --title="My Calculator"
   ```

2. Customize files:
   - Edit `www/ogame/calc/js/mycalc.js` (logic)
   - Update `www/ogame/calc/mycalc.tpl` (HTML)
   - Adjust `www/ogame/calc/css/mycalc.css` (styles)

3. Translate:
   - Replace `[TODO: ...]` placeholders in `www/locale/*.json`

4. Test:
   ```bash
   npx playwright-test tests/mycalc
   ```

5. Commit (hooks validate automatically)

### Adding New Translation Keys

1. Add keys to `www/locale/en.json`

2. Sync to all locales:
   ```bash
   npm run sync-translations:fix
   ```

3. Replace `[TODO: ...]` placeholders in each locale file

4. Validate:
   ```bash
   npm run validate-translations
   ```

### Checking Code Quality

1. Run quality checker:
   ```bash
   npm run check-code-quality
   ```

2. Address issues:
   - Replace `alert()` with UI dialogs
   - Add input validation
   - Extract magic numbers to constants

### Refactoring a Calculator

1. Analyze:
   ```bash
   npm run refactor-calculator flight --analyze
   ```

2. Review recommendations and priority

3. Generate modules (if applicable):
   ```bash
   npm run refactor-calculator flight --apply
   ```

4. Follow migration guide in generated `www/ogame/calc/js/flight-MIGRATION.md`

---

## Troubleshooting

### Pre-commit hooks not running
- Check `.claude/hooks.json` exists and is valid
- Ensure Claude Code is properly configured
- Try running manually: `npm run validate-translations`

### Translation sync fails
- Manually run: `npm run sync-translations:fix`
- Check `en.json` is valid JSON
- Verify locale files are writable

### Test generation fails
- Ensure calculator PHP file exists at `www/ogame/calc/<name>.php`
- Check for duplicate test file
- Delete existing test if regenerating

### Asset versioning applies too many files
- Run `--check` first to review
- Use `git diff` to see changes before committing

### Schema validation fails
- Export actual database schema
- Update `www/schema.sql`
- Re-run validator

---

## File Structure

```
pfg.wmp/
├── .claude/
│   ├── hooks.json                     # Pre-commit hooks
│   └── skills/                        # Claude Code skill definitions
├── scripts/                           # Automation scripts
│   ├── validate-translations.js       # Translation validator
│   ├── sync-translations.js           # Translation synchronizer
│   ├── check-test-coverage.js         # Test coverage checker
│   ├── generate-test.js               # Test generator
│   ├── new-calculator.js              # Calculator generator
│   ├── refactor-calculator.js         # Refactoring tool
│   ├── check-code-quality.js          # Code quality checker
│   ├── update-asset-versions.js       # Asset version manager
│   ├── validate-database-schema.js    # Database validator
│   └── generate-docs.js                # Documentation generator
├── docs/calculators/                  # Generated documentation
├── playwright-tests/tests/              # E2E tests
├── www/ogame/calc/                      # Calculators
├── www/locale/                         # Translation files (13 languages)
└── package.json                         # NPM scripts
```

---

## Additional Resources

- `scripts/README.md` - Detailed script documentation
- `CLAUDE.md` - Project overview and development patterns
- `docs/calculators/README.md` - Calculator documentation index

---

**Status:** ✅ Operational

All automation tools are functional and integrated with Claude Code hooks and skills.
