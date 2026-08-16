---
name: commit
description: Commit changes in this repo — the Conventional Commits subject and the body below it, the SonarQube question, and scoping the test run to what changed. Use whenever the user asks to commit, stage, or push work.
---

# Committing in pfg.wmp

Five steps, in order. Do not skip step 1 — it needs an answer before anything is committed.

## 1. Ask about SonarQube — only if Sonar would see the change

Ask only when the commit touches a file Sonar actually analyzes:

| Ask | Do not ask |
|-----|------------|
| `.js`, `.php`, `.tpl`, `.css`, `.html` | `.md` — CLAUDE.md, README, `docs/**`, `CHANGELOG.md` |
| | `Makefile`, `.gitignore`, `.gitattributes`, CI workflows |
| | `.claude/**` — skills, commands, plans |
| | `www/locale/*.json` and other data-only JSON |
| | `*.sql` — `schema.sql`, `changelog.sql` |

A commit that is entirely in the right-hand column has nothing for `analyze_code_snippet` to
report on; asking is noise. Commit it without the question. **Mixed commit → ask** — one
analyzable file in the change is enough.

When it does apply: ask the user whether the changed files should be run through SonarQube
(`analyze_code_snippet` on the sonarqube MCP server, one call per changed file).
**Wait for the answer.**

Exception: work driven by `/sonar-fix` has already had its Sonar pass — commit without asking.

## 2. Update the changelog

A `feat` or `fix` commit carries its bullet under `## [Unreleased]` in `CHANGELOG.md`, in the
same commit. `refactor`, `chore`, `docs`, `style` and `test` leave the file alone.

Whether the bullet also gets the `<!-- site -->` marker — that is, whether users see it in the
sidebar — is decided by the table in the **`changelog` skill**. Read it rather than guessing;
`make check` fails on a file that marks a bullet without carrying the matching Russian text.

## 3. Run the right tests

Resolve the scope from `docs/test-scope.md` — read it, don't guess the paths. In short:
all changed files in one calculator → that calculator's unit test (if it exists) plus
`make test-one spec=<name>`; anything shared → full `make test`; locale files in the change →
`make check`.

Never commit an unverified fix. Every commit follows a passing run of its resolved scope.

Before `git push`, the full `make test`, regardless of how narrow the commits were.

## 4. Write the message

### The subject

`<type>(<scope>): <subject>` — English, imperative mood, lowercase after the colon,
no trailing period.

- **Types**: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`
- **Scope**: the calculator (`flight`, `moon`, `lfcosts`, `production`, `queue`, …), or the
  area for cross-cutting files. Use `shared` for `ajax.php`, `ogame-costs.js` and the other
  `ogame-*.js` formula files, `dom-utils.js`, `Intl.php` and friends. Reserve `claude` for CLAUDE.md and agent tooling.

Commits before 2026-07-22 use an older plain-sentence style — ignore them, follow this rule.

### The body

A one-line subject is enough for a change that needed no decision. Anything else carries a
body, and the body is where the history earns its keep — the diff already says what changed,
so write down what a reader would otherwise have to rediscover: what the code did wrong, what
the new shape does instead, which constraint forced it, and what deliberately stayed as it was.

- **Leave a blank line after the subject.** Git has no other way to tell the two apart:
  without it the whole message collapses into the subject line and `git log --oneline` prints
  the entire explanation.
- **Prose paragraphs, wrapped near 80 columns** — not a bullet list of the files touched.
- **Close with the `Co-Authored-By` trailer**, after a blank line, naming the model that wrote
  the commit: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. It is the repository's
  practice, not just the harness default — 238 of the 351 commits since 2026-07-22 carry one,
  and the history holds Opus 5, Opus 4.8, Sonnet 5 and Haiku 4.5.

## 5. Commit

Write the message to a temp file and use `git commit -F <file>`, or keep it to a single `-m`
with no quotes or backticks.

**Never use a PowerShell here-string (`@'…'@`) for a commit body** — in the Bash tool it ends
up prepending a literal `@` to the message.

Keep unrelated pre-existing changes in a separate commit. If the working tree mixes your work
with something that was already dirty when you started, split it.
