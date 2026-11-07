// The DOM-free half of the calculation-error context: what the sidebar's
// report dialog attaches when the "this is a calculation error" switch is on.
//
// A report that only says "690.814 is wrong" cannot be reproduced, so the
// dialog sends the calculator's state along. Where that state comes from is
// sidebar.js's job - the calculator's own reportSnapshot() hook, or a generic
// walk over the page's fields for a calculator without one. What happens to
// it lives here, typed against plain objects so the unit tests need no DOM
// (the interaction-timing.js pattern): dropping what still stands at its
// default, the caps, the localized list the visitor sees and the
// language-independent `key = value` lines the e-mail carries.

/**
 * One step of the calculator's mode: the tab, and the sub-tab inside it, the
 * result was read on.
 * @typedef {object} ReportModePart
 * @property {string} key      a stable id, the tab's element id
 * @property {string} label    the tab's caption in the page's language
 */

/**
 * One value that feeds the calculation.
 *
 * `value` and `default` are canonical - a number, a boolean, or a string such
 * as a select's option value - so the e-mail reads the same in every language.
 * `display` is what the page shows, locale separators included; left out, a
 * boolean shows as yes/no and anything else as its string.
 * @typedef {object} ReportEntry
 * @property {string} key                          stable id: `metal-mine.level`, `research-speed`
 * @property {string} group                        sub-heading of the shown list, '' for none
 * @property {string} label                        caption in the page's language
 * @property {string|number|boolean} value
 * @property {string|number|boolean} [default]     the factory default; left out, the entry always goes
 * @property {string} [display]
 */

/**
 * What a calculator's reportSnapshot() hook returns, and what the generic
 * field walk builds for a calculator without one. Every field that feeds the
 * calculation is in `entries`, defaults included: filtering them is done here,
 * in one place.
 * @typedef {object} ReportSnapshot
 * @property {ReportModePart[]} mode
 * @property {ReportEntry[]} entries
 */

/**
 * The cell the selected number came from, when the selection sits inside one.
 * @typedef {object} ReportSelection
 * @property {string} key        the cell's data-report-cell, e.g. `grand-total.metal`
 * @property {string} caption    its localized caption ('' when the page gives none)
 * @property {string} text       the selected text, as shown
 */

/**
 * The localized words of the shown list. The omitted line has one form per
 * plural category of Intl.PluralRules, `{0}` standing for the count.
 * @typedef {object} ReportTexts
 * @property {string} locale        BCP 47 tag the plural rules are picked by
 * @property {string} mode
 * @property {string} selected
 * @property {string} yes
 * @property {string} no
 * @property {string} allDefaults   the line shown when nothing differs from the defaults
 * @property {Record<string, string>} omitted
 */

/**
 * One line of the shown list. A `group` line is a sub-heading.
 * @typedef {object} ReportLine
 * @property {'mode'|'selected'|'group'|'entry'|'omitted'|'empty'} kind
 * @property {string} text
 */

/**
 * @typedef {object} ReportContext
 * @property {boolean} offered      whether the page has anything to report on at all
 * @property {ReportLine[]} lines   the list the dialog shows
 * @property {string} text          the block the e-mail carries
 * @property {number} omitted       entries left out by the cap
 */

// What one report may carry. The entry cap bounds a page of many rows (the
// production calculator with a full planet list), the per-field caps bound a
// pasted spy report, and the total is the same number the server clips at -
// the client is expected to stay under it, the server makes sure it does.
const REPORT_CONTEXT_LIMITS = {
    maxPairs: 200,
    maxLabelLength: 120,
    maxValueLength: 300,
    maxTotalLength: 10000,
};

/** The context of a page with nothing to attach. */
const EMPTY_REPORT_CONTEXT = { offered: false, lines: [], text: '', omitted: 0 };

/**
 * Whether a selection reads like a calculation error rather than a
 * misspelling: it contains a digit. Numbers are what a wrong result looks
 * like, and a typo with a digit in it ("OGame 7.x") is the rare case - and the
 * switch it pre-flips is one click away from being flipped back.
 * @param {string} selection
 * @returns {boolean}
 */
function looksLikeCalculationError(selection) {
    return /\d/.test(selection);
}

/**
 * Squashes template indentation and clipping into the text that goes out.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function clipReportField(text, max) {
    const squeezed = text.replace(/\s+/g, ' ').trim();
    return squeezed.length > max ? squeezed.slice(0, max - 1) + '…' : squeezed;
}

/**
 * Whether an entry still stands at its factory default. Numbers compare as
 * numbers, so a `1.5` read from a "1,5" field equals the template's 1.5;
 * anything else compares as text.
 * @param {ReportEntry} entry
 * @returns {boolean}
 */
function isReportDefault(entry) {
    if (entry.default === undefined) {
        return false;
    }
    if (typeof entry.value === 'number' && typeof entry.default === 'number') {
        return entry.value === entry.default;
    }
    return String(entry.value) === String(entry.default);
}

/**
 * The entries worth reading: not at their default, not empty.
 * @param {ReportEntry[]} entries
 * @returns {ReportEntry[]}
 */
function reportEntriesToSend(entries) {
    return entries.filter((entry) => String(entry.value ?? '').trim() !== '' && !isReportDefault(entry));
}

/**
 * The value as the shown list carries it: the page's own spelling.
 * @param {ReportEntry} entry
 * @param {ReportTexts} texts
 * @returns {string}
 */
function displayReportValue(entry, texts) {
    if (entry.display !== undefined) {
        return entry.display;
    }
    if (typeof entry.value === 'boolean') {
        return entry.value ? texts.yes : texts.no;
    }
    return String(entry.value);
}

/**
 * The localized "N more fields not attached" line, in the plural form the
 * count takes in the page's language.
 * @param {number} count
 * @param {ReportTexts} texts
 * @returns {string}
 */
function reportOmittedLine(count, texts) {
    let category = 'other';
    try {
        category = new Intl.PluralRules(texts.locale || undefined).select(count);
    } catch {
        // An unknown locale tag: the generic form still says it.
    }
    const form = texts.omitted[category] ?? texts.omitted.other ?? '';
    return form.replace('{0}', String(count));
}

/**
 * The shown list's entry lines under their sub-headings. Groups come in the
 * order they first appear, each with every entry of its group, so a
 * calculator that interleaves them still gets one heading per group.
 * @param {{group: string, label: string, display: string}[]} pairs
 * @returns {ReportLine[]}
 */
function groupReportLines(pairs) {
    /** @type {Map<string, string[]>} */
    const groups = new Map();
    for (const pair of pairs) {
        if (!groups.has(pair.group)) {
            groups.set(pair.group, []);
        }
        groups.get(pair.group)?.push(pair.label === '' ? pair.display : `${pair.label}: ${pair.display}`);
    }
    /** @type {ReportLine[]} */
    const lines = [];
    for (const [group, entryLines] of groups) {
        if (group !== '') {
            lines.push({ kind: 'group', text: group });
        }
        for (const text of entryLines) {
            lines.push({ kind: 'entry', text });
        }
    }
    return lines;
}

/**
 * Turns a calculator's snapshot into the two things the dialog needs: the
 * localized list it shows and the canonical block the e-mail carries.
 *
 * The e-mail block starts with `mode: tabtag-0 / tabtag-0-2` and, when the
 * selection came out of a marked cell, `selected: grand-total.metal = "2.306"`,
 * followed by one `key = value` line per entry that differs from its default.
 * @param {ReportSnapshot} snapshot
 * @param {ReportSelection|null} selection
 * @param {ReportTexts} texts
 * @param {typeof REPORT_CONTEXT_LIMITS} [limits] the tests' way of shrinking the caps
 * @returns {ReportContext}
 */
function buildReportContext(snapshot, selection, texts, limits = REPORT_CONTEXT_LIMITS) {
    const offered = snapshot.mode.length > 0 || snapshot.entries.length > 0;
    if (!offered) {
        return { ...EMPTY_REPORT_CONTEXT, lines: [] };
    }

    /** @type {ReportLine[]} */
    const lines = [];
    /** @type {string[]} */
    const mail = [];

    if (snapshot.mode.length > 0) {
        const labels = snapshot.mode.map((part) => clipReportField(part.label, limits.maxLabelLength));
        lines.push({ kind: 'mode', text: `${texts.mode}: ${labels.join(' › ')}` });
        mail.push(`mode: ${snapshot.mode.map((part) => part.key).join(' / ')}`);
    }
    if (selection !== null && selection.key !== '') {
        if (selection.caption !== '') {
            lines.push({ kind: 'selected', text: `${texts.selected}: ${clipReportField(selection.caption, limits.maxLabelLength)}` });
        }
        const shown = clipReportField(selection.text, limits.maxValueLength);
        mail.push(`selected: ${selection.key} = ${JSON.stringify(shown)}`);
    }

    const toSend = reportEntriesToSend(snapshot.entries);
    const kept = toSend.slice(0, limits.maxPairs);
    const omitted = toSend.length - kept.length;

    lines.push(...groupReportLines(kept.map((entry) => ({
        group: clipReportField(entry.group, limits.maxLabelLength),
        label: clipReportField(entry.label, limits.maxLabelLength),
        display: clipReportField(displayReportValue(entry, texts), limits.maxValueLength),
    }))));
    for (const entry of kept) {
        const key = clipReportField(entry.key, limits.maxLabelLength);
        // String() of the raw value is the canonical form the e-mail wants:
        // dot decimals, no thousands separators, true/false.
        mail.push(`${key} = ${clipReportField(String(entry.value), limits.maxValueLength)}`);
    }

    if (toSend.length === 0) {
        lines.push({ kind: 'empty', text: texts.allDefaults });
        // English on purpose, like the other e-mail-only lines: it is read in
        // the site owner's mailbox, not on the sender's screen.
        mail.push('(all fields at their defaults)');
    }
    if (omitted > 0) {
        lines.push({ kind: 'omitted', text: reportOmittedLine(omitted, texts) });
        mail.push(`(+${omitted} more field${omitted === 1 ? '' : 's'} not attached)`);
    }

    let text = mail.join('\n');
    if (text.length > limits.maxTotalLength) {
        text = text.slice(0, limits.maxTotalLength - 1) + '…';
    }
    return { offered, lines, text, omitted };
}
