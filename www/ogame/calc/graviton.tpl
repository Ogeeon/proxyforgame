<!DOCTYPE html>
<html lang="<?= getLangAttr() ?>">
<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8">
  <?php require_once '../../hawk.tpl'; ?>
  <?php require_once __DIR__ . '/../../scripts-guard.tpl'; ?>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= $l['title'] ?></title>
  <meta name="description" content="<?= htmlspecialchars($l['description'], ENT_QUOTES, 'UTF-8') ?>">
  <meta name="keywords" content="<?= $l['keywords'] ?>">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
<?php
  // www/ on disk, for the content-hash cache-busting stamps below.
  $pfgPath = dirname(__DIR__, 2);
?>
  <!-- Bootstrap 5 and Bootstrap Icons (CSS, icon font, JS bundle) -->
  <?php require_once '../../vendor.tpl'; ?>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs.css?v=<?php echo assetVersion($pfgPath, '/css/langs.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/css/common.css?v=<?php echo assetVersion($pfgPath, '/css/common.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/ogame/calc/css/graviton.css?v=<?php echo assetVersion($pfgPath, '/ogame/calc/css/graviton.css'); ?>" rel="stylesheet">

  <!-- Utility libraries and calculator modules -->
  <script src="/js/utils.js?v=<?php echo assetVersion($pfgPath, '/js/utils.js'); ?>" defer></script>
  <script src="/js/api-client.js?v=<?php echo assetVersion($pfgPath, '/js/api-client.js'); ?>" defer></script>
  <script src="/ogame/calc/js/dom-utils.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/dom-utils.js'); ?>" defer></script>
  <!-- Player profiles -->
  <script src="/ogame/calc/js/profiles-core.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-core.js'); ?>" defer></script>
  <script src="/ogame/calc/js/profiles-store.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-store.js'); ?>" defer></script>
  <script src="/ogame/calc/js/profiles-fields.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-fields.js'); ?>" defer></script>
  <script src="/ogame/calc/js/profiles-widgets.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-widgets.js'); ?>" defer></script>
  <script src="/ogame/calc/js/profiles-binders.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-binders.js'); ?>" defer></script>
  <script src="/ogame/calc/js/profiles-ui.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/profiles-ui.js'); ?>" defer></script>
  <script src="/ogame/calc/js/ogame-production.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/ogame-production.js'); ?>" defer></script>
  <script src="/ogame/calc/js/ogame-cargo.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/ogame-cargo.js'); ?>" defer></script>
  <script src="/ogame/calc/js/graviton-core.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/graviton-core.js'); ?>" defer></script>
  <script src="/ogame/calc/js/graviton-data-collector.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/graviton-data-collector.js'); ?>" defer></script>
  <script src="/ogame/calc/js/graviton-renderer.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/graviton-renderer.js'); ?>" defer></script>
  <script src="/ogame/calc/js/graviton-orchestration.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/graviton-orchestration.js'); ?>" defer></script>
  <script src="/ogame/calc/js/graviton-profile.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/graviton-profile.js'); ?>" defer></script>

<script type="module">
    // A module, so it runs after the deferred scripts above have defined `options`.
    // `options` is defined in graviton-orchestration.js; here we only fill in
    // the translation strings the renderer and validators read.
    // A missing `options` means a deferred script never ran
    // (blocked or failed request): show the banner and stop instead of throwing
    // the ReferenceError Hawk logs as a separate group per symbol.
    if (typeof options === 'undefined') {
      pfgScriptsFailed();
    } else {
      options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
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
      options.energyReqConjunction = '<?= $l['energy-needed'] ?>';
      // Captions of the calculation-error report (graviton-data-collector.js):
      // the groups below the parameter tabs, and every result cell by its id.
      options.reportText = <?= json_encode(array('energy' => $l['energy'], 'recycling' => $l['recycling'])) ?>;
      options.reportCells = <?= json_encode(array(
        'solar-plant-energy' => $l['solar-plant-level'] . ', ' . $l['energy'],
        'fusion-plant-energy' => $l['fusion-plant-level'] . ', ' . $l['energy'],
        'solar-satellites-energy' => $l['solar-satellites-count'] . ', ' . $l['energy'],
        'officers-bonus-energy' => $l['officers-bonus'], 'class-bonus-energy' => $l['class-bonus'],
        'alliance-bonus-energy' => $l['alliance-bonus'], 'boost-bonus-energy' => $l['boost-bonus'],
        'disr-chamber-bonus-energy' => $l['disr-chamber-bonus'], 'lf-tech-bonus-energy' => $l['lf-tech-bonus'],
        'energy-produced' => $l['energy-produced'], 'solar-satellites-needed' => $l['solar-satellites-needed'],
        'crystal-required' => $l['expenses'] . ', ' . $l['crystal'],
        'deuterium-required' => $l['expenses'] . ', ' . $l['deuterium'],
        'time-required' => $l['expenses'] . ', ' . $l['time'],
        'crystal-to-deliver' => $l['res-needed'] . ', ' . $l['crystal'],
        'deuterium-to-deliver' => $l['res-needed'] . ', ' . $l['deuterium'],
        'cargoes' => $l['res-needed'] . ', ' . $l['cargoes'],
        'crystal-recyclable' => $l['recycling'] . ', ' . $l['crystal'],
        'deuterium-recyclable' => $l['recycling'] . ', ' . $l['deuterium'],
        'recyclers' => $l['recycling'] . ', ' . $l['recyclers'],
        'cargoes-for-df' => $l['recycling'] . ', ' . $l['cargoes'],
        'net-crystal-required' => $l['net-cost'] . ', ' . $l['crystal'],
        'net-deuterium-required' => $l['net-cost'] . ', ' . $l['deuterium'],
      )) ?>;
    }
</script>
<?php require_once '../../cookies.tpl'; ?>
</head>

<body>

<h1 class="visually-hidden"><?= $l['title'] ?></h1>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once '../../sidebar.tpl'; ?></div>
    <div class="col-md-10">
    <?php $withProfiles = true; require_once '../../topbar.tpl'; ?>

<div id="graviton">
  <div class="border rounded position-relative">
    <div class="d-flex flex-wrap align-items-center">
      <div class="text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['title'] ?></div>
      <div id="pf-planet-box" class="pf-header-bodies d-flex align-items-center gap-1 ms-auto ps-2 me-1 d-none">
        <label for="pf-planet"><?= $l['planet'] ?></label>
        <select id="pf-planet" class="form-select form-select-sm w-auto"></select>
      </div>
      <div id="reset" class="d-flex align-items-center justify-content-center bg-danger-subtle" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <!-- Parameters -->
    <div id="general-settings-panel" class="border rounded m-1 p-2 pb-1">
      <ul class="nav nav-tabs" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-common-tab" data-bs-toggle="tab" data-bs-target="#param-common" type="button" role="tab"><?= $l['param-tab-common'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-buildings-tab" data-bs-toggle="tab" data-bs-target="#param-buildings" type="button" role="tab"><?= $l['buildings'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-researches-tab" data-bs-toggle="tab" data-bs-target="#param-researches" type="button" role="tab"><?= $l['researches'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-lifeforms-tab" data-bs-toggle="tab" data-bs-target="#param-lifeforms" type="button" role="tab"><?= $l['lifeforms'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">
        <!-- Common tab -->
        <div id="param-common" class="tab-pane fade show active p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-1">
            <div class="d-flex align-items-center gap-1">
              <label for="universe-speed"><?= $l['universe-speed'] ?></label>
              <select id="universe-speed" name="universe-speed" class="form-select form-select-sm w-auto">
                <?php for ($s = 1; $s <= 10; $s++): ?>
                <option value="<?= $s ?>"<?= $s === 1 ? ' selected="selected"' : '' ?>><?= $s ?></option>
                <?php endfor; ?>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label>
              <input id="max-planet-temp" type="text" name="max-planet-temp" class="form-control form-control-sm level-input" value="0" data-field-title="<?= $l['max-planet-temp'] ?>">
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="energy-boost"><?= $l['energy-boost'] ?></label>
              <select id="energy-boost" name="energy-boost" class="form-select form-select-sm w-auto">
                <option value="0" selected="selected">0%</option>
                <option value="2">20%</option>
                <option value="4">40%</option>
                <option value="6">60%</option>
                <option value="8">80%</option>
              </select>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-1">
            <?php foreach (['engineer', 'geologist', 'technocrat', 'admiral', 'commander'] as $officer): ?>
            <div class="d-flex align-items-center gap-1">
              <input id="<?= $officer ?>" type="checkbox" name="<?= $officer ?>" class="form-check-input">
              <label for="<?= $officer ?>"><?= $l[$officer] ?></label>
            </div>
            <?php endforeach; ?>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <fieldset class="d-flex align-items-center gap-1 flex-wrap flex-sm-nowrap fieldset-reset">
              <legend><?= $l['class'] ?>:</legend>
              <input id="player-class-0" type="radio" name="player-class" value="0" class="form-check-input" checked="checked"> <label for="player-class-0"><?= $l['none'] ?></label>
              <input id="player-class-1" type="radio" name="player-class" value="1" class="form-check-input ms-2"> <label for="player-class-1"><?= $l['class-collector'] ?></label>
              <input id="player-class-2" type="radio" name="player-class" value="2" class="form-check-input ms-2"> <label for="player-class-2"><?= $l['class-general'] ?></label>
            </fieldset>
            <div class="d-flex align-items-center gap-1">
              <input id="trader-bonus" type="checkbox" name="trader-bonus" class="form-check-input">
              <label for="trader-bonus"><?= $l['trader-bonus'] ?></label>
            </div>
          </div>
        </div><!-- /param-common -->

        <!-- Buildings tab -->
        <div id="param-buildings" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="shipyard-level"><?= $l['shipyard-level'] ?></label>
              <input id="shipyard-level" type="text" name="shipyard-level" class="form-control form-control-sm level-input" value="1" data-field-title="<?= $l['shipyard-level'] ?>">
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="nanites-factory-level"><?= $l['nanites-factory-level'] ?></label>
              <input id="nanites-factory-level" type="text" name="nanites-factory-level" class="form-control form-control-sm level-input" value="0" data-field-title="<?= $l['nanites-factory-level'] ?>">
            </div>
          </div>
        </div><!-- /param-buildings -->

        <!-- Researches tab -->
        <div id="param-researches" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label>
              <input id="energy-tech-level" type="text" name="energy-tech-level" class="form-control form-control-sm level-input" value="0" data-field-title="<?= $l['energy-tech-level'] ?>">
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label>
              <input id="hyper-tech-level" type="text" name="hyper-tech-level" class="form-control form-control-sm level-input" value="0" data-field-title="<?= $l['hyper-tech'] ?>">
            </div>
          </div>
        </div><!-- /param-researches -->

        <div id="param-lifeforms" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap column-gap-3 row-gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="disr-chamber-level"><?= $l['disr-chamber'] ?></label>
              <input id="disr-chamber-level" type="text" name="disr-chamber-level" class="form-control form-control-sm level-input" value="0" data-field-title="<?= $l['disr-chamber'] ?>">
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="total-lf-energy-bonus"><?= $l['total-lf-energy-bonus'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="total-lf-energy-bonus" type="text" name="total-lf-energy-bonus" class="form-control level-input m-0" value="0" data-field-title="<?= $l['total-lf-energy-bonus'] ?>">
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex flex-wrap align-items-center gap-2 border rounded p-2">
              <span class="fw-semibold"><?= $l['class-collector'] ?>:</span>
              <div class="d-flex align-items-center gap-1">
                <label for="lf-collector-class-bonus"><?= $l['lf-class-bonus'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lf-collector-class-bonus" type="text" name="lf-collector-class-bonus" class="form-control level-input m-0" value="0" data-field-title="<?= $l['collectors-character-bonus'] ?>">
                  <span class="input-group-text">%</span>
                </div>
                <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= htmlspecialchars($l['lf-class-bonus-hint'], ENT_QUOTES) ?>"></i>
              </div>
            </div>
            <div class="d-flex flex-wrap align-items-center gap-2 border rounded p-2">
              <span class="fw-semibold"><?= $l['cargo-cap-increase'] ?></span>
              <div class="d-flex align-items-center gap-1">
                <label for="sc-capacity-increase"><?= $l['sc-short'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="form-control level-input m-0" value="0" data-field-title="<?= $l['cargo-cap-increase'] ?><?= $l['sc-short'] ?>">
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="lc-capacity-increase"><?= $l['lc-short'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="form-control level-input m-0" value="0" data-field-title="<?= $l['cargo-cap-increase'] ?><?= $l['lc-short'] ?>">
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="rc-capacity-increase"><?= $l['recycler'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="rc-capacity-increase" type="text" name="rc-capacity-increase" class="form-control level-input m-0" value="0" data-field-title="<?= $l['cargo-cap-increase'] ?><?= $l['recycler'] ?>">
                  <span class="input-group-text">%</span>
                </div>
              </div>
            </div>
          </div>
        </div><!-- /param-lifeforms -->
      </div><!-- /paramTabContent -->

      <hr class="my-2">

      <div id="plants-settings">
        <table class="mx-auto pfg-energy-rows" role="presentation">
          <tr>
            <td><label for="solar-plant-level"><?= $l['solar-plant-level'] ?></label></td>
            <td><input id="solar-plant-level" type="text" name="solar-plant-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0" data-field-title="<?= $l['solar-plant-level'] ?>"></td>
            <td>
              <select id="solar-plant-percent" name="solar-plant-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin" aria-label="<?= htmlspecialchars($l['solar-plant-level'] . ', %', ENT_QUOTES) ?>">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option><option value="0">0%</option>
              </select>
            </td>
            <td><span id="solar-plant-energy" data-report-cell="solar-plant-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><label for="fusion-plant-level"><?= $l['fusion-plant-level'] ?></label></td>
            <td><input id="fusion-plant-level" type="text" name="fusion-plant-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0" data-field-title="<?= $l['fusion-plant-level'] ?>"></td>
            <td>
              <select id="fusion-plant-percent" name="fusion-plant-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin" aria-label="<?= htmlspecialchars($l['fusion-plant-level'] . ', %', ENT_QUOTES) ?>">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option><option value="0">0%</option>
              </select>
            </td>
            <td><span id="fusion-plant-energy" data-report-cell="fusion-plant-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><label for="solar-satellites-count"><?= $l['solar-satellites-count'] ?></label></td>
            <td><input id="solar-satellites-count" type="text" name="solar-satellites-count" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0" data-field-title="<?= $l['solar-satellites-count'] ?>"></td>
            <td>
              <select id="solar-satellites-percent" name="solar-satellites-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin" aria-label="<?= htmlspecialchars($l['solar-satellites-count'] . ', %', ENT_QUOTES) ?>">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option><option value="0">0%</option>
              </select>
            </td>
            <td><span id="solar-satellites-energy" data-report-cell="solar-satellites-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['officers-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="officers-bonus-energy" data-report-cell="officers-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['class-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="class-bonus-energy" data-report-cell="class-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['alliance-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="alliance-bonus-energy" data-report-cell="alliance-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['boost-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="boost-bonus-energy" data-report-cell="boost-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['disr-chamber-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="disr-chamber-bonus-energy" data-report-cell="disr-chamber-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
          <tr>
            <td><span><?= $l['lf-tech-bonus'] ?></span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><span id="lf-tech-bonus-energy" data-report-cell="lf-tech-bonus-energy">0</span> <span><?= $l['energy'] ?></span></td>
          </tr>
        </table>
      </div>

      <hr class="my-2">

      <div id="tech-settings">
        <table class="mx-auto" role="presentation">
          <tr>
            <td><label for="graviton-level"><?= $l['graviton-level'] ?></label></td>
            <td><input id="graviton-level" type="text" name="graviton-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="1" data-field-title="<?= $l['graviton-level'] ?>"></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Results -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['calc-results'] ?></p>
      <table class="mx-auto" role="presentation">
        <tr>
          <td><span><?= $l['energy-produced'] ?></span></td>
          <td><div id="energy-produced" data-report-cell="energy-produced" class="form-control form-control-sm d-inline-block energy-show ui-input-margin ui-state-disabled">0</div></td>
          <td><span id="energy-requirement"></span></td>
        </tr>
        <tr>
          <td colspan="2"><span><?= $l['solar-satellites-needed'] ?></span></td>
          <td><div id="solar-satellites-needed" data-report-cell="solar-satellites-needed" class="form-control form-control-sm d-inline-block energy-show ui-input-margin ui-state-disabled">0</div></td>
        </tr>
      </table>
    </div>

    <!-- Expenses -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['expenses'] ?></p>
      <table class="mx-auto pfg-pairs" role="presentation">
        <tr>
          <td class="pfg-order-1"><span><?= $l['crystal'] ?></span></td>
          <td class="pfg-order-1"><div id="crystal-required" data-report-cell="crystal-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td class="pfg-order-4"><span><?= $l['deuterium'] ?></span></td>
          <td class="pfg-order-4"><div id="deuterium-required" data-report-cell="deuterium-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td class="pfg-order-7"><span><?= $l['time'] ?></span></td>
          <td class="pfg-order-7"><div id="time-required" data-report-cell="time-required" class="form-control form-control-sm d-inline-block time-show ui-input-margin ui-state-disabled">0</div></td>
        </tr>
        <tr>
          <td class="pfg-order-2 pfg-phone-sub"><label for="crystal-available"><?= $l['res-available'] ?></label></td>
          <td class="pfg-order-2"><input id="crystal-available" data-report-skip type="text" name="crystal-available" class="form-control form-control-sm d-inline-block resource-show ui-input-margin" value="0" data-field-title="<?= $l['res-available'] ?> <?= $l['crystal'] ?>"></td>
          <td class="pfg-order-5 pfg-phone-sub" data-phone-label="<?= htmlspecialchars($l['res-available'], ENT_QUOTES) ?>">&nbsp;</td>
          <td class="pfg-order-5"><input id="deuterium-available" data-report-skip type="text" name="deuterium-available" class="form-control form-control-sm d-inline-block resource-show ui-input-margin" value="0" data-field-title="<?= $l['res-available'] ?> <?= $l['deuterium'] ?>" aria-label="<?= htmlspecialchars($l['res-available'] . ': ' . $l['deuterium'], ENT_QUOTES) ?>"></td>
          <td colspan="2" class="pfg-phone-hide">&nbsp;</td>
        </tr>
        <tr id="resources-age-row" class="d-none">
          <td class="pfg-phone-hide"></td>
          <td colspan="5" class="pt-0 pfg-order-5 pfg-phone-full"><small id="resources-age" class="text-body-secondary"></small></td>
        </tr>
        <tr>
          <td class="pfg-order-3 pfg-phone-sub"><span><?= $l['res-needed'] ?></span></td>
          <td class="pfg-order-3"><div id="crystal-to-deliver" data-report-cell="crystal-to-deliver" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td class="pfg-order-6 pfg-phone-sub" data-phone-label="<?= htmlspecialchars($l['res-needed'], ENT_QUOTES) ?>">&nbsp;</td>
          <td class="pfg-order-6"><div id="deuterium-to-deliver" data-report-cell="deuterium-to-deliver" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td colspan="2" class="pfg-phone-hide">&nbsp;</td>
        </tr>
        <tr>
          <td class="pfg-order-8"><span><?= $l['cargoes'] ?></span></td>
          <td colspan="5" class="pfg-order-8"><div id="cargoes" data-report-cell="cargoes" class="form-control form-control-sm d-inline-block transport-show ui-input-margin ui-state-disabled">0</div><i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['sc'] ?> / <?= $l['lc'] ?>"></i></td>
        </tr>
      </table>
    </div>

    <!-- Recycling -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['recycling'] ?></p>
      <table class="mx-auto pfg-pairs" role="presentation">
        <tr>
          <td><label for="debris-percent"><?= $l['debris-percent'] ?></label></td>
          <td>
            <select id="debris-percent" name="debris-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
              <option value="30" selected="selected">30%</option>
              <option value="40">40%</option>
              <option value="50">50%</option>
              <option value="55">55%</option>
              <option value="60">60%</option>
              <option value="70">70%</option>
              <option value="80">80%</option>
            </select>
          </td>
          <td colspan="2" class="pfg-phone-full">
            <input id="deut-in-debris" type="checkbox" name="deut-in-debris" class="form-check-input">
            <label for="deut-in-debris"><?= $l['deut-in-debris'] ?></label>
          </td>
        </tr>
        <tr>
          <td><span><?= $l['crystal'] ?></span></td>
          <td><div id="crystal-recyclable" data-report-cell="crystal-recyclable" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td><span><?= $l['deuterium'] ?></span></td>
          <td><div id="deuterium-recyclable" data-report-cell="deuterium-recyclable" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
        </tr>
        <tr>
          <td><span><?= $l['recyclers'] ?></span></td>
          <td><div id="recyclers" data-report-cell="recyclers" class="form-control form-control-sm d-inline-block energy-show ui-input-margin ui-state-disabled">0</div></td>
          <td><span><?= $l['cargoes'] ?></span></td>
          <td><div id="cargoes-for-df" data-report-cell="cargoes-for-df" class="form-control form-control-sm d-inline-block transport-show ui-input-margin ui-state-disabled">0</div></td>
        </tr>
        <tr>
          <td colspan="4" class="pb-0 pfg-phone-full">
            <div class="border-top mt-2 pt-2">
              <span class="fw-semibold"><?= $l['net-cost'] ?></span>
              <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['net-cost-hint'] ?>"></i>
            </div>
          </td>
        </tr>
        <tr>
          <td class="pt-0"><span><?= $l['crystal'] ?></span></td>
          <td class="pt-0"><div id="net-crystal-required" data-report-cell="net-crystal-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
          <td class="pt-0"><span><?= $l['deuterium'] ?></span></td>
          <td class="pt-0"><div id="net-deuterium-required" data-report-cell="net-deuterium-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin ui-state-disabled">0</div></td>
        </tr>
      </table>
    </div>
  </div>

  <div id="warning">
    <div id="warning-message"></div>
  </div>
</div>

    </div> <!-- End col-md-10 -->
  </div> <!-- End row -->
</div> <!-- End container-fluid -->
<?php
  require_once '../../analitics.tpl';
?>

<script type="module">
document.addEventListener('DOMContentLoaded', function() {
  if (typeof bootstrapAvailable !== 'function' || !bootstrapAvailable() || typeof initializeGravitonCalculator !== 'function' || typeof initGravitonProfiles !== 'function') {
    pfgScriptsFailed();
    return;
  }
  attachTooltips(document);
  initializeGravitonCalculator();
  initGravitonProfiles();
});
</script>

</body>
</html>
