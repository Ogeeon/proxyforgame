// Ambient declarations for the calculator pages.
//
// The browser code is loaded as plain <script> globals, so anything that comes
// from outside a .js file - a CDN bundle, a value the PHP template inlines -
// has no declaration TypeScript can find. This file supplies them. It ships
// nothing to the browser; it exists only for `npm run typecheck` and the
// editor.

// Bootstrap itself is not declared here: @types/bootstrap already exports a UMD
// global, which these files pick up because they are scripts rather than
// modules. It is pulled in through `types` in tsconfig.json, and its
// @popperjs/core import is why that package sits in devDependencies - the
// browser gets Popper from the jsdelivr bundle, never from node_modules.
