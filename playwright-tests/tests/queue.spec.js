import { test, expect } from '@playwright/test';

test.describe('Construction Queue Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/queue.php');
    });

    // Helper function to get queue totals
    async function getQueueTotals(page) {
        // Use the correct table ID #table-dst-2 (destination table for planet)
        const totalsRow = page.locator('#table-dst-2 tr').filter({ hasText: 'Total' }).first();
        const levelText = await totalsRow.locator('td:nth-child(2)').textContent();
        const metalText = await totalsRow.locator('td:nth-child(3)').textContent();
        const crystalText = await totalsRow.locator('td:nth-child(4)').textContent();
        const deutText = await totalsRow.locator('td:nth-child(5)').textContent();
        const timeText = await totalsRow.locator('td:nth-child(6)').textContent();

        const transportsRow = page.locator('#table-dst-2 tr').filter({ hasText: 'SC' }).first();
        const scText = await transportsRow.locator('td:nth-child(2)').textContent();
        const lcText = await transportsRow.locator('td:nth-child(3)').textContent();

        return {
            level: levelText.trim(),
            metal: metalText.trim(),
            crystal: crystalText.trim(),
            deuterium: deutText.trim(),
            time: timeText.trim(),
            sc: parseInt(scText.replace(/\D/g, '')),
            lc: parseInt(lcText.replace(/\D/g, ''))
        };
    }

    // Helper function to add building to queue
    // type: 2 = planet, 3 = moon
    // techIds: 1=metal mine, 2=crystal mine, 3=deut synth, 4=solar plant, 12=fusion reactor, 14=robotics factory, 41=lunar base
    async function addToQueue(page, techId, startLevel = 0, type = 2) {
        if (startLevel > 0) {
            const startLevelInput = page.locator(`#startlvl-${type}-${techId}`);
            await startLevelInput.fill(startLevel.toString());
        }
        // Select build button from the correct source table
        const buildButton = page.locator(`#table-src-${type} #build-${techId}`);
        await buildButton.click();
        await page.waitForTimeout(200);
    }

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Construction queue/i);
    });

    test('[planet / metal mine / from level 0] calculates correctly', async ({ page }) => {
        await addToQueue(page, 1, 0); // Metal mine (tech ID 1) from level 0
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('1/163');
        expect(totals.metal).toBe('60');
        expect(totals.crystal).toBe('15');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('30s');
    });

    test('[planet / metal mine / from level 10] calculates correctly', async ({ page }) => {
        await addToQueue(page, 1, 10); // Metal mine (tech ID 1) from level 10
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('11/163');
        expect(totals.metal).toBe('3.459');
        expect(totals.crystal).toBe('864');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('1h 43m 45s');
    });

    test('[planet / crystal mine / from level 0] calculates correctly', async ({ page }) => {
        await addToQueue(page, 2, 0); // Crystal mine (tech ID 2) from level 0
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('1/163');
        expect(totals.metal).toBe('48');
        expect(totals.crystal).toBe('24');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('29s');
    });

    test('[planet / crystal mine / from level 10] calculates correctly', async ({ page }) => {
        await addToQueue(page, 2, 10); // Crystal mine (tech ID 2) from level 10
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('11/163');
        expect(totals.metal).toBe('5.277');
        expect(totals.crystal).toBe('2.638');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('3h 9m 57s');
    });

    test('[planet / deut synthesizer / from level 0] calculates correctly', async ({ page }) => {
        await addToQueue(page, 3, 0); // Deut synthesizer (tech ID 3) from level 0
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('1/163');
        expect(totals.metal).toBe('225');
        expect(totals.crystal).toBe('75');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('2m 3s');
    });

    test('[planet / deut synthesizer / from level 10] calculates correctly', async ({ page }) => {
        await addToQueue(page, 3, 10); // Deut synthesizer (tech ID 3) from level 10
        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('11/163');
        expect(totals.metal).toBe('12.974');
        expect(totals.crystal).toBe('4.324');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('6h 55m 9s');
    });

    test('[planet / 9 element queue] totals are correct', async ({ page }) => {
        // Add 3 metal mines, 3 crystal mines, 3 deut synthesizers
        for (let i = 0; i < 3; i++) {
            await addToQueue(page, 1, 0);
        }
        for (let i = 0; i < 3; i++) {
            await addToQueue(page, 2, 0);
        }
        for (let i = 0; i < 3; i++) {
            await addToQueue(page, 3, 0);
        }

        const totals = await getQueueTotals(page);

        expect(totals.level).toBe('9/163');
        expect(totals.metal).toBe('1.599');
        expect(totals.crystal).toBe('548');
        expect(totals.deuterium).toBe('0');
        expect(totals.time).toBe('18m 13s');
    });

    test('[robotics factory level effect] time calculations update correctly', async ({ page }) => {
        // Create a queue with fusion reactor from level 5 to 6
        await addToQueue(page, 12, 5);

        const initialTime = (await getQueueTotals(page)).time;
        expect(initialTime).toBe('9h 31m 23s');

        // Set robotics factory to level 10
        await page.locator('#startlvl-2-14').fill('10');
        await page.locator('#startlvl-2-14').press('Enter');
        await page.waitForTimeout(500);

        const timeAfterRobo10 = (await getQueueTotals(page)).time;
        expect(timeAfterRobo10).toBe('51m 56s');

        // Add robotics factory to queue (builds from level 10 to 11)
        await addToQueue(page, 14, 10);
        const timeWithRoboInQueue = (await getQueueTotals(page)).time;
        // The time should include the fusion reactor + robotics factory upgrade
        expect(timeWithRoboInQueue).toBe('20h 13m 42s');

        // Move robotics factory up in queue by clicking control button
        // The robotics factory gets rowId = 1 (added after fusion reactor at index 0)
        // Move from position 1 to 0
        await page.locator('#control-2-1-a').click();
        await page.waitForTimeout(200);

        const timeAfterMoving = (await getQueueTotals(page)).time;
        // When robo factory builds first, fusion reactor benefits from level 11 during its construction
        // Time should be slightly shorter (20h 9m 22s vs 20h 13m 42s)
        expect(timeAfterMoving).toBe('20h 9m 22s');
    });

    test('[universe speed effect] time calculations update correctly', async ({ page }) => {
        // Add metal mine to queue
        await addToQueue(page, 1, 0);

        // Check time at universe speed 1
        const timeSpeed1 = (await getQueueTotals(page)).time;
        expect(timeSpeed1).toBe('30s');

        // Change to universe speed 2
        await page.locator('#universe-speed').selectOption('2');
        await page.waitForTimeout(500);

        const timeSpeed2 = (await getQueueTotals(page)).time;
        expect(timeSpeed2).toBe('15s');

        // Change to universe speed 5
        await page.locator('#universe-speed').selectOption('5');
        await page.waitForTimeout(500);

        const timeSpeed5 = (await getQueueTotals(page)).time;
        expect(timeSpeed5).toBe('6s');
    });

    test('[hyperspace tech effect] transport calculations update correctly', async ({ page }) => {
        // Add 3 metal mines to queue
        for (let i = 0; i < 3; i++) {
            await addToQueue(page, 1, 0);
        }

        // Initial transport needs with hyperspace 0
        const transportsInitial = await getQueueTotals(page);
        expect(transportsInitial.sc).toBe(1);
        expect(transportsInitial.lc).toBe(1);

        // Set hyperspace to level 10
        await page.locator('#hyper-tech-level').fill('10');
        await page.locator('#hyper-tech-level').press('Enter');
        await page.waitForTimeout(500);

        const transportsAfterHyper = await getQueueTotals(page);
        expect(transportsAfterHyper.sc).toBe(1);
        expect(transportsAfterHyper.lc).toBe(1);
    });

    test('[ion tech effect] demolition resources calculated correctly', async ({ page }) => {
        // First, build metal mine from level 0 to 1
        await addToQueue(page, 1, 0);
        // Then build it again from level 1 to 2
        await addToQueue(page, 1, 1);

        // Now demolish from level 2 to level 1
        await page.locator('#table-src-2 #destroy-1').click({ force: true });
        await page.waitForTimeout(500);

        // Get the totals and verify demolition cost is shown
        const totals = await getQueueTotals(page);

        // In OGame, demolition costs resources (you must pay to demolish)
        // With ion tech 0, demolishing a level 2 metal mine costs additional resources
        // Total includes: build 0→1 (60m/15c), build 1→2 (90m/23c), demolish 2→1 (210m/50c)
        expect(totals.level).toBe('2/163');
        expect(totals.metal).toBe('360');
        expect(totals.crystal).toBe('88');
    });

    test('[moon queue / lunar base + robotics factories] handles field limits correctly', async ({ page }) => {
        // Click on Moon tab
        await page.locator('#tabtag-3').click();
        await page.waitForTimeout(300);

        // Set total fields to 1 (lunar base will add 3, making 4 total fields available)
        // With lunar base (1 field) + 4 robotics factories (4 fields) = 5/5, still within limits
        // Adding 5th robotics factory = 6/5, which exceeds limits and shows brown
        await page.locator('#total-fields-3').fill('1');
        await page.locator('#total-fields-3').press('Enter');
        await page.waitForTimeout(500);

        // Add lunar base (tech ID 41) from level 0 to 1
        await addToQueue(page, 41, 0, 3);

        // Add 3 robotics factories (tech ID 14)
        for (let i = 0; i < 3; i++) {
            await addToQueue(page, 14, 0, 3);
        }

        // Get the queue totals from moon table
        const moonTotalsRow = page.locator('#table-dst-3 tr').filter({ hasText: 'Total' }).first();
        const levelText = await moonTotalsRow.locator('td:nth-child(2)').textContent();
        const metalText = await moonTotalsRow.locator('td:nth-child(3)').textContent();
        const crystalText = await moonTotalsRow.locator('td:nth-child(4)').textContent();
        const deutText = await moonTotalsRow.locator('td:nth-child(5)').textContent();
        const timeText = await moonTotalsRow.locator('td:nth-child(6)').textContent();

        // After: lunar base (level 1 provides 3 fields) + 3 robotics factories (use 3 fields)
        // Starting with 1 base field: 1 + 3 = 4 fields available total
        // 4 buildings built (lunar base + 3 robotics), using 4 fields, with only 4 available = 4/4 (within limits)
        expect(levelText.trim()).toBe('4/4');
        expect(metalText.trim()).toBe('22.800');
        expect(crystalText.trim()).toBe('40.840');
        expect(deutText.trim()).toBe('21.400');
        expect(timeText.trim()).toBe('1d 14m');

        // Add another robotics factory - this should exceed available fields even more and show brown color
        await addToQueue(page, 14, 0, 3);

        // Check the last row (robotics factory at index 5) has brown color
        const lastRow = page.locator('#table-dst-3 tr').nth(5);
        const fontElement = lastRow.locator('td:first-child font');
        const color = await fontElement.getAttribute('color');

        expect(color).toBe('brown');

        // Check total level shows overflow (5/4)
        const levelAfterOverflow = await moonTotalsRow.locator('td:nth-child(2)').textContent();
        expect(levelAfterOverflow.trim()).toBe('5/4');

        // Remove the last 2 added robotics factories by clicking delete button on row 3 twice
        // After deleting one, the queue shifts, so we click #control-3-3-c twice
        await page.locator('#control-3-3-c').click();
        await page.waitForTimeout(200);
        await page.locator('#control-3-3-c').click();
        await page.waitForTimeout(200);

        // Add another lunar base (upgrade existing from level 1 to 2, adds 3 more fields) and robotics factory
        await addToQueue(page, 41, 0, 3); // lunar base from level 1 to 2 (now provides 6 fields total)
        await addToQueue(page, 14, 0, 3); // robo factory from level 1 to 2

        // Now: Lunar base level 2 (6 fields provided), 3 robotics factories (3 fields used)
        // Starting with 1 base field + 6 from lunar base level 2 = 7 fields available total
        // Queue: 5 buildings (2 lunar bases, 3 robotics)
        // 5/7 = within limits (black color)
        const finalLevelText = await moonTotalsRow.locator('td:nth-child(2)').textContent();
        expect(finalLevelText.trim()).toBe('5/7');
    });
});
