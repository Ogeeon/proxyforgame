# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

## Which Calculator?

This repo contains multiple calculators (production, cost, lifeform cost, flight, trade, queue). Before exploring or editing, confirm which calculator the request targets if the file path is ambiguous — do not assume the cost calculator by default.

## Development Commands

### Running PHP Scripts (PowerShell)
```powershell
& 'd:\wamp64\bin\php\php7.4.9\php.exe' .\ogame\calc\flight.php
```

### Playwright E2E Tests
```powershell
cd playwright-tests
npm install
npx playwright install

# Set base URL (defaults to http://localhost:8000)
set PFG_BASE_URL=http://pfg.wmp

# Run tests
npx playwright test --reporter=list
npx playwright test --ui        # Interactive mode
npx playwright show-report      # View HTML report
```

### Local Development
- Configure WAMP virtual host pointing to `www/` directory (see README.md)
- Add `127.0.0.1 pfg.wmp` to hosts file
- Browse to `http://pfg.wmp` for full-site testing

## Git & Shell
- Commit messages: write to a temp file and use `git commit -F`, or avoid quotes/backticks entirely. Do not use here-strings in PowerShell for commit bodies.
- Keep unrelated pre-existing changes in a separate commit.
- Run the Playwright suite before committing; new tests go in the existing spec file for that calculator, not a new file.

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
