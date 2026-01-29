# OGame - Costs calculator

**URL:** `http://pfg.wmp/ogame/calc/costs.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,price calculation,cost calculation,buildings costs,research costs,fleet costs,defence costs,costs calculator,prices calculator

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/costs.php` |
| Template | `www/ogame/calc/costs.tpl` |
| JavaScript | `www/ogame/calc/js/costs.js` |
| CSS | `www/ogame/calc/css/costs.css` |
| Tests | ✅ `playwright-tests/tests/costs.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `shipyardLevel`
- `robotFactoryLevelP`
- `robotFactoryLevelM`
- `naniteFactoryLevel`
- `universeSpeed`
- `researchSpeed`
- `researchLabLevel`
- `energyTechLevel`
- `plasmaTechLevel`
- `ionTechLevel`
- `hyperTechLevel`
- `maxPlanetTemp`
- `geologist`
- `engineer`
- `technocrat`
- `admiral`
- `commander`
- `booster`
- `researchBonus`
- `irnLevel`
- `planetsSpin`
- `labChoice`
- `labLevels`
- `playerClass`
- `planetPos`
- `fullNumbers`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 15

## Usage

1. Navigate to [OGame - Costs calculator](http://pfg.wmp/ogame/calc/costs.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── costs.php      # Controller
├── costs.tpl      # Template
├── js/costs.js    # Logic
└── css/costs.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test costs
```

### Translation

Translation key: `costs`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
