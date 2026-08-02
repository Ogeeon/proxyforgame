# OGame - Trade calculator - Resource exchange

**URL:** `http://pfg.wmp/ogame/calc/trade.php`

**Keywords:** proxyforgame,ogame,trade calculator,resource exchange,trade ratio,metal crystal deuterium,merchant,resource trade

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/trade.php` |
| Template | `www/ogame/calc/trade.tpl` |
| Stylesheet | `www/ogame/calc/css/trade.css` |
| Options cookie | `options_trade` |
| E2E test | ✅ `playwright-tests/tests/trade.spec.js` |
| Unit test | ✅ `unit-tests/trade-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/trade-core.js` | 410 |
| `www/ogame/calc/js/trade.js` | 963 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/dom-utils.js`

## Configuration Options

The calculator keeps these settings in `options_trade`:

- `metal`
- `crystal`
- `deuterium`
- `fix1`
- `fix2`
- `rates`
- `srcType`
- `dstType`
- `dstMixType`
- `mixBalance`
- `mixProp1`
- `mixProp2`
- `country`
- `universe`
- `coordg`
- `coords`
- `coordp`
- `moon`
- `hyperTech`
- `playerClass`
- `scCapacityIncrease`
- `lcCapacityIncrease`
- `decimalSeparator`
- `validate`
- `load`
- `save`
- `_parseUrlParams`
- `_parseRatesFromParams`
- `_parseTypesFromParams`
- `_parseMixFromParams`
- `_parseResourcesFromParams`
- `_parseLocationFromParams`
- `parseFromUri`
- `_buildMixTypeParams`
- `_buildResourceParams`
- `_buildCoordinateParams`
- `makeUri`
- `makeString`
- `_addResourceIfNeeded`
- `_formatSourceResources`
- `_formatDestinationResources`
- `_formatCoordinates`

## Usage

1. Navigate to [OGame - Trade calculator - Resource exchange](http://pfg.wmp/ogame/calc/trade.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=trade
```

Unit tests:
```bash
node --test trade-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `trade`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
