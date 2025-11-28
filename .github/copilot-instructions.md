# Copilot Instructions (repo-specific)

Purpose: short, actionable guidance to help AI coding agents work productively in this repository.

## Big Picture
- Small WAMP-style PHP site: each page is a minimal PHP controller that sets `$lang` and context, calls `Intl::getTranslations($lang, '<page>')`, then `require_once('<page>.tpl')` to render HTML + inline JS.
- Single AJAX surface: `www/ajax.php` receives POSTs (param `service`) and returns two-line responses in the format `"<code>\n<payload>"` (where `0` = success). Many client actions call these services.
- Calculators live in `www/ogame/calc/` and usually require touching PHP, the `.tpl` template, and client JS in `js/`.

## Key Files & Patterns
- `www/ajax.php` — central dispatcher. Search for `case '...':` to find services.
- `www/Intl.php`, `www/langs.php`, `www/locale/*.json` — translation and language mapping pipeline.
- `www/db.connect.inc.php` — DB connection and SQL helper functions.
- `www/ogame/calc/*.{php,tpl}` and `www/ogame/calc/js/*` — calculator logic, templates, and client integration.

## Project Conventions (do this exactly)
- Controller → Template: always set `$lang`, call `Intl::getTranslations($lang, '<page>')`, then `require_once('<page>.tpl')`.
- Ajax response format: `"<code>\n<payload>"`. Always check the numeric `code` first (0 = OK). Follow existing services for example responses.
- Cookie storage: calculators persist options using cookie keys like `options_expeditions`. Note: `options.prm.fleet` uses `~` as a comma placeholder.
- Fleet mapping: client JS (e.g. `ogame/calc/js/expeditions.js`) maps short ship codes to indices. If you change ship order, update both PHP and JS mapping.
- Translations: when changing visible text, update `locale/*.json` and ensure server calls (via `Intl::getTranslations`) include the new keys.

## Local Dev & Useful Commands
- PHP path used in repo (PowerShell example):
  ```powershell
  & 'd:\wamp64\bin\php\php7.4.9\php.exe' .\ogame\calc\flight.php
  ```
- Full-site testing: start your WAMP stack and open `http://localhost/<project-path>/`.
- VS Code task: use `Run In Terminal` — the task runs `d:/wamp64/bin/php/php7.4.9/php.exe ${file}`.

## Integration Points & Risks
- Legacy frontend: jQuery 1.5.1 and jQuery UI 1.8.x. Upgrading can break calculators — test thoroughly if you change these.
- External services: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`) and SMTP code inside `www/ajax.php` — do not commit credentials.

## Debugging Tips
- To trace an AJAX flow, add temporary logging or `error_log()` calls around `case` blocks in `www/ajax.php` and follow the `"<code>\n<payload>"` response format.
- For missing translation keys, check `www/Intl.php` and the corresponding `www/locale/<lang>.json` file.

## Quick Task Starters
- Change UI text: update `www/locale/<lang>.json` and ensure templates or controllers pass the new keys to the client.
- Add/modify a calculator: change `www/ogame/calc/*.php`, update `*.tpl` and `js/*`, then run the matching PHP script manually or test in browser.
- Add an AJAX service: add a `case` to `www/ajax.php` and return `"<code>\n<payload>"` consistent with existing services.

## Safety Notes
- Never commit hard-coded secrets. Move credentials out of `www/ajax.php` into environment-config during deploy.
- Avoid big client library upgrades without manual QA across `ogame/calc` pages.

If you'd like a follow-up, I can: (A) add a small PR checklist (secrets, translations, QA), (B) paste example diffs for a specific calculator, or (C) run a quick smoke-test command. Which do you want next?
## Purpose
Short, practical guidance to help AI coding agents work productively in this repo: architecture, conventions, workflows, and integration points.

## Big picture (architecture & data flow)
- What it is: a small WAMP-style PHP site where each page is a tiny PHP controller that loads translations and `require_once`'s a `.tpl` template.
- Server → client flow: PHP controller sets `$lang` and context, calls `Intl::getTranslations($lang, '<page>')`, then includes the template which emits HTML + inline JS using locale data from `locale/*.json`.
- Ajax surface: a single POST router `ajax.php` (param `service`) returns two-line responses `"<code>\n<payload>"` (0 = success). Many client actions call `ajax.php` services.

## Key files to inspect first
- Top-level controllers: `index.php`, `policy.php`, `pi.php`.
- Language negotiation: `langs.php` (URL prefix mapping, `us` → `en`).
- Ajax router & services: `ajax.php` (look for `case '...':`).
- DB and SQL helpers: `db.connect.inc.php` and `SqlQuery` helper functions.
- Calculators: `ogame/calc/*.php`, templates `ogame/calc/*.tpl`, JS in `ogame/calc/js/` (e.g. `expeditions.js`, `flight.js`).
- Client locales: `locale/*.json` (server-side translations via `Intl.php`).

## Project-specific conventions & examples
- Controller → Template: always set `$lang`, call `Intl::getTranslations($lang, '<page>')`, then `require_once('<page>.tpl')`.
- Ajax response format: `"<code>\n<payload>"`. See services like `SendReport`, `GetChangelog`, `GetDataCode` for patterns.
- Cookie storage: calculators persist options to cookies (keys like `options_expeditions`). `options.prm.fleet` uses `~` as a comma placeholder.
- Fleet mapping: client JS maps short codes to IDs (see `ogame/calc/js/expeditions.js` `fleetCodeMapping` — update server-side code if you change ship indices).
- Translations: update both server translation calls and `locale/*.json` when changing UI text (templates often inject translation keys into JS variables).

## Integration points & external dependencies
- Local dev: WAMP + PHP 7.4.x (repo references `php7.4.9`).
- Client libs: jQuery 1.5.1 and jQuery UI 1.8.x (old; upgrading is risky).
- External services: `https://logserver.net/api/proxyforgame/` (used by `GetDataCode`), SMTP usage inside `ajax.php` (avoid exposing credentials), and any remote logging/email endpoints.

## Developer workflows & quick commands
- Run a single PHP script (PowerShell):
  & 'd:\wamp64\bin\php\php7.4.9\php.exe' .\ogame\calc\flight.php
- Full site testing: start local WAMP and open `http://localhost/<project-path>/`.
- VS Code task: use the workspace task `Run In Terminal` (label) which runs `d:/wamp64/bin/php/php7.4.9/php.exe ${file}`.

## Safety & maintenance notes
- Do not commit hard-coded credentials. `ajax.php` currently contains SMTP code — prefer environment-based secrets if you change it.
- Avoid upgrading jQuery/jQuery UI without manual QA across `ogame/calc` pages.

## Quick search helpers
- Templates: search for `require_once('*.tpl')` or `\.tpl`.
- Translations: search `Intl::getTranslations` and page keys like `'flight'`.
- Ajax consumers: search JS for `$.post(..., {service:` and `ajax.php` for `case` lines.

## When in doubt
- Run pages in a browser under WAMP to see runtime interactions. Make small incremental changes and test calculators manually; there are no automated tests in the repo.

If you'd like, I can: (A) expand with direct code snippets from `ogame/calc/`, (B) add a short PR checklist (secrets, language redirects, changelog), or (C) produce example edits for a specific page. Which do you prefer?
