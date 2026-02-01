// ============================================================================
// RENDERING LAYER
// ============================================================================

/**
 * Main renderer - displays calculation results in DOM
 * This class bridges the gap between data models and jQuery UI
 */
class Renderer {
  constructor() {
    // Get display settings from options
    this.unitSuffix = options.unitSuffix || '';
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
    
    const rows = $(`#${tableId} tr`);
    const isMultiLevel = tableId.includes('-1-');
    const firstDataCol = isMultiLevel ? 4 : 3;
    
    // Clear all data first
    this._clearTableData(tableId, rows, isMultiLevel);
    
    // Accumulator for totals
    let totals = BuildCost.zero();
    let maxEnergy = 0;
    
    // Render each result
    for (let i = 0; i < results.length; i++) {
      const request = requests[i];
      const result = results[i];
      const rowIndex = this._findRowByTechId(rows, request.techId, request.isMoon);

      if (rowIndex === -1) continue; // Row not found

      const row = rows[rowIndex];

      // Render individual cells
      this._renderRowCost(row, firstDataCol, result, request.techId, isMultiLevel, params);

      // Accumulate totals
      totals = totals.add(result);
      maxEnergy = Math.max(maxEnergy, result.energy);
    }

    // Set max energy (not sum)
    totals.energy = maxEnergy;

    // Render subtotal row (grand totals handled separately by renderGrandTotals)
    this._renderSubtotalRow(tableId, rows, totals, params, isMultiLevel);
  }
  
  /**
   * Render a single row's calculation results
   * @private
   */
  _renderRowCost(row, firstDataCol, result, techId, isMultiLevel, params) {
    // Metal, Crystal, Deuterium
    $(row.children[firstDataCol]).html(this._formatNumber(result.metal, params));
    $(row.children[firstDataCol + 1]).html(this._formatNumber(result.crystal, params));
    $(row.children[firstDataCol + 2]).html(this._formatNumber(result.deuterium, params));

    // Energy
    $(row.children[firstDataCol + 3]).html(this._formatNumber(result.energy, params));

    // Time
    $(row.children[firstDataCol + 4]).html(this._formatTime(result.time));

    // Points
    $(row.children[firstDataCol + 5]).html(this._formatNumber(result.points, params));

    // Dark Matter (only for single-level building/research tabs - not fleet/defense)
    if (!isMultiLevel && techId < 200) {
      const dmCost = getHalvingCost(techId, result.time);
      $(row.children[firstDataCol + 6]).html(this._formatNumber(dmCost, params));
    }
  }
  
  /**
   * Clear all data cells in a table
   * NOTE: Does NOT clear input values - preserves user-entered levels
   * @private
   */
  _clearTableData(tableId, rows, isMultiLevel) {
    const firstDataCol = isMultiLevel ? 4 : 3;
    const numDataCols = isMultiLevel ? 6 : 7;

    // Clear data rows (skip header and footer)
    // Only clear calculated result cells, NOT input cells
    for (let i = 1; i < rows.length - 5; i++) {
      for (let col = 0; col < numDataCols; col++) {
        const cellIndex = firstDataCol + col;
        if (col === 4) {
          // Time cell
          $(rows[i].children[cellIndex]).html('0' + this.datetimeS);
        } else {
          $(rows[i].children[cellIndex]).html('0');
        }
      }

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
    
    for (let i = 1; i < rows.length - 5; i++) {
      const rowTechId = parseInt($(rows[i].children[0]).html());
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
    const subtotalRow = rows.length - 5;
    const transportRow = rows.length - 4;

    // Determine table type for column alignment
    const isBuildingTable = tableId.endsWith('-2') || tableId.endsWith('-3');
    // Fleet and defense tables are tables 5 and 6 in outer tab 0
    const isFleetOrDefenseTable = tableId.endsWith('-5') || tableId.endsWith('-6');

    // Column 2 for subtotal: "Fields taken" sum for buildings, empty for other tables
    if (isBuildingTable) {
      // Calculate sum of building levels for the "Fields taken" column
      let totalLevels = 0;
      for (let i = 1; i < rows.length - 5; i++) {
        const row = rows[i];
        const targetColIdx = isMultiLevel ? 3 : 2;
        const levelInput = $(row.children[targetColIdx]).find('input');
        if (levelInput.length > 0) {
          const level = parseFloat(levelInput.val()) || 0;
          if (level > 0) {
            totalLevels += level;
          }
        }
      }
      $(rows[subtotalRow].children[2]).html(`<b>${totalLevels}</b>`);
    } else {
      // For non-building tables, leave column 2 empty
      $(rows[subtotalRow].children[2]).html('');
    }

    // Subtotals row - data columns start at column 3
    const subtotalStartCol = 3;
    $(rows[subtotalRow].children[subtotalStartCol]).html(`<b>${this._formatNumber(totals.metal, params)}</b>`);
    $(rows[subtotalRow].children[subtotalStartCol + 1]).html(`<b>${this._formatNumber(totals.crystal, params)}</b>`);
    $(rows[subtotalRow].children[subtotalStartCol + 2]).html(`<b>${this._formatNumber(totals.deuterium, params)}</b>`);
    $(rows[subtotalRow].children[subtotalStartCol + 3]).html(`<b>${this._formatNumber(totals.energy, params)}</b>`);
    $(rows[subtotalRow].children[subtotalStartCol + 4]).html(`<b>${this._formatTime(totals.time)}</b>`);
    $(rows[subtotalRow].children[subtotalStartCol + 5]).html(`<b>${this._formatNumber(totals.points, params)}</b>`);

    // DM column (column 9 for single-level tables)
    // For fleet and defense tables, calculate DM cost to halve the total time
    if (!isMultiLevel) {
      if (isFleetOrDefenseTable) {
        // Fleet and defense use techId 1000 for DM halving cost calculation
        const dmCost = getHalvingCost(1000, totals.time);
        $(rows[subtotalRow].children[subtotalStartCol + 6]).html(`<b>${this._formatNumber(dmCost, params)}</b>`);
      } else {
        // For buildings/research, DM column shows individual row costs only
        $(rows[subtotalRow].children[subtotalStartCol + 6]).html('');
      }
    }

    // Transport calculations for subtotal
    const transport = this._calculateTransport(totals.totalResources, params);
    $(rows[transportRow].children[2]).html(
      `${transport.small} <abbr title="${this.scFull}">${this.scShort}</abbr>`
    );
    $(rows[transportRow].children[3]).html(
      `${transport.large} <abbr title="${this.lcFull}">${this.lcShort}</abbr>`
    );
  }
  
  /**
   * Update grand totals across all tables in a tab group
   * @param {number} outerTab - 0 for single-level, 1 for multi-level
   * @param {BuildCost} grandTotal - Combined total from all tables
   * @param {GlobalParams} params - For transport calculation
   */
  renderGrandTotals(outerTab, grandTotal, params) {
    const isMultiLevel = outerTab === 1;
    const tableIds = this._getTableIdsForTab(outerTab);

    tableIds.forEach(tableId => {
      const rows = $(`#${tableId} tr`);
      const grandTotalRow = rows.length - 2;
      const grandTransportRow = rows.length - 1;
      // In grand totals row, we use DOM child indices (not visual columns)
      // The "Grand Total" colspan cell is at child 1, so first data (metal) is at child 2
      // which is nth-child(3) in CSS 1-based indexing
      const startCol = 2;

      // Update grand total row in each table
      $(rows[grandTotalRow].children[startCol]).html(`<b>${this._formatNumber(grandTotal.metal, params)}</b>`);
      $(rows[grandTotalRow].children[startCol + 1]).html(`<b>${this._formatNumber(grandTotal.crystal, params)}</b>`);
      $(rows[grandTotalRow].children[startCol + 2]).html(`<b>${this._formatNumber(grandTotal.deuterium, params)}</b>`);
      $(rows[grandTotalRow].children[startCol + 3]).html(`<b>${this._formatNumber(grandTotal.energy, params)}</b>`);
      $(rows[grandTotalRow].children[startCol + 4]).html(`<b>${this._formatTime(grandTotal.time)}</b>`);
      $(rows[grandTotalRow].children[startCol + 5]).html(`<b>${this._formatNumber(grandTotal.points, params)}</b>`);

      // DM column: Calculate for fleet/defense tables, leave empty for others
      if (!isMultiLevel) {
        // Fleet and defense tables are table-0-5 and table-0-6
        if (tableId === 'table-0-5' || tableId === 'table-0-6') {
          const dmCost = getHalvingCost(1000, grandTotal.time);
          $(rows[grandTotalRow].children[startCol + 6]).html(`<b>${this._formatNumber(dmCost, params)}</b>`);
        } else {
          $(rows[grandTotalRow].children[startCol + 6]).html('');
        }
      }

      // Update grand transport row
      const transport = this._calculateTransport(grandTotal.totalResources, params);
      $(rows[grandTransportRow].children[2]).html(
        `${transport.small} <abbr title="${this.scFull}">${this.scShort}</abbr>`
      );
      $(rows[grandTransportRow].children[3]).html(
        `${transport.large} <abbr title="${this.lcFull}">${this.lcShort}</abbr>`
      );
    });
  }
  
  /**
   * Get all table IDs for a tab group
   * @private
   */
  _getTableIdsForTab(outerTab) {
    if (outerTab === 0) {
      return ['table-0-2', 'table-0-3', 'table-0-4', 'table-0-5', 'table-0-6'];
    } else if (outerTab === 1) {
      return ['table-1-2', 'table-1-3', 'table-1-4'];
    }
    return [];
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
    const { techId, fromLevel, toLevel } = rangeData;
    
    // Determine which table to use
    const isProducer = [1, 2, 3, 4, 12, 212].includes(techId);
    const tableId = isProducer ? 'prods-table' : 'commons-table';
    
    // Show/hide appropriate table
    if (isProducer) {
      $('#prods-table-div').show();
      $('#commons-table-div').hide();
    } else {
      $('#prods-table-div').hide();
      $('#commons-table-div').show();
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

      this._appendRangeRow(tableId, level, result, production, consumption, i, params);

      totals = totals.add(result);
      maxEnergy = Math.max(maxEnergy, result.energy);
      if (production !== null) maxProduction = Math.max(maxProduction, production);
      if (consumption !== null) maxConsumption = Math.max(maxConsumption, consumption);
    }
    
    // Set max energy
    totals.energy = maxEnergy;
    
    // Render totals
    this._renderRangeTotals(tableId, totals, maxProduction, maxConsumption, params, isProducer);
  }
  
  /**
   * Clear range table content
   * @private
   */
  _clearRangeTable(tableId) {
    const table = $(`#${tableId}`)[0];
    const rows = $(`#${tableId} tr`);

    // Remove all data rows (keep header row at index 0 and last 2 footer rows)
    // Any row between header and footer is a data row and should be removed
    for (let i = rows.length - 3; i > 0; i--) {
      $(rows[i]).remove();
    }
  }
  
  /**
   * Append a row to range table
   * @private
   */
  _appendRangeRow(tableId, level, result, production, consumption, index, params) {
    const rowClass = (index % 2) === 0 ? 'odd' : 'even';

    let html = `<tr class="${rowClass}">`;
    html += `<td align="center">${level}</td>`;
    html += `<td align="center">${this._formatNumber(result.metal, params)}</td>`;
    html += `<td align="center">${this._formatNumber(result.crystal, params)}</td>`;
    html += `<td align="center">${this._formatNumber(result.deuterium, params)}</td>`;
    html += `<td align="center">${this._formatNumber(result.energy, params)}</td>`;
    html += `<td align="center">${this._formatTime(result.time)}</td>`;
    html += `<td align="center">${this._formatNumber(result.points, params)}</td>`;

    if (production !== null) {
      html += `<td align="center">${this._formatNumber(production, params)}</td>`;
    }
    if (consumption !== null) {
      html += `<td align="center">${this._formatNumber(consumption, params)}</td>`;
    } else if (production !== null) {
      html += `<td align="center">-</td>`;
    }

    html += `</tr>`;

    // Insert before the totals rows
    const rows = $(`#${tableId} tr`);
    const insertBefore = rows[rows.length - 2];
    $(insertBefore).before(html);
  }
  
  /**
   * Render range table totals
   * @private
   */
  _renderRangeTotals(tableId, totals, maxProduction, maxConsumption, params, isProducer) {
    const rows = $(`#${tableId} tr`);
    const totalsRow = rows.length - 2;
    const transportRow = rows.length - 1;

    // Totals row
    $(rows[totalsRow].children[1]).html(`<b>${this._formatNumber(totals.metal, params)}</b>`);
    $(rows[totalsRow].children[2]).html(`<b>${this._formatNumber(totals.crystal, params)}</b>`);
    $(rows[totalsRow].children[3]).html(`<b>${this._formatNumber(totals.deuterium, params)}</b>`);
    $(rows[totalsRow].children[4]).html(`<b>${this._formatNumber(totals.energy, params)}</b>`);
    $(rows[totalsRow].children[5]).html(`<b>${this._formatTime(totals.time)}</b>`);
    $(rows[totalsRow].children[6]).html(`<b>${this._formatNumber(totals.points, params)}</b>`);

    if (isProducer) {
      $(rows[totalsRow].children[7]).html(`<b>${this._formatNumber(maxProduction, params)}</b>`);
      $(rows[totalsRow].children[8]).html(`<b>${this._formatNumber(maxConsumption, params)}</b>`);
    }

    // Transport row
    const transport = this._calculateTransport(totals.totalResources, params);
    $(rows[transportRow].children[1]).html(
      `${transport.small} <abbr title="${this.scFull}">${this.scShort}</abbr>`
    );
    $(rows[transportRow].children[2]).html(
      `${transport.large} <abbr title="${this.lcFull}">${this.lcShort}</abbr>`
    );
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
    
    $(`#${options.warnindMsgDivId}`).text(message);
    $(`#${options.warnindDivId}`).fadeIn(800, function() {
      setTimeout(function() {
        $(`#${options.warnindDivId}`).fadeOut(800);
      }, 5000);
    });
  }
  
  /**
   * Show validation errors
   * @param {ValidationResult} validation
   */
  showValidationErrors(validation) {
    if (validation.isValid) return;
    
    const message = validation.errors.join('\n');
    alert(message); // Simple alert for now
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Format a number for display
   * @private
   */
  _formatNumber(value, params = null) {
    // Use provided params or fall back to global options
    const useFullNumbers = params?.fullNumbers || options.prm?.fullNumbers || false;

    if (useFullNumbers) {
      return numToOGame(value);
    } else {
      return ogamizeNum(value, this.unitSuffix);
    }
  }
  
  /**
   * Format time for display
   * @private
   */
  _formatTime(seconds) {
    return timespanToShortenedString(
      seconds,
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
    
    // Check what changed
    let hasChanges = false;
    
    // Simple check: if lengths differ, do full render
    if (requests.length !== last.requests.length) {
      this.renderTable(tableId, requests, results, params);
      this.lastRendered[key] = { requests, results, params };
      return;
    }
    
    // TODO: Implement smarter incremental updates
    // For now, just do full render
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
  window.Renderer = Renderer;
  window.BatchRenderer = BatchRenderer;
  window.IncrementalRenderer = IncrementalRenderer;
}
