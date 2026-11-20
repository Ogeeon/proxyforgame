# OGame - Calculations for the Scrap Merchant

**URL:** `http://pfg.wmp/ogame/calc/scrap.php`

## Description

Find out what the Scrap Merchant pays for your fleet and defenses in OGame: the full cost and the return in metal, crystal and deuterium, the points lost and the cargo ships to haul it away.

**Keywords:** proxyforgame,ogame,scrap merchant,scrap merchant calculator,sell fleet,sell defense,scrap rate,fleet value

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/scrap.php` |
| Template | `www/ogame/calc/scrap.tpl` |
| Stylesheet | `www/ogame/calc/css/scrap.css` |
| Options cookie | `options_scrap` |
| E2E test | ✅ `playwright-tests/tests/scrap.spec.js` |
| Unit test | ✅ `unit-tests/scrap-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/scrap-core.js` | 413 |
| `www/ogame/calc/js/scrap-fleetsave.js` | 217 |
| `www/ogame/calc/js/scrap-data-collector.js` | 163 |
| `www/ogame/calc/js/scrap-renderer.js` | 215 |
| `www/ogame/calc/js/scrap-orchestration.js` | 509 |
| `www/ogame/calc/js/scrap-profile.js` | 339 |

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
- `www/ogame/calc/js/ogame-universe.js`
- `www/ogame/calc/js/ogame-cargo.js`
- `www/ogame/calc/js/flight-core.js`
- `www/ogame/calc/js/own-api.js`

## Configuration Options

The calculator keeps these settings in `options_scrap`:

- `fullNumbers`
- `eventRate`
- `eventDays`
- `routeKind`
- `routeDelta`
- `fsSpeed`
- `fsTimes`
- `fsDays`
- `cmbDrive`
- `impDrive`
- `hypDrive`
- `fuelDiscount`
- `rateMetal`
- `rateCrystal`
- `rateDeut`
- `validate`

## Usage

1. Navigate to [OGame - Calculations for the Scrap Merchant](http://pfg.wmp/ogame/calc/scrap.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=scrap
```

Unit tests:
```bash
node --test scrap-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `scrap`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
