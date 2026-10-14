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
// 'building.22', 'ship.217' for the crawler). A calculator whose own arrays use
// other ids (production numbers the crawler 218) translates at its boundary.

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
 * @property {?string} importedAt ISO time of the export the game layer came from.
 * @property {{values: LayeredValues}} account
 * @property {ProfilePlanet[]} planets
 * @property {ProfileMoon[]} moons
 */

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
 * What every calculator's profile field has: the profile value key it shows,
 * and how its game value reads in the "in game" mark (default: the value
 * as text).
 *
 * @typedef {Object} ProfileFieldBase
 * @property {string} key Profile value key.
 * @property {(value: *) => string} [display] The game value as shown in the mark.
 */

/**
 * A field that reads and writes a calculator's settings object (options.prm)
 * through its own getter and setter.
 *
 * @typedef {ProfileFieldBase & {
 *   prm: string,
 *   input: string,
 *   get: (prm: Record<string, any>) => *,
 *   show: (value: *) => void,
 * }} ProfilePrmField
 * prm: key in options.prm; input: selector of the field that shows it; get: the profile value the prm holds;
 * show: put a profile value (or undefined) into the form.
 */

/**
 * A field that converts between a profile value and a settings value.
 *
 * @typedef {ProfileFieldBase & {
 *   prm: string,
 *   input: string,
 *   toPrm: (v: *) => *,
 *   fromPrm: (v: *) => *,
 *   markIf?: (body: ProfilePlanet) => boolean,
 * }} ProfileConvField
 * prm: key in options.prm; input: selector of the field that shows it; toPrm: profile value (or undefined)
 * to the prm value; fromPrm: prm value to the profile value; markIf: the field is marked only for a
 * body it returns true for (default: always).
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
 * A planet or moon as a select shows it: its name and, when known, its
 * coordinates.
 *
 * @param {{name?: ?string, coords?: ?ProfileCoords}} body
 * @param {string} [fallback] The name of a body that has none.
 * @returns {string}
 */
function pfBodyLabel(body, fallback = '—') {
  const c = body.coords;
  const where = c && c.galaxy !== null && c.system !== null ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
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
 * Restore every game value of one entity.
 *
 * @param {{values: LayeredValues}} entity
 * @returns {number} How many values were reset.
 */
function resetEntityToGame(entity) {
  return Object.keys(entity.values).filter((key) => resetProfileValue(entity, key)).length;
}

/**
 * Restore every game value of the whole profile.
 *
 * @param {Profile} profile
 * @returns {number} How many values were reset.
 */
function resetProfileToGame(profile) {
  let count = resetEntityToGame(profile.account);
  profile.planets.forEach((p) => { count += resetEntityToGame(p); });
  profile.moons.forEach((m) => { count += resetEntityToGame(m); });
  return count;
}

/**
 * One value of a profile that differs from the game.
 *
 * @typedef {Object} ProfileOverride
 * @property {'account'|'planet'|'moon'} kind
 * @property {?string} entityId The planet's or moon's local id; null for the account.
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
  const planets = Object.values(raw.planets).filter(isPlainObject).map((p) => exportBody(p, true));
  const moons = Object.values(isPlainObject(raw.moons) ? raw.moons : {}).filter(isPlainObject).map((m) => {
    const body = exportBody(m, false);
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
    moons,
  };
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
  const exportedMs = Date.parse(typeof raw.exportedAt === 'string' ? raw.exportedAt : '');
  const nowSeconds = Number.isFinite(exportedMs) ? exportedMs / 1000 : Number.POSITIVE_INFINITY;
  let best = 0;
  [raw.planets, raw.moons].filter(isPlainObject).forEach((bodies) => {
    Object.values(bodies).filter(isPlainObject).forEach((body) => {
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
 * One planet or moon of the export.
 *
 * @param {Record<string, any>} raw
 * @param {boolean} isPlanet
 * @returns {ExportBody}
 */
function exportBody(raw, isPlanet) {
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
 * Replace the game layer of one entity. A key the import supplies gets the new
 * game value and loses its override; a key it does not supply loses its game
 * value and keeps its override (production percentages, rates); a key left
 * with neither layer is dropped.
 *
 * @param {{values: LayeredValues}} entity
 * @param {Object<string, *>} imported
 */
function replaceGameLayer(entity, imported) {
  Object.keys(entity.values).forEach((key) => {
    if (key in imported) return;
    const v = entity.values[key];
    delete v.game;
    if (!('override' in v)) delete entity.values[key];
  });
  Object.entries(imported).forEach(([key, value]) => {
    entity.values[key] = { game: cloneData(value) };
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
 * @param {{universe?: ?ProfileUniverse, newId?: () => string}} [opts]
 *   `universe` is the one the player picked, used when the export has none.
 * @returns {{profile: Profile, summary: ImportSummary}}
 */
function importAccountExport(existing, data, opts = {}) {
  const newId = opts.newId || newProfileId;
  const created = !existing;
  const profile = existing ? cloneData(existing) : createProfile({ id: newId(), label: data.playerName || String(data.playerId) });

  profile.playerId = data.playerId;
  profile.importedAt = data.exportedAt;
  if (data.universe) {
    profile.universe = { ...data.universe };
    profile.universeLocked = true;
  } else if (!profile.universe && opts.universe) {
    profile.universe = { ...opts.universe };
    profile.universeLocked = false;
  }
  replaceGameLayer(profile.account, data.account);

  const planets = applyBodies(profile.planets, data.planets, newId);
  profile.planets = planets.bodies;

  /** @type {Map<number, string>} */
  const planetIdByGameId = new Map();
  profile.planets.forEach((p) => { if (p.gameId !== null) planetIdByGameId.set(p.gameId, p.id); });
  const moons = applyBodies(profile.moons, data.moons, newId);
  profile.moons = /** @type {ProfileMoon[]} */ (moons.bodies);
  profile.moons.forEach((moon) => {
    const source = data.moons.find((m) => m.gameId !== null && m.gameId === moon.gameId);
    const linked = source?.planetGameId ? planetIdByGameId.get(source.planetGameId) : undefined;
    // A moon new to the profile was created as a planet and has no planetId yet.
    moon.planetId = linked ?? moon.planetId ?? null;
  });

  return { profile, summary: { created, planets: planets.counts, moons: moons.counts } };
}

/**
 * @param {ProfilePlanet[]} current
 * @param {ExportBody[]} imported
 * @param {() => string} newId
 * @returns {{bodies: ProfilePlanet[], counts: ImportCounts}}
 */
function applyBodies(current, imported, newId) {
  const counts = { added: 0, updated: 0, removed: 0 };
  /** @type {Set<ProfilePlanet>} */
  const matched = new Set();
  /** @type {ProfilePlanet[]} */
  const added = [];

  imported.forEach((body) => {
    const target = current.find((p) => !matched.has(p) && p.gameId !== null && p.gameId === body.gameId)
      || uniqueCoordsMatch(current.filter((p) => !matched.has(p) && p.gameId === null), body.coords, imported);
    if (target) {
      matched.add(target);
      target.gameId = body.gameId;
      target.name = body.name || target.name;
      target.coords = body.coords || target.coords;
      replaceGameLayer(target, body.values);
      counts.updated++;
    } else {
      const planet = createPlanet({ id: newId(), gameId: body.gameId, name: body.name, coords: body.coords });
      replaceGameLayer(planet, body.values);
      added.push(planet);
      counts.added++;
    }
  });

  const kept = current.filter((p) => {
    if (matched.has(p)) return true;
    if (p.gameId === null) return true;
    counts.removed++;
    return false;
  });
  return { bodies: kept.concat(added).sort(byCoords), counts };
}

/**
 * Planets in the game's own order: by coordinates, unknown ones last.
 *
 * @param {ProfilePlanet} a
 * @param {ProfilePlanet} b
 */
function byCoords(a, b) {
  /** @param {ProfilePlanet} p */
  const key = (p) => {
    const c = p.coords;
    if (!c || c.galaxy === null || c.system === null || c.position === null) return Number.MAX_SAFE_INTEGER;
    return (c.galaxy * 1000 + c.system) * 100 + c.position;
  };
  return key(a) - key(b);
}

// ---------------------------------------------------------------------------
// Merging two profiles
// ---------------------------------------------------------------------------

/**
 * Merge a second profile into a primary one (ADR-0004). The primary keeps every
 * value it has, game or override; from the second it takes only the keys it
 * lacks, and the universe and player id when it has none. Planets are matched by
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
  if (result.importedAt === null) result.importedAt = other.importedAt;
  fillMissing(result.account, other.account);

  /** @type {Map<string, string>} the second profile's planet id to the merged one */
  const planetIds = new Map();
  result.planets = mergeBodies(result.planets, other.planets, planetIds);
  result.moons = /** @type {ProfileMoon[]} */ (mergeBodies(result.moons, other.moons, new Map()));
  result.moons.forEach((moon) => {
    if (moon.planetId && planetIds.has(moon.planetId)) moon.planetId = planetIds.get(moon.planetId) || null;
  });
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
  const result = primary.slice();
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
      result.push(body);
      idMap.set(body.id, body.id);
    }
  });
  return result.sort(byCoords);
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
  return /** @type {Profile} */ (raw);
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
  if (!isPlainObject(raw) || !isPlainObject(raw.universe) || !isPlainObject(raw.overrides)) return null;
  const { country, number } = raw.universe;
  if (typeof country !== 'string' || !/^[a-z]{2,3}$/i.test(country) || !Number.isInteger(number) || number <= 0) return null;
  /** @type {Record<string, number|boolean>} */
  const overrides = {};
  Object.entries(raw.overrides).forEach(([key, value]) => {
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) overrides[key] = value;
  });
  return Object.keys(overrides).length > 0 ? { universe: { country, number }, overrides } : null;
}

/**
 * The backup file: every profile given, in our own format, and the universe
 * settings the player picked for their universes.
 *
 * @param {Profile[]} profiles
 * @param {string} [exportedAt]
 * @param {UniverseChoices[]} [universes]
 * @returns {string}
 */
function serializeProfilesFile(profiles, exportedAt = new Date().toISOString(), universes = []) {
  return JSON.stringify({ pfgProfiles: PROFILE_FILE_VERSION, exportedAt, profiles, universes }, null, 2);
}

/**
 * @typedef {Object} ProfilesFileResult
 * @property {boolean} ok
 * @property {Profile[]} [profiles]
 * @property {UniverseChoices[]} [universes] Empty for a file written before they were kept.
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
  const profiles = raw.profiles.map(readProfile);
  if (profiles.some((p) => p === null)) return { ok: false, reason: 'version' };
  // The universe choices are a bonus: a broken entry is dropped, not the file.
  const universes = (Array.isArray(raw.universes) ? raw.universes : []).map(readUniverseChoices).filter((u) => u !== null);
  return { ok: true, profiles: /** @type {Profile[]} */ (profiles), universes: /** @type {UniverseChoices[]} */ (universes) };
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

/** Production's planet arrays name the crawler 218; the game calls it 217. */
const PRODUCTION_ROW_TECHS = [1, 2, 3, 4, 12, 212, 217];

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
  PROFILE_OFFICERS.forEach((name) => setManual(acc, 'officer.' + name, prm[name] === true || prm[name] === 'true'));
  setManual(acc, 'class', num(prm.playerClass) + 1);
  if (prm.isTrader === true || prm.isTrader === 'true') setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.TRADER);
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
 * j*3..j*3+2, [24] race, [25..36] the race's building levels by position.
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
    const kind = tech === 212 || tech === 217 ? 'ship.' : 'building.';
    values[kind + tech] = num(s[j * 3]);
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
  return values;
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
  if (prm.traderBonus === true || prm.traderBonus === 'true') setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.TRADER);
  else if (prm.warriorBonus === true || prm.warriorBonus === 'true') setManual(acc, 'allianceClass', PROFILE_ALLIANCE_CLASS.WARRIOR);
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
 * The score limits of expeditions.php's `$thresholds`, one per entry of the
 * "strongest player" select but the last. The page mirrors them, so a universe
 * opened through the URL API and one bound to a profile pick the same entry.
 */
const EXPEDITION_TOP_SCORE_LIMITS = [10000, 100000, 1000000, 5000000, 25000000, 50000000, 75000000, 100000000];

/** The values of expeditions' #highTop options, in the order of the select. */
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
    PRODUCTION_ROW_TECHS, FLIGHT_SHIP_IDS,
    createProfile, createPlanet, newProfileId, sameUniverse, pfNum, pfBool, pfBodyLabel,
    getProfileValue, setProfileValue, differsFromGame, resetProfileValue,
    resetEntityToGame, resetProfileToGame, countOverrides, hasGameLayer,
    parseAccountExport, findProfileForExport, importAccountExport, mergeProfiles,
    readProfile, serializeProfilesFile, parseProfilesFile, planProfilesRestore,
    universeCacheKey, readUniverseChoices,
    ratesToTrade, ratesFromTrade, lfBuildingGameId,
    productionPlanetValues, profileFromProductionSet, profileFromFlightSet,
  });
}
