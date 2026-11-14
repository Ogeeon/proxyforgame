---
paths:
  - "**/*.js"
  - "**/*.d.ts"
  - "tsconfig/**"
  - "www/**/*.tpl"
  - "www/ogame/calc/expeditions.php"
---

# JavaScript

## JavaScript Style
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

## Cookie Storage
Calculator options persist via cookies (e.g., `options_expeditions`). Note that `options.prm.fleet` uses `~` as a comma placeholder for encoded values.

That placeholder is a workaround, not a convention: `saveToCookie`/`loadFromCookie` in
`www/js/utils.js` join records with `,`, and never escape it, so **any stored value containing a
comma is destroyed on read** — including a nested object, which is written as JSON. Settings then
fall back to their defaults with no error. If a calculator appears not to remember something,
check this before looking for a bug in the calculator itself.

## Fleet Mapping
`EXPEDITION_SHIPS` in `www/ogame/calc/js/expeditions-core.js` maps short ship codes to indices,
and the core addresses that array **by index**. If you change ship order, update the PHP side
and `expeditions.tpl` to match.
