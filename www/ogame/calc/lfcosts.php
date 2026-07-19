<?php

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/lfcosts.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'lfcosts');

// Life Form tech data (shared with the Production calculator).
require_once(__DIR__.'/lf-techdata.inc.php');
$techData = $lfTechData;

$techTypes = array(1 => 'buildings', 2 => 'researches');
$tabTitles = array('all-items-one-level', 'all-items-mult-levels', 'one-item-mult-levels');
$colHeadersAllOne = array('building', 'level', 'metal', 'crystal', 'deuterium', 'msu', 'time', 'points', 'dm-abbr');
$colHeadersAllMult = array('building', 'from-level', 'to-level', 'metal', 'crystal', 'deuterium', 'msu', 'time', 'points');
$colHeadersOneCommon = array('level', 'metal', 'crystal', 'deuterium', 'msu', 'time', 'points');

function getTechsByType($type) {
	global $techData;
	$filteredTechs = array();
	for ($i = 1; $i < 5000; $i++) {
		if (!isset($techData[$i]))
			continue;
		// добавляем элемент, если нужно отдать весь список или если тип текущего элемента совпадает с запрошенным типом
		if ($type == 0 || $techData[$i][1] == $type) {
			array_push($filteredTechs, $i);
		}
	}
	return $filteredTechs;
}

require_once('lfcosts.tpl');

?>
