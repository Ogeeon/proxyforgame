<?php

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('queue');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'queue');

// id => (translation key, type, metal, crystal, deuterium, cost-growth factor).
// The buildings of the costs calculator's table (data/costs-techs.json): types
// 1 (planet or moon), 2 (planet) and 3 (moon). Research, ships and defence
// cannot be queued here.
$costsTechs = json_decode(file_get_contents(__DIR__ . '/data/costs-techs.json'), true);
$techData = array();
foreach ($costsTechs['techs'] as $id => $tech) {
    if ($tech['type'] <= 3) {
        $techData[(int)$id] = array_merge(array($tech['key'], $tech['type']), $tech['cost'], array($tech['growth']));
    }
}

$techTypes = array(2 => 'planet', 3 => 'moon');
$colHeadersSrc = array('building', 'start-level', 'next-level');
$colHeadersDst = array('building', 'level', 'metal', 'crystal', 'deuterium', 'time', '-');

function getTechsByType($type) {
    global $techData;
    $filteredTechs = array();
    for ($i = 1; $i < 600; $i++) {
        if (!isset($techData[$i])) {
            continue;
        }
        // add the element if the whole list is requested, if the current element's type matches the requested type,
        // or if the current tech is a "universal" building and buildings for a moon or planet were requested
        if ($type == 0 || $techData[$i][1] == $type || ($techData[$i][1] == 1 && ($type == 2 || $type == 3))) {
            array_push($filteredTechs, $i);
        }
    }
    return $filteredTechs;
}

require_once 'queue.tpl';

