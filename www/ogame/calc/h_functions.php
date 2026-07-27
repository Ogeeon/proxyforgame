<?php

// Maps a serverData.xml child tag name to the PHP type its value should be cast to
// when copied into the array returned by getServerData().
const SERVER_DATA_FIELD_CASTS = [
    'name' => 'string',
    'speed' => 'string',
    'speedFleet' => 'string',
    'galaxies' => 'string',
    'systems' => 'string',
    'acs' => 'string',
    'rapidFire' => 'string',
    'defToTF' => 'string',
    'debrisFactor' => 'string',
    'debrisFactorDef' => 'string',
    'repairFactor' => 'string',
    'newbieProtectionLimit' => 'string',
    'newbieProtectionHigh' => 'string',
    'topScore' => 'string',
    'bonusFields' => 'string',
    'donutGalaxy' => 'string',
    'donutSystem' => 'string',
    'wfEnabled' => 'string',
    'wfMinimumRessLost' => 'string',
    'wfMinimumLossPercentage' => 'string',
    'wfBasicPercentageRepairable' => 'string',
    'globalDeuteriumSaveFactor' => 'string',
    'bashlimit' => 'string',
    'probeCargo' => 'string',
    'researchDurationDivisor' => 'int',
    'marketplaceBasicTradeRatioMetal' => 'float',
    'marketplaceBasicTradeRatioCrystal' => 'float',
    'marketplaceBasicTradeRatioDeuterium' => 'float',
    'marketplaceTaxNotSold' => 'float',
    'speedFleetPeaceful' => 'int',
    'speedFleetWar' => 'int',
    'speedFleetHolding' => 'int',
    'deuteriumInDebris' => 'int',
    'fleetIgnoreEmptySystems' => 'int',
];

/** Casts a serverData.xml node value to the type declared for it in SERVER_DATA_FIELD_CASTS. */
function castServerDataValue($value, $type) {
    switch ($type) {
        case 'int':
            return (int) $value;
        case 'float':
            return (float) $value;
        default:
            return (string) $value;
    }
}

/** Refreshes the local xmlFile cache from the OGame API when it is missing, stale, or empty. */
function refreshServerDataCache($xmlFile, $strUni, $strDomain, $strTime) {
    if (file_exists($xmlFile) && (time() - filemtime($xmlFile)) < $strTime (24 * 60 * 60) && file_get_contents($xmlFile)) {
        return true;
    }

    $url = 'https://s' . $strUni . '-' . $strDomain . '.ogame.gameforge.com/api/serverData.xml';
    if (!urExists($url)) {
        return false;
    }

    $flashRAW = file_get_contents($url);
    $flashXML = simplexml_load_string($flashRAW);

    $xmlHandle = fopen($xmlFile, "r");
    $xmlString = $flashXML->asXML();
    fwrite($xmlHandle, $xmlString);
    fclose($xmlHandle);
    return true;
}

function getServerData($strUni, $strDomain, $strTime) {
    if (!isset($strTime)) { $strTime = 1; }
    $xmlFile = 'https://logserver.net/xml/' . $strDomain . '/serverData/' . $strUni . '.xml';

    if (!refreshServerDataCache($xmlFile, $strUni, $strDomain, $strTime)) {
        return false;
    }

    $xml = simplexml_load_file($xmlFile);
    if ($xml == false) {
        return false;
    }

    $varReturn = false;
    foreach ($xml->children() as $key => $serverData) {
        if (array_key_exists($key, SERVER_DATA_FIELD_CASTS)) {
            $varReturn[$key] = castServerDataValue($serverData, SERVER_DATA_FIELD_CASTS[$key]);
        }
    }

    return $varReturn;
}
