# OGame - Moons calculator

**URL:** `http://pfg.wmp/ogame/calc/moon.php`

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/moon.php` |
| Template | `www/ogame/calc/moon.tpl` |
| JavaScript | `www/ogame/calc/js/moon.js` |
| CSS | `www/ogame/calc/css/moon.css` |
| Tests | ✅ `playwright-tests/tests/moon.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `moonSize`
- `dsCount`
- `debrisPercent`
- `hyperTechLvl`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 3

## Usage

1. Navigate to [OGame - Moons calculator](http://pfg.wmp/ogame/calc/moon.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── moon.php      # Controller
├── moon.tpl      # Template
├── js/moon.js    # Logic
└── css/moon.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test moon
```

### Translation

Translation key: `moon`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
