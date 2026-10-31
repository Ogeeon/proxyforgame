'use strict';

// getProductionRateSplit returns its breakdown as an array, and the costs and
// production calculators read it slot by slot through PRODUCTION_ROW. These
// cases pin which bonus lands in which slot: inputs are chosen so that every
// bonus row of a mine carries a different value, so a reordered or shifted row
// fails here instead of moving figures between lines of the production table.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const {
    PRODUCTION_ROW, getProductionRateSplit, getProductionRate,
    planetEnergy, satelliteEnergyYield, satellitesForEnergy,
} = load(
    ['ogame/calc/js/ogame-production.js'],
    ['PRODUCTION_ROW', 'getProductionRateSplit', 'getProductionRate',
        'planetEnergy', 'satelliteEnergyYield', 'satellitesForEnergy'],
);

const PLANET = {
    energyTechLevel: 12, plasmaTechLevel: 7, maxTemp: 40, pos: 8,
    universeSpeedFactor: 1, geologist: true, engineer: true,
    productionFactor: 1, powerFactor: 1, boosterType: 2,
    allOfficers: true, playerClass: 0, isTrader: true,
};

describe('getProductionRateSplit', () => {
    it('puts each metal mine bonus in its own row', () => {
        const rows = getProductionRateSplit({ ...PLANET, techID: 1, techLevel: 30 });
        expect(rows.length).toBe(Object.keys(PRODUCTION_ROW).length);
        expect(rows[PRODUCTION_ROW.NATURAL]).toBe(40);
        expect(rows[PRODUCTION_ROW.BUILDING]).toBe(21201);
        expect(rows[PRODUCTION_ROW.PLASMA]).toBe(1484);
        expect(rows[PRODUCTION_ROW.BOOSTER]).toBe(4240);
        expect(rows[PRODUCTION_ROW.GEOLOGIST]).toBe(2120);
        expect(rows[PRODUCTION_ROW.ENGINEER]).toBe(0);
        expect(rows[PRODUCTION_ROW.ALL_OFFICERS]).toBe(424);
        expect(rows[PRODUCTION_ROW.CLASS]).toBe(5300);
        expect(rows[PRODUCTION_ROW.ALLIANCE_CLASS]).toBe(1060);
    });

    it('leaves a power plant only its base output and the Engineer bonus', () => {
        const rows = getProductionRateSplit({ ...PLANET, techID: 12, techLevel: 20 });
        expect(rows[PRODUCTION_ROW.BUILDING]).toBe(13863);
        expect(rows[PRODUCTION_ROW.ENGINEER]).toBe(1386);
        const others = rows.filter((_, i) => i !== PRODUCTION_ROW.BUILDING && i !== PRODUCTION_ROW.ENGINEER);
        expect(others.every((v) => v === 0)).toBe(true);
    });
});

describe('getProductionRate', () => {
    it('sums every row for a mine', () => {
        const params = { ...PLANET, techID: 1, techLevel: 30 };
        const sum = getProductionRateSplit(params).reduce((a, b) => a + b, 0);
        expect(getProductionRate(params)).toBe(sum);
    });

    it('returns only the base output for a power plant', () => {
        expect(getProductionRate({ ...PLANET, techID: 12, techLevel: 20 })).toBe(13863);
    });
});

// A planet with every energy source and no bonus; each case switches on what it needs.
const POWER = {
    solarPlantLevel: 30, solarPlantPercent: 100, fusionPlantLevel: 20, fusionPlantPercent: 100,
    energyTechLevel: 12, satellites: 1000, satellitesPercent: 100, maxTemp: 40,
};

describe('planetEnergy', () => {
    it('takes the plants and satellites from getProductionRateSplit', () => {
        const e = planetEnergy(POWER);
        const building = (techID, techLevel) => getProductionRateSplit(
            { ...PLANET, techID, techLevel })[PRODUCTION_ROW.BUILDING];
        expect(e.solarPlant).toBe(building(4, 30));
        expect(e.fusionPlant).toBe(13863);
        expect(e.satellites).toBe(building(212, 1000));
        expect(e.total).toBe(e.solarPlant + e.fusionPlant + e.satellites);
    });

    it('rounds every bonus on its own share of the base', () => {
        const base = planetEnergy(POWER).total;
        const e = planetEnergy({
            ...POWER, booster: 2, engineer: true, fullCrew: true, collector: true,
            collectorEnhancement: 50, trader: true, lfTechBonus: 7.5, lfBuildingBonus: 4.5,
        });
        expect(e.booster).toBe(Math.round(base * 0.2));
        expect(e.engineer).toBe(Math.round(base * 0.1));
        expect(e.fullCrew).toBe(Math.round(base * 0.02));
        expect(e.playerClass).toBe(Math.round(base * 0.15));
        expect(e.trader).toBe(Math.round(base * 0.05));
        expect(e.lfTech).toBe(Math.round(base * 0.075));
        expect(e.lfBuildings).toBe(Math.round(base * 0.045));
        expect(e.total).toBe(base + e.booster + e.engineer + e.fullCrew + e.playerClass
            + e.trader + e.lfTech + e.lfBuildings);
    });

    it('scales the plants by their power setting', () => {
        const half = planetEnergy({ ...POWER, solarPlantPercent: 50, satellites: 0, fusionPlantLevel: 0 });
        expect(half.solarPlant).toBe(Math.floor(planetEnergy(POWER).solarPlant / 2));
    });
});

describe('satellitesForEnergy', () => {
    const total = (p, n) => planetEnergy({ ...p, satellites: p.satellites + n }).total;

    it('finds the fewest satellites that reach the requirement', () => {
        const p = { ...POWER, engineer: true, trader: true, lfBuildingBonus: 13.5 };
        const required = total(p, 0) + 100000;
        const n = satellitesForEnergy(p, required);
        expect(total(p, n)).toBeGreaterThanOrEqual(required);
        expect(total(p, n - 1)).toBeLessThan(required);
    });

    it('needs none when the planet already makes enough', () => {
        expect(satellitesForEnergy(POWER, planetEnergy(POWER).total)).toBe(0);
    });

    it('can never get there with satellites that yield nothing', () => {
        expect(satellitesForEnergy({ ...POWER, maxTemp: -140 }, 1e9)).toBe(Infinity);
        expect(satellitesForEnergy({ ...POWER, satellitesPercent: 0 }, 1e9)).toBe(Infinity);
    });

    it('counts every bonus on a cold planet\'s satellite, however small its share', () => {
        // floor((-120 + 140) / 6) = 3 per satellite; the 45% building bonus adds
        // 1.35 on top of it, which a rounded share would lose entirely
        const cold = { ...POWER, maxTemp: -120, lfBuildingBonus: 45 };
        expect(satelliteEnergyYield(cold)).toBeCloseTo(3 * 1.45);
    });
});
