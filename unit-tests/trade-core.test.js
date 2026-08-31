'use strict';

// Pure computation tests for the trade calculator. The expected numbers are the
// ones playwright-tests/tests/trade.spec.js asserts on the rendered page, so a
// change in here that the browser would show up is caught without a browser.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const {
    TradeCalculator,
    tradeMcRate,
    getDstInputState,
    tradeMixPercent,
    tradeMixRates,
    tradeSourceSharePercent,
    tradeCargoCapacity,
    tradeCargoCount,
    tradeSourceTotal,
} = load(['js/utils.js', 'ogame/calc/js/trade-core.js'], [
    'TradeCalculator',
    'tradeMcRate',
    'getDstInputState',
    'tradeMixPercent',
    'tradeMixRates',
    'tradeSourceSharePercent',
    'tradeCargoCapacity',
    'tradeCargoCount',
    'tradeSourceTotal',
]);

// The rates behind the "2.4 : 1.5 : 1" preset button, which is what every
// numeric expectation in the Playwright suite is measured at.
const RATES = { md: 2.4, cd: 1.5, mc: tradeMcRate(2.4, 1.5) };

// The core runs in its own vm realm, so a deep-equal against an object literal
// built here fails on the prototype check alone. Compare the cargo counts in
// the form the page shows them instead.
const cargo = (c) => `${c.sc} SC / ${c.lc} LC`;

const BASE_PRM = {
    metal: 0,
    crystal: 0,
    deuterium: 0,
    srcType: 0,
    dstType: 0,
    dstMixType: 0,
    mixBalance: 50,
    mixProp1: 1,
    mixProp2: 1,
    mixSrcBalance: 50,
    fix1: 0,
    fix2: 0,
    hyperTech: 0,
    playerClass: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
};

function compute(overrides = {}) {
    return new TradeCalculator(RATES).compute({ ...BASE_PRM, ...overrides });
}

describe('Trade Calculator - exchange rates', () => {
    it('derives the metal:crystal rate from the other two', () => {
        expect(tradeMcRate(2.4, 1.5)).toBe(1.6);
        expect(tradeMcRate(3, 2)).toBe(1.5);
    });

    it('rounds the derived rate to three decimals', () => {
        // 1.85 / 1.05 = 1.7619047619...; the page shows 1.762 and every
        // destination amount has to be derived from that same value.
        expect(tradeMcRate(1.85, 1.05)).toBe(1.762);
    });

    it('returns a number, not the string the page displays', () => {
        expect(typeof tradeMcRate(2.4, 1.5)).toBe('number');
    });
});

describe('Trade Calculator - destination availability', () => {
    it('leaves the resources the source already covers unavailable', () => {
        // Selling metal, buying crystal: metal stays off, deuterium is freed.
        expect(Array.from(getDstInputState(0, 0))).toEqual([1, 0, 1]);
        // Selling metal, buying deuterium: crystal is freed instead.
        expect(Array.from(getDstInputState(0, 1))).toEqual([1, 1, 0]);
    });

    it('frees nothing for a mixed destination', () => {
        expect(Array.from(getDstInputState(0, 2))).toEqual([1, 0, 0]);
    });

    it('offers no choice when the source is already a pair', () => {
        // Selling metal + crystal leaves only deuterium to buy.
        expect(Array.from(getDstInputState(3, 0))).toEqual([1, 1, 0]);
    });
});

describe('Trade Calculator - mix split', () => {
    const mix = (overrides) => tradeMixPercent({ ...BASE_PRM, ...overrides }, RATES);

    it('takes the percentage straight from mode 0', () => {
        expect(mix({ dstMixType: 0, mixBalance: 60 })).toBe(60);
    });

    it('turns the proportion of mode 1 into a percentage', () => {
        expect(mix({ dstMixType: 1, mixProp1: 2, mixProp2: 1 })).toBeCloseTo(66.667, 3);
        expect(mix({ dstMixType: 1, mixProp1: 2, mixProp2: 3 })).toBe(40);
    });

    it('is unused by the fixed-amount modes', () => {
        expect(mix({ dstMixType: 2, mixBalance: 60 })).toBe(0);
        expect(mix({ dstMixType: 3, mixBalance: 60 })).toBe(0);
    });

    it('converts the source cut of mode 4 into a destination share', () => {
        // Half the deuterium buys metal at 2.4 and half buys crystal at 1.5,
        // so the metal is 1.2 / (1.2 + 0.75) of what comes back.
        expect(mix({ dstMixType: 4, mixSrcBalance: 50, srcType: 2 })).toBeCloseTo(61.538, 3);
        expect(mix({ dstMixType: 4, mixSrcBalance: 0, srcType: 2 })).toBe(0);
        expect(mix({ dstMixType: 4, mixSrcBalance: 100, srcType: 2 })).toBe(100);
    });

    it('clamps a source cut outside 0..100', () => {
        expect(mix({ dstMixType: 4, mixSrcBalance: 150, srcType: 2 })).toBe(100);
        expect(mix({ dstMixType: 4, mixSrcBalance: -20, srcType: 2 })).toBe(0);
    });
});

describe('Trade Calculator - source conversion rates', () => {
    it('lists what one unit of the source buys, first destination first', () => {
        const fromMetal = tradeMixRates(0, RATES);
        expect(fromMetal.first).toBeCloseTo(1 / 1.6, 10);
        expect(fromMetal.second).toBeCloseTo(1 / 2.4, 10);

        const fromCrystal = tradeMixRates(1, RATES);
        expect(fromCrystal.first).toBe(1.6);
        expect(fromCrystal.second).toBeCloseTo(1 / 1.5, 10);

        const fromDeuterium = tradeMixRates(2, RATES);
        expect(fromDeuterium.first).toBe(2.4);
        expect(fromDeuterium.second).toBe(1.5);
    });

    it('weighs the source cut by what each side buys', () => {
        // 30 % of the deuterium buys 0.72 metal per unit sold and the other
        // 70 % buys 1.05 crystal, so the metal is the smaller share of the
        // units that come back even though it is the dearer resource.
        expect(tradeSourceSharePercent(30, 2, RATES)).toBeCloseTo(40.678, 3);
        expect(tradeSourceSharePercent(30, 0, RATES)).toBeCloseTo(39.130, 3);
    });
});

describe('Trade Calculator - cargo capacity', () => {
    it('gives the Collector a quarter more hold', () => {
        const collector = tradeCargoCapacity(0, 0, 0, 0);
        expect(collector.sc).toBe(6250);
        expect(collector.lc).toBe(31250);
    });

    it('charges no class bonus to the other classes', () => {
        const other = tradeCargoCapacity(0, 1, 0, 0);
        expect(other.sc).toBe(5000);
        expect(other.lc).toBe(25000);
    });

    it('adds the Hyperspace bonus to the base rather than compounding it', () => {
        // 20 levels double the base; the Collector quarter is added on top of
        // the base, not of the doubled figure.
        const cap = tradeCargoCapacity(20, 0, 0, 0);
        expect(cap.sc).toBe(11250);
        expect(cap.lc).toBe(56250);
    });

    it('adds the universe capacity increase on top, floored', () => {
        // 5000 * 0.01 * 15 = 750; the large cargo gets 25000 * 0.01 * 15 = 3750.
        const cap = tradeCargoCapacity(0, 1, 15, 15);
        expect(cap.sc).toBe(5750);
        expect(cap.lc).toBe(28750);
    });

    it('rounds a part-filled ship up', () => {
        const count = tradeCargoCount(100000, { sc: 6250, lc: 31250 });
        expect(count.sc).toBe(16);
        expect(count.lc).toBe(4);
    });
});

describe('Trade Calculator - what is being sold', () => {
    it('is the single resource for source types 0..2', () => {
        expect(tradeSourceTotal(0, 100, 200, 300)).toBe(100);
        expect(tradeSourceTotal(1, 100, 200, 300)).toBe(200);
        expect(tradeSourceTotal(2, 100, 200, 300)).toBe(300);
    });

    it('is the sum of both for the pairs', () => {
        expect(tradeSourceTotal(3, 100, 200, 300)).toBe(300);
        expect(tradeSourceTotal(4, 100, 200, 300)).toBe(400);
        expect(tradeSourceTotal(5, 100, 200, 300)).toBe(500);
    });
});

describe('Trade Calculator - selling metal', () => {
    const SELLING = { srcType: 0, metal: 100000 };

    it('buys crystal at the metal:crystal rate', () => {
        const r = compute({ ...SELLING, dstType: 0 });
        expect(r.dc).toBe(62500);
        expect(cargo(r.dstCargo)).toBe('10 SC / 2 LC');
    });

    it('buys deuterium at the metal:deuterium rate', () => {
        const r = compute({ ...SELLING, dstType: 1 });
        expect(r.dd).toBe(41667);
        expect(cargo(r.dstCargo)).toBe('7 SC / 2 LC');
    });

    it('splits a mix by percentage', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 0, mixBalance: 60 });
        expect(r.dc).toBe(31250);
        expect(r.dd).toBe(20833);
        expect(cargo(r.dstCargo)).toBe('9 SC / 2 LC');
    });

    it('splits a mix by proportion', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 1, mixProp1: 2, mixProp2: 1 });
        expect(r.dc).toBe(35714);
        expect(r.dd).toBe(17857);
    });

    it('spends the rest on deuterium after a fixed amount of crystal', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 2, fix1: 20000 });
        expect(r.dc).toBe(20000);
        expect(r.dd).toBe(28333);
    });

    it('spends the rest on crystal after a fixed amount of deuterium', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 3, fix2: 10000 });
        expect(r.dc).toBe(47500);
        expect(r.dd).toBe(10000);
    });

    it('splits the metal itself down the middle', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 4, mixSrcBalance: 50 });
        // 50000 metal buys 31250 crystal, the other 50000 buys 20833 deuterium.
        expect(r.dc).toBe(31250);
        expect(r.dd).toBe(20833);
    });

    it('caps a fixed amount at what the metal is actually worth', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 2, fix1: 999999 });
        // 100000 metal buys 62500 crystal and nothing is left for deuterium.
        expect(r.dc).toBe(62500);
        expect(r.dd).toBe(0);
    });
});

describe('Trade Calculator - selling crystal', () => {
    const SELLING = { srcType: 1, crystal: 100000 };

    it('buys metal at the metal:crystal rate', () => {
        const r = compute({ ...SELLING, dstType: 0 });
        expect(r.dm).toBe(160000);
        expect(cargo(r.dstCargo)).toBe('26 SC / 6 LC');
    });

    it('buys deuterium at the crystal:deuterium rate', () => {
        const r = compute({ ...SELLING, dstType: 1 });
        expect(r.dd).toBe(66667);
        expect(cargo(r.dstCargo)).toBe('11 SC / 3 LC');
    });

    it('splits a mix by percentage', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 0, mixBalance: 60 });
        expect(r.dm).toBe(61538);
        expect(r.dd).toBe(41026);
        expect(cargo(r.dstCargo)).toBe('17 SC / 4 LC');
    });

    it('splits a mix by proportion', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 1, mixProp1: 2, mixProp2: 3 });
        expect(r.dm).toBe(34783);
        expect(r.dd).toBe(52174);
    });

    it('spends the rest on deuterium after a fixed amount of metal', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 2, fix1: 20000 });
        expect(r.dm).toBe(20000);
        expect(r.dd).toBe(58333);
    });

    it('spends the rest on metal after a fixed amount of deuterium', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 3, fix2: 10000 });
        expect(r.dm).toBe(136000);
        expect(r.dd).toBe(10000);
    });

    it('spends a quarter of the crystal on metal and the rest on deuterium', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 4, mixSrcBalance: 25 });
        expect(r.dm).toBe(40000);
        expect(r.dd).toBe(50000);
    });
});

describe('Trade Calculator - selling deuterium', () => {
    const SELLING = { srcType: 2, deuterium: 100000 };

    it('buys metal at the metal:deuterium rate', () => {
        const r = compute({ ...SELLING, dstType: 0 });
        expect(r.dm).toBe(240000);
        expect(cargo(r.dstCargo)).toBe('39 SC / 8 LC');
    });

    it('buys crystal at the crystal:deuterium rate', () => {
        const r = compute({ ...SELLING, dstType: 1 });
        expect(r.dc).toBe(150000);
        expect(cargo(r.dstCargo)).toBe('24 SC / 5 LC');
    });

    it('splits a mix by percentage', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 0, mixBalance: 60 });
        expect(r.dm).toBe(116129);
        expect(r.dc).toBe(77419);
        expect(cargo(r.dstCargo)).toBe('31 SC / 7 LC');
    });

    it('splits a mix by proportion', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 1, mixProp1: 2, mixProp2: 1 });
        expect(r.dm).toBe(133333);
        expect(r.dc).toBe(66667);
        expect(cargo(r.dstCargo)).toBe('32 SC / 7 LC');
    });

    it('spends the rest on crystal after a fixed amount of metal', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 2, fix1: 20000 });
        expect(r.dm).toBe(20000);
        expect(r.dc).toBe(137500);
    });

    it('spends the rest on metal after a fixed amount of crystal', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 3, fix2: 10000 });
        expect(r.dm).toBe(224000);
        expect(r.dc).toBe(10000);
    });

    // The letter of the 2013 request this mode exists for: sell half the
    // deuterium for metal and half for crystal, in one deal.
    it('splits the deuterium itself down the middle', () => {
        const r = compute({ ...SELLING, dstType: 2, dstMixType: 4, mixSrcBalance: 50 });
        expect(r.dm).toBe(120000);
        expect(r.dc).toBe(75000);
    });

    it('puts everything on one resource at the ends of the range', () => {
        const allMetal = compute({ ...SELLING, dstType: 2, dstMixType: 4, mixSrcBalance: 100 });
        expect(allMetal.dm).toBe(240000);
        expect(allMetal.dc).toBe(0);

        const allCrystal = compute({ ...SELLING, dstType: 2, dstMixType: 4, mixSrcBalance: 0 });
        expect(allCrystal.dm).toBe(0);
        expect(allCrystal.dc).toBe(150000);
    });
});

describe('Trade Calculator - selling a pair', () => {
    it('turns metal and crystal into deuterium', () => {
        const r = compute({ srcType: 3, metal: 100000, crystal: 50000 });
        expect(r.dd).toBe(75000);
        expect(cargo(r.srcCargo)).toBe('24 SC / 5 LC');
        expect(cargo(r.dstCargo)).toBe('12 SC / 3 LC');
    });

    it('turns metal and deuterium into crystal', () => {
        const r = compute({ srcType: 4, metal: 100000, deuterium: 50000 });
        expect(r.dc).toBe(137500);
        expect(cargo(r.srcCargo)).toBe('24 SC / 5 LC');
        expect(cargo(r.dstCargo)).toBe('22 SC / 5 LC');
    });

    it('turns crystal and deuterium into metal', () => {
        const r = compute({ srcType: 5, crystal: 100000, deuterium: 50000 });
        expect(r.dm).toBe(280000);
        expect(cargo(r.srcCargo)).toBe('24 SC / 5 LC');
        expect(cargo(r.dstCargo)).toBe('45 SC / 9 LC');
    });
});

describe('Trade Calculator - cargo counts follow the ship bonuses', () => {
    it('needs fewer ships once Hyperspace Technology is trained', () => {
        const prm = {
            srcType: 0, metal: 100000, dstType: 2, dstMixType: 3, fix2: 10000,
        };
        const plain = compute(prm);
        const trained = compute({ ...prm, hyperTech: 20 });

        expect(cargo(plain.srcCargo)).toBe('16 SC / 4 LC');
        expect(cargo(trained.srcCargo)).toBe('9 SC / 2 LC');
        expect(cargo(trained.dstCargo)).toBe('6 SC / 2 LC');
    });

    it('counts the destination ships from the rounded amounts', () => {
        const r = compute({ srcType: 0, metal: 100000, dstType: 1 });
        // 41666.67 rounds to 41667 before the ships are counted.
        expect(r.dstTotal).toBe(41667);
    });

    it('asks for no ships while nothing is being traded', () => {
        const r = compute();
        expect(cargo(r.srcCargo)).toBe('0 SC / 0 LC');
        expect(cargo(r.dstCargo)).toBe('0 SC / 0 LC');
    });
});
