'use strict';

// isPlnEmpty() decides whether deleting a planet on the All planets tab needs a
// confirmation, so it has to tell an untouched planet from an edited one without
// caring how the value reached options.prm.aPS — the table writes numbers, older
// cookies hold strings, and planets saved before the life form fields existed are
// simply shorter. All of that is plain array logic, hence Node instead of a browser.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const ctx = load(
    ['ogame/calc/js/production-core.js'],
    ['createEmptyPlanet', 'isPlnEmpty'],
);
const { createEmptyPlanet, isPlnEmpty } = ctx;

// The functions read the planet through the shared `options` object the page
// builds in production.tpl; a bare aPS holder is all they touch.
function check(planet) {
    ctx.options = { prm: { aPS: [planet] } };
    return isPlnEmpty(0);
}

describe('isPlnEmpty', () => {
    it('treats a freshly created planet as empty', () => {
        expect(check(createEmptyPlanet())).toBe(true);
    });

    it('treats levels stored as strings as empty', () => {
        // What collectAllPlanetsInputs() used to write: "0" instead of 0, which made
        // the delete confirmation fire on a planet nobody had touched.
        let planet = createEmptyPlanet();
        for (let j = 1; j < 8; j++)
            planet[j * 3] = '0';
        expect(check(planet)).toBe(true);
    });

    it('detects an entered building level', () => {
        let planet = createEmptyPlanet();
        planet[3] = 20; // metal mine
        expect(check(planet)).toBe(false);
    });

    it('detects an entered level stored as a string', () => {
        let planet = createEmptyPlanet();
        planet[3] = '20';
        expect(check(planet)).toBe(false);
    });

    it('detects a booster', () => {
        let planet = createEmptyPlanet();
        planet[5] = 2; // metal mine booster
        expect(check(planet)).toBe(false);
    });

    it('detects a lowered production factor', () => {
        let planet = createEmptyPlanet();
        planet[4] = 90; // metal mine at 90%
        expect(check(planet)).toBe(false);
    });

    it('detects a changed planet position', () => {
        let planet = createEmptyPlanet();
        planet[1] = 4;
        expect(check(planet)).toBe(false);
    });

    it('detects an entered temperature', () => {
        let planet = createEmptyPlanet();
        planet[0] = -20;
        expect(check(planet)).toBe(false);
    });

    it('detects life form data', () => {
        let planet = createEmptyPlanet();
        planet[24] = 2; // race
        planet[27] = 5; // one of its buildings
        expect(check(planet)).toBe(false);
    });

    it('treats a planet saved before the life form fields as empty', () => {
        let planet = createEmptyPlanet().slice(0, 24);
        expect(check(planet)).toBe(true);
    });
});
