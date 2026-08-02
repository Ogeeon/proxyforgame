<?php
  // Live settings of one OGame universe, read straight off the game's own API.
  // Named apiServerData() rather than getServerData(): the latter is already
  // taken by ogame/calc/h_functions.php with a different signature.

  require_once __DIR__ . '/http.inc.php';

  function apiServerData() {
    $country = getVar('country', 'str');
    $universe = getVar('universe', 'int');

    if ($universe === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid country or universe']);
        return;
    }

    // Restrict to the safe alphabet before splicing into the request URL below,
    // or a crafted value could redirect the fetch to an attacker-controlled host.
    if (!preg_match('/^[a-zA-Z]{2,3}$/', $country)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid country or universe']);
        return;
    }

    $serverDataUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/serverData.xml";
    $serverDataXml = @file_get_contents($serverDataUrl);

    if ($serverDataXml === false) {
        http_response_code(503);
        echo json_encode([
            'error' => 'Failed to fetch server data from OGame API'
        ]);
    }

    $xml = simplexml_load_string($serverDataXml);

    if ($xml === false) {
        http_response_code(422);
        echo json_encode([
            'error' => 'Failed to parse server data XML'
        ]);
    }

    $universeData = [
      'speedFleetPeaceful' => (string)$xml->speedFleetPeaceful ?? '',
      'speedFleetWar' => (string)$xml->speedFleetWar ?? '',
      'speedFleetHolding' => (string)$xml->speedFleetHolding ?? '',
      'galaxies' => (string)$xml->galaxies ?? '',
      'systems' => (string)$xml->systems ?? '',
      'donutGalaxy' => (string)$xml->donutGalaxy ?? '',
      'donutSystem' => (string)$xml->donutSystem ?? '',
      'globalDeuteriumSaveFactor' => (string)$xml->globalDeuteriumSaveFactor ?? '',
      'warriorBonusFuelConsumption' => (string)$xml->warriorBonusFuelConsumption ?? '',
      'probeCargo' => (string)$xml->probeCargo ?? '',
      'fleetIgnoreEmptySystems' => (string)$xml->fleetIgnoreEmptySystems ?? '',
      // Independent of the one above: it skips systems where every player is
      // inactive, and a universe can have either, both or neither switched on.
      'fleetIgnoreInactiveSystems' => (string)$xml->fleetIgnoreInactiveSystems ?? ''
    ];

    echo json_encode($universeData);
  }
