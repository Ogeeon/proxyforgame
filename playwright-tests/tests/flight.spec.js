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

// Fixture: object exported from the OGame client (API 2 field on the 'Fleet' page).
// Coordinates 5:254:14, discoverer class, trader alliance, drives 14/10/8, hypertech 9,
// fleetspeed x10 (universe data, intentionally ignored on import).
const OWN_API_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/own_api.json'),
    'utf-8'
);

const OWN_API_IMPORT_BUTTON = 'div[aria-labelledby="ui-dialog-title-own-api-reader"] .ui-dialog-buttonpane button';

test.describe('Flight Calculator - OGame Object Import', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        // The parameters panel is collapsed by default — open it first
        await page.getByRole('tab', { name: 'Parameters' }).click();
    });

    test('imports own_api.json and populates form fields', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));

        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        await page.locator('#own-api-txtarea').fill(OWN_API_FIXTURE);
        await page.locator(OWN_API_IMPORT_BUTTON).first().click(); // "Import" button

        // Departure coordinates
        await expect(page.locator('#departure-g')).toHaveValue('5');
        await expect(page.locator('#departure-s')).toHaveValue('254');
        await expect(page.locator('#departure-p')).toHaveValue('14');

        // Drive technologies (researches 115/117/118 + hyperspace tech 114)
        await expect(page.locator('#cmb-drive')).toHaveValue('14');
        await expect(page.locator('#imp-drive')).toHaveValue('10');
        await expect(page.locator('#hyp-drive')).toHaveValue('8');
        await expect(page.locator('#hypertech-lvl')).toHaveValue('9');

        // characterClassId 3 -> discoverer -> class-2; allianceClassId 2 -> trader bonus
        await expect(page.locator('#class-2')).toBeChecked();
        await expect(page.locator('#trader-bonus')).toBeChecked();

        // Ship counts (defense ids 401-408 and 212/217 in the object are ignored)
        await expect(page.locator('#small-cargo')).toHaveValue('8855');
        await expect(page.locator('#large-cargo')).toHaveValue('3741');
        await expect(page.locator('#light-fighter')).toHaveValue('407');
        await expect(page.locator('#battleship')).toHaveValue('116');
        await expect(page.locator('#esp-probe')).toHaveValue('9994');
        await expect(page.locator('#pathfinder')).toHaveValue('106');

        // Universe data (fleetspeed etc.) from the API 2 export is intentionally ignored,
        // so the fleet speed select keeps its default value despite fleetspeed x10 in the fixture.
        await expect(page.locator('#speed-fleet-war')).toHaveValue('1');

        // Per-ship LF bonus for light fighter (204): speed 0.003066 -> 0.3066(%)
        const lfSpeed = await page.locator('[class~="204-speed"]').inputValue();
        expect(parseFloat(lfSpeed.replace(',', '.'))).toBeCloseTo(0.3066, 3);

        // Dialog closes on successful import
        await expect(page.locator('#own-api-reader')).toBeHidden();
        expect(errors, 'no page JS errors').toEqual([]);
    });

    test('invalid input shows an error and does not change fields', async ({ page }) => {
        let alertMsg = '';
        page.on('dialog', d => { alertMsg = d.message(); d.accept(); });

        const before = await page.locator('#departure-g').inputValue();

        // Invalid input keeps the dialog open, so open it once and try both values inside it.
        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        // Malformed JSON, and a bare primitive that JSON.parse would otherwise accept ("111" -> 111).
        for (const bad of ['{not valid json', '111']) {
            alertMsg = '';
            await page.locator('#own-api-txtarea').fill(bad);
            await page.locator(OWN_API_IMPORT_BUTTON).first().click();

            expect(alertMsg.length, `alert shown for input ${JSON.stringify(bad)}`).toBeGreaterThan(0);
            await expect(page.locator('#departure-g')).toHaveValue(before);
            await expect(page.locator('#own-api-reader')).toBeVisible(); // stays open on error
        }
    });
});
