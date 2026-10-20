'use strict';

// QueueCalculator.simulate(): the queue played through from its starting
// levels. It used to live in the page's orchestration, interleaved with the
// rendering, where only the Playwright suite could reach it; the MCP server
// needs the same arithmetic, so it moved into queue-core.js.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { QueueCalculator } = load(
    ['ogame/calc/js/ogame-costs.js', 'ogame/calc/js/queue-core.js'],
    ['QueueCalculator'],
);

// Mirrored from data/costs-techs.json.
const TECH_COSTS = {
    1: [60, 15, 0, 1.5],
    14: [400, 120, 200, 2],
    15: [1000000, 500000, 100000, 2],
    33: [0, 50000, 100000, 2],
    36: [200, 0, 50, 5],
    41: [20000, 40000, 20000, 2],
};
const calc = new QueueCalculator(TECH_COSTS);

function simulate(startLevels, queue, extra = {}) {
    return calc.simulate({ startLevels, queue, isMoon: false, maxFields: 100, universeSpeed: 1, ionTechLevel: 0, ...extra });
}

describe('QueueCalculator.simulate', () => {
    it('prices each step at the level it builds', () => {
        const run = simulate({ 1: 10 }, [[1, 1], [1, 1]]);
        expect(run.steps.map((s) => s.resultLevel)).toEqual([11, 12]);
        expect(run.steps[0].cost.slice(0, 3)).toEqual([Math.floor(60 * 1.5 ** 10), Math.floor(15 * 1.5 ** 10), 0]);
        expect(run.finalLevels[1]).toBe(12);
    });

    it('speeds up the steps after a Robotics Factory, and after a Nanite Factory on a planet only', () => {
        const mineAfter = (techId, isMoon) =>
            simulate({ 1: 20, 14: 10, 15: 0 }, [[techId, 1], [1, 1]], { isMoon }).steps[1].cost[3];
        const mineAlone = simulate({ 1: 20, 14: 10, 15: 0 }, [[1, 1]]).steps[0].cost[3];
        expect(mineAfter(14, false)).toBeLessThan(mineAlone);
        expect(mineAfter(15, false)).toBe(Math.floor(mineAlone / 2));
        expect(mineAfter(15, true)).toBe(mineAlone);
    });

    it('demolishes down to the level below', () => {
        const run = simulate({ 1: 5 }, [[1, 0]], { ionTechLevel: 4 });
        expect(run.steps[0].resultLevel).toBe(4);
        expect(run.steps[0].isBuild).toBe(false);
        expect(run.totals[0]).toBe(4);
    });

    it('counts fields: the Space Dock takes none, the Terraformer adds 5 or 6', () => {
        const run = simulate({ 1: 9, 33: 0, 36: 0 }, [[36, 1], [33, 1], [33, 1]], { maxFields: 10 });
        expect(run.steps.map((s) => s.usedFields)).toEqual([9, 10, 11]);
        expect(run.steps.map((s) => s.maxFields)).toEqual([10, 15, 21]);
        expect(run.steps.map((s) => s.overCapacity)).toEqual([false, false, false]);
    });

    it('flags a step that needs a field the planet lacks', () => {
        const run = simulate({ 1: 10 }, [[1, 1]], { maxFields: 10 });
        expect(run.steps[0].overCapacity).toBe(true);
        expect(run.overCapacity).toBe(true);
    });

    it('lets a Lunar Base add 3 fields on a moon only', () => {
        expect(simulate({ 41: 0 }, [[41, 1]], { isMoon: true, maxFields: 1 }).maxFields).toBe(4);
        expect(simulate({ 41: 0 }, [[41, 1]], { maxFields: 1 }).maxFields).toBe(1);
    });

    it('skips an entry for a building that has no starting level', () => {
        const run = simulate({ 1: 1 }, [[14, 1], [1, 1]]);
        expect(run.steps.map((s) => s.index)).toEqual([1]);
    });
});
