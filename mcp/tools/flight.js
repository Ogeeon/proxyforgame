'use strict';

// Flight time, deuterium and cargo for a fleet between two coordinates - the
// flight calculator's main table, computed by its own flight-core.js.

const { loadBrowserScripts } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const { formatDuration } = require('../lib/format');
const { keyedMap } = require('./common');

const { FlightCalculator, SHIPS_BASE, MISSION, PLAYER_CLASS } = loadBrowserScripts(
    ['ogame/calc/js/flight-core.js'],
    ['FlightCalculator', 'SHIPS_BASE', 'MISSION', 'PLAYER_CLASS'],
);

/** Ship keys in the order flight-core.js indexes them - the site's own input ids. */
const SHIP_KEYS = /** @type {string[]} */ (SHIPS_BASE.map((/** @type {any[]} */ ship) => ship[0]));

const MISSIONS = {
    peaceful: MISSION.PEACEFUL,
    war: MISSION.WAR,
    holding: MISSION.HOLDING,
    destroy: MISSION.DESTROY,
};

const CLASSES = {
    collector: PLAYER_CLASS.COLLECTOR,
    general: PLAYER_CLASS.GENERAL,
    discoverer: PLAYER_CLASS.DISCOVERER,
    // No flight rule reads the discoverer, so "no class" flies exactly like one.
    none: PLAYER_CLASS.DISCOVERER,
};

/** Universe settings the site starts from before a universe is picked. */
const DEFAULT_UNIVERSE = {
    fleetSpeedWar: 1,
    fleetSpeedPeaceful: 1,
    fleetSpeedHolding: 1,
    galaxies: 9,
    systems: 499,
    circularGalaxies: false,
    circularSystems: false,
    deuteriumFactor: 1,
    generalFuelReduction: 25,
    probeCargo: 0,
    ignoreEmptySystems: false,
    ignoreInactiveSystems: false,
};

/**
 * @param {string} what
 * @param {number} max
 */
const level = (what, max = 50) => ({ type: 'integer', minimum: 0, maximum: max, default: 0, description: what });

const coordinates = (/** @type {string} */ what) => ({
    type: 'object',
    description: `${what} coordinates, galaxy:system:position.`,
    properties: {
        galaxy: { type: 'integer', minimum: 1, maximum: 50 },
        system: { type: 'integer', minimum: 1, maximum: 999 },
        position: { type: 'integer', minimum: 1, maximum: 16, description: '1-15 are planets, 16 is the expedition slot.' },
    },
    required: ['galaxy', 'system', 'position'],
    additionalProperties: false,
});

const inputSchema = {
    type: 'object',
    properties: {
        from: coordinates('Departure'),
        to: coordinates('Destination'),
        ships: keyedMap(SHIP_KEYS, { type: 'integer', minimum: 0 },
            'How many of each ship fly. At least one ship is needed; the slowest one sets the fleet speed.'),
        mission: {
            type: 'string',
            enum: Object.keys(MISSIONS),
            default: 'peaceful',
            description: 'Which universe fleet speed applies. peaceful: transport, deploy, colonise, '
                + 'harvest, expedition. war: attack, ACS attack, espionage. holding: ACS defend. '
                + 'destroy: moon destruction, which always flies at a fixed speed of 310.',
        },
        speedPercent: {
            type: 'integer',
            minimum: 5,
            maximum: 100,
            description: 'Fleet speed setting. Steps of 10, or of 5 for the General class. '
                + 'Leave out to get every step.',
        },
        drives: {
            type: 'object',
            description: 'Drive research levels.',
            properties: {
                combustion: level('Combustion Drive level'),
                impulse: level('Impulse Drive level'),
                hyperspace: level('Hyperspace Drive level'),
            },
            additionalProperties: false,
        },
        hyperspaceTechnology: level('Hyperspace Technology level; adds 5% cargo per level'),
        playerClass: { type: 'string', enum: Object.keys(CLASSES), default: 'none' },
        allianceClass: {
            type: 'string',
            enum: ['none', 'trader', 'warrior'],
            default: 'none',
            description: 'trader: +10% speed for cargo ships. warrior: +10% speed on holding missions.',
        },
        lifeforms: {
            type: 'object',
            description: 'Life form bonuses, as percentages the game shows.',
            properties: {
                mechaGeneralEnhancement: {
                    type: 'number', minimum: 0, default: 0,
                    description: 'Mechas "General Enhancement": raises the General class ship bonuses.',
                },
                rocktalCollectorEnhancement: {
                    type: 'number', minimum: 0, default: 0,
                    description: 'Rock\'tal "Collector Enhancement": raises the Collector class ship bonuses.',
                },
                shipBonuses: keyedMap(SHIP_KEYS, {
                    type: 'object',
                    properties: {
                        speed: { type: 'number', minimum: 0, default: 0 },
                        cargo: { type: 'number', minimum: 0, default: 0 },
                        fuel: { type: 'number', minimum: 0, maximum: 90, default: 0, description: 'Fuel consumption reduction' },
                    },
                    additionalProperties: false,
                }, 'Per-ship life form bonuses in percent, keyed like `ships`.'),
            },
            additionalProperties: false,
        },
        universe: {
            type: 'object',
            description: 'A live universe, e.g. {"country": "en", "number": 152} for s152-en.ogame.gameforge.com. '
                + 'Its fleet speeds, size, donut settings, deuterium factor and system skipping are read from '
                + 'the game. Anything in universeSettings overrides what is read.',
            properties: {
                country: { type: 'string', description: 'Two or three letters: en, de, ru, us, ...' },
                number: { type: 'integer', minimum: 1 },
            },
            required: ['country', 'number'],
            additionalProperties: false,
        },
        universeSettings: {
            type: 'object',
            description: 'Universe settings given by hand. Unset ones come from `universe` when it is given, '
                + 'else from the defaults (1x speeds, 9 galaxies of 499 systems, no donut).',
            properties: {
                fleetSpeedWar: { type: 'number', minimum: 1, maximum: 10 },
                fleetSpeedPeaceful: { type: 'number', minimum: 1, maximum: 10 },
                fleetSpeedHolding: { type: 'number', minimum: 1, maximum: 10 },
                galaxies: { type: 'integer', minimum: 1, maximum: 50 },
                systems: { type: 'integer', minimum: 1, maximum: 999 },
                circularGalaxies: { type: 'boolean' },
                circularSystems: { type: 'boolean' },
                deuteriumFactor: { type: 'number', minimum: 0.5, maximum: 1, description: 'Fuel consumption factor, 0.5-1.' },
                generalFuelReduction: { type: 'number', minimum: 0, maximum: 50, description: 'General class fuel reduction in percent.' },
                probeCargo: { type: 'integer', minimum: 0, maximum: 100, description: 'Espionage probe cargo capacity.' },
                ignoreEmptySystems: { type: 'boolean', description: 'Fleets skip systems with no planets.' },
                ignoreInactiveSystems: { type: 'boolean', description: 'Fleets skip systems with only inactive players.' },
                skippedSystems: {
                    type: 'integer', minimum: 0,
                    description: 'How many systems on the way are skipped, when you know it. Overrides the count '
                        + 'the server works out from the universe\'s population.',
                },
            },
            additionalProperties: false,
        },
    },
    required: ['from', 'to', 'ships'],
    additionalProperties: false,
};

/**
 * @param {{siteApi: ReturnType<typeof import('../lib/site-api').createSiteApi>}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createFlightTool({ siteApi }) {
    const calc = new FlightCalculator();

    /**
     * Universe settings: defaults, then the live universe, then what was given by hand.
     * @param {any} args
     */
    async function resolveUniverse(args) {
        const settings = { ...DEFAULT_UNIVERSE };
        /** @type {{populatedSystems: any, populatedSystemsAll: any}|null} */
        let population = null;
        let source = 'defaults';

        if (args.universe) {
            const ref = { country: String(args.universe.country).toLowerCase(), universe: args.universe.number };
            if (!/^[a-z]{2,3}$/.test(ref.country)) {
                throw new ToolError('universe.country must be two or three letters, like "en" or "de".');
            }
            Object.assign(settings, fromServerData(await siteApi.serverData(ref)));
            source = `${ref.country}-${ref.universe}`;
            if (settings.ignoreEmptySystems || settings.ignoreInactiveSystems) {
                population = await siteApi.populatedSystems(ref);
            }
        }
        const manual = args.universeSettings ?? {};
        for (const [key, value] of Object.entries(manual)) {
            if (key !== 'skippedSystems') {
                /** @type {Record<string, unknown>} */ (settings)[key] = value;
            }
        }
        if (Object.keys(manual).length > 0) {
            source = source === 'defaults' ? 'given' : `${source}, with overrides`;
        }
        return { settings, population, source, skippedOverride: manual.skippedSystems };
    }

    return {
        name: 'ogame_flight',
        title: 'OGame flight time and fuel',
        description: 'Flight duration, deuterium consumption and cargo capacity of an OGame fleet between two '
            + 'coordinates, using the formulas of the ProxyForGame flight calculator. Give a live universe to '
            + 'pick up its fleet speeds and settings, or give them in universeSettings. Durations are one way.',
        inputSchema,
        openWorld: true,
        async run(args) {
            const { settings, population, source, skippedOverride } = await resolveUniverse(args);
            for (const [name, point] of [['from', args.from], ['to', args.to]]) {
                if (point.galaxy > settings.galaxies) {
                    throw new ToolError(`${name}.galaxy ${point.galaxy} is past the last galaxy (${settings.galaxies}).`);
                }
                if (point.system > settings.systems) {
                    throw new ToolError(`${name}.system ${point.system} is past the last system (${settings.systems}).`);
                }
            }

            const counts = SHIP_KEYS.map((key) => args.ships[key] ?? 0);
            if (!counts.some((count) => count > 0)) {
                throw new ToolError('The fleet is empty: give at least one ship in `ships`.');
            }

            const playerClass = CLASSES[/** @type {keyof typeof CLASSES} */ (args.playerClass)];
            const isGeneral = args.playerClass === 'general';
            if (args.speedPercent !== undefined && args.speedPercent % (isGeneral ? 5 : 10) !== 0) {
                throw new ToolError(isGeneral
                    ? 'speedPercent must be a multiple of 5.'
                    : 'speedPercent must be a multiple of 10; only the General class flies in steps of 5.');
            }

            const shipBonuses = args.lifeforms?.shipBonuses ?? {};
            const params = {
                driveLevels: [args.drives.combustion, args.drives.impulse, args.drives.hyperspace],
                fleetSpeedWar: settings.fleetSpeedWar,
                fleetSpeedPeaceful: settings.fleetSpeedPeaceful,
                fleetSpeedHolding: settings.fleetSpeedHolding,
                circularGalaxies: settings.circularGalaxies,
                circularSystems: settings.circularSystems,
                numberOfGalaxies: settings.galaxies,
                numberOfSystems: settings.systems,
                deutFactor: Math.round(settings.deuteriumFactor * 10),
                deutConsReduction: settings.generalFuelReduction,
                hyperTechLvl: args.hyperspaceTechnology,
                spCargohold: settings.probeCargo,
                playerClass,
                missionType: MISSIONS[/** @type {keyof typeof MISSIONS} */ (args.mission)],
                traderBonus: args.allianceClass === 'trader',
                warriorBonus: args.allianceClass === 'warrior',
                lfMechanGE: args.lifeforms?.mechaGeneralEnhancement ?? 0,
                lfRocktalCE: args.lifeforms?.rocktalCollectorEnhancement ?? 0,
                lfShipsBonuses: SHIP_KEYS.map((key) => {
                    const bonus = shipBonuses[key];
                    return bonus ? [bonus.speed, bonus.cargo, bonus.fuel] : [0, 0, 0];
                }),
                fleetIgnoreEmptySystems: settings.ignoreEmptySystems,
                fleetIgnoreInactiveSystems: settings.ignoreInactiveSystems,
                populatedSystems: population?.populatedSystems ?? null,
                populatedSystemsAll: population?.populatedSystemsAll ?? null,
                emptySystemsOverrideEnabled: skippedOverride !== undefined,
                emptySystemsOverride: skippedOverride ?? 0,
            };

            const ships = calc.buildShipsData(params.driveLevels, params.spCargohold);
            const from = [args.from.galaxy, args.from.system, args.from.position];
            const to = [args.to.galaxy, args.to.system, args.to.position];
            const { distance, emptySystems } = calc.getDistance(from, to, params);

            const minSpeed = calc.getMinSpeed(ships, counts, params);
            const flightSpeed = calc.speedForMission(params.missionType, minSpeed);
            const fleetSpeed = calc.fleetSpeedFor(params.missionType, params);
            const fixedSpeed = params.missionType === MISSION.DESTROY ? flightSpeed : 0;

            const step = isGeneral ? 5 : 10;
            const percents = args.speedPercent !== undefined
                ? [args.speedPercent]
                : Array.from({ length: 100 / step }, (_, i) => 100 - i * step);

            const flights = percents.map((percent) => {
                const duration = calc.getFlightDuration(flightSpeed, distance, percent, fleetSpeed);
                return {
                    speedPercent: percent,
                    durationSeconds: duration,
                    duration: formatDuration(duration),
                    deuterium: calc.getDeutConsumption(ships, counts, distance, duration, fleetSpeed, params, fixedSpeed),
                };
            });

            /** @type {Record<string, unknown>} */
            const result = {
                distance,
                fleetSpeed: flightSpeed,
                cargoCapacity: calc.getCargoCapacity(ships, counts, params),
                flights,
                universe: {
                    source,
                    fleetSpeedFactor: fleetSpeed,
                    galaxies: settings.galaxies,
                    systems: settings.systems,
                    circularGalaxies: settings.circularGalaxies,
                    circularSystems: settings.circularSystems,
                    deuteriumFactor: settings.deuteriumFactor,
                    ignoreEmptySystems: settings.ignoreEmptySystems,
                    ignoreInactiveSystems: settings.ignoreInactiveSystems,
                },
            };
            const skips = settings.ignoreEmptySystems || settings.ignoreInactiveSystems;
            if (skips) {
                result.skippedSystems = emptySystems;
                if (skippedOverride === undefined && params.populatedSystems === null && from[1] !== to[1]
                    && from[0] === to[0]) {
                    result.note = 'The universe skips systems, but no population data was available, so no '
                        + 'system was counted as skipped: the real flight may be shorter. Pass '
                        + 'universeSettings.skippedSystems if you know the count.';
                }
            }
            return result;
        },
    };
}

/**
 * Flight settings from a universe's serverData, the way the calculator's
 * universe picker applies them (fetchServerData in flight-orchestration.js).
 * @param {Record<string, string>} data
 */
function fromServerData(data) {
    /** @type {Partial<typeof DEFAULT_UNIVERSE>} */
    const out = {};
    const num = (/** @type {string} */ key) => {
        const value = Number.parseFloat(data[key]);
        return Number.isFinite(value) ? value : undefined;
    };
    const set = (/** @type {keyof typeof DEFAULT_UNIVERSE} */ key, /** @type {unknown} */ value) => {
        if (value !== undefined) {
            /** @type {Record<string, unknown>} */ (out)[key] = value;
        }
    };
    set('fleetSpeedWar', num('speedFleetWar'));
    set('fleetSpeedPeaceful', num('speedFleetPeaceful'));
    set('fleetSpeedHolding', num('speedFleetHolding'));
    set('galaxies', num('galaxies'));
    set('systems', num('systems'));
    set('circularGalaxies', data.donutGalaxy === undefined ? undefined : data.donutGalaxy === '1');
    set('circularSystems', data.donutSystem === undefined ? undefined : data.donutSystem === '1');
    const deut = num('globalDeuteriumSaveFactor');
    set('deuteriumFactor', deut === undefined ? undefined : Math.round(deut * 10) / 10);
    const general = num('warriorBonusFuelConsumption');
    set('generalFuelReduction', general === undefined ? undefined : Math.round(general * 100));
    set('probeCargo', num('probeCargo'));
    set('ignoreEmptySystems', data.fleetIgnoreEmptySystems === '1');
    set('ignoreInactiveSystems', data.fleetIgnoreInactiveSystems === '1');
    return out;
}

module.exports = { createFlightTool, SHIP_KEYS };
