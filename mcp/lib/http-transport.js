'use strict';

// MCP's Streamable HTTP transport, the stateless subset: every request is one
// POST of a JSON-RPC message to a single endpoint, answered with one JSON body.
// The server never opens an SSE stream - no tool here runs long enough to need
// progress, and nothing is ever pushed to a client - so GET answers 405, which
// the spec reserves for exactly that, and no Mcp-Session-Id is issued.
//
// Apache proxies the public /mcp path here (deploy/apache-mcp.conf); the
// process itself listens on loopback only.

const { errorResponse, PARSE_ERROR, INVALID_REQUEST, SUPPORTED_VERSIONS } = require('./protocol');

const MAX_BODY_BYTES = 64 * 1024;

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
 * @property {() => number} [now]
 */

/**
 * @param {{handle: (message: unknown) => Promise<object|null>}} protocol
 * @param {HttpOptions} options
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
function createHttpHandler(protocol, options) {
    const now = options.now ?? Date.now;
    const limiter = createRateLimiter(options.rateLimit, now);

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

        const origin = req.headers.origin;
        if (origin !== undefined && !options.allowedOrigins.includes(origin)) {
            sendJson(res, 403, errorResponse(null, INVALID_REQUEST, 'Origin not allowed'));
            return;
        }
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            sendJson(res, 405, errorResponse(null, INVALID_REQUEST, 'Only POST is supported; this server opens no SSE stream'));
            return;
        }

        if (!limiter.allow(clientAddress(req, options.trustProxy))) {
            res.setHeader('Retry-After', '60');
            sendJson(res, 429, errorResponse(null, INVALID_REQUEST, 'Too many requests'));
            return;
        }

        // Absent means a client from before the header existed, which the spec
        // says to treat as 2025-03-26 - supported. Present and unknown is refused.
        const version = req.headers['mcp-protocol-version'];
        if (typeof version === 'string' && !SUPPORTED_VERSIONS.includes(version)) {
            sendJson(res, 400, errorResponse(null, INVALID_REQUEST,
                `Unsupported MCP-Protocol-Version ${version}; supported: ${SUPPORTED_VERSIONS.join(', ')}`));
            return;
        }

        const body = await readBody(req);
        if (body === null) {
            sendJson(res, 413, errorResponse(null, INVALID_REQUEST, `Body over ${MAX_BODY_BYTES} bytes`));
            return;
        }
        let message;
        try {
            message = JSON.parse(body);
        } catch {
            sendJson(res, 400, errorResponse(null, PARSE_ERROR, 'Body is not valid JSON'));
            return;
        }

        // A batch is a 2025-03-26 feature the later versions dropped; answering
        // it costs nothing and keeps the older clients working.
        if (Array.isArray(message)) {
            const answers = (await Promise.all(message.map((m) => protocol.handle(m)))).filter((a) => a !== null);
            if (answers.length === 0) {
                res.writeHead(202).end();
            } else {
                sendJson(res, 200, answers);
            }
            return;
        }

        const answer = await protocol.handle(message);
        if (answer === null) {
            // A notification or a response: accepted, nothing to say back.
            res.writeHead(202).end();
            return;
        }
        sendJson(res, 200, answer);
    }
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

module.exports = { createHttpHandler, clientAddress, createRateLimiter, MAX_BODY_BYTES };
