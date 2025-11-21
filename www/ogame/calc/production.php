<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/production.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'production');

// id => (ключ_$l, тип, мет, крис, дейт, коэфф.удорожания}
$techData = array(
	1 => array('metal-mine', 2, 60, 15, 0, 1.5),
	2 => array('crystal-mine', 2, 48, 24, 0, 1.6),
	3 => array('deut-synth', 2, 225, 75, 0, 1.5),

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

$oneTblProdRows = array('natural-production', 'metal-mine', 'crystal-mine', 'deut-synth', 'solar-plant', 'fusion-reactor', 'solar-sat', 'crawler', 'plasma-tech', 'booster', 'geologist', 'engineer', 'commanding-staff', 'class', 'alliance-class', 'prod-per-hour', 'prod-per-day', 'prod-per-week');
$allTblTotalRows = array('prod-per-hour', 'prod-per-day', 'prod-per-week');

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

require_once('production.tpl');

?>
