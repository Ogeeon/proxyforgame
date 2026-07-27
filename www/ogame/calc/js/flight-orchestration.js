// ============================================================================
// ORCHESTRATION — wires collector → core → renderer and owns the events
// ============================================================================

// How long a cached populated-systems map stays usable. The server job that
// builds it runs daily, so anything longer only serves stale coordinates.
const POPULATED_SYSTEMS_TTL_MS = 24 * 60 * 60 * 1000;

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
                case 'missionType': return validateNumber(Number.parseFloat(value), 0, 2, 1);
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
            if (options.prm.lfShipsBonuses.length !== 15 || options.prm.lfShipsBonuses[0].length === undefined) {
                options.prm.lfShipsBonuses = Array.from({ length: 15 }, () => [0, 0, 0]);
            }
        } catch (e) {
            alert(e);
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

        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        this.renderer.renderShipSpeeds(this.calc.getAllShipSpeeds(ships, params));

        if (!route.departure.valid || !route.destination.valid) {
            this.renderer.renderDistance(null);
            this.renderer.clearFlightTimes(params.playerClass);
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
            this.renderer.clearFlightTimes(params.playerClass);
            this.opts.save();
            return;
        }

        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const entries = [];
        for (let percent = 100; percent > 0; percent -= 5) {
            const duration = this.calc.getFlightDuration(minSpeed, distance, percent, fleetSpeed);
            entries.push({
                duration,
                deut: this.calc.getDeutConsumption(ships, counts, distance, duration, fleetSpeed, params),
                cargo: this.calc.getCargoCapacity(ships, counts, params),
            });
        }
        this.renderer.renderFlightTimes(entries, params.playerClass);
        this.opts.save();
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

    _applyCoordinateLimits(galaxies, systems) {
        const setMax = (id, max) => {
            const el = document.getElementById(id);
            if (el) {
                el._constrains = { min: 1, def: 0, max };
            }
        };
        setMax('departure-g', galaxies);
        setMax('destination-g', galaxies);
        setMax('departure-s', systems);
        setMax('destination-s', systems);
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
        if (parts == null || parts.length !== 5) {
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
        const moment = document.getElementById('recall-moment');
        const after = document.getElementById('recall-after');
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

        const tol = form.tolerance.match(/(\d\d):(\d\d)/);
        const toleranceSeconds = Number(tol[1]) * 3600 + Number(tol[2]) * 60;
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
        const { params, ships, counts, minSpeed, departure, target, tolerance, legs, startAt } = ctx;
        const coordAxes = [
            { limit: params.numberOfGalaxies, table: 'savepoints-galaxies', fmt: (v) => `${v}:xxx:xx`, circular: params.circularGalaxies },
            { limit: params.numberOfSystems, table: 'savepoints-systems', fmt: (v) => `${departure[0]}:${v}:xx`, circular: params.circularSystems },
            { limit: 16, table: 'savepoints-planets', fmt: (v) => `${departure[0]}:${departure[1]}:${v}`, circular: false },
        ];
        const increment = params.playerClass === PLAYER_CLASS.GENERAL ? 5 : 10;
        let haveResults = false;

        coordAxes.forEach((axis, axisIndex) => {
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
            if (rows.length > 0) {
                haveResults = true;
            }
            rows.sort((a, b) => this.calc.compareSavePoints(
                [a.speedPercent, 0, a.cost], [b.speedPercent, 0, b.cost]));
            this.renderer.renderSavePoints(axis.table, rows, startDT, legs);
        });

        return haveResults;
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

        const rows = document.querySelectorAll('#lf-ships-bonuses tr');
        prm.lfShipsBonuses.forEach((bonus, i) => {
            const row = rows[i + 1];
            if (row) {
                [0, 1, 2].forEach((j) => { row.children[j + 1].children[0].value = localizeFloat(bonus[j]); });
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
        const field = document.getElementById('ovr-speed-t');
        if (event.currentTarget.checked) {
            field.disabled = false;
            field.classList.remove('ui-state-disabled');
            this.speedOverride.enabled = true;
            let speed = getInputNumber(field);
            if (speed === 0) {
                speed = 10000;
                field.value = 10000;
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
        let last = container.querySelector('.flight-leg:last-child .flight-time-input');

        // A row that only holds the bare mask skeleton counts as free: clicking
        // the add button leaves the field focused, so it never blurs back to ''.
        if (last && !isMaskBlank(last) && last.value !== '00 00:00:00') {
            container.insertAdjacentHTML('beforeend', this._legRowHtml());
            const row = container.querySelector('.flight-leg:last-child');
            this._wireLegRow(row);
            last = row.querySelector('.flight-time-input');
        }

        if (typeof arg !== 'object') {
            const seconds = Number(arg);
            last.value = getFlightTimeStr(Math.abs(seconds));
            if (seconds < 0) {
                this._setLegSign(last.closest('.flight-leg').querySelector('.flight-leg-sign'), '-');
            }
        } else if (last) {
            last.focus();
        }
        this.updateArrival();
    }

    removeFlightLeg(row) {
        const container = document.getElementById('flight-data');
        const rows = container.querySelectorAll('.flight-leg');
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

    /** Rebuild the leg list from the stored flightData array. */
    restoreFlightLegs() {
        const container = document.getElementById('flight-data');
        FlightOrchestrator._disposeRowTooltips(container);
        container.innerHTML = this._legRowHtml(true);
        this._wireLegRow(container.querySelector('.flight-leg'));
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
        // speed override exactly like the flight-times table does.
        const minSpeed = this._effectiveMinSpeed(ships, counts, params);
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
        bootstrap.Tab.getOrCreateInstance(document.getElementById('tabtag1')).show();
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

        FlightOrchestrator._disposeRowTooltips(document.getElementById('flight-data'));
        document.getElementById('flight-data').innerHTML = this._legRowHtml(true);
        this._wireLegRow(document.getElementById('flight-data').querySelector('.flight-leg'));
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
            localStorage.setItem('flight-tab-num', isFlightTimes ? 0 : 1);
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
        document.querySelectorAll('#lf-ships-bonuses input[type=text]').forEach((i) => { i.value = 0; });
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
        const universeEl = document.getElementById('universe');
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
        if (universe === null || universe === '') {
            return;
        }
        this._showOverlay('general-settings-panel', this.opts.dataFetchMsg);
        try {
            const response = await fetch('/ajax.php?' + new URLSearchParams({ service: 'serverdata', country, universe }));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const json = JSON.parse(await response.text());
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
        if (universe === null || universe === '') {
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
            const response = await fetch('/ajax.php?' + new URLSearchParams({ service: 'populatedSystems', country, universe }));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.text();
            const json = JSON.parse(data);
            localStorage.setItem(key, JSON.stringify({ ...json, cachedAt: Date.now() }));
            this.populatedSystems = json.populatedSystems;
            this.populatedSystemsAll = json.populatedSystemsAll ?? null;
        } catch (error) {
            consoleLog('fetch error: ' + error);
        } finally {
            this._hideOverlay('general-settings-panel');
        }
    }

    _selectOption(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.value = String(value);
        }
    }

    // ------------------------------------------------------------------
    // API import — SR code and OGame own-api export
    // ------------------------------------------------------------------

    importSR(code) {
        this._showOverlay('general-settings-panel', this.opts.dataFetchMsg);
        fetch('/ajax.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ service: 'ogameAPI', code }),
        }).then((r) => r.text()).then((data) => {
            try {
                const rcode = Number.parseInt(data.slice(0, data.indexOf('\n')), 10);
                const payload = data.slice(data.indexOf('\n') + 1);
                if (rcode === 3) {
                    alert(payload);
                    return;
                }
                if (rcode === 4) {
                    alert(this.opts.badSRCode);
                    return;
                }
                if (rcode !== 0) {
                    alert(this.opts.importFailedMsg);
                    return;
                }
                const rd = this._parseSRPayload(payload);
                if (rd === null) {
                    alert(this.opts.importFailedMsg);
                    return;
                }
                this._applySRResult(code, rd);
                this.recalc();
            } catch (e) {
                consoleLog('exception: ' + e);
                alert(this.opts.importFailedMsg);
            } finally {
                this._hideOverlay('general-settings-panel');
            }
        }).catch((e) => {
            consoleLog('exception: ' + e);
            alert(this.opts.importFailedMsg);
            this._hideOverlay('general-settings-panel');
        });
    }

    /**
     * Extract RESULT_DATA from an SR import payload.
     * Returns null when the answer is not usable — the upstream log server can
     * reply with PHP warnings glued in front of the JSON, or with a well-formed
     * envelope whose RESULT_DATA is `false`.
     */
    _parseSRPayload(payload) {
        let result;
        try {
            result = JSON.parse(payload);
        } catch (e) {
            consoleLog('SR parse exception: ' + e);
            return null;
        }
        const rd = result?.RESULT_DATA;
        if (result?.RESULT_CODE !== 1000 || rd === null || typeof rd !== 'object' || Array.isArray(rd)) {
            return null;
        }
        if (typeof rd.generic !== 'object' || rd.generic === null ||
            typeof rd.universes !== 'object' || rd.universes === null) {
            return null;
        }
        return rd;
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
            if (v.research_type == 115) setVal('#cmb-drive', v.level);
            if (v.research_type == 117) setVal('#imp-drive', v.level);
            if (v.research_type == 118) setVal('#hyp-drive', v.level);
            if (v.research_type == 114) setVal('#hypertech-lvl', v.level);
        });

        const booster = rd.details?.lifeformBonuses?.CharacterClassBooster;
        setVal('#lf-rocktal-collector-enh', 0);
        setVal('#lf-mechan-general-enh', 0);
        if (booster) {
            Object.entries(booster).forEach(([i, v]) => {
                if (i == 1) setNumVal('#lf-rocktal-collector-enh', frac(v, 6) * 100);
                if (i == 2) setNumVal('#lf-mechan-general-enh', frac(v, 6) * 100);
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

    _applyPerShipBonuses(ships) {
        Object.entries(ships || {}).forEach(([id, v]) => {
            this._setClassVal(`${id}-speed`, v.speed ? localizeFloat(frac(v.speed, 6) * 100, 4) : 0);
            this._setClassVal(`${id}-cargo`, v.cargo ? localizeFloat(frac(v.cargo, 6) * 100, 4) : 0);
            this._setClassVal(`${id}-fuel`, v.fuel ? localizeFloat(frac(v.fuel, 7) * 100, 5) : 0);
        });
    }

    _setClassVal(className, value) {
        // Attribute selector, not `.${className}` — these classes start with a
        // digit (e.g. "202-speed"), which is an invalid CSS class selector.
        document.querySelectorAll(`[class~="${className}"]`).forEach((el) => { el.value = value; });
    }

    importOwnApi(jsonText) {
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            alert(this.opts.ownApiBadJsonMsg);
            return false;
        }
        if (!this._isUsableOwnApiPayload(data)) {
            alert(this.opts.ownApiBadJsonMsg);
            return false;
        }
        const importCoords = getChecked('#own-api-import-coords');
        const importClass = getChecked('#own-api-import-class');
        const importResearch = getChecked('#own-api-import-research');
        const importShips = getChecked('#own-api-import-ships');
        const importLifeforms = getChecked('#own-api-import-lifeforms');
        try {
            if (importCoords && typeof data.coords === 'string') this._importOwnApiCoords(data);
            if (importClass) this._importOwnApiClass(data);
            if (importResearch && data.researches) this._importOwnApiResearch(data);
            if (importLifeforms && data.bonuses?.characterClassBooster) this._importOwnApiLifeformBoosters(data);
            this._resetOwnApiShipFields(importShips, importLifeforms);
            if (data.ships && (importShips || importLifeforms)) this._importOwnApiShips(data, importShips, importLifeforms);
            this.recalc();
        } catch (e) {
            consoleLog('own api import exception: ' + e);
            alert(this.opts.ownApiBadJsonMsg);
            return false;
        }
        return true;
    }

    _isUsableOwnApiPayload(data) {
        return data !== null && typeof data === 'object' && !Array.isArray(data) &&
            ('coords' in data || 'ships' in data || 'researches' in data || 'characterClassId' in data);
    }

    _importOwnApiCoords(data) {
        const coords = data.coords.split(':');
        setVal('#departure-g', coords[0]);
        setVal('#departure-s', coords[1]);
        setVal('#departure-p', coords[2]);
    }

    _importOwnApiClass(data) {
        const classMap = { 1: 'class-0', 2: 'class-1', 3: 'class-2' };
        if (classMap[data.characterClassId]) {
            document.querySelectorAll('input[name="class"]').forEach((r) => { r.checked = false; });
            setChecked(`#${classMap[data.characterClassId]}`, true);
        }
        const isTrader = data.allianceClassId == 2;
        setChecked('#trader-bonus', isTrader);
        if (isTrader) {
            setChecked('#warrior-bonus', false);
        }
    }

    _importOwnApiResearch(data) {
        Object.entries(data.researches).forEach(([id, level]) => {
            if (id == 115) setVal('#cmb-drive', level);
            if (id == 117) setVal('#imp-drive', level);
            if (id == 118) setVal('#hyp-drive', level);
            if (id == 114) setVal('#hypertech-lvl', level);
        });
    }

    _importOwnApiLifeformBoosters(data) {
        setVal('#lf-rocktal-collector-enh', 0);
        setVal('#lf-mechan-general-enh', 0);
        Object.entries(data.bonuses.characterClassBooster).forEach(([i, v]) => {
            if (i == 1) setNumVal('#lf-rocktal-collector-enh', frac(v, 6) * 100);
            if (i == 2) setNumVal('#lf-mechan-general-enh', frac(v, 6) * 100);
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

    _importOwnApiShips(data, importShips, importLifeforms) {
        Object.entries(data.ships).forEach(([id, v]) => {
            const mapped = FLIGHT_TECH_MAPPING.find((m) => m[0] == id);
            if (!mapped) return;
            if (importShips) setVal(`#${mapped[1]}`, v.amount ? v.amount : 0);
            if (importLifeforms) this._applyOwnApiShipLifeformBonuses(id, v);
        });
    }

    _applyOwnApiShipLifeformBonuses(id, v) {
        if (v.speed) this._setClassVal(`${id}-speed`, localizeFloat(frac(v.speed, 6) * 100, 4));
        if (v.cargo) this._setClassVal(`${id}-cargo`, localizeFloat(frac(v.cargo, 6) * 100, 4));
        if (v.fuel) this._setClassVal(`${id}-fuel`, localizeFloat(frac(v.fuel, 7) * 100, 5));
    }

    /** Parse the pasted lifeform-bonuses report into the per-ship bonus table. */
    readShipsBonuses() {
        const lines = document.getElementById('lf-bonuses-txtarea').value.split('\n');
        const scName = this.opts.smallCargoName.toLowerCase();
        const scLine = lines.findIndex((line) => line.toLowerCase().includes(scName));
        if (scLine === -1) {
            alert(this.opts.missingSCName.replace('sc_name', this.opts.smallCargoName));
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
            const rows = document.querySelectorAll('#lf-ships-bonuses tr');
            bonuses.forEach((bonus, i) => {
                const row = rows[i + 1];
                if (row) {
                    // Same cells populateParams fills, so they take the same
                    // locale-aware write: a raw "1.5" would lose its separator
                    // to the numeric blur validator in a comma locale.
                    [0, 1, 2].forEach((k) => { row.children[k + 1].children[0].value = localizeFloat(bonus[k]); });
                }
            });
        } catch (e) {
            alert(e);
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
            attachInputMask(document.getElementById(id), this.opts.datetimeFormat));
        attachInputMask(document.getElementById('save-tolerance-time'), this.opts.toleranceTimeFormat);
        document.querySelectorAll('input.flight-time-input').forEach((el) =>
            attachInputMask(el, this.opts.flightTimeFormat));
    }

    _initSpeedOverride() {
        this.speedOverride = { enabled: false, speed: 10000 };
        const field = document.getElementById('ovr-speed-t');
        field.disabled = true;
        // min 0, not 1: a 0 must reach the toggle so it can fall back to 10000,
        // instead of the blur validator clamping it up to 1 first.
        field._constrains = { min: 0, def: 10000, max: 1000000000 };
        document.getElementById('ovr-speed-cb').addEventListener('click', (e) => this.toggleSpeedOverride(e));
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
        const coord = (id, max) => {
            const el = document.getElementById(id);
            if (el) {
                el._constrains = { min: 1, def: 0, max };
            }
        };
        coord('departure-g', 12); coord('destination-g', 12);
        coord('departure-s', 550); coord('destination-s', 550);
        coord('departure-p', 16); coord('destination-p', 16);
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
            on(id, 'input', () => this._validateSavePointForm());
            on(id, 'blur', () => this._validateSavePointForm());
        });
        on('empty-systems-count-spin', 'input', (e) => this.onEmptySystemsInput(e.currentTarget));
        ['destination-g', 'destination-s', 'destination-p'].forEach((id) =>
            on(id, 'input', () => this.onDestinationInput()));

        document.querySelectorAll('.button-taketocalc').forEach((btn) =>
            btn.addEventListener('click', (e) => this.takeToCalc(e.currentTarget)));
        this._wireLegRow(document.getElementById('flight-data').querySelector('.flight-leg'));

        // Save-point coordinate links are rendered dynamically; delegate their clicks.
        const spTables = document.getElementById('save-points-tables');
        if (spTables) {
            spTables.addEventListener('click', (e) => {
                const link = e.target.closest('.save-point-link');
                if (!link) {
                    return;
                }
                e.preventDefault();
                this.showFlightTime(
                    link.dataset.point.split(',').map(Number),
                    link.dataset.start,
                    Number(link.dataset.speed),
                    Number(link.dataset.legs));
            });
        }
    }

    _bindInputs() {
        // Skip the name/api fields and every date/time field: the numeric
        // validator would strip the separators out of a date or duration.
        const skipIds = ['universe-name', 'fleet-name', 'api-code'];
        const skipClasses = ['startdate-input', 'tolerance-time-input', 'flight-time-input'];
        const isNumeric = (el) => !skipIds.includes(el.id)
            && !skipClasses.some((cls) => el.classList.contains(cls));
        document.querySelectorAll('#flight input[type=text]').forEach((el) => {
            if (!isNumeric(el)) {
                return;
            }
            el.addEventListener('keyup', function (e) {
                validateInputNumber({ currentTarget: this });
            });
            el.addEventListener('keyup', () => this.recalc());
            el.addEventListener('blur', function (e) {
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
        const confirmed = (msg) => window.confirm(msg);
        const on = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', handler);
            }
        };
        on('universe-load', () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { alert(this.opts.noUniSelectedMsg); return; }
            if (confirmed(this.opts.uniLoadConfMsg)) { this.loadUniverse(key); }
        });
        on('universe-save', () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { alert(this.opts.noUniSelectedMsg); return; }
            if (confirmed(this.opts.uniOwrConfMsg)) { this.saveUniverse(key); }
        });
        on('universe-delete', () => {
            const key = getVal('#universe-name-select');
            if (key === '0') { alert(this.opts.noUniSelectedMsg); return; }
            if (confirmed(this.opts.uniDelConfMsg)) { this._removeStorageOption('universe-name-select', key); }
        });
        on('universe-add', () => this._addStorageEntry('universe-name', 'universe-name-select', 'flight_uni_', this.opts.noUniNameMsg, (key) => this.saveUniverse(key)));

        on('fleet-load', () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { alert(this.opts.noFleetSelectedMsg); return; }
            if (confirmed(this.opts.fleetLoadConfMsg)) { this.loadFleet(key); }
        });
        on('fleet-save', () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { alert(this.opts.noFleetSelectedMsg); return; }
            if (confirmed(this.opts.fleetOwrConfMsg)) { this.saveFleet(key); }
        });
        on('fleet-delete', () => {
            const key = getVal('#fleet-name-select');
            if (key === '0') { alert(this.opts.noFleetSelectedMsg); return; }
            if (confirmed(this.opts.fleetDelConfMsg)) { this._removeStorageOption('fleet-name-select', key); }
        });
        on('fleet-add', () => this._addStorageEntry('fleet-name', 'fleet-name-select', 'flight_fleet_', this.opts.noFleetNameMsg, (key) => this.saveFleet(key)));

        on('api-get', () => this.importSR(getVal('#api-code')));

        document.getElementById('country')?.addEventListener('change', function () {
            const self = window.flightOrchestrator;
            self.opts.prm.country = this.value;
            self.opts.prm.fleetIgnoreEmptySystems = false;
            self.opts.prm.fleetIgnoreInactiveSystems = false;
            self.setUniList(this.value, self.opts.prm.universe);
            self.recalc();
            self.opts.save();
        });
        document.getElementById('universe')?.addEventListener('change', function () {
            const self = window.flightOrchestrator;
            self.opts.prm.universe = this.value;
            self.fetchServerData();
            self.recalc();
            self.opts.save();
        });
    }

    _addStorageEntry(inputId, selectId, prefix, emptyMsg, saver) {
        const input = document.getElementById(inputId);
        const name = input.value.trim();
        if (name.length === 0) {
            alert(emptyMsg);
            input.focus();
            return;
        }
        const clean = stripHTMLTags(name);
        const key = prefix + clean;
        saver(key);
        const select = document.getElementById(selectId);
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
        document.getElementById(selectId).value = '0';
    }

    _populateStorageSelects() {
        const fill = (prefix, selectId) => {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.includes(prefix)) {
                    keys.push(key);
                }
            }
            // The names are user typed, so order them the way the reader's
            // language does rather than by code point.
            keys.sort((a, b) => a.replace(prefix, '').localeCompare(b.replace(prefix, '')));
            const select = document.getElementById(selectId);
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
                bootstrap.Modal.getOrCreateInstance(document.getElementById('lf-bonuses-reader')).show();
            });
        }
        const lfRead = document.getElementById('lf-bonuses-read-btn');
        if (lfRead) {
            lfRead.addEventListener('click', () => {
                if (this.readShipsBonuses()) {
                    bootstrap.Modal.getInstance(document.getElementById('lf-bonuses-reader')).hide();
                    this.recalc();
                }
            });
        }
        const importBtn = document.getElementById('import-own-api');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                setVal('#own-api-txtarea', '');
                bootstrap.Modal.getOrCreateInstance(document.getElementById('own-api-reader')).show();
            });
        }
        const ownApiRead = document.getElementById('own-api-read-btn');
        if (ownApiRead) {
            ownApiRead.addEventListener('click', () => {
                if (this.importOwnApi(getVal('#own-api-txtarea'))) {
                    bootstrap.Modal.getInstance(document.getElementById('own-api-reader')).hide();
                }
            });
        }
    }

    _bindTabs() {
        document.querySelectorAll('#tabs button[data-bs-toggle="tab"]').forEach((btn) => {
            btn.addEventListener('shown.bs.tab', (e) => this.showTabsHint(e.target.id));
        });
    }

    _restoreActiveTab() {
        let tabNum = '0';
        try {
            tabNum = localStorage.getItem('flight-tab-num') ?? '0';
        } catch (e) { /* storage disabled */ }
        const tabId = String(tabNum) === '1' ? 'tabtag2' : 'tabtag1';
        bootstrap.Tab.getOrCreateInstance(document.getElementById(tabId)).show();
        this.showTabsHint(tabId);
    }

    _bindTheme() {
        const theme = { value: 'light', validate: (key, val) => val };
        loadFromCookie('theme', theme);
        toggleLightBS(theme.value === 'light');
        const cb = document.getElementById('cb-light-theme');
        if (cb) {
            cb.addEventListener('click', function () { toggleLightBS(this.checked); });
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

/** Strip any HTML tags from a user-entered universe/fleet name. */
function stripHTMLTags(input) {
    return input.replace(/(<([^>]+)>)/gi, '');
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

function initializeFlightCalculator() {
    const orchestrator = new FlightOrchestrator(options);
    window.flightOrchestrator = orchestrator;
    orchestrator.init();
}

if (typeof window !== 'undefined') {
    window.FlightOrchestrator = FlightOrchestrator;
    window.initializeFlightCalculator = initializeFlightCalculator;
}
