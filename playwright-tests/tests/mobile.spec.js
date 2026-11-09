import { test, expect } from './base';

/**
 * Pages that are laid out for a phone. Each one sets
 * <meta name="viewport" content="width=device-width, initial-scale=1">, without
 * which a phone lays the page out 980px wide and zooms it out until the text is
 * too small to read. A page joins this list once it both sets the tag and fits a
 * 360px screen without scrolling sideways: the tag alone, on a page wider than
 * the screen, only trades the zoomed-out page for a horizontal scrollbar.
 */
const PHONE_PAGES = [
  ['start page', '/ru/'],
  ['AI assistants page', '/ru/mcp'],
  ['privacy policy', '/policy.php'],
  ['trade calculator', '/ru/ogame/calc/trade.php'],
];

// isMobile makes Chromium honour the viewport meta tag as a phone does; a
// desktop viewport ignores it, so the check below would pass without the tag.
test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

for (const [name, url] of PHONE_PAGES) {
  test(`the ${name} fits a phone screen`, async ({ page }) => {
    await page.goto(url);
    const { layoutWidth, contentWidth } = await page.evaluate(() => ({
      layoutWidth: window.innerWidth,
      contentWidth: document.documentElement.scrollWidth,
    }));
    expect(layoutWidth, 'laid out at the device width (viewport meta tag)').toBe(360);
    expect(contentWidth, 'nothing wider than the screen').toBeLessThanOrEqual(360);
  });
}
