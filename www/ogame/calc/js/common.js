/**
 * Calculates the resource (units/hour) and energy production rate.
 * @param techID ID of the building - mine/synthesizer, power plant or solar satellite.
 * @param techLevel building level or number of satellites
 * @param energyTechLevel energy technology level
 * @param plasmaTechLevel plasma technology level
 * @param maxTemp max temperature on the planet
 * @param pos planet's position number
 * @param universeSpeedFactor universe speed multiplier
 * @param geologist flag - whether the Geologist is present
 * @param engineer flag - whether the Engineer is present
 * @param productionFactor production coefficient (0..1, less than 1 if there is not enough energy)
 * @param powerFactor power percentage (0..1, set by the user)
 * @param boosterType booster type: 0-none, 1-bronze (10%), 2-silver (20%), 3-gold (30%)
 * @param allOfficers flag - whether all 5 officers are present
 * @param playerClass player class: 0-Collector, 1-General, 2-Discoverer
 * @param [isTrader] whether the player belongs to an alliance with the "Traders" class.
 *        Optional: the costs calculator has no field for it, so it omits the argument
 *        and the 5% alliance bonus stays out of its single-building figures.
 * @returns Number of resource units or energy produced
 */
function getProductionRate(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader) {
	let prod;
	switch (techID*1) {
		case 1:
		case 2:
		case 3:
			prod = getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader);
			return(prod[0] + prod[1] + prod[2] + prod[3] + prod[4] + prod[5] + prod[6] + prod[7]);
		case 4:
		case 12:
		case 212:
			prod = getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader);
			return(prod[1]); // powerFactor is accounted for, while the engineer, officers and class bonuses need to be applied to the sum of remaining energy
		default: {
			return(0);
		}
	}
}

/**
 * Calculates the resource (units/hour) and energy production rate. When calculating metal and crystal mines, returns the natural production in row zero
 * @param techID ID of the building - mine/synthesizer, power plant or solar satellite.
 * @param techLevel building level or number of satellites
 * @param energyTechLevel energy technology level
 * @param plasmaTechLevel plasma technology level
 * @param maxTemp max temperature on the planet
 * @param pos planet's position in the solar system
 * @param universeSpeedFactor universe speed multiplier
 * @param geologist flag - whether the Geologist is present
 * @param engineer flag - whether the Engineer is present
 * @param productionFactor production coefficient (0..1, less than 1 if there is not enough energy)
 * @param powerFactor power percentage (0..1, set by the user)
 * @param boosterType booster type: 0-none, 1-bronze (10%), 2-silver (20%), 3-gold (30%)
 * @param allOfficers flag - whether all 5 officers are present
 * @param playerClass player class: 0-Collector, 1-General, 2-Discoverer
 * @param [isTrader] whether the player belongs to an alliance with the "Traders" class.
 *        Optional: the costs calculator has no field for it, so it omits the argument
 *        and the 5% alliance bonus stays out of its single-building figures.
 * @returns Number of resource units or energy produced
 */
function getProductionRateSplit(techID, techLevel, energyTechLevel, plasmaTechLevel, maxTemp, pos, universeSpeedFactor, geologist, engineer, productionFactor, powerFactor, boosterType, allOfficers, playerClass, isTrader) {
	// The Engineer and Geologist increase production by 10%. If all 5 officers are present, another 2% is added to resource and energy production.
	const geologistFactor = geologist === true ? 0.1 : 0;
	const allStaffFactor = allOfficers === true ? 0.02 : 0;
	const engineerFactor = (engineer === true) ? 0.1 : 0;
	const boostFactor = boosterType * 0.1;
	const classFactor = playerClass === 0 ? 0.25 : 0;
	let allianceClassFactor = isTrader ? 0.05 : 0;
	let positionFactor = 1;
	let basePR;
	const rows = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // natural, mine, geologist, all officers, plasma, booster, class, alliance class
	switch (techID*1) {
		case 1:
			switch (pos*1) {
				case 6: case 10: positionFactor = 1.17; break;
				case 7: case 9: positionFactor = 1.23; break;
				case 8: positionFactor = 1.35; break;
			}
			rows[0] = Math.floor(30 * universeSpeedFactor * positionFactor);
			basePR = 30.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.01 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; // this is the Engineer's slot in the table
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 2:
			switch (pos*1) {
				case 1: positionFactor = 1.4; break;
				case 2: positionFactor = 1.296; break;
				case 3: positionFactor = 1.2; break;
			}
			rows[0] = Math.floor(15 * universeSpeedFactor * positionFactor);
			basePR = 20.0 * techLevel * Math.pow(1.1, techLevel) * productionFactor * powerFactor * positionFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.0066 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; 
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 3:			
			rows[0] = 0;
			basePR = 10.0 * techLevel * Math.pow(1.1, techLevel) * (1.44 - 0.004 * maxTemp) * productionFactor * powerFactor;
			rows[1] = Math.floor(basePR * universeSpeedFactor);
			rows[2] = Math.round(basePR * 0.0033 * plasmaTechLevel * universeSpeedFactor);
			rows[3] = Math.round(basePR * boostFactor * universeSpeedFactor);
			rows[4] = Math.round(basePR * geologistFactor * universeSpeedFactor);
			rows[5] = 0; 
			rows[6] = Math.round(basePR * allStaffFactor * universeSpeedFactor);
			rows[7] = Math.round(basePR * classFactor * universeSpeedFactor);
			rows[8] = Math.round(basePR * allianceClassFactor * universeSpeedFactor);
			break;
		case 4:
			//productionRate = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(20.0 * techLevel * Math.pow(1.1, techLevel) * powerFactor);
			rows[1] = Math.floor(basePR);
			rows[5] = Math.round(basePR * engineerFactor);
			break;
		case 12:
			//productionRate = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * engineerFactor * powerFactor);
			basePR = Math.floor(30.0 * techLevel * Math.pow((1.05 + energyTechLevel * 0.01), techLevel) * powerFactor);
			rows[1] = Math.floor(basePR);
			rows[5] = Math.round(basePR * engineerFactor);
			break;
		case 212:
			//productionRate = techLevel * Math.floor((maxTemp + 140) / 6) * engineerFactor * powerFactor;
			basePR = techLevel * Math.floor((maxTemp + 140) / 6) * powerFactor;
			// If a planet temperature below -140 is entered in the calculator, it would show solar satellites producing a negative amount of energy. Not good.
			if (basePR < 0) {
				basePR = 0;
			}
			rows[1] = Math.floor(basePR);
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

/**
 * Calculates the amount of energy required to research/build
 * @param techID ID of the building or research
 * @param techLevel building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Required energy
 */
function getBuildEnergyCost_C(techID, techLevel, techData) {
	// The "Terraformer", "Space Dock" and "Gravitational Technology" technologies are special. They require energy to research/build.
	if (techLevel < 1)
		return 0;
	const data = techData[techID];
	if (data === undefined)
		// Energy is a scalar here; the [0, 0, 0] resource triple this used to
		// return came from getBuildCost_C and made every caller do arithmetic
		// on an array - terraformer-core got NaN out of it.
		return 0;
	let buildCost = 0;
	switch (techID*1) {
		case 33:
			buildCost = 1000 * Math.pow(data[3], techLevel - 1);
			break;
		case 36:
			// The Space Dock's metal and crystal price grows differently than its energy requirement
			buildCost = Math.floor(50 * Math.pow(data[3]/2, techLevel - 1)); 
			break;
		case 199:
			buildCost = 300000 * Math.pow(data[3], techLevel - 1);
			break;
	}
	return buildCost;
}

/**
 * Calculates the cost of demolishing a building
 * @param techID ID of the building
 * @param techLevel Resulting building level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Cost of demolishing the building
 */
function calcDeconstrCost(techID, techLevel, techData, ionTechLevel) {
	const cost = [0, 0, 0];
	if (techLevel < 0) {
		return cost;
	}
	// Only buildings can be demolished; the terraformer and lunar base cannot be demolished
	if (techID > 100 || techID == 33 || techID == 41) {
		return cost;
	}
	// https://github.com/jstar88/Ogame-algorithms/blob/master/Cost.php
	// http://calc.antigame.de/

	const data = techData[techID];
	for (let i = 0; i < 3; i++)
		cost[i] = Math.floor(Math.floor(data[i] * Math.pow(data[3], techLevel - 1)) * (1 - 0.04 * ionTechLevel));
	return cost;
}

/**
 * Calculates the cost of researching/building
 * @param techID ID of the building or research
 * @param techLevel building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @returns Cost of building/researching the given technology level
 */
function calcBuildCost_C(techID, techLevel, techData) {
	if (techLevel < 1)
		return [0, 0, 0];
	const data = techData[techID];
	if (data === undefined)
		return [0, 0, 0];
	const cost = [0, 0, 0];
	let price = 0;
	// In the redesign, astrophysics grows more expensive with a coefficient of 1.75, and the cost is rounded to hundreds
	if (techID == 124) {
		for (let i = 0; i < 3; i++) {
			price = data[i] * Math.pow(1.75, (techLevel - 1));
			cost[i] = 100 * Math.round(0.01 * price);
		}
	} else {
		for (let i = 0; i < 3; i++)
			cost[i] = Math.floor(data[i] * Math.pow(data[3], (techLevel - 1)));
	}
	return cost;
}

/**
 * Calculates the cost of researching/building several tech levels
 * @param techID ID of the building or research
 * @param techLevelFrom starting building/research level (not included in the calculation)
 * @param techLevelTo final building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @param [ionTechLevel] ion technology level; defaults to 0. Only the demolition
 *        branch reads it, so callers that can only build leave it out.
 * @returns Total cost of the building/research upgrade
 */
function getBuildCost_C(techID, techLevelFrom, techLevelTo, techData, ionTechLevel) {
	let cost;
	let i;
	if (ionTechLevel === undefined)
		ionTechLevel = 0;
	let totalCost = [0, 0, 0];
	// After techID==200 come ships and defense, they have no cost growth with count - we'll calculate them differently than buildings
	if (techID < 200) {
		// If the target level is less than the starting one, calculate the demolition cost. The function returns 0 where demolition is impossible (research, terraformer, lunar base).
		if (1*techLevelFrom > techLevelTo) {
			for (i = 1*techLevelFrom - 1; i >= techLevelTo; i--) {
				cost = calcDeconstrCost(techID, i, techData, ionTechLevel);
				totalCost[0] += cost[0];
				totalCost[1] += cost[1];
				totalCost[2] += cost[2];
			}
		} else {
			// Get the build cost of every tech level from the start to the end and simply sum up the results
			for (i = 1*techLevelFrom + 1; i <= techLevelTo; i++) {
				cost = calcBuildCost_C(techID, i, techData);
				totalCost[0] += cost[0];
				totalCost[1] += cost[1];
				totalCost[2] += cost[2];
			}
		}
	} else {
		// Get the cost of building a single unit and multiply by the count
		cost = calcBuildCost_C(techID, 1, techData);
		totalCost[0] = techLevelTo * cost[0];
		totalCost[1] = techLevelTo * cost[1];
		totalCost[2] = techLevelTo * cost[2];
	}
	return totalCost;
}

/**
 * Calculates the duration of researching/building several levels or several ships
 * @param techID ID of the Building or research
 * @param techLevelFrom Starting building/research level (not included in the calculation)
 * @param techLevelTo Final building/research level
 * @param techData Technology data array in the format {id:[cost_met, cost_crys, cost_deut, grow_koeff]}
 * @param robotsLevel Robot Factory level
 * @param nanitesLevel Nanite Factory level
 * @param researchLabLevel Research Lab level
 * @param technocratFactor Technocrat multiplier - 1 if absent
 * @param shipyardLevel Shipyard level
 * @param uniSpeed Universe speed
 * @param techReqs Research requirements in the format {id: req_level}
 * @returns Total duration of the building/research upgrade, ship construction
 */
/**
 * Time to build/demolish a building (techID <= 100) between two levels.
 * The caller has already filtered out the forbidden demolition of the Terraformer/Lunar Base.
 */
function getBuildingTime_C(techID, techLevelFrom, techLevelTo, robotsLevel, nanitesLevel, techData) {
	// The build time of all buildings except the Nanite Factory, Lunar Base, Sensor Phalanx and Jump Gate is reduced (up to level 8)
	const noReduction = techID == 15 || techID == 41 || techID == 42 || techID == 43;
	let timeSpan = 0;
	if (techLevelFrom < techLevelTo) {
		let curr = 1*techLevelFrom;
		for (let next = 1*techLevelFrom + 1; next <= techLevelTo; next++) {
			const cost = getBuildCost_C(techID, curr, next, techData);
			const reduction = noReduction ? 1 : Math.max(4 - next / 2.0, 1);
			// OGame's formula gives the time in hours - convert to seconds
			timeSpan += Math.floor(3600 * (cost[0] + cost[1]) / (2500.0 * reduction * (robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
			curr = next;
		}
		return timeSpan;
	}
	let curr = 1*techLevelFrom;
	for (let next = 1*techLevelFrom - 1; next >= techLevelTo; next--) {
		const cost = getBuildCost_C(techID, curr, next, techData);
		const reduction = noReduction ? 1 : Math.max(4 - next / 2.0, 1);
		// OGame's formula gives the time in hours - convert to seconds
		timeSpan += Math.ceil(3600 * (cost[0] + cost[1]) / (2500.0 * reduction * (robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
		curr = next;
	}
	return timeSpan;
}

/**
 * Research time (100 < techID <= 200); -1 if the Research Lab level is insufficient.
 */
function getResearchTime_C(techID, techLevelFrom, techLevelTo, researchLabLevel, technocratFactor, techReqs, techData) {
	if (researchLabLevel < techReqs[techID])
		return -1;
	const cost = getBuildCost_C(techID, techLevelFrom, techLevelTo, techData);
	// OGame's formula gives the time in hours - convert to seconds; the technocrat multiplies the result by its own correction factor
	return 3600 * (cost[0] + cost[1]) / (1000 * (1.0 + researchLabLevel)) * technocratFactor;
}

/**
 * Time to build a single ship/defense unit (techID > 200), not multiplied by count.
 */
function getShipBuildTime_C(techID, nanitesLevel, shipyardLevel, techData) {
	// For ships and defense the time cannot be calculated from the full resource count - it must be calculated per unit.
	const cost = calcBuildCost_C(techID, 1, techData);
	//((metal + crystal) / 5'000) * (2 / ((level shipyard) + 1)) * (0.5 ^ (level nanite factory))
	let timeSpan = 3600 * (cost[0] + cost[1]) / 5000.0 * 2.0 / (shipyardLevel + 1.0) * Math.pow(0.5, nanitesLevel);
	// At too high nanite levels the ship build speed can become 0 - this must be accounted for
	if (timeSpan == 0) {
		timeSpan = 1;
	}
	return timeSpan;
}

function getBuildTime_C(techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel, researchLabLevel, technocratFactor, shipyardLevel, uniSpeed, techReqs) {
	if (techLevelFrom < 0)
		return 0;
	const data = techData[techID];
	if (data === undefined)
		return 0;
	if (techLevelFrom >= techLevelTo && techID > 100)
		return 0;
	// The Terraformer and lunar base cannot be demolished
	if (techID <= 100 && techLevelFrom >= techLevelTo && (techID == 33 || techID == 41))
		return 0;

	let timeSpan;
	// Techs with ID up to 100 are buildings. Their build speed depends on the presence and level of the robot and nanite factories
	if (techID <= 100) {
		timeSpan = getBuildingTime_C(techID, techLevelFrom, techLevelTo, robotsLevel, nanitesLevel, techData);
	// Techs with ID from 100 to 200 are technologies. Their research speed depends on the Research Lab level and the presence of a technocrat
	} else if (techID <= 200) {
		timeSpan = getResearchTime_C(techID, techLevelFrom, techLevelTo, researchLabLevel, technocratFactor, techReqs, techData);
		if (timeSpan === -1)
			return -1;
	// Techs with ID above 200 are ships and defense. Their build speed depends on the presence and level of the shipyard and nanite factory
	} else {
		timeSpan = getShipBuildTime_C(techID, nanitesLevel, shipyardLevel, techData);
	}

	// If the calculation is requested for a sped-up universe, divide the computed time by the correction factor
	if (uniSpeed > 1) {
		timeSpan /= uniSpeed;
	}
	if (timeSpan < 1) {
		timeSpan = 1;
	}
	if (techID > 200) {
		timeSpan = techLevelTo*Math.floor(timeSpan);
	}

	return timeSpan;
}

/**
 * Calculates the cost of a single build/research speedup in Dark Matter
 * @param techID ID of the Building, ship or research
 * @param timeSpan Original time cost of the construction/research
 * @returns Amount of Dark Matter required
 */
function getHalvingCost(techID, timeSpan) {
	if (Number(timeSpan) === 0)
		return 0;
	let tmCost = 750;
	if (techID < 200 && timeSpan > 1800) {
		let halves = Math.ceil(Math.ceil(timeSpan/60)/30);
		tmCost = 750 * halves;
		if (techID < 100 && tmCost > 72000)
			tmCost = 72000;
		if (techID > 100 && techID < 200 && tmCost > 108000)
			tmCost = 108000;
		return tmCost;
	}
	if (techID > 200 && timeSpan > 1800) {
		let halves = 0.1 * Math.ceil(Math.floor(timeSpan/60)/3);
		tmCost = Math.floor(750 * halves);
		if (tmCost > 72000)
			tmCost = 72000;
		return tmCost;
	}
	return tmCost;
}

/**
 * Calculates the cost of demolishing a Life Form building
 * @param techID ID of the building
 * @param techLevel Resulting building level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @returns Cost of demolishing the building
 */
function calcDeconstrCostLF(techID, techLevel, techData, ionTechLevel) {
	const cost = [0, 0, 0];
	if (techLevel < 0) {
		return cost;
	}
	// Only buildings can be demolished
	if (Number(techID) % 1000 > 100) {
		return cost;
	}
	const data = techData[techID];
	for (let i = 0; i < 3; i++)
		cost[i] = Math.floor(Math.floor(data[i] * techLevel * Math.pow(data[5 + i], techLevel - 1)) * (1 - 0.04 * ionTechLevel));
	return cost;
}

/**
 * Calculates the cost of researching/building for Life Forms
 * @param techID ID of the building or research
 * @param techLevel building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param costRdc bonus reducing the cost (in %)
 * @returns Cost of building/researching the given technology level
 */
function calcBuildCostLF(techID, techLevel, techData, costRdc) {
	if (techLevel < 1)
		return [0, 0, 0];
	const data = techData[techID];
	if (data === undefined)
		return [0, 0, 0];
	const cost = [0, 0, 0];
	costRdc = Math.min(0.99, costRdc);
	for (let i = 0; i < 3; i++)
		cost[i] = Math.floor((1 - costRdc) * Math.floor(data[i] * techLevel * Math.pow(data[5 + i], (techLevel - 1))));
	return cost;
}

/**
 * Calculates the cost of researching/building several tech levels for Life Forms
 * @param techID ID of the building or research
 * @param techLevelFrom starting building/research level (not included in the calculation)
 * @param techLevelTo final building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param ionTechLevel ion technology level
 * @param rsrCostRdc bonus reducing research cost (in %)
 * @param bldCostRdc bonus from buildings
 * @returns Total cost of the building/research upgrade
 */
function getBuildCostLF(techID, techLevelFrom, techLevelTo, techData, ionTechLevel, rsrCostRdc, bldCostRdc=0) {
	let cost;
	let i;
	if (ionTechLevel === undefined)
		ionTechLevel = 0;
	let totalCost = [0, 0, 0];
	// The Megalith only reduces the cost of buildings
	const costReduction = Number(techID) % 1000 < 100 ? bldCostRdc : 0.01 * rsrCostRdc;
	// If the target level is less than the starting one, calculate the demolition cost. The function returns 0 where demolition is impossible (research, terraformer, lunar base).
	if (Number(techLevelFrom) > Number(techLevelTo)) {
		for (i = Number(techLevelFrom) - 1; i >= Math.max(Number(techLevelTo), 0); i--) {
			if (i == 0) {
				cost = calcDeconstrCostLF(techID, 1, techData, ionTechLevel);
			} else {
				cost = calcDeconstrCostLF(techID, i, techData, ionTechLevel);
			}
			totalCost[0] += cost[0];
			totalCost[1] += cost[1];
			totalCost[2] += cost[2];
		}
	} else {
		// Get the build cost of every tech level from the start to the end and simply sum up the results
		for (i = Number(techLevelFrom) + 1; i <= Number(techLevelTo); i++) {
			cost = calcBuildCostLF(techID, i, techData, costReduction);
			totalCost[0] += cost[0];
			totalCost[1] += cost[1];
			totalCost[2] += cost[2];
		}
	}
	return totalCost;
}

/**
 * Calculates the duration of researching/building several levels for Life Forms
 * @param techID ID of the Building or research
 * @param techLevelFrom Starting building/research level (not included in the calculation)
 * @param techLevelTo Final building/research level
 * @param techData Technology data array in the format {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param robotsLevel Robot Factory level
 * @param nanitesLevel Nanite Factory level
 * @param uniSpeed Universe speed
 * @param rsrTimeRdc Research time reduction (in %)
 * @param megalithRdc bonus from the Megalith
 * @returns Total duration of the building/research upgrade, ship construction
 */
/**
 * Contribution of a single level to the build/demolish time of an LF building.
 * Level 0 has no cost of its own - when demolishing down to it, level 1's values are used.
 */
function getBuildingTimeStepLF(next, data, robotsLevel, nanitesLevel) {
	const n = next == 0 ? 1 : next;
	return Math.floor((n * data[4] * Math.pow(data[9], n)) / ((robotsLevel + 1.0) * Math.pow(2.0, nanitesLevel)));
}

/** Time to build/demolish an LF building (techID % 1000 <= 100) between two levels. */
function getBuildingTimeLF(techLevelFrom, techLevelTo, data, robotsLevel, nanitesLevel, uniSpeed, megalithRdc) {
	let timeSpan = 0;
	if (techLevelFrom < techLevelTo) {
		for (let next = Number(techLevelFrom) + 1; next <= Number(techLevelTo); next++) {
			timeSpan += getBuildingTimeStepLF(next, data, robotsLevel, nanitesLevel);
		}
	} else {
		for (let next = Number(techLevelFrom) - 1; next >= Math.max(Number(techLevelTo), 0); next--) {
			timeSpan += getBuildingTimeStepLF(next, data, robotsLevel, nanitesLevel);
		}
	}
	timeSpan = Math.floor(timeSpan * (1 - megalithRdc));
	return Math.floor(timeSpan / uniSpeed);
}

/** Time to research an LF technology (techID % 1000 > 100); LF research cannot be "unlearned", so demolition is not applicable. */
function getResearchTimeLF(techLevelFrom, techLevelTo, data, uniSpeed, rsrTimeRdc) {
	let timeSpan = 0;
	if (techLevelFrom >= techLevelTo)
		return timeSpan;
	for (let next = Number(techLevelFrom) + 1; next <= Number(techLevelTo); next++) {
		let duration = Math.floor(next * data[4] * Math.pow(data[9], next));
		duration = Math.floor(duration * (1 - 0.01 * rsrTimeRdc));
		timeSpan += Math.floor(duration / uniSpeed);
	}
	return timeSpan;
}

function getBuildTimeLF(techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel, uniSpeed, rsrTimeRdc, megalithRdc=0) {
	if (techLevelFrom < 0)
		return 0;
	const data = techData[techID];
	if (data === undefined)
		return 0;
	if (techLevelFrom >= techLevelTo && Number(techID) % 1000 > 100)
		return 0;

	let timeSpan;
	// Techs with ID up to 100 are buildings. Their build speed depends on the presence and level of the robot and nanite factories
	if (Number(techID) % 1000 <= 100) {
		timeSpan = getBuildingTimeLF(techLevelFrom, techLevelTo, data, robotsLevel, nanitesLevel, uniSpeed, megalithRdc);
	} else {
		// Techs with ID above 100 are technologies. Their research speed depends on the Research Lab level and the presence of a technocrat
		timeSpan = getResearchTimeLF(techLevelFrom, techLevelTo, data, uniSpeed, rsrTimeRdc);
	}

	if (timeSpan < 1) {
		timeSpan = 1;
	}

	return timeSpan;
}

/**
 * Calculates the amount of energy required to research/build for Life Forms
 * @param techID ID of the building or research
 * @param techLevel building/research level
 * @param techData technology data array in the format {id:[cost_met, cost_crys, cost_deut, cost_energy, grow_koeff]}
 * @param ionTechLevel ion technology level
 * @param bldCostRdc cost-reducing bonus from buildings
 * @returns Required energy
 */
function getBuildEnergyCostLF(techID, techLevel, techData, ionTechLevel, bldCostRdc=0) {
	if (techLevel < 1)
		return 0;
	const data = techData[techID];
	if (data === undefined)
		return 0;
	let buildCost = Math.floor(Math.floor(data[3] * techLevel * Math.pow(data[8], techLevel)) * (1 - 0.04 * ionTechLevel));
	if (bldCostRdc > 0)
		buildCost = Math.floor(buildCost * (1 - bldCostRdc));
	return buildCost;
}

/**
 * Format a numeric value either as a full OGame-style number or as a shortened string.
 *
 * The returned format depends on the global flag `options.prm.fullNumbers`:
 * - If truthy, the value is formatted using `numToOGame(num)` (full formatting).
 * - Otherwise, the value is converted using `numberToShortenedString(num, suffix)` (shortened form).
 *
 * @param {number} num - The numeric value to format.
 * @param {string} [suffix] - Optional suffix passed to the shortening helper (e.g. "K", "M").
 *                            Ignored when `options.prm.fullNumbers` is truthy.
 * @returns {string} A formatted string representing the number, either full or shortened.
 * @see options.prm.fullNumbers
 * @see numToOGame
 * @see numberToShortenedString
 * @example
 * // When fullNumbers is true:
 * // shorten(1234567) -> "1.234.567" (format depends on numToOGame implementation)
 *
 * // When fullNumbers is false:
 * // shorten(1500000, "M") -> "1.5M" (format depends on numberToShortenedString implementation)
 */
function ogamizeNum(num, suffix) {
	if (options.prm.fullNumbers)
		return numToOGame(num);
	else
		return numberToShortenedString(num, suffix);
}