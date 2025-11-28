<!DOCTYPE html>
<head>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
	<meta http-equiv="Cache-Control" content="no-cache" />
	<title><?= $l['title'] ?></title>
	<meta name="description" content="<?= $l['title'] ?>"/>
	<meta name="keywords" content="<?= $l['keywords'] ?>"/>
	<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
	<link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<?php 
	if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com') {
		$pfgPath = $_SERVER['DOCUMENT_ROOT'];
	} else {
		$pfgPath = "D:\Programming\JS\pfg.wmp\www";
	};
?>
	<link id="light-theme" type="text/css" href="/css/redmond/jquery.ui.all.css" rel="stylesheet"/>
	<link id="dark-theme" type="text/css" href="/css/dark-hive/jquery.ui.all.css" rel="stylesheet" disabled="disabled"/>
	<link type="text/css" href="/css/langs.css?v=<?php echo filemtime($pfgPath.'/css/langs.css'); ?>" rel="stylesheet" />
	<link type="text/css" href="/css/common.css?v=<?php echo filemtime($pfgPath.'/css/common.css'); ?>" rel="stylesheet"/>
	<link type="text/css" href="/ogame/calc/css/flight.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/flight.css'); ?>" rel="stylesheet"/>
	
<?php if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com'): ?>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.min.js"></script>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jqueryui/1.8.11/jquery-ui.min.js"></script>
<?php elseif ( $_SERVER['SERVER_NAME'] == 'pfg.wmp'): ?>
	<script type="text/javascript" src="/js/jquery.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui.min.js"></script>
<?php else: ?>
	<script type="text/javascript" src="/js/jquery-1.5.1.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui-1.8.11.min.js"></script>
<?php endif; ?>
	<script type="text/javascript" src="/js/jquery.inputmask.js"></script>
	<script type="text/javascript" src="/js/jquery.cookie.js"></script>
<?php require_once('../../social.head.tpl'); ?>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/flight.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/flight.js'); ?>"></script>

	<script type="text/javascript">
		$(function() {
			$("button").button();
			$("#start-datetime").inputmask("<?= $l['datetime-format'] ?>");
			$("#flight-time").inputmask("<?= $l['flight-time-format'] ?>");
			$("#save-start-datetime").inputmask("<?= $l['datetime-format'] ?>", { "oncomplete": function(){ $("#save-return-datetime")[0].focus(); } });
			$("#save-return-datetime").inputmask("<?= $l['datetime-format'] ?>", { "oncomplete": function(){ $("#save-tolerance-time")[0].focus(); } });
			$("#save-tolerance-time").inputmask("<?= $l['tolerance-time-format'] ?>", { "oncomplete": function(){ $("#calculate-savepoints")[0].focus(); } });
		});
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator='<?= $l['decimal-separator'] ?>';
		options.datetimeW = '<?= $l['datetime-w'] ?>';
		options.datetimeD = '<?= $l['datetime-d'] ?>';
		options.datetimeH = '<?= $l['datetime-h'] ?>';
		options.datetimeM = '<?= $l['datetime-m'] ?>';
		options.datetimeS = '<?= $l['datetime-s'] ?>';
		options.datetimeFormat = '<?= $l['datetime-format'] ?>';
		options.flightTimeFormat = '<?= $l['flight-time-format'] ?>';
		options.flightTimeFormatHint = '<?= $l['flight-time-format-hint'] ?>';
		options.toggleSignHint = '<?= $l['toggle-sign'] ?>';
		options.removeRowHint = '<?= $l['remove-row'] ?>';
		options.departureTitle = '<?= $l['departure'] ?>';
		options.arrivalTitle = '<?= $l['arrival'] ?>';
		options.warnindDivId = 'warning';
		options.warnindMsgDivId = 'warning-message';
		options.fieldHint = '<?= $l['field-hint'] ?>';
		options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
		options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
		options.msgNoShips = "<?= $l['msg-no-ships'] ?>";
		options.msgWrongDepartureTime = "<?= $l['msg-wrong-departure-time'] ?>";
		options.msgWrongReturnTime = "<?= $l['msg-wrong-return-time'] ?>";
		options.msgDepartureAfterReturn = "<?= $l['msg-departure-after-return'] ?>";
		options.msgWrongTolerance = "<?= $l['msg-wrong-tolerance'] ?>";
		options.msgWrongDepartureCoordinates = "<?= $l['msg-wrong-departure-coordinates'] ?>";
		options.msgNoSavepointsFound = "<?= $l['msg-no-savepoints-found'] ?>";
		options.flightmodesNote = "<?= $l['flightmodes-note'] ?>";
		options.savepointsNote = "<?= $l['savepoints-note'] ?>";
		options.noUniNameMsg = "<?= $l['no-uni-name-msg'] ?>";
		options.noUniSelectedMsg = "<?= $l['no-uni-selected-msg'] ?>";
		options.uniDelConfMsg = "<?= $l['del-universe-confirm'] ?>";
		options.uniOwrConfMsg = "<?= $l['owr-universe-confirm'] ?>";
		options.uniLoadConfMsg = "<?= $l['load-universe-confirm'] ?>";
		options.noFleetNameMsg = "<?= $l['no-fleet-name-msg'] ?>";
		options.noFleetSelectedMsg = "<?= $l['no-fleet-selected-msg'] ?>";
		options.fleetDelConfMsg = "<?= $l['del-fleet-confirm'] ?>";
		options.fleetOwrConfMsg = "<?= $l['owr-fleet-confirm'] ?>";
		options.fleetLoadConfMsg = "<?= $l['load-fleet-confirm'] ?>";
		options.readTitle = "<?= $l['read'] ?>";
		options.cancelTitle = "<?= $l['cancel'] ?>";
		options.smallCargoName = "<?= $l['small-cargo'] ?>";
		options.missingSCName = "<?= $l['no-sc-message'] ?>";
		options.badSRCode = "<?= $l['import-bad-code-msg'] ?>";
	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="lf-bonuses-reader" title="<?= $l['lf-bonuses-reader-hdr'] ?>">
	<div class="ui-widget-content ui-corner-all width: auto; ">
		<div class="irn-calc-info">
			<?= $l['lf-bonuses-reader-info'] ?>
		</div>
		<div id="lab-levels-div">
			<textarea id="lf-bonuses-txtarea" rows="8" cols="45"></textarea>
		</div>
	</div>
</div>

<div id="flight">
	<div class="ui-widget-content ui-corner-all">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>		
		<div id="general-settings-panel" class="c-ui-widget-content ui-corner-all ui-panel">
			<div id="params-accordion" >
				<h3><a href="#"><?= $l['parameters'] ?></a></h3>
				<div id="accordion-prm">
					<div id="universes-panel" class="ui-widget-content ui-corner-all">
						<table cellpadding="2" cellspacing="0" border="0" align="center">
							<tr>
								<td><label for="universe-name-select"><?= $l['universe'] ?></label></td>
								<td>
									<select id="universe-name-select" name="universe-name-select" class="ui-state-default ui-corner-all ui-input ui-input-margin">
										<option value="0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
									</select>
								</td>
								<td>
									<div id="universe-control">
										<button id="universe-load" title="<?= $l['universe-load'] ?>" class="uni-control-btn"></button>
										<button id="universe-save" title="<?= $l['universe-save'] ?>" class="uni-control-btn"></button>
										<button id="universe-delete" title="<?= $l['universe-delete'] ?>" class="uni-control-btn"></button>
									</div>
								</td>
								<td width="20px">&nbsp;</td>
								<td><input id="universe-name" type="text" name="universe-name" class="ui-state-default ui-corner-all ui-input ui-input-margin input-20columns"/></td>
								<td><button id="universe-add" title="<?= $l['universe-add'] ?>" class="uni-control-btn"></button></td>
								<td>&nbsp;</td>
							</tr>
								<td>SR_KEY:</td>
								<td colspan="4"><input id="api-code" placeholder="API OGame / API LogServer.net" type="text" style="width: 97%;" class="ui-state-default ui-corner-all ui-input ui-input-margin input-20columns"/></td>
								<td>
									<button id="api-get" title="<?= $l['import-sr'] ?>" class="uni-control-btn"></button>
								</td>
								<td>
									<span class="ui-icon ui-icon-help" title="<?= $l['import-hint'] ?>"></span>
								</td>
							<tr>
							</tr>
						</table>
					</div>
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label><?= $l['class'] ?>:</label></td>
							<td><input id="class-0" type="radio" name="class" value="0" tabindex="1"/><label for="class-0"><?= $l['class-collector'] ?></label></td>
							<td><input id="class-1" type="radio" name="class" value="1" tabindex="2"/><label for="class-1"><?= $l['class-general'] ?></label></td>
							<td><input id="class-2" type="radio" name="class" value="2" tabindex="3"/><label for="class-2"><?= $l['class-discoverer'] ?></label></td>
							<td colspan="3">
								&nbsp;<input id="trader-bonus" type="checkbox" name="trader-bonus" class="ui-state-default ui-corner-all ui-input" /><label for="trader-bonus"><?= $l['trader-bonus'] ?></label>
							</td>
						</tr>
						<tr>
							<td><label for="cmb-drive"><?= $l['cmb-drive'] ?></label></td>
							<td><input id="cmb-drive" type="text" name="cmb-drive" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="imp-drive"><?= $l['imp-drive'] ?></label></td>
							<td><input id="imp-drive" type="text" name="imp-drive" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="hyp-drive"><?= $l['hyp-drive'] ?></label></td>
							<td><input id="hyp-drive" type="text" name="hyp-drive" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="universe-speed"><?= $l['universe-speed'] ?></label></td>
							<td>
								<select id="universe-speed" name="universe-speed" class="ui-state-default ui-corner-all ui-input ui-input-margin" tabindex="4" >
									<option value="1" selected="selected">1</option>
									<option value="2">2</option>
									<option value="3">3</option>
									<option value="4">4</option>
									<option value="5">5</option>
									<option value="6">6</option>
									<option value="7">7</option>
									<option value="8">8</option>
									<option value="9">9</option>
									<option value="10">10</option>
								</select>
							</td>
						</tr>
					</table>
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td><?= $l['circular'] ?></td>
							<td><input id="circular-systems" type="checkbox" name="circular-systems" class="ui-state-default ui-corner-all ui-input" tabindex="5" /><label for="circular-systems"><abbr title="<?= $l['circ-systems-explain'] ?>"><?= $l['circ-systems'] ?></abbr></label></td>
							<td><input id="circular-galaxies" type="checkbox" name="circular-galaxies" class="ui-state-default ui-corner-all ui-input" tabindex="6" /><label for="circular-galaxies"><abbr title="<?= $l['circ-galaxies-explain'] ?>"><?= $l['circ-galaxies'] ?></abbr></label></td>
							<td style="width: 20px;">&nbsp</td>
							<td><label for="systems-num"><?= $l['systems-num'] ?></label></td>
							<td><input id="systems-num" type="text" name="systems-num" class="ui-state-default ui-corner-all ui-input level-input-small ui-input-margin" value="499" tabindex="7" /></td>
							<td><label for="galaxies-num"><?= $l['galaxies-num'] ?></label></td>
							<td><input id="galaxies-num" type="text" name="galaxies-num" class="ui-state-default ui-corner-all ui-input level-input-small ui-input-margin" value="9" tabindex="8" /></td>
						</tr>
					</table>
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="departure-g"><?= $l['departure-point'] ?>&nbsp;</label></td>
							<td>
								<input id="departure-g" type="text" name="departure-g" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['galaxy'] ?>" tabindex="10" />:<input id="departure-s" type="text" name="departure-s" class="ui-state-default ui-corner-all ui-input coord-input ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['system'] ?>" tabindex="11" />:<input id="departure-p" type="text" name="departure-p" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['planet'] ?>" tabindex="12" />
							</td>
							<td style="width: 30px;">&nbsp;</td>
							<td><label for="hypertech-lvl"><?= $l['hyper-tech'] ?>&nbsp;</label></td>
							<td><input id="hypertech-lvl" type="text" name="hypertech-lvl" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="0" tabindex="13" /></td>
							<td style="width: 30px;">&nbsp;</td>
							<td><label for="sp-cargohold"><?= $l['sp-cargohold'] ?>&nbsp;</label></td>
							<td><input id="sp-cargohold" type="text" name="p-cargohold" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="0" tabindex="14" /></td>
						</tr>
					</table>
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td>
								<label for="deut-factor"><?= $l['lf-bonus-deut-consum'] ?></label>
							</td>
							<td>
								<select id="deut-factor" name="deut-factor" class="ui-state-default ui-corner-all ui-input ui-input-margin mrg-right-5" tabindex="" >
									<option value="5">50%</option>
									<option value="6">60%</option>
									<option value="7">70%</option>
									<option value="8">80%</option>
									<option value="9">90%</option>
									<option value="10">100%</option>
								</select>							
							</td>
							<td><?= $l['deut-cons-reduction'] ?>&nbsp;</label></td>
							<td>
								<select id="deut-generals-bonus" name="deut-generals-bonus" class="ui-state-default ui-corner-all ui-input ui-input-margin" tabindex="" >
									<option value="25">25%</option>
									<option value="36">36%</option>
									<option value="50">50%</option>
								</select>							
							</td>
						</tr>
					</table>
					<hr>
					<table id="lf-blanket-ehn-tbl" cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="lf-mechan-general-enh"><?= $l['generals-enhancement-lvl'] ?></label></td>
							<td><input id="lf-mechan-general-enh" type="text" name="lf-mechan-general-enh" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="lf-rocktal-collector-enh"><?= $l['collectors-enhancement-lvl'] ?></label></td>
							<td><input id="lf-rocktal-collector-enh" type="text" name="lf-rocktal-collector-enh" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</tr>
					</table>
					<div id="lf-bonuses-accordion">
						<h3><a href="#"><?= $l['lf-bonuses-ships'] ?></a></h3>
						<div id="accordion-lf-prm">
						<table width="80%" cellpadding="0" cellspacing="1" border="0" align="center">
							<tr><td><button id="open-lfbr" style="float: right;"><?= $l['open-lfbr'] ?></button></td></tr> 
						</table>
						<table id="lf-ships-bonuses" class="lined" width="80%" cellpadding="0" cellspacing="1" border="0" align="center">
							<tr>
								<th><?= $l['ship-name'] ?></th>
								<th><?= $l['speed-increase'] ?></th>
								<th><?= $l['cargo-increase'] ?></th>
								<th><?= $l['fuel-decrease'] ?></th>
							</tr>
							<tr class="odd">
								<td><?= $l['small-cargo'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 202-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 202-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 202-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['large-cargo'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 203-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 203-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 203-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['light-fighter'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 204-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 204-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 204-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['heavy-fighter'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 205-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 205-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 205-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['cruiser'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 206-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 206-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 206-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['battleship'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 207-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 207-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 207-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['colony-ship'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 208-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 208-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 208-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['recycler'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 209-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 209-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 209-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['esp-probe'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 210-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 210-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 210-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['bomber'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 211-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 211-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 211-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['destroyer'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 213-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 213-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 213-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['death-star'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 214-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 214-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 214-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['battlecruiser'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 215-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 215-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 215-fuel"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['reaper'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 218-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 218-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 218-fuel"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['pathfinder'] ?></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 219-speed"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 219-cargo"/></td>
								<td class="centered"><input type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 219-fuel"/></td>
							</tr>
						</table>
						</div>	
					</div>
					<hr>
					<table id="override-speed-tbl" cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td>
								<input id="ovr-speed-cb" type="checkbox" name="override-speed" class="ui-state-default ui-corner-all ui-input"/>
								<label for="ovr-speed-cb"><abbr title="<?= $l['ovr-fleet-speed-explain'] ?>"><?= $l['ovr-fleet-speed'] ?></abbr></label>
								<input id="ovr-speed-t" type="text" name="" class="ui-state-default ui-corner-all ui-input float-count-input ui-input-margin" value="10000" />
							</td>
							<td>
						</tr>
					</table>
				</div>
				<h3><a href="#"><?= $l['ships'] ?></a></h3>
				<div id="accordion-ships">
					<div id="fleets-panel" class="ui-widget-content ui-corner-all">
						<table cellpadding="2" cellspacing="0" border="0" align="center">
							<tr>
								<td><label for="fleet-name-select"><?= $l['fleet'] ?></label></td>
								<td>
									<select id="fleet-name-select" name="fleet-name-select" class="ui-state-default ui-corner-all ui-input ui-input-margin">
										<option value="0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
									</select>
								</td>
								<td>
									<div id="fleet-control">
										<button id="fleet-load" title="<?= $l['universe-load'] ?>" class="uni-control-btn"></button>
										<button id="fleet-save" title="<?= $l['universe-save'] ?>" class="uni-control-btn"></button>
										<button id="fleet-delete" title="<?= $l['universe-delete'] ?>" class="uni-control-btn"></button>
									</div>
								</td>
								<td width="20px">&nbsp;</td>
								<td><input id="fleet-name" type="text" name="fleet-name" class="ui-state-default ui-corner-all ui-input ui-input-margin input-20columns"/></td>
								<td><button id="fleet-add" title="<?= $l['universe-add'] ?>" class="uni-control-btn"></button></td>
							</tr>
						</table>
					</div>
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="small-cargo"><?= $l['small-cargo'] ?></label></td>
							<td><label id="small-cargo-speed" class="speed-label">0</label></td>
							<td><input id="small-cargo" type="text" name="small-cargo" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="15" /></td>

							<td><label for="cruiser"><?= $l['cruiser'] ?></label></td>
							<td><label id="cruiser-speed" class="speed-label">0</label></td>
							<td><input id="cruiser" type="text" name="cruiser" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="20" /></td>

							<td><label for="battlecruiser"><?= $l['battlecruiser'] ?></label></td>
							<td><label id="battlecruiser-speed" class="speed-label">0</label></td>
							<td><input id="battlecruiser" type="text" name="battlecruiser" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="25" /></td>
						</tr>
						<tr>
							<td><label for="large-cargo"><?= $l['large-cargo'] ?></label></td>
							<td><label id="large-cargo-speed" class="speed-label">0</label></td>
							<td><input id="large-cargo" type="text" name="large-cargo" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="16" /></td>

							<td><label for="battleship"><?= $l['battleship'] ?></label></td>
							<td><label id="battleship-speed" class="speed-label">0</label></td>
							<td><input id="battleship" type="text" name="battleship" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="21" /></td>

							<td><label for="death-star"><?= $l['death-star'] ?></label></td>
							<td><label id="death-star-speed" class="speed-label">0</label></td>
							<td><input id="death-star" type="text" name="death-star" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="26" /></td>
						</tr>
						<tr>
							<td><label for="light-fighter"><?= $l['light-fighter'] ?></label></td>
							<td><label id="light-fighter-speed" class="speed-label">0</label></td>
							<td><input id="light-fighter" type="text" name="light-fighter" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="17" /></td>

							<td><label for="destroyer"><?= $l['destroyer'] ?></label></td>
							<td><label id="destroyer-speed" class="speed-label">0</label></td>
							<td><input id="destroyer" type="text" name="destroyer" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="22" /></td>

							<td><label for="colony-ship"><?= $l['colony-ship'] ?></label></td>
							<td><label id="colony-ship-speed" class="speed-label">0</label></td>
							<td><input id="colony-ship" type="text" name="colony-ship" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="27" /></td>
						</tr>
						<tr>
							<td><label for="heavy-fighter"><?= $l['heavy-fighter'] ?></label></td>
							<td><label id="heavy-fighter-speed" class="speed-label">0</label></td>
							<td><input id="heavy-fighter" type="text" name="heavy-fighter" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="18" /></td>

							<td><label for="bomber"><?= $l['bomber'] ?></label></td>
							<td><label id="bomber-speed" class="speed-label">0</label></td>
							<td><input id="bomber" type="text" name="bomber" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="23" /></td>

							<td><label for="recycler"><?= $l['recycler'] ?></label></td>
							<td><label id="recycler-speed" class="speed-label">0</label></td>
							<td><input id="recycler" type="text" name="recycler" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="28" /></td>
						</tr>
						<tr>
							<td><label for="reaper"><?= $l['reaper'] ?></label></td>
							<td><label id="reaper-speed" class="speed-label">0</label></td>
							<td><input id="reaper" type="text" name="reaper" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="19" /></td>

							<td><label for="pathfinder"><?= $l['pathfinder'] ?></label></td>
							<td><label id="pathfinder-speed" class="speed-label">0</label></td>
							<td><input id="pathfinder" type="text" name="pathfinder" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="24" /></td>
							
							<td><label for="esp-probe"><?= $l['esp-probe'] ?></label></td>
							<td><label id="esp-probe-speed" class="speed-label">0</label></td>
							<td><input id="esp-probe" type="text" name="esp-probe" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="29" /></td>
						</tr>
					</table>
				</div>
			</div>
		</div>
		<div id="tabs">
			<ul>
				<li><a id="tabtag1" href="#flight-times-panel"  tabindex="30" ><?= $l['flight-time'] ?></a></li>
				<li><a id="tabtag2" href="#save-points-panel" tabindex="31" ><?= $l['save-points'] ?></a></li>
			</ul>
			<div id="flight-times-panel" class="ui-panel">
				<table cellpadding="0" cellspacing="0" border="0" width="100%">
					<tr>
						<td valign="top">
							<table cellpadding="0" cellspacing="0" border="0" style="margin-left: 10px;">
								<tr>
									<td><label for="destination-g"><?= $l['destination-point'] ?>&nbsp;</label></td>
									<td>
										<input id="destination-g" type="text" name="destination-g" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['galaxy'] ?>" tabindex="32" />:<input id="destination-s" type="text" name="destination-s" class="ui-state-default ui-corner-all ui-input coord-input ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['system'] ?>" tabindex="33" />:<input id="destination-p" type="text" name="destination-p" class="ui-state-default ui-corner-all ui-input coord-input-small ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['planet'] ?>" tabindex="34" />
									</td>
									<td style="width: 30px;">&nbsp;</td>
									<td><label><?= $l['distance'] ?></label></td>
									<td style="width: 10px;">&nbsp;</td>
									<td><label id="distance"></label></td>
									<td style="width: 30px;">&nbsp;</td>
									<td>
										<input id="warrior-bonus" type="checkbox" name="warrior-bonus" class="ui-state-default ui-corner-all ui-input" /><label for="warrior-bonus"><?= $l['warrior-bonus'] ?></label>
									</td>
								</tr>
							</table>
							<table id="flight-times" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['speed'] ?></th>
									<th><?= $l['flight-duration'] ?></th>
									<th><?= $l['deut-consumption'] ?></th>
									<th><?= $l['cargo-capacity'] ?></th>
									<th style="width: 32px;">&nbsp;</th>
								</tr>
								<?php for($i=100; $i>0; $i-=5): ?>
								<tr class="<?= ($i % 10) === 5 ? 'odd' : 'even' ?>" style="height: 18px;">
									<td align="center"><?= $i ?>%</td>
									<td align="center"></td>
									<td align="center"></td>
									<td align="center"></td>
									<td>
										<div id="take-to-calc-<?= $i ?>" class="ui-state-default ui-corner-all button-taketocalc" title="<?= $l['take-to-calc'] ?>">
											<span style="margin: auto;" class="ui-icon ui-icon-arrowthick-1-e"></span>
										</div>
									</td>
								</tr>
								<?php endfor; ?>
							</table>
						</td>
						<td valign="top" width="10%">
							<div class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
								<div id="toggle-mode" class="ui-state-default ui-corner-all" style="float:right; padding: 0px; cursor: pointer; margin: 0px; margin-left: 2px;" title="<?= $l['toggle-mode'] ?>"><span class="ui-icon ui-icon-transferthick-e-w"></span></div>
								<div style="text-align: center; height: 18px; margin-left: 14px;">
										<span id="flight-title-1" style="font-weight: bold;"><?= $l['departure'] ?></span>
								</div>
								<table align="center"  cellpadding="0" cellspacing="0" border="0">
									<tr>
										<td>
											<div id="set-departure-now" class="ui-state-default ui-corner-all" style="cursor: pointer; " title="<?= $l['departure-now-hint'] ?>">
												<span style="font-size: xx-small; "><?= $l['departure-now'] ?></span>
											</div>
										</td>
										<td>
											<div id="set-departure-zero" class="ui-state-default ui-corner-all" style="cursor: pointer;" title="<?= $l['departure-zero-hint'] ?>">
												<span style="font-size: xx-small; ">&nbsp;(00:00:00)&nbsp;</span>
											</div>
										</td>
									</tr>
								</table>
								<div style="margin: 0px;">
									<input type="text" id="start-datetime" class="ui-state-default ui-corner-all ui-input startdate-input"  title="<?= $l['datetime-format-hint'] ?>"/>
								</div>
								<div>
									<table align="center">
										<tr>
											<td>
												<span><b><?= $l['flight'] ?></b></span>
											</td>
											<td>
												<div id="add-flight-time" class="ui-state-default ui-corner-all" style="padding: 0px; cursor: pointer; margin: 0px;" title="<?= $l['add-row'] ?>"><span class="ui-icon ui-icon-plus"></span></div>
											</td>
										</tr>
									</table>
								</div>
								<div>
									<table id="flight-data">
										<tr>
											<td>
												<div class="ui-state-default ui-corner-all button-toggle" title="<?= $l['toggle-sign'] ?>"><span class="ui-icon ui-icon-plus"></span></div>
											</td>
											<td>
												<div style="margin: 0px;">
													<input id="flight-time" type="text" class="ui-state-default ui-corner-all ui-input flight-time-input"  title="<?= $l['flight-time-format-hint'] ?>"/>
												</div>
											</td>
											<td>
												<div class="ui-state-default ui-corner-all button-remove" title="<?= $l['remove-row'] ?>"><span class="ui-icon ui-icon-close"></span></div>
											</td>
										</tr>
									</table>
								</div>
								<div style="text-align: center; ">
									<span id="flight-title-2"style="font-weight: bold;"><?= $l['arrival'] ?></span>
								</div>
								<div id="arrival-moment" class="ui-state-default ui-corner-all ui-input startdate-input">?</div>
							</div>
						</td>
					</tr>
				</table>
			</div>
			<div id="save-points-panel" class="ui-panel">
				<div style="float: right;">
					<button id="calculate-savepoints" tabindex="38" ><?= $l['search'] ?></button>
				</div>
				<div id="save-points-params">
					<table cellpadding="0" cellspacing="0" border="0">
						<tr>
							<td>
								<span><?= $l['departure'] ?></span>
							</td>
							<td>
								<div style="margin: 0px;">
									<input type="text" id="save-start-datetime" class="ui-state-default ui-corner-all ui-input startdate-input"  title="<?= $l['datetime-format-hint'] ?>" tabindex="34" />
								</div>
							</td>
							<td>
								<button id="set-save-departure-now" tabindex="35"  title="<?= $l['departure-now-hint'] ?>"><?= $l['departure-now'] ?></button>
							</td>
							<td width=10px;>
								&nbsp;
							</td>
							<td>
								<span><?= $l['return'] ?></span>
							</td>
							<td>
								<div style="margin: 0px;">
									<input type="text" id="save-return-datetime" class="ui-state-default ui-corner-all ui-input startdate-input"  title="<?= $l['datetime-format-hint'] ?>" tabindex="36" />
								</div>
							</td>
							<td width=10px;>
								&nbsp;
							</td>
							<td>
								<span><?= $l['save-tolerance'] ?></span>
							</td>
							<td>
								<input type="text" id="save-tolerance-time" class="ui-state-default ui-corner-all ui-input tolerance-time-input"  title="<?= $l['tolerance-time-format-hint'] ?>" tabindex="37" />
							</td>
							<td>
								<span class="ui-icon ui-icon-help" title="<?= $l['savepoints-hint'] ?>"></span>
							</td>
						</tr>
					</table>
				</div>
				<div id="save-points-tables" style="margin-top: 5px;">
					<table cellpadding="0" cellspacing="0" border="0" width="100%">
						<tr>
							<td valign="top">
								<div class="ui-widget-content ui-corner-all ui-panel" style="text-align: center;">
									<span><?= $l['galaxies'] ?></span>
									<table id="savepoints-galaxies" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
										<tr>
											<th><?= $l['speed'] ?></th>
											<th><?= $l['coords'] ?></th>
											<th><?= $l['deuterium-short'] ?></th>
										</tr>
									</table>
								</div>
							</td>
							<td valign="top">
								<div class="ui-widget-content ui-corner-all ui-panel" style="text-align: center;">
									<span><?= $l['systems'] ?></span>
									<table id="savepoints-systems" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
										<tr>
											<th><?= $l['speed'] ?></th>
											<th><?= $l['coords'] ?></th>
											<th><?= $l['deuterium-short'] ?></th>
										</tr>
									</table>
								</div>
							</td>
							<td valign="top">
								<div class="ui-widget-content ui-corner-all ui-panel" style="text-align: center;">
									<span><?= $l['planets'] ?></span>
									<table id="savepoints-planets" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
										<tr>
											<th><?= $l['speed'] ?></th>
											<th><?= $l['coords'] ?></th>
											<th><?= $l['deuterium-short'] ?></th>
										</tr>
									</table>
								</div>
							</td>
						</tr>
					</table>
				</div>
			</div>
		</div>
		</div>
	<div id="warning" class="ui-state-highlight ui-corner-all">
		<div id="warning-message">msg</div>
	</div>
	<div id="hint" class="ui-corner-all">
			<table >
				<tr>
					<td valign="top">
						<span class="ui-icon ui-icon-info"></span>
					</td>
					<td>
						<span id= "hint-message"><?= $l['flightmodes-note'] ?></span>
					</td>
				</tr>
			</table>
	</div>
</div>

</td>
</tr></table>
<?php
	require_once('../../analitics.tpl');
?>

</body>
</html>
