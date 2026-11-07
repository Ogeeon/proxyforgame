// ============================================================================
// MOON CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form state from the DOM into a plain params object the core can
// consume. No DOM mutation happens here.

'use strict';

class MoonDataCollector {
  /**
   * Read every calculator input into a params object shared by both
   * sub-calculators (destruction and creation).
   */
  static readParams() {
    return {
      moonSize: getInputNumber($('#moon-size')),
      dsCount: getInputNumber($('#ds-count')),
      debrisPercent: Number.parseInt(getVal('#debris-percent'), 10) || 0,
      hyperTechLevel: getInputNumber($('#hypertech-lvl')),
      isGeneral: getChecked('#general-class'),
      rcCapacityIncrease: getInputNumber($('#rc-capacity-increase')),
      defenseDebrisPercent: Number.parseInt(getVal('#defense-debris-percent'), 10) || 0,
      deutToDebris: getChecked('#deut-to-debris'),
      promoMoon: getChecked('#promo-moon'),
      supraRefractorLevel: getInputNumber($('#supra-refractor')),
      counts: MoonDataCollector.readCounts(),
      phalanxLevel: getInputNumber($('#phalanx-lvl')),
      phalanxRangeBonus: getInputNumber($('#phalanx-range-bonus')),
      isDiscoverer: getChecked('#discoverer-class'),
      discovererBonus: getInputNumber($('#discoverer-bonus')),
      ownSystem: getInputNumber($('#own-system')),
      targetSystem: getInputNumber($('#target-system')),
      circularSystems: getChecked('#circular-systems'),
      numberOfSystems: getInputNumber($('#systems-num')),
    };
  }

  /**
   * Read the count input of every unit listed in MOON_UNITS. Units missing
   * from the page (should not happen) simply count as zero.
   *
   * @returns {Object} {unitId: number}
   */
  static readCounts() {
    const counts = {};
    MOON_UNITS.forEach((unit) => {
      const el = $('#' + unit.id);
      counts[unit.id] = el ? getInputNumber(el) : 0;
    });
    return counts;
  }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): every field of the three panels - destruction,
// creation, phalanx - next to its factory default. The page has no result
// tabs, so the mode stays empty. reportFieldById() and cleanReportLabel()
// come from sidebar.js.

// The fields under each caption: a panel's title (options.reportText) or a
// parameter tab of the creation panel (its button's id).
/** @type {[string, string[]][]} */
const MOON_REPORT_GROUPS = [
  ['destroy', ['moon-size', 'ds-count']],
  ['param-common-tab', ['hypertech-lvl', 'general-class', 'debris-percent', 'defense-debris-percent',
    'deut-to-debris', 'promo-moon']],
  ['param-lifeforms-tab', ['supra-refractor', 'rc-capacity-increase']],
  ['phalanx', ['phalanx-range-bonus', 'discoverer-class', 'discoverer-bonus', 'own-system',
    'circular-systems', 'systems-num', 'phalanx-lvl', 'target-system']],
];

/**
 * A group's caption: a tab button's text, or a panel title the template
 * inlined.
 * @param {string} key
 * @returns {string}
 */
function moonReportGroup(key) {
  const tab = document.getElementById(key);
  return cleanReportLabel(tab === null ? options.reportText[key] ?? key : tab.textContent ?? '');
}

/**
 * The report hook: every field the results depend on, defaults included.
 * @returns {ReportSnapshot}
 */
function moonReportSnapshot() {
  /** @type {(ReportEntry|null)[]} */
  const entries = [];
  for (const [group, ids] of MOON_REPORT_GROUPS) {
    const caption = moonReportGroup(group);
    for (const id of ids) {
      entries.push(reportFieldById(id, caption));
    }
  }
  // The units sit on the fleet and defence tabs; the tab names the group.
  for (const unit of MOON_UNITS) {
    const pane = document.getElementById(unit.id)?.closest('.tab-pane');
    const caption = pane ? moonReportGroup(`${pane.id}-tab`) : '';
    entries.push(reportFieldById(unit.id, caption, { key: `${unit.id}.qty` }));
  }
  return { mode: [], entries: entries.filter((entry) => entry !== null) };
}

/**
 * The caption of a result cell the template marked, e.g. "Recycling, Metal".
 * @param {string} key - the cell's id
 * @returns {string}
 */
function moonDescribeCell(key) {
  return cleanReportLabel(options.reportCells[key] ?? '');
}

if (typeof window !== 'undefined') {
  Object.assign(window, { MoonDataCollector });
  globalThis.reportSnapshot = moonReportSnapshot;
  globalThis.describeCell = moonDescribeCell;
}
