// ============================================================================
// QUEUE CALCULATOR - CORE
// ============================================================================
// Pure data structures and cost/time computations for the build queue.
// Wraps getBuildCost_C / getBuildTime_C (ogame-costs.js) so callers don't need to
// remember the parameter order for queued single-level steps.

'use strict';

const TECH_ROBOT_FACTORY = 14;
const TECH_NANITE_FACTORY = 15;
const TECH_TERRAFORMER = 33;
const TECH_SHIPYARD = 36;
const TECH_LUNAR_BASE = 41;

const NON_DESTROYABLE_TECHS = new Set([TECH_TERRAFORMER, TECH_SHIPYARD, TECH_LUNAR_BASE]);

class BuildOp {
  constructor(techId, isBuild) {
    this.techId = Number(techId);
    this.isBuild = isBuild ? 1 : 0;
  }
  toArray() { return [this.techId, this.isBuild]; }
  static fromArray(arr) { return new BuildOp(arr[0], arr[1] === 1); }
}

class QueueCalculator {
  constructor(techCosts) {
    this.techCosts = techCosts;
  }

  /**
   * Cost & duration of a single-level step. Returns [metal, crystal, deut, seconds].
   * @param {number} techID
   * @param {number} resultLevel  Level produced by the step (next level for build,
   *                              level remaining after demolition for destroy).
   * @param {number} robotsLevel
   * @param {number} nanitesLevel
   * @param {number} uniSpeed
   * @param {boolean} deconstruction
   * @param {number} ionTechLevel
   */
  getStepCost(techID, resultLevel, robotsLevel, nanitesLevel, uniSpeed, deconstruction, ionTechLevel) {
    if (resultLevel < 0) return [0, 0, 0, 0];
    let cost;
    let timeSpan;
    if (!deconstruction) {
      cost = getBuildCost_C(techID, resultLevel - 1, resultLevel, this.techCosts, 0);
      timeSpan = getBuildTime_C({
        techID, techLevelFrom: resultLevel - 1, techLevelTo: resultLevel,
        techData: this.techCosts, robotsLevel, nanitesLevel,
        researchLabLevel: 0, technocratFactor: 1, shipyardLevel: 0, uniSpeed
      });
    } else {
      cost = getBuildCost_C(techID, resultLevel + 1, resultLevel, this.techCosts, ionTechLevel);
      timeSpan = getBuildTime_C({
        techID, techLevelFrom: resultLevel + 1, techLevelTo: resultLevel,
        techData: this.techCosts, robotsLevel, nanitesLevel,
        researchLabLevel: 0, technocratFactor: 1, shipyardLevel: 0, uniSpeed
      });
    }
    return [cost[0], cost[1], cost[2], timeSpan];
  }

  /**
   * Bonus to total fields produced after a Terraformer step.
   * Even result levels add 6, odd add 5 (matches OGame formula).
   */
  static terraformerFieldsBonus(resultLevel) {
    return (resultLevel % 2 === 0) ? 6 : 5;
  }

  /** Bonus to total fields produced after a Lunar Base step. */
  static lunarBaseFieldsBonus() {
    return 3;
  }

  /**
   * One queued step, as simulate() reports it.
   * @typedef {object} QueueStep
   * @property {number} index position of the entry in the queue
   * @property {number} techId
   * @property {boolean} isBuild false for a demolition
   * @property {number} resultLevel level the step leaves the building at
   * @property {number[]} cost [metal, crystal, deuterium, seconds]
   * @property {number} usedFields fields taken once the step is done
   * @property {number} maxFields fields available once the step is done
   * @property {boolean} overCapacity the step needs a field the planet does not have
   */

  /**
   * Plays a queue through from its starting levels: what every step costs,
   * how long it takes, and whether the planet (or moon) has a field for it.
   *
   * Every step is priced at the facility levels the steps before it left
   * behind - a Robotics Factory queued first speeds up everything after it, and
   * a Nanite Factory too, on a planet. The Terraformer and the Lunar Base add
   * fields as they are built; the Space Dock takes none. An entry for a
   * building that has no starting level is skipped, as the page has no row
   * for it.
   *
   * @param {object} p
   * @param {Record<number, number>} p.startLevels techId => level now
   * @param {number[][]} p.queue [techId, 1 build | 0 demolish] in queue order
   * @param {boolean} p.isMoon
   * @param {number} p.maxFields fields of the planet or moon before the queue
   * @param {number} p.universeSpeed
   * @param {number} p.ionTechLevel discounts demolitions
   * @returns {{steps: QueueStep[], totals: number[], maxFields: number,
   *   finalLevels: Record<number, number>, overCapacity: boolean}} totals is
   *   [used fields, metal, crystal, deuterium, seconds]
   */
  simulate(p) {
    /** @type {Record<number, number>} */
    const levels = {};
    let usedFields = 0;
    for (const [techId, lvl] of Object.entries(p.startLevels)) {
      levels[Number(techId)] = Number(lvl);
      usedFields += Number(lvl);
    }
    let robots = levels[TECH_ROBOT_FACTORY] || 0;
    let nanites = p.isMoon ? 0 : (levels[TECH_NANITE_FACTORY] || 0);
    let maxFields = p.maxFields;
    let overCapacity = false;
    const totals = [usedFields, 0, 0, 0, 0];
    /** @type {QueueStep[]} */
    const steps = [];

    p.queue.forEach(([techIdRaw, isBuildRaw], index) => {
      const techId = Number(techIdRaw);
      if (levels[techId] === undefined) return;
      const isBuild = Number(isBuildRaw) === 1;
      const inc = isBuild ? 1 : -1;
      const resultLevel = levels[techId] + inc;
      levels[techId] = resultLevel;

      const cost = this.getStepCost(techId, resultLevel, robots, nanites, p.universeSpeed, !isBuild, p.ionTechLevel);
      if (techId === TECH_ROBOT_FACTORY) robots += inc;
      if (techId === TECH_NANITE_FACTORY && !p.isMoon) nanites += inc;

      // The Space Dock does not occupy a field.
      if (techId !== TECH_SHIPYARD) totals[0] += inc;
      // Checked before this step's own field bonus: OGame needs a free field to
      // queue any building, the Terraformer and the Lunar Base included.
      overCapacity = totals[0] > maxFields;
      if (techId === TECH_TERRAFORMER && !p.isMoon) {
        maxFields += QueueCalculator.terraformerFieldsBonus(resultLevel);
      }
      if (techId === TECH_LUNAR_BASE && p.isMoon) {
        maxFields += QueueCalculator.lunarBaseFieldsBonus();
      }
      for (let i = 0; i < 4; i++) totals[i + 1] += cost[i];

      steps.push({ index, techId, isBuild, resultLevel, cost, usedFields: totals[0], maxFields, overCapacity });
    });

    return { steps, totals, maxFields, finalLevels: levels, overCapacity };
  }

  /**
   * Index of the first demolition step for techId that would push its level
   * below 0 when simulated from startLevel, or -1 if the queue is valid.
   */
  static _firstInvalidDemolitionIndex(queue, techId, startLevel) {
    let lvl = startLevel;
    for (let i = 0; i < queue.length; i++) {
      if (Number(queue[i][0]) !== Number(techId)) continue;
      if (queue[i][1] === 1) {
        lvl += 1;
        continue;
      }
      lvl -= 1;
      if (lvl < 0) return i;
    }
    return -1;
  }

  /**
   * Validate a queue against its starting levels: any demolition that would
   * push a building below level 0 is removed. Mutates the queue in place.
   */
  static purgeInvalidDemolitions(queue, startLevelsByTechId) {
    const techsWithDemolition = new Set();
    for (const op of queue) {
      if (op[1] === 0) techsWithDemolition.add(op[0]);
    }
    for (const techId of techsWithDemolition) {
      const startLevel = startLevelsByTechId[techId] || 0;
      let invalidIndex = QueueCalculator._firstInvalidDemolitionIndex(queue, techId, startLevel);
      while (invalidIndex !== -1) {
        queue.splice(invalidIndex, 1);
        invalidIndex = QueueCalculator._firstInvalidDemolitionIndex(queue, techId, startLevel);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    BuildOp,
    QueueCalculator,
    TECH_ROBOT_FACTORY,
    TECH_NANITE_FACTORY,
    TECH_TERRAFORMER,
    TECH_SHIPYARD,
    TECH_LUNAR_BASE,
    NON_DESTROYABLE_TECHS
  });
}
