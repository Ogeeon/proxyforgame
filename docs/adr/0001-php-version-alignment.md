# 1. Align PHP versions on production's 8.2

Date: 2026-08-28

## Status

Accepted. Resolves issue #13.

## Context

Once the CI/CD migration made a push to `main` deploy automatically, the same
commit started landing on four environments running four different PHP builds:

| Environment | PHP | How it runs |
|---|---|---|
| production `88.218.248.47` | 8.2.x | `/opt/php82/bin/php`, ISPmanager-managed, mod_php under Apache prefork |
| standby `89.124.110.192` | 8.5.x | `/usr/bin/php`, distribution package, mod_php under Apache prefork |
| CI (`playwright.yml`) | 8.2 | `shivammathur/setup-php` |
| local dev | 7.4.9 | a wamp build |

A deprecation or behaviour change between 7.4 and 8.5 had three chances to be
missed before code written locally reached production, and one place to surface
— production itself.

Two facts constrain the fix:

- **Production is not ours to move.** It is a managed ISPmanager account run by
  other people, and the panel offers 8.2 only.
- **The standby cannot reach 8.2 either.** It runs Ubuntu 26.04 "resolute",
  whose distribution PHP is 8.5. The `ondrej/php` PPA — the usual way to get an
  older PHP onto Ubuntu — has no `resolute` suite, and no other apt source
  offers 8.2. Bringing the standby to 8.2 would mean rebuilding the host on an
  older LTS, which also carries an unrelated VPN service that must not be
  disturbed.

## Decision

**8.2 is the pinned version**, recorded once in `.php-version` at the repo root
as a bare `major.minor` string. Production's ceiling is the pin; nothing is
allowed to be newer *by policy*, even where the platform offers it.

- **CI** reads `.php-version` (`php-version-file:` in `playwright.yml`). CI and
  production move together; there is no separate version literal in the
  workflow.
- **Local dev** is raised to 8.2 and documented as authoritative only for the
  Node suite, lint and typecheck. Anything PHP-shaped is confirmed in CI or via
  `make serve` on a matching build. `make check` runs `php-version-check`, which
  warns on a mismatch and never gates.
- **The standby stays on its distribution PHP.** It is reclassified: it is a
  warm serving spare and a forward-compatibility canary, **not** a
  version-faithful rehearsal of production. A failover onto the standby is also
  a PHP upgrade and carries that risk.
- **`deploy/watchdog.sh` enforces the pin against the live hosts**, reading the
  `php` field now reported by `ajax.php?service=health`. The check is
  asymmetric: production must equal `.php-version`; the standby must not be
  *older* than it (an older spare is the dangerous case) and only warns when
  newer.

## Consequences

- The one thing that was already right — CI matching production — is now
  structurally guaranteed rather than coincidental.
- Moving production to a newer PHP is a deliberate, separate change: update
  `.php-version`, let CI re-green, and expect `watchdog.sh` to flag any host
  that has not followed. That failure is the intended forcing function.
- The standby divergence is documented and visible in the watchdog instead of
  silent. Closing it is not scheduled: it becomes possible if `ondrej/php`
  publishes a `resolute` suite, or whenever the standby host is next rebuilt.
  No issue is open for it.
- There is still no migration mechanism for schema changes (issue #12), and the
  two hosts still run different databases and crons (unchanged by this ADR).
