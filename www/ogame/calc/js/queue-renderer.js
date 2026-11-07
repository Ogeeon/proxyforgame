// ============================================================================
// QUEUE CALCULATOR - RENDERER
// ============================================================================
// Writes computed state to the DOM (next-level spans, queue rows, totals,
// transports, finish moment, theme-aware row coloring).

'use strict';

// The result columns of a queue step and of the totals row, in display order,
// as the calculation-error report names them.
const QUEUE_REPORT_STEP_COLUMNS = ['level', 'metal', 'crystal', 'deuterium', 'time'];
const QUEUE_REPORT_TOTAL_COLUMNS = ['fields', 'metal', 'crystal', 'deuterium', 'time'];

class QueueRenderer {
  /**
   * Format a duration in seconds using locale-aware suffixes from `options`.
   */
  static formatTime(seconds) {
    return timespanToShortenedString(
      seconds,
      options.datetimeW,
      options.datetimeD,
      options.datetimeH,
      options.datetimeM,
      options.datetimeS,
      true
    );
  }

  static formatNumber(value) {
    return numberToShortenedString(value, options.unitSuffix);
  }

  /**
   * Pick the row text colour based on whether fields overflow.
   * Overflowing (invalid) rows are flagged 'brown'; valid rows return an
   * empty string so they inherit the theme's default text colour.
   */
  static rowFontColor(fieldsOverflow) {
    return fieldsOverflow ? 'brown' : '';
  }

  /**
   * Update the "next level" hint next to a building in the src table.
   */
  static setNextLevel(tabNum, techId, nextLevel) {
    setTextContent(`#nextlvl-${tabNum}-${techId}`, String(nextLevel));
  }

  /**
   * Remove all queue rows from the dst table, leaving the totals/transports
   * footer rows intact (last 2 rows).
   */
  static clearQueueRows(tabNum) {
    const tbl = tableEl(`#table-dst-${tabNum}`);
    if (!tbl) return;
    while (tbl.rows.length > 3) {
      // Dispose Bootstrap tooltips before dropping the row so no orphaned
      // instances or lingering tips are left behind.
      disposeTooltips(tbl.rows[1]);
      tbl.deleteRow(1);
    }
  }

  /**
   * Append a single queue row to the dst table, just above the footer rows.
   * Returns the inserted <tr> element.
   */
  static appendQueueRow(tabNum, rowIndex, techName, resultLevel, costs, isDestroy, fontColor) {
    const tbl = tableEl(`#table-dst-${tabNum}`);
    if (!tbl) return null;

    // The last 2 rows are the totals + transports footer; insert before them.
    const insertBefore = tbl.rows.length - 2;
    const tr = tbl.insertRow(insertBefore);
    tr.className = (rowIndex % 2 === 0) ? 'odd' : 'even';

    const colorOpen = fontColor ? `<font color="${fontColor}">` : '';
    const colorClose = fontColor ? '</font>' : '';
    const arrow = isDestroy ? ' (&darr;)' : '';

    tr.innerHTML =
      `<td>${colorOpen}${techName}${arrow}${colorClose}</td>` +
      `<td align="center">${colorOpen}${resultLevel}${colorClose}</td>` +
      `<td align="center">${colorOpen}${QueueRenderer.formatNumber(costs[0])}${colorClose}</td>` +
      `<td align="center">${colorOpen}${QueueRenderer.formatNumber(costs[1])}${colorClose}</td>` +
      `<td align="center">${colorOpen}${QueueRenderer.formatNumber(costs[2])}${colorClose}</td>` +
      `<td align="center">${colorOpen}${QueueRenderer.formatTime(costs[3])}${colorClose}</td>` +
      `<td>` +
        `<div class="btn-group btn-group-sm" role="group">` +
          `<button id="control-${tabNum}-${rowIndex}-a" type="button" class="btn btn-outline-secondary queue-row-up" data-tab="${tabNum}" data-row="${rowIndex}" data-bs-toggle="tooltip" title="${options.moveUpTitle || ''}"><i class="bi bi-arrow-up"></i></button>` +
          `<button id="control-${tabNum}-${rowIndex}-b" type="button" class="btn btn-outline-secondary queue-row-down" data-tab="${tabNum}" data-row="${rowIndex}" data-bs-toggle="tooltip" title="${options.moveDownTitle || ''}"><i class="bi bi-arrow-down"></i></button>` +
          `<button id="control-${tabNum}-${rowIndex}-c" type="button" class="btn btn-outline-danger queue-row-del" data-tab="${tabNum}" data-row="${rowIndex}" data-bs-toggle="tooltip" title="${options.removeRowTitle || ''}"><i class="bi bi-x"></i></button>` +
        `</div>` +
      `</td>`;

    QueueRenderer.markReportCells(tr, 1, `queue-${rowIndex + 1}`, QUEUE_REPORT_STEP_COLUMNS);

    // Skin the freshly created row control buttons with Bootstrap tooltips.
    attachTooltips(tr);
    return tr;
  }

  /**
   * Marks consecutive result cells of a row for the calculation-error report:
   * data-report-cell="<row>.<column>", which queueDescribeCell() captions.
   * @param {HTMLTableRowElement} row
   * @param {number} firstCol - index of the first marked cell
   * @param {string} rowKey
   * @param {string[]} columns
   */
  static markReportCells(row, firstCol, rowKey, columns) {
    columns.forEach((column, i) => {
      const cell = row.cells[firstCol + i];
      if (cell) {
        cell.dataset.reportCell = `${rowKey}.${column}`;
      }
    });
  }

  /**
   * Update the totals footer row.
   * @param {number} tabNum
   * @param {number[]} totals  [fields, metal, crystal, deut, time]
   * @param {number} totalFlds
   * @param {string} fontColor
   */
  static updateTotals(tabNum, totals, totalFlds, fontColor) {
    const tbl = tableEl(`#table-dst-${tabNum}`);
    if (!tbl) return;
    const totalsRow = tbl.rows[tbl.rows.length - 2];
    if (!totalsRow) return;
    const cells = totalsRow.cells;
    cells[1].innerHTML = fontColor
      ? `<font color="${fontColor}"><b>${totals[0]}/${totalFlds}</b></font>`
      : `<b>${totals[0]}/${totalFlds}</b>`;
    cells[2].innerHTML = `<b>${QueueRenderer.formatNumber(totals[1])}</b>`;
    cells[3].innerHTML = `<b>${QueueRenderer.formatNumber(totals[2])}</b>`;
    cells[4].innerHTML = `<b>${QueueRenderer.formatNumber(totals[3])}</b>`;
    cells[5].innerHTML = `<b>${QueueRenderer.formatTime(totals[4])}</b>`;
    QueueRenderer.markReportCells(totalsRow, 1, 'total', QUEUE_REPORT_TOTAL_COLUMNS);
  }

  /**
   * Update the transports-needed row (SC + LC counts based on hypertech,
   * Collector class and cargo capacity increase, held by shipHold).
   */
  static updateTransports(tabNum, totals, hyperTechLevel, playerClass, scCapacityIncrease, lcCapacityIncrease) {
    const tbl = tableEl(`#table-dst-${tabNum}`);
    if (!tbl) return;
    const transportsRow = tbl.rows[tbl.rows.length - 1];
    if (!transportsRow) return;
    const totalRes = totals[1] + totals[2] + totals[3];
    const classBonus = playerClass === 0 ? HOLD_CLASS_BONUS.COLLECTOR : 0;
    const capSC = shipHold(5000, { hyperTechLevel, classBonus, lfBonus: scCapacityIncrease });
    const capLC = shipHold(25000, { hyperTechLevel, classBonus, lfBonus: lcCapacityIncrease });
    const needSC = Math.ceil(totalRes / capSC) || 0;
    const needLC = Math.ceil(totalRes / capLC) || 0;
    const cells = transportsRow.cells;
    // Dispose first: the innerHTML assignments below detach the current <abbr>
    // anchors, and a tooltip disposed after that would leave its bubble on
    // screen with nothing to point at (this row is rewritten on every keystroke).
    disposeTooltips(transportsRow);
    cells[1].innerHTML = `${numToOGame(needSC)} <abbr data-bs-toggle="tooltip" title="${options.scFull}">${options.scShort}</abbr>`;
    cells[2].innerHTML = `${numToOGame(needLC)} <abbr data-bs-toggle="tooltip" title="${options.lcFull}">${options.lcShort}</abbr>`;
    QueueRenderer.markReportCells(transportsRow, 1, 'transports', ['sc', 'lc']);
    // Skin the transport abbreviations with Bootstrap tooltips.
    attachTooltips(transportsRow);
  }

  /**
   * Set the finish-moment label.
   */
  static setFinishMoment(tabNum, text) {
    setTextContent(`#finish-moment-${tabNum}`, text);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { QueueRenderer });
}
