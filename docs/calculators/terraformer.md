# OGame - Terraformer calculator

**URL:** `http://pfg.wmp/ogame/calc/terraformer.php`

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/terraformer.php` |
| Template | `www/ogame/calc/terraformer.tpl` |
| JavaScript | `www/ogame/calc/js/terraformer.js` |
| CSS | `www/ogame/calc/css/terraformer.css` |
| Tests | ✅ `playwright-tests/tests/terraformer.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `shipyardLevel`
- `robotsFactoryLevel`
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
- `tfSingleLevel`
- `tfLevelFrom`
- `tfLevelTo`
- `isCollector`
- `energyBoost`
- `isTrader`
- `disChLevel`
- `totalLFEnrgBonus`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 2

## Usage

1. Navigate to [OGame - Terraformer calculator](http://pfg.wmp/ogame/calc/terraformer.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── terraformer.php      # Controller
├── terraformer.tpl      # Template
├── js/terraformer.js    # Logic
└── css/terraformer.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test terraformer
```

### Translation

Translation key: `terraformer`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
