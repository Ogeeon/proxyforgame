// ============================================================================
// DATA COLLECTOR — DOM → data models
// ============================================================================

/**
 * Reads the flight calculator form. Nothing here calculates anything: the
 * result is handed to FlightCalculator, which never touches the DOM.
 *
 * Values that do not live in the form — the populated-systems map and the
 * universe flag that enables empty-system counting, both fetched from the
 * server — are passed in through the `state` argument of collectParams().
 */
class FlightDataCollector {

    // ------------------------------------------------------------------
    // Field helpers
    // ------------------------------------------------------------------

    /** Numeric value of an input, 0 when empty or unparseable. */
    num(id) {
        return getInputNumber(document.getElementById(id));
    }

    /** Numeric value of a select. */
    selectNum(id) {
        const el = /** @type {HTMLSelectElement|null} */ (document.getElementById(id));
        return el ? Number(el.value) : 0;
    }

    checked(id) {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        return el ? el.checked : false;
    }

    text(id) {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        return el ? el.value : '';
    }

    // ------------------------------------------------------------------
    // Parameters
    // ------------------------------------------------------------------

    /**
     * Every parameter the calculation engine needs.
     *
     * @param {object} state values the form does not hold:
     *   `populatedSystems` (galaxy → array of systems with an active player, or
     *   null) and `populatedSystemsAll` (the same for systems with any planet),
     *   `fleetIgnoreEmptySystems` / `fleetIgnoreInactiveSystems` (the two
     *   independent universe settings that decide which of the two sets counts),
     *   `emptySystemsOverrideEnabled` / `emptySystemsOverride` (the override is
     *   only active while the user is editing the field — the same field is
     *   also written back with the computed count, so its content alone cannot
     *   tell the two apart).
     */
    collectParams(state = {}) {
        return {
            driveLevels: this.collectDriveLevels(),
            fleetSpeedWar: this.selectNum('speed-fleet-war'),
            fleetSpeedPeaceful: this.selectNum('speed-fleet-peaceful'),
            fleetSpeedHolding: this.selectNum('speed-fleet-holding'),
            circularGalaxies: this.checked('circular-galaxies'),
            circularSystems: this.checked('circular-systems'),
            numberOfGalaxies: this.num('galaxies-num'),
            numberOfSystems: this.num('systems-num'),
            deutFactor: this.selectNum('deut-factor'),
            deutConsReduction: this.selectNum('deut-generals-bonus'),
            hyperTechLvl: this.num('hypertech-lvl'),
            spCargohold: this.num('sp-cargohold'),
            playerClass: this.collectPlayerClass(),
            missionType: this.collectMissionType(state.missionType),
            traderBonus: this.checked('trader-bonus'),
            warriorBonus: this.checked('warrior-bonus'),
            lfMechanGE: this.num('lf-mechan-general-enh'),
            lfRocktalCE: this.num('lf-rocktal-collector-enh'),
            lfShipsBonuses: this.collectLfShipsBonuses(),
            fleetIgnoreEmptySystems: state.fleetIgnoreEmptySystems ?? false,
            fleetIgnoreInactiveSystems: state.fleetIgnoreInactiveSystems ?? false,
            populatedSystems: state.populatedSystems ?? null,
            populatedSystemsAll: state.populatedSystemsAll ?? null,
            emptySystemsOverrideEnabled: state.emptySystemsOverrideEnabled ?? false,
            emptySystemsOverride: state.emptySystemsOverride ?? 0,
        };
    }

    /** Combustion, impulse and hyperspace drive levels. */
    collectDriveLevels() {
        return [this.num('cmb-drive'), this.num('imp-drive'), this.num('hyp-drive')];
    }

    /** Collector / general / discoverer, from the radio group. */
    collectPlayerClass() {
        if (this.checked('class-2')) {
            return PLAYER_CLASS.DISCOVERER;
        }
        if (this.checked('class-1')) {
            return PLAYER_CLASS.GENERAL;
        }
        return PLAYER_CLASS.COLLECTOR;
    }

    /**
     * War / peaceful / holding, from the radio group.
     * @param {number} fallback used while no radio is checked yet (page load)
     */
    collectMissionType(fallback = MISSION.PEACEFUL) {
        const checked = checkedRadio('mission-type');
        return checked ? Number(checked.value) : fallback;
    }

    /**
     * Per-ship life form bonuses as [speed, cargo, fuel] triples, in ship table
     * order. The table has one header row, hence the offset.
     */
    collectLfShipsBonuses() {
        const rows = document.querySelectorAll('#lf-ships-bonuses tr');
        return SHIPS_BASE.map((_, i) => {
            const row = rows[i + 1];
            if (!row) {
                return [0, 0, 0];
            }
            return [1, 2, 3].map((cell) => getInputNumber(row.children[cell].children[0]));
        });
    }

    // ------------------------------------------------------------------
    // Fleet
    // ------------------------------------------------------------------

    /** Ship counts in ship table order; the input id is the ship's short name. */
    collectShipCounts() {
        return SHIPS_BASE.map((ship) => this.num(ship[0]));
    }

    // ------------------------------------------------------------------
    // Coordinates
    // ------------------------------------------------------------------

    /**
     * One end of the trip.
     * @param {string} point 'departure' or 'destination'
     * @returns {{coords: number[], valid: boolean}} valid is false when any
     *   coordinate falls outside the constraints currently on its input
     */
    collectPoint(point) {
        const ids = ['g', 's', 'p'].map((suffix) => `${point}-${suffix}`);
        const coords = ids.map((id) => this.num(id));
        const valid = coords.every((value, i) => {
            const max = getConstraint(document.getElementById(ids[i]), 'max', Infinity);
            return value > 0 && value <= max;
        });
        return { coords, valid };
    }

    /** Both ends at once. */
    collectRoute() {
        return { departure: this.collectPoint('departure'), destination: this.collectPoint('destination') };
    }

    // ------------------------------------------------------------------
    // Manual overrides
    // ------------------------------------------------------------------

    /**
     * The "use this speed instead" checkbox and field.
     * @returns {{enabled: boolean, speed: number}}
     */
    collectSpeedOverride() {
        return { enabled: this.checked('ovr-speed-cb'), speed: this.num('ovr-speed-t') };
    }

    /**
     * The empty-systems field. `hasValue` separates "the user cleared it" from
     * "the user typed 0", which getInputNumber alone cannot do.
     */
    collectEmptySystems() {
        return { count: this.num('empty-systems-count-spin'), hasValue: this.text('empty-systems-count-spin').trim() !== '' };
    }

    // ------------------------------------------------------------------
    // Times
    // ------------------------------------------------------------------

    /** Raw contents of the arrival calculator fields; parsing belongs to core. */
    collectArrivalForm() {
        return { startDT: this.text('start-datetime'), legs: this.collectFlightLegs() };
    }

    /**
     * The flight duration rows. Each leg carries the sign of its +/- toggle, so
     * a returning leg subtracts from the arrival moment. The input element comes
     * along because the renderer marks invalid legs on it.
     */
    collectFlightLegs() {
        const legs = [];
        document.querySelectorAll('#flight-data .flight-leg').forEach((row) => {
            const input = /** @type {HTMLInputElement|null} */ (
                row.querySelector('.flight-time-input'));
            if (!input) {
                return;
            }
            const toggle = /** @type {HTMLElement|null} */ (
                row.querySelector('.flight-leg-sign'));
            legs.push({ input, value: input.value, sign: toggle?.dataset.sign === '-' ? -1 : 1 });
        });
        return legs;
    }

    /**
     * Raw contents of the save point search fields; parsing belongs to core.
     * `returnDT` is the moment the fleet is back home, or — with `oneWay` on —
     * the moment it lands on the target.
     */
    collectSavePointForm() {
        return {
            startDT: this.text('save-start-datetime'),
            returnDT: this.text('save-return-datetime'),
            tolerance: this.text('save-tolerance-time'),
            oneWay: this.checked('save-one-way'),
        };
    }

    // ------------------------------------------------------------------
    // Server selection
    // ------------------------------------------------------------------

    /** The country/universe pair the universe settings are fetched for. */
    collectServer() {
        return { country: this.text('country'), universe: this.text('universe') };
    }
}

// ============================================================================
// CALCULATION-ERROR REPORT
// ============================================================================
//
// What the sidebar's report dialog attaches for this page (the contract is in
// www/js/report-context.js): the result tab and, on the flight-time tab, the
// departure panel's tab; every field that feeds the result next to its
// factory default. reportEntryOf(), reportLabelOf() and cleanReportLabel()
// come from sidebar.js.

// The life-form ship table's three inputs per row, in column order.
const FLIGHT_REPORT_LF_COLUMNS = ['speed', 'cargo', 'fuel'];
// A flight leg as a fresh page shows it.
const FLIGHT_REPORT_EMPTY_LEG = '+00 00:00:00';

/**
 * A localized caption the template inlined for the report (options.reportText).
 * @param {string} key
 * @returns {string}
 */
function flightReportText(key) {
    return cleanReportLabel(options.reportText[key] ?? key);
}

/**
 * The caption of a tab button, '' for a missing one.
 * @param {string} id
 * @returns {string}
 */
function flightTabLabel(id) {
    return cleanReportLabel(document.getElementById(id)?.textContent ?? '');
}

/**
 * Collects the report's entries; `add` reads one field by id.
 */
class FlightReportEntries {
    constructor() {
        /** @type {ReportEntry[]} */
        this.entries = [];
    }

    /**
     * @param {string} id
     * @param {string} group
     * @param {ReportFieldOptions} [opts]
     * @returns {ReportEntry|null} the entry added, null for a missing field
     */
    add(id, group, opts = {}) {
        const el = document.getElementById(id);
        if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) {
            return null;
        }
        const entry = reportEntryOf(el, { group, ...opts });
        this.entries.push(entry);
        return entry;
    }

    /**
     * @param {string[]} ids
     * @param {string} group
     */
    addNumbers(ids, group) {
        for (const id of ids) {
            this.add(id, group, { numeric: true });
        }
    }

    /**
     * A radio group as one entry: the option that is on, against the one the
     * page starts on.
     * @param {string} name
     * @param {string} group
     * @param {string} label
     * @param {string} start - the value of the option a fresh page has on
     */
    addRadio(name, group, label, start) {
        const on = checkedRadio(name);
        this.entries.push({
            key: name, group, label,
            value: on?.value ?? '', default: start,
            display: on instanceof HTMLInputElement ? reportLabelOf(on) || on.value : '',
        });
    }

    /**
     * Galaxy, system and position as one "g:s:p" entry.
     * @param {string} point - 'departure' or 'destination'
     * @param {string} group
     */
    addCoords(point, group) {
        const value = ['g', 's', 'p'].map((suffix) => getVal(`#${point}-${suffix}`)).join(':');
        this.entries.push({
            key: point, group, label: cleanReportLabel(document.querySelector(`label[for="${point}-g"]`)?.textContent ?? point),
            value, default: '1:1:1',
        });
    }
}

/**
 * The tabs the result is read on: the result tab, and on the flight-time tab
 * the departure panel's tab (plain arrival or recall).
 * @returns {ReportModePart[]}
 */
function flightReportMode() {
    /** @type {ReportModePart[]} */
    const mode = [];
    const outer = document.querySelector('#tabs .nav-link.active');
    if (outer === null) {
        return mode;
    }
    mode.push({ key: outer.id, label: flightTabLabel(outer.id) });
    const inner = document.querySelector('#recall-tabs .nav-link.active');
    if (outer.id === 'tabtag1' && inner !== null) {
        mode.push({ key: inner.id, label: flightTabLabel(inner.id) });
    }
    return mode;
}

/**
 * The parameter panel: all three of its tabs, the hidden ones included.
 * @param {FlightReportEntries} out
 */
function flightReportParameters(out) {
    const common = flightTabLabel('param-common-tab');
    out.addCoords('departure', common);
    out.addRadio('class', common, flightReportText('class'), '0');
    out.addRadio('alliance-class', common, flightReportText('alliance-class'), '0');
    out.addNumbers(['cmb-drive', 'imp-drive', 'hyp-drive', 'hypertech-lvl'], common);

    const universe = flightTabLabel('param-universe-tab');
    out.add('country', universe);
    // The universe list is built from the country, so it has no default of
    // its own: named whenever a country is picked.
    const uni = out.add('universe', universe);
    if (uni !== null) {
        delete uni.default;
    }
    out.add('circular-systems', universe);
    out.add('circular-galaxies', universe);
    out.addNumbers(['systems-num', 'galaxies-num'], universe);
    out.add('speed-fleet-war', universe);
    out.add('speed-fleet-peaceful', universe);
    out.add('speed-fleet-holding', universe);
    out.add('sp-cargohold', universe, { numeric: true });
    out.add('deut-factor', universe);
    out.add('deut-generals-bonus', universe);

    const lifeforms = flightTabLabel('param-lifeforms-tab');
    out.addNumbers(['lf-mechan-general-enh', 'lf-rocktal-collector-enh'], lifeforms);
    for (const row of document.querySelectorAll('#lf-ships-bonuses tr[data-report-key]')) {
        if (!(row instanceof HTMLTableRowElement)) {
            continue;
        }
        const name = cleanReportLabel(row.cells[0]?.textContent ?? '');
        row.querySelectorAll('input').forEach((input, i) => {
            out.entries.push(reportEntryOf(input, {
                key: `${row.dataset.reportKey}.${FLIGHT_REPORT_LF_COLUMNS[i] ?? i}-bonus`, group: lifeforms,
                numeric: true, label: `${name} — ${reportLabelOf(input)}`,
            }));
        });
    }
}

/**
 * The ships panel: the count of every ship and the speed override.
 * @param {FlightReportEntries} out
 */
function flightReportShips(out) {
    const ships = flightReportText('ships');
    for (const ship of SHIPS_BASE) {
        const slug = String(ship[0]);
        out.add(slug, ships, { key: `${slug}.qty`, numeric: true });
    }
    out.add('ovr-speed-cb', ships);
    if (getChecked('#ovr-speed-cb')) {
        out.add('ovr-speed-t', ships, { numeric: true });
    }
}

/**
 * The flight-time tab: mission, target, and the departure panel the mode
 * names - the arrival calculator's legs or the recall.
 * @param {FlightReportEntries} out
 * @param {ReportModePart[]} mode
 */
function flightReportFlightTimes(out, mode) {
    const group = mode[0].label;
    out.addRadio('mission-type', group, flightReportText('mission-type'), '1');
    out.addCoords('destination', group);
    const override = window.flightOrchestrator?.emptyOverride;
    if (override?.enabled) {
        out.add('empty-systems-count-spin', group, { numeric: true, label: flightReportText('empty-systems') });
    }

    const panel = mode[1];
    if (panel === undefined) {
        return;
    }
    if (panel.key === 'recall-tabtag-recall') {
        out.add('recall-start-datetime', panel.label);
        out.add('recall-full-flight', panel.label);
        out.addRadio('recall-mode', panel.label, flightReportText('recall'), '0');
        out.add(checkedRadio('recall-mode')?.value === '1' ? 'recall-after' : 'recall-moment', panel.label);
        return;
    }
    // The arrow button swaps what the first moment is: the departure, or -
    // counting back - the arrival.
    const reversed = window.flightOrchestrator?.opts.prm.mode === 1;
    out.entries.push({
        key: 'arrival-mode', group: panel.label, label: flightReportText('toggle-mode'),
        value: reversed ? 1 : 0, default: 0,
        display: cleanReportLabel(document.getElementById('flight-title-1')?.textContent ?? ''),
    });
    out.add('start-datetime', panel.label, { label: cleanReportLabel(document.getElementById('flight-title-1')?.textContent ?? '') });
    document.querySelectorAll('#flight-data .flight-leg').forEach((row, i) => {
        const input = row.querySelector('.flight-time-input');
        if (!(input instanceof HTMLInputElement)) {
            return;
        }
        const sign = row.querySelector('.flight-leg-sign');
        const back = sign instanceof HTMLElement && sign.dataset.sign === '-';
        const time = input.value.trim();
        const direction = back ? '-' : '+';
        const value = time === '' ? '' : `${direction}${time}`;
        // A fresh page shows one empty leg as a forward "00 00:00:00".
        out.entries.push({
            key: `flight-leg.${i + 1}`, group: panel.label, label: `${flightReportText('flight')} ${i + 1}`,
            value, default: FLIGHT_REPORT_EMPTY_LEG,
        });
    });
}

/**
 * The save-point search's own fields.
 * @param {FlightReportEntries} out
 * @param {string} group
 */
function flightReportSavePoints(out, group) {
    out.add('save-start-datetime', group);
    out.add('save-return-datetime', group, { label: cleanReportLabel(document.getElementById('save-return-label')?.textContent ?? '') });
    // The template leaves it empty; a fresh page fills in a zero tolerance.
    const tolerance = out.add('save-tolerance-time', group);
    if (tolerance !== null) {
        tolerance.default = '00:00';
    }
    out.add('save-one-way', group);
}

/**
 * The report hook: the open tabs and every field the result there depends
 * on, defaults included.
 * @returns {ReportSnapshot}
 */
function flightReportSnapshot() {
    const mode = flightReportMode();
    const out = new FlightReportEntries();
    flightReportParameters(out);
    flightReportShips(out);
    if (mode[0]?.key === 'tabtag1') {
        flightReportFlightTimes(out, mode);
    } else if (mode[0]?.key === 'tabtag2') {
        flightReportSavePoints(out, mode[0].label);
    }
    return { mode, entries: out.entries };
}

/**
 * The caption of a result cell the page marked.
 * @param {string} key - e.g. "speed-100.duration", "large-cargo.speed",
 *   "savepoints-systems-2.deuterium", "distance"
 * @returns {string}
 */
function flightDescribeCell(key) {
    const dot = key.lastIndexOf('.');
    if (key === 'arrival-moment') {
        // Arrival, or the departure when the panel counts back from it.
        return cleanReportLabel(document.getElementById('flight-title-2')?.textContent ?? '');
    }
    if (dot < 0) {
        return flightReportText(key);
    }
    const rowKey = key.slice(0, dot);
    const columnKey = key.slice(dot + 1);
    // The save points' last column reads "Return" or, one-way, "Arrival".
    const column = columnKey === 'return'
        ? cleanReportLabel(document.querySelector('.savepoint-return-header')?.textContent ?? '')
        : flightReportText(columnKey);
    let row = '';
    const speed = /^speed-(\d+)$/.exec(rowKey);
    const savePoint = /^savepoints-(galaxies|systems|planets)-(\d+)$/.exec(rowKey);
    if (speed !== null) {
        row = `${flightReportText('speed')} ${speed[1]}%`;
    } else if (savePoint !== null) {
        row = `${flightReportText(savePoint[1])} ${savePoint[2]}`;
    } else {
        row = cleanReportLabel(document.querySelector(`label[for="${CSS.escape(rowKey)}"]`)?.textContent ?? '');
    }
    return row === '' ? column : `${row}, ${column}`;
}

if (typeof window !== 'undefined') {
    globalThis.reportSnapshot = flightReportSnapshot;
    globalThis.describeCell = flightDescribeCell;
}
