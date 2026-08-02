// ============================================================================
// API CLIENT - the one way this site talks to its backend
// ============================================================================
// Every request goes to /ajax.php and names a service. A 2xx answer is the
// resource itself, with no envelope to unwrap; anything else arrives here as an
// ApiError carrying the stable `code` the server chose.
//
// A dropped connection, a 500 and an unreadable body all become that same
// ApiError, so a caller writes one catch instead of three branches - and cannot
// accidentally ignore a failure, which is how the changelog used to swallow
// every error it got.

'use strict';

const API_ENDPOINT = '/ajax.php';

/**
 * A request that did not come back with the resource.
 */
class ApiError extends Error {
    /**
     * @param {number} status - HTTP status, or 0 when the request never landed
     * @param {string} code - stable machine-readable name; keys the locale strings
     * @param {string} message - English prose for the console, never shown to a user
     */
    constructor(status, code, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

/**
 * Turns the service name plus its parameters into a form body / query string.
 * @param {string} service
 * @param {Record<string, string|number>} [params]
 * @returns {URLSearchParams}
 */
function buildApiParams(service, params) {
    const search = new URLSearchParams();
    search.append('service', service);
    for (const [name, value] of Object.entries(params || {})) {
        search.append(name, String(value));
    }
    return search;
}

/**
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function readApiResponse(response) {
    let body = null;
    try {
        body = await response.json();
    } catch {
        // An empty or non-JSON body is only fatal when it was supposed to carry
        // the resource; on an error status the status itself still tells us
        // enough to build the ApiError below.
        if (response.ok) {
            throw new ApiError(response.status, 'bad_response', 'The answer is not JSON');
        }
    }

    if (response.ok) {
        return body;
    }

    const error = body && body.error ? body.error : null;
    throw new ApiError(
        response.status,
        error && error.code ? error.code : `http_${response.status}`,
        error && error.message ? error.message : `Request failed with status ${response.status}`
    );
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
async function requestApi(url, init) {
    let response;
    try {
        response = await fetch(url, init);
    } catch (e) {
        throw new ApiError(0, 'network_error', e instanceof Error ? e.message : String(e));
    }
    return readApiResponse(response);
}

/**
 * Reads a resource. Throws ApiError on anything but success.
 * @param {string} service
 * @param {Record<string, string|number>} [params]
 * @returns {Promise<any>}
 */
async function apiGet(service, params) {
    return requestApi(`${API_ENDPOINT}?${buildApiParams(service, params).toString()}`);
}

/**
 * Performs an action with a side effect. Throws ApiError on anything but success.
 * @param {string} service
 * @param {Record<string, string|number>} [params]
 * @returns {Promise<any>}
 */
async function apiPost(service, params) {
    return requestApi(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildApiParams(service, params).toString(),
    });
}
