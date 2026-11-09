-- One row per JSON-RPC message the MCP server (mcp/server.js) received over
-- HTTP, plus one per request its transport turned away before reading a
-- message (403, 413, 429, a body that is not JSON). Written by the mcpUsage
-- service (www/api/mcp-usage.inc.php), which only the server itself can call,
-- from loopback; read by hand, with the queries in docs/mcp-usage.md.
--
-- Metadata only: which method and tool, how it ended, how long it took and
-- which client sent it. No argument values, no request body, no IP address -
-- arg_keys holds the names of the top-level arguments a call passed and
-- error_paths the schema paths that failed validation, never what was in them.
--
-- session_id is the Mcp-Session-Id the server hands out with each initialize
-- answer and the client sends back on every later request; the server keeps
-- no record of it, so it only groups the rows of one connection here.
-- internal marks the watchdog and the addresses in PFG_MCP_INTERNAL_IPS.
-- Rows are kept: even a hundred times today's traffic is a few thousand a day.

CREATE TABLE IF NOT EXISTS mcp_event (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at          DATETIME(3) NOT NULL,
  host                VARCHAR(32) NULL,
  session_id          CHAR(32) NULL,
  method              VARCHAR(32) NULL,
  tool                VARCHAR(48) NULL,
  outcome             VARCHAR(16) NOT NULL,
  http_status         SMALLINT UNSIGNED NOT NULL,
  duration_ms         INT UNSIGNED NULL,
  body_bytes          INT UNSIGNED NOT NULL,
  client_name         VARCHAR(64) NULL,
  client_version      VARCHAR(32) NULL,
  user_agent          VARCHAR(128) NULL,
  universe            VARCHAR(16) NULL,
  error_paths         VARCHAR(512) NULL,
  arg_keys            VARCHAR(512) NULL,
  internal            TINYINT(1) NOT NULL DEFAULT 0,
  KEY created (created_at),
  KEY tool_time (tool, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
