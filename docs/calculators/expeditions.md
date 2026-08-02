# OGame - Expeditions calculator

**URL:** `http://pfg.wmp/ogame/calc/expeditions.php`

**Keywords:** proxyforgame,ogame,expedition calculator,expeditions,expedition resources,expedition ships,dark matter,expedition finds

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/expeditions.php` |
| Template | `www/ogame/calc/expeditions.tpl` |
| Stylesheet | `www/ogame/calc/css/expeditions_bs.css` |
| Options cookie | `options_expeditions` |
| E2E test | ✅ `playwright-tests/tests/expeditions.spec.js` |
| Unit test | ✅ `unit-tests/expeditions-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/expeditions-core.js` | 223 |
| `www/ogame/calc/js/expeditions-data-collector.js` | 59 |
| `www/ogame/calc/js/expeditions-renderer.js` | 75 |
| `www/ogame/calc/js/expeditions-orchestration.js` | 381 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/own-api.js`

## Configuration Options

The calculator keeps these settings in `options_expeditions`:

- `highTop`
- `playerClass`
- `universeSpeed`
- `hyperTechLevel`
- `percentRes`
- `percentShips`
- `classBonusCollector`
- `classBonusDiscoverer`
- `darkMatterDiscoveryBonus`
- `resourceDiscoveryBooster`
- `fleet`
- `lfShipsBonuses`
- `validate`

## Usage

1. Navigate to [OGame - Expeditions calculator](http://pfg.wmp/ogame/calc/expeditions.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=expeditions
```

Unit tests:
```bash
node --test expeditions-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `expeditions`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
