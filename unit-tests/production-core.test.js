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
    ['ogame/calc/js/ogame-costs.js', 'ogame/calc/js/ogame-production.js', 'ogame/calc/js/production-core.js'],
    ['createEmptyPlanet', 'isPlnEmpty', 'mineSlot', 'PLANET_TEMP', 'PLANET_POS', 'PLANET_RACE', 'PLANET_LF_LEVELS', 'lfResearchIncrease', 'lfBuildingUpgradeLevels', 'lfBuildingCostReduction',
        'calculateProduction', 'getSSCost', 'lfBuildingEffects', 'convertExchangeRates', 'convertAllPlanetParams'],
);
const { createEmptyPlanet, isPlnEmpty, lfResearchIncrease, lfBuildingUpgradeLevels, lfBuildingCostReduction,
    calculateProduction, getSSCost, lfBuildingEffects, convertExchangeRates, convertAllPlanetParams } = ctx;

const check = (planet) => isPlnEmpty(planet);

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

describe('the planet array layout', () => {
    it('names the slots createEmptyPlanet fills', () => {
        const { createEmptyPlanet, mineSlot, PLANET_TEMP, PLANET_POS, PLANET_RACE, PLANET_LF_LEVELS } = ctx;
        const planet = createEmptyPlanet();
        expect(planet[PLANET_TEMP]).toBe(0);
        expect(planet[PLANET_POS]).toBe(8);
        expect(planet[PLANET_RACE]).toBe(0);
        expect(planet).toHaveLength(PLANET_LF_LEVELS + 12);
        expect(mineSlot(1)).toBe(3);
        expect(planet[mineSlot(7) + 1]).toBe(100);
    });
});

// calculateProduction() takes the player's settings as an argument: the page
// passes options.prm, the MCP tool builds its own, and nothing is read from a
// page global - this file never defines one.
const SETTINGS = Object.freeze({
    energyTechLevel: 12, plasmaTechLevel: 10, universeSpeed: 1,
    geologist: false, engineer: false, technocrat: false, admiral: false, commander: false,
    playerClass: 1, isTrader: false,
});
const settings = (over = {}) => ({ ...SETTINGS, ...over });

// [level, percent, booster] of metal, crystal, deuterium, solar plant, fusion
// reactor, satellites and crawlers
function rows({ mines = [30, 26, 24], solar = 30, fusion = 0, sats = 0, crawlers = [0, 100], percent = 100 } = {}) {
    return [
        [mines[0], percent, 0], [mines[1], percent, 0], [mines[2], percent, 0],
        [solar, 100, 0], [fusion, 100, 0], [sats, 100, 0], [crawlers[0], crawlers[1], 0],
    ];
}
const PLANET = [40, 8, 0]; // max temperature, position, energy booster

describe('calculateProduction', () => {
    it('sums the result rows into the planet totals', () => {
        const [results, production] = calculateProduction(rows(), PLANET, settings());
        for (let res = 0; res < 3; res++) {
            const sum = results.reduce((acc, row) => acc + row[res], 0);
            expect(production[res]).toBe(sum);
        }
    });

    it('caps the energy coefficient at 1 and scales the mines down below it', () => {
        const ample = calculateProduction(rows({ solar: 40 }), PLANET, settings());
        expect(ample[4]).toBe(1);
        const short = calculateProduction(rows({ solar: 15 }), PLANET, settings());
        expect(short[4]).toBeLessThan(1);
        expect(short[4]).toBeCloseTo(short[2] / short[3], 10);
        expect(short[1][0]).toBeLessThan(ample[1][0]);
    });

    it('ignores the energy shortfall and the mine settings when normalized', () => {
        const short = rows({ solar: 15, percent: 60 });
        const normalized = calculateProduction(short, PLANET, settings(), { normalized: true });
        const ample = calculateProduction(rows({ solar: 40 }), PLANET, settings());
        expect(normalized[0][1][0]).toBe(ample[0][1][0]);
        expect(normalized[0][2][1]).toBe(ample[0][2][1]);
    });

    it('gives the Engineer 10% of the energy produced', () => {
        const [results] = calculateProduction(rows(), PLANET, settings({ engineer: true }));
        const base = results[4][3] + results[5][3] + results[6][3];
        expect(results[11][3]).toBe(Math.round(base * 0.1));
        const [without] = calculateProduction(rows(), PLANET, settings());
        expect(without[11][3]).toBe(0);
    });

    it('gives the class row to the Collector only, amplified by the Collector bonus', () => {
        const general = calculateProduction(rows({ solar: 40 }), PLANET, settings())[0];
        expect(general[13][0]).toBe(0);
        const collector = calculateProduction(rows({ solar: 40 }), PLANET, settings({ playerClass: 0 }))[0];
        expect(collector[13][0]).toBeGreaterThan(0);
        const enhanced = calculateProduction(rows({ solar: 40 }), PLANET, settings({ playerClass: 0, lfCollectorBonus: 40 }))[0];
        expect(enhanced[13][0]).toBeGreaterThan(collector[13][0]);
    });

    it('raises the plasma row with the plasma technology level', () => {
        const low = calculateProduction(rows({ solar: 40 }), PLANET, settings())[0];
        const high = calculateProduction(rows({ solar: 40 }), PLANET, settings({ plasmaTechLevel: 11 }))[0];
        expect(high[8][0]).toBeGreaterThan(low[8][0]);
    });

    it('cuts the energy crawlers draw by the life form crawler bonus', () => {
        const crawlers = rows({ solar: 40, crawlers: [200, 100] });
        const plain = calculateProduction(crawlers, PLANET, settings())[0];
        expect(plain[7][3]).toBe(-200 * 50);
        const boosted = calculateProduction(crawlers, PLANET, settings({ lfCrawlerBonus: 50 }))[0];
        expect(boosted[7][3]).toBe(-200 * 25);
    });

    it('adds the life form research bonus on the base output of the mines', () => {
        const [results] = calculateProduction(rows({ solar: 40 }), PLANET, settings({ lfMetProdBonus: 10 }));
        expect(results[15][0]).toBe(Math.round(results[1][0] * 0.1));
        expect(results[15][1]).toBe(0);
    });

    it('credits each life form building with its own share', () => {
        // A made-up building: +2% metal per level, no energy draw
        const tables = { lfEnergy: {}, lfBonus: { 2006: { met: [2, 1, null] } } };
        const levels = [0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0];
        const lfEff = lfBuildingEffects(2, levels, tables);
        const [results, , , , , lfBld] = calculateProduction(rows({ solar: 40 }), PLANET, settings(), { lfEff });
        expect(lfBld[5][0]).toBe(Math.round(results[1][0] * 0.1));
        expect(lfBld[0][0]).toBe(0);
    });
});

describe('lfBuildingEffects', () => {
    const tables = { lfEnergy: { 2007: [10, 1.1] }, lfBonus: { 2007: { enR: [0.5, 1, 0.4] } } };
    const levels = [0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0]; // Disruption Chamber at 10

    it('reads energy and bonuses from the tables it is given', () => {
        const eff = lfBuildingEffects(2, levels, tables);
        expect(eff.energyUsed).toBe(Math.floor(10 * 10 * Math.pow(1.1, 10)));
        expect(eff.enR).toBeCloseTo(5, 10);
        expect(eff.perBld[6].energyUsed).toBe(eff.energyUsed);
    });

    it('caps a bonus at its maximum', () => {
        const eff = lfBuildingEffects(2, [0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0], tables);
        expect(eff.enR).toBe(40);
    });

    it('has no effect without a life form', () => {
        expect(lfBuildingEffects(0, levels, tables).energyUsed).toBe(0);
    });
});

describe('getSSCost', () => {
    it('prices whole satellites that cover the extra energy of the next level', () => {
        const cost = getSSCost(1, 30, PLANET, settings());
        expect(cost[0]).toBe(0);
        expect(cost[1] % 2000).toBe(0);
        expect(cost[2]).toBe(cost[1] / 4);
        expect(cost[1]).toBeGreaterThan(0);
    });

    it('needs no more satellites with the Engineer', () => {
        const plain = getSSCost(1, 30, PLANET, settings());
        const engineer = getSSCost(1, 30, PLANET, settings({ engineer: true }));
        expect(engineer[1]).toBeLessThanOrEqual(plain[1]);
    });
});

// The settings a cookie from an older version of the page holds are migrated
// in place on load (production.tpl).
describe('convertExchangeRates', () => {
    it('rewrites a legacy trade ratio as MSU weights', () => {
        const prm = { rates: [3, 2, 1], ratesFmt: 1 };
        convertExchangeRates(prm);
        expect(prm.rates).toEqual([1, 1.5, 3]);
        expect(prm.ratesFmt).toBe(2);
    });

    it('rounds an uneven ratio to two decimals', () => {
        const prm = { rates: [4, 3, 1], ratesFmt: 1 };
        convertExchangeRates(prm);
        expect(prm.rates).toEqual([1, 1.33, 4]);
    });

    it('falls back to the default for an unusable ratio', () => {
        const prm = { rates: [3, 0, 1], ratesFmt: 1 };
        convertExchangeRates(prm);
        expect(prm.rates).toEqual([1, 1.5, 3]);
    });

    it('leaves rates already in the new format alone', () => {
        const prm = { rates: [1, 2, 4], ratesFmt: 2 };
        convertExchangeRates(prm);
        expect(prm.rates).toEqual([1, 2, 4]);
    });
});

describe('convertAllPlanetParams', () => {
    it('rebuilds the planet list from the rows saved before it existed', () => {
        // [temperature, seven levels, position]
        const prm = { currPlanetsCount: 1, aPPP: [[-20, 30, 25, 20, 22, 0, 10, 0, 6]], aPS: [], aPNames: [], aPB: [[1]] };
        convertAllPlanetParams(prm, 'Planet ');
        const planet = prm.aPS[0];
        expect(planet[ctx.PLANET_TEMP]).toBe(-20);
        expect(planet[ctx.PLANET_POS]).toBe(6);
        expect(planet[ctx.mineSlot(1)]).toBe(30);
        expect(planet[ctx.mineSlot(6)]).toBe(10);
        expect(planet[ctx.mineSlot(1) + 1]).toBe(100);
        expect(planet[ctx.PLANET_RACE]).toBe(0);
        expect(prm.aPNames).toEqual(['Planet 1']);
        expect(prm.aPPP).toEqual([[]]);
        expect(prm.aPB).toEqual([[]]);
    });
});
