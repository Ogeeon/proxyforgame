import { test, expect } from '@playwright/test';

test.describe('Lifeforms costs Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/lfcosts.php');
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
        await expect(page).toHaveTitle(/Costs calculator for LifeForms/);
    });

    test('ldcosts.js functionality is available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    // By default we end up with Humans selected
    test('[all items - one level / buildings / human] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Buildings' }).click();
        await fillTableRows(page, '#table-0-1', 2, 13, 2);
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(4)')).toContainText('1.785M');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(5)')).toContainText('836.528');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(6)')).toContainText('825.960');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('2w 2d 22h');
        await page.locator('#full-numbers').check();
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(4)')).toContainText('1.785.028');
        await page.locator('#metal-available-0-1').fill('700000');
        await page.locator('#metal-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(3)')).toContainText('1.085.028');
        await page.locator('#crystal-available-0-1').fill('800000');
        await page.locator('#crystal-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(4)')).toContainText('36.528');
        await page.locator('#deut-available-0-1').fill('1000000');
        await page.locator('#deut-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(5)')).toContainText('0');

        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('1d 12h 59m');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('2m 9s');
        
        await page.locator('#universe-speed').selectOption('3');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('43s');
    });
    
    test('[all items - one level / researches / human] calculations are correct', async ({ page }) => {
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Researches' }).click();
        await fillTableRows(page, '#table-0-2', 2, 19, 2);
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(4)')).toContainText('7.896M');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(5)')).toContainText('5.135M');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(6)')).toContainText('2.724M');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(8)')).toContainText('5d 2h 8m');
        await page.locator('#research-cost-reduction').fill('10');
        await page.locator('#research-cost-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(4)')).toContainText('7.106M');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(5)')).toContainText('4.622M');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(6)')).toContainText('2.452M');
        await page.locator('#research-time-reduction').fill('10');
        await page.locator('#research-time-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(74) td:nth-child(8)')).toContainText('4d 13h 55m');
    });

    test('[transport calculations with hyperspace and capacity increase] SC/LC counts update correctly', async ({ page }) => {
        // Helper function to get transport counts from the "transports needed" row
        async function getTransportCounts(tableId) {
            const transportsRow = page.locator(`${tableId} tr`).filter({ hasText: 'SC' }).and(page.locator(`${tableId} tr`).filter({ hasText: 'LC' })).first();
            const scText = await transportsRow.locator('td:nth-child(3)').textContent();
            const lcText = await transportsRow.locator('td:nth-child(4)').textContent();
            return {
                sc: parseInt(scText.replace(/\D/g, '')),
                lc: parseInt(lcText.replace(/\D/g, ''))
            };
        }

        // Test Buildings table
        await page.getByRole('link', { name: 'All items - one level' }).click();
        await page.getByRole('link', { name: 'Buildings' }).click();

        // Fill level 5 for all VISIBLE rows in Buildings table (rows vary by selected race)
        const buildingsInputs = page.locator('#table-0-1 tr td:nth-child(3) input').filter({ hasText: /^[0-9]*$/ });
        const buildingsInputCount = await buildingsInputs.count();
        for (let i = 0; i < buildingsInputCount; i++) {
            const input = buildingsInputs.nth(i);
            if (await input.isVisible()) {
                await input.fill('5');
                await input.press('Enter');
            }
        }

        // Record initial transport counts
        const buildingsInitial = await getTransportCounts('#table-0-1');

        // Set hyperspace tech to 10
        await page.locator('#hyper-tech-level').fill('10');
        await page.locator('#hyper-tech-level').press('Enter');
        const buildingsAfterHyper = await getTransportCounts('#table-0-1');

        // Set SC and LC capacity increase to 10
        await page.locator('#sc-capacity-increase').fill('10');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.locator('#lc-capacity-increase').fill('10');
        await page.locator('#lc-capacity-increase').press('Enter');
        const buildingsAfterCapIncr = await getTransportCounts('#table-0-1');

        // Test Researches table
        await page.getByRole('link', { name: 'Researches' }).click();

        // Reset hyperspace and capacity settings for clean test
        await page.locator('#hyper-tech-level').fill('0');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.locator('#sc-capacity-increase').fill('0');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.locator('#lc-capacity-increase').fill('0');
        await page.locator('#lc-capacity-increase').press('Enter');

        // Fill level 5 for all VISIBLE rows in Researches table (rows vary by selected race)
        const researchesInputs = page.locator('#table-0-2 tr td:nth-child(3) input').filter({ hasText: /^[0-9]*$/ });
        const researchesInputCount = await researchesInputs.count();
        for (let i = 0; i < researchesInputCount; i++) {
            const input = researchesInputs.nth(i);
            if (await input.isVisible()) {
                await input.fill('5');
                await input.press('Enter');
            }
        }

        // Record initial transport counts
        const researchesInitial = await getTransportCounts('#table-0-2');

        // Set hyperspace tech to 10
        await page.locator('#hyper-tech-level').fill('10');
        await page.locator('#hyper-tech-level').press('Enter');
        const researchesAfterHyper = await getTransportCounts('#table-0-2');

        // Set SC and LC capacity increase to 10
        await page.locator('#sc-capacity-increase').fill('10');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.locator('#lc-capacity-increase').fill('10');
        await page.locator('#lc-capacity-increase').press('Enter');
        const researchesAfterCapIncr = await getTransportCounts('#table-0-2');

        // Verify exact transport counts at each stage
        // Buildings - Initial state (hyperspace=0, capIncrease=0)
        expect(buildingsInitial.sc).toBe(3404);
        expect(buildingsInitial.lc).toBe(681);

        // Buildings - After Hyperspace 10
        expect(buildingsAfterHyper.sc).toBe(2432);
        expect(buildingsAfterHyper.lc).toBe(487);

        // Buildings - After SC/LC capacity increase 10
        expect(buildingsAfterCapIncr.sc).toBe(2300);
        expect(buildingsAfterCapIncr.lc).toBe(460);

        // Researches - Initial state (hyperspace=0, capIncrease=0)
        expect(researchesInitial.sc).toBe(22428);
        expect(researchesInitial.lc).toBe(4486);

        // Researches - After Hyperspace 10
        expect(researchesAfterHyper.sc).toBe(16020);
        expect(researchesAfterHyper.lc).toBe(3204);

        // Researches - After SC/LC capacity increase 10
        expect(researchesAfterCapIncr.sc).toBe(15154);
        expect(researchesAfterCapIncr.lc).toBe(3031);

        // Log values for verification
        console.log('Buildings - Initial SC/LC:', buildingsInitial);
        console.log('Buildings - After Hyper(10):', buildingsAfterHyper);
        console.log('Buildings - After CapIncr(10):', buildingsAfterCapIncr);
        console.log('Researches - Initial SC/LC:', researchesInitial);
        console.log('Researches - After Hyper(10):', researchesAfterHyper);
        console.log('Researches - After CapIncr(10):', researchesAfterCapIncr);
    });

    // Helper function to test second outer tab for a specific lifeform
    async function testSecondOuterTab(page, lifeformValue, lifeformName, expectedData) {
        // Reset page to clean state
        await page.locator('#reset').click();
        await page.waitForTimeout(500);

        // Reset settings
        await page.locator('#hyper-tech-level').fill('0');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.locator('#sc-capacity-increase').fill('0');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.locator('#lc-capacity-increase').fill('0');
        await page.locator('#lc-capacity-increase').press('Enter');
        await page.waitForTimeout(300);

        // Select lifeform BEFORE navigating to tabs (important for row visibility)
        await page.locator('#race-selector').selectOption(lifeformValue);
        await page.waitForTimeout(500);

        // Helper function to get transport counts
        async function getTransportCounts(tableId) {
            const transportsRow = page.locator(`${tableId} tr`).filter({ hasText: 'SC' }).and(page.locator(`${tableId} tr`).filter({ hasText: 'LC' })).first();
            const scText = await transportsRow.locator('td:nth-child(3)').textContent();
            const lcText = await transportsRow.locator('td:nth-child(4)').textContent();
            return {
                sc: parseInt(scText.replace(/\D/g, '')),
                lc: parseInt(lcText.replace(/\D/g, ''))
            };
        }

        // Test Buildings (outer tab 1, inner tab 1) - table-1-1
        await page.getByRole('link', { name: 'All items - multiple levels' }).click();
        await page.waitForTimeout(300);
        await page.getByRole('link', { name: 'Buildings' }).click();
        await page.waitForTimeout(300);

        // Fill from=1, to=2 for all visible rows
        const fromInputs = await page.locator('#table-1-1 tr td:nth-child(3) input').all();
        const toInputs = await page.locator('#table-1-1 tr td:nth-child(4) input').all();

        for (let i = 0; i < fromInputs.length; i++) {
            const fromInput = fromInputs[i];
            const toInput = toInputs[i];
            if (await fromInput.isVisible()) {
                await fromInput.fill('1');
                await fromInput.press('Enter');
                await page.waitForTimeout(50);
                await toInput.fill('2');
                await toInput.press('Enter');
                await page.waitForTimeout(50);
            }
        }

        await page.waitForTimeout(500);

        // Get initial counts
        const buildingsInitial = await getTransportCounts('#table-1-1');

        // Set hyperspace to 10
        await page.locator('#hyper-tech-level').fill('10');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.waitForTimeout(500);
        const buildingsAfterHyper = await getTransportCounts('#table-1-1');

        // Set capacity increase to 10
        await page.locator('#sc-capacity-increase').fill('10');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.waitForTimeout(200);
        await page.locator('#lc-capacity-increase').fill('10');
        await page.locator('#lc-capacity-increase').press('Enter');
        await page.waitForTimeout(500);
        const buildingsAfterCapIncr = await getTransportCounts('#table-1-1');

        // Verify Buildings transport counts
        expect(buildingsInitial.sc).toBe(expectedData.buildings.initial.sc);
        expect(buildingsInitial.lc).toBe(expectedData.buildings.initial.lc);
        expect(buildingsAfterHyper.sc).toBe(expectedData.buildings.afterHyper.sc);
        expect(buildingsAfterHyper.lc).toBe(expectedData.buildings.afterHyper.lc);
        expect(buildingsAfterCapIncr.sc).toBe(expectedData.buildings.afterCapIncr.sc);
        expect(buildingsAfterCapIncr.lc).toBe(expectedData.buildings.afterCapIncr.lc);

        // Reset settings for researches
        await page.locator('#hyper-tech-level').fill('0');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.locator('#sc-capacity-increase').fill('0');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.locator('#lc-capacity-increase').fill('0');
        await page.locator('#lc-capacity-increase').press('Enter');
        await page.waitForTimeout(300);

        // Test Researches (outer tab 1, inner tab 2) - table-1-2
        await page.getByRole('link', { name: 'Researches' }).click();
        await page.waitForTimeout(300);

        // Fill from=1, to=2 for all visible rows
        const resFromInputs = await page.locator('#table-1-2 tr td:nth-child(3) input').all();
        const resToInputs = await page.locator('#table-1-2 tr td:nth-child(4) input').all();

        for (let i = 0; i < resFromInputs.length; i++) {
            const fromInput = resFromInputs[i];
            const toInput = resToInputs[i];
            if (await fromInput.isVisible()) {
                await fromInput.fill('1');
                await fromInput.press('Enter');
                await page.waitForTimeout(50);
                await toInput.fill('2');
                await toInput.press('Enter');
                await page.waitForTimeout(50);
            }
        }

        await page.waitForTimeout(500);

        // Get initial counts
        const researchesInitial = await getTransportCounts('#table-1-2');

        // Set hyperspace to 10
        await page.locator('#hyper-tech-level').fill('10');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.waitForTimeout(500);
        const researchesAfterHyper = await getTransportCounts('#table-1-2');

        // Set capacity increase to 10
        await page.locator('#sc-capacity-increase').fill('10');
        await page.locator('#sc-capacity-increase').press('Enter');
        await page.waitForTimeout(200);
        await page.locator('#lc-capacity-increase').fill('10');
        await page.locator('#lc-capacity-increase').press('Enter');
        await page.waitForTimeout(500);
        const researchesAfterCapIncr = await getTransportCounts('#table-1-2');

        // Verify Researches transport counts
        expect(researchesInitial.sc).toBe(expectedData.researches.initial.sc);
        expect(researchesInitial.lc).toBe(expectedData.researches.initial.lc);
        expect(researchesAfterHyper.sc).toBe(expectedData.researches.afterHyper.sc);
        expect(researchesAfterHyper.lc).toBe(expectedData.researches.afterHyper.lc);
        expect(researchesAfterCapIncr.sc).toBe(expectedData.researches.afterCapIncr.sc);
        expect(researchesAfterCapIncr.lc).toBe(expectedData.researches.afterCapIncr.lc);

        console.log(`${lifeformName} Buildings - Initial SC/LC:`, buildingsInitial);
        console.log(`${lifeformName} Buildings - After Hyper(10):`, buildingsAfterHyper);
        console.log(`${lifeformName} Buildings - After CapIncr(10):`, buildingsAfterCapIncr);
        console.log(`${lifeformName} Researches - Initial SC/LC:`, researchesInitial);
        console.log(`${lifeformName} Researches - After Hyper(10):`, researchesAfterHyper);
        console.log(`${lifeformName} Researches - After CapIncr(10):`, researchesAfterCapIncr);
    }

    test('[all items - multiple levels / human] SC/LC counts update correctly', async ({ page }) => {
        await testSecondOuterTab(page, '1', 'Human', {
            buildings: {
                initial: { sc: 552, lc: 111 },
                afterHyper: { sc: 395, lc: 79 },
                afterCapIncr: { sc: 373, lc: 75 }
            },
            researches: {
                initial: { sc: 3073, lc: 615 },
                afterHyper: { sc: 2195, lc: 439 },
                afterCapIncr: { sc: 2077, lc: 416 }
            }
        });
    });

    test('[all items - multiple levels / rocktal] SC/LC counts update correctly', async ({ page }) => {
        await testSecondOuterTab(page, '2', 'Rocktal', {
            buildings: {
                initial: { sc: 863, lc: 173 },
                afterHyper: { sc: 616, lc: 124 },
                afterCapIncr: { sc: 583, lc: 117 }
            },
            researches: {
                initial: { sc: 3215, lc: 643 },
                afterHyper: { sc: 2297, lc: 460 },
                afterCapIncr: { sc: 2173, lc: 435 }
            }
        });
    });

    test('[all items - multiple levels / mechas] SC/LC counts update correctly', async ({ page }) => {
        await testSecondOuterTab(page, '3', 'Mechas', {
            buildings: {
                initial: { sc: 588, lc: 118 },
                afterHyper: { sc: 420, lc: 84 },
                afterCapIncr: { sc: 397, lc: 80 }
            },
            researches: {
                initial: { sc: 3309, lc: 662 },
                afterHyper: { sc: 2363, lc: 473 },
                afterCapIncr: { sc: 2236, lc: 448 }
            }
        });
    });

    test('[all items - multiple levels / kaeltas] SC/LC counts update correctly', async ({ page }) => {
        await testSecondOuterTab(page, '4', 'Kaeltas', {
            buildings: {
                initial: { sc: 839, lc: 168 },
                afterHyper: { sc: 600, lc: 120 },
                afterCapIncr: { sc: 567, lc: 114 }
            },
            researches: {
                initial: { sc: 3338, lc: 668 },
                afterHyper: { sc: 2385, lc: 477 },
                afterCapIncr: { sc: 2256, lc: 452 }
            }
        });
    });

    // todo: hyperspace, class bonus and lf bonuses to cargo cap
});
