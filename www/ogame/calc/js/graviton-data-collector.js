// ============================================================================
// GRAVITON CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form/input state from the DOM into a plain params object the core
// can consume. No DOM mutation happens here.

'use strict';

class GravitonDataCollector {
  /**
   * Read every calculator input into a params object.
   * getInputNumber() applies the locale-aware decimal handling, so fractional
   * fields (e.g. the LF energy bonus) survive comma locales unchanged.
   */
  static readParams() {
    const officers = GravitonDataCollector.readOfficers();
    return {
      ...officers,
      energyBonus: GravitonCalculator.officerEnergyBonus(officers),
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
      debrisPercent: getInputNumber($('#debris-percent')),
      playerClass: GravitonDataCollector.readPlayerClass(),
      isTrader: getChecked('#trader-bonus'),
      energyBoost: Number.parseInt(getVal('#energy-boost'), 10) || 0,
      disChLevel: getInputNumber($('#disr-chamber-level')),
      gravitonLevel: getInputNumber($('#graviton-level')),
      totalLFEnrgBonus: getInputNumber($('#total-lf-energy-bonus')),
      collectorClassBonus: getInputNumber($('#lf-collector-class-bonus')),
      scCapacityIncrease: getInputNumber($('#sc-capacity-increase')),
      lcCapacityIncrease: getInputNumber($('#lc-capacity-increase')),
      rcCapacityIncrease: getInputNumber($('#rc-capacity-increase')),
      crysAvailable: getInputNumber($('#crystal-available')),
      deutAvailable: getInputNumber($('#deuterium-available')),
      deutInDebris: getChecked('#deut-in-debris'),
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
// The radio group and the selects are read as they are; the rest are numbers.
/** @type {[string, string[]][]} */
const GRAVITON_REPORT_TABS = [
  ['param-common-tab', ['universe-speed', 'max-planet-temp', 'energy-boost',
    'engineer', 'geologist', 'technocrat', 'admiral', 'commander', 'player-class', 'trader-bonus']],
  ['param-buildings-tab', ['shipyard-level', 'nanites-factory-level']],
  ['param-researches-tab', ['energy-tech-level', 'hyper-tech-level', 'graviton-level']],
  ['param-lifeforms-tab', ['disr-chamber-level', 'total-lf-energy-bonus', 'lf-collector-class-bonus',
    'sc-capacity-increase', 'lc-capacity-increase', 'rc-capacity-increase']],
];
// The power plants under the tabs, and the recycling settings.
const GRAVITON_REPORT_PLANTS = ['solar-plant-level', 'solar-plant-percent', 'fusion-plant-level',
  'fusion-plant-percent', 'solar-satellites-count', 'solar-satellites-percent'];
const GRAVITON_REPORT_RECYCLING = ['debris-percent', 'deut-in-debris'];

/**
 * The report hook: every field the result depends on, defaults included.
 * @returns {ReportSnapshot}
 */
function gravitonReportSnapshot() {
  /** @type {(ReportEntry|null)[]} */
  const entries = [];
  const energy = cleanReportLabel(options.reportText.energy ?? '');
  for (const id of GRAVITON_REPORT_PLANTS) {
    entries.push(reportFieldById(id, energy));
  }
  for (const [tab, ids] of GRAVITON_REPORT_TABS) {
    const group = cleanReportLabel(document.getElementById(tab)?.textContent ?? '');
    for (const id of ids) {
      entries.push(reportFieldById(id, group));
    }
  }
  const recycling = cleanReportLabel(options.reportText.recycling ?? '');
  for (const id of GRAVITON_REPORT_RECYCLING) {
    entries.push(reportFieldById(id, recycling));
  }
  return { mode: [], entries: entries.filter((entry) => entry !== null) };
}

/**
 * The caption of a result cell the template marked, e.g. "Expenses, Crystal".
 * @param {string} key - the cell's id
 * @returns {string}
 */
function gravitonDescribeCell(key) {
  return cleanReportLabel(options.reportCells[key] ?? '');
}

if (typeof window !== 'undefined') {
  Object.assign(window, { GravitonDataCollector });
  globalThis.reportSnapshot = gravitonReportSnapshot;
  globalThis.describeCell = gravitonDescribeCell;
}
