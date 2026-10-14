#!/usr/bin/env node
'use strict';

// ProxyForGame's MCP server: the calculators' formulas as tools an LLM can call.
//
//   node mcp/server.js            HTTP on PFG_MCP_HOST:PFG_MCP_PORT, path /mcp
//   node mcp/server.js --stdio    one client over stdin/stdout (Claude Desktop & co.)
//
// No dependencies beyond Node itself: the host deploys by resetting a git
// checkout, with no install or build step (docs/adr/0005-mcp-node-service.md).
// Configuration is environment variables only - see mcp/README.md.

const http = require('node:http');
const readline = require('node:readline');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { createProtocol } = require('./lib/protocol');
const { createHttpHandler } = require('./lib/http-transport');
const { createSiteApi } = require('./lib/site-api');
const { createTools } = require('./tools');
const { checkoutCommit } = require('./lib/revision');

// The package version plus the commit, as semver build metadata: 1.0.0+3f2c1ab09d4e.
// The watchdog compares that commit with the one the site reports, so a server
// that missed its restart after a deploy shows up as drift.
const COMMIT = checkoutCommit();
const VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version
    + (COMMIT ? `+${COMMIT.slice(0, 12)}` : '');

const INSTRUCTIONS = 'Calculators for the browser game OGame, from proxyforgame.com. '
    + 'Use these tools instead of estimating OGame formulas: the results are exact. '
    + 'Ask the player for their universe (country and number, e.g. en 152) when speeds or '
    + 'universe settings matter and they have not said; the tools read the rest from the game.';

/** @param {string} line */
function log(line) {
    // stderr in both modes: under --stdio, stdout belongs to the protocol.
    process.stderr.write(`${new Date().toISOString()} ${line}\n`);
}

function main() {
    const env = process.env;
    const siteApi = createSiteApi({ baseUrl: env.PFG_SITE_URL || 'https://proxyforgame.com' });
    const protocol = createProtocol(createTools({ siteApi }), {
        name: 'proxyforgame',
        title: 'ProxyForGame OGame calculators',
        version: VERSION,
        instructions: INSTRUCTIONS,
    }, { log });

    if (process.argv.includes('--stdio')) {
        serveStdio(protocol);
        return;
    }

    const host = env.PFG_MCP_HOST || '127.0.0.1';
    const port = Number.parseInt(env.PFG_MCP_PORT || '8787', 10);
    const handler = createHttpHandler(protocol, {
        path: '/mcp',
        allowedOrigins: (env.PFG_MCP_ALLOWED_ORIGINS || 'https://proxyforgame.com,https://proxyforgame.net')
            .split(',').map((o) => o.trim()).filter(Boolean),
        rateLimit: Number.parseInt(env.PFG_MCP_RATE_LIMIT || '120', 10),
        trustProxy: env.PFG_MCP_TRUST_PROXY !== '0',
        log,
    });

    const server = http.createServer(handler);
    // Calls finish in milliseconds; anything holding a socket this long is not a client.
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    server.listen(port, host, () => log(`proxyforgame MCP ${VERSION} listening on http://${host}:${port}/mcp`));

    // systemd stops with SIGTERM; finish what is in flight, then go.
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.once(signal, () => {
            log(`${signal}: shutting down`);
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 5000).unref();
        });
    }
}

/**
 * The stdio transport: one JSON-RPC message per line in, one per line out.
 * @param {{handle: (message: unknown) => Promise<object|null>}} protocol
 */
function serveStdio(protocol) {
    const lines = readline.createInterface({ input: process.stdin });
    lines.on('line', async (line) => {
        if (line.trim() === '') {
            return;
        }
        let message;
        try {
            message = JSON.parse(line);
        } catch {
            process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
            return;
        }
        const answer = await protocol.handle(message);
        if (answer !== null) {
            process.stdout.write(`${JSON.stringify(answer)}\n`);
        }
    });
}

main();
