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
        ionTechnology: common.level('Ion Technology level: cheaper demolition', 50),
    },
    required: ['queue'],
    additionalProperties: false,
};

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
            const offered = BUILDINGS.filter((b) => b.type === 1 || b.type === (isMoon ? 3 : 2));
            const offeredIds = new Set(offered.map((b) => b.id));
            const where = isMoon ? 'a moon' : 'a planet';

            const levels = args.levels ?? {};
            for (const key of Object.keys(levels)) {
                if (!offeredIds.has(/** @type {{id: number}} */ (BY_KEY.get(key)).id) && levels[key] > 0) {
                    throw new ToolError(`${NAMES[key] ?? key} cannot stand on ${where}.`);
                }
            }
            /** @type {Record<number, number>} */
            const startLevels = Object.fromEntries(offered.map((b) => [b.id, levels[b.key] ?? 0]));

            /** @type {number[][]} */
            const queue = [];
            /** @type {Record<number, number>} */
            const projected = { ...startLevels };
            for (const step of args.queue) {
                const b = /** @type {{id: number, key: string}} */ (BY_KEY.get(step.building));
                const name = NAMES[b.key] ?? b.key;
                if (!offeredIds.has(b.id)) {
                    throw new ToolError(`${name} cannot be built on ${where}.`);
                }
                const build = step.action === 'build';
                if (!build && NON_DESTROYABLE_TECHS.has(b.id)) {
                    throw new ToolError(`${name} cannot be demolished.`);
                }
                for (let i = 0; i < step.times; i++) {
                    projected[b.id] += build ? 1 : -1;
                    if (projected[b.id] < 0) {
                        throw new ToolError(`The queue demolishes ${name} below level 0.`);
                    }
                    queue.push([b.id, build ? 1 : 0]);
                }
            }
            if (queue.length > MAX_STEPS) {
                throw new ToolError(`The queue has ${queue.length} steps; at most ${MAX_STEPS} are taken.`);
            }

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

            const keyOf = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.key]));
            let elapsed = 0;
            const steps = run.steps.map((/** @type {any} */ s) => {
                elapsed += s.cost[3];
                /** @type {Record<string, unknown>} */
                const out = {
                    building: keyOf[s.techId],
                    name: NAMES[keyOf[s.techId]] ?? keyOf[s.techId],
                    action: s.isBuild ? 'build' : 'demolish',
                    toLevel: s.resultLevel,
                    metal: s.cost[0],
                    crystal: s.cost[1],
                    deuterium: s.cost[2],
                    durationSeconds: s.cost[3],
                    duration: formatDuration(s.cost[3]),
                    finishesAfter: formatDuration(elapsed),
                };
                if (checkFields) {
                    out.fields = `${s.usedFields}/${s.maxFields}`;
                    if (s.overCapacity) out.noFreeField = true;
                }
                return out;
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
                if (run.steps.some((/** @type {any} */ s) => s.overCapacity)) {
                    result.note = 'Some steps need a field the planet does not have (marked noFreeField).';
                }
            }
            return result;
        },
    };
}

module.exports = { createBuildQueueTool };
