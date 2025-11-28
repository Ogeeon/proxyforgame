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
	<script type="text/javascript" src="/js/jquery.ui.spinbtn.js"></script>
<?php require_once('../../social.head.tpl'); ?>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
	<script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>	
	<script type="text/javascript" src="/ogame/calc/js/costs.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/costs.js'); ?>"></script>

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
		options.planetNumStr = '<?= $l['planet-num'] ?>';
		options.doneTitle = '<?= $l['done'] ?>';
		options.cancelTitle = '<?= $l['cancel'] ?>';
		options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
		options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
		options.msgCantResearch = '<?= $l['msg-cant-research'] ?>';

		options.techCosts = {
							<?php $first = true; ?>
							<?php foreach ($techData as $id => $tech): ?>
							<?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>]
							<?php $first = false; ?>
							<?php endforeach; ?>
			};
		options.techReqs = {
				<?php $first = true; ?>
			 	<?php foreach ($techReqs as $id => $req): ?>
			 	<?=(!$first)?',':''?><?= $id ?>:<?= $req ?>
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

<div id="irn-calc" title="<?= $l['llc-dialog-title'] ?>">
	<div class="ui-widget-content ui-corner-all width: auto; ">
		<div>
			<table align="center">
				<tr>
					<td><?= $l['irn-level'] ?></td>
					<td><input id="irn-level" type="text" name="irn-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
					<td><?= $l['planets-count'] ?></td>
					<td>
					<input id="planetsSpin" type="text" class="ui-corner-all input-2columns spin-button" value="8" />
					</td>
				</tr>
			</table>
		</div>
		<div class="irn-calc-info">
			<?= $l['llc-dialog-info'] ?>
		</div>
		<div id="lab-levels-div">
			<table id="lab-levels-table" class="lined" width="100%;" cellpadding="0" cellspacing="1" border="0">
				<tr>
					<th><?= $l['planet'] ?></th><th><?= $l['level'] ?></th><th><?= $l['start'] ?></th>
				</tr>
				<?php for ($i = 1; $i <= 8; $i++): ?>
				<tr class="<?= ($i % 2) === 1 ? 'odd' : 'even' ?>">
					<td align="center"><?= $l['planet-num'] ?><?=$i?></td>
					<td align="center" width="20%;"><input type="text" id="lablevel_<?=$i?>" name="lablevel_<?=$i?>" class="ui-state-default ui-corner-all ui-input input-3columns input-in-table" value="0" /></td>
					<td align="center" width="20%;"><input type="radio" id="labchoice_<?=$i?>" name="start-pln" disabled="disabled"/></td>
				</tr>
				<?php endfor; ?>
			</table>
		</div>
		<div class="irn-calc-info">
			<span><?= $l['resulting-lab-level'] ?></span>&nbsp;<span id="resulting-level"><b>?</b></span>
		</div>
	</div>
</div>

<div id="costs">
	<div class="ui-widget-content ui-corner-all">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<div id="general-settings">
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label for="robot-factory-level"><?= $l['robot-factory'] ?> (<?= $l['planet'] ?>)</label></td>
							<td><input id="robot-factory-level" type="text" name="robot-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="nanite-factory-level"><?= $l['nanite-factory'] ?></label></td>
							<td><input id="nanite-factory-level" type="text" name="nanite-factory-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="shipyard-level"><?= $l['shipyard'] ?></label></td>
							<td><input id="shipyard-level" type="text" name="shipyard-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
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
							<td><label for="research-lab-level"><?= $l['research-lab'] ?></label></td>
							<td>
								<table cellpadding="0" cellspacing="0" border="0">
									<tr>
										<td>
										<input id="research-lab-level" type="text" name="research-lab-level" class="ui-state-default ui-corner-all ui-input level-input" value="0"/>
										</td>
										<td>
										<div id="open-llc-dialog" class="ui-state-default ui-corner-all" title="<?= $l['calculate'] ?>"><span class="ui-icon ui-icon-calculator"></span></div>
										</td>
									</tr>
								</table>
							</td>
							<td><input id="technocrat" type="checkbox" name="technocrat" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="technocrat"><?= $l['technocrat'] ?></label></td>
							<td></td>
							<td><label for="ion-tech-level"><?= $l['ion-tech'] ?></label></td>
							<td><input id="ion-tech-level" type="text" name="ion-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label></td>
							<td><input id="hyper-tech-level" type="text" name="hyper-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</tr>
						<tr>
							<td><label for="research-speed"><?= $l['research-speed'] ?></label></td>
							<td>
								<select id="research-speed" name="research-speed" class="ui-state-default ui-corner-all ui-input ui-input-margin">
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
									<option value="11">11</option>
									<option value="12">12</option>
									<option value="13">13</option>
									<option value="14">14</option>
									<option value="15">15</option>
									<option value="16">16</option>
									<option value="17">17</option>
									<option value="18">18</option>
									<option value="19">19</option>
									<option value="20">20</option>
								</select>
							</td>
							<td colspan="3"><input id="research-bonus" type="checkbox" name="research-bonus" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="research-bonus"><?= $l['research-event'] ?></label></td>
							<td></td>
							<td><label for="robot-factory-level-moon"><?= $l['robot-factory'] ?> (<?= $l['moon'] ?>)</label></td>
							<td><input id="robot-factory-level-moon" type="text" name="robot-factory-level-moon" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</tr>
					</table>
					<table cellpadding="2" cellspacing="0" border="0" align="center">
						<tr>
							<td><label><?= $l['class'] ?>:</label></td>
							<td><input id="class-0" type="radio" name="class" value="0" tabindex="1"/><label for="class-0"><?= $l['class-collector'] ?></label></td>
							<td><input id="class-1" type="radio" name="class" value="1" tabindex="2"/><label for="class-1"><?= $l['class-general'] ?></label></td>
							<td><input id="class-2" type="radio" name="class" value="2" tabindex="3"/><label for="class-2"><?= $l['class-discoverer'] ?></label></td>
							<td>&nbsp;</td>
							<td><input id="full-numbers" type="checkbox" name="full-numbers" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="full-numbers"><?= $l['full-numbers'] ?></label></td>
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
								if ($j == 4)
									$colHeaders[0] = 'research';
								else if ($j == 5)
									$colHeaders[0] = 'ship';
								else
									$colHeaders[0] = 'building';
								if ($i == 0) {
									if ($j == 5 || $j == 6) 
										$colHeaders[1] = 'quantity';
									else {
										$colHeaders[1] = 'level';
									}
								}
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
									<?php $techs = getTechsByType($j); $row = 1;?>
									<?php foreach ($techs as $tech) :?>
									<?php
										$techID = $j == 3 ? $tech + 10000 : $tech; // зданиям на луне присвоим id на 1000 больше, чтобы их можно было отличить при чтении id строк
									?>
									<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
										<td style="display: none;"><?=$techID?></td>
										<td><?=$l[$techData[$tech][0]]?></td>
										<?php if ($i == 1): ?>
										<td align="center"><input type="text" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
										<?php endif;?>
										<?php if ($j == 5 || $j == 6): ?>
											<td align="center"><input type="text" class="ui-state-default ui-corner-all ui-input fleet-input ui-input-margin" value="0"/></td>
										<?php else: ?>
											<td align="center"><input type="text" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
										<?php endif; ?>
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
										<td style="display: none;"></td>
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
									<tr>
										<td style="display: none;"></td>
										<td ><?=$l['transports-needed']?></td>
										<td align="center" >0 <?=$l['sc-short']?></td>
										<td align="center" >0 <?=$l['lc-short']?></td>
										<td colspan="<?= ($i == 1)?'6':(($i == 0)?'6':'5') ?>" ></td>
									</tr>
									<tr><td colspan="<?= ($i == 1)?'10':'9' ?>" height=5px;>&nbsp;</td></tr>
									<tr>
										<td style="display: none;"></td>
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
										<td style="display: none;"></td>
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
									<?php	$techTypes = array(2 => 'buildings-planet', 3 => 'buildings-moon', 4 => 'researches'); ?>
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
									<td><label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label></td>
									<td><input id="energy-tech-level" type="text" name="energy-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
									<td width="10px;">&nbsp;</td>
									<td><label for="plasma-tech-level"><?= $l['plasma-tech-level'] ?></label></td>
									<td><input id="plasma-tech-level" type="text" name="plasma-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
									<td width="10px;">&nbsp;</td>
									<td><input id="engineer" type="checkbox" name="engineer" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="engineer"><?= $l['engineer'] ?></label></td>
									<td width="10px;">&nbsp;</td>
									<td><input id="admiral" type="checkbox" name="admiral" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="admiral"><?= $l['admiral'] ?></label></td>
								</tr>
							</table>
							<table cellpadding="0" cellspacing="1" border="0" >
								<tr>
									<td><label for="tab2-from-level">&nbsp;<?= $l['from-level'] ?></label></td>
									<td><input id="tab2-from-level" type="text" name="tab2-from-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
									<td><label for="tab2-to-level"><?= $l['to-level'] ?></label></td>
									<td><input id="tab2-to-level" type="text" name="tab2-to-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
									<td><label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label></td>
									<td><input id="max-planet-temp" type="text" name="max-planet-temp" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" alt="<?= $l['max-planet-temp'] ?>"/></td>
									<td><label for="planet-pos"><?= $l['planet-pos'] ?></label></td>
									<td><input id="planet-pos" type="text" name="planet-pos" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" alt="<?= $l['planet-pos'] ?>"/></td>
									<td width="10px;">&nbsp;</td>
									<td><label for="booster"><?= $l['booster'] ?></label></td>
									<td align="center" >
										<select id="booster" name="booster" class="ui-state-default ui-corner-all ui-input input-in-table">
											<option value="0" selected="selected">0%</option>
											<option value="1">10%</option>
											<option value="2">20%</option>
											<option value="3">30%</option>
											<option value="4">40%</option>
										</select>
									</td>
									<td width="10px;">&nbsp;</td>
									<td><input id="geologist" type="checkbox" name="geologist" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="geologist"><?= $l['geologist'] ?></label></td>
									<td width="10px;">&nbsp;</td>
									<td><input id="commander" type="checkbox" name="commander" class="ui-state-default ui-corner-all ui-input ui-input-margin"/><label for="commander"><?= $l['commander'] ?></label></td>
								</tr>
							</table>
						</div>
						<div id="prods-table-div">
							<table id="prods-table" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
								<tr>
								<?php foreach ($colHeadersOneProd as $colName): ?>
									<th><?=$l[$colName]?></th>
								<?php endforeach; ?>
								</tr>
								<tr>
									<td colspan="9">&nbsp;</td>
								</tr>
								<tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="center" class="border-n" ><?=$l['total']?></td>
									<td align="center" class="border-n border-s border-w" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s border-e" ><b>0</b></td>
								</tr>
								<tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="center" ><?=$l['transports-needed-short']?></td>
									<td align="center" >0 <?=$l['sc-short']?></td>
									<td align="center" >0 <?=$l['lc-short']?></td>
									<td colspan="6" ></td>
								</tr>
							</table>
						</div>
						<div id="commons-table-div" style="display: none;">
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
									<td align="center" class="border-n" ><?=$l['total']?></td>
									<td align="center" class="border-n border-s border-w" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s" ><b>0</b></td>
									<td align="center" class="border-n border-s border-e" ><b>0</b></td>
								</tr>
								<tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
									<td align="center" ><?=$l['transports-needed-short']?></td>
									<td align="center" >0 <?=$l['sc-short']?></td>
									<td align="center" >0 <?=$l['lc-short']?></td>
									<td colspan="4" ></td>
								</tr>
							</table>
						</div>
					<?php endif;?>
					</div>
					<?php
						// на вкладке "все элементы - несколько уровней" не должно быть вкладок с кораблями и обороной
						unset($techTypes[5]);
						unset($techTypes[6]);
					?>
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
