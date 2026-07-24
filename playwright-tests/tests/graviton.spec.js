import { test, expect } from '@playwright/test';

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
// Core computation. GravitonCalculator.compute() is DOM-free, so it is driven
// directly through page.evaluate() with a full params object per case.
// ---------------------------------------------------------------------------

const BASE_PRM = {
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
    debrisPercent: 30,
    playerClass: 0,
    isTrader: false,
    energyBoost: 0,
    disChLevel: 0,
    gravitonLevel: 1,
    totalLFEnrgBonus: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    rcCapacityIncrease: 0,
    crysAvailable: 0,
    deutAvailable: 0,
    deutInDebris: false,
};

function compute(page, overrides = {}) {
    return page.evaluate((prm) => new GravitonCalculator().compute(prm),
        { ...BASE_PRM, ...overrides });
}

test.describe('Graviton Calculator - Core computation', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('solar plant energy follows the OGame formula', async ({ page }) => {
        // floor(0.01 * 100 * floor(20 * 10 * 1.1^10)) = floor(20*10*2.59374...) = 518
        const r = await compute(page, { solarPlantLevel: 10 });
        expect(r.solarPlantEnergy).toBe(518);
    });

    test('fusion plant energy grows with energy technology', async ({ page }) => {
        const plain = await compute(page, { fusionPlantLevel: 10, energyTechLevel: 0 });
        const teched = await compute(page, { fusionPlantLevel: 10, energyTechLevel: 12 });
        expect(teched.fusionPlantEnergy).toBeGreaterThan(plain.fusionPlantEnergy);
    });

    test('solar satellites depend on planet temperature', async ({ page }) => {
        // baseEnergyPerSat = 0.01*100*floor((maxTemp+140)/6); 100 sats
        const cold = await compute(page, { solarSatellitesCount: 100, maxPlanetTemp: 0 });
        const hot = await compute(page, { solarSatellitesCount: 100, maxPlanetTemp: 60 });
        expect(cold.solarSatsEnergy).toBe(100 * Math.floor((0 + 140) / 6));   // 100 * 23
        expect(hot.solarSatsEnergy).toBe(100 * Math.floor((60 + 140) / 6));   // 100 * 33
    });

    test('graviton level 1 requires 300k energy', async ({ page }) => {
        const r = await compute(page, { gravitonLevel: 1 });
        expect(r.energyRequirement).toBe(300000);
    });

    test('each graviton level triples the requirement', async ({ page }) => {
        const l1 = await compute(page, { gravitonLevel: 1 });
        const l2 = await compute(page, { gravitonLevel: 2 });
        const l3 = await compute(page, { gravitonLevel: 3 });
        expect(l2.energyRequirement).toBe(l1.energyRequirement * 3);
        expect(l3.energyRequirement).toBe(l1.energyRequirement * 9);
    });

    test('graviton level 0 requires no energy', async ({ page }) => {
        const r = await compute(page, { gravitonLevel: 0 });
        expect(r.energyRequirement).toBe(0);
        expect(r.neededSats).toBe(0);
    });

    test('satellites cover the requirement shortfall', async ({ page }) => {
        // No plants, so all 300k must come from satellites.
        // energyPerSat = baseEnergyPerSat = 0.01*100*floor(140/6) = 23
        const r = await compute(page, { gravitonLevel: 1 });
        expect(r.feasible).toBe(true);
        expect(r.energyPerSat).toBe(23);
        expect(r.neededSats).toBe(Math.ceil(300000 / 23));
        expect(r.crysNeeded).toBe(r.neededSats * 2000);
        expect(r.deutNeeded).toBe(r.neededSats * 500);
    });

    test('a strong solar plant lowers the satellites needed', async ({ page }) => {
        const weak = await compute(page, { gravitonLevel: 1, solarPlantLevel: 0 });
        const strong = await compute(page, { gravitonLevel: 1, solarPlantLevel: 30 });
        expect(strong.neededSats).toBeLessThan(weak.neededSats);
    });

    test('zero per-satellite yield is flagged as infeasible', async ({ page }) => {
        // 0% satellite output leaves energyPerSat at 0 -> the shortfall can
        // never be covered, so the result is flagged infeasible.
        const r = await compute(page, { gravitonLevel: 1, solarSatellitesPercent: 0 });
        expect(r.feasible).toBe(false);
        expect(r.neededSats).toBe(Infinity);
    });

    test('build time scales down with universe speed', async ({ page }) => {
        const x1 = await compute(page, { gravitonLevel: 1, universeSpeed: 1 });
        const x5 = await compute(page, { gravitonLevel: 1, universeSpeed: 5 });
        expect(x5.secsTotal).toBeLessThan(x1.secsTotal);
    });

    test('collector class adds a 10% energy bonus', async ({ page }) => {
        const base = await compute(page, { solarPlantLevel: 20 });
        const collector = await compute(page, { solarPlantLevel: 20, playerClass: 1 });
        expect(collector.classEnergyBonus).toBe(Math.floor(0.1 * base.solarPlantEnergy));
        expect(collector.availableEnergy).toBeGreaterThan(base.availableEnergy);
    });

    test('only the collector class boosts energy', async ({ page }) => {
        // The General (2) grants no energy bonus — only cargo perks.
        const general = await compute(page, { solarPlantLevel: 20, playerClass: 2 });
        expect(general.classEnergyBonus).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Cargo capacity. Mirrors the costs calculator: the transport holds grow with
// hyperspace tech, the Collector bonus and the life-form capacity increase —
// all added to the base, never multiplied together.
// ---------------------------------------------------------------------------

test.describe('Graviton Calculator - Cargo capacity', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    // classBonus is the additive class fraction (0.25 Collector transports,
    // 0.20 General recyclers, 0 otherwise).
    const capacity = (page, base, hyper, classBonus, inc) =>
        page.evaluate(([b, h, c, i]) => GravitonCalculator.cargoCapacity(b, h, c, i),
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
        // General recyclers add +20% the same way.
        expect(await capacity(page, 20000, 10, 0.20, 0)).toBe(20000 * 1.5 + 20000 * 0.20);
    });

    test('cargo capacity increase adds floor(base * increase%)', async ({ page }) => {
        expect(await capacity(page, 5000, 0, 0, 100)).toBe(10000);
        expect(await capacity(page, 25000, 0, 0, 50)).toBe(25000 + 12500);
        // Fractional percentages are floored on the base contribution.
        expect(await capacity(page, 5000, 0, 0, 33)).toBe(5000 + Math.floor(5000 * 0.33));
    });

    test('transports use the capacity-adjusted cargo holds', async ({ page }) => {
        const plain = await compute(page, { gravitonLevel: 1 });
        const sum = plain.crysNeeded + plain.deutNeeded;
        expect(plain.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(plain.lcNeeded).toBe(Math.ceil(sum / 25000));
    });

    test('cargo capacity increase lowers the transports needed', async ({ page }) => {
        const plain = await compute(page, { gravitonLevel: 1 });
        const boosted = await compute(page, {
            gravitonLevel: 1, scCapacityIncrease: 100, lcCapacityIncrease: 100,
        });
        expect(boosted.scNeeded).toBeLessThan(plain.scNeeded);
        expect(boosted.lcNeeded).toBeLessThan(plain.lcNeeded);
        // +100% SC capacity doubles the hold (5000 -> 10000), halving the count.
        const sum = boosted.crysNeeded + boosted.deutNeeded;
        expect(boosted.scNeeded).toBe(Math.ceil(sum / 10000));
    });

    test('recycler capacity uses the 20000 hold with the general bonus', async ({ page }) => {
        expect(await capacity(page, 20000, 0, 0, 0)).toBe(20000);
        expect(await capacity(page, 20000, 10, 0, 50)).toBe(20000 * 1.5 + Math.floor(20000 * 0.5));
    });

    test('recycler capacity increase lowers the recyclers needed', async ({ page }) => {
        const plain = await compute(page, { gravitonLevel: 1 });
        const boosted = await compute(page, { gravitonLevel: 1, rcCapacityIncrease: 100 });
        // The debris field is unchanged; only the recycler hold grows.
        expect(boosted.dfAmount).toBe(plain.dfAmount);
        expect(boosted.rcNeeded).toBeLessThan(plain.rcNeeded);
        // +100% doubles the recycler hold (20000 -> 40000).
        expect(boosted.rcNeeded).toBe(Math.ceil(boosted.dfAmount / 40000));
    });

    test('the collector bonus does not apply to the recycler hold', async ({ page }) => {
        // The Collector raises the per-satellite energy (fewer sats -> smaller
        // debris), but the recycler *hold* stays at the base 20000: rcNeeded is
        // dfAmount / 20000, not dfAmount / 25000 (which a +25% hold would give).
        const collector = await compute(page, { gravitonLevel: 1, playerClass: 1 });
        expect(collector.rcNeeded).toBe(Math.ceil(collector.dfAmount / 20000));
    });

    test('the general class boosts the recycler hold by 20%', async ({ page }) => {
        const none = await compute(page, { gravitonLevel: 1, playerClass: 0 });
        const general = await compute(page, { gravitonLevel: 1, playerClass: 2 });
        // The General grants no energy bonus, so the debris field is identical...
        expect(general.dfAmount).toBe(none.dfAmount);
        // ...but the recycler hold grows to 20000 * 1.2, cutting the count.
        expect(general.rcNeeded).toBe(Math.ceil(general.dfAmount / (20000 * 1.2)));
        expect(general.rcNeeded).toBeLessThan(none.rcNeeded);
    });

    test('the general class does not boost transports', async ({ page }) => {
        const none = await compute(page, { gravitonLevel: 1, playerClass: 0 });
        const general = await compute(page, { gravitonLevel: 1, playerClass: 2 });
        // Transport holds stay at the base for a General.
        const sum = general.crysNeeded + general.deutNeeded;
        expect(general.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(general.lcNeeded).toBe(Math.ceil(sum / 25000));
        expect(general.scNeeded).toBe(none.scNeeded);
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
// Resources already on the planet. They never change the build cost — only how
// much still has to be shipped in, and therefore the transports needed.
// ---------------------------------------------------------------------------

test.describe('Graviton Calculator - Resources on hand', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('with nothing on hand everything has to be delivered', async ({ page }) => {
        const r = await compute(page, { gravitonLevel: 1 });
        expect(r.crysToDeliver).toBe(r.crysNeeded);
        expect(r.deutToDeliver).toBe(r.deutNeeded);
    });

    test('stock on the planet reduces the delivery, not the cost', async ({ page }) => {
        const r = await compute(page, {
            gravitonLevel: 1, crysAvailable: 5000000, deutAvailable: 1000000,
        });
        expect(r.crysToDeliver).toBe(r.crysNeeded - 5000000);
        expect(r.deutToDeliver).toBe(r.deutNeeded - 1000000);
        // The build itself still costs the full amount.
        const plain = await compute(page, { gravitonLevel: 1 });
        expect(r.crysNeeded).toBe(plain.crysNeeded);
        expect(r.deutNeeded).toBe(plain.deutNeeded);
    });

    test('a crystal surplus never covers a deuterium shortage', async ({ page }) => {
        // Far more crystal than needed, no deuterium: the whole deuterium bill
        // still has to be shipped in, and the crystal leftover is clamped at 0.
        const r = await compute(page, { gravitonLevel: 1, crysAvailable: 999999999 });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(r.deutNeeded);
        expect(r.lcNeeded).toBe(Math.ceil(r.deutNeeded / 25000));
    });

    test('transports are sized by the delivery, not the total cost', async ({ page }) => {
        const plain = await compute(page, { gravitonLevel: 1 });
        const stocked = await compute(page, {
            gravitonLevel: 1, crysAvailable: 10000000, deutAvailable: 2000000,
        });
        const toDeliver = stocked.crysToDeliver + stocked.deutToDeliver;
        expect(stocked.scNeeded).toBe(Math.ceil(toDeliver / 5000));
        expect(stocked.lcNeeded).toBe(Math.ceil(toDeliver / 25000));
        expect(stocked.scNeeded).toBeLessThan(plain.scNeeded);
    });

    test('a full stock leaves nothing to deliver', async ({ page }) => {
        const plain = await compute(page, { gravitonLevel: 1 });
        const r = await compute(page, {
            gravitonLevel: 1,
            crysAvailable: plain.crysNeeded,
            deutAvailable: plain.deutNeeded,
        });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(0);
        expect(r.scNeeded).toBe(0);
        expect(r.lcNeeded).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Debris field and net cost. Some universes drop deuterium into the debris
// field as well, which is what the deutInDebris flag switches on.
// ---------------------------------------------------------------------------

test.describe('Graviton Calculator - Debris and net cost', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/graviton.php');
    });

    test('by default only crystal lands in the debris field', async ({ page }) => {
        const r = await compute(page, { gravitonLevel: 1, debrisPercent: 30 });
        expect(r.dfCrystal).toBe(Math.floor(r.crysNeeded * 0.3));
        expect(r.dfDeuterium).toBe(0);
        expect(r.dfAmount).toBe(r.dfCrystal);
    });

    test('deutInDebris adds the deuterium share to the debris field', async ({ page }) => {
        const r = await compute(page, {
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.dfDeuterium).toBe(Math.floor(r.deutNeeded * 0.3));
        expect(r.dfAmount).toBe(r.dfCrystal + r.dfDeuterium);
    });

    test('the debris field counts satellites already in orbit', async ({ page }) => {
        // 1000 existing satellites contribute 1000*2000 crystal and, with the
        // flag on, 1000*500 deuterium on top of the ones being built.
        const r = await compute(page, {
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
            solarSatellitesCount: 1000, maxPlanetTemp: 0,
        });
        expect(r.dfCrystal).toBe(Math.floor((r.crysNeeded + 1000 * 2000) * 0.3));
        expect(r.dfDeuterium).toBe(Math.floor((r.deutNeeded + 1000 * 500) * 0.3));
    });

    test('recyclers are sized by the combined debris volume', async ({ page }) => {
        const r = await compute(page, {
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.rcNeeded).toBe(Math.ceil(r.dfAmount / 20000));
        // Turning the flag on raises the debris and therefore the recyclers.
        const crystalOnly = await compute(page, { gravitonLevel: 1, debrisPercent: 30 });
        expect(r.rcNeeded).toBeGreaterThan(crystalOnly.rcNeeded);
    });

    test('net cost subtracts the recycled share of this build', async ({ page }) => {
        const r = await compute(page, { gravitonLevel: 1, debrisPercent: 30 });
        expect(r.netCrysNeeded).toBe(r.crysNeeded - Math.floor(r.crysNeeded * 0.3));
        // Deuterium is not recoverable unless the universe drops it.
        expect(r.netDeutNeeded).toBe(r.deutNeeded);
    });

    test('net deuterium drops once the universe puts it in the debris', async ({ page }) => {
        const r = await compute(page, {
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.netDeutNeeded).toBe(r.deutNeeded - Math.floor(r.deutNeeded * 0.3));
    });

    test('a higher debris percentage lowers the net cost', async ({ page }) => {
        const low = await compute(page, { gravitonLevel: 1, debrisPercent: 30 });
        const high = await compute(page, { gravitonLevel: 1, debrisPercent: 70 });
        expect(high.netCrysNeeded).toBeLessThan(low.netCrysNeeded);
        expect(high.netCrysNeeded).toBe(low.crysNeeded - Math.floor(low.crysNeeded * 0.7));
    });

    test('satellites already in orbit are not a rebate on the new build', async ({ page }) => {
        // Existing satellites feed the debris field (which sizes the recyclers)
        // but must not discount the satellites being built now.
        const r = await compute(page, {
            gravitonLevel: 1, debrisPercent: 30, maxPlanetTemp: 0, solarSatellitesCount: 1000,
        });
        // The debris covers all 1000 existing satellites on top of the new ones...
        expect(r.dfCrystal).toBe(Math.floor((r.crysNeeded + 1000 * 2000) * 0.3));
        expect(r.dfCrystal).toBeGreaterThan(Math.floor(r.crysNeeded * 0.3));
        // ...while the net cost only ever discounts this build's own crystal.
        expect(r.netCrysNeeded).toBe(r.crysNeeded - Math.floor(r.crysNeeded * 0.3));
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
