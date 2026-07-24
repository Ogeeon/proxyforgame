'use strict';

// A minimal stand-in for Playwright's `expect` over plain values, so that logic
// tests moved out of the browser keep their original assertion style and port by
// find-and-replace instead of a rewrite. Only value matchers live here — anything
// asserting on a locator belongs in the Playwright suite by definition.

const assert = require('assert');

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
                assert.deepStrictEqual(actual, expected);
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
