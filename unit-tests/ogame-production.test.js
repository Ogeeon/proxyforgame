'use strict';

// getProductionRateSplit returns its breakdown as an array, and the costs and
// production calculators read it slot by slot through PRODUCTION_ROW. These
// cases pin which bonus lands in which slot: inputs are chosen so that every
// bonus row of a mine carries a different value, so a reordered or shifted row
// fails here instead of moving figures between lines of the production table.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { PRODUCTION_ROW, getProductionRateSplit, getProductionRate } = load(
    ['ogame/calc/js/ogame-production.js'],
    ['PRODUCTION_ROW', 'getProductionRateSplit', 'getProductionRate'],
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
