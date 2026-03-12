// ============================================================================
// CONSTANTS
// ============================================================================

const ENERGY_TECH_IDS = new Set([1002, 2002, 3002, 4002]);
const REDUCTABLES = new Set([1, 2, 3, 4, 12, 2001, 2002]);
const FOOTER_ROWS = 6;

// ============================================================================
// CALCULATION ENGINE
// ============================================================================

class LfCalculator {
    constructor(techCosts) {
        this.techCosts = techCosts;
    }

    /**
     * Calculate full cost for a single tech upgrade/demolition.
     * params must contain: race, megalithLvl, robotFactoryLevel, naniteFactoryLevel,
     *                      universeSpeed, researchTimeReduction
     */
    calculate(techID, levelFrom, levelTo, ionTechLevel, rsrCostRdc, bldCostRdc, params) {
        const resCost = getBuildCostLF(techID, levelFrom, levelTo, this.techCosts, ionTechLevel, rsrCostRdc, bldCostRdc);
        const energyCost = getBuildEnergyCostLF(techID, levelTo, this.techCosts, ionTechLevel, bldCostRdc);
        const timeSpan = this._getAdjustedTime(techID, levelFrom, levelTo, params);
        let points;
        if (levelTo > levelFrom) {
            points = Math.floor((resCost[0] + resCost[1] + resCost[2]) / 1000);
        } else {
            const buildResCost = getBuildCostLF(techID, levelTo, levelFrom, this.techCosts, 0);
            points = -1 * Math.floor((buildResCost[0] + buildResCost[1] + buildResCost[2]) / 1000);
        }
        return { metal: resCost[0], crystal: resCost[1], deut: resCost[2], energy: energyCost, time: timeSpan, points };
    }

    /**
     * Calculate number of transport ships needed.
     * params must contain: hyperTechLevel, playerClass, capIncrSC, capIncrLC
     */
    calculateShipCount(totalRes, params) {
        let capSC = 5000 * (1 + 0.05 * params.hyperTechLevel);
        if (params.playerClass === 0) capSC += 5000 * 0.25;
        capSC += Math.floor(5000 * 0.01 * params.capIncrSC);
        let capLC = 25000 * (1 + 0.05 * params.hyperTechLevel);
        if (params.playerClass === 0) capLC += 25000 * 0.25;
        capLC += Math.floor(25000 * 0.01 * params.capIncrLC);
        return { needSC: Math.ceil(totalRes / capSC), needLC: Math.ceil(totalRes / capLC) };
    }

    /**
     * Compute the building cost reduction for a given techID.
     * Encapsulates the megalith + MRC reduction logic duplicated in the original.
     */
    computeBldCostRdc(techID, race, megalithLvl, mrcLvl) {
        let bldCostRdc = race === 2 ? 0.01 * megalithLvl : 0;
        const mrcRdc = race === 2 ? 0.005 * mrcLvl : 0;
        if (REDUCTABLES.has(techID)) bldCostRdc += mrcRdc;
        return bldCostRdc;
    }

    _getAdjustedTime(techID, levelFrom, levelTo, params) {
        if (levelFrom == 0 && levelTo == 0) return 0;
        const megalithRdc = Math.min(0.99, params.race === 2 ? 0.01 * params.megalithLvl : 0);
        return getBuildTimeLF(techID, levelFrom, levelTo, this.techCosts,
            params.robotFactoryLevel, params.naniteFactoryLevel, params.universeSpeed,
            params.researchTimeReduction, megalithRdc);
    }
}
