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
const { GlobalParams, Calculator } = load(
    [
        'ogame/calc/js/ogame-production.js',
        'ogame/calc/js/ogame-costs.js',
        'ogame/calc/js/costs-core.js',
    ],
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

describe('GlobalParams class bonus amplification', () => {
    it('amplifies the Collector bonus by the Rock’tal life form level', () => {
        const params = new GlobalParams();
        params.collectorClassBonus = 20;
        params.lfRocktalLevel = 100;

        // 20% * (1 + 100 * 0.001) = 22%
        expect(params.collectorBonusPct).toBeCloseTo(22, 10);
    });

    it('amplifies the Discoverer bonus by the Kaelesh life form level', () => {
        const params = new GlobalParams();
        params.discovererClassBonus = 20;
        params.lfKaeleshLevel = 100;

        expect(params.discovererBonusPct).toBeCloseTo(22, 10);
    });

    it('leaves a bonus untouched when its life form level is zero', () => {
        const params = new GlobalParams();
        params.collectorClassBonus = 20;
        params.discovererClassBonus = 20;

        expect(params.collectorBonusPct).toBe(20);
        expect(params.discovererBonusPct).toBe(20);
    });
});

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

    it('boosts the Collector bonus by the amplified class bonus', () => {
        // 5000 + 5000 * 0.25 * 1.22, and the same on the 25000 base
        const params = collector({ collectorClassBonus: 20, lfRocktalLevel: 100 });

        expect(params.smallCargoCapacity).toBe(6525);
        expect(params.largeCargoCapacity).toBe(32625);
    });

    it('ignores the class bonus for any class but the Collector', () => {
        const params = collector({ playerClass: 2, collectorClassBonus: 20, lfRocktalLevel: 100 });

        expect(params.smallCargoCapacity).toBe(5000);
    });
});

describe('GlobalParams.technocratFactor', () => {
    it('boosts the Discoverer research speed by the amplified class bonus', () => {
        const params = new GlobalParams();
        params.playerClass = 2;
        params.discovererClassBonus = 20;
        params.lfKaeleshLevel = 100;

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

    it('passes the amplified Collector bonus into the production rate', () => {
        const bare = calculator.calculateProduction(1, 10, mineParams());
        const boosted = calculator.calculateProduction(
            1, 10, mineParams({ collectorClassBonus: 20, lfRocktalLevel: 100 })
        );

        // The class row is round(basePR * 0.25 * k): 263 at k=1, 320 at k=1.22
        expect(boosted - bare).toBe(57);
    });

    it('adds nothing for a class other than the Collector', () => {
        const params = mineParams({ playerClass: 1, collectorClassBonus: 20, lfRocktalLevel: 100 });

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
