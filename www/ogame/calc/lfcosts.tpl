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
	<link type="text/css" href="/ogame/calc/css/costs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/costs.css'); ?>" rel="stylesheet"/>

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
<?php require_once('../../social.head.tpl'); ?>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>	
	<script type="text/javascript" src="/ogame/calc/js/lfcosts.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts.js'); ?>"></script>

	<script type="text/javascript">
		// десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
		options.decimalSeparator='<?= $l['decimal-separator'] ?>';
		options.datetimeW = '<?= $l['datetime-w'] ?>';
		options.datetimeD = '<?= $l['datetime-d'] ?>';
		options.datetimeH = '<?= $l['datetime-h'] ?>';
		options.datetimeM = '<?= $l['datetime-m'] ?>';
		options.datetimeS = '<?= $l['datetime-s'] ?>';
		options.unitSuffix = '<?= $l['unit-suffix'] ?>';
		options.scShort = '<?= $l['sc-short'] ?>';
		options.lcShort = '<?= $l['lc-short'] ?>';
		options.scFull = '<?= $l['small-cargo'] ?>';
		options.lcFull = '<?= $l['large-cargo'] ?>';
		options.warnindDivId = 'warning';
		options.warnindMsgDivId = 'warning-message';
		options.fieldHint = '<?= $l['field-hint'] ?>';
		options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
		options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';

		options.techCosts = {
							<?php $first = true; ?>
							<?php foreach ($techData as $id => $tech): ?>
							<?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>,
								<?= $tech[6] ?>, <?= $tech[7] ?>, <?= $tech[8] ?>, <?= $tech[9] ?>, <?= $tech[10] ?>, <?= $tech[11] ?>]
							<?php $first = false; ?>
							<?php endforeach; ?>
			};

	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="lfcosts">
	<div class="ui-widget-content ui-corner-all">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<div id="general-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="robot-factory-level"><?= $l['robot-factory'] ?></label></td>
							<td><input id="robot-factory-level" type="text" name="robot-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="nanite-factory-level"><?= $l['nanite-factory'] ?></label></td>
							<td><input id="nanite-factory-level" type="text" name="nanite-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
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
						<tr>
							<td><label for="ion-tech-level"><?= $l['ion-tech'] ?></label></td>
							<td><input id="ion-tech-level" type="text" name="ion-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label></td>
							<td><input id="hyper-tech-level" type="text" name="hyper-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td conspan="2"><input id="full-numbers" type="checkbox" name="full-numbers" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="full-numbers"><?= $l['full-numbers'] ?></label></td>
						</tr>
						<tr>
							<td colspan="4">
								<table cellpadding="2" cellspacing="0" border="0" align="center">
									<tr>
										<td><label><?= $l['class'] ?>:</label></td>
										<td><input id="class-0" type="radio" name="class" value="0" tabindex="1"/><label for="class-0"><?= $l['class-collector'] ?></label></td>
										<td><input id="class-1" type="radio" name="class" value="1" tabindex="2"/><label for="class-1"><?= $l['class-general'] ?></label></td>
										<td><input id="class-2" type="radio" name="class" value="2" tabindex="3"/><label for="class-2"><?= $l['class-discoverer'] ?></label></td>
									</tr>
								</table>
							</td>
							<td colspan="2">
								<table cellpadding="2" cellspacing="0" border="0" align="center">
									<tr>
										<td><label for="race-selector"><?= $l['race'] ?></label></td>
										<td>
											<select id="race-selector" name="race-selector" class="ui-state-default ui-corner-all ui-input ui-input-margin">
											<?php for ($r = 1; $r <= 4; $r++):?>
												<option value="<?=$r?>" <?php if ($r == 1):?>selected="selected"<?php endif; ?>><?= $l['race-'.$r] ?>
												</option>
											<?php endfor; ?>
											</select>
										</td>
									</tr>
								</table>
							</td>							
						</tr>
						</table>
						<table cellpadding="2" cellspacing="0" border="0" align="center">
							<tr>
								<td><label id="lbl-megalith-level" for="megalith-level"><?= $l['megalith'] ?></label></td>
								<td><input id="megalith-level" type="text" name="megalith-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
								<td><label id="lbl-mrc-level" for="mrc-level"><?= $l['mineral-res-centre'] ?></label></td>
								<td><input id="mrc-level" type="text" name="mrc-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
								<td><?= $l['cargo-cap-increase'] ?></td>
								<td><label for="sc-capacity-increase"><?= $l['sc-short'] ?></label></td>
								<td><input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="ui-state-default ui-corner-all ui-input fleet-input ui-input-margin" value="0" /></td>
								<td><label for="lc-capacity-increase"><?= $l['lc-short'] ?></label></td>
								<td><input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="ui-state-default ui-corner-all ui-input fleet-input ui-input-margin" value="0" /></td>
							</tr>
						</table>
						<table cellpadding="2" cellspacing="0" border="0" align="center">
							<tr>
								<td><label for="research-cost-reduction"><?= $l['research-cost-reduction'] ?></label></td>
								<td><input id="research-cost-reduction" type="text" name="research-cost-reduction" class="ui-state-default ui-corner-all ui-input fleet-input ui-input-margin" value="0" /></td>
								<td><span class="ui-icon ui-icon-help" title="<?= $l['times-hint'] ?>"></span></td>
								<td><label for="research-time-reduction"><?= $l['research-time-reduction'] ?></label></td>
								<td><input id="research-time-reduction" type="text" name="research-time-reduction" class="ui-state-default ui-corner-all ui-input fleet-input ui-input-margin" value="0" /></td>
								<td><span class="ui-icon ui-icon-help" title="<?= $l['times-hint'] ?>"></span></td>
							</tr>
						</table>
				</div>
			</div>
			<div id="tabs">
				<ul>
				<?php for ($i = 0; $i < count($tabTitles); $i++):?>
					<li><a id="tabtag-<?=$i?>" href="#tab-<?=$i?>"><?= $l[$tabTitles[$i]] ?></a></li>
				<?php endfor; ?>
				</ul>
				<?php for ($i = 0; $i < count($tabTitles); $i++):?>
					<div id="tab-<?=$i?>" class="ui-panel no-mp">
					<?php if ($i < 2):?>
						<div id="tabs-<?=$i?>" class="no-mp">
							<ul>
							<?php $colHeaders = ($i == 0)?$colHeadersAllOne:$colHeadersAllMult; ?>
							<?php foreach ($techTypes as $j => $type) :?>
								<li><a id="tabtag-<?=$i?>-<?=$j?>" href="#tab-<?=$i?>-<?=$j?>"><?= $l[$type] ?></a></li>
							<?php endforeach; ?>
							</ul>
							<?php foreach ($techTypes as $j => $type):?>
							<?php
								if ($j == 2)
									$colHeaders[0] = 'research';
								else
									$colHeaders[0] = 'building';
							?>
							<div id="tab-<?=$i?>-<?=$j?>" class="ui-panel no-mp">
								<table id="table-<?=$i?>-<?=$j?>" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
									<tr>
										<th style="display: none;"></th>
										<?php foreach ($colHeaders as $idx => $header) :?>
										<th <?=($idx > 0)?'align="center"':''?>>
											<?php if ($header == 'dm-abbr'): ?>
												<abbr title="<?= $l['dm-explanation'] ?>"><?=$l[$header] ?></abbr>
											<?php else: ?>
												<?=$l[$header] ?>
											<?php endif; ?>
										</th>
										<?php endforeach; ?>
									</tr>
									<?php $techs = getTechsByType($j); $row = 1; $race = 0; $prevRace = 0;?>
									<?php foreach ($techs as $tech) :?>
										<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
											<td style="display: none;"><?=$tech?></td>
											<td class="min"><?=$l[$techData[$tech][0]]?></td>
											<?php if ($i == 1): ?>
											<td align="center"><input type="text" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
											<?php endif;?>
											<td align="center"><input type="text" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
											<td align="center">0</td>
											<td align="center">0</td>
											<td align="center">0</td>
											<td align="center">0</td>
											<td align="center">0<?=$l['datetime-s']?></td>
											<td align="center">0</td>
											<?php if ($i == 0):?>
												<td align="center">0</td>
											<?php endif; ?>
										</tr>
									<?php endforeach; ?>
									<tr>
										<td style="display: none;">t</td>
										<td colspan="<?= ($i == 1)?'2':'1' ?>" class="border-n" ><?=$l['total']?></td>
										<td align="center" class="border-n" >0</td>
										<td align="center" class="border-n border-s border-w" ><b>0</b></td>
										<td align="center" class="border-n border-s" ><b>0</b></td>
										<td align="center" class="border-n border-s" ><b>0</b></td>
										<td align="center" class="border-n border-s" ><b>0</b></td>
										<td align="center" class="border-n border-s" ><b>0</b></td>
										<?php if ($i == 0):?>
										<td align="center" class="border-n border-s" ><b>0</b></td>
										<?php endif; ?>
										<td align="center" class="border-n border-s border-e" ><b>0</b></td>
									</tr>
									<tr><td colspan="<?= ($i == 1)?'10':'9' ?>" height=5px;>&nbsp;</td></tr>
									<tr>
										<td style="display: none;">gt</td>
										<td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-n border-w" ><?=$l['grand-total']?></td>
										<td align="center" class="border-n" >0</td>
										<td align="center" class="border-n" >0</td>
										<td align="center" class="border-n" >0</td>
										<td align="center" class="border-n" >0</td>
										<td align="center" class="border-n" >0</td>
										<?php if ($i == 0):?>
										<td align="center" class="border-n" ><b>0</b></td>
										<?php endif; ?>
										<td align="center" class="border-n border-e" >0</td>
									</tr>
									<tr>
										<td style="display: none;">ra</td>
										<td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?= $l['res-available'] ?></td>
										<td align="center"><input id="metal-available-<?=$i?>-<?=$j?>" type="text" name="metal-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
										<td align="center"><input id="crystal-available-<?=$i?>-<?=$j?>" type="text" name="crystal-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
										<td align="center"><input id="deut-available-<?=$i?>-<?=$j?>" type="text" name="deut-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
										<td></td>
										<td></td>
										<?php if ($i == 0):?>
										<td></td>
										<?php endif; ?>
										<td class="border-e"></td>
									</tr>
									<tr>
										<td style="display: none;">dlv</td>
										<td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?= $l['res-needed'] ?></td>
										<td align="center" >0</td>
										<td align="center" >0</td>
										<td align="center" >0</td>
										<td></td>
										<td></td>
										<?php if ($i == 0):?>
										<td></td>
										<?php endif; ?>
										<td class="border-e"></td>
									</tr>
									<tr>
										<td style="display: none;">gtt</td>
										<td class="border-s border-w" ><?=$l['transports-needed']?></td>
										<td align="center" class="border-s" >0 <?=$l['sc-short']?></td>
										<td align="center" class="border-s" >0 <?=$l['lc-short']?></td>
										<td colspan="<?= ($i == 1)?'5':(($i == 0)?'5':'4') ?>" align="center" class="border-s" >&nbsp;</td>
										<td align="center" class="border-s border-e" >&nbsp;</td>
									</tr>
								</table>
							</div>
							<?php endforeach; ?>
						</div>
					<?php else: ?>
						<div>
							<table cellpadding="0" cellspacing="1" border="0" >
								<tr>
									<td colspan="4">
									<select id="tech-types-select" name="tech-types-select" class="ui-state-default ui-corner-all ui-input">
									<?php	$techTypes = array(1 => 'buildings', 2 => 'researches'); ?>
									<?php foreach ($techTypes as $type => $typeName) :?>
										<optgroup label="<?=$l[$typeName]?>">
										<?php $techs = getTechsByType($type);?>
										<?php foreach ($techs as $tech) :?>
											<option value="<?=$tech?>" <?= ($tech==1)?'selected="selected"':'' ?>><?=$l[$techData[$tech][0]]?></option>
										<?php endforeach; ?>
										</optgroup>
									<?php endforeach; ?>
										</select>
									</td>
									<td><label for="tab2-from-level">&nbsp;<?= $l['from-level'] ?></label></td>
									<td><input id="tab2-from-level" type="text" name="tab2-from-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
									<td><label for="tab2-to-level"><?= $l['to-level'] ?></label></td>
									<td><input id="tab2-to-level" type="text" name="tab2-to-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
								</tr>
							</table>
						</div>
						<div id="commons-table-div">
							<table id="commons-table" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
								<?php foreach ($colHeadersOneCommon as $colName): ?>
									<th><?=$l[$colName]?></th>
								<?php endforeach; ?>
								</tr>
								<tr>
									<td colspan="7">&nbsp;</td>
								</tr>
								<tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
									<td class="border-n border-w" ><?=$l['total']?></td>
									<td align="center" class="border-n" ><b>0</b></td>
									<td align="center" class="border-n" ><b>0</b></td>
									<td align="center" class="border-n" ><b>0</b></td>
									<td align="center" class="border-n" ><b>0</b></td>
									<td align="center" class="border-n" ><b>0</b></td>
									<td align="center" class="border-n border-e" ><b>0</b></td>
								</tr>
								<tr>
									<td class="border-w"><?= $l['res-available'] ?></td>
									<td align="center"><input id="metal-available-2-1" type="text" name="metal-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
									<td align="center"><input id="crystal-available-2-1" type="text" name="crystal-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
									<td align="center"><input id="deut-available-2-1" type="text" name="deut-available" class="ui-state-default ui-corner-all ui-input res-input " value="0" /></td>
									<td></td>
									<td></td>
									<td class="border-e"></td>
								</tr>
								<tr>
									<td class="border-w"><?= $l['res-needed'] ?></td>
									<td align="center" >0</td>
									<td align="center" >0</td>
									<td align="center" >0</td>
									<td></td>
									<td></td>
									<td class="border-e"></td>
								</tr>
								<tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
									<td class="border-s border-w" ><?=$l['transports-needed']?></td>
									<td align="center" class="border-s" >0 <?=$l['sc-short']?></td>
									<td align="center" class="border-s">0 <?=$l['lc-short']?></td>
									<td colspan="4" class="border-s border-e"></td>
								</tr>
							</table>
						</div>
					<?php endif;?>
					</div>
				<?php endfor; ?>
			</div>
		</div>
	</div>
	<div id="warning" class="ui-state-highlight ui-corner-all">
		<div id="warning-message"></div>
	</div>
	<div id="hint" class="ui-corner-all">
		<table >
			<tr>
				<td valign="top">
					<span class="ui-icon ui-icon-info"></span>
				</td>
				<td>
					<span id= "hint-message"><?= $l['times-note'] ?></span>
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
