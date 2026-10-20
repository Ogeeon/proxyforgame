<div id="topbar" class="d-flex align-items-center gap-2 px-3">
  <?php // The two side columns share the free space equally, so the profile selector between them sits on the panel's centre line. ?>
  <div class="topbar-side"></div>
  <?php if (!empty($withProfiles)) { require_once __DIR__ . '/ogame/calc/profiles_bs.tpl'; } // NOSONAR ?>
  <div class="topbar-side d-flex align-items-center justify-content-end gap-2">
    <div id="vtablet">
      <?php require_once 'toggle_bs.tpl'; // NOSONAR ?>
    </div>
    <div class="d-none d-md-block"></div>
    <div id="vtablel">
      <?php require_once 'langs_bs.tpl'; // NOSONAR ?>
    </div>
  </div>
</div>
