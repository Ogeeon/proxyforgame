// ============================================================================
// QUEUE CALCULATOR - CORE
// ============================================================================
// Pure data structures and cost/time computations for the build queue.
// Wraps getBuildCost_C / getBuildTime_C (common.js) so callers don't need to
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
      timeSpan = getBuildTime_C(techID, resultLevel - 1, resultLevel, this.techCosts, robotsLevel, nanitesLevel, 0, 1, 0, uniSpeed);
    } else {
      cost = getBuildCost_C(techID, resultLevel + 1, resultLevel, this.techCosts, ionTechLevel);
      timeSpan = getBuildTime_C(techID, resultLevel + 1, resultLevel, this.techCosts, robotsLevel, nanitesLevel, 0, 1, 0, uniSpeed);
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
   * Validate a queue against its starting levels: any demolition that would
   * push a building below level 0 is removed. Mutates the queue in place.
   */
  static purgeInvalidDemolitions(queue, startLevelsByTechId) {
    const techsWithDemolition = new Set();
    for (const op of queue) {
      if (op[1] === 0) techsWithDemolition.add(op[0]);
    }
    for (const techId of techsWithDemolition) {
      let changed = true;
      while (changed) {
        changed = false;
        let lvl = startLevelsByTechId[techId] || 0;
        for (let i = 0; i < queue.length; i++) {
          if (Number(queue[i][0]) !== Number(techId)) continue;
          if (queue[i][1] === 1) {
            lvl += 1;
          } else {
            lvl -= 1;
            if (lvl < 0) {
              queue.splice(i, 1);
              changed = true;
              break;
            }
          }
        }
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
