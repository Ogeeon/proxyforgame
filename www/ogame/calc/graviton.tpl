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
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet"/>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet" />
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet"/>
  <link type="text/css" href="/ogame/calc/css/graviton_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/graviton_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries and calculator modules -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/graviton-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/graviton-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/graviton-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/graviton-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/graviton-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/graviton-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/graviton-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/graviton-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // `options` is defined in graviton-orchestration.js; here we only fill in
    // the translation strings the renderer and validators read.
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
  </script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('../../sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('../../topbar_bs.tpl'); ?>

<div id="graviton">
  <div class="border rounded position-relative">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['title'] ?></div>
      <div id="reset" class="d-flex align-items-center justify-content-center bg-danger-subtle" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <!-- Parameters -->
    <div id="general-settings-panel" class="border rounded m-1 p-2 pb-1">
      <ul class="nav nav-tabs" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-general-tab" data-bs-toggle="tab" data-bs-target="#param-general" type="button" role="tab"><?= $l['parameters'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-lifeforms-tab" data-bs-toggle="tab" data-bs-target="#param-lifeforms" type="button" role="tab"><?= $l['lifeforms'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">
        <div id="param-general" class="tab-pane fade show active p-2 pb-0" role="tabpanel">
        <table class="mx-auto">
          <tr>
            <td><label for="shipyard-level"><?= $l['shipyard-level'] ?></label></td>
            <td><input id="shipyard-level" type="text" name="shipyard-level" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="1" alt="<?= $l['shipyard-level'] ?>"/></td>
            <td><label for="nanites-factory-level"><?= $l['nanites-factory-level'] ?></label></td>
            <td><input id="nanites-factory-level" type="text" name="nanites-factory-level" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
            <td><label for="universe-speed"><?= $l['universe-speed'] ?></label></td>
            <td>
              <select id="universe-speed" name="universe-speed" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                <?php for ($s = 1; $s <= 10; $s++): ?>
                <option value="<?= $s ?>"<?= $s === 1 ? ' selected="selected"' : '' ?>><?= $s ?></option>
                <?php endfor; ?>
              </select>
            </td>
          </tr>
          <tr>
            <td><label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label></td>
            <td><input id="energy-tech-level" type="text" name="energy-tech-level" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0"/></td>
            <td><label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label></td>
            <td><input id="max-planet-temp" type="text" name="max-planet-temp" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" alt="<?= $l['max-planet-temp'] ?>"/></td>
            <td><label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label></td>
            <td><input id="hyper-tech-level" type="text" name="hyper-tech-level" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
          </tr>
        </table>

        <table class="mx-auto">
          <tr>
            <td><label for="energy-boost"><?= $l['energy-boost'] ?></label></td>
            <td>
              <select id="energy-boost" name="energy-boost" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                <option value="0" selected="selected">0%</option>
                <option value="2">20%</option>
                <option value="4">40%</option>
                <option value="6">60%</option>
                <option value="8">80%</option>
              </select>
            </td>
            <td style="width: 20px;">&nbsp;</td>
            <td><label><?= $l['energy-bonus'] ?>:</label></td>
            <td class="text-nowrap">
              <input id="energy-bonus-0" type="radio" name="energy-bonus" value="0" class="form-check-input"/> <label for="energy-bonus-0"><?= $l['none'] ?></label>
              <input id="energy-bonus-1" type="radio" name="energy-bonus" value="1" class="form-check-input ms-2"/> <label for="energy-bonus-1"><?= $l['engineer'] ?></label>
              <input id="energy-bonus-2" type="radio" name="energy-bonus" value="2" class="form-check-input ms-2"/> <label for="energy-bonus-2"><?= $l['all-officers'] ?></label>
            </td>
          </tr>
        </table>

        <table class="mx-auto">
          <tr>
            <td><label for="disr-chamber-level"><?= $l['disr-chamber'] ?></label></td>
            <td><input id="disr-chamber-level" type="text" name="disr-chamber-level" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
            <td class="px-2" colspan="2"><input id="trader-bonus" type="checkbox" name="trader-bonus" class="form-check-input"/> <label for="trader-bonus"><?= $l['trader-bonus'] ?></label></td>
          </tr>
          <tr>
            <td class="text-nowrap"><label><?= $l['class'] ?>:</label></td>
            <td class="text-nowrap" colspan="3">
              <input id="player-class-0" type="radio" name="player-class" value="0" class="form-check-input" checked="checked"/> <label for="player-class-0"><?= $l['none'] ?></label>
              <input id="player-class-1" type="radio" name="player-class" value="1" class="form-check-input ms-2"/> <label for="player-class-1"><?= $l['class-collector'] ?></label>
              <input id="player-class-2" type="radio" name="player-class" value="2" class="form-check-input ms-2"/> <label for="player-class-2"><?= $l['class-general'] ?></label>
            </td>
          </tr>
        </table>
        </div><!-- /param-general -->

        <div id="param-lifeforms" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap column-gap-3 row-gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="total-lf-energy-bonus"><?= $l['total-lf-energy-bonus'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="total-lf-energy-bonus" type="text" name="total-lf-energy-bonus" class="form-control level-input m-0" value="0" alt="<?= $l['total-lf-energy-bonus'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex flex-wrap align-items-center gap-2 border rounded p-2">
              <span class="fw-semibold"><?= $l['cargo-cap-increase'] ?></span>
              <div class="d-flex align-items-center gap-1">
                <label for="sc-capacity-increase"><?= $l['sc-short'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="form-control level-input m-0" value="0" alt="<?= $l['cargo-cap-increase'] ?><?= $l['sc-short'] ?>"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="lc-capacity-increase"><?= $l['lc-short'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="form-control level-input m-0" value="0" alt="<?= $l['cargo-cap-increase'] ?><?= $l['lc-short'] ?>"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="rc-capacity-increase"><?= $l['recycler'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="rc-capacity-increase" type="text" name="rc-capacity-increase" class="form-control level-input m-0" value="0" alt="<?= $l['cargo-cap-increase'] ?><?= $l['recycler'] ?>"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
            </div>
          </div>
        </div><!-- /param-lifeforms -->
      </div><!-- /paramTabContent -->

      <hr>

      <div id="plants-settings">
        <table class="mx-auto">
          <tr>
            <td><label for="solar-plant-level"><?= $l['solar-plant-level'] ?></label></td>
            <td><input id="solar-plant-level" type="text" name="solar-plant-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0"/></td>
            <td>
              <select id="solar-plant-percent" name="solar-plant-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
              </select>
            </td>
            <td><label id="solar-plant-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label for="fusion-plant-level"><?= $l['fusion-plant-level'] ?></label></td>
            <td><input id="fusion-plant-level" type="text" name="fusion-plant-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0"/></td>
            <td>
              <select id="fusion-plant-percent" name="fusion-plant-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
              </select>
            </td>
            <td><label id="fusion-plant-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label for="solar-satellites-count"><?= $l['solar-satellites-count'] ?></label></td>
            <td><input id="solar-satellites-count" type="text" name="solar-satellites-count" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0"/></td>
            <td>
              <select id="solar-satellites-percent" name="solar-satellites-percent" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                <option value="100" selected="selected">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option>
                <option value="50">50%</option><option value="40">40%</option><option value="30">30%</option><option value="20">20%</option><option value="10">10%</option>
              </select>
            </td>
            <td><label id="solar-satellites-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['officers-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="officers-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['class-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="class-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['alliance-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="alliance-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['boost-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="boost-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['disr-chamber-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="disr-chamber-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
          <tr>
            <td><label><?= $l['lf-tech-bonus'] ?></label></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td><label id="lf-tech-bonus-energy">0</label>&nbsp;<label><?= $l['energy'] ?></label></td>
          </tr>
        </table>
      </div>

      <hr>

      <div id="tech-settings">
        <table class="mx-auto">
          <tr>
            <td><label for="graviton-level"><?= $l['graviton-level'] ?></label></td>
            <td><input id="graviton-level" type="text" name="graviton-level" class="form-control form-control-sm d-inline-block energy-input ui-input-margin" value="0"/></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Results -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['calc-results'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['energy-produced'] ?></label></td>
          <td><div id="energy-produced" class="form-control form-control-sm d-inline-block energy-show ui-input-margin">0</div></td>
          <td><label id="energy-requirement"></label></td>
        </tr>
        <tr>
          <td colspan="2"><label><?= $l['solar-satellites-needed'] ?></label></td>
          <td><div id="solar-satellites-needed" class="form-control form-control-sm d-inline-block energy-show ui-input-margin">0</div></td>
        </tr>
      </table>
    </div>

    <!-- Expenses -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['expences'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['crystal'] ?></label></td>
          <td><div id="crystal-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin">0</div></td>
          <td><label><?= $l['deuterium'] ?></label></td>
          <td><div id="deuterium-required" class="form-control form-control-sm d-inline-block resource-show ui-input-margin">0</div></td>
          <td><label><?= $l['time'] ?></label></td>
          <td><div id="time-required" class="form-control form-control-sm d-inline-block time-show ui-input-margin">0</div></td>
        </tr>
        <tr>
          <td><label><?= $l['cargoes'] ?></label></td>
          <td colspan="4"><div id="cargoes" class="form-control form-control-sm d-inline-block transport-show ui-input-margin">0</div></td>
          <td><i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['sc'] ?> / <?= $l['lc'] ?>"></i></td>
        </tr>
      </table>
    </div>

    <!-- Recycling -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['recycling'] ?></b></p>
      <table class="mx-auto">
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
          <td><label><?= $l['crystal'] ?></label></td>
          <td><div id="crystal-recyclable" class="form-control form-control-sm d-inline-block resource-show ui-input-margin">0</div></td>
        </tr>
        <tr>
          <td><label><?= $l['recyclers'] ?></label></td>
          <td><div id="recyclers" class="form-control form-control-sm d-inline-block energy-show ui-input-margin">0</div></td>
          <td><label><?= $l['cargoes'] ?></label></td>
          <td><div id="cargoes-for-df" class="form-control form-control-sm d-inline-block transport-show ui-input-margin">0</div></td>
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
  require_once('../../analitics.tpl');
?>

<script type="text/javascript">
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
    bootstrap.Tooltip.getOrCreateInstance(el);
  });
  initializeGravitonCalculator();
});
</script>

</body>
</html>
