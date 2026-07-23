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
  <link type="text/css" href="/ogame/calc/css/flight_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/flight_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries and calculator modules -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/flight-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/flight-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/flight-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/flight-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/flight-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/flight-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/flight-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/flight-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // `options` is defined in flight-orchestration.js; here we only fill in the
    // translation strings the renderer and orchestrator read.
    options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
    options.datetimeW = '<?= $l['datetime-w'] ?>';
    options.datetimeD = '<?= $l['datetime-d'] ?>';
    options.datetimeH = '<?= $l['datetime-h'] ?>';
    options.datetimeM = '<?= $l['datetime-m'] ?>';
    options.datetimeS = '<?= $l['datetime-s'] ?>';
    options.datetimeFormat = '<?= $l['datetime-format'] ?>';
    options.flightTimeFormat = '<?= $l['flight-time-format'] ?>';
    options.flightTimeFormatHint = '<?= $l['flight-time-format-hint'] ?>';
    options.toggleSignHint = '<?= $l['toggle-sign'] ?>';
    options.removeRowHint = '<?= $l['remove-row'] ?>';
    options.departureTitle = '<?= $l['departure'] ?>';
    options.arrivalTitle = '<?= $l['arrival'] ?>';
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = '<?= $l['field-hint'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
    options.msgNoShips = "<?= $l['msg-no-ships'] ?>";
    options.msgWrongDepartureTime = "<?= $l['msg-wrong-departure-time'] ?>";
    options.msgWrongReturnTime = "<?= $l['msg-wrong-return-time'] ?>";
    options.msgDepartureAfterReturn = "<?= $l['msg-departure-after-return'] ?>";
    options.msgWrongTolerance = "<?= $l['msg-wrong-tolerance'] ?>";
    options.msgWrongDepartureCoordinates = "<?= $l['msg-wrong-departure-coordinates'] ?>";
    options.msgNoSavepointsFound = "<?= $l['msg-no-savepoints-found'] ?>";
    options.flightmodesNote = "<?= $l['flightmodes-note'] ?>";
    options.savepointsNote = "<?= $l['savepoints-note'] ?>";
    options.noUniNameMsg = "<?= $l['no-uni-name-msg'] ?>";
    options.noUniSelectedMsg = "<?= $l['no-uni-selected-msg'] ?>";
    options.uniDelConfMsg = "<?= $l['del-universe-confirm'] ?>";
    options.uniOwrConfMsg = "<?= $l['owr-universe-confirm'] ?>";
    options.uniLoadConfMsg = "<?= $l['load-universe-confirm'] ?>";
    options.noFleetNameMsg = "<?= $l['no-fleet-name-msg'] ?>";
    options.noFleetSelectedMsg = "<?= $l['no-fleet-selected-msg'] ?>";
    options.fleetDelConfMsg = "<?= $l['del-fleet-confirm'] ?>";
    options.fleetOwrConfMsg = "<?= $l['owr-fleet-confirm'] ?>";
    options.fleetLoadConfMsg = "<?= $l['load-fleet-confirm'] ?>";
    options.smallCargoName = "<?= $l['small-cargo'] ?>";
    options.missingSCName = "<?= $l['no-sc-message'] ?>";
    options.badSRCode = "<?= $l['import-bad-code-msg'] ?>";
    options.dataFetchMsg = "<?= $l['fetchig-data'] ?>";
    options.ownApiBadJsonMsg = "<?= $l['own-api-bad-json-msg'] ?>";

    var unis = {
<?php
  $f1 = true;
  foreach ($universes as $ul => $uc) {
    echo ($f1 ? '' :",\n").$ul.': [';
    $f2 = true;
    foreach ($uc as $row) {
      echo ($f2 ? '' : ',')."[{$row['server_number']}, '{$row['name']}']";
      $f2 = false;
    }
    echo ']';
    $f1 = false;
  }
?>
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

<div id="flight">
  <div class="border rounded position-relative">
    <div class="d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1"><?= $l['title'] ?></div>
      <div id="reset" class="d-flex align-items-center justify-content-center bg-danger-subtle" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>

    <div id="general-settings-panel" class="border rounded m-1 position-relative">
      <div class="accordion" id="params-accordion">

        <!-- Parameters -->
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#accordion-prm"><?= $l['parameters'] ?></button>
          </h2>
          <div id="accordion-prm" class="accordion-collapse collapse" data-bs-parent="#params-accordion">
            <div class="accordion-body">

              <div id="universes-panel" class="border rounded p-2 mb-2">
                <table class="mx-auto">
                  <tr>
                    <td><label for="universe-name-select"><?= $l['universe'] ?></label></td>
                    <td>
                      <select id="universe-name-select" name="universe-name-select" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                        <option value="0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
                      </select>
                    </td>
                    <td>
                      <div id="universe-control" class="btn-group" role="group">
                        <button id="universe-load" type="button" title="<?= $l['universe-load'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-box-arrow-in-down"></i></button>
                        <button id="universe-save" type="button" title="<?= $l['universe-save'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-save"></i></button>
                        <button id="universe-delete" type="button" title="<?= $l['universe-delete'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-x-lg"></i></button>
                      </div>
                    </td>
                    <td style="width: 20px;">&nbsp;</td>
                    <td><input id="universe-name" type="text" name="universe-name" class="form-control form-control-sm d-inline-block input-20columns ui-input-margin"/></td>
                    <td><button id="universe-add" type="button" title="<?= $l['universe-add'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-plus-lg"></i></button></td>
                  </tr>
                  <tr>
                    <td>SR_KEY:</td>
                    <td colspan="4">
                      <div class="d-flex align-items-center gap-1">
                        <input id="api-code" placeholder="API OGame / API LogServer.net" type="text" class="form-control form-control-sm flex-grow-1 text-center ui-input-margin"/>
                        <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['import-hint'] ?>"></i>
                        <button id="api-get" type="button" title="<?= $l['import-sr'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-box-arrow-in-down"></i></button>
                      </div>
                    </td>
                    <td>
                      <button id="import-own-api" type="button" title="<?= $l['own-api-import-btn'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-clipboard"></i></button>
                    </td>
                  </tr>
                </table>
              </div>

              <table class="mx-auto">
                <tr>
                  <td><label><?= $l['class'] ?>:</label></td>
                  <td class="px-2"><input id="class-0" type="radio" name="class" value="0" class="form-check-input"/> <label for="class-0"><?= $l['class-collector'] ?></label></td>
                  <td class="px-2"><input id="class-1" type="radio" name="class" value="1" class="form-check-input"/> <label for="class-1"><?= $l['class-general'] ?></label></td>
                  <td class="px-2"><input id="class-2" type="radio" name="class" value="2" class="form-check-input"/> <label for="class-2"><?= $l['class-discoverer'] ?></label></td>
                  <td colspan="3">
                    <input id="trader-bonus" type="checkbox" name="trader-bonus" class="form-check-input"/> <label for="trader-bonus"><?= $l['trader-bonus'] ?></label>
                  </td>
                </tr>
                <tr>
                  <td><label for="cmb-drive"><?= $l['cmb-drive'] ?></label></td>
                  <td><input id="cmb-drive" type="text" name="cmb-drive" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
                  <td><label for="imp-drive"><?= $l['imp-drive'] ?></label></td>
                  <td><input id="imp-drive" type="text" name="imp-drive" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
                  <td><label for="hyp-drive"><?= $l['hyp-drive'] ?></label></td>
                  <td><input id="hyp-drive" type="text" name="hyp-drive" class="form-control form-control-sm d-inline-block level-input ui-input-margin" value="0" /></td>
                  <td><label for="hypertech-lvl"><?= $l['hyper-tech'] ?>&nbsp;</label></td>
                  <td><input id="hypertech-lvl" type="text" name="hypertech-lvl" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="0" /></td>
                </tr>
              </table>

              <table class="mx-auto">
                <tr>
                  <td><label for="departure-g"><?= $l['departure-point'] ?>&nbsp;</label></td>
                  <td class="text-nowrap">
                    <input id="departure-g" type="text" name="departure-g" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['galaxy'] ?>" />:
                    <input id="departure-s" type="text" name="departure-s" class="form-control form-control-sm d-inline-block coord-input ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['system'] ?>" />:
                    <input id="departure-p" type="text" name="departure-p" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="1" alt="<?= $l['departure-point'] ?>-<?= $l['planet'] ?>" />
                  </td>
                  <td style="width: 30px;">&nbsp;</td>
                  <td><label for="country"><?= $l['country'] ?>&nbsp;</label></td>
                  <td>
                    <select id="country" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <option value="--"></option>
                      <?php if ($countries): ?>
                      <?php foreach ($countries as $row): ?>
                        <option value="<?= $row['lang'] ?>"><?= $row['name'] ?></option>
                      <?php endforeach; ?>
                      <?php endif; ?>
                    </select>
                  </td>
                  <td><label for="universe"><?= $l['universe'] ?>&nbsp;</label></td>
                  <td><select id="universe" class="form-select form-select-sm d-inline-block w-auto ui-input-margin"></select></td>
                </tr>
              </table>

              <table class="mx-auto">
                <tr>
                  <td><?= $l['circular'] ?></td>
                  <td class="px-2"><input id="circular-systems" type="checkbox" name="circular-systems" class="form-check-input"/> <label for="circular-systems"><abbr data-bs-toggle="tooltip" title="<?= $l['circ-systems-explain'] ?>"><?= $l['circ-systems'] ?></abbr></label></td>
                  <td class="px-2"><input id="circular-galaxies" type="checkbox" name="circular-galaxies" class="form-check-input"/> <label for="circular-galaxies"><abbr data-bs-toggle="tooltip" title="<?= $l['circ-galaxies-explain'] ?>"><?= $l['circ-galaxies'] ?></abbr></label></td>
                  <td style="width: 20px;">&nbsp;</td>
                  <td><label for="systems-num"><?= $l['systems-num'] ?></label></td>
                  <td><input id="systems-num" type="text" name="systems-num" class="form-control form-control-sm d-inline-block level-input-small ui-input-margin" value="499" /></td>
                  <td><label for="galaxies-num"><?= $l['galaxies-num'] ?></label></td>
                  <td><input id="galaxies-num" type="text" name="galaxies-num" class="form-control form-control-sm d-inline-block level-input-small ui-input-margin" value="9" /></td>
                </tr>
              </table>

              <table class="mx-auto">
                <tr>
                  <td><label><?= $l['speed-fleet-title'] ?></label></td>
                  <td style="width: 10px;">&nbsp;</td>
                  <td><label for="speed-fleet-war"><?= $l['speed-fleet-war'] ?></label></td>
                  <td>
                    <select id="speed-fleet-war" name="speed-fleet-war" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <?php for($s=1;$s<=10;$s++): ?><option value="<?= $s ?>"<?= $s===1?' selected':'' ?>><?= $s ?></option><?php endfor; ?>
                    </select>
                  </td>
                  <td style="width: 10px;">&nbsp;</td>
                  <td><label for="speed-fleet-peaceful"><?= $l['speed-fleet-peaceful'] ?></label></td>
                  <td>
                    <select id="speed-fleet-peaceful" name="speed-fleet-peaceful" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <?php for($s=1;$s<=10;$s++): ?><option value="<?= $s ?>"<?= $s===1?' selected':'' ?>><?= $s ?></option><?php endfor; ?>
                    </select>
                  </td>
                  <td style="width: 10px;">&nbsp;</td>
                  <td><label for="speed-fleet-holding"><?= $l['speed-fleet-holding'] ?></label></td>
                  <td>
                    <select id="speed-fleet-holding" name="speed-fleet-holding" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <?php for($s=1;$s<=10;$s++): ?><option value="<?= $s ?>"<?= $s===1?' selected':'' ?>><?= $s ?></option><?php endfor; ?>
                    </select>
                  </td>
                  <td style="width: 30px;">&nbsp;</td>
                  <td><label for="sp-cargohold"><?= $l['sp-cargohold'] ?>&nbsp;</label></td>
                  <td><input id="sp-cargohold" type="text" name="sp-cargohold" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="0" /></td>
                </tr>
              </table>

              <table class="mx-auto">
                <tr>
                  <td><label for="deut-factor"><?= $l['lf-bonus-deut-consum'] ?></label></td>
                  <td>
                    <select id="deut-factor" name="deut-factor" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <option value="5">50%</option>
                      <option value="6">60%</option>
                      <option value="7">70%</option>
                      <option value="8">80%</option>
                      <option value="9">90%</option>
                      <option value="10" selected>100%</option>
                    </select>
                  </td>
                  <td style="width: 30px;">&nbsp;</td>
                  <td><?= $l['deut-cons-reduction'] ?>&nbsp;</td>
                  <td>
                    <select id="deut-generals-bonus" name="deut-generals-bonus" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                      <option value="25">25%</option>
                      <option value="36">36%</option>
                      <option value="50">50%</option>
                    </select>
                  </td>
                </tr>
              </table>

              <hr>
              <table id="lf-blanket-ehn-tbl" class="mx-auto">
                <tr>
                  <td><label for="lf-mechan-general-enh"><?= $l['generals-character-bonus'] ?></label></td>
                  <td><input id="lf-mechan-general-enh" type="text" name="lf-mechan-general-enh" class="form-control form-control-sm d-inline-block count-input ui-input-margin" value="0" /></td>
                  <td><label for="lf-rocktal-collector-enh"><?= $l['collectors-character-bonus'] ?></label></td>
                  <td><input id="lf-rocktal-collector-enh" type="text" name="lf-rocktal-collector-enh" class="form-control form-control-sm d-inline-block count-input ui-input-margin" value="0" /></td>
                  <td><i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['character-bonus-hint'] ?>"></i></td>
                </tr>
              </table>

              <div class="accordion mt-2" id="lf-bonuses-accordion">
                <div class="accordion-item">
                  <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#accordion-lf-prm"><?= $l['lf-bonuses-ships'] ?></button>
                  </h2>
                  <div id="accordion-lf-prm" class="accordion-collapse collapse" data-bs-parent="#lf-bonuses-accordion">
                    <div class="accordion-body">
                      <div class="text-end mb-1">
                        <button id="open-lfbr" type="button" class="btn btn-sm btn-outline-primary"><?= $l['open-lfbr'] ?></button>
                      </div>
                      <table id="lf-ships-bonuses" class="lined mx-auto" cellpadding="0" cellspacing="1" border="0" style="width: 80%;">
                        <tr>
                          <th><?= $l['ship-name'] ?></th>
                          <th><?= $l['speed-increase'] ?></th>
                          <th><?= $l['cargo-increase'] ?></th>
                          <th><?= $l['fuel-decrease'] ?></th>
                        </tr>
                        <?php
                          $lfRows = [
                            ['small-cargo', 202], ['large-cargo', 203], ['light-fighter', 204],
                            ['heavy-fighter', 205], ['cruiser', 206], ['battleship', 207],
                            ['colony-ship', 208], ['recycler', 209], ['esp-probe', 210],
                            ['bomber', 211], ['destroyer', 213], ['death-star', 214],
                            ['battlecruiser', 215], ['reaper', 218], ['pathfinder', 219],
                          ];
                          foreach ($lfRows as $idx => $r):
                            $name = $r[0]; $tech = $r[1];
                            $cls = ($idx % 2) === 0 ? 'odd' : 'even';
                        ?>
                        <tr class="<?= $cls ?>">
                          <td><?= $l[$name] ?></td>
                          <td class="centered"><input type="text" class="form-control form-control-sm d-inline-block no-mp input-7columns centered <?= $tech ?>-speed"/></td>
                          <td class="centered"><input type="text" class="form-control form-control-sm d-inline-block no-mp input-7columns centered <?= $tech ?>-cargo"/></td>
                          <td class="centered"><input type="text" class="form-control form-control-sm d-inline-block no-mp input-7columns centered <?= $tech ?>-fuel"/></td>
                        </tr>
                        <?php endforeach; ?>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <hr>
              <table id="override-speed-tbl" class="mx-auto">
                <tr>
                  <td>
                    <input id="ovr-speed-cb" type="checkbox" name="override-speed" class="form-check-input"/>
                    <label for="ovr-speed-cb"><abbr data-bs-toggle="tooltip" title="<?= $l['ovr-fleet-speed-explain'] ?>"><?= $l['ovr-fleet-speed'] ?></abbr></label>
                    <input id="ovr-speed-t" type="text" class="form-control form-control-sm d-inline-block input-7columns ui-input-margin" value="10000" />
                  </td>
                </tr>
              </table>

            </div>
          </div>
        </div>

        <!-- Ships -->
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#accordion-ships"><?= $l['ships'] ?></button>
          </h2>
          <div id="accordion-ships" class="accordion-collapse collapse show" data-bs-parent="#params-accordion">
            <div class="accordion-body">

              <div id="fleets-panel" class="border rounded p-2 mb-2">
                <table class="mx-auto">
                  <tr>
                    <td><label for="fleet-name-select"><?= $l['fleet'] ?></label></td>
                    <td>
                      <select id="fleet-name-select" name="fleet-name-select" class="form-select form-select-sm d-inline-block w-auto ui-input-margin">
                        <option value="0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</option>
                      </select>
                    </td>
                    <td>
                      <div id="fleet-control" class="btn-group" role="group">
                        <button id="fleet-load" type="button" title="<?= $l['universe-load'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-box-arrow-in-down"></i></button>
                        <button id="fleet-save" type="button" title="<?= $l['universe-save'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-save"></i></button>
                        <button id="fleet-delete" type="button" title="<?= $l['universe-delete'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-x-lg"></i></button>
                      </div>
                    </td>
                    <td style="width: 20px;">&nbsp;</td>
                    <td><input id="fleet-name" type="text" name="fleet-name" class="form-control form-control-sm d-inline-block input-20columns ui-input-margin"/></td>
                    <td><button id="fleet-add" type="button" title="<?= $l['universe-add'] ?>" class="btn btn-sm btn-outline-secondary uni-control-btn"><i class="bi bi-plus-lg"></i></button></td>
                  </tr>
                </table>
              </div>

              <table class="mx-auto">
                <?php
                  $shipRows = [
                    [['small-cargo'], ['cruiser'], ['battlecruiser']],
                    [['large-cargo'], ['battleship'], ['death-star']],
                    [['light-fighter'], ['destroyer'], ['colony-ship']],
                    [['heavy-fighter'], ['bomber'], ['recycler']],
                    [['reaper'], ['pathfinder'], ['esp-probe']],
                  ];
                  foreach ($shipRows as $row):
                ?>
                <tr>
                  <?php foreach ($row as $ship): $s = $ship[0]; ?>
                  <td><label for="<?= $s ?>"><?= $l[$s] ?></label></td>
                  <td><label id="<?= $s ?>-speed" class="speed-label">0</label></td>
                  <td><input id="<?= $s ?>" type="text" name="<?= $s ?>" class="form-control form-control-sm d-inline-block count-input ui-input-margin" value="0" /></td>
                  <?php endforeach; ?>
                </tr>
                <?php endforeach; ?>
              </table>

            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Result tabs -->
    <ul class="nav nav-tabs mt-2" id="tabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="tabtag1" data-bs-toggle="tab" data-bs-target="#flight-times-panel" type="button" role="tab"><?= $l['flight-time'] ?></button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tabtag2" data-bs-toggle="tab" data-bs-target="#save-points-panel" type="button" role="tab"><?= $l['save-points'] ?></button>
      </li>
    </ul>
    <div class="tab-content border border-top-0 rounded-bottom p-2">

      <div class="tab-pane fade show active" id="flight-times-panel" role="tabpanel">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td valign="top">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <div><input id="warrior-bonus" type="checkbox" name="warrior-bonus" class="form-check-input"/> <label for="warrior-bonus"><?= $l['warrior-bonus'] ?></label></div>
                <div class="ms-3"><span><?= $l['mission-type-title'] ?></span></div>
                <div><input id="mission-type-0" type="radio" name="mission-type" value="0" class="form-check-input"/> <label for="mission-type-0"><?= $l['mission-type-war'] ?></label></div>
                <div><input id="mission-type-1" type="radio" name="mission-type" value="1" class="form-check-input"/> <label for="mission-type-1"><?= $l['mission-type-peaceful'] ?></label></div>
                <div><input id="mission-type-2" type="radio" name="mission-type" value="2" class="form-check-input"/> <label for="mission-type-2"><?= $l['mission-type-holding'] ?></label></div>
              </div>

              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <label for="destination-g"><?= $l['destination-point'] ?>&nbsp;</label>
                <span class="text-nowrap">
                  <input id="destination-g" type="text" name="destination-g" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['galaxy'] ?>" />:
                  <input id="destination-s" type="text" name="destination-s" class="form-control form-control-sm d-inline-block coord-input ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['system'] ?>" />:
                  <input id="destination-p" type="text" name="destination-p" class="form-control form-control-sm d-inline-block coord-input-small ui-input-margin" value="1" alt="<?= $l['destination-point'] ?>-<?= $l['planet'] ?>" />
                </span>
                <span class="ms-3"><label><?= $l['distance'] ?></label></span>
                <label id="distance"></label>
                <label id="empty-systems-label" style="display: none;">(<?= $l['empty-systems'] ?>&nbsp;
                  <input type="number" id="empty-systems-count-spin" class="form-control form-control-sm d-inline-block" step="1" min="0" />)
                </label>
              </div>

              <table id="flight-times" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                <tr>
                  <th><?= $l['speed'] ?></th>
                  <th><?= $l['flight-duration'] ?></th>
                  <th><?= $l['deut-consumption'] ?></th>
                  <th><?= $l['cargo-capacity'] ?></th>
                  <th style="width: 32px;">&nbsp;</th>
                </tr>
                <?php for($i=100; $i>0; $i-=5): ?>
                <tr class="<?= ($i % 10) === 5 ? 'odd' : 'even' ?>">
                  <td align="center"><?= $i ?>%</td>
                  <td align="center"></td>
                  <td align="center"></td>
                  <td align="center"></td>
                  <td align="center">
                    <div class="btn btn-sm btn-outline-secondary button-taketocalc" title="<?= $l['take-to-calc'] ?>">
                      <i class="bi bi-arrow-right"></i>
                    </div>
                  </td>
                </tr>
                <?php endfor; ?>
              </table>
            </td>
            <td valign="top" width="220px" class="ps-2">
              <div class="border rounded p-2">
                <div class="d-flex align-items-center justify-content-between">
                  <span id="flight-title-1" class="fw-bold"><?= $l['departure'] ?></span>
                  <div id="toggle-mode" class="btn btn-sm btn-outline-secondary" title="<?= $l['toggle-mode'] ?>"><i class="bi bi-arrow-left-right"></i></div>
                </div>
                <div class="d-flex gap-1 my-1">
                  <button id="set-departure-now" type="button" class="btn btn-sm btn-outline-secondary flex-fill" title="<?= $l['departure-now-hint'] ?>"><?= $l['departure-now'] ?></button>
                  <button id="set-departure-zero" type="button" class="btn btn-sm btn-outline-secondary" title="<?= $l['departure-zero-hint'] ?>">(00:00:00)</button>
                </div>
                <input type="text" id="start-datetime" class="form-control form-control-sm startdate-input" placeholder="dd.mm.yyyy hh:mm:ss" title="<?= $l['datetime-format-hint'] ?>"/>
                <div class="d-flex align-items-center gap-1 my-1">
                  <span class="fw-bold"><?= $l['flight'] ?></span>
                  <div id="add-flight-time" class="btn btn-sm btn-outline-secondary" title="<?= $l['add-row'] ?>"><i class="bi bi-plus-lg"></i></div>
                </div>
                <div id="flight-data">
                  <div class="d-flex align-items-center gap-1 mb-1 flight-leg">
                    <button type="button" class="btn btn-sm btn-outline-secondary button-toggle flight-leg-sign" data-sign="+" title="<?= $l['toggle-sign'] ?>"><i class="bi bi-plus-lg"></i></button>
                    <input id="flight-time" type="text" class="form-control form-control-sm flight-time-input" placeholder="dd hh:mm:ss" title="<?= $l['flight-time-format-hint'] ?>"/>
                    <button type="button" class="btn btn-sm btn-outline-danger button-remove" title="<?= $l['remove-row'] ?>"><i class="bi bi-x-lg"></i></button>
                  </div>
                </div>
                <div class="text-center fw-bold mt-1"><span id="flight-title-2"><?= $l['arrival'] ?></span></div>
                <div id="arrival-moment" class="form-control form-control-sm startdate-input text-center">?</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <div class="tab-pane fade" id="save-points-panel" role="tabpanel">
        <div class="text-end mb-1">
          <button id="calculate-savepoints" type="button" class="btn btn-sm btn-primary"><?= $l['search'] ?></button>
        </div>
        <div id="save-points-params">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span><?= $l['departure'] ?></span>
            <input type="text" id="save-start-datetime" class="form-control form-control-sm startdate-input" placeholder="dd.mm.yyyy hh:mm:ss" title="<?= $l['datetime-format-hint'] ?>" />
            <button id="set-save-departure-now" type="button" class="btn btn-sm btn-outline-secondary" title="<?= $l['departure-now-hint'] ?>"><?= $l['departure-now'] ?></button>
            <span class="ms-2"><?= $l['return'] ?></span>
            <input type="text" id="save-return-datetime" class="form-control form-control-sm startdate-input" placeholder="dd.mm.yyyy hh:mm:ss" title="<?= $l['datetime-format-hint'] ?>" />
            <span class="ms-2"><?= $l['save-tolerance'] ?></span>
            <input type="text" id="save-tolerance-time" class="form-control form-control-sm tolerance-time-input" placeholder="hh:mm" title="<?= $l['tolerance-time-format-hint'] ?>" />
            <i class="bi bi-question-circle" data-bs-toggle="tooltip" title="<?= $l['savepoints-hint'] ?>"></i>
          </div>
        </div>
        <div id="save-points-tables" class="mt-2">
          <div class="row">
            <?php
              $spTables = [
                ['galaxies', 'savepoints-galaxies'],
                ['systems', 'savepoints-systems'],
                ['planets', 'savepoints-planets'],
              ];
              foreach ($spTables as $spt):
            ?>
            <div class="col-4">
              <div class="border rounded p-2 text-center">
                <span><?= $l[$spt[0]] ?></span>
                <table id="<?= $spt[1] ?>" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                  <tr>
                    <th><?= $l['speed'] ?></th>
                    <th><?= $l['coords'] ?></th>
                    <th><?= $l['deuterium-short'] ?></th>
                  </tr>
                </table>
              </div>
            </div>
            <?php endforeach; ?>
          </div>
        </div>
      </div>

    </div>
  </div>

  <div id="warning">
    <div id="warning-message"></div>
  </div>
  <div id="hint">
    <table>
      <tr>
        <td valign="top"><i class="bi bi-info-circle"></i></td>
        <td><span id="hint-message"><?= $l['flightmodes-note'] ?></span></td>
      </tr>
    </table>
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

<!-- OGame own-api import modal -->
<div class="modal fade" id="own-api-reader" tabindex="-1" aria-labelledby="own-api-reader-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="own-api-reader-label"><?= $l['own-api-reader-hdr'] ?></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="mb-2"><?= $l['own-api-reader-info'] ?></div>
        <textarea id="own-api-txtarea" class="form-control" rows="6"></textarea>
        <div class="mt-2 small text-muted"><?= $l['own-api-reader-note'] ?></div>
      </div>
      <div class="modal-footer">
        <button id="own-api-read-btn" type="button" class="btn btn-primary"><?= $l['own-api-import-title'] ?></button>
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
  initializeFlightCalculator();
});
</script>

</body>
</html>
