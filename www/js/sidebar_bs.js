let reportModal, emailModal, changelogModal;
let reportStep = 0;
let emailStep = 0;

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
    const ids = ['data', 'progress', 'err-0', 'err-1', 'err-2', 'err-3', 'err-4', 'err-5', 'err-6', 'err-7', 'err-99'];
    for (const itemId of ids) {
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

function sendReport() {
    showSendDiv('report', 'progress');
    
    const formData = new URLSearchParams();
    formData.append('service', 'report');
    formData.append('url', currUrl);
    formData.append('wrong', formField('misspelled-text').value);
    formData.append('right', formField('corrected-text').value);
    
    fetch('/ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(data => {
        try {
            const rcode = Number.parseInt(data.substring(0, data.indexOf('\n')));
            // Only the codes showSendDiv() knows have a div of their own. An
            // unexpected one used to throw here, into a catch that swallows it,
            // so the step never advanced and the dialog sat on its progress
            // spinner with both buttons hidden. Advance first, skin second.
            const errDiv = document.getElementById(`report-err-${rcode}`);
            showSendDiv('report', `err-${rcode}`);

            reportStep = rcode === 0 ? 3 : 2;
            if (errDiv) {
                errDiv.classList.remove('alert-info');
                if (rcode !== 0) {
                    errDiv.classList.add('alert-warning');
                }
            }
            updateButtonsState('report');
        } catch(e) {
            console.error('exception: ' + e);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
        showSendDiv('report', 'err-99');
        reportStep = 2;
        updateButtonsState('report');
    });
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

function sendEmail() {
    showSendDiv('email', 'progress');
    
    const formData = new URLSearchParams();
    formData.append('service', 'email');
    formData.append('address', formField('email-form-address').value);
    formData.append('subject', formField('email-form-subject').value);
    formData.append('body', formField('email-form-body').value);
    
    fetch('/ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(data => {
        try {
            const rcode = Number.parseInt(data.substring(0, data.indexOf('\n')));
            // Same as in sendReport(): an unrecognised code must not strand the
            // dialog mid-send.
            const errDiv = document.getElementById(`email-err-${rcode}`);
            showSendDiv('email', `err-${rcode}`);

            emailStep = rcode === 0 ? 3 : 2;
            if (errDiv) {
                errDiv.classList.remove('alert-info');
                if (rcode !== 0) {
                    errDiv.classList.add('alert-warning');
                }
            }
            updateButtonsState('email');
        } catch(e) {
            console.error('exception: ' + e);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
        showSendDiv('email', 'err-99');
        emailStep = 2;
        updateButtonsState('email');
    });
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

function requestAndShowChangelog(fromChange) {
    const formData = new URLSearchParams();
    formData.append('service', 'changelog');
    formData.append('lastSeen', fromChange.value || -1);
    formData.append('lang', currLang);
    
    fetch('/ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(data => {
        try {
            const payload = data.substring(3);
            const changes = JSON.parse(payload);
            clearChangelogTable();
            fillChangelogTable(changes);
            toggleChangelogHeader(!isManualChangelogRequest(fromChange));
            changelogModal.show();
            setTimeout(() => requireEl('changelog-btn-ok').focus(), 300);
        } catch(e) {
            console.error('exception: ' + e);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
    });
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
