let reportModal, emailModal, changelogModal;
let reportStep = 0;
let emailStep = 0;

function showReportWindow(text) {
    document.getElementById('misspelled-text').value = text;
    document.getElementById('corrected-text').value = text;
    reportModal.show();
    showSendDiv('report', 'data');
    setTimeout(() => document.getElementById('corrected-text').focus(), 300);
    reportStep = 0;
    updateButtonsState('report');
}

function getText(e) {
    if (!e) return;
    if ((e.ctrlKey) && ((e.keyCode == 10) || (e.keyCode == 13))) { 
        let mis = getSelectedText();
        if (mis) {
            showReportWindow(mis);
        }
    } 
}

function getSelectedText() {
    if (globalThis.getSelection) {
        return globalThis.getSelection().toString();
    }
    return document.selection?.createRange()?.text ?? '';
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
    const btnOk = document.getElementById(`${dlg}-btn-ok`);
    const btnCancel = document.getElementById(`${dlg}-btn-cancel`);
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
    formData.append('wrong', document.getElementById('misspelled-text').value);
    formData.append('right', document.getElementById('corrected-text').value);
    
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
            const errDiv = document.getElementById(`report-err-${rcode}`);
            showSendDiv('report', `err-${rcode}`);
            
            if (rcode === 0) {
                reportStep = 3;
                errDiv.classList.remove('alert-info');
            } else {
                reportStep = 2;
                errDiv.classList.remove('alert-info');
                errDiv.classList.add('alert-warning');
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
    document.getElementById('email-form-address').value = '';
    document.getElementById('email-form-subject').value = '';
    document.getElementById('email-form-body').value = '';
    emailModal.show();
    showSendDiv('email', 'data');
    setTimeout(() => document.getElementById('email-form-subject').focus(), 300);
    emailStep = 0;
    updateButtonsState('email');
}

function sendEmail() {
    showSendDiv('email', 'progress');
    
    const formData = new URLSearchParams();
    formData.append('service', 'email');
    formData.append('address', document.getElementById('email-form-address').value);
    formData.append('subject', document.getElementById('email-form-subject').value);
    formData.append('body', document.getElementById('email-form-body').value);
    
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
            const errDiv = document.getElementById(`email-err-${rcode}`);
            showSendDiv('email', `err-${rcode}`);
            
            if (rcode === 0) {
                emailStep = 3;
                errDiv.classList.remove('alert-info');
            } else {
                emailStep = 2;
                errDiv.classList.remove('alert-info');
                errDiv.classList.add('alert-warning');
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
            setTimeout(() => document.getElementById('changelog-btn-ok').focus(), 300);
        } catch(e) {
            console.error('exception: ' + e);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
    });
}

function clearChangelogTable() {
    const tbody = document.querySelector('#changelog-tbl tbody');
    tbody.innerHTML = '';
}

function fillChangelogTable(changes) {
    if (!changes || changes.length === 0) {
        return;
    }
    const tbody = document.querySelector('#changelog-tbl tbody');
    for (const change of changes) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center text-info-emphasis">${change.ts}</td>
            <td class="text-info-emphasis">${change.description}</td>
        `;
        tbody.appendChild(tr);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
    emailModal = new bootstrap.Modal(document.getElementById('emailModal'));
    changelogModal = new bootstrap.Modal(document.getElementById('changelogModal'));

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
    
    document.getElementById('report-btn-ok').addEventListener('click', function() {
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
    
    document.getElementById('email-btn-ok').addEventListener('click', function() {
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
    
    document.getElementById('reportModal').addEventListener('hidden.bs.modal', function() {
        reportStep = 0;
        showSendDiv('report', 'data');
    });
    
    document.getElementById('emailModal').addEventListener('hidden.bs.modal', function() {
        emailStep = 0;
        showSendDiv('email', 'data');
    });
});

document.addEventListener('keypress', getText);

let lastChange = { value: '42', validate: function(key, val) { return val; } };
loadFromCookie('lastChange', lastChange);
if (lastChange && lastChange.value < currChange.value) {
    requestAndShowChangelog(lastChange);
}
saveToCookie('lastChange', currChange);
