---
name: new-calculator
description: Scaffold a new calculator page in pfg.wmp, or add a new AJAX service to ajax.php. Covers the generator, the page controller pattern, and what the generator does not do. Use when creating a new calculator, page, or AJAX endpoint.
---

# Adding a calculator or an AJAX service

## Scaffold first — do not hand-write the file set

```powershell
make new-calc name=<calc>
```

`scripts/new-calculator.js` creates all eight files and wires two of the shared ones:

- `www/ogame/calc/<calc>.php`, `<calc>.tpl`
- `www/ogame/calc/js/<calc>-core.js`, `-data-collector.js`, `-renderer.js`, `-orchestration.js`
- `www/ogame/calc/css/<calc>_bs.css`
- `playwright-tests/tests/<calc>.spec.js`
- adds the translation keys to `en.json` and syncs them to all 13 locales
- adds the entry to `www/sidebar_bs.tpl`

It skips any file that already exists, so it is safe to re-run.

## What it leaves for you

1. **Real translations.** It writes placeholders into the other 12 locales. Replace them, using
   the official OGame terminology per language — see the `add-translation` skill.
2. **The maths**, in `<calc>-core.js`. Keep it DOM-free: that is what makes it testable in Node.
3. **A unit test.** The generator does not create one. If the calculator has formulas worth
   asserting, add `unit-tests/<calc>-core.test.js` — a test that only calls a `*-core.js`
   function and asserts on the returned object belongs there, not in Playwright.
4. **The spec body.** The generated `.spec.js` is boilerplate; it must import `test`/`expect`
   from `./base`, not from `@playwright/test`.

## The page controller pattern

Three steps, no more:

```php
$lang = $_GET['lang'] ?? 'en';
$tr = Intl::getTranslations($lang, 'flight');
require_once('flight.tpl');
```

`Intl::getTranslations($lang, $section)` merges the `common` block with the page's own block;
the page block wins on conflict.

## UI

`docs/patterns.md` is the canonical reference — tooltip skinning, locale-aware decimals, blur
validation, input-group sizing. `flight` is the reference implementation. Read the relevant
section before writing the template, rather than reinventing a pattern.

## Adding an AJAX service

One endpoint, `www/ajax.php`, dispatching on a `service` POST parameter through a `switch`.
Add a `case` block returning the two-line format `"<code>\n<payload>"`, where `0` means success.
On the client, **check the numeric code first**, before touching the payload.

## Testing

`ajax.php` and the locale files are shared — a change touching them means the full `make check`.
A brand-new calculator's own files are its own scope once it exists. See `docs/test-scope.md`.
