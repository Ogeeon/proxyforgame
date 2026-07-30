// ============================================================================
// MOON CALCULATOR - CORE
// ============================================================================
// Pure computations for the two moon sub-calculators:
//   * destroying a moon with Death Stars;
//   * creating a moon out of a debris field.
// No DOM access here: everything is derived from a plain params object and
// returned as a plain result object the renderer can display.

'use strict';

// Build cost of every unit that can end up in the debris field, keyed by the
// id of its count input. `group` drives which units feed the debris field:
//   fleet     - always dies in combat, always contributes;
//   satellite - solar satellites cannot leave the planet, so they always die
//               and always contribute (no toggle in the UI);
//   defense   - only contributes when the "defenses to debris" universe
//               setting is enabled.
const MOON_UNITS = [
  { id: 'small-cargo', metal: 2000, crystal: 2000, deuterium: 0, group: 'fleet' },
  { id: 'large-cargo', metal: 6000, crystal: 6000, deuterium: 0, group: 'fleet' },
  { id: 'light-fighter', metal: 3000, crystal: 1000, deuterium: 0, group: 'fleet' },
  { id: 'heavy-fighter', metal: 6000, crystal: 4000, deuterium: 0, group: 'fleet' },
  { id: 'cruiser', metal: 20000, crystal: 7000, deuterium: 2000, group: 'fleet' },
  { id: 'battleship', metal: 45000, crystal: 15000, deuterium: 0, group: 'fleet' },
  { id: 'colony-ship', metal: 10000, crystal: 20000, deuterium: 10000, group: 'fleet' },
  { id: 'recycler', metal: 10000, crystal: 6000, deuterium: 2000, group: 'fleet' },
  { id: 'esp-probe', metal: 0, crystal: 1000, deuterium: 0, group: 'fleet' },
  { id: 'bomber', metal: 50000, crystal: 25000, deuterium: 15000, group: 'fleet' },
  { id: 'destroyer', metal: 60000, crystal: 50000, deuterium: 15000, group: 'fleet' },
  { id: 'death-star', metal: 5000000, crystal: 4000000, deuterium: 1000000, group: 'fleet' },
  { id: 'battlecruiser', metal: 30000, crystal: 40000, deuterium: 15000, group: 'fleet' },
  { id: 'reaper', metal: 85000, crystal: 55000, deuterium: 20000, group: 'fleet' },
  { id: 'pathfinder', metal: 8000, crystal: 15000, deuterium: 8000, group: 'fleet' },
  { id: 'solar-sat', metal: 0, crystal: 2000, deuterium: 500, group: 'satellite' },
  { id: 'rocket-launcher', metal: 2000, crystal: 0, deuterium: 0, group: 'defense' },
  { id: 'light-laser', metal: 1500, crystal: 500, deuterium: 0, group: 'defense' },
  { id: 'heavy-laser', metal: 6000, crystal: 2000, deuterium: 0, group: 'defense' },
  { id: 'gauss-cannon', metal: 20000, crystal: 15000, deuterium: 2000, group: 'defense' },
  { id: 'ion-cannon', metal: 2000, crystal: 6000, deuterium: 0, group: 'defense' },
  { id: 'plasma-turret', metal: 50000, crystal: 50000, deuterium: 30000, group: 'defense' },
  { id: 'small-shield', metal: 10000, crystal: 10000, deuterium: 0, group: 'defense' },
  { id: 'large-shield', metal: 50000, crystal: 50000, deuterium: 0, group: 'defense' },
];

// A debris field of 100k resources is worth 1% moon chance, so a full 100%
// would take 10 000 000 — the cap below is what actually limits the result.
const MOON_DF_PER_FULL_CHANCE = 10000000;
const MOON_CHANCE_CAP = 0.20;
const MOON_CHANCE_CAP_PROMO = 0.40;

// Moon diameter, per the formula the community derived from observed moons
// (board.en.ogame.gameforge.com thread 850762, owiki.de/index.php/Mond):
//   D = floor(1000 * sqrt(10 + X + 300 * p0) * (1 + 0.005 * supraLevel))
// where p0 is the debris share of a full chance capped at 20% (unrounded,
// unlike the displayed chance) and X is a uniformly distributed integer in
// [0, 10]. So a given debris field yields eleven equally likely diameters:
// 2M of debris always gives 8366..8944 km, and the smallest moon the game can
// produce is 3605 km (the 1% minimum chance, X = 0).
//
// Two consequences worth keeping in mind:
//   * the diameter follows the debris field alone - the fleet composition that
//     produced it makes no difference;
//   * the event chance is added on top of the debris share, so it raises the
//     creation chance without ever growing the moon.
const MOON_SIZE_BASE = 10;
const MOON_SIZE_ROLLS = 11;
const MOON_SIZE_CHANCE_FACTOR = 300;
// Kaelesh Supra Refractor: every level adds 0.5% to both the creation chance
// and the diameter, and the diameter cannot pass 9400 km.
const MOON_SUPRA_BONUS_PER_LEVEL = 0.005;
const MOON_SIZE_CAP = 9400;
// Base recycler hold; hyperspace technology adds 5% per level.
const MOON_RECYCLER_CAPACITY = 20000;

// Recycler cargo bonus granted by the General class. It is the only player
// class that changes anything here - the Collector's +25% applies to
// transports, which this calculator never uses - so the form offers a single
// General checkbox instead of the usual class selector.
const MOON_GENERAL_CARGO_BONUS = 0.20;

// Sensor phalanx range bonus granted by the Discoverer class. The class
// checkbox of the phalanx panel is independent of the General checkbox above:
// the three panels are three separate tools (someone else's moon, your own
// fleet, your own phalanx) rather than one model of one player, so they are
// deliberately not tied together even though a player has a single class.
const PHALANX_DISCOVERER_BONUS = 0.20;

// Levels above this are unreachable in practice: at level 24 the range already
// spans 575 systems, more than the largest universe the flight calculator
// admits (550).
const PHALANX_MAX_LEVEL = 50;

class MoonCalculator {
  /**
   * Cargo capacity, matching the costs / graviton calculators:
   *   base * (1 + 0.05 * hyperTech)  +  base * classBonus  +  floor(base * cap%/100)
   * where the class bonus and the life-form capacity increase are additive,
   * never multiplied onto the hyperspace-boosted value.
   *
   * @param {number} base Base cargo capacity (20000 for a recycler).
   * @param {number} hyperTechLevel Hyperspace technology level.
   * @param {number} classBonus Additive class fraction: 0.20 for a General's
   *   recyclers, 0 otherwise (see MOON_GENERAL_CARGO_BONUS).
   * @param {number} capacityIncrease Life-form cargo capacity increase, %.
   */
  static cargoCapacity(base, hyperTechLevel, classBonus, capacityIncrease) {
    let cap = base * (1 + 0.05 * hyperTechLevel);
    cap += base * classBonus;
    cap += Math.floor(base * 0.01 * capacityIncrease);
    return cap;
  }

  /**
   * Destruction sub-calculator: the chance to blow up the target moon and the
   * chance the Death Stars are destroyed in the process.
   *
   * @param {Object} p Parameters: moonSize (moon diameter, km), dsCount.
   */
  computeDestroy(p) {
    const moonSize = Math.max(0, p.moonSize);
    const dsCount = Math.max(0, p.dsCount);
    return {
      destroyChance: clampNumber((100 - Math.sqrt(moonSize)) * Math.sqrt(dsCount), 0, 100),
      blowChance: clampNumber(0.5 * Math.sqrt(moonSize), 0, 100),
    };
  }

  /**
   * Creation sub-calculator. Everything destroyed over the planet lands in the
   * same debris field, which drives both the moon chance and the recycling
   * figures.
   *
   * @param {Object} p Parameters:
   *   counts: {unitId: number} for every entry of MOON_UNITS,
   *   debrisPercent: share of a destroyed unit that goes into the field, %,
   *   hyperTechLevel: hyperspace technology level (recycler hold),
   *   isGeneral: whether the player has the General class (recycler hold),
   *   rcCapacityIncrease: life-form recycler capacity increase, %,
   *   defenseToDebris: whether destroyed defenses feed the field,
   *   deutToDebris: whether deuterium is part of the field,
   *   promoMoon: whether the 40% event cap is active,
   *   supraRefractorLevel: Kaelesh Supra Refractor level.
   */
  computeCreate(p) {
    // Round the share to 2 decimals so e.g. 55% does not grow a float tail.
    const dfShare = Number.parseFloat(dropFraction(0.01 * p.debrisPercent, 2));
    const deutFactor = p.deutToDebris ? 1 : 0;
    const counts = p.counts || {};

    // Full build cost of everything entered, and the subset of it that ends up
    // in the debris field.
    const cost = { metal: 0, crystal: 0, deuterium: 0 };
    const source = { metal: 0, crystal: 0, deuterium: 0 };

    MOON_UNITS.forEach((unit) => {
      const count = Math.max(0, counts[unit.id] || 0);
      cost.metal += count * unit.metal;
      cost.crystal += count * unit.crystal;
      cost.deuterium += count * unit.deuterium;

      if (!MoonCalculator.feedsDebris(unit, p.defenseToDebris)) return;
      source.metal += count * unit.metal;
      source.crystal += count * unit.crystal;
      source.deuterium += count * unit.deuterium;
    });

    const recyclableMetal = Math.floor(source.metal * dfShare);
    const recyclableCrystal = Math.floor(source.crystal * dfShare);
    const recyclableDeut = Math.floor(deutFactor * source.deuterium * dfShare);
    const debrisTotal = recyclableMetal + recyclableCrystal + recyclableDeut;

    // The Supra Refractor lifts both the chance and its cap, so the debris
    // field needed to max out the chance stays the same - `maxCounts` below
    // therefore keeps working off the unboosted cap.
    const supraFactor = MoonCalculator.supraFactor(p.supraRefractorLevel);
    const baseChanceCap = p.promoMoon ? MOON_CHANCE_CAP_PROMO : MOON_CHANCE_CAP;
    const chanceCap = baseChanceCap * supraFactor;
    const createChance = clampNumber(
      supraFactor * debrisTotal / MOON_DF_PER_FULL_CHANCE, 0, chanceCap
    );
    const moonSizes = MoonCalculator.moonSizes(debrisTotal, p.supraRefractorLevel);

    const classBonus = p.isGeneral ? MOON_GENERAL_CARGO_BONUS : 0;
    const recyclerCapacity = MoonCalculator.cargoCapacity(
      MOON_RECYCLER_CAPACITY, p.hyperTechLevel, classBonus, p.rcCapacityIncrease
    );
    const recyclers = recyclerCapacity > 0 ? Math.ceil(debrisTotal / recyclerCapacity) : 0;

    return {
      metalRequired: cost.metal,
      crystalRequired: cost.crystal,
      deuteriumRequired: cost.deuterium,
      recyclableMetal,
      recyclableCrystal,
      recyclableDeut,
      debrisTotal,
      createChance,
      chanceCap,
      moonSizes,
      moonSizeMin: moonSizes.length > 0 ? moonSizes[0] : null,
      moonSizeMax: moonSizes.length > 0 ? moonSizes[moonSizes.length - 1] : null,
      recyclerCapacity,
      recyclers,
      maxCounts: MoonCalculator.maxCounts(dfShare, deutFactor, baseChanceCap, p.defenseToDebris),
    };
  }

  /**
   * Supra Refractor multiplier applied to both the creation chance and the
   * diameter: 1 + 0.005 per level.
   */
  static supraFactor(supraRefractorLevel) {
    return 1 + MOON_SUPRA_BONUS_PER_LEVEL * Math.max(0, supraRefractorLevel || 0);
  }

  /**
   * Every diameter a moon born from this debris field can have, ascending.
   * All eleven entries are equally likely; an empty array means no moon is
   * possible at all because nothing was destroyed over the planet.
   *
   * The debris share is capped at 20% here (see MOON_SIZE_BASE above): past
   * 2M of debris the field no longer grows the moon.
   *
   * @param {number} debrisTotal Debris field size, resource units.
   * @param {number} supraRefractorLevel Kaelesh Supra Refractor level.
   * @returns {number[]} Diameters in km, or [] when there is no debris.
   */
  static moonSizes(debrisTotal, supraRefractorLevel) {
    if (!(debrisTotal > 0)) return [];
    const chanceShare = clampNumber(
      debrisTotal / MOON_DF_PER_FULL_CHANCE, 0, MOON_CHANCE_CAP
    );
    const supraFactor = MoonCalculator.supraFactor(supraRefractorLevel);
    const sizes = [];
    for (let roll = 0; roll < MOON_SIZE_ROLLS; roll++) {
      const squared = MOON_SIZE_BASE + roll + MOON_SIZE_CHANCE_FACTOR * chanceShare;
      const diameter = Math.floor(1000 * Math.sqrt(squared) * supraFactor);
      sizes.push(Math.min(diameter, MOON_SIZE_CAP));
    }
    return sizes;
  }

  /**
   * Whether a destroyed unit of this kind contributes to the debris field.
   * Fleet and solar satellites always do; defenses only when the universe
   * setting is enabled.
   */
  static feedsDebris(unit, defenseToDebris) {
    return unit.group !== 'defense' || !!defenseToDebris;
  }

  /**
   * How many units of each kind it takes to reach the maximum moon chance.
   * Units that cannot contribute (defenses with the setting off, or a debris
   * share of 0) get `null`, which the renderer shows as a dash.
   *
   * @returns {Object} {unitId: number|null}
   */
  static maxCounts(dfShare, deutFactor, chanceCap, defenseToDebris) {
    const capDF = chanceCap * MOON_DF_PER_FULL_CHANCE;
    const result = {};
    MOON_UNITS.forEach((unit) => {
      if (!MoonCalculator.feedsDebris(unit, defenseToDebris)) {
        result[unit.id] = null;
        return;
      }
      const unitDF = (unit.metal + unit.crystal + deutFactor * unit.deuterium) * dfShare;
      result[unit.id] = unitDF > 0 ? Math.ceil(capDF / unitDF) : null;
    });
    return result;
  }

  /**
   * Sensor phalanx sub-calculator: how far the phalanx sees, which systems
   * that covers, and what level it would take to reach a given target.
   *
   * @param {Object} p Parameters:
   *   phalanxLevel: sensor phalanx level,
   *   phalanxRangeBonus: range bonus from the Interplanetary Analysis
   *     Network, already in percent (see phalanxBonus),
   *   isDiscoverer: whether the player has the Discoverer class,
   *   discovererBonus: Discoverer class bonus increase, %,
   *   ownSystem: the system the phalanx sits in,
   *   targetSystem: the system to reach,
   *   circularSystems: whether the galaxy wraps around,
   *   numberOfSystems: systems per galaxy.
   */
  computePhalanx(p) {
    const bonus = MoonCalculator.phalanxBonus(p);
    const range = MoonCalculator.phalanxRange(p.phalanxLevel, bonus);
    const coverage = MoonCalculator.phalanxCoverage(
      p.ownSystem, range, p.circularSystems, p.numberOfSystems
    );
    const distance = MoonCalculator.systemDistance(
      p.ownSystem, p.targetSystem, p.circularSystems, p.numberOfSystems
    );
    return {
      phalanxRange: range,
      phalanxSegments: coverage.segments,
      phalanxSystemsInRange: coverage.count,
      phalanxDistance: distance,
      phalanxLevelRequired: MoonCalculator.phalanxLevelFor(distance, bonus),
    };
  }

  /**
   * The two range bonuses, summed into the single fraction phalanxRange
   * multiplies by.
   *
   * Both arrive as ready percentages rather than as building levels, unlike
   * the Supra Refractor of the creation panel. That is not an inconsistency:
   * the Supra Refractor is a building, and building bonuses are used as-is,
   * while both bonuses here come from researches, whose bonuses the game
   * further multiplies by the life form technology bonus. That amplifier is
   * modelled nowhere in this project - the production calculator also asks for
   * the finished percentage - so deriving either bonus from a level here would
   * silently understate the range for anyone who has one.
   *
   *   phalanxRangeBonus - Interplanetary Analysis Network, +0.6% per level,
   *     uncapped;
   *   discovererBonus   - Kaelesh Discoverer Enhancement, +0.2% per level,
   *     uncapped, which raises the Discoverer class bonus rather than the
   *     range directly.
   */
  static phalanxBonus(p) {
    const analysisNetwork = Math.max(0, p.phalanxRangeBonus || 0) / 100;
    if (!p.isDiscoverer) return analysisNetwork;
    const amplifier = 1 + Math.max(0, p.discovererBonus || 0) / 100;
    return analysisNetwork + PHALANX_DISCOVERER_BONUS * amplifier;
  }

  /**
   * How many systems in each direction a phalanx of this level covers.
   *
   * The base is the level squared minus one, so a level 1 phalanx reaches 0
   * systems - it sees its own system and nothing else.
   *
   * Three things about the bonus are assumptions, not established facts: that
   * it multiplies the base range at all, that the two sources add into one
   * multiplier instead of compounding, and that the product is truncated
   * exactly once, here at the end. None of it is stated by the life form data
   * the percentages come from, which only gives the per-level values.
   *
   * @param {number} level Sensor phalanx level.
   * @param {number} bonus Combined bonus fraction from phalanxBonus.
   */
  static phalanxRange(level, bonus) {
    const lvl = Math.max(1, Math.floor(level || 1));
    return Math.floor((lvl * lvl - 1) * (1 + bonus));
  }

  /**
   * The systems the phalanx covers, as ascending [from, to] pairs.
   *
   * A circular galaxy wraps, so the reach around system 5 comes back as two
   * segments at the far end and the near end; once the reach closes the ring
   * (2 * range + 1 systems or more) the whole galaxy is covered and collapses
   * back to a single segment. A galaxy that does not wrap simply clips at
   * either end, and `count` then reports the clipped total rather than the
   * nominal width.
   *
   * @returns {{segments: number[][], count: number}}
   */
  static phalanxCoverage(ownSystem, range, circularSystems, numberOfSystems) {
    const total = Math.max(1, Math.floor(numberOfSystems || 1));
    const own = clampNumber(Math.floor(ownSystem || 1), 1, total);
    const reach = Math.max(0, range);

    if (!circularSystems) {
      const from = Math.max(1, own - reach);
      const to = Math.min(total, own + reach);
      return { segments: [[from, to]], count: to - from + 1 };
    }

    if (2 * reach + 1 >= total) {
      return { segments: [[1, total]], count: total };
    }

    const width = 2 * reach + 1;
    const low = own - reach;
    const high = own + reach;
    if (low < 1) return { segments: [[total + low, total], [1, high]], count: width };
    if (high > total) return { segments: [[low, total], [1, high - total]], count: width };
    return { segments: [[low, high]], count: width };
  }

  /**
   * Distance between two systems of the same galaxy, in systems. A circular
   * galaxy is reached the short way round, matching countSystems() of the
   * flight calculator.
   */
  static systemDistance(from, to, circularSystems, numberOfSystems) {
    const total = Math.max(1, Math.floor(numberOfSystems || 1));
    const start = clampNumber(Math.floor(from || 1), 1, total);
    const end = clampNumber(Math.floor(to || 1), 1, total);
    const direct = Math.abs(start - end);
    return circularSystems ? Math.min(direct, total - direct) : direct;
  }

  /**
   * Lowest phalanx level whose range covers `distance`, or null when even
   * PHALANX_MAX_LEVEL falls short - which no universe this calculator accepts
   * can actually produce.
   *
   * Found by trying levels rather than by inverting the formula: the bonus and
   * its truncation would have to be inverted too, and the two expressions
   * would then be free to disagree on the boundaries.
   */
  static phalanxLevelFor(distance, bonus) {
    for (let level = 1; level <= PHALANX_MAX_LEVEL; level++) {
      if (MoonCalculator.phalanxRange(level, bonus) >= distance) return level;
    }
    return null;
  }

  /**
   * Run every sub-calculator for a single params object.
   */
  compute(p) {
    return { ...this.computeDestroy(p), ...this.computeCreate(p), ...this.computePhalanx(p) };
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    MoonCalculator,
    MOON_UNITS,
    MOON_DF_PER_FULL_CHANCE,
    MOON_CHANCE_CAP,
    MOON_CHANCE_CAP_PROMO,
    MOON_SIZE_ROLLS,
    MOON_SIZE_CAP,
    MOON_SUPRA_BONUS_PER_LEVEL,
    MOON_RECYCLER_CAPACITY,
    MOON_GENERAL_CARGO_BONUS,
    PHALANX_DISCOVERER_BONUS,
    PHALANX_MAX_LEVEL,
  });
}
