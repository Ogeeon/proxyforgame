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

// The class and life form fuel discounts add up rather than compound, and the game
// stops the total here however deep the life form enhancement runs.
const DEUT_REDUCTION_CAP = 90;

const MISSION = { WAR: 0, PEACEFUL: 1, HOLDING: 2, DESTROY: 3 };

// OGame 12.9.0 pinned moon destruction to a single full-speed figure: 310, which
// is a death star with hyperspace drive 7 in a 1x universe. Drive levels, the
// class bonus, the alliance and life form bonuses and the universe speed factor
// no longer move it. The speed percentage is still the player's to pick, and it
// throttles this speed the way it throttles any other.
const DESTROY_MISSION_SPEED = 310;

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
        // The warrior alliance class speeds the fleet up on a holding mission only
        if (params.warriorBonus && params.missionType === MISSION.HOLDING) {
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
     * Counts systems strictly between the two endpoints that are missing from the
     * given set. Both endpoints are excluded.
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
     * Counts systems strictly between the two endpoints that the fleet flies past
     * without paying for them.
     *
     * The universe exposes two independent settings — one skips systems nobody
     * lives in, the other skips systems where every player is inactive — so all
     * four combinations occur and each needs a different count. Two sets make
     * that possible: `active` holds the systems with at least one active player,
     * `all` holds those with at least one planet of any kind. Systems missing
     * from `active` are the empty ones plus the inactive-only ones; systems
     * missing from `all` are exactly the empty ones, so the difference isolates
     * the inactive-only systems.
     *
     * A missing set means the data never arrived; skipping nothing keeps the
     * flight time on the safe (longer) side rather than inventing a shortcut.
     */
    countSkippedSystems(system1, system2, active, all, params) {
        if (params.fleetIgnoreEmptySystems && params.fleetIgnoreInactiveSystems) {
            return this.countEmptySystems(system1, system2, active);
        }
        if (params.fleetIgnoreEmptySystems) {
            return this.countEmptySystems(system1, system2, all);
        }
        if (params.fleetIgnoreInactiveSystems) {
            if (all == null) {
                return 0;
            }
            return this.countEmptySystems(system1, system2, active)
                - this.countEmptySystems(system1, system2, all);
        }
        return 0;
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

        if (!params.fleetIgnoreEmptySystems && !params.fleetIgnoreInactiveSystems) {
            return { distance: systems * 95 + 2700, emptySystems: 0 };
        }

        // The manual override wins over the computed count, but it is still applied
        // to the (possibly wrapped) travelled arc, not the long way round.
        if (params.emptySystemsOverrideEnabled) {
            const empty = params.emptySystemsOverride;
            return { distance: (systems - empty) * 95 + 2700, emptySystems: empty };
        }

        const active = params.populatedSystems?.[departure[0]] ?? null;
        const all = params.populatedSystemsAll?.[departure[0]] ?? null;
        let empty;

        if (wraps) {
            // The wrap arc runs from the higher endpoint up to the last system and
            // on from the first up to the lower endpoint — independent of which end
            // is the departure, so use max/min rather than departure/destination.
            const high = Math.max(departure[1], destination[1]);
            const low = Math.min(departure[1], destination[1]);
            empty = this.countSkippedSystems(high, params.numberOfSystems + 1, active, all, params)
                + this.countSkippedSystems(0, low, active, all, params);
        } else {
            empty = this.countSkippedSystems(departure[1], destination[1], active, all, params);
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
     * Deuterium burnt on the trip. A single ship pays at least one unit, so does
     * a ship type's share of the bill, and so does the fleet as a whole.
     *
     * @param {number} [fixedSpeed] the one speed every ship flies at, for a
     *   mission that pins it; 0 leaves each ship on its own speed. The duration
     *   was computed from that same speed, so the fuel has to follow it or the
     *   two columns describe different flights.
     */
    getDeutConsumption(shipsData, shipCounts, distance, duration, uniSpeedFactor, params, fixedSpeed = 0) {
        let total = 0;

        for (let i = 0; i < shipsData.length; i++) {
            const count = shipCounts[i];
            if (count <= 0) {
                continue;
            }
            const baseSpeed = fixedSpeed || this.getShipSpeed(shipsData, i, params);
            const speedValue = 35000 / (duration * uniSpeedFactor - 10) * Math.sqrt(distance * 10 / baseSpeed);

            // The class discount and the ship's own life form discount are two
            // percentages the game adds together, not two factors it multiplies, and
            // the sum stops at DEUT_REDUCTION_CAP. The general's share is scaled by the
            // Mechan enhancement first, on the same 0.01 scale the speed and cargo
            // bonuses above use. Both stay in percent until the last step: 1 - 0.9
            // lands just under 0.1 in binary, which floors a 45 down to a 44.
            const classPercent = params.playerClass === PLAYER_CLASS.GENERAL
                ? params.deutConsReduction * (1 + 0.01 * params.lfMechanGE)
                : 0;
            const reduction = Math.min(
                classPercent + params.lfShipsBonuses[i][2], DEUT_REDUCTION_CAP);

            // No hull flies free: a ship whose consumption falls below a unit
            // once the universe factor and the discounts are applied still pays
            // that unit. The probe and the death star, both on a base of 1, are
            // the whole of this case - and a fleet carries them in thousands.
            const perShip = Math.max(Math.floor(
                Math.floor(shipsData[i][3] * 0.1 * params.deutFactor) * (100 - reduction) / 100
            ), 1);
            const fleetBase = Math.max(Math.round(perShip * count), 1);

            // Each ship type is settled on a whole number of its own before it
            // joins the fleet's bill, and no type is charged less than one, so a
            // single ship among a million is a unit rather than a rounding error.
            total += Math.max(Math.round(
                fleetBase * distance / 35000 * ((speedValue / 10) + 1) ** 2), 1);
        }

        // Already whole - the floor is for the fleet with nothing in it
        return Math.max(total, 1);
    }

    // ------------------------------------------------------------------
    // Cargo
    // ------------------------------------------------------------------

    /**
     * Total cargo the fleet can carry. The hold of a single ship is what gets
     * rounded off - the game drops the fraction once per ship and then multiplies,
     * so a fleet of a million ships loses a million fractions, not one.
     */
    getCargoCapacity(shipsData, shipCounts, params) {
        let capacity = 0;

        for (let i = 0; i < shipsData.length; i++) {
            const count = shipCounts[i];
            if (count <= 0) {
                continue;
            }

            // The collector hauls more in transports, the general in recyclers and
            // pathfinders; both extras are scaled by their life form enhancement
            let classBonus = 0;
            let classEnhancement = 0;
            if (params.playerClass === PLAYER_CLASS.COLLECTOR && i < 2) {
                classBonus = HOLD_CLASS_BONUS.COLLECTOR;
                classEnhancement = params.lfRocktalCE;
            }
            if (params.playerClass === PLAYER_CLASS.GENERAL
                && (i === SHIP.RECYCLER || i === SHIP.PATHFINDER)) {
                classBonus = HOLD_CLASS_BONUS.GENERAL;
                classEnhancement = params.lfMechanGE;
            }

            capacity += shipHold(shipsData[i][4], {
                hyperTechLevel: params.hyperTechLvl, classBonus, classEnhancement,
                lfBonus: params.lfShipsBonuses[i][1],
            }) * count;
        }

        return capacity;
    }

    // ------------------------------------------------------------------
    // Mission type
    // ------------------------------------------------------------------

    /**
     * The speed the fleet flies at at 100%. Every mission but moon destruction
     * takes the speed of its slowest ship; destruction is pinned to 310 no
     * matter what is in the fleet or how far the drives are researched. The
     * speed percentage still divides it, in that mission as in any other.
     */
    speedForMission(missionType, minSpeed) {
        return missionType === MISSION.DESTROY ? DESTROY_MISSION_SPEED : minSpeed;
    }

    /** Universe fleet speed that applies to the selected mission type. */
    fleetSpeedFor(missionType, params) {
        if (missionType === MISSION.DESTROY) {
            // 310 already is the 1x figure, so the universe factor is out: the
            // trip takes the same time on every server.
            return 1;
        }
        if (missionType === MISSION.HOLDING) {
            return params.fleetSpeedHolding;
        }
        if (missionType === MISSION.PEACEFUL) {
            return params.fleetSpeedPeaceful;
        }
        return params.fleetSpeedWar;
    }

    /**
     * Everything the mission decides about a flight: the speed it flies at at
     * 100%, the universe factor that divides its duration, and the one speed
     * every ship burns fuel at when the mission pins it (0 when it does not).
     * The fuel is read back out of the duration, which carries the speed
     * percentage, so the fixed speed alone is enough for a throttled trip too.
     *
     * @param {number} missionType
     * @param {number} minSpeed the slowest ship's speed, or the manual override
     * @returns {{flightSpeed: number, fleetSpeed: number, fixedSpeed: number}}
     */
    missionSpeeds(missionType, minSpeed, params) {
        const flightSpeed = this.speedForMission(missionType, minSpeed);
        return {
            flightSpeed,
            fleetSpeed: this.fleetSpeedFor(missionType, params),
            fixedSpeed: missionType === MISSION.DESTROY ? flightSpeed : 0,
        };
    }

    /**
     * The speed steps the fleet-speed control offers, fastest first: every 5%
     * for the general, every 10% for every other class.
     * @param {number} playerClass
     * @returns {number[]}
     */
    speedPercents(playerClass) {
        return percentSteps(playerClass === PLAYER_CLASS.GENERAL ? 5 : 10);
    }

    // ------------------------------------------------------------------
    // Flight plan
    // ------------------------------------------------------------------

    /**
     * One flight at one or more speed percentages: how long it takes and what
     * it burns at each, and what the fleet carries.
     *
     * @param {any[][]} shipsData from buildShipsData()
     * @param {number[]} counts ships in table order
     * @param {number} distance from getDistance()
     * @param {object} params
     * @param {object} [flight]
     * @param {number} [flight.minSpeed] the fleet's speed at 100% before the
     *   mission has its say - the manual override goes here; the slowest ship's
     *   speed when left out
     * @param {number} [flight.missionType] defaults to params.missionType
     * @param {number[]} [flight.percents] defaults to every 5% step, 100 down to 5
     * @returns {FlightPlan}
     */
    planFlight(shipsData, counts, distance, params, flight = {}) {
        const missionType = flight.missionType ?? params.missionType;
        // The mission also decides the warrior's holding-only speed bonus, so
        // the ships are timed and fuelled under the same one.
        const mission = { ...params, missionType };
        const minSpeed = flight.minSpeed ?? this.getMinSpeed(shipsData, counts, mission);
        const { flightSpeed, fleetSpeed, fixedSpeed } = this.missionSpeeds(missionType, minSpeed, mission);

        const entries = (flight.percents ?? percentSteps(5)).map((percent) => {
            const duration = this.getFlightDuration(flightSpeed, distance, percent, fleetSpeed);
            return {
                percent,
                duration,
                deut: this.getDeutConsumption(shipsData, counts, distance, duration, fleetSpeed, mission,
                    fixedSpeed),
            };
        });
        return { flightSpeed, fleetSpeed, cargo: this.getCargoCapacity(shipsData, counts, mission), entries };
    }

    // ------------------------------------------------------------------
    // Save points
    // ------------------------------------------------------------------

    /**
     * The flight a save-point window asks for. The window covers the whole
     * trip: one leg when the fleet only flies out, two when it comes back. Both
     * the target duration and the tolerance are per leg, so they are split the
     * same way.
     *
     * @param {number} startMs departure, epoch ms
     * @param {number} returnMs return home - or arrival, one way - epoch ms
     * @param {number} toleranceSeconds for the whole window
     * @param {boolean} oneWay
     * @returns {{legs: number, target: number, tolerance: number}} target and
     *   tolerance in seconds per leg
     */
    saveWindow(startMs, returnMs, toleranceSeconds, oneWay) {
        const legs = oneWay ? 1 : 2;
        return {
            legs,
            target: Math.round(Math.ceil((returnMs - startMs) / 1000) / legs),
            tolerance: Math.round(toleranceSeconds / legs),
        };
    }

    /**
     * Orders save points: slowest fleet speed first, and among equally slow
     * ones the cheapest trip first.
     * @param {SavePoint} a
     * @param {SavePoint} b
     */
    compareSavePoints(a, b) {
        return a.speedPercent === b.speedPercent ? a.cost - b.cost : a.speedPercent - b.speedPercent;
    }

    /**
     * Every point along the three axes - other galaxies, other systems of the
     * departure galaxy, other positions of the departure system - that the
     * fleet reaches at one of its speed steps with a leg strictly inside
     * target ± tolerance. A flight to a save point is always a peaceful
     * mission, whatever params.missionType says.
     *
     * @param {any[][]} shipsData from buildShipsData()
     * @param {number[]} counts ships in table order
     * @param {number[]} departure
     * @param {object} params
     * @param {object} search
     * @param {number} search.target seconds per leg, from saveWindow()
     * @param {number} search.tolerance seconds per leg, exclusive on both sides
     * @param {number} search.legs 1 one way, 2 there and back
     * @param {number} [search.startAt] departure, epoch ms; arriveAt counts from it
     * @param {number} [search.minSpeed] the manual speed override; the slowest
     *   ship's speed when left out
     * @returns {{galaxies: SavePoint[], systems: SavePoint[], planets: SavePoint[]}}
     *   each sorted by compareSavePoints()
     */
    findSavePoints(shipsData, counts, departure, params, search) {
        const peaceful = { ...params, missionType: MISSION.PEACEFUL };
        const minSpeed = search.minSpeed ?? this.getMinSpeed(shipsData, counts, peaceful);
        const ctx = {
            shipsData, counts, departure,
            params: peaceful,
            speeds: this.missionSpeeds(MISSION.PEACEFUL, minSpeed, peaceful),
            percents: this.speedPercents(params.playerClass),
            target: search.target,
            tolerance: search.tolerance,
            legs: search.legs,
            startAt: search.startAt ?? 0,
        };
        const axes = [
            { limit: params.numberOfGalaxies, circular: params.circularGalaxies },
            { limit: params.numberOfSystems, circular: params.circularSystems },
            { limit: 16, circular: false },
        ];
        const [galaxies, systems, planets] = axes.map((axis, axisIndex) =>
            this._axisSavePoints(ctx, axisIndex, axis));
        return { galaxies, systems, planets };
    }

    /**
     * Sweeps one axis outwards from the departure, one step at a time.
     * @returns {SavePoint[]}
     */
    _axisSavePoints(ctx, axisIndex, axis) {
        const { shipsData, counts, departure, params, speeds, percents, target, tolerance, legs, startAt } = ctx;
        /** @type {SavePoint[]} */
        const rows = [];
        // Past half a ring the fleet would take the short way round, so every
        // farther delta only repeats a trip already listed. A straight axis has
        // no such repeat and runs to its own ends.
        const half = Math.floor(axis.limit / 2);
        for (let delta = 1; !(axis.circular && delta > half); delta++) {
            const distance = this._distanceForDelta(axisIndex, delta, departure, params, axis.limit);
            if (distance === 0) {
                break;
            }
            for (const percent of percents) {
                const duration = this.getFlightDuration(speeds.flightSpeed, distance, percent, speeds.fleetSpeed);
                // Too far even at full speed: every slower step and every
                // farther delta only take longer.
                if (percent === 100 && duration > target + tolerance) {
                    break;
                }
                if (duration <= target - tolerance || duration >= target + tolerance) {
                    continue;
                }
                const cost = this.getDeutConsumption(shipsData, counts, distance, duration, speeds.fleetSpeed,
                    params, speeds.fixedSpeed);
                // A one-way fleet is done on landing; a returning one is home
                // after twice the same flight.
                const arriveAt = startAt + duration * 1000 * legs;
                this._pointsAtDelta(axisIndex, delta, departure, axis).forEach((point) =>
                    rows.push({ speedPercent: percent, point, cost, arriveAt }));
            }
        }
        return rows.sort((a, b) => this.compareSavePoints(a, b));
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
        return this.getDistance(departure, destination, params).distance;
    }

    /**
     * The one or two points `delta` steps from the departure along one axis.
     *
     * Both have to sit exactly `delta` steps away, or the arrival promised for
     * them is not the one the flight tab computes. On a ring axis the step off
     * the end wraps to the other end - `below + limit` going down, `above -
     * limit` going up - which is `delta` steps the long way round and therefore
     * the same trip. A wrap can land on the point the other direction already
     * gave (an even-sized ring, delta at half of it): one is enough.
     *
     * @returns {number[][]}
     */
    _pointsAtDelta(axisIndex, delta, departure, axis) {
        const coords = [];
        const below = departure[axisIndex] - delta;
        const above = departure[axisIndex] + delta;

        if (below > 0) {
            coords.push(below);
        } else if (axis.circular) {
            coords.push(below + axis.limit);
        }

        let up = null;
        if (above <= axis.limit) {
            up = above;
        } else if (axis.circular) {
            up = above - axis.limit;
        }
        if (up !== null && !coords.includes(up)) {
            coords.push(up);
        }

        return coords.map((coord) => {
            const point = [...departure];
            point[axisIndex] = coord;
            return point;
        });
    }
}

/**
 * Speed percentages from 100 down in steps of `step`.
 * @param {number} step
 * @returns {number[]}
 */
function percentSteps(step) {
    const percents = [];
    for (let percent = 100; percent > 0; percent -= step) {
        percents.push(percent);
    }
    return percents;
}

/**
 * @typedef {object} FlightPlan
 * @property {number} flightSpeed the speed at 100%, after the mission's rules
 * @property {number} fleetSpeed the universe factor the mission flies under
 * @property {number} cargo what the fleet carries
 * @property {Array<{percent: number, duration: number, deut: number}>} entries
 *   one per speed step asked for, in the same order; duration in seconds
 */

/**
 * @typedef {object} SavePoint
 * @property {number} speedPercent the speed step that fits the window
 * @property {number[]} point the coordinates to fly to
 * @property {number} cost deuterium for one leg
 * @property {number} arriveAt epoch ms the fleet lands - at the point one way,
 *   back home on a round trip
 */
