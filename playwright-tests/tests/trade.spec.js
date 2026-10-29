import { test, expect } from './base';

test.describe('Trade Calculator Page', () => {
    test.beforeEach(async ({ context, page }, testInfo) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        if (testInfo.title.startsWith('parsing ')) {
            return;
        }
        await page.goto('/trade');
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
        await expect(page.locator('#res-src-cargo')).toContainText('16 SC / 4 LC');
        await page.locator('#res-dst-0').click();
        await expect(page.locator('#res-dst-c')).toHaveValue('62.500');
        await expect(page.locator('#res-dst-cargo')).toContainText('10 SC / 2 LC');
        await page.locator('#res-dst-1').click();
        await expect(page.locator('#res-dst-d')).toHaveValue('41.667');
        await expect(page.locator('#res-dst-cargo')).toContainText('7 SC / 2 LC');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-balance-proc').dblclick();
        await page.locator('#mix-balance-proc').fill('60');
        await page.locator('#mix-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-c')).toHaveValue('31.250');
        await expect(page.locator('#res-dst-d')).toHaveValue('20.833');
        await expect(page.locator('#res-dst-cargo')).toContainText('9 SC / 2 LC');
        await page.locator('#res-dst-mix-1').check();
        await page.locator('#mix-balance-prop1').dblclick();
        await page.locator('#mix-balance-prop1').fill('2');
        await page.locator('#mix-balance-prop1').press('Enter');
        await expect(page.locator('#res-dst-c')).toHaveValue('35.714');
        await expect(page.locator('#res-dst-d')).toHaveValue('17.857');
        await page.locator('#res-dst-mix-2').check();
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-c')).toHaveValue('20.000');
        await expect(page.locator('#res-dst-d')).toHaveValue('28.333');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-c')).toHaveValue('47.500');
        await expect(page.locator('#res-dst-d')).toHaveValue('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('9 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('6 SC / 2 LC');
    });

    test('Crystal calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-1').click();
        await page.locator('#res-src-c').dblclick();
        await page.locator('#res-src-c').fill('100000');
        await page.locator('#res-src-c').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('16 SC / 4 LC');
        await page.locator('#res-dst-0').click();
        await expect(page.locator('#res-dst-m')).toHaveValue('160.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('26 SC / 6 LC');
        await page.locator('#res-dst-1').click();
        await expect(page.locator('#res-dst-d')).toHaveValue('66.667');
        await expect(page.locator('#res-dst-cargo')).toContainText('11 SC / 3 LC');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-balance-proc').dblclick();
        await page.locator('#mix-balance-proc').fill('60');
        await page.locator('#mix-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('61.538');
        await expect(page.locator('#res-dst-d')).toHaveValue('41.026');
        await expect(page.locator('#res-dst-cargo')).toContainText('17 SC / 4 LC');
        await page.locator('#res-dst-mix-1').check();
        await page.locator('#mix-balance-prop1').dblclick();
        await page.locator('#mix-balance-prop1').fill('2');
        await page.locator('#mix-balance-prop1').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('72.727');
        await expect(page.locator('#res-dst-d')).toHaveValue('36.364');
        await page.locator('#res-dst-mix-2').check();
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('20.000');
        await expect(page.locator('#res-dst-d')).toHaveValue('58.333');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('136.000');
        await expect(page.locator('#res-dst-d')).toHaveValue('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('9 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('13 SC / 3 LC');
    });

    test('Deut calculations are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-2').click();
        await page.locator('#res-src-d').dblclick();
        await page.locator('#res-src-d').fill('100000');
        await page.locator('#res-src-d').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('16 SC / 4 LC');
        await page.locator('#res-dst-0').click();
        await expect(page.locator('#res-dst-m')).toHaveValue('240.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('39 SC / 8 LC');
        await page.locator('#res-dst-1').click();
        await expect(page.locator('#res-dst-c')).toHaveValue('150.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('24 SC / 5 LC');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-balance-proc').dblclick();
        await page.locator('#mix-balance-proc').fill('60');
        await page.locator('#mix-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('116.129');
        await expect(page.locator('#res-dst-c')).toHaveValue('77.419');
        await expect(page.locator('#res-dst-cargo')).toContainText('31 SC / 7 LC');
        await page.locator('#res-dst-mix-1').check();
        await page.locator('#mix-balance-prop1').dblclick();
        await page.locator('#mix-balance-prop1').fill('2');
        await page.locator('#mix-balance-prop1').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('133.333');
        await expect(page.locator('#res-dst-c')).toHaveValue('66.667');
        await expect(page.locator('#res-dst-cargo')).toContainText('32 SC / 7 LC');
        await page.locator('#res-dst-mix-2').check();
        await page.locator('#mix-fix1').dblclick();
        await page.locator('#mix-fix1').fill('20000');
        await page.locator('#mix-fix1').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('20.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('137.500');
        await page.locator('#res-dst-mix-3').check();
        await page.locator('#mix-fix2').dblclick();
        await page.locator('#mix-fix2').fill('10000');
        await page.locator('#mix-fix2').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('224.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('10.000');
        await page.locator('#hypertech-lvl').dblclick();
        await page.locator('#hypertech-lvl').fill('20');
        await page.locator('#hypertech-lvl').press('Enter');
        await expect(page.locator('#res-src-cargo')).toContainText('9 SC / 2 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('21 SC / 5 LC');
    });

    test('the source split mode divides what is being sold', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-2').click();
        await page.locator('#res-src-d').dblclick();
        await page.locator('#res-src-d').fill('100000');
        await page.locator('#res-src-d').press('Enter');
        await page.locator('#res-dst-2').click();
        await page.locator('#mix-src-balance-proc').dblclick();
        await page.locator('#mix-src-balance-proc').fill('50');
        await page.locator('#mix-src-balance-proc').press('Enter');
        // 50.000 deut buys metal at 2.4 and the other 50.000 buys crystal at 1.5
        await expect(page.locator('#res-dst-mix-4')).toBeChecked();
        await expect(page.locator('#res-dst-m')).toHaveValue('120.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('75.000');
        await page.locator('#mix-src-balance-proc').dblclick();
        await page.locator('#mix-src-balance-proc').fill('25');
        await page.locator('#mix-src-balance-proc').press('Enter');
        await expect(page.locator('#res-dst-m')).toHaveValue('60.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('112.500');
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
        await expect(page.locator('#res-src-cargo')).toContainText('24 SC / 5 LC');
        await expect(page.locator('#res-dst-d')).toHaveValue('75.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('12 SC / 3 LC');
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
        await expect(page.locator('#res-src-cargo')).toContainText('24 SC / 5 LC');
        await expect(page.locator('#res-dst-c')).toHaveValue('137.500');
        await expect(page.locator('#res-dst-cargo')).toContainText('22 SC / 5 LC');
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
        await expect(page.locator('#res-src-cargo')).toContainText('24 SC / 5 LC');
        await expect(page.locator('#res-dst-m')).toHaveValue('280.000');
        await expect(page.locator('#res-dst-cargo')).toContainText('45 SC / 9 LC');
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
        // toContainText retries until the keyup-triggered recalculation lands
        await expect(page.locator('#alink')).toContainText('/trade#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=0');
        await expect(page.locator('#atext')).toContainText('Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2] (Universe 1, en.ogame.gameforge.com)');
        await expect(page.locator('#abbcode')).toContainText('/trade#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=0]Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2] (Universe 1, en.ogame.gameforge.com)[/url]');
        await page.locator('#moon').check();
        await expect(page.locator('#alink')).toContainText('/trade#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=1');
        await expect(page.locator('#atext')).toContainText('Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2], Moon (Universe 1, en.ogame.gameforge.com)');
        await expect(page.locator('#abbcode')).toContainText('/trade#rmd=2.4&rcd=1.5&st=0&dt=2&dmt=3&fix2=10000&m=100000&l=en:1&lc=4:3:2&lm=1]Selling 100.000 met. Buying 47.500 crys and 10.000 deut. Exchange rates 2.4:1.5:1. Coordinates [4:3:2], Moon (Universe 1, en.ogame.gameforge.com)[/url]');
    });

    test('switching to a country without the universe picks its first one', async ({ page }) => {
        await page.locator('#country').selectOption('en');
        await page.locator('#universe').selectOption('1');
        // No 'ar' universe is numbered 1, so the picker falls back to the country's first.
        await page.locator('#country').selectOption('ar');
        const first = await page.locator('#universe option').first().getAttribute('value');
        expect(first).not.toBe('1');
        await expect(page.locator('#universe')).toHaveValue(first ?? '');
        expect(await page.evaluate(() => options.universe)).toBe(Number(first));
        // The message names the universe through the selected option, so it is not blank.
        await page.locator('#res-src-0').click();
        await page.locator('#res-src-m').fill('100000');
        await page.locator('#res-src-m').press('Enter');
        for (const [id, v] of [['#coord-g', '4'], ['#coord-s', '3'], ['#coord-p', '2']]) {
            await page.locator(id).fill('');
            await page.locator(id).pressSequentially(v);
        }
        await expect(page.locator('#atext')).toContainText(/\[4:3:2\] \(\S[^,]*, ar\.ogame\.gameforge\.com\)/);
    });

    test('parsing a source split from a link works', async ({ page }) => {
        await page.goto('/trade#rmd=2.4&rcd=1.5&st=2&dt=2&dmt=4&msrc=50&d=100000&l=en:1');
        await expect(page.locator('#res-src-2')).toBeChecked();
        await expect(page.locator('#res-dst-mix-4')).toBeChecked();
        await expect(page.locator('#mix-src-balance-proc')).toHaveValue('50');
        await expect(page.locator('#res-dst-m')).toHaveValue('120.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('75.000');
    });

    test('parsing from link works', async ({ page }) => {
        await page.goto('/trade#rmd=2.4&rcd=1.5&st=1&dt=2&dmt=1&mp1=2&mp2=3&c=100000&l=en:1&lc=1:2:3&lm=1');
        await expect(page.locator('#res-src-1')).toBeChecked();
        await expect(page.locator('#res-dst-2')).toBeChecked();
        await expect(page.locator('#res-dst-mix-1')).toBeChecked();
        await expect(page.locator('#mix-balance-prop1')).toHaveValue('2');
        await expect(page.locator('#mix-balance-prop2')).toHaveValue('3');
        await expect(page.locator('#res-src-c')).toHaveValue('100000');
        await expect(page.locator('#res-dst-m')).toHaveValue('34.783');
        await expect(page.locator('#res-dst-d')).toHaveValue('52.174');
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

    // Regression: options.rates is a nested object, and the old cookie format
    // split it on the commas inside its JSON, so it never survived a reload
    // (.claude/plans/settings-serialization.md).
    test('exchange rates survive a reload', async ({ page }) => {
        await page.locator('#rate-btn-1').click(); // preset [4, 2]
        await expect(page.locator('#rate-md')).toHaveValue('4');

        const stored = await page.evaluate(() => localStorage.getItem('options_trade'));
        expect(JSON.parse(stored).rates).toMatchObject({ md: 4, cd: 2 });

        await page.reload();
        await expect(page.locator('#rate-md')).toHaveValue('4');
        await expect(page.locator('#rate-cd')).toHaveValue('2');
    });
    // Issue #33: name what you want to receive, get the amount to sell.
    test('reverse answers the example from the request', async ({ page }) => {
        await page.locator('#rate-btn-5').click(); // 2 : 1.5 : 1
        await page.locator('#res-src-2').click();
        await page.locator('#res-dst-2').click();
        await page.locator('#dir-1').check();
        await expect(page.locator('#big-arrow')).toHaveClass(/bi-caret-left-fill/);
        await expect(page.locator('#dst-mix-block')).toBeHidden();
        await expect(page.locator('#res-dst-m')).toBeEditable();
        await expect(page.locator('#res-src-d')).not.toBeEditable();

        await page.locator('#res-dst-m').fill('11000000');
        await page.locator('#res-dst-m').press('Enter');
        await page.locator('#res-dst-c').fill('4000000');
        await page.locator('#res-dst-c').press('Enter');
        // 11 000 000 / 2 + 4 000 000 / 1.5 = 8 166 666.67, rounded up.
        await expect(page.locator('#res-src-d')).toHaveValue('8.166.667');
        await expect(page.locator('#res-src-cargo')).toContainText('1.307 SC / 262 LC');
        await expect(page.locator('#res-dst-cargo')).toContainText('2.400 SC / 480 LC');
        await expect(page.locator('#alink')).toContainText('&st=2&dt=2&dir=1&wm=11000000&wc=4000000&');
        await expect(page.locator('#atext')).toContainText('Selling 8.166.667 deut. Buying 11.000.000 met and 4.000.000 crys.');
    });

    test('the arrow flips the direction and keeps the deal', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-0').click();
        await page.locator('#res-dst-0').click();
        await page.locator('#res-src-m').fill('100000');
        await page.locator('#res-src-m').press('Enter');
        await expect(page.locator('#res-dst-c')).toHaveValue('62.500');
        await expect(page.locator('#res-dst-c')).not.toBeEditable();

        await page.locator('#dir-switch').click();
        await expect(page.locator('#dir-1')).toBeChecked();
        await expect(page.locator('#res-dst-c')).toHaveValue('62500');
        await expect(page.locator('#res-src-m')).toHaveValue('100.000');

        await page.locator('#dir-switch').click();
        await expect(page.locator('#dir-0')).toBeChecked();
        await expect(page.locator('#big-arrow')).toHaveClass(/bi-caret-right-fill/);
        await expect(page.locator('#res-src-m')).toHaveValue('100000');
        await expect(page.locator('#res-dst-c')).toHaveValue('62.500');
    });

    test('reverse is not offered for a pair source', async ({ page }) => {
        await page.locator('#res-src-3').click();
        await expect(page.locator('#dir-1')).toBeDisabled();
        await expect(page.locator('#dir-switch')).toBeDisabled();

        await page.locator('#res-src-2').click();
        await page.locator('#dir-1').check();
        await expect(page.locator('#res-src-3')).toBeDisabled();
    });

    test('parsing a reverse link works', async ({ page }) => {
        await page.goto('/trade#rmd=2&rcd=1.5&st=2&dt=2&dir=1&wm=11000000&wc=4000000&l=en:1');
        await expect(page.locator('#dir-1')).toBeChecked();
        await expect(page.locator('#res-dst-m')).toHaveValue('11000000');
        await expect(page.locator('#res-src-d')).toHaveValue('8.166.667');
    });
});
