// Arrow-key stepping in numeric text fields (docs/plans/arrow-key-stepping.md).
// The arithmetic is pinned in unit-tests/utils-stepping.test.js; this spec
// covers the wiring: the document-level keydown listener in www/js/utils.js,
// the written-back value, the _constrains each page attaches, and the synthetic
// keyup/input events the existing recalc handlers listen to. The lfcosts case
// sits on the research table whose `input` listener is delegated on the table
// (lfcosts-orchestration.js), which is what the dispatched event's
// `bubbles: true` is for.

import { test, expect } from './base';

// Suppress the changelog popup and any persisted parameters, so every field
// starts from the template defaults.
async function openCalculator(context, page, path, storageKey) {
    await context.addInitScript(([key]) => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
        localStorage.removeItem(key);
    }, [storageKey]);
    await page.goto(path);
}

test.describe('Arrow-key stepping - terraformer', () => {
    test.beforeEach(async ({ context, page }) => {
        await openCalculator(context, page, '/terraformer', 'options_terraformer');
    });

    test('ArrowUp/ArrowDown step an integer level by 1', async ({ page }) => {
        const level = page.locator('#tf-level-to'); // { min: 1, max: 100, def: 1 }
        await expect(level).toHaveValue('1');
        await level.focus();
        await page.keyboard.press('ArrowUp');
        await expect(level).toHaveValue('2');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown'); // past the min: clamped, not wrapped
        await expect(level).toHaveValue('1');
    });

    test('the synthetic events drive the page recalculation', async ({ page }) => {
        // The recalc hangs on the field's keyup and on blur; stepping fires the
        // keyup, so the result updates without the field ever losing focus.
        const level = page.locator('#tf-level-to');
        await level.focus();
        await page.keyboard.press('ArrowUp'); // to level 2
        await expect(page.locator('#energy-needed')).toHaveText('2,000');
    });

    test('Shift multiplies the step by 10', async ({ page }) => {
        const level = page.locator('#tf-level-to');
        await level.focus();
        await page.keyboard.press('Shift+ArrowUp'); // 1 + 10
        await expect(level).toHaveValue('11');
    });

    test('Ctrl multiplies the step by 100 and clamps the jump at max', async ({ page }) => {
        // The LF cost-reduction field: fractional, max 50. (Not tf-level-to's
        // max of 100 - recalculation at level 100 hangs in
        // satellitesForEnergy, a pre-existing bug on main, unrelated here.)
        await page.locator('#param-lifeforms-tab').click();
        const rdc = page.locator('#lf-terraformer-rdc');
        await rdc.fill('45');
        await page.keyboard.press('Control+ArrowUp'); // 45 + 0.1x100 = 55 -> max 50
        await expect(rdc).toHaveValue('50');
    });

    test('ArrowUp steps a float field by 0.1', async ({ page }) => {
        // The LF cargo-capacity bonus is a fractional percent field, on the
        // LifeForms tab.
        await page.locator('#param-lifeforms-tab').click();
        const bonus = page.locator('#sc-capacity-increase');
        await expect(bonus).toHaveValue('0');
        await bonus.focus();
        await page.keyboard.press('ArrowUp');
        await expect(bonus).toHaveValue('0.1');
        await page.keyboard.press('ArrowDown');
        await expect(bonus).toHaveValue('0');
    });

    test('stepping does not scroll the page', async ({ page }) => {
        const level = page.locator('#tf-level-to');
        await level.fill('5'); // leaves the focus in the field, as a player's would be
        // The site's CSS smooth-scrolls; ask for an instant one so the baseline
        // is a settled position, and keep pressing arrows off the body - they
        // must not move the page while a field holds the focus.
        await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
        expect(await page.evaluate(() => window.scrollY)).toBe(300);
        await page.keyboard.press('ArrowUp');
        await expect(level).toHaveValue('6');
        expect(await page.evaluate(() => window.scrollY)).toBe(300);
        await page.keyboard.press('ArrowDown');
        await expect(level).toHaveValue('5');
        expect(await page.evaluate(() => window.scrollY)).toBe(300);
    });
});

test.describe('Arrow-key stepping - lfcosts research table', () => {
    test.beforeEach(async ({ context, page }) => {
        await openCalculator(context, page, '/lfcosts', 'options_lfcosts');
    });

    test('ArrowUp steps a research row through the table-delegated input listener', async ({ page }) => {
        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-2').click();
        await page.locator('#research-select-0').selectOption({ index: 0 });
        await page.locator('#research-add-btn-0').click();

        const level = page.locator('#table-0-2 tr:nth-child(2) td:nth-child(3) input');
        await expect(level).toHaveValue('0');
        await level.focus();
        await page.keyboard.press('ArrowUp');
        await expect(level).toHaveValue('1');
        // The bubbled synthetic `input` reached the listener the table carries:
        // the row's metal cost cell is filled, not the initial 0.
        await expect(page.locator('#table-0-2 tr:nth-child(2) td:nth-child(4)')).not.toHaveText('0');
    });
});
