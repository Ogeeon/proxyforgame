// ============================================================================
// PRODUCTION CALCULATOR - CORE
// ============================================================================
// Pure calculation logic and state helpers. No DOM access except through the
// shared `options` object defined in production.tpl. Ported verbatim from the
// legacy jQuery production.js — including its historical quirks — because the
// Playwright expectations encode the current numeric behavior.

'use strict';

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
		options.prm.aPS[i] = prm;
	}
	options.prm.aPNames = names;
	options.prm.aPPP = [[]];
	options.prm.aPB = [[]];
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

function calculateProduction(prodParams, plnData, normalized = false) {
	let results = [];
	let production = [0, 0, 0];
	// 0-нат.пр-во, 1-шахта мет., 2-шахта крис., 3-синт.дейт., 4-сол.эл/ст,
	// 5--термояд.эл/ст., 6-сол.спут., 7-гусен., 8-плазм.тех., 9-предметы,
	// 10-геолог, 11-инженер, 12-ком.состав, 13-класс
	for (var i = 0; i < 15; i++) { results.push([0, 0, 0, 0, 0]); } // мет, крис, дейт, энергии производится, энергии требуется
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
	results[9][3] = Math.round(energyBalance * boosterFactor);
	results[11][3] = Math.round(energyBalance * engineerFactor);
	results[12][3] = Math.round(energyBalance * allStaffFactor);
	results[13][3] = Math.round(energyBalance * classFactor);
	results[14][3] = Math.round(energyBalance * allianceClassFactor);
	totalEnergyProduced += results[9][3] + results[11][3] + results[12][3] + results[13][3] + results[14][3];

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

	return [results, production, totalEnergyProduced, totalEnergyUsed, koeff];
}
