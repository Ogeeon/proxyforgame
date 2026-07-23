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
// Base recycler hold; hyperspace technology adds 5% per level.
const MOON_RECYCLER_CAPACITY = 20000;

class MoonCalculator {
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
   *   defenseToDebris: whether destroyed defenses feed the field,
   *   deutToDebris: whether deuterium is part of the field,
   *   promoMoon: whether the 40% event cap is active.
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

    const chanceCap = p.promoMoon ? MOON_CHANCE_CAP_PROMO : MOON_CHANCE_CAP;
    const createChance = clampNumber(debrisTotal / MOON_DF_PER_FULL_CHANCE, 0, chanceCap);

    const cargoSpace = Math.round(MOON_RECYCLER_CAPACITY * (1 + 0.05 * p.hyperTechLevel));
    const recyclers = cargoSpace > 0 ? Math.ceil(debrisTotal / cargoSpace) : 0;

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
      recyclers,
      maxCounts: MoonCalculator.maxCounts(dfShare, deutFactor, chanceCap, p.defenseToDebris),
    };
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
   * Run both sub-calculators for a single params object.
   */
  compute(p) {
    return Object.assign({}, this.computeDestroy(p), this.computeCreate(p));
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    MoonCalculator,
    MOON_UNITS,
    MOON_DF_PER_FULL_CHANCE,
    MOON_CHANCE_CAP,
    MOON_CHANCE_CAP_PROMO,
    MOON_RECYCLER_CAPACITY,
  });
}
