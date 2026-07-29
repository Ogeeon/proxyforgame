# Which tests to run for a change

Single source of truth for scoping a test run. Referenced by the `commit` skill and by
`/sonar-fix`; if a path below is wrong, fix it here rather than in either caller.

The rule has one question: **does every changed file belong to the same calculator?**
If yes, run that calculator's tests. If even one file is shared, run everything.

## The ten calculators

`costs`, `expeditions`, `flight`, `graviton`, `lfcosts`, `moon`, `production`, `queue`,
`terraformer`, `trade`.

## A calculator's file set

A file belongs to calculator `<name>` if it is one of:

| Path | Notes |
|------|-------|
| `www/ogame/calc/<name>.php` | controller |
| `www/ogame/calc/<name>.tpl` | template |
| `www/ogame/calc/js/<name>-*.js` | `-core`, `-data-collector`, `-orchestration`, `-renderer` |
| `www/ogame/calc/js/trade.js` | `trade` only — its page code is still one file, `-core` aside |
| `www/ogame/calc/css/<name>_bs.css` | |
| `unit-tests/<name>-core.test.js` | present for 7 of the 10 |
| `playwright-tests/tests/<name>.spec.js` | |

There is no `www/ogame/calc/js/<name>.js` for any calculator except `trade`.
`www/ogame/calc/lf-techdata.inc.php` is data for `lfcosts`.

## Running a calculator's tests

```powershell
node --test <name>-core.test.js    # from unit-tests/, only if that file exists
make test-one spec=<name>
```

Seven of the ten have a unit test: `expeditions`, `flight`, `graviton`, `moon`, `production`,
`terraformer`, `trade`. For `costs`, `lfcosts` and `queue` there is no `*-core.test.js` —
skip that step. Check for the file rather than trusting this list.

## Shared files — these force the full `make test`

Anything not in a calculator's file set, notably:

- `www/ogame/calc/js/common.js` — **note the path**; there is no `www/ogame/common.js`
- `www/ogame/calc/js/dom-utils.js`
- `www/ogame/calc/h_functions.php`, `www/ogame/calc/h_abox.php`
- `www/ajax.php`, `www/Intl.php`, `www/langs.php`, `www/db.connect.inc.php`
- `www/locale/*.json` — use `make check`, so the locale validator runs too
- `playwright-tests/tests/base.js` — **note the path**, it sits in `tests/`, not the root
- `playwright-tests/playwright.config.js`
- anything under `unit-tests/` other than a single `<name>-core.test.js` (`load.js`, `expect.js`)
- the `Makefile` itself

## Always

- **Before `git push`: full `make test`**, however narrow the commits were.
- New tests go in the existing file for that calculator, never a new file.
- `make check` = `i18n-validate` + `lint` + `typecheck` + `tsconfigs-check` + both suites.
  Prefer it over `make test` whenever locale files are in the change; plain `make test`
  validates neither translations nor types.
- The static gates are not scoped per calculator — they cover the whole tree and take about
  20 s together, so run `make lint typecheck` on any JS change even when the test scope is one
  calculator. If the change touched a template's `<script>` tags, run `make tsconfigs` first.
