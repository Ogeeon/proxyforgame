# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

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

## Important Notes

- **Legacy frontend**: jQuery 1.5.1 and jQuery UI 1.8.x — upgrading requires manual QA across all calculator pages
- **External services**: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`)
- **Database**: Optional MySQL/MariaDB for changelog and trade calculator features
- **No automated tests**: Only Playwright E2E tests exist; manual testing required for changes
