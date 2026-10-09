import { test, expect } from './base';

test.describe('Terraformer Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/terraformer.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Terraformer/i);
    });

    test('calculator options are available', async ({ page }) => {
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('the migrated modules are wired up', async ({ page }) => {
        const wired = await page.evaluate(() => ({
            core: typeof TerraformerCalculator,
            collector: typeof TerraformerDataCollector,
            renderer: typeof TerraformerRenderer,
            app: typeof TerraformerApp,
            instance: !!window.terraformerApp,
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

test.describe('Terraformer Calculator - DOM integration', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            // Clear any persisted state so defaults are deterministic.
            localStorage.removeItem('options_terraformer');
        });
        await page.goto('/ogame/calc/terraformer.php');
    });

    test('parameters are organized into Common, Buildings, Researches and LifeForms tabs', async ({ page }) => {
        // The Common tab is active by default; fields on the other tabs are hidden.
        await expect(page.locator('#max-planet-temp')).toBeVisible();
        await expect(page.locator('#robots-factory-level')).toBeHidden();
        await expect(page.locator('#energy-tech-level')).toBeHidden();
        await expect(page.locator('#disr-chamber-level')).toBeHidden();
        await expect(page.locator('#sc-capacity-increase')).toBeHidden();

        // Buildings tab.
        await page.locator('#param-buildings-tab').click();
        await expect(page.locator('#robots-factory-level')).toBeVisible();
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
        await expect(page.locator('#total-lf-energy-bonus')).toBeVisible();
        // Switching away from Common hides its controls.
        await expect(page.locator('#max-planet-temp')).toBeHidden();
    });

    test('editing the solar plant level updates its energy readout', async ({ page }) => {
        await page.locator('#solar-plant-level').fill('10');
        await page.locator('#solar-plant-level').blur();
        await expect(page.locator('#solar-plant-energy')).toHaveText('518');
    });

    test('the energy requirement reflects the terraformer level', async ({ page }) => {
        await page.locator('#tf-level-to').fill('2');
        await page.locator('#tf-level-to').blur();
        // getBuildEnergyCost_C(33, 2) = 2000.
        await expect(page.locator('#energy-needed')).toHaveText('2.000');
    });

    test('the single-level checkbox hides the "from" level field', async ({ page }) => {
        await expect(page.locator('#tf-level-from')).toBeVisible();
        await page.locator('#single-level').check();
        await expect(page.locator('#tf-level-from')).toBeHidden();
        await expect(page.locator('#level-spacer')).toBeHidden();
        await page.locator('#single-level').uncheck();
        await expect(page.locator('#tf-level-from')).toBeVisible();
    });

    test('cargo capacity increase updates the transports readout', async ({ page }) => {
        // Terraformer level 1, no plants -> the transports row is populated.
        await page.locator('#tf-level-to').fill('1');
        await page.locator('#tf-level-to').blur();
        const before = await page.locator('#cargoes').textContent();
        await openLifeformsTab(page);
        await page.locator('#sc-capacity-increase').fill('100');
        await page.locator('#sc-capacity-increase').blur();
        const after = await page.locator('#cargoes').textContent();
        expect(after).not.toBe(before);
    });

    test('the class radios are mutually exclusive', async ({ page }) => {
        await page.locator('#player-class-1').check(); // Collector
        await expect(page.locator('#player-class-1')).toBeChecked();
        await page.locator('#player-class-2').check(); // General
        await expect(page.locator('#player-class-2')).toBeChecked();
        await expect(page.locator('#player-class-1')).not.toBeChecked();
        await expect(page.locator('#player-class-0')).not.toBeChecked();
    });

    test('the resources-on-hand fields are on the page', async ({ page }) => {
        await expect(page.locator('#crystal-available')).toBeVisible();
        await expect(page.locator('#deuterium-available')).toBeVisible();
        await expect(page.locator('#crystal-to-deliver')).toBeVisible();
        await expect(page.locator('#deuterium-to-deliver')).toBeVisible();
    });

    test('with an empty stock the delivery equals the total cost', async ({ page }) => {
        await page.locator('#tf-level-to').fill('1');
        await page.locator('#tf-level-to').blur();
        const total = await page.locator('#crystal-required-total').textContent();
        await expect(page.locator('#crystal-to-deliver')).toHaveText(total);
    });

    test('entering crystal on hand lowers the crystal to deliver', async ({ page }) => {
        await page.locator('#tf-level-to').fill('1');
        await page.locator('#tf-level-to').blur();
        const before = await page.locator('#crystal-to-deliver').textContent();
        await page.locator('#crystal-available').fill('20000');
        await page.locator('#crystal-available').blur();
        const after = await page.locator('#crystal-to-deliver').textContent();
        expect(after).not.toBe(before);
        // The build cost itself is untouched.
        await expect(page.locator('#crystal-required-total')).not.toHaveText(after);
    });

    test('stock on hand lowers the transports needed', async ({ page }) => {
        await page.locator('#tf-level-to').fill('1');
        await page.locator('#tf-level-to').blur();
        const before = await page.locator('#cargoes').textContent();
        await page.locator('#crystal-available').fill('50000');
        await page.locator('#crystal-available').blur();
        const after = await page.locator('#cargoes').textContent();
        expect(after).not.toBe(before);
    });

    test('reset restores the default field values', async ({ page }) => {
        await page.locator('#player-class-2').check(); // General
        await page.locator('#solar-plant-level').fill('25');
        await page.locator('#tf-level-to').fill('5');
        await page.locator('#single-level').check();
        await page.locator('#crystal-available').fill('123456');
        await page.locator('#deuterium-available').fill('7890');
        await page.locator('#deuterium-available').blur();
        // The capacity fields live on the LifeForms tab
        await openLifeformsTab(page);
        await page.locator('#sc-capacity-increase').fill('40');
        await page.locator('#lc-capacity-increase').fill('60');
        await page.locator('#sc-capacity-increase').blur();

        await page.locator('#reset').click();

        await expect(page.locator('#solar-plant-level')).toHaveValue('0');
        await expect(page.locator('#tf-level-to')).toHaveValue('0');
        await expect(page.locator('#energy-bonus-0')).toBeChecked();
        await expect(page.locator('#player-class-0')).toBeChecked();
        await expect(page.locator('#single-level')).not.toBeChecked();
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#lc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#crystal-available')).toHaveValue('0');
        await expect(page.locator('#deuterium-available')).toHaveValue('0');
        // Un-checking single-level on reset re-shows the "from" field.
        await expect(page.locator('#tf-level-from')).toBeVisible();
    });
});
