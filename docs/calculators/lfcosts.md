# OGame - Costs calculator for LifeForms

**URL:** `http://pfg.wmp/ogame/calc/lfcosts.php`

**Keywords:** proxyforgame,proxy,online,calc,calculator,ogame,price calculation,cost calculation,buildings costs,research costs,fleet costs,defence costs,costs calculator,prices calculator,lifeforms

## Technical Details

| Property | Value |
|----------|-------|
| PHP Controller | `www/ogame/calc/lfcosts.php` |
| Template | `www/ogame/calc/lfcosts.tpl` |
| JavaScript | `www/ogame/calc/js/lfcosts.js` |
| CSS | `www/ogame/calc/css/lfcosts.css` |
| Tests | ✅ `playwright-tests/tests/lfcosts.spec.js` |

## Configuration Options

The calculator supports the following options (stored in cookies):

- `robotFactoryLevel`
- `naniteFactoryLevel`
- `universeSpeed`
- `ionTechLevel`
- `hyperTechLevel`
- `playerClass`
- `fullNumbers`
- `tabsState`
- `capIncrSC`
- `capIncrLC`
- `megalithLvl`
- `mineralResCntrLvl`
- `researchCostReduction`
- `researchTimeReduction`
- `validate`
- `default`

## Code Statistics

- JavaScript functions: 10

## Usage

1. Navigate to [OGame - Costs calculator for LifeForms](http://pfg.wmp/ogame/calc/lfcosts.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### File Structure

```
www/ogame/calc/
├── lfcosts.php      # Controller
├── lfcosts.tpl      # Template
├── js/lfcosts.js    # Logic
└── css/lfcosts.css  # Styles
```

### Testing

Run tests:
```bash
npx playwright test lfcosts
```

### Translation

Translation key: `lfcosts`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
