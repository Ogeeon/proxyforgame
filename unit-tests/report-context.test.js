'use strict';

// The DOM-free half of www/js/report-context.js: what the report dialog
// attaches when its "this is a calculation error" switch is on. Reading the
// page - a calculator's reportSnapshot() hook or the generic field walk - is
// sidebar.js's job and needs a browser; what happens to the snapshot - the
// default filter, the caps, the localized list and the canonical e-mail
// lines, the digit guess behind the switch's start state - is decided here,
// against plain objects.

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

// The words sidebar.tpl inlines, here the Russian ones: Russian has three
// plural forms for whole numbers, so it is the case worth testing.
const RU = {
    locale: 'ru',
    mode: 'Режим',
    selected: 'Выделено',
    yes: 'да',
    no: 'нет',
    allDefaults: 'Все поля имеют значения по умолчанию.',
    omitted: {
        one: 'ещё {0} поле не приложено',
        few: 'ещё {0} поля не приложено',
        many: 'ещё {0} полей не приложено',
        other: 'ещё {0} поля не приложено',
    },
};

const MODE = [
    { key: 'tabtag-0', label: 'Все элементы - один уровень' },
    { key: 'tabtag-0-2', label: 'Постройки (планета)' },
];

// An entry as a calculator's hook returns it.
function entry(overrides) {
    return { key: 'k', group: '', label: 'L', value: 0, default: 0, ...overrides };
}

const texts = (context) => context.lines.map((line) => line.text);

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

describe('buildReportContext: what goes out', () => {
    // The calculator hands in every field with its factory default; only what
    // differs is worth a line, and the filter lives here, once.
    it('drops the entries still at their default and keeps the rest', () => {
        const context = buildReportContext({
            mode: [],
            entries: [
                entry({ key: 'metal-mine.level', value: 10, default: 0 }),
                entry({ key: 'crystal-mine.level', value: 0, default: 0 }),
                entry({ key: 'technocrat', value: false, default: false }),
                entry({ key: 'research-bonus', value: true, default: false }),
                entry({ key: 'universe-speed', value: '1', default: '1' }),
                entry({ key: 'research-speed', value: '4', default: '1' }),
            ],
        }, null, RU);
        expect(context.text).toBe('metal-mine.level = 10\nresearch-bonus = true\nresearch-speed = 4');
    });

    // A rate typed as "1,5" on the Russian page is read as 1.5, and the
    // template's default is the dot-decimal 1.5: equal, so no line.
    it('compares numbers as numbers', () => {
        const context = buildReportContext({
            mode: [],
            entries: [
                entry({ key: 'exchange-rates-c', value: 1.5, default: 1.5, display: '1,5' }),
                entry({ key: 'exchange-rates-d', value: 3.25, default: 3, display: '3,25' }),
            ],
        }, null, RU);
        expect(context.text).toBe('exchange-rates-d = 3.25');
    });

    it('always carries an entry without a default, and never an empty value', () => {
        const context = buildReportContext({
            mode: [],
            entries: [
                { key: 'tech-types-select', group: '', label: 'Item', value: '1' },
                entry({ key: 'universe', value: '', default: '1' }),
                entry({ key: 'country', value: '  ', default: '--' }),
            ],
        }, null, RU);
        expect(context.text).toBe('tech-types-select = 1');
    });

    // Language-independent: the site owner reads Russian and German reports
    // alike. Only the selected text stays as the page showed it.
    it('writes the mode, the selected cell and key = value lines for the e-mail', () => {
        const context = buildReportContext({
            mode: MODE,
            entries: [
                entry({ key: 'metal-mine.level', group: 'Постройки (планета)', label: 'Рудник по добыче металла — Уровень', value: 10, display: '10' }),
                entry({ key: 'exchange-rates-c', value: 1.75, default: 1.5, display: '1,75' }),
                entry({ key: 'technocrat', value: true, default: false }),
            ],
        }, { key: 'grand-total.metal', caption: 'Всего, Металл', text: '2.306' }, RU);
        expect(context.text).toBe([
            'mode: tabtag-0 / tabtag-0-2',
            'selected: grand-total.metal = "2.306"',
            'metal-mine.level = 10',
            'exchange-rates-c = 1.75',
            'technocrat = true',
        ].join('\n'));
    });

    it('caps the entries and says in both representations how many were left out', () => {
        const entries = Array.from({ length: 5 }, (_, i) => entry({ key: `f${i}`, label: `L${i}`, value: i + 1 }));
        const context = buildReportContext({ mode: [], entries }, null, RU, { ...REPORT_CONTEXT_LIMITS, maxPairs: 2 });
        expect(context.omitted).toBe(3);
        expect(context.text).toBe('f0 = 1\nf1 = 2\n(+3 more fields not attached)');
        expect(context.lines.at(-1)).toEqual({ kind: 'omitted', text: 'ещё 3 поля не приложено' });
    });

    // Defaults do not count as cut: they were never going out.
    it('counts only the entries that differ from their default as left out', () => {
        const entries = [
            entry({ key: 'a', value: 1 }),
            entry({ key: 'b', value: 0 }),
            entry({ key: 'c', value: 0 }),
        ];
        const context = buildReportContext({ mode: [], entries }, null, RU, { ...REPORT_CONTEXT_LIMITS, maxPairs: 1 });
        expect(context.omitted).toBe(0);
        expect(context.text).toBe('a = 1');
    });

    it('squeezes whitespace and clips long labels and values with an ellipsis', () => {
        const context = buildReportContext({
            mode: [],
            entries: [entry({ label: '  Spiobericht\n\t der Planet  ', value: 'x'.repeat(400), default: '' })],
        }, null, RU, { ...REPORT_CONTEXT_LIMITS, maxLabelLength: 20, maxValueLength: 30 });
        expect(context.lines[0].text).toBe(`Spiobericht der Pla…: ${'x'.repeat(29)}…`);
    });

    it('truncates the whole e-mail block at the total cap', () => {
        const entries = Array.from({ length: 40 }, (_, i) => entry({ key: `k${i}`, value: 'y'.repeat(300), default: '' }));
        const context = buildReportContext({ mode: [], entries }, null, RU,
            { ...REPORT_CONTEXT_LIMITS, maxPairs: 40, maxTotalLength: 1000 });
        expect(context.text.length).toBe(1000);
        expect(context.text.endsWith('…')).toBe(true);
    });
});

describe('buildReportContext: what the visitor sees', () => {
    it('lists the mode, the selected cell and the entries under their group headings', () => {
        const context = buildReportContext({
            mode: MODE,
            entries: [
                entry({ group: 'Постройки (планета)', label: 'Рудник по добыче металла — Уровень', value: 10, display: '10' }),
                entry({ group: 'Общие', label: 'Технократ', value: true, default: false }),
                entry({ group: 'Постройки (планета)', label: 'Рудник по добыче кристалла — Уровень', value: 3, display: '3' }),
                entry({ group: 'Общие', label: 'Курсы обмена — Кристалл', value: 1.75, default: 1.5, display: '1,75' }),
                entry({ group: 'Общие', label: 'Исследовательский ивент', value: false, default: true }),
            ],
        }, { key: 'grand-total.metal', caption: 'Всего, Металл', text: '2.306' }, RU);
        expect(context.lines).toEqual([
            { kind: 'mode', text: 'Режим: Все элементы - один уровень › Постройки (планета)' },
            { kind: 'selected', text: 'Выделено: Всего, Металл' },
            { kind: 'group', text: 'Постройки (планета)' },
            { kind: 'entry', text: 'Рудник по добыче металла — Уровень: 10' },
            { kind: 'entry', text: 'Рудник по добыче кристалла — Уровень: 3' },
            { kind: 'group', text: 'Общие' },
            { kind: 'entry', text: 'Технократ: да' },
            { kind: 'entry', text: 'Курсы обмена — Кристалл: 1,75' },
            { kind: 'entry', text: 'Исследовательский ивент: нет' },
        ]);
    });

    it('shows a selected cell the page gives no caption for only in the e-mail', () => {
        const context = buildReportContext({ mode: MODE, entries: [] },
            { key: 'grand-total.metal', caption: '', text: '2.306' }, RU);
        expect(texts(context).some((line) => line.startsWith('Выделено'))).toBe(false);
        expect(context.text.split('\n')[1]).toBe('selected: grand-total.metal = "2.306"');
    });

    it('puts the omitted line in the plural form of its count', () => {
        const run = (count) => {
            const entries = Array.from({ length: count + 1 }, (_, i) => entry({ key: `f${i}`, value: 1 }));
            return buildReportContext({ mode: [], entries }, null, RU, { ...REPORT_CONTEXT_LIMITS, maxPairs: 1 }).lines.at(-1)?.text;
        };
        expect(run(1)).toBe('ещё 1 поле не приложено');
        expect(run(2)).toBe('ещё 2 поля не приложено');
        expect(run(5)).toBe('ещё 5 полей не приложено');
        expect(run(21)).toBe('ещё 21 поле не приложено');
    });

    // The mode alone is still worth attaching: the result was read on these
    // tabs with every field untouched.
    it('says so when every field is at its default, and still offers the switch', () => {
        const context = buildReportContext({ mode: MODE, entries: [entry({ value: 0 })] }, null, RU);
        expect(context.offered).toBe(true);
        expect(context.lines).toEqual([
            { kind: 'mode', text: 'Режим: Все элементы - один уровень › Постройки (планета)' },
            { kind: 'empty', text: 'Все поля имеют значения по умолчанию.' },
        ]);
        expect(context.text).toBe('mode: tabtag-0 / tabtag-0-2\n(all fields at their defaults)');
    });

    it('offers nothing on a page with neither a mode nor fields', () => {
        const context = buildReportContext({ mode: [], entries: [] }, null, RU);
        expect(context.offered).toBe(false);
        expect(context.lines).toEqual([]);
        expect(context.text).toBe('');
    });
});
