<!DOCTYPE html>
<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
  <meta http-equiv="Cache-Control" content="no-cache" />
  <title><?= $l['LOCA_TITLE'] ?></title>
  <meta name="description" content="<?= $l['LOCA_TITLE'] ?>"/>
  <meta name="keywords" content="<?= $l['keywords'] ?>"/>
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
  <link rel="icon" href="/favicon.ico" type="image/x-icon"/>
<?php
  if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com') {
    $pfgPath = $_SERVER['DOCUMENT_ROOT'];
  } else {
    $pfgPath = "D:\Programming\JS\pfg.wmp\www";
  };

  // Ships that can be sent on an expedition. The order must stay in sync with
  // EXPEDITION_SHIPS in expeditions-core.js, which indexes the life-form cargo
  // bonuses by it.
  $expeditionShips = array(
    array('small-cargo', 'SC', 202), array('large-cargo', 'LC', 203),
    array('light-fighter', 'LF', 204), array('heavy-fighter', 'HF', 205),
    array('cruiser', 'CR', 206), array('battleship', 'BS', 207),
    array('colony-ship', 'CS', 208), array('recycler', 'RC', 209),
    array('esp-probe', 'EP', 210), array('bomber', 'BM', 211),
    array('destroyer', 'DR', 213), array('death-star', 'DS', 214),
    array('battlecruiser', 'BC', 215), array('reaper', 'RE', 218),
    array('pathfinder', 'PA', 219)
  );

  // The fleet table lists the same ships grouped by role. Recyclers, colony
  // ships and death stars are never brought home, so they show a plain 0.
  $fleetRows = array(
    array('small-cargo', 'SC'), array('large-cargo', 'LC'),
    array('light-fighter', 'LF'), array('heavy-fighter', 'HF'),
    array('pathfinder', 'PA'), array('cruiser', 'CR'),
    array('battleship', 'BS'), array('battlecruiser', 'BC'),
    array('colony-ship', 'CS'), array('recycler', 'RC'),
    array('esp-probe', 'EP'), array('bomber', 'BM'),
    array('destroyer', 'DR'), array('death-star', 'DS'),
    array('reaper', 'RE')
  );
  $neverFound = array('CS', 'RC', 'DS');

  // API parameters, in the order the API table documents them.
  $apiDoc = array(
    array('u', $l['api_u'], 'int', '(ex.: 1, 191, ...)'),
    array('d', $l['api_d'], 'str', '(ex.: en, ru, ...)'),
    array('us', $l['api_us'], 'int', '(ex.: 1-10)'),
    array('c', $l['api_c'], 'int', $l['classes']),
    array('h', $l['api_h'], 'int', '(ex.: 0, 1,...)'),
    array('f', $l['api_f'], 'json', '(ex.: {"202":10,"203":15})'),
    array('pr', $l['api_pr'], 'float', '(ex.: 0-100)'),
    array('ps', $l['api_ps'], 'float', '(ex.: 0-100)'),
    array('bc', $l['api_bc'], 'float', '(ex.: 0-100)'),
    array('bd', $l['api_bd'], 'float', '(ex.: 0-100)'),
    array('rd', $l['resources-discovery-booster'], 'int', '(ex.: 0-40)'),
    array('dd', $l['dark-matter-discovery-bonus'], 'float', '(ex.: 0-100)')
  );
  $baseUrl = expeditionsBaseUrl();
?>
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet"/>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs_bs.css?v=<?php echo filemtime($pfgPath.'/css/langs_bs.css'); ?>" rel="stylesheet" />
  <link type="text/css" href="/css/common_bs.css?v=<?php echo filemtime($pfgPath.'/css/common_bs.css'); ?>" rel="stylesheet"/>
  <link type="text/css" href="/ogame/calc/css/expeditions_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/expeditions_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries and calculator modules -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/expeditions-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/expeditions-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/expeditions-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/expeditions-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/expeditions-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/expeditions-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/expeditions-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/expeditions-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // Parameters passed through the URL API. A null means "not passed", so the
    // calculator falls back to the options saved in the browser.
    var apiParams = {
      highTopIdx: <?= is_null($highTopIdx) ? 'null' : $highTopIdx ?>,
      universeSpeed: <?= $universeSpeed ? $universeSpeed : 'null' ?>,
      playerClass: <?= $strClass ? $strClass : 'null' ?>,
      hyperTechLevel: <?= $strHyper ? $strHyper : 'null' ?>,
      percentRes: <?= $percentResources ? $percentResources : 'null' ?>,
      percentShips: <?= $percentShip ? $percentShip : 'null' ?>,
      classBonusCollector: <?= $bonusCollector ? $bonusCollector : 'null' ?>,
      classBonusDiscoverer: <?= $bonusDiscoverer ? $bonusDiscoverer : 'null' ?>,
      resourceDiscoveryBooster: <?= $resourceDiscoveryBooster ? $resourceDiscoveryBooster : 'null' ?>,
      darkMatterDiscoveryBonus: <?= $darkMatterDiscoveryBonus ? $darkMatterDiscoveryBonus : 'null' ?>,
      fleet: <?= $jsonFleet ? json_encode($jsonFleet) : 'null' ?>
    };

    // `options` is defined in expeditions-orchestration.js; here we only fill in
    // the translation strings the renderer and the bonus reader use. They go
    // through json_encode because several locales carry apostrophes.
    options.decimalSeparator = <?= json_encode($l['decimal-separator'], JSON_UNESCAPED_UNICODE) ?>;
    options.locaYes = <?= json_encode($l['LOCA_YES'], JSON_UNESCAPED_UNICODE) ?>;
    options.locaNo = <?= json_encode($l['LOCA_NO'], JSON_UNESCAPED_UNICODE) ?>;
    options.smallCargoName = <?= json_encode($l['small-cargo'], JSON_UNESCAPED_UNICODE) ?>;
    options.missingSCName = <?= json_encode($l['no-sc-message'], JSON_UNESCAPED_UNICODE) ?>;
    options.largeCargoAbbrev = <?= json_encode($l['large-cargo-abbrev'], JSON_UNESCAPED_UNICODE) ?>;
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = <?= json_encode($l['field-hint'], JSON_UNESCAPED_UNICODE) ?>;
    options.msgMinConstraintViolated = <?= json_encode($l['msg-min-constraint-violated'], JSON_UNESCAPED_UNICODE) ?>;
    options.msgMaxConstraintViolated = <?= json_encode($l['msg-max-constraint-violated'], JSON_UNESCAPED_UNICODE) ?>;
  </script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('../../sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('../../topbar_bs.tpl'); ?>

<div id="expeditions">
  <div class="border rounded">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['LOCA_TITLE'] ?></div>
      <div id="reset" class="d-flex align-items-center justify-content-center bg-danger-subtle" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <!-- ================= Parameters ================= -->
    <div id="settings-panel" class="border rounded m-1 p-2 pb-1">
      <ul class="nav nav-tabs" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-common-tab" data-bs-toggle="tab" data-bs-target="#param-common" type="button" role="tab"><?= $l['param-tab-common'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-lf-tab" data-bs-toggle="tab" data-bs-target="#param-lf" type="button" role="tab"><?= $l['lifeforms'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">

        <!-- Common tab -->
        <div id="param-common" class="tab-pane fade show active p-2 pb-0" role="tabpanel">
          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <label for="highTop"><?= $l['LOCA_STRONGEST_CAP'] ?></label>
              <select id="highTop" name="highTop" class="form-select form-select-sm w-auto">
                <option value="40000">&lt; 10.000</option>
                <option value="500000">&lt; 100.000</option>
                <option value="1200000">&lt; 1.000.000</option>
                <option value="1800000">&lt; 5.000.000</option>
                <option value="2400000">&lt; 25.000.000</option>
                <option value="3000000">&lt; 50.000.000</option>
                <option value="3600000">&lt; 75.000.000</option>
                <option value="4200000">&lt; 100.000.000</option>
                <option value="5000000" selected="selected">&gt; 100.000.000</option>
              </select>
              <span><?= $l['LOCA_STRONGEST_CAP2'] ?></span>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <label for="player-class"><?= $l['LOCA_CLASS'] ?></label>
              <select id="player-class" name="player-class" class="form-select form-select-sm w-auto">
                <option value="0" selected="selected"><?= $l['LOCA_DISCOVERER'] ?></option>
                <option value="1"><?= $l['LOCA_COLLECTOR'] ?></option>
                <option value="2"><?= $l['LOCA_OTHER'] ?></option>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="universe-speed"><?= $l['LOCA_SPEED_FACTOR'] ?></label>
              <select id="universe-speed" name="universe-speed" class="form-select form-select-sm w-auto">
<?php for ($i = 1; $i <= 10; $i++): ?>
                <option value="<?= $i ?>"><?= $i ?></option>
<?php endfor; ?>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="tech-hyper-level"><?= $l['LOCA_TECH_HYPER'] ?></label>
              <input id="tech-hyper-level" type="text" name="tech-hyper-level" class="form-control form-control-sm level-input" value="0" alt="<?= $l['LOCA_TECH_HYPER'] ?>"/>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <label for="percent-resources"><?= $l['LOCA_PERCENT_RESOURCES'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="percent-resources" type="text" class="form-control m-0 percent-input" value="0" alt="<?= $l['LOCA_PERCENT_RESOURCES'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="percent-ships"><?= $l['LOCA_PERCENT_SHIP'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="percent-ships" type="text" class="form-control m-0 percent-input" value="0" alt="<?= $l['LOCA_PERCENT_SHIP'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
            <div class="d-flex align-items-center gap-1">
              <label for="class-bonus-collector"><?= $l['class-bonus-collector'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="class-bonus-collector" type="text" class="form-control m-0 percent-input" value="0" alt="<?= $l['class-bonus-collector'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="class-bonus-discoverer"><?= $l['class-bonus-discoverer'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="class-bonus-discoverer" type="text" class="form-control m-0 percent-input" value="0" alt="<?= $l['class-bonus-discoverer'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="dark-matter-discovery-bonus"><?= $l['dark-matter-discovery-bonus'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="dark-matter-discovery-bonus" type="text" class="form-control m-0 percent-input" value="0" alt="<?= $l['dark-matter-discovery-bonus'] ?>"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="resource-discovery-booster"><?= $l['resources-discovery-booster'] ?></label>
              <select id="resource-discovery-booster" class="form-select form-select-sm w-auto">
<?php for ($r = 0; $r <= 40; $r += 5): ?>
                <option value="<?= $r ?>"<?= $r === 0 ? ' selected="selected"' : '' ?>><?= $r ?>%</option>
<?php endfor; ?>
              </select>
            </div>
          </div>
        </div><!-- /param-common -->

        <!-- LifeForms tab -->
        <div id="param-lf" class="tab-pane fade p-2 pb-0" role="tabpanel">
          <div class="text-end mb-1">
            <button id="open-lfbr" type="button" class="btn btn-sm btn-outline-primary"><?= $l['open-lfbr'] ?></button>
          </div>
          <table id="lf-ships-bonuses" class="lined mx-auto">
            <tr>
              <th><?= $l['ship-name'] ?></th>
              <th><?= $l['cargo-increase'] ?></th>
            </tr>
<?php foreach ($expeditionShips as $idx => $ship): ?>
            <tr class="<?= ($idx % 2) === 0 ? 'odd' : 'even' ?>">
              <td><label for="lf-cargo-<?= $ship[2] ?>"><?= $l[$ship[0]] ?></label></td>
              <td class="centered"><input id="lf-cargo-<?= $ship[2] ?>" type="text" class="form-control form-control-sm d-inline-block no-mp input-5columns centered" value="0" alt="<?= $l[$ship[0]] ?>"/></td>
            </tr>
<?php endforeach; ?>
          </table>
        </div><!-- /param-lf -->

      </div><!-- /paramTabContent -->
    </div>

    <!-- ================= Results ================= -->
    <div id="data-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><b><?= $l['calc-results'] ?></b></p>

      <table id="data-table" class="lined mx-auto">
        <tr>
          <th class="centered"><?= $l['LOCA_SHIP_TYPE'] ?></th>
          <th class="centered">
            <button id="clear-fleet" type="button" class="btn btn-sm btn-outline-danger clear-fleet-btn" data-bs-toggle="tooltip" title="<?= $l['reset'] ?>"><i class="bi bi-x-lg"></i></button>
            <?= $l['LOCA_NUMBER'] ?>
          </th>
          <th class="centered"><?= $l['LOCA_SHIP_CAN_BE_FOND'] ?></th>
          <th class="centered"><?= $l['LOCA_DISCOVERED'] ?></th>
        </tr>
<?php foreach ($fleetRows as $idx => $ship): ?>
        <tr class="<?= ($idx % 2) === 0 ? 'odd' : 'even' ?>">
          <td><label for="num<?= $ship[1] ?>"><?= $l[$ship[0]] ?></label></td>
          <td class="centered"><input id="num<?= $ship[1] ?>" type="text" class="form-control form-control-sm d-inline-block count-input" value="0" alt="<?= $l[$ship[0]] ?>"/></td>
          <td class="centered"><span id="can<?= $ship[1] ?>">-</span></td>
          <td class="centered"><?= in_array($ship[1], $neverFound) ? '0' : '<span id="find'.$ship[1].'">0</span>' ?></td>
        </tr>
<?php endforeach; ?>
        <tr class="odd">
          <td colspan="2"><?= $l['LOCA_SI_NEW'] ?></td>
          <td colspan="2" class="right-aligned"><span id="max-points">0</span></td>
        </tr>
        <tr class="even">
          <td colspan="2"><?= $l['LOCA_STORAGE'] ?></td>
          <td colspan="2" class="right-aligned"><span id="storage-capacity">0</span></td>
        </tr>
        <tr class="odd">
          <td colspan="2"><?= $l['LOCA_RES_FIND'] ?></td>
          <td class="right-aligned">
            <?= $l['LOCA_M'] ?><br>
            <?= $l['LOCA_K'] ?><br>
            <?= $l['LOCA_D'] ?>
          </td>
          <td class="right-aligned">
            <span id="max-find-met">0</span><br>
            <span id="max-find-cry">0</span><br>
            <span id="max-find-deu">0</span>
          </td>
        </tr>
        <tr class="even">
          <td colspan="2"><?= $l['LOCA_DM'] ?></td>
          <td colspan="2" class="right-aligned"><span id="dark-matter-find">0</span></td>
        </tr>
      </table>
    </div>

    <!-- ================= URL API ================= -->
    <div class="accordion m-1" id="api-accordion">
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#accordion-api">API</button>
        </h2>
        <div id="accordion-api" class="accordion-collapse collapse" data-bs-parent="#api-accordion">
          <div class="accordion-body">
            <table id="api-table" class="lined w-100">
              <tr>
                <th><?= $l['api_param'] ?></th>
                <th><?= $l['api_prm_meaning'] ?></th>
                <th><?= $l['api_prm_type'] ?></th>
                <th><?= $l['api_prm_explain'] ?></th>
              </tr>
<?php foreach ($apiDoc as $idx => $prm): ?>
              <tr class="<?= ($idx % 2) === 0 ? 'odd' : 'even' ?>">
                <td class="centered"><?= $prm[0] ?></td>
                <td><?= $prm[1] ?></td>
                <td><?= $prm[2] ?></td>
                <td><?= $prm[3] ?></td>
              </tr>
<?php endforeach; ?>
              <tr>
                <td colspan="4" class="centered"><b><?= $l['examples'] ?></b></td>
              </tr>
              <tr class="odd">
                <td colspan="3"><a href="<?= $baseUrl ?>?u=1&amp;d=ru"><?= $baseUrl ?>?u=1&amp;d=ru</a></td>
                <td><?= $l['auto_select'] ?></td>
              </tr>
              <tr class="even">
                <td colspan="3"><a href='<?= $baseUrl ?>?u=1&d=ru&h=8&c=0&f={"203":2140,"219":1,"210":1,"218":1}&pr=10.9&ps=9.89&bc=10.5&bd=60.7&rd=20&dd=50'><?= $baseUrl ?>?u=1&amp;d=ru<br>&amp;h=8&amp;c=0<br>&amp;f={"203":2140,"219":1,"210":1,"218":1}<br>&amp;pr=10.9&amp;ps=9.89&amp;bc=10.5&amp;bd=60.7&amp;rd=20&amp;dd=50</a></td>
                <td><?= $l['all_options'] ?></td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="warning">
    <div id="warning-message"></div>
  </div>
</div>

<!-- Lifeform bonuses reader modal -->
<div class="modal fade" id="lf-bonuses-reader" tabindex="-1" aria-labelledby="lf-bonuses-reader-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="lf-bonuses-reader-label"><?= $l['lf-bonuses-reader-hdr'] ?></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="mb-2"><?= $l['lf-bonuses-reader-info'] ?></div>
        <textarea id="lf-bonuses-txtarea" class="form-control" rows="8"></textarea>
      </div>
      <div class="modal-footer">
        <button id="lf-bonuses-read-btn" type="button" class="btn btn-primary"><?= $l['read'] ?></button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['cancel'] ?></button>
      </div>
    </div>
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
  initializeExpeditionsCalculator();
});
</script>

</body>
</html>
