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
        'calculateProduction', 'getSSCost', 'lfBuildingEffects', 'convertExchangeRates', 'convertAllPlanetParams',
        'floorExact', 'scaleConsumerRows', 'getProductionRateSplit', 'getProductionRateExact', 'lithiumConversion', 'planetLithiumConversion', 'PLANET_IAS_ON', 'PLANET_IAS_LEVEL', 'PLANET_IAS_DISCOUNT', 'PLANET_IAS_RESOURCE', 'PLANET_IAS_WORKLOAD'],
);
const { createEmptyPlanet, isPlnEmpty, lfResearchIncrease, lfBuildingUpgradeLevels, lfBuildingCostReduction,
    calculateProduction, getSSCost, lfBuildingEffects, convertExchangeRates, convertAllPlanetParams,
    floorExact, scaleConsumerRows, getProductionRateSplit } = ctx;

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

    it('adds base% of every planet\'s mine output, rounded down per planet', () => {
        // High-Performance Extractors: 0.06% of all three resources
        const bonus = { met: [0.06, 1, null], cry: [0.06, 1, null], deu: [0.06, 1, null] };
        // 21200*0.0006 = 12.72 -> 12, 10000*0.0006 = 6; 5.4 -> 5, 3; 2.4 -> 2, 1.5 -> 1
        expect(lfResearchIncrease(mines, bonus, 0)).toEqual([18, 8, 3]);
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
        // The life form levels, then the five slots of the lithium conversion.
        expect(ctx.PLANET_IAS_ON).toBe(PLANET_LF_LEVELS + 12);
        expect(planet).toHaveLength(ctx.PLANET_IAS_WORKLOAD + 1);
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
    it('forms the planet totals from the unrounded rows, so they can exceed the sum of the shown ones', () => {
        // The game floors every row it shows but adds up the unrounded amounts, then floors the sum
        // (production-vs-ogame.md, section 2): the total is never below the rows, and above them by
        // less than one unit per row.
        const [results, production] = calculateProduction(rows(), PLANET, settings());
        for (let res = 0; res < 3; res++) {
            const sum = results.reduce((acc, row) => acc + row[res], 0);
            expect(production[res]).toBeGreaterThanOrEqual(sum);
            expect(production[res]).toBeLessThan(sum + results.length);
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
        expect(results[11][3]).toBe(Math.floor(base * 0.1));
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
        expect(results[15][0]).toBe(Math.floor(results[1][0] * 0.1));
        expect(results[15][1]).toBe(0);
    });

    it('credits each life form building with its own share', () => {
        // A made-up building: +2% metal per level, no energy draw
        const tables = { lfEnergy: {}, lfBonus: { 2006: { met: [2, 1, null] } } };
        const levels = [0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0];
        const lfEff = lfBuildingEffects(2, levels, tables);
        const [results, , , , , lfBld] = calculateProduction(rows({ solar: 40 }), PLANET, settings(), { lfEff });
        expect(lfBld[5][0]).toBe(Math.floor(results[1][0] * 0.1));
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

    describe('energy draw at level 1', () => {
        // Observed on s1-en, 2026-07 and 2026-11 (issue #88): at level 1 the game
        // draws the base energy, with no growth coefficient applied.
        const real = {
            1012: [100, 1.02], // Planetary Shield
            2004: [20, 1.35], // Rune Forge
            2010: [90, 1.1], // Deuterium Synthesiser
            2012: [100, 1.1], // Advanced Recycling Plant
            3003: [13, 1.08], // Robotics Research Centre
        };
        const draw = (race, position, level) => {
            const lv = new Array(12).fill(0);
            lv[position - 1] = level;
            return lfBuildingEffects(race, lv, { lfEnergy: real, lfBonus: {} }).energyUsed;
        };

        it('is the base energy', () => {
            expect(draw(1, 12, 1)).toBe(100);
            expect(draw(2, 12, 1)).toBe(100);
            expect(draw(3, 3, 1)).toBe(13);
            expect(draw(2, 10, 1)).toBe(90);
            expect(draw(2, 4, 1)).toBe(20); // the formula would say 27
        });

        it('returns to the formula from level 2', () => {
            expect(draw(1, 12, 3)).toBe(318); // Planetary Shield 3
            expect(draw(2, 10, 2)).toBe(217); // Deuterium Synthesiser 2: floor(90 * 2 * 1.21)
            expect(draw(2, 4, 12)).toBe(8794); // Rune Forge 12
        });

        it('draws nothing at level 0', () => {
            expect(draw(2, 12, 0)).toBe(0);
        });
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

// Measured in the Orion beta (docs/anomaly-scanner.md): the Lithium Production
// tab of a level-20 scanner at every workload, and the resource settings page.
describe('lithiumConversion', () => {
    const { lithiumConversion, planetLithiumConversion } = ctx;
    const at = (workloadPct, resource = 0, discountPct = 0, level = 20) =>
        lithiumConversion({ level, workloadPct, discountPct, resource });

    it('floors the lithium of a level-20 scanner at every workload the game offers', () => {
        const lithium = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((w) => at(w).lithium);
        expect(lithium).toEqual([20666, 18600, 16533, 14466, 12400, 10333, 8266, 6200, 4133, 2066]);
    });

    it('rounds the cost, computed from the floored lithium, with the discount', () => {
        // 20666 * 2 * 0.999 = 41290.67, shown as 41,291
        expect(at(100, 1, 0.1).cost).toEqual([0, 41291, 0]);
        // 2066 * 3 * 0.999 = 6191.8, not 2066.688 * 3 * 0.999 = 6193.9
        expect(at(10, 0, 0.1).cost).toEqual([6192, 0, 0]);
        expect(at(100, 2, 0.1).cost).toEqual([0, 0, 20645]);
    });

    // Measured 2026-11-18 on a level-18 scanner with one Catalytic Converter
    // level, which the game shows as a 0.15% discount.
    it('reproduces the costs the game shows with a 0.15% discount', () => {
        /** @type {Array<[number, number[], number]>} workload, cost per resource, lithium */
        const measured = [
            [100, [46047, 30698, 15349], 15372],
            [50, [23023, 15349, 7674], 7686],
            [10, [4604, 3069, 1535], 1537],
        ];
        for (const [workload, costs, lithium] of measured) {
            costs.forEach((cost, resource) => {
                const result = at(workload, resource, 0.15, 18);
                expect(result.lithium).toBe(lithium);
                expect(result.cost[resource]).toBe(cost);
            });
        }
    });

    it('matches the conversion row of the resource settings page', () => {
        // -7,230 metal: level 11 at 50%, no discount, 2410 lithium
        expect(lithiumConversion({ level: 11, workloadPct: 50, discountPct: 0, resource: 0 })).toEqual({ lithium: 2410, cost: [7230, 0, 0] });
    });

    it('costs nothing without a scanner, a workload or a known resource', () => {
        expect(at(100, 0, 0, 0)).toEqual({ lithium: 0, cost: [0, 0, 0] });
        expect(at(0)).toEqual({ lithium: 0, cost: [0, 0, 0] });
        expect(at(100, 3)).toEqual({ lithium: 0, cost: [0, 0, 0] });
    });

    it('reads a planet array, the discount in hundredths of a percent, and skips one switched off', () => {
        const planet = createEmptyPlanet();
        planet[ctx.PLANET_IAS_LEVEL] = 20;
        planet[ctx.PLANET_IAS_DISCOUNT] = 10;
        planet[ctx.PLANET_IAS_RESOURCE] = 1;
        expect(planetLithiumConversion(planet)).toBe(null);
        planet[ctx.PLANET_IAS_ON] = 1;
        expect(planetLithiumConversion(planet)).toEqual({ lithium: 20666, cost: [0, 41291, 0], resource: 1 });
    });

    it('leaves a planet empty while only the conversion defaults are set', () => {
        const planet = createEmptyPlanet();
        expect(planet[ctx.PLANET_IAS_WORKLOAD]).toBe(100);
        expect(isPlnEmpty(planet)).toBe(true);
        planet[ctx.PLANET_IAS_ON] = 1;
        expect(isPlnEmpty(planet)).toBe(false);
    });
});

// What the game itself shows on the resource settings page, s1-en, 2026-11-21 (issue #87). Every row is
// rounded down; the totals, the production factor and the energy come from the unrounded amounts.
describe('calculateProduction against the game\'s resource settings page', () => {
    const gameSettings = (over = {}) => settings({
        energyTechLevel: 15, plasmaTechLevel: 9, universeSpeed: 10, playerClass: 0, isTrader: true,
        lfMetProdBonus: 2.7848, lfCrysProdBonus: 2.7844, lfDeutProdBonus: 5.2871, lfCollectorBonus: 0, ...over,
    });
    // Rune Technologium (Rock'tal, 3rd building), draws 87 at level 4
    const runeTech = lfBuildingEffects(2, [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0], { lfEnergy: { 2003: [15, 1.1] }, lfBonus: {} });

    it('floors the bonus rows and the totals of a Collector with Traders (OgTheMiner, Theta)', () => {
        const [res, hourly, produced] = calculateProduction(
            rows({ mines: [26, 26, 26], solar: 27, fusion: 11, sats: 62 }), [60, 7, 0], gameSettings(), { lfEff: runeTech });
        expect(res[1][0]).toBe(114342);
        expect(res[2][1]).toBe(61974);
        expect(res[3][2]).toBe(37184);
        expect(res[8].slice(0, 3)).toEqual([10290, 3681, 1104]); // plasma: 10290.78, 3681.9, 1104.7
        expect(res[13]).toEqual([28585, 15493, 9296, 1157, 0]); // Collector: 28585.5, 15493.5
        expect(res[14].slice(0, 4)).toEqual([5717, 3098, 1859, 578]); // Traders: 5717.1, 3098.7
        expect(res[15].slice(0, 3)).toEqual([3184, 1725, 1965]);
        expect(hourly).toEqual([162488, 86123, 48271]); // the sum of the shown rows is 162487 / 86121 / 48269
        expect(produced).toBe(13312);
    });

    it('takes the crawler bonus from the shown mine row, at every overload (OgTheMiner)', () => {
        // 87 crawlers at 150% on Alpha: 0.0002 * 1.5 (Collector) * 1.5 = 3.915% of each mine
        const alpha = calculateProduction(
            rows({ mines: [26, 25, 24], solar: 23, fusion: 12, sats: 362, crawlers: [87, 150] }), [35, 9, 0], gameSettings())[0];
        expect(alpha[7]).toEqual([4476, 2120, 1203, -8700, 0]); // 2120.9 and 1203.1 are rounded down
        expect(alpha[13].slice(0, 4)).toEqual([28585, 13543, 7682, 1782]);
        // and a 100% planet on the other side of the range
        const zeta = calculateProduction(
            rows({ mines: [26, 25, 24], solar: 24, fusion: 10, sats: 320, crawlers: [91, 100] }), [17, 10, 0], gameSettings())[0];
        expect(zeta[7].slice(0, 4)).toEqual([2969, 1478, 885, -4550]);
    });

    it('does not lose a unit of crawler energy to floating point (OgTheMiner, Beta and Delta)', () => {
        // 76 * (1 + 0.4 * 2) * 50 is exactly 6840, but 1.4 - 1 is 0.3999999999999999 and the product 6839.999999999999
        const beta = calculateProduction(rows({ solar: 40, crawlers: [76, 140] }), [32, 8, 0], gameSettings())[0];
        expect(beta[7][3]).toBe(-6840);
        const delta = calculateProduction(rows({ solar: 40, crawlers: [46, 120] }), [43, 10, 0], gameSettings())[0];
        expect(delta[7][3]).toBe(-3220);
    });

    it('floors the geologist, engineer and commanding staff rows (Ogeeon, Alpha)', () => {
        const staff = { geologist: true, engineer: true, technocrat: true, admiral: true, commander: true };
        const res = calculateProduction(
            rows({ mines: [26, 28, 31], solar: 30, fusion: 15, sats: 308 }), [41, 10, 0],
            settings({ energyTechLevel: 15, plasmaTechLevel: 9, universeSpeed: 10, playerClass: 2, isTrader: true, ...staff }))[0];
        expect(res[10].slice(0, 3)).toEqual([10876, 8075, 7592]); // 10876.5, 8075.7, 7592.5
        expect(res[12].slice(0, 4)).toEqual([2175, 1615, 1518, 532]); // 2% of the mines and of the 26642 base energy
        expect(res[11][3]).toBe(2664); // Engineer: 10% of 26642
    });

    it('floors a resource booster row (Ogeeon, Gamma)', () => {
        // Metal booster +30% on a 114342 mine: 34302.6; deuterium +30% on 61091: 18327.3 (18327.6 on the unrounded mine)
        const withBooster = rows({ mines: [26, 26, 29], solar: 30, fusion: 15, sats: 343 });
        withBooster[0][2] = 3;
        withBooster[2][2] = 3;
        const [res] = calculateProduction(withBooster, [28, 9, 0], settings({ energyTechLevel: 15, plasmaTechLevel: 9, universeSpeed: 10, isTrader: true }));
        expect(res[9][0]).toBe(34302);
        expect(res[9][2]).toBe(18327);
    });

    it('scales a mine\'s rounded-down output by the energy coefficient (Ogeeon, Zeta)', () => {
        // The metal mine makes 92961.78 at 100%. The game floors that to 92961 first, then scales it:
        // 92961 * 0.78224 = 72717.8 -> 72717. Scaling the unrounded figure would give 72718.4 -> 72718.
        const split = getProductionRateSplit({
            techID: 1, techLevel: 26, energyTechLevel: 15, plasmaTechLevel: 9, maxTemp: -112, pos: 14,
            universeSpeedFactor: 10, geologist: false, engineer: false, productionFactor: 0.78224, powerFactor: 1,
            boosterType: 0, allOfficers: false, playerClass: 2, isTrader: false,
        });
        expect(split[1]).toBe(72717);
    });
});

// The draw the game shows on a planet short of energy (issue #89), s1-en, 2026-11-21, Ogeeon.
describe('scaleConsumerRows against the game\'s resource settings page', () => {
    it('scales the draw floored at full production by the unrounded coefficient (Zeta)', () => {
        const shown = scaleConsumerRows(0.78222, 0, { mines: [3098, 0, 0], buildings: [120, 8794] });
        expect(shown.mines[0]).toBe(2423); // 3098 * 0.78222 = 2423.2
        expect(shown.buildings).toEqual([93, 6878]);
    });

    it('floors the draw before the reduction, not after (Gamma, Mineral Research Centre 5)', () => {
        // 2227.76 at a coefficient of 1 and -4%: 2227 * 0.96 = 2137.9 -> 2137, where 2227.76 * 0.96 gives 2138
        expect(scaleConsumerRows(1, 4, { mines: [], buildings: [2227.76] }).buildings).toEqual([2137]);
    });

    it('does not round the reduction before the coefficient (Epsilon, Deuterium Synthesiser 1)', () => {
        // 90 * 0.895017 * 0.965 = 77.73 -> 77; flooring the reduced 86.85 first would give 86 * 0.895017 = 76.97 -> 76
        expect(scaleConsumerRows(0.895017, 3.5, { mines: [90, 0, 0], buildings: [] }).mines[0]).toBe(77);
    });

    it('is what calculateProduction returns last, next to an unscaled total draw (Zeta)', () => {
        const prod = calculateProduction(rows({ mines: [26, 25, 24], sats: 0, solar: 10 }), [17, 10, 0], settings());
        const [results, , produced, used, koeff, , , , shown] = prod;
        expect(koeff < 1).toBe(true);
        expect(shown.mines[0]).toBe(Math.floor(results[1][4] * koeff));
        expect(used).toBe(results[1][4] + results[2][4] + results[3][4]); // the total stays the unscaled sum
        expect(koeff).toBe(produced / used > 1 ? 1 : prod[7][0] / prod[7][1]);
    });
});

describe('floorExact', () => {
    it('rounds down amounts a float error would pull under the next whole number', () => {
        expect(Math.floor(0.29 * 100)).toBe(28); // what a plain Math.floor does
        expect(floorExact(0.29 * 100)).toBe(29);
        expect(floorExact(76 * (1 + (1.4 - 1) * 2) * 50)).toBe(6840);
    });

    it('still rounds a real fraction down', () => {
        expect(floorExact(2536.535)).toBe(2536);
        expect(floorExact(4847.8)).toBe(4847);
        expect(floorExact(-0.5)).toBe(-1);
    });
});
