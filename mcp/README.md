# The MCP server

The calculators as tools an LLM can call - ChatGPT, Claude, Cursor, anything that
speaks the [Model Context Protocol](https://modelcontextprotocol.io). The tools
compute with the same `*-core.js` files the pages load, so a model gets the
site's numbers rather than its own guess at OGame's formulas.

Why it is built this way - Node, no dependencies, one process behind Apache:
[ADR-0005](../docs/adr/0005-mcp-node-service.md). Running it on the host:
[`deploy/README.md`](../deploy/README.md), *The MCP server*.

## Tools

| Tool | What it answers | Computed by |
|---|---|---|
| `ogame_flight` | Distance, one-way duration and deuterium at each speed step, cargo capacity | `flight-core.js` |
| `ogame_build_cost` | Metal, crystal, deuterium, energy, time, points, DM to halve, cargo ships to haul it - for a building or research range, or a number of ships or defences | `costs-core.js`, `ogame-costs.js`, `data/costs-techs.json` |

Both take an optional `universe: {country, number}` - `{"country": "en", "number": 152}`
for s152-en - and read its speeds and settings through the site's `serverdata` and
`populatedSystems` services (`docs/universe-data.md`). Anything given by hand
overrides what is read. The input schemas in `tools/*.js` are the reference: the
server validates every call against the schema it publishes.

## Running it

```
make mcp                          # HTTP on http://127.0.0.1:8787/mcp
node mcp/server.js --stdio        # one client over stdin/stdout
```

| Variable | Default | |
|---|---|---|
| `PFG_MCP_HOST` | `127.0.0.1` | Interface to listen on |
| `PFG_MCP_PORT` | `8787` | |
| `PFG_SITE_URL` | `https://proxyforgame.com` | Where the universe data is read from |
| `PFG_MCP_ALLOWED_ORIGINS` | the two site origins | Browser origins allowed to call; requests with another `Origin` get 403 |
| `PFG_MCP_RATE_LIMIT` | `120` | Requests per client address per minute, 0 for none |
| `PFG_MCP_TRUST_PROXY` | on | `0` stops reading the client address from `X-Forwarded-For` |

`PFG_SITE_URL=http://localhost:8000` points it at `make serve`.

## Connecting a client

- **ChatGPT** - with developer mode on, add a custom MCP connector with the URL
  `https://proxyforgame.com/mcp` and no authentication.
- **Claude** (claude.ai, Desktop) - Settings → Connectors → add a custom connector with
  the same URL.
- **Claude Code** - `claude mcp add --transport http proxyforgame https://proxyforgame.com/mcp`.
- **A local checkout** in any client that runs commands - command `node`, arguments
  `<checkout>/mcp/server.js --stdio`.

## Adding a tool

1. A file in `tools/` exporting a factory that returns `{name, title, description,
   inputSchema, openWorld?, run}`, registered in `tools/index.js`.
2. `run` gets the arguments already validated, defaults filled in. Throw a
   `ToolError` for anything the caller can fix - the model reads the message - and
   let anything else propagate: it becomes an internal error and a log line.
3. Compute with the calculator's own core through `loadBrowserScripts`. When the
   arithmetic or the data still lives in a template, an orchestration file or PHP,
   move it into a shared file first rather than copying it here - the costs tech
   table is the precedent.
4. Tests in `unit-tests/mcp-server.test.js`. The schema only understands the
   keywords listed at the top of `lib/schema.js`.

## Layout

| File | |
|---|---|
| `server.js` | Entry point: configuration, HTTP or stdio |
| `lib/protocol.js` | JSON-RPC and the MCP methods; transport-free |
| `lib/http-transport.js` | Streamable HTTP, stateless: POST only, rate limit, origin check |
| `lib/schema.js` | Validates arguments against the published input schema |
| `lib/browser-scripts.js` | Runs `www/` scripts in a `vm` context - shared with the unit tests |
| `lib/site-api.js` | Reads universe data from the site, with a short cache |
| `lib/revision.js` | The checkout's commit, for the version string |
