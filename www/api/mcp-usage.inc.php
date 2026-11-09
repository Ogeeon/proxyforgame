<?php
  // The MCP server's usage record (mcp/lib/usage.js): batches of events, one
  // per JSON-RPC message the server handled or request it refused, stored one
  // row each in mcp_event (migration 0004). Read by hand, with the queries in
  // docs/mcp-usage.md - nothing on the site shows it.
  //
  // Only the MCP server may write here: it runs on the same machine and
  // connects over loopback, and it sends the token both sides read from .env.
  // Without PFG_MCP_EVENTS_TOKEN the service is off.

  require_once __DIR__ . '/http.inc.php';

  // What one request may carry; the server sends at most this many at a time.
  const MCP_USAGE_MAX_EVENTS = 100;

  // Bounds no real event goes past: a batch waits seconds in the queue, never a
  // day, and no call takes ten minutes.
  const MCP_USAGE_MAX_AGE_MS = 86400000;
  const MCP_USAGE_MAX_DURATION_MS = 600000;

  const MCP_USAGE_OUTCOMES = array('ok', 'invalid', 'tool_error', 'internal', 'rejected');

  function apiMcpUsage($in) {
    $remote = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    if (!in_array($remote, array('127.0.0.1', '::1'), true)) {
      throw new ApiError(403, 'forbidden', 'mcpUsage is only open to the MCP server on this machine');
    }
    $expected = getenv('PFG_MCP_EVENTS_TOKEN');
    $token = getParam($in, 'token', 'str');
    if ($expected === false || $expected === '' || $token === null || !hash_equals($expected, $token)) {
      throw new ApiError(403, 'forbidden', 'mcpUsage needs the token from .env');
    }

    $events = json_decode((string)requireParam($in, 'events', 'str'), true);
    if (!is_array($events) || !array_is_list($events) || count($events) > MCP_USAGE_MAX_EVENTS) {
      throw new ApiError(400, 'bad_params', 'events must be a JSON array of at most ' . MCP_USAGE_MAX_EVENTS);
    }

    $nowMs = (int)round(microtime(true) * 1000);
    $stored = 0;
    $skipped = 0;
    foreach ($events as $event) {
      $row = is_array($event) ? mcpUsageRow($event, $nowMs) : null;
      if ($row === null) {
        $skipped++;
        continue;
      }
      // One literal statement: scripts/validate-database-schema.js reads the
      // table names out of the SQL strings and does not follow concatenation.
      // FROM_UNIXTIME converts in the session's time zone, as NOW() would.
      $ok = sqlExec(
        'INSERT INTO mcp_event (created_at, host, session_id, method, tool, outcome, http_status, duration_ms, body_bytes, client_name, client_version, user_agent, universe, error_paths, arg_keys, internal) VALUES (FROM_UNIXTIME(? / 1000), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        $row
      );
      if (!$ok) {
        // No database, or it went away: the rest of the batch would fail too.
        throw new ApiError(503, 'storage_unavailable', 'Could not store the events');
      }
      $stored++;
    }
    return array('stored' => $stored, 'skipped' => $skipped);
  }

  /**
   * The INSERT parameters for one event, or NULL when it is not one the server
   * could have sent. Optional fields that make no sense are stored as NULL.
   */
  function mcpUsageRow($e, $nowMs) {
    $ts = mcpUsageInt($e, 'ts', $nowMs - MCP_USAGE_MAX_AGE_MS, $nowMs + 300000);
    $status = mcpUsageInt($e, 'status', 100, 599);
    $bodyBytes = mcpUsageInt($e, 'bodyBytes', 0, 2147483647);
    $outcome = isset($e['outcome']) && in_array($e['outcome'], MCP_USAGE_OUTCOMES, true) ? $e['outcome'] : null;
    if ($ts === null || $status === null || $bodyBytes === null || $outcome === null) {
      return null;
    }
    return array(
      $ts,
      mcpUsageMatch($e, 'host', '/^[a-z0-9.-]{1,32}$/'),
      mcpUsageMatch($e, 'sessionId', '/^[0-9a-f]{32}$/'),
      mcpUsageMatch($e, 'method', '#^[A-Za-z/_.-]{1,32}$#'),
      mcpUsageMatch($e, 'tool', '/^[a-z0-9_]{1,48}$/'),
      $outcome,
      $status,
      mcpUsageInt($e, 'durationMs', 0, MCP_USAGE_MAX_DURATION_MS),
      $bodyBytes,
      mcpUsageText($e, 'clientName', 64),
      mcpUsageText($e, 'clientVersion', 32),
      mcpUsageText($e, 'userAgent', 128),
      mcpUsageMatch($e, 'universe', '/^[a-z]{2,3}-\d{1,4}$/'),
      mcpUsageNames($e, 'errorPaths'),
      mcpUsageNames($e, 'argKeys'),
      !empty($e['internal']) ? 1 : 0,
    );
  }

  /** An integer field within [$min, $max], or NULL. */
  function mcpUsageInt($e, $name, $min, $max) {
    $value = isset($e[$name]) ? $e[$name] : null;
    return (is_int($value) && $value >= $min && $value <= $max) ? $value : null;
  }

  /** A string field that matches $pattern, or NULL. */
  function mcpUsageMatch($e, $name, $pattern) {
    $value = isset($e[$name]) ? $e[$name] : null;
    return (is_string($value) && preg_match($pattern, $value) === 1) ? $value : null;
  }

  /** Free text the client chose - a name, a user agent: printable ASCII, cut to $max. */
  function mcpUsageText($e, $name, $max) {
    $value = isset($e[$name]) ? $e[$name] : null;
    if (!is_string($value)) {
      return null;
    }
    $clean = substr(trim(preg_replace('/[^\x20-\x7e]/', '', $value)), 0, $max);
    return $clean === '' ? null : $clean;
  }

  /**
   * A list of argument names or schema paths, comma-joined into the 512 the
   * column holds; whole names only, the ones that do not fit are left out.
   */
  function mcpUsageNames($e, $name) {
    $list = isset($e[$name]) && is_array($e[$name]) ? $e[$name] : array();
    $joined = '';
    foreach ($list as $item) {
      if (!is_string($item) || preg_match('/^[\w.\[\]()-]{1,100}$/', $item) !== 1) {
        continue;
      }
      $next = $joined === '' ? $item : "$joined,$item";
      if (strlen($next) > 512) {
        break;
      }
      $joined = $next;
    }
    return $joined === '' ? null : $joined;
  }
