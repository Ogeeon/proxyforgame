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
      globals: { ...globals.browser, bootstrap: 'readonly' },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off',
    },
  },

  // Build scripts and the node:test suite: CommonJS.
  {
    files: ['scripts/**/*.js', 'unit-tests/**/*.js'],
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
