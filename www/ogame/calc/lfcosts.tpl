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
  <link type="text/css" href="/ogame/calc/css/costs_bs.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/costs_bs.css'); ?>" rel="stylesheet"/>

  <!-- Bootstrap 5 JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>

  <!-- Utility libraries -->
  <script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/common.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/common.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/lfcosts-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/lfcosts-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/lfcosts-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/lfcosts-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts-orchestration.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/lfcosts.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/lfcosts.js'); ?>"></script>

  <script type="text/javascript">
    // десятичный разделитель будет использоваться в функциях, проверяющих валидность чисел в input-ах
    options.decimalSeparator='<?= $l['decimal-separator'] ?>';
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
    options.warnindDivId = 'warning';
    options.warnindMsgDivId = 'warning-message';
    options.fieldHint = '<?= $l['field-hint'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
    options.energyCostToBuildLabel = '<?= $l['energy-cost-to-build'] ?>';

    options.techCosts = {
            <?php $first = true; ?>
            <?php foreach ($techData as $id => $tech): ?>
            <?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>,
              <?= $tech[6] ?>, <?= $tech[7] ?>, <?= $tech[8] ?>, <?= $tech[9] ?>, <?= $tech[10] ?>, <?= $tech[11] ?>]
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

<div id="lfcosts">
  <div class="border rounded position-relative">
    <div class="d-inline-block d-flex align-items-center">
      <div class="bg-body-secondary text-primary-emphasis rounded main-header text-center flex-grow-1">
        <?= $l['title'] ?>
      </div>
      <div id="reset" class="top-0 end-0 d-flex align-items-center justify-content-center bg-danger-subtle" title="<?= $l['reset'] ?>">
        <i class="bi bi-arrow-counterclockwise" style="color: #dc3545; font-size: 1.25rem;"></i>
      </div>
    </div>
    <div id="general-settings-panel" class="border rounded m-1">
      <div class="d-flex align-items-center">
        <p class="border rounded subheader bg-primary-subtle mb-0 flex-grow-1"><?= $l['parameters'] ?></p>
      </div>
      <!-- Parameter Tabs -->
      <ul class="nav nav-tabs nav-tabs-sm" id="paramTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-buildings-tab" data-bs-toggle="tab" data-bs-target="#param-buildings" type="button" role="tab"><?= $l['param-tab-buildings'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-researches-tab" data-bs-toggle="tab" data-bs-target="#param-researches" type="button" role="tab"><?= $l['researches'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-common-tab" data-bs-toggle="tab" data-bs-target="#param-common" type="button" role="tab"><?= $l['param-tab-common'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="param-lifeforms-tab" data-bs-toggle="tab" data-bs-target="#param-lifeforms" type="button" role="tab"><?= $l['param-tab-lifeforms'] ?></button>
        </li>
      </ul>
      <div id="general-settings" class="tab-content">
        <!-- Buildings tab: robot factory, nanite -->
        <div class="tab-pane fade p-2" id="param-buildings" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <div class="d-flex align-items-center gap-1">
              <label for="robot-factory-level"><?= $l['robot-factory'] ?></label>
              <input id="robot-factory-level" type="text" name="robot-factory-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="nanite-factory-level"><?= $l['nanite-factory'] ?></label>
              <input id="nanite-factory-level" type="text" name="nanite-factory-level" class="form-control form-control-sm level-input" value="0" />
            </div>
          </div>
        </div>
        <!-- Common tab: universe speed, class, full-numbers -->
        <div class="tab-pane fade p-2" id="param-common" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <div class="d-flex align-items-center gap-1">
              <label for="universe-speed"><?= $l['economy-speed'] ?></label>
              <select id="universe-speed" name="universe-speed" class="form-select form-select-sm w-auto">
                <option value="1" selected="selected">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1 ms-3">
              <input id="full-numbers" type="checkbox" name="full-numbers" class="form-check-input"/>
              <label for="full-numbers"><?= $l['full-numbers'] ?></label>
            </div>
            <label class="ms-3"><?= $l['class'] ?>:</label>
            <div class="d-flex align-items-center gap-1">
              <input id="class-0" type="radio" name="class" value="0" tabindex="1" class="form-check-input"/>
              <label for="class-0"><?= $l['class-collector'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="class-1" type="radio" name="class" value="1" tabindex="2" class="form-check-input"/>
              <label for="class-1"><?= $l['class-general'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="class-2" type="radio" name="class" value="2" tabindex="3" class="form-check-input"/>
              <label for="class-2"><?= $l['class-discoverer'] ?></label>
            </div>
          </div>
        </div>
        <!-- Researches tab: ion tech, hyper tech, cost/time reduction -->
        <div class="tab-pane fade p-2" id="param-researches" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <div class="d-flex align-items-center gap-1">
              <label for="ion-tech-level"><?= $l['ion-tech'] ?></label>
              <input id="ion-tech-level" type="text" name="ion-tech-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="hyper-tech-level"><?= $l['hyper-tech'] ?></label>
              <input id="hyper-tech-level" type="text" name="hyper-tech-level" class="form-control form-control-sm level-input" value="0" />
            </div>
          </div>
        </div>
        <!-- Lifeforms tab: race, megalith, mrc, cargo capacity increase -->
        <div class="tab-pane fade show active p-2" id="param-lifeforms" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
            <div class="d-flex align-items-center gap-1">
              <label for="race-selector"><?= $l['race'] ?></label>
              <select id="race-selector" name="race-selector" class="form-select form-select-sm w-auto">
              <?php for ($r = 1; $r <= 4; $r++):?>
                <option value="<?=$r?>" <?php if ($r == 1):?>selected="selected"<?php endif; ?>><?= $l['race-'.$r] ?></option>
              <?php endfor; ?>
              </select>
            </div>
            <div id="megalith-level-wrap" class="align-items-center gap-1" style="display: none;">
              <label id="lbl-megalith-level" for="megalith-level"><?= $l['megalith'] ?></label>
              <input id="megalith-level" type="text" name="megalith-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div id="mrc-level-wrap" class="align-items-center gap-1" style="display: none;">
              <label id="lbl-mrc-level" for="mrc-level"><?= $l['mineral-res-centre'] ?></label>
              <input id="mrc-level" type="text" name="mrc-level" class="form-control form-control-sm level-input" value="0" />
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
            <div class="d-flex align-items-center gap-1">
              <label for="research-cost-reduction"><?= $l['research-cost-reduction'] ?></label>
              <input id="research-cost-reduction" type="text" name="research-cost-reduction" class="form-control form-control-sm fleet-input" value="0" />
              <i class="bi bi-question-circle ms-1" data-bs-toggle="tooltip" title="<?= $l['times-hint'] ?>"></i>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="research-time-reduction"><?= $l['research-time-reduction'] ?></label>
              <input id="research-time-reduction" type="text" name="research-time-reduction" class="form-control form-control-sm fleet-input" value="0" />
              <i class="bi bi-question-circle ms-1" data-bs-toggle="tooltip" title="<?= $l['times-hint'] ?>"></i>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span><?= $l['cargo-cap-increase'] ?></span>
            <div class="d-flex align-items-center gap-1">
              <label for="sc-capacity-increase"><?= $l['sc-short'] ?></label>
              <input id="sc-capacity-increase" type="text" name="sc-capacity-increase" class="form-control form-control-sm fleet-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="lc-capacity-increase"><?= $l['lc-short'] ?></label>
              <input id="lc-capacity-increase" type="text" name="lc-capacity-increase" class="form-control form-control-sm fleet-input" value="0" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Main Tabs -->
    <ul class="nav nav-tabs" id="mainTabs" role="tablist">
    <?php for ($i = 0; $i < count($tabTitles); $i++):?>
      <li class="nav-item" role="presentation">
        <button class="nav-link <?= $i === 0 ? 'active' : '' ?>" id="tabtag-<?=$i?>" data-bs-toggle="tab" data-bs-target="#tab-<?=$i?>" type="button" role="tab">
          <?= $l[$tabTitles[$i]] ?>
        </button>
      </li>
    <?php endfor; ?>
    </ul>
    <div class="tab-content" id="mainTabContent">
      <?php for ($i = 0; $i < count($tabTitles); $i++):?>
        <div class="tab-pane fade <?= $i === 0 ? 'show active' : '' ?>" id="tab-<?=$i?>" role="tabpanel">
        <?php if ($i < 2):?>
          <!-- Inner Tabs -->
          <ul class="nav nav-tabs" id="innerTabs<?=$i?>" role="tablist">
          <?php $colHeaders = ($i == 0)?$colHeadersAllOne:$colHeadersAllMult; ?>
          <?php $firstInnerTab = array_key_first($techTypes); ?>
          <?php foreach ($techTypes as $j => $type) :?>
            <li class="nav-item" role="presentation">
              <button class="nav-link <?= $j === $firstInnerTab ? 'active' : '' ?>" id="tabtag-<?=$i?>-<?=$j?>" data-bs-toggle="tab" data-bs-target="#tab-<?=$i?>-<?=$j?>" type="button" role="tab">
                <?= $l[$type] ?>
              </button>
            </li>
          <?php endforeach; ?>
          </ul>
          <div class="tab-content">
            <?php foreach ($techTypes as $j => $type):?>
            <?php
              if ($j == 2)
                $colHeaders[0] = 'research';
              else
                $colHeaders[0] = 'building';
            ?>
            <div class="tab-pane fade <?= $j === $firstInnerTab ? 'show active' : '' ?> no-mp" id="tab-<?=$i?>-<?=$j?>" role="tabpanel">
              <table id="table-<?=$i?>-<?=$j?>" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                <tr>
                  <th style="display: none;"></th>
                  <?php foreach ($colHeaders as $idx => $header) :?>
                  <th <?=($idx > 0)?'align="center"':''?>>
                    <?php if ($header == 'dm-abbr'): ?>
                      <abbr data-bs-toggle="tooltip" title="<?= $l['dm-explanation'] ?>"><?=$l[$header] ?></abbr>
                    <?php else: ?>
                      <?=$l[$header] ?>
                    <?php endif; ?>
                  </th>
                  <?php endforeach; ?>
                </tr>
                <?php $techs = getTechsByType($j); $row = 1; ?>
                <?php $energyHintBuildings = [1002, 2002, 3002, 4002]; ?>
                <?php foreach ($techs as $tech) :?>
                <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                  <td style="display: none;"><?=$tech?></td>
                  <td class="min"><?=$l[$techData[$tech][0]]?><?php if (in_array($tech, $energyHintBuildings)): ?> <i class="bi bi-lightning-charge energy-cost-hint" data-bs-toggle="tooltip" title="<?= $l['energy-cost-to-build'] ?>: 0"></i><?php endif; ?></td>
                  <?php if ($i == 1): ?>
                  <td align="center"><input type="text" class="form-control form-control-sm level-input ui-input-margin" value="0"/></td>
                  <?php endif;?>
                  <td align="center"><input type="text" class="form-control form-control-sm level-input ui-input-margin" value="0"/></td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td align="center">0<?=$l['datetime-s']?></td>
                  <td align="center">0</td>
                  <?php if ($i == 0):?>
                    <td align="center">0</td>
                  <?php endif; ?>
                </tr>
                <?php endforeach; ?>
                <tr>
                  <td style="display: none;">t</td>
                  <td colspan="<?= ($i == 1)?'2':'1' ?>" class="border-n"><?=$l['total']?></td>
                  <td align="center" class="border-n">0</td>
                  <td align="center" class="border-n border-s border-w"><b>0</b></td>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <?php if ($i == 0):?>
                  <td align="center" class="border-n border-s"><b>0</b></td>
                  <?php endif; ?>
                  <td align="center" class="border-n border-s border-e"><b>0</b></td>
                </tr>
                <tr><td colspan="9" height="5px">&nbsp;</td></tr>
                <tr>
                  <td style="display: none;">gt</td>
                  <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-n border-w"><?=$l['grand-total']?></td>
                  <td align="center" class="border-n">0</td>
                  <td align="center" class="border-n">0</td>
                  <td align="center" class="border-n">0</td>
                  <td align="center" class="border-n">0</td>
                  <?php if ($i == 0):?>
                  <td align="center" class="border-n"><b>0</b></td>
                  <?php endif; ?>
                  <td align="center" class="border-n border-e">0</td>
                </tr>
                <tr>
                  <td style="display: none;">ra</td>
                  <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?= $l['res-available'] ?></td>
                  <td align="center"><input id="metal-available-<?=$i?>-<?=$j?>" type="text" name="metal-available" class="form-control form-control-sm res-input" value="0" /></td>
                  <td align="center"><input id="crystal-available-<?=$i?>-<?=$j?>" type="text" name="crystal-available" class="form-control form-control-sm res-input" value="0" /></td>
                  <td align="center"><input id="deut-available-<?=$i?>-<?=$j?>" type="text" name="deut-available" class="form-control form-control-sm res-input" value="0" /></td>
                  <td></td>
                  <?php if ($i == 0):?>
                  <td></td>
                  <?php endif; ?>
                  <td class="border-e"></td>
                </tr>
                <tr>
                  <td style="display: none;">dlv</td>
                  <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?= $l['res-needed'] ?></td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td></td>
                  <?php if ($i == 0):?>
                  <td></td>
                  <?php endif; ?>
                  <td class="border-e"></td>
                </tr>
                <tr>
                  <td style="display: none;">gtt</td>
                  <td class="border-s border-w"><?=$l['transports-needed']?></td>
                  <td align="center" class="border-s">0 <?=$l['sc-short']?></td>
                  <td align="center" class="border-s">0 <?=$l['lc-short']?></td>
                  <td colspan="<?= ($i == 1)?'4':(($i == 0)?'4':'3') ?>" align="center" class="border-s">&nbsp;</td>
                  <td align="center" class="border-s border-e">&nbsp;</td>
                </tr>
              </table>
            </div>
            <?php endforeach; ?>
          </div> <!-- End inner tab-content -->
        <?php else: ?>
          <div class="p-2">
            <div class="d-flex align-items-center flex-wrap gap-2 py-1">
              <select id="tech-types-select" name="tech-types-select" class="form-select form-select-sm w-auto">
              <?php $techTypes = array(1 => 'buildings', 2 => 'researches'); ?>
              <?php foreach ($techTypes as $type => $typeName) :?>
                <optgroup label="<?=$l[$typeName]?>">
                <?php $techs = getTechsByType($type);?>
                <?php foreach ($techs as $tech) :?>
                  <option value="<?=$tech?>" <?= ($tech==1)?'selected="selected"':'' ?>><?=$l[$techData[$tech][0]]?></option>
                <?php endforeach; ?>
                </optgroup>
              <?php endforeach; ?>
              </select>
              <label for="tab2-from-level"><?= $l['from-level'] ?></label>
              <input id="tab2-from-level" type="text" name="tab2-from-level" class="form-control form-control-sm level-input" value="0"/>
              <label for="tab2-to-level"><?= $l['to-level'] ?></label>
              <input id="tab2-to-level" type="text" name="tab2-to-level" class="form-control form-control-sm level-input" value="0"/>
            </div>
          </div>
          <div id="commons-table-div">
            <table id="commons-table" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
              <tr>
              <?php foreach ($colHeadersOneCommon as $colName): ?>
                <th><?=$l[$colName]?></th>
              <?php endforeach; ?>
              </tr>
              <tr>
                <td colspan="6">&nbsp;</td>
              </tr>
              <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                <td class="border-n border-w"><?=$l['total']?></td>
                <td align="center" class="border-n"><b>0</b></td>
                <td align="center" class="border-n"><b>0</b></td>
                <td align="center" class="border-n"><b>0</b></td>
                <td align="center" class="border-n"><b>0</b></td>
                <td align="center" class="border-n border-e"><b>0</b></td>
              </tr>
              <tr>
                <td class="border-w"><?= $l['res-available'] ?></td>
                <td align="center"><input id="metal-available-2-1" type="text" name="metal-available" class="form-control form-control-sm res-input" value="0" /></td>
                <td align="center"><input id="crystal-available-2-1" type="text" name="crystal-available" class="form-control form-control-sm res-input" value="0" /></td>
                <td align="center"><input id="deut-available-2-1" type="text" name="deut-available" class="form-control form-control-sm res-input" value="0" /></td>
                <td></td>
                <td class="border-e"></td>
              </tr>
              <tr>
                <td class="border-w"><?= $l['res-needed'] ?></td>
                <td align="center">0</td>
                <td align="center">0</td>
                <td align="center">0</td>
                <td></td>
                <td class="border-e"></td>
              </tr>
              <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                <td class="border-s border-w"><?=$l['transports-needed']?></td>
                <td align="center" class="border-s">0 <?=$l['sc-short']?></td>
                <td align="center" class="border-s">0 <?=$l['lc-short']?></td>
                <td colspan="3" class="border-s border-e"></td>
              </tr>
            </table>
          </div>
        <?php endif;?>
        </div>
      <?php endfor; ?>
    </div> <!-- End main tab-content -->
  </div>
  <div id="warning">
    <div id="warning-message"></div>
  </div>
  <div id="hint">
    <table>
      <tr>
        <td valign="top">
          <i class="bi bi-info-circle"></i>
        </td>
        <td>
          <span id="hint-message"><?= $l['times-note'] ?></span>
        </td>
      </tr>
    </table>
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
  initializeLfCostsCalculator();
});
</script>

</body>
</html>
