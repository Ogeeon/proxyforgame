import { test, expect } from './base';

/**
 * Pages that are laid out for a phone. Each one sets
 * <meta name="viewport" content="width=device-width, initial-scale=1">, without
 * which a phone lays the page out 980px wide and zooms it out until the text is
 * too small to read. A page joins this list once it both sets the tag and fits a
 * 360px screen without scrolling sideways: the tag alone, on a page wider than
 * the screen, only trades the zoomed-out page for a horizontal scrollbar.
 *
 * "Fits" is checked in every state a player can reach without typing much: the
 * first screen, then each tab and each collapsible panel opened in turn, then -
 * where the entry has a `calculate` step - the page with results in it, since a
 * result table filled with numbers is wider than an empty one.
 *
 * Inside the page, only a `.pfg-scroll-x` wrapper may scroll sideways (a wide
 * table on a narrow screen; docs/patterns.md, "Phone layout"). Any other element
 * that scrolls horizontally - typically a whole calculator whose root has
 * overflow-x: auto - fails the check, because the player would then drag the
 * tabs, the settings and the title off the screen along with the table.
 *
 * @type {Array<{name: string, url: string, calculate?: (page: import('@playwright/test').Page) => Promise<void>}>}
 */
const PHONE_PAGES = [
  { name: 'start page', url: '/ru/' },
  { name: 'AI assistants page', url: '/ru/mcp' },
  { name: 'privacy policy', url: '/policy.php' },
  { name: 'trade calculator', url: '/ru/ogame/calc/trade.php',
    calculate: async (page) => {
      // Sell metal for a crystal + deuterium mix: the widest result there is.
      await page.locator('#res-src-0').click();
      await page.locator('#res-src-m').fill('123456789');
      await page.locator('#res-src-m').blur();
      await page.locator('#res-dst-2').click();
    } },
  { name: 'queue calculator', url: '/ru/ogame/calc/queue.php',
    calculate: async (page) => {
      // A few queued levels fill the queue table with rows and their buttons.
      for (let i = 0; i < 3; i++) await page.locator('#build-2-1').click();
      await page.locator('#build-2-2').click();
    } },
  { name: 'expeditions calculator', url: '/ru/ogame/calc/expeditions.php',
    calculate: async (page) => {
      await page.locator('#numSC').fill('1234567');
      await page.locator('#numSC').blur();
      await page.locator('#numLC').fill('123456');
      await page.locator('#numLC').blur();
    } },
  { name: 'production calculator', url: '/ru/ogame/calc/production.php',
    calculate: async (page) => {
      // Mines and a power plant at high levels: the production table's widest numbers.
      const table = page.locator('#one-planet-prod');
      for (const label of ['Рудник по добыче металла', 'Рудник по добыче кристалла', 'Солнечная электростанция']) {
        const field = table.getByLabel(`${label}-Ур/Кол-во`);
        await field.fill('45');
        await field.blur();
      }
    } },
];

const WIDTH = 360;

// isMobile makes Chromium honour the viewport meta tag as a phone does; a
// desktop viewport ignores it, so the check below would pass without the tag.
test.use({ viewport: { width: WIDTH, height: 740 }, isMobile: true, hasTouch: true });

/**
 * The layout width, the page's own width, and every element other than a
 * `.pfg-scroll-x` wrapper that scrolls sideways.
 * @param {import('@playwright/test').Page} page
 */
async function measure(page) {
  return page.evaluate(() => {
    const scrollers = [];
    for (const el of document.querySelectorAll('body *')) {
      // A collapsed or visually-hidden element (1px wide) is not something to drag.
      if (el.clientWidth <= 1 || el.scrollWidth <= el.clientWidth + 1) continue;
      const overflow = getComputedStyle(el).overflowX;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      if (el.classList.contains('pfg-scroll-x')) continue;
      scrollers.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${el.clientWidth}/${el.scrollWidth}`);
    }
    return {
      layoutWidth: window.innerWidth,
      contentWidth: document.documentElement.scrollWidth,
      scrollers,
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} state what the page was showing, for the failure message
 */
async function expectFits(page, state) {
  const m = await measure(page);
  expect(m.layoutWidth, `${state}: laid out at the device width (viewport meta tag)`).toBe(WIDTH);
  expect(m.contentWidth, `${state}: nothing wider than the screen`).toBeLessThanOrEqual(WIDTH);
  expect(m.scrollers, `${state}: only .pfg-scroll-x scrolls sideways`).toEqual([]);
}

/**
 * Open every visible tab and collapsible panel in turn, checking after each.
 * Two passes, because opening a panel can reveal tabs inside it.
 * @param {import('@playwright/test').Page} page
 */
async function visitEveryToggle(page) {
  const selector = '[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="collapse"]';
  for (let pass = 0; pass < 2; pass++) {
    const toggles = page.locator(selector);
    const count = await toggles.count();
    for (let i = 0; i < count; i++) {
      const toggle = toggles.nth(i);
      if (!(await toggle.isVisible())) continue;
      const label = ((await toggle.textContent()) || '').trim().slice(0, 40)
        || (await toggle.getAttribute('data-bs-target')) || `toggle ${i}`;
      await toggle.click();
      // Tabs fade and panels slide; let the transition finish before measuring.
      await page.waitForTimeout(400);
      await expectFits(page, `after opening "${label}"`);
    }
  }
}

for (const { name, url, calculate } of PHONE_PAGES) {
  test(`the ${name} fits a phone screen`, async ({ page }) => {
    // Keep the changelog dialog from opening on top of the page.
    await page.addInitScript(() => {
      localStorage.setItem('lastChange', JSON.stringify({ value: 99999 }));
    });
    await page.goto(url);
    await expectFits(page, 'first screen');
    if (calculate) {
      await calculate(page);
      await page.waitForTimeout(300);
      await expectFits(page, 'with results');
    }
    await visitEveryToggle(page);
  });
}
