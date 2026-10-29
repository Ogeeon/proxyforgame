# OGame - Costs calculator

**URL:** `http://pfg.wmp/ogame/calc/costs.php`

## Description

Calculate the cost and build time of buildings, research, ships, and defenses in OGame, including universe speed and bonuses.

**Keywords:** proxyforgame,ogame,ogame cost calculator,price calculator,building costs,research costs,fleet costs,defence costs,construction costs,resource costs

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/costs.php` |
| Template | `www/ogame/calc/costs.tpl` |
| Stylesheet | `www/ogame/calc/css/costs_bs.css` |
| Options cookie | none |
| E2E test | ✅ `playwright-tests/tests/costs.spec.js` |
| Unit test | ✅ `unit-tests/costs-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/costs-core.js` | 919 |
| `www/ogame/calc/js/costs-data-collector.js` | 642 |
| `www/ogame/calc/js/costs-renderer.js` | 676 |
| `www/ogame/calc/js/costs-orchestration.js` | 2374 |
| `www/ogame/calc/js/costs-profile.js` | 722 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/js/api-client.js`
- `www/ogame/calc/js/ogame-production.js`
- `www/ogame/calc/js/ogame-costs.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/profiles-core.js`
- `www/ogame/calc/js/profiles-store.js`
- `www/ogame/calc/js/profiles-fields.js`
- `www/ogame/calc/js/profiles-widgets.js`
- `www/ogame/calc/js/profiles-binders.js`
- `www/ogame/calc/js/profiles-ui.js`

## Usage

1. Navigate to [OGame - Costs calculator](http://pfg.wmp/ogame/calc/costs.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=costs
```

Unit tests:
```bash
node --test costs-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `costs`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
