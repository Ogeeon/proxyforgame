// ============================================================================
// TERRAFORMER CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form/input state from the DOM into a plain params object the core
// can consume. No DOM mutation happens here.

'use strict';

class TerraformerDataCollector {
  /**
   * Read every calculator input into a params object.
   * getInputNumber() applies the locale-aware decimal handling, so fractional
   * fields (e.g. the LF energy bonus) survive comma locales unchanged.
   */
  static readParams() {
    const officers = TerraformerDataCollector.readOfficers();
    return {
      ...officers,
      energyBonus: TerraformerCalculator.officerBonusLevel(officers),
      robotsFactoryLevel: getInputNumber($('#robots-factory-level')),
      shipyardLevel: getInputNumber($('#shipyard-level')),
      nanitesFactoryLevel: getInputNumber($('#nanites-factory-level')),
      universeSpeed: Number.parseFloat(getVal('#universe-speed')) || 1,
      energyTechLevel: getInputNumber($('#energy-tech-level')),
      hyperTechLevel: getInputNumber($('#hyper-tech-level')),
      maxPlanetTemp: getInputNumber($('#max-planet-temp')),
      solarPlantLevel: getInputNumber($('#solar-plant-level')),
      solarPlantPercent: Number.parseInt(getVal('#solar-plant-percent'), 10) || 0,
      fusionPlantLevel: getInputNumber($('#fusion-plant-level')),
      fusionPlantPercent: Number.parseInt(getVal('#fusion-plant-percent'), 10) || 0,
      solarSatellitesCount: getInputNumber($('#solar-satellites-count')),
      solarSatellitesPercent: Number.parseInt(getVal('#solar-satellites-percent'), 10) || 0,
      playerClass: TerraformerDataCollector.readPlayerClass(),
      isTrader: getChecked('#trader-bonus'),
      energyBoost: Number.parseInt(getVal('#energy-boost'), 10) || 0,
      disChLevel: getInputNumber($('#disr-chamber-level')),
      totalLFEnrgBonus: getInputNumber($('#total-lf-energy-bonus')),
      collectorClassBonus: getInputNumber($('#lf-collector-class-bonus')),
      lfTerraformerRdc: getInputNumber($('#lf-terraformer-rdc')),
      scCapacityIncrease: getInputNumber($('#sc-capacity-increase')),
      lcCapacityIncrease: getInputNumber($('#lc-capacity-increase')),
      tfSingleLevel: getChecked('#single-level'),
      tfLevelFrom: getInputNumber($('#tf-level-from')),
      tfLevelTo: getInputNumber($('#tf-level-to')),
      crysAvailable: getInputNumber($('#crystal-available')),
      deutAvailable: getInputNumber($('#deuterium-available')),
    };
  }

  /** Read the five officer checkboxes. */
  static readOfficers() {
    return {
      engineer: getChecked('#engineer'),
      geologist: getChecked('#geologist'),
      technocrat: getChecked('#technocrat'),
      admiral: getChecked('#admiral'),
      commander: getChecked('#commander'),
    };
  }

  /**
   * Read the selected player class radio (0 = none, 1 = collector, 2 = general).
   * Falls back to 0 (none) when nothing is checked.
   */
  static readPlayerClass() {
    const checked = checkedRadio('player-class');
    return checked ? (Number.parseInt(checked.value, 10) || 0) : 0;
  }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): every field that feeds the result next to its
// factory default - except the resources available, which the report leaves
// out by design. The page has no result tabs, so the mode stays empty.
// reportFieldById() and cleanReportLabel() come from sidebar.js.

// The fields of each parameter tab, by the tab button that captions them.
/** @type {[string, string[]][]} */
const TERRAFORMER_REPORT_TABS = [
  ['param-common-tab', ['max-planet-temp', 'universe-speed', 'energy-boost',
    'engineer', 'geologist', 'technocrat', 'admiral', 'commander', 'player-class', 'trader-bonus']],
  ['param-buildings-tab', ['robots-factory-level', 'shipyard-level', 'nanites-factory-level']],
  ['param-researches-tab', ['energy-tech-level', 'hyper-tech-level']],
  ['param-lifeforms-tab', ['disr-chamber-level', 'total-lf-energy-bonus', 'lf-terraformer-rdc',
    'lf-collector-class-bonus', 'sc-capacity-increase', 'lc-capacity-increase']],
];
// The power plants under the tabs; the percent selects have no label of
// their own, so they borrow the plant's.
const TERRAFORMER_REPORT_PLANTS = [['solar-plant-level', 'solar-plant-percent'],
  ['fusion-plant-level', 'fusion-plant-percent'], ['solar-satellites-count', 'solar-satellites-percent']];

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function terraformerReportText(key) {
  return cleanReportLabel(options.reportText[key] ?? key);
}

/**
 * The report hook: every field the result depends on, defaults included.
 * @returns {ReportSnapshot}
 */
function terraformerReportSnapshot() {
  /** @type {(ReportEntry|null)[]} */
  const entries = [];
  const energy = terraformerReportText('energy');
  for (const [level, percent] of TERRAFORMER_REPORT_PLANTS) {
    const plant = reportFieldById(level, energy);
    entries.push(plant, reportFieldById(percent, energy, plant ? { label: `${plant.label}, %` } : {}));
  }
  for (const [tab, ids] of TERRAFORMER_REPORT_TABS) {
    const group = cleanReportLabel(document.getElementById(tab)?.textContent ?? '');
    for (const id of ids) {
      entries.push(reportFieldById(id, group));
    }
  }
  // The terraformer's own levels: a range, or with "one level" on only its
  // upper end.
  const terraformer = terraformerReportText('terraformer');
  const levels = terraformerReportText('tf-level');
  entries.push(reportFieldById('single-level', terraformer, { label: terraformerReportText('single-level') }));
  if (!getChecked('#single-level')) {
    entries.push(reportFieldById('tf-level-from', terraformer, { label: `${levels} — ${terraformerReportText('from-level')}` }));
  }
  entries.push(reportFieldById('tf-level-to', terraformer, { label: `${levels} — ${terraformerReportText('to-level')}` }));
  return { mode: [], entries: entries.filter((entry) => entry !== null) };
}

/**
 * The caption of a result cell the template marked, e.g. "Expenses, Crystal".
 * @param {string} key - the cell's id
 * @returns {string}
 */
function terraformerDescribeCell(key) {
  return cleanReportLabel(options.reportCells[key] ?? '');
}

if (typeof window !== 'undefined') {
  Object.assign(window, { TerraformerDataCollector });
  globalThis.reportSnapshot = terraformerReportSnapshot;
  globalThis.describeCell = terraformerDescribeCell;
}
