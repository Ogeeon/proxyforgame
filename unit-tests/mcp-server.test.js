'use strict';

// The MCP server in mcp/: the protocol layer, its HTTP transport, the input
// validator and the two tools. The tools compute with the calculators' own
// *-core.js files, so the numbers here are checked against those files called
// directly - what this suite guards is the mapping from tool arguments to the
// calculators' parameters, not the formulas (those have their own tests).

const http = require('node:http');
const { describe, it, before, after } = require('node:test');
const { expect } = require('./expect');
const { load } = require('./load');

const { createProtocol, SUPPORTED_VERSIONS } = require('../mcp/lib/protocol');
const { createHttpHandler, clientAddress } = require('../mcp/lib/http-transport');
const { createSiteApi } = require('../mcp/lib/site-api');
const { validate } = require('../mcp/lib/schema');
const { formatDuration } = require('../mcp/lib/format');
const { createTools } = require('../mcp/tools');

const { FlightCalculator } = load(['ogame/calc/js/flight-core.js'], ['FlightCalculator']);

/**
 * A stand-in for the site's ajax.php: serverdata and populatedSystems answers
 * keyed by "country-universe".
 * @param {Record<string, any>} serverData
 * @param {Record<string, any>} [population]
 */
function fakeSiteApi(serverData, population = {}) {
    const calls = [];
    return {
        calls,
        async serverData(ref) {
            calls.push(['serverdata', ref]);
            return serverData[`${ref.country}-${ref.universe}`];
        },
        async populatedSystems(ref) {
            calls.push(['populatedSystems', ref]);
            return population[`${ref.country}-${ref.universe}`] ?? null;
        },
    };
}

const INFO = { name: 'proxyforgame', title: 'test', version: '0.0.0', instructions: 'test' };

function protocolWith(siteApi = fakeSiteApi({})) {
    return createProtocol(createTools({ siteApi }), INFO);
}

/**
 * Hands one message to the protocol. Typed loosely on purpose: the tests read
 * whichever of result and error the case at hand produces.
 * @returns {Promise<any>}
 */
function rpc(protocol, message) {
    return protocol.handle(message);
}

/** Calls a tool through the protocol and returns the tool result. */
async function call(protocol, name, args) {
    const answer = await rpc(protocol, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    return answer.result;
}

describe('MCP protocol', () => {
    const protocol = protocolWith();

    it('answers initialize with the version the client asked for when it is supported', async () => {
        const answer = await rpc(protocol, {
            jsonrpc: '2.0', id: 1, method: 'initialize',
            params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } },
        });
        expect(answer.result.protocolVersion).toBe('2025-03-26');
        expect(answer.result.capabilities).toEqual({ tools: { listChanged: false } });
        expect(answer.result.serverInfo.name).toBe('proxyforgame');
    });

    it('offers its newest version to a client asking for one it does not know', async () => {
        const answer = await rpc(protocol, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
        expect(answer.result.protocolVersion).toBe(SUPPORTED_VERSIONS[0]);
    });

    it('does not answer a notification', async () => {
        expect(await rpc(protocol, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    });

    it('answers ping with an empty result', async () => {
        expect((await rpc(protocol, { jsonrpc: '2.0', id: 'p', method: 'ping' })).result).toEqual({});
    });

    it('reports an unknown method as -32601', async () => {
        const answer = await rpc(protocol, { jsonrpc: '2.0', id: 2, method: 'resources/list' });
        expect(answer.error.code).toBe(-32601);
    });

    it('refuses something that is not a JSON-RPC 2.0 message', async () => {
        expect((await rpc(protocol, [1, 2])).error.code).toBe(-32600);
        expect((await rpc(protocol, { id: 1, method: 'ping' })).error.code).toBe(-32600);
    });

    it('lists both tools as read-only', async () => {
        const { tools } = (await rpc(protocol, { jsonrpc: '2.0', id: 3, method: 'tools/list' })).result;
        expect(tools.map((t) => t.name)).toEqual(['ogame_flight', 'ogame_build_cost']);
        for (const tool of tools) {
            expect(tool.inputSchema.type).toBe('object');
            expect(tool.annotations.readOnlyHint).toBe(true);
        }
    });

    it('reports an unknown tool as a protocol error', async () => {
        const answer = await rpc(protocol, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope' } });
        expect(answer.error.code).toBe(-32602);
    });

    it('reports bad arguments as a tool error the model can read', async () => {
        const result = await call(protocol, 'ogame_build_cost', { item: 'metal-mine', toLevel: -1, colour: 'red' });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('arguments.toLevel must be at least 0');
        expect(result.content[0].text).toContain('arguments.colour is not a known field');
    });
});

describe('MCP input validation', () => {
    const schema = {
        type: 'object',
        properties: {
            name: { type: 'string', enum: ['a', 'b'] },
            group: {
                type: 'object',
                properties: { x: { type: 'integer', default: 3 }, y: { type: 'number' } },
            },
            flag: { type: 'boolean', default: false },
        },
        required: ['name'],
        additionalProperties: false,
    };

    it('fills the defaults in, including those of a group left out', () => {
        const { value, errors } = validate(schema, { name: 'a' });
        expect(errors).toEqual([]);
        expect(value).toEqual({ name: 'a', group: { x: 3 }, flag: false });
    });

    it('keeps what was given over the defaults', () => {
        expect(validate(schema, { name: 'b', group: { x: 7, y: 1.5 }, flag: true }).value)
            .toEqual({ name: 'b', group: { x: 7, y: 1.5 }, flag: true });
    });

    it('tells an integer from a fraction', () => {
        expect(validate(schema, { name: 'a', group: { x: 1.5 } }).errors).toEqual(['arguments.group.x must be an integer, got number']);
    });

    it('names a missing required field', () => {
        expect(validate(schema, {}).errors).toEqual(['arguments.name is required']);
    });
});

describe('MCP HTTP transport', () => {
    let server;
    let base;

    before(async () => {
        const handler = createHttpHandler(protocolWith(), {
            path: '/mcp',
            allowedOrigins: ['https://proxyforgame.com'],
            rateLimit: 30,
            trustProxy: true,
            log: () => {},
        });
        server = http.createServer(handler);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
    });

    after(() => new Promise((resolve) => server.close(resolve)));

    const post = (body, headers = {}) => fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    it('answers a request with one JSON body', async () => {
        const res = await post({ jsonrpc: '2.0', id: 1, method: 'ping' });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
    });

    it('accepts a notification with 202 and no body', async () => {
        const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
        expect(res.status).toBe(202);
        expect(await res.text()).toBe('');
    });

    it('answers a batch with an array', async () => {
        const res = await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]);
        expect(await res.json()).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }]);
    });

    it('opens no SSE stream: GET is 405', async () => {
        const res = await fetch(`${base}/mcp`, { headers: { accept: 'text/event-stream' } });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('POST');
    });

    it('refuses a browser origin it does not know, and serves one it does', async () => {
        expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://evil.example' })).status).toBe(403);
        expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://proxyforgame.com' })).status).toBe(200);
    });

    it('refuses a protocol version header it does not speak', async () => {
        const res = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '1999-01-01' });
        expect(res.status).toBe(400);
    });

    it('answers a body that is not JSON with a parse error', async () => {
        const res = await post('{nope');
        expect(res.status).toBe(400);
        const body = /** @type {any} */ (await res.json());
        expect(body.error.code).toBe(-32700);
    });

    it('refuses an oversized body', async () => {
        const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', pad: 'x'.repeat(70 * 1024) }));
        expect(res.status).toBe(413);
    });

    it('answers 404 off the endpoint and serves a health check', async () => {
        expect((await fetch(`${base}/other`, { method: 'POST' })).status).toBe(404);
        expect((await fetch(`${base}/healthz`)).status).toBe(200);
    });

    it('limits requests per client address', async () => {
        const headers = { 'x-forwarded-for': '203.0.113.9' };
        const statuses = [];
        for (let i = 0; i < 31; i++) {
            statuses.push((await post({ jsonrpc: '2.0', id: i, method: 'ping' }, headers)).status);
        }
        expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
        expect(statuses[30]).toBe(429);
        // Another client is not affected.
        expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'x-forwarded-for': '203.0.113.10' })).status).toBe(200);
    });

    it('takes the client address from the hop Apache appended, and only behind loopback', () => {
        const req = (remoteAddress, forwarded) => ({ socket: { remoteAddress }, headers: { 'x-forwarded-for': forwarded } });
        expect(clientAddress(req('127.0.0.1', 'spoofed, 198.51.100.7'), true)).toBe('198.51.100.7');
        expect(clientAddress(req('198.51.100.8', '10.0.0.1'), true)).toBe('198.51.100.8');
        expect(clientAddress(req('127.0.0.1', '198.51.100.7'), false)).toBe('127.0.0.1');
    });
});

describe('MCP site API', () => {
    const response = (status, body) => ({ ok: status === 200, status, json: async () => body });

    it('caches a universe answer instead of asking twice', async () => {
        let asked = 0;
        const api = createSiteApi({
            baseUrl: 'https://example.test',
            fetch: async (url) => {
                asked++;
                expect(url).toBe('https://example.test/ajax.php?service=serverdata&country=en&universe=1');
                return response(200, { speed: '2' });
            },
        });
        await api.serverData({ country: 'en', universe: 1 });
        expect((await api.serverData({ country: 'en', universe: 1 })).speed).toBe('2');
        expect(asked).toBe(1);
    });

    it('reads a missing population row as null, not as a failure', async () => {
        const api = createSiteApi({ baseUrl: 'https://example.test', fetch: async () => response(404, {}) });
        expect(await api.populatedSystems({ country: 'en', universe: 1 })).toBeNull();
    });

    it('turns an unreachable site into a tool error the model can act on', async () => {
        const api = createSiteApi({ baseUrl: 'https://example.test', fetch: async () => { throw new TypeError('fetch failed'); } });
        const protocol = createProtocol(createTools({ siteApi: api }), INFO);
        const result = await call(protocol, 'ogame_build_cost', { item: 'metal-mine', toLevel: 1, universe: { country: 'en', number: 1 } });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Could not reach https://example.test');
    });
});

describe('MCP tool ogame_flight', () => {
    const calc = new FlightCalculator();

    it('matches the flight calculator for a fleet in the default universe', async () => {
        const result = await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 1, system: 100, position: 8 },
            to: { galaxy: 1, system: 150, position: 8 },
            ships: { 'large-cargo': 100 },
            drives: { combustion: 10 },
            speedPercent: 100,
        });
        expect(result.isError).toBe(false);
        const out = result.structuredContent;
        // 50 systems apart: 50 * 95 + 2700. A large cargo on combustion 10 flies 7500 * 2.
        expect(out.distance).toBe(7450);
        expect(out.fleetSpeed).toBe(15000);
        expect(out.flights).toHaveLength(1);
        expect(out.flights[0].durationSeconds).toBe(calc.getFlightDuration(15000, 7450, 100, 1));
        expect(out.flights[0].duration).toBe('02:10:10');
        expect(out.cargoCapacity).toBe(2500000);
        expect(out.universe.source).toBe('defaults');
    });

    it('lists every speed step: tens for most classes, fives for the general', async () => {
        const args = { from: { galaxy: 1, system: 1, position: 1 }, to: { galaxy: 2, system: 1, position: 1 }, ships: { 'small-cargo': 1 } };
        const plain = (await call(protocolWith(), 'ogame_flight', args)).structuredContent;
        expect(plain.flights.map((f) => f.speedPercent)).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
        const general = (await call(protocolWith(), 'ogame_flight', { ...args, playerClass: 'general' })).structuredContent;
        expect(general.flights).toHaveLength(20);
        expect(general.flights[1].speedPercent).toBe(95);
    });

    it('refuses a 5% step outside the general class', async () => {
        const result = await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 1, system: 1, position: 1 }, to: { galaxy: 1, system: 1, position: 2 },
            ships: { cruiser: 1 }, speedPercent: 55,
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('only the General class');
    });

    it('refuses an empty fleet', async () => {
        const result = await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 1, system: 1, position: 1 }, to: { galaxy: 1, system: 1, position: 2 }, ships: { cruiser: 0 },
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('The fleet is empty');
    });

    it('flies moon destruction at the fixed 310 whatever the fleet', async () => {
        const out = (await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 1, system: 1, position: 1 }, to: { galaxy: 1, system: 2, position: 1 },
            ships: { 'death-star': 1, 'light-fighter': 10 }, mission: 'destroy', speedPercent: 100,
        })).structuredContent;
        expect(out.fleetSpeed).toBe(310);
        expect(out.universe.fleetSpeedFactor).toBe(1);
    });

    it('reads a live universe, skips its empty systems and lets a manual setting win', async () => {
        const site = fakeSiteApi({
            'en-152': {
                speed: '8', speedFleetPeaceful: '4', speedFleetWar: '2', speedFleetHolding: '1',
                galaxies: '6', systems: '499', donutGalaxy: '1', donutSystem: '1',
                globalDeuteriumSaveFactor: '0.7', warriorBonusFuelConsumption: '0.5', probeCargo: '5',
                fleetIgnoreEmptySystems: '1', fleetIgnoreInactiveSystems: '0',
            },
        }, {
            // Galaxy 1 has players in systems 10, 12 and 20 only (and in nothing else).
            'en-152': { populatedSystems: { 1: [10, 12, 20] }, populatedSystemsAll: { 1: [10, 12, 20] } },
        });
        const out = (await call(protocolWith(site), 'ogame_flight', {
            universe: { country: 'EN', number: 152 },
            universeSettings: { fleetSpeedPeaceful: 3 },
            from: { galaxy: 1, system: 10, position: 4 },
            to: { galaxy: 1, system: 20, position: 4 },
            ships: { 'small-cargo': 1 },
            speedPercent: 100,
        })).structuredContent;
        // Systems 11, 13-19 are empty: 8 of the 9 in between are skipped.
        expect(out.skippedSystems).toBe(8);
        expect(out.distance).toBe((10 - 8) * 95 + 2700);
        expect(out.universe.fleetSpeedFactor).toBe(3);
        expect(out.universe.source).toBe('en-152, with overrides');
        expect(out.universe.circularGalaxies).toBe(true);
        expect(out.universe.deuteriumFactor).toBe(0.7);
        expect(site.calls.map(([service]) => service)).toEqual(['serverdata', 'populatedSystems']);
    });

    it('says so when the universe skips systems but no population data exists', async () => {
        const site = fakeSiteApi({ 'de-1': { galaxies: '9', systems: '499', fleetIgnoreEmptySystems: '1' } });
        const out = (await call(protocolWith(site), 'ogame_flight', {
            universe: { country: 'de', number: 1 },
            from: { galaxy: 1, system: 10, position: 4 }, to: { galaxy: 1, system: 20, position: 4 },
            ships: { 'small-cargo': 1 }, speedPercent: 100,
        })).structuredContent;
        expect(out.skippedSystems).toBe(0);
        expect(out.note).toContain('no population data');
    });

    it('refuses a coordinate past the edge of the universe', async () => {
        const result = await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 10, system: 1, position: 1 }, to: { galaxy: 1, system: 1, position: 1 }, ships: { cruiser: 1 },
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('past the last galaxy (9)');
    });
});

describe('MCP tool ogame_build_cost', () => {
    it('sums every level of a building and times it', async () => {
        const out = (await call(protocolWith(), 'ogame_build_cost', {
            item: 'metal-mine', fromLevel: 30, toLevel: 31,
            facilities: { roboticsFactory: 10, naniteFactory: 5 }, universeSpeed: 5,
        })).structuredContent;
        // 60 * 1.5^30 and 15 * 1.5^30, floored.
        expect(out.metal).toBe(11505063);
        expect(out.crystal).toBe(2876265);
        expect(out.deuterium).toBe(0);
        expect(out.durationSeconds).toBe(11766);
        expect(out.points).toBe(14381);
        expect(out.item).toEqual({ key: 'metal-mine', name: 'Metal mine', kind: 'building' });
    });

    it('prices a research range the way the costs page does', async () => {
        // The same range costs-core.test.js checks against the game: 82202 / 164406 / 82202.
        const out = (await call(protocolWith(), 'ogame_build_cost', {
            item: 'astrophysics', toLevel: 5, facilities: { researchLab: 3 },
        })).structuredContent;
        expect([out.metal, out.crystal, out.deuterium]).toEqual([82202, 164406, 82202]);
        expect(out.item.kind).toBe('research');
    });

    it('names the Research Lab level a research needs', async () => {
        const result = await call(protocolWith(), 'ogame_build_cost', { item: 'graviton', toLevel: 1, facilities: { researchLab: 5 } });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Research Lab of level 12');
    });

    it('multiplies a ship by its quantity', async () => {
        const out = (await call(protocolWith(), 'ogame_build_cost', {
            item: 'large-cargo', quantity: 10, facilities: { shipyard: 2 },
        })).structuredContent;
        expect([out.metal, out.crystal, out.deuterium]).toEqual([60000, 60000, 0]);
        expect(out.quantity).toBe(10);
        expect(out.darkMatterToHalve).toBe(undefined);
    });

    it('asks for a quantity for a ship and for levels for a building', async () => {
        expect((await call(protocolWith(), 'ogame_build_cost', { item: 'cruiser', toLevel: 3 })).content[0].text).toContain('give quantity');
        expect((await call(protocolWith(), 'ogame_build_cost', { item: 'shipyard', quantity: 3 })).content[0].text).toContain('give toLevel');
    });

    it('keeps moon buildings on the moon and planet buildings off it', async () => {
        const phalanx = (await call(protocolWith(), 'ogame_build_cost', { item: 'sensor-phalanx', toLevel: 1 })).structuredContent;
        expect(phalanx.location).toBe('moon');
        const mine = await call(protocolWith(), 'ogame_build_cost', { item: 'metal-mine', toLevel: 1, onMoon: true });
        expect(mine.isError).toBe(true);
    });

    it('refuses to demolish the terraformer', async () => {
        const result = await call(protocolWith(), 'ogame_build_cost', { item: 'terraformer', fromLevel: 3, toLevel: 2 });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('cannot be demolished');
    });

    it('takes the research speed from a live universe', async () => {
        const site = fakeSiteApi({ 'en-1': { speed: '5', researchDurationDivisor: '2' } });
        const out = (await call(protocolWith(site), 'ogame_build_cost', {
            item: 'astrophysics', toLevel: 1, facilities: { researchLab: 3 }, universe: { country: 'en', number: 1 },
        })).structuredContent;
        expect(out.speeds).toEqual({ universeSpeed: 5, researchSpeed: 10 });
    });
});

describe('MCP duration format', () => {
    it('prints a day count only when there is one', () => {
        expect(formatDuration(59)).toBe('00:00:59');
        expect(formatDuration(3723)).toBe('01:02:03');
        expect(formatDuration(90061)).toBe('1d 01:01:01');
    });
});
