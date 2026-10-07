// @ts-check
import { defineConfig } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * The server the suite runs against. CI sets PFG_BASE_URL in the workflow;
 * locally an unset variable means "whichever server is up" - WAMP first, then
 * :8000 (probe-base-url.mjs). The result goes back into the environment, so the
 * workers Playwright forks inherit it and the probe runs once per run.
 * @returns {string}
 */
function resolveBaseUrl() {
  if (process.env.PFG_BASE_URL) return process.env.PFG_BASE_URL;
  const probe = spawnSync(process.execPath, [path.join(__dirname, 'probe-base-url.mjs')], { encoding: 'utf8' });
  if (probe.status !== 0) {
    throw new Error('No local server answered on http://pfg.wmp or http://localhost:8000. '
      + 'Start WAMP, `make serve` or `make docker-up`, or set PFG_BASE_URL.');
  }
  process.env.PFG_BASE_URL = probe.stdout;
  console.error(`PFG_BASE_URL not set - running against ${probe.stdout}`);
  return probe.stdout;
}

export default defineConfig({
  testDir: './tests',

  use: {
    // Base URL used by page.goto(), e.g. page.goto('/en/');
    baseURL: resolveBaseUrl(),

    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    // Video is recorded for every test and thrown away when it passes, which costs
    // ~25% of the local run time. Keep it in CI, where a failure is not reproducible
    // on demand; locally set PFG_VIDEO=1 when a failure needs one.
    video: process.env.CI || process.env.PFG_VIDEO ? 'retain-on-failure' : 'off',
  },

  // Enable retries in CI for stability
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel
  fullyParallel: true,

  // Default is half the cores; the tests wait on a local server more than they burn CPU.
  workers: process.env.CI ? undefined : '100%',

  // Configure reporter(s)
  reporter: 'html',
});
