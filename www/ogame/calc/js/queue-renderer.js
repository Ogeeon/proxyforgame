// ============================================================================
// QUEUE CALCULATOR - RENDERER
// ============================================================================
// Writes computed state to the DOM (next-level spans, queue rows, totals,
// transports, finish moment, theme-aware row coloring).

'use strict';

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
   * Pick the row text colour based on theme cookie + whether fields overflow.
   */
  static rowFontColor(fieldsOverflow) {
    if (fieldsOverflow) return 'brown';
    const theme = { value: 'light', validate: (k, v) => v };
    loadFromCookie('theme', theme);
    return theme.value === 'light' ? 'black' : 'white';
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
    const tbl = $(`#table-dst-${tabNum}`);
    if (!tbl) return;
    while (tbl.rows.length > 3) {
      tbl.deleteRow(1);
    }
  }

  /**
   * Append a single queue row to the dst table, just above the footer rows.
   * Returns the inserted <tr> element.
   */
  static appendQueueRow(tabNum, rowIndex, techName, resultLevel, costs, isDestroy, fontColor) {
    const tbl = $(`#table-dst-${tabNum}`);
    if (!tbl) return null;

    // The last 2 rows are the totals + transports footer; insert before them.
    const insertBefore = tbl.rows.length - 2;
    const tr = tbl.insertRow(insertBefore);
    tr.className = (rowIndex % 2 === 0) ? 'odd' : 'even';

    const colorOpen = `<font color="${fontColor}">`;
    const colorClose = '</font>';
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
          `<button type="button" class="btn btn-outline-secondary queue-row-up" data-tab="${tabNum}" data-row="${rowIndex}" title="${options.moveUpTitle || ''}"><i class="bi bi-arrow-up"></i></button>` +
          `<button type="button" class="btn btn-outline-secondary queue-row-down" data-tab="${tabNum}" data-row="${rowIndex}" title="${options.moveDownTitle || ''}"><i class="bi bi-arrow-down"></i></button>` +
          `<button type="button" class="btn btn-outline-danger queue-row-del" data-tab="${tabNum}" data-row="${rowIndex}" title="${options.removeRowTitle || ''}"><i class="bi bi-x"></i></button>` +
        `</div>` +
      `</td>`;
    return tr;
  }

  /**
   * Update the totals footer row.
   * @param {number} tabNum
   * @param {number[]} totals  [fields, metal, crystal, deut, time]
   * @param {number} totalFlds
   * @param {string} fontColor
   */
  static updateTotals(tabNum, totals, totalFlds, fontColor) {
    const tbl = $(`#table-dst-${tabNum}`);
    if (!tbl) return;
    const totalsRow = tbl.rows[tbl.rows.length - 2];
    if (!totalsRow) return;
    const cells = totalsRow.cells;
    cells[1].innerHTML = `<font color="${fontColor}"><b>${totals[0]}/${totalFlds}</b></font>`;
    cells[2].innerHTML = `<b>${QueueRenderer.formatNumber(totals[1])}</b>`;
    cells[3].innerHTML = `<b>${QueueRenderer.formatNumber(totals[2])}</b>`;
    cells[4].innerHTML = `<b>${QueueRenderer.formatNumber(totals[3])}</b>`;
    cells[5].innerHTML = `<b>${QueueRenderer.formatTime(totals[4])}</b>`;
  }

  /**
   * Update the transports-needed row (SC + LC counts based on hypertech,
   * Collector class and cargo capacity increase — matches the Trade/Costs calculators).
   */
  static updateTransports(tabNum, totals, hyperTechLevel, playerClass, scCapacityIncrease, lcCapacityIncrease) {
    const tbl = $(`#table-dst-${tabNum}`);
    if (!tbl) return;
    const transportsRow = tbl.rows[tbl.rows.length - 1];
    if (!transportsRow) return;
    const totalRes = totals[1] + totals[2] + totals[3];
    const capSC = 5000.0 * (1 + 0.05 * hyperTechLevel) + (playerClass === 0 ? 5000 * 0.25 : 0) + Math.floor(5000 * 0.01 * scCapacityIncrease);
    const capLC = 25000.0 * (1 + 0.05 * hyperTechLevel) + (playerClass === 0 ? 25000 * 0.25 : 0) + Math.floor(25000 * 0.01 * lcCapacityIncrease);
    const needSC = Math.ceil(totalRes / capSC) || 0;
    const needLC = Math.ceil(totalRes / capLC) || 0;
    const cells = transportsRow.cells;
    cells[1].innerHTML = `${numToOGame(needSC)} <abbr title="${options.scFull}">${options.scShort}</abbr>`;
    cells[2].innerHTML = `${numToOGame(needLC)} <abbr title="${options.lcFull}">${options.lcShort}</abbr>`;
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
