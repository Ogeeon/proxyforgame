'use strict';

// The number separators of the 13 locale files (docs/adr/0006-locale-number-formatting.md).
// Two of them are invisible characters, and the i18n gate checks only that every locale has the
// same keys - so a typo'd space would pass it unseen. This test reads the files themselves and
// pins each separator to its code point.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { expect } = require('./expect');

const LOCALE_DIR = join(__dirname, '..', 'www', 'locale');

const COMMA = 0x2C;
const DOT = 0x2E;
const NO_BREAK_SPACE = 0xA0;
const NARROW_NO_BREAK_SPACE = 0x202F;

/** Code points of [decimal-separator, thousands-separator] per CLDR (pt is Portugal). */
const EXPECTED = {
    en: [DOT, COMMA],
    us: [DOT, COMMA],
    fr: [COMMA, NARROW_NO_BREAK_SPACE],
    pl: [COMMA, NO_BREAK_SPACE],
    pt: [COMMA, NO_BREAK_SPACE],
    ru: [COMMA, NO_BREAK_SPACE],
    sk: [COMMA, NO_BREAK_SPACE],
    de: [COMMA, DOT],
    es: [COMMA, DOT],
    it: [COMMA, DOT],
    nl: [COMMA, DOT],
    tr: [COMMA, DOT],
    bs: [COMMA, DOT],
};

/** The code points of a separator string, so a two-character typo shows as two entries. */
function codePoints(s) {
    return [...String(s)].map((c) => c.codePointAt(0));
}

describe('locale number separators', () => {
    for (const [lang, [decimal, thousands]] of Object.entries(EXPECTED)) {
        it(`${lang}: one-character separators with the CLDR code points`, () => {
            const common = JSON.parse(readFileSync(join(LOCALE_DIR, `${lang}.json`), 'utf8')).common;
            expect(codePoints(common['decimal-separator'])).toEqual([decimal]);
            expect(codePoints(common['thousands-separator'])).toEqual([thousands]);
        });
    }
});
