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

// Properties the calculators hang directly off DOM elements. They are set in
// dom-utils.js and utils.js and read all over the place, so they are part of
// this project's element contract rather than incidental casts.
interface Element {
  /** Handlers registered through addEvent(), kept so removeAllEvents() can find them. */
  _eventHandlers?: Record<string, EventListener[]>;
  /**
   * Per-field validation constraints (min, max, def, allowNegative, allowFloat)
   * attached by the calculator templates and read by getConstraint(). Declared
   * on Element, not HTMLElement: the loops that set it iterate querySelectorAll
   * results.
   */
  _constrains?: Record<string, any>;
  /** Saved state for the costs calculator's incremental-render backup/restore. */
  _irnBackup?: any;
  /** Deferred incremental-render callback attached by the costs orchestrator. */
  _irnExecute?: any;
}

interface Window {
  /** The live flight orchestrator, exposed for E2E tests and console debugging. */
  flightOrchestrator?: any;
  /**
   * The orchestrator class itself. Declared here rather than assigned through
   * globalThisRecord() because unit-tests/load.js runs flight-orchestration.js
   * without dom-utils.js, where that helper lives.
   */
  FlightOrchestrator?: any;
}

interface HTMLInputElement {
  /** Input-mask state attached by the dom-utils mask helpers. */
  _inputMask?: any;
}

// Values sidebar_bs.tpl inlines into the page before sidebar_bs.js runs. Their
// declarations live in PHP, so nothing in the .js files can define them.

/** Localised button captions for the report and e-mail dialogs. */
declare const buttonsText: Record<string, string>;
/** REQUEST_URI of the current page, sent along with a misspelling report. */
declare const currUrl: string;
/** Current language code, e.g. 'en'. */
declare const currLang: string;
/** Newest changelog entry, in the shape loadFromCookie/saveToCookie expect. */
declare const currChange: { value: number, validate: (key: string, val: any) => any };
/** Fleet/resource values parsed out of a pasted OGame API string. */
declare const apiParams: Record<string, any>;
/** Universe lists per language, inlined by the flight and trade templates. */
declare const unis: Record<string, any[]>;

/**
 * The pseudo-event the validation helpers are called with. The real listeners
 * pass a genuine Event, but most call sites synthesise `{ currentTarget }` and
 * some add `data` - the name of a function to run once validation is done.
 */
interface ValidationEvent {
  currentTarget: HTMLInputElement | EventTarget | null;
  data?: string;
}
