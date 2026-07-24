// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  use: {
    // Base URL used by page.goto(), e.g. page.goto('/en/');
    // In CI: http://localhost:8000  (set in workflow)
    // Locally: http://pfg.wmp       (set manually or fallback to CI-style URL)
    baseURL: process.env.PFG_BASE_URL || 'http://localhost:8000',

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
