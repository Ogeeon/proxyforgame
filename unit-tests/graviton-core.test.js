'use strict';

// Pure computation tests for the graviton calculator, moved out of the Playwright
// suite: GravitonCalculator touches no DOM, so exercising it through a browser only
// bought a page load per assertion. The test bodies are unchanged from
// playwright-tests/tests/graviton.spec.js — only the plumbing above them differs.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// utils.js first: graviton-core calls dropFraction() from it.
const { GravitonCalculator } = load(
    ['js/utils.js', 'ogame/calc/js/graviton-core.js'],
    ['GravitonCalculator'],
);

const BASE_PRM = {
    shipyardLevel: 1,
    nanitesFactoryLevel: 0,
    universeSpeed: 1,
    energyTechLevel: 0,
    hyperTechLevel: 0,
    maxPlanetTemp: 0,
    energyBonus: 0,
    solarPlantLevel: 0,
    solarPlantPercent: 100,
    fusionPlantLevel: 0,
    fusionPlantPercent: 100,
    solarSatellitesCount: 0,
    solarSatellitesPercent: 100,
    debrisPercent: 30,
    playerClass: 0,
    isTrader: false,
    energyBoost: 0,
    disChLevel: 0,
    gravitonLevel: 1,
    totalLFEnrgBonus: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    rcCapacityIncrease: 0,
    crysAvailable: 0,
    deutAvailable: 0,
    deutInDebris: false,
};

function compute(overrides = {}) {
    return new GravitonCalculator().compute({ ...BASE_PRM, ...overrides });
}

// classBonus is the additive class fraction (0.25 Collector transports,
// 0.20 General recyclers, 0 otherwise).
const capacity = (base, hyper, classBonus, inc) =>
    GravitonCalculator.cargoCapacity(base, hyper, classBonus, inc);

describe('Graviton Calculator - Core computation', () => {
    it('solar plant energy follows the OGame formula', () => {
        // floor(0.01 * 100 * floor(20 * 10 * 1.1^10)) = floor(20*10*2.59374...) = 518
        const r = compute({ solarPlantLevel: 10 });
        expect(r.solarPlantEnergy).toBe(518);
    });

    it('fusion plant energy grows with energy technology', () => {
        const plain = compute({ fusionPlantLevel: 10, energyTechLevel: 0 });
        const teched = compute({ fusionPlantLevel: 10, energyTechLevel: 12 });
        expect(teched.fusionPlantEnergy).toBeGreaterThan(plain.fusionPlantEnergy);
    });

    it('solar satellites depend on planet temperature', () => {
        // baseEnergyPerSat = 0.01*100*floor((maxTemp+140)/6); 100 sats
        const cold = compute({ solarSatellitesCount: 100, maxPlanetTemp: 0 });
        const hot = compute({ solarSatellitesCount: 100, maxPlanetTemp: 60 });
        expect(cold.solarSatsEnergy).toBe(100 * Math.floor((0 + 140) / 6));   // 100 * 23
        expect(hot.solarSatsEnergy).toBe(100 * Math.floor((60 + 140) / 6));   // 100 * 33
    });

    it('graviton level 1 requires 300k energy', () => {
        const r = compute({ gravitonLevel: 1 });
        expect(r.energyRequirement).toBe(300000);
    });

    it('each graviton level triples the requirement', () => {
        const l1 = compute({ gravitonLevel: 1 });
        const l2 = compute({ gravitonLevel: 2 });
        const l3 = compute({ gravitonLevel: 3 });
        expect(l2.energyRequirement).toBe(l1.energyRequirement * 3);
        expect(l3.energyRequirement).toBe(l1.energyRequirement * 9);
    });

    it('graviton level 0 requires no energy', () => {
        const r = compute({ gravitonLevel: 0 });
        expect(r.energyRequirement).toBe(0);
        expect(r.neededSats).toBe(0);
    });

    it('satellites cover the requirement shortfall', () => {
        // No plants, so all 300k must come from satellites.
        // energyPerSat = baseEnergyPerSat = 0.01*100*floor(140/6) = 23
        const r = compute({ gravitonLevel: 1 });
        expect(r.feasible).toBe(true);
        expect(r.energyPerSat).toBe(23);
        expect(r.neededSats).toBe(Math.ceil(300000 / 23));
        expect(r.crysNeeded).toBe(r.neededSats * 2000);
        expect(r.deutNeeded).toBe(r.neededSats * 500);
    });

    it('a strong solar plant lowers the satellites needed', () => {
        const weak = compute({ gravitonLevel: 1, solarPlantLevel: 0 });
        const strong = compute({ gravitonLevel: 1, solarPlantLevel: 30 });
        expect(strong.neededSats).toBeLessThan(weak.neededSats);
    });

    it('zero per-satellite yield is flagged as infeasible', () => {
        // 0% satellite output leaves energyPerSat at 0 -> the shortfall can
        // never be covered, so the result is flagged infeasible.
        const r = compute({ gravitonLevel: 1, solarSatellitesPercent: 0 });
        expect(r.feasible).toBe(false);
        expect(r.neededSats).toBe(Infinity);
    });

    it('build time scales down with universe speed', () => {
        const x1 = compute({ gravitonLevel: 1, universeSpeed: 1 });
        const x5 = compute({ gravitonLevel: 1, universeSpeed: 5 });
        expect(x5.secsTotal).toBeLessThan(x1.secsTotal);
    });

    it('collector class adds a 10% energy bonus', () => {
        const base = compute({ solarPlantLevel: 20 });
        const collector = compute({ solarPlantLevel: 20, playerClass: 1 });
        expect(collector.classEnergyBonus).toBe(Math.floor(0.1 * base.solarPlantEnergy));
        expect(collector.availableEnergy).toBeGreaterThan(base.availableEnergy);
    });

    it('only the collector class boosts energy', () => {
        // The General (2) grants no energy bonus — only cargo perks.
        const general = compute({ solarPlantLevel: 20, playerClass: 2 });
        expect(general.classEnergyBonus).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Cargo capacity. Mirrors the costs calculator: the transport holds grow with
// hyperspace tech, the Collector bonus and the life-form capacity increase —
// all added to the base, never multiplied together.
// ---------------------------------------------------------------------------

describe('Graviton Calculator - Cargo capacity', () => {
    it('base capacity with no bonuses', () => {
        expect(capacity(5000, 0, 0, 0)).toBe(5000);
        expect(capacity(25000, 0, 0, 0)).toBe(25000);
    });

    it('hyperspace technology adds 5% per level', () => {
        expect(capacity(5000, 10, 0, 0)).toBe(5000 * 1.5);
        expect(capacity(25000, 20, 0, 0)).toBe(25000 * 2);
    });

    it('the class bonus is additive, not scaled by hyperspace tech', () => {
        // 5000*1.5 + 5000*0.25 = 8750, NOT 5000*1.5*1.25 = 9375 (the old bug).
        expect(capacity(5000, 10, 0.25, 0)).toBe(5000 * 1.5 + 5000 * 0.25);
        expect(capacity(25000, 10, 0.25, 0)).toBe(25000 * 1.5 + 25000 * 0.25);
        // General recyclers add +20% the same way.
        expect(capacity(20000, 10, 0.20, 0)).toBe(20000 * 1.5 + 20000 * 0.20);
    });

    it('cargo capacity increase adds floor(base * increase%)', () => {
        expect(capacity(5000, 0, 0, 100)).toBe(10000);
        expect(capacity(25000, 0, 0, 50)).toBe(25000 + 12500);
        // Fractional percentages are floored on the base contribution.
        expect(capacity(5000, 0, 0, 33)).toBe(5000 + Math.floor(5000 * 0.33));
    });

    it('transports use the capacity-adjusted cargo holds', () => {
        const plain = compute({ gravitonLevel: 1 });
        const sum = plain.crysNeeded + plain.deutNeeded;
        expect(plain.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(plain.lcNeeded).toBe(Math.ceil(sum / 25000));
    });

    it('cargo capacity increase lowers the transports needed', () => {
        const plain = compute({ gravitonLevel: 1 });
        const boosted = compute({
            gravitonLevel: 1, scCapacityIncrease: 100, lcCapacityIncrease: 100,
        });
        expect(boosted.scNeeded).toBeLessThan(plain.scNeeded);
        expect(boosted.lcNeeded).toBeLessThan(plain.lcNeeded);
        // +100% SC capacity doubles the hold (5000 -> 10000), halving the count.
        const sum = boosted.crysNeeded + boosted.deutNeeded;
        expect(boosted.scNeeded).toBe(Math.ceil(sum / 10000));
    });

    it('recycler capacity uses the 20000 hold with the general bonus', () => {
        expect(capacity(20000, 0, 0, 0)).toBe(20000);
        expect(capacity(20000, 10, 0, 50)).toBe(20000 * 1.5 + Math.floor(20000 * 0.5));
    });

    it('recycler capacity increase lowers the recyclers needed', () => {
        const plain = compute({ gravitonLevel: 1 });
        const boosted = compute({ gravitonLevel: 1, rcCapacityIncrease: 100 });
        // The debris field is unchanged; only the recycler hold grows.
        expect(boosted.dfAmount).toBe(plain.dfAmount);
        expect(boosted.rcNeeded).toBeLessThan(plain.rcNeeded);
        // +100% doubles the recycler hold (20000 -> 40000).
        expect(boosted.rcNeeded).toBe(Math.ceil(boosted.dfAmount / 40000));
    });

    it('the collector bonus does not apply to the recycler hold', () => {
        // The Collector raises the per-satellite energy (fewer sats -> smaller
        // debris), but the recycler *hold* stays at the base 20000: rcNeeded is
        // dfAmount / 20000, not dfAmount / 25000 (which a +25% hold would give).
        const collector = compute({ gravitonLevel: 1, playerClass: 1 });
        expect(collector.rcNeeded).toBe(Math.ceil(collector.dfAmount / 20000));
    });

    it('the general class boosts the recycler hold by 20%', () => {
        const none = compute({ gravitonLevel: 1, playerClass: 0 });
        const general = compute({ gravitonLevel: 1, playerClass: 2 });
        // The General grants no energy bonus, so the debris field is identical...
        expect(general.dfAmount).toBe(none.dfAmount);
        // ...but the recycler hold grows to 20000 * 1.2, cutting the count.
        expect(general.rcNeeded).toBe(Math.ceil(general.dfAmount / (20000 * 1.2)));
        expect(general.rcNeeded).toBeLessThan(none.rcNeeded);
    });

    it('the general class does not boost transports', () => {
        const none = compute({ gravitonLevel: 1, playerClass: 0 });
        const general = compute({ gravitonLevel: 1, playerClass: 2 });
        // Transport holds stay at the base for a General.
        const sum = general.crysNeeded + general.deutNeeded;
        expect(general.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(general.lcNeeded).toBe(Math.ceil(sum / 25000));
        expect(general.scNeeded).toBe(none.scNeeded);
    });
});

// ---------------------------------------------------------------------------
// Resources already on the planet. They never change the build cost — only how
// much still has to be shipped in, and therefore the transports needed.
// ---------------------------------------------------------------------------

describe('Graviton Calculator - Resources on hand', () => {
    it('with nothing on hand everything has to be delivered', () => {
        const r = compute({ gravitonLevel: 1 });
        expect(r.crysToDeliver).toBe(r.crysNeeded);
        expect(r.deutToDeliver).toBe(r.deutNeeded);
    });

    it('stock on the planet reduces the delivery, not the cost', () => {
        const r = compute({
            gravitonLevel: 1, crysAvailable: 5000000, deutAvailable: 1000000,
        });
        expect(r.crysToDeliver).toBe(r.crysNeeded - 5000000);
        expect(r.deutToDeliver).toBe(r.deutNeeded - 1000000);
        // The build itself still costs the full amount.
        const plain = compute({ gravitonLevel: 1 });
        expect(r.crysNeeded).toBe(plain.crysNeeded);
        expect(r.deutNeeded).toBe(plain.deutNeeded);
    });

    it('a crystal surplus never covers a deuterium shortage', () => {
        // Far more crystal than needed, no deuterium: the whole deuterium bill
        // still has to be shipped in, and the crystal leftover is clamped at 0.
        const r = compute({ gravitonLevel: 1, crysAvailable: 999999999 });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(r.deutNeeded);
        expect(r.lcNeeded).toBe(Math.ceil(r.deutNeeded / 25000));
    });

    it('transports are sized by the delivery, not the total cost', () => {
        const plain = compute({ gravitonLevel: 1 });
        const stocked = compute({
            gravitonLevel: 1, crysAvailable: 10000000, deutAvailable: 2000000,
        });
        const toDeliver = stocked.crysToDeliver + stocked.deutToDeliver;
        expect(stocked.scNeeded).toBe(Math.ceil(toDeliver / 5000));
        expect(stocked.lcNeeded).toBe(Math.ceil(toDeliver / 25000));
        expect(stocked.scNeeded).toBeLessThan(plain.scNeeded);
    });

    it('a full stock leaves nothing to deliver', () => {
        const plain = compute({ gravitonLevel: 1 });
        const r = compute({
            gravitonLevel: 1,
            crysAvailable: plain.crysNeeded,
            deutAvailable: plain.deutNeeded,
        });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(0);
        expect(r.scNeeded).toBe(0);
        expect(r.lcNeeded).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Debris field and net cost. Some universes drop deuterium into the debris
// field as well, which is what the deutInDebris flag switches on.
// ---------------------------------------------------------------------------

describe('Graviton Calculator - Debris and net cost', () => {
    it('by default only crystal lands in the debris field', () => {
        const r = compute({ gravitonLevel: 1, debrisPercent: 30 });
        expect(r.dfCrystal).toBe(Math.floor(r.crysNeeded * 0.3));
        expect(r.dfDeuterium).toBe(0);
        expect(r.dfAmount).toBe(r.dfCrystal);
    });

    it('deutInDebris adds the deuterium share to the debris field', () => {
        const r = compute({
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.dfDeuterium).toBe(Math.floor(r.deutNeeded * 0.3));
        expect(r.dfAmount).toBe(r.dfCrystal + r.dfDeuterium);
    });

    it('the debris field counts satellites already in orbit', () => {
        // 1000 existing satellites contribute 1000*2000 crystal and, with the
        // flag on, 1000*500 deuterium on top of the ones being built.
        const r = compute({
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
            solarSatellitesCount: 1000, maxPlanetTemp: 0,
        });
        expect(r.dfCrystal).toBe(Math.floor((r.crysNeeded + 1000 * 2000) * 0.3));
        expect(r.dfDeuterium).toBe(Math.floor((r.deutNeeded + 1000 * 500) * 0.3));
    });

    it('recyclers are sized by the combined debris volume', () => {
        const r = compute({
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.rcNeeded).toBe(Math.ceil(r.dfAmount / 20000));
        // Turning the flag on raises the debris and therefore the recyclers.
        const crystalOnly = compute({ gravitonLevel: 1, debrisPercent: 30 });
        expect(r.rcNeeded).toBeGreaterThan(crystalOnly.rcNeeded);
    });

    it('net cost subtracts the recycled share of this build', () => {
        const r = compute({ gravitonLevel: 1, debrisPercent: 30 });
        expect(r.netCrysNeeded).toBe(r.crysNeeded - Math.floor(r.crysNeeded * 0.3));
        // Deuterium is not recoverable unless the universe drops it.
        expect(r.netDeutNeeded).toBe(r.deutNeeded);
    });

    it('net deuterium drops once the universe puts it in the debris', () => {
        const r = compute({
            gravitonLevel: 1, debrisPercent: 30, deutInDebris: true,
        });
        expect(r.netDeutNeeded).toBe(r.deutNeeded - Math.floor(r.deutNeeded * 0.3));
    });

    it('a higher debris percentage lowers the net cost', () => {
        const low = compute({ gravitonLevel: 1, debrisPercent: 30 });
        const high = compute({ gravitonLevel: 1, debrisPercent: 70 });
        expect(high.netCrysNeeded).toBeLessThan(low.netCrysNeeded);
        expect(high.netCrysNeeded).toBe(low.crysNeeded - Math.floor(low.crysNeeded * 0.7));
    });

    it('satellites already in orbit are not a rebate on the new build', () => {
        // Existing satellites feed the debris field (which sizes the recyclers)
        // but must not discount the satellites being built now.
        const r = compute({
            gravitonLevel: 1, debrisPercent: 30, maxPlanetTemp: 0, solarSatellitesCount: 1000,
        });
        // The debris covers all 1000 existing satellites on top of the new ones...
        expect(r.dfCrystal).toBe(Math.floor((r.crysNeeded + 1000 * 2000) * 0.3));
        expect(r.dfCrystal).toBeGreaterThan(Math.floor(r.crysNeeded * 0.3));
        // ...while the net cost only ever discounts this build's own crystal.
        expect(r.netCrysNeeded).toBe(r.crysNeeded - Math.floor(r.crysNeeded * 0.3));
    });
});
