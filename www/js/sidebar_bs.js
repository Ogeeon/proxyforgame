let reportModal, emailModal, changelogModal;
let reportStep = 0;
let emailStep = 0;

// The answers each dialog has a div - and a locale string - of its own for.
// Anything else, an unexpected status or a dropped connection, falls back to
// `request_error`: the user gets "something went wrong with the request", which
// is all the three separate "error in request" messages ever said anyway.
const REPORT_CODES = ['sent', 'both_empty', 'texts_equal', 'wrong_empty', 'right_empty', 'mail_failed', 'request_error'];
const EMAIL_CODES = ['sent', 'nothing_to_send', 'mail_failed', 'request_error'];
const SEND_DIV_IDS = ['data', 'progress', ...new Set([...REPORT_CODES, ...EMAIL_CODES].map((code) => `err-${code}`))];

/**
 * An element sidebar_bs.tpl is required to contain.
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

function showReportWindow(text) {
    formField('misspelled-text').value = text;
    formField('corrected-text').value = text;
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
        await apiPost('report', {
            url: currUrl,
            wrong: formField('misspelled-text').value,
            right: formField('corrected-text').value,
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
 * The changelog table body, which sidebar_bs.tpl always provides.
 * @returns {HTMLElement}
 */
function changelogBody() {
    const tbody = requireEl('changelog-tbl').querySelector('tbody');
    if (!tbody) {
        throw new Error('sidebar: #changelog-tbl has no tbody');
    }
    return /** @type {HTMLElement} */ (tbody);
}

function clearChangelogTable() {
    changelogBody().innerHTML = '';
}

function fillChangelogTable(changes) {
    if (!changes || changes.length === 0) {
        return;
    }
    const tbody = changelogBody();
    for (const change of changes) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center text-info-emphasis">${change.ts}</td>
            <td class="text-info-emphasis">${change.description}</td>
        `;
        tbody.appendChild(tr);
    }
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
                sendReport();
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
                sendEmail();
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
    
    requireEl('reportModal').addEventListener('hidden.bs.modal', function() {
        reportStep = 0;
        showSendDiv('report', 'data');
    });
    
    requireEl('emailModal').addEventListener('hidden.bs.modal', function() {
        emailStep = 0;
        showSendDiv('email', 'data');
    });
});

document.addEventListener('keydown', getText);

let lastChange = { value: 42, validate: function(key, val) { return val; } };
loadFromCookie('lastChange', lastChange);
if (lastChange && lastChange.value < currChange.value) {
    requestAndShowChangelog(lastChange);
}
saveToCookie('lastChange', currChange);
