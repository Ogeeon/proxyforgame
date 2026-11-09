'use strict';

// The usage record: one event per JSON-RPC message the HTTP transport handled,
// plus one per request it turned away, sent to the site's mcpUsage service
// (www/api/mcp-usage.inc.php), which stores them in mcp_event. The queries that
// read them are in docs/mcp-usage.md.
//
// Metadata only - see the Trace typedef in protocol.js. Events are queued and
// sent in batches, fire-and-forget: a lost batch costs a few rows of statistics,
// never a call, and nothing here ever delays an answer to a client.
//
// Off unless both PFG_MCP_EVENTS_URL and PFG_MCP_EVENTS_TOKEN are set, so a
// local `make mcp`, the stdio mode and the tests record nothing.

const http = require('node:http');
const https = require('node:https');

/** Events held at most; past this the oldest are dropped. */
const MAX_QUEUE = 1000;
/** Events per request to the service - the service accepts no more. */
const MAX_BATCH = 100;

/**
 * @typedef {object} UsageEvent
 * @property {number} ts epoch milliseconds
 * @property {string|null} host
 * @property {string|null} sessionId
 * @property {string|null} method
 * @property {string|null} tool
 * @property {'ok'|'invalid'|'tool_error'|'internal'|'rejected'} outcome
 * @property {number} status the HTTP status of the answer
 * @property {number|null} durationMs
 * @property {number} bodyBytes
 * @property {string|null} clientName
 * @property {string|null} clientVersion
 * @property {string|null} userAgent
 * @property {string|null} universe
 * @property {string[]} errorPaths
 * @property {string[]} argKeys
 * @property {boolean} internal
 */

/**
 * @typedef {object} UsageRecorder
 * @property {(event: UsageEvent) => void} record
 * @property {() => Promise<void>} flush sends what is queued
 */

/**
 * @typedef {object} UsageOptions
 * @property {string} [url] the site's ajax.php, e.g. https://proxyforgame.com/ajax.php
 * @property {string} [token] PFG_MCP_EVENTS_TOKEN, shared with the service
 * @property {string} [connectAddress] connect here instead of resolving the
 *   URL's host - 127.0.0.1 on the site's own machine, so the service sees a
 *   loopback address. TLS is still checked against the URL's host name.
 * @property {number} [flushMs] how long an event may wait in the queue
 * @property {(line: string) => void} [log]
 * @property {(body: string) => Promise<number>} [send] replaces the HTTP post
 *   (tests); resolves to the answer's status
 */

/** @type {UsageRecorder} */
const DISABLED = { record() {}, flush: async () => {} };

/**
 * @param {UsageOptions} options
 * @returns {UsageRecorder}
 */
function createUsageRecorder(options) {
    const { url, token } = options;
    if (!url || !token) {
        return DISABLED;
    }
    const auth = token;
    const log = options.log ?? (() => {});
    const send = options.send ?? ((body) => post(new URL(url), options.connectAddress, body));
    const flushMs = options.flushMs ?? 10_000;

    /** @type {UsageEvent[]} */
    let queue = [];
    /** @type {NodeJS.Timeout|null} */
    let timer = null;
    // A service that is down fails every batch; say so once, not every ten seconds.
    let failing = false;

    async function flush() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        while (queue.length > 0) {
            const batch = queue.slice(0, MAX_BATCH);
            queue = queue.slice(MAX_BATCH);
            const body = new URLSearchParams({ service: 'mcpUsage', token: auth, events: JSON.stringify(batch) }).toString();
            try {
                const status = await send(body);
                if (status !== 200) {
                    throw new Error(`HTTP ${status}`);
                }
                if (failing) {
                    log('usage: the service takes events again');
                    failing = false;
                }
            } catch (error) {
                if (!failing) {
                    log(`usage: could not send ${batch.length} event(s): ${error instanceof Error ? error.message : String(error)}`);
                    failing = true;
                }
            }
        }
    }

    return {
        record(event) {
            queue.push(event);
            if (queue.length > MAX_QUEUE) {
                queue = queue.slice(-MAX_QUEUE);
            }
            if (queue.length >= MAX_BATCH) {
                void flush();
            } else if (!timer) {
                timer = setTimeout(() => void flush(), flushMs);
                // A pending batch must not keep a stopping process alive.
                timer.unref();
            }
        },
        flush,
    };
}

/**
 * One form POST; resolves to the status, rejects on a network error.
 * @param {URL} url
 * @param {string|undefined} connectAddress
 * @param {string} body
 * @returns {Promise<number>}
 */
function post(url, connectAddress, body) {
    const secure = url.protocol === 'https:';
    const transport = secure ? https : http;
    return new Promise((resolve, reject) => {
        const req = transport.request({
            protocol: url.protocol,
            host: connectAddress || url.hostname,
            port: url.port || (secure ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            // SNI and the certificate check go by the site's name, whatever
            // address the socket goes to.
            servername: secure ? url.hostname : undefined,
            headers: {
                Host: url.host,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'pfg-mcp-usage',
            },
            timeout: 5000,
        }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
        });
        req.on('timeout', () => req.destroy(new Error('timed out')));
        req.on('error', reject);
        req.end(body);
    });
}

module.exports = { createUsageRecorder, MAX_BATCH };
