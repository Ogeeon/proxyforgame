<?php
  // Field INP, measured by www/js/interaction-timing.js on the public site and
  // stored one row per page load in interaction_timing (migration 0003). It is
  // read by hand, with SQL - nothing on the site shows it.
  //
  // The beacon is fire-and-forget: sendBeacon never reads the answer. The
  // statuses still follow the protocol in http.inc.php, so a malformed request
  // shows up as such in the access log and in the e2e suite.

  require_once __DIR__ . '/http.inc.php';
  require_once __DIR__ . '/health.inc.php';

  // Rows a single hour may add. The busiest day of the last quarter had 1820
  // page views, so a real hour stays far below this; what it stops is a script
  // that fills the table. The environment can lower it.
  const INTERACTION_TIMING_LIMIT_HOURLY = 1000;

  // How long a row is kept. Nothing older than a few releases is worth reading.
  const INTERACTION_TIMING_RETENTION_DAYS = 90;

  // No phase of an interaction lasts longer than this; anything above it is
  // not a measurement.
  const INTERACTION_TIMING_MAX_PHASE_MS = 60000;

  function apiInteractionTiming($in) {
    $row = array(
      'load_id'         => interactionTimingMatch($in, 'loadId', '/^[0-9a-f]{32}$/'),
      'page'            => interactionTimingMatch($in, 'page', '#^/[A-Za-z0-9/._-]{0,63}$#'),
      'lang'            => interactionTimingMatch($in, 'lang', '/^[a-z-]{0,8}$/'),
      'interactions'    => interactionTimingInt($in, 'interactions', 1, 65535),
      'inp_ms'          => interactionTimingInt($in, 'inp', 0, INTERACTION_TIMING_MAX_PHASE_MS),
      'input_delay_ms'  => interactionTimingInt($in, 'inputDelay', 0, INTERACTION_TIMING_MAX_PHASE_MS),
      'processing_ms'   => interactionTimingInt($in, 'processing', 0, INTERACTION_TIMING_MAX_PHASE_MS),
      'presentation_ms' => interactionTimingInt($in, 'presentation', 0, INTERACTION_TIMING_MAX_PHASE_MS),
      // A tab can stay open for days before the click that counts.
      'start_ms'        => interactionTimingInt($in, 'start', 0, 2147483647),
      'event_type'      => interactionTimingMatch($in, 'event', '/^[a-z]{1,16}$/'),
      'target'          => interactionTimingMatch($in, 'target', '/^[A-Za-z0-9#._()-]{1,96}$/'),
    );

    // What the browser may not know: an older one has no hardwareConcurrency,
    // and a page hidden before DOMContentLoaded has no time for it.
    $pointer = getParam($in, 'pointer', 'str');
    $row['pointer_type'] = in_array($pointer, array('coarse', 'fine', 'none'), true) ? $pointer : null;
    $row['cpu_cores'] = interactionTimingOptionalInt($in, 'cores', 1, 1024);
    $row['dcl_ms'] = interactionTimingOptionalInt($in, 'dcl', 0, 2147483647);

    // Read on the server, so a beacon cannot claim a release it did not come from.
    $row['release_sha'] = healthDeployedCommit(dirname(__DIR__, 2));

    // Nothing reads a row past the retention window. The index on created_at
    // keeps this cheap, and the LIMIT keeps one request from doing a backlog.
    sqlExec('DELETE FROM interaction_timing WHERE created_at < NOW() - INTERVAL ' . INTERACTION_TIMING_RETENTION_DAYS . ' DAY LIMIT 100', array());

    // One literal string: scripts/validate-database-schema.js reads the table
    // names out of sqlQuery() calls and does not follow concatenation.
    $recent = sqlQuery('SELECT COUNT(*) AS n FROM interaction_timing WHERE created_at > NOW() - INTERVAL 1 HOUR', array());
    // empty() covers both FALSE (no database) and a missing row. The database
    // is optional for the site; without one there is nothing to store.
    if (empty($recent)) {
      return array('stored' => false);
    }
    if ((int)$recent[0]['n'] >= interactionTimingLimit()) {
      throw new ApiError(429, 'rate_limited', 'Too many interaction timings this hour');
    }

    // A page load sends again when it is hidden a second time with more
    // interactions behind it; the later beacon carries the whole visit, so it
    // replaces the row. created_at and release_sha stay those of the first one.
    $stored = sqlExec(
      'INSERT INTO interaction_timing (load_id, created_at, release_sha, page, lang, pointer_type, cpu_cores, interactions, dcl_ms, inp_ms, input_delay_ms, processing_ms, presentation_ms, start_ms, event_type, target) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE interactions = VALUES(interactions), dcl_ms = VALUES(dcl_ms), inp_ms = VALUES(inp_ms), input_delay_ms = VALUES(input_delay_ms), processing_ms = VALUES(processing_ms), presentation_ms = VALUES(presentation_ms), start_ms = VALUES(start_ms), event_type = VALUES(event_type), target = VALUES(target)',
      array(
        $row['load_id'], $row['release_sha'], $row['page'], $row['lang'],
        $row['pointer_type'], $row['cpu_cores'], $row['interactions'], $row['dcl_ms'],
        $row['inp_ms'], $row['input_delay_ms'], $row['processing_ms'], $row['presentation_ms'],
        $row['start_ms'], $row['event_type'], $row['target'],
      )
    );
    if (!$stored) {
      error_log('interactionTiming: could not store the row');
    }
    return array('stored' => (bool)$stored);
  }

  /** A required string parameter that must match $pattern. */
  function interactionTimingMatch($in, $name, $pattern) {
    $value = requireParam($in, $name, 'str');
    if (preg_match($pattern, $value) !== 1) {
      throw new ApiError(400, 'bad_params', "Malformed parameter: $name");
    }
    return $value;
  }

  /** A required integer parameter within [$min, $max]. */
  function interactionTimingInt($in, $name, $min, $max) {
    $value = requireParam($in, $name, 'int');
    if ($value < $min || $value > $max) {
      throw new ApiError(400, 'bad_params', "Parameter out of range: $name");
    }
    return $value;
  }

  /** An optional integer parameter: NULL when absent, malformed or out of range. */
  function interactionTimingOptionalInt($in, $name, $min, $max) {
    $value = getParam($in, $name, 'int');
    return ($value === null || $value < $min || $value > $max) ? null : $value;
  }

  /** The hourly cap from the environment when it holds a positive integer, the default otherwise. */
  function interactionTimingLimit() {
    $value = filter_var(getenv('INTERACTION_TIMING_LIMIT_HOURLY'), FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
    return $value === false ? INTERACTION_TIMING_LIMIT_HOURLY : $value;
  }
