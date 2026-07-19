// ============================================================================
// PRODUCTION CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads calculator inputs from the DOM. The positional row/cell indices are
// dictated by the production.tpl table layout and must stay in sync with it.

'use strict';

// Cells of a planet row in #all-planets-prod that hold the 7 level inputs
// (mines, power plants, satellites, crawlers).
const LEVEL_COLUMNS = [4, 6, 8, 10, 11, 12, 13];

/**
 * Read the general settings panel (techs, speed, officers, class, trader).
 */
function collectGeneralSettings() {
	return {
		universeSpeed: $('#universe-speed').value,
		energyTechLevel: getInputNumber($('#energy-tech-level')),
		plasmaTechLevel: getInputNumber($('#plasma-tech-level')),
		engineer: getChecked('#engineer'),
		geologist: getChecked('#geologist'),
		technocrat: getChecked('#technocrat'),
		admiral: getChecked('#admiral'),
		commander: getChecked('#commander'),
		playerClass: getChecked('#class-2') ? 2 : (getChecked('#class-1') ? 1 : 0),
		isTrader: getChecked('#is-trader'),
		energyBoost: $('#energy-boost').value,
		lfMetProdBonus: getInputNumber($('#lf-metal-prod-bonus')),
		lfCrysProdBonus: getInputNumber($('#lf-crystal-prod-bonus')),
		lfDeutProdBonus: getInputNumber($('#lf-deut-prod-bonus')),
		lfEnergyProdBonus: getInputNumber($('#lf-energy-prod-bonus')),
		lfCrawlerBonus: getInputNumber($('#lf-crawler-bonus')),
		lfPlasmaCostReduction: getInputNumber($('#lf-plasma-cost-reduction'))
	};
}

/**
 * Read the one-planet production table into a params array:
 * [Level/Count, PowerFactor, Booster] per building row.
 * @param {NodeList} rows - all tr of #one-planet-prod
 */
function collectOnePlanetParams(rows) {
	//            Met. mine Crys. mine  Deut. syn  Sol.plant  Fus.plant  Sol.sat.   Crawler
	let params = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
	for (let i = 2; i < 9; i++) {
		params[i - 2][0] = getInputNumber(rows[i].children[2].children[0]);
		params[i - 2][1] = rows[i].children[7].children[0].value;
		if (i > 4) { // У электростанций, лампочек и Гусеничников нет бустеров
			params[i - 2][2] = 0.0;
		} else {
			params[i - 2][2] = rows[i].children[1].children[0].value;
		}
	}
	return params;
}

/**
 * Read the exchange rates inputs, substituting the defaults for zeroes.
 */
function collectExchangeRates() {
	let rates = [];
	rates[0] = getInputNumber($('#exchange-rates-m'));
	if (rates[0] === 0) rates[0] = 3;
	rates[1] = getInputNumber($('#exchange-rates-c'));
	if (rates[1] === 0) rates[1] = 2;
	rates[2] = getInputNumber($('#exchange-rates-d'));
	if (rates[2] === 0) rates[2] = 1;
	return rates;
}

/**
 * Sync options.prm.aPS with the all-planets table inputs (in case of direct
 * editing of a row).
 * @param {NodeList} rows - all tr of #all-planets-prod
 */
function collectAllPlanetsInputs(rows) {
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		options.prm.aPS[i][0] = getInputNumber(rows[i * 2 + 1].children[2].children[0]);
		options.prm.aPS[i][1] = getInputNumber(rows[i * 2 + 1].children[3].children[0]);
		for (let j = 1; j < 8; j++) {
			options.prm.aPS[i][j * 3] = rows[i * 2 + 1].children[LEVEL_COLUMNS[j - 1]].children[0].value;
		}
	}
}

/**
 * Build calculateProduction() arguments from a stored planet.
 * @param {number} i - planet index in options.prm.aPS
 */
function buildPlanetProdParams(i) {
	let prodParams = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
	for (let j = 1; j < 8; j++) {
		prodParams[j - 1][0] = options.prm.aPS[i][j * 3];
		prodParams[j - 1][1] = options.prm.aPS[i][j * 3 + 1];
		prodParams[j - 1][2] = options.prm.aPS[i][j * 3 + 2];
	}
	let plnData = [options.prm.aPS[i][0], options.prm.aPS[i][1], options.prm.aPS[i][2]];
	let lfEnergyUsed = lfEnergyConsumption(options.prm.aPS[i][24] || 0, options.prm.aPS[i].slice(25, 37)).total;
	return { prodParams: prodParams, plnData: plnData, lfEnergyUsed: lfEnergyUsed };
}
