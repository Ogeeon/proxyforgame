// ============================================================================
// CONSTANTS
// ============================================================================

// Ship table: [input id, base speed, drive type, deuterium consumption, cargo]
// Drive type indexes into the combustion/impulse/hyperspace bonus triple.
const SHIPS_BASE = [
    ['small-cargo', 5000, 0, 10, 5000],       // 0
    ['large-cargo', 7500, 0, 50, 25000],      // 1
    ['light-fighter', 12500, 0, 20, 50],      // 2
    ['heavy-fighter', 10000, 1, 75, 100],     // 3
    ['cruiser', 15000, 1, 300, 800],          // 4
    ['battleship', 10000, 2, 500, 1500],      // 5
    ['colony-ship', 2500, 1, 1000, 7500],     // 6
    ['recycler', 2000, 0, 300, 20000],        // 7
    ['esp-probe', 100000000, 0, 1, 0],        // 8
    ['bomber', 4000, 1, 700, 500],            // 9
    ['destroyer', 5000, 2, 1000, 2000],       // 10
    ['death-star', 100, 2, 1, 1000000],       // 11
    ['battlecruiser', 10000, 2, 250, 750],    // 12
    ['reaper', 7000, 2, 1100, 10000],         // 13
    ['pathfinder', 12000, 2, 300, 10000],     // 14
];

const SHIP = {
    SMALL_CARGO: 0, LARGE_CARGO: 1, LIGHT_FIGHTER: 2, HEAVY_FIGHTER: 3,
    CRUISER: 4, BATTLESHIP: 5, COLONY_SHIP: 6, RECYCLER: 7, ESP_PROBE: 8,
    BOMBER: 9, DESTROYER: 10, DEATH_STAR: 11, BATTLECRUISER: 12,
    REAPER: 13, PATHFINDER: 14,
};

const PLAYER_CLASS = { COLLECTOR: 0, GENERAL: 1, DISCOVERER: 2 };

// The general speeds up every warship plus recyclers and pathfinders
const GENERAL_BOOSTED = new Set([2, 3, 4, 5, 7, 9, 10, 12, 13, 14]);

// Percentage added per drive level, by drive type
const DRIVE_BONUS_PER_LEVEL = [10, 20, 30];

// Drive research levels that re-engine a ship onto a faster drive
const UPGRADES = {
    SMALL_CARGO_IMPULSE: 4,   // above this, small cargo runs on impulse
    BOMBER_HYPERSPACE: 7,     // above this, the bomber runs on hyperspace
    RECYCLER_HYPERSPACE: 14,  // above this, the recycler runs on hyperspace
    RECYCLER_IMPULSE: 16,     // above this, the recycler runs on impulse
};

const MISSION = { WAR: 0, PEACEFUL: 1, HOLDING: 2 };

// ============================================================================
// CALCULATION ENGINE
// ============================================================================

/**
 * Pure flight maths — no DOM access. Every method takes the values it needs, so
 * the collector owns reading the form and the renderer owns writing results.
 *
 * `params` throughout means an object shaped like the one returned by
 * FlightDataCollector.collectParams().
 */
class FlightCalculator {

    // ------------------------------------------------------------------
    // Ship table
    // ------------------------------------------------------------------

    /**
     * Builds the effective ship table for the given research levels. Several
     * ships move to a better drive once the matching research is high enough,
     * which changes their base speed, drive type and fuel use.
     */
    buildShipsData(driveLevels, spCargohold = 0) {
        const ships = SHIPS_BASE.map((s) => [...s]);
        const [, impulse, hyperspace] = driveLevels;

        if (impulse > UPGRADES.SMALL_CARGO_IMPULSE) {
            ships[SHIP.SMALL_CARGO] = ['small-cargo', 10000, 1, 20, 5000];
        }
        if (hyperspace > UPGRADES.BOMBER_HYPERSPACE) {
            ships[SHIP.BOMBER] = ['bomber', 5000, 2, 700, 500];
        }
        // Hyperspace wins over impulse when both thresholds are cleared
        if (hyperspace > UPGRADES.RECYCLER_HYPERSPACE) {
            ships[SHIP.RECYCLER] = ['recycler', 6000, 2, 900, 20000];
        } else if (impulse > UPGRADES.RECYCLER_IMPULSE) {
            ships[SHIP.RECYCLER] = ['recycler', 4000, 1, 600, 20000];
        }
        if (spCargohold !== 0) {
            ships[SHIP.ESP_PROBE] = ['esp-probe', 100000000, 0, 1, spCargohold];
        }
        return ships;
    }

    /** Percentage speed bonus per drive type, derived from the research levels. */
    driveBonuses(driveLevels) {
        return DRIVE_BONUS_PER_LEVEL.map((perLevel, i) => driveLevels[i] * perLevel);
    }

    // ------------------------------------------------------------------
    // Speed
    // ------------------------------------------------------------------

    /** Whether the player class doubles this ship's speed. */
    isSpeedDoubled(playerClass, shipID) {
        if (playerClass === PLAYER_CLASS.COLLECTOR) {
            return shipID < 2; // the collector only speeds up transports
        }
        if (playerClass === PLAYER_CLASS.GENERAL) {
            return GENERAL_BOOSTED.has(shipID);
        }
        return false;
    }

    /**
     * Speed of a single ship, including drive research, the class bonus and its
     * life form enhancement, the alliance bonus and the per-ship life form bonus.
     */
    getShipSpeed(shipsData, index, params) {
        const base = shipsData[index][1];
        const driveType = shipsData[index][2];
        const bonuses = this.driveBonuses(params.driveLevels);

        let speed = base * (1 + bonuses[driveType] / 100);

        if (this.isSpeedDoubled(params.playerClass, index)) {
            // Each class bonus is scaled by its own life form enhancement
            if (params.playerClass === PLAYER_CLASS.COLLECTOR) {
                speed += Math.floor(base * (1 + 0.01 * params.lfRocktalCE));
            }
            if (params.playerClass === PLAYER_CLASS.GENERAL) {
                speed += Math.floor(base * (1 + 0.01 * params.lfMechanGE));
            }
        }
        if (params.warriorBonus) {
            speed += base * 0.1;
        }
        if (params.traderBonus && index < 2) {
            speed += base * 0.1;
        }
        speed += Math.ceil(base * 0.01 * params.lfShipsBonuses[index][0]);
        return speed;
    }

    /**
     * Speed of the slowest ship actually present in the fleet.
     * @returns Infinity when the fleet is empty — the caller treats that as "no trip"
     */
    getMinSpeed(shipsData, shipCounts, params) {
        let minSpeed = Infinity;
        for (let i = 0; i < shipsData.length; i++) {
            const speed = this.getShipSpeed(shipsData, i, params);
            if (shipCounts[i] > 0 && speed > 0 && !Number.isNaN(speed)) {
                minSpeed = Math.min(minSpeed, speed);
            }
        }
        return minSpeed;
    }

    /** Speed of every ship, in table order — used to label the fleet inputs. */
    getAllShipSpeeds(shipsData, params) {
        return shipsData.map((_, i) => this.getShipSpeed(shipsData, i, params));
    }

    // ------------------------------------------------------------------
    // Distance
    // ------------------------------------------------------------------

    /**
     * Counts systems strictly between the two endpoints that nobody lives in.
     * Both endpoints are excluded.
     */
    countEmptySystems(system1, system2, populatedSystems) {
        if (populatedSystems == null) {
            return 0;
        }
        const start = Math.min(system1, system2);
        const end = Math.max(system1, system2);
        const totalInRange = end - start - 1;
        const populatedInRange = populatedSystems.filter((s) => s > start && s < end).length;
        return totalInRange - populatedInRange;
    }

    /**
     * Distance between two points, in OGame distance units. Only the highest
     * differing coordinate counts: a different galaxy makes the system and planet
     * irrelevant, and so on.
     *
     * @returns {{distance: number, emptySystems: number}}
     */
    getDistance(departure, destination, params) {
        if (departure[0] !== destination[0]) {
            let galaxies = Math.abs(departure[0] - destination[0]);
            if (params.circularGalaxies) {
                galaxies = Math.min(galaxies, params.numberOfGalaxies - galaxies);
            }
            return { distance: galaxies * 20000, emptySystems: 0 };
        }
        if (departure[1] !== destination[1]) {
            return this._systemDistance(departure, destination, params);
        }
        if (departure[2] !== destination[2]) {
            return { distance: Math.abs(departure[2] - destination[2]) * 5 + 1000, emptySystems: 0 };
        }
        return { distance: 5, emptySystems: 0 };
    }

    _systemDistance(departure, destination, params) {
        const directSystems = Math.abs(departure[1] - destination[1]);

        // In a circular universe the fleet takes the shorter of the two arcs.
        const wraps = params.circularSystems
            && params.numberOfSystems - directSystems < directSystems;
        const systems = wraps ? params.numberOfSystems - directSystems : directSystems;

        if (!params.fleetIgnoreEmptySystems) {
            return { distance: systems * 95 + 2700, emptySystems: 0 };
        }

        // The manual override wins over the computed count, but it is still applied
        // to the (possibly wrapped) travelled arc, not the long way round.
        if (params.emptySystemsOverrideEnabled) {
            const empty = params.emptySystemsOverride;
            return { distance: (systems - empty) * 95 + 2700, emptySystems: empty };
        }

        const populated = params.populatedSystems?.[departure[0]] ?? null;
        let empty;

        if (wraps) {
            // The wrap arc runs from the higher endpoint up to the last system and
            // on from the first up to the lower endpoint — independent of which end
            // is the departure, so use max/min rather than departure/destination.
            const high = Math.max(departure[1], destination[1]);
            const low = Math.min(departure[1], destination[1]);
            empty = this.countEmptySystems(high, params.numberOfSystems + 1, populated)
                + this.countEmptySystems(0, low, populated);
        } else {
            empty = this.countEmptySystems(departure[1], destination[1], populated);
        }

        return { distance: (systems - empty) * 95 + 2700, emptySystems: empty };
    }

    // ------------------------------------------------------------------
    // Duration and fuel
    // ------------------------------------------------------------------

    /** Trip duration in seconds. */
    getFlightDuration(minSpeed, distance, speedPercent, uniSpeedFactor) {
        return Math.round(
            (35000 / (speedPercent / 10) * Math.sqrt(distance * 10 / minSpeed) + 10) / uniSpeedFactor
        );
    }

    /**
     * Deuterium burnt on the trip. Each ship pays at least one unit, and so does
     * the fleet as a whole.
     */
    getDeutConsumption(shipsData, shipCounts, distance, duration, uniSpeedFactor, params) {
        let total = 0;

        for (let i = 0; i < shipsData.length; i++) {
            const count = shipCounts[i];
            if (count <= 0) {
                continue;
            }
            const baseSpeed = this.getShipSpeed(shipsData, i, params);
            const speedValue = 35000 / (duration * uniSpeedFactor - 10) * Math.sqrt(distance * 10 / baseSpeed);

            // The general's fuel discount is itself scaled by the Mechan enhancement
            const classFactor = params.playerClass === PLAYER_CLASS.GENERAL
                ? 0.01 * params.deutConsReduction * (1 + 0.002 * params.lfMechanGE)
                : 0;
            const lfFactor = params.lfShipsBonuses[i][2] * 0.01;

            const perShip = Math.floor(
                Math.floor(shipsData[i][3] * 0.1 * params.deutFactor) * (1 - classFactor) * (1 - lfFactor)
            );
            const fleetBase = Math.max(Math.round(perShip * count), 1);

            total += fleetBase * distance / 35000 * ((speedValue / 10) + 1) ** 2;
        }

        return Math.max(Math.round(total), 1);
    }

    // ------------------------------------------------------------------
    // Cargo
    // ------------------------------------------------------------------

    /** Total cargo the fleet can carry. */
    getCargoCapacity(shipsData, shipCounts, params) {
        let capacity = 0;

        for (let i = 0; i < shipsData.length; i++) {
            const count = shipCounts[i];
            if (count <= 0) {
                continue;
            }
            const baseCargo = shipsData[i][4];
            let increment = count * (baseCargo * (1 + 0.05 * params.hyperTechLvl));

            // The collector hauls more in transports, the general in recyclers and pathfinders
            if (params.playerClass === PLAYER_CLASS.COLLECTOR && i < 2) {
                increment += Math.floor(count * baseCargo * 0.25 * (1 + params.lfRocktalCE * 0.01));
            }
            if (params.playerClass === PLAYER_CLASS.GENERAL
                && (i === SHIP.RECYCLER || i === SHIP.PATHFINDER)) {
                increment += count * baseCargo * 0.2;
            }

            const lfBonus = baseCargo * params.lfShipsBonuses[i][1] * 0.01;
            // EPSILON keeps values like 4.999999 from rounding down a step
            increment += Math.round((lfBonus + Number.EPSILON) * count);

            capacity += increment;
        }

        return Math.floor(capacity);
    }

    // ------------------------------------------------------------------
    // Save points
    // ------------------------------------------------------------------

    /**
     * Orders save point candidates: slowest fleet speed first, and among equally
     * slow ones the cheapest trip first.
     */
    compareSavePoints(a, b) {
        return a[0] === b[0] ? a[2] - b[2] : a[0] - b[0];
    }

    /** Universe fleet speed that applies to the selected mission type. */
    fleetSpeedFor(missionType, params) {
        if (missionType === MISSION.HOLDING) {
            return params.fleetSpeedHolding;
        }
        if (missionType === MISSION.PEACEFUL) {
            return params.fleetSpeedPeaceful;
        }
        return params.fleetSpeedWar;
    }
}
