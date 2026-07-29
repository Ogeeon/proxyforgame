---
name: commit
description: Commit changes in this repo — Conventional Commits subject, the SonarQube question, and scoping the test run to what changed. Use whenever the user asks to commit, stage, or push work.
---

# Committing in pfg.wmp

Four steps, in order. Do not skip step 1 — it needs an answer before anything is committed.

## 1. Ask about SonarQube

Ask the user whether the changed files should be run through SonarQube
(`analyze_code_snippet` on the sonarqube MCP server, one call per changed file).
**Wait for the answer.**

Exception: work driven by `/sonar-fix` has already had its Sonar pass — commit without asking.

## 2. Run the right tests

Resolve the scope from `docs/test-scope.md` — read it, don't guess the paths. In short:
all changed files in one calculator → that calculator's unit test (if it exists) plus
`make test-one spec=<name>`; anything shared → full `make test`; locale files in the change →
`make check`.

Never commit an unverified fix. Every commit follows a passing run of its resolved scope.

Before `git push`, the full `make test`, regardless of how narrow the commits were.

## 3. Write the subject

`<type>(<scope>): <subject>` — English, imperative mood, lowercase after the colon,
no trailing period.

- **Types**: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`
- **Scope**: the calculator (`flight`, `moon`, `lfcosts`, `production`, `queue`, …), or the
  area for cross-cutting files. Use `shared` for `ajax.php`, `common.js`, `dom-utils.js`,
  `Intl.php` and friends. Reserve `claude` for CLAUDE.md and agent tooling.

Commits before 2026-07-22 use an older plain-sentence style — ignore them, follow this rule.

## 4. Commit

Write the message to a temp file and use `git commit -F <file>`, or keep it to a single `-m`
with no quotes or backticks.

**Never use a PowerShell here-string (`@'…'@`) for a commit body** — in the Bash tool it ends
up prepending a literal `@` to the message.

Keep unrelated pre-existing changes in a separate commit. If the working tree mixes your work
with something that was already dirty when you started, split it.
