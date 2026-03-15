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

  <!-- DOM Utilities (jQuery replacement) -->
  <script type="text/javascript" src="/ogame/calc/js/dom-utils.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/dom-utils.js'); ?>"></script>

  <!-- New modular calculator architecture -->
  <script type="text/javascript" src="/ogame/calc/js/costs-core.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/costs-core.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/costs-data-collector.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/costs-data-collector.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/costs-renderer.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/costs-renderer.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/costs-orchestration.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/costs-orchestration.js'); ?>"></script>

  <script type="text/javascript">
    // Global options object
    var options = {};

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
    options.planetNumStr = '<?= $l['planet-num'] ?>';
    options.doneTitle = '<?= $l['done'] ?>';
    options.cancelTitle = '<?= $l['cancel'] ?>';
    options.msgMinConstraintViolated = '<?= $l['msg-min-constraint-violated'] ?>';
    options.msgMaxConstraintViolated = '<?= $l['msg-max-constraint-violated'] ?>';
    options.msgCantResearch = '<?= $l['msg-cant-research'] ?>';

    options.techCosts = {
              <?php $first = true; ?>
              <?php foreach ($techData as $id => $tech): ?>
              <?=(!$first)?',':''?><?= $id ?>:[<?= $tech[2] ?>, <?= $tech[3] ?>, <?= $tech[4] ?>, <?= $tech[5] ?>]
              <?php $first = false; ?>
              <?php endforeach; ?>
      };
    options.techReqs = {
        <?php $first = true; ?>
         <?php foreach ($techReqs as $id => $req): ?>
         <?=(!$first)?',':''?><?= $id ?>:<?= $req ?>
         <?php $first = false; ?>
         <?php endforeach; ?>
    };

    // Minimal options.prm for IRN dialog compatibility
    options.prm = {
      irnLevel: 0,
      planetsSpin: 8,
      labLevels: [0, 0, 0, 0, 0, 0, 0, 0],
      labChoice: -1
    };
    options.currPlanetsCount = 8;
    options.resultingLabLevelComputed = false;

  </script>
<?php require_once('../../cookies.tpl'); ?>
</head>

<body>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-2"><?php require_once('../../sidebar_bs.tpl'); ?></div>
    <div class="col-md-10">
    <?php require_once('../../topbar_bs.tpl'); ?>

<div id="costs">
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
          <button class="nav-link active" id="param-buildings-tab" data-bs-toggle="tab" data-bs-target="#param-buildings" type="button" role="tab"><?= $l['buildings'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-researches-tab" data-bs-toggle="tab" data-bs-target="#param-researches" type="button" role="tab"><?= $l['researches'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-common-tab" data-bs-toggle="tab" data-bs-target="#param-common" type="button" role="tab"><?= $l['param-tab-common'] ?></button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="param-lifeforms-tab" data-bs-toggle="tab" data-bs-target="#param-lifeforms" type="button" role="tab"><?= $l['lifeforms'] ?></button>
        </li>
      </ul>
      <div class="tab-content" id="paramTabContent">
        <!-- Buildings tab -->
        <div class="tab-pane fade show active p-2" id="param-buildings" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <div class="d-flex align-items-center gap-1">
              <label for="robot-factory-level"><?= $l['robot-factory'] ?> (<?= $l['planet'] ?>)</label>
              <input id="robot-factory-level" type="text" name="robot-factory-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="robot-factory-level-moon"><?= $l['robot-factory'] ?> (<?= $l['moon'] ?>)</label>
              <input id="robot-factory-level-moon" type="text" name="robot-factory-level-moon" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="nanite-factory-level"><?= $l['nanite-factory'] ?></label>
              <input id="nanite-factory-level" type="text" name="nanite-factory-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="shipyard-level"><?= $l['shipyard'] ?></label>
              <input id="shipyard-level" type="text" name="shipyard-level" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="research-lab-level"><?= $l['research-lab'] ?></label>
              <div class="d-flex gap-1">
                <input id="research-lab-level" type="text" name="research-lab-level" class="form-control form-control-sm level-input" value="0"/>
                <button id="open-llc-dialog" class="btn btn-outline-primary btn-sm" type="button" title="<?= $l['calculate'] ?>">
                  <i class="bi bi-calculator"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Researches tab -->
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
        <!-- Common tab -->
        <div class="tab-pane fade p-2" id="param-common" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
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
            <div class="d-flex align-items-center gap-1">
              <label for="research-speed"><?= $l['research-speed'] ?></label>
              <select id="research-speed" name="research-speed" class="form-select form-select-sm w-auto">
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
                <option value="11">11</option>
                <option value="12">12</option>
                <option value="13">13</option>
                <option value="14">14</option>
                <option value="15">15</option>
                <option value="16">16</option>
                <option value="17">17</option>
                <option value="18">18</option>
                <option value="19">19</option>
                <option value="20">20</option>
              </select>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="research-bonus" type="checkbox" name="research-bonus" class="form-check-input"/>
              <label for="research-bonus"><?= $l['research-event'] ?></label>
            </div>
            <div class="d-flex align-items-center gap-1">
              <input id="technocrat" type="checkbox" name="technocrat" class="form-check-input"/>
              <label for="technocrat"><?= $l['technocrat'] ?></label>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <label><?= $l['class'] ?>:</label>
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
            <div class="d-flex align-items-center gap-1">
              <input id="full-numbers" type="checkbox" name="full-numbers" class="form-check-input"/>
              <label for="full-numbers"><?= $l['full-numbers'] ?></label>
            </div>
          </div>
        </div>
        <!-- LifeForms tab -->
        <div class="tab-pane fade p-2" id="param-lifeforms" role="tabpanel">
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <div class="d-flex align-items-center gap-1">
              <label for="research-cost-reduction"><?= $l['research-cost-reduction'] ?></label>
              <input id="research-cost-reduction" type="text" name="research-cost-reduction" class="form-control form-control-sm level-input" value="0" />
              <span>%</span>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="research-time-reduction"><?= $l['research-time-reduction'] ?></label>
              <input id="research-time-reduction" type="text" name="research-time-reduction" class="form-control form-control-sm level-input" value="0" />
              <span>%</span>
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="mineral-res-cntr-lvl"><?= $l['mineral-res-cntr-lvl'] ?></label>
              <input id="mineral-res-cntr-lvl" type="text" name="mineral-res-cntr-lvl" class="form-control form-control-sm level-input" value="0" />
            </div>
            <div class="d-flex align-items-center gap-1">
              <label for="lf-terraformer-rdc"><?= $l['lf-terraformer-rdc'] ?></label>
              <input id="lf-terraformer-rdc" type="text" name="lf-terraformer-rdc" class="form-control form-control-sm level-input" value="0" />
              <span>%</span>
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
                if ($j == 4)
                  $colHeaders[0] = 'research';
                else if ($j == 5)
                  $colHeaders[0] = 'ship';
                else
                  $colHeaders[0] = 'building';
                if ($i == 0) {
                  if ($j == 5 || $j == 6)
                    $colHeaders[1] = 'quantity';
                  else {
                    $colHeaders[1] = 'level';
                  }
                }
              ?>
              <div class="tab-pane fade <?= $j === $firstInnerTab ? 'show active' : '' ?> no-mp" id="tab-<?=$i?>-<?=$j?>" role="tabpanel">
                <table id="table-<?=$i?>-<?=$j?>" class="lined" cellpadding="0" cellspacing="1" border="0">
                  <tr>
                    <th style="display: none;"></th>
                    <?php foreach ($colHeaders as $idx => $header) :?>
                    <th <?=($idx > 0)?'align="center"':''?> style="white-space:nowrap">
                      <?php if ($header == 'dm-abbr'): ?>
                        <abbr title="<?= $l['dm-explanation'] ?>"><?=$l[$header] ?></abbr>
                      <?php else: ?>
                        <?=$l[$header] ?>
                      <?php endif; ?>
                    </th>
                    <?php endforeach; ?>
                  </tr>
                  <?php $techs = getTechsByType($j); $row = 1;?>
                  <?php foreach ($techs as $tech) :?>
                  <?php
                    $techID = $j == 3 ? $tech + 10000 : $tech; // зданиям на луне присвоим id на 1000 больше, чтобы их можно было отличить при чтении id строк
                  ?>
                  <tr class="<?= ($row++ % 2) === 1 ? 'odd' : 'even' ?>">
                    <td style="display: none;"><?=$techID?></td>
                    <td style="white-space: nowrap"><?=$l[$techData[$tech][0]]?></td>
                    <?php if ($i == 1): ?>
                    <td align="center"><input type="text" class="form-control form-control-sm level-input ui-input-margin" value="0"/></td>
                    <?php endif;?>
                    <?php if ($j == 5 || $j == 6): ?>
                      <td align="center"><input type="text" class="form-control form-control-sm fleet-input ui-input-margin" value="0"/></td>
                    <?php else: ?>
                      <td align="center"><input type="text" class="form-control form-control-sm level-input ui-input-margin" value="0"/></td>
                    <?php endif; ?>
                    <td align="center">0</td>
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
                    <td style="display: none;"></td>
                    <td colspan="<?= ($i == 1)?'2':'1' ?>" class="border-n" ><?=$l['total']?></td>
                    <td align="center" class="border-n" >0</td>
                    <td align="center" class="border-n border-s border-w" ><b>0</b></td>
                    <td align="center" class="border-n border-s" ><b>0</b></td>
                    <td align="center" class="border-n border-s" ><b>0</b></td>
                    <td align="center" class="border-n border-s" ><b>0</b></td>
                    <td align="center" class="border-n border-s" ><b>0</b></td>
                    <?php if ($i == 0):?>
                    <td align="center" class="border-n border-s" ><b>0</b></td>
                    <?php endif; ?>
                    <td align="center" class="border-n border-s border-e" ><b>0</b></td>
                  </tr>
                  <tr><td colspan="<?= ($i == 1)?'10':'9' ?>" height=5px;>&nbsp;</td></tr>
                  <tr>
                    <td style="display: none;"></td>
                    <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-n border-w" ><?=$l['grand-total']?></td>
                    <td align="center" class="border-n" >0</td>
                    <td align="center" class="border-n" >0</td>
                    <td align="center" class="border-n" >0</td>
                    <td align="center" class="border-n" >0</td>
                    <td align="center" class="border-n" >0</td>
                    <?php if ($i == 0):?>
                    <td align="center" class="border-n" ><b>0</b></td>
                    <?php endif; ?>
                    <td align="center" class="border-n border-e" >0</td>
                  </tr>
                  <tr>
                    <td style="display: none;"></td>
                    <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?=$l['res-available']?></td>
                    <td align="center"><input id="metal-available-<?=$i?>-<?=$j?>" type="text" name="metal-available" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                    <td align="center"><input id="crystal-available-<?=$i?>-<?=$j?>" type="text" name="crystal-available" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                    <td align="center"><input id="deut-available-<?=$i?>-<?=$j?>" type="text" name="deut-available" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                    <td colspan="<?= ($i == 1)?'2':'3' ?>"></td>
                    <td class="border-e"></td>
                  </tr>
                  <tr>
                    <td style="display: none;"></td>
                    <td colspan="<?= ($i == 1)?'3':'2' ?>" class="border-w"><?=$l['res-needed']?></td>
                    <td align="center">0</td>
                    <td align="center">0</td>
                    <td align="center">0</td>
                    <td colspan="<?= ($i == 1)?'2':'3' ?>"></td>
                    <td class="border-e"></td>
                  </tr>
                  <tr>
                    <td style="display: none;"></td>
                    <td class="border-s border-w"><?=$l['transports-needed']?></td>
                    <td align="center" class="border-s">0 <?=$l['sc-short']?></td>
                    <td align="center" class="border-s">0 <?=$l['lc-short']?></td>
                    <td colspan="<?= ($i == 1)?'5':(($i == 0)?'5':'4') ?>" align="center" class="border-s">&nbsp;</td>
                    <td align="center" class="border-s border-e">&nbsp;</td>
                  </tr>
                </table>
              </div>
              <?php endforeach; ?>
            </div> <!-- End inner tab-content -->
          <?php else: ?>
            <div class="p-2">
              <div class="d-flex flex-column gap-1 py-1">
                <div class="d-flex align-items-center flex-wrap gap-2">
                  <select id="tech-types-select" name="tech-types-select" class="form-select form-select-sm w-auto">
                  <?php	$techTypes = array(2 => 'buildings-planet', 3 => 'buildings-moon', 4 => 'researches'); ?>
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
                  <span id="range-booster-wrap" class="d-flex align-items-center gap-2">
                    <label for="booster"><?= $l['booster'] ?></label>
                    <select id="booster" name="booster" class="form-select form-select-sm w-auto">
                      <option value="0" selected="selected">0%</option>
                      <option value="1">10%</option>
                      <option value="2">20%</option>
                      <option value="3">30%</option>
                      <option value="4">40%</option>
                    </select>
                  </span>
                </div>
                <div id="range-producer-row" class="d-flex align-items-center flex-wrap gap-2">
                  <label for="energy-tech-level"><?= $l['energy-tech-level'] ?></label>
                  <input id="energy-tech-level" type="text" name="energy-tech-level" class="form-control form-control-sm level-input" value="0"/>
                  <label for="plasma-tech-level"><?= $l['plasma-tech-level'] ?></label>
                  <input id="plasma-tech-level" type="text" name="plasma-tech-level" class="form-control form-control-sm level-input" value="0"/>
                  <label for="max-planet-temp"><?= $l['max-planet-temp'] ?></label>
                  <input id="max-planet-temp" type="text" name="max-planet-temp" class="form-control form-control-sm level-input" value="0" alt="<?= $l['max-planet-temp'] ?>"/>
                  <label for="planet-pos"><?= $l['planet-pos'] ?></label>
                  <input id="planet-pos" type="text" name="planet-pos" class="form-control form-control-sm level-input" value="0" alt="<?= $l['planet-pos'] ?>"/>
                </div>
                <div id="range-officers-row" class="d-flex align-items-center flex-wrap gap-3">
                  <div class="d-flex align-items-center gap-1"><input id="engineer" type="checkbox" name="engineer" class="form-check-input"/><label for="engineer"><?= $l['engineer'] ?></label></div>
                  <div class="d-flex align-items-center gap-1"><input id="admiral" type="checkbox" name="admiral" class="form-check-input"/><label for="admiral"><?= $l['admiral'] ?></label></div>
                  <div class="d-flex align-items-center gap-1"><input id="geologist" type="checkbox" name="geologist" class="form-check-input"/><label for="geologist"><?= $l['geologist'] ?></label></div>
                  <div class="d-flex align-items-center gap-1"><input id="commander" type="checkbox" name="commander" class="form-check-input"/><label for="commander"><?= $l['commander'] ?></label></div>
                </div>
              </div>
            </div>
            <div id="prods-table-div">
              <table id="prods-table" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                <tr>
                <?php foreach ($colHeadersOneProd as $colName): ?>
                  <th><?=$l[$colName]?></th>
                <?php endforeach; ?>
                </tr>
                <tr>
                  <td colspan="9">&nbsp;</td>
                </tr>
                <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                  <td align="center" class="border-n" ><?=$l['total']?></td>
                  <td align="center" class="border-n border-s border-w" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s border-e" ><b>0</b></td>
                </tr>
                <tr>
                  <td align="center"><?=$l['res-available']?></td>
                  <td align="center"><input id="prods-metal-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td align="center"><input id="prods-crystal-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td align="center"><input id="prods-deut-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td colspan="5"></td>
                </tr>
                <tr>
                  <td align="center"><?=$l['res-needed']?></td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td colspan="5"></td>
                </tr>
                <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                  <td align="center" ><?=$l['transports-needed-short']?></td>
                  <td align="center" >0 <?=$l['sc-short']?></td>
                  <td align="center" >0 <?=$l['lc-short']?></td>
                  <td colspan="6" ></td>
                </tr>
              </table>
            </div>
            <div id="commons-table-div" style="display: none;">
              <table id="commons-table" class="lined" cellpadding="0" cellspacing="1" border="0" width="100%">
                <tr>
                <?php foreach ($colHeadersOneCommon as $colName): ?>
                  <th><?=$l[$colName]?></th>
                <?php endforeach; ?>
                </tr>
                <tr>
                  <td colspan="7">&nbsp;</td>
                </tr>
                <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                  <td align="center" class="border-n" ><?=$l['total']?></td>
                  <td align="center" class="border-n border-s border-w" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s" ><b>0</b></td>
                  <td align="center" class="border-n border-s border-e" ><b>0</b></td>
                </tr>
                <tr>
                  <td align="center"><?=$l['res-available']?></td>
                  <td align="center"><input id="commons-metal-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td align="center"><input id="commons-crystal-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td align="center"><input id="commons-deut-available" type="text" class="form-control form-control-sm" style="text-align:center" value="0" /></td>
                  <td colspan="3"></td>
                </tr>
                <tr>
                  <td align="center"><?=$l['res-needed']?></td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td align="center">0</td>
                  <td colspan="3"></td>
                </tr>
                <tr class="<?= ($row % 2) === 1 ? 'odd' : 'even' ?>">
                  <td align="center" ><?=$l['transports-needed-short']?></td>
                  <td align="center" >0 <?=$l['sc-short']?></td>
                  <td align="center" >0 <?=$l['lc-short']?></td>
                  <td colspan="4" ></td>
                </tr>
              </table>
            </div>
          <?php endif;?>
          </div>
          <?php
            // на вкладке "все элементы - несколько уровней" не должно быть вкладок с кораблями и обороной
            unset($techTypes[5]);
            unset($techTypes[6]);
          ?>
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
// Initialize the calculator app
document.addEventListener('DOMContentLoaded', function() {
  // Bootstrap tabs are auto-initialized from markup
  // Bootstrap modals are auto-initialized from markup

  // Initialize the calculator app
  initializeCostsCalculator();
});
</script>

<!-- IRN Calculator Modal -->
<div class="modal fade" id="irn-calc" tabindex="-1" aria-labelledby="irn-calc-label" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="irn-calc-label"><?= $l['llc-dialog-title'] ?></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <table class="table table-sm mb-2">
          <tr>
            <td><label for="irn-level"><?= $l['irn-level'] ?></label></td>
            <td><input id="irn-level" type="text" name="irn-level" class="form-control form-control-sm level-input" value="0" /></td>
            <td><label for="planetsSpin"><?= $l['planets-count'] ?></label></td>
            <td>
              <div class="input-group input-group-sm" style="width: 100px;">
                <input id="planetsSpin" type="text" class="form-control" value="8" />
                <button class="btn btn-outline-secondary" type="button" id="planetsSpin-up">
                  <i class="bi bi-caret-up-fill"></i>
                </button>
                <button class="btn btn-outline-secondary" type="button" id="planetsSpin-down">
                  <i class="bi bi-caret-down-fill"></i>
                </button>
              </div>
            </td>
          </tr>
        </table>
        <div class="irn-calc-info">
          <?= $l['llc-dialog-info'] ?>
        </div>
        <div id="lab-levels-div">
          <table id="lab-levels-table" class="lined">
            <thead>
              <tr>
                <th><?= $l['planet'] ?></th>
                <th><?= $l['level'] ?></th>
                <th><?= $l['start'] ?></th>
              </tr>
            </thead>
            <tbody>
              <?php for ($i = 1; $i <= 8; $i++): ?>
              <tr class="<?= ($i % 2) === 1 ? 'odd' : 'even' ?>">
                <td align="center"><?= $l['planet-num'] ?><?=$i?></td>
                <td align="center"><input type="text" id="lablevel_<?=$i?>" name="lablevel_<?=$i?>" class="form-control form-control-sm input-3columns input-in-table" value="0" /></td>
                <td align="center"><input type="radio" id="labchoice_<?=$i?>" name="start-pln" disabled/></td>
              </tr>
              <?php endfor; ?>
            </tbody>
          </table>
        </div>
        <div class="irn-calc-info mt-2">
          <span><?= $l['resulting-lab-level'] ?></span>&nbsp;<span id="resulting-level"><b>?</b></span>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="irn-done-btn"><?= $l['done'] ?></button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?= $l['cancel'] ?></button>
      </div>
    </div>
  </div>
</div>

</body>
</html>
