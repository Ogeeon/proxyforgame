<?php
  // все аякс-сервисы обрабатываются здесь
  // в запросе обязательно должен присутствовать параметр service

  // аналог js unescape
  function convertUnicode($t)
  {
    return preg_replace( '#%u([0-9A-F]{4})#se','iconv("UTF-16BE","UTF-8",pack("H4","$1"))', $t );
  }

  // функция выбирает из запроса значение указанного параметра
function getVar($var, $type)
{
    $value = filter_input(INPUT_GET, $var);
    if ($value === null) {
        $value = filter_input(INPUT_POST, $var);
    }

    if ($value === null) {
        return false;
    }

    switch ($type) {
        case 'str':
            return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');

        case 'int':
            $int = filter_var($value, FILTER_VALIDATE_INT);
            return ($int !== false) ? $int : false;

        case 'float':
            $float = filter_var($value, FILTER_VALIDATE_FLOAT);
            return ($float !== false) ? $float : false;

        default:
            return false;
    }
}


  function sendReport() {
    if (($wrong = getVar('wrong', 'str')) !== false && ($right = getVar('right', 'str')) !== false) {
      if ($wrong == '' && $right == '') {
        die("4\nempty");
      }
      if ($wrong === $right) {
        die("5\nequal");
      }
      if ($wrong == '') {
        die("6\nempty");
      }
      if ($right == '') {
        die("7\nempty");
      }
      $to  = 'proxyforgame@gmail.com';
      $subject = 'New feedback from ProxyForGame site';
      $message = "Script: \"". getVar('url', 'str')."\"\n";
      $message .= "Wrong text: \"".getVar('wrong', 'str')."\"\n";
      $message .= "Right text: \"".getVar('right', 'str')."\"\n";
      if (socketmail($to, $subject, $message)) {
        die("0\ngood");
      } else {
        die("99\nfailed");
      }
    }
    die("3\nempty");
  }

  function sendEmail() {
    if (($emailSubject = getVar('subject', 'str')) !== false && ($emailBody = getVar('body', 'str')) !== false) {
      if ($emailSubject == '' && $emailBody == '') {
        die("4\nempty");
      }
      $to  = 'proxyforgame@gmail.com';
      $subject = 'New email from ProxyForGame site';
      $message = "Sender: \"".(getVar('address', 'str')==''?'(unspecified)':getVar('address', 'str'))."\"\n";
      $message .= "Subject: \"".$emailSubject."\"\n";
      $message .= "Body: \"".$emailBody."\"\n";
      if (socketmail($to, $subject, $message)) {
        die("0\ngood");
      } else {
        die("99\nfailed");
      }
    }
    die("3\nempty");
  }

  function socketmail($to, $subject, $message) {
    $smtpUser = getenv('SMTP_USER');
    $smtpPass = getenv('SMTP_PASS');
    if (!$smtpUser || !$smtpPass) {
      error_log("SMTP_USER/SMTP_PASS not configured in .env");
      return false;
    }
    $server = "ssl://smtp.gmail.com";
    $socket = fsockopen($server, 465, $errno, $errstr, 30);
    if (!$socket) {
      die("99\Server $server. Connection failed: $errno, $errstr");
    }
    fputs($socket, "HELO proxyforgame.com\r\n"); fgets($socket, 256);
    fputs($socket, 'AUTH LOGIN'."\r\n"); fgets($socket, 256);
    fputs($socket, base64_encode($smtpUser)."\r\n"); fgets($socket, 256);
    fputs($socket, base64_encode($smtpPass)."\r\n"); fgets($socket, 256);
    fputs($socket, "MAIL FROM: <$smtpUser>\r\n"); fgets($socket, 256);
    fputs($socket, "RCPT TO: <$to>\r\n"); fgets($socket, 256);
    fputs($socket, "DATA\r\n"); fgets($socket, 256);

    fputs($socket, "Content-Type: text/plain; charset=UTF-8\r\n");
    fputs($socket, "To: <$to>\r\n");
    fputs($socket, "Subject: $subject\r\n");
    fputs($socket, "\r\n");
    fputs($socket, $message." \r\n");
    fputs($socket, ".\r\n");
    fputs($socket, "QUIT\r\n");
    fclose($socket);
    return true;
  }

  function getChangelog() {
    if (($lastSeen = getVar('lastSeen', 'int')) !== false && ($lang = getVar('lang', 'str')) !== false) {
      $langs = array('ru', 'de', 'es', 'pl', 'fr', 'it', 'nl', 'sk', 'tr', 'pt', 'en', 'us');
      if (!in_array($lang, $langs)) {
        die("1\nmalformed");
      }
      if ($lang == 'us') {
        $lang = 'en';
      }
      $result = sqlQuery("select ch.ts, cd.description from change_headers ch join change_descriptions cd on (ch.id = cd.id)
        where lang like ? and ch.id > ? order by ch.id desc", array($lang, $lastSeen));
      $repsonse = json_encode($result);
      die('0\n'.$repsonse);
    }
    die("1\nmalformed");
  }

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
    die("3\nempty");
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
      $reportUrl = "https://ogapi.faw-kes.de/v1/report/" . $srId;
      $reportData = @file_get_contents($reportUrl);

      if ($reportData === false) {
          return null;
      }

      $reportJson = json_decode($reportData, true);

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

  function getServerData() {
    $country = getVar('country', 'str');
    $universe = getVar('universe', 'int');

    // Restrict to the safe alphabet before splicing into the request URL below,
    // or a crafted value could redirect the fetch to an attacker-controlled host.
    if ($universe === false || !preg_match('/^[a-zA-Z]{2,3}$/', $country)) {
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

  function getPopulatedSystems() {
      $country = getVar('country', 'str');
      $universe = getVar('universe', 'int');
      $result = sqlQuery("
          SELECT timestamp, population, population_all, UNIX_TIMESTAMP(updated_at) AS updated_at
          FROM population_data
          WHERE universe = ? AND country = ?
      ", array($universe, $country));

      // population_all is null for rows written before the two settings were told
      // apart; the client falls back to skipping nothing rather than guessing.
      header('Content-Type: application/json');
      echo json_encode([
        'timestamp' => (int)$result[0]['timestamp'],
        'updatedAt' => (int)$result[0]['updated_at'],
        'populatedSystems' => json_decode($result[0]['population'], true),
        'populatedSystemsAll' => $result[0]['population_all'] === null
            ? null
            : json_decode($result[0]['population_all'], true)
    ]);
  }

  // --------- обработка запроса ---------
  header('Content-Type: text/html; charset=utf-8');
  require_once 'db.connect.inc.php';

  // если непонятно, что за запрос, ничего не делаем и выходим с ошибкой
  if (!isset($_REQUEST['service'])) {
    die("1\nno service");
  }
  $service = $_REQUEST['service'];

  switch ($service)
  {
    case 'report': sendReport(); break;
    case 'email': sendEmail(); break;
    case 'changelog': getChangelog(); break;
    case 'ogameAPI': getDataCode(); break;
    case 'serverdata': getServerData(); break;
    case 'populatedSystems': getPopulatedSystems(); break;

    // для всех остальных "неизвестных" сервисов выходим с кодом 2
    default: die("2\nunknown");
  }
