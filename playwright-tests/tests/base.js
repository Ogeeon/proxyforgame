// Every spec imports `test` and `expect` from here rather than from
// @playwright/test, so a fixture every test needs has one place to go.
//
// The fixture that lived here routed cdn.jsdelivr.net through a disk cache
// (.cdn-cache/), because each test's fresh context re-downloaded Bootstrap.
// Bootstrap is now served from www/vendor/ on the site itself, so no test page
// loads anything from a CDN and there is nothing left to intercept.
import { expect } from '@playwright/test';

export { test, expect } from '@playwright/test';

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
