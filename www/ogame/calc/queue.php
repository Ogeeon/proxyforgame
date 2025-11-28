<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/queue.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'queue');

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
	44 => array('missle-silo', 2, 20000, 20000, 1000, 2)
);


$techTypes = array(2 => 'planet', 3 => 'moon');
$colHeadersSrc = array('building', 'start-level', 'next-level');
$colHeadersDst = array('building', 'level', 'metal', 'crystal', 'deuterium', 'time', '-');

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

require_once('queue.tpl');

?>
