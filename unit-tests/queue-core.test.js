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
    45: [90, 45, 15, 1.5],
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

    it('counts a field for each level of the Interstellar Anomaly Scanner', () => {
        const run = simulate({ 1: 9, 45: 0 }, [[45, 1], [45, 1]]);
        expect(run.steps.map((s) => s.usedFields)).toEqual([10, 11]);
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

// Life form research gives the Terraformer 0.1% off its cost and 0.2% off its
// build time per level, capped at 50% and 99%; a time reduction of 0 means
// twice the cost one. Levels 1-4 without a robotics factory take 20571 + 48000
// + 115200 + 288000 = 471771 s and cost 750000 crystal, 1500000 deuterium.
describe('QueueCalculator.simulate - the Terraformer life form reductions', () => {
    const TERRAFORMER_X4 = [[33, 1], [33, 1], [33, 1], [33, 1]];
    const totals = (extra) => simulate({ 33: 0 }, TERRAFORMER_X4, extra).totals.slice(1);

    it('changes nothing without them', () => {
        expect(totals({})).toEqual([0, 750000, 1500000, 471771]);
    });

    it('takes twice the cost reduction off the time when no time reduction is given', () => {
        // 40% off the cost, 80% off the time: 4114 + 9600 + 23040 + 57600.
        expect(totals({ lfTerraformerRdc: 40 })).toEqual([0, 450000, 900000, 94354]);
    });

    it('uses a given time reduction as it is', () => {
        // 10% off the time, each step floored: 18513 + 43200 + 103680 + 259200.
        expect(totals({ lfTerraformerRdc: 40, lfTerraformerTimeRdc: 10 })).toEqual([0, 450000, 900000, 424593]);
    });

    it('caps the cost reduction at 50% and the time one at 99%', () => {
        // 99% off the time: 205 + 480 + 1152 + 2880.
        expect(totals({ lfTerraformerRdc: 80, lfTerraformerTimeRdc: 150 })).toEqual([0, 375000, 750000, 4717]);
    });

    it('leaves the other buildings alone', () => {
        const plain = simulate({ 1: 10, 14: 2 }, [[1, 1], [14, 1]]).totals;
        const reduced = simulate({ 1: 10, 14: 2 }, [[1, 1], [14, 1]], { lfTerraformerRdc: 40, lfTerraformerTimeRdc: 60 }).totals;
        expect(reduced).toEqual(plain);
    });
});
