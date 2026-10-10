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
