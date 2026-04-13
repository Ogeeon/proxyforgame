import { test, expect } from '@playwright/test';

test.describe('Production Calculator Page', () => {
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

    test('basic functionality works', async ({ page }) => {
        // Add your specific test here
        // Example: fill in a form field and check the result

        // await page.locator('#some-input').fill('10');
        // await page.locator('#some-input').press('Enter');
        // await expect(page.locator('#some-result')).toContainText('expected value');
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
});
