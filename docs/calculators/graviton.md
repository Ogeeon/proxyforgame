# OGame - Graviton calculator

**URL:** `http://pfg.wmp/ogame/calc/graviton.php`

## Description

Find how many Solar Satellites and how much energy you need to research Graviton Technology in OGame, based on your planet settings.

**Keywords:** proxyforgame,ogame,graviton calculator,graviton technology,gravitation technology,solar satellites,energy for graviton,deathstar research

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/graviton.php` |
| Template | `www/ogame/calc/graviton.tpl` |
| Stylesheet | `www/ogame/calc/css/graviton_bs.css` |
| Options cookie | `options_graviton` |
| E2E test | ✅ `playwright-tests/tests/graviton.spec.js` |
| Unit test | ✅ `unit-tests/graviton-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/graviton-core.js` | 222 |
| `www/ogame/calc/js/graviton-data-collector.js` | 72 |
| `www/ogame/calc/js/graviton-renderer.js` | 105 |
| `www/ogame/calc/js/graviton-orchestration.js` | 304 |
| `www/ogame/calc/js/graviton-profile.js` | 90 |

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

## Configuration Options

The calculator keeps these settings in `options_graviton`:

- `shipyardLevel`
- `nanitesFactoryLevel`
- `universeSpeed`
- `energyTechLevel`
- `hyperTechLevel`
- `maxPlanetTemp`
- `energyBonus`
- `engineer`
- `geologist`
- `technocrat`
- `admiral`
- `commander`
- `solarPlantLevel`
- `solarPlantPercent`
- `fusionPlantLevel`
- `fusionPlantPercent`
- `solarSatellitesCount`
- `solarSatellitesPercent`
- `debrisPercent`
- `playerClass`
- `isTrader`
- `energyBoost`
- `disChLevel`
- `gravitonLevel`
- `totalLFEnrgBonus`
- `scCapacityIncrease`
- `lcCapacityIncrease`
- `rcCapacityIncrease`
- `crysAvailable`
- `deutAvailable`
- `deutInDebris`
- `validate`

## Usage

1. Navigate to [OGame - Graviton calculator](http://pfg.wmp/ogame/calc/graviton.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=graviton
```

Unit tests:
```bash
node --test graviton-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `graviton`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
