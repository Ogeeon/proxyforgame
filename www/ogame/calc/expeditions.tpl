<?php
    $strUni =       (isset($_GET["u"])) ? KillInjection ($_GET["u"]) : false;
    $strDomain =    (isset($_GET["d"])) ? KillInjection ($_GET["d"]) : false;

    $strUniSpeed = (isset($_GET["us"])) ? KillInjection ($_GET["us"]) : false;
    $strClass =    (isset($_GET["c"]))  ? KillInjection ($_GET["c"])  : false;
    $strHyper =    (isset($_GET["h"]))  ? KillInjection ($_GET["h"])  : false;

    $percentResources = (isset($_GET["pr"])) ? KillInjection ($_GET["pr"]) : false;
    $percentShip =      (isset($_GET["ps"])) ? KillInjection ($_GET["ps"]) : false;

    $bonusCollector =   (isset($_GET["bc"])) ? KillInjection ($_GET["bc"]) : false;
    $bonusDiscoverer =  (isset($_GET["bd"])) ? KillInjection ($_GET["bd"]) : false;
  $resourceDiscoveryBooster = (isset($_GET["rd"])) ? KillInjection ($_GET["rd"]) : false;
  $darkMatterDiscoveryBonus = (isset($_GET["dd"])) ? KillInjection ($_GET["dd"]) : false;

    function isJSON($string) {
        return is_string($string) && is_array(json_decode($string, true)) ? true : false;
    }

    $jsonFleet =    (isset($_GET["f"]) && isJSON($_GET["f"])) ? json_decode(($_GET["f"]), true) : false;

    $arrServerData = [];
    if ($strUni && $strDomain) {
        $arrServerData = GetServerData($strUni, $strDomain, 90);
    }

    function getCurrentBaseUrl() {
      $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
      $host = $_SERVER['HTTP_HOST'];
      $requestUri = $_SERVER['REQUEST_URI'];
      
      $fullUrl = $protocol . "://" . $host . $requestUri;
      return strstr($fullUrl, '?', true) ?: $fullUrl;
  }
?>    
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html><head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
	<title><?= $l['LOCA_TITLE'] ?></title>
	<meta name="description" content="<?= $l['LOCA_TITLE'] ?>"/>
	<meta name="keywords" content="<?= $l['keywords'] ?>"/>
	<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon"/>
	<link rel="icon" href="/favicon.ico" type="image/x-icon"/>
	<meta name="robots" content="index, follow">
	<meta name="rating" content="general">
<?php 
	if ($_SERVER['HTTP_HOST'] == 'proxyforgame.com') {
		$pfgPath = $_SERVER['DOCUMENT_ROOT'];
	} else {
		$pfgPath = "D:\Programming\JS\pfg.wmp\www";
	};
?>
	<link id="light-theme" type="text/css" href="/css/redmond/jquery.ui.all.css" rel="stylesheet"/>
	<link id="dark-theme" type="text/css" href="/css/dark-hive/jquery.ui.all.css" rel="stylesheet" disabled="disabled"/>
	<link type="text/css" href="/css/langs.css?v=<?php echo filemtime($pfgPath.'/css/langs.css'); ?>" rel="stylesheet" />
	<link type="text/css" href="/css/common.css?v=<?php echo filemtime($pfgPath.'/css/common.css'); ?>" rel="stylesheet"/>
	<link type="text/css" href="/ogame/calc/css/expeditions.css?v=<?php echo filemtime($pfgPath.'/ogame/calc/css/expeditions.css'); ?>" rel="stylesheet"/>
	
<?php if ( $_SERVER['SERVER_NAME'] == 'proxyforgame.com'): ?>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1.5.1/jquery.min.js"></script>
	<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jqueryui/1.8.11/jquery-ui.min.js"></script>
<?php elseif ( $_SERVER['SERVER_NAME'] == 'pfg.wmp'): ?>
	<script type="text/javascript" src="/js/jquery.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui.min.js"></script>
<?php else: ?>
	<script type="text/javascript" src="/js/jquery-1.5.1.min.js"></script>
	<script type="text/javascript" src="/js/jquery-ui-1.8.11.min.js"></script>
<?php endif; ?>
	<script type="text/javascript" src="/js/jquery.cookie.js"></script>
	<script type="text/javascript" src="/js/utils.js?v=<?php echo filemtime($pfgPath.'/js/utils.js'); ?>"></script>
  <script type="text/javascript" src="/ogame/calc/js/expeditions.js?v=<?php echo filemtime($pfgPath.'/ogame/calc/js/expeditions.js'); ?>"></script>
<script>
  <?php
    if ($arrServerData) {
        $a = 8;
        $intTopScore = floor($arrServerData["topScore"]);
        if ($intTopScore <= 10000) $a = 0;
        if ($intTopScore <= 100000) $a = 1;
        if ($intTopScore <= 10000000) $a = 2;
        if ($intTopScore <= 50000000) $a = 3;
        if ($intTopScore <= 250000000) $a = 4;
        if ($intTopScore <= 500000000) $a = 5;
        if ($intTopScore <= 750000000) $a = 6;
        if ($intTopScore <= 1000000000) $a = 7;

        echo "api_hightop_idx = " . $a . ";";
        echo "api_universe_speed = " . ($arrServerData["speed"]) . ";";
    } else {
      echo "api_hightop_idx = null;";
      echo "api_universe_speed = " . ($strUniSpeed ? $strUniSpeed : "null") . ";";
    }
    ?>
  api_player_class = <?= ($strClass) ? $strClass : "null" ?>;
  api_hypertech_level = <?= ($strHyper) ? $strHyper : "null" ?>;
  api_percent_res = <?= ($percentResources) ? $percentResources : "null" ?>;
  api_percent_ships = <?= ($percentShip) ? $percentShip : "null" ?>;
  api_class_bonus_collector = <?= ($bonusCollector) ? $bonusCollector : "null" ?>;
  api_class_bonus_discoverer = <?= ($bonusDiscoverer) ? $bonusDiscoverer : "null" ?>;
  api_resource_discovery_booster = <?= ($resourceDiscoveryBooster) ? $resourceDiscoveryBooster : "null" ?>;
  api_dark_matter_discovery_bonus = <?= ($darkMatterDiscoveryBonus) ? $darkMatterDiscoveryBonus : "null" ?>;
  api_fleet = <?= ($jsonFleet) ? json_encode($jsonFleet) : "null" ?>;

  LOCA_YES = "<?= $l['LOCA_YES'] ?>";
  LOCA_NO = "<?= $l['LOCA_NO'] ?>";
  options.decimalSeparator='<?= $l['decimal-separator'] ?>';
  options.readTitle = "<?= $l['read'] ?>";
  options.cancelTitle = "<?= $l['cancel'] ?>";
  options.smallCargoName = "<?= $l['small-cargo'] ?>";
  options.missingSCName = "<?= $l['no-sc-message'] ?>";
  options.largeCargoAbbrev = "<?= $l['large-cargo-abbrev'] ?>";
</script>	
</head>

<body class="ui-widget">

<table id="vtable" cellspacing="2" cellpadding="0" border="0">
  <tr>
    <td id="vtablesb"><?php require_once('../../sidebar.tpl'); ?></td>
    <td id="vtablec">
      <?php require_once('../../topbar.tpl'); ?>
      
      <div id="lf-bonuses-reader" title="<?= $l['lf-bonuses-reader-hdr'] ?>">
        <div class="ui-widget-content ui-corner-all width: auto; ">
          <div>
            <?= $l['lf-bonuses-reader-info'] ?>
          </div>
          <div>
            <textarea id="lf-bonuses-txtarea" rows="8" cols="45"></textarea>
          </div>
        </div>
      </div>

      <div id="expeditions">
        <div class="ui-widget-content ui-corner-all no-mp">
          <div id="reset" class="ui-state-error ui-corner-all" title="<?= $l['reset'] ?>"><span class="ui-icon ui-icon-arrowrefresh-1-w"></span></div>
          <div class="ui-widget-header ui-corner-all c-ui-main-header"><?= $l['LOCA_TITLE'] ?></div>
          <div>
            <div id="settings-panel" class="ui-widget-content c-ui-widget-content ui-corner-all ui-panel">
              <table cellpadding="2" width="100%">
                <tr>
                  <td class="centered">
                    <?= $l['LOCA_STRONGEST_CAP'] ?> 
                    <select id="highTop" name="highTop" class="ui-state-default ui-corner-all ui-input ui-input-margin">
                      <option value="40000">&lt; 10.000</option>
                      <option value="500000">&lt; 100.000</option>
                      <option value="1200000">&lt; 1.000.000</option>
                      <option value="1800000">&lt; 5.000.000</option>
                      <option value="2400000">&lt; 25&nbsp;000&nbsp;000</option>
                      <option value="3000000">&lt; 50&nbsp;000&nbsp;000</option>
                      <option value="3600000">&lt; 75&nbsp;000&nbsp;000</option>
                      <option value="4200000">&lt; 100&nbsp;000&nbsp;000</option>
                      <option value="5000000" selected="selected">&gt; 100&nbsp;000&nbsp;000</option>
                    </select>
                    <?= $l['LOCA_STRONGEST_CAP2'] ?><br>                    
                  </td>
                </tr>
                <tr>
                  <td class="centered">
                    <?= $l['LOCA_RES_FIND'] ?>
                    <span id="max_points"></span>
                  </td>
                </tr>
              </table>
              <table cellpadding="2" width="100%">
                <tr>
                  <td class="right-aligned">
                    <?= $l['LOCA_CLASS'] ?>
                    <select id="player-class" name="player-class" class="ui-state-default ui-corner-all ui-input ui-input-margin">
                      <option value="0" selected="selected"><?= $l['LOCA_DISCOVERER'] ?></option>
                      <option value="1"><?= $l['LOCA_COLLECTOR'] ?></option>
                      <option value="2"><?= $l['LOCA_OTHER'] ?></option>
                    </select>
                  </td>
                  <td class="left-aligned">
                    <?= $l['LOCA_SPEED_FACTOR'] ?>
                    <select id="universe-speed" name="universe-speed" class="ui-state-default ui-corner-all ui-input ui-input-margin">
                          <?php
                              for ($i=1; $i <= 10; $i++) {
                                  echo '<option value="' . $i . '">' . $i . '</option>';
                              }
                          ?>
                    </select>
                  </td>
                </tr>
              </table>
              <table cellpadding="2" width="100%">
                <tr>
                  <td class="centered">
                    <label for="tech_hyper-level"><?= $l['LOCA_TECH_HYPER'] ?></label>
                    <input id="tech_hyper-level" type="text" name="tech_hyper-level" class="ui-state-default ui-corner-all ui-input level-input ui-input-margin" value="0" />
                  </td>
                </tr>
              </table>
              <table cellpadding="2" width="100%">
                <tr>
                  <td class="right-aligned" colspan="2">
                      <?= $l['LOCA_PERCENT_RESOURCES'] ?>:
                      <input type="text" id="percent-resources" value="0" class="ui-state-default ui-corner-all ui-input percent-input ui-input-margin">%
                  </td>        
                  <td class="left-aligned" colspan="5">
                      <?= $l['LOCA_PERCENT_SHIP'] ?>:
                      <input type="text" id="percent-ships" value="0" class="ui-state-default ui-corner-all ui-input percent-input ui-input-margin">%
                  </td>  
                </tr>
                <tr>
                  <td class="right-aligned" colspan="2">
                      <?= $l['class-bonus-collector'] ?>:
                      <input type="text" id="class-bonus-collector" value="0" class="ui-state-default ui-corner-all ui-input percent-input ui-input-margin">%
                  </td>        
                  <td class="left-aligned" colspan="5">
                      <?= $l['class-bonus-discoverer'] ?>:
                      <input type="text" id="class-bonus-discoverer" value="0" class="ui-state-default ui-corner-all ui-input percent-input ui-input-margin">%
                  </td>  
                </tr>
                <tr>
                  <td class="right-aligned" colspan="2">
                      <?= $l['dark-matter-discovery-bonus']?>:
                      <input type="text" id="dark-matter-discovery-bonus" value="0" class="ui-state-default ui-corner-all ui-input percent-input ui-input-margin">%
                  </td>
                  <td class="left-aligned" colspan="5">
                      <?= $l['resources-discovery-booster']?>:
                      <select id="resource-discovery-booster" class="ui-state-default ui-corner-all ui-input ui-input-margin">
                        <?php for ($r = 0; $r <= 40; $r += 5) { echo '<option value="' . $r . '"' . ($r == 0? ' selected="selected"':'') . '>' . $r . '%</option>'; } ?>
                      </select>
                  </td>
                </tr>
              </table>
					<div id="lf-bonuses-accordion">
						<h3><a href="#"><?= $l['lf-bonuses-ships'] ?></a></h3>
						<div id="accordion-lf-prm">
						<table width="80%" cellpadding="0" cellspacing="1" border="0" align="center">
							<tr><td><button id="open-lfbr" style="float: right;"><?= $l['open-lfbr'] ?></button></td></tr> 
						</table>
						<table id="lf-ships-bonuses" class="lined" width="80%" cellpadding="0" cellspacing="1" border="0" align="center">
							<tr>
								<th><?= $l['ship-name'] ?></th>
								<th><?= $l['cargo-increase'] ?></th>
							</tr>
							<tr class="odd">
								<td><?= $l['small-cargo'] ?></td>
								<td class="centered"><input id="small-cargo" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 202-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['large-cargo'] ?></td>
								<td class="centered"><input id="large-cargo" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 203-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['light-fighter'] ?></td>
								<td class="centered"><input id="light-fighter" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 204-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['heavy-fighter'] ?></td>
								<td class="centered"><input id="heavy-fighter" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 205-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['cruiser'] ?></td>
								<td class="centered"><input id="cruiser" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 206-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['battleship'] ?></td>
								<td class="centered"><input id="battleship" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 207-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['colony-ship'] ?></td>
								<td class="centered"><input id="colony-ship" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 208-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['recycler'] ?></td>
								<td class="centered"><input id="recycler" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 209-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['esp-probe'] ?></td>
								<td class="centered"><input id="esp-probe" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 210-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['bomber'] ?></td>
								<td class="centered"><input id="bomber" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 211-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['destroyer'] ?></td>
								<td class="centered"><input id="destroyer" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 213-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['death-star'] ?></td>
								<td class="centered"><input id="death-star" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 214-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['battlecruiser'] ?></td>
								<td class="centered"><input id="battlecruiser" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 215-cargo"/></td>
							</tr>
							<tr class="even">
								<td><?= $l['reaper'] ?></td>
								<td class="centered"><input id="reaper" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 218-cargo"/></td>
							</tr>
							<tr class="odd">
								<td><?= $l['pathfinder'] ?></td>
								<td class="centered"><input id="pathfinder" type="text" class="ui-state-default ui-corner-all ui-input no-mp input-5columns centered 219-cargo"/></td>
							</tr>
						</table>
						</div>	
					</div>
            </div> <!-- settings-panel -->
            <div id="data-panel" class="ui-panel ui-widget-content ui-corner-bottom">
              <table id="data-table" class="lined" cellpadding="1" cellspacing="1" width="100%">
                <tbody>   
                  <tr>
                    <th class="centered"><?= $l['LOCA_SHIP_TYPE'] ?></td>
                    <th class="centered"><button id="clearFleet" name="x" type="button" onclick="clearFleet ();">x</button>&nbsp;<?= $l['LOCA_NUMBER'] ?></td>
                    <th class="centered"><?= $l['LOCA_SHIP_CAN_BE_FOND'] ?></td>
                    <th class="centered"><?= $l['LOCA_DISCOVERED'] ?></td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column"><?= $l['small-cargo'] ?></td>
                    <td class="centered"><input id="numSC" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canSC">-</span></td>
                    <td class="centered"><span id="findSC">0</span></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['large-cargo'] ?></td>
                    <td class="centered"><input id="numLC" type="text"value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canLC">-</span></td>
                    <td class="centered"><span id="findLC">0</span></td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column"><?= $l['light-fighter'] ?></td>
                    <td class="centered"><input id="numLF" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canLF">-</span></td>
                    <td class="centered"><span id="findLF">0</span></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['heavy-fighter'] ?></td>
                    <td class="centered"><input id="numHF" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canHF">-</span></td>
                    <td class="centered"><span id="findHF">0</span></td>
                  </tr>              
                  <tr class="odd">
                    <td class="first-column"><?= $l['pathfinder'] ?></td>
                    <td class="centered"><input id="numPA" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canPA">-</span></td>
                    <td class="centered"><span id="findPA">0</span></td>
                  </tr>                
                  <tr class="even">
                    <td class="first-column"><?= $l['cruiser'] ?></td>
                    <td class="centered"><input id="numCR" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canCR">-</span></td>
                    <td class="centered"><span id="findCR">0</span></td>
                  </tr>                
                  <tr class="odd">
                    <td class="first-column"><?= $l['battleship'] ?></td>
                    <td class="centered"><input id="numBS" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canBS">-</span></td>
                    <td class="centered"><span id="findBS">0</span></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['battlecruiser'] ?></td>
                    <td class="centered"><input id="numBC" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canBC">-</span></td>
                    <td class="centered"><span id="findBC">0</span></td>
                  </tr>                
                  <tr class="odd">
                    <td class="first-column"><?= $l['colony-ship'] ?></td>
                    <td class="centered"><input id="numCS" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canCS">-</span></td>
                    <td class="centered">0</td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['recycler'] ?></td>
                    <td class="centered"><input id="numRC" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canRC">-</span></td>
                    <td class="centered">0</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column"><?= $l['esp-probe'] ?></td>
                    <td class="centered"><input id="numEP" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canEP">-</span></td>
                    <td class="centered"><span id="findEP">0</span></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['bomber'] ?></td>
                    <td class="centered"><input id="numBM" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canBM">-</span></td>
                    <td class="centered"><span id="findBM">0</span></td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column"><?= $l['destroyer'] ?></td>
                    <td class="centered"><input id="numDR" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canDR">-</span></td>
                    <td class="centered"><span id="findDR">0</span></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column"><?= $l['death-star'] ?></td>
                    <td class="centered"><input id="numDS" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered"><span id="canDS">-</span></td>
                    <td class="centered">0</td>
                  </tr>                
                  <tr class="odd">
                    <td class="first-column border-s"><?= $l['reaper'] ?></td>
                    <td class="centered border-s"><input id="numRE" type="text" value="0" class="ui-state-default ui-corner-all ui-input count-input ui-input-margin"></td>
                    <td class="centered border-s"><span id="canRE">-</span></td>
                    <td class="centered border-s"><span id="findRE">0</span></td>
                  </tr>                
                  <tr class="even">
                    <td colspan="2"><?= $l['LOCA_STORAGE'] ?></td>
                    <td colspan="2" align="right"><span id="storageCapacity">0</span></td>
                  </tr>
                  <tr class="odd">
                    <td  colspan="2"><?= $l['LOCA_RES_FIND'] ?></td>
                    <td  style="text-align : right;">
                      <?= $l['LOCA_M'] ?><br>
                      <?= $l['LOCA_K'] ?><br>
                      <?= $l['LOCA_D'] ?> 
                    </td>
                    <td style="text-align : right;">
                      <span id="maxFindMet">0</span><br>
                      <span id="maxFindCry">0</span><br>
                      <span id="maxFindDeu">0</span>
                    </td>
                  </tr>
                  <tr class="even">
                    <td  colspan="2"><?= $l['LOCA_DM'] ?></td>
                    <td  colspan="2" style="text-align : right;"><span id="darkMatterFind">0</span></td>
                  </tr>        
                </tbody>
              </table>
            </div> <!-- results -->
          </div>
          <div id="api-accordion" >
            <h3><a href="#">API</a></h3>
              <div id="api-accordion-inner">
                <table id="api-table" class="lined" cellpadding="1" cellspacing="1" width="100%">
                  <tr>
                    <th><?= $l['api_param'] ?></th>
                    <th><?= $l['api_prm_meaning'] ?></th>
                    <th><?= $l['api_prm_type'] ?></th>
                    <th><?= $l['api_prm_explain'] ?></th>
                  </tr>
                  <tr class="even">
                    <td class="first-column" class="centered">u</td>
                    <td ><?= $l['api_u'] ?></td>
                    <td >int</td>
                    <td >(ex.: 1, 191, ...)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">d</td>
                    <td ><?= $l['api_d'] ?></td>
                    <td >str</td>
                    <td >(ex.: en, ru, ...)</td>
                  </tr>
                  <tr class="even">
                    <td class="first-column" class="centered">us</td>
                    <td ><?= $l['api_us'] ?></td>
                    <td >int</td>
                    <td >(ex.: 1-10)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">c</td>
                    <td ><?= $l['api_c'] ?></td>
                    <td >int</td>
                    <td ><?= $l['classes'] ?></td>
                  </tr>
                  <tr class="even">
                    <td class="first-column" class="centered">h</td>
                    <td ><?= $l['api_h'] ?></td>
                    <td >int</td>
                    <td >(ex.: 0, 1,...)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">f</td>
                    <td ><?= $l['api_f'] ?></td>
                    <td >json</td>
                    <td >(ex.: {"202":10,"203":15})</td>
                  </tr>
                  <tr class="even">
                    <td class="first-column" class="centered">pr</td>
                    <td ><?= $l['api_pr'] ?></td>
                    <td >float</td>
                    <td >(ex.: 0-100)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">ps</td>
                    <td ><?= $l['api_ps'] ?></td>
                    <td >float</td>
                    <td >(ex.: 0-100)</td>
                  </tr>
                  <tr class="even">
                    <td class="first-column" class="centered">bc</td>
                    <td ><?= $l['api_bc'] ?></td>
                    <td >float</td>
                    <td >(ex.: 0-100)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">bd</td>
                    <td ><?= $l['api_bd'] ?></td>
                    <td >float</td>
                    <td >(ex.: 0-100)</td>
                  </tr>   
                  <tr class="even">
                    <td class="first-column" class="centered">rd</td>
                    <td ><?= $l['resources-discovery-booster']?></td>
                    <td >int</td>
                    <td >(ex.: 0-40)</td>
                  </tr>
                  <tr class="odd">
                    <td class="first-column" class="centered">dd</td>
                    <td ><?= $l['dark-matter-discovery-bonus']?></td>
                    <td >float</td>
                    <td >(ex.: 0-100)</td>
                  </tr>
                  <tr>
                    <td colspan="4"><hr></td>
                  </tr>                    
                  <tr>
                    <td colspan="4" class="centered"><?= $l['examples'] ?></td>
                  </tr>  
                  <tr class="even">
                    <td  colspan="3"><a href="<?=getCurrentBaseUrl()?>?u=1&d=ru"><?=getCurrentBaseUrl()?>?u=1&d=ru</a></td>
                    <td ><?= $l['auto_select'] ?></td>
                  </tr>
                  <tr class="odd">
                    <td  colspan="3"><a href='<?=getCurrentBaseUrl()?>?u=1&d=ru&h=8&c=0&f={"203":2140,"219":1,"210":1,"218":1}&pr=10.9&ps=9.89&bc=10.5&bd=60.7&rd=20&dd=50'><?=getCurrentBaseUrl()?>?u=1&d=ru<br>&h=8&c=0<br>&f={"203":2140,"219":1,"210":1,"218":1}<br>&pr=10.9&ps=9.89&bc=10.5&bd=60.7&rd=20&dd=50</a></td>
                    <td ><?= $l['all_options'] ?></td>
                  </tr>     
                </table>
              </div>
          </div>  <!-- api-accordion -->
        </div> <!-- ui-widget-content -->

</td>
</tr>
</table>
<?php
	require_once('../../analitics.tpl');
?>

</body>
</html>
