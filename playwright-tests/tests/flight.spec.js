import { test, expect } from './base';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Installs a thin compatibility layer on the page so the DOM-free maths tests can
 * keep calling the pre-Bootstrap globals (updateNumbers, getDistance, ...). Each
 * one now delegates to the migrated FlightCalculator / FlightDataCollector held
 * by window.flightOrchestrator, so the tests still exercise the real engine and
 * the real rendering — only the glue is recreated.
 */
async function installCompat(page) {
    await page.evaluate(() => {
        const orch = window.flightOrchestrator;
        const calc = orch.calc;
        const collector = orch.collector;

        const params = () => {
            const p = Object.assign({}, options.prm);
            const wb = document.getElementById('warrior-bonus');
            p.warriorBonus = !!(wb && wb.checked);
            p.populatedSystems = options.populatedSystems ?? null;
            p.populatedSystemsAll = options.populatedSystemsAll ?? null;
            p.emptySystemsOverrideEnabled = options.emptySystemsOverrideEnabled ?? false;
            p.emptySystemsOverride = options.emptySystemsOverride ?? 0;
            if (!Array.isArray(p.lfShipsBonuses) || p.lfShipsBonuses.length !== 15 || !Array.isArray(p.lfShipsBonuses[0])) {
                p.lfShipsBonuses = Array.from({ length: 15 }, () => [0, 0, 0]);
            }
            return p;
        };
        const ships = () => options.shipsData
            || calc.buildShipsData(options.prm.driveLevels || [0, 0, 0], options.prm.spCargohold || 0);

        window.updateNumbers = () => {
            orch.recalc();
            options.shipsData = calc.buildShipsData(options.prm.driveLevels, options.prm.spCargohold);
        };
        window.getDistance = (dep, dest) => {
            const r = calc.getDistance(dep, dest, params());
            window.getDistance.lastEmptyCount = r.emptySystems;
            return r.distance;
        };
        window.getFlightDuration = (s, d, p, u) => calc.getFlightDuration(s, d, p, u);
        window.getShipSpeed = (i) => calc.getShipSpeed(ships(), i, params());
        window.getMinSpeed = () => calc.getMinSpeed(ships(), collector.collectShipCounts(), params());
        window.getDeutConsumption = (minSpeed, distance, duration, pct, uni) =>
            calc.getDeutConsumption(ships(), collector.collectShipCounts(), distance, duration, uni, params());
        window.getCargoCapacity = (hyperTechLvl) => {
            const p = params();
            p.hyperTechLvl = hyperTechLvl;
            return calc.getCargoCapacity(ships(), collector.collectShipCounts(), p);
        };
        window.getSecondsFromTimeField = (t) => orch._legSeconds(t);
        window.compareSavePoints = (a, b) => calc.compareSavePoints(a, b);
        window.validateSPParams = () => orch._validateSavePointForm();

        if (!Object.getOwnPropertyDescriptor(options, 'isSpeedOvr')?.get) {
            Object.defineProperty(options, 'isSpeedOvr', { configurable: true, get: () => orch.speedOverride.enabled });
            Object.defineProperty(options, 'ovrSpeed', { configurable: true, get: () => orch.speedOverride.speed });
        }
    });
}

test.describe('Flight Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Flight/i);
    });

    test('calculator options are available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

});

// Fixture: spy report code fs003df9447df01744296d867509e0ae7e60
// Universe 1-en, coordinates 4:123:7, all fleet speeds x1
const SR_CODE = 'fs003df9447df01744296d867509e0ae7e60';
// What ajax.php hands the client: the report itself. The log server's
// {"RESULT_CODE":1000,"RESULT_DATA":{...}} envelope is checked and dropped
// server-side, so it never appears on this side of the wire.
const SR_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/sr_fs003df9447df01744296d867509e0ae7e60.json'),
    'utf-8'
);
const OGAME_API_ROUTE = /\/ajax\.php\?.*service=ogameAPI/;

test.describe('Flight Calculator - Spy Report Import', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });

        // Intercept the ogameAPI ajax call and return the pre-recorded fixture
        await page.route(OGAME_API_ROUTE, (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: SR_FIXTURE,
        }));

        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    test('imports spy report and populates form fields', async ({ page }) => {
        // The parameters panel is collapsed by default — open it first
        await openParams(page);
        await page.locator('#api-code').fill(SR_CODE);
        await page.locator('#api-get').click();

        // Wait for the loading overlay to disappear
        await page.waitForFunction(() => !document.querySelector('.panel-overlay'), { timeout: 5000 });

        // Universe and location from fixture (universe 1-en, coordinates 4:123:7)
        await expect(page.locator('#country')).toHaveValue('en');
        await expect(page.locator('#departure-g')).toHaveValue('4');
        await expect(page.locator('#departure-s')).toHaveValue('123');
        await expect(page.locator('#departure-p')).toHaveValue('7');

        // Fleet speed selects should reflect the fixture values (all x1)
        await expect(page.locator('#speed-fleet-war')).toHaveValue('1');
        await expect(page.locator('#speed-fleet-peaceful')).toHaveValue('1');
        await expect(page.locator('#speed-fleet-holding')).toHaveValue('1');
    });

    // The imported universe can be a ring along one axis only, so each donut
    // flag has to reach the checkbox of its own axis.
    test('imports each donut setting onto the checkbox of its own axis', async ({ page }) => {
        // Selecting the imported universe also asks the OGame API for its live
        // settings, and that answer would land on the same two checkboxes; keep
        // it away so only the import writes them.
        await page.route(/\/ajax\.php\?.*service=serverdata/, (route) => route.fulfill({ status: 503 }));

        // Routes registered later win, so this overrides the fixture route above
        await page.route(OGAME_API_ROUTE, (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: SR_FIXTURE.replace('donutGalaxy":"1"', 'donutGalaxy":"0"'),
        }));

        await openParams(page);
        await page.locator('#api-code').fill(SR_CODE);
        await page.locator('#api-get').click();
        await page.waitForFunction(() => !document.querySelector('.panel-overlay'), { timeout: 5000 });

        // The stubbed 503 raises a toast of its own, and a danger toast waits for
        // the user instead of fading — get it off the corner it shares with the
        // controls this test is about to click.
        await page.locator('.toast .btn-close').click();
        await expect(page.locator('.toast')).toHaveCount(0);

        await showParamTab(page, '#circular-galaxies');
        await expect(page.locator('#circular-galaxies')).not.toBeChecked();
        await expect(page.locator('#circular-systems')).toBeChecked();
    });

    test('shows an error when the server answer is not usable', async ({ page }) => {
        await openParams(page);
        const before = await page.locator('#departure-g').inputValue();

        // The first two are what ajax.php itself answers when neither source
        // could serve the report; the last two are what reaches the client when
        // something between it and ajax.php answers instead - a proxy page, a
        // gateway error, an upstream warning glued in front of the body.
        const badResponses = [
            { status: 502, body: JSON.stringify({ error: { code: 'sr_unusable', message: 'bad answer' } }) },
            { status: 404, body: JSON.stringify({ error: { code: 'sr_not_found', message: 'code not found' } }) },
            { status: 502, body: '<html><body>Bad Gateway</body></html>' },
            { status: 200, body: '<br /><b>Warning</b>: gzuncompress(): data error' },
        ];
        const dialog = page.locator('.dyn-dialog.show');
        for (const { status, body } of badResponses) {
            // Routes registered later win, so this overrides the fixture route above
            await page.route(OGAME_API_ROUTE, (route) => route.fulfill({ status, body }));

            await page.locator('#api-code').fill(SR_CODE);
            await page.locator('#api-get').click();

            // The overlay only clears once the dialog is dismissed - importSR()
            // awaits showAlertModal() before its `finally` runs - so the dialog
            // itself is what to wait for here, not the overlay.
            await expect(dialog, `alert shown for ${JSON.stringify(body)}`).toBeVisible();
            const alertMsg = await dialog.locator('.modal-body').innerText();
            expect(alertMsg.length, `alert shown for ${JSON.stringify(body)}`).toBeGreaterThan(0);
            await dialog.locator('.btn-primary').click();
            await expect(dialog).toHaveCount(0);

            await page.waitForFunction(() => !document.querySelector('.panel-overlay'), { timeout: 5000 });
            await expect(page.locator('#departure-g')).toHaveValue(before);
        }
    });
});

test.describe('Flight Calculator - Server data fetch', () => {
    // A universe answer takes a round trip to the OGame API, so the panel has to
    // say it is busy — the same overlay the spy report import puts up.
    const SERVER_DATA = JSON.stringify({
        speedFleetPeaceful: '1', speedFleetWar: '1', speedFleetHolding: '1',
        galaxies: '9', systems: '499', donutGalaxy: '1', donutSystem: '1',
        globalDeuteriumSaveFactor: '1', warriorBonusFuelConsumption: '0.25',
        probeCargo: '0', fleetIgnoreEmptySystems: '0',
    });

    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.route(/\/ajax\.php\?.*service=serverdata/, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await route.fulfill({ status: 200, contentType: 'application/json', body: SERVER_DATA });
        });
        await page.goto('/ogame/calc/flight.php');
    });

    test('covers the parameters panel while the universe data is on the wire', async ({ page }) => {
        await openParams(page, '#country');
        await page.locator('#country').selectOption('en');

        // The list is filled from the `unis` global; take whatever it offers first
        const universe = page.locator('#universe');
        await universe.selectOption({ index: 0 });

        await expect(page.locator('#general-settings-panel .panel-overlay')).toBeVisible();
        await expect(page.locator('.panel-overlay-content')).not.toBeEmpty();

        // ...and uncovers it once the answer lands
        await expect(page.locator('.panel-overlay')).toHaveCount(0, { timeout: 5000 });
        await expect(page.locator('#galaxies-num')).toHaveValue('9');
    });

    // A universe can be a ring along one axis and a straight line along the
    // other, so each donut flag has to reach the checkbox of its own axis.
    test('each donut setting lands on the checkbox of its own axis', async ({ page }) => {
        const ringedGalaxies = SERVER_DATA.replace('"donutSystem":"1"', '"donutSystem":"0"');
        await page.route(/\/ajax\.php\?.*service=serverdata/, async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: ringedGalaxies });
        });

        await openParams(page, '#country');
        await page.locator('#country').selectOption('en');
        await page.locator('#universe').selectOption({ index: 0 });
        await expect(page.locator('.panel-overlay')).toHaveCount(0, { timeout: 5000 });

        await showParamTab(page, '#circular-galaxies');
        await expect(page.locator('#circular-galaxies')).toBeChecked();
        await expect(page.locator('#circular-systems')).not.toBeChecked();
    });

    // Nobody asked for this request, so it cannot answer with an alert - but
    // staying silent would leave the panel showing its defaults as if they had
    // been loaded, and every figure computed from them would be wrong.
    test('reports a failed universe fetch in a dismissible toast', async ({ page }) => {
        await page.route(/\/ajax\.php\?.*service=serverdata/, (route) => route.fulfill({
            status: 502,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'upstream_unavailable', message: 'no answer' } }),
        }));

        await openParams(page, '#country');
        await page.locator('#country').selectOption('en');
        await page.locator('#universe').selectOption({ index: 0 });

        const toast = page.locator('.toast');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/text-bg-danger/);
        await expect(toast.locator('.toast-body')).not.toBeEmpty();

        await toast.locator('.btn-close').click();
        await expect(toast).toHaveCount(0);
    });

    // The populated-systems map only degrades the flight - the fleet is then
    // charged for every system it passes - so it warns rather than alarms.
    test('warns at a lower level when only the populated systems are missing', async ({ page }) => {
        const skippingUniverse = SERVER_DATA.replace('"fleetIgnoreEmptySystems":"0"', '"fleetIgnoreEmptySystems":"1"');
        await page.route(/\/ajax\.php\?.*service=serverdata/, (route) => route.fulfill({
            status: 200, contentType: 'application/json', body: skippingUniverse,
        }));
        await page.route(/\/ajax\.php\?.*service=populatedSystems/, (route) => route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'not_found', message: 'no such universe' } }),
        }));

        await openParams(page, '#country');
        await page.locator('#country').selectOption('en');
        await page.locator('#universe').selectOption({ index: 0 });

        const toast = page.locator('.toast');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/text-bg-warning/);
    });
});

// Fixture: object exported from the OGame client (API 2 field on the 'Fleet' page).
// Coordinates 5:254:14, discoverer class, trader alliance, drives 14/10/8, hypertech 9,
// fleetspeed x10 (universe data, intentionally ignored on import).
const OWN_API_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/own_api.json'),
    'utf-8'
);

const OWN_API_IMPORT_BUTTON = '#own-api-read-btn';

test.describe('Flight Calculator - OGame Object Import', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        // The parameters panel is collapsed by default — open it first
        await openParams(page);
    });

    test('imports own_api.json and populates form fields', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));

        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        await page.locator('#own-api-input').fill(OWN_API_FIXTURE);
        await page.locator(OWN_API_IMPORT_BUTTON).click(); // "Import" button

        // Departure coordinates
        await expect(page.locator('#departure-g')).toHaveValue('5');
        await expect(page.locator('#departure-s')).toHaveValue('254');
        await expect(page.locator('#departure-p')).toHaveValue('14');

        // Drive technologies (researches 115/117/118 + hyperspace tech 114)
        await expect(page.locator('#cmb-drive')).toHaveValue('14');
        await expect(page.locator('#imp-drive')).toHaveValue('10');
        await expect(page.locator('#hyp-drive')).toHaveValue('8');
        await expect(page.locator('#hypertech-lvl')).toHaveValue('9');

        // characterClassId 3 -> discoverer -> class-2; allianceClassId 2 -> trader bonus
        await expect(page.locator('#class-2')).toBeChecked();
        await expect(page.locator('#trader-bonus')).toBeChecked();

        // Ship counts (defense ids 401-408 and 212/217 in the object are ignored)
        await expect(page.locator('#small-cargo')).toHaveValue('8855');
        await expect(page.locator('#large-cargo')).toHaveValue('3741');
        await expect(page.locator('#light-fighter')).toHaveValue('407');
        await expect(page.locator('#battleship')).toHaveValue('116');
        await expect(page.locator('#esp-probe')).toHaveValue('9994');
        await expect(page.locator('#pathfinder')).toHaveValue('106');

        // Universe data (fleetspeed etc.) from the API 2 export is intentionally ignored,
        // so the fleet speed select keeps its default value despite fleetspeed x10 in the fixture.
        await expect(page.locator('#speed-fleet-war')).toHaveValue('1');

        // Per-ship LF bonus for light fighter (204): speed 0.003066 -> 0.3066(%)
        const lfSpeed = await page.locator('[class~="204-speed"]').inputValue();
        expect(parseFloat(lfSpeed.replace(',', '.'))).toBeCloseTo(0.3066, 3);

        // Dialog closes on successful import
        await expect(page.locator('#own-api-reader')).toBeHidden();
        expect(errors, 'no page JS errors').toEqual([]);
    });

    test('unchecking an import category leaves its fields untouched', async ({ page }) => {
        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        await page.locator('#own-api-import-coords').uncheck();
        await page.locator('#own-api-import-ships').uncheck();

        const beforeCoord = await page.locator('#departure-g').inputValue();
        const beforeShip = await page.locator('#small-cargo').inputValue();

        await page.locator('#own-api-input').fill(OWN_API_FIXTURE);
        await page.locator(OWN_API_IMPORT_BUTTON).click();

        // Unchecked categories: fields keep their pre-import value
        await expect(page.locator('#departure-g')).toHaveValue(beforeCoord);
        await expect(page.locator('#small-cargo')).toHaveValue(beforeShip);

        // Categories left checked still import normally
        await expect(page.locator('#cmb-drive')).toHaveValue('14');
        await expect(page.locator('#class-2')).toBeChecked();

        await expect(page.locator('#own-api-reader')).toBeHidden();
    });

    test('invalid input shows an error and does not change fields', async ({ page }) => {
        const before = await page.locator('#departure-g').inputValue();

        // Invalid input keeps the dialog open, so open it once and try both values inside it.
        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        const dialog = page.locator('.dyn-dialog.show');
        // Malformed JSON, and a bare primitive that JSON.parse would otherwise accept ("111" -> 111).
        for (const bad of ['{not valid json', '111']) {
            await page.locator('#own-api-input').fill(bad);
            await page.locator(OWN_API_IMPORT_BUTTON).click();

            await expect(dialog, `alert shown for input ${JSON.stringify(bad)}`).toBeVisible();
            const alertMsg = await dialog.locator('.modal-body').innerText();
            expect(alertMsg.length, `alert shown for input ${JSON.stringify(bad)}`).toBeGreaterThan(0);
            await dialog.locator('.btn-primary').click();
            await expect(dialog).toHaveCount(0);
            await expect(page.locator('#departure-g')).toHaveValue(before);
            await expect(page.locator('#own-api-reader')).toBeVisible(); // stays open on error
        }
    });
});

// ---------------------------------------------------------------------------
// Block 1. Ship speeds, fuel and cargo.
//
// The formulas live in unit-tests/flight-core.test.js. What stays here drives the
// real form so the form-to-params wiring is covered: the alliance checkboxes, the
// life-form bonus table, the class radio, and the drive / hyperspace-tech fields.
// ---------------------------------------------------------------------------

// Indices into options.shipsData, mirrored by updateNumbers()
const SHIP = {
    smallCargo: 0, largeCargo: 1, lightFighter: 2, heavyFighter: 3, cruiser: 4,
    battleship: 5, colonyShip: 6, recycler: 7, espProbe: 8, bomber: 9,
    destroyer: 10, deathStar: 11, battlecruiser: 12, reaper: 13, pathfinder: 14,
};

// #params-accordion holds two Bootstrap accordion sections — parameters and
// ships — and only one stays expanded, so tests open the one they need.
/**
 * Expands a Bootstrap accordion section unless its probe element is visible.
 * Drives Bootstrap's Collapse API and waits for shown.bs.collapse so the panel
 * is fully open (height:auto) before the caller interacts — a plain click would
 * return mid-animation, leaving lower controls overlapped by the next header.
 */
async function openCollapse(page, target, probe) {
    if (!await page.locator(probe).isVisible()) {
        await page.evaluate((t) => new Promise((resolve) => {
            const el = document.querySelector(t);
            el.addEventListener('shown.bs.collapse', resolve, { once: true });
            bootstrap.Collapse.getOrCreateInstance(el).show();
        }), target);
    }
    await expect(page.locator(probe)).toBeVisible();
}

/**
 * Activates the #paramTabs pane that holds `probe`. The three panes hide each
 * other, so a control is only actionable once its own tab is on top.
 */
async function showParamTab(page, probe) {
    await page.evaluate((sel) => {
        const pane = document.querySelector(sel).closest('.tab-pane');
        const btn = document.querySelector(`#paramTabs [data-bs-target="#${pane.id}"]`);
        bootstrap.Tab.getOrCreateInstance(btn).show();
    }, probe);
    await expect(page.locator(probe)).toBeVisible();
}

/**
 * Expands the parameters section and brings the tab owning `probe` to the front.
 * The collapse itself is probed through #universe-name-select, which sits above
 * the tab strip and is therefore visible whichever tab is active — probing a
 * tabbed control instead would ask Bootstrap to re-show an already open panel,
 * and shown.bs.collapse would never fire.
 */
async function openParams(page, probe = '#cmb-drive') {
    await openCollapse(page, '#accordion-prm', '#universe-name-select');
    await showParamTab(page, probe);
}

const openShips = (page) => openCollapse(page, '#accordion-ships', '#light-fighter');

/** Opens the life-form tab, which carries the per-ship bonus table. */
const openLfBonuses = (page) => openParams(page, '[class~="202-speed"]');

/** Activates the flight-times tab, which the tab strip may have left hidden. */
async function openFlightTimesTab(page) {
    await page.locator('#tabtag1').click();
    await expect(page.locator('#warrior-bonus')).toBeVisible();
}

// The ship-speed formula - every drive, class, alliance and life form combination -
// is covered in unit-tests/flight-core.test.js. What stays here needs the real form:
// the mutually-exclusive alliance checkboxes and the life-form bonus table.
test.describe('Flight Calculator - Ship Speeds', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await openFlightTimesTab(page);
    });

    test('warrior and trader bonuses are mutually exclusive', async ({ page }) => {
        await page.locator('#warrior-bonus').check();
        await expect(page.locator('#warrior-bonus')).toBeChecked();

        // Checking trader must clear warrior
        await page.locator('#trader-bonus').check();
        await expect(page.locator('#warrior-bonus')).not.toBeChecked();
        await expect(page.locator('#trader-bonus')).toBeChecked();

        // And back the other way
        await page.locator('#warrior-bonus').check();
        await expect(page.locator('#trader-bonus')).not.toBeChecked();
        await expect(page.locator('#warrior-bonus')).toBeChecked();
    });

    test('per-ship life form speed bonus is applied', async ({ page }) => {
        // 10% on the small cargo only: base + ceil(5000 * 0.1)
        await openParams(page);
        await page.locator('#class-2').check(); // discoverer, so nothing is doubled
        await openLfBonuses(page);
        await page.locator('[class~="202-speed"]').fill('10');
        const s = await page.evaluate(() => {
            updateNumbers();
            return options.shipsData.map((_, i) => getShipSpeed(i));
        });
        expect(s[SHIP.smallCargo]).toBe(5000 + 500);
        expect(s[SHIP.largeCargo]).toBe(7500);
    });
});

test.describe('Flight Calculator - Slowest Ship', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await page.locator('#class-2').check(); // discoverer: no speed doubling
        await openShips(page);
    });

    // getMinSpeed() over a fleet is covered in unit-tests/flight-core.test.js; this
    // block keeps the check that the per-ship speeds reach the DOM.
    test('per-ship speeds are rendered next to the counts', async ({ page }) => {
        await openParams(page);
        await page.locator('#cmb-drive').fill('5'); // +50% on combustion ships
        await page.evaluate(() => updateNumbers());
        await expect(page.locator('#light-fighter-speed')).toHaveText('18.750');
        await expect(page.locator('#small-cargo-speed')).toHaveText('7.500');
        await expect(page.locator('#cruiser-speed')).toHaveText('15.000');
    });
});

// ---------------------------------------------------------------------------
// Block 2. Deuterium consumption and cargo capacity.
// ---------------------------------------------------------------------------

/** Sets ship counts by input id, leaving every other ship at zero. */
async function setFleet(page, counts) {
    await openShips(page);
    for (const [id, n] of Object.entries(counts)) {
        await page.locator(`#${id}`).fill(String(n));
    }
}

/**
 * Runs a trip the same way updateNumbers() does: slowest ship -> duration -> fuel.
 * @returns {Promise<{cons: number, minSpeed: number, duration: number}>}
 */
function fuelFor(page, { distance = 60000, pct = 100, uni = 1 } = {}) {
    return page.evaluate(({ distance, pct, uni }) => {
        updateNumbers();
        const minSpeed = getMinSpeed();
        const duration = getFlightDuration(minSpeed, distance, pct, uni);
        return {
            cons: getDeutConsumption(minSpeed, distance, duration, pct, uni),
            minSpeed,
            duration,
        };
    }, { distance, pct, uni });
}

const cargoFor = (page) => page.evaluate(() => {
    updateNumbers();
    return getCargoCapacity(options.prm.hyperTechLvl);
});

test.describe('Flight Calculator - Deuterium Consumption', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await page.locator('#class-2').check(); // discoverer: no speed or fuel perks
    });

    // The consumption formula - ship count, distance, the universe factor, the
    // general discount and its Mechan scaling, the per-ship life form reduction and
    // the one-deuterium floor - is covered in unit-tests/flight-core.test.js. This
    // test stays for the form wiring: the class radio and the discount select.
    test('general class reduces consumption by the configured percentage', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 100 });
        const discoverer = (await fuelFor(page)).cons;

        await openParams(page);
        await page.locator('#class-1').check();
        await page.locator('#deut-generals-bonus').selectOption('25');
        const general25 = (await fuelFor(page)).cons;

        await page.locator('#deut-generals-bonus').selectOption('50');
        const general50 = (await fuelFor(page)).cons;

        expect(general25).toBeLessThan(discoverer);
        expect(general50).toBeLessThan(general25);
    });
});

test.describe('Flight Calculator - Cargo Capacity', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await page.locator('#class-2').check(); // discoverer: no cargo perks
    });

    // The capacity formula - ship count, the hyperspace-tech multiplier, the
    // collector and general bonuses with their life form scaling, the per-ship life
    // form bonus and the spy-probe cargohold - is covered in
    // unit-tests/flight-core.test.js. This test stays for the #hypertech-lvl wiring.
    test('hyperspace technology adds 5% per level', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 1 });
        await openParams(page);

        await page.locator('#hypertech-lvl').fill('10');
        expect(await cargoFor(page)).toBe(25000 * 1.5);

        await page.locator('#hypertech-lvl').fill('20');
        expect(await cargoFor(page)).toBe(25000 * 2);
    });
});

// ---------------------------------------------------------------------------
// Block 3. The results table.
// ---------------------------------------------------------------------------

/**
 * The twenty speed steps of #flight-times. Selected by class rather than by
 * position: the table also carries the empty-state rows, which are not speed
 * steps and must not be counted as such.
 */
const speedRows = (page) => page.locator('#flight-times tr.speed-row');

test.describe('Flight Calculator - Results Table', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await page.locator('#class-2').check();
        await openFlightTimesTab(page);
        await setFleet(page, { 'large-cargo': 100 });
        // Filling an input does not always re-run the calculation on its own
        await page.evaluate(() => updateNumbers());
    });

    test('one row per 5% speed step from 100 down to 5', async ({ page }) => {
        const rows = speedRows(page);
        await expect(rows).toHaveCount(20);
        await expect(rows.first().locator('td').first()).toHaveText('100%');
        await expect(rows.last().locator('td').first()).toHaveText('5%');
    });

    test('duration, fuel and capacity are filled in for every visible row', async ({ page }) => {
        const rows = speedRows(page);
        for (const idx of [0, 2, 4, 19]) {
            const cells = rows.nth(idx).locator('td');
            await expect(cells.nth(1)).not.toBeEmpty(); // duration
            await expect(cells.nth(2)).not.toBeEmpty(); // deuterium
            await expect(cells.nth(3)).not.toBeEmpty(); // cargo
        }
    });

    test('slower speeds take longer and burn less fuel', async ({ page }) => {
        const fuelAt = async (idx) =>
            Number((await speedRows(page).nth(idx).locator('td').nth(2).innerText()).replace(/\./g, ''));

        const at100 = await fuelAt(0);
        const at50 = await fuelAt(10);
        const at10 = await fuelAt(18);

        expect(at50).toBeLessThan(at100);
        expect(at10).toBeLessThan(at50);
    });

    test('only multiples of 10% are offered to non-general classes', async ({ page }) => {
        const rows = speedRows(page);
        // Row 0 is 100%, row 1 is 95%, row 2 is 90% ...
        await expect(rows.nth(0)).toBeVisible();
        await expect(rows.nth(1)).toBeHidden();
        await expect(rows.nth(2)).toBeVisible();
        await expect(rows.nth(3)).toBeHidden();
    });

    test('the general class unlocks every 5% step', async ({ page }) => {
        await openParams(page);
        await page.locator('#class-1').check();
        await openFlightTimesTab(page);

        const rows = speedRows(page);
        for (const idx of [0, 1, 2, 3, 19]) {
            await expect(rows.nth(idx)).toBeVisible();
        }
    });

    test('mission type picks the matching universe fleet speed', async ({ page }) => {
        await openParams(page, '#speed-fleet-war');
        await page.locator('#speed-fleet-war').selectOption('1');
        await page.locator('#speed-fleet-peaceful').selectOption('5');
        await page.locator('#speed-fleet-holding').selectOption('10');
        await openFlightTimesTab(page);

        const durationAt100 = () => speedRows(page).nth(0).locator('td').nth(1).innerText();

        await page.locator('#mission-type-0').check(); // war, x1
        const war = await durationAt100();

        await page.locator('#mission-type-1').check(); // peaceful, x5
        const peaceful = await durationAt100();

        await page.locator('#mission-type-2').check(); // holding, x10
        const holding = await durationAt100();

        expect(war).not.toBe(peaceful);
        expect(peaceful).not.toBe(holding);
        // Faster universe speed means a shorter trip, so the strings differ in length
        // or value; compare the underlying seconds instead
        const seconds = await page.evaluate(() => {
            const dist = getDistance(options.prm.departure, options.prm.destination);
            const ms = getMinSpeed();
            return {
                x1: getFlightDuration(ms, dist, 100, 1),
                x5: getFlightDuration(ms, dist, 100, 5),
                x10: getFlightDuration(ms, dist, 100, 10),
            };
        });
        expect(seconds.x5).toBeLessThan(seconds.x1);
        expect(seconds.x10).toBeLessThan(seconds.x5);
    });

    test('distance is shown for a valid route', async ({ page }) => {
        await openParams(page);
        await page.locator('#departure-g').fill('1');
        await page.locator('#destination-g').fill('4');
        await expect(page.locator('#distance')).toHaveText('60.000');
    });

    test('an out-of-range coordinate blanks the distance and clears the table', async ({ page }) => {
        await openParams(page, '#galaxies-num');
        await page.locator('#galaxies-num').fill('9');
        await page.locator('#destination-g').fill('99'); // beyond the galaxy count
        await page.evaluate(() => updateNumbers());

        await expect(page.locator('#distance')).toHaveText('-');
        const cells = speedRows(page).nth(0).locator('td');
        await expect(cells.nth(1)).toBeEmpty();
        await expect(cells.nth(2)).toBeEmpty();
        await expect(cells.nth(3)).toBeEmpty();
    });

    test('a zero coordinate is rejected as well', async ({ page }) => {
        await openParams(page);
        await page.locator('#destination-p').fill('0');
        await page.evaluate(() => updateNumbers());
        await expect(page.locator('#distance')).toHaveText('-');
    });

    test('an empty fleet leaves the table blank', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 0 });
        await page.evaluate(() => updateNumbers());

        const cells = speedRows(page).nth(0).locator('td');
        await expect(cells.nth(1)).toBeEmpty();
        await expect(cells.nth(2)).toBeEmpty();
    });

    test('the clear button zeroes every ship count', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 100, 'light-fighter': 7, 'esp-probe': 3 });
        await page.locator('#clear-ships').click();

        for (const id of ['large-cargo', 'light-fighter', 'esp-probe']) {
            await expect(page.locator(`#${id}`)).toHaveValue('0');
        }
    });

    test('clearing the ships blanks the table and hides the take-to-calc buttons', async ({ page }) => {
        await openShips(page);
        await page.locator('#clear-ships').click();

        const row = speedRows(page).nth(0);
        const cells = row.locator('td');
        await expect(cells.nth(1)).toBeEmpty();
        await expect(cells.nth(2)).toBeEmpty();
        await expect(cells.nth(3)).toBeEmpty();
        await expect(row.locator('.button-taketocalc')).toBeHidden();
    });

    test('a speed override does not fill the table for an empty fleet', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        await page.locator('#ovr-speed-cb').check();
        await page.locator('#ovr-speed-t').fill('100000');
        await openShips(page);
        await page.locator('#clear-ships').click();

        const cells = speedRows(page).nth(0).locator('td');
        await expect(cells.nth(1)).toBeEmpty();
        await expect(cells.nth(2)).toBeEmpty();
        await expect(cells.nth(3)).toBeEmpty();
    });

    test('speed override replaces the slowest ship speed', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        const before = await speedRows(page).nth(0).locator('td').nth(1).innerText();

        await page.locator('#ovr-speed-cb').check(); // enables the input
        await page.locator('#ovr-speed-t').fill('100000');
        await page.evaluate(() => updateNumbers());

        const after = await speedRows(page).nth(0).locator('td').nth(1).innerText();
        expect(after).not.toBe(before);
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(true);
    });

    test('the take-to-calc button carries over the overridden speed', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        await page.locator('#ovr-speed-cb').check();
        await page.locator('#ovr-speed-t').fill('100000'); // far above the large cargo
        await openFlightTimesTab(page);
        await page.evaluate(() => updateNumbers());

        await speedRows(page).nth(0).locator('.button-taketocalc').click();

        const seconds = await page.evaluate(() => {
            const orch = window.flightOrchestrator;
            const prm = orch.collector.collectParams(orch._state());
            const uni = orch.calc.fleetSpeedFor(prm.missionType, prm);
            const dist = getDistance(options.prm.departure, options.prm.destination);
            return {
                taken: options.prm.flightData[0],
                overridden: getFlightDuration(100000, dist, 100, uni),
                bySlowestShip: getFlightDuration(getMinSpeed(), dist, 100, uni),
            };
        });
        expect(seconds.taken).toBe(seconds.overridden);
        expect(seconds.taken).not.toBe(seconds.bySlowestShip);
    });

    test('an override of zero falls back to 10000', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        // The field starts disabled, so enable it before clearing the value
        await page.locator('#ovr-speed-cb').check();
        await page.locator('#ovr-speed-t').fill('0');
        await page.locator('#ovr-speed-cb').uncheck();
        await page.locator('#ovr-speed-cb').check();

        await expect(page.locator('#ovr-speed-t')).toHaveValue('10000');
        expect(await page.evaluate(() => options.ovrSpeed)).toBe(10000);
    });

    test('the override field is only editable while the override is on', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        await expect(page.locator('#ovr-speed-t')).toBeDisabled();

        await page.locator('#ovr-speed-cb').check();
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(true);
        await expect(page.locator('#ovr-speed-t')).toBeEnabled();

        await page.locator('#ovr-speed-cb').uncheck();
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(false);
        await expect(page.locator('#ovr-speed-t')).toBeDisabled();
    });
});

test.describe('Flight Calculator - Moon Destruction Mission', () => {
    /** The numbers of a speed row's duration cell, e.g. "5h 32m 18s" -> [5, 32, 18]. */
    async function rowDuration(page, idx) {
        const text = await speedRows(page).nth(idx).locator('td').nth(1).innerText();
        return (text.match(/\d+/g) ?? []).map(Number);
    }

    /** The same for the 100% row, which most of these tests are about. */
    const topDuration = (page) => rowDuration(page, 0);

    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
        await page.locator('#class-2').check();
        // The neighbouring planet is the 1005 distance the announcement used
        await page.locator('#departure-g').fill('1');
        await page.locator('#departure-s').fill('1');
        await page.locator('#departure-p').fill('1');
        await page.locator('#destination-g').fill('1');
        await page.locator('#destination-s').fill('1');
        await page.locator('#destination-p').fill('2');
        await openFlightTimesTab(page);
        await setFleet(page, { 'death-star': 10 });
        await page.evaluate(() => updateNumbers());
    });

    test('the trip takes the published 5h 32m whatever the fleet could do', async ({ page }) => {
        await page.locator('#mission-type-3').check();
        expect(await topDuration(page)).toEqual([5, 32, 18]);

        // Neither a researched drive nor a faster universe moves it
        await openParams(page, '#hyp-drive');
        await page.locator('#hyp-drive').fill('12');
        // The fleet speeds live on the universe tab, the drives on another one
        await openParams(page, '#speed-fleet-war');
        await page.locator('#speed-fleet-war').selectOption('10');
        await page.locator('#speed-fleet-peaceful').selectOption('10');
        await page.locator('#speed-fleet-holding').selectOption('10');
        await openFlightTimesTab(page);
        expect(await topDuration(page)).toEqual([5, 32, 18]);
    });

    test('the speed percentage is still the player\'s to pick', async ({ page }) => {
        await page.locator('#mission-type-3').check();

        const rows = speedRows(page);
        // A discoverer sees the ten multiples of 10%, in their usual places
        for (const idx of [0, 2, 4, 18]) {
            await expect(rows.nth(idx)).toBeVisible();
            await expect(rows.nth(idx).locator('td').nth(1)).not.toBeEmpty();
        }
        await expect(rows.nth(1)).toBeHidden();

        // Half the speed, twice the flight: 5h 32m 18s becomes 11h 4m 27s
        const half = await rowDuration(page, 10);
        expect(half).toEqual([11, 4, 27]);
    });

    test('a throttled trip burns less deuterium', async ({ page }) => {
        // A death star burns one unit per trip, so ten of them pay the fleet
        // minimum at every percentage - it takes a real fleet to see the bill
        await setFleet(page, { 'death-star': 10000 });
        await openFlightTimesTab(page);
        await page.locator('#mission-type-3').check();

        const deut = async (idx) => Number.parseInt(
            (await speedRows(page).nth(idx).locator('td').nth(2).innerText()).replace(/\D/g, ''), 10);
        const full = await deut(0);
        expect(full).toBeGreaterThan(1);
        expect(await deut(10)).toBeLessThan(full);
    });

    test('the manual speed override is greyed out and cannot win', async ({ page }) => {
        await openParams(page, '#ovr-speed-cb');
        await page.locator('#ovr-speed-cb').check();
        await page.locator('#ovr-speed-t').fill('100000');
        await openFlightTimesTab(page);

        await page.locator('#mission-type-3').check();
        await expect(page.locator('#ovr-speed-cb')).toBeDisabled();
        await expect(page.locator('#ovr-speed-t')).toBeDisabled();
        // 310 all the same, not the 100000 left in the field
        expect(await topDuration(page)).toEqual([5, 32, 18]);

        await page.locator('#mission-type-1').check();
        await expect(page.locator('#ovr-speed-cb')).toBeEnabled();
        await expect(page.locator('#ovr-speed-t')).toBeEnabled();
    });
});

test.describe('Flight Calculator - Empty State', () => {
    const noShips = (page) => page.locator('#flight-times-empty-ships');
    const badCoords = (page) => page.locator('#flight-times-empty-coords');

    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        // No fleet is set up here on purpose: every ship count starts at 0, which
        // is exactly the state a first-time visitor lands in.
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openFlightTimesTab(page);
    });

    test('a first visit is met by the no-ships message, not by a blank table', async ({ page }) => {
        await expect(noShips(page)).toBeVisible();
        await expect(badCoords(page)).toBeHidden();
        await expect(speedRows(page).nth(0)).toBeHidden();
    });

    test('entering a ship count puts the speed rows back', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 100 });
        await page.evaluate(() => updateNumbers());

        await expect(noShips(page)).toBeHidden();
        await expect(speedRows(page).nth(0)).toBeVisible();
        await expect(speedRows(page).nth(0).locator('td').nth(1)).not.toBeEmpty();
    });

    /**
     * Leaves a coordinate out of range with the focus elsewhere. Typing an
     * invalid value directly would not survive: blur validation clamps the field
     * back into range the moment the user leaves it, so that state only exists
     * mid-keystroke. Shrinking the universe under an already-entered coordinate
     * is the way to reach it for real - only the edited field is ever repaired.
     */
    async function shrinkUniverseUnder(page, fieldId) {
        await page.locator(`#${fieldId}`).fill('5');
        await openParams(page, '#galaxies-num');
        await page.locator('#galaxies-num').fill('2');
        await page.locator('#galaxies-num').blur();
        await page.evaluate(() => updateNumbers());
    }

    test('a broken route reports the coordinates, not the fleet', async ({ page }) => {
        // Both causes hold at once: the fleet is still empty. The coordinates win,
        // because without a route there is nothing to fly along in the first place.
        await shrinkUniverseUnder(page, 'destination-g');

        await expect(badCoords(page)).toBeVisible();
        await expect(noShips(page)).toBeHidden();
    });

    test('the no-ships message leads to the ship counts', async ({ page }) => {
        // Opening the parameters closes the ships section: they share a parent
        // accordion, so this is the state where the shortcut has work to do.
        await openParams(page);
        await expect(page.locator('#small-cargo')).toBeHidden();

        await page.locator('#flight-times-goto-ships').click();

        await expect(page.locator('#small-cargo')).toBeVisible();
        await expect(page.locator('#small-cargo')).toBeFocused();
    });

    test('the coordinates message leads to the field that is wrong', async ({ page }) => {
        await shrinkUniverseUnder(page, 'destination-g');

        await page.locator('#flight-times-goto-coords').click();
        await expect(page.locator('#destination-g')).toBeFocused();
    });

    test('an invalid departure is reached through its collapsed section', async ({ page }) => {
        await openParams(page, '#departure-g');
        await shrinkUniverseUnder(page, 'departure-g');
        // Collapse the parameters again by opening the ships section over them
        await openShips(page);
        await expect(page.locator('#departure-g')).toBeHidden();

        await page.locator('#flight-times-goto-coords').click();

        await expect(page.locator('#departure-g')).toBeVisible();
        await expect(page.locator('#departure-g')).toBeFocused();
    });
});

test.describe('Flight Calculator - Arrival Time', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await page.locator('#tabtag1').click();
        await page.locator('#set-departure-zero').click(); // midnight today, a stable base
    });

    const flightRows = (page) => page.locator('#flight-data .flight-leg');
    const arrival = (page) => page.locator('#arrival-moment').innerText();

    test('a departure time alone already yields an arrival', async ({ page }) => {
        const start = await page.locator('#start-datetime').inputValue();
        expect(await arrival(page)).toBe(start);
    });

    test('a flight time is added to the departure moment', async ({ page }) => {
        const before = await arrival(page);
        await page.locator('#flight-time').fill('00 01:00:00');
        await page.locator('#flight-time').press('End'); // fire keyup -> updateArrival
        const after = await arrival(page);

        expect(after).not.toBe(before);
        // One hour later on the same day
        const hourOf = (s) => Number(s.match(/ (\d\d):/)[1]);
        expect(hourOf(after)).toBe(hourOf(before) + 1);
    });

    test('toggling the sign subtracts the flight time instead', async ({ page }) => {
        await page.locator('#flight-time').fill('00 01:00:00');
        await page.locator('#flight-time').press('End');
        const plus = await arrival(page);

        await flightRows(page).first().locator('.button-toggle').click();
        const minus = await arrival(page);

        expect(minus).not.toBe(plus);
        expect(await page.evaluate(() => options.prm.flightData[0])).toBe(-3600);
    });

    test('the sign toggle flips back', async ({ page }) => {
        const toggle = flightRows(page).first().locator('.button-toggle');
        await page.locator('#flight-time').fill('00 00:30:00');
        await page.locator('#flight-time').press('End');

        await toggle.click();
        expect(await page.evaluate(() => options.prm.flightData[0])).toBe(-1800);

        await toggle.click();
        expect(await page.evaluate(() => options.prm.flightData[0])).toBe(1800);
    });

    test('several flight times accumulate', async ({ page }) => {
        await page.locator('#flight-time').fill('00 01:00:00');
        await page.locator('#flight-time').press('End');

        await page.locator('#add-flight-time').click();
        await expect(flightRows(page)).toHaveCount(2);

        const second = flightRows(page).nth(1).locator('input.flight-time-input');
        await second.fill('00 00:30:00');
        await second.press('End');

        expect(await page.evaluate(() => options.prm.flightData)).toEqual([3600, 1800]);
    });

    test('an added row can be removed again', async ({ page }) => {
        await page.locator('#flight-time').fill('00 01:00:00');
        await page.locator('#flight-time').press('End');
        await page.locator('#add-flight-time').click();
        await expect(flightRows(page)).toHaveCount(2);

        await flightRows(page).nth(1).locator('.button-remove').click();
        await expect(flightRows(page)).toHaveCount(1);
        expect(await page.evaluate(() => options.prm.flightData)).toEqual([3600]);
    });

    test('an invalid flight time is flagged on the field', async ({ page }) => {
        const field = page.locator('#flight-time');
        await field.fill('00 99:00:00'); // hours out of range
        await field.press('End');

        await expect(field).toHaveClass(/is-invalid/);
    });

    test('a valid flight time clears the error state', async ({ page }) => {
        const field = page.locator('#flight-time');
        await field.fill('00 99:00:00');
        await field.press('End');
        await expect(field).toHaveClass(/is-invalid/);

        await field.fill('00 02:00:00');
        await field.press('End');
        await expect(field).not.toHaveClass(/is-invalid/);
    });

    test('the departure shortcut fills in the current moment', async ({ page }) => {
        await page.locator('#set-departure-now').click();
        const value = await page.locator('#start-datetime').inputValue();
        expect(value).not.toContain('_');
        expect(await page.evaluate(() => options.prm.startDT)).toBeGreaterThan(0);
    });

    test('clicking the departure shortcut dismisses its tooltip', async ({ page }) => {
        const button = page.locator('#set-departure-now');
        await button.hover();
        // Bootstrap points the trigger at the live bubble through aria-describedby
        await expect(button).toHaveAttribute('aria-describedby', /tooltip/);

        await button.click();

        await expect(button).not.toHaveAttribute('aria-describedby', /tooltip/);
        // The midnight shortcut clicked in beforeEach must not have left one behind either
        await expect(page.locator('.tooltip')).toHaveCount(0);
    });

    test('swapping the mode relabels departure and arrival', async ({ page }) => {
        const first = await page.locator('#flight-title-1').innerText();
        const second = await page.locator('#flight-title-2').innerText();

        await page.locator('#toggle-mode').click();

        await expect(page.locator('#flight-title-1')).toHaveText(second);
        await expect(page.locator('#flight-title-2')).toHaveText(first);
    });
});

test.describe('Flight Calculator - Input Masks', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await page.locator('#tabtag1').click();
    });

    /** Puts the caret at a character offset, the way a click into the field would. */
    const caretTo = (page, selector, pos) => page.locator(selector).evaluate(
        (el, at) => el.setSelectionRange(at, at), pos);

    test('an untouched date field is empty and shows its skeleton on focus', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await expect(field).toHaveValue('');

        await field.focus();
        await expect(field).toHaveValue('__.__.____ __:__:__');
    });

    test('a skeleton nobody typed into is taken back on blur', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.blur();

        await expect(field).toHaveValue('');
    });

    test('typed digits skip over the separators', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');

        await expect(field).toHaveValue('26.07.2026 12:05:30');
    });

    test('a digit replaces the one under the caret instead of widening the field', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');

        await caretTo(page, '#start-datetime', 11); // the hours
        await field.pressSequentially('09');

        await expect(field).toHaveValue('26.07.2026 09:05:30');
    });

    test('typing past a separator lands in the next group', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');

        await caretTo(page, '#start-datetime', 9); // the last digit of the year
        await field.pressSequentially('712');

        await expect(field).toHaveValue('26.07.2027 12:05:30');
    });

    test('non-digits are ignored', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26ab07');

        await expect(field).toHaveValue('26.07.____ __:__:__');
    });

    test('backspace blanks the previous slot without shifting the rest', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');
        await field.press('Backspace');

        await expect(field).toHaveValue('26.07.2026 12:05:3_');
    });

    test('backspace steps over a separator', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('2607');
        await field.press('Backspace');
        await field.press('Backspace');

        await expect(field).toHaveValue('26.__.____ __:__:__');
    });

    test('delete blanks the slot the caret sits on', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');

        await caretTo(page, '#start-datetime', 0);
        await field.press('Delete');

        await expect(field).toHaveValue('_6.07.2026 12:05:30');
    });

    test('a selection is blanked rather than removed', async ({ page }) => {
        const field = page.locator('#start-datetime');
        await field.focus();
        await field.pressSequentially('26072026120530');

        await field.evaluate((el) => el.setSelectionRange(0, 10));
        await field.press('Backspace');

        await expect(field).toHaveValue('__.__.____ 12:05:30');
    });

    test('the flight time field carries the duration mask', async ({ page }) => {
        // The leading leg starts out at the stored 00 00:00:00 rather than empty,
        // so this is the overtype case straight away.
        const field = page.locator('#flight-time');
        await field.focus();
        await caretTo(page, '#flight-time', 3); // the hours

        await field.pressSequentially('01');

        await expect(field).toHaveValue('00 01:00:00');
        expect(await page.evaluate(() => options.prm.flightData[0])).toBe(3600);
    });

    test('an emptied flight time field shows the duration skeleton', async ({ page }) => {
        const field = page.locator('#flight-time');
        await field.fill('');
        await field.focus();

        await expect(field).toHaveValue('__ __:__:__');
    });

    test('a leg row added at run time is masked too', async ({ page }) => {
        await page.locator('#flight-time').fill('00 01:00:00');
        await page.locator('#add-flight-time').click();

        const second = page.locator('#flight-data .flight-leg').nth(1).locator('input.flight-time-input');
        await second.focus();
        await second.pressSequentially('00003000');

        await expect(second).toHaveValue('00 00:30:00');
        expect(await page.evaluate(() => options.prm.flightData)).toEqual([3600, 1800]);
    });

    test('the add button does not consume a row that only holds the skeleton', async ({ page }) => {
        await page.locator('#flight-time').focus();
        await page.locator('#add-flight-time').click();

        await expect(page.locator('#flight-data .flight-leg')).toHaveCount(1);
    });

    test('the tolerance field carries the hh:mm mask', async ({ page }) => {
        await page.locator('#tabtag2').click();
        const field = page.locator('#save-tolerance-time');
        await field.focus();
        await caretTo(page, '#save-tolerance-time', 0);

        await field.pressSequentially('0130');

        await expect(field).toHaveValue('01:30');
    });

    test('a departure written by the shortcut stays editable in place', async ({ page }) => {
        await page.locator('#set-departure-zero').click();
        const field = page.locator('#start-datetime');
        const before = await field.inputValue();

        await field.focus();
        await caretTo(page, '#start-datetime', 11);
        await field.pressSequentially('07');

        const after = await field.inputValue();
        expect(after).toHaveLength(before.length);
        expect(after.slice(0, 10)).toBe(before.slice(0, 10));
        expect(after.slice(11, 13)).toBe('07');
    });
});

// ---------------------------------------------------------------------------
// Block 4. Save points.
// ---------------------------------------------------------------------------

/**
 * Fills the save-point form. The date fields are inputmask-driven, so the values
 * are written straight to the DOM in the calculator's own display format.
 */
function fillSavePoints(page, { roundTripHours = 4, tolerance = '02:00', fleet = { 'large-cargo': 100 } } = {}) {
    return page.evaluate(({ roundTripHours, tolerance, fleet }) => {
        for (const [id, n] of Object.entries(fleet)) {
            document.getElementById(id).value = String(n);
        }
        updateNumbers();

        const start = new Date(2026, 0, 15, 12, 0, 0).getTime();
        document.getElementById('save-start-datetime').value = getDateStr(start, options.datetimeFormat);
        document.getElementById('save-return-datetime').value =
            getDateStr(start + roundTripHours * 3600 * 1000, options.datetimeFormat);
        document.getElementById('save-tolerance-time').value = tolerance;
    }, { roundTripHours, tolerance, fleet });
}

const validateSP = (page) => page.evaluate(() => validateSPParams());
const warningText = (page) => page.locator('#warning-message').innerText();

/** Turns the manual speed override on; the field lives on the universe parameter tab. */
async function enableSpeedOverride(page, speed) {
    await openFlightTimesTab(page);
    await openParams(page, '#ovr-speed-cb');
    await page.locator('#ovr-speed-cb').check();
    await page.locator('#ovr-speed-t').fill(String(speed));
    await page.locator('#tabtag2').click();
}

test.describe('Flight Calculator - Save Points', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await page.locator('#tabtag2').click();
    });

    test('candidates are ordered by speed, then by fuel cost', async ({ page }) => {
        const sorted = await page.evaluate(() => {
            const points = [[50, 'a', 300], [10, 'b', 100], [50, 'c', 100], [10, 'd', 500]];
            return [...points].sort(compareSavePoints).map((p) => p[1]);
        });
        // Slowest first; within one speed the cheaper trip wins
        expect(sorted).toEqual(['b', 'd', 'c', 'a']);
    });

    test('an empty fleet is reported first', async ({ page }) => {
        expect(await validateSP(page)).toBe('esp-probe');

        await page.locator('#calculate-savepoints').click();
        expect(await warningText(page)).toBe('There are no ships in the fleet.');
    });

    test('bad departure coordinates outrank every other complaint', async ({ page }) => {
        await page.evaluate(() => { document.getElementById('departure-g').value = '0'; });
        expect(await validateSP(page)).toBe('departure-g');

        await page.locator('#calculate-savepoints').click();
        expect(await warningText(page)).toBe('Wrong departure points coordinates.');
    });

    test('a departure later than the return is rejected', async ({ page }) => {
        await fillSavePoints(page, { roundTripHours: -4 });
        expect(await validateSP(page)).toBe('return-start');

        await page.locator('#calculate-savepoints').click();
        expect(await warningText(page)).toBe('Departure date/time cannot be after return date/time.');
    });

    test('an unfilled tolerance is rejected', async ({ page }) => {
        await fillSavePoints(page, { tolerance: '__:__' });
        expect(await validateSP(page)).toBe('save-tolerance-time');

        await page.locator('#calculate-savepoints').click();
        expect(await warningText(page)).toBe('Wrong time tolerance value.');
    });

    test('a complete form passes validation', async ({ page }) => {
        await fillSavePoints(page);
        expect(await validateSP(page)).toBe('');
    });

    test('a search fills the result tables', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        // Header row plus at least one result
        await expect(page.locator('#savepoints-systems tr')).not.toHaveCount(1);
        await expect(page.locator('#savepoints-planets tr')).not.toHaveCount(1);

        // Every result row starts with a speed percentage
        const firstCell = page.locator('#savepoints-systems tr').nth(1).locator('td').first();
        await expect(firstCell).toHaveText(/^\d+%$/);
    });

    test('every candidate shows the forecast return moment', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        // Read the cells through parseDate so the check survives both date formats
        const offsets = await page.evaluate(() => {
            const start = parseDate(document.getElementById('save-start-datetime').value, options.datetimeFormat);
            const seconds = [];
            ['savepoints-galaxies', 'savepoints-systems', 'savepoints-planets'].forEach((id) => {
                document.querySelectorAll(`#${id} .savepoint-return`).forEach((td) => {
                    seconds.push((parseDate(td.textContent, options.datetimeFormat) - start) / 1000);
                });
            });
            return seconds;
        });

        expect(offsets.length).toBeGreaterThan(0);
        // A 4h round trip searched with a 2h tolerance: home between 14:00 and 18:00
        for (const offset of offsets) {
            expect(offset).toBeGreaterThan(2 * 3600);
            expect(offset).toBeLessThan(6 * 3600);
        }
    });

    test('the shown return moment matches the legs the point seeds', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        const row = page.locator('#savepoints-systems tr').nth(1);
        const shown = await row.locator('.savepoint-return').innerText();
        await row.locator('a').click();

        const expected = await page.evaluate(() => {
            const start = parseDate(document.getElementById('save-start-datetime').value, options.datetimeFormat);
            const roundTrip = options.prm.flightData.reduce((sum, leg) => sum + leg, 0);
            return getDateStr(start + roundTrip * 1000, options.datetimeFormat);
        });
        expect(shown).toBe(expected);
    });

    /**
     * A ring universe with the departure in galaxy 4 of 9: stepping four
     * galaxies down runs off the end of the ring and comes back onto galaxy 9,
     * which is those same four galaxies away the other way round. Listing any
     * other galaxy there promises a flight time the first tab will not honour.
     */
    test('a save point past the end of the galaxy ring is as far away as its row promises', async ({ page }) => {
        await openParams(page, '#departure-g');
        await page.locator('#departure-g').fill('4');
        await openParams(page, '#galaxies-num');
        await page.locator('#galaxies-num').fill('9');
        await page.locator('#circular-galaxies').check();
        await page.evaluate(() => updateNumbers());
        await enableSpeedOverride(page, 100000); // fast enough to cross galaxies

        await fillSavePoints(page, { roundTripHours: 5.5, tolerance: '01:00' });
        await page.locator('#calculate-savepoints').click();

        const rows = page.locator('#savepoints-galaxies tr');
        const count = await rows.count();
        expect(count, 'the search lists galaxies').toBeGreaterThan(1);

        for (let i = 1; i < count; i++) {
            const row = rows.nth(i);
            const shown = await row.locator('.savepoint-return').innerText();
            const label = await row.locator('a').innerText();
            await row.locator('a').click();

            const expected = await page.evaluate(() => {
                const start = parseDate(document.getElementById('save-start-datetime').value, options.datetimeFormat);
                const roundTrip = options.prm.flightData.reduce((sum, leg) => sum + leg, 0);
                return getDateStr(start + roundTrip * 1000, options.datetimeFormat);
            });
            expect(shown, `save point ${label}`).toBe(expected);
            await page.locator('#tabtag2').click();
        }
    });

    test('results are listed slowest first', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        const speeds = await page.locator('#savepoints-systems tr td:first-child').allInnerTexts();
        const numeric = speeds.map((s) => Number(s.replace('%', '')));
        const ascending = [...numeric].sort((a, b) => a - b);
        expect(numeric).toEqual(ascending);
    });

    test('a zero tolerance finds nothing and says so', async ({ page }) => {
        await fillSavePoints(page, { tolerance: '00:00' });
        await page.locator('#calculate-savepoints').click();

        expect(await warningText(page)).toBe('No possible save points found.');
        await expect(page.locator('#savepoints-systems tr')).toHaveCount(1); // header only
    });

    test('a repeated search does not stack up rows', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();
        const first = await page.locator('#savepoints-systems tr').count();

        await page.locator('#calculate-savepoints').click();
        expect(await page.locator('#savepoints-systems tr').count()).toBe(first);
    });

    test('the search is run at the overridden speed', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();
        const bySlowestShip = await page.locator('#savepoints-systems tr td:first-child').allInnerTexts();

        await enableSpeedOverride(page, 100000); // far above the large cargo
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();
        const overridden = await page.locator('#savepoints-systems tr td:first-child').allInnerTexts();

        // A much faster fleet reaches other systems in the same round trip
        expect(overridden.length).toBeGreaterThan(0);
        expect(overridden).not.toEqual(bySlowestShip);
    });

    test('a save point picked at the overridden speed seeds matching legs', async ({ page }) => {
        await enableSpeedOverride(page, 100000);
        await fillSavePoints(page, { roundTripHours: 4, tolerance: '02:00' });
        await page.locator('#calculate-savepoints').click();

        await page.locator('#savepoints-systems tr').nth(1).locator('a').click();

        // The point was found because there and back fits the 4h round trip within
        // the 2h tolerance, so each leg must land in the same window
        const legs = await page.evaluate(() => options.prm.flightData);
        expect(legs[0]).toBeGreaterThan(4 * 3600 / 2 - 3600);
        expect(legs[0]).toBeLessThan(4 * 3600 / 2 + 3600);
    });

    test('picking a save point sends it to the flight tab', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        const link = page.locator('#savepoints-systems tr').nth(1).locator('a');
        const label = await link.innerText(); // "g:sss:xx"
        const system = label.split(':')[1];
        await link.click();

        // The flight-times tab is brought forward and the destination is filled in
        await expect(page.locator('#warrior-bonus')).toBeVisible();
        await expect(page.locator('#destination-s')).toHaveValue(system);

        // Two legs are queued: there and back
        await expect(page.locator('#flight-data .flight-leg')).toHaveCount(2);
        const legs = await page.evaluate(() => options.prm.flightData);
        expect(legs).toHaveLength(2);
        expect(legs[0]).toBe(legs[1]);
    });

    test('the one-way checkbox renames the second moment', async ({ page }) => {
        await expect(page.locator('#save-return-label')).toHaveText('Return');
        await expect(page.locator('#savepoints-systems th.savepoint-return-header')).toHaveText('Return');

        await page.locator('#save-one-way').check();
        await expect(page.locator('#save-return-label')).toHaveText('Arrival');
        await expect(page.locator('#savepoints-systems th.savepoint-return-header')).toHaveText('Arrival');
    });

    test('toggling the one-way search drops the results of the other mode', async ({ page }) => {
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();
        await expect(page.locator('#savepoints-systems tr')).not.toHaveCount(1);

        await page.locator('#save-one-way').check();
        await expect(page.locator('#savepoints-systems tr')).toHaveCount(1); // header only
    });

    test('a one-way save point seeds a single leg for the whole window', async ({ page }) => {
        await page.locator('#save-one-way').check();
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        await page.locator('#savepoints-systems tr').nth(1).locator('a').click();

        // The fleet does not come back, so the 4h window is one flight, and the
        // 2h tolerance applies to it undivided
        await expect(page.locator('#flight-data .flight-leg')).toHaveCount(1);
        const legs = await page.evaluate(() => options.prm.flightData);
        expect(legs).toHaveLength(1);
        expect(legs[0]).toBeGreaterThan(2 * 3600);
        expect(legs[0]).toBeLessThan(6 * 3600);
    });

    test('the one-way arrival moment matches the leg the point seeds', async ({ page }) => {
        await page.locator('#save-one-way').check();
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        const row = page.locator('#savepoints-systems tr').nth(1);
        const shown = await row.locator('.savepoint-return').innerText();
        await row.locator('a').click();

        const expected = await page.evaluate(() => {
            const start = parseDate(document.getElementById('save-start-datetime').value, options.datetimeFormat);
            const flight = options.prm.flightData.reduce((sum, leg) => sum + leg, 0);
            return getDateStr(start + flight * 1000, options.datetimeFormat);
        });
        expect(shown).toBe(expected);
    });

    test('a one-way search reaches farther than a round trip', async ({ page }) => {
        const farthestSystem = async () => {
            const labels = await page.locator('#savepoints-systems tr td:nth-child(2)').allInnerTexts();
            return Math.max(...labels.map((label) => Number(label.split(':')[1])));
        };

        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();
        const roundTrip = await farthestSystem();

        await page.locator('#save-one-way').check();
        await fillSavePoints(page);
        await page.locator('#calculate-savepoints').click();

        // The same window buys twice the flight when the fleet stays there
        expect(await farthestSystem()).toBeGreaterThan(roundTrip);
    });

    test('a one-way departure later than the arrival names the arrival', async ({ page }) => {
        await page.locator('#save-one-way').check();
        await fillSavePoints(page, { roundTripHours: -4 });
        expect(await validateSP(page)).toBe('return-start');

        await page.locator('#calculate-savepoints').click();
        expect(await warningText(page)).toBe('Departure date/time cannot be after arrival date/time.');
    });
});

// ---------------------------------------------------------------------------
// Block 5. Persistence and reset.
// ---------------------------------------------------------------------------

test.describe('Flight Calculator - Persistence', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await openParams(page);
    });

    test('settings are written to options_flight storage', async ({ page }) => {
        await page.locator('#cmb-drive').fill('12');
        await page.evaluate(() => updateNumbers());

        // saveToCookie() prefers localStorage and only falls back to a real cookie
        const stored = await page.evaluate(() => localStorage.getItem('options_flight'));
        expect(stored, 'options_flight is persisted').toBeTruthy();
        expect(JSON.parse(stored).driveLevels[0]).toBe(12);
    });

    test('settings survive a reload', async ({ page }) => {
        await page.locator('#cmb-drive').fill('12');
        await page.locator('#imp-drive').fill('7');
        await page.locator('#hypertech-lvl').fill('3');
        await page.locator('#class-1').check();
        await page.evaluate(() => updateNumbers());

        await page.reload();
        await installCompat(page);
        await openParams(page);

        await expect(page.locator('#cmb-drive')).toHaveValue('12');
        await expect(page.locator('#imp-drive')).toHaveValue('7');
        await expect(page.locator('#hypertech-lvl')).toHaveValue('3');
        await expect(page.locator('#class-1')).toBeChecked();
    });

    test('the fleet is persisted on change', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 250, 'recycler': 17 });
        await page.evaluate(() => updateNumbers());

        const stored = await page.evaluate(() => localStorage.getItem('options_flight'));
        expect(JSON.parse(stored).ships[1]).toBe(250);
        expect(JSON.parse(stored).ships[7]).toBe(17);
    });

    // The Bootstrap migration fixed the old reload-wipes-fleet defect:
    // FlightOrchestrator.populateParams() restores the ship inputs straight from
    // prm.ships (over the fixed SHIPS_BASE list) instead of the still-empty
    // options.shipsData the legacy populateParams() iterated.
    test('ship counts survive a reload', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 250, 'recycler': 17 });
        await page.evaluate(() => updateNumbers());

        await page.reload();
        await installCompat(page);
        await openShips(page);

        await expect(page.locator('#large-cargo')).toHaveValue('250');
        await expect(page.locator('#recycler')).toHaveValue('17');
    });

    test('a reload does not wipe the stored fleet', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 250 });
        await page.evaluate(() => updateNumbers());

        await page.reload();
        await installCompat(page);

        expect(await page.evaluate(() => options.prm.ships[1])).toBe(250);
    });

    test('universe settings survive a reload', async ({ page }) => {
        await openParams(page, '#galaxies-num');
        await page.locator('#galaxies-num').fill('12');
        await page.locator('#systems-num').fill('200');
        await page.locator('#circular-systems').check();
        await page.evaluate(() => updateNumbers());

        await page.reload();
        await installCompat(page);
        await openParams(page);

        await expect(page.locator('#galaxies-num')).toHaveValue('12');
        await expect(page.locator('#systems-num')).toHaveValue('200');
        await expect(page.locator('#circular-systems')).toBeChecked();
    });

    test('the one-way save-point search survives a reload', async ({ page }) => {
        await page.locator('#tabtag2').click();
        await page.locator('#save-one-way').check();

        await page.reload();
        await installCompat(page);
        await page.locator('#tabtag2').click();

        await expect(page.locator('#save-one-way')).toBeChecked();
        await expect(page.locator('#save-return-label')).toHaveText('Arrival');
    });

    // The save-point date fields only fed options.prm from the search button, so
    // an emptied field kept the last searched moment in storage and got it back
    // on the next load.
    test('cleared save-point moments stay cleared after a reload', async ({ page }) => {
        await page.locator('#tabtag2').click();
        const stamp = await page.evaluate(
            () => getDateStr(new Date(2026, 0, 15, 12, 0, 0).getTime(), options.datetimeFormat));
        await page.locator('#set-save-departure-now').click();
        await page.locator('#save-return-datetime').fill(stamp);
        await expect(page.locator('#save-start-datetime')).not.toHaveValue('');

        await page.locator('#save-start-datetime').fill('');
        await page.locator('#save-return-datetime').fill('');

        await page.reload();
        await installCompat(page);
        await page.locator('#tabtag2').click();

        await expect(page.locator('#save-start-datetime')).toHaveValue('');
        await expect(page.locator('#save-return-datetime')).toHaveValue('');
    });

    test('reset restores the default parameters', async ({ page }) => {
        await page.locator('#cmb-drive').fill('12');
        await page.locator('#hypertech-lvl').fill('9');
        await page.locator('#class-1').check();
        await openParams(page, '#galaxies-num');
        await page.locator('#galaxies-num').fill('12');
        await page.evaluate(() => updateNumbers());

        await page.locator('#reset').click();

        await expect(page.locator('#cmb-drive')).toHaveValue('0');
        await expect(page.locator('#hypertech-lvl')).toHaveValue('0');
        await expect(page.locator('#galaxies-num')).toHaveValue('9');
        await expect(page.locator('#systems-num')).toHaveValue('499');
        expect(await page.evaluate(() => options.prm.playerClass)).toBe(0);
    });

    test('reset clears the fleet', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 250 });
        await page.evaluate(() => updateNumbers());

        await openParams(page);
        await page.locator('#reset').click();

        expect(await page.evaluate(() => options.prm.ships)).toEqual(new Array(15).fill(0));
        await openShips(page);
        await expect(page.locator('#large-cargo')).toHaveValue('0');
    });
});

test.describe('Flight Calculator - Fleet Recall', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
        await page.locator('#tabtag1').click();
    });

    /** Switches the departure panel to its Recall tab and waits for the pane. */
    async function openRecallTab(page) {
        await page.locator('#recall-tabtag-recall').click();
        await expect(page.locator('#recall-start-datetime')).toBeVisible();
    }

    /**
     * Writes the read-only "Full flight" field the way take-to-calc does. The
     * field is disabled, so a test cannot type into it.
     */
    const setFullFlight = (page, text) => page.evaluate((t) => {
        const el = document.getElementById('recall-full-flight');
        el.value = t;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);

    /** The day portion of the recall departure, so tests can build sibling moments. */
    async function departureDay(page) {
        const value = await page.locator('#recall-start-datetime').inputValue();
        return value.slice(0, 10);
    }

    const fillMasked = async (page, selector, text) => {
        await page.locator(selector).fill(text);
        await page.locator(selector).press('End');
    };

    const returnMoment = (page) => page.locator('#recall-return-moment').innerText();

    // ---- structure -------------------------------------------------------

    test('the departure panel is split into Regular and Recall tabs', async ({ page }) => {
        await expect(page.locator('#recall-tabtag-regular')).toBeVisible();
        await expect(page.locator('#recall-tabtag-recall')).toBeVisible();
        await expect(page.locator('#recall-tabtag-regular')).toHaveClass(/active/);

        // The Regular tab still holds the untouched arrival calculator
        await expect(page.locator('#start-datetime')).toBeVisible();
        await expect(page.locator('#flight-time')).toBeVisible();
        await expect(page.locator('#arrival-moment')).toBeVisible();
        await expect(page.locator('#recall-start-datetime')).toBeHidden();
    });

    test('the Recall tab carries its own departure, full flight and return fields', async ({ page }) => {
        await openRecallTab(page);

        await expect(page.locator('#set-recall-departure-now')).toBeVisible();
        await expect(page.locator('#set-recall-departure-zero')).toBeVisible();
        await expect(page.locator('#recall-full-flight')).toBeDisabled();
        await expect(page.locator('#recall-full-flight')).toHaveValue('00 00:00:00');
        await expect(page.locator('#recall-return-moment')).toHaveText('?');
    });

    test('the recall mode defaults to the exact moment with both fields disabled', async ({ page }) => {
        await openRecallTab(page);

        await expect(page.locator('#recall-mode-0')).toBeChecked();
        await expect(page.locator('#recall-mode-1')).not.toBeChecked();
        // Neither departure nor full flight is known yet
        await expect(page.locator('#recall-moment')).toBeDisabled();
        await expect(page.locator('#recall-after')).toBeDisabled();
        await expect(page.locator('#recall-after')).toHaveValue('00 00:00:00');
    });

    // ---- full flight from the results table -------------------------------

    test('the take-to-calc button fills the full flight field', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 5 });
        await page.locator('#destination-s').fill('50');
        await page.evaluate(() => updateNumbers());

        // The same row through each tab: a leg on the regular one, the full
        // flight on the recall one, and both have to read it as the same flight
        await speedRows(page).nth(0).locator('.button-taketocalc').click();
        await openRecallTab(page);
        await speedRows(page).nth(0).locator('.button-taketocalc').click();

        const full = await page.locator('#recall-full-flight').inputValue();
        expect(full).not.toBe('00 00:00:00');
        expect(await page.evaluate(() => options.prm.recallFullFlight))
            .toBe(await page.evaluate(() => options.prm.flightData[0]));
    });

    test('a row taken to the recall tab adds no leg to the regular one', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 5 });
        await page.locator('#destination-s').fill('50');
        await page.evaluate(() => updateNumbers());

        await openRecallTab(page);
        await speedRows(page).nth(0).locator('.button-taketocalc').click();
        await expect(page.locator('#recall-full-flight')).not.toHaveValue('00 00:00:00');

        await page.locator('#recall-tabtag-regular').click();
        // Still the single zero leg the panel starts with
        await expect(page.locator('#flight-data .flight-leg')).toHaveCount(1);
        await expect(page.locator('#flight-time')).toHaveValue('00 00:00:00');
        expect(await page.evaluate(() => options.prm.flightData)).toEqual([0]);
    });

    test('a row taken to the regular tab leaves the full flight alone', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 5 });
        await page.locator('#destination-s').fill('50');
        await page.evaluate(() => updateNumbers());

        await speedRows(page).nth(0).locator('.button-taketocalc').click();
        const legs = await page.evaluate(() => options.prm.flightData);
        expect(legs).toHaveLength(1);
        expect(legs[0]).toBeGreaterThan(0);

        await openRecallTab(page);
        await expect(page.locator('#recall-full-flight')).toHaveValue('00 00:00:00');
        // With no outbound flight picked the recall fields stay locked
        await expect(page.locator('#recall-moment')).toBeDisabled();
    });

    test('a second take-to-calc replaces the full flight instead of adding to it', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 5 });
        await page.locator('#destination-s').fill('50');
        await page.evaluate(() => updateNumbers());

        await openRecallTab(page);
        await speedRows(page).nth(0).locator('.button-taketocalc').click(); // 100%
        const first = await page.locator('#recall-full-flight').inputValue();
        const firstSeconds = await page.evaluate(() => options.prm.recallFullFlight);

        await speedRows(page).nth(4).locator('.button-taketocalc').click(); // a slower row
        const second = await page.locator('#recall-full-flight').inputValue();
        const full = await page.evaluate(() => options.prm.recallFullFlight);

        expect(second).not.toBe(first);
        expect(await page.evaluate((t) => getSecondsFromTimeField(t), second)).toBe(full);

        // The regular tab turns the same row into a leg, which pins down what
        // that row on its own is worth
        await page.locator('#recall-tabtag-regular').click();
        await speedRows(page).nth(4).locator('.button-taketocalc').click();
        const [leg] = await page.evaluate(() => options.prm.flightData);

        // Replaced: the latest row on its own, not the two of them added up
        expect(full).toBe(leg);
        expect(full).not.toBe(firstSeconds + leg);
    });

    // ---- enabling the recall inputs ---------------------------------------

    test('the recall inputs stay disabled until departure and full flight are both known', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();

        // Departure alone is not enough
        await expect(page.locator('#recall-moment')).toBeDisabled();

        await setFullFlight(page, '00 05:00:00');
        await expect(page.locator('#recall-moment')).toBeEnabled();
        // The unselected mode keeps its field locked
        await expect(page.locator('#recall-after')).toBeDisabled();
    });

    test('picking a recall mode moves the enabled field', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');

        await page.locator('#recall-mode-1').check();
        await expect(page.locator('#recall-after')).toBeEnabled();
        await expect(page.locator('#recall-moment')).toBeDisabled();

        await page.locator('#recall-mode-0').check();
        await expect(page.locator('#recall-moment')).toBeEnabled();
        await expect(page.locator('#recall-after')).toBeDisabled();
    });

    // ---- the exact-moment mode --------------------------------------------

    test('a recall moment before the departure is flagged and blocks the result', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');

        const day = await departureDay(page);
        const [d, m, y] = day.split('.').map(Number);
        const previous = new Date(y, m - 1, d - 1);
        const pad = (n) => String(n).padStart(2, '0');
        await fillMasked(page, '#recall-moment',
            `${pad(previous.getDate())}.${pad(previous.getMonth() + 1)}.${previous.getFullYear()} 12:00:00`);

        await expect(page.locator('#recall-moment')).toHaveClass(/is-invalid/);
        expect(await returnMoment(page)).toBe('?');

        // The banner waits for the field to be left rather than shouting mid-edit
        await page.locator('#recall-moment').blur();
        expect(await warningText(page))
            .toBe(await page.evaluate(() => options.msgRecallBeforeDeparture));
    });

    test('a valid recall moment fills in the elapsed time and the return', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');

        const day = await departureDay(page);
        await fillMasked(page, '#recall-moment', `${day} 02:00:00`);

        await expect(page.locator('#recall-moment')).not.toHaveClass(/is-invalid/);
        // Two hours after a midnight departure
        await expect(page.locator('#recall-after')).toHaveValue('00 02:00:00');
        // ...and two more hours to fly home
        expect(await returnMoment(page)).toBe(`${day} 04:00:00`);
    });

    test('a recall moment after the arrival is flagged and blocks the result', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 01:00:00');

        const day = await departureDay(page);
        // Recalled three hours in, but the whole trip only lasts one hour: by
        // then the fleet has landed and there is nothing left to turn back
        await fillMasked(page, '#recall-moment', `${day} 03:00:00`);

        await expect(page.locator('#recall-moment')).toHaveClass(/is-invalid/);
        expect(await returnMoment(page)).toBe('?');
        // A rejected moment is not mirrored into the elapsed field
        await expect(page.locator('#recall-after')).toHaveValue('00 00:00:00');

        await page.locator('#recall-moment').blur();
        expect(await warningText(page))
            .toBe(await page.evaluate(() => options.msgRecallAfterArrival));
    });

    test('a recall exactly at the arrival is still accepted', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 01:00:00');

        const day = await departureDay(page);
        await fillMasked(page, '#recall-moment', `${day} 01:00:00`);

        await expect(page.locator('#recall-moment')).not.toHaveClass(/is-invalid/);
        // The whole outbound flight, then the whole way back
        expect(await returnMoment(page)).toBe(`${day} 02:00:00`);
    });

    test('a shorter full flight drops a stored recall that no longer fits', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');

        const day = await departureDay(page);
        await fillMasked(page, '#recall-moment', `${day} 03:00:00`);
        expect(await page.evaluate(() => options.prm.recallElapsed)).toBe(3 * 3600);

        // Taking a shorter row to the calculator narrows the window under the
        // recall already stored, leaving three hours into a one-hour flight
        await setFullFlight(page, '00 01:00:00');

        await expect(page.locator('#recall-moment')).toHaveClass(/is-invalid/);
        expect(await page.evaluate(() => options.prm.recallElapsed)).toBe(0);
        expect(await page.evaluate(() => options.prm.recallMomentDT)).toBe(0);

        // ...so the reload comes back empty rather than flagged
        await page.reload();
        await installCompat(page);
        await page.locator('#tabtag1').click();
        await openRecallTab(page);

        await expect(page.locator('#recall-moment')).toHaveValue('');
        await expect(page.locator('#recall-moment')).not.toHaveClass(/is-invalid/);
        await expect(page.locator('#recall-after')).toHaveValue('00 00:00:00');
        expect(await returnMoment(page)).toBe('?');
    });

    test('coming back inside the window clears the flag and the result', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 01:00:00');

        const day = await departureDay(page);
        await fillMasked(page, '#recall-moment', `${day} 03:00:00`);
        await expect(page.locator('#recall-moment')).toHaveClass(/is-invalid/);

        await fillMasked(page, '#recall-moment', `${day} 00:30:00`);

        await expect(page.locator('#recall-moment')).not.toHaveClass(/is-invalid/);
        await expect(page.locator('#recall-after')).toHaveValue('00 00:30:00');
        expect(await returnMoment(page)).toBe(`${day} 01:00:00`);
    });

    // ---- the after-given-time mode ----------------------------------------

    test('an elapsed time fills in the recall moment and the return', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');
        await page.locator('#recall-mode-1').check();

        const day = await departureDay(page);
        await fillMasked(page, '#recall-after', '00 02:00:00');

        await expect(page.locator('#recall-moment')).toHaveValue(`${day} 02:00:00`);
        expect(await returnMoment(page)).toBe(`${day} 04:00:00`);
    });

    test('an elapsed time longer than the full flight is flagged and blocks the result', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 01:00:00');
        await page.locator('#recall-mode-1').check();

        const day = await departureDay(page);
        await fillMasked(page, '#recall-after', '00 03:00:00');

        await expect(page.locator('#recall-after')).toHaveClass(/is-invalid/);
        expect(await returnMoment(page)).toBe('?');
        // The paired field keeps the last accepted recall — the zero elapsed the
        // mode switch mirrored — rather than the rejected three hours
        await expect(page.locator('#recall-moment')).toHaveValue(`${day} 00:00:00`);

        await page.locator('#recall-after').blur();
        expect(await warningText(page))
            .toBe(await page.evaluate(() => options.msgRecallAfterArrival));
    });

    // ---- reset -------------------------------------------------------------

    test('reset restores the recall defaults', async ({ page }) => {
        await openRecallTab(page);
        await page.locator('#set-recall-departure-zero').click();
        await setFullFlight(page, '00 05:00:00');
        await page.locator('#recall-mode-1').check();
        await fillMasked(page, '#recall-after', '00 02:00:00');

        await page.locator('#reset').click();
        await openRecallTab(page);

        await expect(page.locator('#recall-start-datetime')).toHaveValue('');
        await expect(page.locator('#recall-full-flight')).toHaveValue('00 00:00:00');
        await expect(page.locator('#recall-after')).toHaveValue('00 00:00:00');
        await expect(page.locator('#recall-mode-0')).toBeChecked();
        await expect(page.locator('#recall-moment')).toBeDisabled();
        expect(await returnMoment(page)).toBe('?');
    });
});
