import { test, expect } from '@playwright/test';

test.describe('Trade Calculator Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/ogame/calc/trade.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Trade/);
    });
/*
    test('trade.js functionality is available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('localization object is available', async ({ page }) => {
        // Check if the l object (localization) is loaded
        const lExists = await page.evaluate(() => typeof l !== 'undefined');
        expect(lExists).toBe(true);
    });

    test('universes data is loaded', async ({ page }) => {
        // Check if the unis object is loaded
        const unisLoaded = await page.evaluate(() => typeof unis !== 'undefined' && Object.keys(unis).length > 0);
        expect(unisLoaded).toBe(true);
    });

  test('calculations are correct', async ({ page }) => {
    await page.getByRole('button', { name: '2.4 : 1.5 :' }).click();
    await page.locator('#res-src-0').click();
    await page.locator('#res-src-m').click();
    await page.locator('#res-src-m').fill('100000');
    await page.locator('#res-src-m').press('Enter');
    await expect(page.locator('#res-src-cargo')).toContainText('20 SC / 4 LC');
    await page.locator('#res-dst-0').click();
    await expect(page.locator('#res-dst-c')).toContainText('62.500');
    await expect(page.locator('#res-dst-cargo')).toContainText('13 SC / 3 LC');
    await page.locator('#res-dst-1').click();
    await expect(page.locator('#res-dst-d')).toContainText('41.667');
    await expect(page.locator('#res-dst-cargo')).toContainText('9 SC / 2 LC');
    await page.locator('#res-dst-2').click();
    await page.locator('#mix-balance-proc').dblclick();
    await page.locator('#mix-balance-proc').fill('60');
    await page.locator('#mix-balance-proc').press('Enter');
    await expect(page.locator('#res-dst-c')).toContainText('31.250');
    await expect(page.locator('#res-dst-d')).toContainText('20.833');
    await expect(page.locator('#res-dst-cargo')).toContainText('11 SC / 3 LC');
    await page.locator('#res-dst-mix-1').check();
    await page.locator('#mix-balance-prop1').dblclick();
    await page.locator('#mix-balance-prop1').fill('2');
    await page.locator('#mix-balance-prop1').press('Enter');
    await expect(page.locator('#res-dst-c')).toContainText('35.714');
    await expect(page.locator('#res-dst-d')).toContainText('17.857');
    await page.locator('#res-dst-mix-2').check();
    await page.locator('#mix-fix1').click();
    await page.locator('#mix-fix1').fill('20000');
    await page.locator('#mix-fix1').press('Enter');
    await expect(page.locator('#res-dst-c')).toContainText('20.000');
    await expect(page.locator('#res-dst-d')).toContainText('28.333');
    await expect(page.locator('#alink')).toContainText('/en/ogame/calc/trade.php#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=2&fix1=20000&m=100000&l=en:101');
  });*/
});
