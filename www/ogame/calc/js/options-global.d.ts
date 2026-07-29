// The `options` page global.
//
// Seven calculators declare it in their own orchestrator (`const options = {…}`);
// costs, production and queue declare it in an inline <script> inside the .tpl
// instead, where no .js file can see it. This declaration stands in for those,
// and for the shared files (utils.js, common.js, dom-utils.js) that read it
// without knowing which page they are on.
//
// It is deliberately NOT part of globals.d.ts: a project that already has a real
// `const options` would collide with it. scripts/generate-tsconfigs.js adds this
// file only to the projects whose scripts do not declare one.

declare const options: Record<string, any>;
