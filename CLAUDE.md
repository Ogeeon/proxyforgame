# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

## Which Calculator?

This repo contains ten calculators: `costs`, `expeditions`, `flight`, `graviton`, `lfcosts`,
`moon`, `production`, `queue`, `terraformer`, `trade`. Before exploring or editing, confirm which
one the request targets if the file path is ambiguous — do not assume the cost calculator by default.

## Development Commands

### Task Runner (`make`)

`make` from the repo root is the entry point for everything below — `make help` lists the
targets. **Requires GNU Make 4.x**; the GnuWin32 3.81 build that is still on many Windows
boxes is too old (`choco install make`).

| Target | What it does |
|--------|--------------|
| `make test` | Both suites — the ritual required before a commit |
| `make test-unit` / `make test-e2e` | One suite each |
| `make test-one spec=flight` | A single Playwright spec |
| `make check` | `i18n-validate` + `lint` + `typecheck` + both suites — the green gate |
| `make lint` / `make typecheck` | ESLint and the TypeScript `checkJs` pass; both gate `check` |
| `make tsconfigs` | Regenerate `tsconfig/<calc>.json` after editing a template's `<script>` tags |
| `make audit` | Test coverage, DB schema reports (advisory) |
| `make serve` | `php -S localhost:8000 -t www`, no WAMP needed |
| `make i18n-fix` / `make i18n-report` | Translation sync and completion |
| `make install` | `npm ci` + Playwright browsers |

Variables override on the command line: `make test-e2e PFG_BASE_URL=http://pfg.wmp`,
`make serve PORT=8080`, `make serve PHP=...`. The constraints on writing recipes (platform
default shell, one command per line, never pin `SHELL`) are documented in the Makefile header.

### Which tests to run

`docs/test-scope.md` — the file-set table and the shared-file list. `unit-tests/README.md`
covers whether a given test belongs in Node or in Playwright.

Two things worth knowing before writing a test:

- `PFG_BASE_URL` is the name `playwright.config.js` reads — **not** `PLAYWRIGHT_BASE_URL`.
- Specs import `test`/`expect` from `./base`, **not** from `@playwright/test` — the fixture
  there caches the jsdelivr Bootstrap assets in `.cdn-cache/`, without which every test
  re-downloads them over the network. New spec files must use the same import. Video recording
  is off locally (`PFG_VIDEO=1` brings it back for a failing run).

### Running PHP Scripts (PowerShell)
```powershell
& 'd:\wamp64\bin\php\php7.4.9\php.exe' .\ogame\calc\flight.php
```

### Local Development
- Configure WAMP virtual host pointing to `www/` directory (see README.md)
- Add `127.0.0.1 pfg.wmp` to hosts file
- Browse to `http://pfg.wmp` for full-site testing
- Or skip WAMP entirely: `make serve` runs the built-in PHP server on `http://localhost:8000`,
  which is the default the tests expect

## Git & Commits

The full procedure lives in the **`commit` skill** — Conventional Commits subject, test
scoping, message mechanics. Two rules that must hold even if the skill is not invoked:

- **When asked to commit, first ask whether the changed files should be run through SonarQube**
  (`analyze_code_snippet` on the sonarqube MCP server, one call per changed file). Wait for the
  answer before committing. Work driven by `/sonar-fix` is exempt — its Sonar pass already happened.
- **Never commit an unverified change.** Scope the run per `docs/test-scope.md`; full `make test`
  before any `git push`. Keep unrelated pre-existing changes in a separate commit.

## Architecture

### Page Controller Pattern
Every page follows this three-step pattern:
1. Set `$lang` and context variables
2. Call `Intl::getTranslations($lang, '<page>')` to load translations from `locale/*.json`
3. `require_once('<page>.tpl')` to render HTML + inline JS

**Example:**
```php
$lang = $_GET['lang'] ?? 'en';
$tr = Intl::getTranslations($lang, 'flight');
require_once('flight.tpl');
```

### AJAX API
Single endpoint `www/ajax.php` handles all AJAX requests:
- Request: POST with `service` parameter identifying the action
- Response: Two-line format `"<code>\n<payload>"` where `0` = success
- Services are defined as `case` blocks in the switch statement

### Calculator Structure
Calculators in `www/ogame/calc/` consist of:
- `<name>.php` - Controller (sets language, loads translations)
- `<name>.tpl` - Template (renders HTML with inline JS)
- `css/<name>_bs.css` - Per-calculator styles
- `js/<name>-core.js` - DOM-free formulas (what the node:test suite exercises)
- `js/<name>-data-collector.js`, `-renderer.js`, `-orchestration.js` - form reading, output, wiring

`trade` is half-way there: it has `js/trade-core.js` and a type-checked `js/trade.js`, but the
rest of the page — form reading, output and wiring — still lives in that one file rather than in
a collector/renderer/orchestration trio. To create a new calculator use the
**`new-calculator` skill**.

### Internationalization
- `www/langs.php` - Maps URL prefixes to languages (`/en/` → English, `us` → `en`)
- `www/Intl.php` - `Intl::getTranslations($lang, $page)` merges common + page-specific keys
- `www/locale/*.json` - Translation files for 13 languages

### Key Files
| File | Purpose |
|------|---------|
| `www/ajax.php` | Central AJAX dispatcher |
| `www/langs.php` | Language detection from URL |
| `www/Intl.php` | Translation loader |
| `www/db.connect.inc.php` | Database connection helpers |
| `www/ogame/calc/js/common.js` | Shared calculator JS logic |
| `www/ogame/calc/js/dom-utils.js` | Native DOM helpers (the jQuery replacement) |

## Project Conventions

### Code Comments
Write all comments in code files in English only.

### JavaScript Style
Prefer `const`/`let` over `var`, and `Number.parseInt`/`Number.parseFloat` over the bare global
forms — in new code and whenever you're already touching a line. Don't do a drive-by rewrite of
an entire legacy file just to convert unrelated `var` declarations.

**Every JS file is type-checked** — `checkJs: true`, types expressed in JSDoc, no `.ts` sources
and no per-file `// @ts-check` opt-in. `make typecheck` gates `make check`, so a change that
breaks types cannot be committed green. Two consequences worth knowing:

- The browser code is checked **one project per calculator** (`tsconfig/<calc>.json`), because
  a page loads exactly one calculator and the files share a global scope. Those projects are
  generated from the `<script>` tags of the matching `.tpl` — after adding, removing or
  reordering a tag, run `make tsconfigs`, otherwise `make check` fails on a stale project.
- Ambient declarations for page globals, expando properties and `bootstrap` live in
  `www/ogame/calc/js/globals.d.ts`; `options-global.d.ts` covers the calculators that declare
  `options` in an inline template script.

### Cookie Storage
Calculator options persist via cookies (e.g., `options_expeditions`). Note that `options.prm.fleet` uses `~` as a comma placeholder for encoded values.

That placeholder is a workaround, not a convention: `saveToCookie`/`loadFromCookie` in
`www/js/utils.js` join records with `,`, and never escape it, so **any stored value containing a
comma is destroyed on read** — including a nested object, which is written as JSON. Settings then
fall back to their defaults with no error. If a calculator appears not to remember something,
check this before looking for a bug in the calculator itself.

### Fleet Mapping
`EXPEDITION_SHIPS` in `www/ogame/calc/js/expeditions-core.js` maps short ship codes to indices,
and the core addresses that array **by index**. If you change ship order, update the PHP side
and `expeditions.tpl` to match.

### Adding AJAX Services
Add a `case` block in `www/ajax.php` and return responses in the format `"<code>\n<payload>"`. Always check the numeric code first on the client side.

## Localization

Any new user-visible string (labels, tooltips, warnings, modal text) must be added to **all 13
locale files** in the same commit; reuse an existing key before creating one, and put
cross-page keys in `common` rather than duplicating them per page. Procedure: **`add-translation`
skill**.

## UI Patterns

`docs/patterns.md` is the canonical reference for the Bootstrap 5 calculator UI — tooltip
skinning, locale-aware decimal input, blur validation, input-group sizing, non-editable fields,
button styling. **Read the relevant section there before writing UI code**; the two lists below
are only a summary of its most frequently hit rules. The `flight` calculator is the reference
implementation for every pattern.

## Validation & Input Conventions
- All numeric inputs use the **blur-validation pattern** (validate/clamp on blur, never live-clamp while typing). Follow the existing helpers rather than inventing new behavior.
- Always use the locale-aware decimal helper for user-entered fractional values (RU uses `,`). **Never** apply locale separators to imported OGame API data — that data always uses `.`.
- Never persist a locale decimal separator into comma-delimited cookies; serialize with a canonical dot format.

## CSS / Bootstrap Gotchas
- Bootstrap `input-group` overrides non-id-scoped width classes — scope width rules or they will blow up to ~177px.
- Accordions and tables inside calculator panels use `max-content` intrinsic width and will widen the panel; apply `width: 0; min-width: 100%` to contain them.
- Prefer `bootstrap.Tooltip.getOrCreateInstance()` over `new bootstrap.Tooltip()` (SonarQube S1848).

## Important Notes

- **Frontend**: vanilla JS on Bootstrap 5.3, no jQuery — `www/ogame/calc/js/dom-utils.js` provides the
  DOM helpers that replaced it. Nine calculators went through the full BS5 migration;
  **`trade` is only part-way**. Its JS is migrated — `dom-utils.js`, `trade-core.js`,
  type-checked — but its UI is not: `trade.css` has no BS custom properties, the numeric fields
  validate on `keyup` instead of on blur, and it carries one Bootstrap tooltip against flight's
  thirty. Do not assume a `docs/patterns.md` UI rule already holds there.
- **External services**: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`)
- **Database**: Optional MySQL/MariaDB for changelog and trade calculator features
