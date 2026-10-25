<?php

require_once 'h_abox.php';
require_once 'h_functions.php';

require_once '../../langs.php';
$lang = getLang();
require_once '../../routes.inc.php';
$currUrl = canonicalCalcPath('expeditions');

require_once '../../Intl.php';
$l = Intl::getTranslations($lang, 'expeditions');

/**
 * The page can be driven entirely from the URL (see the API table it renders).
 * Everything the template needs is collected here; a parameter that was not
 * passed stays false so the client falls back to the saved options.
 */
function expeditionsApiParam($name) {
    return isset($_GET[$name]) ? killInjection($_GET[$name]) : false;
}

function expeditionsIsJson($string) {
    return is_string($string) && is_array(json_decode($string, true));
}

/** The page URL without its query string, used for the API examples. */
function expeditionsBaseUrl() {
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http');
    $fullUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
    return strstr($fullUrl, '?', true) ?: $fullUrl;
}

$strUni = expeditionsApiParam('u');
$strDomain = expeditionsApiParam('d');
$strUniSpeed = expeditionsApiParam('us');
$strClass = expeditionsApiParam('c');
$strHyper = expeditionsApiParam('h');
$percentResources = expeditionsApiParam('pr');
$percentShip = expeditionsApiParam('ps');
$bonusCollector = expeditionsApiParam('bc');
$bonusDiscoverer = expeditionsApiParam('bd');
$resourceDiscoveryBooster = expeditionsApiParam('rd');
$darkMatterDiscoveryBonus = expeditionsApiParam('dd');
$jsonFleet = (isset($_GET['f']) && expeditionsIsJson($_GET['f'])) ? json_decode($_GET['f'], true) : false;

// When a universe is named, its speed and top score come from the server data.
$arrServerData = ($strUni && $strDomain) ? getServerData($strUni, $strDomain, 90) : [];

// The "strongest player" tiers, one per option of its select: the top score a
// tier reaches (null for the last, which has no limit) and the option's value.
// The file is shared with the MCP server; EXPEDITION_TOP_SCORE_LIMITS and
// EXPEDITION_HIGH_TOP_VALUES in profiles-core.js repeat it, and
// unit-tests/profiles-core.test.js keeps them equal.
$expTopTiers = json_decode(file_get_contents(__DIR__ . '/data/expedition-top-tiers.json'), true);

// Index of the matching entry in the "strongest player" select.
$highTopIdx = null;
if ($arrServerData) {
    $intTopScore = floor($arrServerData['topScore']);
    // The upper limits the option labels show, one per option but the last.
    $thresholds = array_column(array_slice($expTopTiers, 0, -1), 'upTo');
    $highTopIdx = count($thresholds);
    foreach (array_reverse($thresholds, true) as $idx => $limit) {
        if ($intTopScore <= $limit) {
            $highTopIdx = $idx;
        }
    }
    $universeSpeed = $arrServerData['speed'];
} else {
    $universeSpeed = $strUniSpeed;
}

require_once 'expeditions.tpl';
