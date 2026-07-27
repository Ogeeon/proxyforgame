// ============================================================================
// PRODUCTION CALCULATOR - CORE
// ============================================================================
// Pure calculation logic and state helpers. No DOM access except through the
// shared `options` object defined in production.tpl. Ported verbatim from the
// legacy jQuery production.js — including its historical quirks — because the
// Playwright expectations encode the current numeric behavior.

'use strict';

// Every life form has the same number of buildings; planet data reserves one
// level slot per building (aPS indexes 25..36), including the first two
// buildings, which this calculator hides because they neither boost production
// nor draw energy.
const LF_BUILDINGS_PER_RACE = 12;

function convertAllPlanetParams() {
	let prm = [];
	options.prm.aPS = [];
	let names = [];
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		prm = [];
		names[i] = options.planetNumStr + (i + 1);
		// 0 - temperature, 1-6 - mines, power plants and satellites, 7 - crawlers, 8 - position
		prm[0] = options.prm.aPPP[i][0]; // temperature
		prm[1] = options.prm.aPPP[i][8]; // position
		prm[2] = 0; // energy booster
		for (let j = 1; j < 8; j++) {
			if (options.prm.aPPP[i][j] === undefined) {
				prm[j * 3] = 0;
			} else {
				prm[j * 3] = options.prm.aPPP[i][j]; // level (in the historically established order)
			}
			prm[j * 3 + 1] = 100; // production coefficient
			prm[j * 3 + 2] = 0; // booster
		}
		prm[24] = 0; // life form (race)
		for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) prm[25 + k] = 0; // life form building levels (positional per race)
		options.prm.aPS[i] = prm;
	}
	options.prm.aPNames = names;
	options.prm.aPPP = [[]];
	options.prm.aPB = [[]];
}

/**
 * Migrate exchange rates saved in the legacy trade-ratio format (metal:crystal:
 * deuterium, e.g. 3:2:1) to the MSU-weight format shared with the cost
 * calculators (metal:crystal:deuterium, e.g. 1:1.5:3). The two describe the
 * same economy, so the stored ratio is preserved, only rewritten.
 */
function convertExchangeRates() {
	if (options.prm.ratesFmt >= 2)
		return;
	let old = options.prm.rates;
	// Ratios like 4:3 do not divide evenly, so round to two decimals: the error is
	// far below the precision anyone picks a trade ratio with, and it keeps the
	// migrated value readable in the input.
	if (Array.isArray(old) && old.length === 3 && old[0] > 0 && old[1] > 0 && old[2] > 0)
		options.prm.rates = [1, Math.round(old[0] / old[1] * 100) / 100, Math.round(old[0] / old[2] * 100) / 100];
	else
		options.prm.rates = [1, 1.5, 3];
	options.prm.ratesFmt = 2;
}

function createEmptyPlanet() {
	let prm = [];
	// 0 - temperature, 1-6 - mines, power plants and satellites, 7 - crawlers, 8 - position
	prm[0] = 0; // temperature
	prm[1] = 8; // position
	prm[2] = 0; // energy booster
	for (let j = 1; j < 8; j++) {
		prm[j * 3] = 0;
		prm[j * 3 + 1] = 100; // production coefficient
		prm[j * 3 + 2] = 0; // booster
	}
	prm[24] = 0; // life form (race)
	for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) prm[25 + k] = 0; // life form building levels (positional per race)
	return prm;
}

/**
 * A planet counts as untouched while every field still equals the
 * createEmptyPlanet() default, so deleting it needs no confirmation. Values are
 * compared numerically: the table inputs and the stored cookie may hold numeric
 * strings. The planet name is deliberately left out — names are not renumbered
 * after a planet is deleted or moved, so a default name may well differ from
 * the one the position would suggest.
 */
function isPlnEmpty(plnID) {
	let plnData = options.prm.aPS[plnID];
	let empty = createEmptyPlanet();
	for (let i = 0; i < empty.length; i++) {
		// A planet saved before a field existed simply keeps that field's default
		if (plnData[i] === undefined || plnData[i] === null || plnData[i] === '')
			continue;
		if (Number(plnData[i]) !== empty[i])
			return false;
	}
	return true;
}

function stripHTMLTags(input) {
	return input.replace(/<[^>]+>/g, "");
}

function getSSCost(techID, currLvl, plnData) {
	let currCons = getHourlyConsumption(techID, currLvl, options.prm.universeSpeed, 1);
	let newCons = getHourlyConsumption(techID, currLvl + 1, options.prm.universeSpeed, 1);
	let energyReq = newCons - currCons;
	let fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;
	// plnData = [temp., pos., booster]
	let oneSSProd = getProductionRate(212, 1, options.prm.energyTechLevel, options.prm.plasmaTechLevel, plnData[0], plnData[1],
		options.prm.universeSpeed, options.prm.geologist, options.prm.engineer, 1, 1, fullCrew, options.prm.playerClass);
	let boosterFactor = 0.1 * plnData[2];
	let engineerFactor = (options.prm.engineer === true) ? 0.1 : 0;
	let allStaffFactor = fullCrew === true ? 0.02 : 0;
	let classFactor = options.prm.playerClass === 0 ? 0.1 : 0;
	let allianceClassFactor = options.prm.isTrader ? 0.05 : 0;
	let totalEnergyProd = oneSSProd;
	totalEnergyProd += Math.round(oneSSProd * boosterFactor);
	totalEnergyProd += Math.round(oneSSProd * engineerFactor);
	totalEnergyProd += Math.round(oneSSProd * allStaffFactor);
	totalEnergyProd += Math.round(oneSSProd * classFactor);
	totalEnergyProd += Math.round(oneSSProd * allianceClassFactor);
	let satsCount = Math.ceil(energyReq / totalEnergyProd);
	let techData = { 212: [0, 2000, 500, 1] };
	return getBuildCost_C(212, 0, satsCount, techData);
}

// Energy consumed by a single life form building at a given level.
// Mirrors OGame's mine-style formula: floor(base * level * coeff^level),
// where base and coeff come from options.lfEnergy (see lf-techdata.inc.php).
function lfBuildingEnergy(bldId, level) {
	level = Number(level) || 0;
	if (level < 1) return 0;
	let data = options.lfEnergy ? options.lfEnergy[bldId] : undefined;
	if (data === undefined) return 0;
	return Math.floor(data[0] * level * Math.pow(data[1], level));
}

// Applies one building's percentage bonuses (met/cry/deu/enP/enR) to both the
// race-wide totals and that building's own row.
function applyLfBuildingBonus(bonus, level, bld, eff) {
	for (let kind in bonus) {
		let base = bonus[kind][0], factor = bonus[kind][1], max = bonus[kind][2];
		let pct = base * Math.pow(factor, level - 1) * level;
		if (max !== null && max !== undefined) pct = Math.min(max * 100, pct);
		eff[kind] += pct;
		if (bld[kind] !== undefined) bld[kind] = pct;
	}
}

// Aggregate all life form building effects for a race and a positional array of
// building levels. Returns energy consumption (total and per building) plus the
// production/energy bonus percentages contributed by that race's buildings:
//   met/cry/deu - resource production increase (%)
//   enP         - energy production increase (%)
//   enR         - energy consumption reduction (%)
// `perBld` keeps the same numbers per building (index = building position), so
// that each building can show its own contribution in the one-planet table.
function lfBuildingEffects(race, levels) {
	let eff = { energyUsed: 0, perBld: [], met: 0, cry: 0, deu: 0, enP: 0, enR: 0 };
	if (race < 1 || race > 4) return eff;
	if (!levels) return eff;
	for (let pos = 0; pos < levels.length; pos++) {
		let level = Number(levels[pos]) || 0;
		let bldId = race * 1000 + (pos + 1);
		let e = lfBuildingEnergy(bldId, level);
		// enR acts on the whole planet, so it stays out of the per-building numbers -
		// only what a single building adds on its own is listed here.
		let bld = { id: bldId, level: level, energyUsed: e, met: 0, cry: 0, deu: 0, enP: 0 };
		eff.energyUsed += e;
		let bonus = options.lfBonus ? options.lfBonus[bldId] : undefined;
		if (bonus && level > 0) {
			applyLfBuildingBonus(bonus, level, bld, eff);
		}
		eff.perBld.push(bld);
	}
	return eff;
}

// Power plants/satellites base output (rows 4-6) plus the fusion reactor's
// deuterium draw, recorded into `results` and `production` row 3 (deuterium).
function computeBaseEnergyProduction(prodParams, plnData, fullCrew, results, production) {
	let totalEnergyProduced = 0;
	for (let i = 3; i < 6; i++) {
		// Take the building's level and the power percentage it runs at from the table
		let level = prodParams[i][0];
		let perCent = prodParams[i][1];
		let energy = 0;
		// Power percentage is passed straight into getProductionRateSplit so the officer/plasma/booster bonus rows stay proportional to it.
		if (level > 0) {
			let energyArray = getProductionRateSplit(options.rowsToTechs[i], level, options.prm.energyTechLevel, 0, plnData[0], plnData[1], options.prm.universeSpeed, options.prm.geologist,
				options.prm.engineer, 1, perCent / 100.0, 0, fullCrew, options.prm.playerClass, options.prm.isTrader);
			energy = energyArray[1];
			// write the base energy produced into the power plant's/satellite's row
			results[i + 1][3] = energyArray[1];
		}
		totalEnergyProduced += energy;
		// For the fusion reactor we need to show how much deuterium it consumes
		if (options.rowsToTechs[i] === 12) {
			let deutCons = level > 0 ? getHourlyConsumption(12, level, options.prm.universeSpeed, perCent / 100.0) : 0;
			results[i + 1][2] = -deutCons;
			production[2] = -deutCons;
		}
	}
	return totalEnergyProduced;
}

// Adds the booster/officer/class/life-form energy bonuses on top of the base
// production, plus what each life form building contributes to its own row.
function applyEnergyBonuses(totalEnergyProduced, plnData, fullCrew, lfEff, results, lfBld) {
	let energyBalance = totalEnergyProduced; // the base for calculating energy bonuses must be taken before Crawlers
	if (energyBalance < 0) energyBalance = 0;
	const boosterFactor = 0.1 * plnData[2];
	const engineerFactor = (options.prm.engineer === true) ? 0.1 : 0;
	const allStaffFactor = fullCrew === true ? 0.02 : 0;
	const classFactor = options.prm.playerClass === 0 ? 0.1 : 0;
	const allianceClassFactor = options.prm.isTrader ? 0.05 : 0;
	const lfEnergyFactor = (options.prm.lfEnergyProdBonus || 0) / 100;
	results[9][3] = Math.round(energyBalance * boosterFactor);
	results[11][3] = Math.round(energyBalance * engineerFactor);
	results[12][3] = Math.round(energyBalance * allStaffFactor);
	results[13][3] = Math.round(energyBalance * classFactor);
	results[14][3] = Math.round(energyBalance * allianceClassFactor);
	// Life form tech bonus: energy production increase from the base output
	results[15][3] = Math.round(energyBalance * lfEnergyFactor);
	let total = totalEnergyProduced + results[9][3] + results[11][3] + results[12][3] + results[13][3] + results[14][3] + results[15][3];
	// Energy production increase from buildings - into the building's own row
	for (let b = 0; b < lfBld.length; b++) {
		lfBld[b][3] = Math.round(energyBalance * lfEff.perBld[b].enP / 100);
		total += lfBld[b][3];
	}
	return total;
}

// We know how much energy the planet produces in total - now we need to find out how much of it is consumed
function computeEnergyConsumption(prodParams, results) {
	let totalEnergyUsed = 0;
	for (let i = 0; i < 3; i++) {
		let level = prodParams[i][0];
		let perCent = prodParams[i][1];
		let energy = level > 0 ? getHourlyConsumption(options.rowsToTechs[i], level, options.prm.universeSpeed, perCent / 100.0) : 0;
		results[i + 1][4] = energy;
		totalEnergyUsed += energy;
	}
	return totalEnergyUsed;
}

// Crawlers are in row 6
function computeCrawlersEnergyConsumption(prodParams, results) {
	let cralwersPwrPcnt = prodParams[6][1] / 100.0;
	let crawlersOlPcnt = 0;
	if (cralwersPwrPcnt > 1) {
		crawlersOlPcnt = cralwersPwrPcnt - 1;
		cralwersPwrPcnt = 1;
	}
	let crawlersEenergyCons = Math.round((prodParams[6][0] * (cralwersPwrPcnt + crawlersOlPcnt * 2)) * 50);
	results[7][3] = -crawlersEenergyCons;
	return crawlersEenergyCons;
}

// Disruption Chamber (and similar) reduces the planet's energy consumption.
// OGame applies the reduction to every consumer row as well, flooring each row
// on its own, so the rows can add up to slightly less than the total above -
// which is derived from the unreduced sum. Reproduced verbatim: matching the
// game's table is the point, and the total keeps driving the production
// coefficient exactly as before.
function applyLfEnergyReduction(lfEff, totalEnergyUsed, crawlersEenergyCons, results, lfBld) {
	if (lfEff.enR <= 0) return totalEnergyUsed;
	let enRFactor = 1 - Math.min(lfEff.enR, 100) / 100;
	for (let i = 1; i < 4; i++)
		results[i][4] = Math.floor(results[i][4] * enRFactor);
	results[7][3] = -Math.floor(crawlersEenergyCons * enRFactor);
	for (let b = 0; b < lfBld.length; b++)
		lfBld[b][4] = Math.floor(lfBld[b][4] * enRFactor);
	return Math.floor(totalEnergyUsed * enRFactor);
}

// Base resource production (mines/synthesizer rows plus officer/class/plasma
// bonus rows 8-14), scaled by the energy coefficient unless normalized.
function computeResourceProduction(prodParams, plnData, fullCrew, koeff, normalized, results, production) {
	let prodFactor = normalized ? 1 : koeff;
	for (const i of [0, 1, 2]) {
		let pwrFactor = normalized ? 1 : prodParams[i][1] / 100.0;
		let prod = getProductionRateSplit(options.rowsToTechs[i], prodParams[i][0], options.prm.energyTechLevel, options.prm.plasmaTechLevel, plnData[0], plnData[1],
			options.prm.universeSpeed, options.prm.geologist, options.prm.engineer, prodFactor, pwrFactor, prodParams[i][2], fullCrew, options.prm.playerClass, options.prm.isTrader);
		// Save the resource production data
		results[0][i] += prod[0];  // base production
		production[i] += prod[0];
		results[i + 1][i] += prod[1];  // production at the mine
		production[i] += prod[1];
		for (let line = 8; line < 15; line++) {
			results[line][i] += prod[line - 6];
			production[i] += prod[line - 6];
		}
	}
}

function applyCrawlerProductionBonus(prodParams, results, production) {
	let crMult = options.prm.playerClass === 0 ? 1.5 : 1;
	results[7][0] = Math.round(results[1][0] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[0] += results[7][0];
	results[7][1] = Math.round(results[2][1] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[1] += results[7][1];
	results[7][2] = Math.round(results[3][2] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[2] += results[7][2];
}

// Life form tech bonus: extra resource production from RESEARCH (percentages
// from the parameters panel - they already include the tech bonus, see above).
// The increase for each resource is applied to the mine's base output, and the
// crawler boost - to their production. With zero bonuses the row contributes nothing.
function applyLfTechProductionBonus(results, production) {
	let lfMetFactor = (options.prm.lfMetProdBonus || 0) / 100;
	let lfCrysFactor = (options.prm.lfCrysProdBonus || 0) / 100;
	let lfDeutFactor = (options.prm.lfDeutProdBonus || 0) / 100;
	let lfCrawlerFactor = (options.prm.lfCrawlerBonus || 0) / 100;
	results[15][0] = Math.round(results[1][0] * lfMetFactor) + Math.round(results[7][0] * lfCrawlerFactor);
	results[15][1] = Math.round(results[2][1] * lfCrysFactor) + Math.round(results[7][1] * lfCrawlerFactor);
	results[15][2] = Math.round(results[3][2] * lfDeutFactor) + Math.round(results[7][2] * lfCrawlerFactor);
	production[0] += results[15][0];
	production[1] += results[15][1];
	production[2] += results[15][2];
}

// Extraction increase from life form buildings - into each building's own row
function applyLfBuildingProduction(lfEff, results, lfBld, production) {
	let mineProd = [results[1][0], results[2][1], results[3][2]];
	for (let b = 0; b < lfBld.length; b++) {
		let bld = lfEff.perBld[b];
		let pcts = [bld.met, bld.cry, bld.deu];
		for (let res = 0; res < 3; res++) {
			lfBld[b][res] = Math.round(mineProd[res] * pcts[res] / 100);
			production[res] += lfBld[b][res];
		}
	}
}

function calculateProduction(prodParams, plnData, normalized = false, lfEff = null) {
	if (!lfEff) lfEff = { energyUsed: 0, perBld: [], met: 0, cry: 0, deu: 0, enP: 0, enR: 0 };
	// NOTE: the life form technology bonus (Metropolis, Chip Mass Production,
	// HP-Transformer) is not modelled at all. OGame folds it into the research
	// percentages shown on its life form panel, which is where the user copies them
	// from, so applying it here would double-count it.
	// See docs/calculators/production-vs-ogame.md.
	// What each life form building contributes on its own: [met, crys, deut,
	// energy produced, energy used]. Reported separately from the results rows so
	// the one-planet table can show it in the building's own row.
	let lfBld = (lfEff.perBld || []).map(function (bld) { return [0, 0, 0, 0, bld.energyUsed]; });
	let results = [];
	let production = [0, 0, 0];
	// 0-base production, 1-metal mine, 2-crystal mine, 3-deut synthesizer, 4-solar plant,
	// 5-fusion reactor, 6-solar satellite, 7-crawlers, 8-plasma tech, 9-items,
	// 10-geologist, 11-engineer, 12-officers, 13-class, 14-alliance class,
	// 15-life form tech bonus
	for (let i = 0; i < 16; i++) { results.push([0, 0, 0, 0, 0]); } // metal, crystal, deuterium, energy produced, energy required
	const fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;

	let totalEnergyProduced = computeBaseEnergyProduction(prodParams, plnData, fullCrew, results, production);
	totalEnergyProduced = applyEnergyBonuses(totalEnergyProduced, plnData, fullCrew, lfEff, results, lfBld);

	let totalEnergyUsed = computeEnergyConsumption(prodParams, results);
	let crawlersEenergyCons = computeCrawlersEnergyConsumption(prodParams, results);
	totalEnergyUsed += crawlersEenergyCons;
	// Life form buildings draw energy from the same pool as mines and crawlers.
	totalEnergyUsed += lfEff.energyUsed;
	totalEnergyUsed = applyLfEnergyReduction(lfEff, totalEnergyUsed, crawlersEenergyCons, results, lfBld);

	let koeff = 1.0;
	if (totalEnergyUsed > 0)
		koeff = totalEnergyProduced / (totalEnergyUsed);
	if (koeff > 1) {
		koeff = 1;
	}

	computeResourceProduction(prodParams, plnData, fullCrew, koeff, normalized, results, production);
	applyCrawlerProductionBonus(prodParams, results, production);
	applyLfTechProductionBonus(results, production);
	applyLfBuildingProduction(lfEff, results, lfBld, production);

	return [results, production, totalEnergyProduced, totalEnergyUsed, koeff, lfBld];
}
