# OGame - Flight time and savepoints calculator

**URL:** `http://pfg.wmp/ogame/calc/flight_t.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,save,flight,flight time calculator,savepoints,fuel comsumption,deuterium comsumption

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/flight_t.php` |
| Template | `www/ogame/calc/flight_t.tpl` |
| JavaScript | `www/ogame/calc/js/flight_t.js` |
| CSS | `www/ogame/calc/css/flight_t.css` |
| Tests | ✅ `playwright-tests/tests/flight_t.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `country`
- `universe`
- `driveLevels`
- `fleetSpeedWar`
- `fleetSpeedPeaceful`
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
- `fleetIgnoreEmptySystems`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 50

## Usage

1. Navigate to [OGame - Flight time and savepoints calculator](http://pfg.wmp/ogame/calc/flight_t.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── flight_t.php      # Controller
├── flight_t.tpl      # Template
├── js/flight_t.js    # Logic
└── css/flight_t.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test flight_t
```

### Translation

Translation key: `flight`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
