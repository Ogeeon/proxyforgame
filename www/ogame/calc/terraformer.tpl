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
	<link type="text/css" href="/ogame/calc/css/terraformer.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/terraformer.css'); ?>" rel="stylesheet"/>
	
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
	<script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>	
	<script type="text/javascript" src="/ogame/calc/js/terraformer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/terraformer.js'); ?>"></script>

	<script type="text/javascript">
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator='<?= $l['decimal-separator'] ?>';
		options.datetimeW = '<?= $l['datetime-w'] ?>';
		options.datetimeD = '<?= $l['datetime-d'] ?>';
		options.datetimeH = '<?= $l['datetime-h'] ?>';
		options.datetimeM = '<?= $l['datetime-m'] ?>';
		options.datetimeS = '<?= $l['datetime-s'] ?>';
		options.scShort = '<?= $l['sc-short'] ?>';
		options.lcShort = '<?= $l['lc-short'] ?>';
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

<div id="terraformer">
	<div class="ui-widget-content ui-corner-all no-mp">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['parameters'] ?></b></p>
				<div id="general-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="robots-factory-level"><?= $l['robots-factory-level'] ?></label></td>
							<td><input id="robots-factory-level" type="text" name="robots-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="shipyard-level"><?= $l['shipyard-level'] ?></label></td>
							<td><input id="shipyard-level" type="text" name="shipyard-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="1" alt="<?= $l['shipyard-level'] ?>"/></td>
							<td><label for="nanites-factory-level"><?= $l['nanites-factory-level'] ?></label></td>
							<td><input id="nanites-factory-level" type="text" name="nanites-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</tr>
						<tr>
							<td><label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label></td>
							<td><input id="energy-tech-level" type="text" name="energy-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
							<td><label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label></td>
							<td><input id="max-planet-temp" type="text" name="max-planet-temp" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" alt="<?= $l['max-planet-temp'] ?>"/></td>
							<td><label for="universe-speed"><?= $l['universe-speed'] ?></label></td>
							<td>
								<select id="universe-speed" name="universe-speed" class="ui-state-default ui-corner-all ui-input ui-input-margin">
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
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
						<td><label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label></td>
						<td><input id="hyper-tech-level" type="text" name="hyper-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						<td>&nbsp;</td>
						<td><label for="disr-chamber-level"><?= $l['disr-chamber'] ?></label></td>
						<td>
							<td><input id="disr-chamber-level" type="text" name="disr-chamber-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</td>
						</tr>
					</table>
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
						<td>
						<label><?= $l['energy-bonus'] ?>:</label>
						</td>
						<td>
						<input id="energy-bonus-0" type="radio" name="energy-bonus" value="0" tabindex="1"/><label for="energy-bonus-0"><?= $l['none'] ?></label>
						<input id="energy-bonus-1" type="radio" name="energy-bonus" value="1" tabindex="2"/><label for="energy-bonus-1"><?= $l['engineer'] ?></label>
						<input id="energy-bonus-2" type="radio" name="energy-bonus" value="2" tabindex="3"/><label for="energy-bonus-2"><?= $l['all-officers'] ?></label>
						</td>
						</tr>
					</table>
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="energy-boost"><?= $l['energy-boost'] ?></label></td>
							<td>
								<select id="energy-boost" name="energy-boost" class="ui-state-default ui-corner-all ui-input ui-input-margin">
									<option value="0" selected="selected">0%</option>
									<option value="2">20%</option>
									<option value="4">40%</option>
									<option value="6">60%</option>
									<option value="8">80%</option>
								</select>							
							</td>
							<td>
								<input id="class-collector" type="checkbox" name="class-collector" class="ui-state-default ui-corner-all ui-input"/><label for="class-collector"><?= $l['class-collector'] ?></label>
							</td>
							<td>
								&nbsp;&nbsp;<input id="trader-bonus" type="checkbox" name="trader-bonus" class="ui-state-default ui-corner-all ui-input" /><label for="trader-bonus"><?= $l['trader-bonus'] ?></label>
							</td>
						</tr>
					</table>
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td>
								<label for="total-lf-energy-bonus"><?= $l['total-lf-energy-bonus'] ?></label>
							</td>
							<td>
								<td><input id="total-lf-energy-bonus" type="text" name="total-lf-energy-bonus" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" />%</td>
							</td>
						</tr>
					</table>
				</div>
				<div class="hr"></div>
				<div id="plants-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="solar-plant-level"><?= $l['solar-plant-level'] ?></label></td>
							<td><input id="solar-plant-level" type="text" name="solar-plant-level" class="ui-state-default ui-corner-all ui-input energy-input ui-input-margin" value="0"/></td>
							<td>
								<select id="solar-plant-percent" name="solar-plant-percent" class="ui-state-default ui-corner-all ui-input ui-input-margin">
								<option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
								<option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
								</select>
							</td>
							<td><label id="solar-plant-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="fusion-plant-level"><?= $l['fusion-plant-level'] ?></label></td>
							<td><input id="fusion-plant-level" type="text" name="fusion-plant-level" class="ui-state-default ui-corner-all ui-input energy-input ui-input-margin" value="0"/></td>
							<td>
								<select id="fusion-plant-percent" name="fusion-plant-percent" class="ui-state-default ui-corner-all ui-input ui-input-margin">
								<option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
								<option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
								</select>
							</td>
							<td><label id="fusion-plant-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="solar-satellites-count"><?= $l['solar-satellites-count'] ?></label></td>
							<td><input id="solar-satellites-count" type="text" name="solar-satellites-count" class="ui-state-default ui-corner-all ui-input energy-input ui-input-margin" value="0"/></td>
							<td>
								<select id="solar-satellites-percent" name="solar-satellites-percent" class="ui-state-default ui-corner-all ui-input ui-input-margin">
								<option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
								<option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
								</select>
							</td>
							<td><label id="solar-satsellites-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="officers-bonus"><?= $l['officers-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="officers-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="class-bonus"><?= $l['class-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="class-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td>
								<label for="alliance-bonus"><?= $l['alliance-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="alliance-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="boost-bonus"><?= $l['boost-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="boost-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
						<tr>
							<td><label for="disr-chamber-bonus"><?= $l['disr-chamber-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="disr-chamber-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
							<td><label for="lf-tech-bonus"><?= $l['lf-tech-bonus'] ?></label></td>
							<td>&nbsp;</td>
							<td>&nbsp;</td>
							<td><label id="lf-tech-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
						</tr>
					</table>
				</div>
				<div class="hr"></div>
				<div id="tf-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="tf-level"><?= $l['tf-level'] ?>&nbsp;(</label></td>
							<td><input id="single-level" type="checkbox" name="single-level" class="ui-state-default ui-corner-all ui-input"/><label for="single-level"><?= $l['single-level'] ?>)</label></td>
							<td><input id="tf-level-from" type="text" name="tf-level-from" class="ui-state-default ui-corner-all ui-input energy-input ui-input-margin" value="0"/></td>
							<td><label id="level-spacer">&#8212;</label></td>
							<td><input id="tf-level-to" type="text" name="tf-level-to" class="ui-state-default ui-corner-all ui-input energy-input ui-input-margin" value="0"/></td>
						</tr>
					</table>
				</div>
			</div>
			<div class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['calc-results'] ?></b></p>
				<table align="center">
					<tr>
						<td>
							<label><?= $l['added-fields'] ?>:</label>
						</td>
						<td>
							<div id="added-fields" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
				<div class="hr"></div>
				<table align="center">
					<tr>
						<td>
							<label><?= $l['energy-produced'] ?></label>
						</td>
						<td>
							<div id="energy-produced" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
						<td>
							<label><?= $l['energy-needed'] ?></label>
						</td>
						<td>
							<div id="energy-needed" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
				<table align="center">
					<tr>
						<td colspan="2">
							<label><?= $l['solar-satellites-needed'] ?></label>
						</td>
						<td>
							<div id="solar-satellites-needed" class="ui-state-default ui-corner-all ui-input energy-show ui-input-margin">0</div>
						</td>
					</tr>
				</table>
			</div>
			<div class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
			<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['expences'] ?></b></p>
			<table align="center">
				<tr><td colspan="6" align="center"><span class="result-subtitle"><?= $l['terraformer'] ?></span></td></tr>
				<tr>
					<td>
						<label><?= $l['crystal'] ?></label>
					</td>
					<td>
						<div id="crystal-required-tf" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['deuterium'] ?></label>
					</td>
					<td>
						<div id="deuterium-required-tf" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['time'] ?></label>
					</td>
					<td>
						<div id="time-required-tf" class="ui-state-default ui-corner-all ui-input time-show ui-input-margin">0</div>
					</td>
				</tr>
				<tr><td colspan="6" align="center"><span class="result-subtitle"><?= $l['satellites'] ?></span></td></tr>
				<tr>
					<td>
						<label><?= $l['crystal'] ?></label>
					</td>
					<td>
						<div id="crystal-required-ss" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['deuterium'] ?></label>
					</td>
					<td>
						<div id="deuterium-required-ss" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['time'] ?></label>
					</td>
					<td>
						<div id="time-required-ss" class="ui-state-default ui-corner-all ui-input time-show ui-input-margin">0</div>
					</td>
				</tr>
				<tr><td colspan="6" align="center"><span class="result-subtitle"><?= $l['total'] ?></span></td></tr>
				<tr>
					<td>
						<label><?= $l['crystal'] ?></label>
					</td>
					<td>
						<div id="crystal-required-total" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						<label><?= $l['deuterium'] ?></label>
					</td>
					<td>
						<div id="deuterium-required-total" class="ui-state-default ui-corner-all ui-input resource-show ui-input-margin">0</div>
					</td>
					<td>
						&nbsp;
					</td>
					<td>
						&nbsp;
					</td>
				</tr>
			</table>
			<div style="height: 5px;"></div>
			<table align="center">
				<tr>
					<td>
						<label><?= $l['cargoes'] ?></label>
					</td>
					<td>
						<div id="cargoes" class="ui-state-default ui-corner-all ui-input transport-show ui-input-margin">0</div>
					</td>
					<td>
						<span class="ui-icon ui-icon-help" title="<?= $l['sc'] ?> / <?= $l['lc'] ?>"></span>
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
