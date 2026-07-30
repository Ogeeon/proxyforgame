'use strict';

// Pure computation tests for the moon calculator, moved out of the Playwright suite:
// MoonCalculator touches no DOM. Test bodies are unchanged from
// playwright-tests/tests/moon.spec.js — only the plumbing above them differs.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { MoonCalculator } = load(['js/utils.js', 'ogame/calc/js/moon-core.js'], ['MoonCalculator']);

const BASE_PRM = {
    moonSize: 1,
    dsCount: 1,
    debrisPercent: 30,
    hyperTechLevel: 0,
    isGeneral: false,
    rcCapacityIncrease: 0,
    defenseToDebris: false,
    deutToDebris: false,
    promoMoon: false,
    supraRefractorLevel: 0,
    counts: {},
};

function compute(overrides = {}) {
    return new MoonCalculator().compute({ ...BASE_PRM, ...overrides });
}

describe('Moon Calculator - Destruction', () => {
    it('destruction chance follows (100 - sqrt(size)) * sqrt(ds)', () => {
        // sqrt(2500) = 50 -> (100 - 50) * sqrt(1) = 50
        const r = compute({ moonSize: 2500, dsCount: 1 });
        expect(r.destroyChance).toBe(50);
    });

    it('more Death Stars raise the destruction chance', () => {
        const one = compute({ moonSize: 8000, dsCount: 1 });
        const four = compute({ moonSize: 8000, dsCount: 4 });
        expect(four.destroyChance).toBeCloseTo(one.destroyChance * 2, 6);
    });

    it('the destruction chance is capped at 100%', () => {
        const r = compute({ moonSize: 2500, dsCount: 100 });
        expect(r.destroyChance).toBe(100);
    });

    it('the Death Star blow chance is half the square root of the diameter', () => {
        const r = compute({ moonSize: 2500 });
        expect(r.blowChance).toBe(25);
    });
});

describe('Moon Calculator - Creation', () => {
    it('fleet feeds the debris field at the universe debris rate', () => {
        // 100 light fighters: 300000 metal / 100000 crystal, 30% into the field.
        const r = compute({ counts: { 'light-fighter': 100 } });
        expect(r.metalRequired).toBe(300000);
        expect(r.crystalRequired).toBe(100000);
        expect(r.recyclableMetal).toBe(90000);
        expect(r.recyclableCrystal).toBe(30000);
        expect(r.debrisTotal).toBe(120000);
        // 100k of debris is worth 1% -> 120k is 1.2%.
        expect(r.createChance).toBeCloseTo(0.012, 10);
    });

    it('solar satellites always contribute, without any toggle', () => {
        // Satellites cannot leave the planet, so they always die and always
        // land in the debris field: 1000 * 2000 crystal * 30% = 600000.
        const r = compute({ counts: { 'solar-sat': 1000 } });
        expect(r.debrisTotal).toBe(600000);
        expect(r.createChance).toBeCloseTo(0.06, 10);
    });

    it('defenses only feed the debris field when the setting is on', () => {
        const counts = { 'plasma-turret': 10 }; // 500000 metal / 500000 crystal
        const off = compute({ counts });
        const on = compute({ counts, defenseToDebris: true });

        // The build cost is shown either way — the resources were spent.
        expect(off.metalRequired).toBe(500000);
        expect(on.metalRequired).toBe(500000);

        expect(off.debrisTotal).toBe(0);
        expect(on.debrisTotal).toBe(300000);
        expect(on.createChance).toBeCloseTo(0.03, 10);
    });

    it('deuterium only feeds the debris field when the setting is on', () => {
        const counts = { 'solar-sat': 1000 }; // 2000 crystal + 500 deuterium each
        const off = compute({ counts });
        const on = compute({ counts, deutToDebris: true });

        expect(off.recyclableDeut).toBe(0);
        expect(on.recyclableDeut).toBe(150000); // 500000 * 30%
        expect(on.debrisTotal).toBe(off.debrisTotal + 150000);
    });

    it('the moon chance is capped at 20%', () => {
        // A single Death Star already drops 2.7M of debris - far past the cap.
        const r = compute({ counts: { 'death-star': 1 } });
        expect(r.debrisTotal).toBe(2700000);
        expect(r.chanceCap).toBe(0.20);
        expect(r.createChance).toBe(0.20);
    });

    it('the promo event raises the cap to 40%', () => {
        const r = compute({ counts: { 'death-star': 1 }, promoMoon: true });
        expect(r.chanceCap).toBe(0.40);
        // 2.7M of debris is 27%, which now fits below the raised cap.
        expect(r.createChance).toBeCloseTo(0.27, 10);
    });

    it('the promo cap is still a cap', () => {
        const r = compute({ counts: { 'death-star': 2 }, promoMoon: true });
        expect(r.createChance).toBe(0.40);
    });

    it('recyclers carry the whole field, deuterium included', () => {
        const counts = { 'light-fighter': 100 }; // 120000 debris at 30%
        const plain = compute({ counts });
        // Base recycler hold is 20000.
        expect(plain.recyclers).toBe(6);

        // Hyperspace technology adds 5% per level: 20000 * 1.5 = 30000.
        const teched = compute({ counts, hyperTechLevel: 10 });
        expect(teched.recyclers).toBe(Math.ceil(120000 / 30000));
    });

    it('the recycler hold grows with the general class and the LF increase', () => {
        const counts = { 'light-fighter': 100 }; // 120000 debris at 30%
        const plain = compute({ counts });
        expect(plain.recyclerCapacity).toBe(20000);

        // The General adds 20% of the base hold.
        const general = compute({ counts, isGeneral: true });
        expect(general.recyclerCapacity).toBe(20000 * 1.2);
        expect(general.recyclers).toBe(Math.ceil(120000 / 24000));

        // The life-form increase adds floor(base * increase%).
        const lf = compute({ counts, rcCapacityIncrease: 50 });
        expect(lf.recyclerCapacity).toBe(20000 + 10000);
        expect(lf.recyclers).toBe(Math.ceil(120000 / 30000));
    });

    it('the class and LF bonuses are additive, not scaled by hyperspace tech', () => {
        // 20000*1.5 + 20000*0.2 + floor(20000*0.5) = 30000 + 4000 + 10000,
        // NOT 20000 * 1.5 * 1.2 * 1.5.
        const r = compute({
            hyperTechLevel: 10, isGeneral: true, rcCapacityIncrease: 50,
        });
        expect(r.recyclerCapacity).toBe(44000);
    });

    it('a bigger recycler hold lowers the recyclers needed', () => {
        const counts = { 'light-fighter': 100 };
        const plain = compute({ counts });
        const boosted = compute({ counts, isGeneral: true, rcCapacityIncrease: 100 });
        // The debris field is unchanged; only the hold grows.
        expect(boosted.debrisTotal).toBe(plain.debrisTotal);
        expect(boosted.recyclers).toBeLessThan(plain.recyclers);
    });

    it('deuterium in the field raises the recyclers needed', () => {
        const counts = { cruiser: 100 }; // 2000 deuterium each
        const off = compute({ counts });
        const on = compute({ counts, deutToDebris: true });
        expect(on.recyclers).toBeGreaterThan(off.recyclers);
        expect(on.recyclers).toBe(Math.ceil(on.debrisTotal / 20000));
    });

    it('a higher debris rate raises both the chance and the recyclers', () => {
        const counts = { 'light-fighter': 100 };
        const low = compute({ counts, debrisPercent: 30 });
        const high = compute({ counts, debrisPercent: 60 });
        expect(high.debrisTotal).toBe(low.debrisTotal * 2);
        expect(high.createChance).toBeCloseTo(low.createChance * 2, 10);
        expect(high.recyclers).toBeGreaterThan(low.recyclers);
    });
});

describe('Moon Calculator - Moon size', () => {
    it('a full debris field yields the eleven known maximum-moon diameters', () => {
        expect(Array.from(MoonCalculator.moonSizes(2000000, 0))).toEqual([
            8366, 8426, 8485, 8544, 8602, 8660, 8717, 8774, 8831, 8888, 8944,
        ]);
    });

    it('the smallest field the game gives a moon for starts at 3605 km', () => {
        // 100k of debris is the 1% minimum chance, and X = 0 is the worst roll.
        const sizes = MoonCalculator.moonSizes(100000, 0);
        expect(sizes[0]).toBe(3605);
        expect(sizes[sizes.length - 1]).toBe(4795);
    });

    it('a bigger field shifts the whole range up', () => {
        const small = MoonCalculator.moonSizes(1000000, 0);
        const big = MoonCalculator.moonSizes(2000000, 0);
        expect(small[0]).toBe(6324);
        expect(big[0]).toBeGreaterThan(small[small.length - 1]);
    });

    it('debris past the 20% cap no longer grows the moon', () => {
        // 2M is the cap; 4M rolls exactly the same diameters.
        expect(Array.from(MoonCalculator.moonSizes(4000000, 0))).toEqual(
            Array.from(MoonCalculator.moonSizes(2000000, 0))
        );
    });

    it('no debris means no moon at all', () => {
        expect(Array.from(MoonCalculator.moonSizes(0, 0))).toEqual([]);
    });

    it('the Supra Refractor scales every diameter by 0.5% per level', () => {
        const plain = MoonCalculator.moonSizes(2000000, 0);
        const boosted = MoonCalculator.moonSizes(2000000, 10);
        expect(boosted[0]).toBe(Math.floor(1000 * Math.sqrt(70) * 1.05));
        expect(boosted[10]).toBe(9391);
        expect(boosted[0]).toBeGreaterThan(plain[0]);
    });

    it('the Supra Refractor cannot push the diameter past 9400 km', () => {
        const sizes = MoonCalculator.moonSizes(2000000, 20);
        expect(sizes[sizes.length - 1]).toBe(9400);
        // The lower rolls are still below the cap, so they keep the bonus.
        expect(sizes[0]).toBe(9203);
    });

    it('the event chance raises the chance but never the moon', () => {
        const counts = { 'death-star': 1 }; // 2.7M of debris
        const plain = compute({ counts });
        const promo = compute({ counts, promoMoon: true });
        expect(promo.createChance).toBeGreaterThan(plain.createChance);
        expect(Array.from(promo.moonSizes)).toEqual(Array.from(plain.moonSizes));
    });

    it('the size range is exposed alongside the full roll list', () => {
        const r = compute({ counts: { 'death-star': 1 } });
        expect(r.moonSizes.length).toBe(11);
        expect(r.moonSizeMin).toBe(8366);
        expect(r.moonSizeMax).toBe(8944);
    });

    it('an empty battle has no size range at all', () => {
        const r = compute();
        expect(Array.from(r.moonSizes)).toEqual([]);
        expect(r.moonSizeMin).toBeNull();
        expect(r.moonSizeMax).toBeNull();
    });

    it('the diameter follows the debris field, not the fleet composition', () => {
        // 500 light fighters and 200 heavy fighters both leave 600k of debris
        // at 30%: (3000 + 1000) * 500 == (6000 + 4000) * 200.
        const light = compute({ counts: { 'light-fighter': 500 } });
        const heavy = compute({ counts: { 'heavy-fighter': 200 } });
        expect(heavy.debrisTotal).toBe(light.debrisTotal);
        expect(Array.from(heavy.moonSizes)).toEqual(Array.from(light.moonSizes));
    });
});

describe('Moon Calculator - Supra Refractor', () => {
    it('every level adds 0.5% to the creation chance and to its cap', () => {
        const counts = { 'light-fighter': 100 }; // 120000 debris -> 1.2%
        const r = compute({ counts, supraRefractorLevel: 10 });
        expect(r.createChance).toBeCloseTo(0.012 * 1.05, 10);
        expect(r.chanceCap).toBeCloseTo(0.21, 10);
    });

    it('the boosted cap lets the chance pass the bare 20%', () => {
        const r = compute({ counts: { 'death-star': 1 }, supraRefractorLevel: 20 });
        expect(r.createChance).toBeCloseTo(0.22, 10);
    });

    it('the debris needed for the maximum chance is unchanged', () => {
        // The building lifts the chance and the cap by the same factor, so the
        // per-unit counts that max the chance out must not move.
        const plain = compute();
        const boosted = compute({ supraRefractorLevel: 20 });
        expect(boosted.maxCounts['light-fighter']).toBe(plain.maxCounts['light-fighter']);
    });
});

describe('Moon Calculator - Units for the maximum chance', () => {
    it('a unit count reaches the 2M debris the 20% cap needs', () => {
        // Light fighter: (3000 + 1000) * 30% = 1200 of debris each.
        const r = compute();
        expect(r.maxCounts['light-fighter']).toBe(Math.ceil(2000000 / 1200));
        // Espionage probes only carry crystal: 1000 * 30% = 300 each.
        expect(r.maxCounts['esp-probe']).toBe(Math.ceil(2000000 / 300));
    });

    it('the promo cap doubles the units needed', () => {
        const plain = compute();
        const promo = compute({ promoMoon: true });
        expect(promo.maxCounts['light-fighter']).toBe(2 * plain.maxCounts['light-fighter']);
    });

    it('deuterium counted in the field lowers the units needed', () => {
        const off = compute();
        const on = compute({ deutToDebris: true });
        // The cruiser carries deuterium, the light fighter does not.
        expect(on.maxCounts.cruiser).toBeLessThan(off.maxCounts.cruiser);
        expect(on.maxCounts['light-fighter']).toBe(off.maxCounts['light-fighter']);
    });

    it('defenses have no maximum while they stay out of the field', () => {
        const off = compute();
        expect(off.maxCounts['plasma-turret']).toBeNull();

        const on = compute({ defenseToDebris: true });
        // (50000 + 50000) * 30% = 30000 of debris each.
        expect(on.maxCounts['plasma-turret']).toBe(Math.ceil(2000000 / 30000));
    });

    it('a rocket launcher with no deuterium value still has a maximum', () => {
        const r = compute({ defenseToDebris: true });
        expect(r.maxCounts['rocket-launcher']).toBe(Math.ceil(2000000 / (2000 * 0.3)));
    });
});
