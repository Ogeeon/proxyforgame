// The calculation-error report, as the calculators' specs drive it: catch the
// report the dialog posts, and select a result cell the way a visitor does
// before opening the dialog through the sidebar link's handler.
//
// Each calculator's reportSnapshot() hook (its *-data-collector.js) decides
// what the fold-out lists and what the e-mail carries; the specs assert both.

import { expect } from './base';

/**
 * Intercepts the report POST to ajax.php and answers it, letting every other
 * request through. The returned getter yields the posted form once it went.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<() => URLSearchParams|null>}
 */
export async function catchReport(page) {
    /** @type {URLSearchParams|null} */
    let sent = null;
    await page.route(/\/ajax\.php/, async (route) => {
        const body = new URLSearchParams(route.request().postData() ?? '');
        if (route.request().method() !== 'POST' || body.get('service') !== 'report') {
            await route.continue();
            return;
        }
        sent = body;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    return () => sent;
}

/**
 * Selects the cell's text, opens the report dialog with the calculation-error
 * switch on and unfolds the list of attached values.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} cell
 */
export async function reportCell(page, cell) {
    await cell.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        findSelection();
    });
    await expect(page.locator('#reportModal')).toBeVisible();
    await expect(page.locator('#report-calc-toggle')).toBeChecked();
    await page.locator('#report-calc-details summary').click();
}

/**
 * Sends the open report with a corrected value and returns the e-mail context
 * the dialog posted.
 * @param {import('@playwright/test').Page} page
 * @param {() => URLSearchParams|null} sent - what catchReport() returned
 * @param {string} corrected
 * @returns {Promise<void>}
 */
export async function sendReport(page, sent, corrected) {
    await page.locator('#corrected-text').fill(corrected);
    await page.locator('#report-btn-ok').click();
    await expect.poll(() => sent()?.get('context') ?? null).not.toBeNull();
}
