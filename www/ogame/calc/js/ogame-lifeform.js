// Life Form build math: cost, demolition refund, energy requirement and build
// or research time for LF buildings and technologies. Read by lfcosts alone.

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

/**
 * The life-form counterpart of BuildTimeParams. Nine positional parameters was
 * over the limit as well (javascript:S107).
 *
 * @typedef {object} BuildTimeLFParams
 * @property {number} techID ID of the life-form building or research
 * @property {number} techLevelFrom level built up from
 * @property {number} techLevelTo level built up to
 * @property {any} techData technology data, keyed by tech id
 * @property {number} robotsLevel Robotics Factory level
 * @property {number} nanitesLevel Nanite Factory level
 * @property {number} uniSpeed universe speed multiplier
 * @property {number} rsrTimeRdc research time reduction, per cent
 * @property {number} [megalithRdc] Megalith build time reduction, 0..0.99
 */

/**
 * Calculates how long a life-form build or research takes.
 * @param {BuildTimeLFParams} params
 * @returns Seconds
 */
function getBuildTimeLF(params) {
	const {
		techID, techLevelFrom, techLevelTo, techData, robotsLevel, nanitesLevel,
		uniSpeed, rsrTimeRdc, megalithRdc = 0
	} = params;
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
