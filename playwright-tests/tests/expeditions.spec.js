import { test, expect } from './base';

const PAGE_URL = '/ogame/calc/expeditions.php';

/** Load the page with the changelog popup suppressed. */
async function openPage(context, page, url = PAGE_URL) {
    await context.addInitScript(() => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
    });
    await page.goto(url);
}

test.describe('Expeditions Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        await openPage(context, page);
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Expeditions/i);
    });

    test('calculator options are available', async ({ page }) => {
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('the migrated modules are wired up', async ({ page }) => {
        const wired = await page.evaluate(() => ({
            core: typeof ExpeditionsCalculator,
            collector: typeof ExpeditionsDataCollector,
            renderer: typeof ExpeditionsRenderer,
            app: typeof ExpeditionsApp,
            instance: !!window.expeditionsApp,
        }));
        expect(wired).toEqual({
            core: 'function',
            collector: 'function',
            renderer: 'function',
            app: 'function',
            instance: true,
        });
    });

    test('jQuery is gone and Bootstrap is in', async ({ page }) => {
        const libs = await page.evaluate(() => ({
            jquery: typeof window.jQuery,
            bootstrap: typeof window.bootstrap,
        }));
        expect(libs).toEqual({ jquery: 'undefined', bootstrap: 'object' });
    });
});

// ---------------------------------------------------------------------------
// DOM integration: form inputs drive the rendered results.
// ---------------------------------------------------------------------------

async function openDom(context, page, url = PAGE_URL) {
    await context.addInitScript(() => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
        // Clear any persisted state so defaults are deterministic. Init scripts
        // also run on reload, so only wipe it on the first load - otherwise the
        // persistence test could never observe a saved value.
        if (!localStorage.getItem('pfg-exp-cleared')) {
            localStorage.removeItem('options_expeditions');
            localStorage.setItem('pfg-exp-cleared', '1');
        }
    });
    await page.goto(url);
}

/** Type a value into a numeric field and let the blur validation run. */
async function fillNumber(page, selector, value) {
    await page.locator(selector).fill(String(value));
    await page.locator(selector).blur();
}

test.describe('Expeditions Calculator - DOM integration', () => {
    test.beforeEach(async ({ context, page }) => {
        await openDom(context, page);
    });

    test('parameters are organized into Common and LifeForms tabs', async ({ page }) => {
        await expect(page.locator('#highTop')).toBeVisible();
        await expect(page.locator('#percent-resources')).toBeVisible();
        await expect(page.locator('#lf-cargo-203')).toBeHidden();

        await page.locator('#param-lf-tab').click();
        await expect(page.locator('#lf-cargo-203')).toBeVisible();
        await expect(page.locator('#open-lfbr')).toBeVisible();
        await expect(page.locator('#highTop')).toBeHidden();
    });

    test('the fleet drives the capacity, points and resource readouts', async ({ page }) => {
        await fillNumber(page, '#numLC', 10);

        await expect(page.locator('#storage-capacity')).toHaveText('250.000');
        await expect(page.locator('#max-points')).toHaveText('60.000 (3 LC)');
        await expect(page.locator('#max-find-met')).toHaveText('60.000');
        await expect(page.locator('#max-find-cry')).toHaveText('30.000');
        await expect(page.locator('#max-find-deu')).toHaveText('20.000');
        await expect(page.locator('#dark-matter-find')).toHaveText('1.800');
    });

    test('the "can be found" column follows the fleet', async ({ page }) => {
        await expect(page.locator('#canEP')).toHaveText('No');

        await fillNumber(page, '#numLC', 10);
        await expect(page.locator('#canEP')).toHaveText('Yes');
        await expect(page.locator('#canLC')).toHaveText('Yes');
        await expect(page.locator('#canHF')).toHaveText('Yes');
        await expect(page.locator('#canCR')).toHaveText('No');
        await expect(page.locator('#canRC')).toHaveText('No');

        await expect(page.locator('#findEP')).toHaveText('60');
        await expect(page.locator('#findLC')).toHaveText('5');
    });

    test('the hyperspace level raises the capacity', async ({ page }) => {
        await fillNumber(page, '#numLC', 10);
        await fillNumber(page, '#tech-hyper-level', 8);
        await expect(page.locator('#storage-capacity')).toHaveText('350.000');
    });

    test('the player class changes the capacity and the points', async ({ page }) => {
        await fillNumber(page, '#numRC', 10);
        await expect(page.locator('#storage-capacity')).toHaveText('200.000');
        await expect(page.locator('#max-points')).toHaveText(/^60\.000/);

        await page.locator('#player-class').selectOption('2');
        await expect(page.locator('#storage-capacity')).toHaveText('240.000');
        await expect(page.locator('#max-points')).toHaveText(/^40\.000/);
    });

    test('the life-form cargo bonus feeds the capacity', async ({ page }) => {
        await fillNumber(page, '#numLC', 10);
        await page.locator('#param-lf-tab').click();
        await fillNumber(page, '#lf-cargo-203', 10);
        await expect(page.locator('#storage-capacity')).toHaveText('275.000');
    });

    test('the Dark Matter bonus is applied', async ({ page }) => {
        await fillNumber(page, '#dark-matter-discovery-bonus', 50);
        await expect(page.locator('#dark-matter-find')).toHaveText('2.700');
    });

    test('the clear button empties the fleet', async ({ page }) => {
        await fillNumber(page, '#numLC', 10);
        await expect(page.locator('#storage-capacity')).toHaveText('250.000');

        await page.locator('#clear-fleet').click();
        await expect(page.locator('#numLC')).toHaveValue('0');
        await expect(page.locator('#storage-capacity')).toHaveText('0');
    });

    test('the reset button restores the defaults', async ({ page }) => {
        await fillNumber(page, '#numLC', 10);
        await fillNumber(page, '#percent-resources', 25);
        await page.locator('#player-class').selectOption('2');

        await page.locator('#reset').click();
        await expect(page.locator('#numLC')).toHaveValue('0');
        await expect(page.locator('#percent-resources')).toHaveValue('0');
        await expect(page.locator('#player-class')).toHaveValue('0');
        await expect(page.locator('#storage-capacity')).toHaveText('0');
    });

    test('out-of-range values are clamped on blur with a warning', async ({ page }) => {
        await fillNumber(page, '#percent-resources', 5000);
        await expect(page.locator('#percent-resources')).toHaveValue('999');
        await expect(page.locator('#warning')).toHaveClass(/visible/);
    });

    test('the parameters survive a reload', async ({ page }) => {
        await fillNumber(page, '#numLC', 7);
        await fillNumber(page, '#percent-ships', 12);

        await page.reload();
        await expect(page.locator('#numLC')).toHaveValue('7');
        await expect(page.locator('#percent-ships')).toHaveValue('12');
    });

    test('the API accordion documents the URL parameters', async ({ page }) => {
        await expect(page.locator('#api-table')).toBeHidden();
        await page.locator('#api-accordion .accordion-button').click();
        await expect(page.locator('#api-table')).toBeVisible();
    });
});

test.describe('Expeditions Calculator - URL API', () => {
    test('URL parameters populate the form and override the saved state', async ({ context, page }) => {
        const query = '?us=5&c=0&h=8&pr=10&ps=20&bc=30&bd=40&rd=20&dd=50&f={"203":12,"219":1}';
        await openDom(context, page, PAGE_URL + query);

        await expect(page.locator('#universe-speed')).toHaveValue('5');
        await expect(page.locator('#player-class')).toHaveValue('0');
        await expect(page.locator('#tech-hyper-level')).toHaveValue('8');
        await expect(page.locator('#percent-resources')).toHaveValue('10');
        await expect(page.locator('#percent-ships')).toHaveValue('20');
        await expect(page.locator('#class-bonus-collector')).toHaveValue('30');
        await expect(page.locator('#class-bonus-discoverer')).toHaveValue('40');
        await expect(page.locator('#resource-discovery-booster')).toHaveValue('20');
        await expect(page.locator('#dark-matter-discovery-bonus')).toHaveValue('50');
        await expect(page.locator('#numLC')).toHaveValue('12');
        await expect(page.locator('#numPA')).toHaveValue('1');
    });
});
