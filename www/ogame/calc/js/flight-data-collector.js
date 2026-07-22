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
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    }

    checked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    }

    text(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    // ------------------------------------------------------------------
    // Parameters
    // ------------------------------------------------------------------

    /**
     * Every parameter the calculation engine needs.
     *
     * @param {object} state values the form does not hold:
     *   `populatedSystems` (galaxy → array of inhabited systems, or null),
     *   `fleetIgnoreEmptySystems` (universe setting),
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
            populatedSystems: state.populatedSystems ?? null,
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
        const checked = document.querySelector('input[name="mission-type"]:checked');
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
        document.querySelectorAll('#flight-data tr').forEach((row) => {
            const input = row.querySelector('input[type="text"]');
            if (!input) {
                return;
            }
            const toggle = row.querySelector('.flight-leg-sign');
            legs.push({ input, value: input.value, sign: toggle?.dataset.sign === '-' ? -1 : 1 });
        });
        return legs;
    }

    /** Raw contents of the save point search fields; parsing belongs to core. */
    collectSavePointForm() {
        return {
            startDT: this.text('save-start-datetime'),
            returnDT: this.text('save-return-datetime'),
            tolerance: this.text('save-tolerance-time'),
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
