# OGame - Construction queue

**URL:** `http://pfg.wmp/ogame/calc/queue.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,price calculation,cost calculation,buildings costs,research costs,fleet costs,defence costs,costs calculator,prices calculator

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/queue.php` |
| Template | `www/ogame/calc/queue.tpl` |
| JavaScript | `www/ogame/calc/js/queue.js` |
| CSS | `www/ogame/calc/css/queue.css` |
| Tests | ✅ `playwright-tests/tests/queue.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `universeSpeed`
- `ionTechLevel`
- `hyperTechLevel`
- `totFldPln`
- `totFldMn`
- `sDTP`
- `sDTM`
- `slp`
- `slm`
- `qp`
- `qm`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 16

## Usage

1. Navigate to [OGame - Construction queue](http://pfg.wmp/ogame/calc/queue.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── queue.php      # Controller
├── queue.tpl      # Template
├── js/queue.js    # Logic
└── css/queue.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test queue
```

### Translation

Translation key: `queue`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
