# OGame - Trade calculator - Resource exchange

**URL:** `http://pfg.wmp/ogame/calc/trade.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,trading calculator,trade calculator,resource exchange

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/trade.php` |
| Template | `www/ogame/calc/trade.tpl` |
| JavaScript | `www/ogame/calc/js/trade.js` |
| CSS | `www/ogame/calc/css/trade.css` |
| Tests | ✅ `playwright-tests/tests/trade.spec.js` |

## Code Statistics

- JavaScript functions: 19

## Usage

1. Navigate to [OGame - Trade calculator - Resource exchange](http://pfg.wmp/ogame/calc/trade.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── trade.php      # Controller
├── trade.tpl      # Template
├── js/trade.js    # Logic
└── css/trade.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test trade
```

### Translation

Translation key: `trade`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
