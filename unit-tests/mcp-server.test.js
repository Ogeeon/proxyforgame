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
const { readWwwJson } = require('../mcp/lib/browser-scripts');
const { createTools } = require('../mcp/tools');

const { FlightCalculator } = load(['ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/flight-core.js'], ['FlightCalculator']);

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

    it('lists every tool as read-only', async () => {
        const { tools } = (await rpc(protocol, { jsonrpc: '2.0', id: 3, method: 'tools/list' })).result;
        expect(tools.map((t) => t.name)).toEqual([
            'ogame_import_account', 'ogame_flight', 'ogame_build_cost', 'ogame_lifeform_cost', 'ogame_build_queue', 'ogame_production',
            'ogame_expedition', 'ogame_moon_destruction', 'ogame_moon_creation', 'ogame_phalanx',
            'ogame_graviton', 'ogame_terraformer', 'ogame_trade',
        ]);
        for (const tool of tools) {
            expect(tool.inputSchema.type).toBe('object');
            expect(tool.annotations.readOnlyHint).toBe(true);
        }
    });

    it('keeps tools/list within its size budget', async () => {
        // Every client loads the tool list into its model's context (mcp/README.md). Going over
        // the budget is a deliberate decision that raises it here, in the same commit.
        // 52 KB until ogame_import_account added its 1.5 KB.
        const BUDGET = 54 * 1024;
        const { tools } = (await rpc(protocol, { jsonrpc: '2.0', id: 3, method: 'tools/list' })).result;
        const size = tools.reduce((sum, { name, title, description, inputSchema }) =>
            sum + JSON.stringify({ name, title, description, inputSchema }).length, 0);
        expect(size).toBeLessThanOrEqual(BUDGET);
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
        const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', pad: 'x'.repeat(260 * 1024) }));
        expect(res.status).toBe(413);
    });

    it('takes a body the size of a big account export passed as a string', async () => {
        const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', pad: 'x'.repeat(120 * 1024) }));
        expect(res.status).toBe(200);
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

    it('times research by facilities.researchLab alone, with no research network', async () => {
        const seconds = async (lab) => (await call(protocolWith(), 'ogame_build_cost', {
            item: 'astrophysics', fromLevel: 4, toLevel: 5, facilities: { researchLab: lab },
        })).structuredContent.durationSeconds;
        // Astrophysics 5 costs 37515 metal and 75031 crystal; research takes
        // (metal + crystal) / (1000 * (1 + lab)) hours, with the lab as entered.
        expect(await seconds(3)).toBe(Math.round((37515 + 75031) / 4000 * 3600));
        expect(await seconds(9)).toBe(Math.round((37515 + 75031) / 10000 * 3600));
    });

    it('makes research 25% faster with officers.technocrat', async () => {
        const seconds = async (officers) => (await call(protocolWith(), 'ogame_build_cost', {
            item: 'astrophysics', fromLevel: 4, toLevel: 5, facilities: { researchLab: 3 }, officers,
        })).structuredContent.durationSeconds;
        expect(await seconds({ technocrat: true })).toBe(Math.round((37515 + 75031) / 4000 * 3600 * 0.75));
        expect(await seconds({ engineer: true })).toBe(await seconds({}));
    });

    it('caps the research levels at 50, as every tool does', async () => {
        const result = await call(protocolWith(), 'ogame_build_cost', {
            item: 'metal-mine', toLevel: 1, hyperspaceTechnology: 51, ionTechnology: 51,
        });
        expect(result.content[0].text).toContain('arguments.hyperspaceTechnology must be at most 50');
        expect(result.content[0].text).toContain('arguments.ionTechnology must be at most 50');
    });

    it('takes the life form reductions for the item asked about', async () => {
        const out = async (lifeforms) => (await call(protocolWith(), 'ogame_build_cost', {
            item: 'astrophysics', fromLevel: 4, toLevel: 5, facilities: { researchLab: 3 }, lifeforms,
        })).structuredContent;
        const plain = await out({});
        const reduced = await out({ itemCostReduction: 10, itemTimeReduction: 20 });
        expect(reduced.metal).toBe(Math.floor(plain.metal * 0.9));
        expect(reduced.durationSeconds).toBeLessThan(plain.durationSeconds);
    });

    it('refuses a research when the lab is 0, rather than making one up', async () => {
        const result = await call(protocolWith(), 'ogame_build_cost', { item: 'astrophysics', toLevel: 1, facilities: { researchLab: 0 } });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('facilities.researchLab is 0');
    });

    it('multiplies a ship by its quantity', async () => {
        const out = (await call(protocolWith(), 'ogame_build_cost', {
            item: 'large-cargo', quantity: 10, facilities: { shipyard: 2 },
        })).structuredContent;
        expect([out.metal, out.crystal, out.deuterium]).toEqual([60000, 60000, 0]);
        expect(out.quantity).toBe(10);
        expect(out.darkMatterToHalve).toBe(undefined);
    });

    it('raises a Collector\'s transport holds by lifeforms.collectorClassBonus', async () => {
        const ships = async (playerClass, collectorClassBonus) => (await call(protocolWith(), 'ogame_build_cost', {
            item: 'large-cargo', quantity: 1000, playerClass, lifeforms: { collectorClassBonus },
        })).structuredContent.cargoShipsNeeded;
        // 12,000,000 resources; the Collector's +25% hold, +100% of it with the enhancement at 100.
        expect(await ships('collector', 0)).toEqual({ smallCargo: 1920, largeCargo: 384 });
        expect(await ships('collector', 100)).toEqual({ smallCargo: 1600, largeCargo: 320 });
        // The enhancement raises the Collector's bonus only.
        expect(await ships('general', 100)).toEqual({ smallCargo: 2400, largeCargo: 480 });
    });

    it('raises the transport holds by their own life form cargo bonus', async () => {
        const out = (await call(protocolWith(), 'ogame_build_cost', {
            item: 'large-cargo', quantity: 1000, playerClass: 'general',
            lifeforms: { shipBonuses: { 'small-cargo': { cargo: 50 }, 'large-cargo': { cargo: 20 } } },
        })).structuredContent;
        // 12,000,000 resources in holds of 7500 and 30000.
        expect(out.cargoShipsNeeded).toEqual({ smallCargo: 1600, largeCargo: 400 });
    });

    it('prices the crawler, the reaper and the pathfinder', async () => {
        const price = async (item) => {
            const out = (await call(protocolWith(), 'ogame_build_cost', { item, quantity: 1, facilities: { shipyard: 2 } })).structuredContent;
            return [out.metal, out.crystal, out.deuterium];
        };
        expect(await price('crawler')).toEqual([2000, 2000, 1000]);
        expect(await price('reaper')).toEqual([85000, 55000, 20000]);
        expect(await price('pathfinder')).toEqual([8000, 15000, 8000]);
    });

    it('asks for a quantity for a ship and for levels for a building', async () => {
        expect((await call(protocolWith(), 'ogame_build_cost', { item: 'cruiser', toLevel: 3 })).content[0].text).toContain('give quantity');
        expect((await call(protocolWith(), 'ogame_build_cost', { item: 'shipyard', quantity: 3 })).content[0].text).toContain('give toLevel');
    });

    it('keeps moon buildings on the moon and planet buildings off it', async () => {
        const phalanx = (await call(protocolWith(), 'ogame_build_cost', { item: 'sensor-phalanx', toLevel: 1 })).structuredContent;
        expect(phalanx.location).toBe('moon');
        const mine = await call(protocolWith(), 'ogame_build_cost', { item: 'metal-mine', toLevel: 1, location: 'moon' });
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

describe('MCP input validation of keyed maps', () => {
    const schema = {
        type: 'object',
        properties: {
            ships: { type: 'object', propertyNames: { enum: ['a', 'b'] }, additionalProperties: { type: 'integer', minimum: 0 } },
        },
    };

    it('checks every value against the shared schema', () => {
        expect(validate(schema, { ships: { a: 1, b: -1 } }).errors).toEqual(['arguments.ships.b must be at least 0']);
    });

    it('refuses a key outside the list', () => {
        expect(validate(schema, { ships: { c: 1 } }).errors).toEqual(['arguments.ships.c is not one of: a, b']);
    });
});

describe('MCP tool ogame_graviton', () => {
    const { GravitonCalculator } = load(['js/utils.js', 'ogame/calc/js/ogame-production.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/graviton-core.js'], ['GravitonCalculator']);

    it('maps its arguments onto the graviton calculator', async () => {
        const site = fakeSiteApi({ 'en-5': { speed: '4', debrisFactor: '0.5', deuteriumInDebris: '1' } });
        const out = (await call(protocolWith(site), 'ogame_graviton', {
            universe: { country: 'en', number: 5 },
            maxTemperature: 40, solarPlant: { level: 30 }, fusionReactor: { level: 20, percent: 80 },
            solarSatellites: { count: 100 }, energyTechnology: 20, playerClass: 'collector',
            officers: { commander: true, admiral: true, engineer: true, geologist: true, technocrat: true },
            energyBoosterPercent: 40, facilities: { shipyard: 12, naniteFactory: 5 }, crystalAvailable: 1000000,
        })).structuredContent;
        const direct = new GravitonCalculator().compute({
            shipyardLevel: 12, nanitesFactoryLevel: 5, universeSpeed: 4, energyTechLevel: 20, hyperTechLevel: 0,
            maxPlanetTemp: 40, energyBonus: 2, solarPlantLevel: 30, solarPlantPercent: 100, fusionPlantLevel: 20,
            fusionPlantPercent: 80, solarSatellitesCount: 100, solarSatellitesPercent: 100, debrisPercent: 50,
            playerClass: 1, isTrader: false, energyBoost: 4, disChLevel: 0, gravitonLevel: 1, totalLFEnrgBonus: 0,
            scCapacityIncrease: 0, lcCapacityIncrease: 0, rcCapacityIncrease: 0, crysAvailable: 1000000,
            deutAvailable: 0, deutInDebris: true,
        });
        expect(out.energyAvailable.total).toBe(direct.availableEnergy);
        expect(out.satellitesNeeded).toBe(direct.neededSats);
        expect(out.buildSeconds).toBe(direct.secsTotal);
        expect(out.ifShotDown.debris.deuterium).toBe(direct.dfDeuterium);
        expect(out.ifShotDown.debrisPercent).toBe(50);
        expect(out.universeSpeed).toBe(4);
    });

    it('reads the officers\' energy bonus off the five flags: the Engineer alone, or the whole staff', async () => {
        const planet = { maxTemperature: 40, solarPlant: { level: 30 }, energyTechnology: 20 };
        const officersBonus = async (officers) => (await call(protocolWith(), 'ogame_graviton', { ...planet, officers }))
            .structuredContent.energyAvailable.officers;
        const direct = (energyBonus) => new GravitonCalculator().compute({
            shipyardLevel: 0, nanitesFactoryLevel: 0, universeSpeed: 1, energyTechLevel: 20, hyperTechLevel: 0,
            maxPlanetTemp: 40, energyBonus, solarPlantLevel: 30, solarPlantPercent: 100, fusionPlantLevel: 0,
            fusionPlantPercent: 100, solarSatellitesCount: 0, solarSatellitesPercent: 100, debrisPercent: 30,
            playerClass: 0, isTrader: false, energyBoost: 0, disChLevel: 0, gravitonLevel: 1, totalLFEnrgBonus: 0,
            scCapacityIncrease: 0, lcCapacityIncrease: 0, rcCapacityIncrease: 0, crysAvailable: 0,
            deutAvailable: 0, deutInDebris: false,
        }).officerBonus;
        const staff = { commander: true, admiral: true, engineer: true, geologist: true, technocrat: true };
        expect(await officersBonus({})).toBe(0);
        expect(await officersBonus({ geologist: true })).toBe(0);
        expect(await officersBonus({ engineer: true })).toBe(direct(1));
        // Four of five, the Engineer among them, is still only the Engineer.
        expect(await officersBonus({ ...staff, technocrat: false })).toBe(direct(1));
        expect(await officersBonus(staff)).toBe(direct(2));
        expect(direct(2)).toBeGreaterThan(direct(1));
    });

    it('raises the Collector\'s energy and transport hold by the Collector Enhancement, and nobody else\'s', async () => {
        const graviton = async (playerClass, collectorClassBonus) => (await call(protocolWith(), 'ogame_graviton', {
            maxTemperature: 40, solarPlant: { level: 30 }, energyTechnology: 20, playerClass,
            lifeforms: { collectorClassBonus },
        })).structuredContent;
        const plain = await graviton('collector', 0);
        const enhanced = await graviton('collector', 50);
        const direct = new GravitonCalculator().compute({
            shipyardLevel: 0, nanitesFactoryLevel: 0, universeSpeed: 1, energyTechLevel: 20, hyperTechLevel: 0,
            maxPlanetTemp: 40, energyBonus: 0, solarPlantLevel: 30, solarPlantPercent: 100, fusionPlantLevel: 0,
            fusionPlantPercent: 100, solarSatellitesCount: 0, solarSatellitesPercent: 100, debrisPercent: 30,
            playerClass: 1, isTrader: false, energyBoost: 0, disChLevel: 0, gravitonLevel: 1, totalLFEnrgBonus: 0,
            collectorClassBonus: 50, scCapacityIncrease: 0, lcCapacityIncrease: 0, rcCapacityIncrease: 0,
            crysAvailable: 0, deutAvailable: 0, deutInDebris: false,
        });
        expect(enhanced.energyAvailable.playerClass).toBe(direct.classEnergyBonus);
        expect(enhanced.energyAvailable.playerClass).toBeGreaterThan(plain.energyAvailable.playerClass);
        expect(enhanced.transportsNeeded.largeCargo).toBeLessThan(plain.transportsNeeded.largeCargo);
        expect(await graviton('general', 50)).toEqual(await graviton('general', 0));
        // The same block reaches the terraformer.
        const tf = async (collectorClassBonus) => (await call(protocolWith(), 'ogame_terraformer', {
            toLevel: 1, maxTemperature: 40, solarPlant: { level: 30 }, energyTechnology: 20, playerClass: 'collector',
            lifeforms: { collectorClassBonus },
        })).structuredContent.energyAvailable.playerClass;
        expect(await tf(50)).toBeGreaterThan(await tf(0));
    });

    it('says so when satellites cannot help', async () => {
        const out = (await call(protocolWith(), 'ogame_graviton', { maxTemperature: -140 })).structuredContent;
        expect(out.satellitesNeeded).toBe(undefined);
        expect(out.note).toContain('no number of them');
    });
});

describe('MCP tool ogame_terraformer', () => {
    it('adds 4 fields on an odd level and 5 on an even one', async () => {
        const out = (await call(protocolWith(), 'ogame_terraformer', {
            fromLevel: 8, toLevel: 10, solarPlant: { level: 30 }, maxTemperature: 40,
        })).structuredContent;
        expect(out.fieldsAdded).toBe(9);
        // 1000 * 2^(10-1) energy for level 10
        expect(out.energyRequired).toBe(512000);
        expect(out.terraformer.crystal).toBe(50000 * (2 ** 8 + 2 ** 9));
    });

    it('prices the Terraformer as ogame_build_cost does under the same life form reduction', async () => {
        const facilities = { roboticsFactory: 10, naniteFactory: 3 };
        const both = async (fromLevel, toLevel) => {
            const tf = (await call(protocolWith(), 'ogame_terraformer', {
                fromLevel, toLevel, facilities, universeSpeed: 3, lifeforms: { terraformerReduction: 20 },
                solarPlant: { level: 30 }, maxTemperature: 40,
            })).structuredContent.terraformer;
            const bc = (await call(protocolWith(), 'ogame_build_cost', {
                item: 'terraformer', fromLevel, toLevel, facilities, universeSpeed: 3,
                lifeforms: { terraformerReduction: 20 },
            })).structuredContent;
            return { tf, bc };
        };
        // One level: the same cost and time to the second.
        const one = await both(4, 5);
        expect([one.tf.crystal, one.tf.deuterium, one.tf.buildSeconds])
            .toEqual([one.bc.crystal, one.bc.deuterium, one.bc.durationSeconds]);
        // 20% off: level 5 costs 50000 * 2^4 = 800000 crystal, 640000 after.
        expect(one.tf.crystal).toBe(640000);
        // A range: the same resources. The time is left out - the terraformer
        // core rounds it down per level, the costs core once for the range.
        const range = await both(4, 7);
        expect([range.tf.crystal, range.tf.deuterium]).toEqual([range.bc.crystal, range.bc.deuterium]);
        expect(range.tf.crystal).toBe(0.8 * 50000 * (2 ** 4 + 2 ** 5 + 2 ** 6));
    });

    it('caps the life form Terraformer reduction at 50%', async () => {
        const result = await call(protocolWith(), 'ogame_terraformer', { toLevel: 1, lifeforms: { terraformerReduction: 60 } });
        expect(result.isError).toBe(true);
    });

    it('refuses to go down', async () => {
        const result = await call(protocolWith(), 'ogame_terraformer', { fromLevel: 5, toLevel: 5 });
        expect(result.isError).toBe(true);
    });
});

describe('MCP tool ogame_expedition', () => {
    it('picks the find tier from the strongest player\'s points', async () => {
        const args = { ships: { 'large-cargo': 100 } };
        const top = async (points) => (await call(protocolWith(), 'ogame_expedition', { ...args, topPlayerPoints: points }))
            .structuredContent.assumptions.topTierValue;
        expect(await top(9999)).toBe(40000);
        expect(await top(30000000)).toBe(3000000);
        expect(await top(500000000)).toBe(5000000);
    });

    it('keeps a top score equal to a tier limit in that tier, as the page does', async () => {
        const args = { ships: { 'large-cargo': 100 } };
        const top = async (points) => (await call(protocolWith(), 'ogame_expedition', { ...args, topPlayerPoints: points }))
            .structuredContent.assumptions.topTierValue;
        expect(await top(1000000)).toBe(1200000);
        expect(await top(1000001)).toBe(1800000);
        expect(await top(100000000)).toBe(4200000);
        expect(await top(100000001)).toBe(5000000);
    });

    it('reads the top score and speed from a live universe', async () => {
        const site = fakeSiteApi({ 'de-1': { speed: '8', topScore: '250000.5' } });
        const out = (await call(protocolWith(site), 'ogame_expedition', {
            universe: { country: 'de', number: 1 }, ships: { 'small-cargo': 10 }, playerClass: 'discoverer',
        })).structuredContent;
        expect(out.assumptions).toEqual({ topPlayerPoints: 250000, topTierValue: 1200000, universeSpeed: 8 });
        // Discoverer: 1.5 * speed * tier, no pathfinder
        expect(out.maxExpeditionPoints).toBe(1.5 * 8 * 1200000);
    });

    it('gives the General\'s recycler bonus to a General only', async () => {
        const cap = async (cls) => (await call(protocolWith(), 'ogame_expedition', { ships: { recycler: 10 }, playerClass: cls }))
            .structuredContent.fleetCargoCapacity;
        expect(await cap('none')).toBe(200000);
        expect(await cap('general')).toBe(240000);
    });

    it('raises the resource find with discoveryBoosterPercent', async () => {
        const metal = async (discoveryBoosterPercent) => (await call(protocolWith(), 'ogame_expedition', {
            ships: { 'large-cargo': 1000 }, discoveryBoosterPercent,
        })).structuredContent.maxFind.metal;
        expect(await metal(20)).toBeGreaterThan(await metal(0));
    });

    it('lists only the ships the fleet unlocks', async () => {
        const out = (await call(protocolWith(), 'ogame_expedition', { ships: { 'small-cargo': 100 } })).structuredContent;
        expect(Object.keys(out.findableShips)).toEqual(['esp-probe', 'small-cargo', 'light-fighter']);
    });
});

describe('MCP moon tools', () => {
    it('ogame_moon_destruction: (100 - sqrt(D)) * sqrt(n) and sqrt(D) / 2', async () => {
        const out = (await call(protocolWith(), 'ogame_moon_destruction', { moonDiameter: 8100, deathStars: 4 })).structuredContent;
        expect(out).toEqual({ moonDestroyedPercent: 20, deathStarsLostPercent: 45 });
    });

    it('ogame_moon_creation: 2M of debris is the 20% cap', async () => {
        const out = (await call(protocolWith(), 'ogame_moon_creation', { destroyed: { 'light-fighter': 2000 } })).structuredContent;
        expect(out.debris.total).toBe(2400000);
        expect(out.moonChancePercent).toBe(20);
        expect(out.moonDiameterKm.min).toBe(8366);
        expect(out.unitsForMaxChance['rocket-launcher']).toBe(undefined);
    });

    it('ogame_moon_creation: counts defence at the universe\'s defence share, ships at theirs', async () => {
        const site = fakeSiteApi({ 'en-9': { debrisFactor: '0.5', debrisFactorDef: '0.3', deuteriumInDebris: '0' } });
        const out = (await call(protocolWith(site), 'ogame_moon_creation', {
            universe: { country: 'en', number: 9 }, destroyed: { 'rocket-launcher': 100, 'light-fighter': 10 },
        })).structuredContent;
        expect(out.assumptions).toEqual({ debrisPercent: 50, defenceDebrisPercent: 30, deuteriumInDebris: false });
        // 100 rocket launchers (2000 metal) at 30%, 10 light fighters (3000/1000) at 50%.
        expect(out.debris.metal).toBe(100 * 2000 * 0.3 + 10 * 3000 * 0.5);
        expect(out.debris.crystal).toBe(10 * 1000 * 0.5);
    });

    it('ogame_moon_creation: a defence share given by hand wins over the universe\'s', async () => {
        const site = fakeSiteApi({ 'en-9': { debrisFactor: '0.5', debrisFactorDef: '0.3', deuteriumInDebris: '0' } });
        const out = (await call(protocolWith(site), 'ogame_moon_creation', {
            universe: { country: 'en', number: 9 }, destroyed: { 'rocket-launcher': 100 }, defenceDebrisPercent: 10,
        })).structuredContent;
        expect(out.debris.metal).toBe(20000);
        expect(out.assumptions.defenceDebrisPercent).toBe(10);
    });

    it('ogame_moon_creation: no defence in the field without a universe or a share', async () => {
        const out = (await call(protocolWith(), 'ogame_moon_creation', { destroyed: { 'rocket-launcher': 100 } })).structuredContent;
        expect(out.debris.total).toBe(0);
        expect(out.assumptions.defenceDebrisPercent).toBe(0);
    });

    it('ogame_moon_creation: gives a General\'s recyclers 20% more hold', async () => {
        const capacity = async (playerClass) => (await call(protocolWith(), 'ogame_moon_creation', {
            destroyed: { 'light-fighter': 2000 }, playerClass,
        })).structuredContent.recyclerCapacity;
        expect(await capacity('none')).toBe(20000);
        expect(await capacity('discoverer')).toBe(20000);
        expect(await capacity('general')).toBe(24000);
    });

    it('ogame_phalanx: gives the Discoverer class its range bonus, and no other class', async () => {
        const { MoonCalculator } = load(['js/utils.js', 'ogame/calc/js/ogame-cargo.js', 'ogame/calc/js/moon-core.js'], ['MoonCalculator']);
        const range = async (playerClass) => (await call(protocolWith(), 'ogame_phalanx', {
            phalanxLevel: 7, moonSystem: 100, playerClass,
        })).structuredContent.rangeSystems;
        const direct = (isDiscoverer) => new MoonCalculator().computePhalanx({
            phalanxLevel: 7, phalanxRangeBonus: 0, isDiscoverer, discovererBonus: 0, ownSystem: 100,
            targetSystem: 100, circularSystems: false, numberOfSystems: 499,
        }).phalanxRange;
        expect(await range('collector')).toBe(direct(false));
        expect(await range('discoverer')).toBe(direct(true));
        expect(direct(true)).toBeGreaterThan(direct(false));
    });

    it('ogame_phalanx: wraps round a circular galaxy and names the level a target needs', async () => {
        const out = (await call(protocolWith(), 'ogame_phalanx', {
            phalanxLevel: 7, moonSystem: 5, targetSystem: 470, universeSettings: { circularSystems: true },
        })).structuredContent;
        expect(out.rangeSystems).toBe(48);
        expect(out.covers).toEqual([{ from: 456, to: 499 }, { from: 1, to: 53 }]);
        expect(out.target).toEqual({ system: 470, distance: 34, inRange: true, levelNeeded: 6 });
    });

    it('ogame_phalanx: reads the galaxy shape from a live universe, and lets universeSettings win', async () => {
        const site = fakeSiteApi({ 'en-3': { systems: '400', donutSystem: '1' } });
        const galaxy = async (universeSettings) => (await call(protocolWith(site), 'ogame_phalanx', {
            phalanxLevel: 7, moonSystem: 5, universe: { country: 'en', number: 3 }, universeSettings,
        })).structuredContent.galaxy;
        expect(await galaxy({})).toEqual({ systems: 400, circular: true });
        expect(await galaxy({ circularSystems: false })).toEqual({ systems: 400, circular: false });
        expect(await galaxy({ systems: 499, circularSystems: false })).toEqual({ systems: 499, circular: false });
    });
});

describe('MCP tool ogame_lifeform_cost', () => {
    const { LfCalculator } = load(
        ['ogame/calc/js/ogame-costs.js', 'ogame/calc/js/ogame-lifeform.js', 'ogame/calc/js/lfcosts-core.js'],
        ['LfCalculator'],
    );

    it('applies the Megalith to a Rock\'tal building the way the page does', async () => {
        const out = (await call(protocolWith(), 'ogame_lifeform_cost', {
            item: 'Megalith', fromLevel: 5, toLevel: 6, lifeforms: { megalith: 5 }, facilities: { roboticsFactory: 10 },
        })).structuredContent;
        const techs = readWwwJson('ogame/calc/data/lf-techs.json');
        const costs = Object.fromEntries(Object.entries(techs).map(([id, row]) => [id, row.slice(2)]));
        const calc = new LfCalculator(costs);
        const params = { race: 2, megalithLvl: 5, mineralResCntrLvl: 0, robotFactoryLevel: 10, naniteFactoryLevel: 0,
            universeSpeed: 1, researchCostReduction: 0, researchTimeReduction: 0, runeTechLvl: 0 };
        const direct = calc.calculate(2008, 5, 6, 0, calc.computeRsrCostRdc(params), calc.computeBldCostRdc(2008, 2, 5, 0), params);
        expect(out.item.key).toBe('megalith');
        expect([out.metal, out.crystal, out.deuterium, out.durationSeconds]).toEqual([direct.metal, direct.crystal, direct.deut, direct.time]);
        expect(out.reductions.buildingCostPercent).toBe(5);
    });

    it('refuses to lower a research and names an unknown item', async () => {
        expect((await call(protocolWith(), 'ogame_lifeform_cost', { item: 'kaelesh-disc-enh', fromLevel: 3, toLevel: 2 })).isError).toBe(true);
        const unknown = await call(protocolWith(), 'ogame_lifeform_cost', { item: 'warp drive', toLevel: 1 });
        expect(unknown.content[0].text).toContain('Unknown item "warp drive"');
    });
});

describe('MCP tool ogame_build_queue', () => {
    it('times a step with the Robotics Factory the step before it built', async () => {
        const run = async (queue) => (await call(protocolWith(), 'ogame_build_queue', {
            levels: { 'robot-factory': 9, 'metal-mine': 30 }, queue,
        })).structuredContent;
        const alone = await run([{ building: 'metal-mine' }]);
        const after = await run([{ building: 'robot-factory' }, { building: 'metal-mine' }]);
        // Robotics 10 instead of 9: the mine takes 10/11 of the time
        expect(after.steps[1].durationSeconds).toBe(Math.floor(alone.steps[0].durationSeconds * 10 / 11));
        expect(after.steps[1].toLevel).toBe(31);
    });

    it('flags a step with no free field, and counts the Terraformer\'s new ones', async () => {
        const out = (await call(protocolWith(), 'ogame_build_queue', {
            levels: { 'metal-mine': 10 }, fields: 11, queue: [{ building: 'terraformer' }, { building: 'crystal-mine', times: 2 }],
        })).structuredContent;
        expect(out.steps.map((s) => s.noFreeField ?? false)).toEqual([false, false, false]);
        expect(out.fields).toEqual({ used: 13, available: 16 });
    });

    it('refuses impossible queues', async () => {
        const error = async (args) => (await call(protocolWith(), 'ogame_build_queue', args)).content[0].text;
        expect(await error({ queue: [{ building: 'metal-mine', action: 'demolish' }] })).toContain('below level 0');
        expect(await error({ levels: { terraformer: 2 }, queue: [{ building: 'terraformer', action: 'demolish' }] }))
            .toContain('cannot be demolished');
        expect(await error({ queue: [{ building: 'sensor-phalanx' }] })).toContain('cannot be built on a planet');
    });
});

describe('MCP tool ogame_production', () => {
    const base = {
        maxTemperature: 40, metalMine: { level: 30 }, crystalMine: { level: 25 }, deuteriumSynthesizer: { level: 20 },
        solarPlant: { level: 35 }, energyTechnology: 15, plasmaTechnology: 10,
    };

    it('produces the same hour as the page\'s own core', async () => {
        const out = (await call(protocolWith(), 'ogame_production', base)).structuredContent;
        expect(out.perDay.metal).toBe(out.perHour.metal * 24);
        expect(out.productionFactor).toBe(1);
        const parts = Object.values(out.breakdownPerHour).reduce((sum, r) => sum + r.metal, 0);
        expect(parts).toBe(out.perHour.metal);
    });

    it('lets a Magma Forge raise the metal output', async () => {
        const plain = (await call(protocolWith(), 'ogame_production', base)).structuredContent;
        const forge = (await call(protocolWith(), 'ogame_production', { ...base, lifeforms: { buildings: { 'magma-forge': 10 } } })).structuredContent;
        // 2% per level of the mine's output
        expect(forge.breakdownPerHour.lifeformBuildings.metal).toBe(Math.round(plain.breakdownPerHour.mines.metal * 0.2));
    });

    it('caps crawlers at 8 per mine level and says so', async () => {
        const out = (await call(protocolWith(), 'ogame_production', { ...base, crawlers: { count: 5000 } })).structuredContent;
        expect(out.note).toContain('Only 600 crawlers');
    });

    it('gives the commanding staff bonus for all five officers only', async () => {
        const staff = { commander: true, admiral: true, engineer: true, geologist: true, technocrat: true };
        const row = async (officers) => (await call(protocolWith(), 'ogame_production', { ...base, officers }))
            .structuredContent.breakdownPerHour;
        expect((await row({ ...staff, admiral: false })).commandingStaff.metal).toBe(0);
        const full = await row(staff);
        expect(full.commandingStaff.metal).toBeGreaterThan(0);
        expect(full.geologist.metal).toBeGreaterThan(0);
    });

    it('gives the alliance Trader bonus to the trader class only', async () => {
        const alliance = async (allianceClass) => (await call(protocolWith(), 'ogame_production', { ...base, allianceClass }))
            .structuredContent.breakdownPerHour.allianceClass;
        expect((await alliance('none')).metal).toBe(0);
        expect((await alliance('warrior')).metal).toBe(0);
        const plain = (await call(protocolWith(), 'ogame_production', base)).structuredContent;
        // +5% of the mines' output
        expect((await alliance('trader')).metal).toBe(Math.round(plain.breakdownPerHour.mines.metal * 0.05));
    });

    it('refuses buildings of two races on one planet', async () => {
        const result = await call(protocolWith(), 'ogame_production', { lifeforms: { buildings: { 'magma-forge': 1, 'high-en-smelt': 1 } } });
        expect(result.isError).toBe(true);
    });
});

describe('MCP lifeforms.shipBonuses', () => {
    const cargo = (ship, percent) => ({ lifeforms: { shipBonuses: { [ship]: { cargo: percent } } } });

    it('raises a ship\'s hold in ogame_flight', async () => {
        const out = (await call(protocolWith(), 'ogame_flight', {
            from: { galaxy: 1, system: 1, position: 1 }, to: { galaxy: 1, system: 2, position: 1 },
            ships: { 'large-cargo': 100 }, speedPercent: 100, ...cargo('large-cargo', 10),
        })).structuredContent;
        expect(out.cargoCapacity).toBe(100 * 27500);
    });

    it('raises a ship\'s hold in ogame_trade, ogame_moon_creation and ogame_expedition', async () => {
        const trade = async (extra) => (await call(protocolWith(), 'ogame_trade', {
            sell: { metal: 2750000 }, buy: 'crystal', ...extra,
        })).structuredContent.cargoShips.toDeliverSold.largeCargo;
        expect(await trade({})).toBe(110);
        expect(await trade(cargo('large-cargo', 10))).toBe(100);

        const moon = (await call(protocolWith(), 'ogame_moon_creation', {
            destroyed: { 'light-fighter': 2000 }, ...cargo('recycler', 10),
        })).structuredContent;
        expect(moon.recyclerCapacity).toBe(22000);

        const expedition = async (extra) => (await call(protocolWith(), 'ogame_expedition', {
            ships: { recycler: 10 }, ...extra,
        })).structuredContent.fleetCargoCapacity;
        expect(await expedition(cargo('recycler', 10))).toBe(await expedition({}) + 10 * 2000);
    });

    it('ignores the life form fields and ships a tool does not read', async () => {
        const trade = async (lifeforms) => (await call(protocolWith(), 'ogame_trade', {
            sell: { metal: 2750000 }, buy: 'crystal', lifeforms,
        })).structuredContent.cargoShips.toDeliverSold.largeCargo;
        // The whole account block, as ogame_import_account returns it
        const block = {
            metalBonus: 4.2, collectorClassBonus: 12, megalith: 3,
            shipBonuses: { 'large-cargo': { cargo: 10 }, cruiser: { speed: 5, cargo: 3 } },
        };
        expect(await trade(block)).toBe(await trade(cargo('large-cargo', 10).lifeforms));
    });

    it('still checks the fields a tool reads, and the top level', async () => {
        const bad = await call(protocolWith(), 'ogame_trade', { sell: { metal: 1 }, buy: 'crystal', ...cargo('large-cargo', -5) });
        expect(bad.isError).toBe(true);
        const typo = await call(protocolWith(), 'ogame_trade', { sell: { metal: 1 }, buy: 'crystal', lifeform: {} });
        expect(typo.isError).toBe(true);
    });
});

describe('MCP tool ogame_trade', () => {
    it('sells two resources for the third', async () => {
        const out = (await call(protocolWith(), 'ogame_trade', { sell: { metal: 300000, crystal: 100000 } })).structuredContent;
        // 300000 / 2.4 + 100000 / 1.5 at the default rates
        expect(out.receive).toEqual({ deuterium: 191667 });
        expect(out.rates.withinUsualRanges).toBe(true);
    });

    it('splits the return by units', async () => {
        const out = (await call(protocolWith(), 'ogame_trade', {
            sell: { deuterium: 100000 }, buy: 'both', split: { receivePercent: { crystal: 70 } },
        })).structuredContent;
        expect(Math.round(out.receive.crystal / (out.receive.crystal + out.receive.metal) * 100)).toBe(70);
    });

    it('buys a fixed amount and the rest in the other resource', async () => {
        const out = (await call(protocolWith(), 'ogame_trade', {
            sell: { metal: 240000 }, buy: 'both', split: { fixed: { deuterium: 50000 } }, rates: { metalPerDeuterium: 2.4, crystalPerDeuterium: 1.6 },
        })).structuredContent;
        // 50000 deuterium cost 120000 metal; the other 120000 buy crystal at 1.5
        expect(out.receive).toEqual({ crystal: 80000, deuterium: 50000 });
    });

    it('refuses a trade that makes no sense', async () => {
        const error = async (args) => (await call(protocolWith(), 'ogame_trade', args)).isError;
        expect(await error({ sell: { metal: 1, crystal: 1, deuterium: 1 } })).toBe(true);
        expect(await error({ sell: { metal: 1 }, buy: 'metal' })).toBe(true);
        expect(await error({ sell: { metal: 1 }, buy: 'crystal', split: { fixed: { crystal: 1 } } })).toBe(true);
    });
});

describe('MCP tool ogame_import_account', () => {
    const { ACCOUNT_MAP, PLANET_MAP, BODY_MAP, lfBuildingFields } = require('../mcp/tools/import-account');
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    // A synthetic 8-planet account (schemaVersion 2, every block a real export has, booster
    // uuids from the game's shop), sized like a real one; and the small schema-1 export.
    const fixture = (name) => JSON.parse(readFileSync(join(__dirname, '..', 'playwright-tests', 'fixtures', name), 'utf8'));
    const LARGE = fixture('account-export-large.json');
    const SMALL = fixture('account-export-v1.json');
    const tools = createTools({ siteApi: fakeSiteApi({}) });
    const importAccount = async (args) => call(protocolWith(), 'ogame_import_account', args);

    /**
     * What the PfG Companion's "copy for AI" leaves of an export (docs/ogame-api-import.md):
     * no resources, defences or baseProduction on a body, every speciesBonuses entry cut
     * down to its totalBonus.
     */
    function trimmed(raw) {
        const copy = structuredClone(raw);
        for (const bodies of [copy.planets, copy.moons]) {
            for (const body of Object.values(bodies ?? {})) {
                delete body.resources;
                delete body.defenses;
                delete body.baseProduction;
            }
        }
        for (const group of Object.values(copy.speciesBonuses)) {
            for (const [id, entry] of Object.entries(group)) {
                group[id] = { totalBonus: entry.totalBonus };
            }
        }
        return copy;
    }

    /**
     * The schema an argument path leads to in a tool's input schema, or undefined:
     * named properties first, then a map's shared value schema with its key list.
     */
    function schemaAt(schema, path) {
        let at = schema;
        for (const part of path.split('.')) {
            const names = at?.propertyNames?.enum;
            const next = at?.properties?.[part]
                ?? (typeof at?.additionalProperties === 'object' && (!names || names.includes(part)) ? at.additionalProperties : undefined);
            if (!next) return undefined;
            at = next;
        }
        return at;
    }

    it('maps every value onto an argument the named tools take', () => {
        const maps = [...ACCOUNT_MAP, ...PLANET_MAP, ...BODY_MAP, ...[0, 1, 2, 3, 4].flatMap(lfBuildingFields),
            { path: 'planetRace', tools: ['ogame_lifeform_cost'] }, { path: 'position', tools: ['ogame_production'] }];
        const missing = [];
        for (const field of maps) {
            for (const name of field.tools) {
                const tool = tools.find((t) => t.name === name);
                if (!tool || !schemaAt(tool.inputSchema, field.path)) missing.push(`${name}: ${field.path}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('answers the same for a full export and the Companion\'s trimmed copy of it', async () => {
        const full = await importAccount({ export: LARGE });
        expect(full.isError === true).toBe(false);
        const cut = trimmed(LARGE);
        expect(JSON.stringify(cut).length).toBeLessThan(JSON.stringify(LARGE).length * 0.6);
        expect((await importAccount({ export: cut })).structuredContent).toEqual(full.structuredContent);
    });

    it('reads the account and the bodies under the tools\' argument names', async () => {
        const out = (await importAccount({ export: LARGE })).structuredContent;
        expect(out.universe).toEqual({ country: 'en', number: 152 });
        expect(out.bodies.length).toBe(14);
        const { account } = out;
        expect(account.playerClass).toBe('collector');
        expect(account.allianceClass).toBe('trader');
        expect(account.officers).toEqual({ commander: true, admiral: true, engineer: true, geologist: true, technocrat: false });
        expect(account.discoveryBoosterPercent).toBe(20);
        expect(account.lifeforms.crawlerBonus).toBe(2.75);

        const alpha = out.bodies[0];
        expect(alpha.location).toBe('planet');
        expect(alpha.planetRace).toBe('humans');
        // Platinum metal booster active, the gold one on planet 4 expired before the export.
        expect(alpha.metalMine.boosterPercent).toBe(40);
        expect(out.bodies[3].metalMine.boosterPercent).toBe(0);
        // The Companion's production settings: crawlers overloaded on the first four planets.
        expect(alpha.crawlers.percent).toBe(150);
        expect(alpha.crawlers.count).toBe(LARGE.planets['30000001'].ships['217']);
        expect(alpha.ships.reaper).toBe(LARGE.planets['30000001'].ships['218']);
        expect(alpha.ships.pathfinder).toBe(LARGE.planets['30000001'].ships['219']);
        expect(alpha.ships.crawler).toBe(undefined);

        const moon = out.bodies.find((b) => b.location === 'moon');
        expect(moon.levels['lunar-base']).toBeGreaterThan(0);
        expect(moon.metalMine).toBe(undefined);
    });

    it('leaves out who the player is, defences and resources', async () => {
        const text = JSON.stringify((await importAccount({ export: LARGE })).structuredContent);
        for (const secret of ['Synthetic Player', '104729', 'itemUuid', 'a83cfdc15b8dba27c82962d57e50d8101d263cfb', 'buffStart']) {
            expect(text.includes(secret)).toBe(false);
        }
        expect(text.includes('rocket-launcher')).toBe(false);
        expect(text.includes('"resources"')).toBe(false);
    });

    it('fills the other tools straight from its answer', async () => {
        const out = (await importAccount({ export: LARGE })).structuredContent;
        const planet = out.bodies[1];
        /** The model's part: the fields a tool takes, account and planet life forms merged. */
        const argsFor = (name, extra = {}) => {
            const props = tools.find((t) => t.name === name)?.inputSchema.properties ?? {};
            const merged = { ...out.account, ...planet, lifeforms: { ...out.account.lifeforms, ...planet.lifeforms } };
            return { ...Object.fromEntries(Object.entries(merged).filter(([key]) => key in props)), ...extra };
        };
        for (const [name, extra] of [
            ['ogame_production', {}],
            ['ogame_graviton', {}],
            ['ogame_terraformer', { toLevel: 3 }],
            ['ogame_build_queue', { queue: [{ building: 'metal-mine' }] }],
            ['ogame_lifeform_cost', { item: 'rune-tech', fromLevel: planet.lifeformLevels['rune-tech'], toLevel: 25 }],
            ['ogame_build_cost', { item: 'plasma-tech', fromLevel: out.account.research['plasma-tech'], toLevel: 20 }],
            ['ogame_flight', { from: planet.coordinates, to: out.bodies[2].coordinates }],
            ['ogame_expedition', {}],
        ]) {
            const result = await call(protocolWith(), name, argsFor(name, extra));
            expect([name, result.isError ? result.content[0].text : 'ok']).toEqual([name, 'ok']);
        }
    });

    it('hands the Collector Enhancement to ogame_build_cost', async () => {
        const row = ACCOUNT_MAP.find((field) => field.key === 'lf.classBooster.1');
        expect(row?.tools.includes('ogame_build_cost')).toBe(true);
        const { account } = (await importAccount({ export: LARGE })).structuredContent;
        expect(account.lifeforms.collectorClassBonus).toBe(7.6077);
        const ships = async (lifeforms) => (await call(protocolWith(), 'ogame_build_cost', {
            item: 'large-cargo', quantity: 1000, playerClass: account.playerClass, lifeforms,
        })).structuredContent.cargoShipsNeeded.largeCargo;
        // 12,000,000 resources in holds of 25000 * (1 + 0.25 * 1.076077) = 31725
        expect(await ships({ collectorClassBonus: account.lifeforms.collectorClassBonus })).toBe(Math.ceil(12_000_000 / 31725));
        expect(await ships({})).toBe(384);
    });

    it('copies the universe asked for into a schemaVersion 1 answer, null without', async () => {
        expect((await importAccount({ export: SMALL })).structuredContent.universe).toBe(null);
        const out = (await importAccount({ export: SMALL, universe: { country: 'EN', number: 1 } })).structuredContent;
        expect(out.universe).toEqual({ country: 'en', number: 1 });
    });

    it('takes the export as a string too', async () => {
        const out = await importAccount({ export: JSON.stringify(SMALL) });
        expect(out.structuredContent.account.playerClass).toBe('collector');
    });

    it('picks the export out of a Companion payload', async () => {
        const second = { ...structuredClone(LARGE), universe: { language: 'de', number: 3 } };
        const one = await importAccount({ export: { version: 1, exports: [LARGE] } });
        expect(one.structuredContent.universe).toEqual({ country: 'en', number: 152 });

        const several = await importAccount({ export: { version: 1, exports: [LARGE, second] } });
        expect(several.isError).toBe(true);
        expect(several.content[0].text).toContain('en-152, de-3');

        const picked = await importAccount({ export: { version: 1, exports: [LARGE, second] }, universe: { country: 'de', number: 3 } });
        expect(picked.structuredContent.universe).toEqual({ country: 'de', number: 3 });
        const absent = await importAccount({ export: { version: 1, exports: [LARGE] }, universe: { country: 'fr', number: 1 } });
        expect(absent.content[0].text).toContain('no export of fr-1');
    });

    it('refuses what it cannot read, with a reason', async () => {
        const schema = await importAccount({ export: { ...SMALL, schemaVersion: 3 } });
        expect(schema.content[0].text).toContain('schemaVersion 3 is not supported');
        expect((await importAccount({ export: '{nope' })).content[0].text).toContain('not valid JSON');
        expect((await importAccount({ export: { planets: {} } })).content[0].text).toContain('needs playerId and planets');
        const other = await importAccount({ export: LARGE, universe: { country: 'de', number: 1 } });
        expect(other.content[0].text).toContain('from en-152, not de-1');
    });
});
