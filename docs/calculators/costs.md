# OGame - Costs calculator

**URL:** `http://pfg.wmp/ogame/calc/costs.php`

**Keywords:** proxyforgame,ogame,ogame cost calculator,price calculator,building costs,research costs,fleet costs,defence costs,construction costs,resource costs

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/costs.php` |
| Template | `www/ogame/calc/costs.tpl` |
| Stylesheet | `www/ogame/calc/css/costs_bs.css` |
| Options cookie | none |
| E2E test | ✅ `playwright-tests/tests/costs.spec.js` |
| Unit test | ❌ none |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/costs-core.js` | 821 |
| `www/ogame/calc/js/costs-data-collector.js` | 760 |
| `www/ogame/calc/js/costs-renderer.js` | 691 |
| `www/ogame/calc/js/costs-orchestration.js` | 2089 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/ogame-production.js`
- `www/ogame/calc/js/ogame-costs.js`
- `www/ogame/calc/js/dom-utils.js`

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

### Translation

Translation key: `costs`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
