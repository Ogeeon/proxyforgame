---
paths:
  - "www/**"
  - "unit-tests/**"
  - "playwright-tests/**"
  - "mcp/**"
---

# Calculator architecture

## Calculator Structure
Calculators in `www/ogame/calc/` consist of:
- `<name>.php` - Controller (sets language, loads translations)
- `<name>.tpl` - Template (renders HTML with inline JS)
- `css/<name>.css` - Per-calculator styles
- `js/<name>-core.js` - DOM-free formulas (what the node:test suite exercises)
- `js/<name>-data-collector.js`, `-renderer.js`, `-orchestration.js` - form reading, output, wiring

`trade` is half-way there: it has `js/trade-core.js` and a type-checked `js/trade.js`, but the
rest of the page — form reading, output and wiring — still lives in that one file rather than in
a collector/renderer/orchestration trio. To create a new calculator use the
**`new-calculator` skill**.

## Internationalization
- `www/langs.php` - Maps URL prefixes to languages (`/en/` → English, `us` → `en`)
- `www/Intl.php` - `Intl::getTranslations($lang, $page)` merges common + page-specific keys
- `www/locale/*.json` - Translation files for 13 languages

## Key Files
| File | Purpose |
|------|---------|
| `www/ajax.php` | Central AJAX dispatcher |
| `www/langs.php` | Language detection from URL |
| `www/Intl.php` | Translation loader |
| `www/db.connect.inc.php` | Database connection helpers |
| `www/ogame/calc/js/ogame-production.js` | Production rates, consumption, storage capacity, planet energy with its bonuses (costs, production, graviton, terraformer) |
| `www/ogame/calc/js/ogame-cargo.js` | One ship's hold — `shipHold` (costs, expeditions, flight, graviton, moon, queue, terraformer, trade) |
| `www/ogame/calc/js/ogame-costs.js` | Classic build cost/time, demolition, halving cost (costs, production, queue, terraformer, lfcosts) |
| `www/ogame/calc/js/ogame-lifeform.js` | Life Form cost/time (lfcosts, production) |
| `www/ogame/calc/js/dom-utils.js` | Native DOM helpers (the jQuery replacement) |
| `www/ogame/calc/js/own-api.js` | Normalizes OGame's API 2 export (`flight`, `expeditions`) |

Importing data the player copies out of the game — the API 2 export and the spy report, what each
calculator takes from them — is documented in `docs/ogame-api-import.md`. The country/universe
picker (flight, costs, trade) — the crons, tables and `serverdata`/`populatedSystems` services
behind it — is `docs/universe-data.md`.

## Other notes
- **External services**: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`)
- **Database**: Optional MySQL/MariaDB for changelog and trade calculator features
