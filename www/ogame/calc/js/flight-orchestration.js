// ============================================================================
// ORCHESTRATION — wires collector → core → renderer and owns the events
// ============================================================================

// The persisted state object. The TPL inline script fills in the translation
// strings; the orchestrator reads/writes prm and calls load/save (cookie I/O in
// utils.js). Transient bits (populated systems, manual overrides) live on the
// orchestrator instance, not here.
var options = {
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
        validate: function (field, value) {
            switch (field) {
                case 'country': return value;
                case 'universe': return validateNumber(Number.parseInt(value, 10), 0, Infinity, 101);
                case 'driveLevels': return validateNumber(parseFloat(value), 0, 50, 0);
                case 'fleetSpeedWar':
                case 'fleetSpeedPeaceful':
                case 'fleetSpeedHolding': return validateNumber(parseFloat(value), 1, 10, 1);
                case 'missionType': return validateNumber(parseFloat(value), 0, 2, 1);
                case 'circularGalaxies':
                case 'circularSystems':
                case 'traderBonus':
                case 'fleetIgnoreEmptySystems': return value === 'true';
                case 'numberOfSystems': return validateNumber(parseFloat(value), 1, 550, 499);
                case 'numberOfGalaxies': return validateNumber(parseFloat(value), 1, 12, 9);
                case 'deutFactor': return validateNumber(parseFloat(value), 5, 10, 10);
                case 'deutConsReduction': return validateNumber(parseFloat(value), 25, 50, 25);
                case 'departure':
                case 'destination': return validateNumber(parseFloat(value), 1, 1000, 1);
                case 'ships':
                case 'startDT':
                case 'saveStartDT':
                case 'saveReturnDT':
                case 'saveTolerance':
                case 'hyperTechLvl':
                case 'lfMechanGE':
                case 'lfRocktalCE':
                case 'lfShipsBonuses': return validateNumber(parseFloat(value), 0, Infinity, 0);
                case 'mode': return validateNumber(parseFloat(value), 0, 1, 0);
                case 'flightData': return validateNumber(parseFloat(value), -Infinity, Infinity, 0);
                case 'spCargohold': return validateNumber(parseFloat(value), 0, 5, 0);
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
            + `<button type="button" class="btn btn-sm btn-outline-secondary button-toggle flight-leg-sign" data-sign="+" title="${this.opts.toggleSignHint}"><i class="bi bi-plus-lg"></i></button>`
            + `<input type="text"${first ? ' id="flight-time"' : ''} class="form-control form-control-sm flight-time-input" placeholder="dd hh:mm:ss" title="${this.opts.flightTimeFormatHint}"/>`
            + `<button type="button" class="btn btn-sm btn-outline-danger button-remove" title="${this.opts.removeRowHint}"><i class="bi bi-x-lg"></i></button>`
            + '</div>';
    }

    /**
     * Add a leg row. When called from a click it just focuses the last empty
     * row; when called with a number it writes that many seconds (sign included).
     */
    addFlightLeg(arg) {
        const container = document.getElementById('flight-data');
        let last = container.querySelector('.flight-leg:last-child .flight-time-input');

        if (last && last.value !== '' && last.value !== '00 00:00:00') {
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

    _wireLegRow(row) {
        row.querySelector('.flight-leg-sign').addEventListener('click', (e) => this.toggleLegSign(e.currentTarget));
        row.querySelector('.button-remove').addEventListener('click', (e) => this.removeFlightLeg(e.currentTarget.closest('.flight-leg')));
        row.querySelector('.flight-time-input').addEventListener('keyup', () => this.updateArrival());
    }

    /** Rebuild the leg list from the stored flightData array. */
    restoreFlightLegs() {
        const container = document.getElementById('flight-data');
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
        const minSpeed = this.calc.getMinSpeed(ships, counts, params);
        const percentText = button.closest('tr').children[0].textContent;
        const percent = parseInt(percentText, 10);
        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const duration = this.calc.getFlightDuration(minSpeed, distance, percent, fleetSpeed);
        const sign = this.opts.prm.mode === 1 ? -1 : 1;
        this.addFlightLeg(sign * duration);
        this.opts.save();
    }

    // ------------------------------------------------------------------
    // Save-point navigation
    // ------------------------------------------------------------------

    /** Jump to a save point: fill the destination, recalc and seed the legs. */
    showFlightTime(point, depTime, speed) {
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
        const minSpeed = this.calc.getMinSpeed(ships, counts, params);
        const fleetSpeed = this.calc.fleetSpeedFor(params.missionType, params);
        const duration = this.calc.getFlightDuration(minSpeed, distance, speed, fleetSpeed);

        document.getElementById('flight-data').innerHTML = this._legRowHtml(true);
        this._wireLegRow(document.getElementById('flight-data').querySelector('.flight-leg'));
        this.addFlightLeg(duration);
        this.addFlightLeg(duration);
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
            startDT: 0, saveStartDT: 0, saveReturnDT: 0, saveTolerance: 0,
            hyperTechLvl: 0, playerClass: 0, traderBonus: false, spCargohold: 0,
            lfMechanGE: 0, lfRocktalCE: 0,
            lfShipsBonuses: Array.from({ length: 15 }, () => [0, 0, 0]),
            fleetIgnoreEmptySystems: false, flightData: [0],
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
        try {
            const response = await fetch('/ajax.php?' + new URLSearchParams({ service: 'serverdata', country, universe }));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const json = JSON.parse(await response.text());
            this._selectOption('speed-fleet-war', json.speedFleetWar);
            this._selectOption('speed-fleet-peaceful', json.speedFleetPeaceful);
            this._selectOption('speed-fleet-holding', json.speedFleetHolding);
            setChecked('#circular-systems', json.donutGalaxy == 1);
            setChecked('#circular-galaxies', json.donutSystem == 1);
            setVal('#systems-num', json.systems);
            setVal('#galaxies-num', json.galaxies);
            setVal('#sp-cargohold', json.probeCargo);
            this._selectOption('deut-factor', frac(json.globalDeuteriumSaveFactor * 10, 0));
            this._selectOption('deut-generals-bonus', frac(json.warriorBonusFuelConsumption * 100, 0));
            this.opts.prm.fleetIgnoreEmptySystems = json.fleetIgnoreEmptySystems === '1';
            const label = document.getElementById('empty-systems-label');
            if (this.opts.prm.fleetIgnoreEmptySystems) {
                this.getPopulatedSystemsInfo();
                setVal('#empty-systems-count-spin', 0);
                if (label) {
                    label.style.display = '';
                }
            } else {
                this.emptyOverride.enabled = false;
                if (label) {
                    label.style.display = 'none';
                }
            }
            this.recalc();
        } catch (error) {
            consoleLog('fetch error: ' + error);
        }
    }

    async getPopulatedSystemsInfo() {
        if (!this.opts.prm.fleetIgnoreEmptySystems) {
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
                if ((Date.now() - json.timestamp * 1000) <= 604800000) {
                    this.populatedSystems = json.populatedSystems;
                    return;
                }
            } catch (e) {
                consoleLog('parse exception: ' + e);
            }
        }
        try {
            const response = await fetch('/ajax.php?' + new URLSearchParams({ service: 'populatedSystems', country, universe }));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.text();
            const json = JSON.parse(data);
            localStorage.setItem(key, data);
            this.populatedSystems = json.populatedSystems;
        } catch (error) {
            consoleLog('fetch error: ' + error);
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
                const rcode = Number.parseInt(data.substr(0, data.indexOf('\n')), 10);
                if (rcode === 3) {
                    alert(data.substr(data.indexOf('\n') + 1));
                    return;
                }
                if (rcode === 4) {
                    alert(this.opts.badSRCode);
                    return;
                }
                if (rcode !== 0) {
                    return;
                }
                const result = JSON.parse(data.substr(data.indexOf('\n') + 1));
                if (result.RESULT_CODE === 1000) {
                    this._applySRResult(code, result.RESULT_DATA);
                    this.recalc();
                }
            } catch (e) {
                consoleLog('exception: ' + e);
            } finally {
                this._hideOverlay('general-settings-panel');
            }
        }).catch((e) => {
            consoleLog('exception: ' + e);
            this._hideOverlay('general-settings-panel');
        });
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
        setChecked('#circular-systems', rd.universes.donutGalaxy == 1);
        setChecked('#circular-galaxies', rd.universes.donutSystem == 1);
        setVal('#systems-num', rd.universes.systems);
        setVal('#galaxies-num', rd.universes.galaxies);
        setVal('#sp-cargohold', rd.universes.probeCargo);
        this._selectOption('deut-factor', rd.universes.globalDeuteriumSaveFactor * 10);
        this._selectOption('deut-generals-bonus', rd.universes.warriorBonusFuelConsumption * 10);
        this.opts.prm.fleetIgnoreEmptySystems = rd.universes.fleetIgnoreEmptySystems === '1';

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
                if (i == 1) setVal('#lf-rocktal-collector-enh', localizeFloat(frac(v, 6) * 100));
                if (i == 2) setVal('#lf-mechan-general-enh', localizeFloat(frac(v, 6) * 100));
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
        if (data === null || typeof data !== 'object' || Array.isArray(data) ||
            !('coords' in data || 'ships' in data || 'researches' in data || 'characterClassId' in data)) {
            alert(this.opts.ownApiBadJsonMsg);
            return false;
        }
        try {
            if (typeof data.coords === 'string') {
                const coords = data.coords.split(':');
                setVal('#departure-g', coords[0]);
                setVal('#departure-s', coords[1]);
                setVal('#departure-p', coords[2]);
            }
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
            if (data.researches) {
                Object.entries(data.researches).forEach(([id, level]) => {
                    if (id == 115) setVal('#cmb-drive', level);
                    if (id == 117) setVal('#imp-drive', level);
                    if (id == 118) setVal('#hyp-drive', level);
                    if (id == 114) setVal('#hypertech-lvl', level);
                });
            }
            if (data.bonuses && data.bonuses.characterClassBooster) {
                setVal('#lf-rocktal-collector-enh', 0);
                setVal('#lf-mechan-general-enh', 0);
                Object.entries(data.bonuses.characterClassBooster).forEach(([i, v]) => {
                    if (i == 1) setVal('#lf-rocktal-collector-enh', localizeFloat(frac(v, 6) * 100));
                    if (i == 2) setVal('#lf-mechan-general-enh', localizeFloat(frac(v, 6) * 100));
                });
            }
            FLIGHT_TECH_MAPPING.forEach(([techId, name]) => {
                setVal(`#${name}`, 0);
                this._setClassVal(`${techId}-speed`, 0);
                this._setClassVal(`${techId}-cargo`, 0);
                this._setClassVal(`${techId}-fuel`, 0);
            });
            if (data.ships) {
                Object.entries(data.ships).forEach(([id, v]) => {
                    const mapped = FLIGHT_TECH_MAPPING.find((m) => m[0] == id);
                    if (mapped) {
                        setVal(`#${mapped[1]}`, v.amount ? v.amount : 0);
                        if (v.speed) this._setClassVal(`${id}-speed`, localizeFloat(frac(v.speed, 6) * 100, 4));
                        if (v.cargo) this._setClassVal(`${id}-cargo`, localizeFloat(frac(v.cargo, 6) * 100, 4));
                        if (v.fuel) this._setClassVal(`${id}-fuel`, localizeFloat(frac(v.fuel, 7) * 100, 5));
                    }
                });
            }
            this.recalc();
        } catch (e) {
            consoleLog('own api import exception: ' + e);
            alert(this.opts.ownApiBadJsonMsg);
            return false;
        }
        return true;
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
                    [0, 1, 2].forEach((k) => { row.children[k + 1].children[0].value = bonus[k]; });
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

    _showOverlay(elementId, text) {
        const panel = document.getElementById(elementId);
        if (!panel) {
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

        this._restoreActiveTab();

        if (this.opts.prm.fleetIgnoreEmptySystems) {
            const label = document.getElementById('empty-systems-label');
            if (label) {
                label.style.display = '';
            }
        }
        this.recalc();
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
        document.querySelectorAll('#lf-bonuses-accordion input[type=text]').forEach((el) => {
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
        on('set-departure-now', 'click', () => this.setDepartureNow());
        on('set-departure-zero', 'click', () => this.setDepartureZero());
        on('set-save-departure-now', 'click', () => this.setSaveDepartureNow());
        on('add-flight-time', 'click', () => this.addFlightLeg({}));
        on('toggle-mode', 'click', () => this.toggleMode());
        on('warrior-bonus', 'click', (e) => this.toggleAllianceBonus(e));
        on('trader-bonus', 'click', (e) => this.toggleAllianceBonus(e));
        on('calculate-savepoints', 'click', () => this.updateSavePoints());
        on('start-datetime', 'keyup', () => this.updateArrival());
        ['save-start-datetime', 'save-return-datetime', 'save-tolerance-time'].forEach((id) => {
            on(id, 'keyup', () => this._validateSavePointForm());
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
                    Number(link.dataset.speed));
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
            keys.sort();
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
