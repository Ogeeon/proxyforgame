// Resource and energy production: mine and plant output, hourly deuterium
// consumption, storage capacity. Read by the costs and production calculators.

/**
 * Everything the production formula reads, in one object. It used to be sixteen
 * positional parameters, which is over the limit SonarQube allows
 * (javascript:S107) and, worse, put four booleans and nine numbers in a row
 * where transposing two of them produced wrong figures rather than an error.
 * Named properties are checked by name at every call site.
 *
 * @typedef {object} ProductionParams
 * @property {number} techID ID of the building - mine/synthesizer, power plant or solar satellite.
 * @property {number} techLevel building level or number of satellites
 * @property {number} energyTechLevel energy technology level
 * @property {number} plasmaTechLevel plasma technology level
 * @property {number} maxTemp max temperature on the planet
 * @property {number} pos planet's position in the solar system
 * @property {number} universeSpeedFactor universe speed multiplier
 * @property {boolean} geologist whether the Geologist is present
 * @property {boolean} engineer whether the Engineer is present
 * @property {number} productionFactor production coefficient (0..1, less than 1 if there is not enough energy)
 * @property {number} powerFactor power percentage (0..1, set by the user)
 * @property {number} boosterType booster type: 0-none, 1-bronze (10%), 2-silver (20%), 3-gold (30%)
 * @property {boolean} allOfficers whether all 5 officers are present
 * @property {number} playerClass player class: 0-Collector, 1-General, 2-Discoverer
 * @property {boolean} [isTrader] whether the player belongs to an alliance with the "Traders" class.
 * @property {number} [collectorClassBonusPct] percentage by which the Collector class bonus is
 *           amplified (Rock'tal Collector Enhancement, +0.2 per research level).
 *           Optional: left out, the class bonus stays at its base 25%.
 */

/**
 * Row indices of the array getProductionRateSplit returns. The production
 * calculator's table shows PLASMA..ALLIANCE_CLASS as consecutive bonus rows, so
 * a new row goes at the end, not in the middle.
 */
const PRODUCTION_ROW = Object.freeze({
	NATURAL: 0, // natural production of metal and crystal, independent of the mine
	BUILDING: 1, // the building's own output: mine, power plant or satellites
	PLASMA: 2,
	BOOSTER: 3,
	GEOLOGIST: 4,
	ENGINEER: 5,
	ALL_OFFICERS: 6,
	CLASS: 7,
	ALLIANCE_CLASS: 8,
});

/**
 * Calculates the resource (units/hour) and energy production rate.
 * @param {ProductionParams} params
 * @returns {number} Number of resource units or energy produced
 */
function getProductionRate(params) {
	let prod;
	switch (params.techID*1) {
		case 1:
		case 2:
		case 3:
			prod = getProductionRateSplit(params);
			return prod.reduce((sum, row) => sum + row, 0);
		case 4:
		case 12:
		case 212:
			prod = getProductionRateSplit(params);
			return(prod[PRODUCTION_ROW.BUILDING]); // powerFactor is accounted for, while the engineer, officers and class bonuses need to be applied to the sum of remaining energy
		default: {
			return(0);
		}
	}
}

/**
 * Calculates the resource (units/hour) and energy production rate. When calculating metal and crystal mines, returns the natural production in row zero
 * @param {ProductionParams} params
 * @returns {number[]} Production broken down by source, indexed by PRODUCTION_ROW
 */
function getProductionRateSplit(params) {
	const {
		techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos,
		universeSpeedFactor, geologist, engineer, productionFactor, powerFactor,
		boosterType, allOfficers, playerClass, isTrader, collectorClassBonusPct
	} = params;
	// The Engineer and Geologist increase production by 10%. If all 5 officers are present, another 2% is added to resource and energy production.
	const geologistFactor = geologist === true ? 0.1 : 0;
	const allStaffFactor = allOfficers === true ? 0.02 : 0;
	const engineerFactor = (engineer === true) ? 0.1 : 0;
	const boostFactor = boosterType * 0.1;
	const classFactor = playerClass === 0 ? 0.25 * (1 + 0.01 * (collectorClassBonusPct || 0)) : 0;
	let allianceClassFactor = isTrader ? 0.05 : 0;
	let positionFactor = 1;
	let basePR;
	const rows = Object.values(PRODUCTION_ROW).map(() => 0);
	switch (techID*1) {
		case 1:
			switch (pos*1) {
				case 6: case 10: positionFactor = 1.17; break;
				case 7: case 9: positionFactor = 1.23; break;
				case 8: positionFactor = 1.35; break;
			}
			rows[PRODUCTION_ROW.NATURAL] = Math.floor(30 * universeSpeedFactor * positionFactor);
			basePR = 30.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR * universeSpeedFactor);
			rows[PRODUCTION_ROW.PLASMA] = Math.round(basePR * 0.01 * plasmaTechLevel * universeSpeedFactor);
			rows[PRODUCTION_ROW.BOOSTER] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.GEOLOGIST] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ENGINEER] = 0; // the Engineer only boosts energy
			rows[PRODUCTION_ROW.ALL_OFFICERS] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.CLASS] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ALLIANCE_CLASS] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 2:
			switch (pos*1) {
				case 1: positionFactor = 1.4; break;
				case 2: positionFactor = 1.296; break;
				case 3: positionFactor = 1.2; break;
			}
			rows[PRODUCTION_ROW.NATURAL] = Math.floor(15 * universeSpeedFactor * positionFactor);
			basePR = 20.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR * universeSpeedFactor);
			rows[PRODUCTION_ROW.PLASMA] = Math.round(basePR * 0.0066 * plasmaTechLevel * universeSpeedFactor);
			rows[PRODUCTION_ROW.BOOSTER] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.GEOLOGIST] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ENGINEER] = 0;
			rows[PRODUCTION_ROW.ALL_OFFICERS] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.CLASS] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ALLIANCE_CLASS] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 3:			
			rows[PRODUCTION_ROW.NATURAL] = 0;
			basePR = 10.0 * techLevel * Math.pow(1.1, techLevel) * (1.44 - 0.004 * maxTemp) * productionFactor * powerFactor;
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR * universeSpeedFactor);
			rows[PRODUCTION_ROW.PLASMA] = Math.round(basePR * 0.0033 * plasmaTechLevel * universeSpeedFactor);
			rows[PRODUCTION_ROW.BOOSTER] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.GEOLOGIST] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ENGINEER] = 0;
			rows[PRODUCTION_ROW.ALL_OFFICERS] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.CLASS] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[PRODUCTION_ROW.ALLIANCE_CLASS] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 4:
			//productionRate = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR);
			rows[PRODUCTION_ROW.ENGINEER] = Math.round(basePR * engineerFactor);
			break;
		case 12:
			//productionRate = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * powerFactor);
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR);
			rows[PRODUCTION_ROW.ENGINEER] = Math.round(basePR * engineerFactor);
			break;
		case 212:
			//productionRate = techLevel * Math.floor((maxTemp + 140) / 6) * engineerFactor * powerFactor;
			basePR = techLevel * Math.floor((maxTemp + 140) / 6) * powerFactor;
			// If a planet temperature below -140 is entered in the calculator, it would show solar satellites producing a negative amount of energy. Not good.
			if (basePR < 0) {
				basePR = 0;
			}
			rows[PRODUCTION_ROW.BUILDING] = Math.floor(basePR);
	}
	return rows;
}

/**
 * Calculates energy consumption by mines and deuterium consumption by the fusion reactor
 * @param techID ID of the mine or power plant
 * @param techLevel building level
 * @param universeSpeedFactor universe speed multiplier
 * @param powerFactor power percentage (0..1, set by the user)
 * @returns Number of energy/deuterium units consumed by the building
 */
function getHourlyConsumption(techID, techLevel, universeSpeedFactor, powerFactor) {
	if (techLevel < 1)
		return 0;
	let consump;
	switch (techID*1) {
		case 1: // metal mine. consumes energy
		case 2: // crystal mine. consumes energy
			consump = Math.floor(10.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			break;
		case 12: // fusion reactor. consumes deuterium
			consump = Math.floor(Math.floor(10.0 * techLevel * Math.pow(1.1, techLevel) * universeSpeedFactor) * powerFactor);
			break;
		case 3: // deuterium synthesizer. consumes energy
			consump = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			break;
		default:
			return 0;
	}
	return consump;
}

/**
 * Calculates the resource storage capacity
 * @param techLevel building level
 * @returns Amount of resources the building can store
 */
function getStorageCapacity(level) {
	if (level < 0)
		return 0;
	if (level == 0)
		return 10000;
	return 5000 * Math.floor(2.5 * Math.exp(20.0 * level/33.0));
}
