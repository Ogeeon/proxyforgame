function showReportWindow(text) {
	$('#misspelled-text')[0].value = text;
	$('#corrected-text')[0].value = text;
	$("#report-form").dialog( "open" );
	showSendDiv('report', 'data');
	$('#corrected-text')[0].focus();
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
		if (id == ids[i])
			$('#'+dialog+'-'+ids[i]).css('display', 'block');
		else
			$('#'+dialog+'-'+ids[i]).css('display', 'none');
	}
}

function updateButtonsState(dlg) {
	switch ($('#'+dlg+'-form').dialog('option', 'step')) {
		case 0: {
			$('#'+dlg+'-btn-ok')[0].children[0].innerHTML = buttonsText.send;
			$('#'+dlg+'-btn-ok').css('display', 'inline'); 
			$('#'+dlg+'-btn-cancel').css('display', 'inline'); 
			break;
		} 
		case 1: { 
			$('#'+dlg+'-btn-ok').css('display', 'none'); 
			$('#'+dlg+'-btn-cancel').css('display', 'none');
			break;
		}
		case 2:  {
			$('#'+dlg+'-btn-ok')[0].children[0].innerHTML = buttonsText.correct;
			$('#'+dlg+'-btn-ok').css('display', 'inline'); 
			$('#'+dlg+'-btn-cancel').css('display', 'inline'); 
			break;
		}
		case 3:  {
			$('#'+dlg+'-btn-ok')[0].children[0].innerHTML = buttonsText.ok;
			$('#'+dlg+'-btn-ok').css('display', 'inline'); 
			$('#'+dlg+'-btn-cancel').css('display', 'none'); 
			break;
		}
	}
}

function sendReport() {
	showSendDiv('report', 'progress');
	$.post(
			"/ajax.php",
			{service: "report", url: currUrl, wrong: $('#misspelled-text')[0].value, right: $('#corrected-text')[0].value},
			function(data) {
				try {
					var rcode = parseInt(data.substr(0, data.indexOf('\n')));
					showSendDiv('report', 'err-'+rcode);
					if (rcode == 0)
						$("#report-form").dialog("option", "step", 3);
					else
						$("#report-form").dialog("option", "step", 2);
					updateButtonsState('report');
				} catch(e) {
					consoleLog('exception: '+e);
				}
			}
		);
}

function showEmailWindow() {
	$('#email-form-address')[0].value = '';
	$('#email-form-subject')[0].value = '';
	$('#email-form-body')[0].value = '';
	$("#email-form").dialog( "open" );
	showSendDiv('email', 'data');
	$('#email-form-subject')[0].focus();
	$("#email-form").dialog("option", "step", 0);
	updateButtonsState('email');
}

function sendEmail() {
	showSendDiv('email', 'progress');
	$.post(
			"/ajax.php",
			{service: "email", address: $('#email-form-address')[0].value, subject: $('#email-form-subject')[0].value, body: $('#email-form-body')[0].value},
			function(data) {
				try {
					var rcode = parseInt(data.substr(0, data.indexOf('\n')));
					showSendDiv('email', 'err-'+rcode);
					if (rcode == 0)
						$("#email-form").dialog("option", "step", 3);
					else
						$("#email-form").dialog("option", "step", 2);
					updateButtonsState('email');
				} catch(e) {
					consoleLog('exception: '+e);
				}
			}
		);
}

function requestAndShowChangelog(fromChange) {
	$.post(
		"/ajax.php",
		{service: "changelog", lastSeen: fromChange, lang: currLang},
		function(data) {
			//consoleLog('response: '+data);
			try {
				var rcode = parseInt(data.substr(0, data.indexOf('\n')));
				var payload = data.substr(3, data.length);
				//consoleLog(payload);
				var changes = JSON.parse(payload);
				clearChangelogTable();
				fillChangelogTable(changes);
				$("#changelog-dialog").dialog("open");
				$('#changelog-btn-ok')[0].focus();
			} catch(e) {
				consoleLog('exception: '+e);
			}
		}
	);
}

function clearChangelogTable() {
	var tbl = $('#changelog-tbl')[0];
	for (var i = tbl.rows.length-1; i > 0; i--) {
		$(tbl.rows[i]).remove();
	}
}

function fillChangelogTable(changes) {
	for (var chng = 0; chng < changes.length; chng++) {
		$('#changelog-tbl').append('<tr class='+((chng % 2) === 1 ? 'odd' : 'even')+'><td width="20%" align="center">'+changes[chng].ts+'</td><td>'+changes[chng].description+'</td></tr>');
	}	
}

$(function(){	
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
	var dialog = $('div[aria-labelledby="ui-dialog-title-report-form"]');
	var buttons = dialog.find('div.ui-dialog-buttonset');
	buttons[0].children[0].children[0].innerHTML = buttonsText.send;
	buttons[0].children[0].id = "report-btn-ok";
	buttons[0].children[1].children[0].innerHTML = buttonsText.cancel;
	buttons[0].children[1].id = "report-btn-cancel";
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
	var dialog = $('div[aria-labelledby="ui-dialog-title-email-form"]');
	var buttons = dialog.find('div.ui-dialog-buttonset');
	buttons[0].children[0].children[0].innerHTML = buttonsText.send;
	buttons[0].children[0].id = "email-btn-ok";
	buttons[0].children[1].children[0].innerHTML = buttonsText.cancel;
	buttons[0].children[1].id = "email-btn-cancel";
	$("#email-form").dialog("option", "step", 0);
	
	$('textarea').focusin(function() {
		$(this).addClass('ui-state-focus');
	});
	$('textarea').focusout(function() {
		$(this).removeClass('ui-state-focus');
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
	var dialog = $('div[aria-labelledby="ui-dialog-title-changelog-dialog"]');
	var buttons = dialog.find('div.ui-dialog-buttonset');
	buttons[0].children[0].children[0].innerHTML = buttonsText.ok;
	buttons[0].children[0].id = "changelog-btn-ok";
});

document.onkeypress = getText;

var lastChange = $.cookie("lastChange");
if(lastChange) {
	//consoleLog("lastChange="+lastChange+", currChange="+currChange);
	if (lastChange < currChange) {
		requestAndShowChangelog(lastChange);
	}
}
$.cookie("lastChange", currChange, { expires: 365, path: '/' });