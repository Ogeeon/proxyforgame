'use strict';

// isPlnEmpty() decides whether deleting a planet on the All planets tab needs a
// confirmation, so it has to tell an untouched planet from an edited one without
// caring how the value reached options.prm.aPS — the table writes numbers, older
// cookies hold strings, and planets saved before the life form fields existed are
// simply shorter. All of that is plain array logic, hence Node instead of a browser.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const ctx = load(
    ['ogame/calc/js/production-core.js'],
    ['createEmptyPlanet', 'isPlnEmpty', 'lfResearchIncrease', 'lfBuildingUpgradeLevels', 'lfBuildingCostReduction'],
);
const { createEmptyPlanet, isPlnEmpty, lfResearchIncrease, lfBuildingUpgradeLevels, lfBuildingCostReduction } = ctx;

// The functions read the planet through the shared `options` object the page
// builds in production.tpl; a bare aPS holder is all they touch.
function check(planet) {
    ctx.options = { prm: { aPS: [planet] } };
    return isPlnEmpty(0);
}

describe('isPlnEmpty', () => {
    it('treats a freshly created planet as empty', () => {
        expect(check(createEmptyPlanet())).toBe(true);
    });

    it('treats levels stored as strings as empty', () => {
        // What collectAllPlanetsInputs() used to write: "0" instead of 0, which made
        // the delete confirmation fire on a planet nobody had touched.
        let planet = createEmptyPlanet();
        for (let j = 1; j < 8; j++)
            planet[j * 3] = '0';
        expect(check(planet)).toBe(true);
    });

    it('detects an entered building level', () => {
        let planet = createEmptyPlanet();
        planet[3] = 20; // metal mine
        expect(check(planet)).toBe(false);
    });

    it('detects an entered level stored as a string', () => {
        let planet = createEmptyPlanet();
        planet[3] = '20';
        expect(check(planet)).toBe(false);
    });

    it('detects a booster', () => {
        let planet = createEmptyPlanet();
        planet[5] = 2; // metal mine booster
        expect(check(planet)).toBe(false);
    });

    it('detects a lowered production factor', () => {
        let planet = createEmptyPlanet();
        planet[4] = 90; // metal mine at 90%
        expect(check(planet)).toBe(false);
    });

    it('detects a changed planet position', () => {
        let planet = createEmptyPlanet();
        planet[1] = 4;
        expect(check(planet)).toBe(false);
    });

    it('detects an entered temperature', () => {
        let planet = createEmptyPlanet();
        planet[0] = -20;
        expect(check(planet)).toBe(false);
    });

    it('detects life form data', () => {
        let planet = createEmptyPlanet();
        planet[24] = 2; // race
        planet[27] = 5; // one of its buildings
        expect(check(planet)).toBe(false);
    });

    it('treats a planet saved before the life form fields as empty', () => {
        let planet = createEmptyPlanet().slice(0, 24);
        expect(check(planet)).toBe(true);
    });
});

// The LF amortization table on the All planets tab ranks one more level of each
// production research by payback. The gain is linear in the level, so it comes
// straight from the mines' output rather than from a second production pass.
describe('lfResearchIncrease', () => {
    // [metal mine, crystal mine, deuterium synthesizer] per planet
    const mines = [[21200, 9000, 4000], [10000, 5000, 2500]];

    it('adds base% of every planet\'s mine output, rounded per planet', () => {
        // High-Performance Extractors: 0.06% of all three resources
        const bonus = { met: [0.06, 1, null], cry: [0.06, 1, null], deu: [0.06, 1, null] };
        // 21200*0.0006 = 12.72 -> 13, 10000*0.0006 = 6; 5.4 -> 5, 3; 2.4 -> 2, 1.5 -> 2
        expect(lfResearchIncrease(mines, bonus, 0)).toEqual([19, 8, 4]);
    });

    it('touches only the resources the research boosts', () => {
        // Acoustic Scanning: crystal 0.08%
        expect(lfResearchIncrease(mines, { cry: [0.08, 1, null] }, 0)).toEqual([0, 11, 0]);
    });

    it('is amplified by the technology bonus', () => {
        // Depth Sounding, metal 0.08%, with a 50% technology bonus:
        // 21200*0.0012 = 25.44 -> 25, 10000*0.0012 = 12
        expect(lfResearchIncrease(mines, { met: [0.08, 1, null] }, 50)).toEqual([37, 0, 0]);
    });

    it('gains nothing without mines', () => {
        expect(lfResearchIncrease([], { met: [0.08, 1, null] }, 50)).toEqual([0, 0, 0]);
        expect(lfResearchIncrease([[0, 0, 0]], { met: [0.08, 1, null] }, 0)).toEqual([0, 0, 0]);
    });
});

describe('lfBuildingUpgradeLevels', () => {
    it('raises one building and leaves the planet untouched', () => {
        const levels = [0, 0, 0, 0, 0, 7, 0, 3, 0, 0, 0, 0];
        const upgraded = lfBuildingUpgradeLevels(levels, 5);
        expect(upgraded[5]).toBe(8);
        expect(upgraded[7]).toBe(3);
        expect(levels[5]).toBe(7);
    });

    it('reads levels stored as strings or left blank as numbers', () => {
        const upgraded = lfBuildingUpgradeLevels(['4', '', undefined], 0);
        expect(upgraded[0]).toBe(5);
        expect(upgraded[1]).toBe(0);
        expect(upgraded[2]).toBe(0);
    });
});

describe('lfBuildingCostReduction', () => {
    const levels = [0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0]; // Megalith (position 8) at 12

    it('gives Rock\'tal buildings 1% per Megalith level', () => {
        expect(lfBuildingCostReduction(2, levels)).toBeCloseTo(0.12, 10);
    });

    it('gives the other races nothing', () => {
        expect(lfBuildingCostReduction(1, levels)).toBe(0);
        expect(lfBuildingCostReduction(3, levels)).toBe(0);
        expect(lfBuildingCostReduction(4, levels)).toBe(0);
    });
});
