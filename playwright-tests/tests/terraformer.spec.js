import { test, expect } from '@playwright/test';

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
// Core computation. TerraformerCalculator.compute() is DOM-free, so it is driven
// directly through page.evaluate() with a full params object per case.
// ---------------------------------------------------------------------------

const BASE_PRM = {
    robotsFactoryLevel: 0,
    shipyardLevel: 1,
    nanitesFactoryLevel: 0,
    universeSpeed: 1,
    energyTechLevel: 0,
    hyperTechLevel: 0,
    maxPlanetTemp: 0,
    energyBonus: 0,
    solarPlantLevel: 0,
    solarPlantPercent: 100,
    fusionPlantLevel: 0,
    fusionPlantPercent: 100,
    solarSatellitesCount: 0,
    solarSatellitesPercent: 100,
    playerClass: 0,
    isTrader: false,
    energyBoost: 0,
    disChLevel: 0,
    totalLFEnrgBonus: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    tfSingleLevel: false,
    tfLevelFrom: 0,
    tfLevelTo: 0,
    crysAvailable: 0,
    deutAvailable: 0,
};

function compute(page, overrides = {}) {
    return page.evaluate((prm) => new TerraformerCalculator().compute(prm),
        { ...BASE_PRM, ...overrides });
}

test.describe('Terraformer Calculator - Core computation', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/terraformer.php');
    });

    test('solar plant energy follows the OGame formula', async ({ page }) => {
        // floor(0.01 * 100 * floor(20 * 10 * 1.1^10)) = 518
        const r = await compute(page, { solarPlantLevel: 10 });
        expect(r.solarPlantEnergy).toBe(518);
    });

    test('fusion plant energy grows with energy technology', async ({ page }) => {
        const plain = await compute(page, { fusionPlantLevel: 10, energyTechLevel: 0 });
        const teched = await compute(page, { fusionPlantLevel: 10, energyTechLevel: 12 });
        expect(teched.fusionPlantEnergy).toBeGreaterThan(plain.fusionPlantEnergy);
    });

    test('solar satellites depend on planet temperature', async ({ page }) => {
        const cold = await compute(page, { solarSatellitesCount: 100, maxPlanetTemp: 0 });
        const hot = await compute(page, { solarSatellitesCount: 100, maxPlanetTemp: 60 });
        expect(cold.solarSatsEnergy).toBe(100 * Math.floor((0 + 140) / 6));   // 100 * 23
        expect(hot.solarSatsEnergy).toBe(100 * Math.floor((60 + 140) / 6));   // 100 * 33
    });

    test('the terraformer energy requirement doubles per level', async ({ page }) => {
        // getBuildEnergyCost_C(33, level) = 1000 * 2^(level-1).
        const l1 = await compute(page, { tfLevelTo: 1 });
        const l2 = await compute(page, { tfLevelTo: 2 });
        const l3 = await compute(page, { tfLevelTo: 3 });
        expect(l1.energyRequirement).toBe(1000);
        expect(l2.energyRequirement).toBe(2000);
        expect(l3.energyRequirement).toBe(4000);
    });

    test('terraformer level 0 requires no energy and no satellites', async ({ page }) => {
        const r = await compute(page, { tfLevelTo: 0 });
        expect(r.energyRequirement).toBe(0);
        expect(r.neededSats).toBe(0);
    });

    test('fields added: 4 on odd levels, 5 on even levels', async ({ page }) => {
        // Range 0 -> 3: level 1 (+4), level 2 (+5), level 3 (+4) = 13.
        const r = await compute(page, { tfLevelTo: 3 });
        expect(r.addedFields).toBe(13);
    });

    test('single-level mode counts only the last terraformer step', async ({ page }) => {
        // tfLevelTo=4, single -> from=3, so only level 4 (+5) is added.
        const r = await compute(page, { tfLevelTo: 4, tfSingleLevel: true });
        expect(r.addedFields).toBe(5);
        // The range mode from 0 accumulates every level up to 4.
        const range = await compute(page, { tfLevelTo: 4, tfSingleLevel: false });
        expect(range.addedFields).toBe(4 + 5 + 4 + 5);
    });

    test('satellites cover the requirement shortfall', async ({ page }) => {
        // No plants, so all 1000 energy must come from satellites.
        // energyPerSat = baseEnergyPerSat = 0.01*100*floor(140/6) = 23.
        const r = await compute(page, { tfLevelTo: 1 });
        expect(r.feasible).toBe(true);
        expect(r.energyPerSat).toBe(23);
        expect(r.neededSats).toBe(Math.ceil(1000 / 23));
        expect(r.crysSS).toBe(r.neededSats * 2000);
        expect(r.deutSS).toBe(r.neededSats * 500);
    });

    test('the total cost sums the terraformer and satellite costs', async ({ page }) => {
        // getBuildCost_C(33, 0, 1): crystal 50000, deuterium 100000.
        const r = await compute(page, { tfLevelTo: 1 });
        expect(r.crysTF).toBe(50000);
        expect(r.deutTF).toBe(100000);
        expect(r.crysTotal).toBe(r.crysSS + r.crysTF);
        expect(r.deutTotal).toBe(r.deutSS + r.deutTF);
    });

    test('a strong solar plant lowers the satellites needed', async ({ page }) => {
        const weak = await compute(page, { tfLevelTo: 3, solarPlantLevel: 0 });
        const strong = await compute(page, { tfLevelTo: 3, solarPlantLevel: 20 });
        expect(strong.neededSats).toBeLessThan(weak.neededSats);
    });

    test('zero per-satellite yield is flagged as infeasible', async ({ page }) => {
        const r = await compute(page, { tfLevelTo: 1, solarSatellitesPercent: 0 });
        expect(r.feasible).toBe(false);
        expect(r.neededSats).toBe(Infinity);
    });

    test('build time scales down with economy speed', async ({ page }) => {
        const x1 = await compute(page, { tfLevelTo: 1, universeSpeed: 1 });
        const x5 = await compute(page, { tfLevelTo: 1, universeSpeed: 5 });
        expect(x5.secsTF).toBeLessThan(x1.secsTF);
    });

    test('collector class adds a 10% energy bonus', async ({ page }) => {
        const base = await compute(page, { solarPlantLevel: 20 });
        const collector = await compute(page, { solarPlantLevel: 20, playerClass: 1 });
        expect(collector.classEnergyBonus).toBe(Math.floor(0.1 * base.solarPlantEnergy));
        expect(collector.availableEnergy).toBeGreaterThan(base.availableEnergy);
    });

    test('only the collector class boosts energy', async ({ page }) => {
        // The General (2) grants no energy bonus in the terraformer calculator.
        const general = await compute(page, { solarPlantLevel: 20, playerClass: 2 });
        expect(general.classEnergyBonus).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Cargo capacity. Mirrors the costs calculator: the transport holds grow with
// hyperspace tech, the Collector bonus and the life-form capacity increase —
// all added to the base, never multiplied together.
// ---------------------------------------------------------------------------

test.describe('Terraformer Calculator - Cargo capacity', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/terraformer.php');
    });

    const capacity = (page, base, hyper, classBonus, inc) =>
        page.evaluate(([b, h, c, i]) => TerraformerCalculator.cargoCapacity(b, h, c, i),
            [base, hyper, classBonus, inc]);

    test('base capacity with no bonuses', async ({ page }) => {
        expect(await capacity(page, 5000, 0, 0, 0)).toBe(5000);
        expect(await capacity(page, 25000, 0, 0, 0)).toBe(25000);
    });

    test('hyperspace technology adds 5% per level', async ({ page }) => {
        expect(await capacity(page, 5000, 10, 0, 0)).toBe(5000 * 1.5);
        expect(await capacity(page, 25000, 20, 0, 0)).toBe(25000 * 2);
    });

    test('the class bonus is additive, not scaled by hyperspace tech', async ({ page }) => {
        // 5000*1.5 + 5000*0.25 = 8750, NOT 5000*1.5*1.25 = 9375 (the old bug).
        expect(await capacity(page, 5000, 10, 0.25, 0)).toBe(5000 * 1.5 + 5000 * 0.25);
        expect(await capacity(page, 25000, 10, 0.25, 0)).toBe(25000 * 1.5 + 25000 * 0.25);
    });

    test('cargo capacity increase adds floor(base * increase%)', async ({ page }) => {
        expect(await capacity(page, 5000, 0, 0, 100)).toBe(10000);
        expect(await capacity(page, 25000, 0, 0, 50)).toBe(25000 + 12500);
        expect(await capacity(page, 5000, 0, 0, 33)).toBe(5000 + Math.floor(5000 * 0.33));
    });

    test('transports use the capacity-adjusted cargo holds', async ({ page }) => {
        const plain = await compute(page, { tfLevelTo: 1 });
        const sum = plain.crysTotal + plain.deutTotal;
        expect(plain.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(plain.lcNeeded).toBe(Math.ceil(sum / 25000));
    });

    test('cargo capacity increase lowers the transports needed', async ({ page }) => {
        const plain = await compute(page, { tfLevelTo: 1 });
        const boosted = await compute(page, {
            tfLevelTo: 1, scCapacityIncrease: 100, lcCapacityIncrease: 100,
        });
        expect(boosted.scNeeded).toBeLessThan(plain.scNeeded);
        expect(boosted.lcNeeded).toBeLessThan(plain.lcNeeded);
        // +100% SC capacity doubles the hold (5000 -> 10000).
        const sum = boosted.crysTotal + boosted.deutTotal;
        expect(boosted.scNeeded).toBe(Math.ceil(sum / 10000));
    });
});

// ---------------------------------------------------------------------------
// Resources already on the planet. They reduce what has to be flown in, but
// never the build cost itself.
// ---------------------------------------------------------------------------

test.describe('Terraformer Calculator - Resources on hand', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/terraformer.php');
    });

    test('with nothing on hand everything has to be delivered', async ({ page }) => {
        const r = await compute(page, { tfLevelTo: 1 });
        expect(r.crysToDeliver).toBe(r.crysTotal);
        expect(r.deutToDeliver).toBe(r.deutTotal);
    });

    test('stock on the planet reduces the delivery, not the cost', async ({ page }) => {
        const plain = await compute(page, { tfLevelTo: 1 });
        const r = await compute(page, {
            tfLevelTo: 1, crysAvailable: 20000, deutAvailable: 30000,
        });
        expect(r.crysToDeliver).toBe(plain.crysTotal - 20000);
        expect(r.deutToDeliver).toBe(plain.deutTotal - 30000);
        // The build itself still costs the full amount.
        expect(r.crysTotal).toBe(plain.crysTotal);
        expect(r.deutTotal).toBe(plain.deutTotal);
    });

    test('a crystal surplus never covers a deuterium shortage', async ({ page }) => {
        const r = await compute(page, { tfLevelTo: 1, crysAvailable: 999999999 });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(r.deutTotal);
        expect(r.lcNeeded).toBe(Math.ceil(r.deutTotal / 25000));
    });

    test('transports are sized by the delivery, not the total cost', async ({ page }) => {
        const plain = await compute(page, { tfLevelTo: 1 });
        const stocked = await compute(page, {
            tfLevelTo: 1, crysAvailable: 40000, deutAvailable: 60000,
        });
        const toDeliver = stocked.crysToDeliver + stocked.deutToDeliver;
        expect(stocked.scNeeded).toBe(Math.ceil(toDeliver / 5000));
        expect(stocked.lcNeeded).toBe(Math.ceil(toDeliver / 25000));
        expect(stocked.scNeeded).toBeLessThan(plain.scNeeded);
    });

    test('a full stock leaves nothing to deliver', async ({ page }) => {
        const plain = await compute(page, { tfLevelTo: 1 });
        const r = await compute(page, {
            tfLevelTo: 1,
            crysAvailable: plain.crysTotal,
            deutAvailable: plain.deutTotal,
        });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(0);
        expect(r.scNeeded).toBe(0);
        expect(r.lcNeeded).toBe(0);
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
