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
		// 0 - температура, 1-6 - шахты, электростанции и лампочки, 7 - гусеничники, 8 - позиция
		prm[0] = options.prm.aPPP[i][0]; // температура
		prm[1] = options.prm.aPPP[i][8]; // позиция
		prm[2] = 0; // бустер энергии
		for (let j = 1; j < 8; j++) {
			if (options.prm.aPPP[i][j] === undefined) {
				prm[j * 3] = 0;
			} else {
				prm[j * 3] = options.prm.aPPP[i][j]; // уровень (исторически сложившийся порядок)
			}
			prm[j * 3 + 1] = 100; // коэффициент производства
			prm[j * 3 + 2] = 0; // бустер
		}
		prm[24] = 0; // форма жизни (раса)
		for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) prm[25 + k] = 0; // уровни зданий форм жизни (позиционно для расы)
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
	// 0 - температура, 1-6 - шахты, электростанции и лампочки, 7 - гусеничники, 8 - позиция
	prm[0] = 0; // температура
	prm[1] = 8; // позиция
	prm[2] = 0; // бустер энергии
	for (let j = 1; j < 8; j++) {
		prm[j * 3] = 0;
		prm[j * 3 + 1] = 100; // коэффициент производства
		prm[j * 3 + 2] = 0; // бустер
	}
	prm[24] = 0; // форма жизни (раса)
	for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) prm[25 + k] = 0; // уровни зданий форм жизни (позиционно для расы)
	return prm;
}

function isPlnEmpty(plnID) {
	let plnData = options.prm.aPS[plnID];
	// в первой тройке индекс 1 это позиция, в остальных - фактор производства, он по умолчанию 100
	// NOTE: after updateAllPlnTab the levels are strings ("0" !== 0), so this
	// reports untouched planets as non-empty and the delete confirmation always
	// fires — same as the legacy jQuery version (verified against the live site).
	for (let i = 0; i < 8; i++) {
		if (plnData[3 * i] !== 0 || plnData[3 * i + 2] !== 0)
			return false;
	}
	return true;
}

function stripHTMLTags(input) {
	return input.replace(/(<([^>]+)>)/gi, "");
}

function getSSCost(techID, currLvl, plnData) {
	let currCons = getHourlyConsumption(techID, currLvl, options.prm.universeSpeed, 1);
	let newCons = getHourlyConsumption(techID, currLvl + 1, options.prm.universeSpeed, 1);
	let energyReq = newCons - currCons;
	let fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;
	// plnData = [темп., поз., бустер]
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
			for (let kind in bonus) {
				let base = bonus[kind][0], factor = bonus[kind][1], max = bonus[kind][2];
				let pct = base * Math.pow(factor, level - 1) * level;
				if (max !== null && max !== undefined) pct = Math.min(max * 100, pct);
				eff[kind] += pct;
				if (bld[kind] !== undefined) bld[kind] = pct;
			}
		}
		eff.perBld.push(bld);
	}
	return eff;
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
	// 0-нат.пр-во, 1-шахта мет., 2-шахта крис., 3-синт.дейт., 4-сол.эл/ст,
	// 5--термояд.эл/ст., 6-сол.спут., 7-гусен., 8-плазм.тех., 9-предметы,
	// 10-геолог, 11-инженер, 12-ком.состав, 13-класс, 14-класс альянса,
	// 15-техн. бонус форм жизни
	for (var i = 0; i < 16; i++) { results.push([0, 0, 0, 0, 0]); } // мет, крис, дейт, энергии производится, энергии требуется
	var energy = 0, level = 0, perCent = 0, deutCons = 0, totalEnergyProduced = 0, totalEnergyUsed = 0, booster = 0;
	var fullCrew = options.prm.geologist && options.prm.engineer && options.prm.admiral && options.prm.commander && options.prm.technocrat;
	let energyArray;
	for (var i = 3; i < 6; i++) {
		// Сначала вычислим произоводимую энергию
		// Возьмём из таблицы данные об уровне постройки и проценте мощности, на который она работает
		level = prodParams[i][0];
		perCent = prodParams[i][1];
		// Для расчёта коэффициента производства нам нужны неокруглённые значения производимой энергии, поэтому на процент мощности умножаем после - FIXME? это действительно нужно?
		if (level > 0) {
			energyArray = getProductionRateSplit(options.rowsToTechs[i], level, options.prm.energyTechLevel, 0, plnData[0], plnData[1], options.prm.universeSpeed, options.prm.geologist,
				options.prm.engineer, 1, perCent / 100.0, 0, fullCrew, options.prm.playerClass, options.prm.isTrader);
			energy = energyArray[1];
			// базовую производимую энергию запишем в строку для эл.станции/спутника
			results[i + 1][3] = energyArray[1];
		} else {
			energy = 0;
		}
		totalEnergyProduced += energy;
		// Для термоядерной электростанции надо показать, сколько дейтерия она потребляет
		if (options.rowsToTechs[i] === 12) {
			if (level > 0) {
				deutCons = getHourlyConsumption(12, level, options.prm.universeSpeed, perCent / 100.0);
			} else {
				deutCons = 0;
			}
			results[i + 1][2] = -deutCons;
			production[2] = -deutCons;
		}
	}

	var energyBalance = totalEnergyProduced; // базу для расчёта бонусов энергии нужно считать до Гусеничников
	if (energyBalance < 0) energyBalance = 0;
	var boosterFactor = 0.1 * plnData[2];
	var engineerFactor = (options.prm.engineer === true) ? 0.1 : 0;
	var allStaffFactor = fullCrew === true ? 0.02 : 0;
	var classFactor = options.prm.playerClass === 0 ? 0.1 : 0;
	let allianceClassFactor = options.prm.isTrader ? 0.05 : 0;
	let lfEnergyFactor = (options.prm.lfEnergyProdBonus || 0) / 100;
	results[9][3] = Math.round(energyBalance * boosterFactor);
	results[11][3] = Math.round(energyBalance * engineerFactor);
	results[12][3] = Math.round(energyBalance * allStaffFactor);
	results[13][3] = Math.round(energyBalance * classFactor);
	results[14][3] = Math.round(energyBalance * allianceClassFactor);
	// Техн. бонус форм жизни: прирост производства энергии от базовой выработки
	results[15][3] = Math.round(energyBalance * lfEnergyFactor);
	totalEnergyProduced += results[9][3] + results[11][3] + results[12][3] + results[13][3] + results[14][3] + results[15][3];
	// Прирост производства энергии от зданий - в строку самого здания
	for (let b = 0; b < lfBld.length; b++) {
		lfBld[b][3] = Math.round(energyBalance * lfEff.perBld[b].enP / 100);
		totalEnergyProduced += lfBld[b][3];
	}

	// Мы знаем, сколько всего производится энергии на планете - теперь нужно узнать, сколько её потребляется
	for (var i = 0; i < 3; i++) {
		level = prodParams[i][0];
		perCent = prodParams[i][1];
		if (level > 0) {
			energy = getHourlyConsumption(options.rowsToTechs[i], level, options.prm.universeSpeed, perCent / 100.0);
		} else {
			energy = 0;
		}
		results[i + 1][4] = energy;
		totalEnergyUsed += energy;
	}
	// Гусеничники в 6й строке
	var cralwersPwrPcnt = prodParams[6][1] / 100.0;
	var crawlersOlPcnt = 0;
	if (cralwersPwrPcnt > 1) {
		crawlersOlPcnt = cralwersPwrPcnt - 1;
		cralwersPwrPcnt = 1;
	}
	let crawlersEenergyCons = Math.round((prodParams[6][0] * (cralwersPwrPcnt + crawlersOlPcnt * 2)) * 50);
	results[7][3] = -crawlersEenergyCons;
	totalEnergyUsed += crawlersEenergyCons;

	// Life form buildings draw energy from the same pool as mines and crawlers.
	totalEnergyUsed += lfEff.energyUsed;
	// Disruption Chamber (and similar) reduces the planet's energy consumption.
	if (lfEff.enR > 0) {
		let enRFactor = 1 - Math.min(lfEff.enR, 100) / 100;
		totalEnergyUsed = Math.floor(totalEnergyUsed * enRFactor);
		// OGame applies the reduction to every consumer row as well, flooring each row
		// on its own, so the rows can add up to slightly less than the total above -
		// which is derived from the unreduced sum. Reproduced verbatim: matching the
		// game's table is the point, and the total keeps driving the production
		// coefficient exactly as before.
		for (let i = 1; i < 4; i++)
			results[i][4] = Math.floor(results[i][4] * enRFactor);
		results[7][3] = -Math.floor(crawlersEenergyCons * enRFactor);
		for (let b = 0; b < lfBld.length; b++)
			lfBld[b][4] = Math.floor(lfBld[b][4] * enRFactor);
	}

	var koeff = 1.0;
	if (totalEnergyUsed > 0)
		koeff = totalEnergyProduced / (totalEnergyUsed);
	if (koeff > 1) {
		koeff = 1;
	}

	var prod = 0;
	let prodFactor = normalized ? 1 : koeff;

	for (var i = 0; i < 3; i++) {
		let pwrFactor = normalized ? 1 : prodParams[i][1] / 100.0;
		prod = getProductionRateSplit(options.rowsToTechs[i], prodParams[i][0], options.prm.energyTechLevel, options.prm.plasmaTechLevel, plnData[0], plnData[1],
			options.prm.universeSpeed, options.prm.geologist, options.prm.engineer, prodFactor, pwrFactor, prodParams[i][2], fullCrew, options.prm.playerClass, options.prm.isTrader);
		// Сохраним данные о производстве ресурсов
		results[0][i] += prod[0];  // естественное производство
		production[i] += prod[0];
		results[i + 1][i] += prod[1];  // производство на руднике
		production[i] += prod[1];
		for (var line = 8; line < 15; line++) {
			results[line][i] += prod[line - 6];
			production[i] += prod[line - 6];
		}
	}
	let crMult = options.prm.playerClass === 0 ? 1.5 : 1;
	results[7][0] = Math.round(results[1][0] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[0] += results[7][0];
	results[7][1] = Math.round(results[2][1] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[1] += results[7][1];
	results[7][2] = Math.round(results[3][2] * prodParams[6][0] * 0.0002 * crMult * prodParams[6][1] / 100.0);
	production[2] += results[7][2];

	// Техн. бонус форм жизни: доп. производство ресурсов от ИССЛЕДОВАНИЙ (проценты
	// с панели параметров - они уже включают технологический бонус, см. выше).
	// Прирост по каждому ресурсу применяется к базовой выработке рудника, а буст
	// гусеничников - к их производству. При нулевых бонусах строка не даёт вклада.
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

	// Прирост добычи от зданий форм жизни - в строку каждого здания
	let mineProd = [results[1][0], results[2][1], results[3][2]];
	for (let b = 0; b < lfBld.length; b++) {
		let bld = lfEff.perBld[b];
		let pcts = [bld.met, bld.cry, bld.deu];
		for (let res = 0; res < 3; res++) {
			lfBld[b][res] = Math.round(mineProd[res] * pcts[res] / 100);
			production[res] += lfBld[b][res];
		}
	}

	return [results, production, totalEnergyProduced, totalEnergyUsed, koeff, lfBld];
}
