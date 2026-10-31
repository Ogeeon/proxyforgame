# OGame - Production speed calculator

**URL:** `http://pfg.wmp/ogame/calc/production.php`

## Description

Calculate metal, crystal, and deuterium production, energy use, and mine upgrade payback for one planet or your entire OGame empire.

**Keywords:** proxyforgame,ogame,production calculator,resource production,production speed,energy balance,energy production,mine profitability,amortization,payback,crawlers

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/production.php` |
| Template | `www/ogame/calc/production.tpl` |
| Stylesheet | `www/ogame/calc/css/production.css` |
| Options cookie | `options_production` |
| E2E test | ✅ `playwright-tests/tests/production.spec.js` |
| Unit test | ✅ `unit-tests/production-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/production-core.js` | 570 |
| `www/ogame/calc/js/production-data-collector.js` | 147 |
| `www/ogame/calc/js/production-renderer.js` | 221 |
| `www/ogame/calc/js/production-orchestration.js` | 1203 |
| `www/ogame/calc/js/production-profile.js` | 560 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/js/api-client.js`
- `www/ogame/calc/js/ogame-production.js`
- `www/ogame/calc/js/ogame-costs.js`
- `www/ogame/calc/js/ogame-lifeform.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/js/profiles-core.js`
- `www/ogame/calc/js/profiles-store.js`
- `www/ogame/calc/js/profiles-fields.js`
- `www/ogame/calc/js/profiles-widgets.js`
- `www/ogame/calc/js/profiles-binders.js`
- `www/ogame/calc/js/profiles-ui.js`

## Configuration Options

The calculator keeps these settings in `options_production`:

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
- `onePlnRace`
- `onePlnLfLevels`
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
- `ratesFmt`
- `isTrader`
- `lfMetProdBonus`
- `lfCrysProdBonus`
- `lfDeutProdBonus`
- `lfEnergyProdBonus`
- `lfCollectorBonus`
- `lfCrawlerBonus`
- `lfPlasmaCostReduction`
- `lfResLevels`
- `lfResAvail`
- `lfTechBonus`
- `lfResearchCostReduction`
- `validate`

## Usage

1. Navigate to [OGame - Production speed calculator](http://pfg.wmp/ogame/calc/production.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=production
```

Unit tests:
```bash
node --test production-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `production`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
