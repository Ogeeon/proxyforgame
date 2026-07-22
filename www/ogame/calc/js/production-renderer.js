// ============================================================================
// PRODUCTION CALCULATOR - RENDERER
// ============================================================================
// Writes calculator state into the DOM: populates the settings panel, the
// one-planet table and rebuilds the all-planets table. Row/cell positions
// must match production.tpl and the collector's LEVEL_COLUMNS.

'use strict';

function populateParams() {
	setVal('#universe-speed', options.prm.universeSpeed);
	setVal('#energy-tech-level', options.prm.energyTechLevel);
	setVal('#plasma-tech-level', options.prm.plasmaTechLevel);
	setVal('#max-planet-temp', options.prm.maxPlanetTemp);
	setChecked('#one-pln-extended-view', options.prm.onePlnExtView);
	setVal('#one-pln-race', options.prm.onePlnRace);
	if (typeof updateLifeformRows === 'function') updateLifeformRows();
	if (typeof writeOnePlnLfLevels === 'function') writeOnePlnLfLevels(options.prm.onePlnRace, options.prm.onePlnLfLevels);
	setVal('#planet-pos', options.prm.planetPos);
	setChecked('#engineer', options.prm.engineer);
	setChecked('#geologist', options.prm.geologist);
	setChecked('#technocrat', options.prm.technocrat);
	setChecked('#admiral', options.prm.admiral);
	setChecked('#commander', options.prm.commander);
	setChecked('#class-' + options.prm.playerClass, true);
	setVal('#energy-boost', options.prm.energyBoost);
	setChecked('#all-pln-addtnl-info', options.prm.showAddInf);
	setNumVal('#exchange-rates-m', options.prm.rates[0]);
	setNumVal('#exchange-rates-c', options.prm.rates[1]);
	setNumVal('#exchange-rates-d', options.prm.rates[2]);
	setChecked('#include-SS-' + (options.prm.inclSats ? 'y' : 'n'), true);
	setChecked('#is-trader', options.prm.isTrader);
	setNumVal('#lf-metal-prod-bonus', options.prm.lfMetProdBonus);
	setNumVal('#lf-crystal-prod-bonus', options.prm.lfCrysProdBonus);
	setNumVal('#lf-deut-prod-bonus', options.prm.lfDeutProdBonus);
	setNumVal('#lf-energy-prod-bonus', options.prm.lfEnergyProdBonus);
	setNumVal('#lf-crawler-bonus', options.prm.lfCrawlerBonus);
	setNumVal('#lf-plasma-cost-reduction', options.prm.lfPlasmaCostReduction);
}

function setOnePlanetProdData() {
	let rows = $$('#one-planet-prod tr:not(.lf-row)');
	for (let i = 0; i < options.prm.oPPP.length; i++) {
		rows[i + 2].children[2].children[0].value = options.prm.oPPP[i][0];
		if (i < 6)
			rows[i + 2].children[7].children[0].selectedIndex = (100 - options.prm.oPPP[i][1]) / 10;
		if (i === 6)
			rows[i + 2].children[7].children[0].selectedIndex = (150 - options.prm.oPPP[i][1]) / 10;
		if (i < 3)
			rows[i + 2].children[1].children[0].selectedIndex = options.prm.oPPP[i][2];
	}

	setVal('#storage-met', options.prm.metStorageLvl);
	setVal('#storage-crys', options.prm.crysStorageLvl);
	setVal('#storage-deut', options.prm.deutStorageLvl);
}

function prepAllPlanetsTable() {
	let allRows = Array.from($$('#all-planets-prod tr'));
	// Keep the header (first row) and the footer (2px line, 3 totals rows,
	// 3px line); drop previously rendered planet rows in between.
	let footerStart = allRows.length - 5;
	for (let r = 1; r < footerStart; r++) {
		// Dispose Bootstrap tooltips before dropping the row so no orphaned
		// instances or lingering tips are left behind.
		allRows[r].querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
			const inst = bootstrap.Tooltip.getInstance(el);
			if (inst) inst.dispose();
		});
		allRows[r].remove();
	}
	let footerFirst = allRows[footerStart];

	let html = '';
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		let tr = '<tr class="' + ((i % 2) === 0 ? 'odd' : 'even') + '">';
		tr += '<td>&nbsp;' + (i + 1) + '&nbsp;</td>';
		tr += '<td>' + options.prm.aPNames[i] + '</td>';
		// температура и позиция
		tr += '<td><input type="text" class="form-control form-control-sm no-mp input-3columns temperature-input centered" value="' + options.prm.aPS[i][0] + '" alt="' + options.maxTempAlt + '"/></td>';
		tr += '<td><input type="text" class="form-control form-control-sm no-mp input-2columns position-input centered" value="' + options.prm.aPS[i][1] + '" alt="' + options.positionAlt + '"/></td>';
		for (let j = 1; j < 8; j++) {
			// заготовка: уровень и нулевое производство
			let inputClass = 'form-control form-control-sm no-mp input-' + (j < 6 ? '2columns centered' : '4columns centered');
			tr += '<td class="centered"><input type="text" class="' + inputClass + '" value="' + options.prm.aPS[i][j * 3] + '"/></td>';
			if (j < 4) {
				tr += '<td class="centered">0</td>';
			}
		}
		tr += '<td class="centered">0</td>'; // коэффициент - тоже заготовка
		tr += '<td><div id="control-' + i + '" class="btn-group">';
		tr += '<button id="control-' + i + '-u" type="button" class="btn btn-outline-secondary btn-sm control-btn control-move-up" data-pln="' + i + '" data-bs-toggle="tooltip" title="' + options.movePlanetUpTitle + '"' + (i === 0 ? ' disabled' : '') + '><i class="bi bi-arrow-up"></i></button>';
		tr += '<button id="control-' + i + '-w" type="button" class="btn btn-outline-secondary btn-sm control-btn control-move-down" data-pln="' + i + '" data-bs-toggle="tooltip" title="' + options.movePlanetDownTitle + '"' + (i === options.prm.currPlanetsCount - 1 ? ' disabled' : '') + '><i class="bi bi-arrow-down"></i></button>';
		tr += '<button id="control-' + i + '-e" type="button" class="btn btn-outline-secondary btn-sm control-btn control-edit" data-pln="' + i + '" data-bs-toggle="tooltip" title="' + options.editPlanetTitle + '"><i class="bi bi-pencil"></i></button>';
		tr += '<button id="control-' + i + '-d" type="button" class="btn btn-outline-secondary btn-sm control-btn control-delete" data-pln="' + i + '" data-bs-toggle="tooltip" title="' + options.deletePlanetTitle + '"><i class="bi bi-x-lg"></i></button>';
		tr += '</div></td>';
		tr += '</tr>';
		html += tr;

		// дополнительная информационная строка
		let spanType = options.prm.showAddInf ? 'visible-span' : 'hidden-span';
		tr = '<tr class="' + ((i % 2) === 0 ? 'odd' : 'even') + '">';
		tr += '<td></td><td><span class="' + spanType + '">' + options.addtnlRowHeader + '</span></td><td colspan="2"><span class="' + spanType + '"></span></td>';
		for (let k = 0; k < 10; k++)
			tr += '<td><span class="' + spanType + '"></span></td>';
		tr += '<td colspan="2"></td>';
		tr += '</tr>';
		html += tr;
	}
	footerFirst.insertAdjacentHTML('beforebegin', html);

	// Skin the freshly created row control buttons with Bootstrap tooltips
	$$('#all-planets-prod [data-bs-toggle="tooltip"]').forEach(function (el) {
		bootstrap.Tooltip.getOrCreateInstance(el);
	});

	// Wire validation + recalc on the freshly created inputs
	let rows = $$('#all-planets-prod tr');
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		let newInputs = rows[i * 2 + 1].querySelectorAll('input[type=text]');
		newInputs.forEach(function (input) {
			bindNumericInput(input, updateAllPlnTab);
		});
		newInputs[0]._constrains = { 'min': -134, 'def': 0, 'allowNegative': true };
		newInputs[1]._constrains = { 'min': 1, 'max': 16, 'def': 8, 'allowNegative': false };
	}
}

let maxTempBlinkCount = 0;
function blinkMaxTemp() {
	if (options.prm.maxTempEntered)
		return;
	let maxTempInput = $('#max-planet-temp');
	if (maxTempBlinkCount++ < 10) {
		setTimeout(function () {
			maxTempInput.classList.toggle('red-border');
			blinkMaxTemp();
		},
			200);
	} else {
		maxTempBlinkCount = 0;
		maxTempInput.classList.remove('red-border');
	}
}

function blinkMaxStorage(storages) {
	var spans = ['#storage-cap-met', '#storage-cap-crys', '#storage-cap-deut'];
	if (options.storageBlinkCount++ < 10) {
		setTimeout(function () {
			for (var i = 0; i < 3; i++) {
				if (storages[i] == 1) {
					$(spans[i]).classList.toggle('red-border');
				} else {
					$(spans[i]).classList.remove('red-border');
				}
			}
			blinkMaxStorage(storages);
		},
			200);
	} else {
		options.storageBlinkCount = 0;
		options.storagesBlinking = false;
		for (var i = 0; i < 3; i++)
			$(spans[i]).classList.remove('red-border');
	}
}

function setOnePlanetView(extended) {
	var rows = $$('#one-planet-prod tr');
	var newMode = extended ? 'table-cell' : 'none';
	for (var row = 0; row < rows.length; row++) {
		if (rows[row].children.length < 8)
			continue;
		rows[row].children[1].style.display = newMode;
		rows[row].children[7].style.display = newMode;
	}
}

function toggleShowAdditionalInfo() {
	options.prm.showAddInf = !options.prm.showAddInf;
	if (options.prm.showAddInf) {
		$$('#all-planets-prod .hidden-span').forEach(function (span) {
			span.classList.replace('hidden-span', 'visible-span');
		});
	} else {
		$$('#all-planets-prod .visible-span').forEach(function (span) {
			span.classList.replace('visible-span', 'hidden-span');
		});
	}
}
