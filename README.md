## This is the source code for proxyforgame.com website.

## Prerequisites
- PHP 7.4+ with mysqli enabled
- Node.js 18+ for running Playwright tests
- (Recommended) GNU Make 4.x as the task runner — `choco install make` on Windows. A 3.81
  build from GnuWin32 is too old. Everything below also works without it.
- (Optional) MySQL/MariaDB if you want changelog functionality and domains/universes in the Trade calculator; import `schema.sql` and configure connection in the .env file

## Quick start (no database)
WAMP virtual host (pretty URL `http://pfg.wmp`)
1) Clone the repo to e.g. `d:/projects/pfg.wmp`.
2) In WampServer, open Apache → httpd-vhosts.conf and add (adjust paths if needed):
```
<VirtualHost *:80>
	ServerName pfg.wmp
	DocumentRoot "d:/projects/pfg.wmp/www"
	<Directory "d:/projects/pfg.wmp/www">
		AllowOverride All
		Require all granted
	</Directory>
</VirtualHost>
```
3) Add to `C:/Windows/System32/drivers/etc/hosts`:
```
127.0.0.1   pfg.wmp
```
4) Restart WampServer services, then browse http://pfg.wmp.

## Optional: enable database
1) Create a database and import `schema.sql`.
2) Populate the `.env` file in the repo root with your actual values
3) Restart the PHP server so `www/db.connect.inc.php` can pick up the variables.

## Run the tests

`make help` lists every available target. The short version:

```powershell
make install       # npm ci + Playwright browsers, first run only
make serve         # built-in PHP server on http://localhost:8000, if WAMP is not running
make test          # unit suite + Playwright suite
```

Point the suite at a different host with `make test-e2e PFG_BASE_URL=http://pfg.wmp`; it
defaults to `http://localhost:8000`. Then `make report` opens the HTML report, and
`make test-e2e-ui` starts the interactive runner. A single spec: `make test-one spec=graviton`.

Without make:
```powershell
cd unit-tests; npm test

cd playwright-tests
npm install
npx playwright install
npx playwright test --reporter=list
```

## Notes
- Translations live in `www/locale/*.json` and are loaded per page via `Intl::getTranslations`.
- AJAX calls use `www/ajax.php` with two-line responses (`<code>\n<payload>`, where `0` = success).
- Calculators live under `www/ogame/calc/` (PHP controllers + `.tpl` templates + JS in `www/ogame/calc/js`).