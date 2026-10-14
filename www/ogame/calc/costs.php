<?php

require_once '../../langs.php';
require_once 'universes.inc.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('costs');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'costs');

// The universe picker fills in the economy and research speeds
$countries = loadUniverseCountries($lang);
$universes = loadUniverses($countries);

// id => (translation key, type, metal, crystal, deuterium, cost-growth factor).
// The table itself lives in data/costs-techs.json, which the MCP server
// (mcp/) reads too, so the page and the LLM tools price the same items.
$costsTechs = json_decode(file_get_contents(__DIR__ . '/data/costs-techs.json'), true);
$techData = array();
foreach ($costsTechs['techs'] as $id => $tech) {
    $techData[(int)$id] = array_merge(array($tech['key'], $tech['type']), $tech['cost'], array($tech['growth']));
}

// Research Lab levels required to research technologies
$techReqs = array();
foreach ($costsTechs['labRequirements'] as $id => $level) {
    $techReqs[(int)$id] = $level;
}

$techTypes = array(2 => 'buildings-planet', 3 => 'buildings-moon', 4 => 'researches', 5 => 'fleet', 6 => 'defenses');
$tabTitles = array('all-items-one-level', 'all-items-mult-levels', 'one-item-mult-levels');
$colHeadersAllOne = array('building', 'level', 'metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points', 'dm-abbr');
$colHeadersAllMult = array('building', 'from-level', 'to-level', 'metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points');
$colHeadersOneCommon = array('level', 'metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points');
$colHeadersOneProd = array('level', 'metal', 'crystal', 'deuterium', 'msu', 'energy', 'time', 'points', 'hourly-prod', 'hourly-cons');

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

require_once 'costs.tpl';

