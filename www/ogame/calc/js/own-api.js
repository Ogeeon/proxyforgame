// ============================================================================
// OGAME OWN-API IMPORT - payload normalizer
// ============================================================================
// The "API 2" field on the game's Fleet page exports the player's own planet as
// a single line of JSON. Two calculators read it: `flight` takes coordinates,
// classes, researches, ship counts and per-ship bonuses; `expeditions` takes the
// cargo bonuses alone. Both go through parseOwnApi(), so the shape of the export
// and the unit conversions are described in exactly one place.
//
// Fields the game sends but nobody consumes - `defenses`, `missiles`,
// `fleetspeed`, the rest of `bonuses` - are dropped on purpose: `fleetspeed` in
// particular is universe data the flight calculator deliberately ignores,
// because the export carries no fleet-speed variant to attach it to.
//
// No DOM access here: the caller writes the values into its own fields.

'use strict';

// Decimal digits kept on each per-ship bonus, counted on the percentage. The
// game sends fractions (0.003066 = 0.3066%); fuel keeps one digit more than
// speed and cargo, as it did while the flight importer owned this conversion.
const OWN_API_BONUS_DIGITS = { cargo: 4, speed: 4, fuel: 5 };

/**
 * @typedef {Object} OwnApiCoords
 * @property {number} galaxy
 * @property {number} system
 * @property {number} position
 */

/**
 * @typedef {Object} OwnApiShip
 * @property {number} amount Ships in the shipyard.
 * @property {number} cargo Cargo capacity bonus, in percent.
 * @property {number} speed Speed bonus, in percent.
 * @property {number} fuel Fuel consumption bonus, in percent.
 */

/**
 * @typedef {Object} OwnApiPayload
 * @property {?OwnApiCoords} coords Null when the export carries no coordinates.
 * @property {number} characterClassId 0 when the export carries no class.
 * @property {number} allianceClassId 0 when the export carries no class.
 * @property {Object<string, number>} researches Tech id to level.
 * @property {Object<string, OwnApiShip>} ships Tech id to counts and bonuses.
 * @property {Object<string, number>} classBoosters Booster index to percent.
 */

/**
 * Convert a bonus fraction from the export into a percentage. Shared with the
 * spy-report importer, which reads the same fractions out of a different
 * payload.
 *
 * @param {unknown} fraction Raw value, e.g. 0.003066.
 * @param {number} digits Decimal digits to keep on the percentage.
 * @returns {number} The percentage, e.g. 0.3066. Anything non-numeric gives 0.
 */
function bonusPercent(fraction, digits) {
  const value = Number(fraction);
  return Number.isFinite(value) ? frac(value * 100, digits) : 0;
}

/**
 * Parse and normalize the API 2 export.
 *
 * @param {string} text The pasted export.
 * @returns {?OwnApiPayload} Null when the text is not a JSON object - which
 *   covers both malformed JSON and a bare primitive like "111".
 */
function parseOwnApi(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isOwnApiObject(data)) return null;
  return {
    coords: parseOwnApiCoords(data.coords),
    characterClassId: Number(data.characterClassId) || 0,
    allianceClassId: Number(data.allianceClassId) || 0,
    researches: parseOwnApiLevels(data.researches),
    ships: parseOwnApiShips(data.ships),
    classBoosters: parseOwnApiBoosters(isOwnApiObject(data.bonuses) ? data.bonuses.characterClassBooster : null),
  };
}

/**
 * True for a plain object: the export never uses arrays where we read it.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>} Narrowed for the callers, which
 *   walk the block with Object.entries right after the check.
 */
function isOwnApiObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} raw The "galaxy:system:position" string.
 * @returns {?OwnApiCoords}
 */
function parseOwnApiCoords(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split(':');
  if (parts.length !== 3) return null;
  const [galaxy, system, position] = parts.map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(galaxy) || !Number.isFinite(system) || !Number.isFinite(position)) return null;
  return { galaxy, system, position };
}

/**
 * @param {unknown} raw Tech id to level, as exported.
 * @returns {Object<string, number>} Only the entries that carry a number.
 */
function parseOwnApiLevels(raw) {
  /** @type {Object<string, number>} */
  const levels = {};
  if (!isOwnApiObject(raw)) return levels;
  Object.entries(raw).forEach(([techId, value]) => {
    const level = Number(value);
    if (Number.isFinite(level)) levels[techId] = level;
  });
  return levels;
}

/**
 * @param {unknown} raw Tech id to ship record, as exported.
 * @returns {Object<string, OwnApiShip>}
 */
function parseOwnApiShips(raw) {
  /** @type {Object<string, OwnApiShip>} */
  const ships = {};
  if (!isOwnApiObject(raw)) return ships;
  Object.entries(raw).forEach(([techId, ship]) => {
    if (!isOwnApiObject(ship)) return;
    ships[techId] = {
      amount: Number(ship.amount) || 0,
      cargo: bonusPercent(ship.cargo, OWN_API_BONUS_DIGITS.cargo),
      speed: bonusPercent(ship.speed, OWN_API_BONUS_DIGITS.speed),
      fuel: bonusPercent(ship.fuel, OWN_API_BONUS_DIGITS.fuel),
    };
  });
  return ships;
}

/**
 * @param {unknown} raw The characterClassBooster block, as exported.
 * @returns {Object<string, number>} Booster index to percentage.
 */
function parseOwnApiBoosters(raw) {
  /** @type {Object<string, number>} */
  const boosters = {};
  if (!isOwnApiObject(raw)) return boosters;
  Object.entries(raw).forEach(([index, value]) => {
    boosters[index] = bonusPercent(value, OWN_API_BONUS_DIGITS.cargo);
  });
  return boosters;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { parseOwnApi, bonusPercent, OWN_API_BONUS_DIGITS });
}
