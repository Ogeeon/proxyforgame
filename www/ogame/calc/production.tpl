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
	<link type="text/css" href="/css/jquery.ui.spinbtn.css" rel="stylesheet"/>
	<link type="text/css" href="/css/langs.css?v=<?php echo filemtime($pfgPath.'/css/langs.css'); ?>" rel="stylesheet" />
	<link type="text/css" href="/css/common.css?v=<?php echo filemtime($pfgPath.'/css/common.css'); ?>" rel="stylesheet"/>
	<link type="text/css" href="/ogame/calc/css/production.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/production.css'); ?>" rel="stylesheet"/>
	
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

	<script type="text/javascript" src="/js/jquery.ui.spinbtn.js"></script>
<?php require_once('../../social.head.tpl'); ?>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>	
	<script type="text/javascript" src="/ogame/calc/js/production.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/production.js'); ?>"></script>

	<script type="text/javascript">
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator="<?= $l['decimal-separator'] ?>";
		options.metal = "<?= $l['metal'] ?>";
		options.crystal = "<?= $l['crystal'] ?>";
		options.deuterium = "<?= $l['deuterium'] ?>";
		options.datetimeW = "<?= $l['datetime-w'] ?>";
		options.datetimeD = "<?= $l['datetime-d'] ?>";
		options.datetimeH = "<?= $l['datetime-h'] ?>";
		options.datetimeM = "<?= $l['datetime-m'] ?>";
		options.datetimeS = "<?= $l['datetime-s'] ?>";
		options.unitSuffix = "<?= $l['unit-suffix'] ?>";
		options.warnindDivId = 'warning';
		options.warnindMsgDivId = 'warning-message';
		options.fieldHint = "<?= $l['field-hint'] ?>";
		options.msgMinConstraintViolated = "<?= $l['msg-min-constraint-violated'] ?>";
		options.msgMaxConstraintViolated = "<?= $l['msg-max-constraint-violated'] ?>";
		options.planetNumStr = "<?= $l['planet-num'] ?>";
		options.maxTempAlt = "<?= $l['max-planet-temp'] ?>";
		options.positionAlt = "<?= $l['planet-pos'] ?>";
		options.resReadyInMsg =  "<?= $l['res-ready-in'] ?>";
		options.resWillNotAccumMsg = "<?= $l['res-will-not-accumulate'] ?>";
		options.resWillNotAccumMsg1 = "<?= $l['res-will-not-accumulate1'] ?>";
		options.enoughResAlreadyMsg = "<?= $l['enough-res-already'] ?>";
		options.plnDelConfMsg = "<?= $l['del-planet-confirm'] ?>";
		options.noUniNameMsg = "<?= $l['no-uni-name-msg'] ?>";
		options.noUniSelectedMsg = "<?= $l['no-uni-selected-msg'] ?>";
		options.uniDelConfMsg = "<?= $l['del-universe-confirm'] ?>";
		options.uniOwrConfMsg = "<?= $l['owr-universe-confirm'] ?>";
		options.uniLoadConfMsg = "<?= $l['load-universe-confirm'] ?>";
		options.cloneConfMsg = "<?= $l['clone-confirm'] ?>";
		options.addtnlRowHeader = "<?= $l['addtnl-row'] ?>";
		options.energyShort = "<?= $l['energy-short'] ?>";

		<?php $techs = getTechsByType(2);?>
		options.bldCosts = {
		<?php $first = true; ?>
		<?php foreach ($techs as $tech): ?>
		<?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
		<?php $first = false; ?>
		<?php endforeach; ?>
		};

		<?php $techs = getTechsByType(5);?>
		options.fleetCosts = {
			<?php $first = true; ?>
		 	<?php foreach ($techs as $tech): ?>
		 	<?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
		 	<?php $first = false; ?>
		 	<?php endforeach; ?>
		};

		<?php $techs = getTechsByType(6);?>
		options.defenseCosts = {
			<?php $first = true; ?>
		 	<?php foreach ($techs as $tech): ?>
		 	<?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
		 	<?php $first = false; ?>
		 	<?php endforeach; ?>
		};
        $(function() {
            $("button").button();
        });
	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="production">
	<div class="ui-widget-content ui-corner-all no-mp">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="universes-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
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
					</tr>
				</table>
			</div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<table cellpadding="2" cellspacing="0" border="0" align="center">
					<tr>
						<td><label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label></td>
						<td><input id="energy-tech-level" type="text" name="energy-tech-level" class="ui-state-default ui-corner-all ui-input ui-input-margin input-2columns" value="0"/></td>
						<td><label for="plasma-tech-level"><?= $l['plasma-tech-level'] ?></label></td>
						<td><input id="plasma-tech-level" type="text" name="plasma-tech-level" class="ui-state-default ui-corner-all ui-input ui-input-margin input-2columns" value="0"/></td>
					</tr>
				</table>
				<table cellpadding="2" cellspacing="0" border="0" align="center">
					<tr>
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
						<td><input id="engineer" type="checkbox" name="engineer" class="ui-state-default ui-corner-all ui-input "/><label for="engineer"><?= $l['engineer'] ?></label></td>
						<td><input id="geologist" type="checkbox" name="geologist" class="ui-state-default ui-corner-all ui-input "/><label for="geologist"><?= $l['geologist'] ?></label></td>
						<td><input id="technocrat" type="checkbox" name="technocrat" class="ui-state-default ui-corner-all ui-input "/><label for="technocrat"><?= $l['technocrat'] ?></label></td>
						<td><input id="admiral" type="checkbox" name="admiral" class="ui-state-default ui-corner-all ui-input "/><label for="admiral"><?= $l['admiral'] ?></label></td>
						<td><input id="commander" type="checkbox" name="commander" class="ui-state-default ui-corner-all ui-input "/><label for="commander"><?= $l['commander'] ?></label></td>
					</tr>
				</table>
				<table cellpadding="2" cellspacing="0" border="0" align="center">
					<tr>
						<td style="width: 10px;">&nbsp;</td>
						<td><label><?= $l['class'] ?>:</label></td>
						<td><input id="class-0" type="radio" name="class" value="0" tabindex="1"/><label for="class-0"><?= $l['class-collector'] ?></label></td>
						<td><input id="class-1" type="radio" name="class" value="1" tabindex="2"/><label for="class-1"><?= $l['class-general'] ?></label></td>
						<td><input id="class-2" type="radio" name="class" value="2" tabindex="3"/><label for="class-2"><?= $l['class-discoverer'] ?></label></td>
						<td style="width: 10px;">&nbsp;</td>
						<td><input id="is-trader" type="checkbox" name="is-trader" class="ui-state-default ui-corner-all ui-input "/><label for="is-trader"><?= $l['is-trader'] ?></label></td>
						<td style="width: 10px;">&nbsp;</td>
						<td>
							<label for="exchange-rates-m"><?= $l['exchange-rates'] ?></label>
							<input id="exchange-rates-m" type="text" name="exchange-rates-m" class="ui-state-default ui-corner-all input-1column" value="3"/>:
							<input id="exchange-rates-c" type="text" name="exchange-rates-c" class="ui-state-default ui-corner-all input-1column er-input-margin" value="2"/>:
							<input id="exchange-rates-d" type="text" name="exchange-rates-d" class="ui-state-default ui-corner-all input-1column er-input-margin" value="1"/>
						</td>
					</tr>
				</table>
			</div>
			<div id="tabs">
				<ul>
					<li><a id="tabtag1" href="#one-planet-panel" ><?= $l['one-planet'] ?></a></li>
					<li><a id="tabtag2" href="#all-planets-panel" ><?= $l['all-planets'] ?></a></li>
				</ul>
				<div id="one-planet-panel" class="ui-panel">
					<div id="planet-temp-div">
						<label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label>
						<input id="max-planet-temp" type="text" name="max-planet-temp" class="ui-state-default ui-corner-all ui-input ui-input-margin input-4columns" value="0" alt="<?= $l['max-planet-temp'] ?>"/>
					</div>
					<div id="planet-pos-div">
						<label for="planet-pos"><?= $l['planet-pos'] ?></label>
						<input id="planet-pos" type="text" name="planet-pos" class="ui-state-default ui-corner-all ui-input ui-input-margin input-2columns" value="0" alt="<?= $l['planet-pos'] ?>"/>
					</div>
					<div id="energy-boost-div">
						<label for="energy-boost"><?= $l['energy-boost'] ?></label>
						<select id="energy-boost" name="energy-boost" class="ui-state-default ui-corner-all ui-input ui-input-margin">
							<option value="0" selected="selected">0%</option>
							<option value="2">20%</option>
							<option value="4">40%</option>
							<option value="6">60%</option>
							<option value="8">80%</option>
						</select>
					</div>
					<div id="extended-view-div">
						<input id="one-pln-extended-view" name="one-pln-extended-view" type="checkbox" class="ui-state-default ui-corner-all ui-input"/>
						<label for="one-pln-extended-view"><?= $l['extended-view'] ?></label>
					</div>
					<div id="prod-coeff-div">
						<?= $l['prod-coeff'] ?>&nbsp;<span id="prod-coeff">0</span>
					</div>

					<table id="one-planet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
						<tr>
							<th>&nbsp;</th>
							<th style="display: none;"><?= $l['boosted'] ?></th>
							<th><?= $l['qty-header'] ?></th>
							<th><?= $l['metal'] ?></th>
							<th><?= $l['crystal'] ?></th>
							<th><?= $l['deuterium'] ?></th>
							<th><?= $l['energy'] ?></th>
							<th style="display: none;">%</th>
						</tr>
						<?php for($i = 0; $i < count($oneTblProdRows); $i++): ?>
							<?php if ($i == 15):?>
 								<tr><td colspan="8" class="table-line-2px"></td></tr>
							<?php endif; ?>
							<tr class="<?= ($i % 2) === 1 ? 'odd' : 'even' ?>" >
									<td align="left" ><?= $l[$oneTblProdRows[$i]] ?></td>
									<?php if ($i > 0 && $i < 8): ?>
										<?php if ($i < 4): ?>
											<td align="center" style="display: none;">
												<select id="boosted-prod<?= $i ?>" name="boosted-prod" class="ui-state-default ui-corner-all ui-input input-in-table">
													<option value="0" selected="selected">0%</option>
													<option value="1">10%</option>
													<option value="2">20%</option>
													<option value="3">30%</option>
													<option value="4">40%</option>
												</select>
											</td>
										<?php else: ?>
											<td style="display: none;"></td>
										<?php endif; ?>
										<td align="center">
											<input type="text" class="ui-state-default ui-corner-all ui-input <?=($i==6 || $i==7)?'input-4columns':'input-3columns' ?> input-in-table" value="0" />
										</td>
										<td align="center"></td><td align="center"></td><td align="center"></td><td align="center"></td>
										<td style="display: none;" align="center" style="display: none;">
											<select class="ui-state-default ui-corner-all ui-input input-in-table">
											<?php if ($i == 7): ?>
												<option value="150">150</option>
												<option value="140">140</option>
												<option value="130">130</option>
												<option value="120">120</option>
												<option value="110">110</option>
											<?php endif; ?>
												<option value="100" selected="selected">100</option>
												<option value="90">90</option>
												<option value="80">80</option>
												<option value="70">70</option>
												<option value="60">60</option>
												<option value="50">50</option>
												<option value="40">40</option>
												<option value="30">30</option>
												<option value="20">20</option>
												<option value="10">10</option>
												<option value="0">0</option>
											</select>
										</td>
									<?php else: ?>
										<?php for ($j = 0; $j < 7; $j++): ?>
											<?php if ($j == 0 || $j == 6): ?>
												<td align="center" style="display: none;"></td>
											<?php else: ?>
												<td align="center"></td>
											<?php endif; ?>
										<?php endfor; ?>
									<?php endif; ?>
							</tr>
						<?php endfor; ?>
						<tr><td colspan="8" class="table-line-3px"></td></tr>
					</table>
					<div id="planet-save-div" class="ui-panel" style="display:none">
						<table id="planet-save-tbl" cellpadding="0" cellspacing="1" border="0" align="center">
							<tr>
								<td><label for="planet-name"><?= $l['planet-name'] ?></label></td>
								<td><input id="planet-name" type="text" name="planet-name" class="ui-state-default ui-corner-all ui-input ui-input-margin input-20columns"/></td>
								<td width="20px">&nbsp;</td>
								<td><button id="save-planet-data" title="<?= $l['save-planet-data'] ?>"><?= $l['save-planet-data'] ?></button></td>
								<td width="20px">&nbsp;</td>
								<td><button id="clone-planet-data" title="<?= $l['clone-planet-data'] ?>"><?= $l['clone-planet-data'] ?></button></td>
							</tr>
						</table>
					</div>
					<div id="one-planet-accordion">
						<h3><a href="#"><?= $l['mines-amortization'] ?></a></h3>
						<div>
							<table cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<td style="width: 1%">&nbsp;</td>
									<td style="width: 80%; margin-left: 20px;"><?= $l['incl-explain'] ?></td>
									<td style="white-space: nowrap; width: 20%; text-align: center">
									<input id="include-SS-y" type="radio" name="include-SS" value="0" tabindex="1"/><label for="include-SS-y"><?= $l['incl-yes'] ?></label>
									<input id="include-SS-n" type="radio" name="include-SS" value="1" tabindex="2"/><label for="include-SS-n"><?= $l['incl-no'] ?></label>
									</td>
								</tr>
							</table>
							<table id="mines-amort-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['mine'] ?></th>
									<th><?= $l['upgrade-cost'] ?></th>
									<th><?= $l['production-increase'] ?></th>
									<th><?= $l['amortization-time'] ?></th>
								</tr>
								<tr class="odd">
									<td><?= $l['metal-mine'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
								</tr>
								<tr class="even">
									<td><?= $l['crystal-mine'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
								</tr>
								<tr class="odd">
									<td><?= $l['deut-synth'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
								</tr>
							</table>
							<table cellpadding="0" cellspacing="1" border="0" style="width=100%; margin-top: 15px;">
								<tr>
									<td style="width: 1%">&nbsp;</td>
									<td><?= $l['amort-comment'] ?></td>
								</tr>
							</table>
						</div>
						<h3><a href="#"><?= $l['resources-accumulation'] ?></a></h3>
						<div>
							<table width="100%;">
								<tr>
									<td colspan="2">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['current-resources'] ?></legend>
											<table id="one-pln-accum" class="lined" width="100%" cellpadding="0" cellspacing="1" border="0" >
												<tr>
													<th><?= $l['resource'] ?></th>
													<th><?= $l['amount'] ?></th>
													<th><?= $l['storage-level'] ?></th>
													<th><?= $l['storage-capacity'] ?></th>
												</tr>
												<tr>
													<td><?= $l['metal'] ?></td>
													<td align="center"><input id="onepln-curr-met" type="text" name="onepln-curr-met" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
													<td align="center"><input id="storage-met" type="text" name="storage-met" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-3columns" value="0"/></td>
													<td align="center"><span id="storage-cap-met">0</span></td>
												</tr>
												<tr>
													<td><?= $l['crystal'] ?></td>
													<td align="center"><input id="onepln-curr-crys" type="text" name="onepln-curr-crys" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
													<td align="center"><input id="storage-crys" type="text" name="storage-crys" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-3columns" value="0"/></td>
													<td align="center"><span id="storage-cap-crys">0</span></td>
												</tr>
												<tr>
													<td><?= $l['deuterium'] ?></td>
													<td align="center"><input id="onepln-curr-deut" type="text" name="onepln-curr-deut" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
													<td align="center"><input id="storage-deut" type="text" name="storage-deut" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-3columns" value="0"/></td>
													<td align="center"><span id="storage-cap-deut">0</span></td>
												</tr>
											</table>
										</fieldset>
									</td>
								</tr>
								<tr>
									<td width="50%" valign="top">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['accumulate-what'] ?></legend>
											<table width="100%;" cellpadding="0" cellspacing="1" border="0" >
												<tr>
													<td colspan="2" height="20px;">
														<table cellpadding="0" cellspacing="0" border="0" >
															<tr>
																<td><?= $l['after'] ?></td>
																<td><input id="onepln-accumwhat-d" type="text" name="onepln-accumwhat-d" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="onepln-accumwhat-d"><?= $l['datetime-d'] ?></label></td>
																<td><input id="onepln-accumwhat-h" type="text" name="onepln-accumwhat-h" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="onepln-accumwhat-h"><?= $l['datetime-h'] ?></label></td>
																<td><input id="onepln-accumwhat-m" type="text" name="onepln-accumwhat-m" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="onepln-accumwhat-m"><?= $l['datetime-m'] ?></label></td>
															</tr>
														</table>
													</td>
												</tr>
												<tr><td colspan="2"  height="20px;"><?= $l['resources-will-be'] ?></td></tr>
												<tr><td width="50%;" height="20px;"><?= $l['metal'] ?></td><td align="left"><span id="onepln-accumwhat-met">0</span></td></tr>
												<tr><td height="20px;"><?= $l['crystal'] ?></td><td align="left"><span id="onepln-accumwhat-crys">0</span></td></tr>
												<tr><td height="20px;"><?= $l['deuterium'] ?></td><td align="left"><span id="onepln-accumwhat-deut">0</span></td></tr>
											</table>
										</fieldset>
									</td>
									<td valign="top">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['accumulate-when'] ?></legend>
											<table cellpadding="0" cellspacing="1" border="0" >
												<tr>
													<td colspan="2" height="20px;"><?= $l['specify-res-quant'] ?></td>
												</tr>
												<tr>
													<td height="20px;"><label for="onepln-accumwhen-met"><?= $l['metal'] ?></label></td>
													<td><input id="onepln-accumwhen-met" type="text" name="onepln-accumwhen-met" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td height="20px;"><label for="onepln-accumwhen-crys"><?= $l['crystal'] ?></label></td>
													<td><input id="onepln-accumwhen-crys" type="text" name="onepln-accumwhen-crys" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td height="20px;"><label for="onepln-accumwhen-deut"><?= $l['deuterium'] ?></label></td>
													<td><input id="onepln-accumwhen-deut" type="text" name="onepln-accumwhen-deut" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td colspan="2" height="20px;">
														<span id="onepln-accumwhen-msg"></span>
													</td>
												</tr>
											</table>
										</fieldset>
									</td>
								</tr>
							</table>
						</div>
						<h3><a href="#"><?= $l['fleet-production'] ?></a></h3>
						<div>
							<?php $techs = getTechsByType(5);?>
							<table id="one-pln-fleet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['ship'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
								</tr>
								<?php $row = 0;?>
								<?php foreach ($techs as $tech) :?>
								<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
								</tr>
								<?php endforeach; ?>
							</table>
						</div>
						<h3><a href="#"><?= $l['defense-producton'] ?></a></h3>
						<div>
							<?php $techs = getTechsByType(6);?>
							<table id="one-pln-defense-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['building'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
								</tr>
								<?php $row = 0;?>
								<?php foreach ($techs as $tech) :?>
								<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
								</tr>
								<?php endforeach; ?>
							</table>
						</div>	
					</div>					
				</div>
				<div id="all-planets-panel" class="ui-panel">
                    <div id="addtnl-info-div">
                        <input id="all-pln-addtnl-info" name="all-pln-addtnl-info" type="checkbox" class="ui-state-default ui-corner-all ui-input"/>
                        <label for="all-pln-addtnl-info"><?= $l['show-addtnl-info'] ?></label>
                    </div>
                    <div style="text-align: center;">
                        <?= $l['planets-count'] ?>
                        <input id="planetsSpin" type="text" class="ui-corner-all input-2columns spin-button" value="8" />
                    </div>
					<table id="all-planets-prod" class="lined" width="100%" cellpadding="0" cellspacing="1" border="0" >
						<tr>
							<th>&nbsp;</th>
							<th>&nbsp;</th>
							<th><abbr title="<?= $l['max-planet-temp'] ?>">t°</abbr></th>
							<th><abbr title="<?= $l['planet-pos'] ?>"><?= $l['planet-pos-short'] ?></abbr></th>
							<th><abbr title="<?= $l['metal-mine'] ?>"><?= $l['metal-mine-short'] ?></abbr></th>
							<th><?= $l['metal-short'] ?></th>
							<th><abbr title="<?= $l['crystal-mine'] ?>"><?= $l['crystal-mine-short'] ?></abbr></th>
							<th><?= $l['crystal-short'] ?></th>
							<th><abbr title="<?= $l['deut-synth'] ?>"><?= $l['deuterium-synth-short'] ?></abbr></th>
							<th><?= $l['deuterium-short'] ?></th>
							<th><abbr title="<?= $l['solar-plant'] ?>"><?= $l['solar-short'] ?></abbr></th>
							<th><abbr title="<?= $l['fusion-reactor'] ?>"><?= $l['fusion-short'] ?></abbr></th>
							<th><abbr title="<?= $l['solar-sat'] ?>"><?= $l['sats-short'] ?></abbr></th>
							<th><abbr title="<?= $l['crawler'] ?>"><?= $l['crawler-short'] ?></abbr></th>
							<th><abbr title="<?= $l['prod-coeff'] ?>"><?= $l['coeff-short'] ?></abbr></th>
							<th class="control-buttons">&nbsp;</th>
						</tr>
						<tr><td colspan="16" class="table-line-2px"></td></tr>
						<?php for ($i = 0; $i < 3; $i++): ?>
							<tr class="<?= (($i+1) % 2) === 1 ? 'odd' : 'even' ?>">
								<td></td>
								<td><?= $l[$allTblTotalRows[$i]] ?></td>
								<?php for ($j = 1; $j < 16; $j++): ?>
									<td align="center"></td>
								<?php endfor; ?>
							</tr>
						<?php endfor; ?>
						<tr><td colspan="16" class="table-line-3px"></td></tr>
					</table>
					<div id="all-planets-accordion">
						<h3><a href="#"><?= $l['plasma-amortization'] ?></a></h3>
						<div>
							<table id="plasma-amort-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th style="width: 55%"></th>
									<th style="width: 15%"><?= $l['metal'] ?></th>
									<th style="width: 15%"><?= $l['crystal'] ?></th>
									<th style="width: 15%"><?= $l['deuterium'] ?></th>
								</tr>
								<tr class="odd">
									<td><?= $l['upgrade-cost'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
								</tr>
								<tr class="even">
									<td><?= $l['production-increase'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
								</tr>
								<tr class="odd">
									<td><?= $l['amortization-time'] ?></td><td class="centered" colspan="3"></td>
								</tr>
							</table>
						</div>
						<h3><a href="#"><?= $l['resources-accumulation'] ?></a></h3>
						<div>
							<table width="100%;">
								<tr>
									<td colspan="2">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['total-empire-resources'] ?></legend>
											<table>
												<tr>
													<td><label for="allpln-curr-met"><?= $l['metal'] ?></label></td>
													<td><input id="allpln-curr-met" type="text" name="allpln-curr-met" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
													<td><label for="allpln-curr-crys"><?= $l['crystal'] ?></label></td>
													<td><input id="allpln-curr-crys" type="text" name="allpln-curr-crys" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
													<td><label for="allpln-curr-deut"><?= $l['deuterium'] ?></label></td>
													<td><input id="allpln-curr-deut" type="text" name="allpln-curr-deut" class="ui-state-default ui-corner-all ui-input ui-spaced-input-r input-10columns" value="0"/></td>
												</tr>
											</table>
										</fieldset>
									</td>
								</tr>
								<tr>
									<td width="50%" valign="top">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['accumulate-what'] ?></legend>
											<table width="100%;" cellpadding="0" cellspacing="1" border="0" >
												<tr>
													<td colspan="2" height="20px;">
														<table cellpadding="0" cellspacing="0" border="0" >
															<tr>
																<td><?= $l['after'] ?></td>
																<td><input id="allpln-accumwhat-d" type="text" name="allpln-accumwhat-d" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="allpln-accumwhat-d"><?= $l['datetime-d'] ?></label></td>
																<td><input id="allpln-accumwhat-h" type="text" name="allpln-accumwhat-h" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="allpln-accumwhat-h"><?= $l['datetime-h'] ?></label></td>
																<td><input id="allpln-accumwhat-m" type="text" name="allpln-accumwhat-m" class="ui-state-default ui-corner-all ui-input ui-spaced-input-l input-2columns" value="0"/></td>
																<td><label for="allpln-accumwhat-m"><?= $l['datetime-m'] ?></label></td>
															</tr>
														</table>
													</td>
												</tr>
												<tr><td colspan="2"  height="20px;"><?= $l['resources-will-be'] ?></td></tr>
												<tr><td width="50%;" height="20px;"><?= $l['metal'] ?></td><td align="left"><span id="allpln-accumwhat-met">0</span></td></tr>
												<tr><td height="20px;"><?= $l['crystal'] ?></td><td align="left"><span id="allpln-accumwhat-crys">0</span></td></tr>
												<tr><td height="20px;"><?= $l['deuterium'] ?></td><td align="left"><span id="allpln-accumwhat-deut">0</span></td></tr>
											</table>
										</fieldset>
									</td>
									<td valign="top">
										<fieldset class="ui-widget-content ui-corner-all ui-panel">
											<legend><?= $l['accumulate-when'] ?></legend>
											<table cellpadding="0" cellspacing="1" border="0" >
												<tr>
													<td colspan="2" height="20px;"><?= $l['specify-res-quant'] ?></td>
												</tr>
												<tr>
													<td height="20px;"><label for="allpln-accumwhen-met"><?= $l['metal'] ?></label></td>
													<td><input id="allpln-accumwhen-met" type="text" name="allpln-accumwhen-met" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td height="20px;"><label for="onepln-accumwhen-crys"><?= $l['crystal'] ?></label></td>
													<td><input id="allpln-accumwhen-crys" type="text" name="allpln-accumwhen-crys" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td height="20px;"><label for="allpln-accumwhen-deut"><?= $l['deuterium'] ?></label></td>
													<td><input id="allpln-accumwhen-deut" type="text" name="allpln-accumwhen-deut" class="ui-state-default ui-corner-all ui-input no-mp input-10columns" value="0"/></td>
												</tr>
												<tr>
													<td colspan="2" height="20px;">
														<span id="allpln-accumwhen-msg"></span>
													</td>
												</tr>
											</table>
										</fieldset>
									</td>
								</tr>
							</table>
						</div>
						<h3><a href="#"><?= $l['fleet-production'] ?></a></h3>
						<div>
							<?php $techs = getTechsByType(5);?>
							<table id="all-pln-fleet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['ship'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
								</tr>
								<?php $row = 0;?>
								<?php foreach ($techs as $tech) :?>
								<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
								</tr>
								<?php endforeach; ?>
							</table>
						</div>
						<h3><a href="#"><?= $l['defense-producton'] ?></a></h3>
						<div>
							<?php $techs = getTechsByType(6);?>
							<table id="all-pln-defense-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
									<th><?= $l['building'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
								</tr>
								<?php $row = 0;?>
								<?php foreach ($techs as $tech) :?>
								<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
								</tr>
								<?php endforeach; ?>
							</table>
						</div>
				</div>
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
