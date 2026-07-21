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
  <link type="text/css" href="/ogame/calc/css/production_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/production_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>

  <!-- DOM utilities (jQuery replacement) -->
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>

  <!-- Production calculator modules -->
  <script type="text/javascript" src="/ogame/calc/js/production-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/production-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/production-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/production-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/production-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/production-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/production-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/production-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    var options = {
      defConstraints: {
        min: -Infinity,
        max: Infinity,
        def: 0,
        allowFloat: false,
        allowNegative: false
      },
      rowsToTechs: [1, 2, 3, 4, 12, 212, 218, 0, 0, 0, 0, 0, 0, 0],
      minPlanetsCount: 1,
      maxPlanetsCount: 99,
      defPlanetsCount: 8,
      metStorageCap: 0,
      crysStorageCap: 0,
      deutStorageCap: 0,
      storageBlinkCount: 0,
      storagesBlinking: false,
      storagesToBlink: [0, 0, 0],
      editedPln: 0,

      prm: {
        energyTechLevel: 0,
        plasmaTechLevel: 0,
        universeSpeed: 1,
        geologist: false,
        engineer: false,
        technocrat: false,
        admiral: false,
        commander: false,
        maxTempEntered: false,
        maxPlanetTemp: 0,
        onePlnExtView: false,
        onePlnRace: 0,
        onePlnRaceLevel: 0,
        onePlnLfLevels: [],
        oPPP: [[0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0], [0, 100, 0]],
        metStorageLvl: 0,
        crysStorageLvl: 0,
        deutStorageLvl: 0,
        currPlanetsCount: 8,
        aPPP: [[]],
        aPB: [[]],
        playerClass: 0,
        planetPos: 0,
        energyBoost: 0,
        aPS: [],
        aPNames: [],
        showAddInf: false,
        inclSats: 0,
        rates: [3, 2, 1],
        isTrader: false,
        lfMetProdBonus: 0,
        lfCrysProdBonus: 0,
        lfDeutProdBonus: 0,
        lfEnergyProdBonus: 0,
        lfCrawlerBonus: 0,
        lfPlasmaCostReduction: 0,

        validate: function (field, value) {
          switch (field) {
            case 'energyTechLevel':
              return validateNumber(parseFloat(value), 0, 50, 0);
            case 'plasmaTechLevel':
              return validateNumber(parseFloat(value), 0, 50, 0);
            case 'universeSpeed':
              return validateNumber(parseFloat(value), 1, 10, 1);
            case 'geologist':
              return value === 'true';
            case 'engineer':
              return value === 'true';
            case 'technocrat':
              return value === 'true';
            case 'admiral':
              return value === 'true';
            case 'commander':
              return value === 'true';
            case 'maxTempEntered':
              return value === 'true';
            case 'maxPlanetTemp':
              return validateNumber(parseFloat(value), -272, Infinity, 0);
            case 'onePlnExtView':
              return value === 'true';
            case 'onePlnRace':
              return validateNumber(Number.parseInt(value), 0, 4, 0);
            case 'onePlnRaceLevel':
              return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'oPPP':
              return validateNumber(parseFloat(value), -272, Infinity, 0);
            case 'currPlanetsCount':
              return validateNumber(parseFloat(value), 1, 99, 1);
            case 'aPPP':
              return validateNumber(parseFloat(value), -272, Infinity, 0);
            case 'aPB':
              return validateNumber(parseFloat(value), 0, 3, 0);
            case 'playerClass':
              return validateNumber(parseFloat(value), 0, 2, 0);
            case 'planetPos':
              return validateNumber(parseFloat(value), 1, 16, 8);
            case 'energyBoost':
              return validateNumber(Number.parseInt(value), 0, 4, 0);
            case 'aPS':
              return validateNumber(Number.parseInt(value), -272, Infinity, 0);
            case 'showAddInf':
              return value === 'true';
            case 'inclSats':
              return value === 'true';
            case 'rates':
              return validateNumber(parseFloat(value), 1, 4, 1);
            case 'isTrader':
              return value === 'true';
            case 'lfMetProdBonus':
            case 'lfCrysProdBonus':
            case 'lfDeutProdBonus':
            case 'lfEnergyProdBonus':
            case 'lfCrawlerBonus':
              return validateNumber(parseFloat(value), 0, Infinity, 0);
            case 'lfPlasmaCostReduction':
              return validateNumber(parseFloat(value), 0, 99, 0);
            default:
              return value;
          }
        }
      },

      load: function (key) {
        try {
          loadFromCookie(key, options.prm);
        } catch (e) {
          consoleLog(e);
          resetParams();
        }
        try {
          if (options.prm.aPS.length === 0)
            convertAllPlanetParams();
        } catch (e) {
          resetParams();
        }

        populateParams();
        if (options.prm.planetPos === 0)
          resetParams();

        setOnePlanetProdData();
        setOnePlanetView(options.prm.onePlnExtView);

        setVal('#planetsSpin', options.prm.currPlanetsCount);
        prepAllPlanetsTable();
      },

      save: function () {
        saveToCookie('options_production', options.prm);
      }
    };

    // Localized strings used by JS modules
    options.decimalSeparator = "<?= $l['decimal-separator'] ?>";
    options.metal = "<?= $l['metal'] ?>";
    options.crystal = "<?= $l['crystal'] ?>";
    options.deuterium = "<?= $l['deuterium'] ?>";
    options.datetimeW = "<?= $l['datetime-w'] ?>";
    options.datetimeD = "<?= $l['datetime-d'] ?>";
    options.datetimeH = "<?= $l['datetime-h'] ?>";
    options.datetimeM = "<?= $l['datetime-m'] ?>";
    options.datetimeS = "<?= $l['datetime-s'] ?>";
    options.unitSuffix = "<?= $l['unit-suffix'] ?>";
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = "<?= $l['field-hint'] ?>";
    options.msgMinConstraintViolated = "<?= $l['msg-min-constraint-violated'] ?>";
    options.msgMaxConstraintViolated = "<?= $l['msg-max-constraint-violated'] ?>";
    options.planetNumStr = "<?= $l['planet-num'] ?>";
    options.maxTempAlt = "<?= $l['max-planet-temp'] ?>";
    options.positionAlt = "<?= $l['planet-pos'] ?>";
    options.resReadyInMsg =  "<?= $l['res-ready-in'] ?>";
    options.resWillNotAccumMsg = "<?= $l['res-will-not-accumulate'] ?>";
    options.resWillNotAccumMsg1 = "<?= $l['res-will-not-accumulate1'] ?>";
    options.enoughResAlreadyMsg = "<?= $l['enough-res-already'] ?>";
    options.plnDelConfMsg = "<?= $l['del-planet-confirm'] ?>";
    options.noUniNameMsg = "<?= $l['no-uni-name-msg'] ?>";
    options.noUniSelectedMsg = "<?= $l['no-uni-selected-msg'] ?>";
    options.uniDelConfMsg = "<?= $l['del-universe-confirm'] ?>";
    options.uniOwrConfMsg = "<?= $l['owr-universe-confirm'] ?>";
    options.uniLoadConfMsg = "<?= $l['load-universe-confirm'] ?>";
    options.cloneConfMsg = "<?= $l['clone-confirm'] ?>";
    options.addtnlRowHeader = "<?= $l['addtnl-row'] ?>";
    options.energyShort = "<?= $l['energy-short'] ?>";
    options.editPlanetTitle = "<?= $l['edit-planet-tooltip'] ?>";
    options.deletePlanetTitle = "<?= $l['delete-planet-tooltip'] ?>";
    options.movePlanetUpTitle = "<?= $l['move-planet-up-tooltip'] ?>";
    options.movePlanetDownTitle = "<?= $l['move-planet-down-tooltip'] ?>";
    options.mineNames = ["<?= $l['metal-mine'] ?>", "<?= $l['crystal-mine'] ?>", "<?= $l['deut-synth'] ?>"];
    options.noUpgradesMsg = "<?= $l['no-upgrades'] ?>";
    options.crawlerName = "<?= $l['crawler'] ?>";
    options.crawlerLimitHint = "<?= $l['crawler-limit-hint'] ?>";

    <?php $techs = getTechsByType(2);?>
    options.bldCosts = {
    <?php $first = true; ?>
    <?php foreach ($techs as $tech): ?>
    <?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
    <?php $first = false; ?>
    <?php endforeach; ?>
    };

    <?php $techs = getTechsByType(5);?>
    options.fleetCosts = {
      <?php $first = true; ?>
      <?php foreach ($techs as $tech): ?>
      <?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
      <?php $first = false; ?>
      <?php endforeach; ?>
    };

    <?php $techs = getTechsByType(6);?>
    options.defenseCosts = {
      <?php $first = true; ?>
      <?php foreach ($techs as $tech): ?>
      <?=(!$first)?',':''?><?= $tech ?>:[<?= $techData[$tech][2] ?>, <?= $techData[$tech][3] ?>, <?= $techData[$tech][4] ?>, <?= $techData[$tech][5] ?>]
      <?php $first = false; ?>
      <?php endforeach; ?>
    };

    // Life form building energy consumption: id => [base energy, growth coefficient].
    // Consumption at level n = floor(base * n * pow(coeff, n)).
    options.lfEnergy = {
      <?php $first = true; ?>
      <?php foreach ($lfBuildingEnergy as $lfId => $lfE): ?>
      <?=(!$first)?',':''?><?= $lfId ?>:[<?= $lfE[0] ?>, <?= $lfE[1] ?>]
      <?php $first = false; ?>
      <?php endforeach; ?>
    };

    // Life form building production/energy bonuses: id => {kind:[base, factor, max]}.
    // kind is met/cry/deu/enP/enR; pct(level) = min(max*100, base*factor^(level-1)*level).
    options.lfBonus = {
      <?php $first = true; ?>
      <?php foreach ($lfBuildingBonus as $lfId => $lfB): ?>
      <?=(!$first)?',':''?><?= $lfId ?>:{<?php $bf = true; foreach ($lfB as $kind => $p): ?><?=(!$bf)?',':''?><?= $kind ?>:[<?= $p[0] ?>, <?= $p[1] ?>, <?= $p[2] === null ? 'null' : $p[2] ?>]<?php $bf = false; endforeach; ?>}
      <?php $first = false; ?>
      <?php endforeach; ?>
    };
  </script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('../../sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('../../topbar_bs.tpl'); ?>

<div id="production">
  <div class="border rounded position-relative">
    <div class="d-inline-block d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1">
        <?= $l['title'] ?>
      </div>
      <div id="reset" class="top-0 end-0 d-flex align-items-center justify-content-center bg-danger-subtle" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <div id="universes-panel" class="border rounded m-1 p-2">
      <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
        <div class="d-flex align-items-center gap-1">
          <label for="universe-name-select"><?= $l['universe'] ?></label>
          <select id="universe-name-select" name="universe-name-select" class="form-select form-select-sm w-auto">
            <option value="0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
          </select>
        </div>
        <div id="universe-control" class="btn-group">
          <button id="universe-load" type="button" data-bs-toggle="tooltip" title="<?= $l['universe-load'] ?>" class="btn btn-outline-secondary btn-sm uni-control-btn">
            <i class="bi bi-box-arrow-up"></i>
          </button>
          <button id="universe-save" type="button" data-bs-toggle="tooltip" title="<?= $l['universe-save'] ?>" class="btn btn-outline-secondary btn-sm uni-control-btn">
            <i class="bi bi-box-arrow-in-down"></i>
          </button>
          <button id="universe-delete" type="button" data-bs-toggle="tooltip" title="<?= $l['universe-delete'] ?>" class="btn btn-outline-secondary btn-sm uni-control-btn">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="d-flex align-items-center gap-1">
          <input id="universe-name" type="text" name="universe-name" class="form-control form-control-sm input-20columns"/>
          <button id="universe-add" type="button" data-bs-toggle="tooltip" title="<?= $l['universe-add'] ?>" class="btn btn-outline-secondary btn-sm uni-control-btn">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <div id="general-settings-panel" class="border rounded m-1 p-2 pb-1">
      <!-- Parameter Tabs -->
      <ul class="nav nav-tabs nav-tabs-sm" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-general-tab" data-bs-toggle="tab" data-bs-target="#param-general" type="button" role="tab"><?= $l['param-tab-general'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-researches-tab" data-bs-toggle="tab" data-bs-target="#param-researches" type="button" role="tab"><?= $l['researches'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-lifeforms-tab" data-bs-toggle="tab" data-bs-target="#param-lifeforms" type="button" role="tab"><?= $l['lifeforms'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">
        <!-- General tab -->
        <div class="tab-pane fade show active p-2 pb-0" id="param-general" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-1">
            <div class="d-flex align-items-center gap-1">
              <input id="engineer" type="checkbox" name="engineer" class="form-check-input"/>
              <label for="engineer"><?= $l['engineer'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="geologist" type="checkbox" name="geologist" class="form-check-input"/>
              <label for="geologist"><?= $l['geologist'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="technocrat" type="checkbox" name="technocrat" class="form-check-input"/>
              <label for="technocrat"><?= $l['technocrat'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="admiral" type="checkbox" name="admiral" class="form-check-input"/>
              <label for="admiral"><?= $l['admiral'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="commander" type="checkbox" name="commander" class="form-check-input"/>
              <label for="commander"><?= $l['commander'] ?></label>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center mb-1">
            <div class="d-flex align-items-center gap-1 flex-nowrap">
              <label><?= $l['class'] ?>:</label>
              <input id="class-0" type="radio" name="class" value="0" class="form-check-input"/>
              <label for="class-0"><?= $l['class-collector'] ?></label>
              <input id="class-1" type="radio" name="class" value="1" class="form-check-input"/>
              <label for="class-1"><?= $l['class-general'] ?></label>
              <input id="class-2" type="radio" name="class" value="2" class="form-check-input"/>
              <label for="class-2"><?= $l['class-discoverer'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="is-trader" type="checkbox" name="is-trader" class="form-check-input"/>
              <label for="is-trader"><?= $l['is-trader'] ?></label>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="universe-speed"><?= $l['economy-speed'] ?></label>
              <select id="universe-speed" name="universe-speed" class="form-select form-select-sm w-auto">
                <?php for ($s = 1; $s <= 10; $s++): ?>
                <option value="<?=$s?>" <?= $s === 1 ? 'selected="selected"' : '' ?>><?=$s?></option>
                <?php endfor; ?>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="exchange-rates-m"><?= $l['exchange-rates'] ?></label>
              <input id="exchange-rates-m" type="text" name="exchange-rates-m" class="form-control form-control-sm input-1column" value="3"/>:
              <input id="exchange-rates-c" type="text" name="exchange-rates-c" class="form-control form-control-sm input-1column" value="2"/>:
              <input id="exchange-rates-d" type="text" name="exchange-rates-d" class="form-control form-control-sm input-1column" value="1"/>
            </div>
          </div>
        </div>
        <!-- Researches tab -->
        <div class="tab-pane fade p-2 pb-0" id="param-researches" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label>
              <input id="energy-tech-level" type="text" name="energy-tech-level" class="form-control form-control-sm level-input" value="0"/>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="plasma-tech-level"><?= $l['plasma-tech-level'] ?></label>
              <input id="plasma-tech-level" type="text" name="plasma-tech-level" class="form-control form-control-sm level-input" value="0"/>
            </div>
          </div>
        </div>
        <!-- LifeForms tab -->
        <div class="tab-pane fade p-2 pb-0" id="param-lifeforms" role="tabpanel">
          <div class="d-flex flex-wrap column-gap-3 row-gap-1 align-items-center justify-content-center">
            <div class="d-flex flex-wrap align-items-center gap-2 border rounded p-2">
              <span class="fw-semibold"><?= $l['lf-prod-increase'] ?>:</span>
              <div class="d-flex align-items-center gap-1">
                <label for="lf-metal-prod-bonus" class="text-capitalize"><?= $l['metal'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lf-metal-prod-bonus" type="text" name="lf-metal-prod-bonus" class="form-control level-input m-0" value="0"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="lf-crystal-prod-bonus" class="text-capitalize"><?= $l['crystal'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lf-crystal-prod-bonus" type="text" name="lf-crystal-prod-bonus" class="form-control level-input m-0" value="0"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="lf-deut-prod-bonus" class="text-capitalize"><?= $l['deuterium'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lf-deut-prod-bonus" type="text" name="lf-deut-prod-bonus" class="form-control level-input m-0" value="0"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
              <div class="d-flex align-items-center gap-1">
                <label for="lf-energy-prod-bonus" class="text-capitalize"><?= $l['energy'] ?></label>
                <div class="input-group input-group-sm w-auto">
                  <input id="lf-energy-prod-bonus" type="text" name="lf-energy-prod-bonus" class="form-control level-input m-0" value="0"/>
                  <span class="input-group-text">%</span>
                </div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="lf-crawler-bonus"><?= $l['lf-crawlers-boost'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="lf-crawler-bonus" type="text" name="lf-crawler-bonus" class="form-control level-input m-0" value="0"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="lf-plasma-cost-reduction"><?= $l['lf-plasma-cost-reduction'] ?></label>
              <div class="input-group input-group-sm w-auto">
                <input id="lf-plasma-cost-reduction" type="text" name="lf-plasma-cost-reduction" class="form-control level-input m-0" value="0"/>
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- One planet / All planets tabs -->
    <ul class="nav nav-tabs" id="mainTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="tabtag1" data-bs-toggle="tab" data-bs-target="#one-planet-panel" type="button" role="tab"><?= $l['one-planet'] ?></button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tabtag2" data-bs-toggle="tab" data-bs-target="#all-planets-panel" type="button" role="tab"><?= $l['all-planets'] ?></button>
      </li>
    </ul>

    <div class="tab-content" id="mainTabContent">
      <div class="tab-pane fade show active p-2" id="one-planet-panel" role="tabpanel">
        <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
          <div class="d-flex align-items-center gap-1">
            <label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label>
            <input id="max-planet-temp" type="text" name="max-planet-temp" class="form-control form-control-sm input-4columns" value="0" alt="<?= $l['max-planet-temp'] ?>"/>
          </div>
          <div class="d-flex align-items-center gap-1">
            <label for="planet-pos"><?= $l['planet-pos'] ?></label>
            <input id="planet-pos" type="text" name="planet-pos" class="form-control form-control-sm input-2columns" value="0" alt="<?= $l['planet-pos'] ?>"/>
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
          <div id="prod-coeff-div" class="d-flex align-items-center gap-1 ms-auto">
            <?= $l['prod-coeff'] ?>&nbsp;<span id="prod-coeff">0</span>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
          <div class="d-flex align-items-center gap-1">
            <label for="one-pln-race"><?= $l['race'] ?></label>
            <select id="one-pln-race" name="one-pln-race" class="form-select form-select-sm w-auto">
              <option value="0" selected="selected"><?= $l['none'] ?></option>
              <?php for ($r = 1; $r <= 4; $r++): ?>
              <option value="<?=$r?>"><?= $l['race-'.$r] ?></option>
              <?php endfor; ?>
            </select>
            <label for="one-pln-race-level"><?= $l['lifeform-level'] ?></label>
            <input id="one-pln-race-level" type="text" name="one-pln-race-level" class="form-control form-control-sm input-3columns" value="0" disabled/>
          </div>
          <div class="d-flex align-items-center gap-1 ms-auto">
            <input id="one-pln-extended-view" name="one-pln-extended-view" type="checkbox" class="form-check-input"/>
            <label for="one-pln-extended-view"><?= $l['extended-view'] ?></label>
          </div>
        </div>

        <table id="one-planet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
          <tr>
            <th>&nbsp;</th>
            <th style="display: none;"><?= $l['boosted'] ?></th>
            <th><?= $l['qty-header'] ?></th>
            <th><?= $l['metal'] ?></th>
            <th><?= $l['crystal'] ?></th>
            <th><?= $l['deuterium'] ?></th>
            <th><?= $l['energy'] ?></th>
            <th style="display: none;">%</th>
          </tr>
          <?php for($i = 0; $i < count($oneTblProdRows); $i++): ?>
            <?php if ($i == 16):?>
              <tr><td colspan="8" class="table-line-2px"></td></tr>
            <?php endif; ?>
            <tr class="<?= ($i % 2) === 1 ? 'odd' : 'even' ?>" >
                <td align="left" ><?= $l[$oneTblProdRows[$i]] ?></td>
                <?php if ($i > 0 && $i < 8): ?>
                  <?php if ($i < 4): ?>
                    <td align="center" style="display: none;">
                      <select id="boosted-prod<?= $i ?>" name="boosted-prod" class="form-select form-select-sm input-in-table">
                        <option value="0" selected="selected">0%</option>
                        <option value="1">10%</option>
                        <option value="2">20%</option>
                        <option value="3">30%</option>
                        <option value="4">40%</option>
                      </select>
                    </td>
                  <?php else: ?>
                    <td style="display: none;"></td>
                  <?php endif; ?>
                  <td align="center">
                    <input type="text" class="form-control form-control-sm <?=($i==6 || $i==7)?'input-4columns':'input-3columns' ?> input-in-table" value="0" />
                  </td>
                  <td align="center"></td><td align="center"></td><td align="center"></td><td align="center"></td>
                  <td align="center" style="display: none;">
                    <select class="form-select form-select-sm input-in-table">
                    <?php if ($i == 7): ?>
                      <option value="150">150</option>
                      <option value="140">140</option>
                      <option value="130">130</option>
                      <option value="120">120</option>
                      <option value="110">110</option>
                    <?php endif; ?>
                      <option value="100" selected="selected">100</option>
                      <option value="90">90</option>
                      <option value="80">80</option>
                      <option value="70">70</option>
                      <option value="60">60</option>
                      <option value="50">50</option>
                      <option value="40">40</option>
                      <option value="30">30</option>
                      <option value="20">20</option>
                      <option value="10">10</option>
                      <option value="0">0</option>
                    </select>
                  </td>
                <?php else: ?>
                  <?php for ($j = 0; $j < 7; $j++): ?>
                    <?php if ($j == 0 || $j == 6): ?>
                      <td align="center" style="display: none;"></td>
                    <?php else: ?>
                      <td align="center"></td>
                    <?php endif; ?>
                  <?php endfor; ?>
                <?php endif; ?>
            </tr>
            <?php if ($i == 5): // life form building rows, shown only for the selected race ?>
              <?php foreach ($lfBuildingKeys as $lfRace => $lfKeys): ?>
                <?php foreach ($lfKeys as $lfPos => $lfKey): ?>
                  <tr class="lf-row lf-row-<?= $lfRace ?> <?= ($lfPos % 2) === 1 ? 'odd' : 'even' ?>" style="display: none;">
                    <td align="left"><?= $lfTr[$lfKey] ?></td>
                    <td align="center" style="display: none;"></td>
                    <td align="center">
                      <input type="text" class="form-control form-control-sm input-3columns lf-level-input" data-lf-id="<?= $lfRace * 1000 + ($lfPos + 1) ?>" value="0" />
                    </td>
                    <td align="center"></td><td align="center"></td><td align="center"></td><td align="center"></td>
                    <td align="center" style="display: none;"></td>
                  </tr>
                <?php endforeach; ?>
              <?php endforeach; ?>
            <?php endif; ?>
          <?php endfor; ?>
          <tr><td colspan="8" class="table-line-3px"></td></tr>
        </table>
        <div id="planet-save-div" class="border rounded p-2 my-1" style="display:none">
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <div class="d-flex align-items-center gap-1">
              <label for="planet-name"><?= $l['planet-name'] ?></label>
              <input id="planet-name" type="text" name="planet-name" class="form-control form-control-sm input-20columns"/>
            </div>
            <button id="save-planet-data" type="button" class="btn btn-outline-primary btn-sm" title="<?= $l['save-planet-data'] ?>"><?= $l['save-planet-data'] ?></button>
            <button id="clone-planet-data" type="button" class="btn btn-outline-primary btn-sm" title="<?= $l['clone-planet-data'] ?>"><?= $l['clone-planet-data'] ?></button>
          </div>
        </div>
        <div class="accordion mt-1" id="one-planet-accordion">
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#one-pln-acc-amort"><?= $l['mines-amortization'] ?></button>
            </h2>
            <div id="one-pln-acc-amort" class="accordion-collapse collapse" data-bs-parent="#one-planet-accordion">
              <div class="accordion-body">
                <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
                  <div class="flex-grow-1"><?= $l['incl-explain'] ?></div>
                  <div class="d-flex align-items-center gap-1 flex-nowrap">
                    <input id="include-SS-y" type="radio" name="include-SS" value="0" class="form-check-input"/>
                    <label for="include-SS-y"><?= $l['incl-yes'] ?></label>
                    <input id="include-SS-n" type="radio" name="include-SS" value="1" class="form-check-input"/>
                    <label for="include-SS-n"><?= $l['incl-no'] ?></label>
                  </div>
                </div>
                <table id="mines-amort-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <thead>
                    <tr>
                      <th><?= $l['mine'] ?></th>
                      <th><?= $l['upgrade-cost'] ?></th>
                      <th><?= $l['production-increase'] ?></th>
                      <th><?= $l['amortization-time'] ?></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="odd">
                      <td><?= $l['metal-mine'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
                    </tr>
                    <tr class="even">
                      <td><?= $l['crystal-mine'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
                    </tr>
                    <tr class="odd">
                      <td><?= $l['deut-synth'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
                    </tr>
                  </tbody>
                </table>
                <div class="mt-2"><?= $l['amort-comment'] ?></div>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#one-pln-acc-accum"><?= $l['resources-accumulation'] ?></button>
            </h2>
            <div id="one-pln-acc-accum" class="accordion-collapse collapse" data-bs-parent="#one-planet-accordion">
              <div class="accordion-body">
                <div class="border rounded p-2 mb-2">
                  <div class="fw-semibold mb-1"><?= $l['current-resources'] ?></div>
                  <table id="one-pln-accum" class="lined" width="100%" cellpadding="0" cellspacing="1" border="0" >
                    <tr>
                      <th><?= $l['resource'] ?></th>
                      <th><?= $l['amount'] ?></th>
                      <th><?= $l['storage-level'] ?></th>
                      <th><?= $l['storage-capacity'] ?></th>
                    </tr>
                    <tr>
                      <td><?= $l['metal'] ?></td>
                      <td align="center"><input id="onepln-curr-met" type="text" name="onepln-curr-met" class="form-control form-control-sm input-10columns" value="0"/></td>
                      <td align="center"><input id="storage-met" type="text" name="storage-met" class="form-control form-control-sm input-3columns" value="0"/></td>
                      <td align="center"><span id="storage-cap-met">0</span></td>
                    </tr>
                    <tr>
                      <td><?= $l['crystal'] ?></td>
                      <td align="center"><input id="onepln-curr-crys" type="text" name="onepln-curr-crys" class="form-control form-control-sm input-10columns" value="0"/></td>
                      <td align="center"><input id="storage-crys" type="text" name="storage-crys" class="form-control form-control-sm input-3columns" value="0"/></td>
                      <td align="center"><span id="storage-cap-crys">0</span></td>
                    </tr>
                    <tr>
                      <td><?= $l['deuterium'] ?></td>
                      <td align="center"><input id="onepln-curr-deut" type="text" name="onepln-curr-deut" class="form-control form-control-sm input-10columns" value="0"/></td>
                      <td align="center"><input id="storage-deut" type="text" name="storage-deut" class="form-control form-control-sm input-3columns" value="0"/></td>
                      <td align="center"><span id="storage-cap-deut">0</span></td>
                    </tr>
                  </table>
                </div>
                <div class="d-flex flex-wrap gap-2 align-items-stretch">
                  <div class="border rounded p-2 flex-grow-1">
                    <div class="fw-semibold mb-1"><?= $l['accumulate-what'] ?></div>
                    <div class="d-flex align-items-center gap-1 mb-1">
                      <span><?= $l['after'] ?></span>
                      <input id="onepln-accumwhat-d" type="text" name="onepln-accumwhat-d" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="onepln-accumwhat-d"><?= $l['datetime-d'] ?></label>
                      <input id="onepln-accumwhat-h" type="text" name="onepln-accumwhat-h" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="onepln-accumwhat-h"><?= $l['datetime-h'] ?></label>
                      <input id="onepln-accumwhat-m" type="text" name="onepln-accumwhat-m" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="onepln-accumwhat-m"><?= $l['datetime-m'] ?></label>
                    </div>
                    <div class="mb-1"><?= $l['resources-will-be'] ?></div>
                    <table width="100%" cellpadding="0" cellspacing="1" border="0">
                      <tr><td width="50%"><?= $l['metal'] ?></td><td align="left"><span id="onepln-accumwhat-met">0</span></td></tr>
                      <tr><td><?= $l['crystal'] ?></td><td align="left"><span id="onepln-accumwhat-crys">0</span></td></tr>
                      <tr><td><?= $l['deuterium'] ?></td><td align="left"><span id="onepln-accumwhat-deut">0</span></td></tr>
                    </table>
                  </div>
                  <div class="border rounded p-2 flex-grow-1">
                    <div class="fw-semibold mb-1"><?= $l['accumulate-when'] ?></div>
                    <div class="mb-1"><?= $l['specify-res-quant'] ?></div>
                    <table cellpadding="0" cellspacing="1" border="0">
                      <tr>
                        <td><label for="onepln-accumwhen-met"><?= $l['metal'] ?></label></td>
                        <td><input id="onepln-accumwhen-met" type="text" name="onepln-accumwhen-met" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                      <tr>
                        <td><label for="onepln-accumwhen-crys"><?= $l['crystal'] ?></label></td>
                        <td><input id="onepln-accumwhen-crys" type="text" name="onepln-accumwhen-crys" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                      <tr>
                        <td><label for="onepln-accumwhen-deut"><?= $l['deuterium'] ?></label></td>
                        <td><input id="onepln-accumwhen-deut" type="text" name="onepln-accumwhen-deut" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                    </table>
                    <div class="mt-1"><span id="onepln-accumwhen-msg"></span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#one-pln-acc-fleet"><?= $l['fleet-production'] ?></button>
            </h2>
            <div id="one-pln-acc-fleet" class="accordion-collapse collapse" data-bs-parent="#one-planet-accordion">
              <div class="accordion-body">
                <?php $techs = getTechsByType(5);?>
                <table id="one-pln-fleet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <tr>
                    <th><?= $l['ship'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
                  </tr>
                  <?php $row = 0;?>
                  <?php foreach ($techs as $tech) :?>
                  <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                    <td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
                  </tr>
                  <?php endforeach; ?>
                </table>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#one-pln-acc-defense"><?= $l['defense-producton'] ?></button>
            </h2>
            <div id="one-pln-acc-defense" class="accordion-collapse collapse" data-bs-parent="#one-planet-accordion">
              <div class="accordion-body">
                <?php $techs = getTechsByType(6);?>
                <table id="one-pln-defense-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <tr>
                    <th><?= $l['building'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
                  </tr>
                  <?php $row = 0;?>
                  <?php foreach ($techs as $tech) :?>
                  <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                    <td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
                  </tr>
                  <?php endforeach; ?>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-pane fade p-2" id="all-planets-panel" role="tabpanel">
        <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
          <div class="d-flex align-items-center gap-1 mx-auto">
            <span><?= $l['planets-count'] ?></span>
            <div class="input-group input-group-sm" style="width: 100px;">
              <input id="planetsSpin" type="text" class="form-control centered" value="8" />
              <button class="btn btn-outline-secondary" type="button" id="planetsSpin-up">
                <i class="bi bi-caret-up-fill"></i>
              </button>
              <button class="btn btn-outline-secondary" type="button" id="planetsSpin-down">
                <i class="bi bi-caret-down-fill"></i>
              </button>
            </div>
          </div>
          <div class="d-flex align-items-center gap-1">
            <input id="all-pln-addtnl-info" name="all-pln-addtnl-info" type="checkbox" class="form-check-input"/>
            <label for="all-pln-addtnl-info"><?= $l['show-addtnl-info'] ?></label>
          </div>
        </div>
        <table id="all-planets-prod" class="lined" width="100%" cellpadding="0" cellspacing="1" border="0" >
          <tr>
            <th>&nbsp;</th>
            <th>&nbsp;</th>
            <th><abbr title="<?= $l['max-planet-temp'] ?>" data-bs-toggle="tooltip">t°</abbr></th>
            <th><abbr title="<?= $l['planet-pos'] ?>" data-bs-toggle="tooltip"><?= $l['planet-pos-short'] ?></abbr></th>
            <th><abbr title="<?= $l['metal-mine'] ?>" data-bs-toggle="tooltip"><?= $l['metal-mine-short'] ?></abbr></th>
            <th><?= $l['metal-short'] ?></th>
            <th><abbr title="<?= $l['crystal-mine'] ?>" data-bs-toggle="tooltip"><?= $l['crystal-mine-short'] ?></abbr></th>
            <th><?= $l['crystal-short'] ?></th>
            <th><abbr title="<?= $l['deut-synth'] ?>" data-bs-toggle="tooltip"><?= $l['deuterium-synth-short'] ?></abbr></th>
            <th><?= $l['deuterium-short'] ?></th>
            <th><abbr title="<?= $l['solar-plant'] ?>" data-bs-toggle="tooltip"><?= $l['solar-short'] ?></abbr></th>
            <th><abbr title="<?= $l['fusion-reactor'] ?>" data-bs-toggle="tooltip"><?= $l['fusion-short'] ?></abbr></th>
            <th><abbr title="<?= $l['solar-sat'] ?>" data-bs-toggle="tooltip"><?= $l['sats-short'] ?></abbr></th>
            <th><abbr title="<?= $l['crawler'] ?>" data-bs-toggle="tooltip"><?= $l['crawler-short'] ?></abbr></th>
            <th><abbr title="<?= $l['prod-coeff'] ?>" data-bs-toggle="tooltip"><?= $l['coeff-short'] ?></abbr></th>
            <th class="control-buttons">&nbsp;</th>
          </tr>
          <tr><td colspan="16" class="table-line-2px"></td></tr>
          <?php for ($i = 0; $i < 3; $i++): ?>
            <tr class="<?= (($i+1) % 2) === 1 ? 'odd' : 'even' ?>">
              <td></td>
              <td><?= $l[$allTblTotalRows[$i]] ?></td>
              <?php for ($j = 1; $j < 15; $j++): ?>
                <td align="center"></td>
              <?php endfor; ?>
            </tr>
          <?php endfor; ?>
          <tr><td colspan="16" class="table-line-3px"></td></tr>
        </table>
        <div class="accordion mt-1" id="all-planets-accordion">
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-pln-acc-priority"><?= $l['priority-upgrades'] ?></button>
            </h2>
            <div id="all-pln-acc-priority" class="accordion-collapse collapse" data-bs-parent="#all-planets-accordion">
              <div class="accordion-body">
                <div class="table-responsive">
                  <table id="mines-priority-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th><?= $l['planet'] ?></th>
                        <th><?= $l['mine'] ?></th>
                        <th><?= $l['level'] ?></th>
                        <th><?= $l['upgrade-cost'] ?></th>
                        <th><?= $l['production-increase'] ?></th>
                        <th><?= $l['amortization-time'] ?></th>
                      </tr>
                    </thead>
                    <tbody id="mines-priority-body"></tbody>
                  </table>
                </div>
                <div class="mt-2"><?= $l['priority-upgrades-comment'] ?></div>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-pln-acc-amort"><?= $l['plasma-amortization'] ?></button>
            </h2>
            <div id="all-pln-acc-amort" class="accordion-collapse collapse" data-bs-parent="#all-planets-accordion">
              <div class="accordion-body">
                <table id="plasma-amort-tbl" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <thead>
                    <tr>
                      <th style="width: 55%"></th>
                      <th style="width: 15%"><?= $l['metal'] ?></th>
                      <th style="width: 15%"><?= $l['crystal'] ?></th>
                      <th style="width: 15%"><?= $l['deuterium'] ?></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="odd">
                      <td><?= $l['upgrade-cost'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
                    </tr>
                    <tr class="even">
                      <td><?= $l['production-increase'] ?></td><td class="centered"></td><td class="centered"></td><td class="centered"></td>
                    </tr>
                    <tr class="odd">
                      <td><?= $l['amortization-time'] ?></td><td class="centered" colspan="3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-pln-acc-accum"><?= $l['resources-accumulation'] ?></button>
            </h2>
            <div id="all-pln-acc-accum" class="accordion-collapse collapse" data-bs-parent="#all-planets-accordion">
              <div class="accordion-body">
                <div class="border rounded p-2 mb-2">
                  <div class="fw-semibold mb-1"><?= $l['total-empire-resources'] ?></div>
                  <div class="d-flex flex-wrap gap-2 align-items-center">
                    <div class="d-flex align-items-center gap-1">
                      <label for="allpln-curr-met"><?= $l['metal'] ?></label>
                      <input id="allpln-curr-met" type="text" name="allpln-curr-met" class="form-control form-control-sm input-10columns" value="0"/>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                      <label for="allpln-curr-crys"><?= $l['crystal'] ?></label>
                      <input id="allpln-curr-crys" type="text" name="allpln-curr-crys" class="form-control form-control-sm input-10columns" value="0"/>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                      <label for="allpln-curr-deut"><?= $l['deuterium'] ?></label>
                      <input id="allpln-curr-deut" type="text" name="allpln-curr-deut" class="form-control form-control-sm input-10columns" value="0"/>
                    </div>
                  </div>
                </div>
                <div class="d-flex flex-wrap gap-2 align-items-stretch">
                  <div class="border rounded p-2 flex-grow-1">
                    <div class="fw-semibold mb-1"><?= $l['accumulate-what'] ?></div>
                    <div class="d-flex align-items-center gap-1 mb-1">
                      <span><?= $l['after'] ?></span>
                      <input id="allpln-accumwhat-d" type="text" name="allpln-accumwhat-d" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="allpln-accumwhat-d"><?= $l['datetime-d'] ?></label>
                      <input id="allpln-accumwhat-h" type="text" name="allpln-accumwhat-h" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="allpln-accumwhat-h"><?= $l['datetime-h'] ?></label>
                      <input id="allpln-accumwhat-m" type="text" name="allpln-accumwhat-m" class="form-control form-control-sm input-2columns" value="0"/>
                      <label for="allpln-accumwhat-m"><?= $l['datetime-m'] ?></label>
                    </div>
                    <div class="mb-1"><?= $l['resources-will-be'] ?></div>
                    <table width="100%" cellpadding="0" cellspacing="1" border="0">
                      <tr><td width="50%"><?= $l['metal'] ?></td><td align="left"><span id="allpln-accumwhat-met">0</span></td></tr>
                      <tr><td><?= $l['crystal'] ?></td><td align="left"><span id="allpln-accumwhat-crys">0</span></td></tr>
                      <tr><td><?= $l['deuterium'] ?></td><td align="left"><span id="allpln-accumwhat-deut">0</span></td></tr>
                    </table>
                  </div>
                  <div class="border rounded p-2 flex-grow-1">
                    <div class="fw-semibold mb-1"><?= $l['accumulate-when'] ?></div>
                    <div class="mb-1"><?= $l['specify-res-quant'] ?></div>
                    <table cellpadding="0" cellspacing="1" border="0">
                      <tr>
                        <td><label for="allpln-accumwhen-met"><?= $l['metal'] ?></label></td>
                        <td><input id="allpln-accumwhen-met" type="text" name="allpln-accumwhen-met" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                      <tr>
                        <td><label for="allpln-accumwhen-crys"><?= $l['crystal'] ?></label></td>
                        <td><input id="allpln-accumwhen-crys" type="text" name="allpln-accumwhen-crys" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                      <tr>
                        <td><label for="allpln-accumwhen-deut"><?= $l['deuterium'] ?></label></td>
                        <td><input id="allpln-accumwhen-deut" type="text" name="allpln-accumwhen-deut" class="form-control form-control-sm input-10columns" value="0"/></td>
                      </tr>
                    </table>
                    <div class="mt-1"><span id="allpln-accumwhen-msg"></span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-pln-acc-fleet"><?= $l['fleet-production'] ?></button>
            </h2>
            <div id="all-pln-acc-fleet" class="accordion-collapse collapse" data-bs-parent="#all-planets-accordion">
              <div class="accordion-body">
                <?php $techs = getTechsByType(5);?>
                <table id="all-pln-fleet-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <tr>
                    <th><?= $l['ship'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
                  </tr>
                  <?php $row = 0;?>
                  <?php foreach ($techs as $tech) :?>
                  <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                    <td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
                  </tr>
                  <?php endforeach; ?>
                </table>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-pln-acc-defense"><?= $l['defense-producton'] ?></button>
            </h2>
            <div id="all-pln-acc-defense" class="accordion-collapse collapse" data-bs-parent="#all-planets-accordion">
              <div class="accordion-body">
                <?php $techs = getTechsByType(6);?>
                <table id="all-pln-defense-prod" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <tr>
                    <th><?= $l['building'] ?></th><th><?= $l['per-hour'] ?></th><th><?= $l['per-day'] ?></th><th><?= $l['per-week'] ?></th>
                  </tr>
                  <?php $row = 0;?>
                  <?php foreach ($techs as $tech) :?>
                  <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                    <td align="left"><?=$l[$techData[$tech][0]]?></td><td align="center">0</td><td align="center">0</td><td align="center">0</td>
                  </tr>
                  <?php endforeach; ?>
                </table>
              </div>
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

<?php require_once('../../analitics.tpl'); ?>

<script type="text/javascript">
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
      new bootstrap.Tooltip(el);
    });
    initializeProductionCalculator();
  });
</script>

</body>
</html>
