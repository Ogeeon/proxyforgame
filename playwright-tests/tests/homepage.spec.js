import { test, expect } from './base';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ProxyForGame - tools for online browser game OGame/);
});

test.describe('Changelog dialog on load', () => {
  // A first visit must not be read as "last saw some old release": the dialog
  // would then list every release on the site. The seeded changelog holds
  // entries 1 and 2, so treating a first visit as release 0 opens it here.
  test('a first visit does not open it, and records the current release', async ({ page }) => {
    const changelogRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('service=changelog')) changelogRequests.push(request.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(changelogRequests).toEqual([]);
    await expect(page.locator('#changelogModal')).toBeHidden();
    const { saved, current } = await page.evaluate(() => ({
      saved: localStorage.getItem('lastChange'),
      current: currChange.value,
    }));
    expect(JSON.parse(saved || '{}').value).toBe(current);
  });

  test('a returning visitor who missed a release gets it', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lastChange', JSON.stringify({ value: 0 }));
    });
    await page.goto('/');
    await expect(page.locator('#changelogModal')).toBeVisible();
    await expect(page.locator('#changelog-tbl tbody tr').first()).toBeVisible();
  });
});

/**
 * The bundle is served from our own origin, so the only way it goes missing is a
 * request that failed. A `defer` script that never arrives leaves `bootstrap`
 * undefined, and the sidebar wiring used to throw straight out of its
 * DOMContentLoaded handler at that point, taking the rest of the handler with it
 * (Hawk: "bootstrap is not defined"). Nothing else on the homepage touches the
 * bundle unguarded, so aborting it isolates that handler.
 */
test.describe('Sidebar with the Bootstrap bundle missing', () => {
  test('the sidebar wiring does not throw', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.route('**/vendor/bootstrap/bootstrap.bundle.min.js*', (route) => route.abort());
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(
      errors.filter((e) => /bootstrap is not defined/.test(e)),
      'no uncaught reference to the missing bundle',
    ).toEqual([]);
  });
});
