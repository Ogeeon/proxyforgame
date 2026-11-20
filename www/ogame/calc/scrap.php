<?php

declare(strict_types=1);

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('scrap');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'scrap');

// The units the merchant buys, in the game's order: they must match
// SCRAP_FLEET_IDS and SCRAP_DEFENSE_IDS in scrap-core.js.
$scrapFleet = [202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 217, 218, 219];
$scrapDefenses = [401, 402, 403, 404, 405, 406, 407, 408, 502, 503];

// id => (translation key, [metal, crystal, deuterium]). The prices come from
// data/costs-techs.json, the table the cost calculator and the MCP server
// read, so all three price a unit the same.
/** @var array{techs: array<string, array{key: string, cost: list<int>}>} $costsTechs */
$costsTechs = json_decode((string) file_get_contents(__DIR__ . '/data/costs-techs.json'), true);
$scrapUnits = [];
foreach (array_merge($scrapFleet, $scrapDefenses) as $id) {
    $tech = $costsTechs['techs'][(string) $id];
    $scrapUnits[$id] = ['key' => $tech['key'], 'cost' => $tech['cost']];
}

require_once 'scrap.tpl';
