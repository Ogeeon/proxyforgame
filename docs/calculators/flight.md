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
