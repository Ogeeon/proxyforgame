// ============================================================================
// PRODUCTION CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Wires DOM events, drives recomputation on every
// change, keeps the one-planet and all-planets tabs in sync and persists
// state to localStorage-backed cookies.

'use strict';

const PRODUCTION_ACTIVE_TAB_COOKIE = 'production_active_tab';

/**
 * Standard wiring for a numeric text input: character validation + recalc on
 * typing, recalc when the value is committed (covers programmatic fills), and
 * min/max clamping with a follow-up recalc on blur.
 */
function bindNumericInput(input, recalc) {
	addEvent(input, 'keyup', function (e) { validateInputNumber(e); recalc(); });
	addEvent(input, 'change', function () { recalc(); });
	addEvent(input, 'blur', function (e) {
		const before = input.value;
		validateInputNumberOnBlurNative(e);
		if (input.value !== before) recalc();
	});
}

// OGame lets a planet use at most 8 crawlers per summed mine level (metal +
// crystal + deuterium), or 8.8 per level with a Geologist. Extra crawlers
// beyond that produce nothing, so the calculator caps the entered count.
const CRAWLER_CAP_PER_MINE = 8;
const CRAWLER_CAP_PER_MINE_GEOLOGIST = 8.8;

function maxCrawlers(metalMineLvl, crystalMineLvl, deutSynthLvl, geologist) {
	const mineSum = metalMineLvl + crystalMineLvl + deutSynthLvl;
	const factor = geologist ? CRAWLER_CAP_PER_MINE_GEOLOGIST : CRAWLER_CAP_PER_MINE;
	return Math.floor(factor * mineSum);
}

/**
 * Refresh the dynamic crawler limit on a crawler-count input: store it as the
 * field's max constraint (so the shared blur validator clamps to it and shows
 * the standard out-of-range warning, exactly like every other numeric field)
 * and surface it through the tooltip. The value itself is left untouched here;
 * clamping happens on blur, when the field loses focus.
 */
function updateCrawlerLimit(input, metalMineLvl, crystalMineLvl, deutSynthLvl, geologist) {
	if (!input) return;
	const max = maxCrawlers(metalMineLvl, crystalMineLvl, deutSynthLvl, geologist);
	input._constrains = { min: 0, max: max, def: 0, allowFloat: false, allowNegative: false };
	// alt feeds the field name into the blur validator's warning message
	if (options.crawlerName) input.alt = options.crawlerName;
	if (!options.crawlerLimitHint) return;

	const hint = options.crawlerLimitHint.replace('{0}', numToOGame(max));
	if (bootstrap.Tooltip.getInstance(input)) {
		// Bootstrap moves `title´ into `data-bs-original-title´ when it adopts an
		// element and re-reads the bubble text from there on every show, so that
		// attribute — not `title´ — is what keeps a recomputed hint in sync.
		// Writing `title´ back would leave the element with a native tooltip and
		// a Bootstrap one at the same time.
		input.dataset.bsOriginalTitle = hint;
	} else {
		input.dataset.bsToggle = 'tooltip';
		input.title = hint;
		bootstrap.Tooltip.getOrCreateInstance(input);
	}
}

function showMainTab(target) {
	const trigger = document.querySelector('#mainTabs button[data-bs-target="' + target + '"]');
	if (trigger && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
		bootstrap.Tab.getOrCreateInstance(trigger).show();
	}
}

// Accounts for changes in the parameters: energy tech, universe speed, officers and class.
function updateParams() {
	const g = collectGeneralSettings();
	options.prm.universeSpeed = g.universeSpeed;
	options.prm.energyTechLevel = g.energyTechLevel;
	options.prm.plasmaTechLevel = g.plasmaTechLevel;
	options.prm.geologist = g.geologist;
	options.prm.engineer = g.engineer;
	options.prm.technocrat = g.technocrat;
	options.prm.admiral = g.admiral;
	options.prm.commander = g.commander;
	options.prm.playerClass = g.playerClass;
	options.prm.energyBoost = g.energyBoost;
	options.prm.isTrader = g.isTrader;
	options.prm.lfMetProdBonus = g.lfMetProdBonus;
	options.prm.lfCrysProdBonus = g.lfCrysProdBonus;
	options.prm.lfDeutProdBonus = g.lfDeutProdBonus;
	options.prm.lfEnergyProdBonus = g.lfEnergyProdBonus;
	options.prm.lfCrawlerBonus = g.lfCrawlerBonus;
	options.prm.lfPlasmaCostReduction = g.lfPlasmaCostReduction;

	updateOnePlnTab();
	updateAllPlnTab();
}

// "How much will accumulate" panel
function renderAccumWhat(tab, currMet, currCrys, currDeut, totalHours, production, deutAccum) {
	if (tab === 'one') {
		$('#' + tab + 'pln-accumwhat-met').innerHTML = numToOGame(Math.min(options.metStorageCap, Math.round(currMet + totalHours * production[0])));
		$('#' + tab + 'pln-accumwhat-crys').innerHTML = numToOGame(Math.min(options.crysStorageCap, Math.round(currCrys + totalHours * production[1])));
		$('#' + tab + 'pln-accumwhat-deut').innerHTML = numToOGame(Math.min(options.deutStorageCap, deutAccum));
	} else {
		$('#' + tab + 'pln-accumwhat-met').innerHTML = numToOGame(Math.round(currMet + totalHours * production[0]));
		$('#' + tab + 'pln-accumwhat-crys').innerHTML = numToOGame(Math.round(currCrys + totalHours * production[1]));
		$('#' + tab + 'pln-accumwhat-deut').innerHTML = numToOGame(deutAccum);
	}
}

// If something is exceeded, mark that the specific storage's max capacity needs to blink, and reset the blink counter so the process starts over
function updateStorageBlinkFlags(currMet, currCrys, totalHours, production, deutAccum, needMet, needCrys, needDeut) {
	options.storagesToBlink[0] = options.metStorageCap < Math.round(currMet + totalHours * production[0]) || needMet > options.metStorageCap ? 1 : 0;
	options.storagesToBlink[1] = options.crysStorageCap < Math.round(currCrys + totalHours * production[1]) || needCrys > options.crysStorageCap ? 1 : 0;
	options.storagesToBlink[2] = options.deutStorageCap < deutAccum || needDeut > options.deutStorageCap ? 1 : 0;
	if (options.storagesToBlink[0] === 1 || options.storagesToBlink[1] === 1 || options.storagesToBlink[2] === 1) {
		options.storageBlinkCount = 0;
		if (!options.storagesBlinking) {
			options.storagesBlinking = true;
			blinkMaxStorage(options.storagesToBlink);
		}
	}
}

// calculate the time in hours it takes to accumulate the required amount of each resource and take the maximum of these intervals
function timeUntilResourcesAccumulate(currMet, currCrys, currDeut, production, needMet, needCrys, needDeut) {
	let t = 0;
	if (needMet > currMet) {
		t = (needMet - currMet) / production[0];
	}
	if (needCrys > currCrys) {
		t = Math.max(t, (needCrys - currCrys) / production[1]);
	}
	if (needDeut > currDeut) {
		if (production[2] <= 0) { // there are two possible reasons production is negative or zero:
			t = options.prm.oPPP[2][0] === 0 // there is no synthesizer at all
				? Number.POSITIVE_INFINITY
				: Number.NEGATIVE_INFINITY; // ...or the fusion reactor takes more than is produced
		} else {
			t = Math.max(t, (needDeut - currDeut) / production[2]);
		}
	}
	return t;
}

// "When it will accumulate" panel
function renderAccumWhen(tab, t) {
	const msgEl = $('#' + tab + 'pln-accumwhen-msg');
	if (!Number.isFinite(t)) {
		msgEl.innerHTML = t === Number.POSITIVE_INFINITY ? options.resWillNotAccumMsg : options.resWillNotAccumMsg1;
	} else if (t > 0) {
		msgEl.innerHTML = options.resReadyInMsg + timespanToShortenedString(t * 3600, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
	} else {
		msgEl.innerHTML = options.enoughResAlreadyMsg;
	}
}

function updateAccumulation(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	let currMet = getInputNumber($('#' + tab + 'pln-curr-met'));
	let currCrys = getInputNumber($('#' + tab + 'pln-curr-crys'));
	let currDeut = getInputNumber($('#' + tab + 'pln-curr-deut'));
	let days = getInputNumber($('#' + tab + 'pln-accumwhat-d'));
	let hours = getInputNumber($('#' + tab + 'pln-accumwhat-h'));
	let minutes = getInputNumber($('#' + tab + 'pln-accumwhat-m'));
	let totalHours = days * 24 + hours + minutes / 60.0;

	let deutAccum = Math.round(currDeut + totalHours * production[2]);
	if (deutAccum < 0)
		deutAccum = 0;

	renderAccumWhat(tab, currMet, currCrys, currDeut, totalHours, production, deutAccum);

	let needMet = getInputNumber($('#' + tab + 'pln-accumwhen-met'));
	let needCrys = getInputNumber($('#' + tab + 'pln-accumwhen-crys'));
	let needDeut = getInputNumber($('#' + tab + 'pln-accumwhen-deut'));

	updateStorageBlinkFlags(currMet, currCrys, totalHours, production, deutAccum, needMet, needCrys, needDeut);

	let t = timeUntilResourcesAccumulate(currMet, currCrys, currDeut, production, needMet, needCrys, needDeut);
	renderAccumWhen(tab, t);
}

// How many units of one fleet/defense item the accumulated production affords
// over `duration` hours, given its [metal, crystal, deuterium] cost.
function affordableUnitCount(duration, production, costs) {
	let minCount = Number.POSITIVE_INFINITY;
	for (let res = 0; res < 3; res++) {
		let producedRes = duration * production[res];
		if (producedRes < 0)
			producedRes = 0;
		if (costs[res] > 0)
			minCount = Math.min(minCount, Math.floor(producedRes / costs[res]));
	}
	return minCount;
}

function renderAffordableCounts(rows, itemCosts, duration, production, column, adjust) {
	let idx = 0;
	for (let i in itemCosts) {
		let minCount = affordableUnitCount(duration, production, itemCosts[i]);
		if (adjust) minCount = adjust(i, minCount);
		rows[idx++].children[column].innerHTML = minCount;
	}
}

// You can't build more than one shield dome anyway
function capMoonShields(itemId, minCount) {
	// Object property indexes are strings
	return (itemId === '407' || itemId === '408') ? Math.min(minCount, 1) : minCount;
}

function updateProduction(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	let durations = [1, 24, 168];	// resource accumulation duration: hour, day, week
	let fleetRows = Array.from($$('#' + tab + '-pln-fleet-prod tr')).slice(1);
	let defenseRows = Array.from($$('#' + tab + '-pln-defense-prod tr')).slice(1);
	for (let d = 0; d < 3; d++) {
		let duration = durations[d];
		renderAffordableCounts(fleetRows, options.fleetCosts, duration, production, d + 1, null);
		renderAffordableCounts(defenseRows, options.defenseCosts, duration, production, d + 1, capMoonShields);
	}
}

// Fills the per-row production/consumption cells (rows 0-15, columns 0-3),
// with column 3 of rows 1-3 showing the energy a mine draws (used/required).
function renderOnePlnProductionRows(rows, results, koeff) {
	for (let row = 0; row < 16; row++) {
		for (let col = 0; col < 4; col++) {
			if (row > 0 && row < 4 && col === 3) {
				let cons = results[row][4];
				rows[row + 1].children[6].innerHTML = cons > 0
					? numToOGame(Math.round(koeff * cons)) + '/' + numToOGame(cons)
					: '';
				continue;
			}
			let val = results[row][col] >= 0 ? numToOGame(results[row][col]) : '<span style="color: brown;">' + numToOGame(-1 * results[row][col]) + '</span>';
			if (results[row][col] === 0)
				val = '';
			rows[row + 1].children[col + 3].innerHTML = val;
		}
	}
}

// Display the current production data and sum up the totals: hourly/daily/weekly
// totals per resource plus the energy balance, all in the summary rows below
// the per-building table.
function renderOnePlnProductionSummary(rows, resultRow, production, totalEnergyProduced, totalEnergyUsed) {
	for (let i = 1; i < 4; i++) {
		let lb = '', rb = '', s = 1;
		if (production[i - 1] < 0) {
			lb = '<span style="color: brown;">';
			rb = '</span>';
			s = -1;
		}
		rows[resultRow].children[2 + i].innerHTML = lb + numberToShortenedString(s * production[i - 1], options.unitSuffix) + rb;
		rows[resultRow + 1].children[2 + i].innerHTML = lb + numberToShortenedString(24 * s * production[i - 1], options.unitSuffix) + rb;
		rows[resultRow + 2].children[2 + i].innerHTML = lb + numberToShortenedString(7 * 24 * s * production[i - 1], options.unitSuffix) + rb;
	}
	let energyLeft = Math.round(totalEnergyProduced - totalEnergyUsed);
	let spanColor = energyLeft < 0 ? 'brown' : 'inherit';
	let energyLeftStr = numberToShortenedString(Math.abs(energyLeft), options.unitSuffix);
	rows[resultRow].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeftStr + '</span>';
	rows[resultRow + 1].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeftStr + '</span>';
	rows[resultRow + 2].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeftStr + '</span>';
}

// One row of the mine amortization table: the cost of the next level (with
// solar satellites priced in when included), the resulting production
// increase and its payback time.
function renderMineUpgradeRow(rows, i, plnData, msuMult, currProd, newProd) {
	let costs = getBuildCost_C(i, options.prm.oPPP[i - 1][0], options.prm.oPPP[i - 1][0] + 1, options.bldCosts, 0);
	let totalCost;
	if (options.prm.inclSats) {
		let satsCost = getSSCost(i, options.prm.oPPP[i - 1][0], plnData);
		costs[1] += satsCost[1];
		costs[2] += satsCost[2];
		rows[i].children[1].innerHTML = numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
			numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal + ', ' +
			numberToShortenedString(costs[2], options.unitSuffix) + ' ' + options.deuterium;
		totalCost = costs[0] + msuMult[1] * costs[1] + msuMult[2] * costs[2];
	} else {
		rows[i].children[1].innerHTML = numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
			numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal;
		totalCost = costs[0] + msuMult[1] * costs[1];
	}
	let resMult = msuMult[i - 1] || 1;
	let increase = newProd[1][i - 1] - currProd[1][i - 1];
	rows[i].children[2].innerHTML = numberToShortenedString(increase, options.unitSuffix);
	rows[i].children[3].innerHTML = paybackToString(totalCost, increase * resMult);
}

// Mine amortization table: for each of metal/crystal/deuterium, the cost of the
// next level, the resulting production increase and its payback time.
function renderMinesAmortizationTable(rows, params, plnData, lfEff) {
	let currProd = calculateProduction(params, plnData, true, lfEff);
	let paramsCopy = params.map(function (arr) {
		return arr.slice();
	});
	paramsCopy[0][0] = paramsCopy[0][0] + 1; paramsCopy[1][0] = paramsCopy[1][0] + 1; paramsCopy[2][0] = paramsCopy[2][0] + 1;
	let newProd = calculateProduction(paramsCopy, plnData, true, lfEff);
	let msuMult = collectResourceMultipliers();
	options.prm.inclSats = getChecked('#include-SS-y');
	for (let i = 1; i < 4; i++) {
		renderMineUpgradeRow(rows, i, plnData, msuMult, currProd, newProd);
	}
}

function updateOnePlnStorageCapacities() {
	options.prm.metStorageLvl = getInputNumber($('#storage-met'));
	options.metStorageCap = getStorageCapacity(options.prm.metStorageLvl);
	$('#storage-cap-met').innerHTML = numToOGame(options.metStorageCap);

	options.prm.crysStorageLvl = getInputNumber($('#storage-crys'));
	options.crysStorageCap = getStorageCapacity(options.prm.crysStorageLvl);
	$('#storage-cap-crys').innerHTML = numToOGame(options.crysStorageCap);

	options.prm.deutStorageLvl = getInputNumber($('#storage-deut'));
	options.deutStorageCap = getStorageCapacity(options.prm.deutStorageLvl);
	$('#storage-cap-deut').innerHTML = numToOGame(options.deutStorageCap);
}

function updateOnePlnTab() {
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp'));
	options.prm.planetPos = getInputNumber($('#planet-pos'));
	options.prm.energyBoost = $('#energy-boost').value;
	options.prm.onePlnRace = Number($('#one-pln-race').value);
	options.prm.onePlnLfLevels = readOnePlnLfLevels();
	let lfEff = lfBuildingEffects(options.prm.onePlnRace, options.prm.onePlnLfLevels);
	let plnData = [options.prm.maxPlanetTemp, options.prm.planetPos, options.prm.energyBoost];
	let rows = $$('#one-planet-prod tr:not(.lf-row)');
	// Keep the crawler count (row 8) limit in sync with the mines (rows 2-4);
	// the value is clamped on blur by the shared numeric-input validator.
	updateCrawlerLimit(
		rows[8].children[2].children[0],
		getInputNumber(rows[2].children[2].children[0]),
		getInputNumber(rows[3].children[2].children[0]),
		getInputNumber(rows[4].children[2].children[0]),
		getChecked('#geologist')
	);
	let params = collectOnePlanetParams(rows);

	let prodData = calculateProduction(params, plnData, false, lfEff);
	let results = prodData[0];
	let production = prodData[1];
	let totalEnergyProduced = prodData[2];
	let totalEnergyUsed = prodData[3];
	let koeff = prodData[4];
	renderOnePlnLfRows(options.prm.onePlnRace, prodData[5]);

	let coeffSpan = $('#prod-coeff');
	coeffSpan.innerHTML = '<b>' + Math.floor(koeff * 100) + '%</b>';
	// brown when energy-starved, otherwise inherit the theme body color
	coeffSpan.style.color = koeff < 1 ? 'brown' : '';

	// +4 = header + separator + "Life form tech bonus" row on top of rowsToTechs.
	let resultRow = options.rowsToTechs.length + 4;
	renderOnePlnProductionRows(rows, results, koeff);
	renderOnePlnProductionSummary(rows, resultRow, production, totalEnergyProduced, totalEnergyUsed);
	options.prm.oPPP = params;

	let rates = collectExchangeRates();
	options.prm.rates = rates;
	renderMinesAmortizationTable($$('#mines-amort-tbl tr'), params, plnData, lfEff);

	updateOnePlnStorageCapacities();

	updateAccumulation('one', production);
	updateProduction('one', production);
	options.save();
}

function updateAllPlnTab() {
	let planetsCount = options.prm.currPlanetsCount;
	let rows = $$('#all-planets-prod tr');
	let totalProd = [0, 0, 0];
	// Keep every planet's crawler limit in sync with its mines; the values are
	// clamped on blur by the shared numeric-input validator.
	// LEVEL_COLUMNS holds the cell indices: [0]=metal, [1]=crystal, [2]=deut, [6]=crawler.
	let geologist = getChecked('#geologist');
	for (let i = 0; i < planetsCount; i++) {
		let plnRow = rows[i * 2 + 1];
		updateCrawlerLimit(
			plnRow.children[LEVEL_COLUMNS[6]].children[0],
			getInputNumber(plnRow.children[LEVEL_COLUMNS[0]].children[0]),
			getInputNumber(plnRow.children[LEVEL_COLUMNS[1]].children[0]),
			getInputNumber(plnRow.children[LEVEL_COLUMNS[2]].children[0]),
			geologist
		);
	}
	// collect the table inputs' data into the array in case there was a direct edit
	collectAllPlanetsInputs(rows);
	for (let i = 0; i < planetsCount; i++) {
		let planet = buildPlanetProdParams(i);
		let prodData = calculateProduction(planet.prodParams, planet.plnData, false, planet.lfEff);
		let production = prodData[1];
		let koeff = prodData[4];
		rows[i * 2 + 1].children[14].innerHTML = Math.floor(koeff * 100) + '%'; // write the production coefficient into the table's last column

		// Show the planet's energy booster
		rows[i * 2 + 2].children[2].children[0].innerHTML = options.energyShort + 10 * options.prm.aPS[i][2] + '%';
		for (let j = 0; j < 3; j++) {
			// Show resource production taking into account the selected mine power percentages
			rows[i * 2 + 1].children[LEVEL_COLUMNS[j] + 1].innerHTML = numToOGame(production[j]);
			// ...as well as the production boosters and factors
			rows[i * 2 + 2].children[LEVEL_COLUMNS[j] - 1].children[0].innerHTML = // adjustment for colspan=2
				10 * options.prm.aPS[i][(j + 1) * 3 + 2] + '% / ' + options.prm.aPS[i][(j + 1) * 3 + 1] + '%';
		}
		for (let j = 3; j < 7; j++) {
			// For power plants, satellites and Crawlers - production factors only
			rows[i * 2 + 2].children[LEVEL_COLUMNS[j] - 1].children[0].innerHTML = options.prm.aPS[i][(j + 1) * 3 + 1] + '%';
		}
		// Done with the calculations for the current planet, need to add the obtained resource production values to the total
		totalProd[0] += production[0];
		totalProd[1] += production[1];
		totalProd[2] += production[2];
	}

	// The resource production calculation for the planets is done, the totals can be summed up
	for (let i = 0; i < 3; i++) {
		rows[planetsCount * 2 + 2].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(totalProd[i], options.unitSuffix);
		rows[planetsCount * 2 + 3].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(24 * totalProd[i], options.unitSuffix);
		rows[planetsCount * 2 + 4].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(7 * 24 * totalProd[i], options.unitSuffix);
	}

	// Update the data in the bottom panels
	updateAccumulation('all', totalProd);
	updateProduction('all', totalProd);
	options.save();

	let techData = { 122: [2000, 4000, 1000, 2] };
	let costs = getBuildCost_C(122, options.prm.plasmaTechLevel, options.prm.plasmaTechLevel + 1, techData, 0);
	// Life Forms bonus: reduce the plasma upgrade cost used for the payback estimate
	let plasmaCostFactor = 1 - options.prm.lfPlasmaCostReduction / 100;
	for (let i = 0; i < 3; i++)
		costs[i] = Math.round(costs[i] * plasmaCostFactor);
	let msuMult = collectResourceMultipliers();
	let normCost = costs[0] + msuMult[1] * costs[1] + msuMult[2] * costs[2];
	options.prm.plasmaTechLevel += 1;
	let newProd = [0, 0, 0];
	for (let i = 0; i < planetsCount; i++) {
		let planet = buildPlanetProdParams(i);
		let prodData = calculateProduction(planet.prodParams, planet.plnData, false, planet.lfEff);
		newProd[0] += prodData[1][0];
		newProd[1] += prodData[1][1];
		newProd[2] += prodData[1][2];
	}
	let increase = [];
	increase[0] = newProd[0] - totalProd[0];
	increase[1] = newProd[1] - totalProd[1];
	increase[2] = newProd[2] - totalProd[2];
	let normIncrease = increase[0] + msuMult[1] * increase[1] + msuMult[2] * increase[2];
	options.prm.plasmaTechLevel -= 1;
	rows = $$('#plasma-amort-tbl tr');
	for (let i = 0; i < 3; i++) {
		rows[1].children[i + 1].innerHTML = numToOGame(costs[i]);
		rows[2].children[i + 1].innerHTML = numToOGame(increase[i]);
	}
	rows[3].children[1].innerHTML = paybackToString(normCost, normIncrease);

	updateMinesPriority();
}

// How many upgrades the priority table lists
const PRIORITY_UPGRADES_COUNT = 10;

/**
 * Format a [metal, crystal, deuterium] triple, dropping the zero components.
 */
function resourcesToString(res) {
	let names = [options.metal, options.crystal, options.deuterium];
	let parts = [];
	for (let i = 0; i < 3; i++) {
		if (Math.round(res[i]) === 0)
			continue;
		parts.push(numberToShortenedString(res[i], options.unitSuffix) + ' ' + names[i]);
	}
	return parts.length > 0 ? parts.join(', ') : '0';
}

/**
 * Payback time for a cell: an em dash when the upgrade brings no gain, so the
 * cell never keeps a stale value from an earlier recalculation.
 */
function paybackToString(normCost, normIncrease) {
	if (normIncrease <= 0)
		return '&mdash;';
	return timespanToShortenedString(Math.ceil(normCost / normIncrease * 3600),
		options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
}

/**
 * Rank one-level mine upgrades over every planet by their payback time and
 * list the fastest ones. Costs and production gains are brought to a common
 * scale with the exchange rates. Like the one-planet amortization table, the
 * production is computed as normalized (mines have enough energy and run at
 * 100% load), and the extra solar satellites are not priced in.
 */
function updateMinesPriority() {
	let body = $('#mines-priority-body');
	if (!body)
		return;
	let resMult = collectResourceMultipliers();
	let candidates = [];
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		let planet = buildPlanetProdParams(i);
		let currProd = calculateProduction(planet.prodParams, planet.plnData, true, planet.lfEff)[1];
		for (let m = 0; m < 3; m++) {
			let level = Number(planet.prodParams[m][0]) || 0;
			let costs = getBuildCost_C(m + 1, level, level + 1, options.bldCosts, 0);
			let upgraded = planet.prodParams.map(function (arr) { return arr.slice(); });
			upgraded[m][0] = level + 1;
			let newProd = calculateProduction(upgraded, planet.plnData, true, planet.lfEff)[1];
			let delta = [newProd[0] - currProd[0], newProd[1] - currProd[1], newProd[2] - currProd[2]];
			let normIncrease = delta[0] + resMult[1] * delta[1] + resMult[2] * delta[2];
			if (normIncrease <= 0)
				continue;
			let normCost = costs[0] + resMult[1] * costs[1] + resMult[2] * costs[2];
			candidates.push({
				pln: i, mine: m, level: level, costs: costs, delta: delta,
				time: normCost / normIncrease
			});
		}
	}
	candidates.sort(function (a, b) { return a.time - b.time; });

	let html = '';
	let shown = Math.min(candidates.length, PRIORITY_UPGRADES_COUNT);
	for (let n = 0; n < shown; n++) {
		let c = candidates[n];
		html += '<tr class="' + ((n % 2) === 0 ? 'odd' : 'even') + '">';
		html += '<td class="centered">' + (n + 1) + '</td>';
		html += '<td>' + options.prm.aPNames[c.pln] + '</td>';
		html += '<td>' + options.mineNames[c.mine] + '</td>';
		html += '<td class="centered">' + c.level + '&nbsp;&rarr;&nbsp;' + (c.level + 1) + '</td>';
		html += '<td class="centered">' + resourcesToString(c.costs) + '</td>';
		html += '<td class="centered">' + resourcesToString(c.delta) + '</td>';
		html += '<td class="centered">' + timespanToShortenedString(Math.ceil(c.time * 3600), options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true) + '</td>';
		html += '</tr>';
	}
	if (shown === 0)
		html = '<tr class="odd"><td colspan="7" class="centered">' + options.noUpgradesMsg + '</td></tr>';
	body.innerHTML = html;
}

function changePlanetsCount(newVal, oldVal) {
	if (newVal < options.minPlanetsCount || newVal > options.maxPlanetsCount)
		return;
	if (newVal < oldVal) {
		// Pick up any direct edits made in the table before judging the planet empty
		collectAllPlanetsInputs($$('#all-planets-prod tr'));
		if (!isPlnEmpty(oldVal - 1) && confirm(options.plnDelConfMsg) === false) {
			setVal('#planetsSpin', oldVal);
			return;
		}
		let plnID = oldVal - 1;
		options.prm.aPNames.splice(plnID, 1);
		options.prm.aPS.splice(plnID, 1);
		options.prm.currPlanetsCount--;
	} else {
		let plnID = options.prm.currPlanetsCount;
		options.prm.currPlanetsCount++;
		options.prm.aPNames[plnID] = options.planetNumStr + newVal;
		options.prm.aPS[plnID] = createEmptyPlanet();
	}
	prepAllPlanetsTable();
	updateAllPlnTab();
}

function resetParams() {
	options.prm.energyTechLevel = 0;
	options.prm.plasmaTechLevel = 0;
	options.prm.universeSpeed = 1;
	options.prm.geologist = false;
	options.prm.engineer = false;
	options.prm.technocrat = false;
	options.prm.admiral = false;
	options.prm.commander = false;
	options.prm.maxTempEntered = false;
	options.prm.maxPlanetTemp = 0;
	options.prm.planetPos = 8;
	options.prm.onePlnExtView = false;
	options.prm.onePlnRace = 0;
	options.prm.onePlnLfLevels = [];
	options.prm.oPPP = [[0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0]];
	options.prm.metStorageLvl = 0;
	options.prm.crysStorageLvl = 0;
	options.prm.deutStorageLvl = 0;
	options.prm.currPlanetsCount = 8;
	options.prm.playerClass = 0;
	options.prm.energyBoost = 0;
	options.prm.showAddInf = false;
	options.prm.inclSats = false;
	options.prm.rates = [1, 1.5, 3];
	options.prm.ratesFmt = 2;
	options.prm.isTrader = false;
	options.prm.lfMetProdBonus = 0;
	options.prm.lfCrysProdBonus = 0;
	options.prm.lfDeutProdBonus = 0;
	options.prm.lfEnergyProdBonus = 0;
	options.prm.lfCrawlerBonus = 0;
	options.prm.lfPlasmaCostReduction = 0;

	populateParams();
	setVal('#storage-met', 0);
	setVal('#storage-crys', 0);
	setVal('#storage-deut', 0);
	setVal('#onepln-curr-met', 0);
	setVal('#onepln-curr-crys', 0);
	setVal('#onepln-curr-deut', 0);
	setVal('#onepln-accumwhat-d', 0);
	setVal('#onepln-accumwhat-h', 0);
	setVal('#onepln-accumwhat-m', 0);
	setVal('#onepln-accumwhen-met', 0);
	setVal('#onepln-accumwhen-crys', 0);
	setVal('#onepln-accumwhen-deut', 0);
	setChecked('#one-pln-extended-view', options.prm.onePlnExtView);
	$$('#one-planet-prod .lf-row input[type=text]').forEach(function (el) { el.value = 0; });
	setOnePlanetProdData();
	updateOnePlnTab();
	setOnePlanetView(options.prm.onePlnExtView);

	setChecked('#all-pln-addtnl-info', options.prm.showAddInf);
	options.prm.currPlanetsCount = options.defPlanetsCount;
	setVal('#planetsSpin', options.defPlanetsCount);
	options.prm.aPS = [];
	options.prm.aPNames = [];
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		options.prm.aPNames.push(options.planetNumStr + (i + 1));
		options.prm.aPS.push(createEmptyPlanet());
	}

	prepAllPlanetsTable();
	updateAllPlnTab();
}

function toggleOnePlanetView() {
	options.prm.onePlnExtView = !options.prm.onePlnExtView;
	setOnePlanetView(options.prm.onePlnExtView);
	options.save();
}

// Show the life form building rows for the race picked in #one-pln-race
// (between the fusion reactor and the solar satellites), hiding the others.
function updateLifeformRows() {
	let race = Number($('#one-pln-race').value) || 0;
	$$('#one-planet-prod .lf-row').forEach(function (tr) {
		tr.style.display = 'none';
	});
	if (race >= 1 && race <= 4) {
		$$('#one-planet-prod .lf-row-' + race).forEach(function (tr) {
			tr.style.display = '';
		});
	}
}

// Index of a building row in the positional level array (index 0 is the race's
// first building). The table skips the first two buildings of every race, so the
// index comes from the row's building id rather than from its DOM order.
function lfRowIndex(el) {
	return Number.parseInt(el.dataset.lfId, 10) % 1000 - 1;
}

// Read the building levels of the currently selected race from the table into a
// positional array (index 0 is the race's first building).
function readOnePlnLfLevels() {
	let race = Number($('#one-pln-race').value) || 0;
	let levels = new Array(LF_BUILDINGS_PER_RACE).fill(0);
	if (race >= 1 && race <= 4) {
		$$('#one-planet-prod .lf-row-' + race + ' input[type=text]').forEach(function (el) {
			levels[lfRowIndex(el)] = getInputNumber(el);
		});
	}
	return levels;
}

// Fill the given race's building-level inputs from a positional array.
function writeOnePlnLfLevels(race, levels) {
	if (race < 1 || race > 4) return;
	let inputs = $$('#one-planet-prod .lf-row-' + race + ' input[type=text]');
	inputs.forEach(function (el) {
		let idx = lfRowIndex(el);
		el.value = (levels?.[idx] != null) ? levels[idx] : 0;
	});
}

// Table cell for a life form building contribution: blank at zero, brown when
// the building takes more than it gives - the same convention as the other rows.
function lfCellValue(val) {
	if (!val) return '';
	return val > 0
		? numToOGame(val)
		: '<span style="color: brown;">' + numToOGame(-val) + '</span>';
}

// Show what each life form building contributes in its own row: extra metal,
// crystal and deuterium, and its net effect on the planet energy pool.
function renderOnePlnLfRows(race, lfBld) {
	if (race < 1 || race > 4) return;
	let rows = $$('#one-planet-prod .lf-row-' + race);
	rows.forEach(function (tr) {
		let bld = lfBld[lfRowIndex(tr.querySelector('input[type=text]'))] || [0, 0, 0, 0, 0];
		for (let res = 0; res < 3; res++)
			tr.children[res + 3].innerHTML = lfCellValue(bld[res]);
		tr.children[6].innerHTML = lfCellValue(bld[3] - bld[4]);
	});
}

function editRow(plnID) {
	options.editedPln = plnID;
	setVal('#planet-name', options.prm.aPNames[plnID]);
	setVal('#max-planet-temp', options.prm.aPS[plnID][0]);
	setVal('#planet-pos', options.prm.aPS[plnID][1]);
	setVal('#energy-boost', options.prm.aPS[plnID][2]);
	setVal('#one-pln-race', options.prm.aPS[plnID][24] || 0);
	updateLifeformRows();
	writeOnePlnLfLevels(options.prm.aPS[plnID][24] || 0, options.prm.aPS[plnID].slice(25, 37));
	let rows = $$('#one-planet-prod tr:not(.lf-row)');
	for (let i = 1; i < 8; i++) {
		rows[i + 1].children[2].children[0].value = options.prm.aPS[plnID][i * 3];
		if (i < 7)
			rows[i + 1].children[7].children[0].selectedIndex = (100 - options.prm.aPS[plnID][i * 3 + 1]) / 10;
		if (i === 7)
			rows[i + 1].children[7].children[0].selectedIndex = (150 - options.prm.aPS[plnID][i * 3 + 1]) / 10;
		if (i < 4)
			rows[i + 1].children[1].children[0].selectedIndex = options.prm.aPS[plnID][i * 3 + 2];
	}
	showMainTab('#one-planet-panel');
	$('#planet-save-div').style.display = '';
	updateOnePlnTab();
}

/**
 * Swap a planet with its neighbour, keeping the table order in sync with aPS.
 * @param {number} plnID - index of the planet to move
 * @param {number} delta - -1 to move up, +1 to move down
 */
function movePlanet(plnID, delta) {
	let target = plnID + delta;
	if (target < 0 || target >= options.prm.currPlanetsCount)
		return;
	// Pick up any direct edits made in the table before reordering the arrays
	collectAllPlanetsInputs($$('#all-planets-prod tr'));
	let tmpName = options.prm.aPNames[plnID];
	options.prm.aPNames[plnID] = options.prm.aPNames[target];
	options.prm.aPNames[target] = tmpName;
	let tmpPln = options.prm.aPS[plnID];
	options.prm.aPS[plnID] = options.prm.aPS[target];
	options.prm.aPS[target] = tmpPln;
	// Keep the pending "edit planet" reference pointing at the same planet
	if (options.editedPln === plnID)
		options.editedPln = target;
	else if (options.editedPln === target)
		options.editedPln = plnID;
	prepAllPlanetsTable();
	updateAllPlnTab();
}

function deleteRow(plnID) {
	// Pick up any direct edits made in the table before judging the planet empty
	collectAllPlanetsInputs($$('#all-planets-prod tr'));
	if (!isPlnEmpty(plnID) && confirm(options.plnDelConfMsg) === false) {
		return;
	}
	options.prm.aPNames.splice(plnID, 1);
	options.prm.aPS.splice(plnID, 1);
	options.prm.currPlanetsCount--;
	setVal('#planetsSpin', options.prm.currPlanetsCount);
	prepAllPlanetsTable();
	updateAllPlnTab();
}

function savePlnData() {
	options.prm.aPNames[options.editedPln] = stripHTMLTags($('#planet-name').value);
	let target = options.prm.aPS[options.editedPln];
	let rows = $$('#one-planet-prod tr:not(.lf-row)');
	target[0] = getInputNumber($('#max-planet-temp'));
	target[1] = getInputNumber($('#planet-pos'));
	target[2] = Number($('#energy-boost').value);
	target[24] = Number($('#one-pln-race').value);
	let savedLfLevels = readOnePlnLfLevels();
	for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) target[25 + k] = savedLfLevels[k] || 0;
	for (let i = 1; i < 8; i++) {
		target[i * 3] = getInputNumber(rows[i + 1].children[2].children[0]);
		target[i * 3 + 1] = Number(rows[i + 1].children[7].children[0].value);
		if (i > 3) { // Power plants, satellites and Crawlers have no boosters
			target[i * 3 + 2] = 0;
		} else {
			target[i * 3 + 2] = Number(rows[i + 1].children[1].children[0].value);
		}
	}
	prepAllPlanetsTable();
	options.editedPln = 0;
	showMainTab('#all-planets-panel');
	$('#planet-save-div').style.display = 'none';
	updateAllPlnTab();
}

function clonePlnData() {
	if (confirm(options.cloneConfMsg) === false) {
		return;
	}
	let rows = $$('#one-planet-prod tr:not(.lf-row)');
	let lfLevels = readOnePlnLfLevels();
	let cloneRace = Number($('#one-pln-race').value);
	for (let pln = 0; pln < options.prm.currPlanetsCount; pln++) {
		let p = options.prm.aPS[pln];
		p[24] = cloneRace;
		for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) p[25 + k] = lfLevels[k] || 0;
		for (let i = 1; i < 8; i++) {
			p[i * 3] = getInputNumber(rows[i + 1].children[2].children[0]);
			p[i * 3 + 1] = Number(rows[i + 1].children[7].children[0].value);
			if (i > 3) { // Power plants, satellites and Crawlers have no boosters
				p[i * 3 + 2] = 0;
			} else {
				p[i * 3 + 2] = Number(rows[i + 1].children[1].children[0].value);
			}
		}
	}

	prepAllPlanetsTable();
	options.editedPln = 0;
	showMainTab('#all-planets-panel');
	$('#planet-save-div').style.display = 'none';
	updateAllPlnTab();
}

// ---------------------------------------------------------------------------
// Universes panel (pure localStorage, no AJAX)
// ---------------------------------------------------------------------------

function saveUniverseData() {
	let selectedUni = $('#universe-name-select').value;
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniOwrConfMsg) === false) {
		return;
	}
	saveToCookie(selectedUni, options.prm);
	$('#universe-save').blur();
}

function loadUniverseData() {
	let selectedUni = $('#universe-name-select').value;
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniLoadConfMsg) === false) {
		return;
	}
	options.load(selectedUni);
	$('#universe-load').blur();
	updateParams();
}

function deleteUniverseData() {
	let selectedUni = $('#universe-name-select').value;
	if (selectedUni === '0') {
		alert(options.noUniSelectedMsg);
		return;
	}
	if (confirm(options.uniDelConfMsg) === false) {
		return;
	}
	localStorage.removeItem(selectedUni);
	let uniNameSelect = $('#universe-name-select');
	let opt = Array.from(uniNameSelect.options).find(function (o) { return o.value === selectedUni; });
	if (opt) opt.remove();
	uniNameSelect.value = "0";
	$('#universe-delete').blur();
}

function addUniverseData() {
	let uniNameInput = $('#universe-name');
	if (uniNameInput.value.length === 0) {
		alert(options.noUniNameMsg);
		uniNameInput.focus();
		return;
	}
	let name = stripHTMLTags(uniNameInput.value);
	let key = "prod_uni_" + name;
	saveToCookie(key, options.prm);
	let uniNameSelect = $('#universe-name-select');
	uniNameSelect.append(new Option(name, key));
	uniNameSelect.value = key;
	uniNameInput.value = "";
	$('#universe-add').blur();
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function setupPlanetsSpin() {
	const input = $('#planetsSpin');
	const up = $('#planetsSpin-up');
	const down = $('#planetsSpin-down');
	if (!input || !up || !down) return;

	addEvent(up, 'click', function () {
		const oldVal = getInputNumber(input);
		const newVal = oldVal + 1;
		if (newVal <= options.maxPlanetsCount) {
			input.value = newVal;
			changePlanetsCount(newVal, oldVal);
		}
	});
	addEvent(down, 'click', function () {
		const oldVal = getInputNumber(input);
		const newVal = oldVal - 1;
		if (newVal >= options.minPlanetsCount) {
			input.value = newVal;
			changePlanetsCount(newVal, oldVal);
		}
	});
	// The field itself is readonly: typing a target count would have to add or
	// remove several planets at once, each one able to raise its own delete
	// confirmation, and a mistyped 150 would silently mean "delete 142 planets".
	// The buttons are the only way in, one planet per click, like costs.
}

function _onPlanetsTableClick(event) {
	const btn = event.target.closest('button');
	if (!btn || !('pln' in btn.dataset)) return;
	const plnID = Number.parseInt(btn.dataset.pln, 10);
	if (Number.isNaN(plnID)) return;
	btn.blur();
	if (btn.classList.contains('control-edit')) {
		editRow(plnID);
	} else if (btn.classList.contains('control-delete')) {
		deleteRow(plnID);
	} else if (btn.classList.contains('control-move-up')) {
		movePlanet(plnID, -1);
	} else if (btn.classList.contains('control-move-down')) {
		movePlanet(plnID, 1);
	}
}

function _bindTabPersistence() {
	$$('#mainTabs button[data-bs-toggle="tab"]').forEach(function (btn) {
		btn.addEventListener('shown.bs.tab', function () {
			const target = btn.dataset.bsTarget || '';
			const cookie = { value: target === '#all-planets-panel' ? 'all' : 'one', validate: function (k, v) { return v; } };
			saveToCookie(PRODUCTION_ACTIVE_TAB_COOKIE, cookie);
		});
	});
}

function _restoreActiveTab() {
	const cookie = { value: 'one', validate: function (k, v) { return v; } };
	loadFromCookie(PRODUCTION_ACTIVE_TAB_COOKIE, cookie);
	showMainTab(cookie.value === 'all' ? '#all-planets-panel' : '#one-planet-panel');
}

function _applyTheme() {
	const theme = { value: 'light', validate: function (k, v) { return v; } };
	loadFromCookie('theme', theme);
	if (typeof toggleLightBS === 'function') {
		toggleLightBS(theme.value === 'light');
	} else if (typeof toggleLight === 'function') {
		toggleLight(theme.value === 'light');
	}
}

function initializeProductionCalculator() {
	try {
		options.load('options_production');

		// Universes panel
		addEvent('#universe-load', 'click', loadUniverseData);
		addEvent('#universe-save', 'click', saveUniverseData);
		addEvent('#universe-delete', 'click', deleteUniverseData);
		addEvent('#universe-add', 'click', addUniverseData);

		// Tabs
		_bindTabPersistence();
		_restoreActiveTab();

		// Input constraints
		// Research levels: the same 0..50 range options.prm.validate applies to the
		// stored values, so an out-of-range entry is clamped on blur (with the
		// standard warning) instead of silently reverting to 0 on the next load.
		document.getElementById('energy-tech-level')._constrains = { 'min': 0, 'max': 50, 'def': 0, 'allowNegative': false };
		document.getElementById('plasma-tech-level')._constrains = { 'min': 0, 'max': 50, 'def': 0, 'allowNegative': false };
		document.getElementById('max-planet-temp')._constrains = { 'min': -134, 'def': 0, 'allowNegative': true };
		document.getElementById('planet-pos')._constrains = { 'min': 1, 'max': 16, 'def': 8, 'allowNegative': false };
		document.getElementById('exchange-rates-m')._constrains = { 'min': 0.1, 'max': 100, 'def': 1,   'allowFloat': true, 'allowNegative': false };
		document.getElementById('exchange-rates-c')._constrains = { 'min': 0.1, 'max': 100, 'def': 1.5, 'allowFloat': true, 'allowNegative': false };
		document.getElementById('exchange-rates-d')._constrains = { 'min': 0.1, 'max': 100, 'def': 3,   'allowFloat': true, 'allowNegative': false };

		// Life Forms bonuses: non-negative floating-point percentages
		['lf-metal-prod-bonus', 'lf-crystal-prod-bonus', 'lf-deut-prod-bonus', 'lf-energy-prod-bonus', 'lf-crawler-bonus'].forEach(function (id) {
			document.getElementById(id)._constrains = { 'min': 0, 'max': Infinity, 'def': 0, 'allowFloat': true, 'allowNegative': false };
		});
		// Plasma technology cost reduction is capped at 99%
		document.getElementById('lf-plasma-cost-reduction')._constrains = { 'min': 0, 'max': 99, 'def': 0, 'allowFloat': true, 'allowNegative': false };

		// Life form building levels: non-negative integers
		$$('#one-planet-prod .lf-row input[type=text]').forEach(function (el) {
			el._constrains = { 'min': 0, 'def': 0, 'allowFloat': false, 'allowNegative': false };
		});

		// General settings panel
		$$('#general-settings-panel input[type=text]').forEach(function (el) {
			bindNumericInput(el, updateParams);
		});
		$$('#general-settings-panel select').forEach(function (el) {
			addEvent(el, 'keyup', updateParams);
			addEvent(el, 'change', updateParams);
		});
		$$('#general-settings-panel input[type=checkbox]').forEach(function (el) {
			addEvent(el, 'click', updateParams);
		});
		$$('#general-settings-panel input[type=radio]').forEach(function (el) {
			addEvent(el, 'click', updateParams);
		});

		addEvent('#reset', 'click', resetParams);
		addEvent('#one-pln-extended-view', 'click', toggleOnePlanetView);
		addEvent('#all-pln-addtnl-info', 'click', toggleShowAdditionalInfo);

		// One-planet tab
		$$('#one-planet-panel input[type=text]').forEach(function (el) {
			if (el.id === 'planet-name') return;
			bindNumericInput(el, updateOnePlnTab);
		});
		$$('#one-planet-panel select').forEach(function (el) {
			addEvent(el, 'keyup', updateOnePlnTab);
			addEvent(el, 'change', updateOnePlnTab);
		});
		$$('#one-planet-panel input[type=checkbox]').forEach(function (el) {
			addEvent(el, 'click', updateOnePlnTab);
		});
		addEvent('#save-planet-data', 'click', savePlnData);
		addEvent('#clone-planet-data', 'click', clonePlnData);
		addEvent('#include-SS-y', 'click', updateOnePlnTab);
		addEvent('#include-SS-n', 'click', updateOnePlnTab);
		addEvent('#one-pln-race', 'change', updateLifeformRows);
		// Reflect the race restored from storage on the initial render
		updateLifeformRows();

		// All-planets tab: the table inputs are (re)bound in prepAllPlanetsTable;
		// row edit/delete clicks are delegated so they survive table rebuilds
		$$('#all-planets-accordion input[type=text]').forEach(function (el) {
			bindNumericInput(el, updateAllPlnTab);
		});
		$$('#all-planets-panel input[type=checkbox]').forEach(function (el) {
			addEvent(el, 'click', updateAllPlnTab);
		});
		addEvent('#all-planets-prod', 'click', _onPlanetsTableClick);

		setupPlanetsSpin();

		// Synthesizer (row 4) and satellite (row 7) production depends on temperature - remind about it
		let rows = $$('#one-planet-prod tr:not(.lf-row)');
		addEvent(rows[4].children[2].children[0], 'keyup', blinkMaxTemp);
		addEvent(rows[7].children[2].children[0], 'keyup', blinkMaxTemp);
		addEvent('#max-planet-temp', 'keyup', function () { options.prm.maxTempEntered = true; });

		// Universe list from localStorage
		let keys = [];
		for (let i = 0, len = localStorage.length; i < len; i++) {
			let key = localStorage.key(i);
			if (key.includes("prod_uni_")) {
				keys.push(key);
			}
		}
		keys.sort((a, b) => a.localeCompare(b));
		for (let i = 0; i < keys.length; i++) {
			let key = keys[i];
			$('#universe-name-select').append(new Option(key.replace("prod_uni_", ""), key));
		}

		// Theme
		_applyTheme();
		const lightCb = $('#cb-light-theme');
		if (lightCb) {
			lightCb.addEventListener('click', function () {
				if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
			});
		}

		updateParams();
		options.cloneConfMsg = options.cloneConfMsg.replaceAll("__BR__", "\n");
	} catch (e) {
		alert('Exception: ' + e);
	}
}

if (typeof globalThis !== 'undefined') {
	globalThis.initializeProductionCalculator = initializeProductionCalculator;
}
