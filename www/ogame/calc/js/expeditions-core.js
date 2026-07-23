// ============================================================================
// EXPEDITIONS CALCULATOR - CORE
// ============================================================================
// Pure expedition computations: cargo capacity of the sent fleet, the maximum
// expedition points, the resource and Dark Matter finds and which ships can be
// found. No DOM access here: everything is derived from a plain params object
// and returned as a plain result object the renderer can display.

'use strict';

// Player classes as they are offered by the class select. "Other" is what the
// game calls the General: it grants the +20% recycler / pathfinder cargo bonus.
const EXPEDITION_CLASS = { DISCOVERER: 0, COLLECTOR: 1, OTHER: 2 };

// Ships that can be sent on an expedition, in the order the life-form cargo
// bonus table lists them. The index is meaningful - it addresses the saved
// `lfShipsBonuses` array and the class-bonus checks below - so never reorder.
const EXPEDITION_SHIPS = [
  { id: 'small-cargo',   abbrev: 'SC', techId: 202, cargo: 5000 },
  { id: 'large-cargo',   abbrev: 'LC', techId: 203, cargo: 25000 },
  { id: 'light-fighter', abbrev: 'LF', techId: 204, cargo: 50 },
  { id: 'heavy-fighter', abbrev: 'HF', techId: 205, cargo: 100 },
  { id: 'cruiser',       abbrev: 'CR', techId: 206, cargo: 800 },
  { id: 'battleship',    abbrev: 'BS', techId: 207, cargo: 1500 },
  { id: 'colony-ship',   abbrev: 'CS', techId: 208, cargo: 7500 },
  { id: 'recycler',      abbrev: 'RC', techId: 209, cargo: 20000 },
  { id: 'esp-probe',     abbrev: 'EP', techId: 210, cargo: 0 },
  { id: 'bomber',        abbrev: 'BM', techId: 211, cargo: 500 },
  { id: 'destroyer',     abbrev: 'DR', techId: 213, cargo: 2000 },
  { id: 'death-star',    abbrev: 'DS', techId: 214, cargo: 1000000 },
  { id: 'battlecruiser', abbrev: 'BC', techId: 215, cargo: 750 },
  { id: 'reaper',        abbrev: 'RE', techId: 218, cargo: 10000 },
  { id: 'pathfinder',    abbrev: 'PA', techId: 219, cargo: 10000 },
];

// Ship indices carrying a player-class cargo bonus.
const EXPEDITION_TRANSPORTS = [0, 1];       // Collector: +25% on small/large cargo
const EXPEDITION_GENERAL_SHIPS = [7, 14];   // General: +20% on recyclers/pathfinders

// Ships an expedition may bring home, ordered by their expedition value (the
// second field is the structural integrity the find is paid for with). The
// first three are never found; sending a ship of tier `d` unlocks the tiers
// from 3 up to and including `d + 1`.
const EXPEDITION_FINDABLE = [
  { abbrev: 'RC', points: 16000 },
  { abbrev: 'CS', points: 30000 },
  { abbrev: 'DS', points: 9000000 },
  { abbrev: 'EP', points: 1000 },
  { abbrev: 'SC', points: 4000 },
  { abbrev: 'LF', points: 4000 },
  { abbrev: 'LC', points: 12000 },
  { abbrev: 'HF', points: 10000 },
  { abbrev: 'CR', points: 27000 },
  { abbrev: 'PA', points: 23000 },
  { abbrev: 'BS', points: 60000 },
  { abbrev: 'BC', points: 70000 },
  { abbrev: 'BM', points: 75000 },
  { abbrev: 'DR', points: 110000 },
  { abbrev: 'RE', points: 140000 },
];

// The lowest tier index that can ever be found.
const EXPEDITION_FIRST_FINDABLE = 3;

// Base Dark Matter yield of a single expedition, before the discovery bonus.
const EXPEDITION_BASE_DM = 1800;

// Floor of the resource find pool, in expedition points.
const EXPEDITION_MIN_RES_POOL = 200000;

// Floor of the pool the found ships are paid for with.
const EXPEDITION_MIN_SHIP_POOL = 10000;

class ExpeditionsCalculator {
  /**
   * Cargo capacity of `count` ships of the given type, with the hyperspace
   * technology boost, the player-class bonus and the life-form capacity
   * increase all added on top of the base capacity.
   *
   * @param {number} index Index into EXPEDITION_SHIPS.
   * @param {number} count Number of ships of that type.
   * @param {Object} p Params (hyperTechLevel, playerClass, classBonusCollector,
   *   lfShipsBonuses).
   * @returns {number} Capacity, not yet floored.
   */
  static shipCargoCapacity(index, count, p) {
    const base = EXPEDITION_SHIPS[index].cargo;
    let capacity = count * base * (1 + 0.05 * p.hyperTechLevel);

    // A Collector's transports carry 25% more, itself raised by the class bonus.
    if (p.playerClass === EXPEDITION_CLASS.COLLECTOR && EXPEDITION_TRANSPORTS.includes(index)) {
      capacity += Math.floor(count * base * 0.25 * (1 + p.classBonusCollector * 0.01));
    }
    // A General's recyclers and pathfinders carry 20% more.
    if (p.playerClass === EXPEDITION_CLASS.OTHER && EXPEDITION_GENERAL_SHIPS.includes(index)) {
      capacity += count * base * 0.2;
    }

    const bonus = Number.isFinite(p.lfShipsBonuses[index]) ? p.lfShipsBonuses[index] : 0;
    capacity += Math.floor(count * base * bonus * 0.01); // the bonus is a percentage

    return capacity;
  }

  /** Total cargo capacity of the whole fleet described by `p.counts`. */
  static fleetCargoCapacity(p) {
    let capacity = 0;
    EXPEDITION_SHIPS.forEach((ship, index) => {
      const count = p.counts[ship.abbrev] || 0;
      if (count > 0) {
        capacity += ExpeditionsCalculator.shipCargoCapacity(index, count, p);
      }
    });
    return Math.floor(capacity);
  }

  /**
   * Which ship tiers the expedition can bring home.
   *
   * @returns {Object} {canFind: {abbrev: boolean}, hasFindable: boolean}
   */
  static findableTiers(counts) {
    const lastTier = EXPEDITION_FINDABLE.length - 1;
    let maxTier = -1;

    for (let tier = EXPEDITION_FIRST_FINDABLE; tier <= lastTier; tier++) {
      if ((counts[EXPEDITION_FINDABLE[tier].abbrev] || 0) > 0) {
        // Sending a ship of this tier also unlocks the next one up.
        maxTier = Math.max(maxTier, Math.min(tier + 1, lastTier));
      }
    }

    const canFind = {};
    EXPEDITION_FINDABLE.forEach((ship, tier) => {
      canFind[ship.abbrev] = tier >= EXPEDITION_FIRST_FINDABLE && tier <= maxTier;
    });
    return { canFind, hasFindable: maxTier >= 0 };
  }

  /**
   * Run the full computation for a set of parameters.
   *
   * @param {Object} p Parameters collected from the form:
   *   highTop, playerClass, universeSpeed, hyperTechLevel, percentRes,
   *   percentShips, classBonusCollector, classBonusDiscoverer,
   *   resourceDiscoveryBooster, darkMatterDiscoveryBonus, lfShipsBonuses,
   *   counts {abbrev: number}
   * @returns {Object} Result with the fleet capacity, the maximum expedition
   *   points, the per-resource finds, the findable ships and the Dark Matter.
   */
  compute(p) {
    const capacity = ExpeditionsCalculator.fleetCargoCapacity(p);
    const { canFind, hasFindable } = ExpeditionsCalculator.findableTiers(p.counts);
    const isDiscoverer = p.playerClass === EXPEDITION_CLASS.DISCOVERER;

    // Pathfinders raise the expedition yield; for a Discoverer both the base and
    // the pathfinder multiplier scale with the universe speed.
    const hasPathfinder = (p.counts.PA || 0) > 0;
    let factor;
    if (hasPathfinder) {
      factor = isDiscoverer ? 3 * p.universeSpeed : 2;
    } else {
      factor = isDiscoverer ? 1.5 * p.universeSpeed : 1;
    }

    const basePoints = factor * p.highTop;
    const discovererBonus = isDiscoverer ? 1 + p.classBonusDiscoverer / 100 : 1;
    const maxPoints = Math.floor(basePoints * (1 + p.percentRes / 100) * discovererBonus);

    // How many large cargoes it takes to carry a maximum find home.
    const singleLCCapacity = Math.floor(ExpeditionsCalculator.shipCargoCapacity(1, 1, p));
    const minLC = singleLCCapacity > 0 ? Math.ceil(maxPoints / singleLCCapacity) : 0;

    // The resource pool the find is drawn from, capped by the fleet capacity.
    let resourcePool = Math.max(1000 * basePoints, EXPEDITION_MIN_RES_POOL) * 0.001;
    resourcePool = resourcePool
      * (1 + p.percentRes / 100)
      * discovererBonus
      * (1 + p.resourceDiscoveryBooster / 100);

    const result = {
      capacity,
      capacityExceeded: resourcePool > capacity,
      maxPoints,
      minLC,
      maxFindMetal: Math.floor(Math.min(resourcePool, capacity)),
      maxFindCrystal: Math.floor(Math.min(resourcePool / 2, capacity)),
      maxFindDeuterium: Math.floor(Math.min(resourcePool / 3, capacity)),
      darkMatter: Math.floor(EXPEDITION_BASE_DM * (1 + p.darkMatterDiscoveryBonus / 100)),
      canFind,
      findCounts: {},
    };

    // Found ships are paid for out of a pool bounded by the fleet capacity; an
    // empty fleet, or one that unlocks no tier at all, finds nothing.
    const shipPool = (hasFindable && capacity > 0)
      ? Math.max(Math.min(capacity, basePoints), EXPEDITION_MIN_SHIP_POOL)
      : 0;

    EXPEDITION_FINDABLE.forEach((ship, tier) => {
      if (tier < EXPEDITION_FIRST_FINDABLE || !canFind[ship.abbrev]) {
        result.findCounts[ship.abbrev] = 0;
        return;
      }
      const found = shipPool / ship.points;
      result.findCounts[ship.abbrev] = Math.floor(found + found * p.percentShips / 100);
    });

    return result;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    ExpeditionsCalculator,
    EXPEDITION_CLASS,
    EXPEDITION_SHIPS,
    EXPEDITION_FINDABLE,
    EXPEDITION_FIRST_FINDABLE,
    EXPEDITION_BASE_DM,
  });
}
