// ============================================================================
// PLAYER PROFILES - the model, DOM-free and storage-free
// ============================================================================
// A profile is one OGame account as the site knows it: its universe, its
// account data and its planets and moons (CONTEXT.md, ADR-0004). Every value is
// kept in two layers - `game`, as the last account export reported it, and
// `override`, what the player set by hand on top of it - so an experiment never
// silently becomes the account's truth and a re-import never silently erases it.
//
// This file holds the rules only: reading an account export, applying it to a
// profile, editing and resetting values, merging two profiles, the profile file,
// and turning the old saved sets of flight and production into profiles. Storage
// and the page wiring live in profiles-store.js and the calculators.
//
// Value keys are flat strings with GAME ids throughout ('research.113',
// 'building.22', 'ship.217' for the crawler). The calculators' own tech tables
// use the same game ids, so no value needs translating at their boundary.

'use strict';

/** Version of the stored profile format. Bump it with a migration in readProfile(). */
const PROFILE_FORMAT_VERSION = 1;

/** Version of the profile file a player downloads as a backup. */
const PROFILE_FILE_VERSION = 1;

/** The origin-exporter `schemaVersion` values this site understands. */
const ACCOUNT_EXPORT_SCHEMAS = new Set([1, 2]);

/** Character class: the game's ids. 0 means none. */
const PROFILE_CLASS = { NONE: 0, COLLECTOR: 1, GENERAL: 2, DISCOVERER: 3 };

/** Alliance class: the game's ids. 0 means none. */
const PROFILE_ALLIANCE_CLASS = { NONE: 0, WARRIOR: 1, TRADER: 2, RESEARCHER: 3 };

const PROFILE_OFFICERS = ['commander', 'admiral', 'engineer', 'geologist', 'technocrat'];

/** Life-form species id (701-704) to the race number the calculators use (1-4). */
const SPECIES_TO_RACE = { 701: 1, 702: 2, 703: 3, 704: 4 };

/** Character class booster id in speciesBonuses to the class it boosts. */
const CLASS_BOOSTER_TO_CLASS = { 601: 1, 602: 2, 603: 3 };

/**
 * The "Expedition Resource Booster" items of the game's shop, by the percentage
 * each one adds to the resources found. An item is told apart by its uuid, not
 * its name: the name follows the player's client language. Three uuids per
 * step, one for each duration the shop sells.
 *
 * @type {Object<string, number>}
 */
const EXPEDITION_RESOURCE_BOOSTER_ITEMS = {
  '586b20cfd60ef85c6670b62435ca2f44f1071bd8': 10, '3fe4fb984a1b2bd29e8c14f9f25bea2389727b5e': 10, 'be998009fff22d7eea987cf974a25cacc06d330c': 10,
  'e4b33192361f45f4c61691844d0e8ec95fa5a231': 15, '6c482898a61fa9ad20e9ce330975f07aa1f76520': 15, '93eab867affae30157fc660899d9eac7d3b4f971': 15,
  '03ece11ef535f5ef49b203ff50a0466fda5a76e2': 20, '335efdb763687e956dfe6a330ceddd32f174d753': 20, '01c49a959ed989bd1b86abf0526f91ac0b716bfe': 20,
  '0049d2538081bea1dc5264a2899a194fe79107f1': 25, '75154767d49fc6867c9d7465a095371993377c88': 25, '4cfd5bef27f891a1608b0d1e595cf8bf8cb144c0': 25,
  '5e42748915b5cab0ca7fd8e58e842ae9abb12745': 30, 'b9d9a0d57544363a4ac5531fa01f4b0b17256e24': 30, '9c069cb845b9225f9bb191f15d4f6abb0e7e144e': 30,
  '2466f93d624ef96ffcc9e36f8c953699f525a5eb': 35, 'edd5cb7bfed46a64d4351fa6f4ef2076dc305e10': 35, '1b709fc34003e171528ec345430cbb2e3aa090e5': 35,
  '3876b353a7f99b28520a82df01cd86c31b4cbfe0': 40, '505fa6275e34b816d5059e26632dcaa8c18bde9a': 40, 'b0f6477d68c9683170cb8d32be2df1177669c5a0': 40,
};

/**
 * The metal, crystal, deuterium and energy booster items of the game's shop and
 * inventory, by the profile value each one sets on its planet: the key and the
 * percentage / 10 (`booster.1`-`booster.3` 1..4, `energyBooster` 2..8). As with
 * the expedition booster, an item is told apart by its uuid, not its name. One
 * line per tier, three uuids for the durations the shop sells; bronze is not
 * sold and has been seen with one duration only.
 *
 * @type {Object<string, [string, number]>}
 */
const PRODUCTION_BOOSTER_ITEMS = {
  'de922af379061263a56d7204d1c395cefcfb7d75': ['booster.1', 1],
  'ba85cc2b8a5d986bbfba6954e2164ef71af95d4a': ['booster.1', 2], '742743b3b0ae1f0b8a1e01921042810b58f12f39': ['booster.1', 2], '6f44dcd2bd84875527abba69158b4e976c308bbc': ['booster.1', 2],
  '05294270032e5dc968672425ab5611998c409166': ['booster.1', 3], '6fecb993169fe918d9c63cd37a2e541cc067664e': ['booster.1', 3], '21c1a65ca6aecf54ffafb94c01d0c60d821b325d': ['booster.1', 3],
  'a83cfdc15b8dba27c82962d57e50d8101d263cfb': ['booster.1', 4], 'c690f492cffe5f9f2952337e8eed307a8a62d6cf': ['booster.1', 4], 'ca7f903a65467b70411e513b0920d66c417aa3a2': ['booster.1', 4],
  '3c9f85221807b8d593fa5276cdf7af9913c4a35d': ['booster.2', 1],
  '422db99aac4ec594d483d8ef7faadc5d40d6f7d3': ['booster.2', 2], '5b69663e3ba09a1fe77cf72c5094e246cfe954d6': ['booster.2', 2], '04d8afd5936976e32ce894b765ea8bd168aa07ef': ['booster.2', 2],
  '118d34e685b5d1472267696d1010a393a59aed03': ['booster.2', 3], '36fb611e71d42014f5ebd0aa5a52bc0c81a0c1cb': ['booster.2', 3], 'd45f00e8b909f5293a83df4f369737ea7d69c684': ['booster.2', 3],
  '35d96e441c21ef112a84c618934d9d0f026998fd': ['booster.2', 4], '6bf45fcba8a6a68158273d04a924452eca75cf39': ['booster.2', 4], '7c2edf40c5cd54ad11c6439398b83020c0a7a6be': ['booster.2', 4],
  'd9fa5f359e80ff4f4c97545d07c66dbadab1d1be': ['booster.3', 1],
  'e4b78acddfa6fd0234bcb814b676271898b0dbb3': ['booster.3', 2], '26416a3cdb94613844b1d3ca78b9057fd6ae9b15': ['booster.3', 2], '6f0952a919fd2ab9c009e9ccd83c1745f98f758f': ['booster.3', 2],
  '5560a1580a0330e8aadf05cb5bfe6bc3200406e2': ['booster.3', 3], '300493ddc756869578cb2888a3a1bc0c3c66765f': ['booster.3', 3], 'dc5896bed3311434224d511fa7ced6fdbe41b4e8': ['booster.3', 3],
  '4b51d903560edd102467b110586000bd64fdb954': ['booster.3', 4], '620f779dbffa1011aded69b091239727910a3d03': ['booster.3', 4], '831c3ea8d868eb3601536f4d5e768842988a1ba9': ['booster.3', 4],
  '3f6f381dc9b92822406731a942c028adf8dc978f': ['energyBooster', 2],
  'c2bad58fcec374d709099d11d0549e59ea7e233e': ['energyBooster', 4], 'bedd248aaf288c27e9351cfacfa6be03f1dbb898': ['energyBooster', 4], 'e05aa5b9e3df5be3857b43da8403eafbf5ad3b96': ['energyBooster', 4],
  '55b52cbfb148ec80cd4e5b0580f7bed01149d643': ['energyBooster', 6], '4fa9a2273ee446284d5177fd9d60a22de01e932b': ['energyBooster', 6], '5ad783dcfce3655ef97b36197425718a0dad6b66': ['energyBooster', 6],
  '77c36199102e074dca46f5f26ef57ce824d044dd': ['energyBooster', 8], 'dfe86378f8c3d7f3ee0790ea64603bc44e83ca47': ['energyBooster', 8], 'c39aa972a971e94b1d9b4d7a8f734b3d8be12534': ['energyBooster', 8],
};

/** The profile keys a production booster item sets, each 0 when no booster of its kind is active. */
const PRODUCTION_BOOSTER_KEYS = ['booster.1', 'booster.2', 'booster.3', 'energyBooster'];

/** Default exchange rates, [metal, crystal, deuterium] in metal units. */
const DEFAULT_RATES = [1, 1.5, 3];

/** Decimal digits kept on a life-form percentage: enough for any value the game shows. */
const PROFILE_PERCENT_DIGITS = 6;

/**
 * @typedef {Object} LayeredValue
 * @property {*} [game] The value at the last import. Absent on a value the game never reported.
 * @property {*} [override] The value the player set on top of it.
 */

/** @typedef {Object<string, LayeredValue>} LayeredValues */

/**
 * @typedef {Object} ProfileCoords
 * @property {?number} galaxy Null for a planet carried over from production, which only knew the position.
 * @property {?number} system
 * @property {?number} position
 */

/**
 * @typedef {Object} ProfilePlanet
 * @property {string} id Our own id, stable for the life of the profile.
 * @property {?number} gameId The game's planet id; null for a planet entered by hand.
 * @property {string} name
 * @property {?ProfileCoords} coords
 * @property {LayeredValues} values
 */

/**
 * @typedef {Object} ProfileMoonExtra
 * @property {?string} planetId Our id of the planet the moon orbits, when known.
 */

/** @typedef {ProfilePlanet & ProfileMoonExtra} ProfileMoon */

/**
 * @typedef {Object} ProfileUniverse
 * @property {string} country Community code, as in the host name s1-en.
 * @property {number} number
 */

/**
 * @typedef {Object} Profile
 * @property {number} formatVersion
 * @property {string} id
 * @property {string} label
 * @property {?ProfileUniverse} universe
 * @property {boolean} universeLocked True when the universe came from the export itself.
 * @property {?number} playerId
 * @property {?string} [playerName] The account's name in the game as the last
 *   import named it. The label follows it while the two agree (followPlayerName).
 *   Null on a manual profile; absent on one stored before it was kept.
 * @property {?string} importedAt ISO time of the export the game layer came from.
 * @property {{values: LayeredValues}} account
 * @property {ProfilePlanet[]} planets
 * @property {ProfileMoon[]} moons
 * @property {BodyResourcesMap} [resources] The resources on each body, as last
 *   reported. Not a game layer: no override, no mark, not in the backup file.
 *   Absent on a profile never imported.
 */

/**
 * The metal, crystal and deuterium on one planet or moon at one moment, as the
 * game showed them. Not extrapolated: `at` says how old they are.
 *
 * @typedef {Object} BodyResources
 * @property {number} metal
 * @property {number} crystal
 * @property {number} deuterium
 * @property {number} at When they were read, in Unix milliseconds.
 */

/** @typedef {Object<string, BodyResources>} BodyResourcesMap Keyed by the body's game id, as a string. */

/**
 * @typedef {Object} ExportBody
 * @property {?number} gameId
 * @property {string} name
 * @property {?ProfileCoords} coords
 * @property {Object<string, *>} values Plain values, not layered.
 * @property {?number} [planetGameId] On a moon: the game id of its planet.
 */

/**
 * @typedef {Object} AccountExport
 * @property {number} schemaVersion
 * @property {number} playerId
 * @property {string} playerName
 * @property {?ProfileUniverse} universe Null on schema 1, which does not carry it.
 * @property {?string} exportedAt
 * @property {Object<string, *>} account Plain values, not layered.
 * @property {ExportBody[]} planets
 * @property {ExportBody[]} moons
 * @property {BodyResourcesMap} resources Per body, Companion's reading, else the
 *   export's own (exportResources). Empty for a trimmed export.
 */

/**
 * @typedef {Object} ImportCounts
 * @property {number} added
 * @property {number} updated
 * @property {number} removed
 */

/**
 * @typedef {Object} ImportSummary
 * @property {boolean} created True when the import made a new profile.
 * @property {ImportCounts} planets
 * @property {ImportCounts} moons
 * @property {?ProfileRename} renamed The label the import changed, if it did.
 */

/**
 * @typedef {Object} ProfileRename
 * @property {string} from
 * @property {string} to
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A finite number, or null.
 *
 * @param {unknown} value
 * @returns {?number}
 */
function finiteOrNull(value) {
  const n = Number(value);
  return value !== null && value !== '' && Number.isFinite(n) ? n : null;
}

/**
 * A game fraction (0.0418043) as a percentage (4.18043), rounded off float noise.
 *
 * @param {unknown} fraction
 * @returns {number}
 */
function fractionToPercent(fraction) {
  const value = Number(fraction);
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** PROFILE_PERCENT_DIGITS;
  return Math.round(value * 100 * scale) / scale;
}

/**
 * Deep equality for the value shapes a profile holds: numbers, strings,
 * booleans and arrays of them.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  return a === b;
}

/**
 * Plain-data copy. Profiles hold JSON data only, so JSON is an exact copy -
 * and it is the right one for a calculator's settings too: production's
 * options.prm carries a `validate` function, which JSON drops and
 * structuredClone refuses with a DataCloneError.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function cloneData(value) {
  return JSON.parse(JSON.stringify(value)); // NOSONAR - structuredClone throws on the functions in a settings object
}

/**
 * A fresh local id. Not a security token: it only has to be unique in one browser.
 *
 * @returns {string}
 */
function newProfileId() {
  const c = typeof crypto === 'undefined' ? null : crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); // NOSONAR - a local id, not a secret (see above)
}

/**
 * @param {?ProfileUniverse} a
 * @param {?ProfileUniverse} b
 */
function sameUniverse(a, b) {
  return !!a && !!b && a.country === b.country && a.number === b.number;
}

/**
 * A universe as stored data names it - a backup file, the ignore list - when
 * it is one: a two- or three-letter country and a positive number.
 *
 * @param {unknown} raw
 * @returns {?ProfileUniverse}
 */
function readProfileUniverse(raw) {
  if (!isPlainObject(raw)) return null;
  const { country, number } = raw;
  if (typeof country !== 'string' || !/^[a-z]{2,3}$/i.test(country) || !Number.isInteger(number) || number <= 0) return null;
  return { country, number };
}

/**
 * Whether time `a` comes after time `b`. A missing time, or one that does not
 * read as a date, counts as the epoch.
 *
 * @param {?string|undefined} a
 * @param {?string|undefined} b
 * @returns {boolean}
 */
function isLaterThan(a, b) {
  return (Date.parse(a || '') || 0) > (Date.parse(b || '') || 0);
}

/**
 * What every calculator's profile field has: the profile value key it shows,
 * and how its game value reads in the "in game" mark (default: the value
 * as text).
 *
 * @typedef {Object} ProfileFieldBase
 * @property {string} key Profile value key.
 * @property {(value: *) => string} [display] The game value as shown in the mark.
 */

/**
 * A stored or typed value as a number; anything that is not one is 0.
 *
 * @param {*} v
 * @returns {number}
 */
function pfNum(v) {
  return Number(v) || 0;
}

/**
 * A stored flag as a boolean: calculator settings keep one as true or 'true'.
 *
 * @param {*} v
 * @returns {boolean}
 */
function pfBool(v) {
  return v === true || v === 'true';
}

/**
 * The "from" and "to" levels a build row takes when the body it is filled from
 * changes, or null to leave the row as it is. A row the player left alone -
 * "to" equal to "from", or empty, on the multi-level tables (gap 0); "to" not
 * beyond "from" + gap on the range tab (gap above 0) - follows the new level.
 * One whose "to" was set by hand keeps both its levels: it is the player's plan.
 *
 * @param {number} from
 * @param {number} to
 * @param {number} level The body's level.
 * @param {number} gap How far "to" sits above "from" on a row left alone.
 * @returns {?{from: number, to: number}}
 */
function pfStartRange(from, to, level, gap) {
  const untouched = gap === 0 ? to === from || to === 0 : to <= from + gap;
  return untouched ? { from: level, to: level + gap } : null;
}

/**
 * A planet or moon as a select shows it: its name and, when known, its
 * coordinates.
 *
 * @param {{name?: ?string, coords?: ?ProfileCoords}} body
 * @param {string} [fallback] The name of a body that has none.
 * @returns {string}
 */
function pfBodyLabel(body, fallback = '—') {
  const c = body.coords;
  const where = typeof c?.galaxy === 'number' && typeof c.system === 'number' ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
  return (body.name || fallback) + where;
}

/**
 * Coordinates match when every part both sides know agrees and the position is
 * known on both. A planet carried over from production knows only its position,
 * so a missing galaxy or system is not a mismatch.
 *
 * @param {?ProfileCoords} a
 * @param {?ProfileCoords} b
 */
function sameCoords(a, b) {
  if (!a || !b || a.position === null || a.position !== b.position) return false;
  if (a.galaxy !== null && b.galaxy !== null && a.galaxy !== b.galaxy) return false;
  return !(a.system !== null && b.system !== null && a.system !== b.system);
}

/**
 * The planet of `pool` that `coords` matches, if there is exactly one. A planet
 * carried over from production knows only its position, and a player can hold
 * several planets on the same position in different systems; a match on the
 * position alone therefore counts only when it is unambiguous both ways - one
 * planet of the pool has it, and no other planet of `rivals` (the side
 * `coords` comes from) would claim the same pool planet.
 *
 * @template {{coords: ?ProfileCoords}} T
 * @param {T[]} pool
 * @param {?ProfileCoords} coords
 * @param {Array<{coords: ?ProfileCoords}>} rivals Includes the planet `coords` belongs to.
 * @returns {T|undefined}
 */
function uniqueCoordsMatch(pool, coords, rivals) {
  const found = pool.filter((p) => sameCoords(p.coords, coords));
  if (found.length !== 1) return undefined;
  const target = found[0];
  return rivals.filter((r) => sameCoords(target.coords, r.coords)).length === 1 ? target : undefined;
}

// ---------------------------------------------------------------------------
// Creating profiles
// ---------------------------------------------------------------------------

/**
 * A new, empty manual profile.
 *
 * @param {{label: string, universe?: ?ProfileUniverse, id?: string}} init
 * @returns {Profile}
 */
function createProfile(init) {
  return {
    formatVersion: PROFILE_FORMAT_VERSION,
    id: init.id || newProfileId(),
    label: String(init.label || '').trim(),
    universe: init.universe ? { country: init.universe.country, number: init.universe.number } : null,
    universeLocked: false,
    playerId: null,
    playerName: null,
    importedAt: null,
    account: { values: {} },
    planets: [],
    moons: [],
  };
}

/**
 * @param {{name?: string, coords?: ?ProfileCoords, gameId?: ?number, id?: string}} init
 * @returns {ProfilePlanet}
 */
function createPlanet(init) {
  return {
    id: init.id || newProfileId(),
    gameId: init.gameId ?? null,
    name: init.name || '',
    coords: init.coords || null,
    values: {},
  };
}

// ---------------------------------------------------------------------------
// The two layers
// ---------------------------------------------------------------------------

/**
 * The value a calculator should use: the override when there is one, otherwise
 * what the game reported.
 *
 * @param {{values: LayeredValues}} entity The account, a planet or a moon.
 * @param {string} key
 * @param {*} [fallback] Returned when neither layer holds the key.
 */
function getProfileValue(entity, key, fallback) {
  const v = entity.values[key];
  if (!v) return fallback;
  if ('override' in v) return v.override;
  if ('game' in v) return v.game;
  return fallback;
}

/**
 * Set a value from a calculator. It always lands in the override layer; an
 * override equal to the game value is dropped, because it no longer differs.
 *
 * @param {{values: LayeredValues}} entity
 * @param {string} key
 * @param {*} value
 * @returns {boolean} True when the stored data changed.
 */
function setProfileValue(entity, key, value) {
  const current = entity.values[key];
  if (current && 'game' in current && sameValue(current.game, value)) {
    if (!('override' in current)) return false;
    delete current.override;
    return true;
  }
  if (current && 'override' in current && sameValue(current.override, value)) return false;
  entity.values[key] = current ? { ...current, override: cloneData(value) } : { override: cloneData(value) };
  return true;
}

/**
 * True when the value has an override that differs from a game value. A value
 * the game never reported is not "different from the game" - there is nothing
 * to restore - so a manual profile never shows the mark.
 *
 * @param {{values: LayeredValues}} entity
 * @param {string} key
 */
function differsFromGame(entity, key) {
  const v = entity.values[key];
  return !!v && 'game' in v && 'override' in v && !sameValue(v.game, v.override);
}

/**
 * Drop the override of one value, back to what the game reported. A value with
 * no game layer is left alone: resetting it would erase the only copy.
 *
 * @param {{values: LayeredValues}} entity
 * @param {string} key
 * @returns {boolean} True when something was reset.
 */
function resetProfileValue(entity, key) {
  const v = entity.values[key];
  if (!v || !('game' in v) || !('override' in v)) return false;
  delete v.override;
  return true;
}

/**
 * One profile value as a calculator shows it now, ready to be compared with a
 * binder's snapshot.
 *
 * @typedef {Object} FieldReading
 * @property {?{values: LayeredValues}} entity What holds the value: the account, the body shown; null when no such entity is shown.
 * @property {string} key Profile value key.
 * @property {string} snapKey Where the snapshot keeps the value (pfSnapKey).
 * @property {*} value
 */

/**
 * The key a binder's snapshot keeps a value under: an account value under its
 * own key, a body value prefixed with its scope, as in `planet:building.14`.
 *
 * @param {string} scope '' for the account.
 * @param {string} key Profile value key.
 * @returns {string}
 */
function pfSnapKey(scope, key) {
  return scope ? scope + ':' + key : key;
}

/**
 * A snapshot of the values a calculator shows, those of an entity not shown
 * included.
 *
 * @param {FieldReading[]} readings
 * @returns {Record<string, *>}
 */
function snapshotReadings(readings) {
  /** @type {Record<string, *>} */
  const snapshot = {};
  readings.forEach((r) => { snapshot[r.snapKey] = r.value; });
  return snapshot;
}

/**
 * What a write-back writes: every value that differs from the snapshot, and
 * the snapshot with those values in it. A reading of no entity is skipped and
 * its snapshot left as it was. A value set back to the game's is written too -
 * the profile then drops its override, or does not change - and remembered.
 *
 * @param {FieldReading[]} readings
 * @param {Record<string, *>} snapshot Not changed; the result carries the new one.
 * @returns {{writes: Array<{entity: {values: LayeredValues}, key: string, value: *}>, snapshot: Record<string, *>}}
 */
function diffReadings(readings, snapshot) {
  const next = { ...snapshot };
  /** @type {Array<{entity: {values: LayeredValues}, key: string, value: *}>} */
  const writes = [];
  readings.forEach((r) => {
    if (!r.entity || sameValue(r.value, next[r.snapKey])) return;
    next[r.snapKey] = r.value;
    writes.push({ entity: r.entity, key: r.key, value: r.value });
  });
  return { writes, snapshot: next };
}

/**
 * Settings keys the profile owns whenever the entity behind them is shown -
 * the account, a planet, a moon, the universe - as a binder of the
 * calculator's own values counts them (ADR-0004: with a profile active, what
 * the profile owns is not written to options_<calc>).
 *
 * @typedef {Object} PfOwnedGroup
 * @property {string[]} keys Keys of the calculator's settings.
 * @property {boolean} present True while the profile fills them; false leaves them to the calculator (a body the profile does not have).
 * @property {boolean} [show] False: while absent, the form is not given the own values back - something else decides what it shows (the universe settings). Their values are still the calculator's own.
 */

/**
 * What a field group tells pfOwnedGroups(): the entity that fills it, and the
 * settings keys it writes - each field's own, and those no field covers
 * (`alsoOwns`: a value filled in from the entity, a key the binder writes itself).
 *
 * @typedef {Object} PfOwningGroup
 * @property {(profile: Profile) => ?Object} entity
 * @property {Array<{owns: string[]}>} fields
 * @property {string[]} [alsoOwns]
 */

/**
 * The owned groups that follow from a binder's field groups and the settings
 * its universe fills (CONTEXT.md: Own values): one per field group, present
 * while the profile has its entity, and one for the universe settings, present
 * while the profile has a universe and never given back to the form - the
 * universe setting shows them. A key is listed once per group.
 *
 * @param {PfOwningGroup[]} groups
 * @param {string[]} universeKeys
 * @param {?Profile} profile The profile shown; null before one is, when only the keys count.
 * @returns {PfOwnedGroup[]}
 */
function pfOwnedGroups(groups, universeKeys, profile) {
  /** @type {PfOwnedGroup[]} */
  const owned = groups.map((g) => ({
    keys: [...new Set([...g.fields.flatMap((f) => f.owns), ...(g.alsoOwns ?? [])])],
    present: profile !== null && (g.entity(profile) ?? null) !== null,
  }));
  if (universeKeys.length > 0) owned.push({ keys: universeKeys, present: !!profile?.universe, show: false });
  return owned;
}

/**
 * A deep copy of some keys of a calculator's settings. A key the settings do
 * not hold (or hold as undefined) is left out: there is no own value to keep,
 * and cloneData() cannot copy undefined.
 *
 * @param {Record<string, any>} values
 * @param {Iterable<string>} keys
 * @returns {Record<string, any>}
 */
function pfPickOwn(values, keys) {
  /** @type {Record<string, any>} */
  const picked = {};
  for (const key of keys) {
    if (values[key] !== undefined) picked[key] = cloneData(values[key]);
  }
  return picked;
}

/**
 * Which owned keys the profile fills now and which are the calculator's own
 * now: a group that is not present - a body the profile does not have - is
 * the calculator's. A key that a present group names is the profile's, even
 * if an absent group names it too. Each key is listed once.
 *
 * @param {PfOwnedGroup[]} groups
 * @returns {{profile: string[], own: string[]}}
 */
function pfSplitOwned(groups) {
  const profile = new Set(groups.filter((g) => g.present).flatMap((g) => g.keys));
  const own = new Set(groups.filter((g) => !g.present).flatMap((g) => g.keys).filter((k) => !profile.has(k)));
  return { profile: [...profile], own: [...own] };
}

/**
 * What a calculator stores as its own while a profile is active, and what
 * its copy of the own values becomes. `stored` is `current` with the keys the
 * profile fills now taken from the copy; the new copy is the old one with the
 * keys it tracks but the profile does not fill now taken from `current`. A
 * key the copy does not hold leaves `current`'s value in `stored`; a key
 * `current` does not hold is dropped from the copy. Nothing passed in is
 * changed, and neither result shares a value with the other or with `own`.
 *
 * @param {{current: Record<string, any>, own: Record<string, any>, owned: Iterable<string>, ownedNow: Iterable<string>}} input
 *   `owned`: the keys the copy tracks; `ownedNow`: those of them the profile fills now.
 * @returns {{stored: Record<string, any>, own: Record<string, any>}}
 */
function pfKeepOwn({ current, own, owned, ownedNow }) {
  const now = new Set(ownedNow);
  const stored = { ...current, ...pfPickOwn(own, now) };
  const next = pfPickOwn(own, Object.keys(own));
  for (const key of owned) {
    if (now.has(key)) continue;
    if (current[key] === undefined) delete next[key];
    else next[key] = cloneData(current[key]);
  }
  return { stored, own: next };
}

/**
 * One value of a profile that differs from the game, or a setting of its
 * universe that the player picked instead of the game's (listUniverseOverrides).
 *
 * @typedef {Object} ProfileOverride
 * @property {'account'|'planet'|'moon'|'universe'} kind
 * @property {?string} entityId The planet's or moon's local id; null for the account and the universe.
 * @property {string} key
 * @property {*} game
 * @property {*} override
 */

/**
 * Every value of the profile that differs from the game: the account first,
 * then the planets and the moons in the profile's order.
 *
 * @param {Profile} profile
 * @returns {ProfileOverride[]}
 */
function listOverrides(profile) {
  /** @type {ProfileOverride[]} */
  const list = [];
  /**
   * @param {'account'|'planet'|'moon'} kind
   * @param {?string} entityId
   * @param {{values: LayeredValues}} entity
   */
  const collect = (kind, entityId, entity) => {
    Object.keys(entity.values).forEach((key) => {
      if (!differsFromGame(entity, key)) return;
      const v = entity.values[key];
      list.push({ kind, entityId, key, game: v.game, override: v.override });
    });
  };
  collect('account', null, profile.account);
  profile.planets.forEach((p) => collect('planet', p.id, p));
  profile.moons.forEach((m) => collect('moon', m.id, m));
  return list;
}

/**
 * Restore the game value of the listed overrides; the others keep theirs.
 *
 * @param {Profile} profile
 * @param {Array<{entityId: ?string, key: string}>} items
 * @returns {number} How many values were reset.
 */
function resetOverrides(profile, items) {
  let count = 0;
  items.forEach((item) => {
    const entity = item.entityId === null
      ? profile.account
      : profile.planets.find((p) => p.id === item.entityId) || profile.moons.find((m) => m.id === item.entityId);
    if (entity && resetProfileValue(entity, item.key)) count++;
  });
  return count;
}

/**
 * How many values of the profile differ from the game.
 *
 * @param {Profile} profile
 */
function countOverrides(profile) {
  return listOverrides(profile).length;
}

/**
 * True when the profile has a game layer at all - the condition for showing the
 * "in game" marks (ADR-0004).
 *
 * @param {Profile} profile
 */
function hasGameLayer(profile) {
  return profile.importedAt !== null;
}

// ---------------------------------------------------------------------------
// Reading an account export (origin-exporter)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExportParseResult
 * @property {boolean} ok
 * @property {AccountExport} [data]
 * @property {'json'|'shape'|'schema'} [reason] Why the text was refused.
 */

/**
 * Parse the text of an account export.
 *
 * @param {string} text
 * @returns {ExportParseResult}
 */
function parseAccountExport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isPlainObject(raw) || finiteOrNull(raw.playerId) === null || !isPlainObject(raw.planets)) {
    return { ok: false, reason: 'shape' };
  }
  const schemaVersion = Number(raw.schemaVersion);
  if (!ACCOUNT_EXPORT_SCHEMAS.has(schemaVersion)) return { ok: false, reason: 'schema' };
  return { ok: true, data: normalizeAccountExport(raw, schemaVersion) };
}

/**
 * @param {Record<string, any>} raw
 * @param {number} schemaVersion
 * @returns {AccountExport}
 */
function normalizeAccountExport(raw, schemaVersion) {
  const productionFactors = isPlainObject(raw.pfgCompanion) && isPlainObject(raw.pfgCompanion.productionFactors)
    ? raw.pfgCompanion.productionFactors : {};
  const nowSeconds = exportTimeSeconds(raw);
  const planetRank = exportPlanetOrder(raw);
  const exported = Object.values(raw.planets).filter((p) => isPlainObject(p))
    .map((p) => exportBody(p, true, nowSeconds, productionFactors[String(p.id)]));
  const planets = orderByRank(exported, (p) => (p.gameId === null ? -1 : planetRank.get(p.gameId) ?? -1));
  const moons = Object.values(isPlainObject(raw.moons) ? raw.moons : {}).filter((m) => isPlainObject(m)).map((m) => {
    const body = exportBody(m, false, nowSeconds);
    body.planetGameId = finiteOrNull(m.siblingId) || null;
    return body;
  });
  return {
    schemaVersion,
    playerId: Number(raw.playerId),
    playerName: typeof raw.playerName === 'string' ? raw.playerName : '',
    universe: exportUniverse(raw.universe),
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date(0).toISOString(),
    account: exportAccountValues(raw),
    planets,
    moons: orderByRank(moons, (m) => planets.findIndex((p) => p.gameId !== null && p.gameId === m.planetGameId)),
    resources: exportResources(raw),
  };
}

/**
 * Where each planet stands in the player's own planet list, by game id. The
 * game lets the player sort that list (by emergence, coordinates, name, size,
 * fields, either way round); PfG Companion reports the result as
 * `pfgCompanion.planetOrder`, the planets' game ids in the order the list
 * shows them. The export itself carries no order: its `planets` is keyed by id.
 * An id that is not a number, or one listed twice, is skipped - the order is
 * cosmetic and never fails an import.
 *
 * @param {Record<string, any>} raw
 * @returns {Map<number, number>} Game id to position; empty when there is no order.
 */
function exportPlanetOrder(raw) {
  /** @type {Map<number, number>} */
  const rank = new Map();
  const order = isPlainObject(raw.pfgCompanion) ? raw.pfgCompanion.planetOrder : null;
  if (!Array.isArray(order)) return rank;
  order.forEach((value) => {
    const id = finiteOrNull(value);
    if (id !== null && !rank.has(id)) rank.set(id, rank.size);
  });
  return rank;
}

/**
 * One reading of a body's resources, or null when any of the three is missing.
 *
 * @param {unknown} raw `{metal, crystal, deuterium, ...}`
 * @param {number} at Unix milliseconds.
 * @returns {?BodyResources}
 */
function readBodyResources(raw, at) {
  if (!isPlainObject(raw) || !Number.isFinite(at) || at <= 0) return null;
  const metal = finiteOrNull(raw.metal);
  const crystal = finiteOrNull(raw.crystal);
  const deuterium = finiteOrNull(raw.deuterium);
  if (metal === null || crystal === null || deuterium === null) return null;
  return { metal, crystal, deuterium, at };
}

/**
 * A time as the export or Companion writes it - an ISO string, or already
 * Unix milliseconds - in Unix milliseconds; NaN when it does not read.
 *
 * @param {unknown} value
 * @returns {number}
 */
function timeMs(value) {
  if (typeof value === 'number') return value;
  return Date.parse(typeof value === 'string' ? value : '');
}

/**
 * The resources on each body the export names. Two sources: every full export
 * carries a body's resources as of `exportedAt`, and Companion adds the ones it
 * read off a game page since, in `pfgCompanion.resources`, each with its own
 * `at`. A body's Companion reading wins whatever the two times say: Companion
 * seeds it from the export's resources with their true time, but moves
 * `exportedAt` to "now" on saves that do not refetch them, so `exportedAt`
 * can make a stale reading look newer. The export's resources only cover the
 * bodies Companion has no entry for (an export from another tool). A Companion
 * entry of a body the export does not list is dropped, and so are the export's
 * own resources when its time does not read. A trimmed export gives nothing.
 *
 * @param {Record<string, any>} raw The whole export.
 * @returns {BodyResourcesMap}
 */
function exportResources(raw) {
  /** @type {BodyResourcesMap} */
  const found = {};
  const exportedAt = timeMs(raw.exportedAt);
  /** @type {Set<string>} */
  const bodyIds = new Set();
  [raw.planets, raw.moons].filter((bodies) => isPlainObject(bodies)).forEach((bodies) => {
    Object.values(bodies).filter((body) => isPlainObject(body)).forEach((body) => {
      const id = finiteOrNull(body.id);
      if (id === null) return;
      bodyIds.add(String(id));
      const reading = readBodyResources(body.resources, exportedAt);
      if (reading) found[String(id)] = reading;
    });
  });
  const companion = isPlainObject(raw.pfgCompanion) && isPlainObject(raw.pfgCompanion.resources) ? raw.pfgCompanion.resources : {};
  Object.entries(companion).forEach(([id, entry]) => {
    const reading = isPlainObject(entry) ? readBodyResources(entry, timeMs(entry.at)) : null;
    if (reading && bodyIds.has(id)) found[id] = reading;
  });
  return found;
}

/**
 * The `universe` block proposed in origin-exporter issue #1. Absent on schema 1.
 *
 * @param {unknown} raw
 * @returns {?ProfileUniverse}
 */
function exportUniverse(raw) {
  if (!isPlainObject(raw)) return null;
  const number = finiteOrNull(raw.number);
  const country = typeof raw.language === 'string' ? raw.language : '';
  return number !== null && country ? { country, number } : null;
}

/**
 * @param {Record<string, any>} raw The whole export.
 * @returns {Object<string, *>}
 */
function exportAccountValues(raw) {
  /** @type {Object<string, *>} */
  const values = {};
  // A class the export leaves null is unknown, not "none": the game's accountInfo
  // has been seen to send allianceClassId null for a member of a warrior
  // alliance (2026-10-11). Leaving the key out keeps whatever the player set and
  // marks nothing as differing from the game.
  const characterClass = finiteOrNull(raw.characterClassId);
  if (characterClass !== null) values.class = characterClass;
  const allianceClass = finiteOrNull(raw.allianceClassId);
  if (allianceClass !== null) values.allianceClass = allianceClass;
  const officers = isPlainObject(raw.officers) ? raw.officers : {};
  PROFILE_OFFICERS.forEach((name) => { values['officer.' + name] = officers[name] === true; });
  copyLevels(raw.researches, 'research.', values);

  const speciesValues = isPlainObject(raw.species) && isPlainObject(raw.species.values) ? raw.species.values : {};
  Object.entries(speciesValues).forEach(([speciesId, s]) => {
    const level = isPlainObject(s) ? finiteOrNull(s.level) : null;
    if (level !== null) values['species.' + speciesId + '.level'] = level;
  });

  Object.assign(values, exportLifeformBonuses(raw.speciesBonuses, raw.bonusByType));
  values['item.expeditionResources'] = activeExpeditionResourceBooster(raw);
  return values;
}

/**
 * The percentage the active "Expedition Resource Booster" item adds to the
 * resources an expedition finds. The item is the account's, but the export lists
 * it as a buff of every planet and moon, so the bodies are searched; a buff
 * whose effect ended before the export was made does not count. 0 when none.
 *
 * @param {Record<string, any>} raw The whole export.
 * @returns {number}
 */
function activeExpeditionResourceBooster(raw) {
  const nowSeconds = exportTimeSeconds(raw);
  let best = 0;
  [raw.planets, raw.moons].filter((bodies) => isPlainObject(bodies)).forEach((bodies) => {
    Object.values(bodies).filter((body) => isPlainObject(body)).forEach((body) => {
      (Array.isArray(body.buffs) ? body.buffs : []).filter(isPlainObject).forEach((buff) => {
        const percent = EXPEDITION_RESOURCE_BOOSTER_ITEMS[String(buff.itemUuid)] ?? 0;
        const end = finiteOrNull(buff.effectEnd);
        if (percent > best && (end === null || end > nowSeconds)) best = percent;
      });
    });
  });
  return best;
}

/**
 * The moment the export was made, in seconds - the unit of a buff's
 * `effectEnd`. +Infinity when `exportedAt` is missing or unreadable, so that no
 * buff counts as expired.
 *
 * @param {Record<string, any>} raw The whole export.
 * @returns {number}
 */
function exportTimeSeconds(raw) {
  const exportedMs = Date.parse(typeof raw.exportedAt === 'string' ? raw.exportedAt : '');
  return Number.isFinite(exportedMs) ? exportedMs / 1000 : Number.POSITIVE_INFINITY;
}

/**
 * The production booster items active on one planet, as profile values. Unlike
 * the expedition booster, such an item belongs to the planet it was used on.
 * Every key is present, 0 when no booster of its kind is active, so that a
 * re-import clears one that has expired. Unknown items and buffs whose effect
 * ended before the export are skipped; of two boosters of one kind the higher
 * one counts.
 *
 * @param {unknown} buffs The planet's `buffs`.
 * @param {number} nowSeconds The export time (exportTimeSeconds).
 * @returns {Object<string, number>}
 */
function activeProductionBoosters(buffs, nowSeconds) {
  /** @type {Object<string, number>} */
  const values = {};
  PRODUCTION_BOOSTER_KEYS.forEach((key) => { values[key] = 0; });
  (Array.isArray(buffs) ? buffs : []).filter(isPlainObject).forEach((buff) => {
    const item = PRODUCTION_BOOSTER_ITEMS[String(buff.itemUuid)];
    if (!item) return;
    const [key, value] = item;
    const end = finiteOrNull(buff.effectEnd);
    if (value > values[key] && (end === null || end > nowSeconds)) values[key] = value;
  });
  return values;
}

/**
 * The life-form bonuses, as the final percentages the calculators ask for
 * (ADR-0004: the game's totals, never recomputed from building levels).
 *
 * @param {unknown} sb `speciesBonuses`
 * @param {unknown} byType `bonusByType`
 * @returns {Object<string, number>}
 */
function exportLifeformBonuses(sb, byType) {
  /** @type {Object<string, number>} */
  const values = {};
  const bonuses = isPlainObject(sb) ? sb : {};
  const types = isPlainObject(byType) ? byType : {};

  const resources = isPlainObject(bonuses.resources) ? bonuses.resources : {};
  ['metal', 'crystal', 'deuterium', 'energy'].forEach((res) => {
    const total = isPlainObject(resources[res]) && isPlainObject(resources[res].totalBonus) ? resources[res].totalBonus[res] : 0;
    values['lf.prod.' + res] = fractionToPercent(total);
  });

  const ships = isPlainObject(bonuses.ships) ? bonuses.ships : {};
  Object.entries(ships).forEach(([shipId, entry]) => {
    const total = isPlainObject(entry) && isPlainObject(entry.totalBonus) ? entry.totalBonus : {};
    Object.entries(total).forEach(([stat, fraction]) => {
      values['lf.ship.' + shipId + '.' + stat] = fractionToPercent(fraction);
    });
  });

  const costs = isPlainObject(bonuses.costreduction) ? bonuses.costreduction : {};
  Object.entries(costs).forEach(([techId, entry]) => {
    const total = isPlainObject(entry) && isPlainObject(entry.totalBonus) ? entry.totalBonus : {};
    values['lf.cost.' + techId + '.cost'] = fractionToPercent(total.cost);
    values['lf.cost.' + techId + '.time'] = fractionToPercent(total.time);
  });

  const expedition = isPlainObject(bonuses.expedition) ? bonuses.expedition : {};
  /** @param {string} name */
  const expeditionTotal = (name) => (isPlainObject(expedition[name]) && isPlainObject(expedition[name].totalBonus)
    ? expedition[name].totalBonus[name] : 0);
  values['lf.expedition.resources'] = fractionToPercent(expeditionTotal('ResultBooster'));
  values['lf.expedition.ships'] = fractionToPercent(expeditionTotal('ShipResultBooster'));
  values['lf.expedition.fleetLoss'] = fractionToPercent(expeditionTotal('FleetLostReducer'));

  const classes = isPlainObject(bonuses.characterclasses) ? bonuses.characterclasses : {};
  Object.entries(CLASS_BOOSTER_TO_CLASS).forEach(([boosterId, classId]) => {
    const entry = classes[boosterId];
    const total = isPlainObject(entry) && isPlainObject(entry.totalBonus) ? entry.totalBonus.characterClass : 0;
    values['lf.classBooster.' + classId] = fractionToPercent(total);
  });

  const misc = isPlainObject(bonuses.misc) ? bonuses.misc : {};
  const discovery = isPlainObject(misc.discoveryBonus) && isPlainObject(misc.discoveryBonus.totalBonus)
    ? misc.discoveryBonus.totalBonus.discoveryBonus : 0;
  values['lf.discovery'] = fractionToPercent(discovery);

  // bonusByType drops zero values, so a missing type means 0, not "unknown".
  // ImprovedCrawler is documented as a multi-dimension object; its dimension
  // names have not been seen in a real export yet, so take its first number.
  values['lf.crawler'] = fractionToPercent(firstNumber(types.ImprovedCrawler));
  values['lf.phalanxRange'] = fractionToPercent(firstNumber(types.PhalanxRangeBooster));
  return values;
}

/**
 * @param {unknown} value A number, or an object holding numbers.
 * @returns {number}
 */
function firstNumber(value) {
  if (typeof value === 'number') return value;
  if (isPlainObject(value)) {
    const found = Object.values(value).find((v) => typeof v === 'number');
    if (typeof found === 'number') return found;
  }
  return 0;
}

/**
 * @param {unknown} raw Id to level.
 * @param {string} prefix
 * @param {Object<string, *>} into
 */
function copyLevels(raw, prefix, into) {
  if (!isPlainObject(raw)) return;
  Object.entries(raw).forEach(([id, level]) => {
    const n = finiteOrNull(level);
    if (/^\d+$/.test(id) && n !== null) into[prefix + id] = n;
  });
}

/**
 * Copy the finite numbers among `raw`'s properties, each under its value key.
 *
 * @param {Record<string, any>} raw
 * @param {Record<string, string>} keys Property name -> value key.
 * @param {Object<string, *>} into
 */
function copyNumbers(raw, keys, into) {
  Object.entries(keys).forEach(([prop, key]) => {
    const n = finiteOrNull(raw[prop]);
    if (n !== null) into[key] = n;
  });
}

/**
 * The techs a planet may hold of each life form, at the game ids
 * lfBuildingGameId() and lfResearchGameId() count out. The counts follow
 * data/lf-techs.json. An export names only the standing buildings and
 * researches, so an import fills the rest with zeros (fillLfGameLevels):
 * an unbuilt one is level 0 too, and without the game's zero the field
 * that shows it gets no "as in game" mark.
 */
const LF_RACES = 4;
const LF_BUILDING_POSITIONS = 12;
const LF_RESEARCH_POSITIONS = 18;

/** Every life-form value key a planet may hold: all races, buildings first. */
function lfTechValueKeys() {
  const keys = [];
  for (let race = 1; race <= LF_RACES; race++) {
    for (let position = 1; position <= LF_BUILDING_POSITIONS; position++) keys.push('lf.building.' + lfBuildingGameId(race, position));
    for (let position = 1; position <= LF_RESEARCH_POSITIONS; position++) keys.push('lf.research.' + lfResearchGameId(race, position));
  }
  return keys;
}

/**
 * Add the zeros the export left out. Every race's techs are filled, not only
 * the planet's own: the player's planets may show different races, and lfcosts
 * names buildings of all four. Only the keys that are missing are added, so
 * this runs twice without harm - the stored profiles go through it on every
 * page load (migrateLfGameLevels()).
 *
 * @param {Object<string, *>} values The game values the import has built.
 * @param {number} race The planet's race, as `lf.race`; a planet with no life form gets nothing.
 */
function fillLfGameLevels(values, race) {
  if (race < 1 || race > LF_RACES) return;
  lfTechValueKeys().forEach((key) => { if (!(key in values)) values[key] = 0; });
}

/**
 * The profiles imported before the zeros: their planets lack the game values
 * an import adds now, and the fields of the unbuilt techs show up unmarked.
 * Give every imported planet the missing zeros and save the profiles that
 * changed. Runs once a page, from createProfilesUi(), before anything reads
 * the profiles; after the first run it adds nothing and saves nothing. A
 * hand-entered planet (its race lives in the override layer) is left alone -
 * the next import matches it and fills it as it fills the others.
 *
 * @param {ProfileStore} store
 * @returns {number} How many profiles were rewritten.
 */
function migrateLfGameLevels(store) {
  let count = 0;
  store.getAll().forEach((profile) => {
    if (!hasGameLayer(profile)) return;
    let changed = false;
    profile.planets.forEach((planet) => {
      const race = planet.values['lf.race'];
      if (!race || !('game' in race) || race.game < 1 || race.game > LF_RACES) return;
      lfTechValueKeys().forEach((key) => {
        if (!(key in planet.values)) { planet.values[key] = { game: 0 }; changed = true; }
      });
    });
    if (changed) {
      store.save(profile);
      count++;
    }
  });
  return count;
}

/**
 * One planet or moon of the export.
 *
 * @param {Record<string, any>} raw
 * @param {boolean} isPlanet
 * @param {number} nowSeconds The export time (exportTimeSeconds).
 * @param {unknown} [productionFactors] The planet's row of the Companion's productionFactors.
 * @returns {ExportBody}
 */
function exportBody(raw, isPlanet, nowSeconds, productionFactors = null) {
  /** @type {Object<string, *>} */
  const values = {};
  copyLevels(raw.buildings, 'building.', values);
  copyLevels(raw.ships, 'ship.', values);
  copyLevels(raw.defenses, 'defense.', values);
  copyLevels(raw.speciesBuildings, 'lf.building.', values);
  copyLevels(raw.speciesResearches, 'lf.research.', values);
  if (isPlainObject(raw.fields)) copyNumbers(raw.fields, { used: 'fields.used', total: 'fields.total' }, values);
  copyNumbers(raw, { diameter: 'diameter' }, values);
  if (isPlanet) {
    if (isPlainObject(raw.temperature)) copyNumbers(raw.temperature, { min: 'temperature.min', max: 'temperature.max' }, values);
    const speciesId = finiteOrNull(raw.selectedSpeciesId);
    values['lf.race'] = speciesId !== null ? (SPECIES_TO_RACE[/** @type {701|702|703|704} */ (speciesId)] || 0) : 0;
    fillLfGameLevels(values, values['lf.race']);
    if (isPlainObject(productionFactors)) {
      // Every row of production's table: mines, solar and fusion plants, satellites, crawlers.
      PRODUCTION_ROW_TECHS.forEach((techId) => {
        const factor = finiteOrNull(productionFactors[String(techId)]);
        if (factor !== null) values['production.' + techId] = factor;
      });
    }
    Object.assign(values, activeProductionBoosters(raw.buffs, nowSeconds));
  }
  const galaxy = finiteOrNull(raw.galaxy);
  const system = finiteOrNull(raw.system);
  const position = finiteOrNull(raw.position);
  return {
    gameId: finiteOrNull(raw.id),
    name: typeof raw.name === 'string' ? raw.name : '',
    coords: position !== null ? { galaxy, system, position } : null,
    values,
  };
}

// ---------------------------------------------------------------------------
// Applying an export to a profile
// ---------------------------------------------------------------------------

/**
 * The profile an export belongs to, if one exists: same universe and same
 * player id (ADR-0004). The universe has to be known by then - for a schema-1
 * export the import dialog asks for it first.
 *
 * @param {Array<{id: string, universe: ?ProfileUniverse, playerId: ?number}>} index
 * @param {number} playerId
 * @param {?ProfileUniverse} universe
 * @returns {?string} The profile id.
 */
function findProfileForExport(index, playerId, universe) {
  const match = index.find((entry) => entry.playerId === playerId && sameUniverse(entry.universe, universe));
  return match ? match.id : null;
}

/**
 * The universe an import goes to. The export's own universe always wins. An
 * export without one (schema 1) goes, the first time round, to the universe of
 * the player's only profile that has one; with none or several, the player is
 * asked. Once asked, only what they picked counts.
 *
 * @param {AccountExport} data
 * @param {Array<{universe: ?ProfileUniverse, playerId: ?number}>} index
 * @param {{asked: boolean, picked: ?ProfileUniverse}} picker Whether the player
 *   was already shown the universe picker, and what it holds.
 * @returns {?ProfileUniverse} Null: ask the player.
 */
function resolveImportUniverse(data, index, picker) {
  if (data.universe) return data.universe;
  if (picker.asked) return picker.picked;
  const known = index.filter((e) => e.playerId === data.playerId && e.universe);
  return known.length === 1 ? known[0].universe : null;
}

/**
 * Replace the game layer of one entity. A key the import supplies gets the new
 * game value and loses its override; a key it does not supply loses its game
 * value and keeps its override (production percentages, rates); a key left
 * with neither layer is dropped.
 *
 * @param {{values: LayeredValues}} entity
 * @param {Object<string, *>} imported
 * @param {boolean} [keepOverrides] Keep overrides while replacing the game layer.
 */
function replaceGameLayer(entity, imported, keepOverrides = false) {
  Object.keys(entity.values).forEach((key) => {
    if (key in imported) return;
    const v = entity.values[key];
    delete v.game;
    if (!('override' in v)) delete entity.values[key];
  });
  Object.entries(imported).forEach(([key, value]) => {
    const override = entity.values[key]?.override;
    entity.values[key] = keepOverrides && override !== undefined ? { game: cloneData(value), override } : { game: cloneData(value) };
  });
}

/**
 * Apply an account export to a profile, or create one from it.
 *
 * Planets are matched by game id, then - for a planet entered by hand - by
 * coordinates, a position alone only when it is unambiguous (uniqueCoordsMatch).
 * A planet that had a game id and is missing from the export is
 * removed: the export is the truth about the account. A hand-entered planet with
 * no match is kept. Moons follow the same rules.
 *
 * @param {?Profile} existing
 * @param {AccountExport} data
 * @param {{universe?: ?ProfileUniverse, newId?: () => string, keepOverrides?: boolean}} [opts]
 *   `universe` is the one the player picked, used when the export has none.
 * @returns {{profile: Profile, summary: ImportSummary}}
 */
function importAccountExport(existing, data, opts = {}) {
  const newId = opts.newId || newProfileId;
  const created = !existing;
  const profile = existing ? cloneData(existing) : createProfile({ id: newId(), label: data.playerName || String(data.playerId) });

  const renamed = followPlayerName(profile, data);
  profile.playerId = data.playerId;
  profile.importedAt = data.exportedAt;
  if (data.universe) {
    profile.universe = { ...data.universe };
    profile.universeLocked = true;
  } else if (!profile.universe && opts.universe) {
    profile.universe = { ...opts.universe };
    profile.universeLocked = false;
  }
  replaceGameLayer(profile.account, data.account, opts.keepOverrides);

  const planets = applyBodies(profile.planets, data.planets, newId, opts.keepOverrides);
  profile.planets = planets.bodies;

  /** @type {Map<number, string>} */
  const planetIdByGameId = new Map();
  profile.planets.forEach((p) => { if (p.gameId !== null) planetIdByGameId.set(p.gameId, p.id); });
  const moons = applyBodies(profile.moons, data.moons, newId, opts.keepOverrides);
  profile.moons = /** @type {ProfileMoon[]} */ (moons.bodies);
  profile.moons.forEach((moon) => {
    const source = data.moons.find((m) => m.gameId !== null && m.gameId === moon.gameId);
    const linked = source?.planetGameId ? planetIdByGameId.get(source.planetGameId) : undefined;
    // A moon new to the profile was created as a planet and has no planetId yet.
    moon.planetId = linked ?? moon.planetId ?? null;
  });
  profile.moons = orderMoonsByPlanets(profile.planets, profile.moons);
  mergeBodyResources(profile, data.resources);

  return { profile, summary: { created, planets: planets.counts, moons: moons.counts, renamed } };
}

/**
 * Keep the label in step with the account's name in the game. The label is
 * renamed only while it is still the name the last import gave - one the
 * player typed is theirs and stays. A profile stored before the name was kept
 * cannot tell, so it is renamed only when its label is the player id, the
 * label an export without a name leaves. An export without a name changes
 * nothing: an empty name is an unknown one.
 *
 * @param {Profile} profile Changed in place; its playerId is still the old one.
 * @param {AccountExport} data
 * @returns {?ProfileRename}
 */
function followPlayerName(profile, data) {
  const name = data.playerName;
  if (!name) return null;
  const automatic = typeof profile.playerName === 'string'
    ? profile.label === profile.playerName
    : profile.label === String(data.playerId);
  profile.playerName = name;
  if (!automatic || profile.label === name) return null;
  const renamed = { from: profile.label, to: name };
  profile.label = name;
  return renamed;
}

/**
 * Take the resource readings that are newer than the profile's, body by body,
 * and drop the readings of bodies the profile no longer has (or has only as
 * entered by hand, without a game id). Run after the bodies of an applied
 * export, this drops the bodies the export no longer lists.
 *
 * @param {Profile} profile Changed in place.
 * @param {BodyResourcesMap|undefined} incoming
 * @returns {boolean} True when the profile's readings changed.
 */
function mergeBodyResources(profile, incoming) {
  const current = isPlainObject(profile.resources) ? profile.resources : {};
  const known = new Set([...profile.planets, ...profile.moons].filter((b) => b.gameId !== null).map((b) => String(b.gameId)));
  /** @type {BodyResourcesMap} */
  const next = {};
  let changed = false;
  Object.entries(current).forEach(([id, reading]) => {
    if (known.has(id)) next[id] = reading;
    else changed = true;
  });
  Object.entries(incoming || {}).forEach(([id, reading]) => {
    if (!known.has(id) || (next[id] && next[id].at >= reading.at)) return;
    next[id] = { ...reading };
    changed = true;
  });
  profile.resources = next;
  return changed;
}

/**
 * The resources last reported on a planet or moon of the profile.
 *
 * @param {Profile} profile
 * @param {string} bodyId Our own id of the planet or moon, as the body selects hold it.
 * @returns {?BodyResources} A copy; null for a body without a game id or a reading.
 */
function profileBodyResources(profile, bodyId) {
  const body = profile.planets.find((p) => p.id === bodyId) || profile.moons.find((m) => m.id === bodyId);
  const gameId = body?.gameId ?? null;
  if (gameId === null || !isPlainObject(profile.resources)) return null;
  const reading = profile.resources[String(gameId)];
  return reading ? { ...reading } : null;
}

/** A resource reading older than this is shown as stale. */
const RESOURCE_READING_STALE_MS = 60 * 60 * 1000;

/**
 * Whether a resource reading is old enough to warn about.
 *
 * @param {number} at When it was read, in Unix milliseconds.
 * @param {number} now
 * @returns {boolean}
 */
function isResourceReadingStale(at, now) {
  return now - at > RESOURCE_READING_STALE_MS;
}

/**
 * What a calculator's resource fields last showed of the profile: whose body,
 * and the time of the reading - null when the body had none.
 *
 * @typedef {Object} ResourceFillShown
 * @property {string} profileId
 * @property {?string} bodyId
 * @property {?number} at
 */

/**
 * How a calculator's resource fields follow the profile shown:
 *   - 'replace': another profile or body than last time - every field takes
 *     the reading, whatever the player typed (a page load is one too);
 *   - 'refresh': the same body has a newer reading (a Sync) - only the fields
 *     the player left alone take it;
 *   - 'keep': nothing new for the fields;
 *   - 'none': no reading for the body - the fields are the calculator's, but
 *     for the ones still showing another body's reading (PfBodyResources).
 *
 * @param {?ResourceFillShown} shown What the fields showed last; null for nothing yet.
 * @param {string} profileId
 * @param {?string} bodyId Our own id of the body shown; null for none.
 * @param {?BodyResources} reading
 * @returns {'replace'|'refresh'|'keep'|'none'}
 */
function planResourceFill(shown, profileId, bodyId, reading) {
  if (!reading || bodyId === null) return 'none';
  if (shown?.profileId !== profileId || shown.bodyId !== bodyId) return 'replace';
  if (shown.at === null || reading.at > shown.at) return 'refresh';
  return 'keep';
}

/**
 * A profile from a backup file, about to replace the stored one of the same
 * id, keeping the stored one's resource readings: the file carries none
 * (withoutResources), and saving replaces the whole profile. The readings of
 * bodies the restored profile does not have are dropped.
 *
 * @param {Profile} restored
 * @param {?Profile} stored
 * @returns {Profile} A shallow copy of `restored`; `restored` itself is not changed.
 */
function keepBodyResources(restored, stored) {
  const copy = { ...restored };
  if (!isPlainObject(stored?.resources)) return copy;
  delete copy.resources;
  mergeBodyResources(copy, stored.resources);
  return copy;
}

// ---------------------------------------------------------------------------
// Sync: what PfG Companion delivers
// ---------------------------------------------------------------------------

/**
 * The Sync rule of ADR-0004: an export is applied only when it was made after
 * the export the profile's game layer came from. A profile with no import time
 * takes any export, and so does a time that does not read as a date. An export
 * that carried no time reads as the epoch (normalizeAccountExport), so it is
 * never newer than a real import.
 *
 * @param {AccountExport} data
 * @param {Profile} profile
 * @returns {boolean}
 */
function isNewerExport(data, profile) {
  if (profile.importedAt === null) return true;
  const exported = Date.parse(typeof data.exportedAt === 'string' ? data.exportedAt : '');
  const imported = Date.parse(profile.importedAt);
  if (Number.isNaN(exported) || Number.isNaN(imported)) return true;
  return exported > imported;
}

/**
 * An OGame account as Companion and the profiles tell one from another: the
 * player id and the universe, the way a profile is matched
 * (findProfileForExport). An export, an ignore-list entry and a profile index
 * entry all carry it.
 *
 * @typedef {Object} CompanionAccount
 * @property {number} playerId
 * @property {?ProfileUniverse} universe
 */

/**
 * An account the player asked not to be offered again, on the ignore list
 * (`pfg_companion_ignored`). The name is a snapshot from the export, so the
 * manager can still name the account after Companion has moved on to other
 * exports.
 *
 * @typedef {Object} CompanionIgnoredEntry
 * @property {number} playerId
 * @property {ProfileUniverse} universe
 * @property {string} playerName
 * @property {string} ignoredAt
 */

/**
 * What PfG Companion hands the page: the exports it collected, one or more per
 * account. Only version 1 is understood (planCompanionSync).
 *
 * @typedef {Object} CompanionPayload
 * @property {number} version
 * @property {unknown[]} exports
 */

/**
 * @param {unknown} raw
 * @returns {?CompanionIgnoredEntry} Null for anything that is not an entry.
 */
function readCompanionIgnoredEntry(raw) {
  if (!isPlainObject(raw)) return null;
  const universe = readProfileUniverse(raw.universe);
  const playerId = finiteOrNull(raw.playerId);
  if (universe === null || playerId === null) return null;
  return {
    playerId,
    universe,
    playerName: typeof raw.playerName === 'string' ? raw.playerName : '',
    ignoredAt: typeof raw.ignoredAt === 'string' ? raw.ignoredAt : '',
  };
}

/**
 * Whether two exports, ignore-list entries or index entries speak of one account.
 *
 * @param {CompanionAccount} a
 * @param {CompanionAccount} b
 * @returns {boolean}
 */
function sameCompanionAccount(a, b) {
  return a.playerId === b.playerId && sameUniverse(a.universe, b.universe);
}

/**
 * Put an item into a list that holds one per account: it joins the list, or
 * replaces the item of its account when its time is later (isLaterThan).
 *
 * @template {CompanionAccount} T
 * @param {T[]} list Changed in place.
 * @param {T} item
 * @param {(item: T) => ?string} timeOf
 */
function keepLatestPerAccount(list, item, timeOf) {
  const at = list.findIndex((old) => sameCompanionAccount(old, item));
  if (at === -1) list.push(item);
  else if (isLaterThan(timeOf(item), timeOf(list[at]))) list[at] = item;
}

/**
 * The union of two ignore lists, by account; when both have an entry for one,
 * the one ignored more recently wins, so restoring a backup never brings back
 * an account ignored after the file was made.
 *
 * @param {CompanionIgnoredEntry[]} stored
 * @param {CompanionIgnoredEntry[]} incoming
 * @returns {CompanionIgnoredEntry[]} Copies; neither list is changed.
 */
function mergeCompanionIgnored(stored, incoming) {
  /** @param {CompanionIgnoredEntry} e */
  const copy = (e) => ({ ...e, universe: { ...e.universe } });
  const merged = stored.map(copy);
  incoming.forEach((entry) => keepLatestPerAccount(merged, copy(entry), (e) => e.ignoredAt));
  return merged;
}

/**
 * @typedef {Object} CompanionSyncPlan
 * @property {Profile[]} updates Profiles to save, each with the newer export or only newer resources applied.
 * @property {AccountExport[]} candidates Exports of accounts that have no profile and are not ignored.
 * @property {AccountExport[]} ignored Exports of accounts that have no profile and are on the ignore list.
 * @property {ProfileRename[]} renamed The labels the updates changed, one per profile.
 * @property {?CompanionIgnoredEntry[]} ignoredRefreshed The ignore list with the
 *   names the newest exports carry; null when no name changed.
 */

/**
 * Decide what a PfG Companion payload changes. Each export that names its
 * universe either updates the profile of its account and universe - when it is
 * newer (isNewerExport), keeping the overrides - or, for an account without a
 * profile, becomes a candidate: one to offer the player, or an ignored one,
 * which is only reported so the manager can create its profile after all. An
 * account named by several exports is offered once, from its newest export.
 * The resources on the bodies are taken body by body whenever they are newer,
 * the export newer or not (mergeBodyResources). The exports are taken in
 * order, so a second export of one account is compared with the first one's
 * result. An ignored account renamed in the game gets the new name on its
 * ignore-list entry. Nothing is saved here.
 *
 * @param {*} payload What Companion handed over: `{version: 1, exports: [...]}`.
 * @param {Array<{id: string, universe: ?ProfileUniverse, playerId: ?number}>} index
 * @param {(id: string) => ?Profile} load A fresh copy of a stored profile.
 * @param {CompanionIgnoredEntry[]} [ignoredEntries] Accounts the player asked not to be offered again.
 * @returns {?CompanionSyncPlan} Null for a payload this site does not understand.
 */
function planCompanionSync(payload, index, load, ignoredEntries = []) {
  if (payload?.version !== 1 || !Array.isArray(payload.exports)) return null;
  /** @type {Map<string, Profile>} */
  const updated = new Map();
  /** @type {AccountExport[]} */
  const candidates = [];
  /** @type {AccountExport[]} */
  const ignored = [];
  /** @type {Map<string, ProfileRename>} */
  const renames = new Map();
  payload.exports.forEach((/** @type {unknown} */ raw) => {
    const parsed = parseAccountExport(JSON.stringify(raw));
    const data = parsed.data;
    if (!parsed.ok || !data?.universe) return;
    const existingId = findProfileForExport(index, data.playerId, data.universe);
    const existing = existingId ? updated.get(existingId) || load(existingId) : null;
    if (!existing) {
      const onIgnoreList = ignoredEntries.some((entry) => sameCompanionAccount(entry, data));
      // One export per account, the newest, whatever order the payload lists them in.
      keepLatestPerAccount(onIgnoreList ? ignored : candidates, data, (d) => d.exportedAt);
      return;
    }
    if (isNewerExport(data, existing)) {
      const { profile, summary } = importAccountExport(existing, data, { keepOverrides: true });
      updated.set(profile.id, profile);
      // Two exports of one account renaming it twice are one rename, from the first name.
      if (summary.renamed) renames.set(profile.id, { from: renames.get(profile.id)?.from ?? summary.renamed.from, to: summary.renamed.to });
      return;
    }
    // Companion reads the resources off every game page, so an export whose
    // game layer is not newer can still carry newer resources.
    const profile = cloneData(existing);
    if (mergeBodyResources(profile, data.resources)) updated.set(profile.id, profile);
  });
  const renamed = [...renames.values()].filter((r) => r.from !== r.to);
  return { updates: [...updated.values()], candidates, ignored, renamed, ignoredRefreshed: refreshIgnoredNames(ignoredEntries, ignored) };
}

/**
 * The ignore list with each entry's name taken from its account's export, when
 * the export names it and the name differs.
 *
 * @param {CompanionIgnoredEntry[]} entries
 * @param {AccountExport[]} exports One per account.
 * @returns {?CompanionIgnoredEntry[]} A new list, `entries` unchanged; null when no name changed.
 */
function refreshIgnoredNames(entries, exports) {
  let changed = false;
  const refreshed = entries.map((entry) => {
    const name = exports.find((data) => sameCompanionAccount(entry, data))?.playerName;
    if (!name || name === entry.playerName) return entry;
    changed = true;
    return { ...entry, universe: { ...entry.universe }, playerName: name };
  });
  return changed ? refreshed : null;
}

/**
 * @param {ProfilePlanet[]} current
 * @param {ExportBody[]} imported
 * @param {() => string} newId
 * @param {boolean} [keepOverrides]
 * @returns {{bodies: ProfilePlanet[], counts: ImportCounts}}
 */
function applyBodies(current, imported, newId, keepOverrides = false) {
  const counts = { added: 0, updated: 0, removed: 0 };
  /** @type {Set<ProfilePlanet>} */
  const matched = new Set();
  /** @type {ProfilePlanet[]} The bodies of the export, in its order. */
  const ordered = [];

  imported.forEach((body) => {
    const target = current.find((p) => !matched.has(p) && p.gameId !== null && p.gameId === body.gameId)
      || uniqueCoordsMatch(current.filter((p) => !matched.has(p) && p.gameId === null), body.coords, imported);
    if (target) {
      matched.add(target);
      target.gameId = body.gameId;
      target.name = body.name || target.name;
      target.coords = body.coords || target.coords;
      replaceGameLayer(target, body.values, keepOverrides);
      ordered.push(target);
      counts.updated++;
    } else {
      const planet = createPlanet({ id: newId(), gameId: body.gameId, name: body.name, coords: body.coords });
      replaceGameLayer(planet, body.values, keepOverrides);
      ordered.push(planet);
      counts.added++;
    }
  });

  // A hand-entered body the export did not match stays, after the game's ones.
  const handEntered = current.filter((p) => {
    if (matched.has(p)) return false;
    if (p.gameId === null) return true;
    counts.removed++;
    return false;
  });
  handEntered.sort(byCoords);
  return { bodies: ordered.concat(handEntered), counts };
}

/**
 * Bodies by coordinates, unknown ones last. The order the site falls back to
 * when the game's own is not known - the player may sort their planets in the
 * game any way they like (exportPlanetOrder).
 *
 * @param {{coords: ?ProfileCoords}} a
 * @param {{coords: ?ProfileCoords}} b
 */
function byCoords(a, b) {
  /** @param {{coords: ?ProfileCoords}} p */
  const key = (p) => {
    const c = p.coords;
    if (typeof c?.galaxy !== 'number' || typeof c.system !== 'number' || typeof c.position !== 'number') return Number.MAX_SAFE_INTEGER;
    return (c.galaxy * 1000 + c.system) * 100 + c.position;
  };
  return key(a) - key(b);
}

/**
 * Bodies by a rank, those without one (-1) after them by coordinates.
 *
 * @template {{coords: ?ProfileCoords}} T
 * @param {T[]} bodies
 * @param {(body: T) => number} rank
 * @returns {T[]} A new array.
 */
function orderByRank(bodies, rank) {
  const ranked = bodies.map((body) => ({ body, rank: rank(body) }));
  ranked.sort((a, b) => {
    if (a.rank >= 0 && b.rank >= 0) return a.rank - b.rank;
    if (a.rank >= 0) return -1;
    if (b.rank >= 0) return 1;
    return byCoords(a.body, b.body);
  });
  return ranked.map((r) => r.body);
}

/**
 * The moons in the order of their planets; a moon whose planet the profile does
 * not know comes last, by coordinates.
 *
 * @param {ProfilePlanet[]} planets
 * @param {ProfileMoon[]} moons
 * @returns {ProfileMoon[]} A new array.
 */
function orderMoonsByPlanets(planets, moons) {
  return orderByRank(moons, (m) => (m.planetId === null ? -1 : planets.findIndex((p) => p.id === m.planetId)));
}

// ---------------------------------------------------------------------------
// Merging two profiles
// ---------------------------------------------------------------------------

/**
 * Merge a second profile into a primary one (ADR-0004). The primary keeps every
 * value it has, game or override; from the second it takes only the keys it
 * lacks, and the universe, player id and game name when it has none. Planets are matched by
 * coordinates - a planet carried over from production knows only its position,
 * which counts only when it is unambiguous (uniqueCoordsMatch) - then by a
 * unique case-insensitive name. The second profile's unmatched
 * planets and moons are added.
 *
 * @param {Profile} primary
 * @param {Profile} secondary
 * @returns {Profile} A new profile with the primary's id.
 */
function mergeProfiles(primary, secondary) {
  const result = cloneData(primary);
  const other = cloneData(secondary);
  if (!result.universe && other.universe) {
    result.universe = other.universe;
    result.universeLocked = other.universeLocked;
  }
  if (result.playerId === null) result.playerId = other.playerId;
  if (typeof result.playerName !== 'string' && typeof other.playerName === 'string') result.playerName = other.playerName;
  if (result.importedAt === null) result.importedAt = other.importedAt;
  fillMissing(result.account, other.account);

  /** @type {Map<string, string>} the second profile's planet id to the merged one */
  const planetIds = new Map();
  result.planets = mergeBodies(result.planets, other.planets, planetIds);
  result.moons = /** @type {ProfileMoon[]} */ (mergeBodies(result.moons, other.moons, new Map()));
  result.moons.forEach((moon) => {
    if (moon.planetId && planetIds.has(moon.planetId)) moon.planetId = planetIds.get(moon.planetId) || null;
  });
  result.moons = orderMoonsByPlanets(result.planets, result.moons);
  // The resources are no value to keep: per body the newer reading wins.
  if (other.resources || result.resources) mergeBodyResources(result, other.resources);
  return result;
}

/**
 * @param {{values: LayeredValues}} target
 * @param {{values: LayeredValues}} source
 */
function fillMissing(target, source) {
  Object.entries(source.values).forEach(([key, value]) => {
    if (!(key in target.values)) target.values[key] = value;
  });
}

/**
 * @param {ProfilePlanet[]} primary
 * @param {ProfilePlanet[]} secondary
 * @param {Map<string, string>} idMap Filled with secondary id to merged id.
 * @returns {ProfilePlanet[]}
 */
function mergeBodies(primary, secondary, idMap) {
  /** @type {Set<ProfilePlanet>} */
  const used = new Set();
  /** @type {ProfilePlanet[]} The second profile's bodies the primary lacks. */
  const added = [];
  secondary.forEach((body) => {
    let target = uniqueCoordsMatch(primary.filter((p) => !used.has(p)), body.coords, secondary);
    if (!target && body.name) {
      const sameName = primary.filter((p) => !used.has(p) && p.name.toLowerCase() === body.name.toLowerCase());
      if (sameName.length === 1) target = sameName[0];
    }
    if (target) {
      used.add(target);
      fillMissing(target, body);
      if (!target.coords) target.coords = body.coords;
      idMap.set(body.id, target.id);
    } else {
      added.push(body);
      idMap.set(body.id, body.id);
    }
  });
  // The primary keeps its order - the game's, when it was imported.
  added.sort(byCoords);
  return primary.concat(added);
}

// ---------------------------------------------------------------------------
// Reading a stored profile, and the profile file
// ---------------------------------------------------------------------------

/**
 * Validate a profile read back from storage or a file.
 *
 * @param {unknown} raw
 * @returns {?Profile} Null when it is not a profile of a format we know.
 */
function readProfile(raw) {
  if (!isPlainObject(raw) || raw.formatVersion !== PROFILE_FORMAT_VERSION) return null;
  if (typeof raw.id !== 'string' || !raw.id || !isPlainObject(raw.account) || !isPlainObject(raw.account.values)) return null;
  if (!Array.isArray(raw.planets) || !Array.isArray(raw.moons)) return null;
  // The resources are a convenience: a broken map is dropped, not the profile.
  if ('resources' in raw && !isPlainObject(raw.resources)) delete raw.resources;
  // So is the game name: without it the label only stops following the game.
  if ('playerName' in raw && raw.playerName !== null && typeof raw.playerName !== 'string') delete raw.playerName;
  return /** @type {Profile} */ (raw);
}

/**
 * A profile as the backup file carries it: without the resources on its
 * bodies, which are hours old by the time a backup is restored.
 *
 * @param {Profile} profile
 * @returns {Profile} A shallow copy; the profile itself is not changed.
 */
function withoutResources(profile) {
  const copy = { ...profile };
  delete copy.resources;
  return copy;
}

/**
 * The key of a universe's entry in the shared universe cache (ADR-0004): its
 * settings as the game reports them and the ones the player picked instead.
 *
 * @param {ProfileUniverse} universe
 */
function universeCacheKey(universe) {
  return 'pfg_universe_' + universe.country + '_' + universe.number;
}

/** How long a universe's settings are reused before they are fetched again. */
const UNIVERSE_SETTINGS_TTL_MS = 24 * 3600 * 1000;

/**
 * A universe's entry in the shared universe cache: `at`, when the settings
 * were fetched (0 for an entry a backup created, which is already stale); the
 * game's value of each setting under its key, null when the game did not say;
 * and in `overrides` the value the player picked instead, if any. `override`
 * is the speed's choice as it was kept before there were others - only ever
 * read, never written.
 *
 * @typedef {{at: number, overrides?: Record<string, *>, override?: *, [setting: string]: *}} UniverseEntry
 */

/**
 * @param {*} value As the answer has it, usually a string.
 * @returns {?number} A whole number above zero, or null.
 */
function universeCount(value) {
  const n = Number.parseInt(value, 10);
  return n > 0 ? n : null;
}

/**
 * @param {*} value A fraction, as "0.3".
 * @returns {?number} The share in percent, or null for anything but a number of at least zero.
 */
function universeShare(value) {
  const factor = Number.parseFloat(value);
  return Number.isFinite(factor) && factor >= 0 ? Math.round(factor * 100) : null;
}

/**
 * @param {*} value "1", "0" or an empty element.
 * @returns {?boolean} Null only when the key is missing altogether.
 */
function universeFlag(value) {
  return typeof value === 'string' ? value === '1' : null;
}

/**
 * How each universe setting is read from a `serverdata` answer; null when the
 * answer does not hold it.
 *
 * @type {Record<string, (data: Record<string, any>) => *>}
 */
const UNIVERSE_SETTING_PARSERS = {
  speed: (data) => universeCount(data.speed),
  debrisFactor: (data) => universeShare(data.debrisFactor),
  // The game sends "1" or an empty element, so only a missing key is unknown.
  deuteriumInDebris: (data) => universeFlag(data.deuteriumInDebris),
  // Kept as the value of expeditions' #highTop option the score falls into, not as the score.
  topScore: (data) => expeditionHighTop(data.topScore),
  debrisFactorDef: (data) => universeShare(data.debrisFactorDef),
  systems: (data) => universeCount(data.systems),
  // The game sends "1" or "0" - flight compares it with 1 the same way.
  donutSystem: (data) => universeFlag(data.donutSystem),
};

/**
 * Every setting a `serverdata` answer gives, whichever field asked for it.
 *
 * @param {Record<string, any>} data
 * @returns {Record<string, *>}
 */
function parseUniverseSettings(data) {
  /** @type {Record<string, *>} */
  const settings = {};
  Object.entries(UNIVERSE_SETTING_PARSERS).forEach(([key, parse]) => { settings[key] = parse(data); });
  return settings;
}

/**
 * A universe cache entry as stored, with the speed's old lone choice moved
 * into `overrides`. Nothing is written back: the entry is rewritten in the
 * new shape the next time it is saved.
 *
 * @param {unknown} raw The parsed stored value.
 * @returns {?UniverseEntry} Null for anything without a fetch time.
 */
function readUniverseEntry(raw) {
  if (!isPlainObject(raw) || typeof raw.at !== 'number') return null;
  /** @type {UniverseEntry} */
  const entry = { ...raw, at: raw.at };
  if ('override' in entry) {
    entry.overrides = { speed: entry.override, ...entry.overrides };
    delete entry.override;
  }
  return entry;
}

/**
 * True when the entry can be used without asking the server again: it was
 * fetched less than a day ago, and the setting was already part of the fetch.
 *
 * @param {?UniverseEntry} entry
 * @param {string} key
 * @param {number} now
 */
function isUniverseEntryFresh(entry, key, now) {
  return !!entry && now - entry.at < UNIVERSE_SETTINGS_TTL_MS && key in entry;
}

/**
 * One setting of a cache entry as the two layers of a profile value: the
 * game's value, when it is known, and the player's choice, when they made one.
 *
 * @param {?UniverseEntry} entry
 * @param {string} key
 * @returns {LayeredValue}
 */
function universeLayer(entry, key) {
  /** @type {LayeredValue} */
  const layer = {};
  if (!entry) return layer;
  const game = entry[key];
  if (game !== undefined && game !== null) layer.game = game;
  if (entry.overrides && key in entry.overrides) layer.override = entry.overrides[key];
  return layer;
}

/**
 * The value a field should show: the player's choice, otherwise the game's.
 *
 * @param {?UniverseEntry} entry
 * @param {string} key
 * @returns {*} Null when neither is known.
 */
function universeValue(entry, key) {
  return getProfileValue({ values: { [key]: universeLayer(entry, key) } }, key, null);
}

/**
 * Remember the player's choice of a setting, by the rule of a profile value:
 * a choice equal to the game's value is dropped. Without a game value there is
 * nothing to compare with, and nothing is kept.
 *
 * @param {UniverseEntry} entry Changed in place.
 * @param {string} key
 * @param {*} chosen
 * @returns {boolean} True when the entry changed.
 */
function setUniverseChoice(entry, key, chosen) {
  const holder = { values: { [key]: universeLayer(entry, key) } };
  if (!('game' in holder.values[key]) || !setProfileValue(holder, key, chosen)) return false;
  const layer = holder.values[key];
  const overrides = { ...entry.overrides };
  if ('override' in layer) overrides[key] = layer.override;
  else delete overrides[key];
  entry.overrides = overrides;
  return true;
}

/**
 * A backup's choices put over an entry's own. A universe never fetched on this
 * device gets an entry that is already stale, so its game values are fetched
 * the first time it is shown.
 *
 * @param {?UniverseEntry} entry
 * @param {Record<string, *>} overrides
 * @returns {UniverseEntry}
 */
function mergeUniverseChoices(entry, overrides) {
  const base = entry || { at: 0 };
  return { ...base, overrides: { ...base.overrides, ...overrides } };
}

/**
 * The settings the player picked that differ from the game's, as rows of the
 * reset dialog. A choice is shared by every profile of the universe, so it
 * counts for each of them.
 *
 * @param {?UniverseEntry} entry
 * @returns {ProfileOverride[]}
 */
function listUniverseOverrides(entry) {
  if (!entry?.overrides) return [];
  /** @type {ProfileOverride[]} */
  const list = [];
  Object.keys(entry.overrides).forEach((key) => {
    const layer = universeLayer(entry, key);
    if (pfMarkState(layer, true).differs) list.push({ kind: 'universe', entityId: null, key, game: layer.game, override: layer.override });
  });
  return list;
}

/**
 * Drop the player's choices of the listed settings, back to the game's.
 *
 * @param {UniverseEntry} entry Changed in place.
 * @param {string[]} keys
 * @returns {number} How many choices were dropped.
 */
function resetUniverseChoices(entry, keys) {
  const overrides = { ...entry.overrides };
  const count = keys.filter((key) => key in overrides).length;
  if (count === 0) return 0;
  keys.forEach((key) => { delete overrides[key]; });
  entry.overrides = overrides;
  return count;
}

/**
 * How a field is marked: bound when its value has a game layer to compare
 * with and marks are wanted at all, differing when the value set on top of
 * that layer is not the game's.
 *
 * @param {LayeredValue|undefined} layer
 * @param {boolean} enabled False drops every mark.
 * @returns {{bound: boolean, differs: boolean, game: *}} `game` is null when not bound.
 */
function pfMarkState(layer, enabled) {
  if (!enabled || !layer || !('game' in layer)) return { bound: false, differs: false, game: null };
  return { bound: true, differs: 'override' in layer && !sameValue(layer.game, layer.override), game: layer.game };
}

/**
 * The universe settings the player picked instead of the game's, for one
 * universe. They are not in a profile, so the backup file carries them beside
 * the profiles; the game's own values are fetched again on any device.
 *
 * @typedef {Object} UniverseChoices
 * @property {ProfileUniverse} universe
 * @property {Record<string, number|boolean>} overrides
 */

/**
 * @param {unknown} raw
 * @returns {?UniverseChoices} Null for anything but a universe with at least one choice.
 */
function readUniverseChoices(raw) {
  if (!isPlainObject(raw) || !isPlainObject(raw.overrides)) return null;
  const universe = readProfileUniverse(raw.universe);
  if (universe === null) return null;
  /** @type {Record<string, number|boolean>} */
  const overrides = {};
  Object.entries(raw.overrides).forEach(([key, value]) => {
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) overrides[key] = value;
  });
  return Object.keys(overrides).length > 0 ? { universe, overrides } : null;
}

/**
 * The backup file: every profile given, in our own format but for the
 * resources on the bodies (withoutResources), the universe settings the
 * player picked for their universes, and the Companion ignore list, so a
 * restored device is not asked about accounts it has already refused.
 *
 * @param {Profile[]} profiles
 * @param {string} [exportedAt]
 * @param {UniverseChoices[]} [universes]
 * @param {CompanionIgnoredEntry[]} [companionIgnored]
 * @returns {string}
 */
function serializeProfilesFile(profiles, exportedAt = new Date().toISOString(), universes = [], companionIgnored = []) {
  return JSON.stringify({ pfgProfiles: PROFILE_FILE_VERSION, exportedAt, profiles: profiles.map((p) => withoutResources(p)), universes, companionIgnored }, null, 2);
}

/**
 * @typedef {Object} ProfilesFileResult
 * @property {boolean} ok
 * @property {Profile[]} [profiles]
 * @property {UniverseChoices[]} [universes] Empty for a file written before they were kept.
 * @property {CompanionIgnoredEntry[]} [companionIgnored] Empty for a file written before the ignore list was kept.
 * @property {'json'|'shape'|'version'} [reason]
 */

/**
 * @param {string} text
 * @returns {ProfilesFileResult}
 */
function parseProfilesFile(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.profiles) || !('pfgProfiles' in raw)) return { ok: false, reason: 'shape' };
  if (raw.pfgProfiles !== PROFILE_FILE_VERSION) return { ok: false, reason: 'version' };
  // Resources a hand-edited file carries are ignored, as the backup never writes them.
  const profiles = raw.profiles.map(readProfile).map((p) => p && withoutResources(p));
  if (profiles.includes(null)) return { ok: false, reason: 'version' };
  // The universe choices are a bonus: a broken entry is dropped, not the file.
  const universes = (Array.isArray(raw.universes) ? raw.universes : []).map(readUniverseChoices).filter((u) => u !== null);
  // So is the ignore list.
  const companionIgnored = (Array.isArray(raw.companionIgnored) ? raw.companionIgnored : []).map((e) => readCompanionIgnoredEntry(e)).filter((e) => e !== null);
  return { ok: true, profiles: /** @type {Profile[]} */ (profiles), universes: /** @type {UniverseChoices[]} */ (universes), companionIgnored };
}

/**
 * Plan restoring a profile file into the stored profiles: which ids are new
 * and which collide. The page asks the player what to do with a collision.
 *
 * @param {string[]} storedIds
 * @param {Profile[]} incoming
 * @returns {{added: Profile[], conflicts: Profile[]}}
 */
function planProfilesRestore(storedIds, incoming) {
  const stored = new Set(storedIds);
  return {
    added: incoming.filter((p) => !stored.has(p.id)),
    conflicts: incoming.filter((p) => stored.has(p.id)),
  };
}

// ---------------------------------------------------------------------------
// Share link: one profile carried to another device in a URL fragment
// ---------------------------------------------------------------------------
//
// The fragment never reaches the server, a log or a Referer. Its value is
// `d2.` + base64url(deflate-raw(JSON)) or, where the browser cannot compress,
// `r2.` + base64url(UTF-8 JSON). The JSON is {pfp, k, profile, universes}: the
// profile without the resources on its bodies, as the backup file carries it,
// its value sets packed by SHARE_KEYS (the compact form, below), and the
// universe settings the player picked for that profile's universe. The links
// written before the compact form, `d1.`/`r1.` with every key named and no
// `k`, are still read.
//
// The link to copy is always that one URL. A QR code holds less than a camera
// can be trusted to read off a screen, so a payload too long for one code is
// cut into a series: `p1.<id>.<n>.<k>.<chunk>`, each part an ordinary link of
// its own. The page a part opens keeps it until the series is complete, and
// the page that receives the last part takes the profile.

/** Version of the share payload. Bump it with a reader for the old one. */
const SHARE_FORMAT_VERSION = 1;

/** The fragment key of a share link; base64url holds no `&`, `#` or `=`. */
const SHARE_FRAGMENT_KEY = 'pfp';

/**
 * The longest URL one QR code of a share carries: version 25, error correction
 * L, byte mode. Larger versions fit more but a phone camera reads them off a
 * screen unreliably, so a longer link becomes a series of codes. Lower it if a
 * phone cannot read a version-25 code; nothing else depends on the number.
 */
const QR_SINGLE_URL_LIMIT = 1273;

/** The longest series of QR codes offered; a longer one is the link's or the backup file's job. */
const QR_MAX_PARTS = 10;

/** How long the parts of an unfinished series are kept. */
const SHARE_PARTS_TTL_MS = 30 * 60 * 1000;

/** A part's id: 8 base64url characters, 6 random bytes. */
const SHARE_PART_ID = /^[\w-]{8}$/;

/** A part as its fragment value spells it: `p1.<id>.<n>.<k>.<chunk>`. */
const SHARE_PART_PATTERN = /^p1\.([\w-]{8})\.([1-9]\d?)\.([1-9]\d?)\.([\w.-]+)$/;

// The compact form (`d2.`/`r2.`): the value keys of the account, a planet and
// a moon are known in advance, so a share lists the game values in the order
// of SHARE_KEYS instead of naming every key, and the overrides by index.
//
// SHARE_KEYS ONLY GROWS AT ITS END. A link carries how many keys of each list
// its writer had (`k`), and a reader takes that many from its own copy - so a
// key moved, removed or inserted in the middle would hand every later value to
// the wrong key in links already sent. A key the code no longer writes keeps
// its place; a new one is appended. A key missing from the lists still travels,
// by name, in `x`. unit-tests/profiles-core.test.js holds a copy of the lists
// as they were and fails on anything but an append.
//
// The order: the keys every import writes first, the sparse ones (a few ships'
// and techs' life-form bonuses, the life-form techs of the four races) last,
// where an account or a body that lacks them is cut short.

/** @type {{account: string[], planet: string[], moon: string[]}} */
const SHARE_KEYS = {
  account: [
    'class', 'allianceClass', 'officer.commander', 'officer.admiral', 'officer.engineer',
    'officer.geologist', 'officer.technocrat', 'research.106', 'research.108', 'research.109',
    'research.110', 'research.111', 'research.113', 'research.114', 'research.115', 'research.117',
    'research.118', 'research.120', 'research.121', 'research.122', 'research.123', 'research.124',
    'research.199', 'species.701.level', 'species.702.level', 'species.703.level',
    'species.704.level', 'lf.prod.metal', 'lf.prod.crystal', 'lf.prod.deuterium', 'lf.prod.energy',
    'lf.expedition.resources', 'lf.expedition.ships', 'lf.expedition.fleetLoss',
    'lf.classBooster.1', 'lf.classBooster.2', 'lf.classBooster.3', 'lf.discovery', 'lf.crawler',
    'lf.phalanxRange', 'item.expeditionResources', 'rates', 'lf.ship.202.armor',
    'lf.ship.202.shield', 'lf.ship.202.cargo', 'lf.ship.202.speed', 'lf.ship.202.weapon',
    'lf.ship.202.fuel', 'lf.ship.203.armor', 'lf.ship.203.shield', 'lf.ship.203.cargo',
    'lf.ship.203.speed', 'lf.ship.203.weapon', 'lf.ship.203.fuel', 'lf.ship.204.armor',
    'lf.ship.204.shield', 'lf.ship.204.cargo', 'lf.ship.204.speed', 'lf.ship.204.weapon',
    'lf.ship.204.fuel', 'lf.ship.205.armor', 'lf.ship.205.shield', 'lf.ship.205.cargo',
    'lf.ship.205.speed', 'lf.ship.205.weapon', 'lf.ship.205.fuel', 'lf.ship.206.armor',
    'lf.ship.206.shield', 'lf.ship.206.cargo', 'lf.ship.206.speed', 'lf.ship.206.weapon',
    'lf.ship.206.fuel', 'lf.ship.207.armor', 'lf.ship.207.shield', 'lf.ship.207.cargo',
    'lf.ship.207.speed', 'lf.ship.207.weapon', 'lf.ship.207.fuel', 'lf.ship.208.armor',
    'lf.ship.208.shield', 'lf.ship.208.cargo', 'lf.ship.208.speed', 'lf.ship.208.weapon',
    'lf.ship.208.fuel', 'lf.ship.209.armor', 'lf.ship.209.shield', 'lf.ship.209.cargo',
    'lf.ship.209.speed', 'lf.ship.209.weapon', 'lf.ship.209.fuel', 'lf.ship.210.armor',
    'lf.ship.210.shield', 'lf.ship.210.cargo', 'lf.ship.210.speed', 'lf.ship.210.weapon',
    'lf.ship.210.fuel', 'lf.ship.211.armor', 'lf.ship.211.shield', 'lf.ship.211.cargo',
    'lf.ship.211.speed', 'lf.ship.211.weapon', 'lf.ship.211.fuel', 'lf.ship.213.armor',
    'lf.ship.213.shield', 'lf.ship.213.cargo', 'lf.ship.213.speed', 'lf.ship.213.weapon',
    'lf.ship.213.fuel', 'lf.ship.214.armor', 'lf.ship.214.shield', 'lf.ship.214.cargo',
    'lf.ship.214.speed', 'lf.ship.214.weapon', 'lf.ship.214.fuel', 'lf.ship.215.armor',
    'lf.ship.215.shield', 'lf.ship.215.cargo', 'lf.ship.215.speed', 'lf.ship.215.weapon',
    'lf.ship.215.fuel', 'lf.ship.218.armor', 'lf.ship.218.shield', 'lf.ship.218.cargo',
    'lf.ship.218.speed', 'lf.ship.218.weapon', 'lf.ship.218.fuel', 'lf.ship.219.armor',
    'lf.ship.219.shield', 'lf.ship.219.cargo', 'lf.ship.219.speed', 'lf.ship.219.weapon',
    'lf.ship.219.fuel', 'lf.cost.106.cost', 'lf.cost.106.time', 'lf.cost.108.cost',
    'lf.cost.108.time', 'lf.cost.109.cost', 'lf.cost.109.time', 'lf.cost.110.cost',
    'lf.cost.110.time', 'lf.cost.111.cost', 'lf.cost.111.time', 'lf.cost.113.cost',
    'lf.cost.113.time', 'lf.cost.114.cost', 'lf.cost.114.time', 'lf.cost.115.cost',
    'lf.cost.115.time', 'lf.cost.117.cost', 'lf.cost.117.time', 'lf.cost.118.cost',
    'lf.cost.118.time', 'lf.cost.120.cost', 'lf.cost.120.time', 'lf.cost.121.cost',
    'lf.cost.121.time', 'lf.cost.122.cost', 'lf.cost.122.time', 'lf.cost.123.cost',
    'lf.cost.123.time', 'lf.cost.124.cost', 'lf.cost.124.time', 'lf.cost.199.cost',
    'lf.cost.199.time', 'lf.cost.33.cost', 'lf.cost.33.time', 'lf.cost.11201.cost',
    'lf.cost.11201.time',
  ],
  planet: [
    'building.1', 'building.2', 'building.3', 'building.4', 'building.12', 'building.14',
    'building.15', 'building.21', 'building.22', 'building.23', 'building.24', 'building.31',
    'building.33', 'building.34', 'building.36', 'building.41', 'building.42', 'building.43',
    'building.44', 'ship.202', 'ship.203', 'ship.204', 'ship.205', 'ship.206', 'ship.207',
    'ship.208', 'ship.209', 'ship.210', 'ship.211', 'ship.212', 'ship.213', 'ship.214', 'ship.215',
    'ship.217', 'ship.218', 'ship.219', 'defense.401', 'defense.402', 'defense.403', 'defense.404',
    'defense.405', 'defense.406', 'defense.407', 'defense.408', 'defense.502', 'defense.503',
    'fields.used', 'fields.total', 'diameter', 'temperature.min', 'temperature.max', 'lf.race',
    'production.1', 'production.2', 'production.3', 'production.4', 'production.12',
    'production.212', 'production.217', 'booster.1', 'booster.2', 'booster.3', 'energyBooster',
    'lf.building.11101', 'lf.building.11102', 'lf.building.11103', 'lf.building.11104',
    'lf.building.11105', 'lf.building.11106', 'lf.building.11107', 'lf.building.11108',
    'lf.building.11109', 'lf.building.11110', 'lf.building.11111', 'lf.building.11112',
    'lf.research.11201', 'lf.research.11202', 'lf.research.11203', 'lf.research.11204',
    'lf.research.11205', 'lf.research.11206', 'lf.research.11207', 'lf.research.11208',
    'lf.research.11209', 'lf.research.11210', 'lf.research.11211', 'lf.research.11212',
    'lf.research.11213', 'lf.research.11214', 'lf.research.11215', 'lf.research.11216',
    'lf.research.11217', 'lf.research.11218', 'lf.building.12101', 'lf.building.12102',
    'lf.building.12103', 'lf.building.12104', 'lf.building.12105', 'lf.building.12106',
    'lf.building.12107', 'lf.building.12108', 'lf.building.12109', 'lf.building.12110',
    'lf.building.12111', 'lf.building.12112', 'lf.research.12201', 'lf.research.12202',
    'lf.research.12203', 'lf.research.12204', 'lf.research.12205', 'lf.research.12206',
    'lf.research.12207', 'lf.research.12208', 'lf.research.12209', 'lf.research.12210',
    'lf.research.12211', 'lf.research.12212', 'lf.research.12213', 'lf.research.12214',
    'lf.research.12215', 'lf.research.12216', 'lf.research.12217', 'lf.research.12218',
    'lf.building.13101', 'lf.building.13102', 'lf.building.13103', 'lf.building.13104',
    'lf.building.13105', 'lf.building.13106', 'lf.building.13107', 'lf.building.13108',
    'lf.building.13109', 'lf.building.13110', 'lf.building.13111', 'lf.building.13112',
    'lf.research.13201', 'lf.research.13202', 'lf.research.13203', 'lf.research.13204',
    'lf.research.13205', 'lf.research.13206', 'lf.research.13207', 'lf.research.13208',
    'lf.research.13209', 'lf.research.13210', 'lf.research.13211', 'lf.research.13212',
    'lf.research.13213', 'lf.research.13214', 'lf.research.13215', 'lf.research.13216',
    'lf.research.13217', 'lf.research.13218', 'lf.building.14101', 'lf.building.14102',
    'lf.building.14103', 'lf.building.14104', 'lf.building.14105', 'lf.building.14106',
    'lf.building.14107', 'lf.building.14108', 'lf.building.14109', 'lf.building.14110',
    'lf.building.14111', 'lf.building.14112', 'lf.research.14201', 'lf.research.14202',
    'lf.research.14203', 'lf.research.14204', 'lf.research.14205', 'lf.research.14206',
    'lf.research.14207', 'lf.research.14208', 'lf.research.14209', 'lf.research.14210',
    'lf.research.14211', 'lf.research.14212', 'lf.research.14213', 'lf.research.14214',
    'lf.research.14215', 'lf.research.14216', 'lf.research.14217', 'lf.research.14218',
  ],
  moon: [
    'building.1', 'building.2', 'building.3', 'building.4', 'building.12', 'building.14',
    'building.15', 'building.21', 'building.22', 'building.23', 'building.24', 'building.31',
    'building.33', 'building.34', 'building.36', 'building.41', 'building.42', 'building.43',
    'building.44', 'ship.202', 'ship.203', 'ship.204', 'ship.205', 'ship.206', 'ship.207',
    'ship.208', 'ship.209', 'ship.210', 'ship.211', 'ship.212', 'ship.213', 'ship.214', 'ship.215',
    'ship.217', 'ship.218', 'ship.219', 'defense.401', 'defense.402', 'defense.403', 'defense.404',
    'defense.405', 'defense.406', 'defense.407', 'defense.408', 'defense.502', 'defense.503',
    'fields.used', 'fields.total', 'diameter',
  ],
};

/**
 * Whether a stored value is the two layers and nothing else, which the compact
 * form can carry by position.
 *
 * @param {unknown} v
 */
function pfIsLayers(v) {
  return isPlainObject(v) && Object.keys(v).every((k) => k === 'game' || k === 'override');
}

/**
 * @typedef {Object} PackedShareValues
 * @property {Array<*>} g The game values by key position, up to the last key there.
 * @property {Array<*>} [o] The overrides: [position, value, position, value, …].
 * @property {number[]} [a] Runs of positions within `g` whose key is not there
 *   at all: [first, count, first, count, …]. The sparse keys (a life-form bonus of
 *   a few ships out of fifteen) leave long gaps, which a list of runs keeps short.
 * @property {number[]} [n] Positions within `g` whose key has no game value.
 * @property {Object<string, *>} [x] Keys outside the list, or not two layers, as they are.
 */

/**
 * @param {LayeredValues} values
 * @param {string[]} keys
 * @returns {PackedShareValues}
 */
function packShareValues(values, keys) {
  const index = new Map(keys.map((key, i) => [key, i]));
  /** @type {Object<string, *>} */
  const x = {};
  const present = new Set();
  Object.entries(values).forEach(([key, v]) => {
    const i = index.get(key);
    if (i === undefined || !pfIsLayers(v)) x[key] = v;
    else present.add(i);
  });
  const length = present.size > 0 ? Math.max(...present) + 1 : 0;
  /** @type {PackedShareValues} */
  const packed = { g: [] };
  /** @type {Array<*>} */
  const o = [];
  /** @type {number[]} */
  const a = [];
  /** @type {number[]} */
  const n = [];
  for (let i = 0; i < length; i++) {
    const v = values[keys[i]];
    // A position with no game value holds a 0, the cheapest filler.
    if (!present.has(i)) {
      a.push(i);
      packed.g.push(0);
      continue;
    }
    if ('game' in v) {
      packed.g.push(v.game);
    } else {
      n.push(i);
      packed.g.push(0);
    }
    if ('override' in v) o.push(i, v.override);
  }
  if (o.length > 0) packed.o = o;
  if (a.length > 0) packed.a = pfShareRuns(a);
  if (n.length > 0) packed.n = n;
  if (Object.keys(x).length > 0) packed.x = x;
  return packed;
}

/**
 * @param {number[]} positions Ascending.
 * @returns {number[]} [first, count, first, count, …]
 */
function pfShareRuns(positions) {
  /** @type {number[]} */
  const runs = [];
  positions.forEach((i) => {
    const last = runs.length - 2;
    if (last >= 0 && runs[last] + runs[last + 1] === i) runs[last + 1]++;
    else runs.push(i, 1);
  });
  return runs;
}

/**
 * @param {unknown} runs [first, count, first, count, …]
 * @param {number} length
 * @returns {?number[]} The positions, when every run is whole and below `length`.
 */
function pfShareFromRuns(runs, length) {
  if (runs === undefined) return [];
  if (!Array.isArray(runs) || runs.length % 2 !== 0) return null;
  /** @type {number[]} */
  const positions = [];
  for (let j = 0; j < runs.length; j += 2) {
    const [first, count] = [runs[j], runs[j + 1]];
    if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 1 || first + count > length) return null;
    for (let i = first; i < first + count; i++) positions.push(i);
  }
  return positions;
}

/**
 * @param {unknown} list
 * @param {number} length
 * @returns {?number[]} The positions, when every one is below `length`.
 */
function pfSharePositions(list, length) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  return list.every((i) => Number.isInteger(i) && i >= 0 && i < length) ? list : null;
}

/**
 * @param {unknown} packed
 * @param {string[]} keys The keys the link's writer had: a prefix of SHARE_KEYS.
 * @returns {?LayeredValues} Null when it is not a packed value set.
 */
function unpackShareValues(packed, keys) {
  if (!isPlainObject(packed) || !Array.isArray(packed.g) || packed.g.length > keys.length) return null;
  const g = packed.g;
  const absent = pfShareFromRuns(packed.a, g.length);
  const noGame = pfSharePositions(packed.n, g.length);
  const o = packed.o === undefined ? [] : packed.o;
  if (absent === null || noGame === null || !Array.isArray(o) || o.length % 2 !== 0) return null;
  if (packed.x !== undefined && !isPlainObject(packed.x)) return null;
  const skip = new Set(absent);
  const overrides = new Map();
  for (let j = 0; j < o.length; j += 2) {
    if (!Number.isInteger(o[j]) || o[j] < 0 || o[j] >= g.length || skip.has(o[j])) return null;
    overrides.set(o[j], o[j + 1]);
  }
  const bare = new Set(noGame);
  /** @type {LayeredValues} */
  const values = {};
  g.forEach((game, i) => {
    if (skip.has(i)) return;
    /** @type {{game?: *, override?: *}} */
    const v = {};
    if (!bare.has(i)) v.game = game;
    if (overrides.has(i)) v.override = overrides.get(i);
    values[keys[i]] = v;
  });
  return Object.assign(values, packed.x);
}

/**
 * @param {Profile} profile
 * @returns {Object<string, *>} The profile with its value sets packed.
 */
function packProfileShare(profile) {
  /** @param {{values: LayeredValues}} body @param {string[]} keys */
  const pack = (body, keys) => ({ ...body, values: packShareValues(body.values, keys) });
  return {
    ...profile,
    account: pack(profile.account, SHARE_KEYS.account),
    planets: profile.planets.map((p) => pack(p, SHARE_KEYS.planet)),
    moons: profile.moons.map((m) => pack(m, SHARE_KEYS.moon)),
  };
}

/**
 * The profile of a compact share with its value sets unpacked, for readProfile().
 *
 * @param {Object<string, *>} raw The share's JSON.
 * @returns {unknown} Null when the counts or a value set cannot be read.
 */
function unpackProfileShare(raw) {
  const k = raw.k;
  const parts = /** @type {const} */ (['account', 'planet', 'moon']);
  // A link from code with more keys than this page knows names values it cannot place.
  if (!Array.isArray(k) || k.length !== parts.length
    || !parts.every((part, i) => Number.isInteger(k[i]) && k[i] >= 0 && k[i] <= SHARE_KEYS[part].length)) return null;
  const p = raw.profile;
  if (!isPlainObject(p) || !isPlainObject(p.account) || !Array.isArray(p.planets) || !Array.isArray(p.moons)) return null;
  /**
   * @param {unknown} body
   * @param {string[]} keys
   */
  const unpack = (body, keys) => {
    const values = isPlainObject(body) ? unpackShareValues(body.values, keys) : null;
    return values === null || !isPlainObject(body) ? null : { ...body, values };
  };
  const account = unpack(p.account, SHARE_KEYS.account.slice(0, k[0]));
  const planets = p.planets.map((b) => unpack(b, SHARE_KEYS.planet.slice(0, k[1])));
  const moons = p.moons.map((b) => unpack(b, SHARE_KEYS.moon.slice(0, k[2])));
  if (account === null || planets.includes(null) || moons.includes(null)) return null;
  return { ...p, account, planets, moons };
}

/**
 * The share payload's JSON, in the compact form: the profile without the
 * resources on its bodies, its value sets packed by SHARE_KEYS.
 *
 * @param {Profile} profile
 * @param {UniverseChoices[]} [universes] The choices for the profile's universe.
 * @returns {string}
 */
function serializeProfileShare(profile, universes = []) {
  return JSON.stringify({
    pfp: SHARE_FORMAT_VERSION,
    k: [SHARE_KEYS.account.length, SHARE_KEYS.planet.length, SHARE_KEYS.moon.length],
    profile: packProfileShare(withoutResources(profile)),
    universes,
  });
}

/**
 * @typedef {Object} ProfileShareResult
 * @property {boolean} ok
 * @property {Profile} [profile]
 * @property {UniverseChoices[]} [universes]
 * @property {'json'|'shape'|'version'} [reason]
 */

/**
 * Read a share payload's JSON with the checks the backup file gets.
 *
 * @param {string} text
 * @returns {ProfileShareResult}
 */
function parseProfileShare(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!isPlainObject(raw) || !('pfp' in raw) || !('profile' in raw)) return { ok: false, reason: 'shape' };
  if (raw.pfp !== SHARE_FORMAT_VERSION) return { ok: false, reason: 'version' };
  // A share carries its counts of SHARE_KEYS when its value sets are packed;
  // the links written before the compact form name every key.
  const profile = readProfile('k' in raw ? unpackProfileShare(raw) : raw.profile);
  if (profile === null) return { ok: false, reason: 'version' };
  // A broken universe entry is dropped, not the profile (parseProfilesFile).
  const universes = (Array.isArray(raw.universes) ? raw.universes : []).map(readUniverseChoices).filter((u) => u !== null);
  return { ok: true, profile: withoutResources(profile), universes: /** @type {UniverseChoices[]} */ (universes) };
}

/**
 * base64url without padding, over btoa.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function pfB64UrlEncode(bytes) {
  // In slices: String.fromCharCode takes its arguments on the stack.
  const SLICE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += SLICE) {
    binary += String.fromCodePoint(...bytes.subarray(i, i + SLICE));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * @param {string} text base64url, padded or not.
 * @returns {?Uint8Array} Null when the text is not base64url.
 */
function pfB64UrlDecode(text) {
  if (!/^[\w-]*={0,2}$/.test(text)) return null;
  const bare = text.replaceAll('=', '');
  if (bare.length % 4 === 1) return null;
  const padded = bare.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (bare.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  // atob yields one char per byte, all below 256.
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.codePointAt(i) ?? 0;
  return bytes;
}

/**
 * Push bytes through a transform stream and collect what comes out.
 *
 * @param {Uint8Array} bytes
 * @param {{writable: WritableStream, readable: ReadableStream}} stream
 * @returns {Promise<Uint8Array>} Rejects when the stream fails.
 */
async function pfPipeBytes(bytes, stream) {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const readAll = async () => {
    /** @type {Uint8Array[]} */
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  };
  // Together, so a failure on either side rejects once and is never left unhandled.
  const [, out] = await Promise.all([writer.write(bytes).then(() => writer.close()), readAll()]);
  return out;
}

/**
 * The fragment value for a share payload's JSON: compressed where the browser
 * can, plain otherwise - and plain when compressing fails, as the link still works.
 *
 * @param {string} json
 * @returns {Promise<string>}
 */
async function encodeSharePayload(json) {
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'd2.' + pfB64UrlEncode(await pfPipeBytes(bytes, new CompressionStream('deflate-raw')));
    } catch {
      // Falls through to the uncompressed form.
    }
  }
  return 'r2.' + pfB64UrlEncode(bytes);
}

/** The payload tags a link may carry: deflated or raw, of the full (1) or the compact (2) form. */
const SHARE_PAYLOAD_TAGS = new Set(['d1.', 'r1.', 'd2.', 'r2.']);

/**
 * @typedef {Object} SharePayloadResult
 * @property {boolean} ok
 * @property {string} [text] The payload's JSON.
 * @property {'format'|'unsupported'|'corrupt'} [reason] `format`: not a payload
 *   we know; `unsupported`: compressed, and this browser cannot decompress;
 *   `corrupt`: the bytes do not decompress or decode.
 */

/**
 * @param {string} payload The fragment value: `d2.…`/`r2.…`, or `d1.…`/`r1.…` of an older link.
 * @returns {Promise<SharePayloadResult>}
 */
async function decodeSharePayload(payload) {
  const tag = String(payload).slice(0, 3);
  if (!SHARE_PAYLOAD_TAGS.has(tag)) return { ok: false, reason: 'format' };
  const bytes = pfB64UrlDecode(String(payload).slice(3));
  if (bytes === null || bytes.length === 0) return { ok: false, reason: 'format' };
  let raw = bytes;
  if (tag.startsWith('d')) {
    if (typeof DecompressionStream === 'undefined') return { ok: false, reason: 'unsupported' };
    try {
      raw = await pfPipeBytes(bytes, new DecompressionStream('deflate-raw'));
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(raw) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

/**
 * @param {string} payload
 * @returns {string} `pfp=…`, without the `#`.
 */
function buildShareFragment(payload) {
  return SHARE_FRAGMENT_KEY + '=' + payload;
}

/**
 * The share payload a URL fragment carries. The value is taken as it is -
 * base64url needs no decoding and is case-sensitive - and other `&`-separated
 * keys are ignored.
 *
 * @param {string} hash `location.hash`, with or without the `#`.
 * @returns {?string} Null when the fragment holds no share payload.
 */
function readShareFragment(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  for (const part of text.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === SHARE_FRAGMENT_KEY) return part.slice(eq + 1) || null;
  }
  return null;
}

/**
 * The fragment with the share payload taken out and any other key kept.
 *
 * @param {string} hash `location.hash`, with or without the `#`.
 * @returns {string} What is left, without the `#`; empty when nothing is.
 */
function withoutShareFragment(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  return text.split('&').filter((part) => part !== '' && part.split('=')[0] !== SHARE_FRAGMENT_KEY).join('&');
}

/**
 * Whether a URL fits in one QR code of a share (QR_SINGLE_URL_LIMIT bytes of UTF-8).
 *
 * @param {string} url
 */
function fitsQrCode(url) {
  return new TextEncoder().encode(url).length <= QR_SINGLE_URL_LIMIT;
}

/**
 * The fragments of the QR codes for a payload: the whole share link when it
 * fits one code, otherwise a series of parts of equal length, each of whose
 * URLs fits one.
 *
 * @param {string} payload `d2.…` or `r2.…`.
 * @param {string} prefixUrl Everything the URL holds before the fragment, `#` included.
 * @param {string} id The series id, 8 base64url characters.
 * @returns {?string[]} The fragments, without the `#`; null when the series
 *   would take more than QR_MAX_PARTS codes.
 */
function splitShareParts(payload, prefixUrl, id) {
  const whole = buildShareFragment(payload);
  const base = new TextEncoder().encode(prefixUrl).length;
  if (base + whole.length <= QR_SINGLE_URL_LIMIT) return [whole];
  for (let k = 2; k <= QR_MAX_PARTS; k++) {
    // The part numbered k has the longest head: n takes as many digits as k.
    const head = (n) => SHARE_FRAGMENT_KEY + '=p1.' + id + '.' + n + '.' + k + '.';
    const size = Math.ceil(payload.length / k);
    if (base + head(k).length + size <= QR_SINGLE_URL_LIMIT) {
      // The smallest k that fits leaves no part empty: with one part less
      // the same size would have held the whole payload.
      return Array.from({ length: k }, (_, i) => head(i + 1) + payload.slice(i * size, (i + 1) * size));
    }
  }
  return null;
}

/**
 * @typedef {Object} SharePart
 * @property {string} id
 * @property {number} n 1-based.
 * @property {number} k How many parts the series has.
 * @property {string} chunk
 */

/**
 * @param {string} value A fragment value.
 * @returns {?SharePart} Null when it is not a part of a series.
 */
function readSharePart(value) {
  const m = SHARE_PART_PATTERN.exec(String(value));
  if (!m) return null;
  const n = Number(m[2]);
  const k = Number(m[3]);
  if (n > k || k > QR_MAX_PARTS) return null;
  return { id: m[1], n, k, chunk: m[4] };
}

/**
 * The parts of a series received so far, as the page keeps them.
 *
 * @typedef {Object} SharePartsState
 * @property {string} id
 * @property {number} k
 * @property {Record<string, string>} parts The chunks, by part number.
 * @property {number} at When the last part came, in ms.
 */

/**
 * Validate a series read back from storage.
 *
 * @param {unknown} raw
 * @returns {?SharePartsState}
 */
function readSharePartsState(raw) {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || !SHARE_PART_ID.test(raw.id)) return null;
  if (!Number.isInteger(raw.k) || raw.k < 1 || raw.k > QR_MAX_PARTS) return null;
  if (typeof raw.at !== 'number' || !Number.isFinite(raw.at) || !isPlainObject(raw.parts)) return null;
  const k = raw.k;
  const entries = Object.entries(raw.parts);
  const valid = entries.every(([n, chunk]) => /^[1-9]\d?$/.test(n) && Number(n) <= k && typeof chunk === 'string' && /^[\w.-]+$/.test(chunk));
  return valid ? { id: raw.id, k, parts: Object.fromEntries(entries), at: raw.at } : null;
}

/**
 * Add a part to its series. The same part again changes nothing but the time.
 *
 * @param {?SharePartsState} state The series so far; null for its first part.
 * @param {SharePart} part
 * @param {number} now
 * @returns {?SharePartsState} A new state; null when the part does not belong
 *   to this series (another id, or another length under the same id).
 */
function addSharePart(state, part, now) {
  if (state !== null && (state.id !== part.id || state.k !== part.k)) return null;
  return { id: part.id, k: part.k, parts: { ...state?.parts, [part.n]: part.chunk }, at: now };
}

/**
 * @param {SharePartsState} state
 * @returns {?string} The payload once every part is there, null before.
 */
function assembleShareParts(state) {
  const chunks = [];
  for (let n = 1; n <= state.k; n++) {
    const chunk = state.parts[n];
    if (typeof chunk !== 'string') return null;
    chunks.push(chunk);
  }
  return chunks.join('');
}

/**
 * @param {SharePartsState} state
 * @returns {number} How many of the parts have come.
 */
function countShareParts(state) {
  return Object.keys(state.parts).length;
}

/**
 * The stored series to drop: unreadable, or untouched for SHARE_PARTS_TTL_MS.
 *
 * @param {Record<string, unknown>} all The stored series, by storage key.
 * @param {number} now
 * @returns {string[]} Their keys.
 */
function purgeStaleShareParts(all, now) {
  return Object.entries(all)
    .filter(([, raw]) => {
      const state = readSharePartsState(raw);
      return state === null || now - state.at > SHARE_PARTS_TTL_MS;
    })
    .map(([key]) => key);
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

/**
 * Rates as trade keeps them: metal and crystal per one deuterium.
 *
 * @param {number[]} rates [metal, crystal, deuterium] in metal units.
 * @returns {{md: number, cd: number}}
 */
function ratesToTrade(rates) {
  const [m, c, d] = rates;
  return { md: d / m, cd: d / c };
}

/**
 * @param {{md: number, cd: number}} trade
 * @returns {number[]} [metal, crystal, deuterium] in metal units.
 */
function ratesFromTrade(trade) {
  return [1, trade.md / trade.cd, trade.md];
}

// ---------------------------------------------------------------------------
// Saved sets: the old named slots of flight and production
// ---------------------------------------------------------------------------

/**
 * The techs of production's planet rows, in row order: production-core.js's
 * PRODUCTION_ROWS, which loads on the production page only, so they are
 * repeated here.
 */
const PRODUCTION_ROW_TECHS = [1, 2, 3, 4, 12, 212, 217];

/**
 * The anomaly scanner's lithium conversion, slots 37-41 of a production planet
 * array, as profile values: the scanner level is the building the game
 * reports; the rest is the page's own and the game never sends it. The
 * discount is a percent in the profile and hundredths of one in the array.
 *
 * @type {ReadonlyArray<{key: string, def: number, scale: number}>}
 */
const PRODUCTION_IAS_KEYS = Object.freeze([
  { key: 'ias.on', def: 0, scale: 1 },
  { key: 'building.45', def: 0, scale: 1 },
  { key: 'ias.discount', def: 0, scale: 100 },
  { key: 'ias.resource', def: 0, scale: 1 },
  { key: 'ias.workload', def: 100, scale: 1 },
]);

/**
 * The profile value key of a production row's level: the satellite and the
 * crawler are ships, the rest are buildings.
 *
 * @param {number} tech One of PRODUCTION_ROW_TECHS.
 * @returns {string}
 */
function productionRowKey(tech) {
  return (tech === 212 || tech === 217 ? 'ship.' : 'building.') + tech;
}

/** Flight's ship order, as game ids. */
const FLIGHT_SHIP_IDS = [202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 213, 214, 215, 218, 219];

/** Flight's drive levels, in its order: combustion, impulse, hyperspace. */
const FLIGHT_DRIVE_TECHS = [115, 117, 118];

/**
 * Write a plain value into an entity's override layer - the only layer a value
 * entered by hand can have.
 *
 * @param {{values: LayeredValues}} entity
 * @param {string} key
 * @param {*} value
 */
function setManual(entity, key, value) {
  entity.values[key] = { override: cloneData(value) };
}

/**
 * Production's stored exchange rates in canonical form. Format 1 is the legacy
 * trade ratio (metal:crystal:deuterium, e.g. 3:2:1), format 2 is already metal
 * units; the conversion is production's own convertExchangeRates().
 *
 * @param {unknown} rates
 * @param {unknown} format
 * @returns {number[]}
 */
function productionRates(rates, format) {
  if (!Array.isArray(rates) || rates.length !== 3 || !rates.every((r) => Number(r) > 0)) return DEFAULT_RATES.slice();
  const r = rates.map(Number);
  if (Number(format) >= 2) return r;
  return [1, Math.round(r[0] / r[1] * 100) / 100, Math.round(r[0] / r[2] * 100) / 100];
}

/**
 * A manual profile from a production saved set (`prod_uni_<name>`). The
 * one-planet tab is working state and is not carried over; the planet list is.
 * Production knew only each planet's position, so galaxy and system stay null.
 *
 * @param {Record<string, any>} prm The stored options.prm of production.
 * @param {{label: string, newId?: () => string}} init
 * @returns {Profile}
 */
function profileFromProductionSet(prm, init) {
  const newId = init.newId || newProfileId;
  const profile = createProfile({ id: newId(), label: init.label });
  const acc = profile.account;
  const num = (/** @type {unknown} */ v) => finiteOrNull(v) ?? 0;

  setManual(acc, 'research.113', num(prm.energyTechLevel));
  setManual(acc, 'research.122', num(prm.plasmaTechLevel));
  PROFILE_OFFICERS.forEach((name) => setManual(acc, 'officer.' + name, pfBool(prm[name])));
  setManual(acc, 'class', num(prm.playerClass) + 1);
  if (pfBool(prm.isTrader)) setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.TRADER);
  setManual(acc, 'lf.prod.metal', num(prm.lfMetProdBonus));
  setManual(acc, 'lf.prod.crystal', num(prm.lfCrysProdBonus));
  setManual(acc, 'lf.prod.deuterium', num(prm.lfDeutProdBonus));
  setManual(acc, 'lf.prod.energy', num(prm.lfEnergyProdBonus));
  setManual(acc, 'lf.classBooster.1', num(prm.lfCollectorBonus));
  setManual(acc, 'lf.crawler', num(prm.lfCrawlerBonus));
  setManual(acc, 'lf.cost.122.cost', num(prm.lfPlasmaCostReduction));
  setManual(acc, 'rates', productionRates(prm.rates, prm.ratesFmt));

  const states = Array.isArray(prm.aPS) && prm.aPS.length > 0 ? prm.aPS : legacyProductionStates(prm.aPPP);
  const names = Array.isArray(prm.aPNames) ? prm.aPNames : [];
  const count = Math.min(states.length, num(prm.currPlanetsCount) || states.length);
  for (let i = 0; i < count; i++) {
    const s = states[i];
    if (!Array.isArray(s)) continue;
    const planet = createPlanet({
      id: newId(),
      name: typeof names[i] === 'string' ? names[i] : '',
      coords: { galaxy: null, system: null, position: finiteOrNull(s[1]) },
    });
    Object.entries(productionPlanetValues(s)).forEach(([key, value]) => setManual(planet, key, value));
    profile.planets.push(planet);
  }
  return profile;
}

/**
 * The planet list of a set saved before `aPS` existed: `aPPP` rows of
 * [temperature, seven levels, position], as production's own
 * convertAllPlanetParams() reads them.
 *
 * @param {unknown} rows
 * @returns {unknown[][]}
 */
function legacyProductionStates(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => Array.isArray(r) && r.length > 1).map((r) => {
    const s = [r[0], r[8], 0];
    for (let j = 1; j < 8; j++) {
      s[j * 3] = r[j] ?? 0;
      s[j * 3 + 1] = 100;
      s[j * 3 + 2] = 0;
    }
    s[24] = 0;
    return s;
  });
}

/**
 * One production planet array (`aPS[i]`) as profile values.
 * Layout: [0] max temperature, [1] position, [2] energy booster, then per row j
 * (1..7, techs PRODUCTION_ROW_TECHS[j-1]) level, production %, item booster at
 * j*3..j*3+2, [24] race, [25..36] the race's building levels by position,
 * [37..41] the anomaly scanner's lithium conversion (PRODUCTION_IAS_KEYS).
 *
 * @param {unknown[]} s
 * @returns {Object<string, number>}
 */
function productionPlanetValues(s) {
  const num = (/** @type {unknown} */ v) => finiteOrNull(v) ?? 0;
  /** @type {Object<string, number>} */
  const values = {
    'temperature.max': num(s[0]),
    energyBooster: num(s[2]),
  };
  PRODUCTION_ROW_TECHS.forEach((tech, i) => {
    const j = i + 1;
    values[productionRowKey(tech)] = num(s[j * 3]);
    values['production.' + tech] = finiteOrNull(s[j * 3 + 1]) ?? 100;
    if (j <= 3) values['booster.' + tech] = num(s[j * 3 + 2]);
  });
  const race = num(s[24]);
  values['lf.race'] = race;
  if (race >= 1 && race <= 4) {
    for (let k = 0; k < 12; k++) {
      // Positions 1 and 2 (population, food) do not count for production, but
      // the array is positional from 1, as the page writes it.
      values['lf.building.' + lfBuildingGameId(race, k + 1)] = num(s[25 + k]);
    }
  }
  PRODUCTION_IAS_KEYS.forEach(({ key, def, scale }, k) => {
    values[key] = (finiteOrNull(s[37 + k]) ?? def * scale) / scale;
  });
  return values;
}

/**
 * The inverse of productionPlanetValues(): a production planet array (`aPS[i]`,
 * same layout) from a profile planet. Missing values take production's own
 * defaults, so a planet with nothing in it gives createEmptyPlanet()'s array.
 * The indices are the literal ones of productionPlanetValues(); production
 * names them PLANET_* and mineSlot() in production-core.js.
 *
 * @param {ProfilePlanet} planet
 * @returns {number[]}
 */
function productionPlanetState(planet) {
  /**
   * @param {string} key
   * @param {number} def
   */
  const get = (key, def) => pfNum(getProfileValue(planet, key, def));
  /** @type {number[]} */
  const s = [];
  s[0] = get('temperature.max', 0);
  s[1] = planet.coords && planet.coords.position !== null ? planet.coords.position : 8;
  s[2] = get('energyBooster', 0);
  PRODUCTION_ROW_TECHS.forEach((tech, i) => {
    const j = i + 1;
    s[j * 3] = get(productionRowKey(tech), 0);
    s[j * 3 + 1] = get('production.' + tech, 100);
    s[j * 3 + 2] = j <= 3 ? get('booster.' + tech, 0) : 0;
  });
  const race = get('lf.race', 0);
  s[24] = race;
  for (let k = 0; k < 12; k++) {
    s[25 + k] = race >= 1 && race <= 4 ? get('lf.building.' + lfBuildingGameId(race, k + 1), 0) : 0;
  }
  PRODUCTION_IAS_KEYS.forEach(({ key, def, scale }, k) => {
    s[37 + k] = Math.round(get(key, def) * scale);
  });
  return s;
}

/**
 * One row of production's all-planets table: the profile planet it shows, if
 * any, its planet array (`aPS[i]`) and its name.
 *
 * @typedef {Object} ProductionPlanetRow
 * @property {?string} [id] The profile planet's id; none for a row added since.
 * @property {number[]} state
 * @property {string} name
 */

/**
 * The planets of a profile after production's all-planets table was edited.
 * The planets follow the rows, in their order: a row of a planet that is not
 * there becomes a new planet, a planet with no row leaves the profile (its
 * moons are not touched). A planet the profile has gets only what changed in
 * its row since `snapshot` - the values, the position (galaxy and system stay),
 * the name; one the snapshot does not know is left as it is.
 * The blank planet a profile without planets is shown as does not join the
 * profile until it is edited.
 * The planets the profile keeps are changed in place.
 *
 * @param {ProfilePlanet[]} planets The profile's planets.
 * @param {ProductionPlanetRow[]} rows The table, in its order.
 * @param {Map<string, {state: number[], name: string}>} snapshot The rows at the last apply or write-back.
 * @param {() => string} [newId]
 * @returns {{planets: ProfilePlanet[], created: Array<{row: number, id: string}>, edited: Set<string>, changed: boolean}}
 *   `created` names the planets made from rows, by row index; `edited`, the
 *   planets kept whose values changed in their row, so a form showing one can
 *   be filled again; `changed` is true when anything in the planets changed.
 */
function reconcileProductionPlanets(planets, rows, snapshot, newId = newProfileId) {
  const placeholder = planets.length === 0 && rows.length === 1
    && sameValue(rows[0].state, productionPlanetState(createPlanet({})));
  /** @type {ProfilePlanet[]} */
  const ordered = [];
  /** @type {Array<{row: number, id: string}>} */
  const created = [];
  /** @type {Set<string>} */
  const edited = new Set();
  let changed = false;
  rows.forEach((row, i) => {
    const existing = row.id ? planets.find((p) => p.id === row.id) : undefined;
    if (existing) {
      const before = snapshot.get(existing.id);
      if (before && reconcileProductionPlanet(existing, row, before)) {
        changed = true;
        if (row.state.some((v, k) => v !== before.state[k])) edited.add(existing.id);
      }
      ordered.push(existing);
      return;
    }
    if (placeholder) return;
    const planet = createPlanet({ id: newId(), name: row.name, coords: { galaxy: null, system: null, position: row.state[1] } });
    Object.entries(productionPlanetValues(row.state)).forEach(([key, value]) => setProfileValue(planet, key, value));
    created.push({ row: i, id: planet.id });
    ordered.push(planet);
    changed = true;
  });
  if (ordered.length !== planets.length || ordered.some((p, i) => p !== planets[i])) changed = true;
  return { planets: ordered, created, edited, changed };
}

/**
 * Write what changed in a planet's row since `before` into the planet.
 *
 * @param {ProfilePlanet} planet
 * @param {ProductionPlanetRow} row
 * @param {{state: number[], name: string}} before
 * @returns {boolean} True when the planet changed.
 */
function reconcileProductionPlanet(planet, row, before) {
  let changed = false;
  const was = productionPlanetValues(before.state);
  Object.entries(productionPlanetValues(row.state)).forEach(([key, value]) => {
    if (!sameValue(was[key], value)) changed = setProfileValue(planet, key, value) || changed;
  });
  if (row.state[1] !== before.state[1]) {
    planet.coords = { galaxy: planet.coords ? planet.coords.galaxy : null, system: planet.coords ? planet.coords.system : null, position: row.state[1] };
    changed = true;
  }
  if (row.name !== before.name) {
    planet.name = row.name;
    changed = true;
  }
  return changed;
}

/**
 * The game id of a race's building at a position: race 1 position 6 is 11106.
 *
 * @param {number} race 1-4
 * @param {number} position 1-12
 */
function lfBuildingGameId(race, position) {
  return 10000 + race * 1000 + 100 + position;
}

/**
 * The game id of a race's research at a position: race 1 position 7 is 11207.
 *
 * @param {number} race 1-4
 * @param {number} position 1-18
 */
function lfResearchGameId(race, position) {
  return 10000 + race * 1000 + 200 + position;
}

/**
 * A manual profile from a flight saved set (`flight_uni_<name>`). Only the
 * universe and the account data move; the flight being planned (departure,
 * destination, times, mode) is working state and is dropped, and the universe
 * settings come from the universe itself. The ships stored in the set were never
 * applied on load, so they are dropped too.
 *
 * @param {Record<string, any>} prm The stored options.prm of flight.
 * @param {{label: string, newId?: () => string}} init
 * @returns {Profile}
 */
function profileFromFlightSet(prm, init) {
  const newId = init.newId || newProfileId;
  const number = finiteOrNull(prm.universe);
  const country = typeof prm.country === 'string' && prm.country !== '--' ? prm.country : '';
  const universe = number !== null && country ? { country, number } : null;
  const profile = createProfile({ id: newId(), label: init.label, universe });
  const acc = profile.account;
  const num = (/** @type {unknown} */ v) => finiteOrNull(v) ?? 0;

  const drives = Array.isArray(prm.driveLevels) ? prm.driveLevels : [];
  FLIGHT_DRIVE_TECHS.forEach((tech, i) => setManual(acc, 'research.' + tech, num(drives[i])));
  setManual(acc, 'research.114', num(prm.hyperTechLvl));
  setManual(acc, 'class', num(prm.playerClass) + 1);
  if (pfBool(prm.traderBonus)) setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.TRADER);
  else if (pfBool(prm.warriorBonus)) setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.WARRIOR);
  setManual(acc, 'lf.classBooster.1', num(prm.lfRocktalCE));
  setManual(acc, 'lf.classBooster.2', num(prm.lfMechanGE));

  const bonuses = Array.isArray(prm.lfShipsBonuses) ? prm.lfShipsBonuses : [];
  FLIGHT_SHIP_IDS.forEach((shipId, i) => {
    const b = Array.isArray(bonuses[i]) ? bonuses[i] : [];
    setManual(acc, 'lf.ship.' + shipId + '.speed', num(b[0]));
    setManual(acc, 'lf.ship.' + shipId + '.cargo', num(b[1]));
    setManual(acc, 'lf.ship.' + shipId + '.fuel', num(b[2]));
  });
  return profile;
}

/**
 * A manual profile for the player a spy report describes: the report's
 * universe and the spied planet or moon, so flight's departure select offers
 * it. The account values stay empty - flight's report import then writes them
 * as it would into any profile entered by hand. Nothing is saved here.
 *
 * @param {*} rd The report, as the ogameAPI service returns it.
 * @param {string} label
 * @param {() => string} [newId]
 * @returns {Profile}
 */
function profileFromSpyReport(rd, label, newId = newProfileId) {
  const number = Number(rd?.universes?.universe);
  const country = String(rd?.universes?.domain || '');
  const profile = createProfile({ id: newId(), label, universe: country && number > 0 ? { country, number } : null });
  const coords = String(rd?.generic?.defender_planet_coordinates || '').split(':').map(Number);
  if (coords.length === 3 && coords.every((n) => Number.isInteger(n) && n > 0)) {
    const body = createPlanet({
      id: newId(),
      name: String(rd.generic.defender_planet_name || ''),
      coords: { galaxy: coords[0], system: coords[1], position: coords[2] },
    });
    // The game's planet types: 1 planet, 3 moon.
    if (Number(rd.generic.defender_planet_type) === 3) profile.moons.push({ ...body, planetId: null });
    else profile.planets.push(body);
  }
  return profile;
}

/**
 * The score limits of the "strongest player" tiers, one per entry of its
 * select but the last - the `upTo` of data/expedition-top-tiers.json, which
 * expeditions.php and the MCP server read. The parser below runs on every
 * calculator that loads a universe's settings, not only on expeditions, so the
 * tiers are repeated here rather than handed over by one page's template;
 * unit-tests/profiles-core.test.js fails when the two drift apart.
 */
const EXPEDITION_TOP_SCORE_LIMITS = [10000, 100000, 1000000, 5000000, 25000000, 50000000, 75000000, 100000000];

/** The values of expeditions' #highTop options, in the order of the select (the tiers' `highTop`). */
const EXPEDITION_HIGH_TOP_VALUES = [40000, 500000, 1200000, 1800000, 2400000, 3000000, 3600000, 4200000, 5000000];

/**
 * The #highTop value for the score of a universe's strongest player: the first
 * entry whose limit the score does not exceed, the last one beyond them all
 * (expeditions.php does the same with floor()).
 *
 * @param {unknown} score The `topScore` of the server data.
 * @returns {?number} The option value; null when the score is not a number.
 */
function expeditionHighTop(score) {
  const points = Math.floor(Number(score));
  if (score === null || score === '' || !Number.isFinite(points)) return null;
  const index = EXPEDITION_TOP_SCORE_LIMITS.findIndex((limit) => points <= limit);
  return EXPEDITION_HIGH_TOP_VALUES[index === -1 ? EXPEDITION_TOP_SCORE_LIMITS.length : index];
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    expeditionHighTop,
    PROFILE_FORMAT_VERSION, PROFILE_CLASS, PROFILE_ALLIANCE_CLASS, DEFAULT_RATES,
    PRODUCTION_ROW_TECHS, productionRowKey, FLIGHT_SHIP_IDS,
    createProfile, createPlanet, newProfileId, sameUniverse, pfNum, pfBool, pfBodyLabel,
    getProfileValue, setProfileValue, differsFromGame, resetProfileValue,
    pfSnapKey, snapshotReadings, diffReadings, pfOwnedGroups, pfPickOwn, pfSplitOwned, pfKeepOwn,
    countOverrides, hasGameLayer,
    parseAccountExport, findProfileForExport, importAccountExport, mergeProfiles,
    isNewerExport, planCompanionSync, resolveImportUniverse, profileBodyResources,
    readCompanionIgnoredEntry, sameCompanionAccount, mergeCompanionIgnored,
    RESOURCE_READING_STALE_MS, isResourceReadingStale, planResourceFill, keepBodyResources,
    readProfile, serializeProfilesFile, parseProfilesFile, planProfilesRestore,
    SHARE_FORMAT_VERSION, QR_SINGLE_URL_LIMIT, QR_MAX_PARTS, SHARE_PARTS_TTL_MS,
    SHARE_KEYS, packShareValues, unpackShareValues, serializeProfileShare, parseProfileShare,
    pfB64UrlEncode, pfB64UrlDecode, encodeSharePayload, decodeSharePayload,
    buildShareFragment, readShareFragment, withoutShareFragment, fitsQrCode,
    splitShareParts, readSharePart, readSharePartsState, addSharePart, assembleShareParts,
    countShareParts, purgeStaleShareParts,
    universeCacheKey, readUniverseChoices, UNIVERSE_SETTINGS_TTL_MS, UNIVERSE_SETTING_PARSERS,
    parseUniverseSettings, readUniverseEntry, isUniverseEntryFresh, universeLayer, universeValue,
    setUniverseChoice, mergeUniverseChoices, pfMarkState, listUniverseOverrides, resetUniverseChoices,
    ratesToTrade, ratesFromTrade, lfBuildingGameId, lfResearchGameId,
    LF_RACES, LF_BUILDING_POSITIONS, LF_RESEARCH_POSITIONS,
    lfTechValueKeys, fillLfGameLevels, migrateLfGameLevels,
    productionPlanetValues, productionPlanetState, reconcileProductionPlanets, profileFromProductionSet, profileFromFlightSet,
    profileFromSpyReport,
  });
}
