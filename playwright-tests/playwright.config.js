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
    video: 'retain-on-failure',
  },

  // Enable retries in CI for stability
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel
  fullyParallel: true,

  // Configure reporter(s)
  reporter: 'html',
});
