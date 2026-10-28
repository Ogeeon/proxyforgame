'use strict';

// The player's own account, read from the account export the Origin Exporter
// userscript (or the PfG Companion) copies out of the game, and handed back
// under the other tools' argument names - so a model fills those tools from
// one paste instead of asking for every level and bonus.
//
// The export is read by the profiles' own parser, profiles-core.js, exactly as
// the site's import dialog reads it. The tables below map that parser's value
// keys ('research.114', 'lf.classBooster.1', ...) onto argument paths, each
// with the tools that take it; a test checks every path against the tools'
// input schemas, so renaming an argument cannot silently break the import.
//
// Nothing that identifies the player leaves this tool: no player name or id,
// no item uuids, no buff times. Planet names, coordinates, the universe and
// the export time do. Request bodies are never logged (lib/protocol.js logs
// error stacks only).

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const common = require('./common');

const { parseAccountExport, lfBuildingGameId, ACCOUNT_EXPORT_SCHEMAS } = loadBrowserScripts(
    ['ogame/calc/js/profiles-core.js'],
    ['parseAccountExport', 'lfBuildingGameId', 'ACCOUNT_EXPORT_SCHEMAS'],
);

/** @type {{techs: Record<string, {key: string, type: number}>}} */
const COST_TECHS = readWwwJson('ogame/calc/data/costs-techs.json');
/** @type {Record<string, any[]>} */
const LF_TECHS = readWwwJson('ogame/calc/data/lf-techs.json');

/**
 * Game ship ids to the cores' kebab keys. Not costs-techs.json: the site
 * numbers the last three ships its own way (216 reaper, 217 pathfinder, 218
 * crawler), the game 217 crawler, 218 reaper, 219 pathfinder.
 */
const GAME_SHIPS = {
    202: 'small-cargo', 203: 'large-cargo', 204: 'light-fighter', 205: 'heavy-fighter', 206: 'cruiser',
    207: 'battleship', 208: 'colony-ship', 209: 'recycler', 210: 'esp-probe', 211: 'bomber', 212: 'solar-sat',
    213: 'destroyer', 214: 'death-star', 215: 'battlecruiser', 217: 'crawler', 218: 'reaper', 219: 'pathfinder',
};

/** The ships the fleet tools take (flight, expedition): every ship but the satellite and the crawler. */
const FLEET_SHIPS = Object.entries(GAME_SHIPS).filter(([, key]) => key !== 'solar-sat' && key !== 'crawler');

/** Game tech id to costs key: buildings and research share the site's numbering; ships are the game's. */
const GAME_TECHS = {
    ...Object.fromEntries(Object.entries(COST_TECHS.techs).filter(([, t]) => t.type <= 4).map(([id, t]) => [id, t.key])),
    ...GAME_SHIPS,
};

/** Research of the account, by game id. */
const RESEARCH_IDS = Object.entries(COST_TECHS.techs).filter(([, t]) => t.type === 4).map(([id]) => id);

/** Buildings, by game id. */
const BUILDING_IDS = Object.entries(COST_TECHS.techs).filter(([, t]) => t.type <= 3).map(([id]) => id);

const RACES = { 1: 'humans', 2: 'rocktal', 3: 'mechas', 4: 'kaelesh' };
const CLASSES = { 0: 'none', 1: 'collector', 2: 'general', 3: 'discoverer' };
// The researcher alliance changes nothing any tool computes, so it reads as none.
const ALLIANCE_CLASSES = { 0: 'none', 1: 'warrior', 2: 'trader', 3: 'none' };

/** The game id of a life form building or research in lf-techs.json. */
const LF_GAME_ID_OFFSET = 10100;

/** The life form buildings of the production tool: positions 3 to 12 of each race. */
const FIRST_PRODUCTION_BUILDING = 3;

const T = {
    flight: 'ogame_flight', cost: 'ogame_build_cost', lfCost: 'ogame_lifeform_cost', queue: 'ogame_build_queue',
    production: 'ogame_production', expedition: 'ogame_expedition', moonCreation: 'ogame_moon_creation',
    phalanx: 'ogame_phalanx', graviton: 'ogame_graviton', terraformer: 'ogame_terraformer', trade: 'ogame_trade',
};
const SHIP_BONUS_TOOLS = [T.flight, T.lfCost, T.expedition, T.moonCreation, T.graviton, T.terraformer, T.trade];

/**
 * One value of the export, and where the answer puts it.
 * @typedef {object} FieldMap
 * @property {string} key The profiles-core value key.
 * @property {string} path Dot-separated argument path in the answer.
 * @property {string[]} tools The tools that take the argument at `path`.
 * @property {(v: any) => any} [convert] From the export's value to the argument's; undefined skips it.
 * @property {boolean} [dropZero] Leave a 0 out: a map entry or an optional count.
 */

const nonZero = { dropZero: true };

/** @type {FieldMap[]} */
const ACCOUNT_MAP = [
    { key: 'class', path: 'playerClass', convert: (v) => CLASSES[/** @type {0} */ (v)],
        tools: [T.flight, T.cost, T.lfCost, T.production, T.expedition, T.moonCreation, T.phalanx, T.graviton, T.terraformer, T.trade] },
    { key: 'allianceClass', path: 'allianceClass', convert: (v) => ALLIANCE_CLASSES[/** @type {0} */ (v)],
        tools: [T.flight, T.production, T.graviton, T.terraformer] },
    ...['commander', 'admiral', 'engineer', 'geologist', 'technocrat'].map((officer) => ({
        key: 'officer.' + officer, path: 'officers.' + officer, tools: [T.cost, T.production, T.graviton, T.terraformer],
    })),
    { key: 'research.114', path: 'hyperspaceTechnology',
        tools: [T.flight, T.cost, T.lfCost, T.expedition, T.moonCreation, T.graviton, T.terraformer, T.trade] },
    { key: 'research.121', path: 'ionTechnology', tools: [T.cost, T.lfCost, T.queue] },
    { key: 'research.113', path: 'energyTechnology', tools: [T.production, T.graviton, T.terraformer] },
    { key: 'research.122', path: 'plasmaTechnology', tools: [T.production] },
    { key: 'research.115', path: 'drives.combustion', tools: [T.flight] },
    { key: 'research.117', path: 'drives.impulse', tools: [T.flight] },
    { key: 'research.118', path: 'drives.hyperspace', tools: [T.flight] },
    // Every research level, for ogame_build_cost's fromLevel.
    ...RESEARCH_IDS.map((id) => ({ key: 'research.' + id, path: 'research.' + GAME_TECHS[id], tools: [], ...nonZero })),
    // The life form bonuses, treated as the site's profiles treat them (production-profile.js and the rest).
    { key: 'lf.prod.metal', path: 'lifeforms.metalBonus', tools: [T.production] },
    { key: 'lf.prod.crystal', path: 'lifeforms.crystalBonus', tools: [T.production] },
    { key: 'lf.prod.deuterium', path: 'lifeforms.deuteriumBonus', tools: [T.production] },
    { key: 'lf.prod.energy', path: 'lifeforms.energyBonus', tools: [T.production, T.graviton, T.terraformer] },
    { key: 'lf.crawler', path: 'lifeforms.crawlerBonus', tools: [T.production] },
    { key: 'lf.classBooster.1', path: 'lifeforms.collectorClassBonus', tools: [T.flight, T.production, T.expedition] },
    { key: 'lf.classBooster.2', path: 'lifeforms.generalClassBonus', tools: [T.flight] },
    { key: 'lf.classBooster.3', path: 'lifeforms.discovererClassBonus', tools: [T.cost, T.expedition, T.phalanx] },
    { key: 'lf.expedition.resources', path: 'lifeforms.resourceFindBonus', tools: [T.expedition] },
    { key: 'lf.expedition.ships', path: 'lifeforms.shipFindBonus', tools: [T.expedition] },
    { key: 'lf.phalanxRange', path: 'lifeforms.analysisNetworkBonus', tools: [T.phalanx] },
    // The game reports a reduction per technology. The terraformer takes the cost one for both,
    // as the costs page does; life form research takes the reduction of the first one, 11201.
    { key: 'lf.cost.33.cost', path: 'lifeforms.terraformerReduction', tools: [T.cost, T.terraformer] },
    { key: 'lf.cost.11201.cost', path: 'lifeforms.researchCostReduction', tools: [T.lfCost] },
    { key: 'lf.cost.11201.time', path: 'lifeforms.researchTimeReduction', tools: [T.lfCost] },
    ...FLEET_SHIPS.flatMap(([id, ship]) => ['speed', 'cargo', 'fuel'].map((stat) => ({
        key: `lf.ship.${id}.${stat}`, path: `lifeforms.shipBonuses.${ship}.${stat}`, tools: SHIP_BONUS_TOOLS, ...nonZero,
    }))),
    // Per item, for ogame_build_cost's lifeforms.itemCostReduction / itemTimeReduction.
    ...Object.entries(GAME_TECHS).filter(([id]) => id !== '33').flatMap(([id, item]) => [
        { key: `lf.cost.${id}.cost`, path: `itemReductions.${item}.itemCostReduction`, tools: [], ...nonZero },
        { key: `lf.cost.${id}.time`, path: `itemReductions.${item}.itemTimeReduction`, tools: [], ...nonZero },
    ]),
    { key: 'item.expeditionResources', path: 'discoveryBoosterPercent', tools: [T.expedition] },
];

/**
 * A production row: level, the Companion's production setting, a booster.
 * @param {string} name argument name
 * @param {number} id game id
 * @param {string} levelKey the value key of its level or count
 * @param {string} levelField `level` or `count`
 * @param {string[]} tools
 * @returns {FieldMap[]}
 */
const row = (name, id, levelKey, levelField, tools) => [
    { key: levelKey, path: `${name}.${levelField}`, tools },
    { key: 'production.' + id, path: `${name}.percent`, tools: [T.production] },
];
const mineBooster = (/** @type {string} */ name, /** @type {number} */ n) => ({
    key: 'booster.' + n, path: `${name}.boosterPercent`, convert: (/** @type {number} */ v) => v * 10, tools: [T.production],
});
const ENERGY_TOOLS = [T.production, T.graviton, T.terraformer];

/** The values of a planet. Its life form buildings are added by lfBuildingFields(), its race separately. */
/** @type {FieldMap[]} */
const PLANET_MAP = [
    { key: 'temperature.max', path: 'maxTemperature', tools: ENERGY_TOOLS },
    ...row('metalMine', 1, 'building.1', 'level', [T.production]), mineBooster('metalMine', 1),
    ...row('crystalMine', 2, 'building.2', 'level', [T.production]), mineBooster('crystalMine', 2),
    ...row('deuteriumSynthesizer', 3, 'building.3', 'level', [T.production]), mineBooster('deuteriumSynthesizer', 3),
    ...row('solarPlant', 4, 'building.4', 'level', ENERGY_TOOLS),
    ...row('fusionReactor', 12, 'building.12', 'level', ENERGY_TOOLS),
    ...row('solarSatellites', 212, 'ship.212', 'count', ENERGY_TOOLS),
    ...row('crawlers', 217, 'ship.217', 'count', [T.production]),
    { key: 'energyBooster', path: 'energyBoosterPercent', convert: (v) => v * 10, tools: ENERGY_TOOLS },
];

/** What a planet and a moon both have. */
/** @type {FieldMap[]} */
const BODY_MAP = [
    { key: 'fields.total', path: 'fields', tools: [T.queue] },
    { key: 'building.14', path: 'facilities.roboticsFactory', tools: [T.cost, T.lfCost, T.terraformer] },
    { key: 'building.15', path: 'facilities.naniteFactory', tools: [T.cost, T.lfCost, T.graviton, T.terraformer] },
    { key: 'building.21', path: 'facilities.shipyard', tools: [T.cost, T.graviton, T.terraformer] },
    { key: 'building.31', path: 'facilities.researchLab', tools: [T.cost] },
    ...BUILDING_IDS.map((id) => ({ key: 'building.' + id, path: 'levels.' + GAME_TECHS[id], tools: [T.queue], ...nonZero })),
    ...FLEET_SHIPS.map(([id, ship]) => ({ key: 'ship.' + id, path: 'ships.' + ship, tools: [T.flight, T.expedition], ...nonZero })),
];

/**
 * The life form buildings of a planet: the planet race's production buildings
 * under `lifeforms.buildings`, the few the tools name on their own whatever
 * the race, and every building and research level under `lifeformLevels`.
 * @param {number} race 1-4, 0 for none
 * @returns {FieldMap[]}
 */
function lfBuildingFields(race) {
    /** @type {FieldMap[]} */
    const fields = [
        { key: 'lf.building.' + lfBuildingGameId(2, 8), path: 'lifeforms.megalith', tools: [T.lfCost], ...nonZero },
        { key: 'lf.building.' + lfBuildingGameId(2, 11), path: 'lifeforms.mineralResearchCentre', tools: [T.cost, T.lfCost], ...nonZero },
        { key: 'lf.building.' + lfBuildingGameId(2, 7), path: 'lifeforms.disruptionChamber', tools: [T.graviton, T.terraformer], ...nonZero },
        { key: 'lf.building.' + lfBuildingGameId(4, 12), path: 'lifeforms.supraRefractor', tools: [T.moonCreation], ...nonZero },
    ];
    if (race > 0) {
        fields.push({ key: 'lf.building.' + lfBuildingGameId(race, 3), path: 'lifeforms.researchBuilding', tools: [T.lfCost], ...nonZero });
        for (let position = FIRST_PRODUCTION_BUILDING; position <= 12; position++) {
            const id = race * 1000 + position;
            fields.push({ key: 'lf.building.' + (id + LF_GAME_ID_OFFSET), path: 'lifeforms.buildings.' + LF_TECHS[id][0], tools: [T.production], ...nonZero });
        }
    }
    for (const id of Object.keys(LF_TECHS)) {
        const kind = LF_TECHS[id][1] === 1 ? 'lf.building.' : 'lf.research.';
        fields.push({ key: kind + (Number(id) + LF_GAME_ID_OFFSET), path: 'lifeformLevels.' + LF_TECHS[id][0], tools: [], ...nonZero });
    }
    return fields;
}

/**
 * Sets `value` at a dot-separated path, creating the objects on the way.
 * @param {Record<string, any>} target
 * @param {string} path
 * @param {unknown} value
 */
function setPath(target, path, value) {
    const parts = path.split('.');
    let at = target;
    for (const part of parts.slice(0, -1)) {
        at[part] ??= {};
        at = at[part];
    }
    at[parts.at(-1) ?? ''] = value;
}

/**
 * The values `map` names, under their argument paths.
 * @param {Record<string, any>} values a normalized export body or account
 * @param {FieldMap[]} map
 * @returns {Record<string, any>}
 */
function mapValues(values, map) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const field of map) {
        const raw = values[field.key];
        if (raw === undefined || raw === null) {
            continue;
        }
        const value = field.convert ? field.convert(raw) : raw;
        if (value === undefined || (field.dropZero && value === 0)) {
            continue;
        }
        setPath(out, field.path, value);
    }
    return out;
}

/**
 * @param {{name: string, coords: ?{galaxy: ?number, system: ?number, position: ?number}, values: Record<string, any>}} body
 *   a body of the normalized export
 * @param {boolean} isPlanet
 */
function bodyAnswer(body, isPlanet) {
    const race = isPlanet ? Number(body.values['lf.race']) || 0 : 0;
    const mapped = mapValues(body.values, isPlanet ? [...PLANET_MAP, ...BODY_MAP, ...lfBuildingFields(race)] : BODY_MAP);
    const coords = body.coords;
    return {
        name: body.name,
        location: isPlanet ? 'planet' : 'moon',
        coordinates: coords ? { galaxy: coords.galaxy, system: coords.system, position: coords.position } : null,
        ...(isPlanet && coords?.position ? { position: coords.position } : {}),
        ...(race > 0 ? { planetRace: RACES[/** @type {1} */ (race)] } : {}),
        ...mapped,
    };
}

/**
 * The export to read: the argument itself, or the one export of a PfG
 * Companion payload that `universe` picks.
 * @param {unknown} given
 * @param {{country: string, number: number}|undefined} universe
 * @returns {Record<string, any>}
 */
function pickExport(given, universe) {
    let raw = given;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            throw new ToolError('export is not valid JSON. Pass the export as a JSON object, unchanged.');
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ToolError('export must be an account export (an object with playerId and planets) or a PfG Companion payload.');
    }
    const obj = /** @type {Record<string, any>} */ (raw);
    if (!('exports' in obj)) {
        return obj;
    }
    if (obj.version !== 1 || !Array.isArray(obj.exports)) {
        throw new ToolError('export looks like a PfG Companion payload, but not version 1 with an exports list.');
    }
    const exports = obj.exports.filter((e) => e && typeof e === 'object');
    const label = (/** @type {any} */ e) => (e.universe ? `${e.universe.language}-${e.universe.number}` : 'unknown universe');
    if (universe) {
        const country = common.universeRef(universe).country;
        const found = exports.find((e) => e.universe?.language === country && Number(e.universe?.number) === universe.number);
        if (!found) {
            throw new ToolError(`The payload has no export of ${country}-${universe.number}; it holds `
                + `${exports.map(label).join(', ') || 'none'}.`);
        }
        return found;
    }
    if (exports.length !== 1) {
        throw new ToolError(`The payload holds ${exports.length} exports (${exports.map(label).join(', ') || 'none'}): `
            + 'pass `universe` to pick one.');
    }
    return exports[0];
}

const inputSchema = {
    type: 'object',
    properties: {
        export: {
            description: 'The account export exactly as copied (Origin Exporter, schemaVersion 1 or 2), or a PfG '
                + 'Companion payload {version: 1, exports: [...]}. Pass it as a JSON object: a string works too '
                + 'but doubles in size escaped.',
        },
        universe: {
            ...common.universeSchema,
            description: 'Picks the export out of a Companion payload; for a schemaVersion 1 export, which does not '
                + 'name its universe, it is copied into the answer.',
        },
    },
    required: ['export'],
    additionalProperties: false,
};

/** @returns {import('../lib/protocol').Tool} */
function createImportAccountTool() {
    return {
        name: 'ogame_import_account',
        title: 'OGame account import',
        description: 'Reads the player\'s account export once and returns it under the other tools\' argument '
            + 'names: `account` (class, officers, research, life form bonuses) and `bodies` (each planet and moon: '
            + 'coordinates, temperature, buildings, production settings, boosters, ships, life form buildings). '
            + 'For a tool about one planet, merge `account.lifeforms` with that body\'s `lifeforms` and pass the '
            + 'fields the tool takes. `account.itemReductions[item]` goes into ogame_build_cost\'s lifeforms, '
            + '`research` and `levels`/`lifeformLevels` give fromLevel. With `universe` null, ask the player '
            + 'which universe when a tool needs one. Player name and id are not returned; defences and stored '
            + 'resources are left out.',
        inputSchema,
        async run(args) {
            const raw = pickExport(args.export, args.universe);
            const parsed = parseAccountExport(JSON.stringify(raw));
            if (!parsed.ok) {
                if (parsed.reason === 'schema') {
                    throw new ToolError(`schemaVersion ${JSON.stringify(raw.schemaVersion)} is not supported: `
                        + `this server reads ${[...ACCOUNT_EXPORT_SCHEMAS].join(' and ')}.`);
                }
                throw new ToolError('export is not an account export: it needs playerId and planets.');
            }
            const data = parsed.data;
            let universe = data.universe ? { country: data.universe.country, number: data.universe.number } : null;
            if (args.universe) {
                const asked = { country: common.universeRef(args.universe).country, number: args.universe.number };
                if (universe && (universe.country !== asked.country || universe.number !== asked.number)) {
                    throw new ToolError(`The export is from ${universe.country}-${universe.number}, `
                        + `not ${asked.country}-${asked.number}.`);
                }
                universe = asked;
            }
            return {
                universe,
                exportedAt: data.exportedAt,
                account: mapValues(data.account, ACCOUNT_MAP),
                bodies: [
                    ...data.planets.map((planet) => bodyAnswer(planet, true)),
                    ...data.moons.map((moon) => bodyAnswer(moon, false)),
                ],
            };
        },
    };
}

module.exports = { createImportAccountTool, ACCOUNT_MAP, PLANET_MAP, BODY_MAP, lfBuildingFields };
