# OGame - Moons calculator

**URL:** `http://pfg.wmp/ogame/calc/moon.php`

**Keywords:** proxyforgame,ogame,moon calculator,moon chance,debris field,moon destruction,lunar base,recyclers,deathstar,Sensor phalanx

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/moon.php` |
| Template | `www/ogame/calc/moon.tpl` |
| Stylesheet | `www/ogame/calc/css/moon_bs.css` |
| Options cookie | `options_moon` |
| E2E test | ✅ `playwright-tests/tests/moon.spec.js` |
| Unit test | ✅ `unit-tests/moon-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/moon-core.js` | 443 |
| `www/ogame/calc/js/moon-data-collector.js` | 57 |
| `www/ogame/calc/js/moon-renderer.js` | 152 |
| `www/ogame/calc/js/moon-orchestration.js` | 300 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/ogame/calc/js/dom-utils.js`

## Configuration Options

The calculator keeps these settings in `options_moon`:

- `moonSize`
- `dsCount`
- `debrisPercent`
- `hyperTechLevel`
- `isGeneral`
- `rcCapacityIncrease`
- `defenseToDebris`
- `deutToDebris`
- `promoMoon`
- `supraRefractorLevel`
- `phalanxLevel`
- `phalanxRangeBonus`
- `isDiscoverer`
- `discovererBonus`
- `ownSystem`
- `targetSystem`
- `circularSystems`
- `numberOfSystems`
- `validate`

## Usage

1. Navigate to [OGame - Moons calculator](http://pfg.wmp/ogame/calc/moon.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=moon
```

Unit tests:
```bash
node --test moon-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `moon`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
