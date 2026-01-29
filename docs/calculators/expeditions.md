# Калькулятор Экспедиции OGame

**URL:** `http://pfg.wmp/ogame/calc/expeditions.php`

**Keywords:** calculator,resourses,fleet,expedition

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/expeditions.php` |
| Template | `www/ogame/calc/expeditions.tpl` |
| JavaScript | `www/ogame/calc/js/expeditions.js` |
| CSS | `www/ogame/calc/css/expeditions.css` |
| Tests | ✅ `playwright-tests/tests/expeditions.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `universeSpeed`
- `highTop`
- `playerClass`
- `hyperTechLevel`
- `percentRes`
- `percentShips`
- `classBonusCollector`
- `classBonusDiscoverer`
- `darkMatterDiscoveryBonus`
- `resourceDiscoveryBooster`
- `fleet`

## Code Statistics

- JavaScript functions: 8

## Usage

1. Navigate to [Калькулятор Экспедиции OGame](http://pfg.wmp/ogame/calc/expeditions.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── expeditions.php      # Controller
├── expeditions.tpl      # Template
├── js/expeditions.js    # Logic
└── css/expeditions.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test expeditions
```

### Translation

Translation key: `expeditions`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
