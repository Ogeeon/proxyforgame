<?php
  // What stands between the report and email services and a script that
  // posts to ajax.php in a loop. Two layers, both checked after the form has
  // been validated, so a person filling it in wrong still gets told why:
  //
  // - the traps catch a client that is not the sidebar dialog - a filled-in
  //   honeypot, or no record of how long the dialog was open. It is answered
  //   as if the message had gone out, so there is nothing to learn from it.
  // - the rate limit caps what one address can send, real dialog or not.

  require_once __DIR__ . '/http.inc.php';

  // The dialog cannot be opened, filled in and sent faster than this.
  const MAIL_MIN_ELAPSED_MS = 2000;

  // Messages one address may send per window. The environment can lower them,
  // which is how CI reaches the limit without sending a pile of requests.
  const MAIL_LIMIT_SHORT = 5;   // per 10 minutes
  const MAIL_LIMIT_DAILY = 20;  // per 24 hours

  /**
   * Whether the request trips one of the traps the sidebar dialog never does:
   * the `website` field is hidden from people, and `elapsed` is the time the
   * dialog spent open, which a client that skips the dialog does not send.
   */
  function isTrapped($in) {
    $honeypot = getParam($in, 'website', 'str');
    if ($honeypot !== null && $honeypot !== '') {
      error_log('antispam: honeypot filled, message dropped');
      return true;
    }

    $elapsed = getParam($in, 'elapsed', 'int');
    if ($elapsed === null || $elapsed < MAIL_MIN_ELAPSED_MS) {
      error_log('antispam: elapsed ' . ($elapsed === null ? 'missing' : $elapsed . ' ms') . ', message dropped');
      return true;
    }

    return false;
  }

  /**
   * Counts this message against the sender's address, or refuses it with a
   * 429 when the address has used up either window.
   *
   * The row goes in before the message is sent, so a send that fails still
   * counts: an SMTP outage must not turn into an unlimited retry loop.
   *
   * Fails open. The database is optional for the site, and an outage of it is
   * no reason to stop people from writing in - the traps still hold.
   */
  function enforceMailRateLimit() {
    $ip = isset($_SERVER['REMOTE_ADDR']) && is_string($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $ipHash = hash('sha256', $ip);

    // Nothing reads a row past the daily window; drop them here rather than
    // in a cron of their own. A failure is harmless - the counts below only
    // look inside the window.
    sqlExec('DELETE FROM mail_rate_limit WHERE created_at < NOW() - INTERVAL 1 DAY', array());

    // One literal string: scripts/validate-database-schema.js reads the table
    // names out of sqlQuery() calls and does not follow concatenation.
    $rows = sqlQuery('SELECT COALESCE(SUM(created_at > NOW() - INTERVAL 10 MINUTE), 0) AS recent, COUNT(*) AS daily FROM mail_rate_limit WHERE ip_hash = ? AND created_at > NOW() - INTERVAL 1 DAY', array($ipHash));
    // empty() covers both FALSE (no database) and a missing row.
    if (empty($rows)) {
      error_log('antispam: rate limit unavailable (no database), message let through');
      return;
    }

    $recent = (int)$rows[0]['recent'];
    $daily = (int)$rows[0]['daily'];
    if ($recent >= mailLimit('MAIL_RATE_LIMIT_SHORT', MAIL_LIMIT_SHORT)
        || $daily >= mailLimit('MAIL_RATE_LIMIT_DAILY', MAIL_LIMIT_DAILY)) {
      throw new ApiError(429, 'rate_limited', 'Too many messages from this address');
    }

    if (!sqlExec('INSERT INTO mail_rate_limit (ip_hash, created_at) VALUES (?, NOW())', array($ipHash))) {
      error_log('antispam: could not record the message for the rate limit');
    }
  }

  /** A limit from the environment when it holds a positive integer, the default otherwise. */
  function mailLimit($envName, $default) {
    $value = filter_var(getenv($envName), FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
    return $value === false ? $default : $value;
  }
