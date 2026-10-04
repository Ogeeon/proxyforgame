'use strict';

// Pure computation tests for the costs calculator: the rules that live in
// costs-core.js and need no DOM — research lab levels, the life form class
// bonuses and what they feed (cargo capacity, research speed, mine output).
// Everything else the calculator has is Playwright.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// ogame-production.js and ogame-costs.js first: costs-core.js calls their
// getProductionRate and getHalvingCost helpers the way the page does, with all
// three scripts sharing one global scope.
const { GlobalParams, Calculator, BuildRequest, universeSpeeds, calcBuildCost_C, getBuildCost_C } = load(
    [
        'ogame/calc/js/ogame-production.js',
        'ogame/calc/js/ogame-costs.js',
        'ogame/calc/js/costs-core.js',
    ],
    ['GlobalParams', 'Calculator', 'BuildRequest', 'universeSpeeds', 'calcBuildCost_C', 'getBuildCost_C'],
);

// Research Lab levels the game requires, mirrored from $techReqs in costs.php.
// Only the entries the tests below name are listed.
const TECH_REQS = {
    106: 3,   // Espionage technology
    109: 4,   // Weapons technology
    199: 12,  // Graviton technology
};

const calculator = new Calculator({}, TECH_REQS);

describe('calcBuildCost_C: astrophysics', () => {
    // Mirrored from $techData in costs.php: astrophysics grows by 1.75 per level.
    const TECH_DATA = { 124: [4000, 8000, 4000, 1.75] };
    // The result comes from the vm realm, so copy it into a local array before comparing
    const local = (cost) => [...cost];

    it('floors the cost like every other tech, without rounding to hundreds', () => {
        // Measured in game (en-1): level 5 costs 37515 / 75031 / 37515.
        // The old rounding to hundreds gave 37500 / 75000 / 37500.
        expect(local(calcBuildCost_C(124, 5, TECH_DATA))).toEqual([37515, 75031, 37515]);
    });

    it('sums the floored per-level costs over a range', () => {
        // Levels 1..5: 4000 + 7000 + 12250 + 21437 + 37515 metal.
        expect(local(getBuildCost_C(124, 0, 5, TECH_DATA))).toEqual([82202, 164406, 82202]);
    });
});

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

describe('Calculator.isResearchable', () => {
    it('accepts a research whose lab requirement is met', () => {
        expect(calculator.isResearchable(199, directParams({ researchLabLevel: 12 }))).toBe(true);
        expect(calculator.isResearchable(199, directParams({ researchLabLevel: 20 }))).toBe(true);
    });

    it('rejects a research whose lab falls short', () => {
        expect(calculator.isResearchable(199, directParams({ researchLabLevel: 11 }))).toBe(false);
        expect(calculator.isResearchable(106, directParams({ researchLabLevel: 0 }))).toBe(false);
    });

    it('accepts anything that is not a research', () => {
        // Buildings, ships and defence carry no requirement, so an empty lab
        // must not make them look impossible.
        expect(calculator.isResearchable(1, directParams({ researchLabLevel: 0 }))).toBe(true);
        expect(calculator.isResearchable(204, directParams({ researchLabLevel: 0 }))).toBe(true);
    });

    it('reads the level through the IRN sum, not off the entered field', () => {
        // Same case as the getLabLevelRaiseTarget test below: the entered field
        // is empty and the per-planet table is what the calculation uses.
        const irn = new GlobalParams();
        irn.useDirectLabLevel = true;
        irn.researchLabLevel = 0;
        irn.labLevels = [12, 10, 0, 0, 0, 0, 0, 0];
        irn.labChoice = 0;
        irn.irnLevel = 1;

        expect(calculator.isResearchable(199, irn)).toBe(true);
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

describe('Calculator.halvingCost', () => {
    /** @param {number} playerClass */
    function withClass(playerClass) {
        return Object.assign(new GlobalParams(), { playerClass });
    }

    const collector = withClass(0);
    const discoverer = withClass(2);

    it('charges nothing when there is no build time', () => {
        // A research the lab level does not allow is calculated as a zero cost,
        // and a research that is not running cannot be sped up.
        expect(Calculator.halvingCost(199, 0, collector)).toBe(0);
        expect(Calculator.halvingCost(199, 0, discoverer)).toBe(0);
        expect(Calculator.halvingCost(1, 0, collector)).toBe(0);
    });

    it('charges the 750 minimum for anything under half an hour', () => {
        expect(Calculator.halvingCost(1, 1000, collector)).toBe(750);
        expect(Calculator.halvingCost(199, 1000, collector)).toBe(750);
    });

    it('charges 750 per half hour above that', () => {
        expect(Calculator.halvingCost(1, 3600, collector)).toBe(1500);
        expect(Calculator.halvingCost(199, 3600, collector)).toBe(1500);
    });

    it('gives the Discoverer 10% off a research, never below the minimum', () => {
        expect(Calculator.halvingCost(199, 3600, discoverer)).toBe(1350);
        // 750 * 0.9 = 675, which the floor lifts back to 750
        expect(Calculator.halvingCost(199, 1000, discoverer)).toBe(750);
    });

    it('leaves buildings alone for a Discoverer', () => {
        expect(Calculator.halvingCost(1, 3600, discoverer)).toBe(1500);
    });
});

// Life form class bonuses. Two researches boost a player class — the Rock'tal one
// boosts every Collector bonus, the Kaelesh one the Discoverer research speed —
// and each is amplified by its own life form's technology bonus, which the life
// form level carries at +0.1% per level.

describe('GlobalParams cargo capacity', () => {
    /** Collector with no hyperspace tech and no separate capacity increase. */
    function collector(overrides = {}) {
        const params = new GlobalParams();
        params.playerClass = 0;
        return Object.assign(params, overrides);
    }

    it('leaves the Collector bonus at 25% without the research', () => {
        expect(collector().smallCargoCapacity).toBe(6250);
        expect(collector().largeCargoCapacity).toBe(31250);
    });

    it('boosts the Collector bonus by the class bonus as the game shows it', () => {
        // 5000 + 5000 * 0.25 * 1.22, and the same on the 25000 base
        const params = collector({ collectorClassBonus: 22 });

        expect(params.smallCargoCapacity).toBe(6525);
        expect(params.largeCargoCapacity).toBe(32625);
    });

    it('ignores the class bonus for any class but the Collector', () => {
        const params = collector({ playerClass: 2, collectorClassBonus: 20 });

        expect(params.smallCargoCapacity).toBe(5000);
    });
});

describe('GlobalParams.technocratFactor', () => {
    // The game's life form panel prints the class bonus already amplified by the
    // life form technology bonus ("Discoverer, Total: 57.35%"), so the field is
    // taken as it stands - nothing is applied to it a second time.
    it('boosts the Discoverer research speed by the class bonus as the game shows it', () => {
        const params = new GlobalParams();
        params.playerClass = 2;
        params.discovererClassBonus = 22;

        // 1 - 0.25 * (1 + 0.22)
        expect(params.technocratFactor).toBeCloseTo(0.695, 10);
    });

    it('keeps the bare 25% reduction without the research', () => {
        const params = new GlobalParams();
        params.playerClass = 2;

        expect(params.technocratFactor).toBe(0.75);
    });
});

describe('Calculator.calculateProduction', () => {
    /** A metal mine on position 8, the only place the class bonus can show up. */
    function mineParams(overrides = {}) {
        const params = new GlobalParams();
        params.playerClass = 0;
        params.planetPos = 8;
        params.universeSpeed = 1;
        return Object.assign(params, overrides);
    }

    it('passes the Collector bonus into the production rate', () => {
        const bare = calculator.calculateProduction(1, 10, mineParams());
        const boosted = calculator.calculateProduction(
            1, 10, mineParams({ collectorClassBonus: 22 })
        );

        // The class row is round(basePR * 0.25 * k): 263 at k=1, 320 at k=1.22
        expect(boosted - bare).toBe(57);
    });

    it('adds nothing for a class other than the Collector', () => {
        const params = mineParams({ playerClass: 1, collectorClassBonus: 22 });

        expect(calculator.calculateProduction(1, 10, params))
            .toBe(calculator.calculateProduction(1, 10, mineParams({ playerClass: 1 })));
    });

    it('adds the 5% alliance Traders bonus to mine production', () => {
        const bare = calculator.calculateProduction(1, 10, mineParams());
        const traded = calculator.calculateProduction(1, 10, mineParams({ isTrader: true }));

        // The alliance class row is round(basePR * 0.05): round(1050.4657... * 0.05) = 53
        expect(traded - bare).toBe(53);
    });

    it('leaves energy production untouched by the Traders bonus', () => {
        const params = mineParams({ isTrader: true });

        expect(calculator.calculateProduction(4, 10, params))
            .toBe(calculator.calculateProduction(4, 10, mineParams()));
    });
});

describe('universeSpeeds', () => {
    // The result comes from the vm realm, so compare fields, not objects
    const speeds = (serverData) => {
        const { universeSpeed, researchSpeed } = universeSpeeds(serverData);
        return [universeSpeed, researchSpeed];
    };

    it('researches at the economy speed times the research divisor', () => {
        // Buzz (de 283): economy 5, divisor 3 — 15x, not the 10x players guess
        expect(speeds({ speed: '5', researchDurationDivisor: '3' })).toEqual([5, 15]);
        // Undae (de 199): economy 10, divisor 2
        expect(speeds({ speed: '10', researchDurationDivisor: '2' })).toEqual([10, 20]);
    });

    it('falls back to 1x for a missing or unreadable setting', () => {
        expect(speeds({ speed: '8' })).toEqual([8, 8]);
        expect(speeds({ speed: '', researchDurationDivisor: 'x' })).toEqual([1, 1]);
    });
});

// One research measured in-game, kept as the anchor for the whole chain: the
// class bonus, the technocrat, the life form reduction, the research speed and
// the total lab level all land on it at once. A German player's account in
// Undae, 2026-09-23 (feedback/additions): Laser Technology 12 -> 13, 17 planets
// at Research Lab 20, IRN 17, all officers, Discoverer with "Total: 57.35%" on
// the life form panel, and the life form research tracker reporting -52.382%.
// The game showed 2m 20s. Reading the 57.35% as a raw figure to be amplified by
// the life form level would give 2m 17s instead.
describe('Calculator.calculate - a research time measured in the game', () => {
    const LASER_TECH = 120;
    // [metal, crystal, deuterium, cost growth factor], as costs.tpl emits it
    const costs = { [LASER_TECH]: [200, 100, 0, 2] };

    it('matches the game to the second on Laser Technology 13', () => {
        const params = new GlobalParams();
        params.playerClass = 2;
        params.discovererClassBonus = 57.35;
        params.technocrat = true;
        params.researchSpeed = 20;          // economy 10 x research divisor 2
        params.useDirectLabLevel = true;
        params.researchLabLevel = 340;      // 17 planets at lab 20, all in the IRN
        params.labChoice = -1;
        params.lfResTimeRdcMap = { [LASER_TECH]: 52.382 };

        const result = new Calculator(costs, { [LASER_TECH]: 1 })
            .calculate(new BuildRequest(LASER_TECH, 12, 13), params);

        expect(result.time).toBe(140);
    });
});
