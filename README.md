## This is the source code for proxyforgame.com website.

[![CI](https://github.com/Ogeeon/proxyforgame/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/Ogeeon/proxyforgame/actions/workflows/playwright.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Ogeeon_proxyforgame&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Ogeeon_proxyforgame)

ProxyForGame is a set of free browser calculators for the space strategy game
[OGame](https://ogame.gameforge.com/). Ten of them are live: build costs and times
(`costs`, `lfcosts`, `queue`, `terraformer`), mine output and energy (`production`,
`graviton`), fleet missions (`flight`, `expeditions`, `moon`) and resource exchange (`trade`).
Several accept the game's own API 2 export, so a fleet or a planet can be pasted straight in
instead of being typed out.

Each page is a small PHP controller that loads its translations and includes a template; the
maths runs client-side in vanilla JavaScript on Bootstrap 5, and every string is served from
`www/locale/` in 13 locales.

## Prerequisites
- **Either** Docker with Compose v2 (the quickest path — see below) **or** PHP 8.2
  with `mysqli`/`intl`/`mbstring` plus WAMP or a local MariaDB
- PHP 8.2 is production's version, pinned in `.php-version`
- Node.js 18+ for running Playwright tests
- (Recommended) GNU Make 4.x as the task runner — `choco install make` on Windows. A 3.81
  build from GnuWin32 is too old. Everything below also works without it.
- (Optional, non-Docker) MySQL/MariaDB if you want changelog functionality and
  domains/universes in the Trade calculator; import `schema.sql` and configure the
  connection in `.env`. Docker seeds this for you.

## Quick start (Docker)
1) `docker compose up -d` &nbsp;— or `make docker-up`
2) Open http://localhost:8000

The `db` service is created, seeded from `schema.sql` + the test fixtures, and
migrated automatically on the first run. Reset it with
`docker compose down -v && docker compose up -d`. Port 3306 collides with a
running WAMP MariaDB — stop one, or set `PFG_DB_PORT`. Details:
[docs/adr/0002-docker-local-dev.md](docs/adr/0002-docker-local-dev.md).

## Quick start — WAMP (Windows)
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

### Enable the database (WAMP / bare `make serve` only)
Docker does this for you; this section is for the non-Docker paths.
1) Create a database and import `schema.sql`.
2) Populate the `.env` file in the repo root with your actual values.
3) Restart the PHP server so `www/db.connect.inc.php` can pick up the variables.

## Run the tests

`make help` lists every available target. The short version:

```powershell
make install       # npm ci + Playwright browsers, first run only
make serve         # built-in PHP server on http://localhost:8000 (or: make docker-up, or WAMP)
make test          # unit suite + Playwright suite, against http://localhost:8000
```

The suite runs on the host and points at `http://localhost:8000` by default, so
any of `make docker-up`, `make serve` or WAMP (`PFG_BASE_URL=http://pfg.wmp`) can
be the server under test.

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
- `CHANGELOG.md` records every change; the bullets marked `<!-- site -->` are the ones published
  to the changelog users see in the sidebar. `make changelog-validate` checks its structure.
- Translations live in `www/locale/*.json` and are loaded per page via `Intl::getTranslations`.
- AJAX calls use `www/ajax.php` with two-line responses (`<code>\n<payload>`, where `0` = success).
- Calculators live under `www/ogame/calc/` (PHP controllers + `.tpl` templates + JS in `www/ogame/calc/js`).