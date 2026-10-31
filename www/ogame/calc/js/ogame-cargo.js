// Ship holds: how much one ship carries once hyperspace technology, the player
// class and the life form bonuses are in. Read by every calculator that counts
// transports or recyclers - costs, expeditions, flight, graviton, moon, queue,
// terraformer and trade - and by the MCP tools through their cores.
//
// The rule is the one the flight calculator measured against the game: every
// bonus is a share of the ship's base hold, the shares add up rather than
// compound, and the fraction is dropped once per ship - so a fleet of a million
// ships loses a million fractions, not one.

// Hyperspace technology adds 5% of the base hold per level.
const HOLD_HYPERSPACE_PER_LEVEL = 0.05;

// The class bonuses to the hold, as shares of the base hold, before the class'
// own life form enhancement raises them: the Collector's small and large
// cargos, the General's recyclers and pathfinders.
const HOLD_CLASS_BONUS = Object.freeze({ COLLECTOR: 0.25, GENERAL: 0.2 });

// How far below a whole unit a ship's hold may land before it is read as that unit.
// Cargo runs to eight digits at most, so this is far below anything meaningful.
const HOLD_ROUNDING_TOLERANCE = 1e-6;

/**
 * @typedef {object} HoldParams
 * @property {number} hyperTechLevel hyperspace technology level
 * @property {number} [classBonus] the share HOLD_CLASS_BONUS gives this ship for
 *           the player's class, 0 (the default) when the class gives it nothing
 * @property {number} [classEnhancement] percent by which the class' life form
 *           enhancement raises that bonus (Rock'tal Collector Enhancement, Mechan
 *           General Enhancement)
 * @property {number} [lfBonus] the ship's own life form cargo bonus, percent
 */

/**
 * The hold of one ship, in whole units.
 * @param {number} baseHold the ship's hold with no technology or bonus
 * @param {HoldParams} p
 * @returns {number}
 */
function shipHold(baseHold, p) {
	let hold = baseHold * (1 + HOLD_HYPERSPACE_PER_LEVEL * p.hyperTechLevel);
	hold += baseHold * (p.classBonus || 0) * (1 + 0.01 * (p.classEnhancement || 0));
	hold += baseHold * (p.lfBonus || 0) * 0.01;
	// The tolerance keeps a hold that is a whole number on paper, but lands a
	// hair under it once the bonuses have been summed in binary, from losing a
	// unit on every ship in the fleet
	return Math.floor(hold + HOLD_ROUNDING_TOLERANCE);
}
