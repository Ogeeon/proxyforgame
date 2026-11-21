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
   * the section's full cost and return under it. The tab above it names the
   * section, so the first column is headed the way costs heads its tables.
   *
   * @param 'fleet'|'defense' $section
   * @param list<int> $ids
   * @param array<int, array{key: string, cost: list<int>}> $scrapUnits
   * @param array<array-key, mixed> $l The page's translations.
   */
  function scrapUnitTable(string $section, array $ids, array $scrapUnits, array $l): void {
    $title = Intl::string($l, $section === 'fleet' ? 'ship' : 'building');
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
  <script src="/ogame/calc/js/flight-core.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/flight-core.js'); ?>" defer></script>
  <script src="/ogame/calc/js/own-api.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/own-api.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-core.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-core.js'); ?>" defer></script>
  <script src="/ogame/calc/js/scrap-fleetsave.js?v=<?php echo assetVersion($pfgPath, '/ogame/calc/js/scrap-fleetsave.js'); ?>" defer></script>
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
      options.thousandsSeparator = <?= json_encode($l['thousands-separator']) ?>;
      options.unitSuffix = <?= json_encode($l['unit-suffix']) ?>;
      options.warnindDivId = 'warning';
      options.warnindMsgDivId = 'warning-message';
      options.fieldHint = <?= json_encode($l['field-hint']) ?>;
      options.msgMinConstraintViolated = <?= json_encode($l['msg-min-constraint-violated']) ?>;
      options.msgMaxConstraintViolated = <?= json_encode($l['msg-max-constraint-violated']) ?>;
      options.ownApiBadJsonMsg = <?= json_encode($l['own-api-bad-json-msg']) ?>;
      options.dialogOk = <?= json_encode($l['dialog-ok']) ?>;
      options.verdictWait = <?= json_encode($l['verdict-wait']) ?>;
      options.verdictSell = <?= json_encode($l['verdict-sell']) ?>;
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

    <!-- What to sell: the fleet and the defenses, a tab each. Which tab is
         open is not saved: the fleet is shown on every load. -->
    <div id="sell-panel" class="border rounded m-1 p-2">
      <p class="border rounded subheader bg-primary-subtle"><?= $l['what-to-sell'] ?></p>
      <ul class="nav nav-tabs nav-tabs-sm" id="sellTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="sell-fleet-tab" data-bs-toggle="tab" data-bs-target="#sell-fleet" type="button" role="tab" aria-controls="sell-fleet" aria-selected="true"><?= $l['fleet'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="sell-defense-tab" data-bs-toggle="tab" data-bs-target="#sell-defense" type="button" role="tab" aria-controls="sell-defense" aria-selected="false"><?= $l['defenses'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="sellTabContent">
        <div class="tab-pane fade show active pt-2" id="sell-fleet" role="tabpanel" aria-labelledby="sell-fleet-tab">
<?php scrapUnitTable('fleet', $scrapFleet, $scrapUnits, $l); ?>
        </div>
        <div class="tab-pane fade pt-2" id="sell-defense" role="tabpanel" aria-labelledby="sell-defense-tab">
<?php scrapUnitTable('defense', $scrapDefenses, $scrapUnits, $l); ?>
        </div>
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
      <!-- The cargo ships to haul the return away: the counts in the header,
           collapsed on every load (the open state is not saved). -->
      <div class="accordion mt-2" id="transport-accordion">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button id="transport-toggle" class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#transport-body" aria-expanded="false" aria-controls="transport-body">
              <span><?= $l['transport'] ?>: <?= $l['sc-short'] ?>&nbsp;<span id="transport-small-head">0</span> / <?= $l['lc-short'] ?>&nbsp;<span id="transport-large-head">0</span></span>
            </button>
          </h2>
          <div id="transport-body" class="accordion-collapse collapse">
            <div class="accordion-body">
              <!-- What the holds take: the controls and keys of the cost
                   calculator, so a profile binds them the same way. -->
              <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-2">
                <div class="d-flex align-items-center gap-1">
                  <label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label>
                  <input id="hyper-tech-level" type="text" name="hyper-tech-level" class="form-control form-control-sm level-input" value="0" data-field-title="<?= htmlspecialchars($l['hyper-tech'], ENT_QUOTES, 'UTF-8') ?>">
                </div>
                <!-- Only the Collector raises a small or large cargo's hold, so
                     the class is one box; the enhancement stays enabled, as in
                     costs, and counts only while the box is ticked. -->
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <div class="d-flex align-items-center gap-1">
                    <input id="collector-class" type="checkbox" name="collector-class" class="form-check-input m-0">
                    <label for="collector-class"><?= $l['class'] ?>: <?= $l['class-collector'] ?></label>
                  </div>
                  <div class="d-flex align-items-center gap-1">
                    <label for="lf-collector-class-bonus"><?= $l['lf-class-bonus'] ?></label>
                    <div class="input-group input-group-sm w-auto">
                      <input id="lf-collector-class-bonus" type="text" name="lf-collector-class-bonus" class="form-control level-input m-0" value="0" data-field-title="<?= htmlspecialchars($l['collectors-character-bonus'], ENT_QUOTES, 'UTF-8') ?>">
                      <span class="input-group-text">%</span>
                    </div>
                    <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= htmlspecialchars($l['lf-class-bonus-hint'], ENT_QUOTES, 'UTF-8') ?>"></i>
                  </div>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-2">
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <span><?= $l['cargo-cap-increase'] ?></span>
                  <div class="d-flex align-items-center gap-1">
                    <label for="sc-capacity-increase"><?= $l['sc-short'] ?></label>
                    <div class="input-group input-group-sm w-auto">
                      <input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="form-control level-input m-0" value="0" data-field-title="<?= htmlspecialchars(Intl::string($l, 'cargo-cap-increase') . Intl::string($l, 'sc-short'), ENT_QUOTES, 'UTF-8') ?>">
                      <span class="input-group-text">%</span>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-1">
                    <label for="lc-capacity-increase"><?= $l['lc-short'] ?></label>
                    <div class="input-group input-group-sm w-auto">
                      <input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="form-control level-input m-0" value="0" data-field-title="<?= htmlspecialchars(Intl::string($l, 'cargo-cap-increase') . Intl::string($l, 'lc-short'), ENT_QUOTES, 'UTF-8') ?>">
                      <span class="input-group-text">%</span>
                    </div>
                  </div>
                </div>
              </div>
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
        </div>
      </div>
      <!-- Sell now or wait for the merchant's event: the flying ships, each
           weighed against the deuterium its fleet saves burn until then. The
           counts of the advice in the header; collapsed on every load. -->
      <div class="accordion mt-2" id="sell-timing-accordion">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button id="sell-timing-toggle" class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#sell-timing-body" aria-expanded="false" aria-controls="sell-timing-body">
              <span><?= $l['sell-timing'] ?>&ensp;<?= $l['verdict-wait'] ?>:&nbsp;<span id="sell-timing-wait-head">0</span> / <?= $l['verdict-sell'] ?>:&nbsp;<span id="sell-timing-sell-head">0</span></span>
            </button>
          </h2>
          <div id="sell-timing-body" class="accordion-collapse collapse">
            <div class="accordion-body">
              <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
                <div class="d-flex align-items-center gap-1">
                  <label for="event-rate"><?= $l['event-rate'] ?></label>
                  <div class="input-group input-group-sm w-auto">
                    <input id="event-rate" type="text" name="event-rate" class="form-control rate-input m-0" value="81" data-field-title="<?= htmlspecialchars($l['event-rate'], ENT_QUOTES, 'UTF-8') ?>">
                    <span class="input-group-text">%</span>
                  </div>
                  <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= htmlspecialchars($l['event-rate-hint'], ENT_QUOTES, 'UTF-8') ?>"></i>
                </div>
                <div class="d-flex align-items-center gap-1">
                  <label for="event-days"><?= $l['event-days'] ?></label>
                  <input id="event-days" type="text" name="event-days" class="form-control form-control-sm level-input" value="180" data-field-title="<?= htmlspecialchars($l['event-days'], ENT_QUOTES, 'UTF-8') ?>">
                </div>
              </div>
              <!-- The fleet save: where to, how fast, how often, with which drives. -->
              <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
                <div class="d-flex align-items-center gap-1">
                  <label for="route-kind"><?= $l['fs-route'] ?></label>
                  <select id="route-kind" name="route-kind" class="form-select form-select-sm w-auto">
<?php foreach (['system', 'systems', 'galaxies'] as $kind): ?>
                    <option value="<?= $kind ?>"<?= $kind === 'galaxies' ? ' selected' : '' ?>><?= $l['route-' . $kind] ?></option>
<?php endforeach; ?>
                  </select>
                </div>
                <div class="d-flex align-items-center gap-1">
                  <label for="route-delta"><?= $l['route-delta'] ?></label>
                  <input id="route-delta" type="text" name="route-delta" class="form-control form-control-sm level-input" value="1" data-field-title="<?= htmlspecialchars($l['route-delta'], ENT_QUOTES, 'UTF-8') ?>">
                </div>
                <div class="d-flex align-items-center gap-1">
                  <label for="fs-speed"><?= $l['speed'] ?></label>
                  <!-- The class's speed steps: the page rebuilds the list for a General's profile. -->
                  <select id="fs-speed" name="fs-speed" class="form-select form-select-sm w-auto">
<?php for ($percent = 100; $percent > 0; $percent -= 10): ?>
                    <option value="<?= $percent ?>"<?= $percent === 10 ? ' selected' : '' ?>><?= $percent ?>%</option>
<?php endfor; ?>
                  </select>
                </div>
                <div class="d-flex align-items-center gap-1">
                  <label for="fs-times"><?= $l['fs-frequency'] ?></label>
                  <input id="fs-times" type="text" name="fs-times" class="form-control form-control-sm level-input" value="1" data-field-title="<?= htmlspecialchars($l['fs-frequency'], ENT_QUOTES, 'UTF-8') ?>">
                  <label for="fs-days"><?= $l['fs-times-every'] ?></label>
                  <input id="fs-days" type="text" name="fs-days" class="form-control form-control-sm level-input" value="1" data-field-title="<?= htmlspecialchars($l['fs-days'], ENT_QUOTES, 'UTF-8') ?>">
                  <span><?= $l['fs-days'] ?></span>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
<?php foreach (['cmb-drive', 'imp-drive', 'hyp-drive'] as $drive): ?>
                <div class="d-flex align-items-center gap-1">
                  <label for="<?= $drive ?>"><?= $l[$drive] ?></label>
                  <input id="<?= $drive ?>" type="text" name="<?= $drive ?>" class="form-control form-control-sm level-input" value="0" data-field-title="<?= htmlspecialchars($l[$drive], ENT_QUOTES, 'UTF-8') ?>">
                </div>
<?php endforeach; ?>
              </div>
              <div class="d-flex flex-wrap gap-3 align-items-center justify-content-center mb-2">
                <!-- Without a profile one discount stands for the class and the
                     life forms; a profile gives them apart, and hides it. -->
                <div id="fuel-discount-box" class="d-flex align-items-center gap-1">
                  <label for="fuel-discount"><?= $l['fuel-discount'] ?></label>
                  <div class="input-group input-group-sm w-auto">
                    <input id="fuel-discount" type="text" name="fuel-discount" class="form-control level-input m-0" value="0" data-field-title="<?= htmlspecialchars($l['fuel-discount'], ENT_QUOTES, 'UTF-8') ?>">
                    <span class="input-group-text">%</span>
                  </div>
                  <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= htmlspecialchars($l['fuel-discount-hint'], ENT_QUOTES, 'UTF-8') ?>"></i>
                </div>
                <span id="fuel-discount-profile" class="small text-body-secondary d-none"><?= $l['fuel-discount-profile'] ?></span>
                <div class="d-flex align-items-center gap-1">
                  <label for="exchange-rates-m"><?= $l['exchange-rates'] ?>:</label>
<?php
  $rateTitle = static fn(string $res): string => htmlspecialchars(Intl::string($l, 'exchange-rates') . ' - ' . Intl::string($l, $res), ENT_QUOTES, 'UTF-8');
?>
                  <input id="exchange-rates-m" type="text" name="exchange-rates-m" class="form-control form-control-sm level-input" value="1" data-field-title="<?= $rateTitle('metal') ?>">:
                  <input id="exchange-rates-c" type="text" name="exchange-rates-c" class="form-control form-control-sm level-input" value="1.5" aria-label="<?= $rateTitle('crystal') ?>" data-field-title="<?= $rateTitle('crystal') ?>">:
                  <input id="exchange-rates-d" type="text" name="exchange-rates-d" class="form-control form-control-sm level-input" value="3" aria-label="<?= $rateTitle('deuterium') ?>" data-field-title="<?= $rateTitle('deuterium') ?>">
                </div>
              </div>
              <div class="pfg-scroll-x">
                <table id="sell-timing-table" class="lined mx-auto">
                  <thead>
                    <tr>
                      <th class="text-center"><?= $l['ship'] ?></th>
                      <th class="text-center"><?= $l['fuel-per-day'] ?></th>
                      <th class="text-center"><?= $l['break-even'] ?> <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= htmlspecialchars($l['break-even-hint'], ENT_QUOTES, 'UTF-8') ?>"></i></th>
                      <th class="text-center"><?= $l['wait-gain'] ?>, <?= $l['msu'] ?></th>
                      <th class="text-center"><?= $l['verdict'] ?></th>
                    </tr>
                  </thead>
                  <tbody id="sell-timing-rows">
                    <tr id="sell-timing-empty"><td colspan="5" class="text-center text-body-secondary"><?= $l['sell-timing-no-ships'] ?></td></tr>
                  </tbody>
                </table>
              </div>
              <div class="d-flex flex-wrap gap-1 align-items-center justify-content-center mt-2">
                <span><?= $l['sell-timing-gain'] ?></span>
                <div id="sell-timing-gain" class="form-control form-control-sm w-auto resource-show ui-state-disabled">0</div>
                <span><?= $l['msu'] ?></span>
              </div>
              <ul id="sell-timing-notes" class="small text-body-secondary mt-2 mb-0">
<?php foreach (['risk', 'split', 'empty', 'free'] as $note): ?>
                <li><?= $l['sell-timing-note-' . $note] ?></li>
<?php endforeach; ?>
              </ul>
            </div>
          </div>
        </div>
      </div>
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
