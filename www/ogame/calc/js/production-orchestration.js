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
	if (options.crawlerLimitHint)
		input.title = options.crawlerLimitHint.replace('{0}', numToOGame(max));
}

function showMainTab(target) {
	const trigger = document.querySelector('#mainTabs button[data-bs-target="' + target + '"]');
	if (trigger && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
		bootstrap.Tab.getOrCreateInstance(trigger).show();
	}
}

// Учитывает изменения в параметрах: энерготеха, скорость вселенной, офицеры и класс.
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

function updateAccumulation(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	// Панелька "Сколько накопится"
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

	if (tab === 'one') {
		$('#' + tab + 'pln-accumwhat-met').innerHTML = numToOGame(Math.min(options.metStorageCap, Math.round(currMet + totalHours * production[0])));
		$('#' + tab + 'pln-accumwhat-crys').innerHTML = numToOGame(Math.min(options.crysStorageCap, Math.round(currCrys + totalHours * production[1])));
		$('#' + tab + 'pln-accumwhat-deut').innerHTML = numToOGame(Math.min(options.deutStorageCap, deutAccum));
	} else {
		$('#' + tab + 'pln-accumwhat-met').innerHTML = numToOGame(Math.round(currMet + totalHours * production[0]));
		$('#' + tab + 'pln-accumwhat-crys').innerHTML = numToOGame(Math.round(currCrys + totalHours * production[1]));
		$('#' + tab + 'pln-accumwhat-deut').innerHTML = numToOGame(deutAccum);
	}

	// Панелька "Когда накопится"
	let needMet = getInputNumber($('#' + tab + 'pln-accumwhen-met'));
	let needCrys = getInputNumber($('#' + tab + 'pln-accumwhen-crys'));
	let needDeut = getInputNumber($('#' + tab + 'pln-accumwhen-deut'));

	// Если что-то превышено, отметим, что надо поморгать максимальным объёмом конкретного хранилища, и сбросим счётчик морганий, чтобы процесс начался снова
	if (options.metStorageCap < Math.round(currMet + totalHours * production[0]) || needMet > options.metStorageCap) {
		options.storagesToBlink[0] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[0] = 0;
	}
	if (options.crysStorageCap < Math.round(currCrys + totalHours * production[1]) || needCrys > options.crysStorageCap) {
		options.storagesToBlink[1] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[1] = 0;
	}
	if (options.deutStorageCap < deutAccum || needDeut > options.deutStorageCap) {
		options.storagesToBlink[2] = 1;
		options.storageBlinkCount = 0;
	} else {
		options.storagesToBlink[2] = 0;
	}
	if ((options.storagesToBlink[0] === 1 || options.storagesToBlink[1] === 1 || options.storagesToBlink[2] === 1) && !options.storagesBlinking) {
		options.storagesBlinking = true;
		blinkMaxStorage(options.storagesToBlink);
	}

	let t = 0;
	// вычислим время в часах, за которое накопится требуемое кол-во каждого из ресурсов и возьмём максимум из этих интервалов
	if (needMet > currMet) {
		t = (needMet - currMet) / production[0];
	}
	if (needCrys > currCrys) {
		t = Math.max(t, (needCrys - currCrys) / production[1]);
	}
	if (needDeut > currDeut) {
		if (production[2] <= 0) { // есть два варианта, почему производство отрицательное или нулевое:
			if (options.prm.oPPP[2][0] === 0) // вообще нет синтезатора
				t = Number.POSITIVE_INFINITY
			else // ...или термояд забирает больше, чем производится
				t = Number.NEGATIVE_INFINITY;
		} else {
			t = Math.max(t, (needDeut - currDeut) / production[2]);
		}
	}

	if (!Number.isFinite(t)) {
		if (t === Number.POSITIVE_INFINITY) {
			$('#' + tab + 'pln-accumwhen-msg').innerHTML = options.resWillNotAccumMsg;
		} else {
			$('#' + tab + 'pln-accumwhen-msg').innerHTML = options.resWillNotAccumMsg1;
		}
	} else {
		if (t > 0) {
			$('#' + tab + 'pln-accumwhen-msg').innerHTML = options.resReadyInMsg + timespanToShortenedString(t * 3600, options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
		} else {
			$('#' + tab + 'pln-accumwhen-msg').innerHTML = options.enoughResAlreadyMsg;
		}
	}
}

function updateProduction(tab, production) {
	if (tab !== 'one' && tab !== 'all')
		return;
	let durations = [1, 24, 168];	// продолжительность накопления ресов: час, день, неделя
	let fleetRows = Array.from($$('#' + tab + '-pln-fleet-prod tr')).slice(1);
	let defenseRows = Array.from($$('#' + tab + '-pln-defense-prod tr')).slice(1);
	let minCount = Number.POSITIVE_INFINITY;
	for (let d = 0; d < 3; d++) {
		let duration = durations[d];
		let idx = 0;
		for (let i in options.fleetCosts) {
			minCount = Number.POSITIVE_INFINITY;
			for (var res = 0; res < 3; res++) {
				var producedRes = duration * production[res];
				if (producedRes < 0)
					producedRes = 0;
				if (options.fleetCosts[i][res] > 0)
					minCount = Math.min(minCount, Math.floor(producedRes / options.fleetCosts[i][res]));
			}
			fleetRows[idx++].children[d + 1].innerHTML = minCount;
		}
		idx = 0;
		for (let i in options.defenseCosts) {
			minCount = Number.POSITIVE_INFINITY;
			for (let res = 0; res < 3; res++) {
				let producedRes = duration * production[res];
				if (producedRes < 0)
					producedRes = 0;
				if (options.defenseCosts[i][res] > 0)
					minCount = Math.min(minCount, Math.floor(producedRes / options.defenseCosts[i][res]));
			}
			// Куполов больше одного всё равно не построишь
			if (i === '407' || i === '408') // Индексы свойств объекта - строковые
				minCount = Math.min(minCount, 1);
			defenseRows[idx++].children[d + 1].innerHTML = minCount;
		}
	}
}

function updateOnePlnTab() {
	let i;
	options.prm.maxPlanetTemp = getInputNumber($('#max-planet-temp'));
	options.prm.planetPos = getInputNumber($('#planet-pos'));
	options.prm.energyBoost = $('#energy-boost').value;
	options.prm.onePlnRace = Number($('#one-pln-race').value);
	options.prm.onePlnLfLevels = readOnePlnLfLevels();
	let lfCons = lfEnergyConsumption(options.prm.onePlnRace, options.prm.onePlnLfLevels);
	renderOnePlnLfEnergy(options.prm.onePlnRace, lfCons.perBld);
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

	let prodData = calculateProduction(params, plnData, false, lfCons.total);
	let results = prodData[0];
	let production = prodData[1];
	let totalEnergyProduced = prodData[2];
	let totalEnergyUsed = prodData[3];
	let koeff = prodData[4];

	let coeffSpan = $('#prod-coeff');
	coeffSpan.innerHTML = '<b>' + Math.floor(koeff * 100) + '%</b>';
	// brown when energy-starved, otherwise inherit the theme body color
	coeffSpan.style.color = koeff < 1 ? 'brown' : '';

	// Выведем данные о текущем производстве и подведем итоги.
	// +4 = заголовок + разделитель + строка "Техн. бонус форм жизни" сверх rowsToTechs.
	let resultRow = options.rowsToTechs.length + 4;
	let val, cons = 0;
	for (let row = 0; row < 16; row++) {
		for (let col = 0; col < 4; col++) {
			if (row > 0 && row < 4 && col === 3) {
				cons = results[row][4];
				if (cons > 0)
					rows[row + 1].children[6].innerHTML = numToOGame(Math.round(koeff * cons)) + '/' + numToOGame(cons);
				else
					rows[row + 1].children[6].innerHTML = '';
				continue;
			}
			val = results[row][col] >= 0 ? numToOGame(results[row][col]) : '<span style="color: brown;">' + numToOGame(-1 * results[row][col]) + '</span>';
			if (results[row][col] === 0)
				val = '';
			rows[row + 1].children[col + 3].innerHTML = val;
		}
	}

	let lb, rb, s;
	for (i = 1; i < 4; i++) {
		if (production[i - 1] < 0) {
			lb = '<span style="color: brown;">';
			rb = '</span>';
			s = -1;
		} else {
			lb = '';
			rb = '';
			s = 1;
		}
		rows[resultRow].children[2 + i].innerHTML = lb + numberToShortenedString(s * production[i - 1], options.unitSuffix) + rb;
		rows[resultRow + 1].children[2 + i].innerHTML = lb + numberToShortenedString(24 * s * production[i - 1], options.unitSuffix) + rb;
		rows[resultRow + 2].children[2 + i].innerHTML = lb + numberToShortenedString(7 * 24 * s * production[i - 1], options.unitSuffix) + rb;
	}
	let energyLeft = Math.round(totalEnergyProduced - totalEnergyUsed);
	let spanColor = energyLeft < 0 ? 'brown' : 'inherit';
	energyLeft = numberToShortenedString(Math.abs(energyLeft), options.unitSuffix);
	rows[resultRow].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeft + '</span>';
	rows[resultRow + 1].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeft + '</span>';
	rows[resultRow + 2].children[6].innerHTML = '<span style="color: ' + spanColor + ';">' + energyLeft + '</span>';
	options.prm.oPPP = params;

	rows = $$('#mines-amort-tbl tr');
	let currProd = calculateProduction(params, plnData, true);
	let paramsCopy = params.map(function (arr) {
		return arr.slice();
	});
	paramsCopy[0][0] = paramsCopy[0][0] + 1; paramsCopy[1][0] = paramsCopy[1][0] + 1; paramsCopy[2][0] = paramsCopy[2][0] + 1;
	let newProd = calculateProduction(paramsCopy, plnData, true);
	let increase;
	let rates = collectExchangeRates();
	options.prm.rates = rates;
	let totalCost;
	let amortTime;
	let satsCost = [];
	let resMult;
	options.prm.inclSats = getChecked('#include-SS-y');
	for (let i = 1; i < 4; i++) {
		let costs = getBuildCost_C(i, options.prm.oPPP[i - 1][0], options.prm.oPPP[i - 1][0] + 1, options.bldCosts, 0);
		if (options.prm.inclSats) {
			satsCost = getSSCost(i, options.prm.oPPP[i - 1][0], plnData);
			costs[1] += satsCost[1];
			costs[2] += satsCost[2];
			rows[i].children[1].innerHTML = numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
				numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal + ', ' +
				numberToShortenedString(costs[2], options.unitSuffix) + ' ' + options.deuterium;
			totalCost = costs[0] + (rates[0] / rates[1]) * costs[1] + (rates[0] / rates[2]) * costs[2];
		} else {
			rows[i].children[1].innerHTML = numberToShortenedString(costs[0], options.unitSuffix) + ' ' + options.metal + ', ' +
				numberToShortenedString(costs[1], options.unitSuffix) + ' ' + options.crystal;
			totalCost = costs[0] + (rates[0] / rates[1]) * costs[1];
		}
		switch (i) {
			case 1: resMult = 1; break;
			case 2: resMult = rates[0] / rates[1]; break;
			case 3: resMult = rates[0] / rates[2]; break;
			default: resMult = 1;
		}
		increase = newProd[1][i - 1] - currProd[1][i - 1];
		rows[i].children[2].innerHTML = numberToShortenedString(increase, options.unitSuffix);
		amortTime = totalCost / (increase * resMult);
		rows[i].children[3].innerHTML = timespanToShortenedString(Math.ceil(amortTime * 3600), options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
	}

	options.prm.metStorageLvl = getInputNumber($('#storage-met'));
	options.metStorageCap = getStorageCapacity(options.prm.metStorageLvl);
	$('#storage-cap-met').innerHTML = numToOGame(options.metStorageCap);

	options.prm.crysStorageLvl = getInputNumber($('#storage-crys'));
	options.crysStorageCap = getStorageCapacity(options.prm.crysStorageLvl);
	$('#storage-cap-crys').innerHTML = numToOGame(options.crysStorageCap);

	options.prm.deutStorageLvl = getInputNumber($('#storage-deut'));
	options.deutStorageCap = getStorageCapacity(options.prm.deutStorageLvl);
	$('#storage-cap-deut').innerHTML = numToOGame(options.deutStorageCap);

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
	// считаем в массив данные из input-ов таблицы на случай, если имело место прямое редактирование
	collectAllPlanetsInputs(rows);
	for (let i = 0; i < planetsCount; i++) {
		let planet = buildPlanetProdParams(i);
		let prodData = calculateProduction(planet.prodParams, planet.plnData, false, planet.lfEnergyUsed);
		let production = prodData[1];
		let koeff = prodData[4];
		rows[i * 2 + 1].children[14].innerHTML = Math.floor(koeff * 100) + '%'; // в последний столбец таблицы запишем коэффициент производства

		// Покажем бустер энергии планеты
		rows[i * 2 + 2].children[2].children[0].innerHTML = options.energyShort + 10 * options.prm.aPS[i][2] + '%';
		for (let j = 0; j < 3; j++) {
			// Покажем производство ресурсов с учётом выбранных процентов мощности работы рудников
			rows[i * 2 + 1].children[LEVEL_COLUMNS[j] + 1].innerHTML = numToOGame(production[j]);
			// ...а также бустеры и факторы производства
			rows[i * 2 + 2].children[LEVEL_COLUMNS[j] - 1].children[0].innerHTML = // поправка на colspan=2
				10 * options.prm.aPS[i][(j + 1) * 3 + 2] + '% / ' + options.prm.aPS[i][(j + 1) * 3 + 1] + '%';
		}
		for (let j = 3; j < 7; j++) {
			// Для электростанций, лампочек и Гусеничников - только факторы производства
			rows[i * 2 + 2].children[LEVEL_COLUMNS[j] - 1].children[0].innerHTML = options.prm.aPS[i][(j + 1) * 3 + 1] + '%';
		}
		// Расчёты по текущей планете закончили, надо добавить полученные значения производства ресурсов к итогу
		totalProd[0] += production[0];
		totalProd[1] += production[1];
		totalProd[2] += production[2];
	}

	// Закончен расчёт производства ресурсов на планетах, можно подводить итоги
	for (let i = 0; i < 3; i++) {
		rows[planetsCount * 2 + 2].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(totalProd[i], options.unitSuffix);
		rows[planetsCount * 2 + 3].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(24 * totalProd[i], options.unitSuffix);
		rows[planetsCount * 2 + 4].children[LEVEL_COLUMNS[i + 1] - 1].innerHTML = numberToShortenedString(7 * 24 * totalProd[i], options.unitSuffix);
	}

	// Обновим данные в нижних панельках
	updateAccumulation('all', totalProd);
	updateProduction('all', totalProd);
	options.save();

	let techData = { 122: [2000, 4000, 1000, 2] };
	let costs = getBuildCost_C(122, options.prm.plasmaTechLevel, options.prm.plasmaTechLevel + 1, techData, 0);
	// Life Forms bonus: reduce the plasma upgrade cost used for the payback estimate
	let plasmaCostFactor = 1 - options.prm.lfPlasmaCostReduction / 100;
	for (let i = 0; i < 3; i++)
		costs[i] = Math.round(costs[i] * plasmaCostFactor);
	let rates = collectExchangeRates();
	let normCost = costs[0] + (rates[0] / rates[1]) * costs[1] + (rates[0] / rates[2]) * costs[2];
	options.prm.plasmaTechLevel += 1;
	let newProd = [0, 0, 0];
	for (let i = 0; i < planetsCount; i++) {
		let planet = buildPlanetProdParams(i);
		let prodData = calculateProduction(planet.prodParams, planet.plnData, false, planet.lfEnergyUsed);
		newProd[0] += prodData[1][0];
		newProd[1] += prodData[1][1];
		newProd[2] += prodData[1][2];
	}
	let increase = [];
	increase[0] = newProd[0] - totalProd[0];
	increase[1] = newProd[1] - totalProd[1];
	increase[2] = newProd[2] - totalProd[2];
	let normIncrease = increase[0] + (rates[0] / rates[1]) * increase[1] + (rates[0] / rates[2]) * increase[2];
	let amortTime = normCost / normIncrease;
	options.prm.plasmaTechLevel -= 1;
	rows = $$('#plasma-amort-tbl tr');
	for (let i = 0; i < 3; i++) {
		rows[1].children[i + 1].innerHTML = numToOGame(costs[i]);
		rows[2].children[i + 1].innerHTML = numToOGame(increase[i]);
	}
	if (normIncrease > 0)
		rows[3].children[1].innerHTML = timespanToShortenedString(Math.ceil(amortTime * 3600), options.datetimeW, options.datetimeD, options.datetimeH, options.datetimeM, options.datetimeS, true);
}

function changePlanetsCount(newVal, oldVal) {
	if (newVal < options.minPlanetsCount || newVal > options.maxPlanetsCount)
		return;
	if (newVal < oldVal) {
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
	options.prm.rates = [3, 2, 1];
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

// Read the building levels of the currently selected race from the table into a
// positional array (index 0 is the race's first building).
function readOnePlnLfLevels() {
	let race = Number($('#one-pln-race').value) || 0;
	let levels = [];
	if (race >= 1 && race <= 4) {
		$$('#one-planet-prod .lf-row-' + race + ' input[type=text]').forEach(function (el) {
			levels.push(getInputNumber(el));
		});
	}
	return levels;
}

// Fill the given race's building-level inputs from a positional array.
function writeOnePlnLfLevels(race, levels) {
	if (race < 1 || race > 4) return;
	let inputs = $$('#one-planet-prod .lf-row-' + race + ' input[type=text]');
	inputs.forEach(function (el, idx) {
		el.value = (levels && levels[idx] != null) ? levels[idx] : 0;
	});
}

// Show each life form building's energy draw in its row (brown, like mines).
function renderOnePlnLfEnergy(race, perBld) {
	if (race < 1 || race > 4) return;
	let rows = $$('#one-planet-prod .lf-row-' + race);
	rows.forEach(function (tr, idx) {
		let cons = perBld[idx] || 0;
		tr.children[6].innerHTML = cons > 0
			? '<span style="color: brown;">' + numToOGame(cons) + '</span>'
			: '';
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

function deleteRow(plnID) {
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
	target[0] = Number($('#max-planet-temp').value);
	target[1] = Number($('#planet-pos').value);
	target[2] = Number($('#energy-boost').value);
	target[24] = Number($('#one-pln-race').value);
	let savedLfLevels = readOnePlnLfLevels();
	for (let k = 0; k < 12; k++) target[25 + k] = savedLfLevels[k] || 0;
	for (let i = 1; i < 8; i++) {
		target[i * 3] = getInputNumber(rows[i + 1].children[2].children[0]);
		target[i * 3 + 1] = Number(rows[i + 1].children[7].children[0].value);
		if (i > 3) { // У электростанций, лампочек и Гусеничников нет бустеров
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
		for (let k = 0; k < 12; k++) p[25 + k] = lfLevels[k] || 0;
		for (let i = 1; i < 8; i++) {
			p[i * 3] = getInputNumber(rows[i + 1].children[2].children[0]);
			p[i * 3 + 1] = Number(rows[i + 1].children[7].children[0].value);
			if (i > 3) { // У электростанций, лампочек и Гусеничников нет бустеров
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
	input._constrains = { 'min': options.minPlanetsCount, 'max': options.maxPlanetsCount, 'def': options.defPlanetsCount, 'allowNegative': false };

	addEvent(up, 'click', function () {
		const oldVal = Number.parseInt(input.value) || 0;
		const newVal = oldVal + 1;
		if (newVal <= options.maxPlanetsCount) {
			input.value = newVal;
			changePlanetsCount(newVal, oldVal);
		}
	});
	addEvent(down, 'click', function () {
		const oldVal = Number.parseInt(input.value) || 0;
		const newVal = oldVal - 1;
		if (newVal >= options.minPlanetsCount) {
			input.value = newVal;
			changePlanetsCount(newVal, oldVal);
		}
	});
	addEvent(input, 'keyup', function (e) { validateInputNumber(e); });
	addEvent(input, 'change', function () {
		let target = getInputNumber(input);
		if (target < options.minPlanetsCount || target > options.maxPlanetsCount) {
			input.value = options.prm.currPlanetsCount;
			return;
		}
		// Add/remove planets one at a time so the per-planet delete
		// confirmation still fires; stop if the user cancels one.
		while (options.prm.currPlanetsCount !== target) {
			const curr = options.prm.currPlanetsCount;
			const next = curr < target ? curr + 1 : curr - 1;
			changePlanetsCount(next, curr);
			if (options.prm.currPlanetsCount === curr) break;
		}
		input.value = options.prm.currPlanetsCount;
	});
}

function _onPlanetsTableClick(event) {
	const btn = event.target.closest('button');
	if (!btn || !btn.hasAttribute('data-pln')) return;
	const plnID = Number.parseInt(btn.getAttribute('data-pln'), 10);
	if (Number.isNaN(plnID)) return;
	btn.blur();
	if (btn.classList.contains('control-edit')) {
		editRow(plnID);
	} else if (btn.classList.contains('control-delete')) {
		deleteRow(plnID);
	}
}

function _bindTabPersistence() {
	$$('#mainTabs button[data-bs-toggle="tab"]').forEach(function (btn) {
		btn.addEventListener('shown.bs.tab', function () {
			const target = btn.getAttribute('data-bs-target') || '';
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
		document.getElementById('max-planet-temp')._constrains = { 'min': -134, 'def': 0, 'allowNegative': true };
		document.getElementById('planet-pos')._constrains = { 'min': 1, 'max': 16, 'def': 8, 'allowNegative': false };
		document.getElementById('exchange-rates-m')._constrains = { 'min': 1, 'max': 4, 'def': 1, 'allowFloat': true, 'allowNegative': false };
		document.getElementById('exchange-rates-c')._constrains = { 'min': 1, 'max': 3, 'def': 1, 'allowFloat': true, 'allowNegative': false };
		document.getElementById('exchange-rates-d')._constrains = { 'min': 1, 'max': 2, 'def': 1, 'allowFloat': true, 'allowNegative': false };

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

		// Производство синтезатора (стр. 4) и спутников (стр. 7) зависит от температуры - напомним о ней
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
