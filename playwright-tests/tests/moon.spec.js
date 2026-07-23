import { test, expect } from '@playwright/test';

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
// Core computation. MoonCalculator is DOM-free, so it is driven directly
// through page.evaluate() with a full params object per case.
// ---------------------------------------------------------------------------

const BASE_PRM = {
    moonSize: 1,
    dsCount: 1,
    debrisPercent: 30,
    hyperTechLevel: 0,
    defenseToDebris: false,
    deutToDebris: false,
    promoMoon: false,
    counts: {},
};

function compute(page, overrides = {}) {
    return page.evaluate((prm) => new MoonCalculator().compute(prm),
        { ...BASE_PRM, ...overrides });
}

test.describe('Moon Calculator - Destruction', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('destruction chance follows (100 - sqrt(size)) * sqrt(ds)', async ({ page }) => {
        // sqrt(2500) = 50 -> (100 - 50) * sqrt(1) = 50
        const r = await compute(page, { moonSize: 2500, dsCount: 1 });
        expect(r.destroyChance).toBe(50);
    });

    test('more Death Stars raise the destruction chance', async ({ page }) => {
        const one = await compute(page, { moonSize: 8000, dsCount: 1 });
        const four = await compute(page, { moonSize: 8000, dsCount: 4 });
        expect(four.destroyChance).toBeCloseTo(one.destroyChance * 2, 6);
    });

    test('the destruction chance is capped at 100%', async ({ page }) => {
        const r = await compute(page, { moonSize: 2500, dsCount: 100 });
        expect(r.destroyChance).toBe(100);
    });

    test('the Death Star blow chance is half the square root of the diameter', async ({ page }) => {
        const r = await compute(page, { moonSize: 2500 });
        expect(r.blowChance).toBe(25);
    });
});

test.describe('Moon Calculator - Creation', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('fleet feeds the debris field at the universe debris rate', async ({ page }) => {
        // 100 light fighters: 300000 metal / 100000 crystal, 30% into the field.
        const r = await compute(page, { counts: { 'light-fighter': 100 } });
        expect(r.metalRequired).toBe(300000);
        expect(r.crystalRequired).toBe(100000);
        expect(r.recyclableMetal).toBe(90000);
        expect(r.recyclableCrystal).toBe(30000);
        expect(r.debrisTotal).toBe(120000);
        // 100k of debris is worth 1% -> 120k is 1.2%.
        expect(r.createChance).toBeCloseTo(0.012, 10);
    });

    test('solar satellites always contribute, without any toggle', async ({ page }) => {
        // Satellites cannot leave the planet, so they always die and always
        // land in the debris field: 1000 * 2000 crystal * 30% = 600000.
        const r = await compute(page, { counts: { 'solar-sat': 1000 } });
        expect(r.debrisTotal).toBe(600000);
        expect(r.createChance).toBeCloseTo(0.06, 10);
    });

    test('defenses only feed the debris field when the setting is on', async ({ page }) => {
        const counts = { 'plasma-turret': 10 }; // 500000 metal / 500000 crystal
        const off = await compute(page, { counts });
        const on = await compute(page, { counts, defenseToDebris: true });

        // The build cost is shown either way — the resources were spent.
        expect(off.metalRequired).toBe(500000);
        expect(on.metalRequired).toBe(500000);

        expect(off.debrisTotal).toBe(0);
        expect(on.debrisTotal).toBe(300000);
        expect(on.createChance).toBeCloseTo(0.03, 10);
    });

    test('deuterium only feeds the debris field when the setting is on', async ({ page }) => {
        const counts = { 'solar-sat': 1000 }; // 2000 crystal + 500 deuterium each
        const off = await compute(page, { counts });
        const on = await compute(page, { counts, deutToDebris: true });

        expect(off.recyclableDeut).toBe(0);
        expect(on.recyclableDeut).toBe(150000); // 500000 * 30%
        expect(on.debrisTotal).toBe(off.debrisTotal + 150000);
    });

    test('the moon chance is capped at 20%', async ({ page }) => {
        // A single Death Star already drops 2.7M of debris - far past the cap.
        const r = await compute(page, { counts: { 'death-star': 1 } });
        expect(r.debrisTotal).toBe(2700000);
        expect(r.chanceCap).toBe(0.20);
        expect(r.createChance).toBe(0.20);
    });

    test('the promo event raises the cap to 40%', async ({ page }) => {
        const r = await compute(page, { counts: { 'death-star': 1 }, promoMoon: true });
        expect(r.chanceCap).toBe(0.40);
        // 2.7M of debris is 27%, which now fits below the raised cap.
        expect(r.createChance).toBeCloseTo(0.27, 10);
    });

    test('the promo cap is still a cap', async ({ page }) => {
        const r = await compute(page, { counts: { 'death-star': 2 }, promoMoon: true });
        expect(r.createChance).toBe(0.40);
    });

    test('recyclers carry the whole field, deuterium included', async ({ page }) => {
        const counts = { 'light-fighter': 100 }; // 120000 debris at 30%
        const plain = await compute(page, { counts });
        // Base recycler hold is 20000.
        expect(plain.recyclers).toBe(6);

        // Hyperspace technology adds 5% per level: 20000 * 1.5 = 30000.
        const teched = await compute(page, { counts, hyperTechLevel: 10 });
        expect(teched.recyclers).toBe(Math.ceil(120000 / 30000));
    });

    test('deuterium in the field raises the recyclers needed', async ({ page }) => {
        const counts = { cruiser: 100 }; // 2000 deuterium each
        const off = await compute(page, { counts });
        const on = await compute(page, { counts, deutToDebris: true });
        expect(on.recyclers).toBeGreaterThan(off.recyclers);
        expect(on.recyclers).toBe(Math.ceil(on.debrisTotal / 20000));
    });

    test('a higher debris rate raises both the chance and the recyclers', async ({ page }) => {
        const counts = { 'light-fighter': 100 };
        const low = await compute(page, { counts, debrisPercent: 30 });
        const high = await compute(page, { counts, debrisPercent: 60 });
        expect(high.debrisTotal).toBe(low.debrisTotal * 2);
        expect(high.createChance).toBeCloseTo(low.createChance * 2, 10);
        expect(high.recyclers).toBeGreaterThan(low.recyclers);
    });
});

test.describe('Moon Calculator - Units for the maximum chance', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('a unit count reaches the 2M debris the 20% cap needs', async ({ page }) => {
        // Light fighter: (3000 + 1000) * 30% = 1200 of debris each.
        const r = await compute(page);
        expect(r.maxCounts['light-fighter']).toBe(Math.ceil(2000000 / 1200));
        // Espionage probes only carry crystal: 1000 * 30% = 300 each.
        expect(r.maxCounts['esp-probe']).toBe(Math.ceil(2000000 / 300));
    });

    test('the promo cap doubles the units needed', async ({ page }) => {
        const plain = await compute(page);
        const promo = await compute(page, { promoMoon: true });
        expect(promo.maxCounts['light-fighter']).toBe(2 * plain.maxCounts['light-fighter']);
    });

    test('deuterium counted in the field lowers the units needed', async ({ page }) => {
        const off = await compute(page);
        const on = await compute(page, { deutToDebris: true });
        // The cruiser carries deuterium, the light fighter does not.
        expect(on.maxCounts.cruiser).toBeLessThan(off.maxCounts.cruiser);
        expect(on.maxCounts['light-fighter']).toBe(off.maxCounts['light-fighter']);
    });

    test('defenses have no maximum while they stay out of the field', async ({ page }) => {
        const off = await compute(page);
        expect(off.maxCounts['plasma-turret']).toBeNull();

        const on = await compute(page, { defenseToDebris: true });
        // (50000 + 50000) * 30% = 30000 of debris each.
        expect(on.maxCounts['plasma-turret']).toBe(Math.ceil(2000000 / 30000));
    });

    test('a rocket launcher with no deuterium value still has a maximum', async ({ page }) => {
        const r = await compute(page, { defenseToDebris: true });
        expect(r.maxCounts['rocket-launcher']).toBe(Math.ceil(2000000 / (2000 * 0.3)));
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
