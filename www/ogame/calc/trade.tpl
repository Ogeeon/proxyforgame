<!DOCTYPE html>
<head>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
	<meta http-equiv="Cache-Control" content="no-cache" />
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?= $l['title'] ?></title>
	<meta name="description" content="<?= $l['title'] ?>"/>
	<meta name="keywords" content="<?= $l['keywords'] ?>"/>
	<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
	<link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<?php 
	if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com') {
		$pfgPath = $_SERVER['DOCUMENT_ROOT']; 
	} else {
		$pfgPath ="D:\Programming\JS\pfg.wmp\www";
	};
?>
<link id="light-theme" type="text/css" href="/css/redmond/jquery.ui.all.css" rel="stylesheet"/>

	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-sRIl4kxILFvY47J16cr9ZwB07vP4J8+LH7qKQnuqkuIAvNWLzeN8tE5YBujZqJLB" crossorigin="anonymous">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
	<link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet" />
	<link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet"/>
	<link type="text/css" href="/ogame/calc/css/trade.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/trade.css'); ?>" rel="stylesheet"/>
	
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
		echo ($f1 ? '' :",\n").$ul.': [';
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
<body>

<div class="container-fluid">
	<div class="row">
		<div class="col-12">
			<?php require_once('../../topbar.tpl'); ?>

			<div id="trade" class="mx-auto" style="max-width: 680px;">
				<div class="border rounded position-relative">
					<div class="d-inline-block d-flex align-items-center">
						<div class="bg-primary text-white rounded main-header text-center flex-grow-1">
							<?= $l['title'] ?>
						</div>
						<div id="reset_bs" class="top-0 end-0 d-flex align-items-center justify-content-center" title="<?= $l['reset'] ?>">
							<i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
						</div>
					</div>

					<!-- Technology Settings Panel -->
					<div id="tech-settings-panel" class="border rounded bg-primary panel m-1">
						<p class="bg-light border rounded subheader bg-primary-subtle text-primary-medium"><?= $l['parameters'] ?></p>
						<div id="tech-settings">
							<div class="row align-items-center justify-content-center py-1">
								<div class="col-auto">
									<label for="hypertech-lvl"><?= $l['hyper-tech'] ?></label>
								</div>
								<div class="col-auto">
									<input id="hypertech-lvl" type="text" name="hypertech-lvl" class="form-control form-control-sm rate-input trade-editable" value="0"/>
								</div>
							</div>
						</div>
					</div>

					<!-- Main Resources Section -->
					<div id="main" class="ms-1 me-1">
						<div class="row g-2 row-tight">
							<!-- Source Resources Panel -->
							<div class="col-12 col-lg-6 d-flex flex-column">
								<div id="res-src-panel" class="border rounded bg-primary panel flex-grow-1">
									<p class="bg-light border rounded subheader bg-primary-subtle text-primary-medium mb-1"><?= $l['src'] ?></p>
									<div class="pe-2 pb-1">
										<div id="res-src" class="mb-2">
											<div class="res-type"><input id="res-src-0" type="radio" name="src" value="0" tabindex="1"/><label for="res-src-0"><?= $l['metal'] ?></label></div>
											<div class="res-type"><input id="res-src-1" type="radio" name="src" value="1" tabindex="2"/><label for="res-src-1"><?= $l['crystal'] ?></label></div>
											<div class="res-type"><input id="res-src-2" type="radio" name="src" value="2" tabindex="3"/><label for="res-src-2"><?= $l['deuterium'] ?></label></div>
											<div class="res-type"><input id="res-src-3" type="radio" name="src" value="3" tabindex="4"/><label for="res-src-3"><?= $l['metal'] ?> + <?= $l['crystal'] ?></label></div>
											<div class="res-type"><input id="res-src-4" type="radio" name="src" value="4" tabindex="5"/><label for="res-src-4"><?= $l['metal'] ?> + <?= $l['deuterium'] ?></label></div>
											<div class="res-type"><input id="res-src-5" type="radio" name="src" value="5" tabindex="6"/><label for="res-src-5"><?= $l['crystal'] ?> + <?= $l['deuterium'] ?></label></div>
										</div>
										<div class="hr mb-1"></div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-src-m"><?= $l['metal'] ?>:</div>
											<div class="col-7"><input id="res-src-m" type="text" name="res-src-m" class="form-control form-control-sm  res-src-m res-input trade-editable" tabindex="7"/></div>
										</div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-src-c"><?= $l['crystal'] ?>:</div>
											<div class="col-7"><input id="res-src-c" type="text" name="res-src-c" class="form-control form-control-sm res-src-c res-input trade-editable" tabindex="8"/></div>
										</div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-src-d"><?= $l['deuterium'] ?>:</div>
											<div class="col-7"><input id="res-src-d" type="text" name="res-src-d" class="form-control form-control-sm res-src-d res-input trade-editable" tabindex="9"/></div>
										</div>
										<div class="hr mb-1"></div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end"><?= $l['cargoes'] ?>:</div>
											<div class="col-7"><div id="res-src-cargo" class="border rounded bg-light res-input ps-1"></div></div>
										</div>
									</div>
								</div>
							</div>

							<!-- Arrow -->
							<div class="col-12 col-lg-auto arrow-col d-flex align-items-center justify-content-center py-1 py-lg-0 px-0">
								<i class="bi bi-caret-right-fill text-info-subtle" id="big-arrow"></i>
							</div>

							<!-- Destination Resources Panel -->
							<div class="col-12 col-lg d-flex flex-column">
								<div id="res-dst-panel" class="border rounded bg-primary panel flex-grow-1">
									<p class="bg-light border rounded subheader bg-primary-subtle text-primary-medium mb-1"><?= $l['dst'] ?></p>
									<div class="pe-2 pb-1">
										<div id="res-dst" class="mb-2">
											<div class="res-type" id="res-type-dst-0"><input id="res-dst-0" type="radio" name="dst" value="0" tabindex="10"/><label for="res-dst-0" id="res-type-dst-lbl-0"></label></div>
											<div id="dst-block">
												<div class="res-type" id="res-type-dst-1"><input id="res-dst-1" type="radio" name="dst" value="1" tabindex="11"/><label for="res-dst-1" id="res-type-dst-lbl-1"></label></div>
												<div class="hrs"></div>
												<div class="res-type" id="res-type-dst-2"><input id="res-dst-2" type="radio" name="dst" value="2" tabindex="12"/><label for="res-dst-2" id="res-type-dst-lbl-2"></label></div>
												<div id="dst-mix-block">
													<div class="res-subtype d-flex align-items-center gap-1" id="res-subtype-dst-0">
														<input id="res-dst-mix-0" type="radio" name="sub-dst" value="0">
														<input id="mix-balance-proc" type="text" name="mix-balance-proc" class="form-control form-control-sm rate-input trade-editable" tabindex="13" style="width: 50px;"/> 
														<span>%</span>
														<span id="mix-lbl"></span>
														<input id="mix-balance" type="range" class="range-slider form-range res-mix-balance flex-grow-1" />
													</div>
													<div class="res-subtype d-inline-block" id="res-subtype-dst-1">
														<input id="res-dst-mix-1" type="radio" name="sub-dst" value="1">
														<div class="d-inline-block">
															<input id="mix-balance-prop1" type="text" name="mix-balance-prop1" class="form-control form-control-sm rate-input trade-editable d-inline-block" tabindex="14" style="width: 50px;"/> /
															<input id="mix-balance-prop2" type="text" name="mix-balance-prop2" class="form-control form-control-sm rate-input trade-editable d-inline-block" tabindex="15" style="width: 50px;"/>
															<span id="mix-prop-lbl"></span>
														</div>
													</div>
													<div class="res-subtype d-inline-block" id="res-subtype-dst-2">
														<input id="res-dst-mix-2" type="radio" name="sub-dst" value="2">
														<input id="mix-fix1" type="text" name="mix-fix1" class="form-control form-control-sm trade-editable d-inline-block" tabindex="16" style="width: 150px;"/>
														<span id="mix-fix1-lbl"></span>
													</div>
													<div class="res-subtype d-inline-block" id="res-subtype-dst-3">
														<input id="res-dst-mix-3" type="radio" name="sub-dst" value="3">
														<input id="mix-fix2" type="text" name="mix-fix2" class="form-control form-control-sm trade-editable d-inline-block" tabindex="17" style="width: 150px;"/>
														<span id="mix-fix2-lbl"></span>
													</div>
												</div>
											</div>
										</div>
										<div class="hr mb-1"></div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-dst-m"><?= $l['metal'] ?>:</div>
											<div class="col-7"><div id="res-dst-m" class="border rounded bg-light res-dst-m res-input ps-1">0</div></div>
										</div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-dst-c"><?= $l['crystal'] ?>:</div>
											<div class="col-7"><div id="res-dst-c" class="border rounded bg-light res-dst-c res-input ps-1">0</div></div>
										</div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end res-dst-d"><?= $l['deuterium'] ?>:</div>
											<div class="col-7"><div id="res-dst-d" class="border rounded bg-light res-dst-d res-input ps-1">0</div></div>
										</div>
										<div class="hr mb-1"></div>
										<div class="row mb-1 align-items-center">
											<div class="col-5 text-end"><?= $l['cargoes'] ?>:</div>
											<div class="col-7"><div id="res-dst-cargo" class="border rounded bg-light res-input ps-1"></div></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Rates Panel -->
					<div class="border rounded bg-primary panel me-1 ms-1">
						<p class="bg-light border rounded subheader bg-primary-subtle text-primary-medium mb-1 px-2"><?= $l['rates'] ?></p>
						<div class="px-2 py-1">
							<!-- Metal:Deuterium Rate -->
							<div class="rate-row mb-2">
								<div class="rate-label"><?= $l['metal'] ?> : <?= $l['deuterium'] ?></div>
								<div class="rate-input-group">
									<input id="rate-md" type="text" name="rate-md" class="form-control form-control-sm trade-editable rate-input" tabindex="18">
								</div>
								<div class="rate-slider-group">
									<span id="rate-md-min"></span>
									<input id="md-slider" type="range" class="range-slider form-range" />
									<span id="rate-md-max"></span>
								</div>
								<div class="rate-buttons">
									<button id="rate-btn-1" class="btn btn-sm btn-primary">4 : 2 : 1</button>
									<button id="rate-btn-4" class="btn btn-sm btn-primary">2.5 : 1.5 : 1</button>
								</div>
							</div>

							<!-- Crystal:Deuterium Rate -->
							<div class="rate-row mb-2">
								<div class="rate-label"><?= $l['crystal'] ?> : <?= $l['deuterium'] ?></div>
								<div class="rate-input-group">
									<input id="rate-cd" type="text" name="rate-cd" class="form-control form-control-sm trade-editable rate-input" tabindex="19"/>
								</div>
								<div class="rate-slider-group">
									<span id="rate-cd-min"></span>
									<input id="cd-slider" type="range" class="range-slider form-range" />
									<span id="rate-cd-max"></span>
								</div>
								<div class="rate-buttons">
									<button id="rate-btn-2" class="btn btn-sm btn-primary">3 : 2 : 1</button>
									<button id="rate-btn-5" class="btn btn-sm btn-primary">2 : 1.5 : 1</button>
								</div>
							</div>

							<!-- Metal:Crystal Rate -->
							<div class="rate-row">
								<div class="rate-label"><?= $l['metal'] ?> : <?= $l['crystal'] ?></div>
								<div class="rate-input-group">
									<div id="rate-mc" class="border rounded bg-light rate-input p-1 text-center"></div>
								</div>
								<div class="rate-slider-group">
									<span id="rate-mc-min"></span>
									<input id="mc-slider" type="range" class="range-slider form-range" disabled />
									<span id="rate-mc-max"></span>
								</div>
								<div class="rate-buttons">
									<button id="rate-btn-3" class="btn btn-sm btn-primary">3 : 1.5 : 1</button>
									<button id="rate-btn-6" class="btn btn-sm btn-primary">2.4 : 1.5 : 1</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Location Panel -->
					<div class="border rounded bg-primary panel m-1">
						<p class="bg-light border rounded subheader bg-primary-subtle text-primary-medium mb-1 px-2"><?= $l['location'] ?></p>
						<div class="px-2 py-1">
							<div class="row mb-1 align-items-center">
								<div class="col-12 col-md-3 text-md-end tdr"><?= $l['country'] ?>:</div>
								<div class="col-12 col-md-9">
									<select id="country" class="form-select form-select-sm" tabindex="21">
									<?php if ($countries): ?>
									<?php foreach ($countries as $row): ?>
										<option value="<?= $row['lang'] ?>"><?= $row['name'].' ('.$row['server'].')' ?></option>
									<?php endforeach; ?>
									<?php endif; ?>
									</select>
								</div>
							</div>
							<div class="row mb-2 align-items-center">
								<div class="col-12 col-md-3 text-md-end tdr"><?= $l['universe'] ?>:</div>
								<div class="col-12 col-md-9">
									<select id="universe" class="form-select form-select-sm" tabindex="22"></select>
								</div>
							</div>
							<div class="row align-items-center">
								<div class="col-12 col-md-3 text-md-end tdr"><?= $l['coords'] ?>:</div>
								<div class="col-12 col-md-9">
									<div class="d-flex align-items-center gap-1">
										<input id="coord-g" type="text" class="form-control form-control-sm rate-input" style="width: 60px;" tabindex="23"/>
										<span>:</span>
										<input id="coord-s" type="text" class="form-control form-control-sm rate-input" style="width: 60px;" tabindex="24"/>
										<span>:</span>
										<input id="coord-p" type="text" class="form-control form-control-sm rate-input" style="width: 60px;" tabindex="25"/>
										<input id="moon" type="checkbox" name="moon" class="form-check-input ms-2"/>
										<label for="moon" class="form-check-label"><?= $l['moon'] ?></label>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Link, Text, BBCode sections -->
				<div id="link" class="my-4 text-center small">
					<?= $l['link'] ?>:<br><a id="alink" href="#"></a>
				</div>
				<div id="text" class="my-4 text-center small">
					<?= $l['text'] ?>:<br><span id="atext"></span>
				</div>
				<div id="bbcode" class="my-4 text-center small">
					BB-Code:<br><textarea id="abbcode" class="form-control border rounded w-100" rows="2"></textarea>
				</div>
			</div>
		</div>
	</div>
</div>

<?php
	require_once('../../analitics.tpl');
?>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js" integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI" crossorigin="anonymous"></script>
</body>
</html>