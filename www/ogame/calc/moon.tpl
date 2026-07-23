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

  // Unit ids rendered as count inputs. They must stay in sync with MOON_UNITS
  // in moon-core.js, which holds the matching build costs.
  $moonFleet = array(
    'small-cargo', 'large-cargo', 'light-fighter', 'heavy-fighter', 'cruiser',
    'battleship', 'colony-ship', 'recycler', 'esp-probe', 'bomber',
    'destroyer', 'death-star', 'battlecruiser', 'reaper', 'pathfinder',
    'solar-sat'
  );
  $moonDefenses = array(
    'rocket-launcher', 'light-laser', 'heavy-laser', 'gauss-cannon',
    'ion-cannon', 'plasma-turret', 'small-shield', 'large-shield'
  );
?>
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet"/>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet" />
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet"/>
  <link type="text/css" href="/ogame/calc/css/moon_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/moon_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries and calculator modules -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/moon-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/moon-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/moon-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/moon-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/moon-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/moon-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/moon-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/moon-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // `options` is defined in moon-orchestration.js; here we only fill in the
    // translation strings the renderer and validators read.
    options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = '<?= $l['field-hint'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
  </script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('../../sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('../../topbar_bs.tpl'); ?>

<div id="moon">

  <!-- ================= Moon destruction ================= -->
  <div class="border rounded mb-2">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['destroy-title'] ?></div>
      <div id="reset-ds" class="d-flex align-items-center justify-content-center bg-danger-subtle" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <div id="destroy-settings-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['parameters'] ?></b></p>
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center">
        <div class="d-flex align-items-center gap-1">
          <label for="moon-size"><?= $l['moon-size'] ?></label>
          <input id="moon-size" type="text" name="moon-size" class="form-control form-control-sm level-input" value="1" alt="<?= $l['moon-size'] ?>"/>
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="ds-count"><?= $l['ds-count'] ?></label>
          <input id="ds-count" type="text" name="ds-count" class="form-control form-control-sm level-input" value="1" alt="<?= $l['ds-count'] ?>"/>
        </div>
      </div>
    </div>

    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['calc-results'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['moon-destroy-chance'] ?></label></td>
          <td><div id="moon-destroy-chance" class="form-control form-control-sm d-inline-block chance-show">0%</div></td>
        </tr>
        <tr>
          <td><label><?= $l['ds-blow-chance'] ?></label></td>
          <td><div id="ds-blow-chance" class="form-control form-control-sm d-inline-block chance-show">0%</div></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ================= Moon creation ================= -->
  <div class="border rounded">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['create-title'] ?></div>
      <div id="reset-cr" class="d-flex align-items-center justify-content-center bg-danger-subtle" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <div id="create-settings-panel" class="border rounded m-1 p-2 pb-1">
      <ul class="nav nav-tabs" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-common-tab" data-bs-toggle="tab" data-bs-target="#param-common" type="button" role="tab"><?= $l['param-tab-common'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-fleet-tab" data-bs-toggle="tab" data-bs-target="#param-fleet" type="button" role="tab"><?= $l['fleet'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-defenses-tab" data-bs-toggle="tab" data-bs-target="#param-defenses" type="button" role="tab"><?= $l['defenses'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">

        <!-- Common tab -->
        <div id="param-common" class="tab-pane fade show active p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <label for="hypertech-lvl"><?= $l['hyper-tech'] ?></label>
              <input id="hypertech-lvl" type="text" name="hypertech-lvl" class="form-control form-control-sm level-input" value="0" alt="<?= $l['hyper-tech'] ?>"/>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="debris-percent"><?= $l['debris-percent'] ?></label>
              <select id="debris-percent" name="debris-percent" class="form-select form-select-sm w-auto">
                <option value="20">20%</option>
                <option value="30" selected="selected">30%</option>
                <option value="40">40%</option>
                <option value="50">50%</option>
                <option value="55">55%</option>
                <option value="60">60%</option>
                <option value="70">70%</option>
                <option value="80">80%</option>
              </select>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <input id="general-class" type="checkbox" name="general-class" class="form-check-input"/>
              <label for="general-class"><?= $l['class'] ?>: <?= $l['class-general'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="rc-capacity-increase"><?= $l['cargo-cap-increase'] ?><?= $l['recycler'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="rc-capacity-increase" type="text" name="rc-capacity-increase" class="form-control m-0" value="0" alt="<?= $l['cargo-cap-increase'] ?><?= $l['recycler'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <input id="defense-to-debris" type="checkbox" name="defense-to-debris" class="form-check-input"/>
              <label for="defense-to-debris"><?= $l['defense-to-debris'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="deut-to-debris" type="checkbox" name="deut-to-debris" class="form-check-input"/>
              <label for="deut-to-debris"><?= $l['deut-to-debris'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="promo-moon" type="checkbox" name="promo-moon" class="form-check-input"/>
              <label for="promo-moon"><?= $l['promo-moon'] ?></label>
            </div>
          </div>
        </div><!-- /param-common -->

        <!-- Fleet tab -->
        <div id="param-fleet" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <p class="text-center small text-body-secondary mb-1"><?= $l['max-count-hint'] ?></p>
          <table class="mx-auto unit-table">
<?php foreach (array_chunk($moonFleet, 3) as $row): ?>
            <tr>
<?php foreach ($row as $unit): ?>
              <td><label for="<?= $unit ?>"><?= $l[$unit] ?></label></td>
              <td><label id="<?= $unit ?>-max" class="max-label">0</label></td>
              <td><input id="<?= $unit ?>" type="text" name="<?= $unit ?>" class="form-control form-control-sm d-inline-block count-input" value="0" alt="<?= $l[$unit] ?>"/></td>
<?php endforeach; ?>
            </tr>
<?php endforeach; ?>
          </table>
        </div><!-- /param-fleet -->

        <!-- Defenses tab -->
        <div id="param-defenses" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <p class="text-center small text-body-secondary mb-1"><?= $l['max-count-hint'] ?></p>
          <table class="mx-auto unit-table">
<?php foreach (array_chunk($moonDefenses, 3) as $row): ?>
            <tr>
<?php foreach ($row as $unit): ?>
              <td><label for="<?= $unit ?>"><?= $l[$unit] ?></label></td>
              <td><label id="<?= $unit ?>-max" class="max-label">0</label></td>
              <td><input id="<?= $unit ?>" type="text" name="<?= $unit ?>" class="form-control form-control-sm d-inline-block count-input" value="0" alt="<?= $l[$unit] ?>"/></td>
<?php endforeach; ?>
            </tr>
<?php endforeach; ?>
          </table>
        </div><!-- /param-defenses -->

      </div><!-- /paramTabContent -->
    </div>

    <!-- Results -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['calc-results'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['moon-create-chance'] ?></label></td>
          <td><div id="moon-create-chance" class="form-control form-control-sm d-inline-block chance-show">0%</div></td>
        </tr>
      </table>
    </div>

    <!-- Expenses -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['expences'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['metal'] ?></label></td>
          <td><div id="metal-required" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td><label><?= $l['crystal'] ?></label></td>
          <td><div id="crystal-required" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td><label><?= $l['deuterium'] ?></label></td>
          <td><div id="deuterium-required" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
        </tr>
      </table>
    </div>

    <!-- Recycling -->
    <div class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['recycling'] ?></b></p>
      <table class="mx-auto">
        <tr>
          <td><label><?= $l['metal'] ?></label></td>
          <td><div id="metal-recyclable" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td><label><?= $l['crystal'] ?></label></td>
          <td><div id="crystal-recyclable" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td><label><?= $l['deuterium'] ?></label></td>
          <td><div id="deuterium-recyclable" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
        </tr>
        <tr>
          <td><label><?= $l['total'] ?></label></td>
          <td><div id="debris-total" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td><label><?= $l['recyclers'] ?></label></td>
          <td><div id="recyclers" class="form-control form-control-sm d-inline-block resource-show">0</div></td>
          <td colspan="2">&nbsp;</td>
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
  initializeMoonCalculator();
});
</script>

</body>
</html>
