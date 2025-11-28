import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://pfg.wmp/en/');
  await expect(page).toHaveTitle(/ProxyForGame - tools for online browser game OGame/);
});