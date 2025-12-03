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
	<link type="text/css" href="/ogame/calc/css/trade.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/trade.css'); ?>" rel="stylesheet"/>
		
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
	<script type="text/javascript" src="/ogame/calc/js/trade.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/trade.js'); ?>"></script>

	<script type="text/javascript">
		l.sc = '<?= $l['sc-short'] ?>';
		l.lc = '<?= $l['lc-short'] ?>';
		l.metal = '<?= $l['metal'] ?>';
		l.crystal = '<?= $l['crystal'] ?>';
		l.deuterium = '<?= $l['deuterium'] ?>';
		l.met = '<?= $l['met'] ?>';
		l.crys = '<?= $l['crys'] ?>';
		l.deut = '<?= $l['deut'] ?>';
		l.src = '<?= $l['src'] ?>';
		l.dst = '<?= $l['dst'] ?>';
		l.fix = '<?= $l['fix'] ?>';
		l.and = '<?= $l['and'] ?>';
		l.coords = '<?= $l['coords'] ?>';
		l.rates = '<?= $l['rates'] ?>';
		l.moonstr = '<?= $l['moon'] ?>';

		unis = {
<?php
	$f1 = true;
	foreach ($universes as $ul => $uc) {
		echo ($f1 ? '' : ",\n").$ul.': [';
		$f2 = true;
		foreach ($uc as $row) {
			preg_match('/s(\d+)-/', $row['server'], $pe);
			echo ($f2 ? '' : ',')."[{$pe[1]}, '{$row['server']}','{$row['name']}']";
			$f2 = false;
		}
		echo ']';
		$f1 = false;
	}
?>
		};
	</script>
<?php require_once('../../cookies.tpl'); ?>
</head>
<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0"><tr>
<td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
<td id="vtablec">
<?php require_once('../../topbar.tpl'); ?>

<div id="trade">
	<div class="ui-widget-content ui-corner-all">
		<div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
		<div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['title'] ?></div>
		<div id="tech-settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
			<p class="ui-state-default ui-corner-all ui-subheader"><?= $l['parameters'] ?></p>
			<div id="tech-settings">
				<table cellpadding="2" cellspacing="0" border="0" align="center">
					<tr>
						<td><label for="hypertech-lvl"><?= $l['hyper-tech'] ?></label></td>
						<td><input id="hypertech-lvl" type="text" name="hypertech-lvl" class="ui-state-default ui-corner-all ui-input rate-input ui-input-margin trade-editable" value="0"/></td>
					</tr>
				</table>
			</div>
		</div>
		<div id="main">
		<table id="tmain" cellpadding="0" border="0" cellspacing="0">
			<tr>
				<td class="res-panel">
					<!-- [[ настройки источника ресурсов -->
					<div id="res-src-panel" class="ui-widget-content ui-corner-all ui-panel">
						<p class="ui-state-default ui-corner-all ui-subheader"><?= $l['src'] ?></p>
						<table cellpadding="2" cellspacing="0" border="0">
							<tr>
								<td colspan="2">
									<div id="res-src">
										<div class="res-type"><input id="res-src-0" type="radio" name="src" value="0" tabindex="1"/><label for="res-src-0"><?= $l['metal'] ?></label></div>
										<div class="res-type"><input id="res-src-1" type="radio" name="src" value="1" tabindex="2"/><label for="res-src-1"><?= $l['crystal'] ?></label></div>
										<div class="res-type"><input id="res-src-2" type="radio" name="src" value="2" tabindex="3"/><label for="res-src-2"><?= $l['deuterium'] ?></label></div>
										<div class="res-type"><input id="res-src-3" type="radio" name="src" value="3" tabindex="4"/><label for="res-src-3"><?= $l['metal'] ?> + <?= $l['crystal'] ?></label></div>
										<div class="res-type"><input id="res-src-4" type="radio" name="src" value="4" tabindex="5"/><label for="res-src-4"><?= $l['metal'] ?> + <?= $l['deuterium'] ?></label></div>
										<div class="res-type"><input id="res-src-5" type="radio" name="src" value="5" tabindex="6"/><label for="res-src-5"><?= $l['crystal'] ?> + <?= $l['deuterium'] ?></label></div>
									</div>
								</td>
							</tr>
							<tr><td colspan="2"><div class="hr"></div></td></tr>
							<tr>
								<td class="res-src-m" align="right"><?= $l['metal'] ?>:</td>
								<td><input id="res-src-m" type="text" name="res-src-m" class="ui-state-default ui-corner-all ui-input res-src-m ui-input-margin res-input trade-editable" tabindex="7"/></td>
							</tr>
							<tr>
								<td class="res-src-c" align="right"><?= $l['crystal'] ?>:</td>
								<td><input id="res-src-c" type="text" name="res-src-c" class="ui-state-default ui-corner-all ui-input res-src-c ui-input-margin res-input trade-editable" tabindex="8"/></td>
							</tr>
							<tr>
								<td class="res-src-d" align="right"><?= $l['deuterium'] ?>:</td>
								<td><input id="res-src-d" type="text" name="res-src-d" class="ui-state-default ui-corner-all ui-input res-src-d ui-input-margin res-input trade-editable" tabindex="9"/></td>
							</tr>
							<tr><td colspan="2"><div class="hr"></div></td></tr>
							<tr>
								<td align="right"><?= $l['cargoes'] ?>:</td>
								<td><div id="res-src-cargo" class="ui-state-default ui-corner-all ui-input ui-input-margin res-input"></div></td>
							</tr>
						</table>
					</div>
					<!-- ]] настройки источника ресурсов -->
				</td>

				<td align="center"><img id="big-arrow" alt=""></td>

				<td class="res-panel">
					<!-- [[ настройки получателя ресурсов -->
					<div id="res-dst-panel" class="ui-widget-content ui-corner-all ui-panel">
						<p class="ui-state-default ui-corner-all ui-subheader"><?= $l['dst'] ?></p>
						<table cellpadding="2" cellspacing="0" border="0">
							<tr>
								<td colspan="2">
									<div id="res-dst">
										<div class="res-type" id="res-type-dst-0"><input id="res-dst-0" type="radio" name="dst" value="0" tabindex="10"/><label for="res-dst-0" id="res-type-dst-lbl-0"></label></div>
										<div id="dst-block">
											<div class="res-type" id="res-type-dst-1"><input id="res-dst-1" type="radio" name="dst" value="1" tabindex="11"/><label for="res-dst-1" id="res-type-dst-lbl-1"></label></div>
											<div class="hrs"></div>
											<div class="res-type" id="res-type-dst-2"><input id="res-dst-2" type="radio" name="dst" value="2" tabindex="12"/><label for="res-dst-2" id="res-type-dst-lbl-2"></label></div>
											<div id="dst-mix-block">
												<div class="res-subtype" id="res-subtype-dst-0">
													<input id="res-dst-mix-0" type="radio" name="sub-dst" value="0">
													<input id="mix-balance-proc" type="text" name="mix-balance-proc" class="ui-state-default ui-corner-all ui-input rate-input trade-editable" tabindex="13"/> % <span id="mix-lbl"></span>
													<div id="mix-balance" class="res-mix-balance"></div>
												</div>
												<div class="res-subtype" id="res-subtype-dst-1">
													<input id="res-dst-mix-1" type="radio" name="sub-dst" value="1">
													<input id="mix-balance-prop1" type="text" name="mix-balance-prop1" class="ui-state-default ui-corner-all ui-input rate-input trade-editable" tabindex="14"/> /
													<input id="mix-balance-prop2" type="text" name="mix-balance-prop2" class="ui-state-default ui-corner-all ui-input rate-input trade-editable" tabindex="15"/>
													<span id="mix-prop-lbl"></span>
												</div>
												<div class="res-subtype" id="res-subtype-dst-2">
													<input id="res-dst-mix-2" type="radio" name="sub-dst" value="2">
													<input id="mix-fix1" type="text" name="mix-fix1" class="ui-state-default ui-corner-all ui-input trade-editable" tabindex="16"/>
													<span id="mix-fix1-lbl"></span>
												</div>
												<div class="res-subtype" id="res-subtype-dst-3">
													<input id="res-dst-mix-3" type="radio" name="sub-dst" value="3">
													<input id="mix-fix2" type="text" name="mix-fix2" class="ui-state-default ui-corner-all ui-input trade-editable" tabindex="17"/>
													<span id="mix-fix2-lbl"></span>
												</div>
											</div>
										</div>
									</div>
								</td>
							</tr>
							<tr><td colspan="2"><div class="hr"></div></td></tr>
							<tr>
								<td class="res-dst-m" align="right"><?= $l['metal'] ?>:</td>
								<td><div id="res-dst-m" class="ui-state-default ui-corner-all ui-input res-dst-m ui-input-margin res-input">0</div></td>
							</tr>
							<tr>
								<td class="res-dst-c" align="right"><?= $l['crystal'] ?>:</td>
								<td><div id="res-dst-c" class="ui-state-default ui-corner-all ui-input res-dst-c ui-input-margin res-input">0</div></td>
							</tr>
							<tr>
								<td class="res-dst-d" align="right"><?= $l['deuterium'] ?>:</td>
								<td><div id="res-dst-d" class="ui-state-default ui-corner-all ui-input res-dst-d ui-input-margin res-input">0</div></td>
							</tr>
							<tr><td colspan="2"><div class="hr"></div></td></tr>
							<tr>
								<td align="right"><?= $l['cargoes'] ?>:</td>
								<td><div id="res-dst-cargo" class="ui-state-default ui-corner-all ui-input ui-input-margin res-input"></div></td>
							</tr>
						</table>
					</div>
					<!-- ]] настройки получателя ресурсов -->
				</td>
			</tr>
		</table>
		</div>

		<div class="ui-widget-content ui-corner-all ui-panel c-ui-widget-content">
		<p class="ui-state-default ui-corner-all ui-subheader"><?= $l['rates'] ?></p>
		<table id="trate" cellpadding="4" border="0" cellspacing="0">
			<tr>
				<td class="tdr"><?= $l['metal'] ?> : <?= $l['deuterium'] ?></td>
				<td><input id="rate-md" type="text" name="rate-md" class="trade-editable ui-state-default ui-corner-all ui-input rate-input" tabindex="18"></td>
				<td style="width:20px"></td>
				<td style="width: 100%">
					<table style="width: 100%" cellpadding="4">
						<tr>
							<td id="rate-md-min"></td>
							<td style="width: 100%">
								<div id="md-slider"></div>
							</td>
							<td id="rate-md-max"></td>
						</tr>
					</table>
				</td>
				<td id="rb1" class="rbutton"><button id="rate-btn-1">4 : 2 : 1</button></td>
				<td id="rb4" class="rbutton"><button id="rate-btn-4">2.5 : 1.5 : 1</button></td>
			</tr>
			<tr>
				<td class="tdr"><?= $l['crystal'] ?> : <?= $l['deuterium'] ?></td>
				<td><input id="rate-cd" type="text" name="rate-cd" class="trade-editable ui-state-default ui-corner-all ui-input rate-input" tabindex="19"/></td>
				<td style="width:20px"></td>
				<td>
					<table style="width: 100%" cellpadding="4">
						<tr>
							<td id="rate-cd-min"></td>
							<td style="width: 100%">
								<div id="cd-slider"></div>
							</td>
							<td id="rate-cd-max"></td>
						</tr>
					</table>
				</td>
				<td id="rb2" class="rbutton"><button id="rate-btn-2">3 : 2 : 1</button></td>
				<td id="rb5" class="rbutton"><button id="rate-btn-5">2 : 1.5 : 1</button></td>
			</tr>
			<tr>
				<td class="tdr"><?= $l['metal'] ?> : <?= $l['crystal'] ?></td>
				<td><div id="rate-mc" class="ui-state-default ui-corner-all ui-input rate-input"></div></td>
				<td style="width:20px"></td>
				<td>
					<table style="width: 100%" cellpadding="4">
						<tr>
							<td id="rate-mc-min"></td>
							<td style="width: 100%">
								<div id="mc-slider" class="ui-state-disabled"></div>
							</td>
							<td id="rate-mc-max"></td>
						</tr>
					</table>
				</td>
				<td id="rb3" class="rbutton"><button id="rate-btn-3">3 : 1.5 : 1</button></td>
				<td id="rb6" class="rbutton"><button id="rate-btn-6">2.4 : 1.5 : 1</button></td>
			</tr>
		</table>
		</div>

		<div class="ui-widget-content ui-corner-all ui-panel c-ui-widget-content">
		<p class="ui-state-default ui-corner-all ui-subheader"><?= $l['location'] ?></p>
		<table id="tlocation" cellpadding="4" border="0" cellspacing="0">
			<tr>
				<td class="tdr" width="200"><?= $l['country'] ?>:</td>
				<td>
					<select id="country" class="ui-state-default ui-corner-all ui-input ui-input-margin" tabindex="21">
					<?php if ($countries): ?>
					<?php foreach ($countries as $row): ?>
						<option value="<?= $row['lang'] ?>"><?= $row['name'].' ('.$row['server'].')' ?></option>
					<?php endforeach; ?>
					<?php endif; ?>
					</select>
				</td>
			</tr>
			<tr>
				<td class="tdr"><?= $l['universe'] ?>:</td>
				<td><select id="universe" class="ui-state-default ui-corner-all ui-input ui-input-margin" tabindex="22"></select></td>
			</tr>
			<tr>
				<td class="tdr"><?= $l['coords'] ?>:</td>
				<td>
					<input id="coord-g" type="text" class="ui-state-default ui-corner-all ui-input rate-input ui-input-margin" tabindex="23"/>:<input id="coord-s" type="text" class="ui-state-default ui-corner-all ui-input rate-input" tabindex="24"/>:<input id="coord-p" type="text" class="ui-state-default ui-corner-all ui-input rate-input" tabindex="25"/>
					&nbsp;
					<input id="moon" type="checkbox" name="moon" class="ui-state-default ui-corner-all ui-input ui-input-margin"/>&nbsp;<label for="moon"><?= $l['moon'] ?></label>
				</td>
			</tr>
		</table>
		</div>
	</div>

</div>

<div id="link">
<?= $l['link'] ?>:<br><a id="alink" href="#"></a>
</div>
<div id="text">
<?= $l['text'] ?>:<br><span id="atext"></span>
</div>
<div id="bbcode">
BB-Code:<br><textarea id="abbcode" class="ui-widget-content ui-corner-all" rows="2"></textarea>
</div>


</td>
</tr></table>
<?php
	require_once('../../analitics.tpl');
?>

</body>
</html>
