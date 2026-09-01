'use strict';

// Pure computation tests for the flight calculator, moved out of the Playwright suite.
// Distance, duration and time-field parsing came over first — their helpers were
// already page.evaluate()-only. Ship speeds, fuel and cargo followed: the Playwright
// suite keeps a handful of smoke tests that drive the real form (so the form-to-params
// wiring stays covered), and every drive / class / alliance / life form combination is
// checked here instead, at a millisecond each rather than a page load.
// Test bodies are unchanged from playwright-tests/tests/flight.spec.js.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// utils.js supplies strPad() for getFlightTimeStr; the orchestration file carries
// getFlightTimeStr and _legSeconds, both of which are pure.
const { FlightCalculator, FlightOrchestrator, getFlightTimeStr, MISSION, SHIP, PLAYER_CLASS } = load(
    ['js/utils.js', 'ogame/calc/js/flight-core.js', 'ogame/calc/js/flight-orchestration.js'],
    ['FlightCalculator', 'FlightOrchestrator', 'getFlightTimeStr', 'MISSION', 'SHIP', 'PLAYER_CLASS'],
);

const calc = new FlightCalculator();

const UNI_DEFAULTS = {
    circularGalaxies: false,
    circularSystems: false,
    numberOfGalaxies: 9,
    numberOfSystems: 499,
    fleetIgnoreEmptySystems: false,
    fleetIgnoreInactiveSystems: false,
};

// Both settings on is the common case (183 of the 401 live universes), so the
// blocks that are not about the settings themselves use this shorthand.
const SKIP_ALL = { fleetIgnoreEmptySystems: true, fleetIgnoreInactiveSystems: true };

/**
 * Calls getDistance() with a known universe configuration.
 *
 * The defaults are spelled out as nullable in JSDoc rather than left to
 * inference: `populated = null` on its own infers the type `null`, so every
 * call that passes a real map is then an error.
 *
 * @param {object} args
 * @param {number[]} args.dep departure coordinates
 * @param {number[]} args.dest destination coordinates
 * @param {Partial<typeof UNI_DEFAULTS>} [args.prm] universe settings to override
 * @param {Record<number, number[]>|null} [args.populated] systems holding an active player, per galaxy
 * @param {Record<number, number[]>|null} [args.populatedAll] systems holding any planet at all, per galaxy
 * @param {number|null} [args.ovr] manual empty-systems count, or null to leave the override disabled
 * @returns {{dst: number, empty: number}} distance and the skipped-system count
 */
function distance({ dep, dest, prm = {}, populated = null, populatedAll = null, ovr = null }) {
    const r = calc.getDistance(dep, dest, {
        ...UNI_DEFAULTS,
        ...prm,
        populatedSystems: populated,
        populatedSystemsAll: populatedAll,
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
            prm: SKIP_ALL,
            populated: { 1: [1, 3, 5, 10] },
        });
        expect(empty).toBe(6);
        expect(dst).toBe((9 - 6) * 95 + 2700);
    });

    it('endpoints are never counted as empty', () => {
        // Nothing populated between 1 and 3 -> exactly one empty system (2)
        const { empty } = distance({
            dep: [1, 1, 1], dest: [1, 3, 1],
            prm: SKIP_ALL,
            populated: { 1: [1, 3] },
        });
        expect(empty).toBe(1);
    });

    it('missing populated-systems map disables the skip', () => {
        const { dst, empty } = distance({
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: SKIP_ALL,
            populated: null,
        });
        expect(empty).toBe(0);
        expect(dst).toBe(9 * 95 + 2700);
    });

    it('manual empty-systems override replaces the computed count', () => {
        const { dst } = distance({
            dep: [1, 1, 1], dest: [1, 10, 1],
            prm: SKIP_ALL,
            populated: { 1: [1, 3, 5, 10] }, // would compute 6
            ovr: 4,
        });
        expect(dst).toBe((9 - 4) * 95 + 2700);
    });
});

describe('Flight Calculator - Distance (the two universe settings)', () => {
    // Systems 1..10 with the endpoints excluded leaves 2..9 to judge.
    //   active (a player who still plays): 3, 5
    //   all (any planet at all):           3, 5, 6, 7
    // so 6 and 7 hold nothing but inactive players, and 2, 4, 8, 9 are empty.
    const ACTIVE = { 1: [1, 3, 5, 10] };
    const ALL = { 1: [1, 3, 5, 6, 7, 10] };
    const hop = (prm, sets = {}) => distance({
        dep: [1, 1, 1], dest: [1, 10, 1], prm, populated: ACTIVE, populatedAll: ALL, ...sets,
    });

    it('both settings on: empty and inactive-only systems are skipped', () => {
        const { dst, empty } = hop(SKIP_ALL);
        expect(empty).toBe(6); // 2, 4, 6, 7, 8, 9
        expect(dst).toBe((9 - 6) * 95 + 2700);
    });

    it('only empty ignored: systems held by inactive players still count', () => {
        const { dst, empty } = hop({ fleetIgnoreEmptySystems: true });
        expect(empty).toBe(4); // 2, 4, 8, 9 — 6 and 7 are inhabited, if barely
        expect(dst).toBe((9 - 4) * 95 + 2700);
    });

    it('only inactive ignored: empty systems still count', () => {
        const { dst, empty } = hop({ fleetIgnoreInactiveSystems: true });
        expect(empty).toBe(2); // 6 and 7 only
        expect(dst).toBe((9 - 2) * 95 + 2700);
    });

    it('neither setting on: the fleet crosses every system', () => {
        const { dst, empty } = hop({});
        expect(empty).toBe(0);
        expect(dst).toBe(9 * 95 + 2700);
    });

    it('the two counts always add up to the count with both settings on', () => {
        const both = hop(SKIP_ALL).empty;
        const emptyOnly = hop({ fleetIgnoreEmptySystems: true }).empty;
        const inactiveOnly = hop({ fleetIgnoreInactiveSystems: true }).empty;
        expect(emptyOnly + inactiveOnly).toBe(both);
    });

    it('without the full set, only-empty skips nothing rather than over-skipping', () => {
        // The unfiltered set is what says which systems are truly empty. Without it
        // the honest answer is "no shortcut", not "treat every inactive as empty".
        const { empty } = hop({ fleetIgnoreEmptySystems: true }, { populatedAll: null });
        expect(empty).toBe(0);
    });

    it('without the full set, only-inactive skips nothing either', () => {
        const { empty } = hop({ fleetIgnoreInactiveSystems: true }, { populatedAll: null });
        expect(empty).toBe(0);
    });

    it('with both settings on the full set is not needed at all', () => {
        // Everything missing from the active set is skipped either way, so this
        // case keeps working on rows written before the split.
        const { empty } = hop(SKIP_ALL, { populatedAll: null });
        expect(empty).toBe(6);
    });
});

describe('Flight Calculator - Distance (circular wrap-around)', () => {
    // The wrap arc runs from the higher endpoint to the last system and on from
    // the first to the lower endpoint, so the empty-system count must be the same
    // whichever end the fleet starts from — it used to count the complementary arc
    // when departure < destination, inflating the count and driving distance negative.
    it('wrap-around distance is the same in both directions', () => {
        const populated = { 1: [1, 490, 495, 497] };
        const prm = { circularSystems: true, ...SKIP_ALL };

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
            prm: { circularSystems: true, ...SKIP_ALL },
            populated: { 1: [1, 490, 495, 497] },
        });
        expect(dst).toBeGreaterThanOrEqual(2700 - 10 * 95);
    });

    // Only-inactive counts a difference of two ranges per arc, so the wrap has to
    // hold up on both halves at once.
    it('inactive-only skipping survives the wrap', () => {
        // Wrapped arc from 490 up to 499 and on from 1 to 1 -> systems 491..498.
        // 495 and 497 have an active player; 492 and 496 hold only inactives.
        const { empty } = distance({
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, fleetIgnoreInactiveSystems: true },
            populated: { 1: [1, 490, 495, 497] },
            populatedAll: { 1: [1, 490, 492, 495, 496, 497] },
        });
        expect(empty).toBe(2);
    });

    // The manual empty-system override is applied to the wrapped arc, not the long
    // way round: the circular-systems shortest path is resolved before the override.
    it('manual override still respects circular systems', () => {
        const { dst } = distance({
            dep: [1, 1, 1], dest: [1, 490, 1],
            prm: { circularSystems: true, ...SKIP_ALL },
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

        // Tuple-typed so the spread into expected() keeps its four arguments;
        // a plain number[] loses the length and cannot be spread into arity 4.
        /** @type {[number, number, number, number][]} */
        const cases = [
            [5000, 60000, 100, 1],
            [12500, 3555, 100, 1],
            [5000, 5, 100, 1],
            [10000, 49155, 70, 1],
        ];
        for (const args of cases) {
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

describe('Flight Calculator - Moon Destruction Mission', () => {
    // OGame 12.9.0: the mission flies at 310 whatever the fleet is, and the
    // universe fleet speed no longer divides the trip. 310 is the full-speed
    // figure though - the speed percentage is still the player's to pick.
    const UNI_X4 = { fleetSpeedWar: 4, fleetSpeedPeaceful: 6, fleetSpeedHolding: 8 };

    /** Ship params for a fleet with the given hyperspace drive level. */
    const shipParams = (hyperspace, over = {}) => ({
        driveLevels: [0, 0, hyperspace],
        playerClass: PLAYER_CLASS.COLLECTOR,
        warriorBonus: false,
        traderBonus: false,
        hyperTechLvl: 0,
        lfMechanGE: 0,
        lfRocktalCE: 0,
        lfShipsBonuses: Array.from({ length: 15 }, () => [0, 0, 0]),
        deutFactor: 10,
        deutConsReduction: 25,
        ...over,
    });

    const deathStars = (count) => {
        const counts = new Array(15).fill(0);
        counts[SHIP.DEATH_STAR] = count;
        return counts;
    };

    const minSpeedWith = (hyperspace, over = {}) => {
        const params = shipParams(hyperspace, over);
        return calc.getMinSpeed(calc.buildShipsData(params.driveLevels), deathStars(10), params);
    };

    it('matches the durations published with the change', () => {
        const trip = (dist) => calc.getFlightDuration(
            calc.speedForMission(MISSION.DESTROY, minSpeedWith(7)),
            dist, 100, calc.fleetSpeedFor(MISSION.DESTROY, UNI_X4));

        // 1005 is the in-system hop of the announcement: 5h 32m
        expect(trip(1005)).toBe(19938);
        // 3650 is ten systems away: 10h 33m
        expect(trip(3650)).toBe(37988);
    });

    it('the speed is fixed, not capped', () => {
        // Below 310 the fleet is sped up to it, above 310 it is slowed down to it
        expect(minSpeedWith(0)).toBe(100);
        expect(calc.speedForMission(MISSION.DESTROY, minSpeedWith(0))).toBe(310);
        // The drive bonus is a float multiplication, hence the tolerance
        expect(minSpeedWith(12)).toBeCloseTo(460, 6);
        expect(calc.speedForMission(MISSION.DESTROY, minSpeedWith(12))).toBe(310);
    });

    it('the speed percentage still throttles the fixed speed', () => {
        const trip = (percent) => calc.getFlightDuration(
            calc.speedForMission(MISSION.DESTROY, minSpeedWith(7)),
            1005, percent, calc.fleetSpeedFor(MISSION.DESTROY, UNI_X4));

        // Half the speed is twice the flight, a tenth of it ten times the
        // flight - the fixed 10 seconds of acceleration apart, and rounded
        const throttled = (times) => times * (trip(100) - 10) + 10;
        expect(trip(50)).toBeCloseTo(throttled(2), -1);
        expect(trip(10)).toBeCloseTo(throttled(10), -1);
    });

    it('neither drive research nor class nor alliance bonus moves it', () => {
        const boosted = minSpeedWith(12, {
            playerClass: PLAYER_CLASS.GENERAL, warriorBonus: true,
        });
        expect(boosted).toBeGreaterThan(310);
        expect(calc.speedForMission(MISSION.DESTROY, boosted)).toBe(310);
    });

    it('the universe fleet speed does not divide the trip', () => {
        expect(calc.fleetSpeedFor(MISSION.DESTROY, UNI_X4)).toBe(1);
        // ... while it still does for the three missions that had it
        expect(calc.fleetSpeedFor(MISSION.WAR, UNI_X4)).toBe(4);
        expect(calc.fleetSpeedFor(MISSION.PEACEFUL, UNI_X4)).toBe(6);
        expect(calc.fleetSpeedFor(MISSION.HOLDING, UNI_X4)).toBe(8);
    });

    it('every other mission keeps flying at the fleet speed', () => {
        [MISSION.WAR, MISSION.PEACEFUL, MISSION.HOLDING].forEach((mission) => {
            expect(calc.speedForMission(mission, 5000)).toBe(5000);
        });
    });

    it('the fuel bill is charged at the fixed speed too', () => {
        const counts = deathStars(10);
        const params = shipParams(12);
        const ships = calc.buildShipsData(params.driveLevels);
        const duration = calc.getFlightDuration(310, 3650, 100, 1);

        // A fleet that could fly at 460 pays as if it flew at 310 full speed,
        // which is what the same fleet with hyperspace 7 pays on its own
        const fixed = calc.getDeutConsumption(ships, counts, 3650, duration, 1, params, 310);
        const params7 = shipParams(7);
        const atSameSpeed = calc.getDeutConsumption(
            calc.buildShipsData(params7.driveLevels), counts, 3650, duration, 1, params7);
        expect(fixed).toBe(atSameSpeed);

        // Left on its own speed the same trip reads as a throttled flight and
        // undercharges, which is exactly the mismatch the fixed speed removes
        expect(calc.getDeutConsumption(ships, counts, 3650, duration, 1, params))
            .toBeLessThan(fixed);

        // A percentage the player picked is already in the duration, so the
        // throttled trip costs less on its own, without a second argument
        const slowDuration = calc.getFlightDuration(310, 3650, 50, 1);
        const throttled = calc.getDeutConsumption(ships, counts, 3650, slowDuration, 1, params, 310);
        expect(throttled).toBeLessThan(fixed);
        expect(throttled).toBe(calc.getDeutConsumption(
            calc.buildShipsData(params7.driveLevels), counts, 3650, slowDuration, 1, params7));
    });
});

// ---------------------------------------------------------------------------
// Ship speeds, fuel and cargo. The Playwright suite keeps the smoke tests that
// drive the form; the formula coverage lives here. Helpers below stand in for
// the page.evaluate() shims flight.spec.js installs (updateNumbers, getMinSpeed,
// getShipSpeed, getDeutConsumption, getCargoCapacity).
// ---------------------------------------------------------------------------

/** A collectParams()-shaped object with every drive, class and bonus at zero. */
function shipParams(over = {}) {
    return {
        driveLevels: [0, 0, 0],
        playerClass: PLAYER_CLASS.DISCOVERER,
        warriorBonus: false,
        traderBonus: false,
        hyperTechLvl: 0,
        spCargohold: 0,
        deutFactor: 10,
        deutConsReduction: 0,
        lfMechanGE: 0,
        lfRocktalCE: 0,
        lfShipsBonuses: Array.from({ length: 15 }, () => [0, 0, 0]),
        ...over,
    };
}

/** Ship-count array, zero except for the given { shipIndex: count } entries. */
function fleet(counts) {
    const arr = new Array(15).fill(0);
    for (const [i, n] of Object.entries(counts)) {
        arr[i] = n;
    }
    return arr;
}

describe('Flight Calculator - Ship Speeds', () => {
    // Mirrors the shipSpeeds() helper in flight.spec.js: apply drives, class and
    // bonuses, then return every ship speed keyed by the SHIP index.
    const speeds = ({
        cmb = 0, imp = 0, hyp = 0, playerClass = PLAYER_CLASS.DISCOVERER,
        warrior = false, trader = false, lfMechanGE = 0, lfRocktalCE = 0,
    } = {}) => {
        const params = shipParams({
            driveLevels: [cmb, imp, hyp], playerClass,
            warriorBonus: warrior, traderBonus: trader, lfMechanGE, lfRocktalCE,
        });
        return calc.getAllShipSpeeds(calc.buildShipsData(params.driveLevels), params);
    };

    it('base speeds with no drives, class or bonuses', () => {
        const s = speeds();
        expect(s[SHIP.SMALL_CARGO]).toBe(5000);
        expect(s[SHIP.LARGE_CARGO]).toBe(7500);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500);
        expect(s[SHIP.HEAVY_FIGHTER]).toBe(10000);
        expect(s[SHIP.CRUISER]).toBe(15000);
        expect(s[SHIP.BATTLESHIP]).toBe(10000);
        expect(s[SHIP.COLONY_SHIP]).toBe(2500);
        expect(s[SHIP.RECYCLER]).toBe(2000);
        expect(s[SHIP.BOMBER]).toBe(4000);
        expect(s[SHIP.DESTROYER]).toBe(5000);
        expect(s[SHIP.DEATH_STAR]).toBe(100);
        expect(s[SHIP.BATTLECRUISER]).toBe(10000);
        expect(s[SHIP.REAPER]).toBe(7000);
        expect(s[SHIP.PATHFINDER]).toBe(12000);
    });

    it('combustion drive adds 10% per level to its ships only', () => {
        const s = speeds({ cmb: 5 }); // +50%
        expect(s[SHIP.SMALL_CARGO]).toBe(5000 * 1.5);
        expect(s[SHIP.LARGE_CARGO]).toBe(7500 * 1.5);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500 * 1.5);
        expect(s[SHIP.RECYCLER]).toBe(2000 * 1.5);
        // Impulse and hyperspace ships are untouched
        expect(s[SHIP.CRUISER]).toBe(15000);
        expect(s[SHIP.BATTLESHIP]).toBe(10000);
    });

    it('impulse drive adds 20% per level to its ships only', () => {
        const s = speeds({ imp: 3 }); // +60%, below the small-cargo threshold
        expect(s[SHIP.HEAVY_FIGHTER]).toBe(10000 * 1.6);
        expect(s[SHIP.CRUISER]).toBe(15000 * 1.6);
        expect(s[SHIP.COLONY_SHIP]).toBe(2500 * 1.6);
        expect(s[SHIP.BOMBER]).toBe(4000 * 1.6);
        expect(s[SHIP.SMALL_CARGO]).toBe(5000);
        expect(s[SHIP.BATTLESHIP]).toBe(10000);
    });

    it('hyperspace drive adds 30% per level to its ships only', () => {
        const s = speeds({ hyp: 5 }); // +150%
        expect(s[SHIP.BATTLESHIP]).toBe(10000 * 2.5);
        expect(s[SHIP.DESTROYER]).toBe(5000 * 2.5);
        expect(s[SHIP.DEATH_STAR]).toBe(100 * 2.5);
        expect(s[SHIP.BATTLECRUISER]).toBe(10000 * 2.5);
        expect(s[SHIP.REAPER]).toBe(7000 * 2.5);
        expect(s[SHIP.PATHFINDER]).toBe(12000 * 2.5);
        expect(s[SHIP.CRUISER]).toBe(15000);
    });

    it('small cargo switches to impulse drive above level 4', () => {
        const at4 = speeds({ imp: 4 });
        expect(at4[SHIP.SMALL_CARGO]).toBe(5000); // still combustion, unaffected by impulse

        const at5 = speeds({ imp: 5 });
        expect(at5[SHIP.SMALL_CARGO]).toBe(10000 * 2); // base 10000, +100% impulse
    });

    it('bomber switches to hyperspace drive above level 7', () => {
        const at7 = speeds({ hyp: 7 });
        expect(at7[SHIP.BOMBER]).toBe(4000); // still impulse, and impulse is at 0

        const at8 = speeds({ hyp: 8 });
        expect(at8[SHIP.BOMBER]).toBe(5000 * 3.4); // base 5000, +240% hyperspace
    });

    it('recycler upgrades at impulse 17 and hyperspace 15', () => {
        const below = speeds({ imp: 16, hyp: 14 });
        expect(below[SHIP.RECYCLER]).toBe(2000); // combustion, level 0

        const impulse = speeds({ imp: 17, hyp: 14 });
        expect(impulse[SHIP.RECYCLER]).toBe(4000 * 4.4); // base 4000, +340% impulse

        const hyper = speeds({ imp: 0, hyp: 15 });
        expect(hyper[SHIP.RECYCLER]).toBe(6000 * 5.5); // base 6000, +450% hyperspace
    });

    it('hyperspace recycler wins over the impulse one', () => {
        // Both thresholds cleared — the hyperspace variant must be chosen
        const s = speeds({ imp: 17, hyp: 15 });
        expect(s[SHIP.RECYCLER]).toBe(6000 * 5.5);
    });

    it('collector doubles transports only', () => {
        const s = speeds({ playerClass: PLAYER_CLASS.COLLECTOR });
        expect(s[SHIP.SMALL_CARGO]).toBe(5000 * 2);
        expect(s[SHIP.LARGE_CARGO]).toBe(7500 * 2);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500);
        expect(s[SHIP.RECYCLER]).toBe(2000);
    });

    it('general doubles combat ships and recyclers, not transports', () => {
        const s = speeds({ playerClass: PLAYER_CLASS.GENERAL });
        expect(s[SHIP.SMALL_CARGO]).toBe(5000);
        expect(s[SHIP.LARGE_CARGO]).toBe(7500);
        expect(s[SHIP.COLONY_SHIP]).toBe(2500);  // not in the boosted list
        expect(s[SHIP.ESP_PROBE]).toBe(100000000);
        expect(s[SHIP.DEATH_STAR]).toBe(100);    // not in the boosted list
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500 * 2);
        expect(s[SHIP.CRUISER]).toBe(15000 * 2);
        expect(s[SHIP.RECYCLER]).toBe(2000 * 2);
        expect(s[SHIP.PATHFINDER]).toBe(12000 * 2);
    });

    it('discoverer doubles nothing', () => {
        const s = speeds({ playerClass: PLAYER_CLASS.DISCOVERER });
        expect(s[SHIP.SMALL_CARGO]).toBe(5000);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500);
        expect(s[SHIP.RECYCLER]).toBe(2000);
    });

    it("Rock'tal Collector Enhancement scales the collector bonus", () => {
        const s = speeds({ playerClass: PLAYER_CLASS.COLLECTOR, lfRocktalCE: 50 });
        // base + floor(base * (1 + 0.5))
        expect(s[SHIP.SMALL_CARGO]).toBe(5000 + 7500);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500); // not a transport, unaffected
    });

    it('Mechan General Enhancement scales the general bonus', () => {
        const s = speeds({ playerClass: PLAYER_CLASS.GENERAL, lfMechanGE: 50 });
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500 + 18750);
        expect(s[SHIP.SMALL_CARGO]).toBe(5000); // not boosted for general
    });

    it('warrior alliance bonus adds 10% to every ship', () => {
        const s = speeds({ warrior: true });
        // Literals, not base * 1.1 — the latter is off by a float ULP for 12500
        expect(s[SHIP.SMALL_CARGO]).toBe(5500);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(13750);
        expect(s[SHIP.RECYCLER]).toBe(2200);
    });

    it('trader alliance bonus adds 10% to transports only', () => {
        const s = speeds({ trader: true });
        expect(s[SHIP.SMALL_CARGO]).toBe(5500);
        expect(s[SHIP.LARGE_CARGO]).toBe(8250);
        expect(s[SHIP.LIGHT_FIGHTER]).toBe(12500);
        expect(s[SHIP.RECYCLER]).toBe(2000);
    });
});

describe('Flight Calculator - Slowest Ship', () => {
    // discoverer: no speed doubling
    const params = shipParams();
    const minSpeed = (counts) =>
        calc.getMinSpeed(calc.buildShipsData(params.driveLevels), fleet(counts), params);

    it('an empty fleet has no speed', () => {
        expect(minSpeed({})).toBe(Infinity);
    });

    it('the slowest ship in the fleet sets the pace', () => {
        expect(minSpeed({ [SHIP.LIGHT_FIGHTER]: 10 })).toBe(12500);
        // Adding a slower ship drags the fleet down
        expect(minSpeed({ [SHIP.LIGHT_FIGHTER]: 10, [SHIP.SMALL_CARGO]: 5 })).toBe(5000);
        // Adding a faster one changes nothing
        expect(minSpeed({
            [SHIP.LIGHT_FIGHTER]: 10, [SHIP.SMALL_CARGO]: 5, [SHIP.CRUISER]: 3,
        })).toBe(5000);
    });

    it('ships with zero count are ignored', () => {
        // colony ship speed 2500, but none in the fleet
        expect(minSpeed({ [SHIP.LIGHT_FIGHTER]: 10, [SHIP.COLONY_SHIP]: 0 })).toBe(12500);
    });
});

describe('Flight Calculator - Deuterium Consumption', () => {
    // discoverer: no speed or fuel perks
    /**
     * Runs a trip the way updateNumbers() does: slowest ship -> duration -> fuel.
     * @returns {{cons: number, minSpeed: number, duration: number}}
     */
    const fuelFor = (counts, { distance = 60000, pct = 100, uni = 1, over = {} } = {}) => {
        const params = shipParams(over);
        const ships = calc.buildShipsData(params.driveLevels, params.spCargohold);
        const shipCounts = fleet(counts);
        const minSpeed = calc.getMinSpeed(ships, shipCounts, params);
        const duration = calc.getFlightDuration(minSpeed, distance, pct, uni);
        return {
            cons: calc.getDeutConsumption(ships, shipCounts, distance, duration, uni, params),
            minSpeed,
            duration,
        };
    };

    it('a single small cargo burns the expected amount', () => {
        const { cons, minSpeed, duration } = fuelFor({ [SHIP.SMALL_CARGO]: 1 });
        // Sanity-check the inputs the fuel formula is fed
        expect(minSpeed).toBe(5000);
        expect(duration).toBe(38351);
        // consumption ~ 10 * (60000/35000) * (1 + speedValue/10)^2, speedValue ~ 10
        expect(cons).toBe(69);
    });

    it('consumption scales with the number of ships', () => {
        const one = fuelFor({ [SHIP.SMALL_CARGO]: 1 }).cons;
        const hundred = fuelFor({ [SHIP.SMALL_CARGO]: 100 }).cons;
        // Rounding happens once on the fleet total, so 100 ships cost slightly less
        // than 100 rounded single-ship trips (68.57 each, not 69)
        expect(one).toBe(69);
        expect(hundred).toBe(6857);
        expect(hundred / one).toBeGreaterThan(99);
        expect(hundred / one).toBeLessThan(100);
    });

    it('consumption grows with distance', () => {
        const near = fuelFor({ [SHIP.SMALL_CARGO]: 10 }, { distance: 3555 }).cons;
        const far = fuelFor({ [SHIP.SMALL_CARGO]: 10 }, { distance: 60000 }).cons;
        expect(far).toBeGreaterThan(near);
    });

    it('universe deuterium factor scales the base consumption', () => {
        const full = fuelFor({ [SHIP.SMALL_CARGO]: 100 }).cons;
        const half = fuelFor({ [SHIP.SMALL_CARGO]: 100 }, { over: { deutFactor: 5 } }).cons; // 50%
        // floor(10 * 0.1 * 5) = 5 instead of 10 -> half the fuel, up to the final rounding
        expect(half).toBe(Math.round(full / 2));
    });

    it('Mechan General Enhancement deepens the general fuel discount', () => {
        const general = { playerClass: PLAYER_CLASS.GENERAL, deutConsReduction: 50 };
        const plain = fuelFor({ [SHIP.LARGE_CARGO]: 100 }, { over: general }).cons;
        const enhanced = fuelFor(
            { [SHIP.LARGE_CARGO]: 100 }, { over: { ...general, lfMechanGE: 100 } }).cons;
        expect(enhanced).toBeLessThan(plain);
    });

    it('per-ship life form fuel reduction lowers consumption', () => {
        const plain = fuelFor({ [SHIP.SMALL_CARGO]: 100 }).cons;
        const bonuses = Array.from({ length: 15 }, () => [0, 0, 0]);
        bonuses[SHIP.SMALL_CARGO] = [0, 0, 50]; // -50% fuel
        const reduced = fuelFor(
            { [SHIP.SMALL_CARGO]: 100 }, { over: { lfShipsBonuses: bonuses } }).cons;
        // floor(10 * 0.5) = 5 instead of 10, up to the final rounding
        expect(reduced).toBe(Math.round(plain / 2));
    });

    it('consumption never drops below one deuterium', () => {
        // Death star: cheapest per-unit fuel, shortest possible hop
        const { cons } = fuelFor({ [SHIP.DEATH_STAR]: 1 }, { distance: 5 });
        expect(cons).toBeGreaterThanOrEqual(1);
    });

    it('an empty fleet still reports the floor value', () => {
        const params = shipParams();
        const cons = calc.getDeutConsumption(
            calc.buildShipsData(params.driveLevels), fleet({}), 60000, 38351, 1, params);
        expect(cons).toBe(1);
    });
});

describe('Flight Calculator - Cargo Capacity', () => {
    // discoverer: no cargo perks
    const cargoFor = (counts, over = {}) => {
        const params = shipParams(over);
        return calc.getCargoCapacity(
            calc.buildShipsData(params.driveLevels, params.spCargohold), fleet(counts), params);
    };

    it('base capacities without hyperspace technology', () => {
        expect(cargoFor({
            [SHIP.SMALL_CARGO]: 1, [SHIP.LARGE_CARGO]: 1, [SHIP.RECYCLER]: 1,
        })).toBe(5000 + 25000 + 20000);
    });

    it('capacity scales with ship count', () => {
        expect(cargoFor({ [SHIP.LARGE_CARGO]: 37 })).toBe(37 * 25000);
    });

    it('an empty fleet carries nothing', () => {
        expect(cargoFor({})).toBe(0);
    });

    it('collector transports carry 25% more', () => {
        const cargo = cargoFor(
            { [SHIP.SMALL_CARGO]: 1, [SHIP.LARGE_CARGO]: 1 },
            { playerClass: PLAYER_CLASS.COLLECTOR });
        expect(cargo).toBe(5000 * 1.25 + 25000 * 1.25);
    });

    it("Rock'tal Collector Enhancement scales the transport bonus", () => {
        // 100 doubles the 25%
        const cargo = cargoFor(
            { [SHIP.SMALL_CARGO]: 1 },
            { playerClass: PLAYER_CLASS.COLLECTOR, lfRocktalCE: 100 });
        expect(cargo).toBe(5000 + 2500);
    });

    it('collector bonus does not apply to warships', () => {
        // light fighter cargo 50 each
        const cargo = cargoFor(
            { [SHIP.LIGHT_FIGHTER]: 10 }, { playerClass: PLAYER_CLASS.COLLECTOR });
        expect(cargo).toBe(500);
    });

    it('general recyclers and pathfinders carry 20% more', () => {
        const general = { playerClass: PLAYER_CLASS.GENERAL };
        expect(cargoFor({ [SHIP.RECYCLER]: 1 }, general)).toBe(20000 * 1.2);
        expect(cargoFor({ [SHIP.PATHFINDER]: 1 }, general)).toBe(10000 * 1.2);
        // Transports get nothing from the general
        expect(cargoFor({ [SHIP.LARGE_CARGO]: 1 }, general)).toBe(25000);
    });

    it('Mechan General Enhancement scales the recycler and pathfinder bonus', () => {
        // 100 doubles the 20%
        const enh = { playerClass: PLAYER_CLASS.GENERAL, lfMechanGE: 100 };
        expect(cargoFor({ [SHIP.RECYCLER]: 1 }, enh)).toBe(20000 + 8000);
        expect(cargoFor({ [SHIP.PATHFINDER]: 1 }, enh)).toBe(10000 + 4000);
    });

    it('per-ship life form cargo bonus is applied', () => {
        const bonuses = Array.from({ length: 15 }, () => [0, 0, 0]);
        bonuses[SHIP.SMALL_CARGO] = [0, 10, 0]; // +10% of the base 5000
        expect(cargoFor({ [SHIP.SMALL_CARGO]: 3 }, { lfShipsBonuses: bonuses }))
            .toBe(3 * (5000 + 500));
    });

    it('spy probes carry cargo once the universe allows it', () => {
        expect(cargoFor({ [SHIP.ESP_PROBE]: 100 })).toBe(0);
        expect(cargoFor({ [SHIP.ESP_PROBE]: 100 }, { spCargohold: 5 })).toBe(500);
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
