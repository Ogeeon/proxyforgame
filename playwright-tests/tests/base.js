// Every spec imports `test` and `expect` from here rather than from
// @playwright/test, so a fixture every test needs has one place to go.
//
// The fixture that lived here routed cdn.jsdelivr.net through a disk cache
// (.cdn-cache/), because each test's fresh context re-downloaded Bootstrap.
// Bootstrap is now served from www/vendor/ on the site itself, so no test page
// loads anything from a CDN and there is nothing left to intercept.
import { expect } from '@playwright/test';

export { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Bootstrap's markup, in one place. Specs reach a tooltip bubble, a dialog or a
// toast through these rather than through Bootstrap's class names, so the day
// those names change (Bootstrap 6: Modal -> Dialog, docs/bootstrap-6-migration.md)
// is an edit here and not in every spec. The ids and classes of our own markup
// (`dyn-dialog`, `pf-*`, ...) stay in the specs.
// ---------------------------------------------------------------------------

/**
 * Assert the text of the Bootstrap tooltip attached to `locator`. Bootstrap moves
 * `title` into data-bs-original-title when it adopts an element and reads the
 * bubble from there, so that attribute is the tooltip's text.
 * @param {import('@playwright/test').Locator} locator
 * @param {string|RegExp} text
 */
export async function expectTooltipTitle(locator, text) {
    await expect(locator).toHaveAttribute('data-bs-original-title', text);
}

/**
 * The tooltip bubbles on the page (Bootstrap appends them to <body>).
 * @param {import('@playwright/test').Page} page
 */
export function tooltipBubble(page) {
    return page.locator('.tooltip');
}

/**
 * The dialogs the dom-utils helpers build (showAlertModal / showConfirmModal)
 * that are currently open.
 * @param {import('@playwright/test').Page} page
 */
export function openDialog(page) {
    return page.locator('.dyn-dialog.show');
}

/**
 * Every open modal that is not one of the profile dialogs (`pf-*`) - in
 * practice the dom-utils confirmation stacked on top of them.
 * @param {import('@playwright/test').Page} page
 */
export function openNonProfileDialog(page) {
    return page.locator('.modal.show:not([id^="pf-"])');
}

/**
 * @param {import('@playwright/test').Locator} dialog
 */
export function dialogBody(dialog) {
    return dialog.locator('.modal-body');
}

/**
 * @param {import('@playwright/test').Locator} dialog
 */
export function dialogHeader(dialog) {
    return dialog.locator('.modal-header');
}

/**
 * @param {import('@playwright/test').Locator} dialog
 */
export function dialogFooter(dialog) {
    return dialog.locator('.modal-footer');
}

/**
 * The toasts on the page (showToast() in dom-utils.js), optionally narrowed by
 * an extra selector such as '.text-bg-success'.
 * @param {import('@playwright/test').Page} page
 * @param {string} [extra]
 */
export function toasts(page, extra = '') {
    return page.locator(`.toast${extra}`);
}

/**
 * The message of the toasts on the page - or of the one `toast` names.
 * @param {import('@playwright/test').Page|import('@playwright/test').Locator} scope
 */
export function toastBody(scope) {
    return scope.locator('.toast-body');
}

/**
 * The close buttons of the toasts on the page.
 * @param {import('@playwright/test').Page} page
 */
export function toastClose(page) {
    return page.locator('.toast .btn-close');
}

/**
 * Assert that a collapsible section is expanded.
 * @param {import('@playwright/test').Locator} locator
 */
export async function expectExpanded(locator) {
    await expect(locator).toHaveClass(/show/);
}

/**
 * Reload the page and assert that it comes up under `title` without an uncaught
 * script error. The one smoke test each calculator keeps: everything else in its
 * spec would fail on a page that does not load, but not on a handler that throws
 * while the page still renders.
 * @param {import('@playwright/test').Page} page
 * @param {RegExp} title
 */
export async function expectLoadsCleanly(page, title) {
    const errors = [];
    const onError = (e) => errors.push(String(e));
    page.on('pageerror', onError);
    await page.reload();
    page.off('pageerror', onError);
    await expect(page).toHaveTitle(title);
    expect(errors, 'uncaught errors while the page loaded').toEqual([]);
}
