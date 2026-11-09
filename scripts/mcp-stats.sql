-- The MCP server's usage over the last @days days, from mcp_event
-- (docs/mcp-usage.md). Run by scripts/mcp-stats.sh (make mcp-stats), which sets
-- @days first. Internal traffic - the watchdog, PFG_MCP_INTERNAL_IPS - is left
-- out of every table but the first.

SET @call = 'tools/call';

SELECT '== totals ==' AS report;
SELECT COUNT(*) AS events, SUM(internal) AS internal_events,
       COUNT(DISTINCT CASE WHEN internal = 0 THEN session_id END) AS sessions,
       SUM(internal = 0 AND method = @call) AS tool_calls,
       MIN(created_at) AS first_event, MAX(created_at) AS last_event
FROM mcp_event
WHERE created_at > NOW() - INTERVAL @days DAY;

SELECT '== per day ==' AS report;
SELECT DATE(created_at) AS day,
       COUNT(DISTINCT session_id) AS sessions,
       SUM(method = 'initialize') AS inits,
       SUM(method = 'tools/list') AS lists,
       SUM(method = @call) AS calls,
       SUM(method = @call AND outcome <> 'ok') AS failed_calls,
       SUM(outcome = 'rejected') AS rejected
FROM mcp_event
WHERE created_at > NOW() - INTERVAL @days DAY AND internal = 0
GROUP BY day
ORDER BY day;

SELECT '== tools ==' AS report;
SELECT tool,
       COUNT(*) AS calls,
       SUM(outcome = 'ok') AS ok,
       SUM(outcome = 'invalid') AS invalid,
       SUM(outcome = 'tool_error') AS tool_error,
       SUM(outcome = 'internal') AS internal_error,
       ROUND(AVG(duration_ms)) AS avg_ms,
       MAX(duration_ms) AS max_ms,
       SUM(universe IS NOT NULL) AS with_universe
FROM mcp_event
WHERE created_at > NOW() - INTERVAL @days DAY AND internal = 0 AND method = @call
GROUP BY tool
ORDER BY calls DESC;

-- A session's client is the clientInfo of its initialize; requests without a
-- session id (a client that ignores it, or one refused before initialize) are
-- grouped by the product part of their user agent.
SELECT '== clients ==' AS report;
SELECT COALESCE(i.client_name, CONCAT('(no session) ', SUBSTRING_INDEX(COALESCE(e.user_agent, '?'), '/', 1))) AS client,
       COUNT(DISTINCT e.session_id) AS sessions,
       SUM(e.method = @call) AS calls,
       SUM(e.method = @call AND e.outcome <> 'ok') AS failed_calls
FROM mcp_event e
LEFT JOIN mcp_event i ON i.session_id = e.session_id AND i.method = 'initialize'
WHERE e.created_at > NOW() - INTERVAL @days DAY AND e.internal = 0
GROUP BY client
ORDER BY calls DESC, sessions DESC;

SELECT '== where calls fail validation ==' AS report;
SELECT tool, error_paths, COUNT(*) AS n
FROM mcp_event
WHERE created_at > NOW() - INTERVAL @days DAY AND internal = 0 AND outcome = 'invalid'
GROUP BY tool, error_paths
ORDER BY n DESC
LIMIT 15;

SELECT '== refused requests ==' AS report;
SELECT http_status, COUNT(*) AS n
FROM mcp_event
WHERE created_at > NOW() - INTERVAL @days DAY AND internal = 0 AND outcome = 'rejected'
GROUP BY http_status
ORDER BY n DESC;
