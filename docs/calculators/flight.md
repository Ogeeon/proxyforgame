# OGame - Flight time and savepoints calculator

**URL:** `http://pfg.wmp/ogame/calc/flight.php`

**Keywords:** proxyforgame,ogame,flight time calculator,flight duration,savepoints,save,fleet speed,deuterium consumption,fuel consumption

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/flight.php` |
| Template | `www/ogame/calc/flight.tpl` |
| Stylesheet | `www/ogame/calc/css/flight_bs.css` |
| Options cookie | `options_flight` |
| E2E test | ✅ `playwright-tests/tests/flight.spec.js` |
| Unit test | ✅ `unit-tests/flight-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/flight-core.js` | 380 |
| `www/ogame/calc/js/flight-data-collector.js` | 233 |
| `www/ogame/calc/js/flight-renderer.js` | 257 |
| `www/ogame/calc/js/flight-orchestration.js` | 2043 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/own-api.js`

## Configuration Options

The calculator keeps these settings in `options_flight`:

- `country`
- `universe`
- `driveLevels`
- `fleetSpeedWar`
- `fleetSpeedPeaceful`
- `fleetSpeedHolding`
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
- `saveOneWay`
- `recallStartDT`
- `recallFullFlight`
- `recallMode`
- `recallMomentDT`
- `recallElapsed`
- `mode`
- `missionType`
- `hyperTechLvl`
- `flightData`
- `playerClass`
- `traderBonus`
- `spCargohold`
- `lfMechanGE`
- `lfRocktalCE`
- `lfShipsBonuses`
- `fleetIgnoreEmptySystems`
- `fleetIgnoreInactiveSystems`
- `validate`

## Usage

1. Navigate to [OGame - Flight time and savepoints calculator](http://pfg.wmp/ogame/calc/flight.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=flight
```

Unit tests:
```bash
node --test flight-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `flight`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
