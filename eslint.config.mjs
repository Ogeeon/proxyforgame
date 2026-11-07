import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/vendor/**',
      '**/.cdn-cache/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.min.js',
    ],
  },

  // Browser code. These files are plain <script> globals, not modules: helpers
  // defined in utils.js and dom-utils.js are called from every calculator. That
  // makes `no-undef` report ~2400 false positives here, so type-checking owns
  // undefined-name detection instead (TS2304), and the rule stays off.
  {
    files: ['www/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
      // Bootstrap's global is read in two files only (override below), so the
      // day it goes away - Bootstrap 6 is ESM-only - is an edit to them, not a
      // hunt through every calculator. `typeof bootstrap` counts as a read.
      'no-restricted-globals': ['error', {
        name: 'bootstrap',
        message: 'Go through www/js/bootstrap-access.js',
      }],
      // `vars: local` for the same reason `no-undef` is off: a top-level
      // function here is a page global, and the file that calls it is a
      // different <script>. Checked once against every .js, .tpl, .php and
      // .json in the project - of the 57 names ESLint called unused, 55 are
      // called from another file and the last two, findSelection and
      // showEmailWindow, are called from onclick handlers inside the locale
      // strings. None of them were dead. Locals still get checked.
      'no-unused-vars': ['error', {
        vars: 'local',
        args: 'after-used',
        caughtErrors: 'none',
        // `for (const _ of rows)` - iterate the right number of times without
        // naming the item.
        varsIgnorePattern: '^_$',
        // A base class's no-op hook names the argument its overrides take:
        // `showProfile(_profile) {}`.
        argsIgnorePattern: '^_',
      }],
      // The project is free of eval(); the rule is enabled so it stays that way
      // (it is not part of eslint:recommended).
      'no-eval': 'error',
    },
  },

  // The facade and the bundle patch are the two files that may read the
  // Bootstrap global; see docs/bootstrap-6-migration.md.
  {
    files: ['www/js/bootstrap-access.js', 'www/js/bootstrap-tooltip-guard.js'],
    languageOptions: {
      globals: { bootstrap: 'readonly' },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Build scripts, the node:test suite and the MCP server: CommonJS.
  {
    files: ['scripts/**/*.js', 'unit-tests/**/*.js', 'mcp/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Playwright specs: ESM, and page.evaluate() bodies run in the browser. The
  // names those bodies call - options, updateNumbers, getFlightDuration - are
  // the calculator page's own globals, invisible to ESLint here for the same
  // reason as in www/**, so `no-undef` is off for the same reason too.
  {
    files: ['playwright-tests/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
    },
  },
];
