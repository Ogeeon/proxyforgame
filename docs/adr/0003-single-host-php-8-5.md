# 3. One host, and its PHP 8.5 becomes the pin

Date: 2026-10-10

## Status

Accepted. Supersedes [ADR-0001](0001-php-version-alignment.md).

## Context

ADR-0001 pinned PHP to production's 8.2 and kept the standby on its
distribution's 8.5 as a forward-compatibility canary. Two hosts were the
reason the pin had to be asymmetric.

In October 2026 Yandex Metrica showed the calculator pages getting slower.
Production (`88.218.248.47`) is a managed ISPmanager account on someone
else's server: its MySQL sits on another machine, so every query is a network
round trip, and the site answered 0.3-0.8 s before the first byte where the
standby, with a local MariaDB, answered in 0.17 s. The account also runs nginx
in front of PHP, which ignores `.htaccess` and cost the short calculator
addresses (reverted in `4e267f0`).

The decision was to leave that account: both `proxyforgame.com` and
`proxyforgame.net` now resolve to the former standby, `89.124.110.192`, until
`.com` is retired, and the two-host arrangement is removed rather than left
idle.

## Decision

**8.5 is the pinned version** - what the one remaining host runs (Ubuntu 26.04's
distribution PHP). `.php-version` stays the single source of truth; nothing
else changes about how it is read.

- **CI** reads `.php-version` as before, so it now tests on 8.5.
- **The watchdog** holds the host to `.php-version` exactly. The asymmetric
  "a spare may be newer" rule goes with the spare.
- **Local dev** should move to an 8.5 build; `docker/php/Dockerfile` uses
  `php:8.5-cli`. `make check` still only warns on a mismatch.

## Consequences

- There is no warm spare. A host failure means rebuilding one; the runbook is in
  `deploy/README.md`. The database holds nothing that cannot be rebuilt from
  `schema.sql`, the migrations, `changelog.sql` and the daily crons, so a
  rebuild loses no data - the only irreplaceable file is the checkout's `.env`,
  which must be kept backed up off the host.
- A PHP upgrade is no longer pre-tested by a canary. Bumping `.php-version`
  first and letting CI go green on the new version, before the host is
  upgraded, takes that role.
- The `.htaccess` rules apply on every host that serves the site again.
