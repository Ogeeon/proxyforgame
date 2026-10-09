import { test, expect } from './base';

test.describe('Graviton Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Graviton/i);
    });

    test('calculator options are available', async ({ page }) => {
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('the migrated modules are wired up', async ({ page }) => {
        const wired = await page.evaluate(() => ({
            core: typeof GravitonCalculator,
            collector: typeof GravitonDataCollector,
            renderer: typeof GravitonRenderer,
            app: typeof GravitonApp,
            instance: !!window.gravitonApp,
        }));
        expect(wired).toEqual({
            core: 'function',
            collector: 'function',
            renderer: 'function',
            app: 'function',
            instance: true,
        });
    });
});

// ---------------------------------------------------------------------------
// DOM integration: form inputs drive the rendered breakdown and results.
// ---------------------------------------------------------------------------

// The life-form bonuses (LF energy bonus, cargo capacity increase) live on the
// "LifeForms" parameter tab, which is not active by default. Open it before
// interacting with those fields.
async function openLifeformsTab(page) {
    await page.locator('#param-lifeforms-tab').click();
    await expect(page.locator('#sc-capacity-increase')).toBeVisible();
}

test.describe('Graviton Calculator - DOM integration', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            // Clear any persisted state so defaults are deterministic.
            localStorage.removeItem('options_graviton');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('parameters are organized into Common, Buildings, Researches and LifeForms tabs', async ({ page }) => {
        // The Common tab is active by default; fields on the other tabs are hidden.
        await expect(page.locator('#max-planet-temp')).toBeVisible();
        await expect(page.locator('#shipyard-level')).toBeHidden();
        await expect(page.locator('#energy-tech-level')).toBeHidden();
        await expect(page.locator('#disr-chamber-level')).toBeHidden();
        await expect(page.locator('#sc-capacity-increase')).toBeHidden();

        // Buildings tab.
        await page.locator('#param-buildings-tab').click();
        await expect(page.locator('#shipyard-level')).toBeVisible();
        await expect(page.locator('#nanites-factory-level')).toBeVisible();

        // Researches tab.
        await page.locator('#param-researches-tab').click();
        await expect(page.locator('#energy-tech-level')).toBeVisible();
        await expect(page.locator('#hyper-tech-level')).toBeVisible();

        // The Disruption Chamber is a life-form building and lives on the LifeForms tab.
        await openLifeformsTab(page);
        await expect(page.locator('#disr-chamber-level')).toBeVisible();
        await expect(page.locator('#lc-capacity-increase')).toBeVisible();
        await expect(page.locator('#rc-capacity-increase')).toBeVisible();
        await expect(page.locator('#total-lf-energy-bonus')).toBeVisible();
        // Switching away from Common hides its controls.
        await expect(page.locator('#max-planet-temp')).toBeHidden();
    });

    test('editing the solar plant level updates its energy readout', async ({ page }) => {
        await page.locator('#solar-plant-level').fill('10');
        await page.locator('#solar-plant-level').blur();
        await expect(page.locator('#solar-plant-energy')).toHaveText('518');
    });

    test('the energy requirement reflects the graviton level', async ({ page }) => {
        await page.locator('#graviton-level').fill('2');
        await page.locator('#graviton-level').blur();
        // 300000 * 3 = 900000, formatted with the locale thousands separator.
        await expect(page.locator('#energy-requirement')).toContainText('900');
    });

    test('cargo capacity increase updates the transports readout', async ({ page }) => {
        // Default: no plants, graviton 1 -> all energy from satellites, so the
        // transports row is populated and reacts to the capacity increase.
        const before = await page.locator('#cargoes').textContent();
        await openLifeformsTab(page);
        await page.locator('#sc-capacity-increase').fill('100');
        await page.locator('#sc-capacity-increase').blur();
        const after = await page.locator('#cargoes').textContent();
        expect(after).not.toBe(before);
    });

    test('recycler capacity increase updates the recyclers readout', async ({ page }) => {
        // Default: satellites cover graviton 1, so the debris field and the
        // recyclers row are populated and react to the capacity increase.
        const before = await page.locator('#recyclers').textContent();
        await openLifeformsTab(page);
        await page.locator('#rc-capacity-increase').fill('100');
        await page.locator('#rc-capacity-increase').blur();
        const after = await page.locator('#recyclers').textContent();
        expect(after).not.toBe(before);
    });

    test('selecting the general class lowers the recyclers needed', async ({ page }) => {
        const before = await page.locator('#recyclers').textContent();
        await page.locator('#player-class-2').check(); // General
        const after = await page.locator('#recyclers').textContent();
        expect(after).not.toBe(before);
        // The General leaves transports untouched.
        await expect(page.locator('#player-class-2')).toBeChecked();
    });

    test('the class radios are mutually exclusive', async ({ page }) => {
        await page.locator('#player-class-1').check(); // Collector
        await expect(page.locator('#player-class-1')).toBeChecked();
        await page.locator('#player-class-2').check(); // General
        await expect(page.locator('#player-class-2')).toBeChecked();
        await expect(page.locator('#player-class-1')).not.toBeChecked();
        await expect(page.locator('#player-class-0')).not.toBeChecked();
    });

    test('reset restores the default field values', async ({ page }) => {
        // player-class-2 lives on the (default) General tab
        await page.locator('#player-class-2').check(); // General
        await page.locator('#solar-plant-level').fill('25');
        await page.locator('#graviton-level').fill('5');
        // The capacity fields live on the LifeForms tab
        await openLifeformsTab(page);
        await page.locator('#sc-capacity-increase').fill('40');
        await page.locator('#lc-capacity-increase').fill('60');
        await page.locator('#rc-capacity-increase').fill('80');
        await page.locator('#sc-capacity-increase').blur();

        await page.locator('#reset').click();

        await expect(page.locator('#solar-plant-level')).toHaveValue('0');
        await expect(page.locator('#graviton-level')).toHaveValue('1');
        await expect(page.locator('#energy-bonus-0')).toBeChecked();
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#lc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#rc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#player-class-0')).toBeChecked();
    });
});

// ---------------------------------------------------------------------------
// DOM integration for the new fields.
// ---------------------------------------------------------------------------

test.describe('Graviton Calculator - Delivery and debris DOM', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            localStorage.removeItem('options_graviton');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('the new fields are on the page', async ({ page }) => {
        await expect(page.locator('#crystal-available')).toBeVisible();
        await expect(page.locator('#deuterium-available')).toBeVisible();
        await expect(page.locator('#crystal-to-deliver')).toBeVisible();
        await expect(page.locator('#deuterium-to-deliver')).toBeVisible();
        await expect(page.locator('#deut-in-debris')).toBeVisible();
        await expect(page.locator('#deuterium-recyclable')).toBeVisible();
        await expect(page.locator('#net-crystal-required')).toBeVisible();
        await expect(page.locator('#net-deuterium-required')).toBeVisible();
    });

    test('with an empty stock the delivery equals the cost', async ({ page }) => {
        const required = await page.locator('#crystal-required').textContent();
        await expect(page.locator('#crystal-to-deliver')).toHaveText(required);
    });

    test('entering crystal on hand lowers the crystal to deliver', async ({ page }) => {
        const before = await page.locator('#crystal-to-deliver').textContent();
        await page.locator('#crystal-available').fill('5000000');
        await page.locator('#crystal-available').blur();
        const after = await page.locator('#crystal-to-deliver').textContent();
        expect(after).not.toBe(before);
        // The build cost itself is untouched.
        await expect(page.locator('#crystal-required')).not.toHaveText(after);
    });

    test('stock on hand lowers the transports needed', async ({ page }) => {
        const before = await page.locator('#cargoes').textContent();
        await page.locator('#crystal-available').fill('10000000');
        await page.locator('#crystal-available').blur();
        const after = await page.locator('#cargoes').textContent();
        expect(after).not.toBe(before);
    });

    test('the deuterium-in-debris checkbox fills the deuterium debris readout', async ({ page }) => {
        await expect(page.locator('#deuterium-recyclable')).toHaveText('0');
        await page.locator('#deut-in-debris').check();
        await expect(page.locator('#deuterium-recyclable')).not.toHaveText('0');
        // ...and it lowers the net deuterium cost.
        const netDeut = await page.locator('#net-deuterium-required').textContent();
        const grossDeut = await page.locator('#deuterium-required').textContent();
        expect(netDeut).not.toBe(grossDeut);
    });

    test('a debris percentage above 40 survives the save/load round trip', async ({ page }) => {
        // The validator used to clamp at 40 and fall back to a non-existent
        // 100 option, so any choice above 40 came back blank after a reload.
        await page.selectOption('#debris-percent', '70');
        const restored = await page.evaluate(() => {
            options.load(); // re-reads the saved state through validate()
            return options.prm.debrisPercent;
        });
        expect(restored).toBe(70);
    });

    test('reset clears the stock fields and the debris checkbox', async ({ page }) => {
        await page.locator('#crystal-available').fill('123456');
        await page.locator('#deuterium-available').fill('7890');
        await page.locator('#crystal-available').blur();
        await page.locator('#deut-in-debris').check();

        await page.locator('#reset').click();

        await expect(page.locator('#crystal-available')).toHaveValue('0');
        await expect(page.locator('#deuterium-available')).toHaveValue('0');
        await expect(page.locator('#deut-in-debris')).not.toBeChecked();
    });
});
