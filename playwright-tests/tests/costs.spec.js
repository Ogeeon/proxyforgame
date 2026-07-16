import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Costs Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            // Avoid changelog popup
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            // Suppress the robot/nanite factory disclaimer so it doesn't block functional tests
            document.cookie = 'costs_rn_disclaimer_shown=1; path=/';
        });
        await page.goto('/ogame/calc/costs.php');
    });

    // Helper function to fill table rows
    async function fillTableRows(page, tableId, startRow, endRow, col3Value, col4Value = null) {
        for (let row = startRow; row <= endRow; row++) {
            await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(3) input`).fill(col3Value.toString());
            if (col4Value !== null) {
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(4) input`).fill(col4Value.toString());
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(4) input`).press('Enter');
            } else {
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(3) input`).press('Enter');
            }
        }
    }

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Costs/);
    });

    test('costs.js functionality is available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('[all items - one level / planet] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await fillTableRows(page, '#table-0-2', 2, 17, 1);
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('1.045M');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(6)')).toContainText('612.724');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(7)')).toContainText('201.730');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('2.569M');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(9)')).toContainText('1.000');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(10)')).toContainText('3w 4d 18h');
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').click();
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('1.045.508');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('2.569.784');
    });

    test('[all items - one level / moon] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.getByRole('tab', { name: 'Buildings (moon)' }).click();
        await fillTableRows(page, '#table-0-3', 2, 9, 1);
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(5)')).toContainText('2.043M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(6)')).toContainText('4.081M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(7)')).toContainText('2.04M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(10)')).toContainText('14w 4d');
        // Planet robo and nanite don't affect moon buildings
        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(10)')).toContainText('14w 4d');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(10)')).toContainText('14w 4d');
        // But moon robo does
        await page.locator('#robot-factory-level-moon').fill('10');
        await page.locator('#robot-factory-level-moon').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(10)')).toContainText('1w 2d 6h');
    });

    test('[all items - one level / researches] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.locator('#tabtag-0-4').click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await fillTableRows(page, '#table-0-4', 2, 17, 1);
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('261.800');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('443.400');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('175.500');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('2d 6h 14m');
        await page.locator('#research-lab-level').fill('120');
        await page.locator('#research-lab-level').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('261.800');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('443.400');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('175.500');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('5h 49m 42s');
        await expect(page.locator('#table-0-4 tr:nth-child(23) td:nth-child(3)')).toContainText('141 SC');
        await expect(page.locator('#table-0-4 tr:nth-child(23) td:nth-child(4)')).toContainText('29 LC');
        await page.locator('#param-common-tab').click();
        await page.getByRole('radio', { name: 'General' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(23) td:nth-child(3)')).toContainText('177 SC');
        await expect(page.locator('#table-0-4 tr:nth-child(23) td:nth-child(4)')).toContainText('36 LC');
        await page.getByRole('radio', { name: 'Discoverer' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('4h 22m 16s');
        await page.locator('#technocrat').click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('3h 16m 42s');
        await page.locator('#research-bonus').click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('2h 27m 32s');
    });

    test('[researches] Discoverer class bonus boosts the Discoverer research-speed bonus', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.locator('#tabtag-0-4').click();
        await page.locator('#research-lab-level').fill('120');
        await page.locator('#research-lab-level').press('Enter');
        await fillTableRows(page, '#table-0-4', 2, 17, 1);

        // Baseline: Discoverer class gives the default 25% research-speed bonus (factor 0.75)
        await page.locator('#param-common-tab').click();
        await page.getByRole('radio', { name: 'Discoverer' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('4h 22m 16s');

        // Discoverer class bonus of 100% doubles the class bonus to 50% (factor 0.50)
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#discoverer-class-bonus').fill('100');
        await page.locator('#discoverer-class-bonus').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('2h 54m 51s');

        // The bonus only applies to the Discoverer class: switching to Collector removes any effect
        await page.locator('#param-common-tab').click();
        await page.getByRole('radio', { name: 'Collector' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('5h 49m 42s');
        // Changing the Discoverer class bonus while not a Discoverer must not change the time
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#discoverer-class-bonus').fill('50');
        await page.locator('#discoverer-class-bonus').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('5h 49m 42s');
    });

    test('[all items - one level / fleet] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.getByRole('tab', { name: 'Fleet' }).click();
        await fillTableRows(page, '#table-0-5', 2, 18, 10);
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(4)')).toContainText('53.370M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(5)')).toContainText('42.51M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(6)')).toContainText('10.885M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(9)')).toContainText('228w 2d');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(10)')).toContainText('106.765');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(11)')).toContainText('72.000');
        await page.locator('#shipyard-level').fill('10');
        await page.locator('#shipyard-level').press('Enter');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(9)')).toContainText('3h 23m 40s');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(11)')).toContainText('5.100');
    });

    test('[all items - one level / defenses] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.getByRole('tab', { name: 'Defenses' }).click();
        await fillTableRows(page, '#table-0-6', 2, 11, 100);
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(4)')).toContainText('16.5M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(5)')).toContainText('13.3M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(6)')).toContainText('4.4M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(9)')).toContainText('70w 6d 16h');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(10)')).toContainText('34.200');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(11)')).toContainText('72.000');
        await page.locator('#shipyard-level').fill('12');
        await page.locator('#shipyard-level').press('Enter');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(9)')).toContainText('51m 40s');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(11)')).toContainText('1.275');
    });

    test('[all items - multiple levels / planet] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await fillTableRows(page, '#table-1-2', 2, 17, 5, 6);
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(3)')).toContainText('96');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(5)')).toContainText('34.053M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(6)')).toContainText('19.599M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(7)')).toContainText('6.607M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(9)')).toContainText('32.000');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(10)')).toContainText('127w 5d 4h');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(11)')).toContainText('60.256');
    });

    test('[all items - multiple levels / moon] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.getByRole('tab', { name: 'Buildings (moon)' }).click();
        await fillTableRows(page, '#table-1-3', 2, 9, 5, 6);
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(5)')).toContainText('65.401M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(6)')).toContainText('130.618M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(7)')).toContainText('65.289M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(10)')).toContainText('466w 4d 23h');
    });

    test('[all items - multiple levels / researches] calculations are correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.locator('#tabtag-1-4').click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await fillTableRows(page, '#table-1-4', 2, 17, 5, 6);
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(4)')).toContainText('8.315M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(5)')).toContainText('14.064M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(6)')).toContainText('5.553M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(8)')).toContainText('72.9M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(9)')).toContainText('10w 1d 17h');
    });

    test('[one item - multiple levels] calculations are correct', async ({ page }) => {
        await page.locator('#reset').click();
        await page.getByRole('tab', { name: 'One item - multiple levels' }).click();
        // When the page loads, Metal Mine is selected by default
        await page.locator('#tab2-from-level').fill('14');
        await page.locator('#tab2-to-level').fill('16');
        await page.locator('#tab2-to-level').press('Enter');
        await expect(page.locator('#prods-table tr:nth-child(2) td:nth-child(1)')).toContainText('15');
        await expect(page.locator('#prods-table tr:nth-child(3) td:nth-child(1)')).toContainText('16');
        await expect(page.locator('#prods-table tr:nth-child(1) th:nth-child(5)')).toContainText('MSU');
        await expect(page.locator('#prods-table tr:nth-child(1) th:nth-child(9)')).toContainText('Prod. per hour');
        await expect(page.locator('#prods-table tr:nth-child(1) th:nth-child(10)')).toContainText('Consum. per hour');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(2)')).toContainText('43.788');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(3)')).toContainText('10.946');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(4)')).toContainText('0');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(5)')).toContainText('60.207');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(7)')).toContainText('21h 53m 36s');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(8)')).toContainText('53');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(9)')).toContainText('3.761');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(10)')).toContainText('735');
        await page.locator('#param-common-tab').click();
        await page.locator('#universe-speed').selectOption('10');
        await expect(page.locator('#prods-table tr:nth-child(4) td:nth-child(7)')).toContainText('2h 11m 21s');

        await page.locator('#tech-types-select').selectOption('21');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(2)')).toContainText('19.66M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(3)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(4)')).toContainText('4.915M');
        await expect(page.locator('#commons-table tr:nth-child(1) th:nth-child(5)')).toContainText('MSU');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(5)')).toContainText('49.152M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(7)')).toContainText('7w 3h');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(8)')).toContainText('34.405');

        await page.locator('#param-buildings-tab').click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await page.locator('#tech-types-select').selectOption('106');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(2)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(3)')).toContainText('49.152M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(4)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(5)')).toContainText('113.049M');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(7)')).toContainText('27w 1h');
        await expect(page.locator('#commons-table tr:nth-child(4) td:nth-child(8)')).toContainText('68.812');
    });


    test('[grand totals - one level] calculations are correct', async ({ page }) => {
        // Set research lab level to 12
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');

        // First outer tab is already selected (All items - one level)
        // Fill 10 in the first row of each inner tab and verify grand totals

        // Buildings (planet)
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(3)')).toContainText('2.306');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(4)')).toContainText('576');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(6)')).toContainText('3.170');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1h 9m 10s');
        await expect(page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(9)')).toContainText('2');

        // Buildings (moon)
        await page.getByRole('tab', { name: 'Buildings (moon)' }).click();
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(3)')).toContainText('207.106');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(4)')).toContainText('62.016');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(5)')).toContainText('102.400');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(8)')).toContainText('4d 11h 38m');
        await expect(page.locator('#table-0-3 tr:nth-last-child(4) td:nth-child(9)')).toContainText('370');

        // Researches
        await page.locator('#tabtag-0-4').click();
        await page.locator('#table-0-4 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-4 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(3)')).toContainText('309.506');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(4)')).toContainText('574.016');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(8)')).toContainText('6d 10h 54m');
        await expect(page.locator('#table-0-4 tr:nth-last-child(4) td:nth-child(9)')).toContainText('1.086');

        // Fleet
        await page.getByRole('tab', { name: 'Fleet' }).click();
        await page.locator('#table-0-5 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-5 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(3)')).toContainText('329.506');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(4)')).toContainText('594.016');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1w 2h');
        await expect(page.locator('#table-0-5 tr:nth-last-child(4) td:nth-child(9)')).toContainText('1.126');

        // Defenses
        await page.getByRole('tab', { name: 'Defenses' }).click();
        await page.locator('#table-0-6 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-6 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(3)')).toContainText('349.506');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(4)')).toContainText('594.016');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1w 10h');
        await expect(page.locator('#table-0-6 tr:nth-last-child(4) td:nth-child(9)')).toContainText('1.146');
    });

    test('[grand totals - multiple levels] calculations are correct', async ({ page }) => {
        // Set research lab level to 12
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');

        // Click the second outer tab (All items - multiple levels)
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();

        // Fill 10 and 11 in the first row of each inner tab and verify grand totals

        // Buildings (planet)
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(3)')).toContainText('3.459');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(4)')).toContainText('864');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1h 43m 45s');
        await expect(page.locator('#table-1-2 tr:nth-last-child(4) td:nth-child(9)')).toContainText('4');

        // Buildings (moon)
        await page.getByRole('tab', { name: 'Buildings (moon)' }).click();
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(3)')).toContainText('413.059');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(4)')).toContainText('123.744');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1w 1d 22h');
        await expect(page.locator('#table-1-3 tr:nth-last-child(4) td:nth-child(9)')).toContainText('741');

        // Researches
        await page.locator('#tabtag-1-4').click();
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(3)')).toContainText('617.859');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(4)')).toContainText('1.147M');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(5)')).toContainText('409.600');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(8)')).toContainText('1w 5d 21h');
        await expect(page.locator('#table-1-4 tr:nth-last-child(4) td:nth-child(9)')).toContainText('2.174');
    });

    test('deconstruction calculation is correct', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();

        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(3) input`).fill('20');
        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(4) input`).fill('19');
        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(4) input`).press('Enter');

        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(5)')).toContainText('88.673');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(6)')).toContainText('22.168');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(9)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(10)')).toContainText('1d 20h 20m');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(11)')).toContainText('-166');
    });

    test('[available resources] delivery transport is correct', async ({ page }) => {
        // Fill a value in buildings planet
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        // With no available resources, resources needed equals grand total
        const grandMetal = await page.locator('#table-0-2 tr:nth-last-child(4) td:nth-child(3)').innerText();
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(3)')).toContainText(grandMetal.trim());
        // Enter some available resources
        await page.locator('#metal-available-0-2').fill('100000');
        await page.locator('#metal-available-0-2').press('Enter');
        // Resources needed should decrease (deficit is reduced by available metal)
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(3)')).not.toContainText(grandMetal.trim());
    });

    test('quantity multiplier works correctly', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();

        // Test for planet buildings
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').fill('1');
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(4) input').fill('5');
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('300');

        // Test for moon buildings
        await page.getByRole('tab', { name: 'Buildings (moon)' }).click();
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(3) input').fill('1');
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(4) input').fill('5');
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(5)')).toContainText('2.000');
    });

    test('quantity multiplier works on the multi-level tab', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();

        // Metal Mine (first row): from-level 0, to-level 3, quantity 2.
        // Level costs 60 + 90 + 135 = 285 metal, times 2 = 570.
        // Columns on this tab: hidden(1) name(2) from(3) to(4) qty(5) metal(6)...
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(3) input').fill('0');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(4) input').fill('3');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(5) input').fill('2');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(5) input').press('Enter');
        await expect(page.locator('#table-1-2 tr:nth-child(2) td:nth-child(6)')).toContainText('570');

        // The quantity column is absent for researches on this tab
        await page.locator('#tabtag-1-4').click();
        await expect(page.locator('#table-1-4 .qty-input')).toHaveCount(0);
    });

    test('IRN calculation works', async ({ page }) => {
        await page.locator('#open-llc-dialog').click();
        await page.locator(`#irn-level`).fill('3');
        for (let i = 1; i <= 8; i++) {
            await page.locator(`#lablevel_${i}`).fill(`${i}`);
            await page.locator(`#lablevel_${i}`).press('Enter');
        }
        await page.locator('#labchoice_1').click();
        await expect(page.locator('#resulting-level')).toContainText('22');
        await page.locator('#labchoice_8').click();
        await expect(page.locator('#resulting-level')).toContainText('26');
        await page.locator(`#irn-level`).fill('7');
        await page.locator(`#irn-level`).press('Enter');
        await expect(page.locator('#resulting-level')).toContainText('36');
        await page.getByRole('button', { name: 'Done' }).click();
        await page.waitForTimeout(100);
        await expect(page.locator('#research-lab-level')).toHaveValue('36');
    });

    test('lifeform bonuses are correct', async ({ page }) => {
        await fillTableRows(page, '#table-0-2', 2, 17, 5);
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').click();
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('16.840.582');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(6)')).toContainText('9.800.061');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(7)')).toContainText('3.257.139');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(9)')).toContainText('16.000');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(10)')).toContainText('61w 2d 8h');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(11)')).toContainText('29.894');

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#mineral-res-cntr-lvl').fill('5');
        await page.locator('#mineral-res-cntr-lvl').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('16.840.290');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(6)')).toContainText('9.799.946');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(7)')).toContainText('3.257.091');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(9)')).toContainText('16.000');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(10)')).toContainText('61w 2d 8h');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(11)')).toContainText('29.893');

        await page.locator('#lf-terraformer-rdc').fill('20');
        await page.locator('#lf-terraformer-rdc').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('16.840.290');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(6)')).toContainText('9.639.946');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(7)')).toContainText('2.937.091');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(9)')).toContainText('16.000');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(10)')).toContainText('61w 13h');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(11)')).toContainText('29.413');

        await page.locator('#reset').click();
        await page.locator('#param-buildings-tab').click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').click();
        await page.locator('#tabtag-0-4').click();
        await fillTableRows(page, '#table-0-4', 2, 17, 5);
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('4.162.300');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('7.041.400');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('2.781.500');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('24.300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('5w 21h');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(10)')).toContainText('13.982');

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#research-cost-reduction').fill('25');
        await page.locator('#research-cost-reduction').press('Enter');
        await page.locator('#research-time-reduction').fill('25');
        await page.locator('#research-time-reduction').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('3.121.725');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('5.281.050');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('2.086.125');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('24.300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(9)')).toContainText('3w 5d 22h');
    });

    test('[exchange rates] MSU column reflects user-entered rates', async ({ page }) => {
        await page.getByRole('tab', { name: 'All items - one level' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await fillTableRows(page, '#table-0-2', 2, 17, 1);
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').click();
        // Default rates 1:1.5:3 → MSU = m + 1.5c + 3d = 2.569.784
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('2.569.784');
        // Rates 1:2:2 → multipliers match old hardcoded formula → MSU = 2.674.416
        await page.locator('#exchange-rates-c').fill('2');
        await page.locator('#exchange-rates-c').press('Enter');
        await page.locator('#exchange-rates-d').fill('2');
        await page.locator('#exchange-rates-d').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('2.674.416');
        // Rates 2:2:2 → cMult=dMult=1 → MSU = m + c + d = 1.859.962
        await page.locator('#exchange-rates-m').fill('2');
        await page.locator('#exchange-rates-m').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('1.859.962');
    });

    test('[research reduction fields] clamp entered value to max on blur', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();

        // Cost reduction is capped at 50%
        await page.locator('#research-cost-reduction').fill('150');
        await page.locator('#research-cost-reduction').blur();
        await expect(page.locator('#research-cost-reduction')).toHaveValue('50');

        // Time reduction is capped at 99%
        await page.locator('#research-time-reduction').fill('150');
        await page.locator('#research-time-reduction').blur();
        await expect(page.locator('#research-time-reduction')).toHaveValue('99');

        // Values within range are left untouched
        await page.locator('#research-cost-reduction').fill('30');
        await page.locator('#research-cost-reduction').blur();
        await expect(page.locator('#research-cost-reduction')).toHaveValue('30');

        await page.locator('#research-time-reduction').fill('80');
        await page.locator('#research-time-reduction').blur();
        await expect(page.locator('#research-time-reduction')).toHaveValue('80');
    });

    test('[one item - multiple levels] planet position clamps to valid range on blur', async ({ page }) => {
        await page.getByRole('tab', { name: 'One item - multiple levels' }).click();

        // Position is capped at 16
        await page.locator('#planet-pos').fill('20');
        await page.locator('#planet-pos').blur();
        await expect(page.locator('#planet-pos')).toHaveValue('16');

        // Position below 1 is raised to 1
        await page.locator('#planet-pos').fill('0');
        await page.locator('#planet-pos').blur();
        await expect(page.locator('#planet-pos')).toHaveValue('1');

        // Values within range are left untouched
        await page.locator('#planet-pos').fill('10');
        await page.locator('#planet-pos').blur();
        await expect(page.locator('#planet-pos')).toHaveValue('10');
    });
});

test.describe('Costs Calculator - Robot/Nanite factory disclaimer', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup, but do NOT suppress the disclaimer cookie here
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/costs.php');
    });

    test('modal appears when building the Robotics factory (single-level tab) and only once', async ({ page }) => {
        const modal = page.locator('#robot-nanite-disclaimer');
        await expect(modal).toBeHidden();

        const robotLevel = page.locator('#table-0-2 tr', { hasText: 'Robotics factory' })
            .locator('td:nth-child(3) input');
        await robotLevel.fill('5');
        await robotLevel.press('Enter');

        await expect(modal).toBeVisible();
        // Body links to the construction queue calculator
        await expect(modal.locator('.modal-body a')).toHaveAttribute('href', /\/ogame\/calc\/queue\.php$/);

        // Dismiss; it must not reappear on further input (remembered via cookie)
        await modal.locator('.btn-close').click();
        await expect(modal).toBeHidden();

        await robotLevel.fill('8');
        await robotLevel.press('Enter');
        await page.waitForTimeout(200);
        await expect(modal).toBeHidden();
    });

    test('modal appears from the "to-level" of a factory on the multi-level tab', async ({ page }) => {
        const modal = page.locator('#robot-nanite-disclaimer');
        await page.getByRole('tab', { name: 'All items - multiple levels' }).click();
        await page.getByRole('tab', { name: 'Buildings (planet)' }).click();
        await expect(modal).toBeHidden();

        const naniteToLevel = page.locator('#table-1-2 tr', { hasText: 'Nanite factory' })
            .locator('td:nth-child(4) input');
        await naniteToLevel.fill('3');
        await naniteToLevel.press('Enter');

        await expect(modal).toBeVisible();
    });

    test('a non-factory row does not trigger the disclaimer', async ({ page }) => {
        const modal = page.locator('#robot-nanite-disclaimer');

        const metalLevel = page.locator('#table-0-2 tr', { hasText: 'Metal Mine' })
            .locator('td:nth-child(3) input');
        await metalLevel.fill('10');
        await metalLevel.press('Enter');

        await page.waitForTimeout(200);
        await expect(modal).toBeHidden();
    });
});

// Fixture: a research bonuses table copied from OGame (English tech names).
// Only Espionage has a cost reduction (24.04%); every research reduces time
// (4.41%, except Espionage at 52.5%). Column minimums are therefore cost 0%,
// time 4.41%.
const LF_RESEARCH_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/lf_research_bonuses.txt'),
    'utf-8'
);

test.describe('Costs Calculator - LifeForm research bonuses table', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            document.cookie = 'costs_rn_disclaimer_shown=1; path=/';
        });
        await page.goto('/ogame/calc/costs.php');
    });

    test('import fills the table and OK copies column minimums to the reduction fields', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();

        const tableModal = page.locator('#lf-research-table');
        await expect(tableModal).toBeVisible();

        // Open the paste-from-OGame modal and import the fixture
        await page.locator('#lf-research-table-get').click();
        const pasteModal = page.locator('#lf-research-paste');
        await expect(pasteModal).toBeVisible();
        await page.locator('#lf-research-paste-txtarea').fill(LF_RESEARCH_FIXTURE);
        await page.locator('#lf-research-paste-import').click();
        await expect(pasteModal).toBeHidden();

        // First row (Espionage) carries both a cost and a time reduction
        const firstRow = page.locator('#lf-research-bonuses-tbody tr').first();
        await expect(firstRow.locator('.lf-research-cost-input')).toHaveValue('24.04');
        await expect(firstRow.locator('.lf-research-time-input')).toHaveValue('52.5');

        // Second row (Computer) has no cost reduction and the common time bonus
        const secondRow = page.locator('#lf-research-bonuses-tbody tr').nth(1);
        await expect(secondRow.locator('.lf-research-cost-input')).toHaveValue('0');
        await expect(secondRow.locator('.lf-research-time-input')).toHaveValue('4.41');

        // OK copies the minimum of each column to the reduction fields
        await page.locator('#lf-research-table-ok').click();
        await expect(tableModal).toBeHidden();
        await expect(page.locator('#research-cost-reduction')).toHaveValue('0');
        await expect(page.locator('#research-time-reduction')).toHaveValue('4.41');

        // The table is persisted to localStorage
        const stored = await page.evaluate(() => localStorage.getItem('costs_lf_research_table'));
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored);
        expect(parsed[0]).toEqual([24.04, 52.5]);
        expect(parsed[1]).toEqual([0, 4.41]);
    });

    test('the clear button resets every input in the table to zero', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        await page.locator('#lf-research-paste-txtarea').fill(LF_RESEARCH_FIXTURE);
        await page.locator('#lf-research-paste-import').click();

        const firstRow = page.locator('#lf-research-bonuses-tbody tr').first();
        await expect(firstRow.locator('.lf-research-cost-input')).toHaveValue('24.04');

        await page.locator('#lf-research-table-clear').click();

        // Every cost/time input is back to 0
        const costInputs = page.locator('#lf-research-bonuses-tbody .lf-research-cost-input');
        const timeInputs = page.locator('#lf-research-bonuses-tbody .lf-research-time-input');
        const costCount = await costInputs.count();
        for (let i = 0; i < costCount; i++) {
            await expect(costInputs.nth(i)).toHaveValue('0');
            await expect(timeInputs.nth(i)).toHaveValue('0');
        }
    });

    test('shows a "values differ" warning next to a field when a column is not uniform', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();

        const costWarn = page.locator('#research-cost-reduction-warn');
        const timeWarn = page.locator('#research-time-reduction-warn');
        await expect(costWarn).toBeHidden();
        await expect(timeWarn).toBeHidden();

        // Import the fixture: both columns contain values above their minimum
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        await page.locator('#lf-research-paste-txtarea').fill(LF_RESEARCH_FIXTURE);
        await page.locator('#lf-research-paste-import').click();
        await page.locator('#lf-research-table-ok').click();

        await expect(costWarn).toBeVisible();
        await expect(timeWarn).toBeVisible();
        await expect(costWarn).toHaveAttribute('data-bs-original-title', /.+/);
    });

    test('the warning is per-column and hides when a column is uniform', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();

        // Uniform cost column (all zero); a single differing value in the time column
        await page.locator('#lf-research-table-clear').click();
        await page.locator('#lf-research-bonuses-tbody tr').first().locator('.lf-research-time-input').fill('10');
        await page.locator('#lf-research-table-ok').click();

        await expect(page.locator('#research-cost-reduction-warn')).toBeHidden();
        await expect(page.locator('#research-time-reduction-warn')).toBeVisible();

        // Clearing everything hides both warnings
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-clear').click();
        await page.locator('#lf-research-table-ok').click();
        await expect(page.locator('#research-cost-reduction-warn')).toBeHidden();
        await expect(page.locator('#research-time-reduction-warn')).toBeHidden();
    });

    test('the warning is shown on page load when the saved table is not uniform', async ({ page }) => {
        // Import and apply, then reload
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        await page.locator('#lf-research-paste-txtarea').fill(LF_RESEARCH_FIXTURE);
        await page.locator('#lf-research-paste-import').click();
        await page.locator('#lf-research-table-ok').click();

        await page.reload();
        await page.locator('#param-lifeforms-tab').click();
        await expect(page.locator('#research-cost-reduction-warn')).toBeVisible();
        await expect(page.locator('#research-time-reduction-warn')).toBeVisible();
    });

    test('imported table survives a page reload', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        await page.locator('#lf-research-paste-txtarea').fill(LF_RESEARCH_FIXTURE);
        await page.locator('#lf-research-paste-import').click();
        await page.locator('#lf-research-table-ok').click();

        await page.reload();

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        const firstRow = page.locator('#lf-research-bonuses-tbody tr').first();
        await expect(firstRow.locator('.lf-research-cost-input')).toHaveValue('24.04');
        await expect(firstRow.locator('.lf-research-time-input')).toHaveValue('52.5');
    });

    test('import is rejected when the first research name is missing', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();

        let dialogMessage = null;
        page.once('dialog', (dialog) => {
            dialogMessage = dialog.message();
            dialog.dismiss();
        });

        // Text without the first research name (Espionage) in the current language
        await page.locator('#lf-research-paste-txtarea').fill('Some header\n5%\nMax. 50%\n-\n');
        await page.locator('#lf-research-paste-import').click();

        // A warning is shown, the paste modal stays open and nothing is written
        await expect.poll(() => dialogMessage).not.toBeNull();
        expect(dialogMessage).toContain('Espionage');
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        await expect(page.locator('#lf-research-bonuses-tbody tr').first().locator('.lf-research-cost-input')).toHaveValue('0');
    });

    test('import is rejected when data for some researches is missing', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#lf-research-table-open').click();
        await expect(page.locator('#lf-research-table')).toBeVisible();
        await page.locator('#lf-research-table-get').click();
        await expect(page.locator('#lf-research-paste')).toBeVisible();

        let dialogMessage = null;
        page.once('dialog', (dialog) => {
            dialogMessage = dialog.message();
            dialog.dismiss();
        });

        // Only the first two researches — the first name is present but data is incomplete
        const partial = [
            'Espionage technology', '24.04%', 'Max. 50%', '52.5%', 'Max. 99%',
            'Computer technology', '-', '4.41%', 'Max. 99%'
        ].join('\n');
        await page.locator('#lf-research-paste-txtarea').fill(partial);
        await page.locator('#lf-research-paste-import').click();

        await expect.poll(() => dialogMessage).not.toBeNull();
        expect(dialogMessage).toContain('16');
        await expect(page.locator('#lf-research-paste')).toBeVisible();
        // Nothing was written: the first row's inputs remain at their default
        await expect(page.locator('#lf-research-bonuses-tbody tr').first().locator('.lf-research-cost-input')).toHaveValue('0');
    });

    // Russian uses a comma as the decimal separator (options.decimalSeparator).
    // Select the language via the context locale (Accept-Language) rather than a
    // "/ru/" URL prefix: the prefix relies on an Apache rewrite that is absent
    // under the PHP built-in server used in CI. The locale drives the language on
    // both servers, and the outer beforeEach already loads costs.php in Russian.
    test.describe('Russian locale', () => {
        test.use({ locale: 'ru-RU' });

        test('respects the current language decimal separator (comma)', async ({ page }) => {
            await page.locator('#param-lifeforms-tab').click();
            await page.locator('#lf-research-table-open').click();
            await expect(page.locator('#lf-research-table')).toBeVisible();
            await page.locator('#lf-research-table-get').click();
            await expect(page.locator('#lf-research-paste')).toBeVisible();

            // Reuse the English fixture (OGame always exports dot decimals); only the
            // anchor line must match the first research name in the current language
            const firstName = (await page.locator('#lf-research-bonuses-tbody tr').first()
                .locator('td').first().innerText()).trim();
            const lines = LF_RESEARCH_FIXTURE.split('\n');
            lines[0] = firstName;
            await page.locator('#lf-research-paste-txtarea').fill(lines.join('\n'));
            await page.locator('#lf-research-paste-import').click();

            // Values are displayed with the language's comma separator
            const firstRow = page.locator('#lf-research-bonuses-tbody tr').first();
            await expect(firstRow.locator('.lf-research-cost-input')).toHaveValue('24,04');
            await expect(firstRow.locator('.lf-research-time-input')).toHaveValue('52,5');

            await page.locator('#lf-research-table-ok').click();
            await expect(page.locator('#research-cost-reduction')).toHaveValue('0');
            await expect(page.locator('#research-time-reduction')).toHaveValue('4,41');

            // Stored numbers stay locale-independent (dot decimal)
            const stored = await page.evaluate(() => localStorage.getItem('costs_lf_research_table'));
            expect(JSON.parse(stored)[0]).toEqual([24.04, 52.5]);
        });
    });
});
