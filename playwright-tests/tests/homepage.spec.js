import { test, expect } from './base';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ProxyForGame - tools for online browser game OGame/);
});

test('the AI assistants card leads to the page about the MCP server', async ({ page }) => {
  await page.goto('/ru/');
  const link = page.locator('#ai-card a[href="/ru/mcp"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/ru\/mcp$/);
  await expect(page.locator('#mcp-address')).toHaveValue('https://proxyforgame.com/mcp');
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

  test('the sidebar button opens it on demand', async ({ page }) => {
    await page.goto('/');
    await page.locator('#sidebar .changelog-open').click();
    await expect(page.locator('#changelogModal')).toBeVisible();
    await expect(page.locator('#changelog-tbl tbody tr').first()).toBeVisible();
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
 * The tripwire for a Bootstrap major upgrade. www/js/bootstrap-access.js and
 * www/js/bootstrap-tooltip-guard.js read the bundle's UMD global and the
 * components below off it; Bootstrap 6 is ESM-only and renames Modal, Offcanvas
 * and Dropdown. This test MUST fail on v6: that failure is the signal to follow
 * docs/bootstrap-6-migration.md, not something to fix by loosening the test.
 */
test('the bundle is Bootstrap 5 with its UMD global', async ({ page }) => {
  await page.goto('/');
  const bundle = await page.evaluate(() => {
    const bs = /** @type {any} */ (window).bootstrap;
    if (!bs) return null;
    return {
      components: ['Tooltip', 'Popover', 'Modal', 'Tab', 'Collapse', 'Toast', 'Offcanvas']
        .filter((name) => typeof bs[name] !== 'function'),
      version: bs.Tooltip?.VERSION ?? '',
    };
  });
  expect(bundle, 'window.bootstrap is defined').not.toBeNull();
  expect(bundle?.components, 'components missing from window.bootstrap').toEqual([]);
  expect(bundle?.version, 'bootstrap.Tooltip.VERSION').toMatch(/^5\./);
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

/**
 * The same failure one file later: the bundle arrives, but www/js/bootstrap-access.js
 * - the facade every script reaches Bootstrap through - does not. The guards check
 * for the facade with `typeof` before calling it, so a missing one is a skipped
 * handler, not a ReferenceError for each of its functions.
 */
test.describe('Sidebar with the Bootstrap facade missing', () => {
  test('the sidebar wiring does not throw', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.route('**/js/bootstrap-access.js*', (route) => route.abort());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The capture-phase click handler carries the same guard.
    await page.locator('body').click();

    expect(
      errors.filter((e) => /is not defined/.test(e)),
      'no uncaught reference to the missing facade',
    ).toEqual([]);
  });

  // A calculator page adds the profile controller, which builds its tooltips as
  // soon as profiles-ui.js runs - outside the page's inline guard. It has to
  // stand down too, leaving only the "scripts failed" banner.
  test('a calculator page shows the banner and nothing throws', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.route('**/js/bootstrap-access.js*', (route) => route.abort());
    await page.goto('/flight');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#pfg-scripts-failed')).toBeVisible();
    expect(
      errors.filter((e) => /is not defined/.test(e)),
      'no uncaught reference to the missing facade',
    ).toEqual([]);
  });
});
