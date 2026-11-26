'use strict';

// stepNumber() in www/js/utils.js - the pure half of arrow-key stepping
// (docs/plans/arrow-key-stepping.md). It runs here exactly as the page's
// keydown listener calls it: the displayed text, the direction, the Shift/Ctrl
// multiplier, the field's _constrains and the locale separator; it answers with
// the plain "."-decimal string the DOM layer then localizes. Pinned down below:
//
//   - the default step is 1 for integer fields, 0.1 where allowFloat, and a
//     `step` constraint overrides both;
//   - an empty or unparseable field starts from `def` (0 when unset);
//   - the result clamps to the defined min/max, never wraps;
//   - rounding to the step's precision keeps float noise (0.2 + 0.1) out of the
//     field and cuts a finer value (0.25 + 0.1) to the step's grid;
//   - the locale decimal separator and the displayed grouping spaces parse.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { expect } = require('./expect');

const UTILS = readFileSync(join(__dirname, '..', 'www', 'js', 'utils.js'), 'utf8');

/**
 * A sandbox with utils.js loaded, the way a page has it: with an `options`
 * object and a document. The document deliberately carries no addEventListener
 * - that also pins the guard around the keydown listener's self-registration.
 */
function env(options = {}) {
    const sandbox = {
        console,
        options,
        document: { cookie: '', getElementById: () => null },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(UTILS, sandbox, { filename: 'utils.js' });
    return sandbox;
}

const stepNumber = env().stepNumber;

describe('utils.js loads outside a browser', () => {
    it('registers no listener when there is no document at all', () => {
        // The same import path unit-tests/load.js performs for the *-core
        // files: a bare sandbox with no document must still load and yield
        // the functions.
        const sandbox = { console };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(UTILS, sandbox, { filename: 'utils.js' });
        expect(typeof sandbox.stepNumber).toBe('function');
    });
});

describe('stepNumber', () => {
    const INT = { min: 0, max: Infinity, def: 0, allowFloat: false, allowNegative: false };

    it('steps an integer field by 1', () => {
        expect(stepNumber('5', 1, 1, INT, '.')).toBe('6');
        expect(stepNumber('5', -1, 1, INT, '.')).toBe('4');
    });

    it('steps a float field by 0.1', () => {
        expect(stepNumber('0.2', 1, 1, { ...INT, allowFloat: true }, '.')).toBe('0.3');
        expect(stepNumber('0.2', -1, 1, { ...INT, allowFloat: true }, '.')).toBe('0.1');
    });

    it('takes an explicit step over the defaults', () => {
        expect(stepNumber('5', 1, 1, { ...INT, step: 5 }, '.')).toBe('10');
        expect(stepNumber('1.5', -1, 1, { allowFloat: true, step: 0.5 }, '.')).toBe('1');
    });

    it('starts from def when the field is empty or unparseable, 0 when unset', () => {
        expect(stepNumber('', 1, 1, { ...INT, def: 10 }, '.')).toBe('11');
        expect(stepNumber('abc', -1, 1, { ...INT, def: 10 }, '.')).toBe('9');
        expect(stepNumber('', 1, 1, INT, '.')).toBe('1');
    });

    it('clamps at min and at max without wrapping', () => {
        const bounded = { min: 1, max: 5, def: 0, allowFloat: false };
        expect(stepNumber('5', 1, 1, bounded, '.')).toBe('5');
        expect(stepNumber('1', -1, 1, bounded, '.')).toBe('1');
        expect(stepNumber('5', 1, 100, bounded, '.')).toBe('5');
        expect(stepNumber('1', -1, 100, bounded, '.')).toBe('1');
    });

    it('multiplies the step by 10 with Shift and by 100 with Ctrl', () => {
        expect(stepNumber('5', 1, 10, INT, '.')).toBe('15');
        // No min here, so the Ctrl jump shows unclamped: 5 - 1x100.
        expect(stepNumber('5', -1, 100, { def: 0, allowFloat: false }, '.')).toBe('-95');
        expect(stepNumber('1.5', 1, 10, { allowFloat: true }, '.')).toBe('2.5');
    });

    it('parses the locale decimal separator of the displayed value', () => {
        expect(stepNumber('2,5', 1, 1, { allowFloat: true }, ',')).toBe('2.6');
        // Ignoring the separator would read 2 and answer 2.5 / 1.5.
        expect(stepNumber('2,5', 1, 1, { allowFloat: true, step: 0.5 }, ',')).toBe('3');
        expect(stepNumber('2,5', -1, 1, { allowFloat: true, step: 0.5 }, ',')).toBe('2');
    });

    it('drops the grouping spaces a copied value carries', () => {
        expect(stepNumber('1\u00A0234\u202F567', 1, 1, INT, '.')).toBe('1234568');
    });

    it('rounds to the step precision, so 0.2 + 0.1 is exactly 0.3', () => {
        expect(stepNumber('0.2', 1, 1, { allowFloat: true }, '.')).toBe('0.3');
    });

    it('cuts a finer-than-step value to the step grid: 0.25 + 0.1 is 0.4', () => {
        expect(stepNumber('0.25', 1, 1, { allowFloat: true }, '.')).toBe('0.4');
    });

    it('clamps a def outside [min..max] back into the range', () => {
        // The departure-planet case: def 0 with a field that starts at 1.
        expect(stepNumber('', -1, 1, { min: 1, max: 16, def: 0 }, '.')).toBe('1');
        expect(stepNumber('', 1, 1, { min: 1, max: 16, def: 0 }, '.')).toBe('1');
    });

    it('leaves a bound out when the constraint does not define it', () => {
        expect(stepNumber('-999', -1, 1, { allowFloat: false }, '.')).toBe('-1000');
        expect(stepNumber('999', 1, 1, { def: 0 }, '.')).toBe('1000');
    });
});
