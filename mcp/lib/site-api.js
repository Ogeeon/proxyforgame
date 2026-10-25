'use strict';

// Universe data, read through the site's own ajax.php - the same two services
// the flight calculator's country/universe picker calls (docs/universe-data.md).
// Going through the site rather than to Gameforge directly keeps one place
// that validates the country, and gives the MCP server the populated-systems
// table without a database connection of its own.

const { ToolError } = require('./protocol');

const TIMEOUT_MS = 10_000;
const SERVER_DATA_TTL_MS = 10 * 60 * 1000;
// The populated-systems table is refilled once a day; the page caches it for 24h.
const POPULATED_TTL_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 200;

/**
 * @typedef {object} UniverseRef
 * @property {string} country two or three letters, as in s<universe>-<country>.ogame.gameforge.com
 * @property {number} universe
 */

/**
 * The part of fetch() this module uses, so a test can stand in for it.
 * @typedef {(url: string, init: {signal: AbortSignal}) =>
 *   Promise<{ok: boolean, status: number, json: () => Promise<any>}>} Fetch
 */

/**
 * @param {object} options
 * @param {string} options.baseUrl the site, e.g. https://proxyforgame.com
 * @param {Fetch} [options.fetch]
 * @param {() => number} [options.now]
 */
function createSiteApi({ baseUrl, fetch: fetchImpl = fetch, now = Date.now }) {
    /** @type {Map<string, {expires: number, value: any}>} */
    const cache = new Map();

    /**
     * GETs one ajax.php service. Resolves to the JSON body, or to null for a 404
     * - "this universe has no populated-systems row" is an answer, not a failure.
     * @param {string} service
     * @param {UniverseRef} ref
     * @param {number} ttl
     */
    async function get(service, ref, ttl) {
        const url = new URL('ajax.php', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
        url.searchParams.set('service', service);
        url.searchParams.set('country', ref.country);
        url.searchParams.set('universe', String(ref.universe));
        const key = url.toString();

        const hit = cache.get(key);
        if (hit && hit.expires > now()) {
            return hit.value;
        }

        let response;
        try {
            response = await fetchImpl(key, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        } catch {
            throw new ToolError(`Could not reach ${url.origin} for the ${ref.country}-${ref.universe} universe data. `
                + 'Pass the universe settings explicitly instead.');
        }
        /** @type {any} */
        let value = null;
        if (response.ok) {
            value = await response.json();
        } else if (response.status === 400) {
            throw new ToolError(`Unknown universe: ${ref.country}-${ref.universe}.`);
        } else if (response.status !== 404) {
            throw new ToolError(`The universe data for ${ref.country}-${ref.universe} is unavailable `
                + `(HTTP ${response.status}). Pass the universe settings explicitly instead.`);
        }

        if (cache.size >= CACHE_LIMIT) {
            cache.clear();
        }
        cache.set(key, { expires: now() + ttl, value });
        return value;
    }

    return {
        /**
         * The universe's live serverData, as ajax.php?service=serverdata returns it.
         * @param {UniverseRef} ref
         */
        async serverData(ref) {
            const data = await get('serverdata', ref, SERVER_DATA_TTL_MS);
            if (data === null) {
                throw new ToolError(`Unknown universe: ${ref.country}-${ref.universe}.`);
            }
            return data;
        },

        /**
         * Which systems hold players, or null when the site has no row for the universe.
         * @param {UniverseRef} ref
         */
        populatedSystems(ref) {
            return get('populatedSystems', ref, POPULATED_TTL_MS);
        },
    };
}

module.exports = { createSiteApi };
