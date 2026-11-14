# Copilot Instructions

This repository keeps its agent guidance in one place, so that it cannot drift out of sync
with itself.

**Read `CLAUDE.md` at the repository root before making any change.** It covers the `make`
targets, the quality gate rules, the commit, deploy and changelog procedure, and i18n across
13 locales. The guidance for one part of the tree lives in `.claude/rules/*.md`, listed in
`CLAUDE.md` with the paths each covers; read the ones that match the files you change — the
page-controller pattern and the `ajax.php` response format (`php-backend.md`), the JavaScript
style rules and the `checkJs` type-checking pass (`javascript.md`), the calculator UI
(`ui.md`) and the rest.

Deeper references, all linked from there:

- `docs/patterns.md` — the Bootstrap 5 calculator UI: tooltips, blur validation, input-group sizing
- `docs/test-scope.md` — which tests to run for a given change
- `docs/ogame-api-import.md` — importing the game's API export and spy reports
- `CHANGELOG.md` — the project's history and the source of the in-app changelog
