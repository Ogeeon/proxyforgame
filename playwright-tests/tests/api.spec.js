import { test, expect } from './base';

// The HTTP contract of /ajax.php, checked from outside the browser: a status
// code, and either the bare resource or {"error":{"code","message"}}.
//
// Only the paths that cost nothing to exercise are here. Two are deliberately
// missing: the successful report and email, which really do hand a message to
// the SMTP server and land in the site owner's mailbox, and the successful
// serverdata and ogameAPI, whose request leaves from the *server* - page.route
// cannot reach it, so the test would depend on Gameforge being up.

const ENDPOINT = '/ajax.php';

/**
 * Asserts the answer is the documented failure and nothing else - a 500 with a
 * PHP notice in it would otherwise satisfy a bare status check.
 * @param {import('@playwright/test').APIResponse} response
 * @param {number} status
 * @param {string} code
 */
async function expectApiError(response, status, code) {
    expect(response.status()).toBe(status);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(body.error.code).toBe(code);
    // English prose for the log; the client never shows it, but an empty one
    // would leave a failure unexplainable from the server side.
    expect(body.error.message.length).toBeGreaterThan(0);
}

test.describe('AJAX endpoint - dispatcher', () => {
    test('a request naming no service is rejected', async ({ request }) => {
        await expectApiError(await request.get(ENDPOINT), 400, 'missing_service');
    });

    test('an empty service name counts as none at all', async ({ request }) => {
        await expectApiError(await request.get(`${ENDPOINT}?service=`), 400, 'missing_service');
    });

    test('an unknown service is a 404, not a 400', async ({ request }) => {
        await expectApiError(await request.get(`${ENDPOINT}?service=nope`), 404, 'unknown_service');
    });

    // The two services with a side effect take POST only, which is what stops a
    // plain <img src="/ajax.php?service=report&..."> on someone else's page from
    // sending mail in a visitor's name.
    for (const service of ['report', 'email']) {
        test(`${service} refuses GET and says what it accepts`, async ({ request }) => {
            const response = await request.get(`${ENDPOINT}?service=${service}`);
            await expectApiError(response, 405, 'method_not_allowed');
            expect(response.headers()['allow']).toBe('POST');
        });
    }

    // A read has no side effect to protect, but the method is still pinned, so
    // that one service cannot be reached two ways.
    test('a read-only service refuses POST', async ({ request }) => {
        const response = await request.post(ENDPOINT, { form: { service: 'changelog' } });
        await expectApiError(response, 405, 'method_not_allowed');
        expect(response.headers()['allow']).toBe('GET');
    });
});

test.describe('AJAX endpoint - report', () => {
    test('a request without the two texts is a 400', async ({ request }) => {
        const response = await request.post(ENDPOINT, { form: { service: 'report' } });
        await expectApiError(response, 400, 'missing_params');
    });

    // Four ways of filling the form wrong, four codes: the dialog explains each
    // one differently, so they must stay apart on the wire too.
    const rejected = [
        { wrong: '', right: '', code: 'both_empty' },
        { wrong: 'Elektromagnetische', right: 'Elektromagnetische', code: 'texts_equal' },
        { wrong: '', right: 'Elektromagnetische', code: 'wrong_empty' },
        { wrong: 'Elektromagnetishe', right: '', code: 'right_empty' },
    ];
    for (const { wrong, right, code } of rejected) {
        test(`wrong="${wrong}" right="${right}" is rejected as ${code}`, async ({ request }) => {
            const response = await request.post(ENDPOINT, {
                form: { service: 'report', wrong, right, url: '/ogame/calc/flight.php' },
            });
            await expectApiError(response, 422, code);
        });
    }
});

test.describe('AJAX endpoint - email', () => {
    test('a request without subject and body is a 400', async ({ request }) => {
        const response = await request.post(ENDPOINT, { form: { service: 'email' } });
        await expectApiError(response, 400, 'missing_params');
    });

    test('an empty subject and an empty body leave nothing to send', async ({ request }) => {
        const response = await request.post(ENDPOINT, {
            form: { service: 'email', subject: '', body: '', address: 'nobody@example.com' },
        });
        await expectApiError(response, 422, 'nothing_to_send');
    });
});

test.describe('AJAX endpoint - changelog', () => {
    test('a locale the site does not have is a bad request', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=changelog&lastSeen=0&lang=xx`);
        await expectApiError(response, 400, 'bad_request');
    });

    test('a missing lastSeen is a bad request', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=changelog&lang=en`);
        await expectApiError(response, 400, 'bad_request');
    });

    test('a lastSeen that is not a number is a bad request', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=changelog&lastSeen=soon&lang=en`);
        await expectApiError(response, 400, 'bad_request');
    });

    test('a valid request answers with the entries as a bare array', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=changelog&lastSeen=0&lang=ru`);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
        expect(body[0]).toHaveProperty('ts');
        expect(body[0]).toHaveProperty('description');
    });

    // Having seen everything is the normal case, not an error: the sidebar asks
    // on every page load and expects an empty list back.
    test('nothing newer than lastSeen is an empty array, not a 404', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=changelog&lastSeen=999999&lang=ru`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual([]);
    });
});

test.describe('AJAX endpoint - populatedSystems', () => {
    test('a universe with no row of its own is a 404', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=populatedSystems&country=zz&universe=999`);
        await expectApiError(response, 404, 'not_found');
    });

    test('a universe that is not a number is rejected before the query', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=populatedSystems&country=en&universe=abc`);
        await expectApiError(response, 400, 'bad_params');
    });

    test('a country outside the safe alphabet is rejected', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=populatedSystems&country=en.evil.test&universe=1`);
        await expectApiError(response, 400, 'bad_params');
    });
});

test.describe('AJAX endpoint - serverdata', () => {
    // The country is spliced into the URL of an outgoing request, so a value
    // outside [a-z]{2,3} must never reach the fetch.
    for (const country of ['123', 'e', 'engl', 'en.evil.test']) {
        test(`country=${country} is refused before anything is fetched`, async ({ request }) => {
            const response = await request.get(`${ENDPOINT}?service=serverdata&country=${encodeURIComponent(country)}&universe=1`);
            await expectApiError(response, 400, 'bad_params');
        });
    }

    test('a missing universe is a bad request', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=serverdata&country=en`);
        await expectApiError(response, 400, 'bad_params');
    });
});

test.describe('AJAX endpoint - ogameAPI', () => {
    test('a missing code is a 400', async ({ request }) => {
        await expectApiError(await request.get(`${ENDPOINT}?service=ogameAPI`), 400, 'missing_params');
    });

    test('an empty code never reaches Logserver', async ({ request }) => {
        await expectApiError(await request.get(`${ENDPOINT}?service=ogameAPI&code=`), 400, 'missing_params');
    });
});

test.describe('AJAX endpoint - health', () => {
    // The shape matters more than the values here: this is what the watchdog
    // workflow parses from outside, and it has no way to complain about a
    // field that quietly changed name.
    test('reports the time, the PHP version, the deployed commit, the receiver digest and the jobs', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=health`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/json');

        const body = await response.json();
        expect(Number.isNaN(Date.parse(body.time))).toBe(false);
        // major.minor of the PHP that answered - the watchdog compares this to
        // .php-version to catch a host that drifted off the pinned version.
        expect(/^\d+\.\d+$/.test(body.php)).toBe(true);
        // Null is the honest answer where there is no readable checkout; a
        // string is only ever a full SHA.
        expect(body.commit === null || /^[0-9a-f]{40}$/.test(body.commit)).toBe(true);
        // sha256 of the installed GitHub receiver, or null where none is
        // configured - which is every host but production, this run included.
        // Never the file itself, and never anything but a digest.
        expect(body.webhook === null || /^[0-9a-f]{64}$/.test(body.webhook)).toBe(true);
        // An object, never an array - the watchdog indexes it by job name, and
        // an empty [] would break that without breaking any status code.
        expect(Array.isArray(body.jobs)).toBe(false);
        expect(typeof body.jobs).toBe('object');
        expect(body.jobs).not.toBeNull();
    });

    // It reads no database, so it must keep answering when the database is the
    // thing that broke. Nothing here can take MySQL away, but the contract is
    // worth pinning: no query means no chance of a 500 from one.
    test('answers without asking the database', async ({ request }) => {
        const response = await request.get(`${ENDPOINT}?service=health`);
        expect(response.status()).toBe(200);
    });

    test('refuses POST and says what it accepts', async ({ request }) => {
        const response = await request.post(ENDPOINT, { form: { service: 'health' } });
        await expectApiError(response, 405, 'method_not_allowed');
        expect(response.headers()['allow']).toBe('GET');
    });
});
