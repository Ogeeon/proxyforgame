// ============================================================================
// EXPEDITIONS CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads the form state from the DOM into a plain params object the core can
// consume. No DOM mutation happens here.

'use strict';

class ExpeditionsDataCollector {
  /** Read every calculator input into a params object. */
  static readParams() {
    return {
      highTop: Number.parseInt(getVal('#highTop'), 10) || 0,
      playerClass: Number.parseInt(getVal('#player-class'), 10) || 0,
      universeSpeed: Number.parseInt(getVal('#universe-speed'), 10) || 1,
      hyperTechLevel: getInputNumber($('#tech-hyper-level')),
      percentRes: getInputNumber($('#percent-resources')),
      percentShips: getInputNumber($('#percent-ships')),
      classBonusCollector: getInputNumber($('#class-bonus-collector')),
      classBonusDiscoverer: getInputNumber($('#class-bonus-discoverer')),
      darkMatterDiscoveryBonus: getInputNumber($('#dark-matter-discovery-bonus')),
      resourceDiscoveryBooster: Number.parseInt(getVal('#resource-discovery-booster'), 10) || 0,
      lfShipsBonuses: ExpeditionsDataCollector.readShipsBonuses(),
      counts: ExpeditionsDataCollector.readCounts(),
    };
  }

  /**
   * Read the life-form cargo capacity bonus of every ship, in the order of
   * EXPEDITION_SHIPS (the core addresses the array by index).
   *
   * @returns {number[]} One percentage per ship.
   */
  static readShipsBonuses() {
    return EXPEDITION_SHIPS.map((ship) => {
      const el = $('#lf-cargo-' + ship.techId);
      return el ? getInputNumber(el) : 0;
    });
  }

  /**
   * Read the fleet count inputs.
   *
   * @returns {Object} {abbrev: number}
   */
  static readCounts() {
    const counts = {};
    EXPEDITION_SHIPS.forEach((ship) => {
      const el = $('#num' + ship.abbrev);
      counts[ship.abbrev] = el ? getInputNumber(el) : 0;
    });
    return counts;
  }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): every field that feeds the result next to its
// factory default. The page has no result tabs, so the mode stays empty.
// reportEntryOf() and cleanReportLabel() come from sidebar.js.

// The parameters, in the order the panel shows them. All of them feed the
// result whichever parameter tab is open.
const EXPEDITIONS_REPORT_NUMBERS = ['tech-hyper-level', 'percent-resources', 'percent-ships',
  'class-bonus-collector', 'class-bonus-discoverer', 'dark-matter-discovery-bonus'];

// The summary cells the template marks by their role rather than by a ship.
const EXPEDITIONS_REPORT_CELLS = new Set(['expedition-points', 'storage', 'dark-matter']);

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function expeditionsReportText(key) {
  return cleanReportLabel(options.reportText[key] ?? key);
}

/**
 * One field by id as a report entry, or null for a missing one.
 * @param {string} id
 * @param {ReportFieldOptions} opts
 * @returns {ReportEntry|null}
 */
function expeditionsReportField(id, opts) {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? reportEntryOf(el, opts) : null;
}

/**
 * The report hook: every field the result depends on, defaults included.
 * @returns {ReportSnapshot}
 */
function expeditionsReportSnapshot() {
  /** @type {(ReportEntry|null)[]} */
  const entries = [];
  const common = cleanReportLabel(document.getElementById('param-common-tab')?.textContent ?? '');
  const strongest = expeditionsReportField('highTop', { group: common });
  if (strongest !== null) {
    // The template marks the last tier selected, but the page opens on the
    // first one (options.prm.highTop) - that is what a visitor starts from.
    strongest.default = String(EXPEDITIONS_HIGH_TOP_DEFAULT);
  }
  entries.push(strongest,
    expeditionsReportField('player-class', { group: common }),
    expeditionsReportField('universe-speed', { group: common }));
  for (const id of EXPEDITIONS_REPORT_NUMBERS) {
    entries.push(expeditionsReportField(id, { group: common, numeric: true }));
  }
  entries.push(expeditionsReportField('resource-discovery-booster', { group: common }));

  const cargo = cleanReportLabel(document.getElementById('param-lf-tab')?.textContent ?? '');
  for (const ship of EXPEDITION_SHIPS) {
    entries.push(expeditionsReportField(`lf-cargo-${ship.techId}`,
      { key: `${ship.id}.cargo-bonus`, group: cargo, numeric: true }));
  }
  const fleet = expeditionsReportText('fleet');
  for (const ship of EXPEDITION_SHIPS) {
    entries.push(expeditionsReportField(`num${ship.abbrev}`, { key: `${ship.id}.qty`, group: fleet, numeric: true }));
  }
  return { mode: [], entries: entries.filter((entry) => entry !== null) };
}

/**
 * The caption of a result cell the template marked: "<ship>, <column>" for
 * the fleet table, the row's caption for the summary rows below it.
 * @param {string} key - e.g. "small-cargo.found", "res-find.metal", "storage"
 * @returns {string}
 */
function expeditionsDescribeCell(key) {
  if (EXPEDITIONS_REPORT_CELLS.has(key)) {
    return expeditionsReportText(key);
  }
  const dot = key.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  const rowKey = key.slice(0, dot);
  const column = expeditionsReportText(key.slice(dot + 1));
  const ship = EXPEDITION_SHIPS.find((s) => s.id === rowKey);
  const row = ship === undefined
    ? expeditionsReportText(rowKey)
    : cleanReportLabel(document.querySelector(`label[for="num${ship.abbrev}"]`)?.textContent ?? '');
  return row === '' ? column : `${row}, ${column}`;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ExpeditionsDataCollector });
  globalThis.reportSnapshot = expeditionsReportSnapshot;
  globalThis.describeCell = expeditionsDescribeCell;
}
