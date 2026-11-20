'use strict';

// Tests for the Scrap Merchant calculator's formulas (scrap-core.js): the
// return per resource, its rounding, the rate's range, the flagship case -
// the API 2 export the e2e suite imports too - and the cargo holds, checked
// against the cost calculator's.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { load } = require('./load');
const { expect } = require('./expect');

const { calculateScrap, scrapRate, scrapUnitPayback, SCRAP_FLEET_IDS, SCRAP_DEFENSE_IDS, SCRAP_RATE } = load(
    ['js/utils.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/scrap-core.js'],
    ['calculateScrap', 'scrapRate', 'scrapUnitPayback', 'SCRAP_FLEET_IDS', 'SCRAP_DEFENSE_IDS', 'SCRAP_RATE'],
);

/** The cost calculator's settings, whose transport holds the scrap holds must match. */
const { GlobalParams } = load(
    ['ogame/calc/js/ogame-production.js', 'ogame/calc/js/ogame-costs.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/costs-core.js'],
    ['GlobalParams'],
);

/** The unit prices, the way scrap.php hands them to the page. */
const TECHS = JSON.parse(readFileSync(join(__dirname, '../www/ogame/calc/data/costs-techs.json'), 'utf8')).techs;
const PRICES = Object.fromEntries(Object.entries(TECHS).map(([id, tech]) => [id, tech.cost]));

/** @param {any} value Re-created in this realm, see own-api.test.js. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {Record<string, number>} counts
 * @param {unknown} [rate]
 */
const scrap = (counts, rate = 35) => calculateScrap({ counts, rate }, PRICES);

describe('the units the merchant buys', () => {
    it('lists 17 ships and 10 defenses, 216 not among them', () => {
        expect(SCRAP_FLEET_IDS.length).toBe(17);
        expect(SCRAP_FLEET_IDS.includes(216)).toBe(false);
        expect(plain(SCRAP_DEFENSE_IDS)).toEqual([401, 402, 403, 404, 405, 406, 407, 408, 502, 503]);
    });

    it('has a price for every one of them, none growing with a level', () => {
        [...SCRAP_FLEET_IDS, ...SCRAP_DEFENSE_IDS].forEach((id) => {
            expect(TECHS[id].growth).toBe(1);
            expect(TECHS[id].cost.length).toBe(3);
        });
    });
});

describe('scrapUnitPayback', () => {
    it('pays each resource at the rate', () => {
        // A cruiser: 20000 / 7000 / 2000.
        expect(plain(scrapUnitPayback([20000, 7000, 2000], 35))).toEqual({ metal: 7000, crystal: 2450, deuterium: 700 });
    });

    it('drops the fraction per unit, per resource', () => {
        // 37.3% of an interplanetary missile's 12500 metal is 4662.5.
        expect(plain(scrapUnitPayback([12500, 2500, 10000], 37.3))).toEqual({ metal: 4662, crystal: 932, deuterium: 3730 });
    });

    it('does not lose a unit to float error on a whole result', () => {
        // 57.3 * 1000 / 100 is 572.9999... in floating point.
        expect(scrapUnitPayback([1000, 0, 0], 57.3).metal).toBe(573);
    });
});

describe('scrapRate', () => {
    it('keeps a rate inside the range as it is, fractions included', () => {
        expect(scrapRate(35)).toBe(35);
        expect(scrapRate(37.3)).toBe(37.3);
        expect(scrapRate('42.5')).toBe(42.5);
    });

    it('clamps a rate to 1-100', () => {
        expect(scrapRate(0)).toBe(1);
        expect(scrapRate(-5)).toBe(1);
        expect(scrapRate(150)).toBe(100);
        expect(scrapRate(100)).toBe(100);
        expect(scrapRate(1)).toBe(1);
    });

    it('rounds a rate to two decimals', () => {
        expect(scrapRate(37.346)).toBe(37.35);
        expect(scrapRate(37.344)).toBe(37.34);
    });

    it('gives the default rate for anything that is not a number', () => {
        expect(SCRAP_RATE.def).toBe(35);
        expect(scrapRate(undefined)).toBe(35);
        expect(scrapRate(null)).toBe(35);
        expect(scrapRate('')).toBe(35);
        expect(scrapRate('abc')).toBe(35);
    });
});

describe('calculateScrap', () => {
    it('multiplies the rounded unit payback by the count, not the other way round', () => {
        // 3 IPMs at 37.3%: 3 x 4662 metal, not floor(3 x 4662.5) = 13987.
        const r = scrap({ 503: 3 }, 37.3);
        expect(plain(r.defense.payback)).toEqual({ metal: 13986, crystal: 2796, deuterium: 11190 });
    });

    it('includes the deuterium in the payback', () => {
        const r = scrap({ 214: 1 });
        expect(plain(r.fleet.payback)).toEqual({ metal: 1750000, crystal: 1400000, deuterium: 350000 });
        expect(r.fleet.paybackSum).toBe(3500000);
    });

    it('keeps fleet and defense apart and adds them up in the total', () => {
        const r = scrap({ 202: 10, 401: 100 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 20000, crystal: 20000, deuterium: 0 });
        expect(plain(r.defense.cost)).toEqual({ metal: 200000, crystal: 0, deuterium: 0 });
        expect(plain(r.total.cost)).toEqual({ metal: 220000, crystal: 20000, deuterium: 0 });
        expect(plain(r.total.payback)).toEqual({ metal: 77000, crystal: 7000, deuterium: 0 });
    });

    it('counts the missiles with the defense', () => {
        const r = scrap({ 502: 2 });
        expect(r.fleet.costSum).toBe(0);
        expect(plain(r.defense.cost)).toEqual({ metal: 16000, crystal: 0, deuterium: 4000 });
    });

    it('takes the solar satellite and the crawler as ships', () => {
        const r = scrap({ 212: 1, 217: 1 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 2000, crystal: 4000, deuterium: 1500 });
        expect(r.defense.costSum).toBe(0);
    });

    it('gives the points as the cost in thousands, rounded down', () => {
        expect(scrap({ 204: 1 }).total.points).toBe(4);
        expect(scrap({ 210: 1 }).total.points).toBe(1);
        expect(scrap({ 402: 1, 210: 1 }).total.points).toBe(3);
    });

    it('gives zeros and no ships to haul for nothing at all', () => {
        const r = scrap({});
        expect(r.total.costSum).toBe(0);
        expect(r.total.paybackSum).toBe(0);
        expect(r.total.points).toBe(0);
        expect(plain(r.units)).toEqual({});
        expect(r.transport.small).toBe(0);
        expect(r.transport.large).toBe(0);
    });

    it('gives an empty section its zeros while the other one has units', () => {
        const r = scrap({ 407: 1 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
        expect(r.defense.costSum).toBe(20000);
    });

    it('ignores ids the merchant does not buy, negatives and fractions of a unit', () => {
        const r = scrap({ 1: 5, 216: 3, 202: -4, 203: 2.7 });
        expect(Object.keys(plain(r.units))).toEqual(['203']);
        expect(r.fleet.cost.metal).toBe(12000);
    });

    it('holds the rate to its range and says which one it used', () => {
        expect(scrap({ 202: 1 }, 250).rate).toBe(100);
        expect(scrap({ 202: 1 }, 250).total.paybackSum).toBe(4000);
        expect(scrap({ 202: 1 }, undefined).rate).toBe(35);
    });

    it('rounds the cargo ships up, at the base holds', () => {
        const r = scrap({ 202: 15 });
        // 15 x 700 x 2 = 21000: five small cargoes of 5000, one large of 25000.
        expect(r.transport.smallHold).toBe(5000);
        expect(r.transport.largeHold).toBe(25000);
        expect(r.transport.small).toBe(5);
        expect(r.transport.large).toBe(1);
    });

    it('prices a planet out of the API 2 export at the default rate', () => {
        const ownApi = JSON.parse(readFileSync(join(__dirname, '../playwright-tests/fixtures/own_api.json'), 'utf8'));
        /** @type {Record<string, number>} */
        const counts = {};
        Object.entries(ownApi.ships).forEach(([id, ship]) => { if (Number(id) < 400) counts[id] = ship.amount; });
        Object.entries({ ...ownApi.defenses, ...ownApi.missiles }).forEach(([id, unit]) => { counts[id] = unit.amount; });
        const r = scrap(counts);
        expect(plain(r.fleet.cost)).toEqual({ metal: 48177000, crystal: 55175000, deuterium: 1048000 });
        expect(plain(r.fleet.payback)).toEqual({ metal: 16861950, crystal: 19311250, deuterium: 366800 });
        expect(plain(r.defense.cost)).toEqual({ metal: 116085000, crystal: 43855000, deuterium: 14200000 });
        expect(plain(r.defense.payback)).toEqual({ metal: 40629750, crystal: 15349250, deuterium: 4970000 });
        expect(r.total.costSum).toBe(278540000);
        expect(r.total.paybackSum).toBe(97489000);
        expect(r.total.points).toBe(278540);
        expect(r.transport.small).toBe(19498);
        expect(r.transport.large).toBe(3900);
    });
});

describe('the cargo holds', () => {
    /** 21000 to haul, as in 'rounds the cargo ships up': fifteen small cargoes. */
    const COUNTS = { 202: 15 };
    /** @param {Record<string, unknown>} cargo */
    const holds = (cargo) => {
        const t = calculateScrap({ counts: COUNTS, rate: 35, ...cargo }, PRICES).transport;
        return [t.smallHold, t.largeHold, t.small, t.large];
    };

    it('stays at the base holds without any cargo bonus', () => {
        expect(holds({})).toEqual([5000, 25000, 5, 1]);
        expect(holds({ hyperTechLevel: 0, isCollector: false, collectorClassBonus: 0, scCapacityIncrease: 0, lcCapacityIncrease: 0 }))
            .toEqual([5000, 25000, 5, 1]);
    });

    it('adds 5% of the base hold per hyperspace level', () => {
        expect(holds({ hyperTechLevel: 10 })).toEqual([7500, 37500, 3, 1]);
    });

    it('gives the Collector +25% while the flag is on', () => {
        expect(holds({ isCollector: true })).toEqual([6250, 31250, 4, 1]);
        expect(holds({ isCollector: false })).toEqual([5000, 25000, 5, 1]);
    });

    it('raises the Collector bonus by the enhancement, with the flag on only', () => {
        // 25% raised by 60% is 40%.
        expect(holds({ isCollector: true, collectorClassBonus: 60 })).toEqual([7000, 35000, 3, 1]);
        expect(holds({ isCollector: false, collectorClassBonus: 60 })).toEqual([5000, 25000, 5, 1]);
        expect(holds({ collectorClassBonus: 60 })).toEqual([5000, 25000, 5, 1]);
    });

    it('gives each ship its own life form bonus', () => {
        expect(holds({ scCapacityIncrease: 10, lcCapacityIncrease: 20 })).toEqual([5500, 30000, 4, 1]);
    });

    it('holds what the cost calculator holds with every bonus at once', () => {
        // The account of the profile fixtures: hyperspace 8, Collector, enhancement
        // 2.15%, cargo bonuses 1.23% and 2.5% - 7000 + 1276.875 + 61.5 and
        // 35000 + 6384.375 + 625, floored per ship.
        const bonuses = { hyperTechLevel: 8, collectorClassBonus: 2.15, scCapacityIncrease: 1.23, lcCapacityIncrease: 2.5 };
        expect(holds({ ...bonuses, isCollector: true })).toEqual([8338, 42009, 3, 1]);
        // The cost calculator, given the same settings, holds the same: its
        // class 0 is the Collector, 1 and 2 the General and the Discoverer.
        const costs = Object.assign(new GlobalParams(), { ...bonuses, playerClass: 0 });
        expect([costs.smallCargoCapacity, costs.largeCargoCapacity]).toEqual([8338, 42009]);
        for (const playerClass of [1, 2]) {
            const p = Object.assign(new GlobalParams(), { ...bonuses, playerClass });
            expect(holds({ ...bonuses, isCollector: false }).slice(0, 2)).toEqual([p.smallCargoCapacity, p.largeCargoCapacity]);
        }
    });

    it('reads the bonuses the way the page saves them, and drops what is out of range', () => {
        expect(holds({ hyperTechLevel: '10', isCollector: true, collectorClassBonus: '60' })).toEqual([9500, 47500, 3, 1]);
        // A negative level or bonus counts as none, a fractional level as its whole part.
        expect(holds({ hyperTechLevel: -3, scCapacityIncrease: -10 })).toEqual([5000, 25000, 5, 1]);
        expect(holds({ hyperTechLevel: 10.9 })).toEqual([7500, 37500, 3, 1]);
        // Only a true flag is the Collector.
        expect(holds({ isCollector: 'true' })).toEqual([5000, 25000, 5, 1]);
        expect(holds({ isCollector: 1 })).toEqual([5000, 25000, 5, 1]);
        expect(holds({ isCollector: null })).toEqual([5000, 25000, 5, 1]);
    });
});

// ---------------------------------------------------------------------------
// Sell now or wait for the event
// ---------------------------------------------------------------------------

const ST = load(
    ['js/utils.js', 'ogame/calc/js/ogame-universe.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/flight-core.js',
        'ogame/calc/js/scrap-core.js', 'ogame/calc/js/scrap-fleetsave.js'],
    ['scrapSellTiming', 'scrapEventRate', 'scrapExchangeWeights', 'SCRAP_SELL_TIMING_IDS', 'scrapFleetsaveFuel',
        'scrapRouteDistance', 'scrapFuelPerDay', 'SCRAP_FLIGHT_SHIP_IDS', 'FlightCalculator', 'MISSION', 'PLAYER_CLASS'],
);

/**
 * The advice with the defaults of the page: 35% today, 81% in 180 days, rates 1 : 1.5 : 3.
 * @param {Record<string, number>} counts
 * @param {Record<string, number>} fuelPerDay
 * @param {object} [over]
 */
const timing = (counts, fuelPerDay, over = {}) => ST.scrapSellTiming({
    counts, rate: 35, eventRate: 81, days: 180, fuelPerDay, ...over,
}, PRICES);

describe('scrapSellTiming', () => {
    // A battleship: 45000 / 15000 / 0, so 67.500 MSU at 1 : 1.5 : 3.
    it('weighs what the event adds against the deuterium burnt until then', () => {
        const r = timing({ 207: 100 }, { 207: 1000 });
        const row = r.rows[0];
        expect(row.value).toBe(6750000);
        // 46% of 6.75M is 3.105M; 1000 deuterium a day is 3000 MSU a day
        expect(row.gain).toBeCloseTo(3105000 - 3000 * 180, 6);
        expect(row.threshold).toBeCloseTo(3105000 / 3000, 9);
        expect(row.wait).toBe(true);
        expect(plain(r.summary)).toEqual({ wait: 1, sell: 0, gain: row.gain });
    });

    it('sells once the event is further off than the threshold', () => {
        const near = timing({ 207: 100 }, { 207: 1000 }, { days: 1035 }).rows[0];
        expect(near.gain).toBeCloseTo(0, 6);
        expect(near.wait).toBe(false);
        expect(timing({ 207: 100 }, { 207: 1000 }, { days: 1034 }).rows[0].wait).toBe(true);
    });

    it('holds ships that burn nothing, with no threshold', () => {
        const row = timing({ 207: 1 }, {}).rows[0];
        expect(row.fuelPerDay).toBe(0);
        expect(row.threshold).toBe(Infinity);
        expect(row.wait).toBe(true);
    });

    it('sells everything when the event pays no more than today', () => {
        const same = timing({ 207: 1 }, {}, { eventRate: 35 }).rows[0];
        expect(same.threshold).toBe(0);
        expect(same.wait).toBe(false);
        const lower = timing({ 207: 1 }, { 207: 10 }, { eventRate: 20 }).rows[0];
        expect(lower.threshold).toBeLessThan(0);
        expect(lower.wait).toBe(false);
    });

    it('leaves out what costs nothing to keep and what has no count', () => {
        const r = timing({ 202: 0, 212: 50, 217: 50, 401: 10, 503: 5, 203: 3 }, { 203: 1 });
        expect(r.rows.map((row) => row.id)).toEqual([203]);
        expect(plain(ST.SCRAP_SELL_TIMING_IDS).includes(212)).toBe(false);
        expect(plain(ST.SCRAP_SELL_TIMING_IDS).includes(217)).toBe(false);
        expect(ST.SCRAP_SELL_TIMING_IDS.length).toBe(15);
    });

    it('prices the units and the deuterium at the exchange rates, metal being 1', () => {
        expect(plain(ST.scrapExchangeWeights({ metal: 2, crystal: 3, deuterium: 4 }))).toEqual({ metal: 1, crystal: 1.5, deuterium: 2 });
        // Out of range or not a number: the default of that rate
        expect(plain(ST.scrapExchangeWeights({ metal: 0, crystal: 'x', deuterium: 500 }))).toEqual({ metal: 1, crystal: 1.5, deuterium: 3 });
        // A large cargo: 6000 / 6000 / 0; 2 : 2 : 2 makes it 12000 and a deuterium worth 1
        const row = timing({ 203: 1 }, { 203: 10 }, { exchangeRates: { metal: 2, crystal: 2, deuterium: 2 } }).rows[0];
        expect(row.value).toBe(12000);
        expect(row.gain).toBeCloseTo(12000 * 0.46 - 10 * 180, 9);
    });

    it('adds up the gain of the types worth holding only', () => {
        const r = timing({ 207: 100, 203: 1 }, { 207: 1000, 203: 1000 });
        expect(r.summary.wait).toBe(1);
        expect(r.summary.sell).toBe(1);
        expect(r.summary.gain).toBe(r.rows.find((row) => row.id === 207)?.gain);
    });

    it('holds the rates and the days to their ranges', () => {
        expect(ST.scrapEventRate('')).toBe(81);
        expect(ST.scrapEventRate(150)).toBe(100);
        const r = timing({ 207: 1 }, {}, { rate: 'x', eventRate: null, days: -3 });
        expect([r.rate, r.eventRate, r.days]).toEqual([35, 81, 0]);
    });
});

describe('the fleet save behind the advice', () => {
    const calc = new ST.FlightCalculator();

    it('measures each route kind as flight does, never skipping a system', () => {
        expect(ST.scrapRouteDistance({ kind: 'system', delta: 3 })).toBe(1015);
        expect(ST.scrapRouteDistance({ kind: 'systems', delta: 3 })).toBe(2985);
        expect(ST.scrapRouteDistance({ kind: 'galaxies', delta: 2 })).toBe(40000);
        // A position is 14 steps away at most; an unknown kind is the next galaxy
        expect(ST.scrapRouteDistance({ kind: 'system', delta: 99 })).toBe(1070);
        expect(ST.scrapRouteDistance({ kind: 'moon', delta: 1 })).toBe(20000);
        // A ring takes the short way round
        expect(ST.scrapRouteDistance({ kind: 'galaxies', delta: 7 },
            { circularGalaxies: true, numberOfGalaxies: 9 })).toBe(40000);
        expect(ST.scrapRouteDistance({ kind: 'systems', delta: 400 },
            { circularSystems: true, numberOfSystems: 499 })).toBe(2700 + 99 * 95);
    });

    it('bills what flight bills for a peaceful flight, the shares adding up to it', () => {
        const counts = { 202: 1000, 207: 200, 214: 1, 212: 9 };
        const settings = {
            route: { kind: 'systems', delta: 5 }, speedPercent: 30, driveLevels: [12, 9, 7],
            playerClass: ST.PLAYER_CLASS.GENERAL, lfMechanGE: 15,
            shipBonuses: { 207: { speed: 10, fuel: 3 } },
            universe: { fleetSpeedPeaceful: 3, deutFactor: 8, deutConsReduction: 36 },
        };
        const fuel = ST.scrapFleetsaveFuel(counts, settings);

        const shipCounts = plain(ST.SCRAP_FLIGHT_SHIP_IDS).map((/** @type {number} */ id) => counts[id] ?? 0);
        const bonuses = plain(ST.SCRAP_FLIGHT_SHIP_IDS).map((/** @type {number} */ id) => (id === 207 ? [10, 0, 3] : [0, 0, 0]));
        const params = {
            driveLevels: [12, 9, 7], playerClass: ST.PLAYER_CLASS.GENERAL, missionType: ST.MISSION.PEACEFUL,
            fleetSpeedWar: 1, fleetSpeedPeaceful: 3, fleetSpeedHolding: 1, deutFactor: 8, deutConsReduction: 36,
            lfMechanGE: 15, lfRocktalCE: 0, lfShipsBonuses: bonuses, traderBonus: false, warriorBonus: false,
            hyperTechLvl: 0, spCargohold: 0,
        };
        const plan = calc.planFlight(calc.buildShipsData([12, 9, 7]), shipCounts, 2700 + 5 * 95, params, { percents: [30] });
        expect(fuel.distance).toBe(3175);
        expect(fuel.duration).toBe(plan.entries[0].duration);
        expect(fuel.total).toBe(plan.entries[0].deut);
        const shares = Object.values(fuel.perSave);
        expect(Math.round(shares.reduce((a, b) => a + b, 0))).toBe(fuel.total);
        expect(fuel.perSave[204]).toBe(0);
        // The satellite does not fly: flight has no row for it
        expect(212 in fuel.perSave).toBe(false);
    });

    it('applies one discount to every ship on top of its own', () => {
        const counts = { 203: 100 };
        const plain0 = ST.scrapFleetsaveFuel(counts, { route: { kind: 'galaxies', delta: 1 }, speedPercent: 100 });
        const half = ST.scrapFleetsaveFuel(counts, {
            route: { kind: 'galaxies', delta: 1 }, speedPercent: 100, fuelDiscount: 30, shipBonuses: { 203: { fuel: 20 } },
        });
        // A large cargo burns 50 a ship, 25 at half
        expect(half.perSave[203]).toBeCloseTo(plain0.perSave[203] / 2, 9);
    });

    it('falls back to 10% for a speed the class does not offer, and costs nothing empty', () => {
        const counts = { 203: 10 };
        const route = { kind: 'galaxies', delta: 1 };
        const odd = ST.scrapFleetsaveFuel(counts, { route, speedPercent: 15 });
        expect(odd.duration).toBe(ST.scrapFleetsaveFuel(counts, { route, speedPercent: 10 }).duration);
        const general = ST.scrapFleetsaveFuel(counts, { route, speedPercent: 15, playerClass: ST.PLAYER_CLASS.GENERAL });
        expect(general.duration).toBeLessThan(odd.duration);
        expect(ST.scrapFleetsaveFuel({ 212: 5 }, { route, speedPercent: 10 }).total).toBe(0);
    });

    it('spreads the saves over the days', () => {
        expect(plain(ST.scrapFuelPerDay({ 202: 10, 203: 0 }, 3, 2))).toEqual({ 202: 15, 203: 0 });
        // Fewer than one save, or one in fewer than one day, counts as one
        expect(plain(ST.scrapFuelPerDay({ 202: 10 }, 0, -1))).toEqual({ 202: 10 });
    });
});
