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
  <link type="text/css" href="/ogame/calc/css/queue_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/queue_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>

  <!-- DOM utilities (jQuery replacement) -->
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>

  <!-- Queue calculator modules -->
  <script type="text/javascript" src="/ogame/calc/js/queue-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/queue-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/queue-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/queue-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/queue-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/queue-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/queue-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/queue-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    var options = {
      defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

      prm: {
        universeSpeed: 1,
        ionTechLevel: 0,
        hyperTechLevel: 0,
        playerClass: 0,
        scCapacityIncrease: 0,
        lcCapacityIncrease: 0,
        totFldPln: 163,
        totFldMn: 1,
        sDTP: 0,
        sDTM: 0,
        slp: [],
        slm: [],
        qp: [],
        qm: [],

        validate: function(field, value) {
          switch (field) {
            case 'universeSpeed':  return validateNumber(Number.parseFloat(value), 0, 10, 1);
            case 'ionTechLevel':   return validateNumber(Number.parseFloat(value), 0, 50, 0);
            case 'hyperTechLevel': return validateNumber(Number.parseFloat(value), 0, 50, 0);
            case 'playerClass':    return validateNumber(Number.parseInt(value), 0, 2, 0);
            case 'scCapacityIncrease': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'lcCapacityIncrease': return validateNumber(Number.parseInt(value), 0, Infinity, 0);
            case 'totFldPln':      return validateNumber(Number.parseFloat(value), 1, Infinity, 163);
            case 'totFldMn':       return validateNumber(Number.parseFloat(value), 1, Infinity, 1);
            case 'sDTP':           return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
            case 'sDTM':           return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
            case 'slp': case 'slm': return validateNumber(Number.parseFloat(value), 0, Infinity, 0);
            case 'qp':  case 'qm':  return validateNumber(Number.parseFloat(value), 0, Infinity, 1);
            default: return value;
          }
        }
      },

      load: function() {
        try { loadFromCookie('options_queue', options.prm); } catch (e) { console.error(e); }
      },
      save: function() { saveToCookie('options_queue', options.prm); },

      defPlfFlds: 163,
      defMnFlds: 1
    };

    // Localized strings used by JS modules
    options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
    options.datetimeW = '<?= $l['datetime-w'] ?>';
    options.datetimeD = '<?= $l['datetime-d'] ?>';
    options.datetimeH = '<?= $l['datetime-h'] ?>';
    options.datetimeM = '<?= $l['datetime-m'] ?>';
    options.datetimeS = '<?= $l['datetime-s'] ?>';
    options.unitSuffix = '<?= $l['unit-suffix'] ?>';
    options.scShort = '<?= $l['sc-short'] ?>';
    options.lcShort = '<?= $l['lc-short'] ?>';
    options.scFull = '<?= $l['small-cargo'] ?>';
    options.lcFull = '<?= $l['large-cargo'] ?>';
    options.datetimeFormat = '<?= $l['datetime-format'] ?>';
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = '<?= $l['field-hint'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
    options.moveUpTitle = '<?= $l['move-up'] ?? '' ?>';
    options.moveDownTitle = '<?= $l['move-down'] ?? '' ?>';
    options.removeRowTitle = '<?= $l['remove-row'] ?? '' ?>';

    options.techCosts = {
<?php $first = true; foreach ($techData as $id => $tech): ?>
      <?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>]
<?php $first = false; endforeach; ?>
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

<div id="queue">
  <div class="border rounded position-relative">
    <div class="d-inline-block d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1">
        <?= $l['title'] ?>
      </div>
      <div id="reset" class="top-0 end-0 d-flex align-items-center justify-content-center bg-danger-subtle" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <div id="general-settings-panel" class="border rounded m-1 p-2">
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <div class="d-flex align-items-center gap-1">
          <label for="universe-speed"><?= $l['universe-speed'] ?></label>
          <select id="universe-speed" name="universe-speed" class="form-select form-select-sm w-auto">
            <?php for ($s = 1; $s <= 10; $s++): ?>
            <option value="<?=$s?>" <?= $s === 1 ? 'selected="selected"' : '' ?>><?=$s?></option>
            <?php endfor; ?>
          </select>
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="ion-tech-level"><?= $l['ion-tech'] ?></label>
          <input id="ion-tech-level" type="text" name="ion-tech-level" class="form-control form-control-sm level-input" value="0" />
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label>
          <input id="hyper-tech-level" type="text" name="hyper-tech-level" class="form-control form-control-sm level-input" value="0" />
        </div>
        <div class="d-flex align-items-center gap-1">
          <label><?= $l['class'] ?>:</label>
        </div>
        <div class="d-flex align-items-center gap-1">
          <input id="player-class-0" type="radio" name="player-class" value="0" class="form-check-input"/>
          <label for="player-class-0"><?= $l['class-collector'] ?></label>
        </div>
        <div class="d-flex align-items-center gap-1">
          <input id="player-class-1" type="radio" name="player-class" value="1" class="form-check-input"/>
          <label for="player-class-1"><?= $l['class-general'] ?></label>
        </div>
        <div class="d-flex align-items-center gap-1">
          <input id="player-class-2" type="radio" name="player-class" value="2" class="form-check-input"/>
          <label for="player-class-2"><?= $l['class-discoverer'] ?></label>
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="sc-capacity-increase"><?= $l['cargo-cap-increase'] ?><?= $l['sc-short'] ?></label>
          <input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="form-control form-control-sm level-input" value="0"/>
        </div>
        <div class="d-flex align-items-center gap-1">
          <label for="lc-capacity-increase"><?= $l['lc-short'] ?></label>
          <input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="form-control form-control-sm level-input" value="0"/>
        </div>
      </div>
    </div>

    <!-- Planet / Moon tabs -->
    <ul class="nav nav-tabs" id="mainTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="tabtag-2" data-bs-toggle="tab" data-bs-target="#tab-2" type="button" role="tab"><?= $l['planet'] ?></button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tabtag-3" data-bs-toggle="tab" data-bs-target="#tab-3" type="button" role="tab"><?= $l['moon'] ?></button>
      </li>
    </ul>

    <div class="tab-content" id="mainTabContent">
      <?php foreach ($techTypes as $i => $type): ?>
      <div class="tab-pane fade <?= $i === 2 ? 'show active' : '' ?> p-2" id="tab-<?=$i?>" role="tabpanel">
        <div class="d-flex flex-wrap gap-2 align-items-start">
          <!-- Available buildings (src) -->
          <div>
            <div id="src-panel-<?=$i?>" class="border rounded p-2">
              <p class="border rounded subheader bg-primary-subtle mb-2"><b><?= $l['buildings'] ?></b></p>
              <div class="d-flex align-items-center gap-2 mb-2">
                <label for="total-fields-<?=$i?>"><?= $l['total-fields'] ?></label>
                <input id="total-fields-<?=$i?>" type="text" name="total-fields-<?=$i?>" class="form-control form-control-sm level-input total-fld-input" value="0" />
              </div>
              <table id="table-src-<?=$i?>" class="lined" cellpadding="0" cellspacing="1" border="0">
                <tr>
                  <th style="display: none;">ID</th>
                  <?php foreach ($colHeadersSrc as $idx => $header): ?>
                  <th <?=($idx > 0)?'align="center"':''?>><?= $l[$header] ?></th>
                  <?php endforeach; ?>
                </tr>
                <?php $techs = getTechsByType($i); $row = 1; ?>
                <?php foreach ($techs as $tech): ?>
                <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                  <td style="display: none;"><?=$tech?></td>
                  <td><?= $l[$techData[$tech][0]] ?></td>
                  <td align="center"><input id="startlvl-<?=$i?>-<?=$tech?>" type="text" class="form-control form-control-sm level-input" value="0"/></td>
                  <td align="center" style="white-space: nowrap;">
                    <span id="nextlvl-<?=$i?>-<?=$tech?>">0</span>
                    <button type="button" data-tech="<?=$tech?>" class="btn btn-outline-secondary btn-sm button-build" title="<?= $l['build'] ?>">
                      <i class="bi bi-arrow-right"></i>
                    </button>
                    <?php if (!in_array($tech, [33, 36, 41])): ?>
                    <button type="button" data-tech="<?=$tech?>" class="btn btn-outline-secondary btn-sm button-destroy" title="<?= $l['destroy'] ?>">
                      <i class="bi bi-arrow-left"></i>
                    </button>
                    <?php endif; ?>
                  </td>
                </tr>
                <?php endforeach; ?>
              </table>
            </div>
          </div>

          <!-- Build queue (dst) -->
          <div>
            <div id="dst-panel-<?=$i?>" class="border rounded p-2">
              <div class="subheader-row d-flex align-items-center gap-1 mb-2">
                <p class="border rounded subheader bg-primary-subtle mb-0 flex-grow-1"><b><?= $l['queue'] ?></b></p>
                <button type="button" id="clear-<?=$i?>" class="btn btn-outline-danger btn-sm" title="<?= $l['clear'] ?>">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <div id="times-<?=$i?>" class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <label for="start-<?=$i?>"><?= $l['start-time'] ?></label>
                <input type="text" id="start-<?=$i?>" class="form-control form-control-sm startdate-input" title="<?= $l['datetime-format-hint'] ?>" placeholder="<?= $l['datetime-format-hint'] ?>"/>
                <button type="button" id="set-start-now-<?=$i?>" class="btn btn-outline-secondary btn-sm" title="<?= $l['start-now-hint'] ?>">
                  <?= $l['start-now'] ?>
                </button>
                <div class="d-flex align-items-center gap-2 flex-nowrap">
                  <label><?= $l['finish-time'] ?></label>
                  <span id="finish-moment-<?=$i?>" class="form-control form-control-sm startdate-input d-inline-block bg-body-tertiary">?</span>
                </div>
              </div>

              <table id="table-dst-<?=$i?>" class="lined" cellpadding="0" cellspacing="1" border="0">
                <tr>
                  <?php foreach ($colHeadersDst as $idx => $header): ?>
                  <th <?=($idx > 0)?'align="center"':''?>><?= $header == '-' ? '' : $l[$header] ?></th>
                  <?php endforeach; ?>
                </tr>
                <tr class="even">
                  <td class="border-n"><?= $l['total'] ?></td>
                  <td align="center" class="border-n"><b>0</b></td>
                  <td align="center" class="border-n border-s border-w"><b>0</b></td>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <td align="center" class="border-n border-s border-e"><b>0</b></td>
                  <td></td>
                </tr>
                <tr class="even">
                  <td><?= $l['transports-needed'] ?></td>
                  <td colspan="2" align="center">0 <?= $l['sc-short'] ?></td>
                  <td colspan="2" align="center">0 <?= $l['lc-short'] ?></td>
                  <td colspan="2"></td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
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
    initializeQueueCalculator();
  });
</script>

</body>
</html>
