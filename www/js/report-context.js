// The DOM-free half of the calculation-error context: what the sidebar's
// report dialog attaches when the "this is a calculation error" switch is on.
//
// A report that only says "690.814 is wrong" cannot be reproduced, so the
// dialog collects the calculator's current field values and sends them along.
// Walking the DOM is sidebar.js's job; what happens to the values - the caps,
// the "label: value" lines, the guess that a selection containing a digit is
// about a calculation rather than a misspelling - lives here, typed against
// plain objects so the unit tests need no DOM (the interaction-timing.js
// pattern).

/**
 * One form control, reduced to what the report carries - typed apart from the
 * DOM interface so the unit tests can hand in plain objects.
 * @typedef {object} ReportControl
 * @property {string} type     the input type, or the tag name for select/textarea
 * @property {string} name     the name or id attribute, the label's fallback
 * @property {string} label    the control's label text, possibly empty
 * @property {string} value    what the control says, as a person reads it
 */

/**
 * @typedef {object} ReportContext
 * @property {{label: string, value: string}[]} pairs   the capped label/value pairs
 * @property {string} text                         the pairs as lines, ready for the e-mail
 * @property {number} omitted                      controls left out by the pair cap
 */

// What one report may carry. The pair cap bounds a page of many rows (the
// production calculator with a full planet list), the per-field caps bound a
// pasted spy report, and the total is the same number the server clips at -
// the client is expected to stay under it, the server makes sure it does.
const REPORT_CONTEXT_LIMITS = {
    maxPairs: 200,
    maxLabelLength: 120,
    maxValueLength: 300,
    maxTotalLength: 10000,
};

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
 * Squashes template indentation and clipping into the label that goes out.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function clipReportField(text, max) {
    const squeezed = text.replace(/\s+/g, ' ').trim();
    return squeezed.length > max ? squeezed.slice(0, max - 1) + '…' : squeezed;
}

/**
 * Turns the page's controls into the lines a calculation-error report carries.
 * A radio group arrives as one control - the checked option - from the DOM
 * walk, so nothing here needs to know about groups.
 * @param {ReportControl[]} controls
 * @param {typeof REPORT_CONTEXT_LIMITS} [limits] the tests' way of shrinking the caps
 * @returns {ReportContext}
 */
function buildReportContext(controls, limits = REPORT_CONTEXT_LIMITS) {
    const pairs = [];
    let omitted = 0;
    for (const control of controls) {
        const label = clipReportField(control.label || control.name || '', limits.maxLabelLength);
        const value = clipReportField(String(control.value ?? ''), limits.maxValueLength);
        // A control with neither a name nor a value says nothing; it is left
        // out without counting as cut.
        if (label === '' && value === '') {
            continue;
        }
        if (pairs.length >= limits.maxPairs) {
            omitted++;
            continue;
        }
        pairs.push({ label, value });
    }

    const lines = pairs.map((pair) => `${pair.label}: ${pair.value}`);
    // English on purpose: this line is read in the site owner's mailbox, like
    // the "Form values:" heading itself, not on the sender's screen.
    if (omitted > 0) {
        lines.push(`(+${omitted} more field${omitted === 1 ? '' : 's'} not attached)`);
    }

    let text = lines.join('\n');
    if (text.length > limits.maxTotalLength) {
        text = text.slice(0, limits.maxTotalLength - 1) + '…';
    }
    return { pairs, text, omitted };
}
