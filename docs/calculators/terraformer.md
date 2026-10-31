# OGame - Terraformer calculator

**URL:** `http://pfg.wmp/ogame/calc/terraformer.php`

## Description

Calculate the energy, resources, and time needed to terraform an OGame planet, including Solar Satellites and bonuses.

**Keywords:** proxyforgame,ogame,terraformer calculator,terraformer,planet fields,solar satellites,energy requirement,nanite factory

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/terraformer.php` |
| Template | `www/ogame/calc/terraformer.tpl` |
| Stylesheet | `www/ogame/calc/css/terraformer.css` |
| Options cookie | `options_terraformer` |
| E2E test | ✅ `playwright-tests/tests/terraformer.spec.js` |
| Unit test | ✅ `unit-tests/terraformer-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/terraformer-core.js` | 267 |
| `www/ogame/calc/js/terraformer-data-collector.js` | 73 |
| `www/ogame/calc/js/terraformer-renderer.js` | 107 |
| `www/ogame/calc/js/terraformer-orchestration.js` | 346 |
| `www/ogame/calc/js/terraformer-profile.js` | 119 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/js/api-client.js`
- `www/ogame/calc/js/ogame-costs.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/profiles-core.js`
- `www/ogame/calc/js/profiles-store.js`
- `www/ogame/calc/js/profiles-fields.js`
- `www/ogame/calc/js/profiles-widgets.js`
- `www/ogame/calc/js/profiles-binders.js`
- `www/ogame/calc/js/profiles-ui.js`

## Configuration Options

The calculator keeps these settings in `options_terraformer`:

- `robotsFactoryLevel`
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
- `playerClass`
- `isTrader`
- `energyBoost`
- `disChLevel`
- `totalLFEnrgBonus`
- `lfTerraformerRdc`
- `scCapacityIncrease`
- `lcCapacityIncrease`
- `tfSingleLevel`
- `tfLevelFrom`
- `tfLevelTo`
- `crysAvailable`
- `deutAvailable`
- `validate`

## Usage

1. Navigate to [OGame - Terraformer calculator](http://pfg.wmp/ogame/calc/terraformer.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=terraformer
```

Unit tests:
```bash
node --test terraformer-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `terraformer`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
