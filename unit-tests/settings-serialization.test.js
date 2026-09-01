'use strict';

// saveToCookie / loadFromCookie in www/js/utils.js - the calculator settings
// store. These are browser globals that touch localStorage and document.cookie,
// so they run here in a vm context with both faked. What matters and is pinned
// down below:
//
//   - every shape a calculator stores round-trips: flat scalars, booleans,
//     arrays, matrices, a nested object, and a string carrying a comma (the
//     case the old `key;value,` format destroyed - see
//     .claude/plans/settings-serialization.md);
//   - each value still passes through params.validate() on load;
//   - a payload written in the pre-JSON format is still read.

const { describe, it, beforeEach } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { expect } = require('./expect');

const UTILS = readFileSync(join(__dirname, '..', 'www', 'js', 'utils.js'), 'utf8');

/** A fresh sandbox with an isolated localStorage and cookie jar, plus utils.js loaded. */
function freshEnv() {
    const store = new Map();
    const localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    // Host JSON so the objects loadFromCookie returns are this realm's, and
    // node:assert's deepStrictEqual (prototype-sensitive) can compare them.
    const sandbox = { console, localStorage, JSON };
    sandbox.window = sandbox;
    // Only the name=value pair is read back; expiry/path are ignored.
    let cookie = '';
    Object.defineProperty(sandbox, 'document', {
        value: {
            get cookie() { return cookie; },
            set cookie(str) {
                const [pair] = str.split(';');
                const eq = pair.indexOf('=');
                const name = pair.slice(0, eq).trim();
                const value = pair.slice(eq + 1);
                const kept = cookie.split('; ').filter((c) => c && !c.startsWith(name + '='));
                cookie = [...kept, `${name}=${value}`].join('; ');
            },
        },
    });
    vm.createContext(sandbox);
    vm.runInContext(UTILS, sandbox, { filename: 'utils.js' });
    return sandbox;
}

/** The validate() a real params object carries - string-typed, like the calculators'. */
function validate(field, value) {
    switch (field) {
        case 'moon':
            return value === 'true' || value === true;
        case 'country':
            return value;
        case 'label':
            return value;
        default:
            return Number.isNaN(Number.parseFloat(value)) ? 0 : Number.parseFloat(value);
    }
}

describe('settings serialization', () => {
    let env;
    beforeEach(() => { env = freshEnv(); });

    /** Save `data` under a key, then load it back into fresh params and return it without validate. */
    function roundTrip(data) {
        env.saveToCookie('options_x', data);
        const shape = JSON.parse(JSON.stringify(data)); // JSON.stringify drops the validate function
        shape.validate = validate;
        env.loadFromCookie('options_x', shape);
        delete shape.validate;
        return shape;
    }

    it('round-trips flat scalars and booleans', () => {
        expect(roundTrip({ speed: 12, moon: true, country: 'de', validate }))
            .toEqual({ speed: 12, moon: true, country: 'de' });
    });

    it('round-trips an array', () => {
        expect(roundTrip({ ships: [250, 0, 17], validate }))
            .toEqual({ ships: [250, 0, 17] });
    });

    it('round-trips a matrix', () => {
        expect(roundTrip({ lfShipsBonuses: [[1, 2, 3], [0, 0, 0]], validate }))
            .toEqual({ lfShipsBonuses: [[1, 2, 3], [0, 0, 0]] });
    });

    it('round-trips a nested object (trade rates) - the case the old format broke', () => {
        expect(roundTrip({ rates: { md: 3, cd: 1.5, mc: 2 }, validate }))
            .toEqual({ rates: { md: 3, cd: 1.5, mc: 2 } });
    });

    it('round-trips a value containing a comma', () => {
        expect(roundTrip({ label: 'Alpha, Beta', validate }))
            .toEqual({ label: 'Alpha, Beta' });
    });

    it('runs every loaded value through validate()', () => {
        env.saveToCookie('options_x', { speed: 999, junk: 'x', validate });
        const loaded = { speed: 0, validate: (f, v) => (f === 'speed' ? 500 : v) };
        env.loadFromCookie('options_x', loaded);
        expect(loaded.speed).toBe(500);
        // A key absent from params is ignored, as the legacy reader did.
        expect('junk' in loaded).toBe(false);
    });

    it('drops functions rather than serializing them', () => {
        const stored = () => {
            env.saveToCookie('options_x', { speed: 1, validate });
            return env.localStorage.getItem('options_x');
        };
        expect(stored()).toBe('{"speed":1}');
    });

    it('still reads a payload written in the pre-JSON format', () => {
        env.localStorage.setItem('options_x', 'key-value;true,speed;42,ships|0;7,ships|1;9');
        const loaded = { speed: 0, ships: [], validate };
        env.loadFromCookie('options_x', loaded);
        expect(loaded.speed).toBe(42);
        expect(loaded.ships).toEqual([7, 9]);
    });

    it('ignores an empty or absent payload', () => {
        const loaded = { speed: 5, validate };
        env.loadFromCookie('options_missing', loaded);
        expect(loaded.speed).toBe(5);
    });

    it('falls back to a cookie when localStorage.setItem throws, and reads it back', () => {
        env.localStorage.setItem = () => { throw new Error('quota'); };
        env.saveToCookie('options_x', { speed: 8, rates: { md: 2, cd: 4 }, validate });
        const loaded = { speed: 0, rates: {}, validate };
        env.loadFromCookie('options_x', loaded);
        expect(loaded.speed).toBe(8);
        expect(loaded.rates).toEqual({ md: 2, cd: 4 });
    });
});
