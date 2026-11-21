'use strict';

// The number formatters and input parsers of www/js/utils.js against the locale separators
// (docs/adr/0006-locale-number-formatting.md). They read the page-global `options`, so they run
// in a vm context with `options` stubbed per locale. Pinned down below:
//
//   - numToLocal groups the integer part only, so a fraction never meets the grouping
//     character - the de case, where both would otherwise be a dot;
//   - the compact (K/M/G) mantissa takes the locale decimal separator;
//   - with no separators configured the output is the legacy dot grouping;
//   - the grouping spaces the page displays never reach a parsed number.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { expect } = require('./expect');

const UTILS = readFileSync(join(__dirname, '..', 'www', 'js', 'utils.js'), 'utf8');

const NBSP = '\u00A0';
const NNBSP = '\u202F';

/** The two separators of each locale exercised here, as the templates put them in options. */
const LOCALES = {
    en: { decimalSeparator: '.', thousandsSeparator: ',' },
    de: { decimalSeparator: ',', thousandsSeparator: '.' },
    ru: { decimalSeparator: ',', thousandsSeparator: NBSP },
    fr: { decimalSeparator: ',', thousandsSeparator: NNBSP },
};

/** A sandbox with utils.js loaded and `options` set to the given object. */
function env(options) {
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

/** utils.js loaded for one locale, with the compact/full toggle set. */
function locale(name, fullNumbers = true) {
    return env({ ...LOCALES[name], prm: { fullNumbers } });
}

describe('numToLocal', () => {
    it('groups by three with the locale character', () => {
        expect(locale('en').numToLocal(1234567)).toBe('1,234,567');
        expect(locale('de').numToLocal(1234567)).toBe('1.234.567');
        expect(locale('ru').numToLocal(1234567)).toBe(`1${NBSP}234${NBSP}567`);
        expect(locale('fr').numToLocal(1234567)).toBe(`1${NNBSP}234${NNBSP}567`);
    });

    it('puts the fraction behind the locale decimal separator', () => {
        expect(locale('en').numToLocal(12345.678)).toBe('12,345.678');
        expect(locale('ru').numToLocal(12345.678)).toBe(`12${NBSP}345,678`);
    });

    it('keeps the grouping dot and the decimal comma apart in de', () => {
        expect(locale('de').numToLocal(12345.678)).toBe('12.345,678');
    });

    it('cuts the fraction to three digits without rounding', () => {
        expect(locale('en').numToLocal(1.23456)).toBe('1.234');
    });

    it('groups a negative number after its sign', () => {
        expect(locale('ru').numToLocal(-1234)).toBe(`-1${NBSP}234`);
        expect(locale('en').numToLocal(-123)).toBe('-123');
    });

    it('leaves numbers below a thousand ungrouped', () => {
        expect(locale('en').numToLocal(999)).toBe('999');
        expect(locale('en').numToLocal(0)).toBe('0');
    });

    it('passes exponent notation through unchanged', () => {
        expect(locale('ru').numToLocal(1e21)).toBe('1e+21');
        expect(locale('ru').numToLocal(1e-7)).toBe('1e-7');
    });

    it('falls back to the legacy dot grouping when no separators are configured', () => {
        expect(env({ prm: {} }).numToLocal(1234567)).toBe('1.234.567');
    });
});

describe('numberToShortenedString and numToDisplay', () => {
    it('writes the compact mantissa with the locale decimal separator', () => {
        expect(locale('en').numberToShortenedString(1500000, 'KMG')).toBe('1.5M');
        expect(locale('de').numberToShortenedString(1500000, 'KMG')).toBe('1,5M');
        expect(locale('ru').numberToShortenedString(1500000, 'КМГ')).toBe('1,5М');
        expect(locale('fr').numberToShortenedString(2345000000, 'KMG')).toBe('2,345G');
    });

    it('groups a number below the compact threshold in full', () => {
        expect(locale('ru').numberToShortenedString(999999, 'КМГ')).toBe(`999${NBSP}999`);
    });

    it('switches between the full and the compact form on options.prm.fullNumbers', () => {
        expect(locale('ru', true).numToDisplay(1500000, 'КМГ')).toBe(`1${NBSP}500${NBSP}000`);
        expect(locale('ru', false).numToDisplay(1500000, 'КМГ')).toBe('1,5М');
    });
});

describe('grouping spaces never reach a parsed number', () => {
    it('getCorrectedValue drops U+00A0 and U+202F (it keeps only digits, sign and decimal)', () => {
        const { getCorrectedValue } = locale('ru');
        const comma = ','.codePointAt(0);
        expect(getCorrectedValue(`1${NBSP}234,5`, false, comma)).toBe('1234,5');
        expect(getCorrectedValue(`1${NNBSP}234`, false, comma)).toBe('1234');
    });

    it('getInputNumber parses a value that still holds them', () => {
        expect(locale('ru').getInputNumber({ value: `1${NBSP}234` })).toBe(1234);
        expect(locale('fr').getInputNumber({ value: `12${NNBSP}345,5` })).toBe(12345.5);
        expect(locale('en').getInputNumber({ value: `1${NBSP}234.5` })).toBe(1234.5);
    });
});
