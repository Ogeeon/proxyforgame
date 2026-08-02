# OGame - Terraformer calculator

**URL:** `http://pfg.wmp/ogame/calc/terraformer.php`

**Keywords:** proxyforgame,ogame,terraformer calculator,terraformer,planet fields,solar satellites,energy requirement,nanite factory

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/terraformer.php` |
| Template | `www/ogame/calc/terraformer.tpl` |
| Stylesheet | `www/ogame/calc/css/terraformer_bs.css` |
| Options cookie | `options_terraformer` |
| E2E test | ✅ `playwright-tests/tests/terraformer.spec.js` |
| Unit test | ✅ `unit-tests/terraformer-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/terraformer-core.js` | 225 |
| `www/ogame/calc/js/terraformer-data-collector.js` | 68 |
| `www/ogame/calc/js/terraformer-renderer.js` | 107 |
| `www/ogame/calc/js/terraformer-orchestration.js` | 323 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/common.js`
- `www/ogame/calc/js/dom-utils.js`

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
