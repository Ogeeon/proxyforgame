---
paths:
  - "www/**/*.php"
  - "www/**/*.tpl"
  - "www/api/**"
---

# PHP pages and the AJAX API

## Page Controller Pattern
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

## AJAX API
Single endpoint `www/ajax.php` handles all AJAX requests:
- Request: a `service` parameter names the action. Reads take GET, anything with a
  side effect takes POST; the `$apiRoutes` table in `ajax.php` declares which.
- Response: **JSON**, with the HTTP status carrying the outcome — `respondJson(200, …)`
  on success, and an error body of `{"error": {"code": …, "message": …}}` otherwise.
- Each service is a plain function in its own file under `www/api/`, returning its
  result or throwing an `ApiError`. Nothing below a handler writes to the output.

## Adding AJAX Services
Add a row to `$apiRoutes` in `www/ajax.php` naming the method and the handler, and put the
handler in its own file under `www/api/`. A handler returns the value to serialize or throws
an `ApiError`; it must not echo anything itself. On the client, check the HTTP status — the
body is JSON either way.
