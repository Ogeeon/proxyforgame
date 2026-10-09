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
