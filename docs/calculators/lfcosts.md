# OGame - Costs calculator for LifeForms

**URL:** `http://pfg.wmp/ogame/calc/lfcosts.php`

## Description

Calculate the cost and build time of Lifeform buildings and research in OGame, including race and technology bonuses.

**Keywords:** proxyforgame,ogame,lifeforms,lifeform calculator,lifeform buildings,lifeform research,lifeform costs,building costs,research costs,cost calculator

## Technical Details

| Property | Value |
|----------|-------|
| PHP controller | `www/ogame/calc/lfcosts.php` |
| Template | `www/ogame/calc/lfcosts.tpl` |
| Stylesheet | `www/ogame/calc/css/costs.css` |
| Options cookie | `options_lfcosts` |
| E2E test | ✅ `playwright-tests/tests/lfcosts.spec.js` |
| Unit test | ✅ `unit-tests/lfcosts-core.test.js` |

## JavaScript Modules

| File | Lines |
|------|-------|
| `www/ogame/calc/js/lfcosts-core.js` | 97 |
| `www/ogame/calc/js/lfcosts-data-collector.js` | 73 |
| `www/ogame/calc/js/lfcosts-renderer.js` | 316 |
| `www/ogame/calc/js/lfcosts-orchestration.js` | 802 |
| `www/ogame/calc/js/lfcosts-profile.js` | 222 |

The page also loads these shared scripts:

- `www/js/utils.js`
- `www/js/api-client.js`
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

The calculator keeps these settings in `options_lfcosts`:

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
- `resCentreLvl`
- `runeTechLvl`
- `rbtResCentreLvl`
- `vortexChamberLvl`
- `researchCostReduction`
- `researchTimeReduction`
- `rates`
- `race`
- `validate`

## Usage

1. Navigate to [OGame - Costs calculator for LifeForms](http://pfg.wmp/ogame/calc/lfcosts.php)
2. Configure input parameters
3. View calculated results

## Development Notes

### Testing

Run tests:
```bash
make test-one spec=lfcosts
```

Unit tests:
```bash
node --test lfcosts-core.test.js
```

(from `unit-tests/`)

### Translation

Translation key: `lfcosts`
Translation files: `www/locale/*.json`

---

*Documentation generated automatically by scripts/generate-docs.js*
