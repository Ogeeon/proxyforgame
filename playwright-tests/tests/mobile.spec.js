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
  { name: 'moon calculator', url: '/ru/ogame/calc/moon.php',
    calculate: async (page) => {
      // A large fleet: the creation chance and the max counts beside every unit.
      await page.locator('#param-fleet-tab').click();
      await page.locator('#death-star').fill('123456');
      await page.locator('#death-star').blur();
    } },
  { name: 'terraformer calculator', url: '/ru/ogame/calc/terraformer.php',
    calculate: async (page) => {
      await page.locator('#solar-satellites-count').fill('12345');
      await page.locator('#solar-satellites-count').blur();
      await page.locator('#tf-level-to').fill('25');
      await page.locator('#tf-level-to').blur();
    } },
  { name: 'graviton calculator', url: '/ru/ogame/calc/graviton.php',
    calculate: async (page) => {
      await page.locator('#solar-satellites-count').fill('12345');
      await page.locator('#solar-satellites-count').blur();
    } },
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
  { name: 'flight calculator', url: '/ru/ogame/calc/flight.php',
    calculate: async (page) => {
      // A big fleet far away: the flight times table's longest durations and fuel.
      await page.locator('#large-cargo').fill('123456');
      await page.locator('#large-cargo').blur();
      await page.locator('#destination-g').fill('5');
      await page.locator('#destination-g').blur();
    } },
  { name: 'LF costs calculator', url: '/ru/ogame/calc/lfcosts.php',
    calculate: async (page) => {
      // High levels of the first buildings: the cost table's widest numbers.
      const fields = page.locator('#table-0-1 input.level-input:visible');
      for (let i = 0; i < 3; i++) {
        await fields.nth(i).fill('60');
        await fields.nth(i).blur();
      }
    } },
  { name: 'costs calculator', url: '/ru/ogame/calc/costs.php',
    calculate: async (page) => {
      // High levels of the first buildings: the cost table's widest numbers.
      const fields = page.locator('#table-0-2 input.level-input:visible');
      for (let i = 0; i < 3; i++) {
        await fields.nth(i).fill('45');
        await fields.nth(i).blur();
      }
    } },
];

/**
 * Screen widths to check: a small phone, a big one, phones held sideways and a
 * small tablet. Breakpoint layouts break between breakpoints - flight's ship
 * grid once kept three ships abreast from 576px up while they needed some
 * 650px - so checking one phone width is not enough.
 */
const WIDTHS = [360, 480, 600, 720, 900];

/**
 * The layout width, the page's own width, every element other than a
 * `.pfg-scroll-x` wrapper that scrolls sideways, and every element sticking out
 * past the left edge of the screen. The last needs a check of its own: content
 * that overflows to the left (a centred box wider than its container) does not
 * widen the page, and nothing can scroll to it.
 * @param {import('@playwright/test').Page} page
 */
async function measure(page) {
  return page.evaluate(() => {
    const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`;
    const scrollers = [];
    const offLeft = [];
    for (const el of document.querySelectorAll('body *')) {
      // The closed sidebar menu waits off screen to the left by design.
      if (el.closest('.offcanvas')) continue;
      // A collapsed or visually-hidden element (1px wide) is neither something
      // to drag nor something to see.
      if (el.clientWidth <= 1) continue;
      // Inside a .pfg-scroll-x wrapper, content left of the edge is content the
      // wrapper has scrolled past (a click on a button in the last column scrolls
      // it), and scrolling back reaches it. The wrapper itself is still checked.
      if (el.getBoundingClientRect().left < -1 && !el.parentElement?.closest('.pfg-scroll-x')) {
        offLeft.push(`${describe(el)} left=${Math.round(el.getBoundingClientRect().left)}`);
      }
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      const overflow = getComputedStyle(el).overflowX;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      if (el.classList.contains('pfg-scroll-x')) continue;
      scrollers.push(`${describe(el)} ${el.clientWidth}/${el.scrollWidth}`);
    }
    return {
      layoutWidth: window.innerWidth,
      contentWidth: document.documentElement.scrollWidth,
      scrollers,
      offLeft: offLeft.slice(0, 10),
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} width the screen width the page was opened at
 * @param {string} state what the page was showing, for the failure message
 */
async function expectFits(page, width, state) {
  const m = await measure(page);
  expect(m.layoutWidth, `${state}: laid out at the device width (viewport meta tag)`).toBe(width);
  expect(m.contentWidth, `${state}: nothing wider than the screen`).toBeLessThanOrEqual(width);
  expect(m.scrollers, `${state}: only .pfg-scroll-x scrolls sideways`).toEqual([]);
  expect(m.offLeft, `${state}: nothing past the left edge of the screen`).toEqual([]);
}

/**
 * Open every visible tab and collapsible panel in turn, checking after each.
 * Two passes, because opening a panel can reveal tabs inside it.
 * @param {import('@playwright/test').Page} page
 * @param {number} width the screen width the page was opened at
 */
async function visitEveryToggle(page, width) {
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
      await expectFits(page, width, `after opening "${label}"`);
    }
  }
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    // isMobile makes Chromium honour the viewport meta tag as a phone does; a
    // desktop viewport ignores it, so the checks would pass without the tag.
    test.use({ viewport: { width, height: 740 }, isMobile: true, hasTouch: true });

    for (const { name, url, calculate } of PHONE_PAGES) {
      test(`the ${name} fits the screen`, async ({ page }) => {
        // Keep the changelog dialog from opening on top of the page.
        await page.addInitScript(() => {
          localStorage.setItem('lastChange', JSON.stringify({ value: 99999 }));
        });
        await page.goto(url);
        await expectFits(page, width, 'first screen');
        if (calculate) {
          await calculate(page);
          await page.waitForTimeout(300);
          await expectFits(page, width, 'with results');
        }
        await visitEveryToggle(page, width);
      });
    }
  });
}
