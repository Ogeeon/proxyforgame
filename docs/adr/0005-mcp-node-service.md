# 5. An MCP server, as a dependency-free Node service on the site's host

Date: 2026-10-14

## Status

Accepted.

## Context

A player asked whether an LLM - "ChatGPT, say" - could use the calculators
instead of guessing at OGame's formulas. The Model Context Protocol is how
ChatGPT, Claude and the editor assistants call outside tools, and ChatGPT
only connects to a **remote** MCP server, reached over HTTPS with the
Streamable HTTP transport.

The formulas the server has to compute with are JavaScript: the DOM-free
`*-core.js` files and the shared `ogame-*.js`, browser scripts that the
node:test suite already runs in Node through a `vm` context. The host
(ADR-0003) runs PHP 8.5 and nothing else of the sort, and deploys by
resetting a git checkout - no install step, no build.

## Decision

**A Node process on the same host, in `mcp/`, with no dependencies.**

- **Node, not PHP.** The server loads the same `*-core.js` files the pages
  load, through the loader the unit tests use (`mcp/lib/browser-scripts.js`).
  A PHP server would have needed every formula ported and then kept in step
  by hand - two implementations that disagree a little more after every fix.
- **No SDK.** For a stateless, tools-only server the protocol is five
  JSON-RPC methods over one POST endpoint (`mcp/lib/protocol.js`,
  `mcp/lib/http-transport.js`). An SDK would bring a `node_modules` that the
  deploy has no step to install, and a supply chain to keep current for a
  process that faces the internet. Compatibility is checked against the
  official TypeScript SDK's client, which connected over both transports
  when this was written.
- **Stateless Streamable HTTP, no SSE.** Every call finishes in milliseconds,
  so nothing needs streaming or a session; `GET /mcp` answers 405, which the
  spec provides for exactly that.
- **Loopback behind Apache.** The process listens on `127.0.0.1:8787`; Apache
  proxies `https://<site>/mcp` to it, so TLS and the certificates stay where
  they are. Only that path is proxied.
- **Restarted by the deploy.** The server loads its code once, at start.
  `pfg-sync` runs as `www-data` and cannot call `systemctl`, so it writes the
  deployed commit to a file and a systemd path unit restarts the service on
  that write - no sudo rule. The server reports the commit it loaded as part
  of its version, and the watchdog compares it with the site's.
- **Data shared with the page.** The costs tech table moved out of
  `costs.php` into `www/ogame/calc/data/costs-techs.json`, which `costs.php`
  and the server both read. The universe settings come from the site's own
  `serverdata` and `populatedSystems` services, so the server needs neither a
  database connection nor a route to Gameforge of its own.

## Consequences

- The host gains a runtime: Node 20 or newer from the distribution
  (`apt install nodejs`), one systemd service (~60 MB resident, capped at
  160 MB and half a CPU), a path unit and a `proxy_http` include in both site
  vhosts. `deploy/README.md`, *The MCP server*, is the runbook.
- A change under `mcp/` deploys like any other commit; a change to the units
  or the Apache snippet has to be reinstalled by hand, like `webhook.php`.
- A rollback to a commit from before `mcp/` existed leaves the service
  failing to start until the next deploy. The site itself is unaffected.
- Adding a calculator to the server is a file in `mcp/tools/` that maps tool
  arguments onto that calculator's core; the formulas stay where they are.
  Where a calculator still keeps its data or a piece of arithmetic in PHP or
  in orchestration code, that piece moves into a shared file first, the way
  the costs tech table did.
- The tools are public and unauthenticated, as the site is. The server
  limits each client address to 120 requests a minute and bodies to 64 KB.
