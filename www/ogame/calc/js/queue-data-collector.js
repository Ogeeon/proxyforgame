// ============================================================================
// QUEUE CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads form/input state from the DOM into plain objects consumable by the
// orchestrator. No DOM mutation here.

'use strict';

class QueueDataCollector {
  /**
   * Read top-level globals (universe speed, ion/hyper tech, total-fields per tab).
   */
  static readGlobalParams() {
    // Every user-entered number goes through getInputNumber: it honours the
    // locale decimal separator, which a bare parseFloat would swallow (RU "5,4"
    // would read as 5). The universe speed is a <select> whose option values are
    // authored with a canonical dot, so it is read straight off the element.
    const num = (selector) => getInputNumber($(selector));
    const universeSpeed = Number.parseFloat(getVal('#universe-speed')) || 1;
    const ionTechLevel = Math.trunc(num('#ion-tech-level'));
    const hyperTechLevel = Math.trunc(num('#hyper-tech-level'));
    const totFldPln = Math.trunc(num('#total-fields-2'));
    const totFldMn = Math.trunc(num('#total-fields-3'));
    const checkedClass = checkedRadio('player-class');
    const playerClass = checkedClass ? Number.parseInt(checkedClass.value, 10) : 0;
    const scCapacityIncrease = num('#sc-capacity-increase');
    const lcCapacityIncrease = num('#lc-capacity-increase');
    return { universeSpeed, ionTechLevel, hyperTechLevel, totFldPln, totFldMn, playerClass, scCapacityIncrease, lcCapacityIncrease };
  }

  /**
   * Read all start-level inputs from a src table, in display order.
   * Returns an array of [techId, level] tuples plus a tech->level map.
   */
  static readStartLevels(tabNum) {
    const rows = getTableRows(`#table-src-${tabNum}`);
    const list = [];
    const byTech = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const idCell = row.cells[0];
      const inputCell = row.cells[2];
      if (!idCell || !inputCell) continue;
      const techId = Number.parseInt(idCell.textContent, 10);
      const input = inputCell.querySelector('input');
      // Levels are whole numbers, but the value still passes through the
      // locale-aware reader so a pasted "1,5" cannot be read as 15.
      const level = input ? Math.trunc(getInputNumber(input)) : 0;
      list.push([techId, level]);
      byTech[techId] = level;
    }
    return { list, byTech };
  }

  /**
   * Read the localized name of a tech as it appears in the src table (used
   * when appending rows to the dst table).
   */
  static readTechNames(tabNum) {
    const rows = getTableRows(`#table-src-${tabNum}`);
    const names = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const idCell = row.cells[0];
      const nameCell = row.cells[1];
      if (!idCell || !nameCell) continue;
      const techId = Number.parseInt(idCell.textContent, 10);
      names[techId] = nameCell.textContent.trim();
    }
    return names;
  }

  /**
   * Read the datetime string from a start-N input. The field is masked by
   * attachInputMask (dom-utils), which keeps the value in the display format,
   * so the raw value is what parseDate expects.
   */
  static readStartDateTime(tabNum) {
    const el = inputEl(`#start-${tabNum}`);
    return el ? el.value : '';
  }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): the open tab - planet or moon - and what its
// queue is computed from: the shared parameters, the tab's field count and
// start moment, the start level of every building, and the queue itself.
// reportFieldById(), reportEntryOf() and cleanReportLabel() come from
// sidebar.js.

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function queueReportText(key) {
  return cleanReportLabel(options.reportText?.[key] ?? key);
}

/**
 * The buildings of a tab's start-level table: tech id to its row.
 * @param {number} tabNum
 * @returns {Map<number, HTMLTableRowElement>}
 */
function queueReportBuildings(tabNum) {
  /** @type {Map<number, HTMLTableRowElement>} */
  const rows = new Map();
  for (const row of document.querySelectorAll(`#table-src-${tabNum} tr[data-report-key]`)) {
    if (row instanceof HTMLTableRowElement) {
      rows.set(Number.parseInt(row.cells[0]?.textContent ?? '', 10), row);
    }
  }
  return rows;
}

/**
 * The queue of a tab, one entry per step: "metal-mine:11", a demolition as
 * "metal-mine:10:demolish". An empty queue is the default, so every step goes.
 * @param {ReportEntry[]} out
 * @param {number} tabNum
 * @param {Map<number, HTMLTableRowElement>} buildings
 */
function queueReportSteps(out, tabNum, buildings) {
  const group = queueReportText('queue');
  const queue = options.prm[tabNum === 3 ? 'qm' : 'qp'] ?? [];
  queue.forEach(([techId, isBuild], i) => {
    const building = buildings.get(Number(techId));
    const slug = building?.dataset.reportKey ?? String(techId);
    const name = cleanReportLabel(building?.cells[1]?.textContent ?? slug);
    const level = cleanReportLabel(document.querySelector(`[data-report-cell="queue-${i + 1}.level"]`)?.textContent ?? '');
    const build = Number(isBuild) === 1;
    out.push({
      key: `queue.${i + 1}`, group, label: `#${i + 1}`,
      value: `${slug}:${level}${build ? '' : ':demolish'}`,
      display: `${name} ${build ? '→' : '↓'} ${level}`,
    });
  });
}

/**
 * The report hook: the open tab and every field its queue depends on,
 * defaults included.
 * @returns {ReportSnapshot}
 */
function queueReportSnapshot() {
  /** @type {ReportModePart[]} */
  const mode = [];
  /** @type {ReportEntry[]} */
  const entries = [];
  /** @param {ReportEntry|null} entry */
  const push = (entry) => {
    if (entry !== null) {
      entries.push(entry);
    }
  };
  const tab = document.querySelector('#mainTabs .nav-link.active');
  if (tab !== null) {
    mode.push({ key: tab.id, label: cleanReportLabel(tab.textContent ?? '') });
  }

  const parameters = queueReportText('parameters');
  push(reportFieldById('universe-speed', parameters));
  push(reportFieldById('ion-tech-level', parameters));
  push(reportFieldById('hyper-tech-level', parameters));
  push(reportFieldById('player-class', parameters));
  const cargo = queueReportText('cargo-cap-increase');
  push(reportFieldById('sc-capacity-increase', parameters, { label: `${cargo} — ${options.scFull}` }));
  push(reportFieldById('lc-capacity-increase', parameters, { label: `${cargo} — ${options.lcFull}` }));

  const tabNum = tab?.id === 'tabtag-3' ? 3 : 2;
  const buildingsGroup = queueReportText('buildings');
  const fields = reportFieldById(`total-fields-${tabNum}`, buildingsGroup);
  if (fields !== null) {
    // The template holds 0; a fresh page shows the default field count.
    fields.default = tabNum === 3 ? options.defMnFlds : options.defPlfFlds;
    entries.push(fields);
  }
  const buildings = queueReportBuildings(tabNum);
  for (const row of buildings.values()) {
    const input = row.querySelector('input');
    if (input instanceof HTMLInputElement) {
      entries.push(reportEntryOf(input, {
        key: `${row.dataset.reportKey}.level`, group: buildingsGroup, numeric: true,
        label: `${cleanReportLabel(row.cells[1]?.textContent ?? '')} — ${queueReportText('start-level')}`,
      }));
    }
  }
  push(reportFieldById(`start-${tabNum}`, queueReportText('queue'), { key: 'start' }));
  queueReportSteps(entries, tabNum, buildings);
  return { mode, entries };
}

/**
 * The caption of a result cell the renderer marked: "<row>, <column>", the
 * row being a queue step with its building, the total or the transports.
 * @param {string} key - e.g. "queue-2.metal", "total.time", "finish"
 * @returns {string}
 */
function queueDescribeCell(key) {
  const dot = key.lastIndexOf('.');
  if (dot < 0) {
    return queueReportText(key);
  }
  const rowKey = key.slice(0, dot);
  const column = queueReportText(key.slice(dot + 1));
  const step = /^queue-(\d+)$/.exec(rowKey);
  const building = document.querySelector(`#mainTabContent tr[data-report-key="${CSS.escape(rowKey)}"]`);
  let row = queueReportText(rowKey);
  if (step !== null) {
    const name = document.querySelector(`[data-report-cell="${CSS.escape(key)}"]`)?.closest('tr')?.cells[0]?.textContent ?? '';
    row = `${queueReportText('queue')} #${step[1]} (${cleanReportLabel(name)})`;
  } else if (building instanceof HTMLTableRowElement) {
    row = cleanReportLabel(building.cells[1]?.textContent ?? rowKey);
  }
  return `${row}, ${column}`;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { QueueDataCollector });
  globalThis.reportSnapshot = queueReportSnapshot;
  globalThis.describeCell = queueDescribeCell;
}
