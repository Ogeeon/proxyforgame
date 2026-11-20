// ============================================================================
// SCRAP MERCHANT CALCULATOR - FLEET SAVE FUEL
// ============================================================================
// The deuterium a fleet burns being kept safe until the merchant's event, per
// ship type: the glue between the scrap calculator's tech ids and the flight
// calculator's own formulas (flight-core.js). One fleet save is a peaceful
// flight of the whole fleet along a route the player names - within a system,
// between systems or between galaxies, so many steps apart - at one speed; the
// game charges both legs of a round trip at departure, and that one figure is
// what a save costs. scrapSellTiming() (scrap-core.js) takes the result as
// deuterium a day. No DOM access: the page and the MCP tool (mcp/tools/scrap.js)
// both compute here.

'use strict';

/** Flight's ship table order (SHIPS_BASE in flight-core.js), by tech id. */
const SCRAP_FLIGHT_SHIP_IDS = Object.freeze([202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 213, 214, 215, 218, 219]);

/**
 * The route kinds: the coordinate a save moves along (galaxy, system,
 * position) and how many steps it can go. A planet's neighbours sit at
 * positions 1-15, so a save within the system goes 14 steps at most; the
 * others stop one short of the widest universe the game runs.
 */
const SCRAP_ROUTES = Object.freeze({
  system: Object.freeze({ axis: 2, max: 14 }),
  systems: Object.freeze({ axis: 1, max: UNIVERSE_MAX_SYSTEMS - 1 }),
  galaxies: Object.freeze({ axis: 0, max: UNIVERSE_MAX_GALAXIES - 1 }),
});

/** The fleet save the advice starts with: the next galaxy, at 10%, once a day. */
const SCRAP_FLEETSAVE_DEFAULTS = Object.freeze({ routeKind: 'galaxies', routeDelta: 1, speedPercent: 10, times: 1, days: 1 });

/**
 * The universe the save is flown in. Left out, a setting is the 1x universe's.
 *
 * @typedef {object} ScrapUniverse
 * @property {number} [fleetSpeedPeaceful] The peaceful fleet speed factor.
 * @property {number} [deutFactor] Deuterium consumption in tenths: 10 is 100%, 5 is 50%.
 * @property {number} [deutConsReduction] The General's fuel discount in this universe, %.
 * @property {boolean} [circularGalaxies]
 * @property {boolean} [circularSystems]
 * @property {number} [numberOfGalaxies]
 * @property {number} [numberOfSystems]
 */

/** @type {Required<ScrapUniverse>} */
const SCRAP_DEFAULT_UNIVERSE = Object.freeze({
  fleetSpeedPeaceful: 1, deutFactor: 10, deutConsReduction: 25,
  circularGalaxies: false, circularSystems: false,
  numberOfGalaxies: UNIVERSE_MAX_GALAXIES, numberOfSystems: UNIVERSE_MAX_SYSTEMS,
});

/**
 * One fleet save and the player behind it.
 *
 * @typedef {object} ScrapFleetsaveSettings
 * @property {{kind: unknown, delta: unknown}} route kind: a SCRAP_ROUTES key; delta: steps apart.
 * @property {unknown} speedPercent One of the class's speed steps.
 * @property {unknown[]} [driveLevels] Combustion, impulse and hyperspace drive levels.
 * @property {number} [playerClass] flight-core.js PLAYER_CLASS; none flies like the Discoverer.
 * @property {unknown} [lfMechanGE] The Mechan General Enhancement total, %.
 * @property {unknown} [lfRocktalCE] The Rock'tal Collector Enhancement total, %.
 * @property {Object<string, {speed?: unknown, fuel?: unknown}>} [shipBonuses] Life form bonuses by tech id, %.
 * @property {unknown} [fuelDiscount] One fuel discount, %, added to every ship's own -
 *   the class and life forms folded into one figure when they are not known apart.
 * @property {ScrapUniverse} [universe]
 */

/**
 * @param {unknown} v
 * @returns {number} At least 0, 0 for anything that is not a number.
 */
function scrapNonNegative(v) {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The universe with every setting filled in.
 *
 * @param {ScrapUniverse} [universe]
 * @returns {Required<ScrapUniverse>}
 */
function scrapUniverse(universe = {}) {
  /** @type {Record<string, any>} */
  const out = { ...SCRAP_DEFAULT_UNIVERSE };
  // A setting the caller does not know comes as undefined or null (a profile
  // whose universe was never fetched), which ScrapUniverse's own types hide.
  /** @type {Record<string, unknown>} */
  const given = universe;
  Object.entries(given).forEach(([key, value]) => {
    if (value !== undefined && value !== null) out[key] = value;
  });
  return /** @type {Required<ScrapUniverse>} */ (out);
}

/**
 * The route, held to its kind's range: an unknown kind is the default one, a
 * delta at least 1 and at most one short of the universe's size.
 *
 * @param {{kind: unknown, delta: unknown}} route
 * @param {Required<ScrapUniverse>} universe
 * @returns {{kind: keyof typeof SCRAP_ROUTES, delta: number}}
 */
function scrapRoute(route, universe) {
  const kind = /** @type {keyof typeof SCRAP_ROUTES} */ (
    Object.hasOwn(SCRAP_ROUTES, String(route?.kind)) ? String(route.kind) : SCRAP_FLEETSAVE_DEFAULTS.routeKind);
  let max = SCRAP_ROUTES[kind].max;
  if (kind === 'galaxies') max = Math.min(max, universe.numberOfGalaxies - 1);
  if (kind === 'systems') max = Math.min(max, universe.numberOfSystems - 1);
  const delta = Math.floor(Number(route?.delta));
  return { kind, delta: Math.max(1, Math.min(max, Number.isFinite(delta) ? delta : 1)) };
}

/**
 * The distance of a fleet save, as flight measures it between two points
 * `delta` steps apart along the route's axis. No system is skipped on the way.
 *
 * @param {{kind: unknown, delta: unknown}} route
 * @param {ScrapUniverse} [universe]
 * @returns {number}
 */
function scrapRouteDistance(route, universe) {
  const uni = scrapUniverse(universe);
  const { kind, delta } = scrapRoute(route, uni);
  const departure = [1, 1, 1];
  const destination = [...departure];
  destination[SCRAP_ROUTES[kind].axis] += delta;
  return new FlightCalculator().getDistance(departure, destination, {
    ...uni, fleetIgnoreEmptySystems: false, fleetIgnoreInactiveSystems: false,
  }).distance;
}

/**
 * Flight's params for the save: a peaceful mission, the player's drives, class
 * and bonuses, the universe's speed and consumption.
 *
 * @param {ScrapFleetsaveSettings} s
 * @param {Required<ScrapUniverse>} uni
 */
function scrapFlightParams(s, uni) {
  const discount = scrapNonNegative(s.fuelDiscount);
  const drives = Array.isArray(s.driveLevels) ? s.driveLevels : [];
  return {
    driveLevels: [0, 1, 2].map((i) => Math.floor(scrapNonNegative(drives[i]))),
    fleetSpeedWar: uni.fleetSpeedPeaceful,
    fleetSpeedPeaceful: uni.fleetSpeedPeaceful,
    fleetSpeedHolding: uni.fleetSpeedPeaceful,
    deutFactor: uni.deutFactor,
    deutConsReduction: uni.deutConsReduction,
    playerClass: s.playerClass ?? PLAYER_CLASS.DISCOVERER,
    missionType: MISSION.PEACEFUL,
    traderBonus: false,
    warriorBonus: false,
    hyperTechLvl: 0,
    spCargohold: 0,
    lfMechanGE: scrapNonNegative(s.lfMechanGE),
    lfRocktalCE: scrapNonNegative(s.lfRocktalCE),
    lfShipsBonuses: SCRAP_FLIGHT_SHIP_IDS.map((id) => {
      const bonus = s.shipBonuses?.[id];
      return [scrapNonNegative(bonus?.speed), 0, scrapNonNegative(bonus?.fuel) + discount];
    }),
  };
}

/**
 * One fleet save of the whole fleet, and each ship type's share of its fuel.
 *
 * @param {Object<string, unknown>} counts Counts by tech id; ships flight does not know are left out.
 * @param {ScrapFleetsaveSettings} settings
 * @returns {{distance: number, duration: number, total: number, perSave: Record<string, number>}}
 *   duration in seconds one way; total, the deuterium the game charges for the save (0 for an
 *   empty fleet); perSave, by tech id, each type's unrounded share of it - they add up to the
 *   total before it is rounded.
 */
function scrapFleetsaveFuel(counts, settings) {
  const calc = new FlightCalculator();
  const uni = scrapUniverse(settings.universe);
  const distance = scrapRouteDistance(settings.route, uni);
  const params = scrapFlightParams(settings, uni);
  const shipCounts = SCRAP_FLIGHT_SHIP_IDS.map((id) => Math.floor(scrapNonNegative(counts[id])));
  /** @type {Record<string, number>} */
  const perSave = Object.fromEntries(SCRAP_FLIGHT_SHIP_IDS.map((id) => [id, 0]));
  if (!shipCounts.some((n) => n > 0)) return { distance, duration: 0, total: 0, perSave };

  const ships = calc.buildShipsData(params.driveLevels);
  const minSpeed = calc.getMinSpeed(ships, shipCounts, params);
  const { flightSpeed, fleetSpeed, fixedSpeed } = calc.missionSpeeds(MISSION.PEACEFUL, minSpeed, params);
  const percents = calc.speedPercents(params.playerClass);
  const asked = Number(settings.speedPercent);
  const percent = percents.includes(asked) ? asked : SCRAP_FLEETSAVE_DEFAULTS.speedPercent;
  const duration = calc.getFlightDuration(flightSpeed, distance, percent, fleetSpeed);
  const { total, perType } = calc.getDeutConsumptionByType(ships, shipCounts, distance, duration, fleetSpeed,
    params, fixedSpeed);
  SCRAP_FLIGHT_SHIP_IDS.forEach((id, i) => { perSave[id] = perType[i]; });
  return { distance, duration, total, perSave };
}

/**
 * Deuterium a day each type burns when the fleet is saved `times` times every
 * `days` days.
 *
 * @param {Record<string, number>} perSave From scrapFleetsaveFuel().
 * @param {unknown} times At least 1.
 * @param {unknown} days At least 1.
 * @returns {Record<string, number>}
 */
function scrapFuelPerDay(perSave, times, days) {
  const atLeastOne = (/** @type {unknown} */ v) => Math.max(1, Math.floor(scrapNonNegative(v)));
  const factor = atLeastOne(times) / atLeastOne(days);
  return Object.fromEntries(Object.entries(perSave).map(([id, fuel]) => [id, fuel * factor]));
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    SCRAP_FLIGHT_SHIP_IDS, SCRAP_ROUTES, SCRAP_FLEETSAVE_DEFAULTS, SCRAP_DEFAULT_UNIVERSE,
    scrapRoute, scrapRouteDistance, scrapFleetsaveFuel, scrapFuelPerDay,
  });
}
