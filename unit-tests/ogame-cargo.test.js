'use strict';

// shipHold is the one hold formula every calculator that counts transports or
// recyclers reads. These cases pin the rule itself; each calculator's own tests
// only check that it hands the right bonuses in.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { shipHold, HOLD_CLASS_BONUS } = load(
    ['ogame/calc/js/ogame-cargo.js'],
    ['shipHold', 'HOLD_CLASS_BONUS'],
);

describe('shipHold', () => {
    it('base hold with no bonuses', () => {
        expect(shipHold(5000, { hyperTechLevel: 0 })).toBe(5000);
        expect(shipHold(25000, { hyperTechLevel: 0 })).toBe(25000);
        expect(shipHold(20000, { hyperTechLevel: 0 })).toBe(20000);
    });

    it('hyperspace technology adds 5% per level', () => {
        expect(shipHold(5000, { hyperTechLevel: 10 })).toBe(5000 * 1.5);
        expect(shipHold(25000, { hyperTechLevel: 20 })).toBe(25000 * 2);
    });

    it('the class bonus is additive, not scaled by hyperspace tech', () => {
        // 5000*1.5 + 5000*0.25 = 8750, NOT 5000*1.5*1.25 = 9375
        expect(shipHold(5000, { hyperTechLevel: 10, classBonus: HOLD_CLASS_BONUS.COLLECTOR }))
            .toBe(5000 * 1.5 + 5000 * 0.25);
        expect(shipHold(20000, { hyperTechLevel: 10, classBonus: HOLD_CLASS_BONUS.GENERAL }))
            .toBe(20000 * 1.5 + 20000 * 0.2);
    });

    it('the life form enhancement raises the class bonus, not the base hold', () => {
        // 5000 + 5000 * 0.25 * 1.5
        expect(shipHold(5000, {
            hyperTechLevel: 0, classBonus: HOLD_CLASS_BONUS.COLLECTOR, classEnhancement: 50,
        })).toBe(6875);
        // Without a class bonus the enhancement has nothing to raise
        expect(shipHold(5000, { hyperTechLevel: 0, classEnhancement: 50 })).toBe(5000);
    });

    it('the ship\'s own life form bonus is a share of the base hold', () => {
        expect(shipHold(5000, { hyperTechLevel: 0, lfBonus: 100 })).toBe(10000);
        expect(shipHold(20000, { hyperTechLevel: 10, lfBonus: 50 })).toBe(20000 * 1.5 + 10000);
    });

    it('drops the fraction of one ship\'s hold', () => {
        // 5000 * 1.33333 = 6666.65
        expect(shipHold(5000, { hyperTechLevel: 0, lfBonus: 33.333 })).toBe(6666);
        // Light fighter, odd hyperspace level: 50 * 1.05 = 52.5
        expect(shipHold(50, { hyperTechLevel: 1 })).toBe(52);
    });

    it('a hold that is whole on paper stays whole after binary rounding', () => {
        // 25000*1.15 + 25000*0.25*1.152 = 35950, summed in binary to 35949.99999999999
        expect(shipHold(25000, {
            hyperTechLevel: 3, classBonus: HOLD_CLASS_BONUS.COLLECTOR, classEnhancement: 15.2,
        })).toBe(35950);
    });
});
