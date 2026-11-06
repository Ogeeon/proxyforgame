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

// What collectReportControls() last built for the open dialog. The page cannot
// change while the modal is up, so one collection per open is the truth the
// whole open works with; empty until then.
/** @type {ReportContext} */
let reportContext = { pairs: [], text: '', omitted: 0 };

// Page chrome, not the calculator: the sidebar with its selects of its own,
// the topbar's language and profile pickers, every dialog, and the honeypot.
const REPORT_CONTEXT_EXCLUDES = '#sidebar, #sidebarOffcanvas, #topbar, .modal, .offcanvas, .pfg-hp';

// Input types that are UI plumbing rather than a value a person set.
const REPORT_SKIP_TYPES = new Set(['hidden', 'button', 'submit', 'reset', 'image', 'file', 'password']);

/**
 * The text of the control's label: the label pointing at its id, else a label
 * wrapped around it, else '' - the name is the fallback the context builder
 * applies. Left unsqueezed; buildReportContext does that for every field.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
 * @returns {string}
 */
function reportLabelOf(el) {
    if (el.id !== '') {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label && label.textContent.trim() !== '') {
            return label.textContent;
        }
    }
    const wrapped = el.closest('label');
    if (wrapped && wrapped.textContent.trim() !== '') {
        return wrapped.textContent;
    }
    return '';
}

/**
 * Reads the page's form controls into the plain objects report-context.js
 * works on: what a person would read off the page. Radios of one group
 * collapse into the option that is on - a group nobody answered says nothing
 * about the calculation - and a select reports its option's text, not the key
 * in its value attribute.
 * @returns {ReportControl[]}
 */
function collectReportControls() {
    /** @type {ReportControl[]} */
    const controls = [];
    const seenRadioGroups = new Set();
    for (const el of document.querySelectorAll('input, select, textarea')) {
        const control = readReportControl(el, seenRadioGroups);
        if (control !== null) {
            controls.push(control);
        }
    }
    return controls;
}

/**
 * One control as the report carries it, or null for an element the report
 * leaves out: page chrome, a hidden or button input, an unanswered radio.
 * @param {Element} el
 * @param {Set<string>} seenRadioGroups - radio groups already carried
 * @returns {ReportControl|null}
 */
function readReportControl(el, seenRadioGroups) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        return null;
    }
    const kind = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
    if (REPORT_SKIP_TYPES.has(kind)) {
        return null;
    }
    if (el.closest(REPORT_CONTEXT_EXCLUDES) !== null) {
        return null;
    }
    if (el instanceof HTMLInputElement && el.type === 'radio') {
        return readReportRadio(el, seenRadioGroups);
    }
    return { type: kind, name: el.name || el.id || '', label: reportLabelOf(el), value: readReportValue(el) };
}

/**
 * The one line a radio group contributes: the checked option, or null for an
 * unchecked one and for a group another radio has already answered.
 * @param {HTMLInputElement} el
 * @param {Set<string>} seenRadioGroups
 * @returns {ReportControl|null}
 */
function readReportRadio(el, seenRadioGroups) {
    const group = el.name || el.id;
    if (!el.checked || (group !== '' && seenRadioGroups.has(group))) {
        return null;
    }
    if (group !== '') {
        seenRadioGroups.add(group);
    }
    // The line reads "player-class: Collector": the group says which setting
    // it is, the option's label says where it stands.
    return { type: 'radio', name: group, label: group, value: reportLabelOf(el) || el.value };
}

/**
 * What a control says as a person reads it: the chosen option's text for a
 * select, the state for a checkbox, the value for the rest.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} el
 * @returns {string}
 */
function readReportValue(el) {
    if (el instanceof HTMLSelectElement) {
        // The calculators have no multiple select; the first option is it.
        return String(el.selectedOptions.length > 0 ? el.selectedOptions[0].textContent : el.value);
    }
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        return el.checked ? 'on' : 'off';
    }
    return String(el.value ?? '');
}

/**
 * Whether the calculation-error switch is on. When it is hidden - a page with
 * nothing to attach - it is also unchecked, so one read answers both.
 * @returns {boolean}
 */
function isReportCalcOn() {
    return formField('report-calc-toggle').checked;
}

/**
 * Fills the list the dialog shows of what will be attached. Values are what
 * the visitor typed on the page: textContent, never innerHTML, so a pasted
 * `<script>` stays the text it is.
 * @param {{label: string, value: string}[]} pairs
 */
function fillReportContextList(pairs) {
    const list = requireEl('report-calc-values');
    list.innerHTML = '';
    for (const pair of pairs) {
        const li = document.createElement('li');
        li.textContent = `${pair.label}: ${pair.value}`;
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
 */
function prepareReportCalcMode(selection) {
    reportContext = buildReportContext(collectReportControls());
    const block = requireEl('report-calc-block');
    if (reportContext.pairs.length === 0) {
        // Nothing to attach on this page (the front page): the switch is not
        // offered and the dialog keeps its misspelling shape.
        block.classList.add('d-none');
        setReportCalcMode(false);
        return;
    }
    block.classList.remove('d-none');
    fillReportContextList(reportContext.pairs);
    setReportCalcMode(looksLikeCalculationError(selection));
}

function showReportWindow(text) {
    formField('misspelled-text').value = text;
    formField('corrected-text').value = text;
    formField('report-website').value = '';
    reportOpenedAt = performance.now();
    prepareReportCalcMode(text);
    reportModal.show();
    showSendDiv('report', 'data');
    setTimeout(() => requireEl('corrected-text').focus(), 300);
    reportStep = 0;
    updateButtonsState('report');
}

function getText(e) {
    if (!e) return;
    if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 10)) {
        let mis = getSelectedText();
        if (mis) {
            showReportWindow(mis);
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
    let mis = getSelectedText();
    if (mis) {
        showReportWindow(mis);
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
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (!target || typeof target.closest !== 'function') return;
    const el = target.closest('[data-bs-toggle="tooltip"]');
    if (!el || el.matches('input, select, textarea')) return;
    const instance = bootstrap.Tooltip.getInstance(el);
    if (!instance) return;
    instance.hide();
    // The mouseenter right before the click queues the show through a timeout, so on a
    // fast click the tooltip is not on screen yet and hide() above is a no-op. Repeat it
    // on the next task: hide() is harmless when nothing is shown, and it is what clears
    // the focus trigger that would otherwise keep the bubble pinned to the button.
    setTimeout(() => instance.hide(), 0);
}, true);

document.addEventListener('DOMContentLoaded', function() {
    // The bundle is served from our own origin, so a missing one means its request
    // failed. There is nothing this handler can wire without it - the dialogs it
    // builds are the only way the report, e-mail and changelog buttons are
    // reachable - so it returns rather than throwing out of the handler. The click
    // handler above carries the same guard.
    if (typeof bootstrap === 'undefined') return;

    reportModal = new bootstrap.Modal(requireEl('reportModal'));
    emailModal = new bootstrap.Modal(requireEl('emailModal'));
    changelogModal = new bootstrap.Modal(requireEl('changelogModal'));

    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
        bootstrap.Tooltip.getOrCreateInstance(el);
    });

    const sidebarToggleBtn = document.querySelector('[data-bs-target="#sidebarOffcanvas"]');
    const sidebarOffcanvas = document.getElementById('sidebarOffcanvas');
    const body = document.body;
    const offcanvasOpenClass = 'sidebar-offcanvas-open';
    if (sidebarToggleBtn && sidebarOffcanvas) {
        sidebarOffcanvas.addEventListener('show.bs.offcanvas', function () {
            sidebarToggleBtn.classList.add('d-none');
            body.classList.add(offcanvasOpenClass);
        });
        sidebarOffcanvas.addEventListener('hide.bs.offcanvas', function () {
            body.classList.remove(offcanvasOpenClass);
        });
        sidebarOffcanvas.addEventListener('hidden.bs.offcanvas', function () {
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

    requireEl('reportModal').addEventListener('hidden.bs.modal', function() {
        reportStep = 0;
        showSendDiv('report', 'data');
        // Back to the misspelling shape, so the next open starts clean whether
        // it re-runs prepareReportCalcMode or not (the e-mail dialog flows
        // through here too and would otherwise find stale labels).
        setReportCalcMode(false);
    });
    
    requireEl('emailModal').addEventListener('hidden.bs.modal', function() {
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
