<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/costs.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'costs');

// id => (ключ_$l, тип, мет, крис, дейт, коэфф.удорожания}
$techData = array(
	1 => array('metal-mine', 2, 60, 15, 0, 1.5),
	2 => array('crystal-mine', 2, 48, 24, 0, 1.6),
	3 => array('deut-synth', 2, 225, 75, 0, 1.5),
	4 => array('solar-plant', 2, 75, 30, 0, 1.5),
	12 => array('fusion-reactor', 2, 900, 360, 180, 1.8),
	14 => array('robot-factory', 1, 400, 120, 200, 2),
	15 => array('nanite-factory', 2, 1000000, 500000, 100000, 2),
	21 => array('shipyard', 1, 400, 200, 100, 2),
	22 => array('metal-storage', 1, 1000, 0, 0, 2),
	23 => array('crystal-storage', 1, 1000, 500, 0, 2),
	24 => array('deuterium-tank', 1, 1000, 1000, 0, 2),
	31 => array('research-lab', 2, 200, 400, 200, 2),
	33 => array('terraformer', 2, 0, 50000, 100000, 2),
	34 => array('alliance-depot', 2, 20000, 40000, 0, 2),
	36 => array('spacedock', 2, 200, 0, 50, 5),
	41 => array('lunar-base', 3, 20000, 40000, 20000, 2),
	42 => array('sensor-phalanx', 3, 20000, 40000, 20000, 2),
	43 => array('jump-gate', 3, 2000000, 4000000, 2000000, 2),
	44 => array('missle-silo', 2, 20000, 20000, 1000, 2),

	106 => array('esp-tech', 4, 200, 1000, 200, 2),
	108 => array('comp-tech', 4, 0, 400, 600, 2),
	109 => array('weap-tech', 4, 800, 200, 0, 2),
	110 => array('shield-tech', 4, 200, 600, 0, 2),
	111 => array('armour-tech', 4, 1000, 0, 0, 2),
	113 => array('energy-tech', 4, 0, 800, 400, 2),
	114 => array('hyper-tech', 4, 0, 4000, 2000, 2),
	115 => array('comb-drive', 4, 400, 0, 600, 2),
	117 => array('imp-drive', 4, 2000, 4000, 600, 2),
	118 => array('hyper-drive', 4, 10000, 20000, 6000, 2),
	120 => array('laser-tech', 4, 200, 100, 0, 2),
	121 => array('ion-tech', 4, 1000, 300, 100, 2),
	122 => array('plasma-tech', 4, 2000, 4000, 1000, 2),
	123 => array('irn', 4, 240000, 400000, 160000, 2),
	124 => array('astrophysics', 4, 4000, 8000, 4000, 1.75),
	199 => array('graviton', 4, 0, 0, 0, 3),

	202 => array('small-cargo', 5, 2000, 2000, 0, 1),
	203 => array('large-cargo', 5, 6000, 6000, 0, 1),
	204 => array('light-fighter', 5, 3000, 1000, 0, 1),
	205 => array('heavy-fighter', 5, 6000, 4000, 0, 1),
	206 => array('cruiser', 5, 20000, 7000, 2000, 1),
	207 => array('battleship', 5, 45000, 15000, 0, 1),
	208 => array('colony-ship', 5, 10000, 20000, 10000, 1),
	209 => array('recycler', 5, 10000, 6000, 2000, 1),
	210 => array('esp-probe', 5, 0, 1000, 0, 1),
	211 => array('bomber', 5, 50000, 25000, 15000, 1),
	212 => array('solar-sat', 5, 0, 2000, 500, 1),
	213 => array('destroyer', 5, 60000, 50000, 15000, 1),
	214 => array('death-star', 5, 5000000, 4000000, 1000000, 1),
	215 => array('battlecruiser', 5, 30000, 40000, 15000, 1),
	216 => array('reaper', 5, 85000, 55000, 20000, 1),
	217 => array('pathfinder', 5, 8000, 15000, 8000, 1),
	218 => array('crawler', 5, 2000, 2000, 1000, 1),

	401 => array('rocket-launcher', 6, 2000, 0, 0, 1),
	402 => array('light-laser', 6, 1500, 500, 0, 1),
	403 => array('heavy-laser', 6, 6000, 2000, 0, 1),
	404 => array('gauss-cannon', 6, 20000, 15000, 2000, 1),
 	405 => array('ion-cannon', 6, 5000, 3000, 0, 1),
	406 => array('plasma-turret', 6, 50000, 50000, 30000, 1),
	407 => array('small-shield', 6, 10000, 10000, 0, 1),
	408 => array('large-shield', 6, 50000, 50000, 0, 1),
	502 => array('abm', 6, 8000, 0, 2000, 1),
	503 => array('ipm', 6, 12500, 2500, 10000, 1)
);

// Уровни Иссл.лаборатории, требуемые для изучения технологий
$techReqs = array(
	106 => 3,
	108 => 1,
	109 => 4,
	110 => 6,
	111 => 2,
	113 => 1,
	114 => 7,
	115 => 1,
	117 => 2,
	118 => 7,
	120 => 1,
	121 => 4,
	122 => 4,
	123 => 10,
	124 => 3,
	199 => 12
);

$techTypes = array(2 => 'buildings-planet', 3 => 'buildings-moon', 4 => 'researches', 5 => 'fleet', 6 => 'defenses');
$tabTitles = array('all-items-one-level', 'all-items-mult-levels', 'one-item-mult-levels');
$colHeadersAllOne = array('building', 'level', 'metal', 'crystal', 'deuterium', 'energy', 'time', 'points', 'dm-abbr');
$colHeadersAllMult = array('building', 'from-level', 'to-level', 'metal', 'crystal', 'deuterium', 'energy', 'time', 'points');
$colHeadersOneCommon = array('level', 'metal', 'crystal', 'deuterium', 'energy', 'time', 'points');
$colHeadersOneProd = array('level', 'metal', 'crystal', 'deuterium', 'energy', 'time', 'points', 'hourly-prod', 'hourly-cons');

function getTechsByType($type) {
	global $techData;
	$filteredTechs = array();
	for ($i = 1; $i < 600; $i++) {
		if (!isset($techData[$i]))
			continue;
		// добавляем элемент, если нужно отдать весь список или если тип текущего элемента совпадает с запрошенным типом
		if ($type == 0 || $techData[$i][1] == $type) {
			array_push($filteredTechs, $i);
			// также добавляем, если текущая теха - "универсальное" здание, а запрошены здания для луны или планеты
		} else if ($techData[$i][1] == 1 && ($type == 2 || $type == 3)) {
			array_push($filteredTechs, $i);
		}
	}
	return $filteredTechs;
}

require_once('costs.tpl');

?>
