// Every spec imports `test` and `expect` from here rather than from
// @playwright/test, so a fixture every test needs has one place to go.
//
// The fixture that lived here routed cdn.jsdelivr.net through a disk cache
// (.cdn-cache/), because each test's fresh context re-downloaded Bootstrap.
// Bootstrap is now served from www/vendor/ on the site itself, so no test page
// loads anything from a CDN and there is nothing left to intercept.
export { test, expect } from '@playwright/test';
