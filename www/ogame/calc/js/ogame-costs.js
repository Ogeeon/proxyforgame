// Classic (non-Life-Form) build math: resource and energy cost, demolition
// refunds, build/research/ship times, and the dark-matter price of halving a
// build. Read by the costs, production, queue and terraformer calculators;
// lfcosts loads it for getHalvingCost alone.

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

/**
 * What a build or research time depends on. Eleven positional parameters was
 * over the limit SonarQube allows (javascript:S107), and the four facility
 * levels in a row - three of which any given caller passes as zero - were the
 * kind of argument list where a value in the wrong slot still reads as
 * plausible. The terraformer calculator passes a technocratFactor of 0 where
 * the queue passes 1, and nothing but the position said which was which.
 *
 * @typedef {object} BuildTimeParams
 * @property {number} techID ID of the building, research, ship or defense item
 * @property {number} techLevelFrom level built up from
 * @property {number} techLevelTo level built up to, or the number of units for ships and defense
 * @property {any} techData technology data, keyed by tech id
 * @property {number} robotsLevel Robotics Factory level
 * @property {number} nanitesLevel Nanite Factory level
 * @property {number} researchLabLevel Research Lab level; only techs read it
 * @property {number} technocratFactor Technocrat speed-up; only techs read it
 * @property {number} shipyardLevel Shipyard level; only ships and defense read it
 * @property {number} uniSpeed universe speed multiplier
 * @property {any} [techReqs] technology requirements, to spot one that is not met
 */

/**
 * Calculates how long a build or a research takes.
 * @param {BuildTimeParams} params
 * @returns Seconds, or -1 when a requirement is not met
 */
function getBuildTime_C(params) {
	const {
		techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel,
		researchLabLevel, technocratFactor, shipyardLevel, uniSpeed, techReqs
	} = params;
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
