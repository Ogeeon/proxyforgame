# Unit tests

`node:test`, no dependencies. Run them with `make test-unit` from the repo root, or
`npm test` here. A single file: `node --test flight-core.test.js`.

The `*-core.js` calculator modules are DOM-free, so their formulas can be exercised in Node
instead of a browser — about 0.1 ms per test against roughly 360 ms through Playwright.

- `load.js` runs the classic (non-module) browser scripts inside a `vm` context and lifts out
  the globals a test asks for.
- `expect.js` is a small value-only matcher shim, so a test body here reads the same as the
  equivalent one in a Playwright spec.

Six of the ten calculators have a file here: `expeditions`, `flight`, `graviton`, `moon`,
`production`, `terraformer`.

## Where a test belongs

**Here**, if it only calls a `*-core.js` function and asserts on the returned object.

**In Playwright**, if it fills a field, clicks, or asserts on rendered output — **including
when those actions sit in a shared helper** and the test body itself looks pure. A test that
reaches the maths *through the form* is covering the form-to-params wiring, and that coverage
is lost the moment it moves here.

That last rule is why the `flight`, `queue` and `lfcosts` specs keep tests whose assertions are
plain arithmetic. They look like they belong in this directory. They do not.

New tests go in the existing file for that calculator, never a new file.
