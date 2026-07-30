'use strict';

// Tests for the shared normalizer of OGame's "API 2" export (own-api.js). It is
// DOM-free by design, so the Playwright suites only need to cover the wiring
// around it: the shapes the game can send are pinned down here.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { parseOwnApi, bonusPercent } = load(
    ['js/utils.js', 'ogame/calc/js/own-api.js'],
    ['parseOwnApi', 'bonusPercent'],
);

/**
 * Re-create a value in this realm. `load()` runs the sources inside a vm
 * context, so what they return carries that context's `Object.prototype` and
 * would fail `deepStrictEqual` against a plain literal written here.
 *
 * @param {any} value
 */
const plain = (value) => JSON.parse(JSON.stringify(value));

/** A trimmed export: two ships, one of them carrying life-form bonuses. */
const EXPORT = JSON.stringify({
    coords: '5:254:14',
    characterClassId: 3,
    allianceClassId: 2,
    researches: { 114: 9, 115: 14 },
    defenses: { 401: { amount: 26100 } },
    missiles: { 502: { amount: 0 } },
    fleetspeed: 10,
    ships: {
        202: { amount: 8855, weapon: 0, cargo: 0, speed: 0, fuel: 0.0006324 },
        204: { amount: 407, weapon: 0.003066, cargo: 0.003066, speed: 0.003066, fuel: 0.0006324 },
    },
    bonuses: { characterClassBooster: { 1: 0, 2: 0.15, 3: 0 } },
});

describe('parseOwnApi - rejected input', () => {
    it('returns null for malformed JSON', () => {
        expect(parseOwnApi('{not valid json')).toBeNull();
    });

    it('returns null for a bare primitive JSON.parse would accept', () => {
        expect(parseOwnApi('111')).toBeNull();
        expect(parseOwnApi('"5:254:14"')).toBeNull();
        expect(parseOwnApi('null')).toBeNull();
    });

    it('returns null for an array', () => {
        expect(parseOwnApi('[{"coords":"5:254:14"}]')).toBeNull();
    });
});

describe('parseOwnApi - a full export', () => {
    it('parses the coordinates into numbers', () => {
        expect(plain(parseOwnApi(EXPORT).coords)).toEqual({ galaxy: 5, system: 254, position: 14 });
    });

    it('keeps the class ids as sent', () => {
        const data = parseOwnApi(EXPORT);
        expect(data.characterClassId).toBe(3);
        expect(data.allianceClassId).toBe(2);
    });

    it('keeps the research levels', () => {
        expect(plain(parseOwnApi(EXPORT).researches)).toEqual({ 114: 9, 115: 14 });
    });

    it('converts the per-ship bonus fractions into percentages', () => {
        const ships = parseOwnApi(EXPORT).ships;
        expect(plain(ships['204'])).toEqual({ amount: 407, cargo: 0.3066, speed: 0.3066, fuel: 0.06324 });
        expect(plain(ships['202'])).toEqual({ amount: 8855, cargo: 0, speed: 0, fuel: 0.06324 });
    });

    it('lifts the character class boosters out of the bonuses block', () => {
        expect(plain(parseOwnApi(EXPORT).classBoosters)).toEqual({ 1: 0, 2: 15, 3: 0 });
    });

    it('drops the fields no calculator consumes', () => {
        const data = parseOwnApi(EXPORT);
        expect(Object.keys(data).sort()).toEqual(
            ['allianceClassId', 'characterClassId', 'classBoosters', 'coords', 'researches', 'ships'],
        );
    });
});

describe('parseOwnApi - partial exports', () => {
    it('gives an empty ships map when the export has no ships', () => {
        expect(plain(parseOwnApi('{"coords":"1:2:3"}').ships)).toEqual({});
    });

    it('gives zero class ids when the export names no class', () => {
        const data = parseOwnApi('{"ships":{}}');
        expect(data.characterClassId).toBe(0);
        expect(data.allianceClassId).toBe(0);
    });

    it('gives null coordinates for anything but three numbers', () => {
        expect(parseOwnApi('{"coords":"5:254"}').coords).toBeNull();
        expect(parseOwnApi('{"coords":"a:b:c"}').coords).toBeNull();
        expect(parseOwnApi('{"coords":42}').coords).toBeNull();
        expect(parseOwnApi('{"ships":{}}').coords).toBeNull();
    });

    it('fills in the missing bonus fields of a ship with zeros', () => {
        expect(plain(parseOwnApi('{"ships":{"203":{"amount":10}}}').ships['203']))
            .toEqual({ amount: 10, cargo: 0, speed: 0, fuel: 0 });
    });

    it('skips a ship entry that is not an object', () => {
        expect(plain(parseOwnApi('{"ships":{"203":null,"204":5,"205":{"amount":1}}}').ships))
            .toEqual({ 205: { amount: 1, cargo: 0, speed: 0, fuel: 0 } });
    });

    it('ignores a research level that is not a number', () => {
        expect(plain(parseOwnApi('{"researches":{"114":9,"115":"x"}}').researches)).toEqual({ 114: 9 });
    });

    it('gives an empty booster map when the bonuses block is absent', () => {
        expect(plain(parseOwnApi('{"bonuses":{}}').classBoosters)).toEqual({});
        expect(plain(parseOwnApi('{"ships":{}}').classBoosters)).toEqual({});
    });
});

describe('bonusPercent', () => {
    it('turns a fraction into a percentage', () => {
        expect(bonusPercent(0.003066, 4)).toBe(0.3066);
        expect(bonusPercent(0.25, 4)).toBe(25);
    });

    it('rounds to the requested digits instead of truncating', () => {
        expect(bonusPercent(0.00306695, 4)).toBe(0.3067);
        expect(bonusPercent(0.00306694, 4)).toBe(0.3067);
        expect(bonusPercent(0.0006324, 5)).toBe(0.06324);
    });

    it('gives 0 for anything non-numeric', () => {
        expect(bonusPercent(undefined, 4)).toBe(0);
        expect(bonusPercent(null, 4)).toBe(0);
        expect(bonusPercent('abc', 4)).toBe(0);
        expect(bonusPercent(Infinity, 4)).toBe(0);
    });
});
