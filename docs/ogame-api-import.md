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
- `characterClassId` is 1/2/3 for collector/general/discoverer; `allianceClassId` 2 is the trader.
- `fleetspeed` and the rest of the universe settings are **ignored on purpose**: the export names
  no fleet-speed variant, so the value cannot be attached to one of the three fields the flight
  calculator has. Use the country/universe selects for that.

`www/ogame/calc/js/own-api.js` is the single parser. `parseOwnApi(text)` returns a normalized
payload (coordinates split into numbers, the class boosters lifted out of `bonuses`, every bonus
already converted to a percentage) or `null` when the text is not a JSON object. It is covered by
`unit-tests/own-api.test.js` and, being shared, forces a full `make test` — see `docs/test-scope.md`.

## Who reads what

| Calculator | Entry point | What it takes |
|------------|-------------|---------------|
| `flight` | **Import from OGame** button (`#import-own-api`), clipboard icon above the parameters | Coordinates, character and alliance class, drive researches and hypertech, ship counts, per-ship life-form bonuses, class boosters. Checkboxes in the dialog select the categories. |
| `expeditions` | The **API 2** field in the cargo-bonus reader (`#open-lfbr` on the cargo-bonus tab) | Nothing but `ships[*].cargo`, written into the per-ship bonus table. |

The flight calculator also imports **spy reports** through their `sr-...` API code
(`#api-code` + `#api-get`, fetched by `ajax.php`). That payload is a different shape but states the
per-ship bonuses as the same fractions, so it shares `bonusPercent()` with the API 2 path.

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
