<?php

require 'h_abox.php';
require 'h_functions.php';

require_once('../../langs.php');
$lang = get_lang();
$currUrl = '/ogame/calc/expeditions.php';

require_once('../../Intl.php');
$l = Intl::getTranslations($lang, 'expeditions');

/**
 * The page can be driven entirely from the URL (see the API table it renders).
 * Everything the template needs is collected here; a parameter that was not
 * passed stays false so the client falls back to the saved options.
 */
function expeditionsApiParam($name) {
    return isset($_GET[$name]) ? KillInjection($_GET[$name]) : false;
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
$arrServerData = ($strUni && $strDomain) ? GetServerData($strUni, $strDomain, 90) : [];

// Index of the matching entry in the "strongest player" select.
$highTopIdx = null;
if ($arrServerData) {
    $intTopScore = floor($arrServerData['topScore']);
    $thresholds = [10000, 100000, 10000000, 50000000, 250000000, 500000000, 750000000, 1000000000];
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

require_once('expeditions.tpl');

?>
