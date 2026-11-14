---
paths:
  - "www/**/*.tpl"
  - "www/**/*.css"
  - "www/**/*.js"
  - "www/vendor/**"
  - "playwright-tests/**"
  - "docs/patterns.md"
---

# Calculator UI

## UI Patterns

`docs/patterns.md` is the canonical reference for the Bootstrap 5 calculator UI — tooltip
skinning, locale-aware decimal input, blur validation, input-group sizing, non-editable fields,
button styling. **Read the relevant section there before writing UI code**; the two lists below
are only a summary of its most frequently hit rules. The `flight` calculator is the reference
implementation for every pattern.

## Validation & Input Conventions
- All numeric inputs use the **blur-validation pattern** (validate/clamp on blur, never live-clamp while typing). Follow the existing helpers rather than inventing new behavior.
- Always use the locale-aware decimal helper for user-entered fractional values (RU uses `,`). **Never** apply locale separators to imported OGame API data — the API 2 export and the spy-report JSON always use `.`.
- **Text the player pastes out of the game UI is different**: its separator follows the game client's language (`.` on EN/RU, `,` on DE), so a paste parser accepts both.
- Never persist a locale decimal separator into comma-delimited cookies; serialize with a canonical dot format.

## CSS / Bootstrap Gotchas
- Bootstrap `input-group` overrides non-id-scoped width classes — scope width rules or they will blow up to ~177px.
- Accordions and tables inside calculator panels use `max-content` intrinsic width and will widen the panel; apply `width: 0; min-width: 100%` to contain them.
- Reach Bootstrap's JavaScript through `attachTooltips()`, `openModal()`, `BS_EVENT` and the other
  helpers of `www/js/bootstrap-access.js` — they use `getOrCreateInstance()`, never `new`
  (SonarQube S1848). Only that file and `bootstrap-tooltip-guard.js` read the `bootstrap` global;
  ESLint enforces it. The Bootstrap 6 plan is `docs/bootstrap-6-migration.md`.
- **Bootstrap and Bootstrap Icons are vendored**: `www/vendor/` holds committed copies of the
  versions `package.json` pins, included by `www/vendor.tpl`. Upgrading is a version bump
  plus `make vendor`; `make check` fails (`vendor-check`) when the two disagree.

## Frontend state
- **Frontend**: vanilla JS on Bootstrap 5.3, no jQuery — `www/ogame/calc/js/dom-utils.js` provides the
  DOM helpers that replaced it. Nine calculators went through the full BS5 migration;
  **`trade` is only part-way**. Its markup (Bootstrap grid, form and utility classes) and its JS
  are migrated — `dom-utils.js`, `trade-core.js`, type-checked — but the UI conventions are not:
  `trade.css` uses `--bs-*` custom properties in only two places, the numeric fields validate on
  `keyup` instead of on blur, and the page has no Bootstrap tooltip against flight's thirty. Do not
  assume a `docs/patterns.md` UI rule already holds there.
