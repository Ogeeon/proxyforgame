let reportModal, emailModal, changelogModal;
let reportStep = 0;
let emailStep = 0;
// When each dialog was last opened (performance.now()). The server drops a
// message sent sooner after that than a person could have written it.
let reportOpenedAt = 0;
let emailOpenedAt = 0;

// The answers each dialog has a div - and a locale string - of its own for.
// Anything else, an unexpected status or a dropped connection, falls back to
// `request_error`: the user gets "something went wrong with the request", which
// is all the three separate "error in request" messages ever said anyway.
// The calc_* codes are the calculation-error mode's wording of the two
// mistakes that mode can still make; the template renders them in the same
// order as this list.
const REPORT_CODES = ['sent', 'both_empty', 'calc_both_empty', 'texts_equal', 'wrong_empty', 'calc_wrong_empty', 'right_empty', 'mail_failed', 'rate_limited', 'request_error'];
const EMAIL_CODES = ['sent', 'nothing_to_send', 'mail_failed', 'rate_limited', 'request_error'];
const SEND_DIV_IDS = ['data', 'progress', ...new Set([...REPORT_CODES, ...EMAIL_CODES].map((code) => `err-${code}`))];

/**
 * An element sidebar.tpl is required to contain.
 *
 * Every id passed here is written in that template, so a miss means the two
 * have drifted apart. Saying so by name beats the "cannot read properties of
 * null" that surfaces a few frames later, usually inside a fetch handler whose
 * catch swallows it.
 *
 * @param {string} id - element id
 * @returns {HTMLElement}
 */
function requireEl(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`sidebar: the page has no #${id}`);
    }
    return el;
}

/**
 * A text field of the report or e-mail dialog.
 * @param {string} id - element id
 * @returns {HTMLInputElement}
 */
function formField(id) {
    return /** @type {HTMLInputElement} */ (requireEl(id));
}

// The calculation-error flavour of the report dialog. The texts the template
// renders are the misspelling flavour's; setReportCalcMode swaps them for the
// ones sidebar.tpl inlines as reportCalcText, keeping the originals here.
let reportCalcDefaults = null;

// What prepareReportCalcMode() last built for the open dialog. The page cannot
// change while the modal is up, so one collection per open is the truth the
// whole open works with; empty until then.
/** @type {ReportContext} */
let reportContext = { offered: false, lines: [], text: '', omitted: 0 };

// Page chrome, not the calculator: the sidebar with its selects of its own,
// the topbar's language and profile pickers, every dialog, and the honeypot -
// plus any field a template marks data-report-skip: the resources available,
// which a report never carries.
const REPORT_CONTEXT_EXCLUDES = '#sidebar, #sidebarOffcanvas, #topbar, .modal, .offcanvas, .pfg-hp, [data-report-skip]';

// Input types that are UI plumbing rather than a value a person set.
const REPORT_SKIP_TYPES = new Set(['hidden', 'button', 'submit', 'reset', 'image', 'file', 'password']);

/**
 * A label as the report shows it: squeezed, without the trailing colon the
 * templates put after a caption ("Exchange rates:").
 * @param {string} text
 * @returns {string}
 */
function cleanReportLabel(text) {
    const squeezed = text.replace(/\s+/g, ' ').trim();
    // A plain endsWith rather than /\s*:$/, which backtracks (Sonar S8786).
    return squeezed.endsWith(':') ? squeezed.slice(0, -1).trimEnd() : squeezed;
}

/**
 * The text of the field's label: the label pointing at its id, else a label
 * wrapped around it, else its aria-label - what the table inputs carry - else
 * ''; reportEntryOf() falls back to the key.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
 * @returns {string}
 */
function reportLabelOf(el) {
    if (el.id !== '') {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        const text = cleanReportLabel(label?.textContent ?? '');
        if (text !== '') {
            return text;
        }
    }
    const wrapped = cleanReportLabel(el.closest('label')?.textContent ?? '');
    if (wrapped !== '') {
        return wrapped;
    }
    return cleanReportLabel(el.getAttribute('aria-label') ?? '');
}

/**
 * How a calculator's reportSnapshot() hook overrides what reportEntryOf()
 * reads off a field.
 * @typedef {object} ReportFieldOptions
 * @property {string} [key]        defaults to the id, else the name
 * @property {string} [group]      defaults to none
 * @property {string} [label]      defaults to reportLabelOf()
 * @property {boolean} [numeric]   read a text field as a locale-aware number,
 *                                 its default from the template's dot-decimal value
 */

/**
 * One field as a report entry: its canonical value next to its factory
 * default - the template's value, checked state or selected option, which a
 * profile or a saved setting never touches - and what the page shows.
 * Shared by the generic walk below and the calculators' reportSnapshot() hooks.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
 * @param {ReportFieldOptions} [opts]
 * @returns {ReportEntry}
 */
function reportEntryOf(el, opts = {}) {
    const key = opts.key ?? (el.id || el.name);
    const group = opts.group ?? '';
    // A field with no caption at all is still better named by its id than
    // shown as a bare value.
    const label = opts.label ?? (reportLabelOf(el) || key);
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        return { key, group, label, value: el.checked, default: el.defaultChecked };
    }
    if (el instanceof HTMLSelectElement) {
        const all = Array.from(el.options);
        // A select with no option marked selected starts on its first one.
        const start = all.find((option) => option.defaultSelected) ?? all[0];
        const shown = el.selectedOptions.length > 0 ? el.selectedOptions[0].textContent ?? '' : el.value;
        return { key, group, label, value: el.value, default: start ? start.value : '', display: shown.trim() };
    }
    if (opts.numeric) {
        return {
            key, group, label,
            value: getInputNumber(el),
            default: Number.parseFloat(el.defaultValue) || 0,
            display: el.value,
        };
    }
    return { key, group, label, value: el.value, default: el.defaultValue };
}

/**
 * A field by id as a report entry, for the calculators' hooks: a select or a
 * checkbox as it is, a text field as a locale-aware number, and an id no
 * element has as the name of a radio group - one entry captioned by its
 * fieldset's legend, reading as the option that is on against the one the
 * template checks. Null when there is nothing by that id or name.
 * @param {string} id - a field id, or the name of a radio group
 * @param {string} group
 * @param {ReportFieldOptions} [opts]
 * @returns {ReportEntry|null}
 */
function reportFieldById(id, group, opts = {}) {
    const el = document.getElementById(id);
    if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type === 'checkbox')) {
        return reportEntryOf(el, { group, ...opts });
    }
    if (el instanceof HTMLInputElement) {
        return reportEntryOf(el, { group, numeric: true, ...opts });
    }
    const first = document.getElementsByName(id)[0];
    if (!(first instanceof HTMLInputElement) || first.type !== 'radio') {
        return null;
    }
    const entry = readReportRadio(first, new Set());
    return entry === null ? null : { ...entry, group, ...opts };
}

/**
 * Reads the page's form fields into a snapshot, for a calculator without a
 * reportSnapshot() hook. What a person sees and set: hidden fields - an
 * inactive tab, a closed dialog - are left out, and radios of one group
 * collapse into one entry, the option that is on. The defaults go along;
 * buildReportContext drops the fields still standing at them.
 * @returns {ReportSnapshot}
 */
function collectFallbackSnapshot() {
    /** @type {ReportEntry[]} */
    const entries = [];
    const seenRadioGroups = new Set();
    for (const el of document.querySelectorAll('input, select, textarea')) {
        const entry = readReportField(el, seenRadioGroups);
        if (entry !== null) {
            entries.push(entry);
        }
    }
    return { mode: [], entries };
}

/**
 * One field as the generic walk carries it, or null for an element the report
 * leaves out: page chrome, a hidden field, a button input, a radio group
 * already carried.
 * @param {Element} el
 * @param {Set<string>} seenRadioGroups - radio groups already carried
 * @returns {ReportEntry|null}
 */
function readReportField(el, seenRadioGroups) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        return null;
    }
    const kind = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
    if (REPORT_SKIP_TYPES.has(kind) || el.closest(REPORT_CONTEXT_EXCLUDES) !== null) {
        return null;
    }
    // No layout box: an inactive tab pane, a collapsed panel, a d-none row.
    if (el.getClientRects().length === 0) {
        return null;
    }
    if (el instanceof HTMLInputElement && el.type === 'radio') {
        return readReportRadio(el, seenRadioGroups);
    }
    return reportEntryOf(el);
}

/**
 * The one entry a radio group contributes: the option that is on, against
 * the one the template checks (else its first).
 * @param {HTMLInputElement} el
 * @param {Set<string>} seenRadioGroups
 * @returns {ReportEntry|null}
 */
function readReportRadio(el, seenRadioGroups) {
    const group = el.name || el.id;
    if (group === '' || seenRadioGroups.has(group)) {
        return null;
    }
    seenRadioGroups.add(group);
    /** @type {HTMLInputElement[]} */
    const radios = [];
    for (const r of el.name === '' ? [el] : document.getElementsByName(el.name)) {
        if (r instanceof HTMLInputElement && r.type === 'radio') {
            radios.push(r);
        }
    }
    const on = radios.find((r) => r.checked);
    // A group the template checks none of gets its first option checked by
    // the calculator on load, so that one stands for the default.
    const start = radios.find((r) => r.defaultChecked) ?? radios[0];
    // The line reads "Class: Collector": the fieldset's legend says which
    // setting it is, the option's label says where it stands.
    const legend = cleanReportLabel(el.closest('fieldset')?.querySelector('legend')?.textContent ?? '');
    return {
        key: group,
        group: '',
        label: legend || group,
        value: on ? on.value : '',
        default: start ? start.value : '',
        display: on ? reportLabelOf(on) || on.value : '',
    };
}

/**
 * The snapshot the dialog attaches: the calculator's own when it has a
 * reportSnapshot() hook, the generic field walk otherwise - and also when the
 * hook throws, because the report must still go out.
 * @returns {ReportSnapshot}
 */
function collectReportSnapshot() {
    const hook = globalThis.reportSnapshot;
    if (typeof hook === 'function') {
        try {
            return hook();
        } catch (e) {
            console.error('reportSnapshot failed, attaching the page fields instead:', e);
        }
    }
    return collectFallbackSnapshot();
}

/**
 * The result cell the current selection sits in: the closest element marked
 * data-report-cell around everything selected. A selection spanning several
 * cells has its common ancestor above them, so it answers null, as does no
 * selection at all.
 * @returns {HTMLElement|null}
 */
function selectedReportCell() {
    const selection = globalThis.getSelection?.();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const node = selection.getRangeAt(0).commonAncestorContainer;
    const el = node instanceof Element ? node : node.parentElement;
    const cell = el?.closest('[data-report-cell]') ?? null;
    return cell instanceof HTMLElement ? cell : null;
}

/**
 * The selection as the report names it: the marked cell's key and the
 * calculator's caption for it (describeCell), with the text as selected.
 * @param {string} text - the selected text
 * @param {HTMLElement|null} cell - the marked cell it came from, if any
 * @returns {ReportSelection|null}
 */
function reportSelectionOf(text, cell) {
    const key = cell?.dataset.reportCell ?? '';
    if (key === '') {
        return null;
    }
    let caption = '';
    const describe = globalThis.describeCell;
    if (typeof describe === 'function') {
        try {
            caption = describe(key);
        } catch (e) {
            console.error('describeCell failed:', e);
        }
    }
    return { key, caption, text };
}

/**
 * The words of the shown list, out of what sidebar.tpl inlines.
 * @returns {ReportTexts}
 */
function reportTexts() {
    return {
        locale: document.documentElement.lang,
        mode: reportCalcText.mode,
        selected: reportCalcText.selected,
        yes: reportCalcText.yes,
        no: reportCalcText.no,
        allDefaults: reportCalcText.allDefaults,
        omitted: {
            one: reportCalcText.omittedOne,
            few: reportCalcText.omittedFew,
            many: reportCalcText.omittedMany,
            other: reportCalcText.omittedOther,
        },
    };
}

/**
 * Whether the calculation-error switch is on. When it is hidden - a page with
 * nothing to attach - it is also unchecked, so one read answers both.
 * @returns {boolean}
 */
function isReportCalcOn() {
    return formField('report-calc-toggle').checked;
}

// How each kind of line of the shown list is set apart.
const REPORT_LINE_CLASSES = {
    mode: ['fw-semibold'],
    selected: ['fw-semibold'],
    group: ['fw-semibold', 'mt-1'],
    entry: ['ps-2'],
    omitted: ['fst-italic', 'mt-1'],
    empty: ['fst-italic'],
};

/**
 * Fills the list the dialog shows of what will be attached. Values are what
 * the visitor typed on the page: textContent, never innerHTML, so a pasted
 * `<script>` stays the text it is.
 * @param {ReportLine[]} lines
 */
function fillReportContextList(lines) {
    const list = requireEl('report-calc-values');
    list.innerHTML = '';
    for (const line of lines) {
        const li = document.createElement('li');
        li.classList.add(...REPORT_LINE_CLASSES[line.kind]);
        li.textContent = line.text;
        list.appendChild(li);
    }
}

/**
 * Turns the dialog into the asked-for flavour. The texts come from the
 * template (misspelling) or reportCalcText (calculation error); the details
 * list and the Discord hint are part of the calculation flavour only.
 * @param {boolean} on
 */
function setReportCalcMode(on) {
    const title = requireEl('reportModalLabel');
    const info = requireEl('report-info');
    const wrongLabel = requireEl('report-label-wrong');
    const rightLabel = requireEl('report-label-right');
    if (reportCalcDefaults === null) {
        reportCalcDefaults = {
            title: title.textContent,
            info: info.textContent,
            wrong: wrongLabel.textContent,
            right: rightLabel.textContent,
        };
    }
    formField('report-calc-toggle').checked = on;
    requireEl('report-calc-details').classList.toggle('d-none', !on);
    requireEl('report-calc-discord').classList.toggle('d-none', !on);
    if (on) {
        // The prefill put the selection into both fields, for the typo flow
        // where the second is the first, edited. Left standing here it would
        // claim the game shows what the calculator shows; an empty field says
        // "don't know", which this mode accepts.
        const wrong = formField('misspelled-text');
        const right = formField('corrected-text');
        if (right.value === wrong.value) {
            right.value = '';
        }
    }
    const texts = on ? reportCalcText : reportCalcDefaults;
    title.textContent = texts.title;
    info.textContent = texts.info;
    wrongLabel.textContent = texts.wrong;
    rightLabel.textContent = texts.right;
}

/**
 * Collects the page's fields and decides the switch's start for the dialog
 * about to open: offered only where something can be attached, and pre-flipped
 * on when the selection reads like a wrong number rather than a misspelling.
 * @param {string} selection - the text the dialog was opened with
 * @param {HTMLElement|null} cell - the marked result cell it was selected in
 */
function prepareReportCalcMode(selection, cell) {
    reportContext = buildReportContext(collectReportSnapshot(), reportSelectionOf(selection, cell), reportTexts());
    const block = requireEl('report-calc-block');
    if (!reportContext.offered) {
        // Nothing to attach on this page (the front page): the switch is not
        // offered and the dialog keeps its misspelling shape.
        block.classList.add('d-none');
        setReportCalcMode(false);
        return;
    }
    block.classList.remove('d-none');
    fillReportContextList(reportContext.lines);
    setReportCalcMode(looksLikeCalculationError(selection));
}

/**
 * Opens the report dialog for the selected text.
 * @param {string} text - the selected text
 * @param {HTMLElement|null} [cell] - the marked result cell it sits in, read
 *        before anything else can move the selection
 */
function showReportWindow(text, cell = null) {
    formField('misspelled-text').value = text;
    formField('corrected-text').value = text;
    formField('report-website').value = '';
    reportOpenedAt = performance.now();
    prepareReportCalcMode(text, cell);
    reportModal.show();
    showSendDiv('report', 'data');
    setTimeout(() => requireEl('corrected-text').focus(), 300);
    reportStep = 0;
    updateButtonsState('report');
}

function getText(e) {
    if (!e) return;
    if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 10)) {
        const mis = getSelectedText();
        if (mis) {
            showReportWindow(mis, selectedReportCell());
        }
    }
}

function getSelectedText() {
    if (globalThis.getSelection) {
        return globalThis.getSelection()?.toString() ?? '';
    }
    return /** @type {any} */ (document).selection?.createRange()?.text ?? '';
}

function findSelection() {
    const mis = getSelectedText();
    if (mis) {
        showReportWindow(mis, selectedReportCell());
    }
}

function showSendDiv(dialog, id) {
    for (const itemId of SEND_DIV_IDS) {
        const el = document.getElementById(`${dialog}-${itemId}`);
        if (el) {
            if (id === itemId) {
                el.classList.remove('d-none');
                if (itemId.startsWith('err-')) {
                    el.classList.add('alert-info');
                }
            } else {
                el.classList.add('d-none');
            }
        }
    }
}

function updateButtonsState(dlg) {
    const btnOk = requireEl(`${dlg}-btn-ok`);
    const btnCancel = requireEl(`${dlg}-btn-cancel`);
    const step = dlg === 'report' ? reportStep : emailStep;
    
    switch (step) {
        case 0: {
            btnOk.textContent = buttonsText.send;
            btnOk.style.display = 'inline-block'; 
            btnCancel.style.display = 'inline-block'; 
            break;
        } 
        case 1: { 
            btnOk.style.display = 'none'; 
            btnCancel.style.display = 'none';
            break;
        }
        case 2: {
            btnOk.textContent = buttonsText.correct;
            btnOk.style.display = 'inline-block'; 
            btnCancel.style.display = 'inline-block'; 
            break;
        }
        case 3: {
            btnOk.textContent = buttonsText.ok;
            btnOk.style.display = 'inline-block'; 
            btnCancel.style.display = 'none'; 
            break;
        }
    }
}

/**
 * Shows the outcome of a send and moves the dialog onto the step that outcome
 * calls for. Skinning comes after the step is set: an unexpected code used to
 * throw on the way here, into a catch that swallowed it, leaving the dialog on
 * its progress spinner with both buttons hidden.
 *
 * @param {string} dialog - 'report' or 'email'
 * @param {string} code - an ApiError code, or 'sent'
 */
function finishSend(dialog, code) {
    const known = dialog === 'report' ? REPORT_CODES : EMAIL_CODES;
    const shown = known.includes(code) ? code : 'request_error';
    const errDiv = document.getElementById(`${dialog}-err-${shown}`);
    showSendDiv(dialog, `err-${shown}`);

    const step = shown === 'sent' ? 3 : 2;
    if (dialog === 'report') {
        reportStep = step;
    } else {
        emailStep = step;
    }

    if (errDiv) {
        errDiv.classList.remove('alert-info');
        if (shown !== 'sent') {
            errDiv.classList.add('alert-warning');
        }
    }
    updateButtonsState(dialog);
}

async function sendReport() {
    showSendDiv('report', 'progress');

    try {
        const calc = isReportCalcOn();
        await apiPost('report', {
            url: currUrl,
            wrong: formField('misspelled-text').value,
            right: formField('corrected-text').value,
            website: formField('report-website').value,
            elapsed: Math.round(performance.now() - reportOpenedAt),
            // '1'/'0' strings: the API client stringifies every value anyway,
            // and the server compares against exactly this.
            calc: calc ? '1' : '0',
            context: calc ? reportContext.text : '',
        });
        finishSend('report', 'sent');
    } catch (e) {
        console.error('report send failed:', e);
        finishSend('report', e instanceof ApiError ? e.code : 'request_error');
    }
}

function showEmailWindow() {
    formField('email-form-address').value = '';
    formField('email-form-subject').value = '';
    formField('email-form-body').value = '';
    formField('email-website').value = '';
    emailOpenedAt = performance.now();
    emailModal.show();
    showSendDiv('email', 'data');
    setTimeout(() => requireEl('email-form-subject').focus(), 300);
    emailStep = 0;
    updateButtonsState('email');
}

async function sendEmail() {
    showSendDiv('email', 'progress');

    try {
        await apiPost('email', {
            address: formField('email-form-address').value,
            subject: formField('email-form-subject').value,
            body: formField('email-form-body').value,
            website: formField('email-website').value,
            elapsed: Math.round(performance.now() - emailOpenedAt),
        });
        finishSend('email', 'sent');
    } catch (e) {
        console.error('email send failed:', e);
        finishSend('email', e instanceof ApiError ? e.code : 'request_error');
    }
}

function isManualChangelogRequest(fromChange) {
    if (typeof fromChange === 'number') {
        return fromChange === -1;
    }
    if (typeof fromChange === 'object' && fromChange !== null && 'value' in fromChange) {
        return Number(fromChange.value) === -1;
    }
    return false;
}

function toggleChangelogHeader(showHeader) {
    for (const id of ['changelog-header-text', 'changelog-header-spacer']) {
        const el = document.getElementById(id);
        if (!el) {
            continue;
        }
        if (showHeader) {
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    }
}

async function requestAndShowChangelog(fromChange) {
    try {
        const changes = await apiGet('changelog', {
            lastSeen: fromChange.value || -1,
            lang: currLang,
        });
        clearChangelogTable();
        fillChangelogTable(changes);
        toggleChangelogHeader(!isManualChangelogRequest(fromChange));
        changelogModal.show();
        setTimeout(() => requireEl('changelog-btn-ok').focus(), 300);
    } catch (e) {
        // Nothing to show the user: the changelog opens on its own after a
        // release, so a failure here means one dialog fewer, not a broken page.
        console.error('changelog request failed:', e);
    }
}

/**
 * The changelog table body, which sidebar.tpl always provides.
 * @returns {HTMLElement}
 */
function changelogBody() {
    const tbody = requireEl('changelog-tbl').querySelector('tbody');
    if (!tbody) {
        throw new Error('sidebar: #changelog-tbl has no tbody');
    }
    return /** @type {HTMLElement} */ (tbody);
}

// How many rows one page of the changelog table holds. The full list can run to
// dozens of entries, which used to render as one long scroll inside the modal.
const CHANGELOG_PAGE_SIZE = 10;

let changelogEntries = [];
let changelogPage = 0;

function clearChangelogTable() {
    changelogEntries = [];
    changelogPage = 0;
    changelogBody().innerHTML = '';
    updateChangelogPager(1);
}

function fillChangelogTable(changes) {
    changelogEntries = Array.isArray(changes) ? changes : [];
    changelogPage = 0;
    renderChangelogPage();
}

function changelogPageCount() {
    return Math.max(1, Math.ceil(changelogEntries.length / CHANGELOG_PAGE_SIZE));
}

/**
 * Renders the current changelog page into the table and syncs the pager. Kept
 * separate from fillChangelogTable so the prev/next buttons can re-render
 * without re-fetching.
 */
function renderChangelogPage() {
    const pageCount = changelogPageCount();
    changelogPage = Math.min(Math.max(changelogPage, 0), pageCount - 1);

    const tbody = changelogBody();
    tbody.innerHTML = '';
    const start = changelogPage * CHANGELOG_PAGE_SIZE;
    for (const change of changelogEntries.slice(start, start + CHANGELOG_PAGE_SIZE)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center text-info-emphasis">${change.ts}</td>
            <td class="text-info-emphasis">${change.description}</td>
        `;
        tbody.appendChild(tr);
    }
    updateChangelogPager(pageCount);
}

/**
 * Shows the pager only when there is more than one page, and reflects the
 * current position on it.
 * @param {number} pageCount
 */
function updateChangelogPager(pageCount) {
    const nav = document.getElementById('changelog-pagination');
    if (!nav) {
        return;
    }
    if (pageCount <= 1) {
        nav.classList.add('d-none');
        return;
    }
    nav.classList.remove('d-none');

    const indicator = document.getElementById('changelog-page-indicator');
    if (indicator) {
        indicator.textContent = `${changelogPage + 1} / ${pageCount}`;
    }
    document.getElementById('changelog-prev')?.classList.toggle('disabled', changelogPage === 0);
    document.getElementById('changelog-next')?.classList.toggle('disabled', changelogPage >= pageCount - 1);
}

/**
 * @param {number} delta - -1 for the previous page, +1 for the next
 */
function stepChangelogPage(delta) {
    changelogPage += delta;
    renderChangelogPage();
    changelogBody().closest('.modal-body')?.scrollTo({ top: 0 });
}

// Bootstrap tooltips default to trigger "hover focus", so after a click the button keeps
// focus and its tooltip stays pinned over it until focus moves elsewhere. Hide it in the
// capture phase, before the page handler runs and possibly re-renders or removes the row.
// Form fields are skipped: there the focus-driven tooltip is the intended behaviour
// (e.g. the crawler-limit hint attached in production-orchestration.js).
document.addEventListener('click', function (event) {
    // `typeof` first: when the facade itself failed to load, calling it would throw.
    if (typeof bootstrapAvailable !== 'function' || !bootstrapAvailable()) return;
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (!target || typeof target.closest !== 'function') return;
    const el = target.closest('[data-bs-toggle="tooltip"]');
    if (!el || el.matches('input, select, textarea')) return;
    if (!hideTooltip(el)) return;
    // The mouseenter right before the click queues the show through a timeout, so on a
    // fast click the tooltip is not on screen yet and hide() above is a no-op. Repeat it
    // on the next task: hide() is harmless when nothing is shown, and it is what clears
    // the focus trigger that would otherwise keep the bubble pinned to the button.
    setTimeout(() => hideTooltip(el), 0);
}, true);

document.addEventListener('DOMContentLoaded', function() {
    // The bundle is served from our own origin, so a missing one means its request
    // failed. There is nothing this handler can wire without it - the dialogs it
    // builds are the only way the report, e-mail and changelog buttons are
    // reachable - so it returns rather than throwing out of the handler. The click
    // handler above carries the same guard; `typeof` covers the facade itself
    // having failed to load.
    if (typeof bootstrapAvailable !== 'function' || !bootstrapAvailable()) return;

    reportModal = modalFor(requireEl('reportModal'));
    emailModal = modalFor(requireEl('emailModal'));
    changelogModal = modalFor(requireEl('changelogModal'));

    attachTooltips(document);

    const sidebarToggleBtn = document.querySelector('[data-bs-target="#sidebarOffcanvas"]');
    const sidebarOffcanvas = document.getElementById('sidebarOffcanvas');
    const body = document.body;
    const offcanvasOpenClass = 'sidebar-offcanvas-open';
    if (sidebarToggleBtn && sidebarOffcanvas) {
        sidebarOffcanvas.addEventListener(BS_EVENT.offcanvasShow, function () {
            sidebarToggleBtn.classList.add('d-none');
            body.classList.add(offcanvasOpenClass);
        });
        sidebarOffcanvas.addEventListener(BS_EVENT.offcanvasHide, function () {
            body.classList.remove(offcanvasOpenClass);
        });
        sidebarOffcanvas.addEventListener(BS_EVENT.offcanvasHidden, function () {
            sidebarToggleBtn.classList.remove('d-none');
            body.classList.remove(offcanvasOpenClass);
        });
    }
    
    requireEl('report-btn-ok').addEventListener('click', function() {
        switch (reportStep) {
            case 0:
                void sendReport();
                reportStep = 1;
                updateButtonsState('report');
                break;
            case 2:
                showSendDiv('report', 'data');
                reportStep = 0;
                updateButtonsState('report');
                break;
            case 3:
                reportModal.hide();
                break;
        }
    });
    
    requireEl('email-btn-ok').addEventListener('click', function() {
        switch (emailStep) {
            case 0:
                void sendEmail();
                emailStep = 1;
                updateButtonsState('email');
                break;
            case 2:
                showSendDiv('email', 'data');
                emailStep = 0;
                updateButtonsState('email');
                break;
            case 3:
                emailModal.hide();
                break;
        }
    });
    
    requireEl('report-calc-toggle').addEventListener('change', () => setReportCalcMode(isReportCalcOn()));

    requireEl('changelog-prev').querySelector('button')?.addEventListener('click', () => stepChangelogPage(-1));
    requireEl('changelog-next').querySelector('button')?.addEventListener('click', () => stepChangelogPage(1));

    requireEl('reportModal').addEventListener(BS_EVENT.modalHidden, function() {
        reportStep = 0;
        showSendDiv('report', 'data');
        // Back to the misspelling shape, so the next open starts clean whether
        // it re-runs prepareReportCalcMode or not (the e-mail dialog flows
        // through here too and would otherwise find stale labels).
        setReportCalcMode(false);
    });
    
    requireEl('emailModal').addEventListener(BS_EVENT.modalHidden, function() {
        emailStep = 0;
        showSendDiv('email', 'data');
    });
});

document.addEventListener('keydown', getText);

// The dialog catches a returning visitor up on the releases since their last
// visit. A first visit has nothing to catch up on - it used to open with every
// release since entry 42 - so it only records the current release.
if (readSavedData('lastChange') !== null) {
    const lastChange = { value: 0, validate: function(key, val) { return val; } };
    loadFromCookie('lastChange', lastChange);
    if (lastChange.value < currChange.value) {
        // It catches its own failures - a missed dialog is not worth an error.
        void requestAndShowChangelog(lastChange);
    }
}
saveToCookie('lastChange', currChange);
