---
paths:
  - "unit-tests/**"
  - "playwright-tests/**"
---

# Running and writing tests

Things worth knowing before running or writing a test:

- **The e2e suite finds its server itself**: with `PFG_BASE_URL` unset,
  `playwright-tests/playwright.config.js` probes `http://pfg.wmp` (WAMP) and then
  `http://localhost:8000`, and fails up front when neither answers — start one, don't guess.
  `PFG_BASE_URL` (**not** `PLAYWRIGHT_BASE_URL`) pins a host explicitly.
- Specs import `test`/`expect` from `./base`, **not** from `@playwright/test`, so a fixture
  every test needs has one place to go. New spec files must use the same import. Video
  recording is off locally (`PFG_VIDEO=1` brings it back for a failing run).
