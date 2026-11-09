'use strict';

// The Model Context Protocol, server side, as plain JSON-RPC 2.0 - no SDK.
//
// The server is stateless and offers tools only, which keeps the protocol to
// five methods: initialize, ping, tools/list, tools/call and the notifications
// a client sends without expecting an answer. Everything transport-shaped
// (HTTP status codes, headers, stdio framing) is the caller's; this module
// takes one parsed message and returns the response object, or null for a
// notification.
//
// Spec: https://modelcontextprotocol.io/specification - the versions this
// server speaks are listed in SUPPORTED_VERSIONS, newest first.

const { validate } = require('./schema');

/** Newest first: a client asking for a version we do not know gets the first. */
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

// JSON-RPC error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/**
 * A failure the caller of a tool caused and can fix - a coordinate out of
 * range, a research the lab cannot start. Reported to the model as a tool
 * result with isError set, which it reads and can act on, rather than as a
 * protocol error, which most clients surface as "the tool is broken".
 */
class ToolError extends Error {}

/**
 * @typedef {object} Tool
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {import('./schema').JsonSchema} inputSchema
 * @property {boolean} [openWorld] true when the tool may read data from outside
 *   the server - a universe's live settings, say
 * @property {(args: any) => unknown | Promise<unknown>} run
 */

/**
 * @typedef {object} ServerInfo
 * @property {string} name
 * @property {string} title
 * @property {string} version
 * @property {string} instructions
 */

/**
 * @typedef {{jsonrpc: '2.0', id: string|number|null, result?: unknown,
 *            error?: {code: number, message: string, data?: unknown}}} JsonRpcResponse
 */

/**
 * What handle() learned about one message, for the usage record
 * (lib/usage.js). Metadata only: the names of the arguments a call passed and
 * the schema paths that failed, never a value.
 * @typedef {object} Trace
 * @property {string|null} [method]
 * @property {string|null} [tool]
 * @property {'ok'|'invalid'|'tool_error'|'internal'} [outcome]
 * @property {string|null} [clientName] clientInfo of an initialize
 * @property {string|null} [clientVersion]
 * @property {string|null} [universe] e.g. "en-1", when a call named one
 * @property {string[]} [argKeys]
 * @property {string[]} [errorPaths]
 */

/**
 * @param {string|number|null} id
 * @param {number} code
 * @param {string} message
 * @returns {JsonRpcResponse}
 */
function errorResponse(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * @param {string|number|null} id
 * @param {unknown} result
 * @returns {JsonRpcResponse}
 */
function resultResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
}

/**
 * The text a tool result carries next to its structured content. Clients that
 * predate structuredContent read only this, so it is the whole result, as JSON.
 * @param {unknown} result
 */
function toolResult(result) {
    return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: false,
    };
}

/** @param {string} message */
function toolFailure(message) {
    return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * A universe argument as "en-1", or null when the call named none or named it
 * in a shape the schema will refuse anyway.
 * @param {unknown} universe
 */
function universeLabel(universe) {
    if (typeof universe !== 'object' || universe === null) {
        return null;
    }
    const { country, number } = /** @type {Record<string, unknown>} */ (universe);
    const code = typeof country === 'string' ? country.toLowerCase() : '';
    const n = typeof number === 'number' ? number : Number.NaN;
    if (!/^[a-z]{2,3}$/.test(code) || !Number.isInteger(n) || n < 1 || n > 9999) {
        return null;
    }
    return `${code}-${n}`;
}

/**
 * The schema paths behind validation errors, without their values: every
 * message from lib/schema.js starts with the path ("arguments.x.y must be ...").
 * Array indexes collapse to [] so that the same mistake groups together.
 * @param {string[]} errors
 */
function errorPaths(errors) {
    const paths = errors.map((error) => error.split(' ', 1)[0]
        .replace(/^arguments\.?/, '')
        .replaceAll(/\[\d+\]/g, '[]')
        .replaceAll(/[^\w.[\]-]/g, '')
        || '(arguments)');
    return [...new Set(paths)];
}

/**
 * A client-supplied string as the usage record keeps it - a clientInfo field,
 * a header: printable ASCII, trimmed and cut short; null when nothing is left.
 * @param {unknown} value
 * @param {number} max
 */
function printable(value, max) {
    if (typeof value !== 'string') {
        return null;
    }
    const clean = value.replaceAll(/[^\x20-\x7e]/g, '').trim().slice(0, max);
    return clean === '' ? null : clean;
}

/**
 * @param {Tool[]} tools
 * @param {ServerInfo} info
 * @param {{log?: (line: string) => void}} [options]
 */
function createProtocol(tools, info, options = {}) {
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const log = options.log ?? (() => {});

    const toolList = tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        // Every tool here is a calculation: nothing is written anywhere and a
        // repeated call changes nothing. Some may read a universe's settings
        // from the site's own read-only API, and say so.
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: tool.openWorld === true,
        },
    }));

    /**
     * @param {any} params
     */
    function initialize(params) {
        const requested = params?.protocolVersion;
        const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0];
        return {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: info.name, title: info.title, version: info.version },
            instructions: info.instructions,
        };
    }

    /**
     * @param {any} params
     * @param {string|number|null} id
     * @param {Trace} trace
     * @returns {Promise<JsonRpcResponse>}
     */
    async function callTool(params, id, trace) {
        const name = params?.name;
        const tool = typeof name === 'string' ? byName.get(name) : undefined;
        if (!tool) {
            trace.outcome = 'invalid';
            return errorResponse(id, INVALID_PARAMS, `Unknown tool: ${String(name)}`);
        }
        trace.tool = tool.name;
        const args = params.arguments ?? {};
        if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
            trace.argKeys = Object.keys(args);
            trace.universe = universeLabel(args.universe);
        }
        const { value, errors } = validate(tool.inputSchema, args);
        if (errors.length > 0) {
            trace.outcome = 'invalid';
            trace.errorPaths = errorPaths(errors);
            return resultResponse(id, toolFailure(`Invalid arguments:\n- ${errors.join('\n- ')}`));
        }
        try {
            return resultResponse(id, toolResult(await tool.run(value)));
        } catch (error) {
            if (error instanceof ToolError) {
                trace.outcome = 'tool_error';
                return resultResponse(id, toolFailure(error.message));
            }
            trace.outcome = 'internal';
            log(`tool ${tool.name} failed: ${error instanceof Error ? error.stack : String(error)}`);
            return errorResponse(id, INTERNAL_ERROR, 'Internal error');
        }
    }

    /**
     * Handles one JSON-RPC message.
     * @param {unknown} message the parsed message
     * @param {Trace} [trace] filled in with what the message was and how it
     *   ended, for a caller that records usage
     * @returns {Promise<JsonRpcResponse|null>} null for a notification or a response
     */
    async function handle(message, trace = {}) {
        trace.outcome = 'ok';
        if (typeof message !== 'object' || message === null || Array.isArray(message)) {
            trace.outcome = 'invalid';
            return errorResponse(null, INVALID_REQUEST, 'Expected a JSON-RPC message object');
        }
        const msg = /** @type {Record<string, any>} */ (message);
        if (typeof msg.method === 'string') {
            trace.method = msg.method.slice(0, 32);
        }
        if (msg.jsonrpc !== '2.0') {
            trace.outcome = 'invalid';
            return errorResponse(msg.id ?? null, INVALID_REQUEST, 'jsonrpc must be "2.0"');
        }
        const isRequest = 'id' in msg && msg.id !== null;
        if (typeof msg.method !== 'string') {
            // A response to something we never ask, or garbage. Neither gets an answer.
            const garbage = isRequest && !('result' in msg || 'error' in msg);
            trace.outcome = garbage ? 'invalid' : 'ok';
            return garbage ? errorResponse(msg.id, INVALID_REQUEST, 'method is missing') : null;
        }
        if (!isRequest) {
            // notifications/initialized, notifications/cancelled and the like.
            // Every call finishes before its response is sent, so there is
            // nothing a cancellation could still stop.
            return null;
        }
        switch (msg.method) {
            case 'initialize':
                trace.clientName = printable(msg.params?.clientInfo?.name, 64);
                trace.clientVersion = printable(msg.params?.clientInfo?.version, 32);
                return resultResponse(msg.id, initialize(msg.params));
            case 'ping':
                return resultResponse(msg.id, {});
            case 'tools/list':
                return resultResponse(msg.id, { tools: toolList });
            case 'tools/call':
                return callTool(msg.params, msg.id, trace);
            default:
                trace.outcome = 'invalid';
                return errorResponse(msg.id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
        }
    }

    return { handle };
}

module.exports = {
    createProtocol,
    ToolError,
    errorResponse,
    printable,
    SUPPORTED_VERSIONS,
    PARSE_ERROR,
    INVALID_REQUEST,
};
