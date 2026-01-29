# Automation Scripts

This directory contains automation scripts for ProxyForGame development workflows.

## Translation Management Scripts

### validate-translations.js

Validates that all locale JSON files have matching keys with the source language (en.json).

**Usage:**
```bash
node scripts/validate-translations.js
```

**What it checks:**
- Missing translation keys (present in en.json but not in other locales)
- Empty translation values
- Extra keys (present in locale but not in en.json)

**Exit codes:**
- `0` - All translations valid
- `1` - Validation errors found

**Integration:**
This script runs automatically as a pre-commit hook via `.claude/hooks.json`.

---

### sync-translations.js

Synchronizes all locale files with the source (en.json) by adding missing keys.

**Usage:**
```bash
# Show completion report only
node scripts/sync-translations.js --report

# Preview changes without modifying files
node scripts/sync-translations.js --dry-run

# Actually add missing keys with placeholder values
node scripts/sync-translations.js --fix
```

**What it does:**
- Scans all locale files in `www/locale/`
- Finds keys missing from each locale compared to en.json
- Adds missing keys with placeholder text: `[TODO: Translate to German] original text`
- Preserves all existing translations
- Generates a completion report showing percentage translated per language

**Example output:**
```
═════════════════════════════════════════════════════════
              Translation Completion Report
═════════════════════════════════════════════════════════

Total keys in source (en.json): 658

Completion by language:
○  PT  96.4% (634/658) [24 missing]
✓  US 100.0% (658/658)
```

**Workflow:**
1. Add new translation keys to `www/locale/en.json`
2. Run `node scripts/sync-translations.js --dry-run` to preview
3. Run `node scripts/sync-translations.js --fix` to add placeholders
4. Translate the placeholders in each locale file
5. Commit when all translations are complete

---

## Test Management Scripts

### check-test-coverage.js

Checks that all calculators have corresponding test files.

**Usage:**
```bash
node scripts/check-test-coverage.js
```

**What it checks:**
- All calculator PHP files in `www/ogame/calc/`
- Corresponding test files in `playwright-tests/tests/`
- Reports test coverage percentage
- Lists calculators missing tests

**Exit codes:**
- `0` - All calculators have tests
- `1` - Some calculators are missing tests

**Integration:**
This script runs automatically as a pre-commit hook via `.claude/hooks.json` when calculator PHP files are modified.

---

### generate-test.js

Generates Playwright test file templates for calculators.

**Usage:**
```bash
node scripts/generate-test.js <calculator-name>
```

**Example:**
```bash
node scripts/generate-test.js graviton
```

**What it does:**
- Reads the calculator PHP file to detect name and translation key
- Creates a test file template in `playwright-tests/tests/`
- Includes standard boilerplate (changelog popup avoidance, basic tests)
- Provides helpful next steps for customization

**Generated template includes:**
- `test.describe()` block with calculator name
- `test.beforeEach()` with changelog popup avoidance
- Basic page load test
- Calculator options availability test
- Placeholder test for customization

---

## Adding New Translation Keys

When adding new features that require translations:

1. **Add keys to en.json:**
   ```json
   {
     "common": {
       "new-feature": "New Feature Description"
     }
   }
   ```

2. **Sync to all locales:**
   ```bash
   node scripts/sync-translations.js --fix
   ```

3. **Translate in each locale file:**
   - `www/locale/de.json`: `"new-feature": "Neue Funktionsbeschreibung"`
   - `www/locale/fr.json`: `"new-feature": "Description de la nouvelle fonctionnalité"`
   - etc.

4. **Validate before committing:**
   ```bash
   node scripts/validate-translations.js
   ```

---

## Adding Tests for New Calculators

When creating a new calculator:

1. **Create calculator files:**
   - `www/ogame/calc/mycalc.php`
   - `www/ogame/calc/mycalc.tpl`
   - `www/ogame/calc/js/mycalc.js`

2. **Generate test template:**
   ```bash
   node scripts/generate-test.js mycalc
   ```

3. **Customize the test:**
   - Open `playwright-tests/tests/mycalc.spec.js`
   - Replace placeholder tests with actual functionality tests
   - Add form input validation
   - Add calculation accuracy tests
   - Add edge case tests

4. **Run the tests:**
   ```bash
   cd playwright-tests
   npx playwright test mycalc
   ```

---

## Development Workflow

### Recommended Git Workflow

1. Make your changes (add new UI text, features, etc.)
2. Update `www/locale/en.json` with new keys
3. Run `npm run sync-translations` to add placeholders
4. Translate the new keys in each locale file
5. The pre-commit hook will validate translations automatically
6. If validation fails, fix missing keys and try again

### Continuous Integration

Consider adding these scripts to your CI pipeline:

```yaml
# .github/workflows/validate-translations.yml
name: Validate Translations
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Validate translations
        run: node scripts/validate-translations.js
      - name: Check test coverage
        run: node scripts/check-test-coverage.js
      - name: Run Playwright tests
        run: |
          cd playwright-tests
          npm ci
          npx playwright test
```

---

## Calculator Management Scripts

### new-calculator.js

Generates a complete calculator structure with all necessary files.

**Usage:**
```bash
node scripts/new-calculator.js <name> [--title="Display Title"] [--skip-existing]
```

**What it creates:**
- PHP controller (`www/ogame/calc/<name>.php`)
- TPL template (`www/ogame/calc/<name>.tpl`)
- JavaScript skeleton (`www/ogame/calc/js/<name>.js`)
- CSS file (`www/ogame/calc/css/<name>.css`)
- Test file template (`playwright-tests/tests/<name>.spec.js`)
- Translation keys in all 13 locale files
- Navigation link in sidebar

**Example:**
```bash
# Create a new calculator with default title
node scripts/new-calculator.js fleet-optimizer

# Create with custom title
node scripts/new-calculator.js fleet-optimizer --title="Fleet Optimizer"

# Skip existing files if partial creation failed
node scripts/new-calculator.js fleet-optimizer --skip-existing
```

**Workflow:**
1. Run generator to create all files
2. Customize calculator logic in JS file
3. Update HTML structure in TPL file
4. Adjust styles in CSS file
5. Translate placeholder keys in all locale files
6. Implement test scenarios
7. Test the calculator

---

### refactor-calculator.js

Analyzes monolithic calculator JavaScript files and suggests modularization.

**Usage:**
```bash
# Analyze only (default)
node scripts/refactor-calculator.js <calculator> --analyze

# Analyze and create modular files
node scripts/refactor-calculator.js <calculator> --apply
```

**What it does:**
- Analyzes file structure and complexity
- Detects code patterns (options, calculations, UI handlers, data)
- Generates refactoring suggestions
- Creates modular file templates (optional)
- Generates migration guide

**Analysis includes:**
- Total lines and function count
- Detected components
- Priority-based suggestions
- Recommended modular structure

**Example output:**
```
File Statistics:
  Total lines: 1505
  Functions: 44

Suggestions:
  ⚠ File is large (1505 lines). Consider splitting into modules.
  ⚠ Mixed calculations and UI handlers. Separate into modules.

Recommended Modular Structure:
  1. flight-core.js - Core calculation logic
  2. flight-data-collector.js - Data collection
  3. flight-renderer.js - UI rendering
  4. flight-orchestration.js - Event handling
```

**Modular files created (with --apply):**
- `<calc>-core.js` - Core calculation logic
- `<calc>-data-collector.js` - Data collection and validation
- `<calc>-renderer.js` - UI rendering and DOM manipulation
- `<calc>-orchestration.js` - Event handling and coordination
- `<calc>-MIGRATION.md` - Step-by-step migration guide

---

## Complete Development Workflow

### Creating a New Calculator (Complete Flow)

1. **Generate calculator structure:**
   ```bash
   npm run new-calculator my-calculator --title="My Calculator"
   ```

2. **Customize the files:**
   - Edit `www/ogame/calc/js/my-calculator.js` - Add calculation logic
   - Update `www/ogame/calc/my-calculator.tpl` - Add HTML structure
   - Adjust `www/ogame/calc/css/my-calculator.css` - Style the calculator

3. **Translate:**
   - Open each `www/locale/*.json` file
   - Find `[TODO: ...]` placeholders
   - Add translations

4. **Implement tests:**
   - Edit `playwright-tests/tests/my-calculator.spec.js`
   - Add test scenarios

5. **Test:**
   ```bash
   npx playwright test my-calculator
   ```

6. **Commit:**
   - Pre-commit hooks validate automatically
   - Fix any issues and commit again

---

## Code Quality & Documentation Scripts

### check-code-quality.js

Analyzes calculator JavaScript files for code quality issues.

**Usage:**
```bash
node scripts/check-code-quality.js [calculator-name]
```

**What it checks:**
- jQuery 1.5.1 compatibility issues (.prop(), .on() vs older methods)
- Debug code (console.log, alert() statements)
- Calculator structure (options object, validation, persistence)
- File metrics (lines, functions, comment ratio)
- Common code quality issues (TODOs, magic numbers)

**Report categories:**
- Errors: Critical issues (alert() usage, missing options)
- Warnings: Important issues (debug code, large files)
- Info: Suggestions (TODOs, magic numbers, improvements)

**Example:**
```bash
# Check all calculators
npm run check-code-quality

# Check specific calculator
npm run check-code-quality graviton
```

---

### update-asset-versions.js

Adds filemtime() versioning to CSS and JS assets in templates.

**Usage:**
```bash
node scripts/update-asset-versions.js [--check] [--apply]
```

**What it does:**
- Scans all .tpl files for asset references
- Checks if assets have versioning (?v=<timestamp>)
- Adds versioning to unversioned assets
- Reports missing assets (404s)

**Benefits:**
- Ensures browser cache busting when assets change
- Prevents users from seeing stale cached files
- Consistent with existing codebase pattern

**Example:**
```bash
# Check what needs versioning
npm run update-asset-versions --check

# Apply versioning
npm run update-asset-versions --apply
```

---

### validate-database-schema.js

Validates database schema against actual usage in PHP code.

**Usage:**
```bash
node scripts/validate-database-schema.js
```

**What it does:**
- Scans PHP files for SqlQuery() calls
- Extracts table names from queries
- Compares with schema.sql
- Reports inconsistencies

**Requirements:**
- Requires `www/schema.sql` file

**Report includes:**
- Tables used in code but missing from schema
- Tables in schema but not used in code
- List of database-related files

---

### generate-docs.js

Generates markdown documentation for calculators.

**Usage:**
```bash
node scripts/generate-docs.js [calculator-name]
```

**What it does:**
- Analyzes calculator files (PHP, JS, TPL)
- Extracts configuration options
- Generates comprehensive documentation
- Creates calculator index

**Generated documentation includes:**
- Title and description
- Technical details (files, tests)
- Configuration options
- Code statistics
- Usage instructions
- Development notes

**Output:**
- `docs/calculators/<calc>.md` - Individual calculator docs
- `docs/calculators/README.md` - Calculator index

**Example:**
```bash
# Generate docs for all calculators
npm run generate-docs

# Generate docs for specific calculator
npm run generate-docs graviton
```

---

## Maintenance Workflow

### Pre-Release Quality Checklist

Before releasing a new version:

1. **Check code quality:**
   ```bash
   npm run check-code-quality
   ```

2. **Update asset versioning:**
   ```bash
   npm run update-asset-versions --apply
   ```

3. **Validate translations:**
   ```bash
   npm run validate-translations
   ```

4. **Check test coverage:**
   ```bash
   npm run check-test-coverage
   ```

5. **Generate documentation:**
   ```bash
   npm run generate-docs
   ```

6. **Run tests:**
   ```bash
   cd playwright-tests
   npx playwright test
   ```

---

## Future Enhancements

Planned improvements to these scripts:

- [ ] Auto-translation using Google Translate API or DeepL
- [ ] Detection of unused translation keys
- [ ] Merge tool for conflicting translations
- [ ] Translation memory for consistent terminology
- [ ] Support for pluralization and gender rules
- [ ] Integration with translation management platforms (Crowdin, Weblate)
