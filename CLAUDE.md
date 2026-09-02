# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

## Which Calculator?

This repo contains ten calculators: `costs`, `expeditions`, `flight`, `graviton`, `lfcosts`,
`moon`, `production`, `queue`, `terraformer`, `trade`. Before exploring or editing, confirm which
one the request targets if the file path is ambiguous — do not assume the cost calculator by default.

## Development Commands

### Task Runner (`make`)

`make` from the repo root is the entry point for everything below — `make help` lists the
targets. **Requires GNU Make 4.x**; the GnuWin32 3.81 build that is still on many Windows
boxes is too old (`choco install make`).

| Target | What it does |
|--------|--------------|
| `make test` | Both suites — the ritual required before a commit |
| `make test-unit` / `make test-e2e` | One suite each |
| `make test-one spec=flight` | A single Playwright spec |
| `make check` | `changelog-validate` + `i18n-validate` + `lint` + `typecheck` + `html-validate` + both suites — the green gate |
| `make changelog-validate` | Check the structure of `CHANGELOG.md`. Gates `check` |
| `make changelog-release` | Cut `[Unreleased]` into a dated release and regenerate `changelog.sql` |
| `make lint` / `make typecheck` | ESLint and the TypeScript `checkJs` pass; both gate `check` |
| `make html-validate` | Render every page in all 13 locales and check with the Nu Html Checker (strict zero errors/warnings/info); needs Java 17+ and `vnu-jar` from `make install`. Gates `check` |
| `make tsconfigs` | Regenerate `tsconfig/<calc>.json` after editing a template's `<script>` tags |
| `make audit` | Test coverage, DB schema, HTML reports (advisory) |
| `make serve` | `php -S localhost:8000 -t www`, no WAMP needed |
| `make docker-up` / `make docker-down` | Local Docker stack: PHP built-in server on :8000 + a seeded MariaDB (ADR-0002) |
| `make i18n-fix` / `make i18n-report` | Translation sync and completion |
| `make install` | `npm ci` + Playwright browsers |

Variables override on the command line: `make test-e2e PFG_BASE_URL=http://pfg.wmp`,
`make serve PORT=8080`, `make serve PHP=...`. The constraints on writing recipes (platform
default shell, one command per line, never pin `SHELL`) are documented in the Makefile header.

### Which tests to run

`docs/test-scope.md` — the file-set table and the shared-file list. `unit-tests/README.md`
covers whether a given test belongs in Node or in Playwright.

Two things worth knowing before writing a test:

- `PFG_BASE_URL` is the name `playwright.config.js` reads — **not** `PLAYWRIGHT_BASE_URL`.
- Specs import `test`/`expect` from `./base`, **not** from `@playwright/test` — the fixture
  there caches the jsdelivr Bootstrap assets in `.cdn-cache/`, without which every test
  re-downloads them over the network. New spec files must use the same import. Video recording
  is off locally (`PFG_VIDEO=1` brings it back for a failing run).

### Running PHP Scripts (PowerShell)
```powershell
& 'd:\wamp64\bin\php\php8.2.33\php.exe' .\ogame\calc\flight.php
```
With the Docker stack up: `docker compose exec web php ogame/calc/flight.php`.
Local PHP is pinned to production's version in `.php-version` (see
`docs/adr/0001-php-version-alignment.md`). Local dev is authoritative only for
the Node suite, lint and typecheck; anything PHP-shaped is confirmed by CI or by
`make serve` on a matching build. `make check` warns — but does not fail — on a
version mismatch.

### Local Development
- `docker compose up -d` (or `make docker-up`) brings up the PHP built-in server on
  `http://localhost:8000` plus a MariaDB seeded from `schema.sql` + the fixtures and
  migrated — the quickest path, and what the tests default to. `docker compose down -v`
  resets the database. See `docs/adr/0002-docker-local-dev.md`.
- Or configure a WAMP virtual host pointing to `www/` (see README.md), add
  `127.0.0.1 pfg.wmp` to the hosts file, and browse `http://pfg.wmp` for full-site testing.
- Or skip both: `make serve` runs the built-in PHP server on `http://localhost:8000`
  against whatever PHP/MariaDB is on the machine (`.env` for the DB).

## Git & Commits

The full procedure lives in the **`commit` skill** — Conventional Commits subject, test
scoping, message mechanics. Two rules that must hold even if the skill is not invoked:

- **When asked to commit, first ask whether the changed files should be run through SonarQube**
  (`analyze_code_snippet` on the sonarqube MCP server, one call per changed file). Wait for the
  answer before committing. Two exemptions: work driven by `/sonar-fix`, whose Sonar pass already
  happened, and a commit that touches nothing Sonar analyzes — docs, `Makefile`, `.claude/**`,
  locale JSON, `*.sql`. One analyzable file (`.js`, `.php`, `.tpl`, `.css`, `.html`) in the change
  means the question applies. The table is in the `commit` skill.
- **Never commit an unverified change.** Scope the run per `docs/test-scope.md`; full `make test`
  before any `git push`. Keep unrelated pre-existing changes in a separate commit.

## Deployment

**A push to `main` that passes CI goes live.** There is no second repository, no manual
copy step and no build: GitHub Actions finishing green emits a `workflow_run` event, a
receiver on the production host verifies it and resets the checkout to that commit. The
standby host follows `main` on a five-minute timer. Full mechanics, rollback and host
layout: **`deploy/README.md`**.

Three consequences for everyday work:

- **`git push` is a release.** The gate is `make check` before the push, not a review step
  afterwards — once CI is green the commit is on the site within a minute.
- **Schema changes are versioned migrations in `db/migrations/`**, applied by the deploy
  (`pfg-sync` runs `pfg-migrate` on both hosts before the smoke test). They must be
  **expand-only and backward compatible** with the code already deployed — the migration
  lands seconds before the code that needs it. Add the migration file and the regenerated
  `schema.sql` in the schema commit, which goes first. See `db/migrations/README.md`.
- **Both hosts run the same commit but not the same environment** — the target PHP version
  is pinned to production's 8.2 in `.php-version` and CI reads it from there, but the standby
  still runs 8.5 because its OS ships nothing older (`docs/adr/0001-php-version-alignment.md`).
  Each host also has its own database and its own cron.

Writing an in-app changelog release stays manual; **applying** it is now part of the deploy —
`changelog.sql` is committed and `pfg-sync` pipes it into each host's database. See below.

## Changelog

`CHANGELOG.md` (Keep a Changelog 1.1.0, English) is the single source of truth for the project's
history. Releases have no version numbers — the site deploys continuously — so a section is
identified by its date and by the id of the entry users see in the sidebar.

Bullets marked `<!-- site -->` are the subset published to that in-app changelog, and the exact
Russian text that was published is quoted at the end of the release section. That makes the file
the archive the database does not provide: `changelog.sql` is committed but rewritten for every
entry, so it only ever holds the latest release.

- A `feat` or `fix` commit adds its bullet under `## [Unreleased]` **in the same commit**;
  `refactor`, `chore`, `docs`, `style` and `test` do not touch the file.
- Whether a bullet is user-visible — and how to cut a release — is the **`changelog` skill**.
- `make changelog-validate` gates `make check`, so a malformed file blocks every commit.
- **A drafted announcement needs the user's explicit approval before the release is cut.** The
  `> **RU:**` text reaches every visitor in twelve languages and is hard to change afterwards —
  once the commit is pushed the deploy applies it, and a later edit needs a fresh release or a
  manual `update` against both hosts. Never publish one the user has not seen.

Cutting the release is manual: `make changelog-release` writes `changelog.sql`,
`/translate-changelog` fills in the eleven non-Russian rows, then **commit `CHANGELOG.md` and
`changelog.sql` together**. From there the deploy carries it — `pfg-sync` runs
`deploy/pfg-changelog-apply` on both hosts after every sync, and the SQL is all upserts so
re-applying an entry is a no-op (`deploy/README.md`, *The in-app changelog*).

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
- Request: a `service` parameter names the action. Reads take GET, anything with a
  side effect takes POST; the `$apiRoutes` table in `ajax.php` declares which.
- Response: **JSON**, with the HTTP status carrying the outcome — `respondJson(200, …)`
  on success, and an error body of `{"error": {"code": …, "message": …}}` otherwise.
- Each service is a plain function in its own file under `www/api/`, returning its
  result or throwing an `ApiError`. Nothing below a handler writes to the output.

### Calculator Structure
Calculators in `www/ogame/calc/` consist of:
- `<name>.php` - Controller (sets language, loads translations)
- `<name>.tpl` - Template (renders HTML with inline JS)
- `css/<name>_bs.css` - Per-calculator styles
- `js/<name>-core.js` - DOM-free formulas (what the node:test suite exercises)
- `js/<name>-data-collector.js`, `-renderer.js`, `-orchestration.js` - form reading, output, wiring

`trade` is half-way there: it has `js/trade-core.js` and a type-checked `js/trade.js`, but the
rest of the page — form reading, output and wiring — still lives in that one file rather than in
a collector/renderer/orchestration trio. To create a new calculator use the
**`new-calculator` skill**.

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
| `www/ogame/calc/js/ogame-production.js` | Production rates, consumption, storage capacity (costs, production) |
| `www/ogame/calc/js/ogame-costs.js` | Classic build cost/time, demolition, halving cost (costs, production, queue, terraformer, lfcosts) |
| `www/ogame/calc/js/ogame-lifeform.js` | Life Form cost/time (lfcosts only) |
| `www/ogame/calc/js/dom-utils.js` | Native DOM helpers (the jQuery replacement) |
| `www/ogame/calc/js/own-api.js` | Normalizes OGame's API 2 export (`flight`, `expeditions`) |

Importing data the player copies out of the game — the API 2 export and the spy report, what each
calculator takes from them — is documented in `docs/ogame-api-import.md`. Note that
`docs/calculators/*.md` is generated (`make docs` overwrites it), so nothing hand-written goes there.

## Project Conventions

### Bug Fixes & Refactoring
- **Fix the root cause, not the symptom.** When a bug surfaces, trace it back to where the
  actual defect lives rather than patching the point where it happens to show up.
- **Suggest best practices, even if they might require refactoring.** Don't withhold a
  correct-approach suggestion just because it touches more code than a minimal patch would —
  raise it and let the user decide whether to take the larger change.

### Code Comments
Write all comments in code files in English only.

### JavaScript Style
Prefer `const`/`let` over `var`, and `Number.parseInt`/`Number.parseFloat` over the bare global
forms — in new code and whenever you're already touching a line. Don't do a drive-by rewrite of
an entire legacy file just to convert unrelated `var` declarations.

**Every JS file is type-checked** — `checkJs: true`, types expressed in JSDoc, no `.ts` sources
and no per-file `// @ts-check` opt-in. `make typecheck` gates `make check`, so a change that
breaks types cannot be committed green. Three consequences worth knowing:

- **`strictNullChecks` is on**, the rest of the `strict` family is not. A DOM lookup that can
  miss returns `HTMLElement|null` and the null has to be dealt with — early return, `?.`, or a
  narrowing `if`. Do not silence it with `/** @type {HTMLElement} */ (x)`: `dom-utils.js`
  already carries null-safe `$`, `setHtml`, `show`, `hide`, `addEvent`, `setConstrains` and
  friends, and reaching for one of those is almost always the fix. `noImplicitAny` was measured
  and deliberately left off — an unannotated parameter is missing documentation, not a defect.
- The browser code is checked **one project per calculator** (`tsconfig/<calc>.json`), because
  a page loads exactly one calculator and the files share a global scope. Those projects are
  generated from the `<script>` tags of the matching `.tpl` — after adding, removing or
  reordering a tag, run `make tsconfigs`, otherwise `make check` fails on a stale project.
- Ambient declarations for page globals, expando properties and `bootstrap` live in
  `www/ogame/calc/js/globals.d.ts`; `options-global.d.ts` covers the calculators that declare
  `options` in an inline template script.

### Cookie Storage
Calculator options persist via cookies (e.g., `options_expeditions`). Note that `options.prm.fleet` uses `~` as a comma placeholder for encoded values.

That placeholder is a workaround, not a convention: `saveToCookie`/`loadFromCookie` in
`www/js/utils.js` join records with `,`, and never escape it, so **any stored value containing a
comma is destroyed on read** — including a nested object, which is written as JSON. Settings then
fall back to their defaults with no error. If a calculator appears not to remember something,
check this before looking for a bug in the calculator itself.

### Fleet Mapping
`EXPEDITION_SHIPS` in `www/ogame/calc/js/expeditions-core.js` maps short ship codes to indices,
and the core addresses that array **by index**. If you change ship order, update the PHP side
and `expeditions.tpl` to match.

### Adding AJAX Services
Add a row to `$apiRoutes` in `www/ajax.php` naming the method and the handler, and put the
handler in its own file under `www/api/`. A handler returns the value to serialize or throws
an `ApiError`; it must not echo anything itself. On the client, check the HTTP status — the
body is JSON either way.

## Localization

Any new user-visible string (labels, tooltips, warnings, modal text) must be added to **all 13
locale files** in the same commit; reuse an existing key before creating one, and put
cross-page keys in `common` rather than duplicating them per page. Procedure: **`add-translation`
skill**.

## UI Patterns

`docs/patterns.md` is the canonical reference for the Bootstrap 5 calculator UI — tooltip
skinning, locale-aware decimal input, blur validation, input-group sizing, non-editable fields,
button styling. **Read the relevant section there before writing UI code**; the two lists below
are only a summary of its most frequently hit rules. The `flight` calculator is the reference
implementation for every pattern.

## Validation & Input Conventions
- All numeric inputs use the **blur-validation pattern** (validate/clamp on blur, never live-clamp while typing). Follow the existing helpers rather than inventing new behavior.
- Always use the locale-aware decimal helper for user-entered fractional values (RU uses `,`). **Never** apply locale separators to imported OGame API data — that data always uses `.`.
- Never persist a locale decimal separator into comma-delimited cookies; serialize with a canonical dot format.

## CSS / Bootstrap Gotchas
- Bootstrap `input-group` overrides non-id-scoped width classes — scope width rules or they will blow up to ~177px.
- Accordions and tables inside calculator panels use `max-content` intrinsic width and will widen the panel; apply `width: 0; min-width: 100%` to contain them.
- Prefer `bootstrap.Tooltip.getOrCreateInstance()` over `new bootstrap.Tooltip()` (SonarQube S1848).

## Important Notes

- **Frontend**: vanilla JS on Bootstrap 5.3, no jQuery — `www/ogame/calc/js/dom-utils.js` provides the
  DOM helpers that replaced it. Nine calculators went through the full BS5 migration;
  **`trade` is only part-way**. Its JS is migrated — `dom-utils.js`, `trade-core.js`,
  type-checked — but its UI is not: `trade.css` has no BS custom properties, the numeric fields
  validate on `keyup` instead of on blur, and it carries one Bootstrap tooltip against flight's
  thirty. Do not assume a `docs/patterns.md` UI rule already holds there.
- **External services**: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`)
- **Database**: Optional MySQL/MariaDB for changelog and trade calculator features

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Ogeeon/proxyforgame`, driven through the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` plus `docs/adr/` at the repo root; neither exists yet
and both get created lazily. See `docs/agents/domain.md`.

### The `@claude` workflow

What a run summoned from an issue can and cannot do: it gets the non-browser half of
`make check` and nothing else, so its PR still needs `playwright.yml` to go green before
merge. Also the GitHub App setup its push depends on, and how to recover a branch from the
`claude-unpushed-work` artifact when the push fails. See `docs/agents/claude-workflow.md`.
