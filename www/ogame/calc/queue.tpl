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
	<link type="text/css" href="/ogame/calc/css/queue.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/queue.css'); ?>" rel="stylesheet"/>
	
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
	<script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>	
	<script type="text/javascript" src="/ogame/calc/js/queue.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/queue.js'); ?>"></script>

	<script type="text/javascript">
		$(function() {
			$("#start-2").inputmask("<?= $l['datetime-format'] ?>");
			$("#start-3").inputmask("<?= $l['datetime-format'] ?>");
		});

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
		options.datetimeFormat = '<?= $l['datetime-format'] ?>';


		options.techCosts = {
							<?php $first = true; ?>
							<?php foreach ($techData as $id => $tech): ?>
							<?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>]
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

<div id="queue">
	<div class="ui-widget-content ui-corner-all">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div>
			<div id="general-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
				<div id="general-settings">
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
							<td><label for="ion-tech-level"><?= $l['ion-tech'] ?></label></td>
							<td><input id="ion-tech-level" type="text" name="ion-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
							<td><label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label></td>
							<td><input id="hyper-tech-level" type="text" name="hyper-tech-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" /></td>
						</tr>
					</table>
				</div>
			</div>
			<div id="tabs">
				<ul>
					<li><a id="tabtag-2" href="#tab-2"><?= $l['planet'] ?></a></li>
					<li><a id="tabtag-3" href="#tab-3"><?= $l['moon'] ?></a></li>
				</ul>
				<?php foreach ($techTypes as $i => $type):?>
				<div id="tab-<?=$i?>">
					<table id="wrapper-<?=$i?>" cellpadding="0" border="0" cellspacing="0" width="100%">
						<tr>
							<td valign="top">
								<div id="src-panel" class="ui-widget-content ui-corner-all ui-panel">
									<p class="ui-state-default ui-corner-all ui-subheader"><b><?= $l['buildings'] ?></b></p>
									<table align="center" cellpadding="0" cellspacing="1" border="0" >
										<tr>
											<td><?= $l['total-fields'] ?></td>
											<td><input id="total-fields-<?=$i?>" type="text" name="total-fields-<?=$i?>" class="ui-state-default ui-corner-all ui-input level-input total-fld-input" value="0" /></td>
										</tr>
									</table>
									<table id="table-src-<?=$i?>" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
										<tr>
											<th style="display: none;">ID</th>
											<?php foreach ($colHeadersSrc as $idx => $header) :?>
											<th <?=($idx > 0)?'align="center"':''?>><?=$l[$header] ?></th>
											<?php endforeach; ?>
										</tr>
										<?php $techs = getTechsByType($i); $row = 1;?>
										<?php foreach ($techs as $tech) :?>
										<tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
				 							<td style="display: none;"><?=$tech?></td>
											<td><?=$l[$techData[$tech][0]]?></td>
											<td align="center"><input id="startlvl-<?=$i?>-<?= $tech ?>" type="text" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0"/></td>
											<td align="center">
												<span id="nextlvl-<?=$i?>-<?= $tech ?>">0</span>
												<div id="build-<?= $tech ?>" class="ui-state-default ui-corner-all button-build" title="<?= $l['build'] ?>" style="display:inline-block">
													<span style="margin: auto;" class="ui-icon ui-icon-arrowthick-1-e"></span>
												</div>
												<?php if ($tech != 33 && $tech != 36 && $tech != 41): ?>
												<div id="destroy-<?= $tech ?>" class="ui-state-default ui-corner-all button-destroy" title="<?= $l['destroy'] ?>" style="display:inline-block">
													<span style="margin: auto;" class="ui-icon ui-icon-arrowthick-1-w"></span>
												</div>
												<?php endif; ?>
											</td>
										</tr>
										<?php endforeach; ?>
									</table>
								</div>
							</td>
							<td style="width: 5px;"></td>
							<td valign="top">
								<div id="dst-panel" class="ui-widget-content ui-corner-all ui-panel">
									<div id="clear-<?=$i?>" title="<?= $l['clear'] ?>"><span class="ui-icon ui-icon-trash"></span></div>
									<p class="ui-state-default ui-corner-all ui-subheader"><b><?=$l['queue']?></b></p>
									<table id="times-<?=$i?>" align="center"  cellpadding="0" cellspacing="0" border="0">
										<tr>
											<td><label for="start-<?=$i?>"><?= $l['start-time'] ?></label></td>
											<td><input type="text" id="start-<?=$i?>" class="ui-state-default ui-corner-all ui-input startdate-input"  title="<?= $l['datetime-format-hint'] ?>"/></td>
											<td>
												<div id="set-start-now-<?=$i?>" class="ui-state-default ui-corner-all" style="cursor: pointer; " title="<?= $l['start-now-hint'] ?>">
													<span style="font-size: xx-small; "><?= $l['start-now'] ?></span>
												</div>
											</td>
											<td >
												<label style="margin-left: 10px;"><?= $l['finish-time'] ?></label>
											</td>
											<td>
												<div id="finish-moment-<?=$i?>" class="ui-state-default ui-corner-all ui-input startdate-input">?</div>
											</td>
										</tr>
									</table>
									<table id="table-dst-<?=$i?>" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
										<tr>
											<?php foreach ($colHeadersDst as $idx => $header) :?>
											<th <?=($idx > 0)?'align="center"':''?>><?= $header == '-' ? '' : $l[$header] ?></th>
											<?php endforeach; ?>
										</tr>
										<tr class="even">
											<td class="border-n" ><?=$l['total']?></td>
											<td align="center" class="border-n" >0</td>
											<td align="center" class="border-n border-s border-w" ><b>0</b></td>
											<td align="center" class="border-n border-s" ><b>0</b></td>
											<td align="center" class="border-n border-s" ><b>0</b></td>
											<td align="center" class="border-n border-s border-e" ><b>0</b></td>
											<td></td>
										</tr>
										<tr class="even">
											<td ><?=$l['transports-needed']?></td>
											<td colspan="2" align="center" >0 <?=$l['sc-short']?></td>
											<td colspan="2" align="center" >0 <?=$l['lc-short']?></td>
											<td colspan="3" ></td>
										</tr>
									</table>
								</div>
							</td>
						</tr>
					</table>
				</div>
				<?php endforeach; ?>
			</div>
		</div>
	</div>
</div>

</td>
</tr></table>
<?php
	require_once('../../analitics.tpl');
?>

</body>
</html>
