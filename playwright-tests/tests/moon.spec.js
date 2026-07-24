import { test, expect } from './base';

test.describe('Moon Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Moon/i);
    });

    test('calculator options are available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('the migrated modules are wired up', async ({ page }) => {
        const wired = await page.evaluate(() => ({
            core: typeof MoonCalculator,
            collector: typeof MoonDataCollector,
            renderer: typeof MoonRenderer,
            app: typeof MoonApp,
            instance: !!window.moonApp,
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
// DOM integration: form inputs drive the rendered results.
// ---------------------------------------------------------------------------

async function openFleetTab(page) {
    await page.locator('#param-fleet-tab').click();
    await expect(page.locator('#light-fighter')).toBeVisible();
}

async function openDefensesTab(page) {
    await page.locator('#param-defenses-tab').click();
    await expect(page.locator('#plasma-turret')).toBeVisible();
}

test.describe('Moon Calculator - DOM integration', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            // Clear any persisted state so defaults are deterministic. Init
            // scripts also run on reload, so only wipe it on the first load -
            // otherwise the persistence test could never observe a saved value.
            if (!localStorage.getItem('pfg-state-cleared')) {
                localStorage.removeItem('options_moon');
                localStorage.setItem('pfg-state-cleared', '1');
            }
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('creation parameters are organized into Common, Fleet and Defenses tabs', async ({ page }) => {
        // The Common tab is active by default; fields on the other tabs are hidden.
        await expect(page.locator('#debris-percent')).toBeVisible();
        await expect(page.locator('#promo-moon')).toBeVisible();
        await expect(page.locator('#light-fighter')).toBeHidden();
        await expect(page.locator('#plasma-turret')).toBeHidden();

        await openFleetTab(page);
        await expect(page.locator('#solar-sat')).toBeVisible();
        await expect(page.locator('#death-star')).toBeVisible();

        await openDefensesTab(page);
        await expect(page.locator('#rocket-launcher')).toBeVisible();
        await expect(page.locator('#large-shield')).toBeVisible();
        // Switching away from Common hides its controls.
        await expect(page.locator('#debris-percent')).toBeHidden();
    });

    test('the destruction chances react to the moon diameter', async ({ page }) => {
        await page.locator('#moon-size').fill('2500');
        await page.locator('#moon-size').blur();
        await expect(page.locator('#moon-destroy-chance')).toHaveText('50%');
        await expect(page.locator('#ds-blow-chance')).toHaveText('25%');
    });

    test('entering a fleet updates the chance, cost and recycling readouts', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();

        await expect(page.locator('#moon-create-chance')).toHaveText('1.2%');
        await expect(page.locator('#metal-required')).toHaveText('300.000');
        await expect(page.locator('#metal-recyclable')).toHaveText('90.000');
        await expect(page.locator('#debris-total')).toHaveText('120.000');
        await expect(page.locator('#recyclers')).toHaveText('6');
    });

    test('the defenses checkbox switches the defense contribution on', async ({ page }) => {
        await openDefensesTab(page);
        await page.locator('#plasma-turret').fill('10');
        await page.locator('#plasma-turret').blur();
        // Defenses stay out of the field by default...
        await expect(page.locator('#debris-total')).toHaveText('0');
        // ...but the resources were still spent.
        await expect(page.locator('#metal-required')).toHaveText('500.000');
        await expect(page.locator('#plasma-turret-max')).toHaveText('-');

        await page.locator('#param-common-tab').click();
        await page.locator('#defense-to-debris').check();
        await expect(page.locator('#debris-total')).toHaveText('300.000');
        await expect(page.locator('#moon-create-chance')).toHaveText('3%');
    });

    test('the deuterium checkbox adds deuterium to the recycling block', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#solar-sat').fill('1000');
        await page.locator('#solar-sat').blur();
        await expect(page.locator('#deuterium-recyclable')).toHaveText('0');

        await page.locator('#param-common-tab').click();
        await page.locator('#deut-to-debris').check();
        await expect(page.locator('#deuterium-recyclable')).toHaveText('150.000');
    });

    test('the general class lowers the recyclers needed', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();
        await page.locator('#param-common-tab').click();
        await expect(page.locator('#recyclers')).toHaveText('6');

        await page.locator('#general-class').check(); // General -> hold 24000
        await expect(page.locator('#recyclers')).toHaveText('5');
    });

    test('the recycler capacity increase lowers the recyclers needed', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();
        await page.locator('#param-common-tab').click();

        await page.locator('#rc-capacity-increase').fill('50'); // hold 30000
        await page.locator('#rc-capacity-increase').blur();
        await expect(page.locator('#recyclers')).toHaveText('4');
    });

    test('the promo checkbox lifts the chance above 20%', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#death-star').fill('1');
        await page.locator('#death-star').blur();
        await expect(page.locator('#moon-create-chance')).toHaveText('20%');

        await page.locator('#param-common-tab').click();
        await page.locator('#promo-moon').check();
        await expect(page.locator('#moon-create-chance')).toHaveText('27%');
    });

    test('the destruction reset restores its own fields only', async ({ page }) => {
        await page.locator('#moon-size').fill('2500');
        await page.locator('#ds-count').fill('7');
        await page.locator('#hypertech-lvl').fill('12');
        await page.locator('#hypertech-lvl').blur();

        await page.locator('#reset-ds').click();

        await expect(page.locator('#moon-size')).toHaveValue('1');
        await expect(page.locator('#ds-count')).toHaveValue('1');
        // The creation section is untouched.
        await expect(page.locator('#hypertech-lvl')).toHaveValue('12');
    });

    test('the creation reset clears the units, selects and checkboxes', async ({ page }) => {
        await page.locator('#hypertech-lvl').fill('12');
        await page.locator('#debris-percent').selectOption('60');
        await page.locator('#general-class').check();
        await page.locator('#rc-capacity-increase').fill('80');
        await page.locator('#rc-capacity-increase').blur();
        await page.locator('#defense-to-debris').check();
        await page.locator('#deut-to-debris').check();
        await page.locator('#promo-moon').check();
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();

        await page.locator('#reset-cr').click();

        await expect(page.locator('#light-fighter')).toHaveValue('0');
        await page.locator('#param-common-tab').click();
        await expect(page.locator('#hypertech-lvl')).toHaveValue('0');
        await expect(page.locator('#debris-percent')).toHaveValue('30');
        await expect(page.locator('#general-class')).not.toBeChecked();
        await expect(page.locator('#rc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#defense-to-debris')).not.toBeChecked();
        await expect(page.locator('#deut-to-debris')).not.toBeChecked();
        await expect(page.locator('#promo-moon')).not.toBeChecked();
        await expect(page.locator('#moon-create-chance')).toHaveText('0%');
    });

    test('the checkbox settings survive a reload', async ({ page }) => {
        await page.locator('#promo-moon').check();
        await page.locator('#debris-percent').selectOption('70');
        await page.reload();
        await expect(page.locator('#promo-moon')).toBeChecked();
        await expect(page.locator('#debris-percent')).toHaveValue('70');
    });
});
