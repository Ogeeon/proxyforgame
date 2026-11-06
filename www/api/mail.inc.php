<?php
  // The two services that hand a message to the site owner's mailbox. Both
  // validate the form first and only then run the antispam checks, so a person
  // who filled it in wrong is told why rather than silently dropped.

  require_once __DIR__ . '/http.inc.php';
  require_once __DIR__ . '/antispam.inc.php';

  const MAIL_RECIPIENT = 'proxyforgame@gmail.com';

  // The client caps the field values it collects for a calculation-error
  // report itself; this is the backstop that keeps a forged request bounded.
  const REPORT_CONTEXT_MAX_CHARS = 10000;

  /**
   * Clips a UTF-8 string to so many characters. The project does not require
   * mbstring, so the job goes to PCRE, whose /u modifier counts characters.
   * A string shorter than the limit matches nothing and passes through.
   */
  function utf8Clip($text, $maxChars) {
    return preg_replace('/\A(.{' . (int)$maxChars . '}).*\z/us', '$1', $text) ?? $text;
  }

  /**
   * The first validation rule the report input breaks, as the [code, message]
   * the client reads - or null when the input is fine. The calculation-error
   * mode has its own wording for the two rules it can still hit, because its
   * fields are labelled differently there, and skips the two that compare the
   * fields: the game's value is a best-effort answer in that mode, so an empty
   * or echoing second field is not a mistake.
   * @param string $wrong
   * @param string $right
   * @param bool $calc
   * @return array|null
   */
  function reportValidation($wrong, $right, $calc) {
    $invalid = null;
    if ($wrong === '' && $right === '') {
      $invalid = array($calc ? 'calc_both_empty' : 'both_empty', 'Both fields are empty');
    } elseif (!$calc && $wrong === $right) {
      $invalid = array('texts_equal', 'wrong and right are identical');
    } elseif ($wrong === '') {
      $invalid = array($calc ? 'calc_wrong_empty' : 'wrong_empty', 'The wrong text is empty');
    } elseif (!$calc && $right === '') {
      $invalid = array('right_empty', 'The corrected text is empty');
    }
    return $invalid;
  }

  function apiReport($in) {
    $wrong = requireParam($in, 'wrong', 'str');
    $right = requireParam($in, 'right', 'str');
    // The calculation-error flavour of the dialog asks what the game shows as
    // a best-effort answer, and the page's current field values travel along
    // as context.
    $calc = getParam($in, 'calc', 'str') === '1';
    $context = getParam($in, 'context', 'str');

    // Each way of getting the form wrong has its own explanation on the
    // client, hence codes rather than one validation_failed.
    $invalid = reportValidation($wrong, $right, $calc);
    if ($invalid !== null) {
      throw new ApiError(422, $invalid[0], $invalid[1]);
    }

    if (isTrapped($in)) {
      return array('sent' => true);
    }
    enforceMailRateLimit();

    $url = getParam($in, 'url', 'str');
    if ($calc) {
      $message = "Script: \"" . ($url === null ? '' : $url) . "\"\n";
      $message .= "What the calculator shows: \"$wrong\"\n";
      $message .= "What the game shows: \"" . ($right === '' ? '(unspecified)' : $right) . "\"\n";
      $message .= "Form values:\n";
      $message .= ($context === null || $context === '' ? '(none)' : utf8Clip($context, REPORT_CONTEXT_MAX_CHARS)) . "\n";
      sendOrFail('Calculation error from ProxyForGame site', $message);
      return array('sent' => true);
    }

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

    if (isTrapped($in)) {
      return array('sent' => true);
    }
    enforceMailRateLimit();

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
