'use strict';

// A minimal stand-in for Playwright's `expect` over plain values, so that logic
// tests moved out of the browser keep their original assertion style and port by
// find-and-replace instead of a rewrite. Only value matchers live here — anything
// asserting on a locator belongs in the Playwright suite by definition.

const assert = require('node:assert');

// Values computed by code that load() ran in a vm context are built from that
// context's Array and Object. deepStrictEqual compares prototypes, so such an
// array never equals a literal written in the test, and the failure message
// prints two identical-looking values. Rebuild arrays and plain objects in this
// realm before comparing; class instances keep their prototype and stay strict.
function rehome(value) {
    if (Array.isArray(value)) return Array.from(value, rehome);
    if (value !== null && typeof value === 'object') {
        const proto = Object.getPrototypeOf(value);
        if (proto === null || proto.constructor?.name === 'Object') {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rehome(v)]));
        }
    }
    return value;
}

function build(actual, negated) {
    const check = (pass, message) => {
        if (pass === negated) {
            assert.fail(`expected ${JSON.stringify(actual)} ${negated ? 'not ' : ''}${message}`);
        }
    };

    return {
        get not() {
            return build(actual, !negated);
        },
        toBe: (expected) => check(Object.is(actual, expected), `to be ${JSON.stringify(expected)}`),
        toEqual: (expected) => {
            let equal = true;
            try {
                assert.deepStrictEqual(rehome(actual), rehome(expected));
            } catch {
                equal = false;
            }
            check(equal, `to equal ${JSON.stringify(expected)}`);
        },
        toBeCloseTo: (expected, digits = 2) =>
            check(Math.abs(actual - expected) < Math.pow(10, -digits) / 2,
                `to be close to ${expected} (${digits} digits)`),
        toBeGreaterThan: (n) => check(actual > n, `to be greater than ${n}`),
        toBeGreaterThanOrEqual: (n) => check(actual >= n, `to be >= ${n}`),
        toBeLessThan: (n) => check(actual < n, `to be less than ${n}`),
        toBeLessThanOrEqual: (n) => check(actual <= n, `to be <= ${n}`),
        toContain: (item) => check(actual.includes(item), `to contain ${JSON.stringify(item)}`),
        toHaveLength: (n) => check(actual.length === n, `to have length ${n}`),
        toBeNull: () => check(actual === null, 'to be null'),
        toBeTruthy: () => check(!!actual, 'to be truthy'),
        toBeFalsy: () => check(!actual, 'to be falsy'),
        toBeDefined: () => check(actual !== undefined, 'to be defined'),
    };
}

const expect = (actual) => build(actual, false);

module.exports = { expect };
