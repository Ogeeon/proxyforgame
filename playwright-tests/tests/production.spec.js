import { test, expect } from './base';

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
    // Energy/plasma tech inputs live on the Researches parameter sub-tab
    await page.locator('#param-researches-tab').click();

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

    test('clamps to 8x the sum of mine levels on blur', async ({ page }) => {
        await setMines(page);
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1040');
    });

    test('clamps to 8.8x with a Geologist on blur', async ({ page }) => {
        await setMines(page);
        await page.locator('#geologist').click();
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1144');
    });

    test('does not clamp until the field loses focus', async ({ page }) => {
        await setMines(page);
        // Typing an over-limit value leaves it untouched, like every other field.
        await oneCrawler(page).fill('5000');
        await expect(oneCrawler(page)).toHaveValue('5000');
        // Only leaving the field commits the clamp.
        await oneCrawler(page).press('Tab');
        await expect(oneCrawler(page)).toHaveValue('1040');
    });

    test('shows a warning explaining the clamp', async ({ page }) => {
        await setMines(page);
        await oneCrawler(page).fill('5000');
        await oneCrawler(page).press('Tab');
        await expect(page.locator('#warning')).toHaveClass(/visible/);
        await expect(page.locator('#warning-message')).toContainText('maximum 1040');
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
        // The hint is a Bootstrap tooltip, so its text lives in
        // data-bs-original-title; Bootstrap empties `title´ when it adopts the field.
        await expect(oneCrawler(page)).toHaveAttribute('data-bs-original-title', /Max crawlers: 1\.040/);
    });

    test('caps each planet on the All planets tab on blur', async ({ page }) => {
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

test.describe('All planets - delete confirmation', () => {
    // Rows come in pairs (planet row + additional info row), the first row being
    // the header, so planet i sits at row i * 2 + 1.
    function planetRow(page, i) {
        return page.locator('#all-planets-prod tr').nth(i * 2 + 1);
    }

    test('adding and removing a planet asks nothing', async ({ page }) => {
        await page.locator('#tabtag2').click();

        await page.locator('#planetsSpin-up').click();
        await expect(page.locator('#planetsSpin')).toHaveValue('9');
        await page.locator('#planetsSpin-down').click();

        // An untouched planet goes away silently, so the table really shrinks back
        await expect(page.locator('.dyn-dialog.show')).toHaveCount(0);
        await expect(page.locator('#planetsSpin')).toHaveValue('8');
        await expect(page.locator('#all-planets-prod .control-delete')).toHaveCount(8);
    });

    test('removing a planet with entered data asks for confirmation', async ({ page }) => {
        await page.locator('#tabtag2').click();
        await page.locator('#planetsSpin-up').click();

        // Text inputs of a planet row: temp(0) pos(1) metal(2) crystal(3) ...
        const newPlanet = planetRow(page, 8).locator('input[type=text]');
        await newPlanet.nth(2).fill('20');
        await newPlanet.nth(2).press('Tab');

        await page.locator('#planetsSpin-down').click();

        const dialog = page.locator('.dyn-dialog.show');
        await expect(dialog).toBeVisible();
        const dialogMessage = await dialog.locator('.modal-body').innerText();
        expect(dialogMessage).toContain('You entered data for this planet');
        // Cancelling keeps the planet and rolls the counter back
        await dialog.locator('.btn-secondary').click();
        await expect(dialog).toHaveCount(0);
        await expect(page.locator('#planetsSpin')).toHaveValue('9');
        await expect(planetRow(page, 8).locator('input[type=text]').nth(2)).toHaveValue('20');
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

test.describe('Lifeform Tech Bonus row', () => {
    // Column layout of a production row: td[3]=metal, [4]=crystal, [5]=deut, [6]=energy.
    const oneRow = (page, label) => page.locator('#one-planet-prod tr').filter({ hasText: label });
    const cell = (row, col) => row.locator('td').nth(col);

    test('per-resource increases add exactly the base mine output', async ({ page }) => {
        const lifeform = oneRow(page, 'Lifeform Tech Bonus');

        // With no bonuses the row contributes nothing.
        await expect(cell(lifeform, 3)).toHaveText('');
        await expect(cell(lifeform, 4)).toHaveText('');
        await expect(cell(lifeform, 5)).toHaveText('');

        const mineMetal = (await cell(oneRow(page, 'Metal Mine'), 3).textContent())?.trim() ?? '';
        const mineCrys = (await cell(oneRow(page, 'Crystal Mine'), 4).textContent())?.trim() ?? '';
        const mineDeut = (await cell(oneRow(page, 'Deuterium Synthesizer'), 5).textContent())?.trim() ?? '';
        expect(mineMetal).not.toBe('');

        // A 100% increase adds exactly the base mine/synth output per resource.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-metal-prod-bonus').fill('100');
        await page.locator('#lf-crystal-prod-bonus').fill('100');
        await page.locator('#lf-deut-prod-bonus').fill('100');
        await page.locator('#lf-deut-prod-bonus').press('Tab');

        await expect(cell(lifeform, 3)).toHaveText(mineMetal);
        await expect(cell(lifeform, 4)).toHaveText(mineCrys);
        await expect(cell(lifeform, 5)).toHaveText(mineDeut);
    });

    test('crawler boost adds crawler output and energy increase adds energy', async ({ page }) => {
        const lifeform = oneRow(page, 'Lifeform Tech Bonus');

        // A 100% crawler boost adds exactly the crawler production. Read the
        // crawler output after the bonus triggers a full recalc/render.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-crawler-bonus').fill('100');
        await page.locator('#lf-crawler-bonus').press('Tab');
        const crawlerMetal = (await cell(oneRow(page, 'Crawler'), 3).textContent())?.trim() ?? '';
        expect(crawlerMetal).not.toBe('');
        await expect(cell(lifeform, 3)).toHaveText(crawlerMetal);

        // An energy increase surfaces in the energy column.
        await expect(cell(lifeform, 6)).toHaveText('');
        await page.locator('#lf-energy-prod-bonus').fill('50');
        await page.locator('#lf-energy-prod-bonus').press('Tab');
        await expect(cell(lifeform, 6)).not.toHaveText('');
    });

    test('feeds the hourly totals', async ({ page }) => {
        const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });
        const baseline = (await totalRow.locator('td').nth(3).textContent())?.trim() ?? '';

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-metal-prod-bonus').fill('100');
        await page.locator('#lf-metal-prod-bonus').press('Tab');

        // The extra metal from the Lifeform bonus must change the hourly total.
        await expect(totalRow.locator('td').nth(3)).not.toHaveText(baseline);
    });
});

test.describe('Collector character class bonus', () => {
    // The Class row is #one-planet-prod row 14 (0 = header); td[3]=metal,
    // [4]=crystal, [5]=deut, [6]=energy. With the standard setup (levels 10,
    // temp 100, pos 8, Collector) the unamplified bonus is 263/130/67/141.
    const classCell = (page, col) => page.locator('#one-planet-prod tr:not(.lf-row)').nth(14).locator('td').nth(col);
    // The Crawler row is row 8 of the same table - crawlers carry the Collector's
    // +50% production bonus in their own row rather than in the Class row.
    const crawlerCell = (page, col) => page.locator('#one-planet-prod tr:not(.lf-row)').nth(8).locator('td').nth(col);

    test('amplifies the Collector bonus on mines and solar satellites', async ({ page }) => {
        // Blur the last table input so the typed levels are fully committed and
        // the baseline (and totals) are deterministic.
        await page.locator('#one-planet-prod input.input-in-table').last().press('Tab');

        const totalRow = page.locator('#one-planet-prod tr').filter({ hasText: 'Total per hour' });

        // Baseline: the plain +25% mine / +10% satellite Collector bonuses.
        await expect(classCell(page, 3)).toHaveText('263');
        await expect(classCell(page, 4)).toHaveText('130');
        await expect(classCell(page, 5)).toHaveText('67');
        await expect(classCell(page, 6)).toHaveText('141');
        await expect(totalRow.locator('td').nth(6)).toHaveText('11');

        // A 10% enhancement scales the bonus by 1.1: 27.5% on mines, 11% on satellites.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-collector-bonus').fill('10');
        await page.locator('#lf-collector-bonus').press('Tab');

        await expect(classCell(page, 3)).toHaveText('289');
        await expect(classCell(page, 4)).toHaveText('143');
        await expect(classCell(page, 5)).toHaveText('74');
        await expect(classCell(page, 6)).toHaveText('155');

        // The hourly totals move by exactly the amplified class bonus.
        await expect(totalRow.locator('td').nth(3)).toHaveText('1.382');
        await expect(totalRow.locator('td').nth(4)).toHaveText('678');
        await expect(totalRow.locator('td').nth(5)).toHaveText('85');
        await expect(totalRow.locator('td').nth(6)).toHaveText('25');

        // A 100% enhancement doubles the bonus (2.0 factor); removing it restores the base.
        await page.locator('#lf-collector-bonus').fill('100');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(classCell(page, 3)).toHaveText('525');
        await expect(classCell(page, 6)).toHaveText('281');

        await page.locator('#lf-collector-bonus').fill('0');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(classCell(page, 3)).toHaveText('263');
        await expect(classCell(page, 6)).toHaveText('141');
    });

    test('amplifies the Collector bonus on crawlers', async ({ page }) => {
        // Crawler output is a share of the mine output, so the mines have to stay
        // put: a level-25 solar plant keeps the production coefficient at 100% even
        // with 50 crawlers drawing energy, and the mine rows then hold at
        // 1.050/518/269 whatever the class bonus does to the energy balance.
        const levels = page.locator('#one-planet-prod input.input-in-table');
        await levels.nth(3).fill('25');  // solar plant
        await levels.nth(6).fill('50');  // crawlers
        await levels.nth(6).press('Tab');
        await expect(page.locator('#prod-coeff')).toHaveText('100%');

        // 50 crawlers at 100% power: mine output * 50 * 0.02% * 1.5 for a Collector.
        await expect(crawlerCell(page, 3)).toHaveText('16');
        await expect(crawlerCell(page, 4)).toHaveText('8');
        await expect(crawlerCell(page, 5)).toHaveText('4');

        // A 100% enhancement doubles the class bonus, so the multiplier goes 1.5 -> 2.0.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-collector-bonus').fill('100');
        await page.locator('#lf-collector-bonus').press('Tab');

        await expect(page.locator('#prod-coeff')).toHaveText('100%');
        await expect(crawlerCell(page, 3)).toHaveText('21');
        await expect(crawlerCell(page, 4)).toHaveText('10');
        await expect(crawlerCell(page, 5)).toHaveText('5');

        // Removing the enhancement restores the plain 1.5 multiplier.
        await page.locator('#lf-collector-bonus').fill('0');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(crawlerCell(page, 3)).toHaveText('16');
        await expect(crawlerCell(page, 4)).toHaveText('8');
        await expect(crawlerCell(page, 5)).toHaveText('4');
    });

    test('the crawler bonus hint names the research it comes from', async ({ page }) => {
        // The tech name comes from the 'lfcosts' locale section, which the page
        // pulls in separately; reading it from the page's own section silently
        // interpolates an empty string and leaves the hint naming nothing.
        await page.locator('#param-lifeforms-tab').click();
        const hint = page.locator('#lf-crawler-bonus').locator('xpath=../following-sibling::i[1]');
        // Bootstrap adopts the icon on load and moves `title´ to data-bs-original-title.
        await expect(hint).toHaveAttribute('data-bs-original-title', /Ion Crystal Modules/);
    });

    test('lf-crawler-bonus reduces crawler energy consumption by the same percentage', async ({ page }) => {
        // Oversized solar plant keeps the planet at 100% throughout, so the crawler
        // row's own energy column isolates the effect of the bonus.
        const levels = page.locator('#one-planet-prod input.input-in-table');
        await levels.nth(3).fill('25');  // solar plant
        await levels.nth(6).fill('50');  // crawlers
        await levels.nth(6).press('Tab');
        await expect(page.locator('#prod-coeff')).toHaveText('100%');

        // 50 crawlers at 100% power draw 50 * 50 = 2500 energy with no bonus.
        await expect(crawlerCell(page, 6)).toHaveText('2.500');

        // A 50% crawler bonus (from Ion Crystal Modules) halves the energy draw
        // shown in the same row that got the production boost.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-crawler-bonus').fill('50');
        await page.locator('#lf-crawler-bonus').press('Tab');
        await expect(crawlerCell(page, 6)).toHaveText('1.250'); // round(2500 * 0.5)

        // A 100% bonus removes the crawler energy draw entirely - a zero value
        // renders as an empty cell, like every other zero bonus row.
        await page.locator('#lf-crawler-bonus').fill('100');
        await page.locator('#lf-crawler-bonus').press('Tab');
        await expect(crawlerCell(page, 6)).toHaveText('');
    });

    test('leaves General and Discoverer classes untouched', async ({ page }) => {
        // General: no class bonus row, and the enhancement must not create one.
        await page.locator('#class-1').click();
        // Wait for the class switch to land before sampling the crawler output.
        await expect(classCell(page, 3)).toHaveText('');
        const crawlerMetal = (await crawlerCell(page, 3).textContent())?.trim() ?? '';
        expect(crawlerMetal).not.toBe('');
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-collector-bonus').fill('100');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(classCell(page, 3)).toHaveText('');
        await expect(classCell(page, 4)).toHaveText('');
        await expect(classCell(page, 5)).toHaveText('');
        await expect(classCell(page, 6)).toHaveText('');
        // Crawlers keep their plain, unamplified output for a non-Collector.
        await expect(crawlerCell(page, 3)).toHaveText(crawlerMetal);

        // Discoverer likewise gets nothing from a Collector-only research.
        await page.locator('#param-general-tab').click();
        await page.locator('#class-2').click();
        await expect(classCell(page, 3)).toHaveText('');
        await expect(classCell(page, 4)).toHaveText('');
        await expect(classCell(page, 5)).toHaveText('');
        await expect(classCell(page, 6)).toHaveText('');
    });

    test('validates as a non-negative percentage and persists', async ({ page }) => {
        const lfBonus = page.locator('#lf-collector-bonus');
        await page.locator('#param-lifeforms-tab').click();

        // Accepts fractional values - the in-game bonus grows by 0.2% per level.
        await lfBonus.fill('0.4');
        await lfBonus.press('Tab');
        await expect(lfBonus).toHaveValue('0.4');

        // No upper cap, unlike the plasma cost reduction.
        await lfBonus.fill('150');
        await lfBonus.press('Tab');
        await expect(lfBonus).toHaveValue('150');

        // Negative input never yields a negative value.
        await lfBonus.fill('-5');
        await lfBonus.press('Tab');
        const negValue = await lfBonus.inputValue();
        expect(parseFloat(negValue.replace(',', '.'))).toBeGreaterThanOrEqual(0);

        // Survives a reload.
        await lfBonus.fill('12.5');
        await lfBonus.press('Tab');
        await page.reload();
        await page.locator('#param-lifeforms-tab').click();
        await expect(page.locator('#lf-collector-bonus')).toHaveValue('12.5');
    });

    test('the lifeform level amplifies the class bonus', async ({ page }) => {
        await page.locator('#one-planet-prod input.input-in-table').last().press('Tab');
        await page.locator('#param-lifeforms-tab').click();

        // The level on its own changes nothing - it scales the research bonus,
        // which is still zero.
        await page.locator('#lf-experience-level').fill('100');
        await page.locator('#lf-experience-level').press('Tab');
        await expect(classCell(page, 3)).toHaveText('263');
        await expect(classCell(page, 6)).toHaveText('141');

        // Level 100 is a +10% technology bonus, so a 10% research reads as 11%.
        await page.locator('#lf-collector-bonus').fill('10');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(classCell(page, 3)).toHaveText('292');
        const amplified = [];
        for (const col of [3, 4, 5, 6])
            amplified.push((await classCell(page, col).textContent())?.trim() ?? '');

        // Entering the same effective percentage directly must give the same rows.
        await page.locator('#lf-experience-level').fill('0');
        await page.locator('#lf-experience-level').press('Tab');
        await page.locator('#lf-collector-bonus').fill('11');
        await page.locator('#lf-collector-bonus').press('Tab');
        for (const [i, col] of [3, 4, 5, 6].entries())
            await expect(classCell(page, col)).toHaveText(amplified[i]);

        // Without the level, 10% stays the unamplified 10%.
        await page.locator('#lf-collector-bonus').fill('10');
        await page.locator('#lf-collector-bonus').press('Tab');
        await expect(classCell(page, 3)).toHaveText('289');
    });

    test('the lifeform level also amplifies the crawler bonus', async ({ page }) => {
        // Same setup as the crawler test above: the mines have to stay put.
        const levels = page.locator('#one-planet-prod input.input-in-table');
        await levels.nth(3).fill('25');  // solar plant
        await levels.nth(6).fill('50');  // crawlers
        await levels.nth(6).press('Tab');
        await expect(crawlerCell(page, 3)).toHaveText('16');

        // 100% research amplified by a level-100 technology bonus is 110%, so the
        // crawler multiplier goes 1.5 -> 1 + 0.5 * 2.1 = 2.05.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-collector-bonus').fill('100');
        await page.locator('#lf-collector-bonus').press('Tab');
        await page.locator('#lf-experience-level').fill('100');
        await page.locator('#lf-experience-level').press('Tab');

        await expect(page.locator('#prod-coeff')).toHaveText('100%');
        await expect(crawlerCell(page, 3)).toHaveText('22');
        await expect(crawlerCell(page, 4)).toHaveText('11');
        await expect(crawlerCell(page, 5)).toHaveText('6');
    });

    test('the lifeform level validates as a whole level and persists', async ({ page }) => {
        const level = page.locator('#lf-experience-level');
        await page.locator('#param-lifeforms-tab').click();

        // Whole levels only - the decimal separator is dropped, not rounded.
        await level.fill('4.3');
        await level.press('Tab');
        await expect(level).toHaveValue('43');

        // The technology bonus stops growing at level 100.
        await level.fill('150');
        await level.press('Tab');
        await expect(level).toHaveValue('100');

        // Negative input never yields a negative level.
        await level.fill('-5');
        await level.press('Tab');
        expect(Number.parseInt(await level.inputValue(), 10)).toBeGreaterThanOrEqual(0);

        // Survives a reload.
        await level.fill('43');
        await level.press('Tab');
        await page.reload();
        await page.locator('#param-lifeforms-tab').click();
        await expect(page.locator('#lf-experience-level')).toHaveValue('43');
    });
});

test.describe('Life Forms plasma technology cost reduction', () => {
    // #plasma-amort-tbl rows: (1) upgrade cost, (2) production increase, (3) payback time.
    const costRow = (page) => page.locator('#plasma-amort-tbl tbody tr:nth-child(1)');
    const timeValue = (page) => page.locator('#plasma-amort-tbl tbody tr:nth-child(3) td:nth-child(2)');
    const lfReduction = (page) => page.locator('#lf-plasma-cost-reduction');

    // Open the "All planets" tab and expand its Plasma amortization panel.
    async function openPlasmaAmort(page) {
        await page.locator('#tabtag2').click();
        await page.locator('text=Amortisation of Plasma Technology').click();
    }

    test('scales the plasma upgrade cost that drives the payback', async ({ page }) => {
        await openPlasmaAmort(page);

        // Plasma level 0 -> 1 costs 2.000 metal / 4.000 crystal / 1.000 deuterium.
        await expect(costRow(page).locator('td').nth(1)).toHaveText('2.000');
        await expect(costRow(page).locator('td').nth(2)).toHaveText('4.000');
        await expect(costRow(page).locator('td').nth(3)).toHaveText('1.000');

        // The reduction input lives on the Life Forms parameter sub-tab.
        await page.locator('#param-lifeforms-tab').click();

        // A 50% Life Forms reduction halves every cost component.
        await lfReduction(page).fill('50');
        await lfReduction(page).press('Tab');
        await expect(costRow(page).locator('td').nth(1)).toHaveText('1.000');
        await expect(costRow(page).locator('td').nth(2)).toHaveText('2.000');
        await expect(costRow(page).locator('td').nth(3)).toHaveText('500');

        // Removing the bonus restores the full cost.
        await lfReduction(page).fill('0');
        await lfReduction(page).press('Tab');
        await expect(costRow(page).locator('td').nth(1)).toHaveText('2.000');
        await expect(costRow(page).locator('td').nth(2)).toHaveText('4.000');
        await expect(costRow(page).locator('td').nth(3)).toHaveText('1.000');
    });

    test('shortens the plasma payback time on the All planets tab', async ({ page }) => {
        // Give the first planet productive mines and a power plant so a plasma
        // level yields a real production increase and thus a finite payback.
        await page.locator('#tabtag2').click();
        const planetInputs = page.locator('#all-planets-prod tr').nth(1).locator('input[type=text]');
        await planetInputs.nth(2).fill('30'); // metal mine
        await planetInputs.nth(3).fill('26'); // crystal mine
        await planetInputs.nth(4).fill('22'); // deuterium synthesizer
        await planetInputs.nth(5).fill('40'); // solar plant
        await planetInputs.nth(5).press('Tab');

        await page.locator('text=Amortisation of Plasma Technology').click();

        const baseline = (await timeValue(page).textContent())?.trim() ?? '';
        expect(baseline).not.toBe('');

        // The reduction input lives on the Life Forms parameter sub-tab.
        await page.locator('#param-lifeforms-tab').click();

        // Halving the cost must recompute a shorter payback.
        await lfReduction(page).fill('50');
        await lfReduction(page).press('Tab');
        const reduced = (await timeValue(page).textContent())?.trim() ?? '';
        expect(reduced).not.toBe('');
        expect(reduced).not.toBe(baseline);

        // Removing the bonus restores the original payback exactly.
        await lfReduction(page).fill('0');
        await lfReduction(page).press('Tab');
        await expect(timeValue(page)).toHaveText(baseline);
    });

    test('drops the payback time once the empire mines nothing', async ({ page }) => {
        const increaseRow = page.locator('#plasma-amort-tbl tbody tr:nth-child(2)');

        // Start from a productive planet so a payback time is actually shown.
        await page.locator('#tabtag2').click();
        const planetInputs = page.locator('#all-planets-prod tr').nth(1).locator('input[type=text]');
        await planetInputs.nth(2).fill('30'); // metal mine
        await planetInputs.nth(3).fill('26'); // crystal mine
        await planetInputs.nth(4).fill('22'); // deuterium synthesizer
        await planetInputs.nth(5).fill('40'); // solar plant
        await planetInputs.nth(5).press('Tab');

        await page.locator('text=Amortisation of Plasma Technology').click();
        const baseline = (await timeValue(page).textContent())?.trim() ?? '';
        expect(baseline).not.toBe('');

        // Plasma only boosts what the mines dig up, so without them a level adds
        // nothing - and the payback of the productive empire must not linger.
        await planetInputs.nth(2).fill('0');
        await planetInputs.nth(3).fill('0');
        await planetInputs.nth(4).fill('0');
        await planetInputs.nth(4).press('Tab');

        await expect(increaseRow.locator('td').nth(1)).toHaveText('0');
        await expect(increaseRow.locator('td').nth(2)).toHaveText('0');
        await expect(increaseRow.locator('td').nth(3)).toHaveText('0');
        await expect(timeValue(page)).toHaveText('—');
    });

    test('energy production increase is a non-negative float and persists', async ({ page }) => {
        const lfEnergy = page.locator('#lf-energy-prod-bonus');

        await page.locator('#param-lifeforms-tab').click();

        // Accepts a fractional value.
        await lfEnergy.fill('12.5');
        await lfEnergy.press('Tab');
        await expect(lfEnergy).toHaveValue('12.5');

        // Negative input never yields a negative value.
        await lfEnergy.fill('-5');
        await lfEnergy.press('Tab');
        const negValue = await lfEnergy.inputValue();
        expect(parseFloat(negValue.replace(',', '.'))).toBeGreaterThanOrEqual(0);

        // Survives a reload.
        await lfEnergy.fill('34.5');
        await lfEnergy.press('Tab');
        await page.reload();
        await page.locator('#param-lifeforms-tab').click();
        await expect(page.locator('#lf-energy-prod-bonus')).toHaveValue('34.5');
    });

    test('is clamped to a maximum of 99 on blur', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await lfReduction(page).fill('150');
        await lfReduction(page).press('Tab');
        await expect(lfReduction(page)).toHaveValue('99');

        // A value at or below the cap is left untouched.
        await lfReduction(page).fill('80');
        await lfReduction(page).press('Tab');
        await expect(lfReduction(page)).toHaveValue('80');
    });

    test('is persisted and restored on reload', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await lfReduction(page).fill('37.5');
        await lfReduction(page).press('Tab');

        await page.reload();

        await page.locator('#param-lifeforms-tab').click();
        await expect(lfReduction(page)).toHaveValue('37.5');
    });
});

test.describe('Life Forms building energy consumption', () => {
    // Building rows for a race appear between the fusion reactor and the solar
    // satellites; energy consumption = floor(base * level * coeff^level).
    // Rows are addressed by building id (race*1000 + in-game position) because
    // the first two buildings of every race are not listed here.
    const lfRow = (page, id) => page.locator(`#one-planet-prod tr.lf-row:has([data-lf-id="${id}"])`);

    test('shows each building energy draw using floor(base*level*coeff^level)', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('1');

        // Research Centre is the 3rd Human building (base 10, coeff 1.08).
        // Level 10 -> floor(10 * 10 * 1.08^10) = 215.
        const research = lfRow(page, 1003);
        await research.locator('input').fill('10');
        await research.locator('input').press('Tab');
        await expect(research.locator('td').nth(6)).toHaveText('215');

        // Neuro-Calibration Centre is the 5th building (base 30, coeff 1.25).
        // Level 6 -> floor(30 * 6 * 1.25^6) = 686.
        const neuro = lfRow(page, 1005);
        await neuro.locator('input').fill('6');
        await neuro.locator('input').press('Tab');
        await expect(neuro.locator('td').nth(6)).toHaveText('686');
    });

    test('Disruption Chamber lowers the energy draw shown in every consumer row', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('2');

        const rows = page.locator('#one-planet-prod tr:not(.lf-row)');
        // Oversized solar plant so the planet stays at 100% throughout.
        await rows.nth(5).locator('input').fill('45');
        // Metal Mine 26 -> floor(10 * 26 * 1.1^26) = 3098 energy.
        await rows.nth(2).locator('input').fill('26');
        await rows.nth(2).locator('input').press('Tab');
        await expect(rows.nth(2).locator('td').nth(6)).toHaveText('3.098/3.098');

        // Rune Forge is the 4th Rock'tal building (base 20, coeff 1.35).
        // Level 12 -> floor(20 * 12 * 1.35^12) = 8794.
        const runeForge = lfRow(page, 2004);
        await runeForge.locator('input').fill('12');
        await runeForge.locator('input').press('Tab');
        await expect(runeForge.locator('td').nth(6)).toHaveText('8.794');

        // Disruption Chamber level 8 -> -0.5 %/level = -4 % energy consumption. OGame
        // shows that reduction in every consumer row, floored row by row.
        const disruption = lfRow(page, 2007);
        await disruption.locator('input').fill('8');
        await disruption.locator('input').press('Tab');

        await expect(rows.nth(2).locator('td').nth(6)).toHaveText('2.974/2.974'); // floor(3098 * 0.96)
        await expect(runeForge.locator('td').nth(6)).toHaveText('8.442');         // floor(8794 * 0.96)
    });

    test('drains the planet energy pool and lowers the production coefficient', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('1');
        const coeff = page.locator('#prod-coeff');
        const before = (await coeff.textContent())?.trim() ?? '';

        // A heavy building level consumes enough energy to starve the mines.
        const neuro = lfRow(page, 1005);
        await neuro.locator('input').fill('30');
        await neuro.locator('input').press('Tab');

        await expect(coeff).not.toHaveText(before);
    });

    test('building levels validate as non-negative integers', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('1');
        const input = lfRow(page, 1003).locator('input');

        await input.fill('-5');
        await input.press('Tab');
        await expect(input).toHaveValue('5'); // negative sign stripped

        await input.fill('abc');
        await input.press('Tab');
        await expect(input).toHaveValue('0'); // non-numeric falls back to default
    });

    test('per-planet levels persist and restore on reload', async ({ page }) => {
        // Edit planet 1 on the All planets tab, give it a race and a building level.
        await page.locator('#tabtag2').click();
        await page.locator('#all-planets-prod .control-edit').first().click();

        await page.locator('#one-pln-race').selectOption('2');
        const runeTech = lfRow(page, 2003); // Rock'tal Rune Technologium
        await runeTech.locator('input').fill('15');
        await runeTech.locator('input').press('Tab');
        await page.locator('#save-planet-data').click();

        await page.reload();

        await page.locator('#tabtag2').click();
        await page.locator('#all-planets-prod .control-edit').first().click();
        await expect(page.locator('#one-pln-race')).toHaveValue('2');
        await expect(lfRow(page, 2003).locator('input')).toHaveValue('15');
    });
});

test.describe('Life Forms building production bonuses', () => {
    const lfRow = (page, id) => page.locator(`#one-planet-prod tr.lf-row:has([data-lf-id="${id}"])`);
    const named = (page, label) => page.locator('#one-planet-prod tr').filter({ hasText: label });
    const digits = (s) => parseInt((s ?? '').replace(/\D/g, ''), 10) || 0;

    test('High Energy Smelting adds level*1.5% of the metal mine output in its own row', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('1');

        // High Energy Smelting is the 6th Human building; level 10 -> +15% metal.
        const hes = lfRow(page, 1006);
        await hes.locator('input').fill('10');
        await hes.locator('input').press('Tab');

        const mineMetal = digits(await named(page, 'Metal Mine').locator('td').nth(3).textContent());
        expect(digits(await hes.locator('td').nth(3).textContent())).toBe(Math.round(mineMetal * 0.15));
        // Building bonuses are no longer folded into the research bonus row.
        await expect(named(page, 'Lifeform Tech Bonus').locator('td').nth(3)).toHaveText('');
    });

    test('High-Performance Transformer shows its energy gain net of its own draw', async ({ page }) => {
        await page.locator('#one-pln-race').selectOption('3');
        // A solar plant gives the building's +1%/lvl energy bonus something to
        // work on; without production the row would only show consumption.
        const solarRow = page.locator('#one-planet-prod tr:not(.lf-row)').nth(5);
        await solarRow.locator('input').fill('20');
        await solarRow.locator('input').press('Tab');

        const transformer = lfRow(page, 3007);
        await transformer.locator('input').fill('10');
        await transformer.locator('input').press('Tab');

        // Level 10 -> +10% of the base energy output (solar plant, fusion reactor
        // and satellites), less its own consumption floor(40 * 10 * 1.05^10) = 651.
        // Here the draw wins, so the net shows brown.
        const powerRows = page.locator('#one-planet-prod tr:not(.lf-row)');
        let baseEnergy = 0;
        for (const row of [5, 6, 7])
            baseEnergy += digits(await powerRows.nth(row).locator('td').nth(6).textContent());
        const net = Math.round(baseEnergy * 0.10) - 651;
        expect(net).toBeLessThan(0);
        const cell = transformer.locator('td').nth(6);
        expect(digits(await cell.textContent())).toBe(-net);
        await expect(cell.locator('span')).toHaveAttribute('style', /brown/);
    });

    test('Metropolis technology bonus does not re-amplify the research production bonus', async ({ page }) => {
        // Oversized solar plant so the planet stays at 100% even with Metropolis
        // drawing energy, isolating the technology-bonus effect from starvation.
        await page.locator('#one-planet-prod tr:not(.lf-row)').nth(5).locator('input').fill('45');
        await page.locator('#one-planet-prod tr:not(.lf-row)').nth(5).locator('input').press('Tab');

        // Enter the research metal bonus as OGame shows it on the Life Forms panel.
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-metal-prod-bonus').fill('20');
        await page.locator('#lf-metal-prod-bonus').press('Tab');

        await page.locator('#one-pln-race').selectOption('1');
        const mineMetal = digits(await named(page, 'Metal Mine').locator('td').nth(3).textContent());

        // The Lifeform bonus row is exactly 20% of the mine output.
        expect(digits(await named(page, 'Lifeform Tech Bonus').locator('td').nth(3).textContent()))
            .toBe(Math.round(mineMetal * 0.20));

        // Metropolis (Human building 11) grants a technology bonus in game, but OGame
        // already folds it into the percentage shown on its Life Forms panel, so the
        // calculator does not model it: the row must stay at 20%, not climb to 22%.
        const metropolis = lfRow(page, 1011);
        await metropolis.locator('input').fill('20');
        await metropolis.locator('input').press('Tab');

        expect(digits(await named(page, 'Lifeform Tech Bonus').locator('td').nth(3).textContent()))
            .toBe(Math.round(mineMetal * 0.20));
    });

    test('Disruption Chamber raises the production coefficient (more energy, less drain)', async ({ page }) => {
        // Push mines up and power plants down so the planet is energy-starved.
        await page.locator('#one-pln-race').selectOption('2');
        const rows = page.locator('#one-planet-prod tr:not(.lf-row)');
        // rows: 0 header, 1 natural, 2 metal, 3 crystal, 4 deut, 5 solar, 6 fusion
        await rows.nth(2).locator('input').fill('26');
        await rows.nth(3).locator('input').fill('26');
        await rows.nth(4).locator('input').fill('22');
        await rows.nth(5).locator('input').fill('20');
        await rows.nth(5).locator('input').press('Tab');

        const coeffBefore = digits(await page.locator('#prod-coeff').textContent());

        // Disruption Chamber is the 7th Rock'tal building: +energy prod, -energy use.
        const disruption = lfRow(page, 2007);
        await disruption.locator('input').fill('20');
        await disruption.locator('input').press('Tab');

        const coeffAfter = digits(await page.locator('#prod-coeff').textContent());
        expect(coeffAfter).toBeGreaterThan(coeffBefore);
    });
});
