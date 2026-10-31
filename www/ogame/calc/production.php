<?php

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('production');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'production');

// Life form building names live in the 'lfcosts' section; pull them so the
// one-planet table can label each race's building rows.
$lfTr = Intl::getTranslations($lang, 'lfcosts');

// Life form tech data, shared with the Costs (LF) calculator. From it we build:
//  - $lfBuildingKeys: race => position => building translation key, in in-game order;
//  - $lfBuildingEnergy: id => [base energy, growth coefficient] for the
//    energy-consumption formula floor(base * level * coeff^level).
// A building's id is race*1000 + position (e.g. Humans' first building is 1001).
// The first two buildings of every race (population and food) neither boost
// production nor draw energy, so this calculator leaves them out entirely.
require_once __DIR__.'/lf-techdata.inc.php';
define('LF_FIRST_PROD_BUILDING', 3);
$lfBuildingKeys = array(1 => array(), 2 => array(), 3 => array(), 4 => array());
$lfBuildingEnergy = array();
foreach ($lfTechData as $lfId => $lfRow) {
    if ($lfRow[1] !== 1) { continue; } // buildings only (type 1), skip researches
    $lfRace = intdiv($lfId, 1000);
    if ($lfRace < 1 || $lfRace > 4) { continue; }
    $lfPos = $lfId % 1000;
    if ($lfPos < LF_FIRST_PROD_BUILDING) { continue; }
    $lfBuildingKeys[$lfRace][$lfPos] = $lfRow[0];
    $lfBuildingEnergy[$lfId] = array($lfRow[5], $lfRow[10]);
}

// Per-planet production/energy bonuses of life form buildings. Each entry maps a
// building id to effects keyed by kind:
//   met/cry/deu - resource production increase, enP - energy production increase,
//   enR - energy-consumption reduction.
// Each effect is [base, increaseFactor, maxFraction|null] yielding a percentage:
//   pct(level) = min(max*100, base * increaseFactor^(level-1) * level)
// Values from OGame life form building data; every current factor is linear (1.0).
// The technology bonus (Metropolis, High-Performance Transformer, Chip Mass
// Production) is not listed: OGame folds it into the research percentages entered
// on the parameters panel, so the calculator has nothing left to apply it to.
// See docs/calculators/production-vs-ogame.md.
//
// The table lives in data/lf-building-bonuses.json, shared with the MCP server
// (mcp/). The buildings it lists: 1006 High Energy Smelting, 1008 Fusion-Powered
// Production, 2006 Magma Forge, 2007 Disruption Chamber, 2009 Crystal Refinery,
// 2010 Deuterium Synthesiser (Rock'tal), 3007 High-Performance Transformer,
// 3010 High-Performance Synthesiser.
$lfBuildingBonus = array();
foreach (json_decode(file_get_contents(__DIR__ . '/data/lf-building-bonuses.json'), true) as $lfId => $lfB) {
    $lfBuildingBonus[(int)$lfId] = $lfB;
}

// Life form researches that raise resource production, in the same shape as
// $lfBuildingBonus. Every one of them grows linearly (factor 1.0), so a level
// adds base% on top of the mines' output. The figures are the raw research
// bonus: the game multiplies them by the technology bonus, which the "LF
// amortization" table takes from its own field. Source: lf_data.xlsx in
// benedikt-holland/ogame-lifeform-amortisation, the source of the building
// bonuses above. The order here is the order of options.prm.lfResLevels.
//
// The table lives in data/lf-research-bonuses.json. The researches it lists:
// 1102 High-Performance Extractors, 1108 Enhanced Production Technologies,
// 2102 Acoustic Scanning, 2103 High Energy Pump Systems, 2105 Magma-Powered
// Production, 2107 Depth Sounding, 2110 Hardened Diamond Drill Heads, 2111
// Seismic Mining Technology, 2112 Magma-Powered Pump Systems, 3101 Catalyser
// Technology, 3106 Automated Transport Lines, 3113 Artificial Swarm
// Intelligence, 4102 Sulphide Process, 4112 Psychoharmoniser.
$lfResearchBonus = array();
foreach (json_decode(file_get_contents(__DIR__ . '/data/lf-research-bonuses.json'), true) as $lfId => $lfB) {
    $lfResearchBonus[(int)$lfId] = $lfB;
}

// Build costs of every life form object the "LF amortization" table can
// propose: the resource-producing buildings and researches. Each row is laid
// out the way calcBuildCostLF (ogame-lifeform.js) reads it - base metal,
// crystal, deuterium in [0..2], growth factors in [5..7], [3..4] unused - and
// carries the object's name, which the lfcosts section holds.
$lfAmortCosts = array();
$lfAmortNames = array();
$lfProdIds = array();
foreach ($lfBuildingBonus as $lfId => $lfB) {
    if (isset($lfB['met']) || isset($lfB['cry']) || isset($lfB['deu'])) { $lfProdIds[] = $lfId; }
}
foreach (array_merge($lfProdIds, array_keys($lfResearchBonus)) as $lfId) {
    $lfRow = $lfTechData[$lfId];
    $lfAmortCosts[$lfId] = array($lfRow[2], $lfRow[3], $lfRow[4], 0, 0, $lfRow[7], $lfRow[8], $lfRow[9]);
    $lfAmortNames[$lfId] = $lfTr[$lfRow[0]];
}

// id => (translation key, type, metal, crystal, deuterium, cost-growth factor),
// taken from the costs calculator's table (data/costs-techs.json): the three
// mines, whose next level the amortization tables price, and every ship (type 5)
// and defence (type 6), which the accumulation panel counts.
define('PRODUCTION_MINES', array(1, 2, 3));
$techData = array();
foreach (json_decode(file_get_contents(__DIR__ . '/data/costs-techs.json'), true)['techs'] as $techId => $tech) {
    $techId = (int)$techId;
    if (in_array($techId, PRODUCTION_MINES, true) || $tech['type'] === 5 || $tech['type'] === 6) {
        $techData[$techId] = array($tech['key'], $tech['type'], $tech['cost'][0], $tech['cost'][1], $tech['cost'][2], $tech['growth']);
    }
}

$oneTblProdRows = array('natural-production', 'metal-mine', 'crystal-mine', 'deut-synth', 'solar-plant', 'fusion-reactor', 'solar-sat', 'crawler', 'plasma-tech', 'booster', 'geologist', 'engineer', 'commanding-staff', 'class', 'alliance-class', 'lifeform-tech', 'prod-per-hour', 'prod-per-day', 'prod-per-week');
$allTblTotalRows = array('prod-per-hour', 'prod-per-day', 'prod-per-week');

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

require_once 'production.tpl';

