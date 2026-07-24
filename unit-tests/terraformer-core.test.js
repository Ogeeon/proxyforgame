'use strict';

// Pure computation tests for the terraformer calculator, moved out of the Playwright
// suite: TerraformerCalculator touches no DOM. Test bodies are unchanged from
// playwright-tests/tests/terraformer.spec.js — only the plumbing above them differs.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// utils.js supplies dropFraction(); common.js supplies getBuildCost_C/getBuildTime_C.
const { TerraformerCalculator } = load(
    ['js/utils.js', 'ogame/calc/js/common.js', 'ogame/calc/js/terraformer-core.js'],
    ['TerraformerCalculator'],
);

const BASE_PRM = {
    robotsFactoryLevel: 0,
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
    playerClass: 0,
    isTrader: false,
    energyBoost: 0,
    disChLevel: 0,
    totalLFEnrgBonus: 0,
    scCapacityIncrease: 0,
    lcCapacityIncrease: 0,
    tfSingleLevel: false,
    tfLevelFrom: 0,
    tfLevelTo: 0,
    crysAvailable: 0,
    deutAvailable: 0,
};

function compute(overrides = {}) {
    return new TerraformerCalculator().compute({ ...BASE_PRM, ...overrides });
}

const capacity = (base, hyper, classBonus, inc) =>
    TerraformerCalculator.cargoCapacity(base, hyper, classBonus, inc);

describe('Terraformer Calculator - Core computation', () => {
    it('solar plant energy follows the OGame formula', () => {
        // floor(0.01 * 100 * floor(20 * 10 * 1.1^10)) = 518
        const r = compute({ solarPlantLevel: 10 });
        expect(r.solarPlantEnergy).toBe(518);
    });

    it('fusion plant energy grows with energy technology', () => {
        const plain = compute({ fusionPlantLevel: 10, energyTechLevel: 0 });
        const teched = compute({ fusionPlantLevel: 10, energyTechLevel: 12 });
        expect(teched.fusionPlantEnergy).toBeGreaterThan(plain.fusionPlantEnergy);
    });

    it('solar satellites depend on planet temperature', () => {
        const cold = compute({ solarSatellitesCount: 100, maxPlanetTemp: 0 });
        const hot = compute({ solarSatellitesCount: 100, maxPlanetTemp: 60 });
        expect(cold.solarSatsEnergy).toBe(100 * Math.floor((0 + 140) / 6));   // 100 * 23
        expect(hot.solarSatsEnergy).toBe(100 * Math.floor((60 + 140) / 6));   // 100 * 33
    });

    it('the terraformer energy requirement doubles per level', () => {
        // getBuildEnergyCost_C(33, level) = 1000 * 2^(level-1).
        const l1 = compute({ tfLevelTo: 1 });
        const l2 = compute({ tfLevelTo: 2 });
        const l3 = compute({ tfLevelTo: 3 });
        expect(l1.energyRequirement).toBe(1000);
        expect(l2.energyRequirement).toBe(2000);
        expect(l3.energyRequirement).toBe(4000);
    });

    it('terraformer level 0 requires no energy and no satellites', () => {
        const r = compute({ tfLevelTo: 0 });
        expect(r.energyRequirement).toBe(0);
        expect(r.neededSats).toBe(0);
    });

    it('fields added: 4 on odd levels, 5 on even levels', () => {
        // Range 0 -> 3: level 1 (+4), level 2 (+5), level 3 (+4) = 13.
        const r = compute({ tfLevelTo: 3 });
        expect(r.addedFields).toBe(13);
    });

    it('single-level mode counts only the last terraformer step', () => {
        // tfLevelTo=4, single -> from=3, so only level 4 (+5) is added.
        const r = compute({ tfLevelTo: 4, tfSingleLevel: true });
        expect(r.addedFields).toBe(5);
        // The range mode from 0 accumulates every level up to 4.
        const range = compute({ tfLevelTo: 4, tfSingleLevel: false });
        expect(range.addedFields).toBe(4 + 5 + 4 + 5);
    });

    it('satellites cover the requirement shortfall', () => {
        // No plants, so all 1000 energy must come from satellites.
        // energyPerSat = baseEnergyPerSat = 0.01*100*floor(140/6) = 23.
        const r = compute({ tfLevelTo: 1 });
        expect(r.feasible).toBe(true);
        expect(r.energyPerSat).toBe(23);
        expect(r.neededSats).toBe(Math.ceil(1000 / 23));
        expect(r.crysSS).toBe(r.neededSats * 2000);
        expect(r.deutSS).toBe(r.neededSats * 500);
    });

    it('the total cost sums the terraformer and satellite costs', () => {
        // getBuildCost_C(33, 0, 1): crystal 50000, deuterium 100000.
        const r = compute({ tfLevelTo: 1 });
        expect(r.crysTF).toBe(50000);
        expect(r.deutTF).toBe(100000);
        expect(r.crysTotal).toBe(r.crysSS + r.crysTF);
        expect(r.deutTotal).toBe(r.deutSS + r.deutTF);
    });

    it('a strong solar plant lowers the satellites needed', () => {
        const weak = compute({ tfLevelTo: 3, solarPlantLevel: 0 });
        const strong = compute({ tfLevelTo: 3, solarPlantLevel: 20 });
        expect(strong.neededSats).toBeLessThan(weak.neededSats);
    });

    it('zero per-satellite yield is flagged as infeasible', () => {
        const r = compute({ tfLevelTo: 1, solarSatellitesPercent: 0 });
        expect(r.feasible).toBe(false);
        expect(r.neededSats).toBe(Infinity);
    });

    it('build time scales down with economy speed', () => {
        const x1 = compute({ tfLevelTo: 1, universeSpeed: 1 });
        const x5 = compute({ tfLevelTo: 1, universeSpeed: 5 });
        expect(x5.secsTF).toBeLessThan(x1.secsTF);
    });

    it('collector class adds a 10% energy bonus', () => {
        const base = compute({ solarPlantLevel: 20 });
        const collector = compute({ solarPlantLevel: 20, playerClass: 1 });
        expect(collector.classEnergyBonus).toBe(Math.floor(0.1 * base.solarPlantEnergy));
        expect(collector.availableEnergy).toBeGreaterThan(base.availableEnergy);
    });

    it('only the collector class boosts energy', () => {
        // The General (2) grants no energy bonus in the terraformer calculator.
        const general = compute({ solarPlantLevel: 20, playerClass: 2 });
        expect(general.classEnergyBonus).toBe(0);
    });
});

describe('Terraformer Calculator - Cargo capacity', () => {
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
    });

    it('cargo capacity increase adds floor(base * increase%)', () => {
        expect(capacity(5000, 0, 0, 100)).toBe(10000);
        expect(capacity(25000, 0, 0, 50)).toBe(25000 + 12500);
        expect(capacity(5000, 0, 0, 33)).toBe(5000 + Math.floor(5000 * 0.33));
    });

    it('transports use the capacity-adjusted cargo holds', () => {
        const plain = compute({ tfLevelTo: 1 });
        const sum = plain.crysTotal + plain.deutTotal;
        expect(plain.scNeeded).toBe(Math.ceil(sum / 5000));
        expect(plain.lcNeeded).toBe(Math.ceil(sum / 25000));
    });

    it('cargo capacity increase lowers the transports needed', () => {
        const plain = compute({ tfLevelTo: 1 });
        const boosted = compute({
            tfLevelTo: 1, scCapacityIncrease: 100, lcCapacityIncrease: 100,
        });
        expect(boosted.scNeeded).toBeLessThan(plain.scNeeded);
        expect(boosted.lcNeeded).toBeLessThan(plain.lcNeeded);
        // +100% SC capacity doubles the hold (5000 -> 10000).
        const sum = boosted.crysTotal + boosted.deutTotal;
        expect(boosted.scNeeded).toBe(Math.ceil(sum / 10000));
    });
});

describe('Terraformer Calculator - Resources on hand', () => {
    it('with nothing on hand everything has to be delivered', () => {
        const r = compute({ tfLevelTo: 1 });
        expect(r.crysToDeliver).toBe(r.crysTotal);
        expect(r.deutToDeliver).toBe(r.deutTotal);
    });

    it('stock on the planet reduces the delivery, not the cost', () => {
        const plain = compute({ tfLevelTo: 1 });
        const r = compute({
            tfLevelTo: 1, crysAvailable: 20000, deutAvailable: 30000,
        });
        expect(r.crysToDeliver).toBe(plain.crysTotal - 20000);
        expect(r.deutToDeliver).toBe(plain.deutTotal - 30000);
        // The build itself still costs the full amount.
        expect(r.crysTotal).toBe(plain.crysTotal);
        expect(r.deutTotal).toBe(plain.deutTotal);
    });

    it('a crystal surplus never covers a deuterium shortage', () => {
        const r = compute({ tfLevelTo: 1, crysAvailable: 999999999 });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(r.deutTotal);
        expect(r.lcNeeded).toBe(Math.ceil(r.deutTotal / 25000));
    });

    it('transports are sized by the delivery, not the total cost', () => {
        const plain = compute({ tfLevelTo: 1 });
        const stocked = compute({
            tfLevelTo: 1, crysAvailable: 40000, deutAvailable: 60000,
        });
        const toDeliver = stocked.crysToDeliver + stocked.deutToDeliver;
        expect(stocked.scNeeded).toBe(Math.ceil(toDeliver / 5000));
        expect(stocked.lcNeeded).toBe(Math.ceil(toDeliver / 25000));
        expect(stocked.scNeeded).toBeLessThan(plain.scNeeded);
    });

    it('a full stock leaves nothing to deliver', () => {
        const plain = compute({ tfLevelTo: 1 });
        const r = compute({
            tfLevelTo: 1,
            crysAvailable: plain.crysTotal,
            deutAvailable: plain.deutTotal,
        });
        expect(r.crysToDeliver).toBe(0);
        expect(r.deutToDeliver).toBe(0);
        expect(r.scNeeded).toBe(0);
        expect(r.lcNeeded).toBe(0);
    });
});
