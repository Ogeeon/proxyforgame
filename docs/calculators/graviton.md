# OGame - Graviton calculator

**URL:** `http://pfg.wmp/ogame/calc/graviton.php`

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/graviton.php` |
| Template | `www/ogame/calc/graviton.tpl` |
| JavaScript | `www/ogame/calc/js/graviton.js` |
| CSS | `www/ogame/calc/css/graviton.css` |
| Tests | ✅ `playwright-tests/tests/graviton.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `shipyardLevel`
- `nanitesFactoryLevel`
- `universeSpeed`
- `energyTechLevel`
- `hyperTechLevel`
- `maxPlanetTemp`
- `energyBonus`
- `solarPlantLevel`
- `solarPlantPercent`
- `fusionPlantLevel`
- `fusionPlantPercent`
- `solarSatellitesCount`
- `solarSatellitesPercent`
- `debrisPercent`
- `isCollector`
- `isTrader`
- `energyBoost`
- `disChLevel`
- `gravitonLevel`
- `totalLFEnrgBonus`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 2

## Usage

1. Navigate to [OGame - Graviton calculator](http://pfg.wmp/ogame/calc/graviton.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── graviton.php      # Controller
├── graviton.tpl      # Template
├── js/graviton.js    # Logic
└── css/graviton.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test graviton
```

### Translation

Translation key: `graviton`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
