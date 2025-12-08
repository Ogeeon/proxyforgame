import { test, expect } from '@playwright/test';

test.describe('Trade Calculator Page', () => {
    test.beforeEach(async ({ page }, testInfo) => {
        if (testInfo.title.includes('parsing from link works')) {
            return;
        }
        await page.goto('/ogame/calc/trade.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Trade/);
    });

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

    test('Metal calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-0').click();
        await page.locator('#res-src-m').dblclick();
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
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-c')).toContainText('20.000');
        await expect(page.locator('#res-dst-d')).toContainText('28.333');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-c')).toContainText('47.500');
        await expect(page.locator('#res-dst-d')).toContainText('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('10 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('6 SC / 2 LC');
    });

    test('Crystal calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-1').click();
        await page.locator('#res-src-c').dblclick();
        await page.locator('#res-src-c').fill('100000');
        await page.locator('#res-src-c').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('20 SC / 4 LC');
        await page.locator('#res-dst-0').click();
        await expect(page.locator('#res-dst-m')).toContainText('160.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('32 SC / 7 LC');
        await page.locator('#res-dst-1').click();
        await expect(page.locator('#res-dst-d')).toContainText('66.667');
        await expect(page.locator('#res-dst-cargo')).toContainText('14 SC / 3 LC');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-balance-proc').dblclick();
        await page.locator('#mix-balance-proc').fill('60');
        await page.locator('#mix-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('61.538');
        await expect(page.locator('#res-dst-d')).toContainText('41.026');
        await expect(page.locator('#res-dst-cargo')).toContainText('21 SC / 5 LC');
        await page.locator('#res-dst-mix-1').check();
        await page.locator('#mix-balance-prop1').dblclick();
        await page.locator('#mix-balance-prop1').fill('2');
        await page.locator('#mix-balance-prop1').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('72.727');
        await expect(page.locator('#res-dst-d')).toContainText('36.364');
        await page.locator('#res-dst-mix-2').check();
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('20.000');
        await expect(page.locator('#res-dst-d')).toContainText('58.333');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('136.000');
        await expect(page.locator('#res-dst-d')).toContainText('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('10 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('15 SC / 3 LC');
    });

    test('Deut calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-2').click();
        await page.locator('#res-src-d').dblclick();
        await page.locator('#res-src-d').fill('100000');
        await page.locator('#res-src-d').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('20 SC / 4 LC');
        await page.locator('#res-dst-0').click();
        await expect(page.locator('#res-dst-m')).toContainText('240.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('48 SC / 10 LC');
        await page.locator('#res-dst-1').click();
        await expect(page.locator('#res-dst-c')).toContainText('150.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('30 SC / 6 LC');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-balance-proc').dblclick();
        await page.locator('#mix-balance-proc').fill('60');
        await page.locator('#mix-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('116.129');
        await expect(page.locator('#res-dst-c')).toContainText('77.419');
        await expect(page.locator('#res-dst-cargo')).toContainText('39 SC / 8 LC');
        await page.locator('#res-dst-mix-1').check();
        await page.locator('#mix-balance-prop1').dblclick();
        await page.locator('#mix-balance-prop1').fill('2');
        await page.locator('#mix-balance-prop1').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('133.333');
        await expect(page.locator('#res-dst-c')).toContainText('66.667');
        await expect(page.locator('#res-dst-cargo')).toContainText('40 SC / 8 LC');
        await page.locator('#res-dst-mix-2').check();
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('20.000');
        await expect(page.locator('#res-dst-c')).toContainText('137.500');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-m')).toContainText('224.000');
        await expect(page.locator('#res-dst-c')).toContainText('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('10 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('24 SC / 5 LC');
    });

    test('Metal+Crystal calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-3').click();
        await page.locator('#res-src-m').click();
        await page.locator('#res-src-m').fill('100000');
        await page.locator('#res-src-m').press('Enter');
        await page.locator('#res-src-c').click();
        await page.locator('#res-src-c').fill('50000');
        await page.locator('#res-src-c').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('30 SC / 6 LC');
        await expect(page.locator('#res-dst-d')).toContainText('75.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('15 SC / 3 LC');
    });

    test('Metal+Deut calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-4').click();
        await page.locator('#res-src-m').click();
        await page.locator('#res-src-m').fill('100000');
        await page.locator('#res-src-m').press('Enter');
        await page.locator('#res-src-d').click();
        await page.locator('#res-src-d').fill('50000');
        await page.locator('#res-src-d').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('30 SC / 6 LC');
        await expect(page.locator('#res-dst-c')).toContainText('137.500');
        await expect(page.locator('#res-dst-cargo')).toContainText('28 SC / 6 LC');
    });

    test('Crystal+Deut calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-5').click();
        await page.locator('#res-src-c').click();
        await page.locator('#res-src-c').fill('100000');
        await page.locator('#res-src-c').press('Enter');
        await page.locator('#res-src-d').click();
        await page.locator('#res-src-d').fill('50000');
        await page.locator('#res-src-d').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('30 SC / 6 LC');
        await expect(page.locator('#res-dst-m')).toContainText('280.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('56 SC / 12 LC');
    });

    test('links are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-0').click();
        await page.locator('#res-src-m').dblclick();
        await page.locator('#res-src-m').fill('100000');
        await page.locator('#res-src-m').press('Enter');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await page.locator('#universe').selectOption('1');
        await page.locator('#coord-g').click();
        await page.locator('#coord-g').fill('');
        await page.locator('#coord-g').pressSequentially('4');
        await page.locator('#coord-s').click();
        await page.locator('#coord-s').fill('');
        await page.locator('#coord-s').pressSequentially('3');
        await page.locator('#coord-p').click();
        await page.locator('#coord-p').fill('');
        await page.locator('#coord-p').pressSequentially('2');
        // Small wait to ensure keyup events are processed
        await page.waitForTimeout(100);
        await expect(page.locator('#alink')).toContainText('trade.php#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=0');
        await expect(page.locator('#atext')).toContainText('Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2] (Universe 1, en.ogame.gameforge.com)');
        await expect(page.locator('#abbcode')).toContainText('trade.php#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=0]Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2] (Universe 1, en.ogame.gameforge.com)[/url]');
        await page.locator('#moon').check();
        await expect(page.locator('#alink')).toContainText('trade.php#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=1');
        await expect(page.locator('#atext')).toContainText('Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2], moon (Universe 1, en.ogame.gameforge.com)');
        await expect(page.locator('#abbcode')).toContainText('trade.php#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=1]Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2], moon (Universe 1, en.ogame.gameforge.com)[/url]');
    });

    test('parsing from link works', async ({ page }) => {
        await page.goto('/ogame/calc/trade.php#rmd=2.4&rcd=1.5&st=1&dt=2&dmt=1&mp1=2&mp2=3&c=100000&l=en:1&lc=1:2:3&lm=1');
        await expect(page.locator('#res-src-1')).toBeChecked();
        await expect(page.locator('#res-dst-2')).toBeChecked();
        await expect(page.locator('#res-dst-mix-1')).toBeChecked();
        await expect(page.locator('#mix-balance-prop1')).toHaveValue('2');
        await expect(page.locator('#mix-balance-prop2')).toHaveValue('3');
        await expect(page.locator('#res-src-c')).toHaveValue('100000');
        await expect(page.locator('#res-dst-m')).toContainText('34.783');
        await expect(page.locator('#res-dst-d')).toContainText('52.174');
        await expect(page.locator('#rate-md')).toHaveValue('2.4');
        await expect(page.locator('#rate-cd')).toHaveValue('1.5');
        await expect(page.locator('#trade')).toContainText('1.600');
        await expect(page.locator('#country')).toHaveValue('en');
        await expect(page.locator('#universe')).toHaveValue('1');
        await expect(page.locator('#coord-g')).toHaveValue('1');
        await expect(page.locator('#coord-s')).toHaveValue('2');
        await expect(page.locator('#coord-p')).toHaveValue('3');
        await expect(page.locator('#moon')).toBeChecked();
    });
});
