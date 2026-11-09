import { test, expect } from './base';

// Calculator addresses: /<lang>/<calc> is the one canonical URL, every other
// spelling redirects to it (www/routes.inc.php, www/.htaccess and, under the
// built-in server, scripts/dev-router.php).

const CALCULATORS = ['costs', 'expeditions', 'flight', 'graviton', 'lfcosts',
    'moon', 'production', 'queue', 'terraformer', 'trade'];

/** The status and Location of one request, redirects not followed. */
async function head(request, path, headers = {}) {
    const response = await request.get(path, { maxRedirects: 0, headers });
    return { status: response.status(), location: response.headers()['location'] ?? null };
}

test.describe('Calculator routes', () => {
    for (const calc of CALCULATORS) {
        test(`/ru/${calc} serves the calculator`, async ({ request }) => {
            const response = await request.get(`/ru/${calc}`, { maxRedirects: 0 });
            expect(response.status()).toBe(200);
            expect(await response.text()).toContain('<html lang="ru"');
        });
    }

    test('the old .php path redirects permanently, keeping prefix and query', async ({ request }) => {
        expect(await head(request, '/ru/ogame/calc/flight.php?SR_KEY=abc'))
            .toEqual({ status: 301, location: '/ru/flight?SR_KEY=abc' });
    });

    test('a trailing slash redirects to the address without it', async ({ request }) => {
        expect(await head(request, '/de/costs/')).toEqual({ status: 301, location: '/de/costs' });
    });

    test('an upper-case language prefix redirects to the lower-case one', async ({ request }) => {
        expect(await head(request, '/RU/queue')).toEqual({ status: 301, location: '/ru/queue' });
    });

    test('no language prefix redirects temporarily to the Accept-Language one', async ({ request }) => {
        const headers = { 'Accept-Language': 'de-DE,de;q=0.9' };
        expect(await head(request, '/trade', headers)).toEqual({ status: 302, location: '/de/trade' });
        expect(await head(request, '/ogame/calc/moon.php?a=1', headers))
            .toEqual({ status: 302, location: '/de/moon?a=1' });
    });

    test('the sidebar and the language menu link to the short addresses', async ({ page }) => {
        await page.goto('/ru/costs');
        await expect(page.locator('a.ogame-menu-item[href="/ru/flight"]').first()).toBeAttached();
        await expect(page.locator('a.ogame-menu-item[href="/ru/costs"]')).toHaveCount(0);
        await expect(page.locator('a.lang-menu-item[href="/de/costs"]')).toBeAttached();
    });
});

// The page about the MCP server. Its controller is assistants.php, not mcp.php:
// a bare /mcp is the server itself on the live site (PFG_PAGES in routes.inc.php).
test.describe('The AI assistants page', () => {
    test('/ru/mcp serves it, with the server address', async ({ request }) => {
        const response = await request.get('/ru/mcp', { maxRedirects: 0 });
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain('<html lang="ru"');
        expect(html).toContain('value="https://proxyforgame.com/mcp"');
    });

    test('a trailing slash redirects to the address without it', async ({ request }) => {
        expect(await head(request, '/de/mcp/')).toEqual({ status: 301, location: '/de/mcp' });
    });

    test('the controller path redirects temporarily to the Accept-Language address', async ({ request }) => {
        // Where the MCP server sends a browser that opens its address.
        const headers = { 'Accept-Language': 'de-DE,de;q=0.9' };
        expect(await head(request, '/assistants.php', headers)).toEqual({ status: 302, location: '/de/mcp' });
    });

    test('the sidebar links to it in both layouts, and marks it on the page itself', async ({ page }) => {
        await page.goto('/ru/costs');
        await expect(page.locator('a.ai-menu-item[href="/ru/mcp"]')).toHaveCount(2);

        await page.goto('/ru/mcp');
        await expect(page.locator('a.ai-menu-item')).toHaveCount(0);
        await expect(page.locator('.ai-menu-item.active')).toHaveCount(2);
        await expect(page.locator('a.lang-menu-item[href="/de/mcp"]')).toBeAttached();
    });

    // The real clipboard exists only in a secure context, which http://pfg.wmp is
    // not, so these tests stand in fakes: what they check is the page's code.
    test('the copy button puts the address on the clipboard', async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: async (text) => { /** @type {any} */ (window).copiedText = text; } },
            });
        });
        await page.goto('/en/mcp');
        const button = page.locator('#mcp-address-copy');
        await button.click();
        await expect(button).toContainText('Copied');
        expect(await page.evaluate(() => /** @type {any} */ (window).copiedText)).toBe('https://proxyforgame.com/mcp');
    });

    /**
     * Stands in the clipboard of an insecure origin (none) or a refusing one, and
     * an execCommand('copy') that records the selection it copied, or fails.
     * @param {import('@playwright/test').Page} page
     * @param {{clipboard: 'none'|'refuses', execCommandWorks: boolean}} setup
     */
    async function fakeCopy(page, setup) {
        await page.addInitScript((s) => {
            const w = /** @type {any} */ (window);
            Object.defineProperty(navigator, 'clipboard', {
                value: s.clipboard === 'none' ? undefined : { writeText: async () => { throw new Error('denied'); } },
            });
            document.execCommand = (command) => {
                const input = /** @type {HTMLInputElement} */ (document.activeElement);
                w.copiedText = s.execCommandWorks && command === 'copy'
                    ? input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)
                    : undefined;
                return s.execCommandWorks;
            };
        }, setup);
    }

    for (const clipboard of /** @type {const} */ (['none', 'refuses'])) {
        test(`without the Clipboard API (${clipboard}) the button still copies the address`, async ({ page }) => {
            await fakeCopy(page, { clipboard, execCommandWorks: true });
            await page.goto('/en/mcp');
            const button = page.locator('#mcp-address-copy');
            await button.click();
            await expect(button).toContainText('Copied');
            expect(await page.evaluate(() => /** @type {any} */ (window).copiedText)).toBe('https://proxyforgame.com/mcp');
        });
    }

    test('where no copy works, the address is left selected for copying by hand', async ({ page }) => {
        await fakeCopy(page, { clipboard: 'none', execCommandWorks: false });
        await page.goto('/en/mcp');
        const button = page.locator('#mcp-address-copy');
        await button.click();
        await expect.poll(() => page.evaluate(() => {
            const input = /** @type {HTMLInputElement} */ (document.getElementById('mcp-address'));
            return document.activeElement === input && input.selectionEnd - input.selectionStart === input.value.length;
        })).toBe(true);
        await expect(button).not.toContainText('Copied');
    });
});
