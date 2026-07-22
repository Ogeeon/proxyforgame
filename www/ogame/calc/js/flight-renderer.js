// ============================================================================
// RENDERER — DOM writes only
// ============================================================================

/**
 * Writes calculation results back into the page. Nothing here reads the form or
 * calculates anything: the orchestrator hands over already-computed values and
 * the renderer only paints them.
 *
 * Relies on the global formatting helpers from utils.js (numToOGame,
 * timespanToShortenedString) and on the dom-utils fade helpers, exactly as the
 * other Bootstrap-migrated calculators do.
 */
class FlightRenderer {
    constructor(opts) {
        this.opts = opts;
    }

    // ------------------------------------------------------------------
    // Ship speeds
    // ------------------------------------------------------------------

    /**
     * Fill the per-ship speed labels next to each fleet input.
     * @param {number[]} speeds one entry per ship, in SHIPS_BASE order
     */
    renderShipSpeeds(speeds) {
        SHIPS_BASE.forEach((ship, i) => {
            const label = document.getElementById(`${ship[0]}-speed`);
            if (label) {
                label.textContent = numToOGame(Math.round(speeds[i]));
            }
        });
    }

    // ------------------------------------------------------------------
    // Distance and empty systems
    // ------------------------------------------------------------------

    /** Show the trip distance, or a dash when the coordinates are invalid. */
    renderDistance(distance) {
        this._setText('distance', distance == null ? '-' : numToOGame(distance));
    }

    /**
     * Update the empty-systems readout.
     * @param {{count: number, visible: boolean}} state
     */
    renderEmptySystems({ count, visible }) {
        const field = document.getElementById('empty-systems-count-spin');
        if (field) {
            field.value = count;
        }
        const label = document.getElementById('empty-systems-label');
        if (label) {
            label.style.display = visible ? '' : 'none';
        }
    }

    // ------------------------------------------------------------------
    // Flight times table
    // ------------------------------------------------------------------

    /**
     * Fill the flight-times table.
     * @param {Array<{duration: number, deut: number, cargo: number}>} entries
     *   one per speed step, index 0 = 100% down to index 19 = 5%
     * @param {number} playerClass drives which rows are visible and their striping
     */
    renderFlightTimes(entries, playerClass) {
        const rows = document.querySelectorAll('#flight-times tr');
        entries.forEach((entry, i) => {
            const row = rows[i + 1];
            if (!row) {
                return;
            }
            row.children[1].innerHTML = this._fmtTime(entry.duration);
            row.children[2].innerHTML = numToOGame(entry.deut);
            row.children[3].innerHTML = numToOGame(entry.cargo);
            row.children[4].children[0].hidden = false;
            this._stripeRow(row, i + 1, playerClass);
        });
    }

    /** Blank every flight-times row and hide the take-to-calc buttons. */
    clearFlightTimes(playerClass) {
        const rows = document.querySelectorAll('#flight-times tr');
        for (let i = 1; i <= 20; i++) {
            const row = rows[i];
            if (!row) {
                continue;
            }
            row.children[1].innerHTML = '';
            row.children[2].innerHTML = '';
            row.children[3].innerHTML = '';
            row.children[4].children[0].hidden = true;
            this._stripeRow(row, i, playerClass);
        }
    }

    /**
     * A ship of any class flies at one of 20 speed steps, but only the general
     * uses the in-between steps; for everyone else the odd rows are hidden and
     * the striping counts only the visible rows.
     */
    _stripeRow(row, rowIndex, playerClass) {
        if (rowIndex % 2 === 0) {
            row.hidden = playerClass !== PLAYER_CLASS.GENERAL;
        }
        const stripeIndex = playerClass === PLAYER_CLASS.GENERAL
            ? rowIndex
            : Math.floor(rowIndex / 2) + 1;
        row.classList.remove(stripeIndex % 2 === 0 ? 'even' : 'odd');
        row.classList.add(stripeIndex % 2 === 0 ? 'odd' : 'even');
    }

    // ------------------------------------------------------------------
    // Arrival time
    // ------------------------------------------------------------------

    /** Show the computed arrival moment, or '?' when a field is unparseable. */
    renderArrival(text) {
        this._setText('arrival-moment', text ?? '?');
    }

    /** Toggle the departure/arrival column titles for the reversed mode. */
    renderFlightTitles(mode) {
        const departureFirst = mode !== 1;
        this._setText('flight-title-1', departureFirst ? this.opts.departureTitle : this.opts.arrivalTitle);
        this._setText('flight-title-2', departureFirst ? this.opts.arrivalTitle : this.opts.departureTitle);
    }

    // ------------------------------------------------------------------
    // Field validity
    // ------------------------------------------------------------------

    /** Mark a date/time field valid or invalid. */
    markField(elementOrId, valid) {
        const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (el) {
            el.classList.toggle('is-invalid', !valid);
        }
    }

    // ------------------------------------------------------------------
    // Save points
    // ------------------------------------------------------------------

    /** Drop every result row from the three save-point tables, keeping headers. */
    clearSavePoints() {
        ['savepoints-galaxies', 'savepoints-systems', 'savepoints-planets'].forEach((id) => {
            const table = document.getElementById(id);
            if (!table) {
                return;
            }
            for (let i = table.rows.length - 1; i > 0; i--) {
                table.rows[i].remove();
            }
        });
    }

    /**
     * Append the found save points to one coordinate table. Each coordinate is a
     * link the orchestrator wires up (delegated on `.save-point-link`); the
     * target and departure time ride along as data attributes.
     *
     * @param {string} tableId one of the savepoints-* tables
     * @param {Array<{speedPercent: number, coordLabel: string, cost: number, point: number[]}>} rows
     * @param {string} startDT departure moment, passed through to the link
     */
    renderSavePoints(tableId, rows, startDT) {
        const table = document.getElementById(tableId);
        if (!table) {
            return;
        }
        rows.forEach((row, i) => {
            const stripe = i % 2 === 1 ? 'odd' : 'even';
            table.insertAdjacentHTML('beforeend',
                `<tr class="${stripe}">` +
                `<td>${row.speedPercent}%</td>` +
                `<td><a href="#" class="save-point-link" data-point="${row.point.join(',')}"` +
                ` data-start="${this._escapeAttr(startDT)}" data-speed="${row.speedPercent}">${row.coordLabel}</a></td>` +
                `<td>${numToOGame(row.cost)}</td>` +
                '</tr>');
        });
    }

    // ------------------------------------------------------------------
    // Notices
    // ------------------------------------------------------------------

    /** Flash the warning banner with a message, then fade it out. */
    renderWarning(message) {
        this._setText(this.opts.warnindMsgDivId, message);
        const banner = `#${this.opts.warnindDivId}`;
        fadeIn(banner, 800, () => {
            setTimeout(() => fadeOut(banner, 800), 5000);
        });
    }

    /** Set the contextual hint shown under the active tab. */
    renderHint(text) {
        this._setText('hint-message', text);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    _setText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    _fmtTime(seconds) {
        return timespanToShortenedString(seconds,
            this.opts.datetimeW, this.opts.datetimeD, this.opts.datetimeH,
            this.opts.datetimeM, this.opts.datetimeS);
    }

    _escapeAttr(value) {
        return String(value).replace(/"/g, '&quot;');
    }
}
