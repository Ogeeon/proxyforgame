# OGame - Flight time and savepoints calculator

**URL:** `http://pfg.wmp/ogame/calc/flight.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,save,flight,flight time calculator,savepoints,fuel comsumption,deuterium comsumption

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/flight.php` |
| Template | `www/ogame/calc/flight.tpl` |
| JavaScript | `www/ogame/calc/js/flight.js` |
| CSS | `www/ogame/calc/css/flight.css` |
| Tests | ✅ `playwright-tests/tests/flight.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `driveLevels`
- `uniSpeed`
- `circularGalaxies`
- `circularSystems`
- `numberOfGalaxies`
- `numberOfSystems`
- `deutFactor`
- `deutConsReduction`
- `departure`
- `destination`
- `ships`
- `startDT`
- `saveStartDT`
- `saveReturnDT`
- `saveTolerance`
- `mode`
- `hyperTechLvl`
- `flightData`
- `playerClass`
- `traderBonus`
- `spCargohold`
- `lfMechanGE`
- `lfRocktalCE`
- `lfShipsBonuses`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 44

## Usage

1. Navigate to [OGame - Flight time and savepoints calculator](http://pfg.wmp/ogame/calc/flight.php)
2. Configure input parameters
3. View calculated results

## Importing game data

Two importers fill the form from the game:

- **Spy report** — the `sr-...` API code goes into the field next to the universe selects
  (`#api-code`), and `ajax.php` fetches the report.
- **Import from OGame** (`#import-own-api`) — the contents of the **API 2** field on the game's
  *Fleet* page. It is one line of JSON describing the player's own planet: coordinates, character
  and alliance class, researches, ship counts, per-ship life-form bonuses and the class boosters.
  The checkboxes in the dialog pick which of those categories to apply. The universe data in the
  export (`fleetspeed` and friends) is ignored on purpose — use the country/universe selects for it.

Both are parsed by the shared normalizer in `www/ogame/calc/js/own-api.js`, so the bonus
fractions the game sends become percentages in exactly one place.

## Development Notes

### File Structure

```
www/ogame/calc/
├── flight.php      # Controller
├── flight.tpl      # Template
├── js/flight.js    # Logic
└── css/flight.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test flight
```

### Translation

Translation key: `flight`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
