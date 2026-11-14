---
paths:
  - "Makefile"
  - "docker/**"
  - "docker-compose.yml"
  - ".env*"
  - "scripts/**"
  - "www/**/*.php"
  - "playwright-tests/**"
---

# Local development

## Running PHP Scripts (PowerShell)
```powershell
& 'd:\wamp64\bin\php\php8.2.33\php.exe' .\ogame\calc\flight.php
```
With the Docker stack up: `docker compose exec web php ogame/calc/flight.php`.
Local PHP should match the host's version pinned in `.php-version` (see
`docs/adr/0003-single-host-php-8-5.md`). Local dev is authoritative only for
the Node suite, lint and typecheck; anything PHP-shaped is confirmed by CI or by
`make serve` on a matching build. `make check` warns — but does not fail — on a
version mismatch.

## Local Development
- `docker compose up -d` (or `make docker-up`) brings up the PHP built-in server on
  `http://localhost:8000` plus a MariaDB seeded from `schema.sql` + the fixtures and
  migrated — the quickest path. `docker compose down -v` resets the database. See
  `docs/adr/0002-docker-local-dev.md`.
- Or configure a WAMP virtual host pointing to `www/` (see README.md), add
  `127.0.0.1 pfg.wmp` to the hosts file, and browse `http://pfg.wmp` for full-site testing.
  The database is **MariaDB 10.4 on port 3306** — the engine CI runs (the site's host has
  11.8); `.env` carries no port, so whatever answers on 3306 is what the site uses. WAMP's
  services need admin rights to start.
- Or skip both: `make serve` runs the built-in PHP server on `http://localhost:8000`
  against whatever PHP/MariaDB is on the machine (`.env` for the DB).
