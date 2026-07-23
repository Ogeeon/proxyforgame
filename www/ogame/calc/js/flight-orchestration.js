// ============================================================================
// ORCHESTRATION — wires collector → core → renderer and owns the events
// ============================================================================

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

        // Transient state — never persisted, mirrors the old `options.*` fields
        this.populatedSystems = null;
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
            fleetIgnoreEmptySystems: this.opts.prm.fleetIgnoreEmptySystems,
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
        this.renderer.renderEmptySystems({ count: emptyCount, visible: params.fleetIgnoreEmptySystems });

        const minSpeed = this._effectiveMinSpeed(ships, counts, params);
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
        const target = Math.round(Math.ceil((returnDTValue - startDTValue) / 1000) / 2);

        const tol = form.tolerance.match(/(\d\d):(\d\d)/);
        const tolerance = Math.round((Number(tol[1]) * 3600 + Number(tol[2]) * 60) / 2);
        this.opts.prm.saveTolerance = tolerance * 2;

        const params = this.collector.collectParams(this._state());
        const ships = this.calc.buildShipsData(params.driveLevels, params.spCargohold);
        const counts = this.collector.collectShipCounts();
        const minSpeed = this.calc.getMinSpeed(ships, counts, params);
        const departure = this.opts.prm.departure;

        const found = this._searchSavePoints(
            { params, ships, counts, minSpeed, departure, target, tolerance }, form.startDT);
        if (!found) {
            this.renderer.renderWarning(this.opts.msgNoSavepointsFound);
        }
        this.opts.save();
    }

    /** Sweep galaxies, systems and planets for arrival times within tolerance. */
    _searchSavePoints(ctx, startDT) {
        const { params, ships, counts, minSpeed, departure, target, tolerance } = ctx;
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
                if ((params.circularGalaxies || params.circularSystems) && delta > halve) {
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
                    this._collectSavePointRows(rows, axisIndex, delta, departure, params, axis, percent, cost);
                }
            }
            if (rows.length > 0) {
                haveResults = true;
            }
            rows.sort((a, b) => this.calc.compareSavePoints(
                [a.speedPercent, 0, a.cost], [b.speedPercent, 0, b.cost]));
            this.renderer.renderSavePoints(axis.table, rows, startDT);
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

    /** Build the one or two save-point rows a matching delta produces. */
    _collectSavePointRows(rows, axisIndex, delta, departure, params, axis, percent, cost) {
        const point = [...departure];
        const below = departure[axisIndex] - delta;
        const above = departure[axisIndex] + delta;

        if (below > 0) {
            point[axisIndex] = below;
            rows.push({ speedPercent: percent, coordLabel: axis.fmt(below), cost, point: [...point] });
        } else if (axis.circular) {
            const wrapped = axis.limit + 1 - delta;
            point[axisIndex] = wrapped;
            rows.push({ speedPercent: percent, coordLabel: axis.fmt(wrapped), cost, point: [...point] });
        }

        if (above <= axis.limit) {
            point[axisIndex] = above;
            rows.push({ speedPercent: percent, coordLabel: axis.fmt(above), cost, point: [...point] });
        } else if (axis.circular) {
            const wrapped = delta - 1;
            point[axisIndex] = wrapped;
            rows.push({ speedPercent: percent, coordLabel: axis.fmt(wrapped), cost, point: [...point] });
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
        const messages = {
            'departure-g': this.opts.msgWrongDepartureCoordinates,
            'esp-probe': this.opts.msgNoShips,
            'save-start-datetime': this.opts.msgWrongDepartureTime,
            'save-return-datetime': this.opts.msgWrongReturnTime,
            'save-tolerance-time': this.opts.msgWrongTolerance,
            'return-start': this.opts.msgDepartureAfterReturn,
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
            validate: (field, value) => validateNumber(parseFloat(value), 0, Infinity, 0),
        };
        loadFromCookie(key, stored);
        this.opts.prm.ships = Array.from(stored.savedShips);
        SHIPS_BASE.forEach((ship, i) => setVal(`#${ship[0]}`, this.opts.prm.ships[i] ?? 0));
        this.recalc();
    }

    saveFleet(key) {
        saveToCookie(key, { savedShips: this.collector.collectShipCounts() });
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
        setChecked(`#class-${prm.playerClass}`, true);
        setChecked('#trader-bonus', prm.traderBonus);
        setChecked(`#mission-type-${prm.missionType}`, true);
        setVal('#sp-cargohold', localizeFloat(prm.spCargohold));
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
}

if (typeof window !== 'undefined') {
    window.FlightOrchestrator = FlightOrchestrator;
}
