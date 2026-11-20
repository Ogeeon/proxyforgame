<?php declare(strict_types=1); ?>
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

  /**
   * One unit table: a row per unit with its count field, the count the
   * profile's planet has beside it, and what the merchant pays for the row;
   * the section's full cost and return under it.
   *
   * @param 'fleet'|'defense' $section
   * @param list<int> $ids
   * @param array<int, array{key: string, cost: list<int>}> $scrapUnits
   * @param array<array-key, mixed> $l The page's translations.
   */
  function scrapUnitTable(string $section, array $ids, array $scrapUnits, array $l): void {
    $title = Intl::string($l, $section === 'fleet' ? 'fleet' : 'defenses');
?>
      <p id="<?= $section ?>-planet-hint" class="text-center small text-body-secondary mb-1 d-none"><?= $l['planet-count-hint'] ?></p>
      <div class="pfg-scroll-x pfg-sticky-col">
        <table id="<?= $section ?>-table" class="lined mx-auto">
          <thead>
            <tr>
              <th rowspan="2" class="text-center"><?= $title ?></th>
              <th rowspan="2" class="text-center"><?= $l['quantity'] ?></th>
              <th colspan="3" class="text-center pfg-unsticky"><?= $l['payback'] ?></th>
            </tr>
            <tr>
              <th class="text-center pfg-unsticky"><?= $l['metal'] ?></th>
              <th class="text-center"><?= $l['crystal'] ?></th>
              <th class="text-center"><?= $l['deuterium'] ?></th>
            </tr>
          </thead>
          <tbody>
<?php foreach ($ids as $i => $id): $name = Intl::string($l, $scrapUnits[$id]['key']); ?>
            <tr class="<?= $i % 2 === 0 ? 'odd' : 'even' ?>">
              <td><label for="unit-<?= $id ?>"><?= $name ?></label></td>
              <td>
                <div class="d-flex align-items-center justify-content-end gap-1">
                  <span id="unit-<?= $id ?>-planet" class="planet-count d-none"></span>
                  <input id="unit-<?= $id ?>" type="text" name="unit-<?= $id ?>" class="form-control form-control-sm count-input" value="0" data-field-title="<?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?>">
                </div>
              </td>
              <td id="unit-<?= $id ?>-metal" class="text-end">0</td>
              <td id="unit-<?= $id ?>-crystal" class="text-end">0</td>
              <td id="unit-<?= $id ?>-deuterium" class="text-end">0</td>
            </tr>
<?php endforeach; ?>
          </tbody>
          <tfoot>
<?php foreach (['cost' => 'full-cost', 'payback' => 'payback'] as $kind => $caption): ?>
            <tr>
              <th colspan="2" class="text-end pfg-unsticky"><?= $l[$caption] ?></th>
<?php foreach (['metal', 'crystal', 'deuterium'] as $res): ?>
              <td id="<?= $section ?>-<?= $kind ?>-<?= $res ?>" class="text-end fw-semibold">0</td>
<?php endforeach; ?>
            </tr>
<?php endforeach; ?>
          </tfoot>
        </table>
      </div>
<?php
  }
?>
  <!-- Bootstrap 5 and Bootstrap Icons (CSS, icon font, JS bundle) -->
  <?php require_once '../../vendor.tpl'; ?>

  <!-- Custom styles -->
  <link type="text/css" href="/css/langs.css?v=<?php echo assetVersion($pfgPath, '/css/langs.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/css/common.css?v=<?php echo assetVersion($pfgPath, '/css/common.css'); ?>" rel="stylesheet">
  <link type="text/css" href="/ogame/calc/css/scrap.css?v=<?php echo assetVersion($pfgPath, '/ogame/calc/css/scrap.css'); ?>" rel="stylesheet">

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
  <script src="/ogame/calc/js/ogame-universe.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/ogame-universe.js'); ?>" defer></script>
  <script src="/ogame/calc/js/ogame-cargo.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/ogame-cargo.js'); ?>" defer></script>
  <script src="/ogame/calc/js/own-api.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/own-api.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-core.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-core.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-data-collector.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-data-collector.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-renderer.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-renderer.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-orchestration.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-orchestration.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-profile.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-profile.js'); ?>" defer></script>

<script type="module">
    // A module, so it runs after the deferred scripts above have defined `options`.
    // `options` is defined in scrap-orchestration.js; here we only fill in the
    // translation strings and the unit prices it reads.
    // A missing `options` means a deferred script never ran
    // (blocked or failed request): show the banner and stop instead of throwing
    // the ReferenceError Hawk logs as a separate group per symbol.
    if (typeof options === 'undefined') {
      pfgScriptsFailed();
    } else {
      options.decimalSeparator = <?= json_encode($l['decimal-separator']) ?>;
      options.unitSuffix = <?= json_encode($l['unit-suffix']) ?>;
      options.warnindDivId = 'warning';
      options.warnindMsgDivId = 'warning-message';
      options.fieldHint = <?= json_encode($l['field-hint']) ?>;
      options.msgMinConstraintViolated = <?= json_encode($l['msg-min-constraint-violated']) ?>;
      options.msgMaxConstraintViolated = <?= json_encode($l['msg-max-constraint-violated']) ?>;
      options.ownApiBadJsonMsg = <?= json_encode($l['own-api-bad-json-msg']) ?>;
      options.dialogOk = <?= json_encode($l['dialog-ok']) ?>;
      // Unit prices by tech id, [metal, crystal, deuterium] - data/costs-techs.json.
      options.prices = <?= json_encode((object) array_map(fn($unit) => $unit['cost'], $scrapUnits)) ?>;
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

<div id="scrap">
  <div class="border rounded">
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
    <div id="general-settings-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['parameters'] ?></p>
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
        <div class="d-flex align-items-center gap-1">
          <label for="scrap-rate"><?= $l['rate'] ?></label>
          <div class="input-group input-group-sm w-auto">
            <input id="scrap-rate" type="text" name="scrap-rate" class="form-control rate-input m-0" value="35" data-field-title="<?= htmlspecialchars($l['rate'], ENT_QUOTES, 'UTF-8') ?>">
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <input id="full-numbers" type="checkbox" name="full-numbers" class="form-check-input m-0">
          <label for="full-numbers"><?= $l['full-numbers'] ?></label>
        </div>
      </div>
      <label for="own-api-input" class="d-block text-center small text-body-secondary mb-1"><?= $l['import-hint'] ?></label>
      <div class="d-flex gap-2 align-items-start justify-content-center">
        <textarea id="own-api-input" class="form-control form-control-sm" rows="2" spellcheck="false"></textarea>
        <button id="own-api-import" type="button" class="btn btn-sm btn-outline-secondary"><?= $l['import'] ?></button>
      </div>
    </div>

    <!-- Results -->
    <div id="results-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['calc-results'] ?></p>
      <div class="pfg-scroll-x">
        <table id="summary-table" class="lined mx-auto">
          <thead>
            <tr>
              <th></th>
              <th class="text-center"><?= $l['metal'] ?></th>
              <th class="text-center"><?= $l['crystal'] ?></th>
              <th class="text-center"><?= $l['deuterium'] ?></th>
              <th class="text-center"><?= $l['msu'] ?></th>
            </tr>
          </thead>
          <tbody>
<?php foreach (['cost' => 'full-cost', 'payback' => 'payback'] as $kind => $caption): ?>
            <tr>
              <th class="text-end"><?= $l[$caption] ?></th>
<?php foreach (['metal', 'crystal', 'deuterium', 'msu'] as $res): ?>
              <td id="total-<?= $kind ?>-<?= $res ?>" class="text-end">0</td>
<?php endforeach; ?>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mt-2">
        <div class="d-flex align-items-center gap-1 text-nowrap">
          <span><?= $l['points-lost'] ?></span>
          <div id="points-lost" class="form-control form-control-sm w-auto resource-show ui-state-disabled">0</div>
        </div>
      </div>
      <p class="text-center mt-2 mb-1"><?= $l['transport'] ?> <span class="small text-body-secondary">(<?= $l['base-capacity'] ?>)</span></p>
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center">
        <div class="d-flex align-items-center gap-1 text-nowrap">
          <span><?= $l['small-cargo'] ?></span>
          <div id="transport-small" class="form-control form-control-sm w-auto resource-show ui-state-disabled">0</div>
        </div>
        <div class="d-flex align-items-center gap-1 text-nowrap">
          <span><?= $l['large-cargo'] ?></span>
          <div id="transport-large" class="form-control form-control-sm w-auto resource-show ui-state-disabled">0</div>
        </div>
      </div>
    </div>
  </div>

  <div class="scrap-sections mt-2">
    <!-- Fleet -->
    <div id="fleet-panel" class="border rounded p-2">
<?php scrapUnitTable('fleet', $scrapFleet, $scrapUnits, $l); ?>
    </div>

    <!-- Defenses and missiles -->
    <div id="defense-panel" class="border rounded p-2">
<?php scrapUnitTable('defense', $scrapDefenses, $scrapUnits, $l); ?>
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
  if (typeof bootstrapAvailable !== 'function' || !bootstrapAvailable() || typeof initializeScrapCalculator !== 'function' || typeof initScrapProfiles !== 'function') {
    pfgScriptsFailed();
    return;
  }
  attachTooltips(document);
  initializeScrapCalculator();
  initScrapProfiles();
});
</script>

</body>
</html>
