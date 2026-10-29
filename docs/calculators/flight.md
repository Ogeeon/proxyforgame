# OGame - Flight time and savepoints calculator

**URL:** `http://pfg.wmp/ogame/calc/flight.php`

## Description

Calculate fleet flight time, deuterium consumption, and the best departure time in OGame, based on universe speed, ships, and flight mode.

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
| `www/ogame/calc/js/flight-core.js` | 440 |
| `www/ogame/calc/js/flight-data-collector.js` | 233 |
| `www/ogame/calc/js/flight-renderer.js` | 285 |
| `www/ogame/calc/js/flight-orchestration.js` | 2162 |
| `www/ogame/calc/js/flight-profile.js` | 295 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/js/api-client.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/profiles-core.js`
- `www/ogame/calc/js/profiles-store.js`
- `www/ogame/calc/js/profiles-fields.js`
- `www/ogame/calc/js/profiles-widgets.js`
- `www/ogame/calc/js/profiles-binders.js`
- `www/ogame/calc/js/profiles-ui.js`
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
- `warriorBonus`
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
