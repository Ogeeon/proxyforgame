<?php
  // все аякс-сервисы обрабатываются здесь
  // в запросе обязательно должен присутствовать параметр service

  // аналог js unescape
  function convert_unicode($t) 
  { 
    return preg_replace( '#%u([0-9A-F]{4})#se','iconv("UTF-16BE","UTF-8",pack("H4","$1"))', $t ); 
  }
  
  // функция выбирает из запроса значение указанного параметра
function GetVar($var, $type)
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


  function SendReport() {
    if (($wrong = GetVar('wrong', 'str')) !== FALSE && ($right = GetVar('right', 'str')) !== FALSE) {
      if ($wrong == '' && $right == '')
        die("4\nempty");
      if ($wrong === $right)
        die("5\nequal");
      if ($wrong == '')
        die("6\nempty");
      if ($right == '')
        die("7\nempty");
      $to  = 'proxyforgame@gmail.com';
      $subject = 'New feedback from ProxyForGame site';
      $message = "Script: \"". GetVar('url', 'str')."\"\n";
      $message .= "Wrong text: \"".GetVar('wrong', 'str')."\"\n"; 
      $message .= "Right text: \"".GetVar('right', 'str')."\"\n"; 
      if (socketmail($to, $subject, $message))
        die("0\ngood");
      else
        die("99\nfailed");
    }
    die("3\nempty");
  }

  function SendEmail() {
    if (($emailSubject = GetVar('subject', 'str')) !== FALSE && ($emailBody = GetVar('body', 'str')) !== FALSE) {
      if ($emailSubject == '' && $emailBody == '')
        die("4\nempty");
      $to  = 'proxyforgame@gmail.com';
      $subject = 'New email from ProxyForGame site';
      $message = "Sender: \"".(GetVar('address', 'str')==''?'(unspecified)':GetVar('address', 'str'))."\"\n";
      $message .= "Subject: \"".$emailSubject."\"\n"; 
      $message .= "Body: \"".$emailBody."\"\n"; 
      if (socketmail($to, $subject, $message))
        die("0\ngood");
      else
        die("99\nfailed");
    }
    die("3\nempty");
  }
  
  function socketmail($to, $subject, $message) {
    $server = "ssl://smtp.gmail.com";
    $socket = fsockopen($server, 465, $errno, $errstr, 30);
    if (!$socket)
      die("99\Server $server. Connection failed: $errno, $errstr");
    fputs($socket, "HELO proxyforgame.com\r\n"); fgets($socket, 256);
    fputs($socket, 'AUTH LOGIN'."\r\n"); fgets($socket, 256);
    fputs($socket, base64_encode("pfgwebsitemailer@gmail.com")."\r\n"); fgets($socket, 256);
    fputs($socket, base64_encode("khndzgjtwmlzobtd")."\r\n"); fgets($socket, 256);
    fputs($socket, "MAIL FROM: <pfgwebsitemailer@gmail.com>\r\n"); fgets($socket, 256);
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
    
  function GetChangelog() {
    if (($lastSeen = GetVar('lastSeen', 'int')) !== FALSE && ($lang = GetVar('lang', 'str')) !== FALSE) {
      $langs = array('ru', 'de', 'es', 'pl', 'fr', 'it', 'nl', 'sk', 'tr', 'pt', 'en', 'us');
      if (!in_array($lang, $langs))
        die("1\nmalformed");
      if ($lang == 'us')
        $lang = 'en';
      $result = SqlQuery("select ch.ts, cd.description from change_headers ch join change_descriptions cd on (ch.id = cd.id) 
        where lang like ? and ch.id > ? order by ch.id desc", array($lang, $lastSeen));
      $repsonse = json_encode($result);
      die('0\n'.$repsonse);
    }
    die("1\nmalformed");		
  }

  function GetDataCode() {
    if (($strCode = GetVar('code', 'str')) !== FALSE) {

      //flight.php?SR_KEY=fs008d2cbfee933ddbb85e2e20d8872ce34d
      //flight.php?SR_KEY=sr-ru-1-360e215d03d5115e828c70bba761b361dd8b4c0c

      $ch = curl_init('https://logserver.net/api/proxyforgame/?code=' . $strCode);

      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
      curl_setopt($ch, CURLOPT_TIMEOUT, 30);
      $h = curl_exec($ch);
      if (curl_errno($ch)) {
        curl_close($ch);
        $err = curl_error($ch);
        // Maybe Logserver isn't accessible. Let's try fallback method
        // It will use die() if something is wrong
        $data = GetSpyReportByFallbackMethod($strCode);
        if (strpos($data, "RESULT_DATA") > 0) {
          die("0\n$data");
        }
        die("3\n$err");
      }
      curl_close($ch);
      if (strpos($h, "code not found") > 0 || strpos($h, "wrong code") > 0) {
        // Maybe Logserver can't process this SR. Let's try fallback method
        // It will use die() if something is wrong
        $data = GetSpyReportByFallbackMethod($strCode);
        if (strpos($data, "RESULT_DATA") > 0) {
          die("0\n$data");
        }
        die("4\nbad code");
      } else {
        die("0\n$h");
      }
    }
    die("3\nempty");
  }

  function GetSpyReportByFallbackMethod($srId) {
      // Extract language code and universe number from SR_ID
      // Format: sr-en-1-c781a3232869009dbe97d7cdd46a8c3822a75bb5
      $parts = explode('-', $srId);
      
      if (count($parts) < 4) {
          die("4\nbad code");
      }
      
      $language = $parts[1];  // 'en'
      $universe = $parts[2];  // '1'
      
      // Query faw-kes API for spy report
      $reportUrl = "https://ogapi.faw-kes.de/v1/report/" . $srId;
      $reportData = @file_get_contents($reportUrl);
      
      if ($reportData === false) {
          die("3\n" . 'Failed to fetch spy report from ogapi.faw-kes.de');
      }
      
      $reportJson = json_decode($reportData, true);
      
      if ($reportJson === null) {
          die("3\n" . 'Invalid JSON response from ogapi.faw-kes.de');
      }
      
      // Query OGame API for server data
      $serverDataUrl = "https://s{$universe}-{$language}.ogame.gameforge.com/api/serverData.xml";
      $serverDataXml = @file_get_contents($serverDataUrl);
      
      if ($serverDataXml === false) {
          die("3\n" . 'Failed to fetch server data from OGame API');
      }
      
      // Parse XML
      $xml = simplexml_load_string($serverDataXml);
      
      if ($xml === false) {
          die("3\n" . 'Failed to parse server data XML');
      }
      
      // Build universe data JSON structure
      $universeData = [
          'universes' => [
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
              'probeCargo' => (string)$xml->probeCargo ?? ''
          ]
      ];
      
      // Add universe data to report JSON
      $reportJson['RESULT_DATA']['universes'] = $universeData['universes'];
      
      return json_encode($reportJson);
  }

  function GetServerData() {
    $country = GetVar('country', 'str');
    $universe = GetVar('universe', 'int');
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
      'fleetIgnoreEmptySystems' => (string)$xml->fleetIgnoreEmptySystems ?? ''
    ];
        
    echo json_encode($universeData);
  }

  function GetPopulatedSystems() {
      $country = GetVar('country', 'str');
      $universe = GetVar('universe', 'int');
      $result = SqlQuery("
          SELECT timestamp, population
          FROM population_data
          WHERE universe = ? AND country = ?
      ", array($universe, $country));

      header('Content-Type: application/json');
      echo json_encode([
        'timestamp' => (int)$result[0]['timestamp'],
        'populatedSystems' => json_decode($result[0]['population'], true)
    ]);
  }

  // --------- обработка запроса ---------
  header('Content-Type: text/html; charset=utf-8');
  require_once('db.connect.inc.php');

  // если непонятно, что за запрос, ничего не делаем и выходим с ошибкой
  if (!isset($_REQUEST['service'])) die("1\nno service");
  $service = $_REQUEST['service'];
  
  switch ($service)
  {
    case 'report': SendReport(); break;
    case 'email': SendEmail(); break;
    case 'changelog': GetChangelog(); break;
    case 'ogameAPI': GetDataCode(); break;
    case 'serverdata': GetServerData(); break;
    case 'populatedSystems': GetPopulatedSystems(); break;

    // для всех остальных "неизвестных" сервисов выходим с кодом 2
    default: die("2\nunknown");
  }
?>
