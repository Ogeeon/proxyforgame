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
		if (!isset($_POST[$var])) return FALSE;
		switch ($type)
		{
			case 'str':
			{
				$str = trim($_POST[$var]);
				$str = urldecode($str);
				return htmlspecialchars($str);
			}
			case 'int':
			{
				if (!is_numeric($_POST[$var])) return FALSE;
				return intval($_POST[$var]);
			}
			case 'float':
			{
				if (!is_numeric($_POST[$var])) return FALSE;
				return floatval($_POST[$var]);
			}
			default: return FALSE;
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
			$h = curl_exec($ch);
			curl_close($ch);
			if (strpos($h, "code not found") > 0 || strpos($h, "wrong code") > 0) {
				die("4\nbad code");
			} else {
				die("0\n$h");
			}
		}
		die("3\nempty");
	}	
	
	// --------- обработка запроса ---------
	header('Content-Type: text/html; charset=utf-8');
	require_once('db.connect.inc.php');

	// если непонятно, что за запрос, ничего не делаем и выходим с ошибкой
	if (!isset($_POST['service'])) die("1\nno service");
	$service = $_POST['service'];
	
	switch ($service)
	{
		case 'report': SendReport(); break;
		case 'email': SendEmail(); break;
		case 'changelog': GetChangelog(); break;
		case 'ogameAPI': GetDataCode(); break;

		// для всех остальных "неизвестных" сервисов выходим с кодом 2
		default: die("2\nunknown");
	}
?>
