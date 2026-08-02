<?php
  // The two services that hand a message to the site owner's mailbox.

  require_once __DIR__ . '/http.inc.php';

  const MAIL_RECIPIENT = 'proxyforgame@gmail.com';

  function apiReport($in) {
    $wrong = requireParam($in, 'wrong', 'str');
    $right = requireParam($in, 'right', 'str');

    // Four ways of getting the form wrong, each with its own explanation on
    // the client - hence four codes rather than one validation_failed.
    if ($wrong === '' && $right === '') {
      throw new ApiError(422, 'both_empty', 'Both fields are empty');
    }
    if ($wrong === $right) {
      throw new ApiError(422, 'texts_equal', 'wrong and right are identical');
    }
    if ($wrong === '') {
      throw new ApiError(422, 'wrong_empty', 'The misspelled text is empty');
    }
    if ($right === '') {
      throw new ApiError(422, 'right_empty', 'The corrected text is empty');
    }

    $url = getParam($in, 'url', 'str');
    $message = "Script: \"" . ($url === null ? '' : $url) . "\"\n";
    $message .= "Wrong text: \"$wrong\"\n";
    $message .= "Right text: \"$right\"\n";

    sendOrFail('New feedback from ProxyForGame site', $message);
    return array('sent' => true);
  }

  function apiEmail($in) {
    $emailSubject = requireParam($in, 'subject', 'str');
    $emailBody = requireParam($in, 'body', 'str');

    if ($emailSubject === '' && $emailBody === '') {
      throw new ApiError(422, 'nothing_to_send', 'Both subject and body are empty');
    }

    $address = getParam($in, 'address', 'str');
    $message = "Sender: \"" . ($address === null || $address === '' ? '(unspecified)' : $address) . "\"\n";
    $message .= "Subject: \"$emailSubject\"\n";
    $message .= "Body: \"$emailBody\"\n";

    sendOrFail('New email from ProxyForGame site', $message);
    return array('sent' => true);
  }

  function sendOrFail($subject, $message) {
    if (!socketmail(MAIL_RECIPIENT, $subject, $message)) {
      throw new ApiError(502, 'mail_failed', 'Could not hand the message to the SMTP server');
    }
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
      // This used to die() with a hand-rolled status line, and a broken one at
      // that, which left the dialog on the client stuck with every div hidden.
      error_log("socketmail: $server connection failed: $errno, $errstr");
      return false;
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
