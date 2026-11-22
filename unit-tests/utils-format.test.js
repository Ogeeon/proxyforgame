'use strict';

// The number formatters and input parsers of www/js/utils.js against the locale separators
// (docs/adr/0006-locale-number-formatting.md). They read the page-global `options`, so they run
// in a vm context with `options` stubbed per locale. Pinned down below:
//
//   - numToLocal groups the integer part only, so a fraction never meets the grouping
//     character - the de case, where both would otherwise be a dot;
//   - the compact (M/G/T) mantissa takes the locale decimal separator, is cut rather than
//     rounded, and from 10^15 grows past 999 under the T letter - there is no P tier;
//   - with no separators configured the output is the legacy dot grouping;
//   - the grouping spaces the page displays never reach a parsed number;
//   - a duration is a clock under a day, weeks to seconds up to 364 days and years, months and
//     weeks from 365 days, never with a trailing space.

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
        expect(locale('en').numberToShortenedString(987654, 'KMGT')).toBe('987,654');
        expect(locale('de').numberToShortenedString(987654, 'KMGT')).toBe('987.654');
    });

    it('switches tier at 10^6, 10^9 and 10^12, dropping trailing zeros', () => {
        const { numberToShortenedString } = locale('en');
        expect(numberToShortenedString(999999, 'KMGT')).toBe('999,999');
        expect(numberToShortenedString(1000000, 'KMGT')).toBe('1M');
        expect(numberToShortenedString(999999999, 'KMGT')).toBe('999.999M');
        expect(numberToShortenedString(1000000000, 'KMGT')).toBe('1G');
        expect(numberToShortenedString(999999999999, 'KMGT')).toBe('999.999G');
        expect(numberToShortenedString(1e12, 'KMGT')).toBe('1T');
    });

    it('writes trillions under T, cut to three fraction digits', () => {
        expect(locale('en').numberToShortenedString(1234567890123, 'KMGT')).toBe('1.234T');
        expect(locale('de').numberToShortenedString(1234567890123, 'KMGT')).toBe('1,234T');
        expect(locale('ru').numberToShortenedString(1234567890123, 'КМГТ')).toBe('1,234Т');
        expect(locale('ru').numberToShortenedString(1e12, 'КМГТ')).toBe('1Т');
    });

    it('lets the T mantissa grow past 999 from 10^15 (no P tier)', () => {
        expect(locale('en').numberToShortenedString(1234567890123456, 'KMGT')).toBe('1,234.567T');
        // The one compact value where the de grouping dot and decimal comma meet.
        expect(locale('de').numberToShortenedString(1234567890123456, 'KMGT')).toBe('1.234,567T');
        expect(locale('ru').numberToShortenedString(1234567890123456, 'КМГТ')).toBe(`1${NBSP}234,567Т`);
    });

    it('takes the T letter by position from the locale suffixes', () => {
        expect(locale('ru', false).numToDisplay(2e12, 'КМГТ')).toBe('2Т');
        expect(locale('en', false).numToDisplay(2e12, 'KMGT')).toBe('2T');
    });

    it('switches between the full and the compact form on options.prm.fullNumbers', () => {
        expect(locale('ru', true).numToDisplay(1500000, 'КМГ')).toBe(`1${NBSP}500${NBSP}000`);
        expect(locale('ru', false).numToDisplay(1500000, 'КМГ')).toBe('1,5М');
    });
});

describe('timespanToShortenedString', () => {
    const RU = { y: 'г', mo: 'мес', w: 'нд', d: 'д', h: 'ч', m: 'м', s: 'с' };
    const EN = { y: 'y', mo: 'mo', w: 'w', d: 'd', h: 'h', m: 'm', s: 's' };
    const H = 3600;
    const D = 86400;
    /** The ru form of a span, minimized or not. */
    const ru = (seconds, minimize) => locale('ru').timespanToShortenedString(seconds, RU, minimize);
    /** The same span both ways, when the two forms agree. */
    function both(seconds) {
        const minimized = ru(seconds, true);
        expect(ru(seconds, false)).toBe(minimized);
        return minimized;
    }

    it('writes a span under a day as a zero-padded clock, in every language', () => {
        expect(both(0)).toBe('00:00:00');
        expect(both(45 * 60)).toBe('00:45:00');
        expect(both(10 * H)).toBe('10:00:00');
        expect(both(2 * H + 5 * 60 + 3)).toBe('02:05:03');
        expect(both(D - 1)).toBe('23:59:59');
        expect(locale('en').timespanToShortenedString(D - 1, EN)).toBe('23:59:59');
    });

    it('floors the seconds of the clock', () => {
        expect(both(59.9)).toBe('00:00:59');
    });

    it('switches to days at exactly one day', () => {
        expect(both(D)).toBe('1д');
    });

    it('keeps the week/day form from 1 to 364 days, minimize dropping the small units', () => {
        const span = 3 * D + 4 * H + 5 * 60 + 6;
        expect(ru(span, true)).toBe('3д 4ч 5м');
        expect(ru(span, false)).toBe('3д 4ч 5м 6с');
        const weeks = 2 * 7 * D + 3 * H + 5 * 60 + 6;
        expect(ru(weeks, true)).toBe('2нд 3ч');
        expect(ru(weeks, false)).toBe('2нд 3ч 5м 6с');
        expect(both(364 * D)).toBe('52нд');
    });

    it('writes a year and more as years, months and weeks only', () => {
        expect(both(365 * D)).toBe('1г');
        expect(both(370 * D + 5 * H)).toBe('1г');
        expect(both(379 * D)).toBe('1г 2нд');
        expect(both(400 * D)).toBe('1г 1мес');
        expect(both(472 * D + 23 * H + 59 * 60 + 59)).toBe('1г 3мес 2нд');
        expect(both(725 * D)).toBe('1г 12мес');
        expect(both(730 * D)).toBe('2г');
        expect(both(1825 * D)).toBe('5г');
    });

    it('never ends with a space', () => {
        for (const seconds of [0, 45 * 60, 10 * H, D, 3 * D + 4 * H, 364 * D, 365 * D, 400 * D, 1825 * D])
            for (const minimize of [true, false])
                expect(ru(seconds, minimize).endsWith(' ')).toBe(false);
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
