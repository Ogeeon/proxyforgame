# Universe data: where the country/universe lists and settings come from

Three calculators let the player pick a country and a universe instead of typing its
settings: **flight**, **costs** and **trade**. Behind that picker are two cron jobs, four
tables and two AJAX services. None of it is the player's own data — that is
`docs/ogame-api-import.md`.

## The pipeline

| Stage | File | Reads | Writes |
|---|---|---|---|
| Universe list, daily | `uni.list.cron.php` (repo root) | Gameforge lobby `https://lobby.ogame.gameforge.com/api/servers` | `universes` (truncated and refilled); `countries` and `servers` are reference rows from `schema.sql` |
| Populated systems, daily | `get_population.php` (repo root) | per universe `serverData.xml`, `players.xml`, `universe.xml` from `https://s<uni>-<country>.ogame.gameforge.com/api/` | `population_data` (`population` = systems with an active player, `population_all` = any planet) |
| Picker lists, on page load | `www/ogame/calc/universes.inc.php` (`flight.php`, `costs.php`, `trade.php`), cached for an hour in the system temp dir | `countries` ⨝ `servers`, `universes` | inline JS literal in the template |
| Universe settings, on pick | `serverdata` → `www/api/server-data.inc.php` | that universe's live `serverData.xml`, no DB | JSON: speeds, galaxies, donut flags, `fleetIgnore*Systems`, debris share and deuterium-in-debris, … |
| Populated systems, on pick | `populatedSystems` → `www/api/populated-systems.inc.php` | `population_data` | JSON; flight caches it in `localStorage` for 24 h (`POPULATED_SYSTEMS_TTL_MS`, `flight-orchestration.js`) |

Client side: `flight-orchestration.js` and `costs-orchestration.js` call `apiGet('serverdata', …)`;
costs turns the answer into speeds with `universeSpeeds()` in `costs-core.js`. Pages bound to a
player profile with no picker of their own (production, queue, LF costs, terraformer, graviton,
expeditions, moon) take the active profile's universe settings from the shared universe cache:
`UniverseCache` in `profiles-store.js` fetches the answer, collapses parallel requests and keeps
it for a day in `localStorage` (`pfg_universe_<country>_<number>`) with the player's own choices
beside it. The rules - parsing the answer, the TTL, the legacy `override` key, a choice equal to
the game's being dropped - are pure functions in `profiles-core.js` with Node tests;
`PfUniverseSetting` in `profiles-widgets.js` only ties a field to the cache. The player's choices count
in the profile badge of values that differ from the game, and travel in the profile backup file.

## Things that trip people up

- **Without a database the pickers are empty**, not broken: every setting they would fill in
  stays editable by hand. Locally the lists come from whatever is in `universes` — a fresh
  `schema.sql` import has none until `uni.list.cron.php` runs.
- **The picker lists lag the cron by up to an hour**: `universes.inc.php` caches them in
  `pfg-universes-<hash>.json` under `sys_get_temp_dir()`. Delete that file to see a fresh
  `universes` table at once; a database failure is never cached.
- **`population_data.timestamp` is Gameforge's file timestamp, not the run time.** For when the
  job last ran use `updated_at`, or the job stamp in `ajax.php?service=health` (`jobs.population`,
  `jobs.uni-list`).
- `fleetIgnoreEmptySystems` and `fleetIgnoreInactiveSystems` are **independent** flags; a
  universe can have either, both or neither. Flight picks `population` or `population_all`
  from the pair.
- The crons run on each host separately against that host's own database; the schedule and the
  `pfg-cron-run` wrapper are in `deploy/README.md`.
