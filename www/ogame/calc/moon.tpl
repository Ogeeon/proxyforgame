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
	<link type="text/css" href="/ogame/calc/css/moon.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/moon.css'); ?>" rel="stylesheet"/>
	
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
	<script type="text/javascript" src="/js/jquery.cookie.js"></script>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/moon.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/moon.js'); ?>"></script>

	<script type="text/javascript">
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator='<?= $l['decimal-separator'] ?>';
		options.warnindDivId = 'warning';
		options.warnindMsgDivId = 'warning-message';
		options.fieldHint = '<?= $l['field-hint'] ?>';
		options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
		options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="moon">
	<div class="ui-widget-content ui-corner-all no-mp">
		<div id="reset-ds" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['destroy-title'] ?></div>
		<div>
			<div id="destroy-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['parameters'] ?></b></p>
				<div id="destroy-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="moon-size"><?= $l['moon-size'] ?></label></td>
							<td><input id="moon-size" type="text" name="moon-size" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="1" alt="<?= $l['moon-size'] ?>"/></td>
							<td><label for="ds-count"><?= $l['ds-count'] ?></label></td>
							<td><input id="ds-count" type="text" name="ds-count" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="1" /></td>
						</tr>
					</table>
				</div>
			</div>
			<div id="destroy-results-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['calc-results'] ?></b></p>
				<table align="center">
					<tr>
						<td>
							<label><?= $l['moon-destroy-chance'] ?></label>
						</td>
						<td>
							<div id="moon-destroy-chance" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
					<tr>
						<td>
							<label><?= $l['ds-blow-chance'] ?></label>
						</td>
						<td>
							<div id="ds-blow-chance" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<div id="spacer"><hr/></div>
		<div id="reset-cr" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['create-title'] ?></div>
		<div>
			<div id="create-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['parameters'] ?></b></p>
				<div id="create-settings">
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="hypertech-lvl"><?= $l['hyper-tech'] ?>&nbsp;</label></td>
							<td><input id="hypertech-lvl" type="text" name="hypertech-lvl" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
							<td>
								<label><?= $l['debris-percent'] ?></label>
							</td>
							<td>
								<select id="debris-percent" name="debris-percent" class="ui-state-default ui-corner-all ui-input ui-input-margin energy-input">
									<option value="20">20%</option>
									<option value="30" selected="selected">30%</option>
									<option value="40">40%</option>
									<option value="50">50%</option>
									<option value="55">55%</option>
									<option value="60">60%</option>
									<option value="70">70%</option>
									<option value="80">80%</option>
								</select>
							</td>
						</tr>
					<table cellpadding="0" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="small-cargo"><?= $l['small-cargo'] ?></label></td>
							<td><label id="small-cargo-max" class="max-label">0</label></td>
							<td><input id="small-cargo" type="text" name="small-cargo" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="9" /></td>

							<td><label for="cruiser"><?= $l['cruiser'] ?></label></td>
							<td><label id="cruiser-max" class="max-label">0</label></td>
							<td><input id="cruiser" type="text" name="cruiser" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="14" /></td>

							<td><label for="battlecruiser"><?= $l['battlecruiser'] ?></label></td>
							<td><label id="battlecruiser-max" class="max-label">0</label></td>
							<td><input id="battlecruiser" type="text" name="battlecruiser" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="19" /></td>
						</tr>
						<tr>
							<td><label for="large-cargo"><?= $l['large-cargo'] ?></label></td>
							<td><label id="large-cargo-max" class="max-label">0</label></td>
							<td><input id="large-cargo" type="text" name="large-cargo" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="10" /></td>

							<td><label for="battleship"><?= $l['battleship'] ?></label></td>
							<td><label id="battleship-max" class="max-label">0</label></td>
							<td><input id="battleship" type="text" name="battleship" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="15" /></td>

							<td><label for="death-star"><?= $l['death-star'] ?></label></td>
							<td><label id="death-star-max" class="max-label">0</label></td>
							<td><input id="death-star" type="text" name="death-star" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="20" /></td>
						</tr>
						<tr>
							<td><label for="light-fighter"><?= $l['light-fighter'] ?></label></td>
							<td><label id="light-fighter-max" class="max-label">0</label></td>
							<td><input id="light-fighter" type="text" name="light-fighter" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="11" /></td>

							<td><label for="destroyer"><?= $l['destroyer'] ?></label></td>
							<td><label id="destroyer-max" class="max-label">0</label></td>
							<td><input id="destroyer" type="text" name="destroyer" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="16" /></td>

							<td><label for="colony-ship"><?= $l['colony-ship'] ?></label></td>
							<td><label id="colony-ship-max" class="max-label">0</label></td>
							<td><input id="colony-ship" type="text" name="colony-ship" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="21" /></td>
						</tr>
						<tr>
							<td><label for="heavy-fighter"><?= $l['heavy-fighter'] ?></label></td>
							<td><label id="heavy-fighter-max" class="max-label">0</label></td>
							<td><input id="heavy-fighter" type="text" name="heavy-fighter" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="12" /></td>

							<td><label for="bomber"><?= $l['bomber'] ?></label></td>
							<td><label id="bomber-max" class="max-label">0</label></td>
							<td><input id="bomber" type="text" name="bomber" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="17" /></td>

							<td><label for="recycler"><?= $l['recycler'] ?></label></td>
							<td><label id="recycler-max" class="max-label">0</label></td>
							<td><input id="recycler" type="text" name="recycler" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="22" /></td>
						</tr>
						<tr>
							<td><label for="reaper"><?= $l['reaper'] ?></label></td>
							<td><label id="reaper-max" class="max-label">0</label></td>
							<td><input id="reaper" type="text" name="reaper" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="13" /></td>
							
							<td><label for="pathfinder"><?= $l['pathfinder'] ?></label></td>
							<td><label id="pathfinder-max" class="max-label">0</label></td>
							<td><input id="pathfinder" type="text" name="pathfinder" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="18" /></td>
							
							<td><label for="esp-probe"><?= $l['esp-probe'] ?></label></td>
							<td><label id="esp-probe-max" class="max-label">0</label></td>
							<td><input id="esp-probe" type="text" name="esp-probe" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin" value="0" tabindex="23" /></td>
						</tr>
					</table>
				</div>
			</div>
			<div id="create-results-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['calc-results'] ?></b></p>
				<table align="center">
					<tr>
						<td>
							<label><?= $l['moon-create-chance'] ?></label>
						</td>
						<td>
							<div id="moon-create-chance" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
				<hr/>
				<table align="center">
					<tr><td colspan="6" align="center"><span class="result-subtitle"><?= $l['expences'] ?></span></td></tr>
					<tr>
					<td>
						<label><?= $l['metal'] ?></label>
					</td>
					<td>
						<div id="metal-required" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['crystal'] ?></label>
					</td>
					<td>
						<div id="crystal-required" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['deuterium'] ?></label>
					</td>
					<td>
						<div id="deuterium-required" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
				</tr>
				</table>
				<hr/>
				<table align="center">
					<tr><td colspan="6" align="center"><span class="result-subtitle"><?= $l['recycling'] ?></span></td></tr>
					<tr>
						<td>
							<label><?= $l['metal'] ?></label>
						</td>
						<td>
							<div id="metal-recyclable" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
						</td>
						<td>
							<label><?= $l['crystal'] ?></label>
						</td>
						<td>
							<div id="crystal-recyclable" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
						</td>
						<td>
							<label><?= $l['recyclers'] ?></label>
						</td>
						<td>
							<div id="recyclers" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
			</div>
		</div>
	</div>
	<div id="warning" class="ui-state-highlight ui-corner-all">
		<div id="warning-message"></div>
	</div>
</div>

</td>
</tr></table>
<?php
	require_once('../../analitics.tpl');
?>

</body>
</html>
