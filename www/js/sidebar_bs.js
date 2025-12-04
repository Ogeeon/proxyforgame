function showReportWindow(text) {
    document.getElementById('misspelled-text').value = text;
    document.getElementById('corrected-text').value = text;
    $("#report-form").dialog( "open" );
    showSendDiv('report', 'data');
    document.getElementById('corrected-text').focus();
    $("#report-form").dialog("option", "step", 0);
    updateButtonsState('report');
}

function getText(e) {
    if (!e) e = window.event;
    var mis;
    if ((e.ctrlKey) && ((e.keyCode==10)||(e.keyCode==13))) { 
        if(navigator.appName == 'Microsoft Internet Explorer') {
            if (document.selection.createRange()) {
                var range = document.selection.createRange();
                mis = range.text;
                showReportWindow(mis);
            }
        } else {
            if (window.getSelection()) {
                mis = window.getSelection();
                showReportWindow(mis);
            } else {
                if(document.getSelection()) {
                    mis = document.getSelection();
                    showReportWindow(mis);
                }
            }
        }
        return true;
    } 
    return true;
}

function findSelection() { 
    if(navigator.appName == 'Microsoft Internet Explorer') {
        if (document.selection.createRange()) {
            var range = document.selection.createRange();
            mis = range.text;
            showReportWindow(mis);
        }
    } else {
        if (window.getSelection()) {
            mis = window.getSelection();
            showReportWindow(mis);
        } else {
            if(document.getSelection()) {
                mis = document.getSelection();
                showReportWindow(mis);
            }
        }
    }
}

function showSendDiv(dialog, id) {
    var ids = ['data', 'progress', 'err-0', 'err-1', 'err-2', 'err-3', 'err-4', 'err-5', 'err-6', 'err-7'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(dialog + '-' + ids[i]);
        if (el) {
            el.style.display = (id == ids[i]) ? 'block' : 'none';
        }
    }
}

function updateButtonsState(dlg) {
    var formEl = document.getElementById(dlg + '-form');
    var step = $(formEl).dialog('option', 'step');
    var btnOk = document.getElementById(dlg + '-btn-ok');
    var btnCancel = document.getElementById(dlg + '-btn-cancel');
    
    switch (step) {
        case 0: {
            btnOk.children[0].innerHTML = buttonsText.send;
            btnOk.style.display = 'inline'; 
            btnCancel.style.display = 'inline'; 
            break;
        } 
        case 1: { 
            btnOk.style.display = 'none'; 
            btnCancel.style.display = 'none';
            break;
        }
        case 2:  {
            btnOk.children[0].innerHTML = buttonsText.correct;
            btnOk.style.display = 'inline'; 
            btnCancel.style.display = 'inline'; 
            break;
        }
        case 3:  {
            btnOk.children[0].innerHTML = buttonsText.ok;
            btnOk.style.display = 'inline'; 
            btnCancel.style.display = 'none'; 
            break;
        }
    }
}

function sendReport() {
    showSendDiv('report', 'progress');
    
    var formData = new URLSearchParams();
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
    .then(function(data) {
        try {
            var rcode = Number.parseInt(data.substr(0, data.indexOf('\n')));
            showSendDiv('report', 'err-'+rcode);
            if (rcode == 0)
                $("#report-form").dialog("option", "step", 3);
            else
                $("#report-form").dialog("option", "step", 2);
            updateButtonsState('report');
        } catch(e) {
            consoleLog('exception: '+e);
        }
    });
}

function showEmailWindow() {
    document.getElementById('email-form-address').value = '';
    document.getElementById('email-form-subject').value = '';
    document.getElementById('email-form-body').value = '';
    $("#email-form").dialog( "open" );
    showSendDiv('email', 'data');
    document.getElementById('email-form-subject').focus();
    $("#email-form").dialog("option", "step", 0);
    updateButtonsState('email');
}

function sendEmail() {
    showSendDiv('email', 'progress');
    
    var formData = new URLSearchParams();
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
    .then(function(data) {
        try {
            var rcode = Number.parseInt(data.substr(0, data.indexOf('\n')));
            showSendDiv('email', 'err-'+rcode);
            if (rcode == 0)
                $("#email-form").dialog("option", "step", 3);
            else
                $("#email-form").dialog("option", "step", 2);
            updateButtonsState('email');
        } catch(e) {
            consoleLog('exception: '+e);
        }
    });
}

function requestAndShowChangelog(fromChange) {
    var formData = new URLSearchParams();
    formData.append('service', 'changelog');
    formData.append('lastSeen', fromChange);
    formData.append('lang', currLang);
    
    fetch('/ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => response.text())
    .then(function(data) {
        //consoleLog('response: '+data);
        try {
            var rcode = Number.parseInt(data.substr(0, data.indexOf('\n')));
            var payload = data.substr(3, data.length);
            //consoleLog(payload);
            var changes = JSON.parse(payload);
            clearChangelogTable();
            fillChangelogTable(changes);
            $("#changelog-dialog").dialog("open");
            document.getElementById('changelog-btn-ok').focus();
        } catch(e) {
            consoleLog('exception: '+e);
        }
    });
}

function clearChangelogTable() {
    var tbl = document.getElementById('changelog-tbl');
    for (var i = tbl.rows.length-1; i > 0; i--) {
        tbl.rows[i].remove();
    }
}

function fillChangelogTable(changes) {
    var tbl = document.getElementById('changelog-tbl');
    for (var chng = 0; chng < changes.length; chng++) {
        var tr = document.createElement('tr');
        tr.className = (chng % 2) === 1 ? 'odd' : 'even';
        tr.innerHTML = '<td width="20%" align="center">'+changes[chng].ts+'</td><td>'+changes[chng].description+'</td>';
        tbl.appendChild(tr);
    }	
}

document.addEventListener('DOMContentLoaded', function() {	
    $("#report-form").dialog({
        autoOpen: false,
        height: 255,
        width: 410,
        modal: true,
        resizable: false,
        buttons: {
            dt: function() {
                switch ($(this).dialog("option", "step")) {
                    // этапы: 0 - подготовка к отправке, 1 - процесс отправки (ajax), 2 - сообщение об ошибке, 3 - сообщение об удачной отправке 
                    case 0: {
                        sendReport();
                        $(this).dialog("option", "step", 1); 
                        updateButtonsState('report');
                        break;
                    } 
                    case 2: { 
                        showSendDiv('report', 'data');
                        $(this).dialog("option", "step", 0);
                        updateButtonsState('report');
                        break;
                    }
                    case 3: $(this).dialog("close"); break;
                    default: return;
                }				
            },
            ccl: function() {
                $(this).dialog("close");
            }
        },
        close: function() {
        }
    });
    var dialog = document.querySelector('div[aria-labelledby="ui-dialog-title-report-form"]');
    var buttons = dialog.querySelector('div.ui-dialog-buttonset');
    buttons.children[0].children[0].innerHTML = buttonsText.send;
    buttons.children[0].id = "report-btn-ok";
    buttons.children[1].children[0].innerHTML = buttonsText.cancel;
    buttons.children[1].id = "report-btn-cancel";
    $("#report-form").dialog("option", "step", 0);

    $("#email-form").dialog({
        autoOpen: false,
        height: 380,
        width: 615,
        modal: true,
        resizable: false,
        buttons: {
            dt: function() {
                switch ($(this).dialog("option", "step")) {
                    // этапы: 0 - подготовка к отправке, 1 - процесс отправки (ajax), 2 - сообщение об ошибке, 3 - сообщение об удачной отправке 
                    case 0: {
                        sendEmail();
                        $(this).dialog("option", "step", 1); 
                        updateButtonsState('email');
                        break;
                    } 
                    case 2: { 
                        showSendDiv('email', 'data');
                        $(this).dialog("option", "step", 0);
                        updateButtonsState('email');
                        break;
                    }
                    case 3: $(this).dialog("close"); break;
                    default: return;
                }				
            },
            ccl: function() {
                $(this).dialog("close");
            }
        },
        close: function() {
        }
    });
    var dialog = document.querySelector('div[aria-labelledby="ui-dialog-title-email-form"]');
    var buttons = dialog.querySelector('div.ui-dialog-buttonset');
    buttons.children[0].children[0].innerHTML = buttonsText.send;
    buttons.children[0].id = "email-btn-ok";
    buttons.children[1].children[0].innerHTML = buttonsText.cancel;
    buttons.children[1].id = "email-btn-cancel";
    $("#email-form").dialog("option", "step", 0);
    
    var textareas = document.querySelectorAll('textarea');
    textareas.forEach(function(textarea) {
        textarea.addEventListener('focusin', function() {
            this.classList.add('ui-state-focus');
        });
        textarea.addEventListener('focusout', function() {
            this.classList.remove('ui-state-focus');
        });
    });
    
    $("#changelog-dialog").dialog({
        autoOpen: false,
        height: 550,
        width: 700,
        modal: true,
        resizable: false,
        buttons: {
            done: function() {
                $(this).dialog("close");
            }
        },
        close: function() {
        }
    });
    var dialog = document.querySelector('div[aria-labelledby="ui-dialog-title-changelog-dialog"]');
    var buttons = dialog.querySelector('div.ui-dialog-buttonset');
    buttons.children[0].children[0].innerHTML = buttonsText.ok;
    buttons.children[0].id = "changelog-btn-ok";
});

document.onkeypress = getText;

// TODO: set on 2025-12-03, replace with 0 after some time
let lastChange = { value: '42', validate: function(key, val) { return val; } };
loadFromCookie('lastChange', lastChange);
if(lastChange) {
    // consoleLog("lastChange="+lastChange.value+", currChange="+currChange);
    if (lastChange.value < currChange) {
        requestAndShowChangelog(lastChange);
    }
}
saveToCookie('lastChange', lastChange);