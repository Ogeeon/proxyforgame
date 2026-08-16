// ============================================================================
// RENDERER — DOM writes only
// ============================================================================

/**
 * Writes calculation results back into the page. Nothing here reads the form or
 * calculates anything: the orchestrator hands over already-computed values and
 * the renderer only paints them.
 *
 * Relies on the global formatting helpers from utils.js (numToOGame,
 * timespanToShortenedString, getDateStr) and on the dom-utils fade helpers, exactly as the
 * other Bootstrap-migrated calculators do.
 */
/**
 * The take-to-calc button of a flight-times row: column 4 holds exactly one.
 * @param {Element} row - a tr of #flight-times
 * @returns {HTMLElement}
 */
function takeToCalcButton(row) {
    return /** @type {HTMLElement} */ (row.children[4].children[0]);
}

/**
 * The twenty speed steps of #flight-times, fastest first. Addressed by class
 * rather than by position: the table also carries a header and the empty-state
 * rows, and a positional index would silently shift the moment one is added.
 * @returns {NodeListOf<HTMLTableRowElement>}
 */
function speedRows() {
    return document.querySelectorAll('#flight-times tr.speed-row');
}

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
        const field = /** @type {HTMLInputElement|null} */ (
            document.getElementById('empty-systems-count-spin'));
        if (field) {
            field.value = String(count);
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
     *   one per speed step, index 0 = 100% down to index 19 = 5%. A mission
     *   flown at a fixed speed hands over the single 100% entry instead, and
     *   the rows it leaves without an entry are blanked and hidden.
     * @param {number} playerClass drives which rows are visible and their striping
     */
    renderFlightTimes(entries, playerClass) {
        speedRows().forEach((row, i) => {
            const entry = entries[i];
            if (!entry) {
                this._blankRow(row);
                row.hidden = true;
                return;
            }
            row.children[1].innerHTML = this._fmtTime(entry.duration);
            row.children[2].innerHTML = numToOGame(entry.deut);
            row.children[3].innerHTML = numToOGame(entry.cargo);
            takeToCalcButton(row).hidden = false;
            this._stripeRow(row, i + 1, playerClass);
        });
        this._showEmptyState(null);
    }

    /**
     * There is nothing to show, and the table says why instead of going blank.
     * Blanks every speed row, hides the take-to-calc buttons and brings forward
     * the message row for the reason given.
     *
     * @param {'ships'|'coords'} reason what is missing: a fleet, or a valid route
     * @param {number} playerClass drives the striping of the rows left behind
     */
    renderEmptyState(reason, playerClass) {
        speedRows().forEach((row, i) => {
            this._blankRow(row);
            this._stripeRow(row, i + 1, playerClass);
        });
        this._showEmptyState(reason);
    }

    /** Clear one speed row's results and take back its take-to-calc button. */
    _blankRow(row) {
        row.children[1].innerHTML = '';
        row.children[2].innerHTML = '';
        row.children[3].innerHTML = '';
        takeToCalcButton(row).hidden = true;
    }

    /** Show one empty-state row, or none of them when `reason´ is null. */
    _showEmptyState(reason) {
        const table = document.getElementById('flight-times');
        if (table) {
            table.classList.toggle('is-empty', reason !== null);
        }
        document.querySelectorAll('#flight-times tr.flight-times-empty').forEach((row) => {
            row.toggleAttribute('hidden', row.id !== `flight-times-empty-${reason}`);
        });
    }

    /**
     * A ship of any class flies at one of 20 speed steps, but only the general
     * uses the in-between steps; for everyone else the odd rows are hidden and
     * the striping counts only the visible rows.
     *
     * Visibility is assigned rather than only taken away: a row hidden by a
     * fixed-speed mission has to come back the moment another one is picked.
     */
    _stripeRow(row, rowIndex, playerClass) {
        row.hidden = rowIndex % 2 === 0 && playerClass !== PLAYER_CLASS.GENERAL;
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

    /** The moment a recalled fleet is back home, or `?` while it is unknown. */
    renderRecallReturn(text) {
        this._setText('recall-return-moment', text ?? '?');
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
            const table = /** @type {HTMLTableElement|null} */ (
                document.getElementById(id));
            if (!table) {
                return;
            }
            for (let i = table.rows.length - 1; i > 0; i--) {
                table.rows[i].remove();
            }
        });
    }

    /** Name the last result column after what the second moment means. */
    renderSavePointMode(oneWay) {
        const title = oneWay ? this.opts.arrivalTitle : this.opts.returnTitle;
        this._setText('save-return-label', title);
        document.querySelectorAll('.savepoint-return-header').forEach((th) => {
            th.textContent = title;
        });
    }

    /**
     * Append the found save points to one coordinate table. Each coordinate is a
     * link the orchestrator wires up (delegated on `.save-point-link`); the
     * target and departure time ride along as data attributes.
     *
     * @param {string} tableId one of the savepoints-* tables
     * @param {Array<{speedPercent: number, coordLabel: string, cost: number, arriveAt: number, point: number[]}>} rows
     * @param {string} startDT departure moment, passed through to the link
     * @param {number} legs flights the point was found for (1 one-way, 2 round
     *        trip) — carried on the link so a later toggle cannot change what an
     *        already listed point seeds
     */
    renderSavePoints(tableId, rows, startDT, legs) {
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
                ` data-start="${this._escapeAttr(startDT)}" data-speed="${row.speedPercent}"` +
                ` data-legs="${legs}">${row.coordLabel}</a></td>` +
                `<td>${numToOGame(row.cost)}</td>` +
                `<td class="savepoint-return">${getDateStr(row.arriveAt, this.opts.datetimeFormat)}</td>` +
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
        return String(value).replaceAll('"', '&quot;');
    }
}
