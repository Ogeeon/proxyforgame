import { test, expect } from './base';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ProxyForGame - tools for online browser game OGame/);
});