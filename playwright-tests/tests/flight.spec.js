import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Flight Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Flight/i);
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

    // Add more tests as needed
    // test('[specific scenario] calculates correctly', async ({ page }) => {
    //     // Test implementation
    // });
});

// Fixture: spy report code fs003df9447df01744296d867509e0ae7e60
// Universe 1-en, coordinates 4:123:7, all fleet speeds x1
const SR_CODE = 'fs003df9447df01744296d867509e0ae7e60';
const SR_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/sr_fs003df9447df01744296d867509e0ae7e60.txt'),
    'utf-8'
);

test.describe('Flight Calculator - Spy Report Import', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });

        // Intercept the ogameAPI ajax call and return the pre-recorded fixture
        await page.route('/ajax.php', async (route, request) => {
            const body = request.postData() ?? '';
            if (body.includes('service=ogameAPI')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/plain',
                    body: SR_FIXTURE,
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/ogame/calc/flight.php');
    });

    test('imports spy report and populates form fields', async ({ page }) => {
        // The parameters panel is collapsed by default — open it first
        await page.getByRole('tab', { name: 'Parameters' }).click();
        await page.locator('#api-code').fill(SR_CODE);
        await page.locator('#api-get').click();

        // Wait for the loading overlay to disappear
        await page.waitForFunction(() => !document.querySelector('.panel-overlay'), { timeout: 5000 });

        // Universe and location from fixture (universe 1-en, coordinates 4:123:7)
        await expect(page.locator('#country')).toHaveValue('en');
        await expect(page.locator('#departure-g')).toHaveValue('4');
        await expect(page.locator('#departure-s')).toHaveValue('123');
        await expect(page.locator('#departure-p')).toHaveValue('7');

        // Fleet speed selects should reflect the fixture values (all x1)
        await expect(page.locator('#speed-fleet-war')).toHaveValue('1');
        await expect(page.locator('#speed-fleet-peaceful')).toHaveValue('1');
        await expect(page.locator('#speed-fleet-holding')).toHaveValue('1');
    });
});
