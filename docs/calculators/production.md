# OGame - Production speed calculator

**URL:** `http://pfg.wmp/ogame/calc/production.php`

**Keywords:** proxyforgame,proxy,online,browser,game,tool,calc,calculator,ogame,production speed,resource production,resource accumulation,energy balance,energy production,amortization,payback,resource recovery

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/production.php` |
| Template | `www/ogame/calc/production.tpl` |
| JavaScript | `www/ogame/calc/js/production.js` |
| CSS | `www/ogame/calc/css/production.css` |
| Tests | ✅ `playwright-tests/tests/production.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `energyTechLevel`
- `plasmaTechLevel`
- `universeSpeed`
- `geologist`
- `engineer`
- `technocrat`
- `admiral`
- `commander`
- `maxTempEntered`
- `maxPlanetTemp`
- `onePlnExtView`
- `oPPP`
- `metStorageLvl`
- `crysStorageLvl`
- `deutStorageLvl`
- `currPlanetsCount`
- `aPPP`
- `aPB`
- `playerClass`
- `planetPos`
- `energyBoost`
- `aPS`
- `aPNames`
- `showAddInf`
- `inclSats`
- `rates`
- `isTrader`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 30

## Usage

1. Navigate to [OGame - Production speed calculator](http://pfg.wmp/ogame/calc/production.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── production.php      # Controller
├── production.tpl      # Template
├── js/production.js    # Logic
└── css/production.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test production
```

### Translation

Translation key: `production`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
