import { test, expect } from '@playwright/test';

test.describe('Costs Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
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
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Buildings (planet)' }).click();
        await fillTableRows(page, '#table-0-2', 2, 17, 1);
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(4)')).toContainText('1.045M');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(5)')).toContainText('612.724');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(6)')).toContainText('201.730');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(7)')).toContainText('1.050');
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(8)')).toContainText('3w 4d 18h');
        await page.locator('#full-numbers').click();
        await expect(page.locator('#table-0-2 tr:nth-child(18) td:nth-child(4)')).toContainText('1.045.508');
    });

    test('[all items - one level / moon] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Buildings (moon)' }).click();
        await fillTableRows(page, '#table-0-3', 2, 9, 1);
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(4)')).toContainText('2.043M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(5)')).toContainText('4.081M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(6)')).toContainText('2.04M');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(8)')).toContainText('14w 4d');
        // Planet robo and nanite don't affect moon buildings
        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(8)')).toContainText('14w 4d');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(8)')).toContainText('14w 4d');
        // But moon robo does
        await page.locator('#robot-factory-level-moon').fill('10');
        await page.locator('#robot-factory-level-moon').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-child(10) td:nth-child(8)')).toContainText('1w 2d 6h');
    });

    test('[all items - one level / researches] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Researches' }).click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await fillTableRows(page, '#table-0-4', 2, 17, 1);
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('261.800');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('443.400');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('175.500');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(7)')).toContainText('300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('2d 6h 14m');
        await page.locator('#research-lab-level').fill('120');
        await page.locator('#research-lab-level').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(4)')).toContainText('261.800');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(5)')).toContainText('443.400');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(6)')).toContainText('175.500');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(7)')).toContainText('300.000');
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('5h 49m 42s');
        await expect(page.locator('#table-0-4 tr:nth-child(19) td:nth-child(3)')).toContainText('141 SC');
        await expect(page.locator('#table-0-4 tr:nth-child(19) td:nth-child(4)')).toContainText('29 LC');
        await page.getByRole('radio', { name: 'General' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(19) td:nth-child(3)')).toContainText('177 SC');
        await expect(page.locator('#table-0-4 tr:nth-child(19) td:nth-child(4)')).toContainText('36 LC');
        await page.getByRole('radio', { name: 'Discoverer' }).click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('4h 22m 16s');
        await page.locator('#technocrat').click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('3h 16m 42s');
        await page.locator('#research-bonus').click();
        await expect(page.locator('#table-0-4 tr:nth-child(18) td:nth-child(8)')).toContainText('2h 27m 32s');
    });

    test('[all items - one level / fleet] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Fleet' }).click();
        await fillTableRows(page, '#table-0-5', 2, 18, 10);
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(4)')).toContainText('53.370M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(5)')).toContainText('42.51M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(6)')).toContainText('10.885M');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(8)')).toContainText('228w 2d');
        await page.locator('#shipyard-level').fill('10');
        await page.locator('#shipyard-level').press('Enter');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-5 tr:nth-child(19) td:nth-child(8)')).toContainText('3h 23m 40s');
    });

    test('[all items - one level / defenses] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Defenses' }).click();
        await fillTableRows(page, '#table-0-6', 2, 11, 100);
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(4)')).toContainText('16.5M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(5)')).toContainText('13.3M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(6)')).toContainText('4.4M');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(8)')).toContainText('70w 6d 16h');
        await page.locator('#shipyard-level').fill('12');
        await page.locator('#shipyard-level').press('Enter');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(8)')).toContainText('51m 40s');
        await expect(page.locator('#table-0-6 tr:nth-child(12) td:nth-child(10)')).toContainText('1.275');
    });

    test('[all items - multiple levels / planet] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();
        await page.getByRole('link', { name: 'Buildings (planet)' }).click();
        await fillTableRows(page, '#table-1-2', 2, 17, 5, 6);
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(3)')).toContainText('96');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(4)')).toContainText('34.053M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(5)')).toContainText('19.599M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(6)')).toContainText('6.607M');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(7)')).toContainText('36.882');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(8)')).toContainText('127w 5d 4h');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(9)')).toContainText('60.256');
    });

    test('[all items - multiple levels / moon] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();
        await page.getByRole('link', { name: 'Buildings (moon)' }).click();
        await fillTableRows(page, '#table-1-3', 2, 9, 5, 6);
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(4)')).toContainText('65.401M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(5)')).toContainText('130.618M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(6)')).toContainText('65.289M');
        await expect(page.locator('#table-1-3 tr:nth-child(10) td:nth-child(8)')).toContainText('466w 4d 23h');
    });

    test('[all items - multiple levels / researches] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();
        await page.getByRole('link', { name: 'Researches' }).click();
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await fillTableRows(page, '#table-1-4', 2, 17, 5, 6);
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(4)')).toContainText('8.315M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(5)')).toContainText('14.064M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(6)')).toContainText('5.553M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(7)')).toContainText('72.9M');
        await expect(page.locator('#table-1-4 tr:nth-child(18) td:nth-child(8)')).toContainText('10w 1d 17h');
    });

    test('[one item - multiple levels] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'One item - multiple levels' }).click();
        // When the page loads, Metal Mine is selected by default
        await page.locator('#tab2-from-level').fill('14');
        await page.locator('#tab2-to-level').fill('16');
        await page.locator('#tab2-to-level').press('Enter');
        await expect(page.locator('#prods-table tr:nth-child(2) td:nth-child(1)')).toContainText('15');
        await expect(page.locator('#prods-table tr:nth-child(3) td:nth-child(1)')).toContainText('16');
        await expect(page.locator('#prods-table tr:nth-child(1) th:nth-child(8)')).toContainText('Prod. per hour');
        await expect(page.locator('#prods-table tr:nth-child(1) th:nth-child(9)')).toContainText('Consum. per hour');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(2)')).toContainText('43.788');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(3)')).toContainText('10.946');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(4)')).toContainText('0');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(6)')).toContainText('21h 53m 36s');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(7)')).toContainText('55');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(8)')).toContainText('3.761');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(9)')).toContainText('735');
        await page.locator('#universe-speed').selectOption('10');
        await expect(page.locator('#prods-table tr:nth-child(5) td:nth-child(6)')).toContainText('2h 11m 21s');

        await page.locator('#tech-types-select').selectOption('21');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(2)')).toContainText('19.66M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(3)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(4)')).toContainText('4.915M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(6)')).toContainText('7w 3h');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(7)')).toContainText('34.406');

        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');
        await page.locator('#tech-types-select').selectOption('106');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(2)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(3)')).toContainText('49.152M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(4)')).toContainText('9.83M');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(6)')).toContainText('27w 1h');
        await expect(page.locator('#commons-table tr:nth-child(5) td:nth-child(7)')).toContainText('68.813');
    });
    

    test('[grand totals - one level] calculations are correct', async ({ page }) => {
        // Set research lab level to 12
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');

        // First outer tab is already selected (All items - one level)
        // Fill 10 in the first row of each inner tab and verify grand totals

        // Buildings (planet)
        await page.getByRole('link', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(3)')).toContainText('2.306');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(4)')).toContainText('576');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1h 9m 10s');
        await expect(page.locator('#table-0-2 tr:nth-last-child(2) td:nth-child(8)')).toContainText('2');

        // Buildings (moon)
        await page.getByRole('link', { name: 'Buildings (moon)' }).click();
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-3 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(3)')).toContainText('207.106');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(4)')).toContainText('62.016');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(5)')).toContainText('102.400');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(7)')).toContainText('4d 11h 38m');
        await expect(page.locator('#table-0-3 tr:nth-last-child(2) td:nth-child(8)')).toContainText('370');

        // Researches
        await page.getByRole('link', { name: 'Researches' }).click();
        await page.locator('#table-0-4 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-4 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(3)')).toContainText('309.506');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(4)')).toContainText('574.016');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(7)')).toContainText('6d 10h 54m');
        await expect(page.locator('#table-0-4 tr:nth-last-child(2) td:nth-child(8)')).toContainText('1.086');

        // Fleet
        await page.getByRole('link', { name: 'Fleet' }).click();
        await page.locator('#table-0-5 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-5 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(3)')).toContainText('329.506');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(4)')).toContainText('594.016');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1w 2h');
        await expect(page.locator('#table-0-5 tr:nth-last-child(2) td:nth-child(8)')).toContainText('1.126');

        // Defenses
        await page.getByRole('link', { name: 'Defenses' }).click();
        await page.locator('#table-0-6 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-0-6 tr:nth-child(2) td:nth-child(3) input').press('Enter');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(3)')).toContainText('349.506');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(4)')).toContainText('594.016');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1w 10h');
        await expect(page.locator('#table-0-6 tr:nth-last-child(2) td:nth-child(8)')).toContainText('1.146');
    });

    test('[grand totals - multiple levels] calculations are correct', async ({ page }) => {
        // Set research lab level to 12
        await page.locator('#research-lab-level').fill('12');
        await page.locator('#research-lab-level').press('Enter');

        // Click the second outer tab (All items - multiple levels)
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();

        // Fill 10 and 11 in the first row of each inner tab and verify grand totals

        // Buildings (planet)
        await page.getByRole('link', { name: 'Buildings (planet)' }).click();
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-2 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(3)')).toContainText('3.459');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(4)')).toContainText('864');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(5)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1h 43m 45s');
        await expect(page.locator('#table-1-2 tr:nth-last-child(2) td:nth-child(8)')).toContainText('4');

        // Buildings (moon)
        await page.getByRole('link', { name: 'Buildings (moon)' }).click();
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-3 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(3)')).toContainText('413.059');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(4)')).toContainText('123.744');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(5)')).toContainText('204.800');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1w 1d 22h');
        await expect(page.locator('#table-1-3 tr:nth-last-child(2) td:nth-child(8)')).toContainText('741');

        // Researches
        await page.getByRole('link', { name: 'Researches' }).click();
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(3) input').fill('10');
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(4) input').fill('11');
        await page.locator('#table-1-4 tr:nth-child(2) td:nth-child(4) input').press('Enter');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(3)')).toContainText('617.859');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(4)')).toContainText('1.147M');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(5)')).toContainText('409.600');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(7)')).toContainText('1w 5d 21h');
        await expect(page.locator('#table-1-4 tr:nth-last-child(2) td:nth-child(8)')).toContainText('2.174');
    });

    test('deconstruction calculation is correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();
        await page.getByRole('link', { name: 'Buildings (planet)' }).click();
        
        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(3) input`).fill('20');
        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(4) input`).fill('19');
        await page.locator(`#table-1-2 tr:nth-child(2) td:nth-child(4) input`).press('Enter');

        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(4)')).toContainText('88.673');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(5)')).toContainText('22.168');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(6)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(7)')).toContainText('0');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(8)')).toContainText('1d 20h 20m');
        await expect(page.locator('#table-1-2 tr:nth-child(18) td:nth-child(9)')).toContainText('-166');
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
});