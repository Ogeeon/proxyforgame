# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyForGame (pfg.wmp) is a PHP-based calculator website for the OGame space strategy game. The application follows a WAMP-style architecture where each page is a minimal PHP controller that loads translations and includes a template for rendering.

## Which Calculator?

This repo contains ten calculators: `costs`, `expeditions`, `flight`, `graviton`, `lfcosts`,
`moon`, `production`, `queue`, `terraformer`, `trade`. Before exploring or editing, confirm which
one the request targets if the file path is ambiguous — do not assume the cost calculator by default.

## Path-scoped rules

The rules for one part of the code live in `.claude/rules/` and load when a file under their
`paths:` is read. Read the matching file first when a task reaches that area before any file
in it has been opened:

| File | Covers |
|------|--------|
| `.claude/rules/architecture.md` | Calculator file layout, i18n loader, key shared files, external services |
| `.claude/rules/php-backend.md` | Page controller pattern, the AJAX API and adding a service |
| `.claude/rules/javascript.md` | JS style, type checking (`strictNullChecks`, per-calculator tsconfig), cookie storage, fleet mapping |
| `.claude/rules/ui.md` | `docs/patterns.md`, input validation, CSS/Bootstrap gotchas, vendored Bootstrap, the state of `trade` |
| `.claude/rules/mcp.md` | The MCP server and why formulas stay in `*-core.js` |
| `.claude/rules/tests.md` | How the e2e suite finds its server, the `./base` import |
| `.claude/rules/local-dev.md` | Running PHP scripts, Docker, WAMP and `make serve` |

## Development Commands

### Task Runner (`make`)

`make` from the repo root is the entry point for everything — **`make help` lists every
target**. **Requires GNU Make 4.x**; the GnuWin32 3.81 build that is still on many Windows
boxes is too old (`choco install make`). The ones you reach for most:

- `make test` — both suites, the ritual before a commit; `make test-one spec=flight` — one spec.
- `make check` — the green gate: changelog, i18n, migrations, secrets, the linters (workflows,
  shell, Dockerfile, PHP, CSS, spelling, agent files, JS), typecheck, `html-validate` (needs
  Java 17+) and both suites. **A change is not done until it passes.** The standalone
  checkers come from `mise.toml` (`make install` runs `mise install`); `make fix` applies
  the safe autofixes.

### Quality gate rules

- **Never disable a lint rule or add a suppression to get a change through.** An exception
  is one path and one rule, carries its reason, and needs the user's decision. The places
  they live: `.github/jactionlint.yaml`, `.hadolint.yaml`, `.betterleaks.toml`,
  `osv-scanner.toml`, `mago.toml`, `_typos.toml`, `.agnix.toml`, inline
  `# shellcheck disable=`.
- **Baselines only shrink.** `mago-*-baseline.toml` and `stylelint-suppressions.json` hold
  the findings that predate the check. Fix a finding, then regenerate (`make php-baseline`)
  and check the diff only removes entries — never regenerate to absorb a new one.
- **Generated files are never edited by hand**: `tsconfig/<calc>.json` (`make tsconfigs`)
  and `www/vendor/` (`make vendor`); `tsconfigs-check` and `vendor-check` fail on a hand
  edit. `docs/calculators/*.md` is generated too (`make docs` overwrites it), so nothing
  hand-written goes there.
- A shipped `db/migrations/*.sql` is never edited (`make migrations-check`); add a new one.
- Commit messages are linted in CI (`make commitlint`): Conventional Commits, body lines
  ≤ 100 columns, no body line starting with `word:` (it parses as a footer).

Variables override on the command line: `make serve PORT=8080`, `make serve PHP=...`. The
constraints on writing recipes (platform default shell, one command per line, never pin
`SHELL`) are documented in the Makefile header.

### Which tests to run

`docs/test-scope.md` — the file-set table and the shared-file list. `unit-tests/README.md`
covers whether a given test belongs in Node or in Playwright. Tests live in
`unit-tests/<name>-core.test.js` and `playwright-tests/tests/<name>.spec.js`.

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
receiver on the host verifies it and resets the checkout to that commit, and a five-minute
timer catches any delivery that got lost. One host serves both `proxyforgame.net` and
`proxyforgame.com`; there is no standby (`docs/adr/0003-single-host-php-8-5.md`). Full
mechanics, rollback and the rebuild runbook: **`deploy/README.md`**.

Three consequences for everyday work:

- **`git push` is a release.** The gate is `make check` before the push, not a review step
  afterwards — once CI is green the commit is on the site within a minute.
- **Schema changes are versioned migrations in `db/migrations/`**, applied by the deploy
  (`pfg-sync` runs `pfg-migrate` before the smoke test). They must be **expand-only and
  backward compatible** with the code already deployed — the migration lands seconds before
  the code that needs it. Add the migration file and the regenerated
  `schema.sql` in the schema commit, which goes first. See `db/migrations/README.md`.
- **The host runs PHP 8.5 and MariaDB 11.8.** `.php-version` pins the PHP and CI reads it from
  there; CI's database is still MariaDB 10.4, so SQL that only newer MariaDB accepts passes
  on the site and fails in CI, never the other way round.

**After a push, watch it through.** A push is not finished when `git push` returns:

1. Follow the CI run for the pushed SHA (`gh run list --limit 5`, then `gh run watch <id>`
   or a re-check) until it ends. Report a failure with the failing job's output; do not push
   a fix on top without saying so.
2. Once CI is green, check SonarCloud for the new analysis (`Ogeeon_proxyforgame`): the
   quality gate and the OPEN issues, via the sonarqube MCP server. The scan lands a few
   minutes after the push, so compare against what was expected — a Sonar-driven change
   should have closed its findings, and anything new is reported, not silently left.
3. Say the outcome in one line: CI result, quality gate, and any open issue that was not
   there before the push.

Writing an in-app changelog release stays manual; **applying** it is now part of the deploy —
`changelog.sql` is committed and `pfg-sync` pipes it into the host's database. See below.

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
  manual `update` against the host's database. Never publish one the user has not seen.

Cutting the release is manual: `make changelog-release` writes `changelog.sql`,
`/translate-changelog` fills in the eleven non-Russian rows, then **commit `CHANGELOG.md` and
`changelog.sql` together**. From there the deploy carries it — `pfg-sync` runs
`deploy/pfg-changelog-apply` after every sync, and the SQL is all upserts so
re-applying an entry is a no-op (`deploy/README.md`, *The in-app changelog*).

## Project Conventions

### Bug Fixes & Refactoring
- **Fix the root cause, not the symptom.** When a bug surfaces, trace it back to where the
  actual defect lives rather than patching the point where it happens to show up.
- **Suggest best practices, even if they might require refactoring.** Don't withhold a
  correct-approach suggestion just because it touches more code than a minimal patch would —
  raise it and let the user decide whether to take the larger change.

### Code Comments
Write all comments in code files in English only.

## Localization

Any new user-visible string (labels, tooltips, warnings, modal text) must be added to **all 13
locale files** in the same commit; reuse an existing key before creating one, and put
cross-page keys in `common` rather than duplicating them per page. Procedure: **`add-translation`
skill**.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `Ogeeon/proxyforgame`, driven through the `gh` CLI.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` (the glossary) plus `docs/adr/` at the repo root; both
grow lazily as terms and decisions get resolved. See `docs/agents/domain.md`.

### The `@claude` workflow

What a run summoned from an issue can and cannot do: it gets the non-browser half of
`make check` and nothing else, so its PR still needs `playwright.yml` to go green before
merge. Also the GitHub App setup its push depends on, and how to recover a branch from the
`claude-unpushed-work` artifact when the push fails. See `docs/agents/claude-workflow.md`.
