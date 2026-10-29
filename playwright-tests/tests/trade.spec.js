import { test, expect } from './base';

/**
 * Types a value into a field and presses Enter, which fires the keyup the page
 * recalculates on.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} value
 */
async function enter(page, selector, value) {
    await page.locator(selector).fill(value);
    await page.locator(selector).press('Enter');
}

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

    // Selling one resource, every destination and mix mode at 2.4 : 1.5 : 1.
    // `first` and `second` are the two resources it buys, in mix order.
    const SINGLE_SOURCES = [
        {
            name: 'Metal', src: 0, field: 'm', first: 'c', second: 'd',
            onlyFirst: ['62.500', '10 SC / 2 LC'], onlySecond: ['41.667', '7 SC / 2 LC'],
            percent: ['31.250', '20.833', '9 SC / 2 LC'], proportion: ['35.714', '17.857'],
            fixFirst: ['20.000', '28.333'], fixSecond: ['47.500', '10.000'], hyperCargo: '6 SC / 2 LC',
        },
        {
            name: 'Crystal', src: 1, field: 'c', first: 'm', second: 'd',
            onlyFirst: ['160.000', '26 SC / 6 LC'], onlySecond: ['66.667', '11 SC / 3 LC'],
            percent: ['61.538', '41.026', '17 SC / 4 LC'], proportion: ['72.727', '36.364'],
            fixFirst: ['20.000', '58.333'], fixSecond: ['136.000', '10.000'], hyperCargo: '13 SC / 3 LC',
        },
        {
            name: 'Deut', src: 2, field: 'd', first: 'm', second: 'c',
            onlyFirst: ['240.000', '39 SC / 8 LC'], onlySecond: ['150.000', '24 SC / 5 LC'],
            percent: ['116.129', '77.419', '31 SC / 7 LC'], proportion: ['133.333', '66.667', '32 SC / 7 LC'],
            fixFirst: ['20.000', '137.500'], fixSecond: ['224.000', '10.000'], hyperCargo: '21 SC / 5 LC',
        },
    ];

    for (const c of SINGLE_SOURCES) {
        test(`${c.name} calculations are correct`, async ({ page }) => {
            const dst = (r) => page.locator('#res-dst-' + r);
            /** The two destination amounts, and the destination cargo when given. */
            const expectMix = async ([first, second, cargo]) => {
                await expect(dst(c.first)).toHaveValue(first);
                await expect(dst(c.second)).toHaveValue(second);
                if (cargo) await expect(page.locator('#res-dst-cargo')).toContainText(cargo);
            };

            await page.locator('#rate-btn-6').click();
            await page.locator('#res-src-' + c.src).click();
            await enter(page, '#res-src-' + c.field, '100000');
            await expect(page.locator('#res-src-cargo')).toContainText('16 SC / 4 LC');

            await page.locator('#res-dst-0').click();
            await expect(dst(c.first)).toHaveValue(c.onlyFirst[0]);
            await expect(page.locator('#res-dst-cargo')).toContainText(c.onlyFirst[1]);
            await page.locator('#res-dst-1').click();
            await expect(dst(c.second)).toHaveValue(c.onlySecond[0]);
            await expect(page.locator('#res-dst-cargo')).toContainText(c.onlySecond[1]);

            await page.locator('#res-dst-2').click();
            await enter(page, '#mix-balance-proc', '60');
            await expectMix(c.percent);
            await page.locator('#res-dst-mix-1').check();
            await enter(page, '#mix-balance-prop1', '2');
            await expectMix(c.proportion);
            await page.locator('#res-dst-mix-2').check();
            await enter(page, '#mix-fix1', '20000');
            await expectMix(c.fixFirst);
            await page.locator('#res-dst-mix-3').check();
            await enter(page, '#mix-fix2', '10000');
            await expectMix(c.fixSecond);

            await enter(page, '#hypertech-lvl', '20');
            await expect(page.locator('#res-src-cargo')).toContainText('9 SC / 2 LC');
            await expect(page.locator('#res-dst-cargo')).toContainText(c.hyperCargo);
        });
    }

    test('the source split mode divides what is being sold', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-2').click();
        await enter(page, '#res-src-d', '100000');
        await page.locator('#res-dst-2').click();
        await enter(page, '#mix-src-balance-proc', '50');
        // 50.000 deut buys metal at 2.4 and the other 50.000 buys crystal at 1.5
        await expect(page.locator('#res-dst-mix-4')).toBeChecked();
        await expect(page.locator('#res-dst-m')).toHaveValue('120.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('75.000');
        await enter(page, '#mix-src-balance-proc', '25');
        await expect(page.locator('#res-dst-m')).toHaveValue('60.000');
        await expect(page.locator('#res-dst-c')).toHaveValue('112.500');
    });

    // Selling a pair: the one resource it can buy, at 2.4 : 1.5 : 1.
    const PAIR_SOURCES = [
        { name: 'Metal+Crystal', src: 3, sold: [['m', '100000'], ['c', '50000']], dst: 'd', value: '75.000', cargo: '12 SC / 3 LC' },
        { name: 'Metal+Deut', src: 4, sold: [['m', '100000'], ['d', '50000']], dst: 'c', value: '137.500', cargo: '22 SC / 5 LC' },
        { name: 'Crystal+Deut', src: 5, sold: [['c', '100000'], ['d', '50000']], dst: 'm', value: '280.000', cargo: '45 SC / 9 LC' },
    ];

    for (const c of PAIR_SOURCES) {
        test(`${c.name} calculations are correct`, async ({ page }) => {
            await page.locator('#rate-btn-6').click();
            await page.locator('#res-src-' + c.src).click();
            for (const [field, amount] of c.sold) {
                await enter(page, '#res-src-' + field, amount);
            }
            await expect(page.locator('#res-src-cargo')).toContainText('24 SC / 5 LC');
            await expect(page.locator('#res-dst-' + c.dst)).toHaveValue(c.value);
            await expect(page.locator('#res-dst-cargo')).toContainText(c.cargo);
        });
    }

    test('links are correct', async ({ page }) => {
        await page.locator('#rate-btn-6').click();
        await page.locator('#res-src-0').click();
        await enter(page, '#res-src-m', '100000');
        await page.locator('#res-dst-mix-3').check();
        await enter(page, '#mix-fix2', '10000');
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
        await enter(page, '#res-src-m', '100000');
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

        await enter(page, '#res-dst-m', '11000000');
        await enter(page, '#res-dst-c', '4000000');
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
        await enter(page, '#res-src-m', '100000');
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
