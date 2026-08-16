// ============================================================================
// ORCHESTRATION — wires collector → core → renderer and owns the events
// ============================================================================

// How long a cached populated-systems map stays usable. The server job that
// builds it runs daily, so anything longer only serves stale coordinates.
const POPULATED_SYSTEMS_TTL_MS = 24 * 60 * 60 * 1000;

// The hh:mm the save-point tolerance field holds.
const TOLERANCE_RE = /(\d\d):(\d\d)/;

// The persisted state object. The TPL inline script fills in the translation
// strings; the orchestrator reads/writes prm and calls load/save (cookie I/O in
// utils.js). Transient bits (populated systems, manual overrides) live on the
// orchestrator instance, not here.
const options = {
    defConstraints: {
        min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false,
    },
    universe: null,
    prm: {
        country: '--',
        universe: null,
        driveLevels: [0, 0, 0],
        fleetSpeedWar: 1,
        fleetSpeedPeaceful: 1,
        fleetSpeedHolding: 1,
        circularGalaxies: false,
        circularSystems: false,
        numberOfGalaxies: 9,
        numberOfSystems: 499,
        deutFactor: 10,
        deutConsReduction: 25,
        departure: [1, 1, 1],
        destination: [1, 1, 1],
        ships: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        startDT: 0,
        saveStartDT: 0,
        saveReturnDT: 0,
        saveTolerance: 0,
        saveOneWay: false,
        // Fleet recall: the outbound flight being interrupted, plus whichever of
        // the two recall fields the picked mode drives.
        recallStartDT: 0,
        recallFullFlight: 0,
        recallMode: 0,
        recallMomentDT: 0,
        recallElapsed: 0,
        mode: 0,
        missionType: 1,
        hyperTechLvl: 0,
        flightData: [0],
        playerClass: 0,
        traderBonus: false,
        spCargohold: 0,
        lfMechanGE: 0,
        lfRocktalCE: 0,
        /** @type {number[][]} Per ship: [speed, cargo, fuel] bonus in percent. */
        lfShipsBonuses: [],
        fleetIgnoreEmptySystems: false,
        fleetIgnoreInactiveSystems: false,
        validate: function (field, value) {
            switch (field) {
                case 'country': return value;
                case 'universe': return validateNumber(Number.parseInt(value, 10), 0, Infinity, 101);
                case 'driveLevels': return validateNumber(Number.parseFloat(value), 0, 50, 0);
                case 'fleetSpeedWar':
                case 'fleetSpeedPeaceful':
                case 'fleetSpeedHolding': return validateNumber(Number.parseFloat(value), 1, 10, 1);
                case 'missionType': return validateNumber(Number.parseFloat(value), 0, 3, 1);
                case 'circularGalaxies':
                case 'circularSystems':
                case 'traderBonus':
                case 'saveOneWay':
                case 'fleetIgnoreEmptySystems':
                case 'fleetIgnoreInactiveSystems': return value === 'true';
                case 'numberOfSystems': return validateNumber(Number.parseFloat(value), 1, 550, 499);
                case 'numberOfGalaxies': return validateNumber(Number.parseFloat(value), 1, 12, 9);
                case 'deutFactor': return validateNumber(Number.parseFloat(value), 5, 10, 10);
                case 'deutConsReduction': return validateNumber(Number.parseFloat(value), 25, 50, 25);
                case 'departure':
                case 'destination': return validateNumber(Number.parseFloat(value), 1, 1000, 1);
                case 'ships':
                case 'startDT':
                case 'saveStartDT':
                case 'saveReturnDT':
                case 'saveTolerance':
                case 'recallStartDT':
                case 'recallFullFlight':
                case 'recallMomentDT':
                case 'recallElapsed':
                case 'hyperTechLvl':
                case 'lfMechanGE':
                case 'lfRocktalCE':
                case 'lfShipsBonuses': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
                case 'mode':
                case 'recallMode': return validateNumber(Number.parseFloat(value), 0, 1, 0);
                case 'flightData': return validateNumber(Number.parseFloat(value), -Infinity, Infinity, 0);
                case 'spCargohold': return validateNumber(Number.parseFloat(value), 0, 5, 0);
                default: return value;
            }
        },
    },

    load: function (key) {
        try {
            loadFromCookie(key, options.prm);
            if (options.prm.lfShipsBonuses.length !== 15 || !Array.isArray(options.prm.lfShipsBonuses[0])) {
                options.prm.lfShipsBonuses = Array.from({ length: 15 }, () => [0, 0, 0]);
            }
        } catch (e) {
            showAlertModal(String(e), window.flightOrchestrator?.opts.dialogOk);
            if (window.flightOrchestrator) {
                window.flightOrchestrator.resetParams();
            }
        }
    },

    save: function () {
        saveToCookie('options_flight', options.prm);
    },
};

/**
 * Drives the flight calculator: reads the form through FlightDataCollector,
 * runs the numbers through FlightCalculator and paints them with
 * FlightRenderer. It also owns the transient state that is not a form field
 * (the populated-systems map, the manual overrides and the display mode) and
 * keeps options.prm in sync so the existing cookie save/load keeps working.
 *
 * The Bootstrap component setup (tabs, accordions, modals) lives in the inline
 * script of flight.tpl and calls into the public handler methods here; this
 * class only touches plain inputs, buttons, selects and tables.
 */
class FlightOrchestrator {
    constructor(opts) {
        this.opts = opts;
        this.calc = new FlightCalculator();
        this.collector = new FlightDataCollector();
        this.renderer = new FlightRenderer(opts);

        // Transient state — never persisted, mirrors the old `options.*` fields.
        // Two maps: the systems with an active player and the systems with any
        // planet at all, because the universe decides independently whether it
        // skips empty systems, inactive ones, both or neither.
        this.populatedSystems = null;
        this.populatedSystemsAll = null;
        /**
         * Nesting depth per panel id, so overlapping show/hide calls cannot
         * uncover a panel early. Created on first use.
         * @type {Record<string, number>}
         */
        this._overlayCount = {};
        this.speedOverride = { enabled: false, speed: 10000 };
        this.emptyOverride = { enabled: false, count: 0 };
    }

    // ------------------------------------------------------------------
    // State assembly
    // ------------------------------------------------------------------

    /** The bits collectParams needs that do not live in the form. */
    _state() {
        return {
            populatedSystems: this.populatedSystems,
            populatedSystemsAll: this.populatedSystemsAll,
            fleetIgnoreEmptySystems: this.opts.prm.fleetIgnoreEmptySystems,
            fleetIgnoreInactiveSystems: this.opts.prm.fleetIgnoreInactiveSystems,
            emptySystemsOverrideEnabled: this.emptyOverride.enabled,
            emptySystemsOverride: this.emptyOverride.count,
            missionType: this.opts.prm.missionType,
        };
    }

    /** Copy the collected params back into options.prm so a cookie save is current. */
    _syncPrm(params, counts, route) {
        const prm = this.opts.prm;
        prm.driveLevels = params.driveLevels;
        prm.fleetSpeedWar = params.fleetSpeedWar;
        prm.fleetSpeedPeaceful = params.fleetSpeedPeaceful;
        prm.fleetSpeedHolding = params.fleetSpeedHolding;
        prm.circularGalaxies = params.circularGalaxies;
        prm.circularSystems = params.circularSystems;
        prm.numberOfGalaxies = params.numberOfGalaxies;
        prm.numberOfSystems = params.numberOfSystems;
        prm.deutFactor = params.deutFactor;
        prm.deutConsReduction = params.deutConsReduction;
        prm.hyperTechLvl = params.hyperTechLvl;
        prm.spCargohold = params.spCargohold;
        prm.playerClass = params.playerClass;
        prm.traderBonus = params.traderBonus;
        prm.lfMechanGE = params.lfMechanGE;
        prm.lfRocktalCE = params.lfRocktalCE;
        prm.lfShipsBonuses = params.lfShipsBonuses;
        prm.missionType = params.missionType;
        prm.ships = counts;
        prm.departure = route.departure.coords;
        prm.destination = route.destination.coords;
    }

    // ------------------------------------------------------------------
    // Recalculation — replaces updateNumbers
    // ------------------------------------------------------------------

    recalc() {
        const params = this.collector.collectParams(this._state());
        const counts = this.collector.collectShipCounts();
        const route = this.collector.collectRoute();
        this._syncPrm(params, counts, route);

        // Coordinate inputs are clamped to the universe size the user set
        this._applyCoordinateLimits(params.numberOfGalaxies, params.numberOfSystems);
        // Ahead of every early return: a mission with a fixed speed greys the
        // override out whether or not there is a fleet or a route to compute.
        this._applyMissionUi(params.missionType);

        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        this.renderer.renderShipSpeeds(this.calc.getAllShipSpeeds(ships, params));

        if (!route.departure.valid || !route.destination.valid) {
            this.renderer.renderDistance(null);
            this.renderer.renderEmptyState('coords', params.playerClass);
            this.opts.save();
            return;
        }

        const { distance, emptySystems } = this.calc.getDistance(
            route.departure.coords, route.destination.coords, params);
        this.renderer.renderDistance(distance);

        const emptyCount = this.emptyOverride.enabled && this.emptyOverride.count >= 0
            ? this.emptyOverride.count
            : emptySystems;
        this.renderer.renderEmptySystems({
            count: emptyCount,
            visible: params.fleetIgnoreEmptySystems || params.fleetIgnoreInactiveSystems,
        });

        // An empty fleet has nothing to fly, so there is no duration, fuel or
        // cargo to show — not even when the manual speed override is on.
        const minSpeed = counts.some((count) => count > 0)
            ? this._effectiveMinSpeed(ships, counts, params)
            : Infinity;
        if (minSpeed === Infinity) {
            this.renderer.renderEmptyState('ships', params.playerClass);
            this.opts.save();
            return;
        }

        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const flightSpeed = this.calc.speedForMission(params.missionType, minSpeed);
        // Moon destruction is flown at one speed the game does not let the player
        // pick a percentage of, so its table holds the single step that exists.
        const fixed = params.missionType === MISSION.DESTROY;
        const steps = fixed ? [100] : Array.from({ length: 20 }, (_, i) => 100 - i * 5);
        const entries = steps.map((percent) => {
            const duration = this.calc.getFlightDuration(flightSpeed, distance, percent, fleetSpeed);
            return {
                duration,
                deut: this.calc.getDeutConsumption(ships, counts, distance, duration, fleetSpeed, params,
                    fixed ? flightSpeed : 0),
                cargo: this.calc.getCargoCapacity(ships, counts, params),
            };
        });
        this.renderer.renderFlightTimes(entries, params.playerClass);
        this.opts.save();
    }

    /**
     * Grey out the manual speed override while the mission flies at a fixed
     * speed: the override cannot win there, and a live control that changes
     * nothing reads as a bug.
     */
    _applyMissionUi(missionType) {
        const fixed = missionType === MISSION.DESTROY;
        const toggle = /** @type {HTMLInputElement|null} */ (document.getElementById('ovr-speed-cb'));
        if (toggle) {
            toggle.disabled = fixed;
        }
        const field = inputEl('#ovr-speed-t');
        if (field) {
            field.disabled = fixed || !this.speedOverride.enabled;
            field.classList.toggle('ui-state-disabled', field.disabled);
        }
    }

    /** Manual speed override wins over the fleet's slowest ship; 0 means "use 10000". */
    _effectiveMinSpeed(ships, counts, params) {
        const override = this.collector.collectSpeedOverride();
        if (!this.speedOverride.enabled) {
            return this.calc.getMinSpeed(ships, counts, params);
        }
        let speed = override.speed;
        if (speed === 0) {
            speed = 10000;
            setVal('#ovr-speed-t', 10000);
        }
        this.speedOverride.speed = speed;
        return speed;
    }

    _setCoordConstraint(id, max) {
        const el = document.getElementById(id);
        if (el) {
            el._constrains = { min: 1, def: 0, max };
        }
    }

    _applyCoordinateLimits(galaxies, systems) {
        this._setCoordConstraint('departure-g', galaxies);
        this._setCoordConstraint('destination-g', galaxies);
        this._setCoordConstraint('departure-s', systems);
        this._setCoordConstraint('destination-s', systems);
    }

    // ------------------------------------------------------------------
    // Arrival time — replaces updateArrival
    // ------------------------------------------------------------------

    updateArrival() {
        const form = this.collector.collectArrivalForm();
        const startValid = this._markDate('start-datetime', form.startDT);
        let moment = parseDate(form.startDT, this.opts.datetimeFormat);
        this.opts.prm.startDT = moment;

        this.opts.prm.flightData = [];
        form.legs.forEach((leg) => {
            const seconds = this._legSeconds(leg.value);
            if (seconds >= 0) {
                const signed = leg.sign * seconds;
                this.opts.prm.flightData.push(signed);
                moment += signed * 1000;
                this.renderer.markField(leg.input, true);
            } else {
                this.renderer.markField(leg.input, false);
            }
        });

        this.renderer.renderArrival(startValid ? getDateStr(moment, this.opts.datetimeFormat) : null);
        this.opts.save();
    }

    /** Seconds encoded in a "DD HH:MM:SS" leg field, or -1 when malformed. */
    _legSeconds(text) {
        const empty = '__ __:__:__';
        if (text.length === 0 || text === empty) {
            return 0;
        }
        const parts = text.match(/(\d\d) (\d\d):(\d\d):(\d\d)/);
        if (parts?.length !== 5) {
            return -1;
        }
        const [, days, hours, minutes, seconds] = parts.map(Number);
        if (hours > 23 || minutes > 59 || seconds > 59) {
            return -1;
        }
        return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    // ------------------------------------------------------------------
    // Fleet recall — the second departure-panel tab
    // ------------------------------------------------------------------

    /**
     * Recompute the recall tab from its three inputs.
     *
     * A recall needs both halves of the picture: when the fleet left, and how
     * long the whole outbound flight would have taken. Until both are known the
     * two recall fields stay locked. Once they are, the mode radio decides which
     * field the user drives and which one this fills in from it — they always
     * describe the same recall, only in different units.
     *
     * @param {boolean} warn name an out-of-window recall in the warning banner.
     *        Only the blur handler asks for it: typing is not the moment to
     *        shout, and the field colour already says as much.
     */
    updateRecall(warn = false) {
        const prm = this.opts.prm;
        const moment = inputEl('#recall-moment');
        const after = inputEl('#recall-after');
        if (!moment || !after) {
            return;
        }

        const startText = this.collector.text('recall-start-datetime');
        const startValid = this._markDate('recall-start-datetime', startText);
        prm.recallStartDT = startValid ? parseDate(startText, this.opts.datetimeFormat) : 0;

        const fullSeconds = this._legSeconds(this.collector.text('recall-full-flight'));
        prm.recallFullFlight = Math.max(fullSeconds, 0);
        prm.recallMode = getChecked('#recall-mode-1') ? 1 : 0;

        const ready = prm.recallStartDT > 0 && prm.recallFullFlight > 0;
        moment.disabled = !(ready && prm.recallMode === 0);
        after.disabled = !(ready && prm.recallMode === 1);

        if (!ready) {
            this.renderer.markField(moment, true);
            this.renderer.markField(after, true);
            this.renderer.renderRecallReturn(null);
            this.opts.save();
            return;
        }

        const field = prm.recallMode === 0 ? moment : after;
        const elapsed = prm.recallMode === 0
            ? this._recallElapsedFromMoment(prm.recallStartDT, moment)
            : this._recallElapsedFromDuration(after);
        if (elapsed === null) {
            this.renderer.renderRecallReturn(null);
            this.opts.save();
            return;
        }
        if (!this._markRecallWindow(field, elapsed, prm.recallFullFlight, warn)) {
            // A recall the window rules out must not outlive it in the cookie.
            // Taking a shorter row to the calculator narrows the window under a
            // stored recall, and a reload would otherwise hand the panel back a
            // moment it rejects on sight — one the user never typed.
            prm.recallElapsed = 0;
            prm.recallMomentDT = 0;
            this.renderer.renderRecallReturn(null);
            this.opts.save();
            return;
        }

        // Mirror only a recall that really exists, so the paired field never
        // shows a moment the panel has just rejected.
        if (prm.recallMode === 0) {
            setVal('#recall-after', getFlightTimeStr(elapsed));
        } else {
            setVal('#recall-moment', getDateStr(prm.recallStartDT + elapsed * 1000, this.opts.datetimeFormat));
        }

        prm.recallElapsed = elapsed;
        prm.recallMomentDT = prm.recallStartDT + elapsed * 1000;
        // Turning back retraces exactly the distance already flown, and the
        // window check above has ruled out anything past the arrival.
        this.renderer.renderRecallReturn(
            getDateStr(prm.recallMomentDT + elapsed * 1000, this.opts.datetimeFormat));
        this.opts.save();
    }

    /**
     * Seconds between departure and the typed recall moment, or null when the
     * moment is unusable — blank or badly formed. A moment before take-off comes
     * back as a negative number: unparseable and out of window are different
     * answers, and only the caller knows what to do about the second one.
     */
    _recallElapsedFromMoment(departure, field) {
        if (!this._markDate('recall-moment', field.value)) {
            return null;
        }
        const parsed = parseDate(field.value, this.opts.datetimeFormat);
        if (parsed === 0) {
            return null;
        }
        return Math.round((parsed - departure) / 1000);
    }

    /** The mirror image: the seconds a typed elapsed time spells out. */
    _recallElapsedFromDuration(field) {
        const elapsed = this._legSeconds(field.value);
        if (elapsed < 0) {
            this.renderer.markField(field, false);
            return null;
        }
        return elapsed;
    }

    /**
     * A recall only exists between take-off and arrival: past the arrival there
     * is nothing left to turn back. Marks the field and, when asked, names in
     * the warning banner which end of the window was overshot.
     */
    _markRecallWindow(field, elapsed, full, warn) {
        let message = null;
        if (elapsed < 0) {
            message = this.opts.msgRecallBeforeDeparture;
        } else if (elapsed > full) {
            message = this.opts.msgRecallAfterArrival;
        }
        this.renderer.markField(field, message === null);
        if (message !== null && warn) {
            this.renderer.renderWarning(message);
        }
        return message === null;
    }

    setRecallDepartureNow() {
        this.opts.prm.recallStartDT = Date.now();
        setVal('#recall-start-datetime', getDateStr(this.opts.prm.recallStartDT, this.opts.datetimeFormat));
        this.updateRecall();
    }

    setRecallDepartureZero() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        this.opts.prm.recallStartDT = d.getTime();
        setVal('#recall-start-datetime', getDateStr(this.opts.prm.recallStartDT, this.opts.datetimeFormat));
        this.updateRecall();
    }

    /** Mark a date field valid/invalid, leaving an empty field unmarked. */
    _markDate(id, value) {
        const empty = value === '' || value === '__.__.____ __:__:__';
        const valid = !(value.includes('_') || parseDate(value, this.opts.datetimeFormat) === 0);
        this.renderer.markField(id, valid || empty);
        return valid;
    }

    // ------------------------------------------------------------------
    // Save points — replaces validateSPParams + updateSavePoints
    // ------------------------------------------------------------------

    updateSavePoints() {
        this.renderer.clearSavePoints();

        const wrong = this._validateSavePointForm();
        if (wrong !== '') {
            this._warnSavePointField(wrong);
            return;
        }

        const form = this.collector.collectSavePointForm();
        const startDTValue = parseDate(form.startDT, this.opts.datetimeFormat);
        const returnDTValue = parseDate(form.returnDT, this.opts.datetimeFormat);
        this.opts.prm.saveStartDT = startDTValue;
        this.opts.prm.saveReturnDT = returnDTValue;
        this.opts.prm.saveOneWay = form.oneWay;
        // The window the user gave covers the whole trip: one leg when the fleet
        // only flies out, two when it comes back. Both the target duration and
        // the tolerance are per leg, so they are split the same way.
        const legs = form.oneWay ? 1 : 2;
        const target = Math.round(Math.ceil((returnDTValue - startDTValue) / 1000) / legs);

        // An unfilled tolerance field leaves the regexp without a match, which
        // is the same as asking for an exact hit.
        const tol = TOLERANCE_RE.exec(form.tolerance);
        const toleranceSeconds = tol ? Number(tol[1]) * 3600 + Number(tol[2]) * 60 : 0;
        const tolerance = Math.round(toleranceSeconds / legs);
        this.opts.prm.saveTolerance = toleranceSeconds;

        const params = this.collector.collectParams(this._state());
        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        const counts = this.collector.collectShipCounts();
        const minSpeed = this._effectiveMinSpeed(ships, counts, params);
        const departure = this.opts.prm.departure;

        const found = this._searchSavePoints(
            { params, ships, counts, minSpeed, departure, target, tolerance, legs, startAt: startDTValue },
            form.startDT);
        if (!found) {
            this.renderer.renderWarning(this.opts.msgNoSavepointsFound);
        }
        this.opts.save();
    }

    /** Sweep galaxies, systems and planets for arrival times within tolerance. */
    _searchSavePoints(ctx, startDT) {
        const { params, departure } = ctx;
        const coordAxes = [
            { limit: params.numberOfGalaxies, table: 'savepoints-galaxies', fmt: (v) => `${v}:xxx:xx`, circular: params.circularGalaxies },
            { limit: params.numberOfSystems, table: 'savepoints-systems', fmt: (v) => `${departure[0]}:${v}:xx`, circular: params.circularSystems },
            { limit: 16, table: 'savepoints-planets', fmt: (v) => `${departure[0]}:${departure[1]}:${v}`, circular: false },
        ];
        const increment = params.playerClass === PLAYER_CLASS.GENERAL ? 5 : 10;
        let haveResults = false;

        coordAxes.forEach((axis, axisIndex) => {
            if (this._searchAxisSavePoints(axis, axisIndex, ctx, increment, startDT)) {
                haveResults = true;
            }
        });

        return haveResults;
    }

    /** Sweeps one coordinate axis (galaxy/system/planet) for save points within tolerance; returns true if any were found. */
    _searchAxisSavePoints(axis, axisIndex, ctx, increment, startDT) {
        const { params, ships, counts, minSpeed, departure, target, tolerance, legs, startAt } = ctx;
        const rows = [];
        const halve = Math.floor(axis.limit / 2);
        let delta = 0;
        while (true) {
            delta++;
            // Past half a ring the fleet would take the short way round, so
            // every farther delta only repeats a trip already listed. A
            // straight axis has no such repeat and runs to its own ends.
            if (axis.circular && delta > halve) {
                break;
            }
            const distance = this._distanceForDelta(axisIndex, delta, departure, params, axis.limit);
            if (distance === 0) {
                break;
            }
            for (let percent = 100; percent > 0; percent -= increment) {
                const duration = this.calc.getFlightDuration(minSpeed, distance, percent, params.fleetSpeedPeaceful);
                if (percent === 100 && duration > target + tolerance) {
                    break;
                }
                if (duration <= target - tolerance || duration >= target + tolerance) {
                    continue;
                }
                const cost = this.calc.getDeutConsumption(ships, counts, distance, duration, params.fleetSpeedPeaceful, params);
                // A one-way fleet is done on landing; a returning one is home
                // after twice the same flight.
                const arriveAt = startAt + duration * 1000 * legs;
                this._collectSavePointRows(rows, axisIndex, delta, departure, axis,
                    { percent, cost, arriveAt });
            }
        }
        rows.sort((a, b) => this.calc.compareSavePoints(
            [a.speedPercent, 0, a.cost], [b.speedPercent, 0, b.cost]));
        this.renderer.renderSavePoints(axis.table, rows, startDT, legs);
        return rows.length > 0;
    }

    /** Distance to the point `delta` steps from departure along one axis, or 0 if out of range. */
    _distanceForDelta(axisIndex, delta, departure, params, limit) {
        const destination = [...departure];
        if (departure[axisIndex] - delta > 0) {
            destination[axisIndex] = departure[axisIndex] - delta;
        } else if (departure[axisIndex] + delta <= limit) {
            destination[axisIndex] = departure[axisIndex] + delta;
        } else {
            return 0;
        }
        return this.calc.getDistance(departure, destination, params).distance;
    }

    /**
     * Build the one or two save-point rows a matching delta produces.
     *
     * Both rows have to sit exactly `delta` steps from the departure, or the
     * arrival time shown here is not the one the first tab computes for that
     * coordinate. On a ring axis the step off the end wraps to the other end —
     * `below + limit` going down, `above - limit` going up — which is `delta`
     * steps the long way round and therefore the same trip.
     *
     * @param {{percent: number, cost: number, arriveAt: number}} match the speed
     *        step that fits the tolerance, its fuel bill and the moment the
     *        fleet lands — at the target on a one-way flight, back home
     *        otherwise (epoch ms).
     */
    _collectSavePointRows(rows, axisIndex, delta, departure, axis, match) {
        const { percent, cost, arriveAt } = match;
        const point = [...departure];
        const added = [];
        const addRow = (coord) => {
            // A wrap can land on the coordinate the other direction already used
            // (an even-sized ring, delta at half of it) — one row is enough.
            if (added.includes(coord)) {
                return;
            }
            added.push(coord);
            point[axisIndex] = coord;
            rows.push({
                speedPercent: percent,
                coordLabel: axis.fmt(coord),
                cost,
                arriveAt,
                point: [...point],
            });
        };
        const below = departure[axisIndex] - delta;
        const above = departure[axisIndex] + delta;

        if (below > 0) {
            addRow(below);
        } else if (axis.circular) {
            addRow(below + axis.limit);
        }

        if (above <= axis.limit) {
            addRow(above);
        } else if (axis.circular) {
            addRow(above - axis.limit);
        }
    }

    /** @returns the id of the first bad field, or '' when the form is usable. */
    _validateSavePointForm() {
        const route = this.collector.collectRoute();
        if (!route.departure.valid) {
            return 'departure-g';
        }
        const params = this.collector.collectParams(this._state());
        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        if (this.calc.getMinSpeed(ships, this.collector.collectShipCounts(), params) === Infinity) {
            return 'esp-probe';
        }

        const form = this.collector.collectSavePointForm();
        const startValid = this._markDate('save-start-datetime', form.startDT);
        if (!startValid) {
            return 'save-start-datetime';
        }
        const returnValid = this._markDate('save-return-datetime', form.returnDT);
        if (!returnValid) {
            return 'save-return-datetime';
        }
        if (parseDate(form.startDT, this.opts.datetimeFormat) > parseDate(form.returnDT, this.opts.datetimeFormat)) {
            return 'return-start';
        }

        if (form.tolerance.includes('_')) {
            this.renderer.markField('save-tolerance-time', form.tolerance === '__:__');
            return 'save-tolerance-time';
        }
        if (form.tolerance === '') {
            return 'save-tolerance-time';
        }
        this.renderer.markField('save-tolerance-time', true);
        return '';
    }

    /**
     * Mirror the save point fields into options.prm and persist them, so an
     * emptied field is still empty after a reload. `_validateSavePointForm´ only
     * paints the fields; the cookie is written from prm, and without this the
     * last searched moment would outlive the field the user has just cleared.
     */
    _syncSavePointFields() {
        const prm = this.opts.prm;
        const form = this.collector.collectSavePointForm();
        prm.saveStartDT = parseDate(form.startDT, this.opts.datetimeFormat);
        prm.saveReturnDT = parseDate(form.returnDT, this.opts.datetimeFormat);
        const tol = TOLERANCE_RE.exec(form.tolerance);
        prm.saveTolerance = tol ? Number(tol[1]) * 3600 + Number(tol[2]) * 60 : 0;
        this.opts.save();
    }

    _warnSavePointField(wrong) {
        // The second moment is an arrival at the target on a one-way search, so
        // the complaints about it have to name the same thing as the label.
        const oneWay = this.collector.checked('save-one-way');
        const messages = {
            'departure-g': this.opts.msgWrongDepartureCoordinates,
            'esp-probe': this.opts.msgNoShips,
            'save-start-datetime': this.opts.msgWrongDepartureTime,
            'save-return-datetime': oneWay ? this.opts.msgWrongArrivalTime : this.opts.msgWrongReturnTime,
            'save-tolerance-time': this.opts.msgWrongTolerance,
            'return-start': oneWay ? this.opts.msgDepartureAfterArrival : this.opts.msgDepartureAfterReturn,
        };
        this.renderer.renderWarning(messages[wrong]);
        const focusId = wrong === 'return-start' ? 'save-start-datetime' : wrong;
        const el = document.getElementById(focusId);
        if (el) {
            el.focus();
        }
    }

    // ------------------------------------------------------------------
    // Fleet and universe storage
    // ------------------------------------------------------------------

    loadFleet(key) {
        const stored = {
            savedShips: [],
            validate: (field, value) => validateNumber(Number.parseFloat(value), 0, Infinity, 0),
        };
        loadFromCookie(key, stored);
        this.opts.prm.ships = Array.from(stored.savedShips);
        SHIPS_BASE.forEach((ship, i) => setVal(`#${ship[0]}`, this.opts.prm.ships[i] ?? 0));
        this.recalc();
    }

    saveFleet(key) {
        saveToCookie(key, { savedShips: this.collector.collectShipCounts() });
    }

    /** Zero every ship count; recalc then empties the flight-times table. */
    clearShips() {
        SHIPS_BASE.forEach((ship) => setVal(`#${ship[0]}`, 0));
        this.recalc();
    }

    // ------------------------------------------------------------------
    // Empty-state shortcuts — take the user to the field that is missing
    // ------------------------------------------------------------------

    /** From the "no ships" message to the first ship count. */
    focusShipCounts() {
        this._revealField(SHIPS_BASE[0][0]);
    }

    /**
     * From the "bad coordinates" message to the offending field. Departure is
     * checked first because it is the one hidden inside a collapsed section,
     * so leading with it costs nothing and leading with the other would leave
     * the real culprit off screen.
     */
    focusInvalidCoordinates() {
        const route = this.collector.collectRoute();
        this._revealField(route.departure.valid ? 'destination-g' : 'departure-g');
    }

    /**
     * Bring a field into view and put the cursor in it, undoing whatever is
     * hiding it: the tab pane it sits on, and the accordion section around that.
     * The focus waits for the expansion to finish: Bootstrap animates the panel's
     * height, and scrolling to a box that is still growing lands in the wrong
     * place.
     */
    _revealField(id) {
        const el = document.getElementById(id);
        if (!el) {
            return;
        }
        this._showTabOf(el);
        const section = el.closest('.accordion-collapse');
        if (section && !section.classList.contains('show')) {
            section.addEventListener('shown.bs.collapse', () => this._scrollTo(el), { once: true });
            // Bootstrap drops show() on a panel that is still animating, and the
            // sibling sections collapse this one the moment another opens. Asking
            // again once that has finished is what makes the shortcut reliable
            // right after the user has opened some other section.
            if (section.classList.contains('collapsing')) {
                section.addEventListener('hidden.bs.collapse',
                    () => bootstrap.Collapse.getOrCreateInstance(section).show(), { once: true });
            } else {
                bootstrap.Collapse.getOrCreateInstance(section).show();
            }
            return;
        }
        this._scrollTo(el);
    }

    /**
     * Bring the tab pane holding `el´ to the front. The panes hide each other,
     * so expanding the section around a field is not enough on its own - a field
     * on a pane that is not active stays undisplayed, and cannot take focus.
     */
    _showTabOf(el) {
        const pane = el.closest('.tab-pane');
        if (!pane || pane.classList.contains('active')) {
            return;
        }
        const tab = document.querySelector(`[role="tab"][data-bs-target="#${pane.id}"]`);
        if (tab) {
            bootstrap.Tab.getOrCreateInstance(tab).show();
        }
    }

    _scrollTo(el) {
        // focus() scrolls on its own, and its idea of "just visible" is not the
        // centred view we want, so the scroll is done by hand afterwards.
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center' });
    }

    loadUniverse(key) {
        const shipsBackup = Array.from(this.opts.prm.ships);
        this.opts.load(key);
        this.opts.prm.ships = shipsBackup;
        this.populateParams();
        this.recalc();
    }

    saveUniverse(key) {
        saveToCookie(key, this.opts.prm);
    }

    // ------------------------------------------------------------------
    // Form population — replaces populateParams
    // ------------------------------------------------------------------

    populateParams() {
        const prm = this.opts.prm;
        setVal('#cmb-drive', prm.driveLevels[0]);
        setVal('#imp-drive', prm.driveLevels[1]);
        setVal('#hyp-drive', prm.driveLevels[2]);
        setVal('#speed-fleet-war', prm.fleetSpeedWar);
        setVal('#speed-fleet-peaceful', prm.fleetSpeedPeaceful);
        setVal('#speed-fleet-holding', prm.fleetSpeedHolding);
        setChecked('#circular-galaxies', prm.circularGalaxies);
        setChecked('#circular-systems', prm.circularSystems);
        setVal('#galaxies-num', prm.numberOfGalaxies);
        setVal('#systems-num', prm.numberOfSystems);
        setVal('#deut-factor', prm.deutFactor);
        setVal('#deut-generals-bonus', prm.deutConsReduction);
        setVal('#departure-g', prm.departure[0]);
        setVal('#departure-s', prm.departure[1]);
        setVal('#departure-p', prm.departure[2]);
        setVal('#destination-g', prm.destination[0]);
        setVal('#destination-s', prm.destination[1]);
        setVal('#destination-p', prm.destination[2]);
        setVal('#hypertech-lvl', prm.hyperTechLvl);
        SHIPS_BASE.forEach((ship, i) => setVal(`#${ship[0]}`, prm.ships[i]));
        setVal('#start-datetime', getDateStr(prm.startDT, this.opts.datetimeFormat));
        setVal('#save-start-datetime', getDateStr(prm.saveStartDT, this.opts.datetimeFormat));
        setVal('#save-return-datetime', getDateStr(prm.saveReturnDT, this.opts.datetimeFormat));
        setVal('#save-tolerance-time', getTimeStr(prm.saveTolerance));
        setVal('#recall-start-datetime', getDateStr(prm.recallStartDT, this.opts.datetimeFormat));
        setVal('#recall-full-flight', getFlightTimeStr(prm.recallFullFlight));
        setVal('#recall-moment', getDateStr(prm.recallMomentDT, this.opts.datetimeFormat));
        setVal('#recall-after', getFlightTimeStr(prm.recallElapsed));
        setChecked(`#recall-mode-${prm.recallMode}`, true);
        setChecked('#save-one-way', prm.saveOneWay);
        this.renderer.renderSavePointMode(prm.saveOneWay);
        setChecked(`#class-${prm.playerClass}`, true);
        setChecked('#trader-bonus', prm.traderBonus);
        setChecked(`#mission-type-${prm.missionType}`, true);
        setNumVal('#sp-cargohold', prm.spCargohold);
        setVal('#lf-mechan-general-enh', prm.lfMechanGE);
        setVal('#lf-rocktal-collector-enh', prm.lfRocktalCE);

        const rows = $$('#lf-ships-bonuses tr');
        prm.lfShipsBonuses.forEach((bonus, i) => {
            const row = rows[i + 1];
            if (row) {
                [0, 1, 2].forEach((j) => { cellInput(row, j + 1).value = localizeFloat(bonus[j]); });
            }
        });
    }

    // ------------------------------------------------------------------
    // Alliance / mode / override toggles
    // ------------------------------------------------------------------

    toggleAllianceBonus(event) {
        const input = event.currentTarget;
        if (input.id === 'trader-bonus' && input.checked) {
            setChecked('#warrior-bonus', false);
        }
        if (input.id === 'warrior-bonus' && input.checked) {
            setChecked('#trader-bonus', false);
            this.opts.prm.traderBonus = false;
        }
        this.recalc();
    }

    toggleSpeedOverride(event) {
        const field = inputEl('#ovr-speed-t');
        if (event.currentTarget.checked) {
            field.disabled = false;
            field.classList.remove('ui-state-disabled');
            this.speedOverride.enabled = true;
            let speed = getInputNumber(field);
            if (speed === 0) {
                speed = 10000;
                field.value = '10000';
            }
            this.speedOverride.speed = speed;
        } else {
            field.disabled = true;
            field.classList.add('ui-state-disabled');
            this.speedOverride.enabled = false;
        }
        this.recalc();
    }

    toggleMode() {
        this.opts.prm.mode = this.opts.prm.mode === 1 ? 0 : 1;
        this.renderer.renderFlightTitles(this.opts.prm.mode);
        this.opts.save();
    }

    /**
     * Switch the save-point search between a one-way flight and a round trip.
     * Rows already on screen were found for the other mode, so they go.
     */
    toggleSaveOneWay() {
        this.opts.prm.saveOneWay = this.collector.checked('save-one-way');
        this.renderer.renderSavePointMode(this.opts.prm.saveOneWay);
        this.renderer.clearSavePoints();
        this.opts.save();
    }

    onEmptySystemsInput(field) {
        const value = getInputNumber(field);
        if (value >= 0) {
            this.emptyOverride = { enabled: true, count: value };
        } else {
            this.emptyOverride.enabled = false;
        }
        this.recalc();
        this.opts.save();
    }

    onDestinationInput() {
        if (this.emptyOverride.enabled) {
            this.emptyOverride.enabled = false;
            setVal('#empty-systems-count-spin', '');
        }
        this.recalc();
    }

    // ------------------------------------------------------------------
    // Arrival calculator — the dynamic list of flight legs
    // ------------------------------------------------------------------

    /**
     * Markup for one flight-leg row: sign toggle, time field, remove button.
     * The first row keeps the id="flight-time" the template shipped with.
     * @param {boolean} first whether this is the leading row
     */
    _legRowHtml(first = false) {
        return '<div class="d-flex align-items-center gap-1 mb-1 flight-leg">'
            + `<button type="button" class="btn btn-sm btn-outline-secondary button-toggle flight-leg-sign" data-sign="+" data-bs-toggle="tooltip" title="${this.opts.toggleSignHint}"><i class="bi bi-plus-lg"></i></button>`
            // The field keeps a native title: it is masked, so a bubble anchored
            // to it would sit over the digits being overtyped.
            + `<input type="text"${first ? ' id="flight-time"' : ''} class="form-control form-control-sm flight-time-input" placeholder="dd hh:mm:ss" title="${this.opts.flightTimeFormatHint}"/>`
            + `<button type="button" class="btn btn-sm btn-outline-danger button-remove" data-bs-toggle="tooltip" title="${this.opts.removeRowHint}"><i class="bi bi-x-lg"></i></button>`
            + '</div>';
    }

    /**
     * Add a leg row. When called from a click it just focuses the last empty
     * row; when called with a number it writes that many seconds (sign included).
     */
    addFlightLeg(arg) {
        const container = document.getElementById('flight-data');
        if (!container) {
            return;
        }
        let last = /** @type {HTMLInputElement|null} */ (
            container.querySelector('.flight-leg:last-child .flight-time-input'));

        // A row that only holds the bare mask skeleton counts as free: clicking
        // the add button leaves the field focused, so it never blurs back to ''.
        if (last && !isMaskBlank(last) && last.value !== '00 00:00:00') {
            container.insertAdjacentHTML('beforeend', this._legRowHtml());
            const row = container.querySelector('.flight-leg:last-child');
            if (row) {
                this._wireLegRow(row);
                last = /** @type {HTMLInputElement|null} */ (row.querySelector('.flight-time-input'));
            }
        }

        if (last) {
            if (typeof arg !== 'object') {
                const seconds = Number(arg);
                last.value = getFlightTimeStr(Math.abs(seconds));
                const sign = seconds < 0 && last.closest('.flight-leg')?.querySelector('.flight-leg-sign');
                if (sign) {
                    this._setLegSign(sign, '-');
                }
            } else {
                last.focus();
            }
        }
        this.updateArrival();
    }

    removeFlightLeg(row) {
        const rows = $$('#flight-data .flight-leg');
        if (rows.length === 1) {
            const input = row.querySelector('.flight-time-input');
            input.value = '';
            this._setLegSign(row.querySelector('.flight-leg-sign'), '+');
        } else {
            FlightOrchestrator._disposeRowTooltips(row);
            row.remove();
        }
        this.updateArrival();
    }

    toggleLegSign(button) {
        this._setLegSign(button, button.dataset.sign === '+' ? '-' : '+');
        this.updateArrival();
    }

    _setLegSign(button, sign) {
        button.dataset.sign = sign;
        button.innerHTML = sign === '-' ? '<i class="bi bi-dash-lg"></i>' : '<i class="bi bi-plus-lg"></i>';
    }

    /**
     * Give every tooltip anchor inside a run-time built row its instance, and
     * take them back before the row is thrown away — a disposed anchor would
     * otherwise leave its bubble on screen pointing at nothing.
     */
    static _initRowTooltips(root) {
        root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) =>
            bootstrap.Tooltip.getOrCreateInstance(el));
    }

    static _disposeRowTooltips(root) {
        root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
            const tip = bootstrap.Tooltip.getInstance(el);
            if (tip) {
                tip.dispose();
            }
        });
    }

    _wireLegRow(row) {
        row.querySelector('.flight-leg-sign').addEventListener('click', (e) => this.toggleLegSign(e.currentTarget));
        row.querySelector('.button-remove').addEventListener('click', (e) => this.removeFlightLeg(e.currentTarget.closest('.flight-leg')));
        FlightOrchestrator._initRowTooltips(row);
        const field = row.querySelector('.flight-time-input');
        attachInputMask(field, this.opts.flightTimeFormat);
        // The mask cancels the native edit and re-fires `input´ itself, so that
        // is the event to listen on rather than keyup.
        field.addEventListener('input', () => this.updateArrival());
        field.addEventListener('blur', () => this.updateArrival());
    }

    /** Throw the leg list away and leave a single empty row behind. */
    _resetLegRows() {
        const container = document.getElementById('flight-data');
        if (!container) {
            return;
        }
        FlightOrchestrator._disposeRowTooltips(container);
        container.innerHTML = this._legRowHtml(true);
        const row = container.querySelector('.flight-leg');
        if (row) {
            this._wireLegRow(row);
        }
    }

    /** Rebuild the leg list from the stored flightData array. */
    restoreFlightLegs() {
        this._resetLegRows();
        const legs = this.opts.prm.flightData.slice();
        legs.forEach((seconds) => this.addFlightLeg(seconds));
        this.updateArrival();
    }

    /** Push one of the flight-times rows into the arrival calculator. */
    takeToCalc(button) {
        const params = this.collector.collectParams(this._state());
        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        const counts = this.collector.collectShipCounts();
        const route = this.collector.collectRoute();
        const distance = this.calc.getDistance(route.departure.coords, route.destination.coords, params).distance;
        // Must match the row the user clicked, so it has to honour the manual
        // speed override and the mission's fixed speed exactly like the
        // flight-times table does.
        const minSpeed = this.calc.speedForMission(params.missionType,
            this._effectiveMinSpeed(ships, counts, params));
        const percentText = button.closest('tr').children[0].textContent;
        const percent = Number.parseInt(percentText, 10);
        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const duration = this.calc.getFlightDuration(minSpeed, distance, percent, fleetSpeed);
        // The picked row belongs to the departure tab on screen, and to that one
        // only: filling the recall panel used to grow a leg row behind the user's
        // back on the tab they were not looking at.
        if (FlightOrchestrator._recallTabActive()) {
            // The recall tab tracks a single outbound flight rather than a list
            // of legs, so a row picked later replaces the one picked before.
            setVal('#recall-full-flight', getFlightTimeStr(duration));
            this.updateRecall();
        } else {
            const sign = this.opts.prm.mode === 1 ? -1 : 1;
            this.addFlightLeg(sign * duration);
        }
        this.opts.save();
    }

    /** Activate a tab of the main tab strip by its id. */
    static _showTab(id) {
        const tab = document.getElementById(id);
        if (tab) {
            bootstrap.Tab.getOrCreateInstance(tab).show();
        }
    }

    /** Is the departure panel showing its Recall tab rather than the plain one? */
    static _recallTabActive() {
        const tab = document.getElementById('recall-tabtag-recall');
        return tab?.classList.contains('active') ?? false;
    }

    // ------------------------------------------------------------------
    // Save-point navigation
    // ------------------------------------------------------------------

    /**
     * Jump to a save point: fill the destination, recalc and seed the legs.
     * @param {number} legs how many flights the point was found for — one for a
     *        one-way search, two for a round trip.
     */
    showFlightTime(point, depTime, speed, legs) {
        FlightOrchestrator._showTab('tabtag1');
        setVal('#destination-g', point[0]);
        setVal('#destination-s', point[1]);
        setVal('#destination-p', point[2]);
        this.opts.prm.destination = point;
        this.recalc();
        setVal('#start-datetime', depTime);

        const params = this.collector.collectParams(this._state());
        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        const counts = this.collector.collectShipCounts();
        const distance = this.calc.getDistance(this.opts.prm.departure, point, params).distance;
        // The save point was found with the overridden speed, so the leg it seeds
        // has to be built the same way.
        const minSpeed = this._effectiveMinSpeed(ships, counts, params);
        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const duration = this.calc.getFlightDuration(minSpeed, distance, speed, fleetSpeed);

        this._resetLegRows();
        for (let i = 0; i < legs; i++) {
            this.addFlightLeg(duration);
        }
        this.updateArrival();
    }

    // ------------------------------------------------------------------
    // Contextual hint under the tabs
    // ------------------------------------------------------------------

    showTabsHint(activeTabId) {
        const isFlightTimes = activeTabId !== 'tabtag2';
        try {
            localStorage.setItem('flight-tab-num', isFlightTimes ? '0' : '1');
        } catch (e) { /* storage disabled */ }
        this.renderer.renderHint(isFlightTimes ? this.opts.flightmodesNote : this.opts.savepointsNote);
    }

    // ------------------------------------------------------------------
    // Reset
    // ------------------------------------------------------------------

    resetParams() {
        const prm = this.opts.prm;
        Object.assign(prm, {
            country: '--', universe: 1, driveLevels: [0, 0, 0],
            circularGalaxies: false, circularSystems: false,
            numberOfGalaxies: 9, numberOfSystems: 499,
            fleetSpeedWar: 1, fleetSpeedPeaceful: 1, fleetSpeedHolding: 1,
            deutFactor: 10, missionType: 1, deutConsReduction: 25,
            departure: [1, 1, 1], destination: [1, 1, 1],
            ships: new Array(15).fill(0),
            startDT: 0, saveStartDT: 0, saveReturnDT: 0, saveTolerance: 0, saveOneWay: false,
            recallStartDT: 0, recallFullFlight: 0, recallMode: 0, recallMomentDT: 0, recallElapsed: 0,
            hyperTechLvl: 0, playerClass: 0, traderBonus: false, spCargohold: 0,
            lfMechanGE: 0, lfRocktalCE: 0,
            lfShipsBonuses: Array.from({ length: 15 }, () => [0, 0, 0]),
            fleetIgnoreEmptySystems: false, fleetIgnoreInactiveSystems: false, flightData: [0],
        });
        setVal('#country', prm.country);
        this.setUniList(prm.country, prm.universe);
        this.populateParams();
        inputsAll('#lf-ships-bonuses input[type=text]').forEach((i) => { i.value = '0'; });
        setVal('#lf-mechan-general-enh', 0);
        setVal('#lf-rocktal-collector-enh', 0);
        setVal('#api-code', '');
        setChecked('#mission-type-1', true);
        setVal('#start-datetime', '');
        setVal('#save-start-datetime', '');
        setVal('#save-return-datetime', '');
        setVal('#save-tolerance-time', '');
        this.emptyOverride = { enabled: false, count: 0 };
        const label = document.getElementById('empty-systems-label');
        if (label) {
            label.style.display = 'none';
        }
        this.renderer.clearSavePoints();
        this.restoreFlightLegs();
        this.recalc();
        this.updateArrival();
        this.updateRecall();
    }

    // ------------------------------------------------------------------
    // Server data — universe list, fleet speeds, populated systems
    // ------------------------------------------------------------------

    setUniList(lang, uni) {
        const universeEl = selectEl('#universe');
        universeEl.innerHTML = '';
        const list = (typeof unis !== 'undefined' && unis[lang]) || [];

        if (!list.some((item) => item[0] == uni)) {
            uni = null;
            this.opts.universe = null;
            this.opts.save();
            setVal('#empty-systems-count-spin', '');
            const label = document.getElementById('empty-systems-label');
            if (label) {
                label.style.display = 'none';
            }
        }
        list.forEach((item) => {
            const option = document.createElement('option');
            option.value = item[0];
            option.textContent = item[1];
            universeEl.appendChild(option);
        });
        universeEl.value = uni;
        this.fetchServerData();
        this.getPopulatedSystemsInfo();
    }

    async fetchServerData() {
        const { country, universe } = this.collector.collectServer();
        // collectServer reads the select through the collector's text(), which
        // substitutes '' for a missing element - the empty string is the only
        // "nothing selected" value that can arrive here.
        if (universe === '') {
            return;
        }
        this._showOverlay('general-settings-panel', this.opts.dataFetchMsg);
        try {
            const json = await apiGet('serverdata', { country, universe });
            this._selectOption('speed-fleet-war', json.speedFleetWar);
            this._selectOption('speed-fleet-peaceful', json.speedFleetPeaceful);
            this._selectOption('speed-fleet-holding', json.speedFleetHolding);
            // donutGalaxy is the ring over the galaxy axis, donutSystem the one
            // over the systems — each drives the checkbox of its own axis.
            setChecked('#circular-galaxies', json.donutGalaxy == 1);
            setChecked('#circular-systems', json.donutSystem == 1);
            setVal('#systems-num', json.systems);
            setVal('#galaxies-num', json.galaxies);
            setVal('#sp-cargohold', json.probeCargo);
            this._selectOption('deut-factor', frac(json.globalDeuteriumSaveFactor * 10, 0));
            this._selectOption('deut-generals-bonus', frac(json.warriorBonusFuelConsumption * 100, 0));
            this.opts.prm.fleetIgnoreEmptySystems = json.fleetIgnoreEmptySystems === '1';
            this.opts.prm.fleetIgnoreInactiveSystems = json.fleetIgnoreInactiveSystems === '1';
            this._applySystemSkipState();
            if (this._skipsSystems()) {
                setVal('#empty-systems-count-spin', 0);
            }
            this.recalc();
        } catch (error) {
            consoleLog('fetch error: ' + error);
            // Nobody asked for this request, so it fails without an alert - but
            // silence would leave the panel showing defaults that look loaded.
            showToast(this.opts.serverDataFailedMsg, 'danger');
        } finally {
            this._hideOverlay('general-settings-panel');
        }
    }

    /**
     * True when the universe lets the fleet skip some systems, by either setting.
     * As soon as one of them is on the calculator needs the populated-systems
     * data and shows the count field.
     */
    _skipsSystems() {
        return this.opts.prm.fleetIgnoreEmptySystems || this.opts.prm.fleetIgnoreInactiveSystems;
    }

    /**
     * Reveals or hides the skipped-systems field to match the universe settings,
     * and loads the map the count is computed from. The manual override only
     * makes sense while the field is visible, so it is dropped on the way out.
     */
    _applySystemSkipState() {
        const label = document.getElementById('empty-systems-label');
        if (this._skipsSystems()) {
            this.getPopulatedSystemsInfo();
            if (label) {
                label.style.display = '';
            }
        } else {
            this.emptyOverride.enabled = false;
            if (label) {
                label.style.display = 'none';
            }
        }
    }

    async getPopulatedSystemsInfo() {
        if (!this._skipsSystems()) {
            return;
        }
        const { country, universe } = this.collector.collectServer();
        // collectServer reads the select through the collector's text(), which
        // substitutes '' for a missing element - the empty string is the only
        // "nothing selected" value that can arrive here.
        if (universe === '') {
            return;
        }
        const key = `populated_systems_data_${country}_${universe}`;
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            try {
                const json = JSON.parse(stored);
                // Age is counted from the moment the answer was cached, not from
                // the timestamp inside it: that one belongs to Gameforge's
                // universe.xml, which is already days old by the time the server
                // job reads it, so a short TTL measured against it would expire
                // every entry immediately. Entries cached before this field
                // existed have no cachedAt and are refetched once.
                if (json.cachedAt && (Date.now() - json.cachedAt) <= POPULATED_SYSTEMS_TTL_MS) {
                    this.populatedSystems = json.populatedSystems;
                    this.populatedSystemsAll = json.populatedSystemsAll ?? null;
                    return;
                }
            } catch (e) {
                consoleLog('parse exception: ' + e);
            }
        }
        this._showOverlay('general-settings-panel', this.opts.dataFetchMsg);
        try {
            const json = await apiGet('populatedSystems', { country, universe });
            localStorage.setItem(key, JSON.stringify({ ...json, cachedAt: Date.now() }));
            this.populatedSystems = json.populatedSystems;
            this.populatedSystemsAll = json.populatedSystemsAll ?? null;
        } catch (error) {
            consoleLog('fetch error: ' + error);
            // A universe with no row of its own is normal, and the flight is
            // still computed - just without any system counted as skipped.
            showToast(this.opts.populatedSystemsFailedMsg, 'warning');
        } finally {
            this._hideOverlay('general-settings-panel');
        }
    }

    _selectOption(id, value) {
        const el = selectEl(`#${id}`);
        if (el) {
            el.value = String(value);
        }
    }

    // ------------------------------------------------------------------
    // API import — SR code and OGame own-api export
    // ------------------------------------------------------------------

    /**
     * The answer is the report itself: the server checks the log server's
     * envelope and hands over its RESULT_DATA, so there is nothing left to
     * validate here - an unusable answer never reaches this point.
     */
    async importSR(code) {
        if (!code || code.trim() === '') {
            await showAlertModal(this.opts.emptySRCodeMsg, this.opts.dialogOk);
            return;
        }
        this._showOverlay('general-settings-panel', this.opts.dataFetchMsg);
        try {
            const rd = await apiGet('ogameAPI', { code });
            this._applySRResult(code, rd);
            this.recalc();
        } catch (e) {
            consoleLog('SR import failed: ' + e);
            await showAlertModal(e instanceof ApiError && e.code === 'sr_not_found'
                ? this.opts.badSRCode
                : this.opts.importFailedMsg, this.opts.dialogOk);
        } finally {
            this._hideOverlay('general-settings-panel');
        }
    }

    _applySRResult(code, rd) {
        setVal('#api-code', code);
        setVal('#country', rd.universes.domain);
        this.setUniList(rd.universes.domain, rd.universes.universe);
        this._selectOption('speed-fleet-war', rd.universes.speedFleetWar);
        this._selectOption('speed-fleet-peaceful', rd.universes.speedFleetPeaceful);
        this._selectOption('speed-fleet-holding', rd.universes.speedFleetHolding);

        const dep = rd.generic.defender_planet_coordinates.split(':');
        setVal('#departure-g', dep[0]);
        setVal('#departure-s', dep[1]);
        setVal('#departure-p', dep[2]);

        const classMap = { 1: 'class-0', 2: 'class-1', 3: 'class-2' };
        if (classMap[rd.generic.defender_character_class_id]) {
            setChecked(`#${classMap[rd.generic.defender_character_class_id]}`, true);
        }
        if (rd.generic.defender_alliance_class_id == 2) {
            setChecked('#trader-bonus', true);
        }
        setChecked('#circular-galaxies', rd.universes.donutGalaxy == 1);
        setChecked('#circular-systems', rd.universes.donutSystem == 1);
        setVal('#systems-num', rd.universes.systems);
        setVal('#galaxies-num', rd.universes.galaxies);
        setVal('#sp-cargohold', rd.universes.probeCargo);
        this._selectOption('deut-factor', rd.universes.globalDeuteriumSaveFactor * 10);
        this._selectOption('deut-generals-bonus', rd.universes.warriorBonusFuelConsumption * 10);
        this.opts.prm.fleetIgnoreEmptySystems = rd.universes.fleetIgnoreEmptySystems === '1';
        this.opts.prm.fleetIgnoreInactiveSystems = rd.universes.fleetIgnoreInactiveSystems === '1';
        // The import can move the fleet to a universe with different settings, so
        // the count field and the map behind it follow the same rules as a manual
        // universe change.
        this._applySystemSkipState();

        (rd.details.research || []).forEach((v) => {
            const mapped = FLIGHT_RESEARCH_MAPPING.find(([id]) => id == v.research_type);
            if (mapped) setVal(`#${mapped[1]}`, v.level);
        });

        const booster = rd.details?.lifeformBonuses?.CharacterClassBooster;
        FLIGHT_BOOSTER_MAPPING.forEach(([, name]) => setVal(`#${name}`, 0));
        if (booster) {
            Object.entries(booster).forEach(([i, v]) => {
                const mapped = FLIGHT_BOOSTER_MAPPING.find(([index]) => index === i);
                if (mapped) setNumVal(`#${mapped[1]}`, bonusPercent(v, OWN_API_BONUS_DIGITS.cargo));
            });
        }

        this._applyPerShipBonuses(rd.details.combatInformation.ships);
        FLIGHT_TECH_MAPPING.forEach(([, name]) => setVal(`#${name}`, 0));
        Object.entries(rd.details.ships || {}).forEach(([, v]) => {
            if (v.count && v.ship_type) {
                const mapped = FLIGHT_TECH_MAPPING.find((m) => m[0] == v.ship_type);
                if (mapped) {
                    setVal(`#${mapped[1]}`, v.count);
                }
            }
        });
    }

    /**
     * Write the per-ship bonuses a spy report carries. The report states them as
     * the same fractions the API 2 export uses, so the conversion is shared.
     */
    _applyPerShipBonuses(ships) {
        Object.entries(ships || {}).forEach(([id, v]) => {
            this._setClassVal(`${id}-speed`, localizeFloat(bonusPercent(v.speed, OWN_API_BONUS_DIGITS.speed)));
            this._setClassVal(`${id}-cargo`, localizeFloat(bonusPercent(v.cargo, OWN_API_BONUS_DIGITS.cargo)));
            this._setClassVal(`${id}-fuel`, localizeFloat(bonusPercent(v.fuel, OWN_API_BONUS_DIGITS.fuel)));
        });
    }

    _setClassVal(className, value) {
        // Attribute selector, not `.${className}` — these classes start with a
        // digit (e.g. "202-speed"), which is an invalid CSS class selector.
        inputsAll(`[class~="${className}"]`).forEach((el) => { el.value = value; });
    }

    async importOwnApi(jsonText) {
        const data = parseOwnApi(jsonText);
        if (!data || !this._isUsableOwnApiPayload(data)) {
            await showAlertModal(this.opts.ownApiBadJsonMsg, this.opts.dialogOk);
            return false;
        }
        const importCoords = getChecked('#own-api-import-coords');
        const importClass = getChecked('#own-api-import-class');
        const importResearch = getChecked('#own-api-import-research');
        const importShips = getChecked('#own-api-import-ships');
        const importLifeforms = getChecked('#own-api-import-lifeforms');
        try {
            if (importCoords && data.coords) this._importOwnApiCoords(data.coords);
            if (importClass) this._importOwnApiClass(data);
            if (importResearch) this._importOwnApiResearch(data);
            // Guarded, not unconditional: the method zeroes both fields before it
            // writes, so an export without boosters must not reach it.
            if (importLifeforms && Object.keys(data.classBoosters).length) this._importOwnApiLifeformBoosters(data);
            this._resetOwnApiShipFields(importShips, importLifeforms);
            if (importShips || importLifeforms) this._importOwnApiShips(data, importShips, importLifeforms);
            this.recalc();
        } catch (e) {
            consoleLog('own api import exception: ' + e);
            await showAlertModal(this.opts.ownApiBadJsonMsg, this.opts.dialogOk);
            return false;
        }
        return true;
    }

    /**
     * True when the export carries at least one thing this calculator imports.
     * A JSON object that holds none of them parses fine yet has nothing to give.
     *
     * The blocks are matched against the ids this page has fields for, not just
     * counted: the export lists the solar satellite, the crawler and the whole
     * defense under `ships`, so a non-empty block is no proof of an importable
     * fleet. Accepting one would wipe every ship count and bonus field - the
     * import clears them before it writes - and report that as a success.
     *
     * @param {OwnApiPayload} data
     */
    _isUsableOwnApiPayload(data) {
        return !!data.coords || data.characterClassId > 0 ||
            FLIGHT_RESEARCH_MAPPING.some(([id]) => data.researches[id] !== undefined) ||
            FLIGHT_BOOSTER_MAPPING.some(([index]) => data.classBoosters[index] !== undefined) ||
            FLIGHT_TECH_MAPPING.some(([id]) => data.ships[id] !== undefined);
    }

    /** @param {OwnApiCoords} coords */
    _importOwnApiCoords(coords) {
        setVal('#departure-g', coords.galaxy);
        setVal('#departure-s', coords.system);
        setVal('#departure-p', coords.position);
    }

    /** @param {OwnApiPayload} data */
    _importOwnApiClass(data) {
        const classMap = { 1: 'class-0', 2: 'class-1', 3: 'class-2' };
        if (classMap[data.characterClassId]) {
            inputsAll('input[name="class"]').forEach((r) => { r.checked = false; });
            setChecked(`#${classMap[data.characterClassId]}`, true);
        }
        const isTrader = data.allianceClassId === 2;
        setChecked('#trader-bonus', isTrader);
        if (isTrader) {
            setChecked('#warrior-bonus', false);
        }
    }

    /** @param {OwnApiPayload} data */
    _importOwnApiResearch(data) {
        FLIGHT_RESEARCH_MAPPING.forEach(([id, name]) => {
            const level = data.researches[id];
            if (level !== undefined) setVal(`#${name}`, level);
        });
    }

    /** @param {OwnApiPayload} data */
    _importOwnApiLifeformBoosters(data) {
        FLIGHT_BOOSTER_MAPPING.forEach(([index, name]) => {
            setVal(`#${name}`, 0);
            const percent = data.classBoosters[index];
            if (percent !== undefined) setNumVal(`#${name}`, percent);
        });
    }

    _resetOwnApiShipFields(importShips, importLifeforms) {
        FLIGHT_TECH_MAPPING.forEach(([techId, name]) => {
            if (importShips) setVal(`#${name}`, 0);
            if (importLifeforms) {
                this._setClassVal(`${techId}-speed`, 0);
                this._setClassVal(`${techId}-cargo`, 0);
                this._setClassVal(`${techId}-fuel`, 0);
            }
        });
    }

    /**
     * @param {OwnApiPayload} data
     * @param {boolean} importShips
     * @param {boolean} importLifeforms
     */
    _importOwnApiShips(data, importShips, importLifeforms) {
        Object.entries(data.ships).forEach(([id, ship]) => {
            const mapped = FLIGHT_TECH_MAPPING.find((m) => m[0] == id);
            if (!mapped) return;
            if (importShips) setVal(`#${mapped[1]}`, ship.amount);
            if (importLifeforms) this._applyOwnApiShipLifeformBonuses(id, ship);
        });
    }

    /**
     * The percentages arrive rounded from parseOwnApi(), so the only thing left
     * to do here is swap in the decimal separator the locale expects.
     *
     * @param {string} id Ship tech id.
     * @param {OwnApiShip} ship
     */
    _applyOwnApiShipLifeformBonuses(id, ship) {
        this._setClassVal(`${id}-speed`, localizeFloat(ship.speed));
        this._setClassVal(`${id}-cargo`, localizeFloat(ship.cargo));
        this._setClassVal(`${id}-fuel`, localizeFloat(ship.fuel));
    }

    /** Parse the pasted lifeform-bonuses report into the per-ship bonus table. */
    async readShipsBonuses() {
        const lines = /** @type {HTMLTextAreaElement} */ (document.getElementById('lf-bonuses-txtarea')).value.split('\n');
        const scName = this.opts.smallCargoName.toLowerCase();
        const scLine = lines.findIndex((line) => line.toLowerCase().includes(scName));
        if (scLine === -1) {
            await showAlertModal(this.opts.missingSCName.replace('sc_name', this.opts.smallCargoName), this.opts.dialogOk);
            return false;
        }
        try {
            const bonuses = this.opts.prm.lfShipsBonuses;
            let j = 0;
            for (let i = 0; i < 17; i++) {
                bonuses[j][0] = Number.parseFloat(lines[scLine + i * 8 + 4].replace('%', '').replace('-', '0'));
                bonuses[j][1] = Number.parseFloat(lines[scLine + i * 8 + 5].replace('%', '').replace('-', '0'));
                bonuses[j][2] = Number.parseFloat(lines[scLine + i * 8 + 6].replace('%', '').replace('-', '0'));
                if (i === 9 || i === 13) i++; // skip the crawler and the lamp
                j++;
            }
            const rows = $$('#lf-ships-bonuses tr');
            bonuses.forEach((bonus, i) => {
                const row = rows[i + 1];
                if (row) {
                    // Same cells populateParams fills, so they take the same
                    // locale-aware write: a raw "1.5" would lose its separator
                    // to the numeric blur validator in a comma locale.
                    [0, 1, 2].forEach((k) => { cellInput(row, k + 1).value = localizeFloat(bonus[k]); });
                }
            });
        } catch (e) {
            await showAlertModal(String(e), this.opts.dialogOk);
            return false;
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Loading overlay
    // ------------------------------------------------------------------

    // Overlays are reference-counted: several requests can be in flight over the
    // same panel (an SR import re-fills the universe list, which refetches the
    // server data), and the first one to finish must not uncover the panel.
    _showOverlay(elementId, text) {
        const panel = document.getElementById(elementId);
        if (!panel) {
            return;
        }
        this._overlayCount ??= {};
        this._overlayCount[elementId] = (this._overlayCount[elementId] || 0) + 1;
        if (this._overlayCount[elementId] > 1) {
            return;
        }
        panel.classList.add('loading');
        panel.insertAdjacentHTML('beforeend',
            `<div class="panel-overlay"><div class="panel-overlay-content">${text}</div></div>`);
    }

    _hideOverlay(elementId) {
        const panel = document.getElementById(elementId);
        if (!panel) {
            return;
        }
        this._overlayCount ??= {};
        this._overlayCount[elementId] = Math.max(0, (this._overlayCount[elementId] || 0) - 1);
        if (this._overlayCount[elementId] > 0) {
            return;
        }
        panel.classList.remove('loading');
        panel.querySelectorAll('.panel-overlay').forEach((o) => o.remove());
    }

    // ------------------------------------------------------------------
    // init — wires the whole page (replaces the legacy jQuery(...) block)
    // ------------------------------------------------------------------

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('SR_KEY')) {
            this.importSR(urlParams.get('SR_KEY'));
        }

        this.opts.load('options_flight');
        this.populateParams();
        this._initMasks();
        this._initSpeedOverride();
        this._setInputConstraints();
        this._populateStorageSelects();
        this._bindControls();
        this._bindInputs();
        this._bindStorageButtons();
        this._bindModals();
        this._bindTabs();
        this._bindTheme();

        // Restore the display mode and the flight legs from the cookie
        this.opts.prm.mode = this.opts.prm.mode === 0 ? 1 : 0;
        this.toggleMode();
        this.restoreFlightLegs();
        // Settles which recall fields are reachable for the restored state.
        this.updateRecall();

        this._restoreActiveTab();

        if (this._skipsSystems()) {
            const label = document.getElementById('empty-systems-label');
            if (label) {
                label.style.display = '';
            }
        }
        this.recalc();
    }

    /**
     * Give every date, duration and tolerance field its overtype mask. The leg
     * rows are built at run time, so _wireLegRow masks each new one as well.
     */
    _initMasks() {
        ['start-datetime', 'save-start-datetime', 'save-return-datetime',
            'recall-start-datetime', 'recall-moment'].forEach((id) =>
            attachInputMask(/** @type {HTMLInputElement} */ (document.getElementById(id)), this.opts.datetimeFormat));
        attachInputMask(inputEl('#save-tolerance-time'), this.opts.toleranceTimeFormat);
        inputsAll('input.flight-time-input').forEach((el) =>
            attachInputMask(el, this.opts.flightTimeFormat));
    }

    _initSpeedOverride() {
        this.speedOverride = { enabled: false, speed: 10000 };
        const field = inputEl('#ovr-speed-t');
        field.disabled = true;
        // min 0, not 1: a 0 must reach the toggle so it can fall back to 10000,
        // instead of the blur validator clamping it up to 1 first.
        field._constrains = { min: 0, def: 10000, max: 1000000000 };
        const toggle = document.getElementById('ovr-speed-cb');
        if (toggle) {
            toggle.addEventListener('click', (e) => this.toggleSpeedOverride(e));
        }
    }

    _setInputConstraints() {
        document.querySelectorAll('#lf-ships-bonuses input[type=text]').forEach((el) => {
            el._constrains = { min: 0, max: Infinity, def: 0, allowFloat: true, allowNegative: false };
        });
        ['lf-mechan-general-enh', 'lf-rocktal-collector-enh'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el._constrains = { min: 0, max: Infinity, def: 0, allowFloat: true, allowNegative: false };
            }
        });
        this._setCoordConstraint('departure-g', 12); this._setCoordConstraint('destination-g', 12);
        this._setCoordConstraint('departure-s', 550); this._setCoordConstraint('destination-s', 550);
        this._setCoordConstraint('departure-p', 16); this._setCoordConstraint('destination-p', 16);
    }

    _bindControls() {
        const on = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, handler);
            }
        };
        on('reset', 'click', () => this.resetParams());
        on('clear-ships', 'click', () => this.clearShips());
        on('set-departure-now', 'click', () => this.setDepartureNow());
        on('set-departure-zero', 'click', () => this.setDepartureZero());
        on('set-save-departure-now', 'click', () => this.setSaveDepartureNow());
        on('set-recall-departure-now', 'click', () => this.setRecallDepartureNow());
        on('set-recall-departure-zero', 'click', () => this.setRecallDepartureZero());
        on('add-flight-time', 'click', () => this.addFlightLeg({}));
        on('toggle-mode', 'click', () => this.toggleMode());
        on('warrior-bonus', 'click', (e) => this.toggleAllianceBonus(e));
        on('trader-bonus', 'click', (e) => this.toggleAllianceBonus(e));
        on('calculate-savepoints', 'click', () => this.updateSavePoints());
        on('save-one-way', 'change', () => this.toggleSaveOneWay());
        // The masked fields cancel the native edit and re-fire `input´ themselves,
        // so that is the event to listen on rather than keyup.
        on('start-datetime', 'input', () => this.updateArrival());
        on('start-datetime', 'blur', () => this.updateArrival());
        // `recall-full-flight´ is disabled, so it only ever sees the `input´
        // event take-to-calc dispatches on it by hand.
        ['recall-start-datetime', 'recall-moment', 'recall-after', 'recall-full-flight'].forEach((id) => {
            on(id, 'input', () => this.updateRecall());
            on(id, 'blur', () => this.updateRecall(true));
        });
        document.querySelectorAll('input[name="recall-mode"]').forEach((el) =>
            el.addEventListener('change', () => this.updateRecall()));
        ['save-start-datetime', 'save-return-datetime', 'save-tolerance-time'].forEach((id) => {
            const onEdit = () => {
                this._validateSavePointForm();
                this._syncSavePointFields();
            };
            on(id, 'input', onEdit);
            on(id, 'blur', onEdit);
        });
        on('flight-times-goto-ships', 'click', () => this.focusShipCounts());
        on('flight-times-goto-coords', 'click', () => this.focusInvalidCoordinates());
        on('empty-systems-count-spin', 'input', (e) => this.onEmptySystemsInput(e.currentTarget));
        ['destination-g', 'destination-s', 'destination-p'].forEach((id) =>
            on(id, 'input', () => this.onDestinationInput()));

        document.querySelectorAll('.button-taketocalc').forEach((btn) =>
            btn.addEventListener('click', (e) => this.takeToCalc(e.currentTarget)));
        const firstLeg = $('#flight-data .flight-leg');
        if (firstLeg) {
            this._wireLegRow(firstLeg);
        }

        // Save-point coordinate links are rendered dynamically; delegate their clicks.
        const spTables = document.getElementById('save-points-tables');
        if (spTables) {
            spTables.addEventListener('click', (e) => {
                const link = /** @type {HTMLElement|null} */ (
                    /** @type {HTMLElement} */ (e.target).closest('.save-point-link'));
                if (!link) {
                    return;
                }
                e.preventDefault();
                this.showFlightTime(
                    (link.dataset.point ?? '').split(',').map(Number),
                    link.dataset.start,
                    Number(link.dataset.speed),
                    Number(link.dataset.legs));
            });
        }
    }

    _bindInputs() {
        // Skip the name/api fields and every date/time field: the numeric
        // validator would strip the separators out of a date or duration.
        const skipIds = new Set(['universe-name', 'fleet-name', 'api-code']);
        const skipClasses = ['startdate-input', 'tolerance-time-input', 'flight-time-input'];
        const isNumeric = (el) => !skipIds.has(el.id)
            && !skipClasses.some((cls) => el.classList.contains(cls));
        document.querySelectorAll('#flight input[type=text]').forEach((el) => {
            if (!isNumeric(el)) {
                return;
            }
            el.addEventListener('keyup', function () {
                validateInputNumber({ currentTarget: this });
            });
            el.addEventListener('keyup', () => this.recalc());
            el.addEventListener('blur', function () {
                validateInputNumberOnBlurNative({ currentTarget: this });
            });
            el.addEventListener('blur', () => this.recalc());
        });
        document.querySelectorAll('#flight select').forEach((el) => {
            el.addEventListener('change', () => this.recalc());
        });
        document.querySelectorAll('input[name="class"], input[name="mission-type"]').forEach((el) => {
            el.addEventListener('change', () => this.recalc());
        });
        ['circular-systems', 'circular-galaxies'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => this.recalc());
            }
        });
    }

    _bindStorageButtons() {
        const confirmed = (msg) => showConfirmModal(msg, this.opts.dialogConfirm, this.opts.cancel);
        const on = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', handler);
            }
        };
        on('universe-load', async () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { await showAlertModal(this.opts.noUniSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.uniLoadConfMsg)) { this.loadUniverse(key); }
        });
        on('universe-save', async () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { await showAlertModal(this.opts.noUniSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.uniOwrConfMsg)) { this.saveUniverse(key); }
        });
        on('universe-delete', async () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { await showAlertModal(this.opts.noUniSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.uniDelConfMsg)) { this._removeStorageOption('universe-name-select', key); }
        });
        on('universe-add', () => this._addStorageEntry('universe-name', 'universe-name-select', 'flight_uni_', this.opts.noUniNameMsg, (key) => this.saveUniverse(key)));

        on('fleet-load', async () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { await showAlertModal(this.opts.noFleetSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.fleetLoadConfMsg)) { this.loadFleet(key); }
        });
        on('fleet-save', async () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { await showAlertModal(this.opts.noFleetSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.fleetOwrConfMsg)) { this.saveFleet(key); }
        });
        on('fleet-delete', async () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { await showAlertModal(this.opts.noFleetSelectedMsg, this.opts.dialogOk); return; }
            if (await confirmed(this.opts.fleetDelConfMsg)) { this._removeStorageOption('fleet-name-select', key); }
        });
        on('fleet-add', () => this._addStorageEntry('fleet-name', 'fleet-name-select', 'flight_fleet_', this.opts.noFleetNameMsg, (key) => this.saveFleet(key)));

        on('api-get', () => this.importSR(getVal('#api-code')));

        selectEl('#country')?.addEventListener('change', function () {
            const self = window.flightOrchestrator;
            self.opts.prm.country = /** @type {HTMLSelectElement} */ (this).value;
            self.opts.prm.fleetIgnoreEmptySystems = false;
            self.opts.prm.fleetIgnoreInactiveSystems = false;
            self.setUniList(this.value, self.opts.prm.universe);
            self.recalc();
            self.opts.save();
        });
        selectEl('#universe')?.addEventListener('change', function () {
            const self = window.flightOrchestrator;
            self.opts.prm.universe = this.value;
            self.fetchServerData();
            self.recalc();
            self.opts.save();
        });
    }

    async _addStorageEntry(inputId, selectId, prefix, emptyMsg, saver) {
        const input = inputEl(`#${inputId}`);
        const name = input.value.trim();
        if (name.length === 0) {
            await showAlertModal(emptyMsg, this.opts.dialogOk);
            input.focus();
            return;
        }
        const clean = stripHTMLTags(name);
        const key = prefix + clean;
        saver(key);
        const select = selectEl(`#${selectId}`);
        select.appendChild(new Option(clean, key));
        select.value = key;
        input.value = '';
    }

    _removeStorageOption(selectId, key) {
        localStorage.removeItem(key);
        const option = document.querySelector(`#${selectId} option[value="${key}"]`);
        if (option) {
            option.remove();
        }
        selectEl(`#${selectId}`).value = '0';
    }

    _populateStorageSelects() {
        const fill = (prefix, selectId) => {
            /** @type {string[]} */
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.includes(prefix)) {
                    keys.push(key);
                }
            }
            // The names are user typed, so order them the way the reader's
            // language does rather than by code point.
            keys.sort((a, b) => a.replace(prefix, '').localeCompare(b.replace(prefix, '')));
            const select = selectEl(`#${selectId}`);
            keys.forEach((key) => select.appendChild(new Option(key.replace(prefix, ''), key)));
        };
        fill('flight_uni_', 'universe-name-select');
        fill('flight_fleet_', 'fleet-name-select');
    }

    _bindModals() {
        const openLfbr = document.getElementById('open-lfbr');
        if (openLfbr) {
            openLfbr.addEventListener('click', () => {
                setVal('#lf-bonuses-txtarea', '');
                show('#lf-bonuses-reader');
            });
        }
        const lfRead = document.getElementById('lf-bonuses-read-btn');
        if (lfRead) {
            lfRead.addEventListener('click', async () => {
                if (await this.readShipsBonuses()) {
                    hide('#lf-bonuses-reader');
                    this.recalc();
                }
            });
        }
        const importBtn = document.getElementById('import-own-api');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                setVal('#own-api-input', '');
                show('#own-api-reader');
            });
        }
        const ownApiRead = document.getElementById('own-api-read-btn');
        if (ownApiRead) {
            ownApiRead.addEventListener('click', async () => {
                if (await this.importOwnApi(getVal('#own-api-input'))) {
                    hide('#own-api-reader');
                }
            });
        }
    }

    _bindTabs() {
        document.querySelectorAll('#tabs button[data-bs-toggle="tab"]').forEach((btn) => {
            btn.addEventListener('shown.bs.tab', (e) => this.showTabsHint(/** @type {HTMLElement} */ (e.target).id));
        });
    }

    _restoreActiveTab() {
        let tabNum = '0';
        try {
            tabNum = localStorage.getItem('flight-tab-num') ?? '0';
        } catch (e) { /* storage disabled */ }
        const tabId = String(tabNum) === '1' ? 'tabtag2' : 'tabtag1';
        FlightOrchestrator._showTab(tabId);
        this.showTabsHint(tabId);
    }

    _bindTheme() {
        const theme = { value: 'light', validate: (key, val) => val };
        loadFromCookie('theme', theme);
        toggleLightBS(theme.value === 'light');
        const cb = inputEl('#cb-light-theme');
        if (cb) {
            cb.addEventListener('click', () => { toggleLightBS(cb.checked); });
        }
    }

    // ------------------------------------------------------------------
    // Departure-time shortcuts
    // ------------------------------------------------------------------

    setDepartureNow() {
        this.opts.prm.startDT = Date.now();
        setVal('#start-datetime', getDateStr(this.opts.prm.startDT, this.opts.datetimeFormat));
        this.updateArrival();
    }

    setDepartureZero() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        this.opts.prm.startDT = d.getTime();
        setVal('#start-datetime', getDateStr(this.opts.prm.startDT, this.opts.datetimeFormat));
        this.updateArrival();
    }

    setSaveDepartureNow() {
        this.opts.prm.saveStartDT = Date.now();
        setVal('#save-start-datetime', getDateStr(this.opts.prm.saveStartDT, this.opts.datetimeFormat));
        this.opts.save();
    }
}

/** "DD HH:MM:SS" for a positive number of seconds; empty string when negative. */
function getFlightTimeStr(seconds) {
    if (seconds < 0) {
        return '';
    }
    const d = strPad(Math.floor(seconds / 86400), 2, '0', 'STR_PAD_LEFT');
    seconds %= 86400;
    const h = strPad(Math.floor(seconds / 3600), 2, '0', 'STR_PAD_LEFT');
    seconds %= 3600;
    const m = strPad(Math.floor(seconds / 60), 2, '0', 'STR_PAD_LEFT');
    seconds %= 60;
    const s = strPad(seconds, 2, '0', 'STR_PAD_LEFT');
    return `${d} ${h}:${m}:${s}`;
}

/**
 * Strip any HTML tags from a user-entered universe/fleet name.
 *
 * Two passes: whole tags first, then any `<` left over. The name is
 * concatenated into innerHTML, and an unterminated `<img src=x onerror=...`
 * used to pass through the single pass untouched, to be completed by whatever
 * markup followed it. Dropping the bare `<` keeps the rest of a benign name
 * such as `Fleet <3` instead of truncating it there.
 */
function stripHTMLTags(input) {
    return input.replace(/<[^<>]*>/g, '').replaceAll('<', '');
}

// Maps OGame shipyard numeric IDs to the ship count input ids. Shared by the SR
// importer and the OGame-export importer.
const FLIGHT_TECH_MAPPING = [
    [202, 'small-cargo'], [203, 'large-cargo'], [204, 'light-fighter'],
    [205, 'heavy-fighter'], [206, 'cruiser'], [207, 'battleship'],
    [208, 'colony-ship'], [209, 'recycler'], [210, 'esp-probe'],
    [211, 'bomber'], [213, 'destroyer'], [214, 'death-star'],
    [215, 'battlecruiser'], [218, 'reaper'], [219, 'pathfinder'],
];

// The researches this page has a field for. Both importers read them, and the
// API 2 import also decides by this list whether an export has anything to give.
const FLIGHT_RESEARCH_MAPPING = [
    [114, 'hypertech-lvl'], [115, 'cmb-drive'], [117, 'imp-drive'], [118, 'hyp-drive'],
];

// Character class boosters, by the index the game numbers them with.
const FLIGHT_BOOSTER_MAPPING = [
    ['1', 'lf-rocktal-collector-enh'], ['2', 'lf-mechan-general-enh'],
];

function initializeFlightCalculator() {
    const orchestrator = new FlightOrchestrator(options);
    window.flightOrchestrator = orchestrator;
    orchestrator.init();
}

if (typeof window !== 'undefined') {
    window.FlightOrchestrator = FlightOrchestrator;
    window.initializeFlightCalculator = initializeFlightCalculator;
}
