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
 * Read a <select> value by selector.
 * @param {string} selector
 * @returns {string}
 */
function selectValue(selector) {
	return /** @type {HTMLSelectElement} */ ($(selector)).value;
}

/**
 * Read the general settings panel (techs, speed, officers, class, trader).
 */
function collectGeneralSettings() {
	let playerClass = 0;
	if (getChecked('#class-2')) {
		playerClass = 2;
	} else if (getChecked('#class-1')) {
		playerClass = 1;
	}

	return {
		universeSpeed: selectValue('#universe-speed'),
		energyTechLevel: getInputNumber($('#energy-tech-level')),
		plasmaTechLevel: getInputNumber($('#plasma-tech-level')),
		engineer: getChecked('#engineer'),
		geologist: getChecked('#geologist'),
		technocrat: getChecked('#technocrat'),
		admiral: getChecked('#admiral'),
		commander: getChecked('#commander'),
		playerClass: playerClass,
		isTrader: getChecked('#is-trader'),
		energyBoost: selectValue('#energy-boost'),
		lfMetProdBonus: getInputNumber($('#lf-metal-prod-bonus')),
		lfCrysProdBonus: getInputNumber($('#lf-crystal-prod-bonus')),
		lfDeutProdBonus: getInputNumber($('#lf-deut-prod-bonus')),
		lfEnergyProdBonus: getInputNumber($('#lf-energy-prod-bonus')),
		lfCollectorBonus: getInputNumber($('#lf-collector-bonus')),
		lfCrawlerBonus: getInputNumber($('#lf-crawler-bonus')),
		lfPlasmaCostReduction: getInputNumber($('#lf-plasma-cost-reduction')),
		lfResLevels: collectLfResearchLevels(),
		lfResAvail: options.lfResIds.map(function (id) { return getChecked('#lf-res-avail-' + id); }),
		lfTechBonus: getInputNumber($('#lf-tech-bonus')),
		lfResearchCostReduction: getInputNumber($('#lf-research-cost-reduction'))
	};
}

/**
 * Read the life form research levels of the parameters panel, in the order of
 * options.lfResIds - the order options.prm.lfResLevels is stored in.
 * @returns {number[]}
 */
function collectLfResearchLevels() {
	return options.lfResIds.map(function (id) {
		return getInputNumber($('#lf-res-' + id));
	});
}

/**
 * Read the one-planet production table into a params array:
 * [Level/Count, PowerFactor, Booster] per building row.
 * @param {ArrayLike<HTMLElement>} rows - all tr of #one-planet-prod
 */
function collectOnePlanetParams(rows) {
	//            Met. mine Crys. mine  Deut. syn  Sol.plant  Fus.plant  Sol.sat.   Crawler
	/** @type {number[][]} */
	let params = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
	for (let i = 2; i < 9; i++) {
		params[i - 2][0] = getInputNumber(rows[i].children[2].children[0]);
		// These two used to stay strings. production-core only ever divides or
		// multiplies them, so the arithmetic was identical - but the array is
		// declared as numbers and the values are select options that always
		// carry a numeric value, so parse them here.
		params[i - 2][1] = Number.parseFloat(cellSelect(rows[i], 7).value);
		if (i > 4) { // Power plants, satellites and Crawlers have no boosters
			params[i - 2][2] = 0.0;
		} else {
			params[i - 2][2] = Number.parseFloat(cellSelect(rows[i], 1).value);
		}
	}
	return params;
}

/**
 * Read the exchange rates inputs, substituting the defaults for zeroes. Like in
 * the cost calculators, the rates are MSU weights normalized to metal: 1:1.5:3
 * means one crystal is worth 1.5 metal and one deuterium is worth 3 metal.
 */
function collectExchangeRates() {
	let rates = [];
	rates[0] = getInputNumber($('#exchange-rates-m')) || 1;
	rates[1] = getInputNumber($('#exchange-rates-c')) || 1.5;
	rates[2] = getInputNumber($('#exchange-rates-d')) || 3;
	return rates;
}

/**
 * Per-resource MSU multipliers [metal, crystal, deuterium] derived from the
 * exchange rates, so that metal always costs 1.
 */
function collectResourceMultipliers() {
	let rates = collectExchangeRates();
	return [1, rates[1] / rates[0], rates[2] / rates[0]];
}

/**
 * Sync options.prm.aPS with the all-planets table inputs (in case of direct
 * editing of a row).
 * @param {ArrayLike<HTMLElement>} rows - all tr of #all-planets-prod
 */
function collectAllPlanetsInputs(rows) {
	for (let i = 0; i < options.prm.currPlanetsCount; i++) {
		options.prm.aPS[i][0] = getInputNumber(rows[i * 2 + 1].children[2].children[0]);
		options.prm.aPS[i][1] = getInputNumber(rows[i * 2 + 1].children[3].children[0]);
		for (let j = 1; j < 8; j++) {
			options.prm.aPS[i][j * 3] = getInputNumber(rows[i * 2 + 1].children[LEVEL_COLUMNS[j - 1]].children[0]);
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
	let lfEff = lfBuildingEffects(options.prm.aPS[i][24] || 0, options.prm.aPS[i].slice(25, 37), options.lfTables);
	return { prodParams: prodParams, plnData: plnData, lfEff: lfEff };
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): the open tab, and every field that feeds its
// result next to its factory default - except the resources currently on the
// planets, which the report leaves out like every resources-available field.
// reportFieldById(), reportEntryOf() and cleanReportLabel() come from
// sidebar.js.

// The seven producers of a planet, in the order of the one-planet table and
// of the mine slots of a stored planet (production-core.js, mineSlot()).
const PRODUCTION_REPORT_PRODUCERS = ['metal-mine', 'crystal-mine', 'deut-synth', 'solar-plant',
	'fusion-reactor', 'solar-sat', 'crawler'];
// What the three slots of a producer hold, in a stored planet.
const PRODUCTION_REPORT_SLOT_FIELDS = ['level', 'percent', 'booster'];

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function productionReportText(key) {
	return cleanReportLabel(options.reportText?.[key] ?? key);
}

/**
 * The caption of a tab button, '' for a missing one.
 * @param {string} id
 * @returns {string}
 */
function productionTabLabel(id) {
	return cleanReportLabel(document.getElementById(id)?.textContent ?? '');
}

/**
 * Collects the report's entries.
 */
class ProductionReportEntries {
	constructor() {
		/** @type {ReportEntry[]} */
		this.entries = [];
	}

	/**
	 * @param {string} id - a field id, or the name of a radio group
	 * @param {string} group
	 * @param {ReportFieldOptions} [opts]
	 * @returns {ReportEntry|null} the entry added
	 */
	add(id, group, opts = {}) {
		const entry = reportFieldById(id, group, opts);
		if (entry !== null) {
			this.entries.push(entry);
		}
		return entry;
	}

	/**
	 * Days, hours and minutes of an accumulation period as one entry.
	 * @param {string} prefix - 'onepln' or 'allpln'
	 * @param {string} group
	 */
	addPeriod(prefix, group) {
		const parts = ['d', 'h', 'm'].map((unit) => getInputNumber($(`#${prefix}-accumwhat-${unit}`)));
		this.entries.push({
			key: `${prefix}-accumwhat`, group, label: productionReportText('accumulate-what'),
			value: parts.join(':'), default: '0:0:0',
			display: parts.map((n, i) => `${n}${productionReportText(['d', 'h', 'm'][i])}`).join(' '),
		});
	}

	/**
	 * The resource amounts the accumulation waits for.
	 * @param {string} prefix - 'onepln' or 'allpln'
	 * @param {string} group
	 */
	addTargets(prefix, group) {
		const caption = productionReportText('accumulate-when');
		for (const [suffix, resource] of [['met', 'metal'], ['crys', 'crystal'], ['deut', 'deuterium']]) {
			this.add(`${prefix}-accumwhen-${suffix}`, group, { label: `${caption} — ${productionReportText(resource)}` });
		}
	}
}

/**
 * The parameter panel: all three of its tabs, the hidden ones included.
 * @param {ProductionReportEntries} out
 */
function productionReportParameters(out) {
	const general = productionTabLabel('param-general-tab');
	for (const id of ['engineer', 'geologist', 'technocrat', 'admiral', 'commander', 'class', 'is-trader', 'universe-speed']) {
		out.add(id, general);
	}
	const rates = productionReportText('exchange-rates');
	for (const [suffix, resource] of [['m', 'metal'], ['c', 'crystal'], ['d', 'deuterium']]) {
		out.add(`exchange-rates-${suffix}`, general, { label: `${rates} — ${productionReportText(resource)}` });
	}
	const researches = productionTabLabel('param-researches-tab');
	out.add('energy-tech-level', researches);
	out.add('plasma-tech-level', researches);

	const lifeforms = productionTabLabel('param-lifeforms-tab');
	const increase = productionReportText('lf-prod-increase');
	for (const [id, resource] of [['lf-metal-prod-bonus', 'metal'], ['lf-crystal-prod-bonus', 'crystal'],
		['lf-deut-prod-bonus', 'deuterium'], ['lf-energy-prod-bonus', 'energy']]) {
		out.add(id, lifeforms, { label: `${increase} — ${productionReportText(resource)}` });
	}
	for (const id of ['lf-collector-bonus', 'lf-crawler-bonus', 'lf-plasma-cost-reduction', 'lf-tech-bonus',
		'lf-research-cost-reduction']) {
		out.add(id, lifeforms);
	}
	for (const id of options.lfResIds) {
		const available = out.add(`lf-res-avail-${id}`, lifeforms);
		if (available !== null) {
			available.label = `${available.label} — ${productionReportText('available')}`;
		}
		out.add(`lf-res-${id}`, lifeforms);
	}
}

/**
 * The one-planet tab: the planet's settings, the producers' levels and
 * factors, the life form buildings of its race, and the accordion inputs.
 * @param {ProductionReportEntries} out
 * @param {string} group
 */
function productionReportOnePlanet(out, group) {
	out.add('max-planet-temp', group);
	const position = out.add('planet-pos', group);
	if (position !== null) {
		// A fresh page sets the position to 8 (resetParams), not the template's 0.
		position.default = 8;
	}
	out.add('energy-boost', group);
	out.add('one-pln-race', group);
	const qty = productionReportText('qty-header');
	const boosted = productionReportText('boosted');
	for (const row of document.querySelectorAll('#one-planet-prod tr[data-report-key]')) {
		if (!(row instanceof HTMLTableRowElement) || row.style.display === 'none') {
			continue;
		}
		const slug = row.dataset.reportKey ?? '';
		const name = cleanReportLabel(row.cells[0]?.textContent ?? slug);
		const input = row.querySelector('input');
		if (input instanceof HTMLInputElement) {
			out.entries.push(reportEntryOf(input, { key: `${slug}.level`, group, numeric: true, label: `${name} — ${qty}` }));
		}
		const selects = row.querySelectorAll('select');
		selects.forEach((select, i) => {
			const isBooster = i === 0 && selects.length > 1;
			out.entries.push(reportEntryOf(select, {
				key: `${slug}.${isBooster ? 'booster' : 'percent'}`, group,
				label: `${name} — ${isBooster ? boosted : '%'}`,
			}));
		});
	}
	const amortization = productionReportText('mines-amortization');
	const satellites = out.add('include-SS', amortization, { label: amortization });
	if (satellites !== null) {
		// Without a saved choice the page checks "no" (options.prm.inclSats).
		satellites.default = '1';
	}
	const accumulation = productionReportText('resources-accumulation');
	const storage = productionReportText('storage-level');
	for (const [suffix, resource] of [['met', 'metal'], ['crys', 'crystal'], ['deut', 'deuterium']]) {
		out.add(`storage-${suffix}`, accumulation, { label: `${storage} — ${productionReportText(resource)}` });
	}
	out.addPeriod('onepln', accumulation);
	out.addTargets('onepln', accumulation);
}

/**
 * One stored planet of the all-planets tab: every slot that differs from an
 * empty planet - the hidden ones the edit dialog sets included.
 * @param {ProductionReportEntries} out
 * @param {number} i
 */
function productionReportPlanet(out, i) {
	const planet = options.prm.aPS[i] ?? [];
	const empty = createEmptyPlanet();
	const group = cleanReportLabel(options.prm.aPNames[i] ?? `${options.planetNumStr}${i + 1}`);
	const key = `planet-${i + 1}`;
	/**
	 * @param {number} slot
	 * @param {string} field
	 * @param {string} label
	 */
	const push = (slot, field, label) => {
		out.entries.push({ key: `${key}.${field}`, group, label, value: Number(planet[slot] ?? 0), default: Number(empty[slot] ?? 0) });
	};
	push(PLANET_TEMP, 'max-planet-temp', productionReportText('max-planet-temp'));
	push(PLANET_POS, 'planet-pos', productionReportText('planet-pos'));
	push(PLANET_ENERGY_BOOST, 'energy-boost', productionReportText('energy-boost'));
	PRODUCTION_REPORT_PRODUCERS.forEach((slug, j) => {
		const name = cleanReportLabel(document.querySelector(`#one-planet-prod tr[data-report-key="${slug}"]`)?.querySelector('td')?.textContent ?? slug);
		PRODUCTION_REPORT_SLOT_FIELDS.forEach((field, k) => {
			push(mineSlot(j + 1) + k, `${slug}.${field}`, `${name} — ${productionReportText(field)}`);
		});
	});
	const race = Number(planet[PLANET_RACE] ?? 0);
	push(PLANET_RACE, 'race', productionReportText('race'));
	const raceName = document.querySelector(`#one-pln-race option[value="${race}"]`)?.textContent;
	const raceEntry = out.entries.at(-1);
	if (raceName && raceEntry) {
		raceEntry.display = cleanReportLabel(raceName);
	}
	for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) {
		const input = document.querySelector(`#one-planet-prod .lf-row-${race} input[data-lf-id="${race * 1000 + k + 1}"]`);
		if (input !== null) {
			const slug = input.closest('tr')?.dataset.reportKey ?? String(k + 1);
			push(PLANET_LF_LEVELS + k, `${slug}.level`, cleanReportLabel(input.getAttribute('aria-label') ?? slug));
		}
	}
}

/**
 * The report hook: the open tab and every field the result there depends
 * on, defaults included.
 * @returns {ReportSnapshot}
 */
function productionReportSnapshot() {
	/** @type {ReportModePart[]} */
	const mode = [];
	const tab = document.querySelector('#mainTabs .nav-link.active');
	if (tab !== null) {
		mode.push({ key: tab.id, label: cleanReportLabel(tab.textContent ?? '') });
	}
	const out = new ProductionReportEntries();
	if (tab?.id === 'tabtag2') {
		const planets = out.add('planetsSpin', mode[0].label);
		if (planets !== null) {
			planets.default = options.defPlanetsCount;
		}
		for (let i = 0; i < options.prm.currPlanetsCount; i++) {
			productionReportPlanet(out, i);
		}
		const accumulation = productionReportText('resources-accumulation');
		out.addPeriod('allpln', accumulation);
		out.addTargets('allpln', accumulation);
	} else if (tab !== null) {
		productionReportOnePlanet(out, mode[0].label);
	}
	productionReportParameters(out);
	return { mode, entries: out.entries };
}

/**
 * The caption of a result cell the page marked: "<row>, <column>", the row
 * being a producer, a summary row, a planet or an accordion's row.
 * @param {string} key - e.g. "metal-mine.metal", "prod-per-day.crystal", "planet-2.metal"
 * @returns {string}
 */
function productionDescribeCell(key) {
	const dot = key.lastIndexOf('.');
	if (dot < 0) {
		return productionReportText(key);
	}
	const rowKey = key.slice(0, dot);
	const column = productionReportText(key.slice(dot + 1));
	const planet = /^planet-(\d+)$/.exec(rowKey);
	const ranked = /^(priority|lf-amort)-(\d+)$/.exec(rowKey);
	let row = '';
	if (ranked !== null) {
		// A row of a ranked upgrade list, rebuilt on every recalculation: its
		// rank alone says nothing, so the planet, object and level travel along.
		const cell = document.querySelector(`[data-report-cell="${CSS.escape(key)}"]`);
		// Columns 1-3: the planet, the object and its "level → level + 1".
		const [where = '', object = '', level = ''] = [...(cell?.closest('tr')?.cells ?? [])]
			.slice(1, 4).map((td) => cleanReportLabel(td.textContent));
		const what = [where, `${object} ${level}`.trim()].filter((text) => text !== '').join(', ');
		row = `${productionReportText(ranked[1])} #${ranked[2]}` + (what === '' ? '' : ` (${what})`);
	} else if (planet === null) {
		const cell = document.querySelector(`[data-report-cell="${CSS.escape(key)}"]`);
		row = cleanReportLabel(cell?.closest('tr')?.querySelector('td, th')?.textContent ?? '') || productionReportText(rowKey);
	} else {
		const i = Number(planet[1]) - 1;
		row = cleanReportLabel(options.prm.aPNames[i] ?? `${options.planetNumStr}${i + 1}`);
	}
	return row === '' ? column : `${row}, ${column}`;
}

if (typeof window !== 'undefined') {
	globalThis.reportSnapshot = productionReportSnapshot;
	globalThis.describeCell = productionDescribeCell;
}
