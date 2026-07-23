import { test, expect } from '@playwright/test';

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
// Core computation. ExpeditionsCalculator is DOM-free, so it is driven directly
// through page.evaluate() with a full params object per case.
// ---------------------------------------------------------------------------

const BASE_PRM = {
    highTop: 40000,
    playerClass: 0, // Discoverer
    universeSpeed: 1,
    hyperTechLevel: 0,
    percentRes: 0,
    percentShips: 0,
    classBonusCollector: 0,
    classBonusDiscoverer: 0,
    darkMatterDiscoveryBonus: 0,
    resourceDiscoveryBooster: 0,
    lfShipsBonuses: new Array(15).fill(0),
    counts: {},
};

function compute(page, overrides = {}) {
    return page.evaluate((prm) => new ExpeditionsCalculator().compute(prm),
        { ...BASE_PRM, ...overrides });
}

test.describe('Expeditions Calculator - Cargo capacity', () => {
    test.beforeEach(async ({ context, page }) => {
        await openPage(context, page);
    });

    test('capacity is the sum of the base capacities', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 10, SC: 4 } });
        expect(r.capacity).toBe(10 * 25000 + 4 * 5000);
    });

    test('hyperspace technology adds 5% per level', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 10 }, hyperTechLevel: 8 });
        expect(r.capacity).toBe(350000); // 250000 * 1.4
    });

    test('a Collector carries 25% more in its transports', async ({ page }) => {
        const r = await compute(page, { playerClass: 1, counts: { LC: 10 } });
        expect(r.capacity).toBe(312500);
    });

    test('the Collector class bonus raises that 25%', async ({ page }) => {
        const r = await compute(page, { playerClass: 1, classBonusCollector: 20, counts: { LC: 10 } });
        // floor(250000 * 0.25 * 1.2) = 75000 on top of the base
        expect(r.capacity).toBe(325000);
    });

    test('the Collector bonus applies to transports only', async ({ page }) => {
        const r = await compute(page, { playerClass: 1, counts: { RC: 10 } });
        expect(r.capacity).toBe(200000);
    });

    test('a General carries 20% more in recyclers and pathfinders', async ({ page }) => {
        const recyclers = await compute(page, { playerClass: 2, counts: { RC: 10 } });
        expect(recyclers.capacity).toBe(240000);

        const pathfinders = await compute(page, { playerClass: 2, counts: { PA: 10 } });
        expect(pathfinders.capacity).toBe(120000); // 10 * 10000 * 1.2

        const discoverer = await compute(page, { playerClass: 0, counts: { RC: 10 } });
        expect(discoverer.capacity).toBe(200000);
    });

    test('the life-form cargo bonus is added on top of the base capacity', async ({ page }) => {
        const bonuses = new Array(15).fill(0);
        bonuses[1] = 10; // large cargo
        const r = await compute(page, { counts: { LC: 10 }, lfShipsBonuses: bonuses });
        expect(r.capacity).toBe(275000);
    });

    test('espionage probes carry nothing', async ({ page }) => {
        const r = await compute(page, { counts: { EP: 100 }, hyperTechLevel: 20 });
        expect(r.capacity).toBe(0);
    });
});

test.describe('Expeditions Calculator - Expedition points', () => {
    test.beforeEach(async ({ context, page }) => {
        await openPage(context, page);
    });

    test('a Discoverer scales the yield with the universe speed', async ({ page }) => {
        const slow = await compute(page, { universeSpeed: 1 });
        expect(slow.maxPoints).toBe(60000); // 1.5 * 1 * 40000

        const fast = await compute(page, { universeSpeed: 5 });
        expect(fast.maxPoints).toBe(300000);
    });

    test('other classes get a flat yield, unaffected by the universe speed', async ({ page }) => {
        const r = await compute(page, { playerClass: 2, universeSpeed: 5 });
        expect(r.maxPoints).toBe(40000);
    });

    test('a pathfinder doubles the yield, or triples it for a Discoverer', async ({ page }) => {
        const discoverer = await compute(page, { counts: { PA: 1 } });
        expect(discoverer.maxPoints).toBe(120000); // 3 * 1 * 40000

        const other = await compute(page, { playerClass: 2, counts: { PA: 1 } });
        expect(other.maxPoints).toBe(80000);
    });

    test('the Discoverer class bonus only helps a Discoverer', async ({ page }) => {
        const discoverer = await compute(page, { classBonusDiscoverer: 50 });
        expect(discoverer.maxPoints).toBe(90000);

        const other = await compute(page, { playerClass: 2, classBonusDiscoverer: 50 });
        expect(other.maxPoints).toBe(40000);
    });

    test('the expedition resource bonus raises the yield', async ({ page }) => {
        const r = await compute(page, { percentRes: 10 });
        expect(r.maxPoints).toBe(66000);
    });

    test('the minimum large cargo count covers the maximum find', async ({ page }) => {
        const r = await compute(page);
        expect(r.minLC).toBe(3); // ceil(60000 / 25000)

        const boosted = await compute(page, { hyperTechLevel: 8 });
        expect(boosted.minLC).toBe(2); // ceil(60000 / 35000)
    });
});

test.describe('Expeditions Calculator - Resource and Dark Matter finds', () => {
    test.beforeEach(async ({ context, page }) => {
        await openPage(context, page);
    });

    test('crystal is half and deuterium a third of the metal find', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 10 } });
        expect(r.maxFindMetal).toBe(60000);
        expect(r.maxFindCrystal).toBe(30000);
        expect(r.maxFindDeuterium).toBe(20000);
        expect(r.capacityExceeded).toBe(false);
    });

    test('the find is capped by what the fleet can carry', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 1 } });
        expect(r.maxFindMetal).toBe(25000);
        expect(r.maxFindCrystal).toBe(25000);
        expect(r.maxFindDeuterium).toBe(20000);
        expect(r.capacityExceeded).toBe(true);
    });

    test('the resource discovery booster raises the find but not the points', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 10 }, resourceDiscoveryBooster: 20 });
        expect(r.maxFindMetal).toBe(72000);
        expect(r.maxPoints).toBe(60000);
    });

    test('an empty fleet finds nothing', async ({ page }) => {
        const r = await compute(page);
        expect(r.capacity).toBe(0);
        expect(r.maxFindMetal).toBe(0);
    });

    test('Dark Matter starts at 1800 and follows its discovery bonus', async ({ page }) => {
        const plain = await compute(page);
        expect(plain.darkMatter).toBe(1800);

        const boosted = await compute(page, { darkMatterDiscoveryBonus: 50 });
        expect(boosted.darkMatter).toBe(2700);
    });
});

test.describe('Expeditions Calculator - Findable ships', () => {
    test.beforeEach(async ({ context, page }) => {
        await openPage(context, page);
    });

    test('sending a ship unlocks its own tier and the next one up', async ({ page }) => {
        const r = await compute(page, { counts: { EP: 1 } });
        expect(r.canFind.EP).toBe(true);
        expect(r.canFind.SC).toBe(true);
        expect(r.canFind.LF).toBe(false);
    });

    test('the heaviest ship unlocks every findable tier', async ({ page }) => {
        const r = await compute(page, { counts: { RE: 1 } });
        ['EP', 'SC', 'LF', 'LC', 'HF', 'CR', 'PA', 'BS', 'BC', 'BM', 'DR', 'RE']
            .forEach((abbrev) => expect(r.canFind[abbrev]).toBe(true));
    });

    test('recyclers, colony ships and death stars are never found', async ({ page }) => {
        const r = await compute(page, { counts: { RE: 1, RC: 10, CS: 10, DS: 10 } });
        expect(r.canFind.RC).toBe(false);
        expect(r.canFind.CS).toBe(false);
        expect(r.canFind.DS).toBe(false);
    });

    test('a fleet of recyclers alone unlocks nothing', async ({ page }) => {
        const r = await compute(page, { counts: { RC: 10 } });
        expect(Object.values(r.canFind).every((v) => v === false)).toBe(true);
        expect(r.findCounts.EP).toBe(0);
    });

    test('found ships are paid for out of the expedition points', async ({ page }) => {
        // capacity 250000 > 60000 points, so the points are the limit.
        const r = await compute(page, { counts: { LC: 10, EP: 1 } });
        expect(r.findCounts.EP).toBe(60);  // 60000 / 1000
        expect(r.findCounts.SC).toBe(15);  // 60000 / 4000
        expect(r.findCounts.LC).toBe(5);   // 60000 / 12000
        // A large cargo unlocks one tier above itself, and no further.
        expect(r.findCounts.HF).toBe(6);   // 60000 / 10000
        expect(r.findCounts.CR).toBe(0);
    });

    test('the expedition ship bonus raises the number found', async ({ page }) => {
        const r = await compute(page, { counts: { LC: 10, EP: 1 }, percentShips: 10 });
        expect(r.findCounts.EP).toBe(66);
        expect(r.findCounts.SC).toBe(16);
    });

    test('a small fleet caps the find by its own capacity', async ({ page }) => {
        // capacity 5000 < 60000 points, but the pool never drops below 10000.
        const r = await compute(page, { counts: { SC: 1 } });
        expect(r.findCounts.EP).toBe(10); // 10000 / 1000
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
