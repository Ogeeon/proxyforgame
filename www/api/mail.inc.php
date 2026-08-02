<?php
  // The two services that hand a message to the site owner's mailbox.

  require_once __DIR__ . '/http.inc.php';

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
    die(EMPTY_PARAMS_RESPONSE);
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
    die(EMPTY_PARAMS_RESPONSE);
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
