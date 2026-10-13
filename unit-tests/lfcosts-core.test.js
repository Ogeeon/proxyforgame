'use strict';

// Pure computation tests for the life-form costs calculator. LfCalculator touches
// no DOM, so it runs here rather than in Playwright.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// ogame-lifeform.js supplies getBuildCostLF/getBuildEnergyCostLF; utils.js supplies dropFraction().
const { LfCalculator } = load(
    ['js/utils.js', 'ogame/calc/js/ogame-lifeform.js', 'ogame/calc/js/lfcosts-core.js'],
    ['LfCalculator'],
);

// Layout read by calcBuildCostLF and getBuildEnergyCostLF:
// [met, cry, deut, energy, timeBase, growMet, growCry, growDeut, growEnergy, growTime]
const TECH_DATA = {
    // `techID % 1000` decides the branch: below 100 is a building, at or above it a research.
    11001: [1000, 500, 200, 50, 100, 1.5, 1.5, 1.5, 1.1, 1.2],
    11101: [1000, 500, 200, 0, 100, 1.5, 1.5, 1.5, 1.1, 1.2],
};

const PARAMS = {
    race: 1,
    megalithLvl: 0,
    robotFactoryLevel: 0,
    naniteFactoryLevel: 0,
    universeSpeed: 1,
    researchTimeReduction: 0,
};

const calc = new LfCalculator(TECH_DATA);

describe('LF Costs Calculator - demolition points', () => {
    // Regression: the demolition branch called getBuildCostLF without rsrCostRdc,
    // which made the research cost reduction `0.01 * undefined`. Buildings survived
    // it because their reduction argument has a default; research produced NaN.
    it('a demolished research refunds a finite number of points', () => {
        const { points } = calc.calculate(11101, 3, 0, 0, 0, 0, PARAMS);
        expect(Number.isNaN(points)).toBe(false);
    });

    it('a demolished research refunds exactly what building it awarded', () => {
        const up = calc.calculate(11101, 0, 3, 0, 0, 0, PARAMS);
        const down = calc.calculate(11101, 3, 0, 0, 0, 0, PARAMS);
        expect(down.points).toBe(-up.points);
    });

    it('a demolished building still refunds what building it awarded', () => {
        const up = calc.calculate(11001, 0, 3, 0, 0, 0, PARAMS);
        const down = calc.calculate(11001, 3, 0, 0, 0, 0, PARAMS);
        expect(down.points).toBe(-up.points);
    });

    it('research and building of equal cost award the same points', () => {
        const research = calc.calculate(11101, 0, 3, 0, 0, 0, PARAMS);
        const building = calc.calculate(11001, 0, 3, 0, 0, 0, PARAMS);
        expect(research.points).toBe(building.points);
    });
});

// The game counts points from the full cost: the Megalith and the research cost
// reductions lower what the player pays, not what the build or research awards.
describe('LF Costs Calculator - build points ignore cost reductions', () => {
    it('a building under a Megalith-style reduction awards the unreduced points', () => {
        const full = calc.calculate(11001, 0, 6, 0, 0, 0, PARAMS);
        const reduced = calc.calculate(11001, 0, 6, 0, 0, 0.5, PARAMS);
        expect(reduced.metal).toBe(47562);
        expect(reduced.metal).toBeLessThan(full.metal);
        expect(full.points).toBe(161);
        expect(reduced.points).toBe(161);
    });

    it('a research under a research cost reduction awards the unreduced points', () => {
        const full = calc.calculate(11101, 0, 6, 0, 0, 0, PARAMS);
        const reduced = calc.calculate(11101, 0, 6, 0, 50, 0, PARAMS);
        expect(reduced.metal).toBe(47562);
        expect(reduced.metal).toBeLessThan(full.metal);
        expect(full.points).toBe(161);
        expect(reduced.points).toBe(161);
    });

    it('a demolition after a reduced build still refunds exactly the points awarded', () => {
        const up = calc.calculate(11001, 0, 6, 0, 50, 0.5, PARAMS);
        const down = calc.calculate(11001, 6, 0, 0, 50, 0.5, PARAMS);
        expect(down.points).toBe(-up.points);
    });
});
