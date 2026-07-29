---
name: add-translation
description: Add or change user-visible text in the calculators — locale keys across all 13 languages, where the key belongs, and how templates hand strings to JS. Use whenever a label, tooltip, warning, button, modal or any other visible string is added or reworded.
---

# Adding user-visible text

Every new string is a key in **all 13 locale files, in the same commit**. A string hardcoded
in a `.tpl` or `.js` is a bug, not a shortcut.

Locales: `bs de en es fr it nl pl pt ru sk tr us` (`us` is a separate file from `en` — the
validator checks both; fill both).

## 1. Reuse before you create

Search `www/locale/en.json` for an existing key covering the string. The locale files carry
hundreds of keys and duplicates are the usual failure here.

## 2. Pick the right section

`Intl::getTranslations($locale, $section)` merges the `common` block with the page's own
block; **the page block wins on conflict**.

- Used by more than one page → **`common`**. Do not copy it into each page's block.
- Used by exactly one calculator → that calculator's block.

## 3. Add the key everywhere

Write real translations for the languages you can, then:

```powershell
make i18n-fix        # fills any locale still missing the key with a placeholder
make i18n-validate   # must be green before you commit
```

`make i18n-fix` writes placeholders, not translations — anything it inserts still needs a real
string. Use the official OGame terminology of each language for game entities (buildings,
technologies, ships, Life Forms).

## 4. Wire it to the client

The template injects translations as JS variables. Pass them through `json_encode` — never
interpolate a locale string straight into inline JS, or an apostrophe in the French or Italian
text breaks the page.

## 5. Test

Locale files are shared, so the scope is the full suite: **`make check`** (= `i18n-validate` +
both suites), not `make test`. See `docs/test-scope.md`.
