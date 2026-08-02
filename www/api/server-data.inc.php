<?php
  // Live settings of one OGame universe, read straight off the game's own API.
  // Named apiServerData() rather than getServerData(): the latter is already
  // taken by ogame/calc/h_functions.php with a different signature.

  require_once __DIR__ . '/http.inc.php';

  function apiServerData($in) {
    list($country, $universe) = requireUniverse($in);

    $xml = loadServerDataXml($country, $universe);

    return array(
      'speedFleetPeaceful' => (string)$xml->speedFleetPeaceful,
      'speedFleetWar' => (string)$xml->speedFleetWar,
      'speedFleetHolding' => (string)$xml->speedFleetHolding,
      'galaxies' => (string)$xml->galaxies,
      'systems' => (string)$xml->systems,
      'donutGalaxy' => (string)$xml->donutGalaxy,
      'donutSystem' => (string)$xml->donutSystem,
      'globalDeuteriumSaveFactor' => (string)$xml->globalDeuteriumSaveFactor,
      'warriorBonusFuelConsumption' => (string)$xml->warriorBonusFuelConsumption,
      'probeCargo' => (string)$xml->probeCargo,
      'fleetIgnoreEmptySystems' => (string)$xml->fleetIgnoreEmptySystems,
      // Independent of the one above: it skips systems where every player is
      // inactive, and a universe can have either, both or neither switched on.
      'fleetIgnoreInactiveSystems' => (string)$xml->fleetIgnoreInactiveSystems
    );
  }

  /**
   * The country/universe pair both universe-scoped services take.
   *
   * The country is restricted to a safe alphabet because it is spliced into the
   * URL of an outgoing request; a crafted value could otherwise redirect that
   * fetch to a host of the caller's choosing.
   */
  function requireUniverse($in) {
    $country = getParam($in, 'country', 'str');
    $universe = getParam($in, 'universe', 'int');

    if ($universe === null || $country === null || !preg_match('/^[a-zA-Z]{2,3}$/', $country)) {
      throw new ApiError(400, 'bad_params', 'Invalid country or universe');
    }

    return array($country, $universe);
  }

  /**
   * Fetches and parses a universe's serverData.xml, or throws. Both failures
   * are the upstream's, not the caller's, so both are 5xx - but they stay
   * distinct, because an unreachable Gameforge and an unreadable answer call
   * for different things on our side.
   */
  function loadServerDataXml($country, $universe) {
    $serverDataUrl = "https://s{$universe}-{$country}.ogame.gameforge.com/api/serverData.xml";
    $serverDataXml = @file_get_contents($serverDataUrl);

    if ($serverDataXml === false) {
      throw new ApiError(502, 'upstream_unavailable', 'Failed to fetch server data from the OGame API');
    }

    $xml = simplexml_load_string($serverDataXml);

    if ($xml === false) {
      throw new ApiError(502, 'upstream_invalid', 'Failed to parse the server data XML');
    }

    return $xml;
  }
