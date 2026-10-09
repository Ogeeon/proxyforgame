# 2. Docker Compose for local development, not for the hosts or CI

Date: 2026-09-02

## Status

Accepted.

## Context

Getting the site running locally meant a WampServer virtual host: edit
`httpd-vhosts.conf`, edit the Windows `hosts` file, restart the services. The
only alternative was `make serve` (the built-in PHP server) plus a
hand-installed MariaDB with the schema imported by hand. Both assume a specific
PHP and database already on the machine, and the setup is the first thing a
newcomer — or a reviewer sizing up the project — has to work through.

Three things constrain where a container can go:

- **Production is not ours to containerise.** It is a managed ISPmanager account
  (ADR-0001): Apache with mod_php, no root, no Docker.
- **CI already works.** `.github/workflows/playwright.yml` builds PHP with
  `shivammathur/setup-php` from `.php-version` and runs MariaDB as a service
  container. It is green and, by ADR-0001, moves in lockstep with production. A
  compose file wired into CI would be a second description of the same
  environment to keep in sync — the drift that issue #21 exists to prevent.
- **The built-in PHP server is already the local baseline.** `make serve` and CI
  both run `php -S`; neither serves the `.htaccess` rewrites (pretty `/en/`
  URLs). The test suite navigates to `*.php` paths directly, so this has never
  mattered.

## Decision

Add a **`docker-compose.yml` and `docker/php/` for local development only**.

- **`web`** is `php:8.2-cli` running `php -S 0.0.0.0:8000 -t www` — byte-identical
  to `make serve` and CI. Extensions `mysqli`, `intl`, `mbstring` match CI. The
  base image tag is the same `major.minor` as `.php-version`;
  `scripts/check-php-version.js` warns if the two drift.
- **`db`** is `mariadb:10.4`, matching CI and the hosts. `schema.sql` and the
  changelog fixture are mounted into `/docker-entrypoint-initdb.d/` — the same
  files, in the same order, as `make db-seed`. A one-shot **`migrate`** service
  then runs `deploy/pfg-migrate`, so the local database is seeded and migrated
  the same way the deploy does it.
- **WAMP stays a first-class path.** It is unchanged and still documented in the
  README. Nothing in `www/` was touched for this.
- **CI and the hosts are untouched.** They keep their own mechanisms.

To let compose inject the database host without a mounted `.env` fighting it,
`www/db.connect.inc.php` now lets a real environment variable win over a value
in the `.env` file (the 12-factor norm). The Makefile's `DB_*` export was
narrowed to the two recipes that need it, so `make serve` no longer overrides a
developer's customised `.env`.

## Consequences

- The Quick-start section is `docker compose up -d`, then open
  `http://localhost:8000`.
- `.env` precedence changed: a real environment variable now beats the file.
  This is inert on the hosts and in CI (nothing there sets a conflicting
  variable) and is an improvement for `make serve`.
- Resetting the database is `docker compose down -v && docker compose up -d`.
- The `db` service publishes port 3306, which collides with a running WAMP
  MariaDB. Run one stack at a time, or set `PFG_DB_PORT`.
- The Docker PHP is not a version-faithful stand-in for production any more than
  local dev ever was (ADR-0001): anything PHP-shaped is still confirmed in CI.
- Pretty `/en/` URLs are still not served locally. If the project moves to
  clean URLs, a small router shared by `php -S` and `.htaccess` is the likely
  shape — a separate change.
