# MCP usage: the `mcp_event` table

Who uses the MCP server (`mcp/`, `https://proxyforgame.com/mcp`), with which
client, which tools, and where the models get the arguments wrong. Apache's access
log only shows a `POST /mcp` and a user agent; the method, the tool and the
outcome are inside the body, which nothing logs.

The server records one event per JSON-RPC message (`mcp/lib/usage.js`) and sends
them in batches of up to 100, at most ten seconds apart, to the `mcpUsage` service
(`www/api/mcp-usage.inc.php`), which stores them in `mcp_event`
(`db/migrations/0004_create_mcp_event.sql`). Sending is fire-and-forget: if the
service or the database is down, a batch is lost and the journal says so once.

## What is recorded, and what is not

Metadata only. No argument value, no request body, no IP address: a model may
paste a player's whole account export into `ogame_import_account`, and none of it
ends up here. `mcp/README.md` (*Privacy*) and the site page `/<lang>/mcp` say the
same to the players.

| column | meaning |
|---|---|
| `created_at` | when the server received the request (ms) |
| `host` | `proxyforgame.com` or `proxyforgame.net` |
| `session_id` | the `Mcp-Session-Id` the server handed out with `initialize`; groups one connection's calls. The server keeps no record of it and never refuses a request over it |
| `method` | `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/…`; NULL for a request refused before a message was read |
| `tool` | for `tools/call` with a known tool |
| `outcome` | `ok`; `invalid` (arguments failed the schema, unknown tool or method, malformed message); `tool_error` (a `ToolError` the model can act on); `internal` (a bug - the stack is in `journalctl -u pfg-mcp`); `rejected` (refused by the transport: 400 not JSON or unknown protocol version, 403 origin, 413 body, 429 rate limit) |
| `http_status` | of the answer; a 405 (`GET`, `DELETE`) is not recorded at all |
| `duration_ms`, `body_bytes` | time to handle the message, size of the request body |
| `client_name`, `client_version` | `clientInfo` - on the `initialize` row only; join on `session_id` for the rest |
| `user_agent` | the request's, cut to 128 |
| `universe` | `en-1` when a call passed `universe` |
| `arg_keys` | names of the top-level arguments a call passed, comma-separated |
| `error_paths` | for `invalid`: the schema paths that failed (`toLevel`, `lifeforms.shipBonuses.small-cargo.speed`), array indexes as `[]` |
| `internal` | the watchdog (`clientInfo.name = pfg-watchdog`) or an address in `PFG_MCP_INTERNAL_IPS` |

The watchdog only sends `initialize`, so its rows are easy to leave out. A tester's
own traffic is not internal unless their address is listed.

## The summary

```
make mcp-stats            # last 7 days
make mcp-stats days=30
```

prints totals, calls per day, per tool (with the share that failed), per client,
the commonest validation failures and the refused requests. The queries are
`scripts/mcp-stats.sql`; it runs them on the host over `scripts/pfg-ssh.sh`.

## More queries

Run on the host against the site's database (credentials in the checkout's
`.env`); they work on MariaDB 10.4 (CI) and 11.8 (the host).

How often a tool's callers pass a given argument - whether models fill an
optional one, or never find it:

```sql
SELECT tool, COUNT(*) AS calls,
       SUM(FIND_IN_SET('universe', arg_keys) > 0) AS universe,
       SUM(FIND_IN_SET('lifeforms', arg_keys) > 0) AS lifeforms,
       SUM(FIND_IN_SET('officers', arg_keys) > 0) AS officers
FROM mcp_event
WHERE method = 'tools/call' AND internal = 0 AND created_at > NOW() - INTERVAL 30 DAY
GROUP BY tool ORDER BY calls DESC;
```

Whether sessions start with the account import, as the tool descriptions suggest:

```sql
SELECT first_tool, COUNT(*) AS sessions
FROM (SELECT session_id,
             SUBSTRING_INDEX(GROUP_CONCAT(tool ORDER BY id), ',', 1) AS first_tool
      FROM mcp_event
      WHERE method = 'tools/call' AND internal = 0 AND session_id IS NOT NULL
      GROUP BY session_id) AS s
GROUP BY first_tool ORDER BY sessions DESC;
```

One session in order, to read how a model went about a question:

```sql
SELECT created_at, method, tool, outcome, arg_keys, error_paths, duration_ms
FROM mcp_event WHERE session_id = '…' ORDER BY id;
```

Returning clients - days on which each client version was seen:

```sql
SELECT client_name, client_version, COUNT(DISTINCT DATE(created_at)) AS days, COUNT(*) AS sessions
FROM mcp_event
WHERE method = 'initialize' AND internal = 0
GROUP BY client_name, client_version ORDER BY sessions DESC;
```

## Setting it up

The server records nothing until both `PFG_MCP_EVENTS_URL` and
`PFG_MCP_EVENTS_TOKEN` are set; the service refuses everything without the token
and anything that does not come from loopback. On the host the URL is in
`deploy/pfg-mcp.service` and the token in the site's `.env`, which the unit reads
as its `EnvironmentFile` - `deploy/README.md`, *The MCP server*.

Locally, against `make serve`:

```
PFG_MCP_EVENTS_TOKEN=dev make serve
PFG_MCP_EVENTS_URL=http://localhost:8000/ajax.php PFG_MCP_EVENTS_TOKEN=dev make mcp
```
