<?php
  // Fetching a spy report the player copied out of the game, with a second
  // source for when Logserver is down. See docs/ogame-api-import.md.

  require_once __DIR__ . '/http.inc.php';

  function getDataCode() {
    if (($strCode = getVar('code', 'str')) !== false) {

      //flight.php?SR_KEY=fs008d2cbfee933ddbb85e2e20d8872ce34d
      //flight.php?SR_KEY=sr-ru-1-360e215d03d5115e828c70bba761b361dd8b4c0c

      $ch = curl_init('https://logserver.net/api/proxyforgame/?code=' . $strCode);

      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
      curl_setopt($ch, CURLOPT_TIMEOUT, 30);
      $h = curl_exec($ch);
      if (curl_errno($ch)) {
        // Read the message before closing the handle, or it comes back empty
        $err = curl_error($ch);
        curl_close($ch);
        // Maybe Logserver isn't accessible. Let's try fallback method
        $data = getSpyReportByFallbackMethod($strCode);
        if ($data !== null) {
          die("0\n$data");
        }
        die("3\n$err");
      }
      curl_close($ch);
      if (isUsableSpyReport($h)) {
        die("0\n$h");
      }
      // Logserver couldn't process this SR: an unknown code, or a payload it
      // failed to decompress, in which case it answers with PHP notices glued
      // in front of a {"RESULT_CODE":1000,"RESULT_DATA":false} envelope.
      // Let's try fallback method
      $data = getSpyReportByFallbackMethod($strCode);
      if ($data !== null) {
        die("0\n$data");
      }
      // Tell a code the user should double-check apart from a broken answer
      if (strpos($h, "code not found") > 0 || strpos($h, "wrong code") > 0) {
        die("4\nbad code");
      }
      die("5\nbad answer");
    }
    die(EMPTY_PARAMS_RESPONSE);
  }

  /**
   * A usable answer decodes to {"RESULT_CODE":1000,"RESULT_DATA":{...}} with the
   * two sections the flight calculator reads. Anything else - a false
   * RESULT_DATA, an error envelope, HTML - is not worth handing to the client.
   */
  function isUsableSpyReport($body) {
    $json = json_decode($body, true);
    return is_array($json)
      && isset($json['RESULT_CODE']) && $json['RESULT_CODE'] == 1000
      && isset($json['RESULT_DATA']) && is_array($json['RESULT_DATA'])
      && isset($json['RESULT_DATA']['generic'], $json['RESULT_DATA']['universes']);
  }

  /**
   * Extracts the language code and universe number from SR_ID.
   * Format: sr-en-1-c781a3232869009dbe97d7cdd46a8c3822a75bb5
   * Anchored match keeps $language/$universe restricted to safe characters
   * before they get spliced into request URLs below.
   */
  function parseSpyReportId($srId) {
      if (!preg_match('/^sr-([a-zA-Z]{2,3})-(\d+)-[0-9a-fA-F]+$/', $srId, $m)) {
          return null;
      }
      return [$m[1], $m[2]];
  }

  /** Queries the faw-kes API for the spy report; NULL when unusable. */
  function fetchSpyReportFromFallback($srId) {
      // Restrict to the safe alphabet before splicing into the request URL below,
      // regardless of what the caller already checked - this function must not
      // trust an unvalidated $srId to reach file_get_contents().
      if (!preg_match('/^sr-[a-zA-Z]{2,3}-\d+-[0-9a-fA-F]+$/', $srId)) {
          return null;
      }

      $reportUrl = "https://ogapi.faw-kes.de/v1/report/" . $srId;
      $reportData = @file_get_contents($reportUrl);
      $reportJson = ($reportData === false) ? null : json_decode($reportData, true);

      if (!is_array($reportJson) || empty($reportJson['RESULT_DATA'])) {
          return null;
      }

      return $reportJson;
  }

  /** Queries and parses the OGame server data XML for a universe; NULL when unusable. */
  function fetchServerDataXml($language, $universe) {
      $serverDataUrl = "https://s{$universe}-{$language}.ogame.gameforge.com/api/serverData.xml";
      $serverDataXml = @file_get_contents($serverDataUrl);

      if ($serverDataXml === false) {
          return null;
      }

      $xml = simplexml_load_string($serverDataXml);

      if ($xml === false) {
          return null;
      }

      return $xml;
  }

  /** Builds the 'universes' JSON structure spliced into the spy report. */
  function buildUniverseDataFromXml($xml, $language, $universe) {
      return [
          'id' => (string)$xml->id ?? '',
          'date' => (string)$xml->timestamp ?? '',
          'universe' => $universe,
          'domain' => $language,
          'name' => (string)$xml->name ?? '',
          'speed' => (string)$xml->speed ?? '',
          'speedFleetPeaceful' => (string)$xml->speedFleetPeaceful ?? '',
          'speedFleetWar' => (string)$xml->speedFleetWar ?? '',
          'speedFleetHolding' => (string)$xml->speedFleetHolding ?? '',
          'galaxies' => (string)$xml->galaxies ?? '',
          'systems' => (string)$xml->systems ?? '',
          'acs' => (string)$xml->acs ?? '',
          'rapidFire' => (string)$xml->rapidFire ?? '',
          'defToTF' => (string)$xml->defToTF ?? '',
          'debrisFactor' => (string)$xml->debrisFactor ?? '',
          'debrisFactorDef' => (string)$xml->debrisFactorDef ?? '',
          'repairFactor' => (string)$xml->repairFactor ?? '',
          'newbieProtectionLimit' => (string)$xml->newbieProtectionLimit ?? '',
          'newbieProtectionHigh' => (string)$xml->newbieProtectionHigh ?? '',
          'topScore' => (string)$xml->topScore ?? '',
          'bonusFields' => (string)$xml->bonusFields ?? '',
          'donutGalaxy' => (string)$xml->donutGalaxy ?? '',
          'donutSystem' => (string)$xml->donutSystem ?? '',
          'globalDeuteriumSaveFactor' => (string)$xml->globalDeuteriumSaveFactor ?? '',
          'probeCargo' => (string)$xml->probeCargo ?? '',
          // The flight calculator reads both of these off an imported report;
          // without them an import used to silently switch the system skip off.
          'fleetIgnoreEmptySystems' => (string)$xml->fleetIgnoreEmptySystems ?? '',
          'fleetIgnoreInactiveSystems' => (string)$xml->fleetIgnoreInactiveSystems ?? ''
      ];
  }

  /**
   * Second source for a spy report, used when Logserver is down or returns
   * something unusable. Returns NULL when this source cannot serve the report
   * either - the caller decides which error the client gets, so that a rejected
   * code stays distinguishable from a broken answer.
   */
  function getSpyReportByFallbackMethod($srId) {
      $ids = parseSpyReportId($srId);
      if ($ids === null) {
          return null;
      }
      [$language, $universe] = $ids;

      $reportJson = fetchSpyReportFromFallback($srId);
      $xml = $reportJson !== null ? fetchServerDataXml($language, $universe) : null;

      if ($reportJson === null || $xml === null) {
          return null;
      }

      $reportJson['RESULT_DATA']['universes'] = buildUniverseDataFromXml($xml, $language, $universe);

      return json_encode($reportJson);
  }
