'use strict';

// MCP's Streamable HTTP transport, the stateless subset: every request is one
// POST of a JSON-RPC message to a single endpoint, answered with one JSON body.
// The server never opens an SSE stream - no tool here runs long enough to need
// progress, and nothing is ever pushed to a client - so GET answers 405, which
// the spec reserves for exactly that. The one exception is a browser opening
// the address as a page, which is redirected to the site page about the server
// (HttpOptions.pagePath).
//
// An initialize answer carries an Mcp-Session-Id, which the client then sends
// on every request. The server keeps no record of it and never refuses a
// request for its id: it is only there so the usage record (lib/usage.js) can
// tell which calls came over one connection. A DELETE that would end the
// session gets the 405 the spec allows for a server that does not end them.
//
// Apache proxies the public /mcp path here (deploy/apache-mcp.conf); the
// process itself listens on loopback only.

const { randomBytes } = require('node:crypto');
const { errorResponse, printable, PARSE_ERROR, INVALID_REQUEST, SUPPORTED_VERSIONS } = require('./protocol');

/** The client the watchdog (deploy/watchdog.sh) introduces itself as. */
const WATCHDOG_CLIENT = 'pfg-watchdog';

// An account export for ogame_import_account is the largest body a client
// sends: about 40 KB minified for an 8-planet account, nearer 90 KB when a
// model passes it as an escaped string. 256 KB leaves room for a big account.
const MAX_BODY_BYTES = 256 * 1024;

/**
 * @typedef {object} HttpOptions
 * @property {string} path the endpoint, e.g. /mcp
 * @property {string[]} allowedOrigins browser origins allowed to call; a request
 *   with any other Origin header is refused (the spec's DNS-rebinding guard).
 *   Server-to-server clients - ChatGPT, Claude - send none.
 * @property {number} rateLimit requests per client per minute; 0 switches it off
 * @property {boolean} trustProxy take the client address from X-Forwarded-For
 *   when the connection comes from loopback, i.e. from Apache
 * @property {(line: string) => void} log
 * @property {string} [pagePath] where a browser that opens the endpoint as a
 *   page is sent: the site page that explains the server. Unset, it gets the
 *   405 every other GET gets.
 * @property {import('./usage').UsageRecorder} [usage] where each handled
 *   message and each refused request is recorded
 * @property {string[]} [internalAddresses] client addresses whose events are
 *   marked internal (PFG_MCP_INTERNAL_IPS)
 * @property {() => number} [now]
 */

/**
 * What every event of one request shares.
 * @typedef {Pick<import('./usage').UsageEvent,
 *   'host'|'sessionId'|'userAgent'|'bodyBytes'|'internal'>} RequestFacts
 */

/**
 * @param {{handle: (message: unknown, trace?: import('./protocol').Trace) => Promise<object|null>}} protocol
 * @param {HttpOptions} options
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
function createHttpHandler(protocol, options) {
    const now = options.now ?? Date.now;
    const limiter = createRateLimiter(options.rateLimit, now);
    const internalAddresses = new Set(options.internalAddresses ?? []);

    /**
     * @param {RequestFacts} facts
     * @param {number} ts
     * @param {number} status
     * @param {import('./protocol').Trace|null} trace null for a request
     *   refused before any message was read
     * @param {number|null} durationMs
     */
    function record(facts, ts, status, trace, durationMs) {
        if (!options.usage) {
            return;
        }
        options.usage.record({
            ts,
            ...facts,
            method: trace?.method ?? null,
            tool: trace?.tool ?? null,
            outcome: trace?.outcome ?? 'rejected',
            status,
            durationMs,
            clientName: trace?.clientName ?? null,
            clientVersion: trace?.clientVersion ?? null,
            universe: trace?.universe ?? null,
            errorPaths: trace?.errorPaths ?? [],
            argKeys: trace?.argKeys ?? [],
            internal: facts.internal || trace?.clientName === WATCHDOG_CLIENT,
        });
    }

    /**
     * @param {import('node:http').IncomingMessage} req
     * @returns {RequestFacts}
     */
    function requestFacts(req) {
        const session = req.headers['mcp-session-id'];
        return {
            host: siteHost(req),
            sessionId: typeof session === 'string' && /^[0-9a-f]{32}$/.test(session) ? session : null,
            userAgent: printable(req.headers['user-agent'], 128),
            bodyBytes: Number.parseInt(String(req.headers['content-length'] ?? '0'), 10) || 0,
            internal: internalAddresses.has(clientAddress(req, options.trustProxy)),
        };
    }

    return (req, res) => {
        handle(req, res).catch((error) => {
            options.log(`request failed: ${error instanceof Error ? error.stack : String(error)}`);
            if (!res.headersSent) {
                sendJson(res, 500, errorResponse(null, -32603, 'Internal error'));
            } else {
                res.destroy();
            }
        });
    };

    /**
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:http').ServerResponse} res
     */
    async function handle(req, res) {
        const url = new URL(req.url ?? '/', 'http://localhost');

        if (url.pathname === '/healthz' && req.method === 'GET') {
            sendJson(res, 200, { status: 'ok' });
            return;
        }
        if (url.pathname !== options.path) {
            sendJson(res, 404, { error: 'Not found' });
            return;
        }

        // A player who pastes the address into the browser's address bar would
        // otherwise read a bare JSON-RPC error. A client's GET asks for
        // text/event-stream, never text/html, so it still gets the 405 below.
        if (options.pagePath && req.method === 'GET' && wantsHtml(req)) {
            res.writeHead(302, { Location: options.pagePath, 'Cache-Control': 'no-store' }).end();
            return;
        }

        const ts = now();
        const facts = requestFacts(req);
        const received = await receive(req, res, facts, ts);
        if (received.ok) {
            await answer(received.message, res, facts, ts);
        }
    }

    /**
     * The request's parsed body, or - having answered and recorded the
     * refusal already - nothing.
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:http').ServerResponse} res
     * @param {RequestFacts} facts
     * @param {number} ts
     * @returns {Promise<{ok: true, message: unknown}|{ok: false}>}
     */
    async function receive(req, res, facts, ts) {
        const refused = refusal(req);
        if (refused) {
            for (const [name, value] of Object.entries(refused.headers ?? {})) {
                res.setHeader(name, value);
            }
            sendJson(res, refused.status, errorResponse(null, INVALID_REQUEST, refused.message));
            // A 405 is a GET or a DELETE - scanners and session ends, not use.
            if (refused.status !== 405) {
                record(facts, ts, refused.status, null, null);
            }
            // The usage record keeps no headers, so a refusal's cause is
            // logged here: the protocol version a client asked for is the
            // only part of the request that tells the two 400 causes apart.
            if (refused.status === 400) {
                options.log(`refused 400: ${printable(refused.message, 200)}; user agent ${facts.userAgent ?? '-'}`);
            }
            return { ok: false };
        }

        const body = await readBody(req);
        if (body === null) {
            sendJson(res, 413, errorResponse(null, INVALID_REQUEST, `Body over ${MAX_BODY_BYTES} bytes`));
            record(facts, ts, 413, null, null);
            return { ok: false };
        }
        facts.bodyBytes = Buffer.byteLength(body);
        try {
            return { ok: true, message: JSON.parse(body) };
        } catch {
            sendJson(res, 400, errorResponse(null, PARSE_ERROR, 'Body is not valid JSON'));
            record(facts, ts, 400, null, null);
            // The body is not logged: its size and the client are enough to
            // tell a client that sends garbage from one that sends another protocol.
            options.log(`refused 400: body is not valid JSON (${facts.bodyBytes} bytes); user agent ${facts.userAgent ?? '-'}`);
            return { ok: false };
        }
    }

    /**
     * Hands the message - or each message of a batch - to the protocol,
     * answers, and records every one.
     * @param {unknown} message
     * @param {import('node:http').ServerResponse} res
     * @param {RequestFacts} facts
     * @param {number} ts
     */
    async function answer(message, res, facts, ts) {
        // A batch is a 2025-03-26 feature the later versions dropped; answering
        // it costs nothing and keeps the older clients working.
        const messages = Array.isArray(message) ? message : [message];
        const handled = await Promise.all(messages.map(async (m) => {
            /** @type {import('./protocol').Trace} */
            const trace = {};
            const start = now();
            const reply = await protocol.handle(m, trace);
            return { reply, trace, durationMs: now() - start };
        }));
        const answers = handled.map((h) => h.reply).filter((a) => a !== null);

        if (handled.some((h) => h.trace.method === 'initialize' && h.reply !== null)) {
            facts.sessionId = randomBytes(16).toString('hex');
            res.setHeader('Mcp-Session-Id', facts.sessionId);
        }
        const status = answers.length === 0 ? 202 : 200;
        if (answers.length === 0) {
            // Notifications or responses only: accepted, nothing to say back.
            res.writeHead(202).end();
        } else {
            sendJson(res, 200, Array.isArray(message) ? answers : answers[0]);
        }
        for (const h of handled) {
            record(facts, ts, status, h.trace, h.durationMs);
        }
    }

    /**
     * Why a request to the endpoint is turned away before its body is read,
     * or null when it is not.
     * @param {import('node:http').IncomingMessage} req
     * @returns {{status: number, message: string, headers?: Record<string, string>}|null}
     */
    function refusal(req) {
        const origin = req.headers.origin;
        if (origin !== undefined && !options.allowedOrigins.includes(origin)) {
            return { status: 403, message: 'Origin not allowed' };
        }
        if (req.method !== 'POST') {
            return { status: 405, message: 'Only POST is supported; this server opens no SSE stream', headers: { Allow: 'POST' } };
        }
        if (!limiter.allow(clientAddress(req, options.trustProxy))) {
            return { status: 429, message: 'Too many requests', headers: { 'Retry-After': '60' } };
        }
        // Absent means a client from before the header existed, which the spec
        // says to treat as 2025-03-26 - supported. Present and unknown is refused.
        const version = req.headers['mcp-protocol-version'];
        if (typeof version === 'string' && !SUPPORTED_VERSIONS.includes(version)) {
            return { status: 400, message: `Unsupported MCP-Protocol-Version ${version}; supported: ${SUPPORTED_VERSIONS.join(', ')}` };
        }
        return null;
    }
}

/**
 * Whether the request is a browser navigation: it accepts HTML and is not
 * asking for the event stream a client's GET would.
 * @param {import('node:http').IncomingMessage} req
 */
function wantsHtml(req) {
    const accept = req.headers.accept ?? '';
    return accept.includes('text/html') && !accept.includes('text/event-stream');
}

/**
 * The site name the client called - proxyforgame.com or .net - from the
 * X-Forwarded-Host Apache adds, else Host; without the port.
 * @param {import('node:http').IncomingMessage} req
 */
function siteHost(req) {
    const forwarded = req.headers['x-forwarded-host'];
    const raw = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.headers.host) ?? '';
    const host = raw.trim().toLowerCase().replace(/:\d+$/, '');
    return /^[a-z0-9.-]{1,32}$/.test(host) ? host : null;
}

/**
 * The client's address. Behind Apache every connection comes from loopback,
 * so the real one is the last X-Forwarded-For hop - the one Apache appended,
 * which the client cannot forge. Earlier hops are whatever the client sent.
 * @param {{socket: {remoteAddress?: string}, headers: import('node:http').IncomingHttpHeaders}} req
 * @param {boolean} trustProxy
 */
function clientAddress(req, trustProxy) {
    const remote = req.socket.remoteAddress ?? '';
    const forwarded = req.headers['x-forwarded-for'];
    if (trustProxy && typeof forwarded === 'string' && /^(127\.|::1$|::ffff:127\.)/.test(remote)) {
        const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
        return hops.at(-1) ?? remote;
    }
    return remote;
}

/**
 * A fixed one-minute window per client. Crude, but the point is only that one
 * client looping on a tool cannot take the 1-CPU host away from the site.
 * @param {number} perMinute
 * @param {() => number} now
 */
function createRateLimiter(perMinute, now) {
    /** @type {Map<string, {windowStart: number, count: number}>} */
    const clients = new Map();
    return {
        /** @param {string} client */
        allow(client) {
            if (perMinute <= 0) {
                return true;
            }
            const t = now();
            if (clients.size > 10_000) {
                // Forget everyone rather than grow without bound under a spray of addresses.
                clients.clear();
            }
            const entry = clients.get(client);
            if (!entry || t - entry.windowStart >= 60_000) {
                clients.set(client, { windowStart: t, count: 1 });
                return true;
            }
            entry.count += 1;
            return entry.count <= perMinute;
        },
    };
}

/**
 * The request body as text, or null when it is over the limit.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string|null>}
 */
async function readBody(req) {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            return null;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(text),
        'Cache-Control': 'no-store',
    });
    res.end(text);
}

module.exports = { createHttpHandler, clientAddress, createRateLimiter, MAX_BODY_BYTES, WATCHDOG_CLIENT };
