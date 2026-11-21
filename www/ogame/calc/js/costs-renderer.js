// ============================================================================
// RENDERING LAYER
// ============================================================================

// The calculation-error report names a result cell by its row and column: a
// cell is marked data-report-cell="<row>.<column>", e.g. "metal-mine.metal" or
// "grand-total.metal", and describeCell() turns that into a caption. Each
// table's columns come from costsTableLayout() or COSTS_RANGE_TABLES; this
// default names the resources, all the "resources needed" rows carry.
const REPORT_COLUMNS = Object.freeze(['metal', 'crystal', 'deuterium']);

/**
 * Marks `count` consecutive result cells of a row for the report dialog.
 * @param {HTMLTableRowElement} row
 * @param {number} firstCol - index of the row's metal cell
 * @param {string|undefined} rowKey - the row's name; nothing is marked without one
 * @param {number} count
 * @param {readonly string[]} [columns]
 */
function markReportCells(row, firstCol, rowKey, count, columns = REPORT_COLUMNS) {
  if (!rowKey) {
    return;
  }
  for (let i = 0; i < count; i++) {
    const cell = row.cells[firstCol + i];
    if (cell) {
      cell.dataset.reportCell = `${rowKey}.${columns[i]}`;
    }
  }
}

/**
 * Main renderer - displays calculation results in DOM
 * This class bridges the gap between data models and jQuery UI
 */
class Renderer {
  constructor() {
    // Get display settings from options
    this.unitSuffix = options.unitSuffix || '';
    this.datetimeY = options.datetimeY || 'y';
    this.datetimeMo = options.datetimeMo || 'mo';
    this.datetimeW = options.datetimeW || 'w';
    this.datetimeD = options.datetimeD || 'd';
    this.datetimeH = options.datetimeH || 'h';
    this.datetimeM = options.datetimeM || 'm';
    this.datetimeS = options.datetimeS || 's';
    this.scShort = options.scShort || 'SC';
    this.lcShort = options.lcShort || 'LC';
    this.scFull = options.scFull || 'Small Cargo';
    this.lcFull = options.lcFull || 'Large Cargo';
  }

  // ==========================================================================
  // TABLE RENDERING
  // ==========================================================================

  /**
   * Render calculation results for a complete table
   * @param {string} tableId - Table element ID
   * @param {BuildRequest[]} requests - Build requests
   * @param {BuildCost[]} results - Calculation results (same order as requests)
   * @param {GlobalParams} params - Global parameters (for transport calc)
   */
  renderTable(tableId, requests, results, params) {
    if (requests.length !== results.length) {
      console.error('Requests and results length mismatch');
      return;
    }

    const rows = getTableRows(`#${tableId}`);
    const layout = costsTableLayout(tableId);
    const { isMultiLevel } = layout;

    // Clear all data first
    this._clearTableData(tableId, rows);
    // The effect follows the level entered, whether or not anything is built
    this.renderEffects(tableId);

    // Accumulator for totals
    let totals = BuildCost.zero();
    let maxEnergy = 0;

    // Group results by techId before rendering (for multi-level calculations)
    const groupedResults = new Map();

    // Accumulate totals and group results
    for (let i = 0; i < results.length; i++) {
      const request = requests[i];
      const result = results[i];
      const key = `${request.techId}-${request.isMoon ? 'moon' : 'planet'}`;

      if (!groupedResults.has(key)) {
        groupedResults.set(key, BuildCost.zero());
      }

      // Sum results for the same techId (multi-level case)
      groupedResults.set(key, groupedResults.get(key).add(result));

      // Accumulate totals
      totals = totals.add(result);
      maxEnergy = Math.max(maxEnergy, result.energy);
    }

    // Render grouped results
    groupedResults.forEach((summedResult, key) => {
      const [techId, type] = key.split('-');
      const isMoon = type === 'moon';
      const rowIndex = this._findRowByTechId(rows, Number(techId), isMoon);

      if (rowIndex === -1) return; // Row not found

      const row = rows[rowIndex];

      // Render the summed result
      this._renderRowCost(row, layout, summedResult, Number(techId), params);
    });

    // Set max energy (not sum)
    totals.energy = maxEnergy;

    // Render subtotal row (grand totals handled separately by renderGrandTotals)
    this._renderSubtotalRow(tableId, rows, totals, params, isMultiLevel);
  }

  /**
   * The content of one result cell. The Dark Matter column is not a sum, so
   * it has no value here: the callers fill it themselves.
   * @private
   * @param {string} column - a column of costsTableLayout() or costsRangeColumns()
   * @param {BuildCost} cost
   * @param {GlobalParams} params
   * @returns {string}
   */
  _resultCell(column, cost, params) {
    switch (column) {
      case 'metal': return this._formatNumber(cost.metal, params);
      case 'crystal': return this._formatNumber(cost.crystal, params);
      case 'deuterium': return this._formatNumber(cost.deuterium, params);
      case 'msu': return this._formatNumber(cost.msu(params.rates), params);
      case 'energy': return this._formatNumber(cost.energy, params);
      case 'time': return this._formatTime(cost.time);
      case 'points': return this._formatNumber(cost.points, params);
      default: return '';
    }
  }

  /**
   * Render a single row's calculation results
   * @private
   * @param {HTMLTableRowElement} row
   * @param {ReturnType<typeof costsTableLayout>} layout
   * @param {BuildCost} result
   * @param {number} techId
   * @param {GlobalParams} params
   */
  _renderRowCost(row, layout, result, techId, params) {
    const { firstDataCol, resultColumns } = layout;
    // Dark Matter only for buildings and researches - a ship or defence row leaves it alone
    const columns = techId < 200 ? resultColumns : resultColumns.filter(column => column !== 'dm');
    columns.forEach((column, i) => {
      row.cells[firstDataCol + i].innerHTML = column === 'dm'
        ? this._formatNumber(Calculator.halvingCost(techId, result.time, params), params)
        : this._resultCell(column, result, params);
    });
    markReportCells(row, firstDataCol, row.dataset.reportKey, columns.length, columns);
  }

  /**
   * Clear all data cells in a table
   * NOTE: Does NOT clear input values - preserves user-entered levels
   * @private
   */
  _clearTableData(tableId, rows) {
    const { firstDataCol, resultColumns } = costsTableLayout(tableId);

    // Clear data rows (skip header and footer)
    // Only clear calculated result cells, NOT input cells
    for (let i = 1; i < rows.length - 6; i++) {
      resultColumns.forEach((column, col) => {
        rows[i].cells[firstDataCol + col].innerHTML = column === 'time' ? '00:00:00' : '0';
      });

      // DO NOT clear input values - preserve user-entered levels
      // Input cells are at column 2 (and 3 for multi-level)
      // We only reset them if the calculation shows no valid request
    }
  }

  /**
   * Find row index by tech ID
   * @private
   */
  _findRowByTechId(rows, techId, isMoon) {
    // Moon buildings have +10000 in table
    const searchId = isMoon ? techId + 10000 : techId;

    for (let i = 1; i < rows.length - 6; i++) {
      const rowTechId = Number.parseInt(rows[i].cells[0].innerHTML);
      if (rowTechId === searchId) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Render subtotal row for a single table
   * @private
   */
  _renderSubtotalRow(tableId, rows, totals, params, isMultiLevel) {
    const subtotalRow = rows.length - 6;

    const { isBuildingTable, subtotalStartCol, resultColumns } = costsTableLayout(tableId);
    const isFleetOrDefenseTable = tableId.endsWith('-5') || tableId.endsWith('-6');

    // Column 2: sum of building levels for planet and moon buildings, empty otherwise
    // (the Control Centre components' levels are not added up)
    rows[subtotalRow].cells[2].innerHTML = isBuildingTable
      ? `<b>${this._sumBuildingLevels(rows, isMultiLevel)}</b>`
      : '';

    // Subtotals row - data columns start at column 3, or 4 past a quantity or effect column
    resultColumns.forEach((column, i) => {
      const cell = rows[subtotalRow].cells[subtotalStartCol + i];
      if (column === 'dm') {
        this._renderSubtotalDmCell(cell, isFleetOrDefenseTable, totals, params);
      } else {
        cell.innerHTML = `<b>${this._resultCell(column, totals, params)}</b>`;
      }
    });
    // Only the fleet and defence tables sum a Dark Matter cost
    const marked = isFleetOrDefenseTable ? resultColumns : resultColumns.filter(column => column !== 'dm');
    markReportCells(rows[subtotalRow], subtotalStartCol, 'total', marked.length, marked);
  }

  /**
   * Sum the input levels of all building rows in a table
   * @private
   */
  _sumBuildingLevels(rows, isMultiLevel) {
    const targetColIdx = isMultiLevel ? 3 : 2;
    let totalLevels = 0;
    for (let i = 1; i < rows.length - 6; i++) {
      const levelInput = rows[i].cells[targetColIdx].querySelector('input');
      if (levelInput) {
        // Locale-aware read: the field may hold a comma decimal separator
        const level = getInputNumber(levelInput);
        if (level > 0) {
          totalLevels += level;
        }
      }
    }
    return totalLevels;
  }

  /**
   * Render DM cost cell in the subtotal row
   * @private
   */
  _renderSubtotalDmCell(cell, isFleetOrDefenseTable, totals, params) {
    if (isFleetOrDefenseTable) {
      const dmCost = Calculator.halvingCost(1000, totals.time, params);
      cell.innerHTML = `<b>${this._formatNumber(dmCost, params)}</b>`;
    } else {
      cell.innerHTML = '';
    }
  }

  /**
   * Update grand totals across all tables in a tab group
   * @param {number} outerTab - 0 for single-level, 1 for multi-level
   * @param {BuildCost} grandTotal - Combined total from all tables
   * @param {GlobalParams} params - For transport calculation
   */
  renderGrandTotals(outerTab, grandTotal, params) {
    const tableIds = this._getTableIdsForTab(outerTab);

    tableIds.forEach(tableId => {
      const rows = getTableRows(`#${tableId}`);
      const grandTotalRow = rows.length - 4;
      const { resultColumns } = costsTableLayout(tableId);
      // In grand totals row, we use DOM child indices (not visual columns)
      // The "Grand Total" colspan cell is at child 1, so first data (metal) is at child 2
      // which is nth-child(3) in CSS 1-based indexing
      const startCol = 2;

      // Update grand total row in each table; the Control Centre's has no energy,
      // and the Dark Matter cell stays empty everywhere
      resultColumns.forEach((column, i) => {
        rows[grandTotalRow].cells[startCol + i].innerHTML =
          column === 'dm' ? '' : `<b>${this._resultCell(column, grandTotal, params)}</b>`;
      });
      const marked = resultColumns.filter(column => column !== 'dm');
      markReportCells(rows[grandTotalRow], startCol, 'grand-total', marked.length, marked);

      // Update res-needed and delivery transport rows (grand total minus available resources)
      const [, tabOuter, tabInner] = tableId.split('-');
      const resNeededRow = rows.length - 2;
      const deliveryTransportRow = rows.length - 1;
      const metal = getInputNumber(document.getElementById(`metal-available-${tabOuter}-${tabInner}`));
      const crystal = getInputNumber(document.getElementById(`crystal-available-${tabOuter}-${tabInner}`));
      const deut = getInputNumber(document.getElementById(`deut-available-${tabOuter}-${tabInner}`));
      const needMetal = Math.max(0, grandTotal.metal - metal);
      const needCrystal = Math.max(0, grandTotal.crystal - crystal);
      const needDeut = Math.max(0, grandTotal.deuterium - deut);
      rows[resNeededRow].cells[2].innerHTML = this._formatNumber(needMetal, params);
      rows[resNeededRow].cells[3].innerHTML = this._formatNumber(needCrystal, params);
      rows[resNeededRow].cells[4].innerHTML = this._formatNumber(needDeut, params);
      markReportCells(rows[resNeededRow], 2, 'res-needed', 3);
      const delivery = this._calculateTransport(needMetal + needCrystal + needDeut, params);
      disposeTooltips(rows[deliveryTransportRow]);
      rows[deliveryTransportRow].cells[2].innerHTML =
        `${delivery.small} <abbr data-bs-toggle="tooltip" title="${this.scFull}">${this.scShort}</abbr>`;
      rows[deliveryTransportRow].cells[3].innerHTML =
        `${delivery.large} <abbr data-bs-toggle="tooltip" title="${this.lcFull}">${this.lcShort}</abbr>`;
      attachTooltips(rows[deliveryTransportRow], { refresh: true });
    });
  }

  /**
   * Get all table IDs for a tab group.
   * Protected rather than private: BatchRenderer calls it from a subclass.
   * @protected
   */
  _getTableIdsForTab(outerTab) {
    return [...(COSTS_TAB_TABLES[outerTab] ?? [])];
  }

  /**
   * Fill the effect column of the Control Centre table from the levels entered:
   * the level on the single-level tab, the target level on the several-levels
   * one. Any other table has no effect column and is left alone.
   * @param {string} tableId
   */
  renderEffects(tableId) {
    const { hasEffectCol, isMultiLevel } = costsTableLayout(tableId);
    if (!hasEffectCol) {
      return;
    }
    for (const cell of document.querySelectorAll(`#${tableId} td.ias-effect`)) {
      if (cell instanceof HTMLTableCellElement) {
        cell.innerHTML = Renderer.formatEffect(Renderer._cellEffect(cell, isMultiLevel));
      }
    }
  }

  /**
   * The effect an effect cell shows: the component's effect at the level its
   * row holds, or null (a dash) while the effect is not known.
   * @param {HTMLTableCellElement} cell
   * @param {boolean} isMultiLevel the several-levels tab: the level is the target
   * @returns {number|null}
   * @private
   */
  static _cellEffect(cell, isMultiLevel) {
    const perLevel = cell.dataset.effect ? Number(cell.dataset.effect) : null;
    const row = cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement : null;
    const input = row?.cells[isMultiLevel ? 3 : 2]?.querySelector('input');
    const level = input ? getInputNumber(input) : 0;
    // A component cannot be demolished, so a target not above the start has no effect to show
    const fromInput = isMultiLevel ? row?.cells[2]?.querySelector('input') : null;
    if (fromInput && level <= getInputNumber(fromInput)) {
      return null;
    }
    return componentEffect(perLevel, level);
  }

  /**
   * An effect in percent as the table shows it, without a sign: "0.25 %",
   * "0 %" at level 0, and a dash while the effect is not known.
   * @param {number|null} percent
   * @returns {string}
   */
  static formatEffect(percent) {
    if (percent === null) {
      return '—';
    }
    return `${localizeFloat(Math.abs(percent))}&nbsp;%`;
  }

  // ==========================================================================
  // RANGE TAB RENDERING
  // ==========================================================================

  /**
   * Render range calculation table (tab 3)
   * @param {Object} rangeData - Range data from collector
   * @param {BuildCost[]} results - Results for each level
   * @param {Object} productions - Production rates {level: rate}
   * @param {Object} consumptions - Consumption rates {level: rate}
   * @param {GlobalParams} params - For transport calculation
   */
  renderRangeTable(rangeData, results, productions, consumptions, params) {
    const { techId, fromLevel, isComponent, effectPerLevel } = rangeData;

    // Determine which table to use, and show only that one
    const table = costsRangeTable(techId, isComponent);
    const tableId = table.id;
    for (const { id } of COSTS_RANGE_TABLES) {
      if (id === tableId) {
        show(`#${id}-div`);
      } else {
        hide(`#${id}-div`);
      }
    }

    // Clear and rebuild table
    this._clearRangeTable(tableId);

    // Accumulate totals
    let totals = BuildCost.zero();
    let maxEnergy = 0;
    let maxProduction = 0;
    let maxConsumption = 0;

    // Render each level
    for (let i = 0; i < results.length; i++) {
      const level = fromLevel + i + 1;
      const result = results[i];

      const production = productions ? productions[level] : null;
      const consumption = consumptions ? consumptions[level] : null;

      const effect = Renderer.formatEffect(componentEffect(effectPerLevel ?? null, level));
      this._appendRangeRow(table, { level, effect, result, production, consumption }, i, params);

      totals = totals.add(result);
      maxEnergy = Math.max(maxEnergy, result.energy);
      if (production !== null) maxProduction = Math.max(maxProduction, production);
      if (consumption !== null) maxConsumption = Math.max(maxConsumption, consumption);
    }

    // Set max energy
    totals.energy = maxEnergy;

    // Render totals
    this._renderRangeTotals(table, totals, maxProduction, maxConsumption, params);
  }

  /**
   * Show/hide producer-only range controls based on tech type
   * @param {number} techId
   */
  updateRangeControlVisibility(techId) {
    const isProducer = COSTS_PRODUCERS.includes(techId);
    ['#range-booster-wrap', '#range-producer-row', '#range-officers-row'].forEach(sel => {
      if (isProducer) {
        removeClass(sel, 'd-none');
      } else {
        addClass(sel, 'd-none');
      }
    });
  }

  /**
   * Clear range table content
   * @private
   */
  _clearRangeTable(tableId) {
    const rows = getTableRows(`#${tableId}`);

    // Remove all data rows (keep header row at index 0 and last 4 footer rows:
    // totals, available, needed, transport)
    for (let i = rows.length - 5; i > 0; i--) {
      rows[i].remove();
    }
  }

  /**
   * Append a row to range table
   * @private
   */
  /**
   * Append a row to range table
   * @private
   * @param {CostsRangeTable} table
   * @param {{level: number, effect: string, result: BuildCost, production: number|null,
   *   consumption: number|null}} row - the level, its effect as shown, cost and rates
   * @param {number} index
   * @param {GlobalParams} params
   */
  _appendRangeRow(table, row, index, params) {
    const { level, effect, result, production, consumption } = row;
    const rowClass = (index % 2) === 0 ? 'odd' : 'even';
    /** @type {Record<string, () => string>} */
    const special = {
      level: () => String(level),
      effect: () => effect,
      production: () => (production === null ? '-' : this._formatNumber(production, params)),
      // Solar plant and satellite produce without consuming
      consumption: () => (consumption === null ? '-' : this._formatNumber(consumption, params)),
    };
    const cells = table.columns.map(column => special[column]?.() ?? this._resultCell(column, result, params));
    const cellsHtml = cells.map(cell => `<td align="center">${cell}</td>`).join('');
    const html = `<tr class="${rowClass}">${cellsHtml}</tr>`;

    // Insert before the totals row (4th from the end)
    const rows = getTableRows(`#${table.id}`);
    const insertBefore = rows.at(-4);
    insertBefore.insertAdjacentHTML('beforebegin', html);
    const added = insertBefore.previousElementSibling;
    if (added instanceof HTMLTableRowElement) {
      // The report names the results; a missing consumption has nothing to name
      const first = table.columns.indexOf('metal');
      const named = table.columns.slice(first).filter(column => column !== 'consumption' || consumption !== null);
      markReportCells(added, first, `level-${level}`, named.length, named);
    }
  }

  /**
   * Render range table totals
   * @private
   * @param {CostsRangeTable} table
   * @param {BuildCost} totals
   * @param {number} maxProduction
   * @param {number} maxConsumption
   * @param {GlobalParams} params
   */
  _renderRangeTotals(table, totals, maxProduction, maxConsumption, params) {
    const rows = getTableRows(`#${table.id}`);
    const totalsRow = rows.length - 4;
    const neededRow = rows.length - 2;
    const transportRow = rows.length - 1;

    // Totals row: the label covers the columns before metal, then one cell per result
    const results = table.columns.slice(table.columns.indexOf('metal'));
    results.forEach((column, i) => {
      let value;
      if (column === 'production') {
        value = this._formatNumber(maxProduction, params);
      } else if (column === 'consumption') {
        value = this._formatNumber(maxConsumption, params);
      } else {
        value = this._resultCell(column, totals, params);
      }
      rows[totalsRow].cells[1 + i].innerHTML = `<b>${value}</b>`;
    });
    markReportCells(rows[totalsRow], 1, 'total', results.length, results);

    // Read available resources from input fields
    const { prefix } = table;
    const metalAvail = getInputNumber(document.getElementById(`${prefix}-metal-available`)) || 0;
    const crystalAvail = getInputNumber(document.getElementById(`${prefix}-crystal-available`)) || 0;
    const deutAvail = getInputNumber(document.getElementById(`${prefix}-deut-available`)) || 0;

    const needMetal = Math.max(0, totals.metal - metalAvail);
    const needCrystal = Math.max(0, totals.crystal - crystalAvail);
    const needDeut = Math.max(0, totals.deuterium - deutAvail);

    // Needed row
    rows[neededRow].cells[1].innerHTML = this._formatNumber(needMetal, params);
    rows[neededRow].cells[2].innerHTML = this._formatNumber(needCrystal, params);
    rows[neededRow].cells[3].innerHTML = this._formatNumber(needDeut, params);
    markReportCells(rows[neededRow], 1, 'res-needed', 3);

    // Transport row (based on needed resources, not total)
    const transport = this._calculateTransport(needMetal + needCrystal + needDeut, params);
    disposeTooltips(rows[transportRow]);
    rows[transportRow].cells[1].innerHTML =
      `${transport.small} <abbr data-bs-toggle="tooltip" title="${this.scFull}">${this.scShort}</abbr>`;
    rows[transportRow].cells[2].innerHTML =
      `${transport.large} <abbr data-bs-toggle="tooltip" title="${this.lcFull}">${this.lcShort}</abbr>`;
    attachTooltips(rows[transportRow], { refresh: true });
  }

  // ==========================================================================
  // ERROR AND MESSAGE RENDERING
  // ==========================================================================

  /**
   * Show error message for impossible research
   * @param {string} researchName - Name of the research
   */
  showResearchImpossibleError(researchName) {
    if (!options.warnindDivId || !options.msgCantResearch) {
      return; // No error display configured
    }

    const message = options.msgCantResearch.replace('{0}', researchName);

    setTextContent(`#${options.warnindMsgDivId}`, message);
    fadeIn(`#${options.warnindDivId}`, 800, function () {
      setTimeout(function () {
        fadeOut(`#${options.warnindDivId}`, 800);
      }, 5000);
    });
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Format a number for display
   * @param {number} value
   * @param {?GlobalParams} [params] - omitted where the caller has none; the
   *        page options then decide the format
   * @private
   */
  _formatNumber(value, params = null) {
    // Use provided params or fall back to global options
    const useFullNumbers = params?.fullNumbers || options.prm?.fullNumbers || false;

    if (useFullNumbers) {
      return numToLocal(value);
    } else {
      return numToDisplay(value, this.unitSuffix);
    }
  }

  /**
   * Format time for display
   * @private
   */
  _formatTime(seconds) {
    return timespanToShortenedString(
      seconds,
      this.datetimeY,
      this.datetimeMo,
      this.datetimeW,
      this.datetimeD,
      this.datetimeH,
      this.datetimeM,
      this.datetimeS,
      true
    );
  }

  /**
   * Calculate transport ships needed
   * @private
   */
  _calculateTransport(totalResources, params) {
    const smallCargo = Math.ceil(totalResources / params.smallCargoCapacity);
    const largeCargo = Math.ceil(totalResources / params.largeCargoCapacity);

    return {
      small: this._formatNumber(smallCargo, params),
      large: this._formatNumber(largeCargo, params)
    };
  }
}

// ============================================================================
// SPECIALIZED RENDERERS
// ============================================================================

/**
 * Batch renderer - optimized for rendering multiple tables at once
 */
class BatchRenderer extends Renderer {
  /**
   * Render all tables in a tab group
   * @param {number} outerTab - 0 or 1
   * @param {Object} allRequests - Map of tableId to requests
   * @param {Object} allResults - Map of tableId to results
   * @param {GlobalParams} params
   */
  renderAllTables(outerTab, allRequests, allResults, params) {
    const tableIds = this._getTableIdsForTab(outerTab);
    let grandTotal = BuildCost.zero();
    let maxGrandEnergy = 0;

    // Render each table
    tableIds.forEach(tableId => {
      const requests = allRequests[tableId] || [];
      const results = allResults[tableId] || [];

      if (requests.length > 0) {
        this.renderTable(tableId, requests, results, params);

        // Accumulate grand totals
        results.forEach(result => {
          grandTotal = grandTotal.add(result);
          maxGrandEnergy = Math.max(maxGrandEnergy, result.energy);
        });
      }
    });

    // Set max energy
    grandTotal.energy = maxGrandEnergy;

    // Update grand totals across all tables
    this.renderGrandTotals(outerTab, grandTotal, params);
  }
}

/**
 * Incremental renderer - only updates changed cells
 */
class IncrementalRenderer extends Renderer {
  constructor() {
    super();
    this.lastRendered = {};
  }

  /**
   * Render only what changed
   * @param {string} tableId
   * @param {BuildRequest[]} requests
   * @param {BuildCost[]} results
   * @param {GlobalParams} params
   */
  renderIncremental(tableId, requests, results, params) {
    const key = tableId;
    const last = this.lastRendered[key];

    if (!last) {
      // First render - do full render
      this.renderTable(tableId, requests, results, params);
      this.lastRendered[key] = { requests, results, params };
      return;
    }

    // Simple check: if lengths differ, do full render
    if (requests.length !== last.requests.length) {
      this.renderTable(tableId, requests, results, params);
      this.lastRendered[key] = { requests, results, params };
      return;
    }

    this.renderTable(tableId, requests, results, params);
    this.lastRendered[key] = { requests, results, params };
  }

  /**
   * Clear cache
   */
  reset() {
    this.lastRendered = {};
  }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

if (typeof window !== 'undefined') {
  // Cast for the same reason as in costs-core.js: class declarations live in
  // the script's lexical scope, not as globalThis properties.
  const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));
  g.Renderer = Renderer;
  g.BatchRenderer = BatchRenderer;
  g.IncrementalRenderer = IncrementalRenderer;
}
