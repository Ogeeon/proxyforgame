'use strict';

// Pure computation tests for the costs calculator: the rules that live in
// costs-core.js and need no DOM — research lab levels, the life form class
// bonuses and what they feed (cargo capacity, research speed, mine output).
// Everything else the calculator has is Playwright.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

// ogame-production.js, ogame-costs.js and ogame-cargo.js first: costs-core.js
// calls their getProductionRate, getHalvingCost and shipHold helpers the way the
// page does, with all four scripts sharing one global scope.
const {
    GlobalParams, Calculator, BuildRequest, universeSpeeds, calcBuildCost_C, getBuildCost_C, getBuildTime_C,
    componentEffect, costsTableLayout, COSTS_TAB_TABLES, costsRangeTable, COSTS_RANGE_TABLES,
} = load(
    [
        'ogame/calc/js/ogame-production.js',
        'ogame/calc/js/ogame-costs.js',
        'ogame/calc/js/ogame-cargo.js',
        'ogame/calc/js/costs-core.js',
    ],
    ['GlobalParams', 'Calculator', 'BuildRequest', 'universeSpeeds', 'calcBuildCost_C', 'getBuildCost_C',
        'getBuildTime_C', 'componentEffect', 'costsTableLayout', 'COSTS_TAB_TABLES', 'costsRangeTable',
        'COSTS_RANGE_TABLES'],
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
 * Global params with the research network switched off — the calculator's
 * default state, where the entered lab level is the only source of the
 * resulting level.
 * @param {Partial<any>} [overrides]
 */
function directParams(overrides = {}) {
    const params = new GlobalParams();
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
        // Same case as the getLabLevelRaiseTarget test below: with the network
        // switched on the per-planet table is what the calculation uses.
        const irn = new GlobalParams();
        irn.useIrn = true;
        irn.researchLabLevel = 0;
        irn.labLevels = [12, 10, 0, 0, 0, 0, 0, 0];
        irn.labChoice = 0;
        irn.irnLevel = 1;

        expect(calculator.isResearchable(199, irn)).toBe(true);
    });
});

describe('GlobalParams.getResultingLabLevel', () => {
    it('without the network takes the entered lab, 0 included, never the table', () => {
        const params = directParams({ researchLabLevel: 0, labLevels: [12, 10, 0], labChoice: 0, irnLevel: 1 });
        expect(params.getResultingLabLevel()).toBe(0);
        expect(calculator.isResearchable(199, params)).toBe(false);
    });

    it('with the network takes the table alone, never the entered lab', () => {
        const params = Object.assign(new GlobalParams(), {
            useIrn: true, researchLabLevel: 20, labLevels: [0, 0, 0], labChoice: -1, irnLevel: 2,
        });
        expect(params.getResultingLabLevel()).toBe(0);
        expect(calculator.isResearchable(106, params)).toBe(false);
    });

    it('with the network and no lab meeting the requirement, the research cannot run', () => {
        const params = Object.assign(new GlobalParams(), {
            useIrn: true, researchLabLevel: 20, labLevels: [5, 5, 5], labChoice: 0, irnLevel: 2,
        });
        expect(params.getResultingLabLevel(12)).toBe(0);
    });

    it('with no start chosen the network starts on the best lab', () => {
        const params = Object.assign(new GlobalParams(), {
            useIrn: true, labLevels: [4, 9, 7, 1], labChoice: -1, irnLevel: 1,
        });
        expect(params.getResultingLabLevel()).toBe(16);
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
        // With the network switched on the per-planet table counts, where a lab
        // of 12 already clears what the Graviton needs. Comparing against
        // researchLabLevel alone would report a shortfall here and overwrite a
        // configuration that is in fact sufficient.
        const irn = new GlobalParams();
        irn.useIrn = true;
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
        irn.useIrn = true;
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

        // The mine makes 1050 an hour, so the class row is 1050 * 0.25 * k: 262.5 at k=1,
        // 320.25 at k=1.22. The game floors the total, not each row: 1352 and 1410.
        expect(boosted - bare).toBe(58);
    });

    it('adds nothing for a class other than the Collector', () => {
        const params = mineParams({ playerClass: 1, collectorClassBonus: 22 });

        expect(calculator.calculateProduction(1, 10, params))
            .toBe(calculator.calculateProduction(1, 10, mineParams({ playerClass: 1 })));
    });

    it('adds the 5% alliance Traders bonus to mine production', () => {
        const bare = calculator.calculateProduction(1, 10, mineParams());
        const traded = calculator.calculateProduction(1, 10, mineParams({ isTrader: true }));

        // The alliance class row is 5% of the 1050 the mine makes: 52.5. The totals are floored
        // once, floor(1352.5) and floor(1405), so they differ by 53
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
        params.researchLabLevel = 340;      // 17 planets at lab 20, all in the IRN
        params.labChoice = -1;
        params.lfResTimeRdcMap = { [LASER_TECH]: 52.382 };

        const result = new Calculator(costs, { [LASER_TECH]: 1 })
            .calculate(new BuildRequest(LASER_TECH, 12, 13), params);

        expect(result.time).toBe(140);
    });
});

// The game counts points from the full cost: a life form cost reduction lowers what
// the player pays, not what the build or research awards.
describe('Calculator.calculate - points ignore life form cost reductions', () => {
    const LASER_TECH = 120;
    const METAL_MINE = 1;
    // [metal, crystal, deuterium, cost growth factor], as costs.tpl emits it
    const costs = { [LASER_TECH]: [200, 100, 0, 2], [METAL_MINE]: [60, 15, 0, 1.5] };
    const calc = new Calculator(costs, { [LASER_TECH]: 1 });

    const paramsWith = (overrides) => Object.assign(new GlobalParams(), {
        useDirectLabLevel: true,
        researchLabLevel: 10,
        labChoice: -1,
    }, overrides);

    it('keeps the points of a research under a 50% life form research reduction', () => {
        const request = new BuildRequest(LASER_TECH, 0, 10);
        const full = calc.calculate(request, paramsWith({}));
        const reduced = calc.calculate(request, paramsWith({ lfResCostRdcMap: { [LASER_TECH]: 50 } }));

        expect(full.metal).toBe(204600);
        expect(reduced.metal).toBe(102300);
        expect(reduced.crystal).toBe(51150);
        expect(full.points).toBe(306);
        expect(reduced.points).toBe(306);
    });

    it('keeps the points of a mine under a 50% Mineral Research Centre reduction', () => {
        const request = new BuildRequest(METAL_MINE, 0, 20);
        const full = calc.calculate(request, paramsWith({}));
        const reduced = calc.calculate(request, paramsWith({ mineralResCntrLvl: 100 }));

        expect(full.metal).toBe(398901);
        // Each level halved and floored on its own (#58), not half the total (199450)
        expect(reduced.metal).toBe(199444);
        expect(full.points).toBe(498);
        expect(reduced.points).toBe(498);
    });

    it('prices nothing for a Control Centre component whose target is below the start', () => {
        const IAS_RECOVERY_CENTRE = 46;
        const down = calc.calculate(new BuildRequest(IAS_RECOVERY_CENTRE, 5, 4), paramsWith({}));

        expect(new BuildRequest(IAS_RECOVERY_CENTRE, 5, 4).isValid).toBe(false);
        expect(new BuildRequest(IAS_RECOVERY_CENTRE, 4, 5).isValid).toBe(true);
        expect(down.metal).toBe(0);
        expect(down.time).toBe(0);
        expect(down.points).toBe(0);
        // An ordinary building can still be demolished
        expect(calc.calculate(new BuildRequest(METAL_MINE, 5, 4), paramsWith({})).metal).toBeGreaterThan(0);
    });

    it('still scales the unreduced points with the quantity', () => {
        const request = new BuildRequest(LASER_TECH, 0, 10, false, 2);
        const reduced = calc.calculate(request, paramsWith({ lfResCostRdcMap: { [LASER_TECH]: 50 } }));

        expect(reduced.points).toBe(612);
    });
});

// The game builds one level at a time and rounds each level's reduced cost and
// time down on its own, so a range under a life form reduction is the sum of its
// levels. Flooring the reduced total once came out up to a unit per level higher,
// and disagreed with the terraformer calculator on the same range (#58).
describe('Calculator.calculate - life form reductions round each level of a range', () => {
    const TERRAFORMER = 33;
    const LASER_TECH = 120;
    // [metal, crystal, deuterium, cost growth factor], as costs.tpl emits it
    const costs = { [TERRAFORMER]: [0, 50000, 100000, 2], [LASER_TECH]: [200, 100, 0, 2] };
    const calc = new Calculator(costs, { [LASER_TECH]: 1 });
    const terraformerParams = () => Object.assign(new GlobalParams(), {
        robotFactoryLevelPlanet: 10,
        lfTerraformerRdc: 25,
        lfTerraformerTimeRdc: 25,
    });

    it('floors the Terraformer time of each level, as the terraformer calculator does', () => {
        // Levels 5, 6, 7 at robotics 10 take 69818, 209454 and 418909 s. A quarter
        // off each, floored: 52363 + 157090 + 314181 = 523634 s, not 523635 s.
        const result = calc.calculate(new BuildRequest(TERRAFORMER, 4, 7), terraformerParams());

        expect(result.time).toBe(523634);
        expect(result.crystal).toBe(4200000);
        expect(result.deuterium).toBe(8400000);
    });

    it('floors the research time of each level', () => {
        // Levels 1-4 at lab 10: 98.18, 196.36, 392.73 and 785.45 s. A quarter off
        // each, floored: 73 + 147 + 294 + 589 = 1103 s, not 1104 s.
        const params = Object.assign(new GlobalParams(), {
            useDirectLabLevel: true,
            researchLabLevel: 10,
            labChoice: -1,
            lfResTimeRdcMap: { [LASER_TECH]: 25 },
        });
        const result = calc.calculate(new BuildRequest(LASER_TECH, 0, 4), params);

        expect(result.time).toBe(1103);
    });

    it('leaves a single level as it was', () => {
        const result = calc.calculate(new BuildRequest(TERRAFORMER, 6, 7), terraformerParams());

        expect(result.time).toBe(314181);
    });
});

// Life form research gives the Terraformer 0.1% off its cost and 0.2% off its
// build time per level, capped at 50% and 99%. A time reduction of 0 means the
// game's own pairing: twice the cost reduction.
describe('Calculator.calculate - the Terraformer cost and time reductions', () => {
    const TERRAFORMER = 33;
    const ROBOTICS = 14;
    const costs = { [TERRAFORMER]: [0, 50000, 100000, 2], [ROBOTICS]: [400, 120, 200, 2] };
    const calc = new Calculator(costs, {});
    const params = (overrides) => Object.assign(new GlobalParams(), overrides);
    // Levels 1-4 without a robotics factory take 20571 + 48000 + 115200 + 288000
    // = 471771 s and cost 750000 crystal, 1500000 deuterium.
    const levels1to4 = (overrides) => calc.calculate(new BuildRequest(TERRAFORMER, 0, 4), params(overrides));

    it('changes nothing without a reduction', () => {
        const result = levels1to4({});
        expect(result.crystal).toBe(750000);
        expect(result.time).toBe(471771);
    });

    it('takes twice the cost reduction off the time when no time reduction is entered', () => {
        // 40% off the cost, 80% off the time: 4114 + 9600 + 23040 + 57600.
        const result = levels1to4({ lfTerraformerRdc: 40 });
        expect(result.crystal).toBe(450000);
        expect(result.deuterium).toBe(900000);
        expect(result.time).toBe(94354);
    });

    it('uses an entered time reduction as it is', () => {
        // 10% off the time: 18513 + 43200 + 103680 + 259200.
        const result = levels1to4({ lfTerraformerRdc: 40, lfTerraformerTimeRdc: 10 });
        expect(result.crystal).toBe(450000);
        expect(result.time).toBe(424593);
    });

    it('caps the time reduction at 99%, the cost one at 50%', () => {
        // 99% off the time: 205 + 480 + 1152 + 2880.
        const result = levels1to4({ lfTerraformerRdc: 50 });
        expect(result.crystal).toBe(375000);
        expect(result.time).toBe(4717);
    });

    it('leaves the other buildings alone', () => {
        const plain = calc.calculate(new BuildRequest(ROBOTICS, 0, 3), params({}));
        const reduced = calc.calculate(new BuildRequest(ROBOTICS, 0, 3), params({ lfTerraformerRdc: 40, lfTerraformerTimeRdc: 60 }));
        expect(reduced.metal).toBe(plain.metal);
        expect(reduced.time).toBe(plain.time);
    });
});

describe('GlobalParams.validate', () => {
    // loadFromCookie hands every stored leaf over as a string.
    const v = (field, value) => GlobalParams.validate(field, String(value));

    it('keeps a value the form accepts', () => {
        expect(v('shipyardLevel', 12)).toBe(12);
        expect(v('maxPlanetTemp', -23)).toBe(-23);
        expect(v('lfTerraformerRdc', 12.5)).toBe(12.5);
        expect(v('lfTerraformerTimeRdc', 85.5)).toBe(85.5);
        expect(v('rates', 1.75)).toBe(1.75);
        expect(v('labChoice', -1)).toBe(-1);
    });

    it('falls back to the default, not to the nearest bound', () => {
        expect(v('shipyardLevel', -5)).toBe(0);
        expect(v('planetPos', 0)).toBe(8);
        expect(v('planetPos', 17)).toBe(8);
        expect(v('universeSpeed', 99)).toBe(1);
        expect(v('lfTerraformerRdc', 80)).toBe(0);
        expect(v('lfTerraformerTimeRdc', 120)).toBe(0);
        expect(v('maxPlanetTemp', -500)).toBe(0);
    });

    it('takes a value that is not a number as the default', () => {
        expect(v('robotFactoryLevelPlanet', 'abc')).toBe(0);
        expect(v('booster', '')).toBe(0);
    });

    it('reads a boolean only from "true"', () => {
        expect(v('geologist', true)).toBe(true);
        expect(v('geologist', false)).toBe(false);
        expect(v('geologist', 'yes')).toBe(false);
    });

    it('leaves a rate it rejects for normalizeStored to fill in', () => {
        expect(Number.isNaN(v('rates', 500))).toBe(true);
    });

    it('passes a field it has no rule for through', () => {
        expect(v('country', 'de')).toBe('de');
        expect(v('toString', 'x')).toBe('x');
    });
});

describe('GlobalParams.normalizeStored', () => {
    const normalized = (state) => {
        GlobalParams.normalizeStored(state);
        return { labLevels: [...state.labLevels], labChoice: state.labChoice, rates: [...state.rates] };
    };

    it('keeps lab levels and rates of the right shape', () => {
        expect(normalized({ labLevels: [12, 11, 10], labChoice: 2, rates: [2.5, 1.75, 1] }))
            .toEqual({ labLevels: [12, 11, 10], labChoice: 2, rates: [2.5, 1.75, 1] });
    });

    it('gives lab levels that are not a list eight planets at 0', () => {
        expect(normalized({ labLevels: 0, labChoice: -1, rates: [1, 1.5, 3] }).labLevels)
            .toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
        expect(normalized({ labLevels: [], labChoice: -1, rates: [1, 1.5, 3] }).labLevels)
            .toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('drops a lab choice past the last planet', () => {
        expect(normalized({ labLevels: [12, 11], labChoice: 5, rates: [1, 1.5, 3] }).labChoice).toBe(-1);
    });

    it('fills a rejected rate with that rate\'s own default', () => {
        expect(normalized({ labLevels: [0], labChoice: -1, rates: [Number.NaN, 2, Number.NaN] }).rates)
            .toEqual([1, 2, 3]);
    });

    it('replaces rates that are not three numbers', () => {
        expect(normalized({ labLevels: [0], labChoice: -1, rates: 1 }).rates).toEqual([1, 1.5, 3]);
        expect(normalized({ labLevels: [0], labChoice: -1, rates: [1, 2] }).rates).toEqual([1, 1.5, 3]);
    });
});

describe('data/costs-techs.json: ship ids', () => {
    const { readFileSync } = require('node:fs');
    const path = require('node:path');
    /** @type {{techs: Record<string, {key: string, type: number, cost: number[]}>}} */
    const data = JSON.parse(readFileSync(path.join(__dirname, '../www/ogame/calc/data/costs-techs.json'), 'utf8'));
    const ships = Object.entries(data.techs).filter(([, t]) => t.type === 5);

    it('numbers the ships the way the game does', () => {
        // 216 is no game ship; the last three are the crawler, the reaper and the pathfinder.
        expect(ships.map(([id]) => Number(id))).toEqual(
            [202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 217, 218, 219]);
    });

    it('prices the crawler, the reaper and the pathfinder under their game ids', () => {
        expect([data.techs['217'].key, data.techs['217'].cost]).toEqual(['crawler', [2000, 2000, 1000]]);
        expect([data.techs['218'].key, data.techs['218'].cost]).toEqual(['reaper', [85000, 55000, 20000]]);
        expect([data.techs['219'].key, data.techs['219'].cost]).toEqual(['pathfinder', [8000, 15000, 8000]]);
    });
});

describe('data/costs-techs.json: anomaly scanner', () => {
    const { readFileSync } = require('node:fs');
    const path = require('node:path');
    /** @type {{techs: Record<string, {key: string, type: number, cost: number[], growth: number}>}} */
    const data = JSON.parse(readFileSync(path.join(__dirname, '../www/ogame/calc/data/costs-techs.json'), 'utf8'));
    const scanner = data.techs['45'];
    // The [metal, crystal, deut, growth] shape the cost and time functions take.
    const techData = { 45: [...scanner.cost, scanner.growth] };

    // Levels 1-10 as recorded in the game (Project Orion beta): metal, crystal, deuterium,
    // and the build time in seconds at universe speed 100 with no robotics or nanites.
    // The game shows whole seconds, truncated rather than rounded.
    const SHEET = [
        [90, 45, 15, 1],
        [135, 67, 22, 1],
        [202, 101, 33, 1],
        [303, 151, 50, 3],
        [455, 227, 75, 6],
        [683, 341, 113, 14],
        [1025, 512, 170, 22],
        [1537, 768, 256, 33],
        [2306, 1153, 384, 49],
        [3459, 1729, 576, 74],
    ];

    it('is a planet-only building priced 90/45/15 with growth 1.5', () => {
        expect([scanner.key, scanner.type, scanner.cost, scanner.growth])
            .toEqual(['anomaly-scanner', 2, [90, 45, 15], 1.5]);
    });

    it('costs what the game charges for levels 1-10', () => {
        const costs = SHEET.map((_, i) => calcBuildCost_C(45, i + 1, techData));
        expect(costs).toEqual(SHEET.map(row => row.slice(0, 3)));
    });

    it('takes the game build time for each level, early-level reduction included', () => {
        const times = SHEET.map((_, i) => Math.floor(getBuildTime_C({
            techID: 45, techLevelFrom: i, techLevelTo: i + 1, techData,
            robotsLevel: 0, nanitesLevel: 0, uniSpeed: 100,
        })));
        expect(times).toEqual(SHEET.map(row => row[3]));
    });
});

describe('data/costs-techs.json: Control Centre components', () => {
    const { readFileSync } = require('node:fs');
    const path = require('node:path');
    /** @type {{techs: Record<string, {key: string, type: number, gameId?: number, cost: number[], growth: number, effect?: number|null}>}} */
    const data = JSON.parse(readFileSync(path.join(__dirname, '../www/ogame/calc/data/costs-techs.json'), 'utf8'));
    const components = Object.entries(data.techs).filter(([, tech]) => tech.type === 7);
    const techData = Object.fromEntries(components.map(([id, tech]) => [id, [...tech.cost, tech.growth]]));

    // Levels 1-3 as recorded in the game (Project Orion beta, D:\temp\IAS CP.xlsx),
    // with the Catalytic Converter's metal typo on level 3 corrected (286875).
    const SHEET = {
        'ias-recovery-centre': [[75000, 52500, 22500], [112500, 78750, 33750], [168750, 118125, 50625]],
        'ias-lithium-lab': [[52500, 37500, 37500], [78750, 56250, 56250], [118125, 84375, 84375]],
        'ias-metal-recycling': [[112500, 37500, 18000], [168750, 56250, 27000], [253125, 84375, 40500]],
        'ias-crystal-finishing': [[37500, 67500, 27000], [56250, 101250, 40500], [84375, 151875, 60750]],
        'ias-anomaly-analysis': [[67500, 37500, 22500], [101250, 56250, 33750], [151875, 84375, 50625]],
        'ias-deuterium-tanks': [[30000, 37500, 45000], [45000, 56250, 67500], [67500, 84375, 101250]],
        'ias-catalytic-converter': [[127500, 112500, 52500], [191250, 168750, 78750], [286875, 253125, 118125]],
    };

    it('lists the seven components, all with growth 1.5', () => {
        expect(components.map(([, tech]) => [tech.key, tech.growth]))
            .toEqual(Object.keys(SHEET).map(key => [key, 1.5]));
    });

    it('costs what the game charges for levels 1-3', () => {
        for (const [id, tech] of components) {
            const costs = [1, 2, 3].map(level => calcBuildCost_C(Number(id), level, techData));
            expect([tech.key, costs]).toEqual([tech.key, SHEET[tech.key]]);
        }
    });

    it('rounds level 4 down, as the game shows the Lithium Electrolysis Lab', () => {
        // 52500/37500/37500 x 1.5^3 = 177187.5/126562.5/126562.5
        const [id] = components.find(([, tech]) => tech.key === 'ias-lithium-lab') ?? [];
        expect(calcBuildCost_C(Number(id), 4, techData)).toEqual([177187, 126562, 126562]);
    });

    it('carries the ids the game gives them in the Control Centre', () => {
        // data-technology of each component on the game's Control Centre page
        expect(Object.fromEntries(components.map(([, tech]) => [tech.key, tech.gameId]))).toEqual({
            'ias-recovery-centre': 4001,
            'ias-lithium-lab': 4002,
            'ias-metal-recycling': 4003,
            'ias-crystal-finishing': 4004,
            'ias-anomaly-analysis': 4005,
            'ias-deuterium-tanks': 4006,
            'ias-catalytic-converter': 4007,
        });
    });

    it('takes the build time the game shows for the next level', () => {
        // Read in game (Singularity, 2026-11-17) on a planet with Robotics Factory 10 and
        // Nanite Factory 3, universe speed 10: the level built up to and the time in whole
        // seconds. Levels 3 and 4 only match with the early-level reduction.
        const GAME = {
            'ias-recovery-centre': [3, 187],
            'ias-lithium-lab': [4, 248],
            'ias-metal-recycling': [3, 220],
            'ias-crystal-finishing': [3, 154],
            'ias-anomaly-analysis': [3, 154],
            'ias-deuterium-tanks': [3, 99],
            'ias-catalytic-converter': [3, 353],
        };
        for (const [id, tech] of components) {
            const [level] = GAME[tech.key];
            const time = Math.floor(getBuildTime_C({
                techID: Number(id), techLevelFrom: level - 1, techLevelTo: level, techData,
                robotsLevel: 10, nanitesLevel: 3, uniSpeed: 10,
            }));
            expect([tech.key, level, time]).toEqual([tech.key, ...GAME[tech.key]]);
        }
    });

    it('gives what the game\'s bonus tables show: 0.2% per level, a 0.05% discount for the converter', () => {
        // The "?" table of each component (Singularity, 2026-11-18), levels 1-15
        const effects = Object.fromEntries(components.map(([, tech]) => [tech.key, tech.effect]));
        expect(effects).toEqual({
            'ias-recovery-centre': 0.2,
            'ias-lithium-lab': 0.2,
            'ias-metal-recycling': 0.2,
            'ias-crystal-finishing': 0.2,
            'ias-anomaly-analysis': 0.2,
            'ias-deuterium-tanks': 0.2,
            'ias-catalytic-converter': -0.05,
        });
    });
});

describe('componentEffect', () => {
    it('grows by the same step every level', () => {
        expect([0, 1, 5, 15].map(level => componentEffect(0.2, level))).toEqual([0, 0.2, 1, 3]);
    });

    it('leaves no floating-point tail', () => {
        // 0.05 * 3 is 0.15000000000000002 in plain arithmetic
        expect([3, 7, 13].map(level => componentEffect(0.05, level))).toEqual([0.15, 0.35, 0.65]);
    });

    it('keeps the sign of a discount', () => {
        expect(componentEffect(-0.05, 3)).toBe(-0.15);
    });

    it('is null while the effect is unknown', () => {
        expect([componentEffect(null, 4), componentEffect(undefined, 4)]).toEqual([null, null]);
    });
});

describe('costsTableLayout', () => {
    it('puts the Control Centre next to the buildings on both "all items" tabs', () => {
        expect([[...COSTS_TAB_TABLES[0]], [...COSTS_TAB_TABLES[1]]]).toEqual([
            ['table-0-2', 'table-0-3', 'table-0-7', 'table-0-4', 'table-0-5', 'table-0-6'],
            ['table-1-2', 'table-1-3', 'table-1-7', 'table-1-4'],
        ]);
    });

    it('shifts the results past the quantity or the effect column', () => {
        const first = id => costsTableLayout(id).firstDataCol;
        expect(['table-0-4', 'table-0-2', 'table-0-7', 'table-1-4', 'table-1-3', 'table-1-7'].map(first))
            .toEqual([3, 4, 4, 4, 5, 5]);
    });

    it('gives the effect column only to the Control Centre and the quantity only to buildings', () => {
        const flags = id => {
            const { hasQtyCol, hasEffectCol, isBuildingTable, subtotalStartCol } = costsTableLayout(id);
            return [hasQtyCol, hasEffectCol, isBuildingTable, subtotalStartCol];
        };
        expect(['table-1-2', 'table-0-7', 'table-0-5'].map(flags)).toEqual([
            [true, false, true, 4],
            [false, true, false, 4],
            [false, false, false, 3],
        ]);
    });

    it('drops the energy column from the Control Centre and Dark Matter from the several-levels tab', () => {
        const columns = id => [...costsTableLayout(id).resultColumns];
        expect(['table-0-2', 'table-0-7', 'table-1-4', 'table-1-7'].map(columns)).toEqual([
            ['metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points', 'dm'],
            ['metal', 'crystal', 'deuterium', 'msu', 'time', 'points', 'dm'],
            ['metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points'],
            ['metal', 'crystal', 'deuterium', 'msu', 'time', 'points'],
        ]);
    });
});

describe('costsRangeTable', () => {
    const METAL_MINE = 1;
    const ROBOTICS = 14;
    const LITHIUM_LAB = 47;

    it('picks the producers\' table, the components\' or the common one', () => {
        expect([
            costsRangeTable(METAL_MINE, false).id,
            costsRangeTable(LITHIUM_LAB, true).id,
            costsRangeTable(ROBOTICS, false).id,
        ]).toEqual(['prods-table', 'ias-range-table', 'commons-table']);
    });

    it('shows a component\'s effect after the level and no energy', () => {
        expect([...costsRangeTable(LITHIUM_LAB, true).columns])
            .toEqual(['level', 'effect', 'metal', 'crystal', 'deuterium', 'msu', 'time', 'points']);
    });

    it('gives every range table its own resource inputs', () => {
        expect(COSTS_RANGE_TABLES.map(table => table.prefix)).toEqual(['prods', 'ias', 'commons']);
    });
});
