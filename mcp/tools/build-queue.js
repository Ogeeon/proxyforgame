'use strict';

// A queue of building upgrades and demolitions on one planet or moon - the
// queue calculator, played through by QueueCalculator.simulate() in its own
// queue-core.js, with the buildings of www/ogame/calc/data/costs-techs.json.

const { loadBrowserScripts, readWwwJson } = require('../lib/browser-scripts');
const { ToolError } = require('../lib/protocol');
const { formatDuration } = require('../lib/format');
const common = require('./common');

const { QueueCalculator, NON_DESTROYABLE_TECHS } = loadBrowserScripts(
    ['ogame/calc/js/ogame-costs.js', 'ogame/calc/js/queue-core.js'],
    ['QueueCalculator', 'NON_DESTROYABLE_TECHS'],
);

/** @type {{techs: Record<string, {key: string, type: number, cost: number[], growth: number}>}} */
const TECHS = readWwwJson('ogame/calc/data/costs-techs.json');
const NAMES = common.englishNames('queue');

/** Buildings only: 1 planet or moon, 2 planet, 3 moon - what queue.php offers. */
const BUILDINGS = Object.entries(TECHS.techs)
    .filter(([, tech]) => tech.type <= 3)
    .map(([id, tech]) => ({ id: Number(id), key: tech.key, type: tech.type }));
const BY_KEY = new Map(BUILDINGS.map((b) => [b.key, b]));
const TECH_COSTS = Object.fromEntries(BUILDINGS.map((b) => {
    const tech = TECHS.techs[b.id];
    return [b.id, [...tech.cost, tech.growth]];
}));

const MAX_STEPS = 500;

const inputSchema = {
    type: 'object',
    properties: {
        location: { type: 'string', enum: ['planet', 'moon'], default: 'planet' },
        levels: common.keyedMap(BUILDINGS.map((b) => b.key), { type: 'integer', minimum: 0, maximum: 100 },
            'Current building levels; a building left out is at 0. '
            + BUILDINGS.map((b) => `${b.key}: ${NAMES[b.key] ?? b.key}${{ 1: '', 2: ' (planet)', 3: ' (moon)' }[b.type]}`).join(', ') + '.'),
        queue: {
            type: 'array',
            minItems: 1,
            description: 'The steps in order. Each builds or demolishes one level, `times` times in a row.',
            items: {
                type: 'object',
                properties: {
                    building: { type: 'string', enum: BUILDINGS.map((b) => b.key) },
                    action: { type: 'string', enum: ['build', 'demolish'], default: 'build' },
                    times: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
                },
                required: ['building'],
                additionalProperties: false,
            },
        },
        fields: {
            type: 'integer', minimum: 1, maximum: 1000,
            description: 'Fields of the planet or moon before the queue. Leave out to skip the field check.',
        },
        universe: common.universeSchema,
        universeSpeed: common.universeSpeedSchema,
        ionTechnology: common.ionTechnologySchema,
    },
    required: ['queue'],
    additionalProperties: false,
};

/**
 * Starting levels of every building the location offers, refusing a level for
 * one it does not.
 * @param {Record<string, number>} levels
 * @param {{id: number, key: string}[]} offered
 * @param {string} where "a planet" or "a moon"
 * @returns {Record<number, number>}
 */
function startLevelsFor(levels, offered, where) {
    const offeredKeys = new Set(offered.map((b) => b.key));
    for (const [key, level] of Object.entries(levels)) {
        if (!offeredKeys.has(key) && level > 0) {
            throw new ToolError(`${NAMES[key] ?? key} cannot stand on ${where}.`);
        }
    }
    return Object.fromEntries(offered.map((b) => [b.id, levels[b.key] ?? 0]));
}

/**
 * The queue as the [techId, 1 build | 0 demolish] pairs simulate() takes, one
 * per level, refusing what the game would not allow.
 * @param {{building: string, action: string, times: number}[]} steps
 * @param {Record<number, number>} startLevels the offered buildings only
 * @param {string} where
 * @returns {number[][]}
 */
function expandQueue(steps, startLevels, where) {
    /** @type {number[][]} */
    const queue = [];
    const projected = { ...startLevels };
    for (const step of steps) {
        const b = /** @type {{id: number, key: string}} */ (BY_KEY.get(step.building));
        const build = step.action === 'build';
        projected[b.id] = levelAfter(b, build, step.times, projected[b.id], where);
        for (let i = 0; i < step.times; i++) {
            queue.push([b.id, build ? 1 : 0]);
        }
    }
    if (queue.length > MAX_STEPS) {
        throw new ToolError(`The queue has ${queue.length} steps; at most ${MAX_STEPS} are taken.`);
    }
    return queue;
}

/**
 * A building's level after `times` builds or demolitions, refusing a building
 * the location does not offer, a demolition the game does not allow, and one
 * that would go below 0.
 * @param {{id: number, key: string}} b
 * @param {boolean} build
 * @param {number} times
 * @param {number|undefined} level undefined when the location does not offer it
 * @param {string} where
 */
function levelAfter(b, build, times, level, where) {
    const name = NAMES[b.key] ?? b.key;
    if (level === undefined) {
        throw new ToolError(`${name} cannot be built on ${where}.`);
    }
    if (!build && NON_DESTROYABLE_TECHS.has(b.id)) {
        throw new ToolError(`${name} cannot be demolished.`);
    }
    const after = level + (build ? times : -times);
    if (after < 0) {
        throw new ToolError(`The queue demolishes ${name} below level 0.`);
    }
    return after;
}

const KEY_OF = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.key]));

/**
 * One simulated step, for the answer.
 * @param {any} step a QueueStep
 * @param {number} elapsed seconds from the start of the queue to the end of this step
 * @param {boolean} checkFields
 */
function describeStep(step, elapsed, checkFields) {
    const key = KEY_OF[step.techId];
    /** @type {Record<string, unknown>} */
    const out = {
        building: key,
        name: NAMES[key] ?? key,
        action: step.isBuild ? 'build' : 'demolish',
        toLevel: step.resultLevel,
        metal: step.cost[0],
        crystal: step.cost[1],
        deuterium: step.cost[2],
        durationSeconds: step.cost[3],
        duration: formatDuration(step.cost[3]),
        finishesAfter: formatDuration(elapsed),
    };
    if (checkFields) {
        out.fields = `${step.usedFields}/${step.maxFields}`;
        if (step.overCapacity) out.noFreeField = true;
    }
    return out;
}

/**
 * @param {{siteApi: import('./common').SiteApi}} deps
 * @returns {import('../lib/protocol').Tool}
 */
function createBuildQueueTool({ siteApi }) {
    const calc = new QueueCalculator(TECH_COSTS);
    return {
        name: 'ogame_build_queue',
        title: 'OGame building queue',
        description: 'Cost and time of a sequence of building upgrades and demolitions on one planet or moon, each '
            + 'step timed with the Robotics and Nanite Factory levels the steps before it reached, plus the '
            + 'fields used. Uses the ProxyForGame queue calculator.',
        inputSchema,
        openWorld: true,
        async run(args) {
            const isMoon = args.location === 'moon';
            const where = isMoon ? 'a moon' : 'a planet';
            const offered = BUILDINGS.filter((b) => b.type === 1 || b.type === (isMoon ? 3 : 2));
            const startLevels = startLevelsFor(args.levels ?? {}, offered, where);
            const queue = expandQueue(args.queue, startLevels, where);

            const universeSpeed = await common.economySpeed(args, siteApi);
            const checkFields = args.fields !== undefined;
            const run = calc.simulate({
                startLevels,
                queue,
                isMoon,
                maxFields: checkFields ? args.fields : Number.MAX_SAFE_INTEGER,
                universeSpeed,
                ionTechLevel: args.ionTechnology,
            });

            let elapsed = 0;
            const steps = run.steps.map((/** @type {any} */ step) => {
                elapsed += step.cost[3];
                return describeStep(step, elapsed, checkFields);
            });

            /** @type {Record<string, unknown>} */
            const result = {
                location: args.location,
                steps,
                total: {
                    metal: run.totals[1],
                    crystal: run.totals[2],
                    deuterium: run.totals[3],
                    durationSeconds: run.totals[4],
                    duration: formatDuration(run.totals[4]),
                },
                universeSpeed,
            };
            if (checkFields) {
                result.fields = { used: run.totals[0], available: run.maxFields };
                if (run.steps.some((/** @type {any} */ step) => step.overCapacity)) {
                    result.note = 'Some steps need a field the planet does not have (marked noFreeField).';
                }
            }
            return result;
        },
    };
}

module.exports = { createBuildQueueTool };
