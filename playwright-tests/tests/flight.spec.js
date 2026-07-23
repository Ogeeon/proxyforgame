import { test, expect } from '@playwright/test';
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
const SR_FIXTURE = readFileSync(
    join(__dirname, '../fixtures/sr_fs003df9447df01744296d867509e0ae7e60.txt'),
    'utf-8'
);

test.describe('Flight Calculator - Spy Report Import', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });

        // Intercept the ogameAPI ajax call and return the pre-recorded fixture
        await page.route('/ajax.php', async (route, request) => {
            const body = request.postData() ?? '';
            if (body.includes('service=ogameAPI')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/plain',
                    body: SR_FIXTURE,
                });
            } else {
                await route.continue();
            }
        });

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

        await page.locator('#own-api-txtarea').fill(OWN_API_FIXTURE);
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

    test('invalid input shows an error and does not change fields', async ({ page }) => {
        let alertMsg = '';
        page.on('dialog', d => { alertMsg = d.message(); d.accept(); });

        const before = await page.locator('#departure-g').inputValue();

        // Invalid input keeps the dialog open, so open it once and try both values inside it.
        await page.locator('#import-own-api').click();
        await expect(page.locator('#own-api-reader')).toBeVisible();

        // Malformed JSON, and a bare primitive that JSON.parse would otherwise accept ("111" -> 111).
        for (const bad of ['{not valid json', '111']) {
            alertMsg = '';
            await page.locator('#own-api-txtarea').fill(bad);
            await page.locator(OWN_API_IMPORT_BUTTON).click();

            expect(alertMsg.length, `alert shown for input ${JSON.stringify(bad)}`).toBeGreaterThan(0);
            await expect(page.locator('#departure-g')).toHaveValue(before);
            await expect(page.locator('#own-api-reader')).toBeVisible(); // stays open on error
        }
    });
});

// ---------------------------------------------------------------------------
// Block 1. Distance and flight duration.
//
// getDistance() and getFlightDuration() are DOM-free, so they are driven
// directly through page.evaluate() with options.prm stubbed per case.
// ---------------------------------------------------------------------------

const UNI_DEFAULTS = {
    circularGalaxies: false,
    circularSystems: false,
    numberOfGalaxies: 9,
    numberOfSystems: 499,
    fleetIgnoreEmptySystems: false,
};

/**
 * Calls getDistance() with a known universe configuration.
 * @param ovr manual empty-systems count, or null to leave the override disabled
 * @returns {Promise<{dst: number, empty: number}>} distance and getDistance.lastEmptyCount
 */
function distance(page, { dep, dest, prm = {}, populated = null, ovr = null }) {
    return page.evaluate(({ dep, dest, prm, populated, ovr, defaults }) => {
        Object.assign(options.prm, defaults, prm);
        options.populatedSystems = populated;
        options.emptySystemsOverrideEnabled = ovr !== null;
        options.emptySystemsOverride = ovr ?? 0;
        return { dst: getDistance(dep, dest), empty: getDistance.lastEmptyCount };
    }, { dep, dest, prm, populated, ovr, defaults: UNI_DEFAULTS });
}

test.describe('Flight Calculator - Distance', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    test('same planet is a fixed short hop', async ({ page }) => {
        const { dst } = await distance(page, { dep: [1, 1, 1], dest: [1, 1, 1] });
        expect(dst).toBe(5);
    });

    test('planet difference: 5 per slot + 1000', async ({ page }) => {
        const { dst } = await distance(page, { dep: [1, 1, 1], dest: [1, 1, 5] });
        expect(dst).toBe(4 * 5 + 1000);
    });

    test('system difference: 95 per system + 2700', async ({ page }) => {
        const { dst } = await distance(page, { dep: [1, 1, 1], dest: [1, 10, 1] });
        expect(dst).toBe(9 * 95 + 2700);
    });

    test('galaxy difference: 20000 per galaxy', async ({ page }) => {
        const { dst } = await distance(page, { dep: [1, 1, 1], dest: [4, 1, 1] });
        expect(dst).toBe(3 * 20000);
    });

    test('coordinate precedence: galaxy beats system beats planet', async ({ page }) => {
        // Different on all three axes -> only the galaxy delta is used
        const both = await distance(page, { dep: [2, 3, 4], dest: [5, 6, 7] });
        expect(both.dst).toBe(3 * 20000);

        // Same galaxy, different system and planet -> only the system delta is used
        const sys = await distance(page, { dep: [1, 1, 1], dest: [1, 10, 9] });
        expect(sys.dst).toBe(9 * 95 + 2700);
    });

    test('circular galaxies take the short way around', async ({ page }) => {
        // 9 galaxies, 1 -> 8: direct 7, wrapped 2
        const on = await distance(page, {
            dep: [1, 1, 1], dest: [8, 1, 1], prm: { circularGalaxies: true },
        });
        expect(on.dst).toBe(2 * 20000);

        const off = await distance(page, { dep: [1, 1, 1], dest: [8, 1, 1] });
        expect(off.dst).toBe(7 * 20000);
    });

    test('circular systems take the short way around', async ({ page }) => {
        // 499 systems, 1 -> 490: direct 489, wrapped 10
        const on = await distance(page, {
            dep: [1, 1, 1], dest: [1, 490, 1], prm: { circularSystems: true },
        });
        expect(on.dst).toBe(10 * 95 + 2700);

        const off = await distance(page, { dep: [1, 1, 1], dest: [1, 490, 1] });
        expect(off.dst).toBe(489 * 95 + 2700);
    });

    test('empty systems are skipped when the universe ignores them', async ({ page }) => {
        // Systems 1..10, populated: 1, 3, 5, 10. Endpoints are excluded, so the
        // systems strictly between are 2..9 (8 of them), of which 3 and 5 are populated.
        const { dst, empty } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3, 5, 10] },
        });
        expect(empty).toBe(6);
        expect(dst).toBe((9 - 6) * 95 + 2700);
    });

    test('endpoints are never counted as empty', async ({ page }) => {
        // Nothing populated between 1 and 3 -> exactly one empty system (2)
        const { empty } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 3, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3] },
        });
        expect(empty).toBe(1);
    });

    test('missing populated-systems map disables the skip', async ({ page }) => {
        const { dst, empty } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: null,
        });
        expect(empty).toBe(0);
        expect(dst).toBe(9 * 95 + 2700);
    });

    test('manual empty-systems override replaces the computed count', async ({ page }) => {
        const { dst } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3, 5, 10] }, // would compute 6
            ovr: 4,
        });
        expect(dst).toBe((9 - 4) * 95 + 2700);
    });
});

test.describe('Flight Calculator - Distance (circular wrap-around)', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    // The wrap arc runs from the higher endpoint to the last system and on from
    // the first to the lower endpoint, so the empty-system count must be the same
    // whichever end the fleet starts from — it used to count the complementary arc
    // when departure < destination, inflating the count and driving distance negative.
    test('wrap-around distance is the same in both directions', async ({ page }) => {
        const populated = { 1: [1, 490, 495, 497] };
        const prm = { circularSystems: true, fleetIgnoreEmptySystems: true };

        const forward = await distance(page, { dep: [1, 490, 1], dest: [1, 1, 1], prm, populated });
        const backward = await distance(page, { dep: [1, 1, 1], dest: [1, 490, 1], prm, populated });

        expect(forward.dst).toBeGreaterThan(0);
        expect(backward.dst).toBeGreaterThan(0);
        expect(backward.dst).toBe(forward.dst);
    });

    // The invariant behind the fix: you can never skip more systems than the trip
    // is long, so the distance cannot fall below the 2700 floor.
    test('distance never drops below the base cost', async ({ page }) => {
        const { dst } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 490, 495, 497] },
        });
        expect(dst).toBeGreaterThanOrEqual(2700 - 10 * 95);
    });

    // The manual empty-system override is applied to the wrapped arc, not the long
    // way round: the circular-systems shortest path is resolved before the override.
    test('manual override still respects circular systems', async ({ page }) => {
        const { dst } = await distance(page, {
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, fleetIgnoreEmptySystems: true },
            ovr: 0,
        });
        expect(dst).toBe(10 * 95 + 2700); // wrapped, not 489 systems the long way
    });
});

test.describe('Flight Calculator - Flight Duration', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    const duration = (page, args) =>
        page.evaluate(([s, d, p, u]) => getFlightDuration(s, d, p, u), args);

    test('matches the OGame duration formula', async ({ page }) => {
        // round((35000 / (speed% / 10) * sqrt(distance * 10 / minSpeed) + 10) / uniFactor)
        const expected = (minSpeed, dist, pct, uni) =>
            Math.round((35000 / (pct / 10) * Math.sqrt(dist * 10 / minSpeed) + 10) / uni);

        for (const args of [
            [5000, 60000, 100, 1],
            [12500, 3555, 100, 1],
            [5000, 5, 100, 1],
            [10000, 49155, 70, 1],
        ]) {
            expect(await duration(page, args)).toBe(expected(...args));
        }
    });

    test('lower speed percentage scales the duration up', async ({ page }) => {
        const full = await duration(page, [5000, 60000, 100, 1]);
        const half = await duration(page, [5000, 60000, 50, 1]);
        const tenth = await duration(page, [5000, 60000, 10, 1]);

        // The +10s constant keeps this off an exact multiple, hence the tolerance
        expect(half / full).toBeCloseTo(2, 3);
        expect(tenth / full).toBeCloseTo(10, 2);
    });

    test('universe fleet speed divides the duration', async ({ page }) => {
        const x1 = await duration(page, [5000, 60000, 100, 1]);
        const x10 = await duration(page, [5000, 60000, 100, 10]);
        expect(x10).toBe(Math.round(x1 / 10));
    });

    test('faster ships arrive sooner', async ({ page }) => {
        const slow = await duration(page, [2000, 60000, 100, 1]);
        const fast = await duration(page, [12500, 60000, 100, 1]);
        expect(fast).toBeLessThan(slow);
        // Duration scales with 1/sqrt(speed)
        expect(slow / fast).toBeCloseTo(Math.sqrt(12500 / 2000), 2);
    });
});

// ---------------------------------------------------------------------------
// Block 2. Ship speeds.
//
// getShipSpeed()/getMinSpeed() read the form, so these drive the real inputs
// and then call the functions through page.evaluate().
// ---------------------------------------------------------------------------

// Indices into options.shipsData, mirrored by updateNumbers()
const SHIP = {
    smallCargo: 0, largeCargo: 1, lightFighter: 2, heavyFighter: 3, cruiser: 4,
    battleship: 5, colonyShip: 6, recycler: 7, espProbe: 8, bomber: 9,
    destroyer: 10, deathStar: 11, battlecruiser: 12, reaper: 13, pathfinder: 14,
};

const CLASS = { collector: 0, general: 1, discoverer: 2 };

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

const openParams = (page) => openCollapse(page, '#accordion-prm', '#cmb-drive');
const openShips = (page) => openCollapse(page, '#accordion-ships', '#light-fighter');

/** Opens the nested life-form bonuses accordion (lives inside the parameters section). */
async function openLfBonuses(page) {
    await openParams(page);
    await openCollapse(page, '#accordion-lf-prm', '[class~="202-speed"]');
}

/** Activates the flight-times tab, which the tab strip may have left hidden. */
async function openFlightTimesTab(page) {
    await page.locator('#tabtag1').click();
    await expect(page.locator('#warrior-bonus')).toBeVisible();
}

/**
 * Applies drive levels, player class and alliance bonuses, then returns every
 * ship speed keyed by the SHIP index.
 */
async function shipSpeeds(page, {
    cmb = 0, imp = 0, hyp = 0, playerClass = CLASS.discoverer,
    warrior = false, trader = false, lfMechanGE = 0, lfRocktalCE = 0,
} = {}) {
    await openParams(page);
    await page.locator('#cmb-drive').fill(String(cmb));
    await page.locator('#imp-drive').fill(String(imp));
    await page.locator('#hyp-drive').fill(String(hyp));
    await page.locator('#lf-mechan-general-enh').fill(String(lfMechanGE));
    await page.locator('#lf-rocktal-collector-enh').fill(String(lfRocktalCE));
    await page.locator(`#class-${playerClass}`).check();

    // Warrior and trader are mutually exclusive, so clear before setting
    if (warrior) await page.locator('#warrior-bonus').check();
    else await page.locator('#warrior-bonus').uncheck();
    if (trader) await page.locator('#trader-bonus').check();
    else await page.locator('#trader-bonus').uncheck();

    return page.evaluate(() => {
        updateNumbers();
        return options.shipsData.map((_, i) => getShipSpeed(i));
    });
}

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

    test('base speeds with no drives, class or bonuses', async ({ page }) => {
        const s = await shipSpeeds(page);
        expect(s[SHIP.smallCargo]).toBe(5000);
        expect(s[SHIP.largeCargo]).toBe(7500);
        expect(s[SHIP.lightFighter]).toBe(12500);
        expect(s[SHIP.heavyFighter]).toBe(10000);
        expect(s[SHIP.cruiser]).toBe(15000);
        expect(s[SHIP.battleship]).toBe(10000);
        expect(s[SHIP.colonyShip]).toBe(2500);
        expect(s[SHIP.recycler]).toBe(2000);
        expect(s[SHIP.bomber]).toBe(4000);
        expect(s[SHIP.destroyer]).toBe(5000);
        expect(s[SHIP.deathStar]).toBe(100);
        expect(s[SHIP.battlecruiser]).toBe(10000);
        expect(s[SHIP.reaper]).toBe(7000);
        expect(s[SHIP.pathfinder]).toBe(12000);
    });

    test('combustion drive adds 10% per level to its ships only', async ({ page }) => {
        const s = await shipSpeeds(page, { cmb: 5 }); // +50%
        expect(s[SHIP.smallCargo]).toBe(5000 * 1.5);
        expect(s[SHIP.largeCargo]).toBe(7500 * 1.5);
        expect(s[SHIP.lightFighter]).toBe(12500 * 1.5);
        expect(s[SHIP.recycler]).toBe(2000 * 1.5);
        // Impulse and hyperspace ships are untouched
        expect(s[SHIP.cruiser]).toBe(15000);
        expect(s[SHIP.battleship]).toBe(10000);
    });

    test('impulse drive adds 20% per level to its ships only', async ({ page }) => {
        const s = await shipSpeeds(page, { imp: 3 }); // +60%, below the small-cargo threshold
        expect(s[SHIP.heavyFighter]).toBe(10000 * 1.6);
        expect(s[SHIP.cruiser]).toBe(15000 * 1.6);
        expect(s[SHIP.colonyShip]).toBe(2500 * 1.6);
        expect(s[SHIP.bomber]).toBe(4000 * 1.6);
        expect(s[SHIP.smallCargo]).toBe(5000);
        expect(s[SHIP.battleship]).toBe(10000);
    });

    test('hyperspace drive adds 30% per level to its ships only', async ({ page }) => {
        const s = await shipSpeeds(page, { hyp: 5 }); // +150%
        expect(s[SHIP.battleship]).toBe(10000 * 2.5);
        expect(s[SHIP.destroyer]).toBe(5000 * 2.5);
        expect(s[SHIP.deathStar]).toBe(100 * 2.5);
        expect(s[SHIP.battlecruiser]).toBe(10000 * 2.5);
        expect(s[SHIP.reaper]).toBe(7000 * 2.5);
        expect(s[SHIP.pathfinder]).toBe(12000 * 2.5);
        expect(s[SHIP.cruiser]).toBe(15000);
    });

    test('small cargo switches to impulse drive above level 4', async ({ page }) => {
        const at4 = await shipSpeeds(page, { imp: 4 });
        expect(at4[SHIP.smallCargo]).toBe(5000); // still combustion, unaffected by impulse

        const at5 = await shipSpeeds(page, { imp: 5 });
        expect(at5[SHIP.smallCargo]).toBe(10000 * 2); // base 10000, +100% impulse
    });

    test('bomber switches to hyperspace drive above level 7', async ({ page }) => {
        const at7 = await shipSpeeds(page, { hyp: 7 });
        expect(at7[SHIP.bomber]).toBe(4000); // still impulse, and impulse is at 0

        const at8 = await shipSpeeds(page, { hyp: 8 });
        expect(at8[SHIP.bomber]).toBe(5000 * 3.4); // base 5000, +240% hyperspace
    });

    test('recycler upgrades at impulse 17 and hyperspace 15', async ({ page }) => {
        const below = await shipSpeeds(page, { imp: 16, hyp: 14 });
        expect(below[SHIP.recycler]).toBe(2000); // combustion, level 0

        const impulse = await shipSpeeds(page, { imp: 17, hyp: 14 });
        expect(impulse[SHIP.recycler]).toBe(4000 * 4.4); // base 4000, +340% impulse

        const hyper = await shipSpeeds(page, { imp: 0, hyp: 15 });
        expect(hyper[SHIP.recycler]).toBe(6000 * 5.5); // base 6000, +450% hyperspace
    });

    test('hyperspace recycler wins over the impulse one', async ({ page }) => {
        // Both thresholds cleared — the hyperspace variant must be chosen
        const s = await shipSpeeds(page, { imp: 17, hyp: 15 });
        expect(s[SHIP.recycler]).toBe(6000 * 5.5);
    });

    test('collector doubles transports only', async ({ page }) => {
        const s = await shipSpeeds(page, { playerClass: CLASS.collector });
        expect(s[SHIP.smallCargo]).toBe(5000 * 2);
        expect(s[SHIP.largeCargo]).toBe(7500 * 2);
        expect(s[SHIP.lightFighter]).toBe(12500);
        expect(s[SHIP.recycler]).toBe(2000);
    });

    test('general doubles combat ships and recyclers, not transports', async ({ page }) => {
        const s = await shipSpeeds(page, { playerClass: CLASS.general });
        expect(s[SHIP.smallCargo]).toBe(5000);
        expect(s[SHIP.largeCargo]).toBe(7500);
        expect(s[SHIP.colonyShip]).toBe(2500);  // not in the boosted list
        expect(s[SHIP.espProbe]).toBe(100000000);
        expect(s[SHIP.deathStar]).toBe(100);    // not in the boosted list
        expect(s[SHIP.lightFighter]).toBe(12500 * 2);
        expect(s[SHIP.cruiser]).toBe(15000 * 2);
        expect(s[SHIP.recycler]).toBe(2000 * 2);
        expect(s[SHIP.pathfinder]).toBe(12000 * 2);
    });

    test('discoverer doubles nothing', async ({ page }) => {
        const s = await shipSpeeds(page, { playerClass: CLASS.discoverer });
        expect(s[SHIP.smallCargo]).toBe(5000);
        expect(s[SHIP.lightFighter]).toBe(12500);
        expect(s[SHIP.recycler]).toBe(2000);
    });

    test("Rock'tal Collector Enhancement scales the collector bonus", async ({ page }) => {
        const s = await shipSpeeds(page, { playerClass: CLASS.collector, lfRocktalCE: 50 });
        // base + floor(base * (1 + 0.5))
        expect(s[SHIP.smallCargo]).toBe(5000 + 7500);
        expect(s[SHIP.lightFighter]).toBe(12500); // not a transport, unaffected
    });

    test('Mechan General Enhancement scales the general bonus', async ({ page }) => {
        const s = await shipSpeeds(page, { playerClass: CLASS.general, lfMechanGE: 50 });
        expect(s[SHIP.lightFighter]).toBe(12500 + 18750);
        expect(s[SHIP.smallCargo]).toBe(5000); // not boosted for general
    });

    test('warrior alliance bonus adds 10% to every ship', async ({ page }) => {
        const s = await shipSpeeds(page, { warrior: true });
        // Literals, not base * 1.1 — the latter is off by a float ULP for 12500
        expect(s[SHIP.smallCargo]).toBe(5500);
        expect(s[SHIP.lightFighter]).toBe(13750);
        expect(s[SHIP.recycler]).toBe(2200);
    });

    test('trader alliance bonus adds 10% to transports only', async ({ page }) => {
        const s = await shipSpeeds(page, { trader: true });
        expect(s[SHIP.smallCargo]).toBe(5500);
        expect(s[SHIP.largeCargo]).toBe(8250);
        expect(s[SHIP.lightFighter]).toBe(12500);
        expect(s[SHIP.recycler]).toBe(2000);
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

    const minSpeed = (page) => page.evaluate(() => { updateNumbers(); return getMinSpeed(); });

    test('an empty fleet has no speed', async ({ page }) => {
        // Infinity does not survive serialisation, so compare inside the page
        const isInfinite = await page.evaluate(() => {
            updateNumbers();
            return getMinSpeed() === Infinity;
        });
        expect(isInfinite).toBe(true);
    });

    test('the slowest ship in the fleet sets the pace', async ({ page }) => {
        await page.locator('#light-fighter').fill('10');
        expect(await minSpeed(page)).toBe(12500);

        // Adding a slower ship drags the fleet down
        await page.locator('#small-cargo').fill('5');
        expect(await minSpeed(page)).toBe(5000);

        // Adding a faster one changes nothing
        await page.locator('#cruiser').fill('3');
        expect(await minSpeed(page)).toBe(5000);
    });

    test('ships with zero count are ignored', async ({ page }) => {
        await page.locator('#light-fighter').fill('10');
        await page.locator('#colony-ship').fill('0'); // speed 2500, but none in the fleet
        expect(await minSpeed(page)).toBe(12500);
    });

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
// Block 3. Deuterium consumption and cargo capacity.
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

    test('a single small cargo burns the expected amount', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 1 });
        const { cons, minSpeed, duration } = await fuelFor(page);

        // Sanity-check the inputs the fuel formula is fed
        expect(minSpeed).toBe(5000);
        expect(duration).toBe(38351);
        // consumption ~ 10 * (60000/35000) * (1 + speedValue/10)^2, speedValue ~ 10
        expect(cons).toBe(69);
    });

    test('consumption scales with the number of ships', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 1 });
        const one = (await fuelFor(page)).cons;

        await setFleet(page, { 'small-cargo': 100 });
        const hundred = (await fuelFor(page)).cons;

        // Rounding happens once on the fleet total, so 100 ships cost slightly less
        // than 100 rounded single-ship trips (68.57 each, not 69)
        expect(one).toBe(69);
        expect(hundred).toBe(6857);
        expect(hundred / one).toBeGreaterThan(99);
        expect(hundred / one).toBeLessThan(100);
    });

    test('consumption grows with distance', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 10 });
        const near = (await fuelFor(page, { distance: 3555 })).cons;
        const far = (await fuelFor(page, { distance: 60000 })).cons;
        expect(far).toBeGreaterThan(near);
    });

    test('universe deuterium factor scales the base consumption', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 100 });
        const full = (await fuelFor(page)).cons;

        await openParams(page);
        await page.locator('#deut-factor').selectOption('5'); // 50%
        const half = (await fuelFor(page)).cons;

        // floor(10 * 0.1 * 5) = 5 instead of 10 -> half the fuel, up to the final rounding
        expect(half).toBe(Math.round(full / 2));
    });

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

    test('Mechan General Enhancement deepens the general fuel discount', async ({ page }) => {
        await openParams(page);
        await page.locator('#class-1').check();
        await page.locator('#deut-generals-bonus').selectOption('50');
        await setFleet(page, { 'large-cargo': 100 });
        const plain = (await fuelFor(page)).cons;

        await openParams(page);
        await page.locator('#lf-mechan-general-enh').fill('100');
        const enhanced = (await fuelFor(page)).cons;

        expect(enhanced).toBeLessThan(plain);
    });

    test('per-ship life form fuel reduction lowers consumption', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 100 });
        const plain = (await fuelFor(page)).cons;

        await openLfBonuses(page);
        await page.locator('[class~="202-fuel"]').fill('50'); // -50% fuel
        const reduced = (await fuelFor(page)).cons;

        // floor(10 * 0.5) = 5 instead of 10, up to the final rounding
        expect(reduced).toBe(Math.round(plain / 2));
    });

    test('consumption never drops below one deuterium', async ({ page }) => {
        // Death star: cheapest per-unit fuel, shortest possible hop
        await setFleet(page, { 'death-star': 1 });
        const { cons } = await fuelFor(page, { distance: 5 });
        expect(cons).toBeGreaterThanOrEqual(1);
    });

    test('an empty fleet still reports the floor value', async ({ page }) => {
        await setFleet(page, {});
        const cons = await page.evaluate(() =>
            getDeutConsumption(5000, 60000, 38351, 100, 1));
        expect(cons).toBe(1);
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

    test('base capacities without hyperspace technology', async ({ page }) => {
        await setFleet(page, { 'small-cargo': 1, 'large-cargo': 1, 'recycler': 1 });
        expect(await cargoFor(page)).toBe(5000 + 25000 + 20000);
    });

    test('capacity scales with ship count', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 37 });
        expect(await cargoFor(page)).toBe(37 * 25000);
    });

    test('hyperspace technology adds 5% per level', async ({ page }) => {
        await setFleet(page, { 'large-cargo': 1 });
        await openParams(page);

        await page.locator('#hypertech-lvl').fill('10');
        expect(await cargoFor(page)).toBe(25000 * 1.5);

        await page.locator('#hypertech-lvl').fill('20');
        expect(await cargoFor(page)).toBe(25000 * 2);
    });

    test('an empty fleet carries nothing', async ({ page }) => {
        await setFleet(page, {});
        expect(await cargoFor(page)).toBe(0);
    });

    test('collector transports carry 25% more', async ({ page }) => {
        await openParams(page);
        await page.locator('#class-0').check();
        await setFleet(page, { 'small-cargo': 1, 'large-cargo': 1 });
        expect(await cargoFor(page)).toBe(5000 * 1.25 + 25000 * 1.25);
    });

    test("Rock'tal Collector Enhancement scales the transport bonus", async ({ page }) => {
        await openParams(page);
        await page.locator('#class-0').check();
        await page.locator('#lf-rocktal-collector-enh').fill('100'); // doubles the 25%
        await setFleet(page, { 'small-cargo': 1 });
        expect(await cargoFor(page)).toBe(5000 + 2500);
    });

    test('collector bonus does not apply to warships', async ({ page }) => {
        await openParams(page);
        await page.locator('#class-0').check();
        await setFleet(page, { 'light-fighter': 10 }); // cargo 50 each
        expect(await cargoFor(page)).toBe(500);
    });

    test('general recyclers and pathfinders carry 20% more', async ({ page }) => {
        await openParams(page);
        await page.locator('#class-1').check();
        await setFleet(page, { 'recycler': 1 });
        expect(await cargoFor(page)).toBe(20000 * 1.2);

        await setFleet(page, { 'recycler': 0, 'pathfinder': 1 });
        expect(await cargoFor(page)).toBe(10000 * 1.2);

        // Transports get nothing from the general
        await setFleet(page, { 'pathfinder': 0, 'large-cargo': 1 });
        expect(await cargoFor(page)).toBe(25000);
    });

    test('per-ship life form cargo bonus is applied', async ({ page }) => {
        await openLfBonuses(page);
        await page.locator('[class~="202-cargo"]').fill('10'); // +10% of the base 5000
        await setFleet(page, { 'small-cargo': 3 });
        expect(await cargoFor(page)).toBe(3 * (5000 + 500));
    });

    test('spy probes carry cargo once the universe allows it', async ({ page }) => {
        await setFleet(page, { 'esp-probe': 100 });
        expect(await cargoFor(page)).toBe(0);

        await openParams(page);
        await page.locator('#sp-cargohold').fill('5');
        expect(await cargoFor(page)).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// Block 4. The results table.
// ---------------------------------------------------------------------------

/** Data rows of #flight-times, i.e. everything below the header. */
const speedRows = (page) => page.locator('#flight-times tr').nth(0).locator('xpath=..')
    .locator('tr').filter({ hasNot: page.locator('th') });

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
        await openParams(page);
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
        await openParams(page);
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

    test('speed override replaces the slowest ship speed', async ({ page }) => {
        await openParams(page);
        const before = await speedRows(page).nth(0).locator('td').nth(1).innerText();

        await page.locator('#ovr-speed-cb').check(); // enables the input
        await page.locator('#ovr-speed-t').fill('100000');
        await page.evaluate(() => updateNumbers());

        const after = await speedRows(page).nth(0).locator('td').nth(1).innerText();
        expect(after).not.toBe(before);
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(true);
    });

    test('an override of zero falls back to 10000', async ({ page }) => {
        await openParams(page);
        // The field starts disabled, so enable it before clearing the value
        await page.locator('#ovr-speed-cb').check();
        await page.locator('#ovr-speed-t').fill('0');
        await page.locator('#ovr-speed-cb').uncheck();
        await page.locator('#ovr-speed-cb').check();

        await expect(page.locator('#ovr-speed-t')).toHaveValue('10000');
        expect(await page.evaluate(() => options.ovrSpeed)).toBe(10000);
    });

    test('the override field is only editable while the override is on', async ({ page }) => {
        await openParams(page);
        await expect(page.locator('#ovr-speed-t')).toBeDisabled();

        await page.locator('#ovr-speed-cb').check();
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(true);
        await expect(page.locator('#ovr-speed-t')).toBeEnabled();

        await page.locator('#ovr-speed-cb').uncheck();
        expect(await page.evaluate(() => options.isSpeedOvr)).toBe(false);
        await expect(page.locator('#ovr-speed-t')).toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// Block 5. Arrival time.
// ---------------------------------------------------------------------------

test.describe('Flight Calculator - Time Field Parsing', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/flight.php');
        await installCompat(page);
    });

    const parse = (page, text) =>
        page.evaluate((t) => getSecondsFromTimeField(t), text);

    test('a full "DD HH:MM:SS" value is converted to seconds', async ({ page }) => {
        expect(await parse(page, '00 00:00:01')).toBe(1);
        expect(await parse(page, '00 00:01:00')).toBe(60);
        expect(await parse(page, '00 01:00:00')).toBe(3600);
        expect(await parse(page, '01 00:00:00')).toBe(86400);
        expect(await parse(page, '02 03:04:05')).toBe(2 * 86400 + 3 * 3600 + 4 * 60 + 5);
    });

    test('an empty field or an untouched mask counts as zero', async ({ page }) => {
        expect(await parse(page, '')).toBe(0);
        expect(await parse(page, '__ __:__:__')).toBe(0);
    });

    test('out-of-range components are rejected', async ({ page }) => {
        expect(await parse(page, '00 24:00:00')).toBe(-1); // hours must be <= 23
        expect(await parse(page, '00 00:60:00')).toBe(-1); // minutes must be <= 59
        expect(await parse(page, '00 00:00:60')).toBe(-1); // seconds must be <= 59
    });

    test('the largest valid components are accepted', async ({ page }) => {
        expect(await parse(page, '00 23:59:59')).toBe(23 * 3600 + 59 * 60 + 59);
    });

    test('malformed input is rejected', async ({ page }) => {
        expect(await parse(page, 'not a time')).toBe(-1);
        expect(await parse(page, '00 1:00:00')).toBe(-1); // single-digit hour
        expect(await parse(page, '__ 12:00:00')).toBe(-1); // partial mask
    });

    test('seconds are formatted back into "DD HH:MM:SS"', async ({ page }) => {
        const format = (s) => page.evaluate((n) => getFlightTimeStr(n), s);
        expect(await format(0)).toBe('00 00:00:00');
        expect(await format(1)).toBe('00 00:00:01');
        expect(await format(2 * 86400 + 3 * 3600 + 4 * 60 + 5)).toBe('02 03:04:05');
        expect(await format(-1)).toBe(''); // negative durations render as empty
    });

    test('formatting round-trips through parsing', async ({ page }) => {
        for (const seconds of [0, 1, 59, 60, 3599, 3600, 86399, 86400, 123456]) {
            const text = await page.evaluate((n) => getFlightTimeStr(n), seconds);
            expect(await parse(page, text)).toBe(seconds);
        }
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

    test('swapping the mode relabels departure and arrival', async ({ page }) => {
        const first = await page.locator('#flight-title-1').innerText();
        const second = await page.locator('#flight-title-2').innerText();

        await page.locator('#toggle-mode').click();

        await expect(page.locator('#flight-title-1')).toHaveText(second);
        await expect(page.locator('#flight-title-2')).toHaveText(first);
    });
});

// ---------------------------------------------------------------------------
// Block 6. Save points.
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
});

// ---------------------------------------------------------------------------
// Block 7. Persistence and reset.
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
        expect(stored).toContain('driveLevels|0;12');
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
        expect(stored).toContain('ships|1;250');
        expect(stored).toContain('ships|7;17');
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

    test('reset restores the default parameters', async ({ page }) => {
        await page.locator('#cmb-drive').fill('12');
        await page.locator('#hypertech-lvl').fill('9');
        await page.locator('#galaxies-num').fill('12');
        await page.locator('#class-1').check();
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
