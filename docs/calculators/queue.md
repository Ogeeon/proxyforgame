# OGame - Construction queue

**URL:** `http://pfg.wmp/ogame/calc/queue.php`

**Keywords:** proxyforgame,ogame,construction queue,build queue,build order,building time,queue calculator,buildings costs

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/queue.php` |
| Template | `www/ogame/calc/queue.tpl` |
| Stylesheet | `www/ogame/calc/css/queue_bs.css` |
| Options cookie | `options_queue` |
| E2E test | ✅ `playwright-tests/tests/queue.spec.js` |
| Unit test | ❌ none |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/queue-core.js` | 128 |
| `www/ogame/calc/js/queue-data-collector.js` | 87 |
| `www/ogame/calc/js/queue-renderer.js` | 182 |
| `www/ogame/calc/js/queue-orchestration.js` | 547 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/ogame-costs.js`
- `www/ogame/calc/js/dom-utils.js`

## Configuration Options

The calculator keeps these settings in `options_queue`:

- `universeSpeed`
- `ionTechLevel`
- `hyperTechLevel`
- `playerClass`
- `scCapacityIncrease`
- `lcCapacityIncrease`
- `totFldPln`
- `totFldMn`
- `sDTP`
- `sDTM`
- `slp`
- `slm`
- `qp`
- `qm`
- `validate`

## Usage

1. Navigate to [OGame - Construction queue](http://pfg.wmp/ogame/calc/queue.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=queue
```

### Translation

Translation key: `queue`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
