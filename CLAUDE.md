# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

## Which Calculator?

This repo contains multiple calculators (production, cost, lifeform cost, flight, trade, queue). Before exploring or editing, confirm which calculator the request targets if the file path is ambiguous — do not assume the cost calculator by default.

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
| `make check` | `i18n-validate` + both suites — the green gate |
| `make audit` | Code quality, test coverage, DB schema reports (advisory) |
| `make serve` | `php -S localhost:8000 -t www`, no WAMP needed |
| `make i18n-fix` / `make i18n-report` | Translation sync and completion |
| `make install` | `npm ci` + Playwright browsers |

Variables override on the command line: `make test-e2e PFG_BASE_URL=http://pfg.wmp`,
`make serve PORT=8080`, `make serve PHP=...`.

Recipes run under the **platform default shell** — `cmd.exe` on Windows, `/bin/sh` in CI.
Do not pin `SHELL` to a Git-for-Windows `sh.exe`: MSYS rewrites absolute Windows paths and
the Git coreutils are not on `PATH`. Keep every recipe to one command per line, using
`cd <dir> && <cmd>` where a target must run inside a sub-project. CI calls the same targets,
so a change here must keep working on Ubuntu.

### Running PHP Scripts (PowerShell)
```powershell
& 'd:\wamp64\bin\php\php7.4.9\php.exe' .\ogame\calc\flight.php
```

### Unit Tests (node:test, no dependencies)
```powershell
make test-unit          # or: cd unit-tests; npm test
```
`*-core.js` modules are DOM-free, so their formulas are tested in Node instead of a browser
(~0.1 ms per test against ~360 ms through Playwright). `load.js` runs the classic browser
scripts in a `vm` context and lifts out the requested globals; `expect.js` is a small value-only
matcher shim so test bodies read the same as in the Playwright specs.

**Where a test belongs:** if it only calls a `*-core.js` function and asserts on the returned
object, it goes here. If it fills a field, clicks, or asserts on rendered output, it stays in
Playwright — **including when those actions sit in a shared helper** and the test body itself
looks pure. A test that reaches the maths through the form is covering the form-to-params
wiring, and that coverage is lost if it moves. This is why the flight, queue and lfcosts specs
keep tests whose assertions are plain arithmetic.

### Playwright E2E Tests
```powershell
make install                          # npm ci + browsers, first run only
make test-e2e                         # whole suite
make test-one spec=graviton           # single calculator
make test-e2e-ui                      # interactive mode
make report                           # view the HTML report

make test-e2e PFG_BASE_URL=http://pfg.wmp   # defaults to http://localhost:8000
```
`PFG_BASE_URL` is the name `playwright.config.js` reads — not `PLAYWRIGHT_BASE_URL`.

Specs import `test`/`expect` from `./base`, not from `@playwright/test` — the fixture there
caches the jsdelivr Bootstrap assets in `.cdn-cache/`, without which every test re-downloads
them over the network. New spec files must use the same import. Video recording is off locally
(set `PFG_VIDEO=1` to get it back for a failing run).

### Local Development
- Configure WAMP virtual host pointing to `www/` directory (see README.md)
- Add `127.0.0.1 pfg.wmp` to hosts file
- Browse to `http://pfg.wmp` for full-site testing
- Or skip WAMP entirely: `make serve` runs the built-in PHP server on `http://localhost:8000`,
  which is the default the tests expect

## Git & Shell
- Commit subjects follow **Conventional Commits**: `<type>(<scope>): <subject>` in English, imperative mood, lowercase after the colon, no trailing period. Types: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`. Scope is the calculator or area (`flight`, `moon`, `lfcosts`, `production`, `claude`). Commits before 2026-07-22 use the older plain-sentence style — ignore them and follow this rule.
- Commit messages: write to a temp file and use `git commit -F`, or avoid quotes/backticks entirely. Do not use here-strings in PowerShell for commit bodies.
- Keep unrelated pre-existing changes in a separate commit.
- Before committing, scope tests to what changed:
  - If every changed file belongs to a single calculator (its `<name>.php`, `<name>.tpl`, `js/<name>.js`, `unit-tests/<name>-core.test.js`, `playwright-tests/tests/<name>.spec.js`), only run that calculator's tests: `make test-one spec=<name>` for e2e, and `node --test <name>-core.test.js` from `unit-tests/` for the unit test if one exists for that calculator.
  - If any changed file is shared across calculators — `www/ogame/common.js`, `www/ajax.php`, `www/Intl.php`, `www/langs.php`, `www/db.connect.inc.php`, `locale/*.json`, `playwright-tests/base.js`, files under `unit-tests/` other than a single `*-core.test.js`, or the `Makefile`/config itself — run the full suite with `make test` (or `make check` to include translation validation).
  - Always run the full `make test` before `git push`, regardless of how narrow the commits being pushed were.
  - New tests go in the existing file for that calculator, not a new file.

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
Calculators in `www/ogame/calc/` consist of three files:
- `<name>.php` - Controller (sets language, loads translations)
- `<name>.tpl` - Template (renders HTML with inline JS)
- `js/<name>.js` - Client-side logic

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
| `www/ogame/common.js` | Shared calculator JS logic |

## Project Conventions

### Code Comments
Write all comments in code files in English only.

### Cookie Storage
Calculator options persist via cookies (e.g., `options_expeditions`). Note that `options.prm.fleet` uses `~` as a comma placeholder for encoded values.

### Fleet Mapping
Client JS maps short ship codes to indices (see `ogame/calc/js/expeditions.js`). If you change ship order, update both PHP and JS mappings.

### Adding Translations
When adding UI text:
1. Add keys to all `locale/*.json` files
2. Ensure `Intl::getTranslations($lang, '<page>')` includes the new page key
3. Templates inject translations as JS variables for client-side use

### Adding AJAX Services
Add a `case` block in `www/ajax.php` and return responses in the format `"<code>\n<payload>"`. Always check the numeric code first on the client side.

## Localization

Any new user-visible string (labels, tooltips, warnings, modal text) must be added to **all 13 locale files** in the same commit. Reuse an existing localization key if one already covers the string before creating a new one.

## Validation & Input Conventions
- All numeric inputs use the **blur-validation pattern** (validate/clamp on blur, never live-clamp while typing). Follow the existing helpers rather than inventing new behavior.
- Always use the locale-aware decimal helper for user-entered fractional values (RU uses `,`). **Never** apply locale separators to imported OGame API data — that data always uses `.`.
- Never persist a locale decimal separator into comma-delimited cookies; serialize with a canonical dot format.

## CSS / Bootstrap Gotchas
- Bootstrap `input-group` overrides non-id-scoped width classes — scope width rules or they will blow up to ~177px.
- Accordions and tables inside calculator panels use `max-content` intrinsic width and will widen the panel; apply `width: 0; min-width: 100%` to contain them.
- Prefer `bootstrap.Tooltip.getOrCreateInstance()` over `new bootstrap.Tooltip()` (SonarQube S1848).

## Important Notes

- **Legacy frontend**: jQuery 1.5.1 and jQuery UI 1.8.x — upgrading requires manual QA across all calculator pages
- **External services**: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`)
- **Database**: Optional MySQL/MariaDB for changelog and trade calculator features
- **No automated tests**: Only Playwright E2E tests exist; manual testing required for changes
