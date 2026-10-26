# The MCP server

The calculators as tools an LLM can call - ChatGPT, Claude, Cursor, anything that
speaks the [Model Context Protocol](https://modelcontextprotocol.io). The tools
compute with the same `*-core.js` files the pages load, so a model gets the
site's numbers rather than its own guess at OGame's formulas.

Why it is built this way - Node, no dependencies, one process behind Apache:
[ADR-0005](../docs/adr/0005-mcp-node-service.md). Running it on the host:
[`deploy/README.md`](../deploy/README.md), *The MCP server*.

## Tools

| Tool | Calculator | What it answers | Computed by |
|---|---|---|---|
| `ogame_flight` | flight | Distance, one-way duration and deuterium at each speed step, cargo capacity | `flight-core.js` |
| `ogame_build_cost` | costs | Metal, crystal, deuterium, energy, time, points, DM to halve, cargo ships - for a building or research range, or a number of ships or defences | `costs-core.js`, `ogame-costs.js`, `data/costs-techs.json` |
| `ogame_lifeform_cost` | lfcosts | The same for a life form building or research, with the Megalith, MRC and research-building reductions | `lfcosts-core.js`, `ogame-lifeform.js`, `data/lf-techs.json` |
| `ogame_build_queue` | queue | Each step of a build/demolish queue on a planet or moon, timed at the factory levels the steps before it reached; fields used | `QueueCalculator.simulate()` in `queue-core.js` |
| `ogame_production` | production | One planet's hourly and daily output, energy balance and where each part comes from | `production-core.js`, `ogame-production.js`, `data/lf-building-bonuses.json` |
| `ogame_expedition` | expeditions | Maximum resource, dark matter and ship finds of a fleet, and whether it can carry a top find | `expeditions-core.js`, `data/expedition-top-tiers.json` |
| `ogame_moon_destruction` | moon | Chance that Death Stars destroy a moon, and that they blow up | `moon-core.js` |
| `ogame_moon_creation` | moon | Moon chance and possible diameters from what a battle destroyed; debris and recyclers | `moon-core.js` |
| `ogame_phalanx` | moon | Sensor Phalanx range, the systems it covers, the level a target needs | `moon-core.js` |
| `ogame_graviton` | graviton | Energy Graviton Technology needs against what the planet makes; satellites, cost, time, debris | `graviton-core.js` |
| `ogame_terraformer` | terraformer | Terraformer cost, fields and energy, and the satellites that cover the shortfall | `terraformer-core.js`, `ogame-costs.js` |
| `ogame_trade` | trade | What resources buy at given rates - one for one, one for a mix, two for one - and the cargo ships | `trade-core.js` |

Most take an optional `universe: {country, number}` - `{"country": "en", "number": 1}`
for s1-en - and read its speeds and settings through the site's `serverdata` and
`populatedSystems` services (`docs/universe-data.md`). Anything given by hand
overrides what is read. The input schemas in `tools/*.js` are the reference: the
server validates every call against the schema it publishes.

Everything all twelve publish in `tools/list` comes to about 51.5 KB, held to a 52 KB budget
by a test in `unit-tests/mcp-server.test.js` - every client loads it into its model's
context, so keep new schemas lean: write a map from ships or buildings to a value with
`keyedMap()` rather than one property per key, list an item's keys with their names in the
description once instead of as an enum (`resolveKey()` then accepts either), and keep
descriptions short. Going over the budget is a deliberate decision that raises it in the
same commit.

## One name and shape per game concept

A concept the game has once is one argument, with the same name and shape in every tool
that takes it, from one schema in `tools/common.js`; a tool takes the subset its calculator
reads. `lifeforms` alone ignores the fields and ships a tool does not read (the ones it reads
are still checked), so one block serves every tool. The account import is meant to produce these forms, so a new tool reuses them
rather than inventing its own.

| Concept | Argument | Taken by |
|---|---|---|
| Player class | `playerClass`: `none` \| `collector` \| `general` \| `discoverer` | every tool that has a class rule |
| Alliance class | `allianceClass`: `none` \| `trader` \| `warrior` | flight, production, graviton, terraformer |
| Officers | `officers: {commander, admiral, engineer, geologist, technocrat}`, booleans. The commanding staff is all five set - there is no flag of its own | build-cost, production, graviton, terraformer |
| Life forms | `lifeforms`: one object with every life form bonus (percent, as the game shows it) and building level - `metalBonus`, `energyBonus`, `collectorClassBonus` / `generalClassBonus` / `discovererClassBonus`, `terraformerReduction`, `megalith`, `disruptionChamber`, ...; per ship `shipBonuses[ship-key].{speed, cargo, fuel}` with the kebab ship keys of the cores; production's buildings as `lifeforms.buildings` | every tool with a life form input |
| Item vs research reductions | build-cost `lifeforms.itemCostReduction` / `itemTimeReduction` (the item asked about); lifeform-cost `lifeforms.researchCostReduction` / `researchTimeReduction` (life form research) - different things, kept apart | build-cost, lifeform-cost |
| Facilities | `facilities.{roboticsFactory, naniteFactory, shipyard, researchLab}` | build-cost, lifeform-cost, graviton, terraformer; build-queue keeps its keyed `levels` |
| Plants | `maxTemperature`, `solarPlant`, `fusionReactor`, `solarSatellites` | production, graviton, terraformer |
| Research | `hyperspaceTechnology`, `ionTechnology`, max 50 | wherever cargo or demolition is computed |
| Boosters | `energyBoosterPercent`; expedition's `discoveryBoosterPercent` is the expedition booster, not the mine one | production, graviton, terraformer, expedition |
| Universe | `universe: {country, number}`, `universeSpeed`; flight and phalanx override the galaxy shape in `universeSettings` | most |
| Planet or moon | `location`: `planet` \| `moon` | build-cost, build-queue |

`ogame_production` is the one tool whose core reads page-wide state: `production-core.js`
takes its settings from the `options` object `production.tpl` declares. The tool builds that
object in the scripts' sandbox right before each call, which is safe because a call never
yields.

## Running it

```
make mcp                          # HTTP on http://127.0.0.1:8787/mcp
node mcp/server.js --stdio        # one client over stdin/stdout
```

| Variable | Default | |
|---|---|---|
| `PFG_MCP_HOST` | `127.0.0.1` | Interface to listen on |
| `PFG_MCP_PORT` | `8787` | |
| `PFG_SITE_URL` | `https://proxyforgame.com` | Where the universe data is read from |
| `PFG_MCP_ALLOWED_ORIGINS` | the two site origins | Browser origins allowed to call; requests with another `Origin` get 403 |
| `PFG_MCP_RATE_LIMIT` | `120` | Requests per client address per minute, 0 for none |
| `PFG_MCP_TRUST_PROXY` | on | `0` stops reading the client address from `X-Forwarded-For` |

`PFG_SITE_URL=http://localhost:8000` points it at `make serve`.

## Connecting a client

- **ChatGPT** - with developer mode on, add a custom MCP connector with the URL
  `https://proxyforgame.com/mcp` and no authentication.
- **Claude** (claude.ai, Desktop) - Settings → Connectors → add a custom connector with
  the same URL.
- **Claude Code** - `claude mcp add --transport http proxyforgame https://proxyforgame.com/mcp`.
- **A local checkout** in any client that runs commands - command `node`, arguments
  `<checkout>/mcp/server.js --stdio`.

## Adding a tool

1. A file in `tools/` exporting a factory that returns `{name, title, description,
   inputSchema, openWorld?, run}`, registered in `tools/index.js`.
2. `run` gets the arguments already validated, defaults filled in. Throw a
   `ToolError` for anything the caller can fix - the model reads the message - and
   let anything else propagate: it becomes an internal error and a log line.
3. Compute with the calculator's own core through `loadBrowserScripts`. When the
   arithmetic or the data still lives in a template, an orchestration file or PHP,
   move it into a shared file first rather than copying it here - the costs tech
   table is the precedent.
4. Tests in `unit-tests/mcp-server.test.js`. The schema only understands the
   keywords listed at the top of `lib/schema.js`.

## Layout

| File | |
|---|---|
| `server.js` | Entry point: configuration, HTTP or stdio |
| `lib/protocol.js` | JSON-RPC and the MCP methods; transport-free |
| `lib/http-transport.js` | Streamable HTTP, stateless: POST only, rate limit, origin check |
| `lib/schema.js` | Validates arguments against the published input schema |
| `lib/browser-scripts.js` | Runs `www/` scripts in a `vm` context - shared with the unit tests |
| `lib/site-api.js` | Reads universe data from the site, with a short cache |
| `lib/revision.js` | The checkout's commit, for the version string |
| `tools/common.js` | Shared argument schemas: universe, levels, maps, the planet energy inputs, and one schema per game concept |
