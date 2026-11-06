'use strict';

// The DOM-free half of www/js/report-context.js: what the report dialog
// attaches when its "this is a calculation error" switch is on. Walking the
// DOM is sidebar.js's job and needs a browser; what happens to the collected
// values - the caps, the lines, the digit guess behind the switch's start
// state - is decided here, against plain objects.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const {
    REPORT_CONTEXT_LIMITS,
    looksLikeCalculationError,
    buildReportContext,
} = load(['js/report-context.js'], [
    'REPORT_CONTEXT_LIMITS',
    'looksLikeCalculationError',
    'buildReportContext',
]);

// A control as collectReportControls() reads it off a page.
function control(overrides) {
    return { type: 'text', name: '', label: '', value: '', ...overrides };
}

describe('looksLikeCalculationError', () => {
    // A wrong result reads as a number, a misspelling almost never carries a
    // digit - and when it does ("OGame 7.x"), the switch is one click away
    // from being flipped back.
    it('is on for a selection containing a digit', () => {
        expect(looksLikeCalculationError('690.814')).toBe(true);
        expect(looksLikeCalculationError('fuel: -3 deut')).toBe(true);
        expect(looksLikeCalculationError('OGame 7.x')).toBe(true);
    });

    it('is off for words and for nothing selected', () => {
        expect(looksLikeCalculationError('exibition')).toBe(false);
        expect(looksLikeCalculationError('')).toBe(false);
    });
});

describe('buildReportContext', () => {
    it('turns controls into label-colon-value lines', () => {
        const context = buildReportContext([
            control({ label: 'Metal', value: '1000' }),
            control({ name: 'player-class', label: 'player-class', value: 'Collector' }),
        ]);
        expect(context.text).toBe('Metal: 1000\nplayer-class: Collector');
        expect(context.pairs).toEqual([
            { label: 'Metal', value: '1000' },
            { label: 'player-class', value: 'Collector' },
        ]);
        expect(context.omitted).toBe(0);
    });

    it('falls back to the name when the label is empty and drops what says nothing', () => {
        const context = buildReportContext([
            control({ name: 'res-src-m', value: '2 500' }),
            control({ label: '  ', value: '' }),
        ]);
        expect(context.text).toBe('res-src-m: 2 500');
    });

    // Template labels come out of the page with the indentation they were
    // rendered with; a pasted spy report can be one long line of everything.
    it('squeezes whitespace and clips long labels and values with an ellipsis', () => {
        const context = buildReportContext([
            control({ label: '  Spiobericht\n\t der Planet  ', value: 'x'.repeat(400) }),
        ], { ...REPORT_CONTEXT_LIMITS, maxLabelLength: 20, maxValueLength: 30 });
        expect(context.pairs[0].label).toBe('Spiobericht der Pla…');
        expect(context.pairs[0].label).toHaveLength(20);
        expect(context.pairs[0].value).toHaveLength(30);
        expect(context.pairs[0].value.endsWith('…')).toBe(true);
    });

    it('caps the pairs and says in the text how many fields were left out', () => {
        const controls = Array.from({ length: 5 }, (_, i) => control({ label: `L${i}`, value: String(i) }));
        const context = buildReportContext(controls, { ...REPORT_CONTEXT_LIMITS, maxPairs: 3 });
        expect(context.pairs).toHaveLength(3);
        expect(context.omitted).toBe(2);
        expect(context.text.endsWith('(+2 more fields not attached)')).toBe(true);
    });

    it('does not count empty controls as left out', () => {
        const context = buildReportContext([
            control({ label: 'Metal', value: '1' }),
            control({ label: '', value: '' }),
        ], { ...REPORT_CONTEXT_LIMITS, maxPairs: 1 });
        expect(context.omitted).toBe(0);
        expect(context.text).toBe('Metal: 1');
    });

    it('truncates the whole text at the total cap', () => {
        const controls = Array.from({ length: 40 }, (_, i) => control({ label: `L${i}`, value: 'y'.repeat(300) }));
        const context = buildReportContext(controls, { ...REPORT_CONTEXT_LIMITS, maxPairs: 40, maxTotalLength: 1000 });
        expect(context.text.length).toBe(1000);
        expect(context.text.endsWith('…')).toBe(true);
    });

    it('leaves an empty page empty, not a colon on a line', () => {
        expect(buildReportContext([]).text).toBe('');
        expect(buildReportContext([]).pairs).toEqual([]);
    });
});
