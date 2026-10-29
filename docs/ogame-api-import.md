# Importing game data from OGame

Two calculators read data the player copies out of the game. Everything below is hand-maintained:
`docs/calculators/*.md` is machine output (`make docs` overwrites it), so nothing here belongs there.

## The API 2 export

The game's **Fleet** page carries a field labelled **API 2**. It holds one line of JSON describing
the player's own planet:

```json
{
  "coords": "5:254:14",
  "characterClassId": 3,
  "allianceClassId": 2,
  "researches": { "114": 9, "115": 14, "117": 10, "118": 8 },
  "ships": { "204": { "amount": 407, "cargo": 0.003066, "speed": 0.003066, "fuel": 0.0006324 } },
  "defenses": { "401": { "amount": 26100 } },
  "missiles": { "502": { "amount": 0 } },
  "bonuses": { "characterClassBooster": { "1": 0, "2": 0, "3": 0 } },
  "fleetspeed": 10
}
```

Worth knowing:

- The per-ship `cargo`, `speed` and `fuel` values are **fractions**, not percentages: `0.003066`
  is a bonus of `0.3066%`. They carry the life-form bonuses only — the player class bonus and the
  hyperspace technology are separate inputs in both calculators, so a calculator that added them
  again would double-count.
- `characterClassId` is 1/2/3 for collector/general/discoverer; `allianceClassId` is 1/2/3 for warrior/trader/researcher (the order the OValue Exporter userscript maps for the same `accountInfo` field; the spy report's `defender_alliance_class_id` uses the same ids).
- `fleetspeed` and the rest of the universe settings are **ignored on purpose**: the export names
  no fleet-speed variant, so the value cannot be attached to one of the three fields the flight
  calculator has. Use the country/universe selects for that.

`www/ogame/calc/js/own-api.js` is the single parser. `parseOwnApi(text)` returns a normalized
payload (coordinates split into numbers, the class boosters lifted out of `bonuses`, every bonus
already converted to a percentage) or `null` when the text is not a JSON object. It is covered by
`unit-tests/own-api.test.js` and, being shared, forces a full `make test` — see `docs/test-scope.md`.

- `ships` and `researches` are keyed by **tech id**, and the parser keeps nothing else: a named key
  belongs to some other JSON, not to an export.
- A non-empty `ships` block is **no proof of an importable fleet**. The export lists the solar
  satellite, the crawler and the whole defense (`401`+) there too, so each calculator decides for
  itself by matching the ids it has a field for. Both clear those fields before they write, so an
  export that matches nothing has to be refused rather than applied — otherwise it wipes the page
  and reports success.

## Who reads what

| Calculator | Entry point | What it takes |
|------------|-------------|---------------|
| `flight` | **Import from OGame** button (`#import-own-api`), clipboard icon above the parameters | Coordinates, character and alliance class, drive researches and hypertech, ship counts, per-ship life-form bonuses, class boosters. Checkboxes in the dialog select the categories. |
| `expeditions` | The **API 2** field in the cargo-bonus reader (`#open-lfbr` on the cargo-bonus tab) | Nothing but `ships[*].cargo`, written into the per-ship bonus table. |

The flight calculator also imports **spy reports** through their `sr-...` API code
(`#api-code` + `#api-get`, fetched by `ajax.php`). That payload is a different shape but states the
per-ship bonuses as the same fractions, so it shares `bonusPercent()` with the API 2 path.

## The account export

The **Origin Exporter** userscript (and the PfG Companion, which wraps it) copies the whole account
out of the game as one JSON document: `playerId`, `characterClassId`, `allianceClassId`, `officers`,
`researches`, `species`, `planets` and `moons` keyed by the game's ids, `speciesBonuses`,
`bonusByType`, `schemaVersion` and `exportedAt`. Schema 2 adds a `universe` block
(`{language, number, ...}`); schema 1 does not name its universe. The Companion may add
`pfgCompanion.productionFactors` (each planet's production settings, by tech id) and hands several
exports over as `{version: 1, exports: [...]}`.

`parseAccountExport()` / `normalizeAccountExport()` in `www/ogame/calc/js/profiles-core.js` are the
one reader. The player profiles import through them, and so does the MCP tool
`ogame_import_account` (`mcp/tools/import-account.js`), which maps the normalized values onto the
other tools' argument names. An unknown `schemaVersion` is refused, never read best-effort.

### Available resources

Every full export carries each body's stored resources, `planets[id].resources` and
`moons[id].resources` (`{metal, crystal, deuterium, energy}`), as of `exportedAt`. The Companion
may add newer readings it took off the resource bar of a game page since:

```json
"pfgCompanion": {
  "resources": {
    "33620011": { "metal": 1234567, "crystal": 456789, "deuterium": 98765, "at": "2026-10-29T12:34:56.000Z" }
  }
}
```

keyed by the body's game id, `at` being when that body's bar was read — an ISO string like
`exportedAt`, or Unix milliseconds; the site normalizes both to milliseconds. `exportResources()`
in `profiles-core.js` takes a body's Companion reading whenever there is one, whatever the two
times say, and the export's own `resources` only for a body Companion has no entry for (an export
from another tool). Companion seeds its entry from the export's `resources` with their true time,
but moves `exportedAt` to "now" on saves that do not refetch the account (the Resource Settings
save, a `speciesBonuses` retry), so comparing against `exportedAt` would let a stale reading win.
It reads only metal, crystal and deuterium, drops a Companion entry for a body the export does not list and
an entry missing any of the three, and never extrapolates a reading to "now".

The profile keeps them in `profile.resources`, by game id — **not** a game layer: no mark, no
"restore game value", not counted by the badge, and not written to the profiles backup file (a
restore keeps the readings the profile already has). A later import or Sync takes a body's reading
only when its `at` is newer, independently of whether the export as a whole is newer, and drops the
readings of bodies the profile no longer has. `PfBodyResources` (`profiles-widgets.js`) fills the
"resources available" fields of graviton, terraformer, costs, LF costs and production's one-planet
tab from the body shown, with a "Game data as of …" caption that turns to the warning colour after
an hour. The MCP tool leaves resources out.

### What a trimmed export may leave out

The Companion's "copy for AI" sends a trimmed export to keep it small in a model's context — about
16 KB instead of 38 KB for an 8-planet account. It is the same document under the same
`schemaVersion`, and the normalizer must keep accepting it:

- planets and moons carry no `resources`, `defenses` or `baseProduction`, and there is no
  `pfgCompanion.resources` — a trimmed export brings no available resources;
- every entry of `speciesBonuses` is reduced to its `totalBonus` — the normalizer reads nothing else
  of an entry (`spaceObjectBonus`, `technologyBonus`, the maxima go).

Everything else stays as exported. `unit-tests/mcp-server.test.js` trims
`playwright-tests/fixtures/account-export-large.json` (a synthetic 8-planet account) this way and
checks that the tool's answer does not change.

## The two bonus sources in the expeditions calculator

The cargo-bonus reader accepts either input, in one dialog:

1. the text of the game's ship-bonus table, pasted into the textarea — parsed by counting
   eight-line blocks from the line that names the small cargo;
2. the API 2 export, pasted into the single-line field.

They are **mutually exclusive and the export wins**: it is machine data, independent of line order
and of localized ship names. So `readBonuses()` tries the export first, falls back to the report,
and only when neither yields anything shows one message (`no-bonus-data-msg`) and keeps the dialog
open. A source that loses says nothing about why.

An accepted export **clears the whole table first**. It lists every ship the player can build, so a
ship missing from it has no bonus — not the value left over from an earlier read.

That clearing is why an export only counts as accepted once at least one of the fifteen expedition
ships has been matched. A payload naming none of them — defenses alone, or unrelated JSON with a
`ships` key — is handed on to the report instead, and the table is left as it was.
