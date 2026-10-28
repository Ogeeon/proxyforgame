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
    // Meditation Enclave, as lf-techdata.inc.php declares it.
    2001: [9, 3, 0, 0, 40, 1.2, 1.2, 0, 0, 1.21],
    // Crystal Farm, as lf-techdata.inc.php declares it.
    2002: [7, 2, 0, 10, 40, 1.2, 1.2, 0, 1.03, 1.21],
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

describe('LF Costs Calculator - reduced cost rounding', () => {
    // The game floors the reduced cost once. Flooring the base cost first dropped
    // its fraction: 0.915 * 17021644.96 = 15574805.14, but 0.915 * 17021644 =
    // 15574804.26. Reported against the game: Rock'tal Meditation Enclave 58 under
    // Megalith 6 and Mineral Research Centre 5, 6% + 2.5% = 8.5%.
    it('Meditation Enclave 58 at 8.5% costs what the game shows', () => {
        const result = calc.calculate(2001, 57, 58, 0, 0, calc.computeBldCostRdc(2001, 2, 6, 5), PARAMS);
        expect(result.metal).toBe(15574805);
        expect(result.crystal).toBe(5191601);
    });

    it('an unreduced cost is unchanged', () => {
        const result = calc.calculate(2001, 57, 58, 0, 0, 0, PARAMS);
        expect(result.metal).toBe(17021644);
        expect(result.crystal).toBe(5673881);
    });
});

// Read off the game for a Rock'tal Crystal Farm at level 44: Megalith 3, no Mineral
// Research Centre, ion technology 5, Robotics Factory 10, Nanite Factory 3, universe
// speed 8. The building page offers the upgrade to 45 and the demolition down to 43.
describe('LF Costs Calculator - Crystal Farm against the game', () => {
    const rockPARAMS = {
        ...PARAMS, race: 2, megalithLvl: 3, robotFactoryLevel: 10, naniteFactoryLevel: 3, universeSpeed: 8,
    };
    const bldCostRdc = calc.computeBldCostRdc(2002, 2, 3, 0);

    it('the upgrade to 45 costs and lasts what the game shows', () => {
        const result = calc.calculate(2002, 44, 45, 5, 0, bldCostRdc, rockPARAMS);
        expect(result.metal).toBe(931230);
        expect(result.crystal).toBe(266065);
        expect(result.energy).toBe(1650);
        expect(result.time).toBe(3 * 3600 + 39 * 60 + 36);
    });

    // Regression: the demolition ignored the Megalith and came out 3% too dear
    // (509645 metal and 145612 crystal).
    it('the demolition to 43 costs and lasts what the game shows', () => {
        const result = calc.calculate(2002, 44, 43, 5, 0, bldCostRdc, rockPARAMS);
        expect(result.metal).toBe(494356);
        expect(result.crystal).toBe(141244);
        expect(result.energy).toBe(1188);
        expect(result.time).toBe(2 * 3600 + 23 * 60 + 19);
    });
});

// Read off the game on a second Rock'tal account (ion technology 5, no Mineral
// Research Centre): the energy a demolition needs is the resulting level's energy,
// floored, then discounted by the ion technology and the Megalith.
describe('LF Costs Calculator - demolition energy against the game', () => {
    const rockPARAMS = { ...PARAMS, race: 2 };

    it('Crystal Farm 42 -> 41 without a Megalith needs 1101 energy', () => {
        const result = calc.calculate(2002, 42, 41, 5, 0, calc.computeBldCostRdc(2002, 2, 0, 0), rockPARAMS);
        expect(result.energy).toBe(1101);
    });

    it('Crystal Farm 45 -> 44 under Megalith 5 needs 1227 energy', () => {
        const result = calc.calculate(2002, 45, 44, 5, 0, calc.computeBldCostRdc(2002, 2, 5, 0), rockPARAMS);
        expect(result.energy).toBe(1227);
    });
});

// The Mineral Research Centre discounts the Rock'tal food farm as well as the mines.
// Read off the game: Crystal Farm 60 -> 61 under Megalith 6 and Mineral Research
// Centre 5 (6% + 2.5%); the Megalith alone would make it 22616765 metal.
describe('LF Costs Calculator - Mineral Research Centre on the Crystal Farm', () => {
    it('Crystal Farm 61 under Megalith 6 and MRC 5 costs what the game shows', () => {
        const rockPARAMS = { ...PARAMS, race: 2, megalithLvl: 6 };
        const result = calc.calculate(2002, 60, 61, 5, 0, calc.computeBldCostRdc(2002, 2, 6, 5), rockPARAMS);
        expect(result.metal).toBe(22015255);
        expect(result.crystal).toBe(6290073);
        expect(result.energy).toBe(3387);
    });
});

// The game builds one level at a time and charges each level on its own: the
// Megalith reduction and the universe speed are applied to that level, rounded
// down, and a level never takes under a second. A range is the sum of its levels;
// reducing the range's total and flooring once came out a few seconds longer (#62).
// Same Crystal Farm and account as above: Megalith 3, Robotics 10, Nanites 3, speed 8.
describe('LF Costs Calculator - a range of building levels is charged level by level', () => {
    const rockPARAMS = {
        ...PARAMS, race: 2, megalithLvl: 3, robotFactoryLevel: 10, naniteFactoryLevel: 3, universeSpeed: 8,
    };
    const bldCostRdc = calc.computeBldCostRdc(2002, 2, 3, 0);

    it('an upgrade over three levels is the sum of the levels', () => {
        // Levels 45, 46, 47: 13176 + 16298 + 20149 s; reducing the total once gave 49624 s.
        const result = calc.calculate(2002, 44, 47, 0, 0, bldCostRdc, rockPARAMS);
        expect(result.time).toBe(49623);
    });

    it('a demolition over three levels is the sum of the levels', () => {
        // Levels 46, 45, 44: 16298 + 13176 + 10647 s; reducing the total once gave 40123 s.
        const result = calc.calculate(2002, 47, 44, 5, 0, bldCostRdc, rockPARAMS);
        expect(result.time).toBe(40121);
    });

    it('the universe speed alone is applied per level too', () => {
        // No Megalith: dividing the total by 8 once gave 180460 s.
        const params = { ...rockPARAMS, megalithLvl: 0 };
        const result = calc.calculate(2002, 40, 50, 0, 0, 0, params);
        expect(result.time).toBe(180455);
    });

    it('every level takes at least a second', () => {
        // Levels 1-3 are 0, 0 and 0 s after the reduction and the speed; the range
        // used to be floored to 0 and lifted to a single second.
        const result = calc.calculate(2002, 0, 3, 0, 0, bldCostRdc, rockPARAMS);
        expect(result.time).toBe(3);
    });

    it('a single level is unchanged', () => {
        const result = calc.calculate(2002, 44, 45, 0, 0, bldCostRdc, rockPARAMS);
        expect(result.time).toBe(3 * 3600 + 39 * 60 + 36);
    });
});

describe('LF Costs Calculator - every research level takes at least a second', () => {
    it('a research range under a 99% reduction at speed 10 takes a second per level', () => {
        // Levels 1-3 take 120, 288 and 518 s raw: 1, 2 and 5 s after 99% off,
        // 0 s each at speed 10. The range used to come out 0 and be lifted to 1 s.
        const params = { ...PARAMS, resCentreLvl: 0, universeSpeed: 10, researchTimeReduction: 99 };
        const result = calc.calculate(11101, 0, 3, 0, 0, 0, params);
        expect(result.time).toBe(3);
    });
});
