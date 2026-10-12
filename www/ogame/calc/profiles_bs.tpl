<?php
// Player profiles: the selector in the top bar and its dialogs (ADR-0004).
// Included by topbar_bs.tpl on a calculator page that sets $profilesCalc to its
// own name before including the top bar; the scripts (profiles-core.js,
// profiles-store.js, profiles-ui.js) are loaded by the calculator template
// itself, so its TypeScript project sees them.
require_once __DIR__ . '/universes.inc.php';
$pfCountries = loadUniverseCountries($lang);
$pfUniverses = loadUniverses($pfCountries);
$pfCountryList = array_map(fn($row) => array($row['lang'], $row['name']), $pfCountries ?: array());

// One universe picker, rendered twice (import and properties dialogs).
$pfUniversePicker = function ($prefix) use ($l) {
?>
  <div class="d-flex flex-wrap gap-2 align-items-center">
    <div class="d-flex align-items-center gap-1">
      <label for="<?= $prefix ?>-country"><?= $l['country'] ?></label>
      <select id="<?= $prefix ?>-country" class="form-select form-select-sm w-auto pf-country"></select>
    </div>
    <div class="d-flex align-items-center gap-1">
      <label for="<?= $prefix ?>-universe"><?= $l['universe'] ?></label>
      <select id="<?= $prefix ?>-universe" class="form-select form-select-sm w-auto pf-universe"></select>
    </div>
  </div>
<?php
};
?>
<div id="pf-selector" class="d-flex align-items-center gap-1" data-calc="<?= htmlspecialchars($profilesCalc, ENT_QUOTES) ?>">
  <label for="pf-select" class="text-nowrap"><i class="bi bi-person-badge" aria-hidden="true"></i><span class="d-none d-sm-inline"> <?= $l['profile'] ?></span></label>
  <select id="pf-select" class="form-select form-select-sm w-auto"></select>
  <span id="pf-overrides" class="badge text-bg-warning d-none" data-bs-toggle="tooltip" title=""></span>
</div>

<script>
  var pfgProfileText = <?= json_encode(array(
    'noProfile' => $l['pf-no-profile'],
    'actImport' => $l['pf-import'],
    'actCreate' => $l['pf-create'],
    'actManage' => $l['pf-manage'],
    'errJson' => $l['pf-import-err-json'],
    'errShape' => $l['pf-import-err-shape'],
    'errSchema' => $l['pf-import-err-schema'],
    'pickUniverse' => $l['pf-pick-universe'],
    'importDone' => $l['pf-import-done'],
    'nameRequired' => $l['pf-name-required'],
    'deleteConfirm' => $l['pf-delete-confirm'],
    'mergeConfirm' => $l['pf-merge-confirm'],
    'mergeSame' => $l['pf-merge-same'],
    'restoreConflict' => $l['pf-restore-conflict'],
    'restoreDone' => $l['pf-restore-done'],
    'fileErr' => $l['pf-file-err'],
    'storageUnavailable' => $l['pf-storage-unavailable'],
    'saveFailed' => $l['pf-save-failed'],
    'migrateText' => $l['pf-migrate-text'],
    'migrateDone' => $l['pf-migrate-done'],
    'migrateNone' => $l['pf-migrate-none'],
    'overrides' => $l['pf-overrides'],
    'resetAll' => $l['pf-reset-profile'],
    'account' => $l['pf-account'],
    'inGame' => $l['pf-in-game'],
    'resetValue' => $l['pf-reset-value'],
    'edit' => $l['pf-edit'],
    'delete' => $l['universe-delete'],
    'noUniverse' => $l['pf-no-universe'],
    'locked' => $l['pf-universe-locked'],
    'attention' => $l['dialog-attention'],
    'ok' => $l['dialog-ok'],
    'done' => $l['done'],
    'later' => $l['pf-migrate-later'],
    'confirm' => $l['dialog-confirm'],
    'cancel' => $l['cancel'],
    'replace' => $l['pf-replace'],
    'skip' => $l['pf-skip'],
  ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  var pfgCountries = <?= json_encode($pfCountryList, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  var pfgUniverses = <?= universesJs($pfUniverses) ?>;
</script>

<!-- Import an account export -->
<div class="modal fade" role="dialog" id="pf-import-modal" tabindex="-1" aria-labelledby="pf-import-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title fs-5" id="pf-import-label"><?= $l['pf-import-hdr'] ?></h3>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= $l['cancel'] ?>"></button>
      </div>
      <div class="modal-body">
        <p class="small mb-2"><?= $l['pf-import-hint'] ?></p>
        <textarea id="pf-import-text" class="form-control form-control-sm mb-2" rows="5" aria-label="<?= $l['pf-import-hdr'] ?>"></textarea>
        <div class="d-flex align-items-center gap-2 mb-2">
          <label for="pf-import-file" class="text-nowrap"><?= $l['pf-file'] ?></label>
          <input id="pf-import-file" type="file" accept=".json,application/json" class="form-control form-control-sm">
        </div>
        <div id="pf-import-universe-box" class="border rounded p-2 mb-2 d-none">
          <p class="small mb-1"><?= $l['pf-import-universe-hint'] ?></p>
          <?php $pfUniversePicker('pf-import'); ?>
        </div>
        <div id="pf-import-error" class="text-danger small d-none" role="alert"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['cancel'] ?></button>
        <button type="button" id="pf-import-go" class="btn btn-primary"><?= $l['pf-import-btn'] ?></button>
      </div>
    </div>
  </div>
</div>

<!-- Create a profile / edit its name and universe -->
<div class="modal fade" role="dialog" id="pf-props-modal" tabindex="-1" aria-labelledby="pf-props-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title fs-5" id="pf-props-label"><?= $l['pf-props-hdr'] ?></h3>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= $l['cancel'] ?>"></button>
      </div>
      <div class="modal-body">
        <div class="d-flex align-items-center gap-2 mb-2">
          <label for="pf-props-name"><?= $l['pf-name'] ?></label>
          <input id="pf-props-name" type="text" maxlength="60" class="form-control form-control-sm">
        </div>
        <p class="small mb-1"><?= $l['pf-universe-optional'] ?></p>
        <?php $pfUniversePicker('pf-props'); ?>
        <p id="pf-props-locked" class="small text-body-secondary mt-1 mb-0 d-none"><?= $l['pf-universe-locked'] ?></p>
        <div id="pf-props-error" class="text-danger small mt-2 d-none" role="alert"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['cancel'] ?></button>
        <button type="button" id="pf-props-go" class="btn btn-primary"><?= $l['universe-save'] ?></button>
      </div>
    </div>
  </div>
</div>

<!-- Manage the profiles -->
<div class="modal fade" role="dialog" id="pf-manage-modal" tabindex="-1" aria-labelledby="pf-manage-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title fs-5" id="pf-manage-label"><?= $l['pf-manage-hdr'] ?></h3>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= $l['cancel'] ?>"></button>
      </div>
      <div class="modal-body">
        <table class="table table-sm align-middle mb-2">
          <thead>
            <tr><th scope="col"><?= $l['pf-name'] ?></th><th scope="col"><?= $l['universe'] ?></th><th scope="col"><?= $l['pf-source'] ?></th><th scope="col"></th></tr>
          </thead>
          <tbody id="pf-manage-rows"></tbody>
        </table>
        <div class="border rounded p-2 mb-2">
          <div class="fw-semibold mb-1"><?= $l['pf-merge-hdr'] ?></div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <select id="pf-merge-from" class="form-select form-select-sm w-auto" aria-label="<?= $l['pf-merge-from'] ?>"></select>
            <span><?= $l['pf-merge-into'] ?></span>
            <select id="pf-merge-into" class="form-select form-select-sm w-auto" aria-label="<?= $l['pf-merge-into'] ?>"></select>
            <button type="button" id="pf-merge-go" class="btn btn-outline-secondary btn-sm"><?= $l['pf-merge'] ?></button>
          </div>
          <p class="small text-body-secondary mt-1 mb-0"><?= $l['pf-merge-hint'] ?></p>
        </div>
        <div class="border rounded p-2">
          <div class="fw-semibold mb-1"><?= $l['pf-backup-hdr'] ?></div>
          <p class="small mb-2"><?= $l['pf-backup-hint'] ?></p>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button type="button" id="pf-backup-download" class="btn btn-outline-secondary btn-sm"><i class="bi bi-download"></i> <?= $l['pf-backup-download'] ?></button>
            <label for="pf-backup-restore" class="btn btn-outline-secondary btn-sm mb-0"><i class="bi bi-upload"></i> <?= $l['pf-backup-restore'] ?></label>
            <input id="pf-backup-restore" type="file" accept=".json,application/json" class="d-none">
            <button type="button" id="pf-migrate-open" class="btn btn-outline-secondary btn-sm d-none"><?= $l['pf-migrate-btn'] ?></button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal"><?= $l['done'] ?></button>
      </div>
    </div>
  </div>
</div>

<!-- Choose which values go back to the game's -->
<div class="modal fade" role="dialog" id="pf-reset-modal" tabindex="-1" aria-labelledby="pf-reset-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title fs-5" id="pf-reset-label"><?= $l['pf-reset-hdr'] ?></h3>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= $l['cancel'] ?>"></button>
      </div>
      <div class="modal-body">
        <p class="small mb-2"><?= $l['pf-reset-hint'] ?></p>
        <table class="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th scope="col"><input id="pf-reset-all" type="checkbox" class="form-check-input" checked aria-label="<?= $l['pf-select-all'] ?>"></th>
              <th scope="col"><?= $l['pf-col-where'] ?></th>
              <th scope="col"><?= $l['pf-col-field'] ?></th>
              <th scope="col" class="text-end"><?= $l['pf-col-game'] ?></th>
              <th scope="col" class="text-end"><?= $l['pf-col-current'] ?></th>
            </tr>
          </thead>
          <tbody id="pf-reset-rows"></tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['cancel'] ?></button>
        <button type="button" id="pf-reset-go" class="btn btn-primary"><?= $l['pf-reset-selected'] ?></button>
      </div>
    </div>
  </div>
</div>

<!-- Convert the old saved sets -->
<div class="modal fade" role="dialog" id="pf-migrate-modal" tabindex="-1" aria-labelledby="pf-migrate-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title fs-5" id="pf-migrate-label"><?= $l['pf-migrate-hdr'] ?></h3>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?= $l['cancel'] ?>"></button>
      </div>
      <div class="modal-body">
        <p id="pf-migrate-body" class="mb-2"></p>
        <ul id="pf-migrate-list" class="small mb-0"></ul>
        <div id="pf-migrate-result" class="d-none">
          <p id="pf-migrate-result-text" class="mb-2"></p>
          <button type="button" id="pf-migrate-backup" class="btn btn-outline-secondary btn-sm"><i class="bi bi-download"></i> <?= $l['pf-backup-download'] ?></button>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" id="pf-migrate-later" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['pf-migrate-later'] ?></button>
        <button type="button" id="pf-migrate-go" class="btn btn-primary"><?= $l['pf-migrate-btn'] ?></button>
      </div>
    </div>
  </div>
</div>
