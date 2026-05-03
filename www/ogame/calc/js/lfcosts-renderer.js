// ============================================================================
// RENDERER — DOM writes only
// ============================================================================

/**
 * Column layout reference (children indices, 0-based):
 *
 * outer=0 data rows:  [hidden, name, levelInput, M, C, D, time, pts, DM]
 *   firstDataCol = 3 → children[3..8]
 *
 * outer=1 data rows:  [hidden, name, fromInput, toInput, M, C, D, time, pts]
 *   firstDataCol = 4 → children[4..8]
 *
 * Subtotals row uses colspan to absorb one column into the label,
 * keeping the data at the same children indices as in data rows.
 *
 * Grand-totals / needed / transport rows use colspan on the label
 * to shift data left by one: children[2]=M, [3]=C, [4]=D, [5]=time, [6]=pts.
 */
class LfRenderer {
    constructor(opts) {
        this.opts = opts;
    }

    // -------------------------------------------------------------------------
    // Row-level rendering
    // -------------------------------------------------------------------------

    /**
     * Write calculation result into a data row.
     * result = { metal, crystal, deut, energy, time, points }
     */
    renderRow(row, outerTab, techID, result) {
        const fdc = outerTab === 1 ? 4 : 3; // firstDataCol
        row.children[fdc    ].innerHTML = this._fmt(result.metal);
        row.children[fdc + 1].innerHTML = this._fmt(result.crystal);
        row.children[fdc + 2].innerHTML = this._fmt(result.deut);
        row.children[fdc + 3].innerHTML = this._fmt(this._msu(result));
        row.children[fdc + 4].innerHTML = this._fmtTime(result.time);
        row.children[fdc + 5].innerHTML = this._fmt(result.points);
        if (outerTab === 0) {
            row.children[fdc + 6].innerHTML = this._fmt(getHalvingCost(techID, result.time));
        }
        if (ENERGY_TECH_IDS.has(techID)) {
            this.renderEnergyTooltip(row, result.energy);
        }
    }

    /** Zero out a data row and reset its level input(s). */
    clearRow(row, outerTab) {
        row.children[2].children[0].value = 0;
        if (outerTab === 1) row.children[3].children[0].value = 0;
        const fdc = outerTab === 1 ? 4 : 3;
        const numCells = outerTab === 0 ? 7 : 6;
        for (let cell = fdc; cell < fdc + numCells; cell++) {
            row.children[cell].innerHTML = (cell === fdc + 4) ? ('0' + this.opts.datetimeS) : '0';
        }
        const techID = Number(row.children[0].innerHTML);
        if (ENERGY_TECH_IDS.has(techID)) this.renderEnergyTooltip(row, 0);
    }

    renderEnergyTooltip(row, energyCost) {
        const hintEl = row.children[1].querySelector('.energy-cost-hint');
        if (!hintEl) return;
        const existing = bootstrap.Tooltip.getInstance(hintEl);
        if (existing) existing.dispose();
        hintEl.setAttribute('title', this.opts.energyCostToBuildLabel + ': ' + this._fmt(energyCost));
        new bootstrap.Tooltip(hintEl); // NOSONAR
    }

    // -------------------------------------------------------------------------
    // Subtotals (per inner tab)
    // -------------------------------------------------------------------------

    /**
     * Write the subtotals row for one inner tab.
     * totals = { metal, crystal, deut, time, points }
     */
    renderSubtotals(outerTab, innerTab, totals) {
        const rows = getTableRows(`#table-${outerTab}-${innerTab}`);
        const row = rows[rows.length - FOOTER_ROWS];
        row.children[2].innerHTML = '';
        row.children[3].innerHTML = '<b>' + this._fmt(totals.metal)   + '</b>';
        row.children[4].innerHTML = '<b>' + this._fmt(totals.crystal) + '</b>';
        row.children[5].innerHTML = '<b>' + this._fmt(totals.deut)    + '</b>';
        row.children[6].innerHTML = '<b>' + this._fmt(this._msu(totals)) + '</b>';
        row.children[7].innerHTML = '<b>' + this._fmtTime(totals.time) + '</b>';
        row.children[8].innerHTML = '<b>' + this._fmt(totals.points)  + '</b>';
    }

    // -------------------------------------------------------------------------
    // Grand totals (shown in every inner tab of an outer tab)
    // -------------------------------------------------------------------------

    /**
     * Write grand-total, needed-resource, and transport rows for one inner tab.
     * grandTotals = { metal, crystal, deut, time, points }
     * availRes    = { metal, crystal, deut }
     * needSC, needLC = already-computed ship counts (integers)
     */
    renderGrandTotals(outerTab, innerTab, grandTotals, availRes, needSC, needLC) {
        const rows = getTableRows(`#table-${outerTab}-${innerTab}`);
        const gtRow = rows[rows.length - 4];

        gtRow.children[2].innerHTML = '<b>' + this._fmt(grandTotals.metal)   + '</b>';
        gtRow.children[3].innerHTML = '<b>' + this._fmt(grandTotals.crystal) + '</b>';
        gtRow.children[4].innerHTML = '<b>' + this._fmt(grandTotals.deut)    + '</b>';
        gtRow.children[5].innerHTML = '<b>' + this._fmt(this._msu(grandTotals)) + '</b>';
        gtRow.children[6].innerHTML = '<b>' + this._fmtTime(grandTotals.time) + '</b>';
        gtRow.children[7].innerHTML = '<b>' + this._fmt(grandTotals.points)  + '</b>';
        if (outerTab === 0) gtRow.children[8].innerHTML = '<b>0</b>';

        const needMet  = Math.max(0, grandTotals.metal   - availRes.metal);
        const needCrys = Math.max(0, grandTotals.crystal - availRes.crystal);
        const needDeut = Math.max(0, grandTotals.deut    - availRes.deut);
        const needRow  = rows[rows.length - 2];
        needRow.children[2].innerHTML = '<b>' + this._fmt(needMet)  + '</b>';
        needRow.children[3].innerHTML = '<b>' + this._fmt(needCrys) + '</b>';
        needRow.children[4].innerHTML = '<b>' + this._fmt(needDeut) + '</b>';

        const tRow = rows[rows.length - 1];
        tRow.children[2].innerHTML = numToOGame(needSC) + ' <abbr data-bs-toggle="tooltip" title="' + this.opts.scFull + '">' + this.opts.scShort + '</abbr>';
        tRow.children[3].innerHTML = numToOGame(needLC) + ' <abbr data-bs-toggle="tooltip" title="' + this.opts.lcFull + '">' + this.opts.lcShort + '</abbr>';
    }

    // -------------------------------------------------------------------------
    // Tooltip init
    // -------------------------------------------------------------------------

    initTooltips(root) {
        (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
            const existing = bootstrap.Tooltip.getInstance(el);
            if (existing) existing.dispose();
            new bootstrap.Tooltip(el); // NOSONAR
        });
    }

    // -------------------------------------------------------------------------
    // Race visibility
    // -------------------------------------------------------------------------

    renderHideNShow(race) {
        for (let outer = 0; outer < 2; outer++) {
            const rows = getTableRows(`#table-${outer}-1`);
            for (let row = 1; row < rows.length - FOOTER_ROWS; row++) {
                const rowID = Number(rows[row].children[0].innerHTML);
                rows[row].style.display = (Math.floor(rowID / 1000) == race) ? '' : 'none';
            }
        }

        const isRocktal = Number(race) === 2;
        ['megalith-level-wrap', 'mrc-level-wrap'].forEach(id => {
            if (isRocktal) show(`#${id}`); else hide(`#${id}`);
        });
    }

    // -------------------------------------------------------------------------
    // Tab 3 rendering
    // -------------------------------------------------------------------------

    /**
     * Rebuild Tab 3 data rows.
     * rowResults = array of { level, result } where result = { metal, crystal, deut, time, points }
     * focusedInputId = id of the resource input that had focus before the rebuild (or null)
     */
    renderTab3Rows(tbl, rowResults, focusedInputId) {
        // Save footer rows, clear body, reattach footer
        const allRows = Array.from(tbl.querySelectorAll('tr'));
        const footer  = allRows.slice(tbl.rows.length - 5);
        footer.forEach(r => r.remove());
        this._clearTableBodyRows(tbl);

        // Insert data rows
        rowResults.forEach(({ level, result }, i) => {
            const rowClass = (i % 2) === 0 ? 'odd' : 'even';
            let rowStr = `<tr class="${rowClass}">`;
            rowStr += `<td align="center">${level}</td>`;
            rowStr += `<td align="center">${this._fmt(result.metal)}</td>`;
            rowStr += `<td align="center">${this._fmt(result.crystal)}</td>`;
            rowStr += `<td align="center">${this._fmt(result.deut)}</td>`;
            rowStr += `<td align="center">${this._fmt(this._msu(result))}</td>`;
            rowStr += `<td align="center">${this._fmtTime(result.time)}</td>`;
            rowStr += `<td align="center">${this._fmt(Math.round(result.points))}</td>`;
            rowStr += '</tr>';
            tbl.tBodies[0].insertAdjacentHTML('beforeend', rowStr);
        });

        footer.forEach(r => tbl.tBodies[0].appendChild(r));

        // Restore focus
        if (focusedInputId) {
            const el = document.getElementById(focusedInputId);
            if (el) el.focus();
        }
    }

    /**
     * Write Tab 3 footer totals.
     * totals  = { metal, crystal, deut, time, points }
     * availRes = { metal, crystal, deut }
     * needSC, needLC = already-computed ship counts (integers)
     */
    renderTab3Totals(tbl, totals, availRes, needSC, needLC) {
        const rows      = tbl.querySelectorAll('tr');
        const totalsRow = rows.length - 4;

        rows[totalsRow].children[1].innerHTML = '<b>' + this._fmt(totals.metal)          + '</b>';
        rows[totalsRow].children[2].innerHTML = '<b>' + this._fmt(totals.crystal)        + '</b>';
        rows[totalsRow].children[3].innerHTML = '<b>' + this._fmt(totals.deut)           + '</b>';
        rows[totalsRow].children[4].innerHTML = '<b>' + this._fmt(this._msu(totals))     + '</b>';
        rows[totalsRow].children[5].innerHTML = '<b>' + this._fmtTime(totals.time)       + '</b>';
        rows[totalsRow].children[6].innerHTML = '<b>' + this._fmt(Math.round(totals.points)) + '</b>';

        const needMet  = Math.max(0, totals.metal   - availRes.metal);
        const needCrys = Math.max(0, totals.crystal - availRes.crystal);
        const needDeut = Math.max(0, totals.deut    - availRes.deut);
        rows[totalsRow + 2].children[1].innerHTML = '<b>' + this._fmt(needMet)  + '</b>';
        rows[totalsRow + 2].children[2].innerHTML = '<b>' + this._fmt(needCrys) + '</b>';
        rows[totalsRow + 2].children[3].innerHTML = '<b>' + this._fmt(needDeut) + '</b>';

        rows[totalsRow + 3].children[1].innerHTML = numToOGame(needSC) + ' <abbr data-bs-toggle="tooltip" title="' + this.opts.scFull + '">' + this.opts.scShort + '</abbr>';
        rows[totalsRow + 3].children[2].innerHTML = numToOGame(needLC) + ' <abbr data-bs-toggle="tooltip" title="' + this.opts.lcFull + '">' + this.opts.lcShort + '</abbr>';
    }

    /** Zero out Tab 3 when techID = 0. */
    renderTab3Empty(tbl) {
        const allRows = Array.from(tbl.querySelectorAll('tr'));
        const footer  = allRows.slice(tbl.rows.length - 5);
        footer.forEach(r => r.remove());
        this._clearTableBodyRows(tbl);
        footer.forEach(r => tbl.tBodies[0].appendChild(r));

        const rows      = tbl.querySelectorAll('tr');
        const totalsRow = rows.length - 4;
        rows[totalsRow].children[1].innerHTML = '<b>0</b>';
        rows[totalsRow].children[2].innerHTML = '<b>0</b>';
        rows[totalsRow].children[3].innerHTML = '<b>0</b>';
        rows[totalsRow].children[4].innerHTML = '<b>0</b>';
        rows[totalsRow].children[5].innerHTML = '<b>' + this._fmtTime(0) + '</b>';
        rows[totalsRow].children[6].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[1].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[2].innerHTML = '<b>0</b>';
        rows[totalsRow + 2].children[3].innerHTML = '<b>0</b>';
        rows[totalsRow + 3].children[1].innerHTML = '0 <abbr data-bs-toggle="tooltip" title="' + this.opts.scFull + '">' + this.opts.scShort + '</abbr>';
        rows[totalsRow + 3].children[2].innerHTML = '0 <abbr data-bs-toggle="tooltip" title="' + this.opts.lcFull + '">' + this.opts.lcShort + '</abbr>';
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    _fmt(num) {
        return ogamizeNum(num, this.opts.unitSuffix);
    }

    _fmtTime(seconds) {
        return timespanToShortenedString(seconds,
            this.opts.datetimeW, this.opts.datetimeD, this.opts.datetimeH,
            this.opts.datetimeM, this.opts.datetimeS, true);
    }

    _msu(cost) {
        return cost.metal + (2 * cost.crystal) + (2 * cost.deut);
    }

    _clearTableBodyRows(tbl) {
        for (let i = tbl.rows.length - 1; i > 0; i--) {
            tbl.rows[i].remove();
        }
    }
}
