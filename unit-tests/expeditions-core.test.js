'use strict';

// Pure computation tests for the expeditions calculator, moved out of the Playwright
// suite: ExpeditionsCalculator touches no DOM. Test bodies are unchanged from
// playwright-tests/tests/expeditions.spec.js — only the plumbing above them differs.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { ExpeditionsCalculator } = load(
    ['js/utils.js', 'ogame/calc/js/expeditions-core.js'],
    ['ExpeditionsCalculator'],
);

const BASE_PRM = {
    highTop: 40000,
    playerClass: 0, // Discoverer
    universeSpeed: 1,
    hyperTechLevel: 0,
    percentRes: 0,
    percentShips: 0,
    classBonusCollector: 0,
    classBonusDiscoverer: 0,
    darkMatterDiscoveryBonus: 0,
    resourceDiscoveryBooster: 0,
    lfShipsBonuses: new Array(15).fill(0),
    counts: {},
};

function compute(overrides = {}) {
    return new ExpeditionsCalculator().compute({ ...BASE_PRM, ...overrides });
}

describe('Expeditions Calculator - Cargo capacity', () => {
    it('capacity is the sum of the base capacities', () => {
        const r = compute({ counts: { LC: 10, SC: 4 } });
        expect(r.capacity).toBe(10 * 25000 + 4 * 5000);
    });

    it('hyperspace technology adds 5% per level', () => {
        const r = compute({ counts: { LC: 10 }, hyperTechLevel: 8 });
        expect(r.capacity).toBe(350000); // 250000 * 1.4
    });

    it('a Collector carries 25% more in its transports', () => {
        const r = compute({ playerClass: 1, counts: { LC: 10 } });
        expect(r.capacity).toBe(312500);
    });

    it('the Collector class bonus raises that 25%', () => {
        const r = compute({ playerClass: 1, classBonusCollector: 20, counts: { LC: 10 } });
        // floor(250000 * 0.25 * 1.2) = 75000 on top of the base
        expect(r.capacity).toBe(325000);
    });

    it('the Collector bonus applies to transports only', () => {
        const r = compute({ playerClass: 1, counts: { RC: 10 } });
        expect(r.capacity).toBe(200000);
    });

    it('a General carries 20% more in recyclers and pathfinders', () => {
        const recyclers = compute({ playerClass: 2, counts: { RC: 10 } });
        expect(recyclers.capacity).toBe(240000);

        const pathfinders = compute({ playerClass: 2, counts: { PA: 10 } });
        expect(pathfinders.capacity).toBe(120000); // 10 * 10000 * 1.2

        const discoverer = compute({ playerClass: 0, counts: { RC: 10 } });
        expect(discoverer.capacity).toBe(200000);
    });

    it('the life-form cargo bonus is added on top of the base capacity', () => {
        const bonuses = new Array(15).fill(0);
        bonuses[1] = 10; // large cargo
        const r = compute({ counts: { LC: 10 }, lfShipsBonuses: bonuses });
        expect(r.capacity).toBe(275000);
    });

    it('espionage probes carry nothing', () => {
        const r = compute({ counts: { EP: 100 }, hyperTechLevel: 20 });
        expect(r.capacity).toBe(0);
    });
});

describe('Expeditions Calculator - Expedition points', () => {
    it('a Discoverer scales the yield with the universe speed', () => {
        const slow = compute({ universeSpeed: 1 });
        expect(slow.maxPoints).toBe(60000); // 1.5 * 1 * 40000

        const fast = compute({ universeSpeed: 5 });
        expect(fast.maxPoints).toBe(300000);
    });

    it('other classes get a flat yield, unaffected by the universe speed', () => {
        const r = compute({ playerClass: 2, universeSpeed: 5 });
        expect(r.maxPoints).toBe(40000);
    });

    it('a pathfinder doubles the yield, or triples it for a Discoverer', () => {
        const discoverer = compute({ counts: { PA: 1 } });
        expect(discoverer.maxPoints).toBe(120000); // 3 * 1 * 40000

        const other = compute({ playerClass: 2, counts: { PA: 1 } });
        expect(other.maxPoints).toBe(80000);
    });

    it('the Discoverer class bonus only helps a Discoverer', () => {
        const discoverer = compute({ classBonusDiscoverer: 50 });
        expect(discoverer.maxPoints).toBe(90000);

        const other = compute({ playerClass: 2, classBonusDiscoverer: 50 });
        expect(other.maxPoints).toBe(40000);
    });

    it('the expedition resource bonus raises the yield', () => {
        const r = compute({ percentRes: 10 });
        expect(r.maxPoints).toBe(66000);
    });

    it('the minimum large cargo count covers the maximum find', () => {
        const r = compute();
        expect(r.minLC).toBe(3); // ceil(60000 / 25000)

        const boosted = compute({ hyperTechLevel: 8 });
        expect(boosted.minLC).toBe(2); // ceil(60000 / 35000)
    });
});

describe('Expeditions Calculator - Resource and Dark Matter finds', () => {
    it('crystal is half and deuterium a third of the metal find', () => {
        const r = compute({ counts: { LC: 10 } });
        expect(r.maxFindMetal).toBe(60000);
        expect(r.maxFindCrystal).toBe(30000);
        expect(r.maxFindDeuterium).toBe(20000);
        expect(r.capacityExceeded).toBe(false);
    });

    it('the find is capped by what the fleet can carry', () => {
        const r = compute({ counts: { LC: 1 } });
        expect(r.maxFindMetal).toBe(25000);
        expect(r.maxFindCrystal).toBe(25000);
        expect(r.maxFindDeuterium).toBe(20000);
        expect(r.capacityExceeded).toBe(true);
    });

    it('the resource discovery booster raises the find but not the points', () => {
        const r = compute({ counts: { LC: 10 }, resourceDiscoveryBooster: 20 });
        expect(r.maxFindMetal).toBe(72000);
        expect(r.maxPoints).toBe(60000);
    });

    it('an empty fleet finds nothing', () => {
        const r = compute();
        expect(r.capacity).toBe(0);
        expect(r.maxFindMetal).toBe(0);
    });

    it('Dark Matter starts at 1800 and follows its discovery bonus', () => {
        const plain = compute();
        expect(plain.darkMatter).toBe(1800);

        const boosted = compute({ darkMatterDiscoveryBonus: 50 });
        expect(boosted.darkMatter).toBe(2700);
    });
});

describe('Expeditions Calculator - Findable ships', () => {
    it('sending a ship unlocks its own tier and the next one up', () => {
        const r = compute({ counts: { EP: 1 } });
        expect(r.canFind.EP).toBe(true);
        expect(r.canFind.SC).toBe(true);
        expect(r.canFind.LF).toBe(false);
    });

    it('the heaviest ship unlocks every findable tier', () => {
        const r = compute({ counts: { RE: 1 } });
        ['EP', 'SC', 'LF', 'LC', 'HF', 'CR', 'PA', 'BS', 'BC', 'BM', 'DR', 'RE']
            .forEach((abbrev) => expect(r.canFind[abbrev]).toBe(true));
    });

    it('recyclers, colony ships and death stars are never found', () => {
        const r = compute({ counts: { RE: 1, RC: 10, CS: 10, DS: 10 } });
        expect(r.canFind.RC).toBe(false);
        expect(r.canFind.CS).toBe(false);
        expect(r.canFind.DS).toBe(false);
    });

    it('a fleet of recyclers alone unlocks nothing', () => {
        const r = compute({ counts: { RC: 10 } });
        expect(Object.values(r.canFind).every((v) => v === false)).toBe(true);
        expect(r.findCounts.EP).toBe(0);
    });

    it('found ships are paid for out of the expedition points', () => {
        // capacity 250000 > 60000 points, so the points are the limit.
        const r = compute({ counts: { LC: 10, EP: 1 } });
        expect(r.findCounts.EP).toBe(60);  // 60000 / 1000
        expect(r.findCounts.SC).toBe(15);  // 60000 / 4000
        expect(r.findCounts.LC).toBe(5);   // 60000 / 12000
        // A large cargo unlocks one tier above itself, and no further.
        expect(r.findCounts.HF).toBe(6);   // 60000 / 10000
        expect(r.findCounts.CR).toBe(0);
    });

    it('the expedition ship bonus raises the number found', () => {
        const r = compute({ counts: { LC: 10, EP: 1 }, percentShips: 10 });
        expect(r.findCounts.EP).toBe(66);
        expect(r.findCounts.SC).toBe(16);
    });

    it('a small fleet caps the find by its own capacity', () => {
        // capacity 5000 < 60000 points, but the pool never drops below 10000.
        const r = compute({ counts: { SC: 1 } });
        expect(r.findCounts.EP).toBe(10); // 10000 / 1000
    });
});
