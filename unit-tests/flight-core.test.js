'use strict';

// Pure computation tests for the flight calculator, moved out of the Playwright suite.
// Only the blocks whose helpers were already page.evaluate()-only live here: distance,
// duration and time-field parsing. Ship speeds, fuel and cargo stay in Playwright —
// their helpers drive the real form, so they test the form-to-params wiring too.
// Test bodies are unchanged from playwright-tests/tests/flight.spec.js.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// utils.js supplies strPad() for getFlightTimeStr; the orchestration file carries
// getFlightTimeStr and _legSeconds, both of which are pure.
const { FlightCalculator, FlightOrchestrator, getFlightTimeStr } = load(
    ['js/utils.js', 'ogame/calc/js/flight-core.js', 'ogame/calc/js/flight-orchestration.js'],
    ['FlightCalculator', 'FlightOrchestrator', 'getFlightTimeStr'],
);

const calc = new FlightCalculator();

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
 * @returns {{dst: number, empty: number}} distance and the empty-system count
 */
function distance({ dep, dest, prm = {}, populated = null, ovr = null }) {
    const r = calc.getDistance(dep, dest, {
        ...UNI_DEFAULTS,
        ...prm,
        populatedSystems: populated,
        emptySystemsOverrideEnabled: ovr !== null,
        emptySystemsOverride: ovr ?? 0,
    });
    return { dst: r.distance, empty: r.emptySystems };
}

const duration = ([s, d, p, u]) => calc.getFlightDuration(s, d, p, u);

// _legSeconds never reads `this`, so it runs straight off the prototype.
const parse = (text) => FlightOrchestrator.prototype._legSeconds(text);

describe('Flight Calculator - Distance', () => {
    it('same planet is a fixed short hop', () => {
        const { dst } = distance({ dep: [1, 1, 1], dest: [1, 1, 1] });
        expect(dst).toBe(5);
    });

    it('planet difference: 5 per slot + 1000', () => {
        const { dst } = distance({ dep: [1, 1, 1], dest: [1, 1, 5] });
        expect(dst).toBe(4 * 5 + 1000);
    });

    it('system difference: 95 per system + 2700', () => {
        const { dst } = distance({ dep: [1, 1, 1], dest: [1, 10, 1] });
        expect(dst).toBe(9 * 95 + 2700);
    });

    it('galaxy difference: 20000 per galaxy', () => {
        const { dst } = distance({ dep: [1, 1, 1], dest: [4, 1, 1] });
        expect(dst).toBe(3 * 20000);
    });

    it('coordinate precedence: galaxy beats system beats planet', () => {
        // Different on all three axes -> only the galaxy delta is used
        const both = distance({ dep: [2, 3, 4], dest: [5, 6, 7] });
        expect(both.dst).toBe(3 * 20000);

        // Same galaxy, different system and planet -> only the system delta is used
        const sys = distance({ dep: [1, 1, 1], dest: [1, 10, 9] });
        expect(sys.dst).toBe(9 * 95 + 2700);
    });

    it('circular galaxies take the short way around', () => {
        // 9 galaxies, 1 -> 8: direct 7, wrapped 2
        const on = distance({
            dep: [1, 1, 1], dest: [8, 1, 1], prm: { circularGalaxies: true },
        });
        expect(on.dst).toBe(2 * 20000);

        const off = distance({ dep: [1, 1, 1], dest: [8, 1, 1] });
        expect(off.dst).toBe(7 * 20000);
    });

    it('circular systems take the short way around', () => {
        // 499 systems, 1 -> 490: direct 489, wrapped 10
        const on = distance({
            dep: [1, 1, 1], dest: [1, 490, 1], prm: { circularSystems: true },
        });
        expect(on.dst).toBe(10 * 95 + 2700);

        const off = distance({ dep: [1, 1, 1], dest: [1, 490, 1] });
        expect(off.dst).toBe(489 * 95 + 2700);
    });

    it('empty systems are skipped when the universe ignores them', () => {
        // Systems 1..10, populated: 1, 3, 5, 10. Endpoints are excluded, so the
        // systems strictly between are 2..9 (8 of them), of which 3 and 5 are populated.
        const { dst, empty } = distance({
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3, 5, 10] },
        });
        expect(empty).toBe(6);
        expect(dst).toBe((9 - 6) * 95 + 2700);
    });

    it('endpoints are never counted as empty', () => {
        // Nothing populated between 1 and 3 -> exactly one empty system (2)
        const { empty } = distance({
            dep: [1, 1, 1], dest: [1, 3, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3] },
        });
        expect(empty).toBe(1);
    });

    it('missing populated-systems map disables the skip', () => {
        const { dst, empty } = distance({
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: null,
        });
        expect(empty).toBe(0);
        expect(dst).toBe(9 * 95 + 2700);
    });

    it('manual empty-systems override replaces the computed count', () => {
        const { dst } = distance({
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: { fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 3, 5, 10] }, // would compute 6
            ovr: 4,
        });
        expect(dst).toBe((9 - 4) * 95 + 2700);
    });
});

describe('Flight Calculator - Distance (circular wrap-around)', () => {
    // The wrap arc runs from the higher endpoint to the last system and on from
    // the first to the lower endpoint, so the empty-system count must be the same
    // whichever end the fleet starts from — it used to count the complementary arc
    // when departure < destination, inflating the count and driving distance negative.
    it('wrap-around distance is the same in both directions', () => {
        const populated = { 1: [1, 490, 495, 497] };
        const prm = { circularSystems: true, fleetIgnoreEmptySystems: true };

        const forward = distance({ dep: [1, 490, 1], dest: [1, 1, 1], prm, populated });
        const backward = distance({ dep: [1, 1, 1], dest: [1, 490, 1], prm, populated });

        expect(forward.dst).toBeGreaterThan(0);
        expect(backward.dst).toBeGreaterThan(0);
        expect(backward.dst).toBe(forward.dst);
    });

    // The invariant behind the fix: you can never skip more systems than the trip
    // is long, so the distance cannot fall below the 2700 floor.
    it('distance never drops below the base cost', () => {
        const { dst } = distance({
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, fleetIgnoreEmptySystems: true },
            populated: { 1: [1, 490, 495, 497] },
        });
        expect(dst).toBeGreaterThanOrEqual(2700 - 10 * 95);
    });

    // The manual empty-system override is applied to the wrapped arc, not the long
    // way round: the circular-systems shortest path is resolved before the override.
    it('manual override still respects circular systems', () => {
        const { dst } = distance({
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, fleetIgnoreEmptySystems: true },
            ovr: 0,
        });
        expect(dst).toBe(10 * 95 + 2700); // wrapped, not 489 systems the long way
    });
});

describe('Flight Calculator - Flight Duration', () => {
    it('matches the OGame duration formula', () => {
        // round((35000 / (speed% / 10) * sqrt(distance * 10 / minSpeed) + 10) / uniFactor)
        const expected = (minSpeed, dist, pct, uni) =>
            Math.round((35000 / (pct / 10) * Math.sqrt(dist * 10 / minSpeed) + 10) / uni);

        for (const args of [
            [5000, 60000, 100, 1],
            [12500, 3555, 100, 1],
            [5000, 5, 100, 1],
            [10000, 49155, 70, 1],
        ]) {
            expect(duration(args)).toBe(expected(...args));
        }
    });

    it('lower speed percentage scales the duration up', () => {
        const full = duration([5000, 60000, 100, 1]);
        const half = duration([5000, 60000, 50, 1]);
        const tenth = duration([5000, 60000, 10, 1]);

        // The +10s constant keeps this off an exact multiple, hence the tolerance
        expect(half / full).toBeCloseTo(2, 3);
        expect(tenth / full).toBeCloseTo(10, 2);
    });

    it('universe fleet speed divides the duration', () => {
        const x1 = duration([5000, 60000, 100, 1]);
        const x10 = duration([5000, 60000, 100, 10]);
        expect(x10).toBe(Math.round(x1 / 10));
    });

    it('faster ships arrive sooner', () => {
        const slow = duration([2000, 60000, 100, 1]);
        const fast = duration([12500, 60000, 100, 1]);
        expect(fast).toBeLessThan(slow);
        // Duration scales with 1/sqrt(speed)
        expect(slow / fast).toBeCloseTo(Math.sqrt(12500 / 2000), 2);
    });
});

describe('Flight Calculator - Time Field Parsing', () => {
    it('a full "DD HH:MM:SS" value is converted to seconds', () => {
        expect(parse('00 00:00:01')).toBe(1);
        expect(parse('00 00:01:00')).toBe(60);
        expect(parse('00 01:00:00')).toBe(3600);
        expect(parse('01 00:00:00')).toBe(86400);
        expect(parse('02 03:04:05')).toBe(2 * 86400 + 3 * 3600 + 4 * 60 + 5);
    });

    it('an empty field or an untouched mask counts as zero', () => {
        expect(parse('')).toBe(0);
        expect(parse('__ __:__:__')).toBe(0);
    });

    it('out-of-range components are rejected', () => {
        expect(parse('00 24:00:00')).toBe(-1); // hours must be <= 23
        expect(parse('00 00:60:00')).toBe(-1); // minutes must be <= 59
        expect(parse('00 00:00:60')).toBe(-1); // seconds must be <= 59
    });

    it('the largest valid components are accepted', () => {
        expect(parse('00 23:59:59')).toBe(23 * 3600 + 59 * 60 + 59);
    });

    it('malformed input is rejected', () => {
        expect(parse('not a time')).toBe(-1);
        expect(parse('00 1:00:00')).toBe(-1); // single-digit hour
        expect(parse('__ 12:00:00')).toBe(-1); // partial mask
    });

    it('seconds are formatted back into "DD HH:MM:SS"', () => {
        const format = (s) => getFlightTimeStr(s);
        expect(format(0)).toBe('00 00:00:00');
        expect(format(1)).toBe('00 00:00:01');
        expect(format(2 * 86400 + 3 * 3600 + 4 * 60 + 5)).toBe('02 03:04:05');
        expect(format(-1)).toBe(''); // negative durations render as empty
    });

    it('formatting round-trips through parsing', () => {
        for (const seconds of [0, 1, 59, 60, 3599, 3600, 86399, 86400, 123456]) {
            const text = getFlightTimeStr(seconds);
            expect(parse(text)).toBe(seconds);
        }
    });
});
