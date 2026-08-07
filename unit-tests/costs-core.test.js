'use strict';

// Pure computation tests for the costs calculator. This is the calculator's first
// node:test file — everything else it has is Playwright — so it covers only the
// lab-level rules that live in costs-core.js and need no DOM.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { GlobalParams, Calculator } = load(
    ['ogame/calc/js/costs-core.js'],
    ['GlobalParams', 'Calculator'],
);

// Research Lab levels the game requires, mirrored from $techReqs in costs.php.
// Only the entries the tests below name are listed.
const TECH_REQS = {
    106: 3,   // Espionage technology
    109: 4,   // Weapons technology
    199: 12,  // Graviton technology
};

const calculator = new Calculator({}, TECH_REQS);

/**
 * Global params with the IRN left unconfigured — the calculator's default state,
 * where the entered lab level is the only source of the resulting level.
 * @param {Partial<any>} [overrides]
 */
function directParams(overrides = {}) {
    const params = new GlobalParams();
    params.useDirectLabLevel = true;
    params.labLevels = [0, 0, 0, 0, 0, 0, 0, 0];
    params.labChoice = -1;
    return Object.assign(params, overrides);
}

describe('Calculator.getRequiredLabLevel', () => {
    it('returns the requirement of a research', () => {
        expect(calculator.getRequiredLabLevel(199)).toBe(12);
        expect(calculator.getRequiredLabLevel(106)).toBe(3);
    });

    it('returns 0 for anything that is not a research', () => {
        expect(calculator.getRequiredLabLevel(1)).toBe(0);
        expect(calculator.getRequiredLabLevel(204)).toBe(0);
    });
});

describe('Calculator.getLabLevelRaiseTarget', () => {
    it('raises the lab to what the research requires', () => {
        expect(calculator.getLabLevelRaiseTarget(199, directParams({ researchLabLevel: 0 })))
            .toBe(12);
        expect(calculator.getLabLevelRaiseTarget(199, directParams({ researchLabLevel: 5 })))
            .toBe(12);
    });

    it('leaves a sufficient lab level alone', () => {
        expect(calculator.getLabLevelRaiseTarget(199, directParams({ researchLabLevel: 12 })))
            .toBe(0);
        expect(calculator.getLabLevelRaiseTarget(199, directParams({ researchLabLevel: 20 })))
            .toBe(0);
    });

    it('never lowers a lab level that already exceeds the requirement', () => {
        // Espionage needs 3; a lab at 20 is untouched rather than pulled down.
        expect(calculator.getLabLevelRaiseTarget(106, directParams({ researchLabLevel: 20 })))
            .toBe(0);
    });

    it('leaves buildings, ships and defence alone', () => {
        expect(calculator.getLabLevelRaiseTarget(1, directParams({ researchLabLevel: 0 })))
            .toBe(0);
        expect(calculator.getLabLevelRaiseTarget(204, directParams({ researchLabLevel: 0 })))
            .toBe(0);
    });

    it('reads the level through the IRN sum, not off the entered field', () => {
        // The entered field is empty, so getResultingLabLevel() falls through to
        // the per-planet table, where a lab of 12 already clears what the Graviton
        // needs. Comparing against researchLabLevel alone would report a shortfall
        // here and overwrite a configuration that is in fact sufficient.
        const irn = new GlobalParams();
        irn.useDirectLabLevel = true;
        irn.researchLabLevel = 0;
        irn.labLevels = [12, 10, 0, 0, 0, 0, 0, 0];
        irn.labChoice = 0;
        irn.irnLevel = 1;

        expect(calculator.getLabLevelRaiseTarget(199, irn)).toBe(0);
    });

    it('reports a shortfall when no single lab meets the requirement', () => {
        // Four labs of 5 sum to 20, but a research only starts on a lab that on
        // its own reaches the required level, so the IRN filter drops all four.
        const irn = new GlobalParams();
        irn.useDirectLabLevel = true;
        irn.researchLabLevel = 0;
        irn.labLevels = [5, 5, 5, 5, 0, 0, 0, 0];
        irn.labChoice = 0;
        irn.irnLevel = 3;

        expect(calculator.getLabLevelRaiseTarget(199, irn)).toBe(12);
    });
});
