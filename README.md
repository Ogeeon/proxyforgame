## This is the source code for proxyforgame.com website.

## Prerequisites
- PHP 7.4+ with mysqli enabled
- Node.js 18+ for running Playwright tests
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

## Run Playwright tests
1) Install test deps:
```powershell
cd playwright-tests
npm install
npx playwright install
```
2) Make sure the site is running (see Quick start). Set the base URL for tests (defaults to `http://localhost:8000`):
```powershell
set PFG_BASE_URL=http://localhost:8000
```
3) Run the suite:
```powershell
npx playwright test --reporter=list
```
	- Open the HTML report afterward with `npx playwright show-report`.
	- For interactive mode: `npx playwright test --ui`.

## Notes
- Translations live in `www/locale/*.json` and are loaded per page via `Intl::getTranslations`.
- AJAX calls use `www/ajax.php` with two-line responses (`<code>\n<payload>`, where `0` = success).
- Calculators live under `www/ogame/calc/` (PHP controllers + `.tpl` templates + JS in `www/ogame/calc/js`).