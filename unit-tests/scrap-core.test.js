'use strict';

// Tests for the Scrap Merchant calculator's formulas (scrap-core.js): the
// return per resource, its rounding, the rate's range, and the flagship case -
// the API 2 export the e2e suite imports too.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { load } = require('./load');
const { expect } = require('./expect');

const { calculateScrap, scrapRate, scrapUnitPayback, SCRAP_FLEET_IDS, SCRAP_DEFENSE_IDS, SCRAP_RATE } = load(
    ['js/utils.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/scrap-core.js'],
    ['calculateScrap', 'scrapRate', 'scrapUnitPayback', 'SCRAP_FLEET_IDS', 'SCRAP_DEFENSE_IDS', 'SCRAP_RATE'],
);

/** The unit prices, the way scrap.php hands them to the page. */
const TECHS = JSON.parse(readFileSync(join(__dirname, '../www/ogame/calc/data/costs-techs.json'), 'utf8')).techs;
const PRICES = Object.fromEntries(Object.entries(TECHS).map(([id, tech]) => [id, tech.cost]));

/** @param {any} value Re-created in this realm, see own-api.test.js. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {Record<string, number>} counts
 * @param {unknown} [rate]
 */
const scrap = (counts, rate = 35) => calculateScrap({ counts, rate }, PRICES);

describe('the units the merchant buys', () => {
    it('lists 17 ships and 10 defenses, 216 not among them', () => {
        expect(SCRAP_FLEET_IDS.length).toBe(17);
        expect(SCRAP_FLEET_IDS.includes(216)).toBe(false);
        expect(plain(SCRAP_DEFENSE_IDS)).toEqual([401, 402, 403, 404, 405, 406, 407, 408, 502, 503]);
    });

    it('has a price for every one of them, none growing with a level', () => {
        [...SCRAP_FLEET_IDS, ...SCRAP_DEFENSE_IDS].forEach((id) => {
            expect(TECHS[id].growth).toBe(1);
            expect(TECHS[id].cost.length).toBe(3);
        });
    });
});

describe('scrapUnitPayback', () => {
    it('pays each resource at the rate', () => {
        // A cruiser: 20000 / 7000 / 2000.
        expect(plain(scrapUnitPayback([20000, 7000, 2000], 35))).toEqual({ metal: 7000, crystal: 2450, deuterium: 700 });
    });

    it('drops the fraction per unit, per resource', () => {
        // 37.3% of an interplanetary missile's 12500 metal is 4662.5.
        expect(plain(scrapUnitPayback([12500, 2500, 10000], 37.3))).toEqual({ metal: 4662, crystal: 932, deuterium: 3730 });
    });

    it('does not lose a unit to float error on a whole result', () => {
        // 57.3 * 1000 / 100 is 572.9999... in floating point.
        expect(scrapUnitPayback([1000, 0, 0], 57.3).metal).toBe(573);
    });
});

describe('scrapRate', () => {
    it('keeps a rate inside the range as it is, fractions included', () => {
        expect(scrapRate(35)).toBe(35);
        expect(scrapRate(37.3)).toBe(37.3);
        expect(scrapRate('42.5')).toBe(42.5);
    });

    it('clamps a rate to 1-100', () => {
        expect(scrapRate(0)).toBe(1);
        expect(scrapRate(-5)).toBe(1);
        expect(scrapRate(150)).toBe(100);
        expect(scrapRate(100)).toBe(100);
        expect(scrapRate(1)).toBe(1);
    });

    it('rounds a rate to two decimals', () => {
        expect(scrapRate(37.346)).toBe(37.35);
        expect(scrapRate(37.344)).toBe(37.34);
    });

    it('gives the default rate for anything that is not a number', () => {
        expect(SCRAP_RATE.def).toBe(35);
        expect(scrapRate(undefined)).toBe(35);
        expect(scrapRate(null)).toBe(35);
        expect(scrapRate('')).toBe(35);
        expect(scrapRate('abc')).toBe(35);
    });
});

describe('calculateScrap', () => {
    it('multiplies the rounded unit payback by the count, not the other way round', () => {
        // 3 IPMs at 37.3%: 3 x 4662 metal, not floor(3 x 4662.5) = 13987.
        const r = scrap({ 503: 3 }, 37.3);
        expect(plain(r.defense.payback)).toEqual({ metal: 13986, crystal: 2796, deuterium: 11190 });
    });

    it('includes the deuterium in the payback', () => {
        const r = scrap({ 214: 1 });
        expect(plain(r.fleet.payback)).toEqual({ metal: 1750000, crystal: 1400000, deuterium: 350000 });
        expect(r.fleet.paybackSum).toBe(3500000);
    });

    it('keeps fleet and defense apart and adds them up in the total', () => {
        const r = scrap({ 202: 10, 401: 100 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 20000, crystal: 20000, deuterium: 0 });
        expect(plain(r.defense.cost)).toEqual({ metal: 200000, crystal: 0, deuterium: 0 });
        expect(plain(r.total.cost)).toEqual({ metal: 220000, crystal: 20000, deuterium: 0 });
        expect(plain(r.total.payback)).toEqual({ metal: 77000, crystal: 7000, deuterium: 0 });
    });

    it('counts the missiles with the defense', () => {
        const r = scrap({ 502: 2 });
        expect(r.fleet.costSum).toBe(0);
        expect(plain(r.defense.cost)).toEqual({ metal: 16000, crystal: 0, deuterium: 4000 });
    });

    it('takes the solar satellite and the crawler as ships', () => {
        const r = scrap({ 212: 1, 217: 1 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 2000, crystal: 4000, deuterium: 1500 });
        expect(r.defense.costSum).toBe(0);
    });

    it('gives the points as the cost in thousands, rounded down', () => {
        expect(scrap({ 204: 1 }).total.points).toBe(4);
        expect(scrap({ 210: 1 }).total.points).toBe(1);
        expect(scrap({ 402: 1, 210: 1 }).total.points).toBe(3);
    });

    it('gives zeros and no ships to haul for nothing at all', () => {
        const r = scrap({});
        expect(r.total.costSum).toBe(0);
        expect(r.total.paybackSum).toBe(0);
        expect(r.total.points).toBe(0);
        expect(plain(r.units)).toEqual({});
        expect(r.transport.small).toBe(0);
        expect(r.transport.large).toBe(0);
    });

    it('gives an empty section its zeros while the other one has units', () => {
        const r = scrap({ 407: 1 });
        expect(plain(r.fleet.cost)).toEqual({ metal: 0, crystal: 0, deuterium: 0 });
        expect(r.defense.costSum).toBe(20000);
    });

    it('ignores ids the merchant does not buy, negatives and fractions of a unit', () => {
        const r = scrap({ 1: 5, 216: 3, 202: -4, 203: 2.7 });
        expect(Object.keys(plain(r.units))).toEqual(['203']);
        expect(r.fleet.cost.metal).toBe(12000);
    });

    it('holds the rate to its range and says which one it used', () => {
        expect(scrap({ 202: 1 }, 250).rate).toBe(100);
        expect(scrap({ 202: 1 }, 250).total.paybackSum).toBe(4000);
        expect(scrap({ 202: 1 }, undefined).rate).toBe(35);
    });

    it('rounds the cargo ships up, at the base holds', () => {
        const r = scrap({ 202: 15 });
        // 15 x 700 x 2 = 21000: five small cargoes of 5000, one large of 25000.
        expect(r.transport.smallHold).toBe(5000);
        expect(r.transport.largeHold).toBe(25000);
        expect(r.transport.small).toBe(5);
        expect(r.transport.large).toBe(1);
    });

    it('prices a planet out of the API 2 export at the default rate', () => {
        const ownApi = JSON.parse(readFileSync(join(__dirname, '../playwright-tests/fixtures/own_api.json'), 'utf8'));
        /** @type {Record<string, number>} */
        const counts = {};
        Object.entries(ownApi.ships).forEach(([id, ship]) => { if (Number(id) < 400) counts[id] = ship.amount; });
        Object.entries({ ...ownApi.defenses, ...ownApi.missiles }).forEach(([id, unit]) => { counts[id] = unit.amount; });
        const r = scrap(counts);
        expect(plain(r.fleet.cost)).toEqual({ metal: 48177000, crystal: 55175000, deuterium: 1048000 });
        expect(plain(r.fleet.payback)).toEqual({ metal: 16861950, crystal: 19311250, deuterium: 366800 });
        expect(plain(r.defense.cost)).toEqual({ metal: 116085000, crystal: 43855000, deuterium: 14200000 });
        expect(plain(r.defense.payback)).toEqual({ metal: 40629750, crystal: 15349250, deuterium: 4970000 });
        expect(r.total.costSum).toBe(278540000);
        expect(r.total.paybackSum).toBe(97489000);
        expect(r.total.points).toBe(278540);
        expect(r.transport.small).toBe(19498);
        expect(r.transport.large).toBe(3900);
    });
});
