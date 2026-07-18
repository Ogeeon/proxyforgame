import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context, page }) => {
    // Avoid changelog popup
    await context.addInitScript(() => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
    });
    await page.goto('/ogame/calc/production.php');

    // Reset to defaults, then set up standard test values on the "One planet" tab
    await page.locator('#reset').click();
    await page.locator('#max-planet-temp').fill('100');

    const lvlInputs = page.locator('#one-planet-prod input.input-in-table');
    const count = await lvlInputs.count();
    for (let i = 0; i < count; i++) {
        await lvlInputs.nth(i).fill('10');
    }
});

test('page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Production/i);
});

test('calculator options are available', async ({ page }) => {
    // Check if the options object exists
    const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
    expect(optionsExists).toBe(true);
});

test('economy speed factored correctly', async ({ page }) => {
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });

    // Default universe speed is 1
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.353');
    await expect(totalRow.locator('td').nth(4)).toHaveText('663');
    await expect(totalRow.locator('td').nth(5)).toHaveText('77');
    await expect(totalRow.locator('td').nth(6)).toHaveText('511');

    // Set universe speed to 10 and trigger recalculation
    await page.locator('#universe-speed').selectOption('10');
    await expect(totalRow.locator('td').nth(3)).toHaveText('13.567');
    await expect(totalRow.locator('td').nth(4)).toHaveText('6.650');
    await expect(totalRow.locator('td').nth(5)).toHaveText('786');
    await expect(totalRow.locator('td').nth(6)).toHaveText('11');
});

test('officers bonuses calculations are correct', async ({ page }) => {
    // Check Engineer
    await page.locator('#engineer').click();
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.356');
    await expect(totalRow.locator('td').nth(4)).toHaveText('665');
    await expect(totalRow.locator('td').nth(5)).toHaveText('78');
    await expect(totalRow.locator('td').nth(6)).toHaveText('152');

    // Add Geologist
    await page.locator('#geologist').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.461');
    await expect(totalRow.locator('td').nth(4)).toHaveText('717');
    await expect(totalRow.locator('td').nth(5)).toHaveText('105');
    await expect(totalRow.locator('td').nth(6)).toHaveText('152');

    // Add Technocrat
    await page.locator('#technocrat').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.461');
    await expect(totalRow.locator('td').nth(4)).toHaveText('717');
    await expect(totalRow.locator('td').nth(5)).toHaveText('105');
    await expect(totalRow.locator('td').nth(6)).toHaveText('152');

    // Add Admiral
    await page.locator('#admiral').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.461');
    await expect(totalRow.locator('td').nth(4)).toHaveText('717');
    await expect(totalRow.locator('td').nth(5)).toHaveText('105');
    await expect(totalRow.locator('td').nth(6)).toHaveText('152');

    // Add Commander
    await page.locator('#commander').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.482');
    await expect(totalRow.locator('td').nth(4)).toHaveText('727');
    await expect(totalRow.locator('td').nth(5)).toHaveText('110');
    await expect(totalRow.locator('td').nth(6)).toHaveText('180');
});

test('player class and Alliance Traders bonuses calculations are correct', async ({ page }) => {
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });

    // Switch to General
    await page.locator('#class-1').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.003');
    await expect(totalRow.locator('td').nth(4)).toHaveText('490');
    await expect(totalRow.locator('td').nth(5)).toHaveText('13');
    await expect(totalRow.locator('td').nth(6)).toHaveText('130');

    // Switch to Discoverer
    await page.locator('#class-2').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.003');
    await expect(totalRow.locator('td').nth(4)).toHaveText('490');
    await expect(totalRow.locator('td').nth(5)).toHaveText('13');
    await expect(totalRow.locator('td').nth(6)).toHaveText('130');

    // Check Alliance class is "Traders" (with Discoverer still active)
    await page.locator('#is-trader').click();
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.101');
    await expect(totalRow.locator('td').nth(4)).toHaveText('539');
    await expect(totalRow.locator('td').nth(5)).toHaveText('14');
    await expect(totalRow.locator('td').nth(6)).toHaveText('60');
});

test('energy tech level 10 and plasma tech level 10 bonuses calculations are correct', async ({ page }) => {
    // Set energy tech level to 10 and trigger recalculation
    await page.locator('#energy-tech-level').fill('10');
    await page.locator('#energy-tech-level').press('Tab');

    // Verify Total per hour row with energy tech 10
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.356');
    await expect(totalRow.locator('td').nth(4)).toHaveText('665');
    await expect(totalRow.locator('td').nth(5)).toHaveText('78');
    await expect(totalRow.locator('td').nth(6)).toHaveText('808');

    // Set plasma tech level to 10 and trigger recalculation
    await page.locator('#plasma-tech-level').fill('10');
    await page.locator('#plasma-tech-level').press('Tab');

    // Verify Total per hour row with energy tech 10 + plasma tech 10
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.461');
    await expect(totalRow.locator('td').nth(4)).toHaveText('699');
    await expect(totalRow.locator('td').nth(5)).toHaveText('87');
    await expect(totalRow.locator('td').nth(6)).toHaveText('808');
});

test('temperature and position bonuses calculations are correct', async ({ page }) => {
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });

    // Set max planet temperature to -100 (position stays at default 8)
    await page.locator('#max-planet-temp').fill('-100');
    await page.locator('#max-planet-temp').press('Tab');
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.045');
    await expect(totalRow.locator('td').nth(4)).toHaveText('511');
    await expect(totalRow.locator('td').nth(5)).toHaveText('197');
    await expect(totalRow.locator('td').nth(6)).toHaveText('363');

    // Set position to 1 (temperature stays at -100)
    await page.locator('#planet-pos').fill('1');
    await page.locator('#planet-pos').press('Tab');
    await expect(totalRow.locator('td').nth(3)).toHaveText('775');
    await expect(totalRow.locator('td').nth(4)).toHaveText('716');
    await expect(totalRow.locator('td').nth(5)).toHaveText('197');
    await expect(totalRow.locator('td').nth(6)).toHaveText('363');

    // Set position to 15
    await page.locator('#planet-pos').fill('15');
    await page.locator('#planet-pos').press('Tab');
    await expect(totalRow.locator('td').nth(3)).toHaveText('775');
    await expect(totalRow.locator('td').nth(4)).toHaveText('511');
    await expect(totalRow.locator('td').nth(5)).toHaveText('197');
    await expect(totalRow.locator('td').nth(6)).toHaveText('363');
});

test('booster calculations are correct', async ({ page }) => {
    // Switch to extended view
    await page.locator('#one-pln-extended-view').click();

    // Set all boosters to 40%
    await page.locator('#boosted-prod1').selectOption({ value: '4' });
    await page.locator('#boosted-prod2').selectOption({ value: '4' });
    await page.locator('#boosted-prod3').selectOption({ value: '4' });

    // Verify Total per hour row with 40% boosters
    const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });
    await expect(totalRow.locator('td').nth(3)).toHaveText('1.776');
    await expect(totalRow.locator('td').nth(4)).toHaveText('872');
    await expect(totalRow.locator('td').nth(5)).toHaveText('186');
    await expect(totalRow.locator('td').nth(6)).toHaveText('11');
});

test('accumulation calculations are correct', async ({ page }) => {
    // Expand the Resources accumulation accordion
    await page.locator('text=Resources accumulation').first().click();

    // Set storage levels to 10
    await page.locator('#storage-met').fill('10');
    await page.locator('#storage-met').press('Tab');
    await page.locator('#storage-crys').fill('10');
    await page.locator('#storage-crys').press('Tab');
    await page.locator('#storage-deut').fill('10');
    await page.locator('#storage-deut').press('Tab');

    // Set accumulation period to 1 day
    await page.locator('#onepln-accumwhat-d').fill('1');
    await page.locator('#onepln-accumwhat-d').press('Tab');

    // Verify Metal, Crystal, Deuterium results
    await expect(page.locator('#onepln-accumwhat-met')).toHaveText('32.544');
    await expect(page.locator('#onepln-accumwhat-crys')).toHaveText('15.960');
    await expect(page.locator('#onepln-accumwhat-deut')).toHaveText('1.872');
});

test.describe('crawler count capped by mine levels', () => {
    // One-planet input-in-table order: metal(0) crystal(1) deut(2) solar(3)
    // fusion(4) sat(5) crawler(6).
    const oneMine = (page, i) => page.locator('#one-planet-prod input.input-in-table').nth(i);
    const oneCrawler = (page) => page.locator('#one-planet-prod input.input-in-table').nth(6);

    // Enter 50/40/40 mines (sum 130): max is 8*130=1040, or 8.8*130=1144 with a Geologist.
    async function setMines(page) {
        await oneMine(page, 0).fill('50');
        await oneMine(page, 1).fill('40');
        await oneMine(page, 2).fill('40');
        await oneMine(page, 2).press('Tab');
    }

    test('clamps to 8x the sum of mine levels', async ({ page }) => {
        await setMines(page);
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1040');
    });

    test('clamps to 8.8x with a Geologist', async ({ page }) => {
        await setMines(page);
        await page.locator('#geologist').click();
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1144');
    });

    test('re-clamps when the Geologist is turned off', async ({ page }) => {
        await setMines(page);
        await page.locator('#geologist').click();
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1144');

        // Toggling the Geologist alone must lower an over-limit value.
        await page.locator('#geologist').click();
        await expect(oneCrawler(page)).toHaveValue('1040');
    });

    test('forces zero crawlers when there are no mines', async ({ page }) => {
        await oneMine(page, 0).fill('0');
        await oneMine(page, 1).fill('0');
        await oneMine(page, 2).fill('0');
        await oneCrawler(page).fill('500');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('0');
    });

    test('exposes the maximum through the field tooltip', async ({ page }) => {
        await setMines(page);
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveAttribute('title', /Max crawlers: 1\.040/);
    });

    test('caps each planet on the All planets tab', async ({ page }) => {
        await page.locator('#tabtag2').click();

        // First planet's main row: text inputs are temp(0) pos(1) metal(2)
        // crystal(3) deut(4) solar(5) fusion(6) sat(7) crawler(8).
        const planetInputs = page.locator('#all-planets-prod tr').nth(1).locator('input[type=text]');
        await planetInputs.nth(2).fill('50');  // metal mine
        await planetInputs.nth(3).fill('40');  // crystal mine
        await planetInputs.nth(4).fill('40');  // deuterium synthesizer
        await planetInputs.nth(8).fill('9999'); // crawlers
        await planetInputs.nth(8).press('Tab');

        await expect(planetInputs.nth(8)).toHaveValue('1040');
    });
});

test('amortization calculations are correct', async ({ page }) => {
    // Click on the amortization accordion to expand it
    await page.locator('text=Amortisation of mines').click();

    // Verify default values for all 3 rows in #mines-amort-tbl table
    const amortTable = page.locator('#mines-amort-tbl');

    // Metal Mine row
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(2)')).toHaveText('3.459 Metal, 864 Crystal');
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(3)')).toHaveText('277');
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(4)')).toHaveText('17h 9m 58s');

    // Crystal Mine row
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(2)')).toHaveText('5.277 Metal, 2.638 Crystal');
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(3)')).toHaveText('136');
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(4)')).toHaveText('1d 21h 15m');

    // Deuterium Synthesizer row
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(2)')).toHaveText('12.974 Metal, 4.324 Crystal');
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(3)')).toHaveText('72');
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(4)')).toHaveText('3d 18h 5m');

    // Enable radiobutton #include-SS-y
    await page.locator('#include-SS-y').click();

    // Verify values with SS enabled for all 3 rows
    // Metal Mine row - costs include solar satellite cost (Crystal + Deuterium)
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(2)')).toHaveText('3.459 Metal, 4.864 Crystal, 1.000 Deuterium');
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(3)')).toHaveText('277');
    await expect(amortTable.locator('tbody tr:nth-child(1) td:nth-child(4)')).toHaveText('2d 1h 39m');

    // Crystal Mine row - costs include solar satellite cost (Crystal + Deuterium)
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(2)')).toHaveText('5.277 Metal, 6.638 Crystal, 1.000 Deuterium');
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(3)')).toHaveText('136');
    await expect(amortTable.locator('tbody tr:nth-child(2) td:nth-child(4)')).toHaveText('3d 17h 22m');

    // Deuterium Synthesizer row - costs include solar satellite cost (Crystal + Deuterium)
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(2)')).toHaveText('12.974 Metal, 10.324 Crystal, 1.500 Deuterium');
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(3)')).toHaveText('72');
    await expect(amortTable.locator('tbody tr:nth-child(3) td:nth-child(4)')).toHaveText('6d 8h 35m');
});
