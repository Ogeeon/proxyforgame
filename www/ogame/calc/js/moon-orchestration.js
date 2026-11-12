// ============================================================================
// MOON CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns `options` (params + cookie persistence + field
// validation), wires DOM events, drives recomputation on every change, and
// restores the saved state on load.
//
// Unit counts are deliberately not persisted: they describe a single battle,
// not a lasting preference (this matches the pre-Bootstrap behaviour).

'use strict';

const options = {
  defConstraints: { min: -Infinity, max: Infinity, def: 0, allowFloat: false, allowNegative: false },

  /** @type {Record<string, string>} Captions of the report's panel groups, filled in by the template. */
  reportText: {},
  /** @type {Record<string, string>} Captions of the result cells by id, filled in by the template. */
  reportCells: {},

  // One key per row of MOON_FIELDS (moon-core.js), which holds the defaults
  // and the bounds validate() checks a saved value against.
  /** @type {Record<string, any> & {validate: (prm: string, value: string) => any}} */
  prm: {
    ...moonFieldDefaults(),
    validate: moonValidateField,
  },

  load: function () {
    try {
      loadFromCookie('options_moon', options.prm);
      // The defenses' share used to be a switch that gave them the fleet's
      // share; a save from then keeps its results.
      const legacy = {
        defenseToDebris: false,
        defenseDebrisPercent: null,
        validate: (/** @type {string} */ field, /** @type {string} */ value) => (field === 'defenseToDebris' ? value === 'true' : value),
      };
      loadFromCookie('options_moon', legacy);
      if (legacy.defenseDebrisPercent === null && legacy.defenseToDebris) {
        options.prm.defenseDebrisPercent = options.prm.debrisPercent;
      }
    } catch (e) { console.error(e); }
  },
  save: function () { saveToCookie('options_moon', options.prm); }
};

/**
 * Whether a field is a text input that carries a number, with the blur
 * validation and constraints that go with it.
 *
 * @param {MoonField} field
 */
function isMoonTextField(field) {
  return field.kind === 'int' || field.kind === 'float';
}

/**
 * Show a value in its field the way the field's kind needs.
 *
 * @param {MoonField} field
 * @param {*} value
 */
function showMoonField(field, value) {
  if (field.kind === 'bool') setChecked(field.selector, value);
  else if (field.kind === 'float') setNumVal(field.selector, value);
  else setVal(field.selector, value);
}

/** The two coordinates, whose ceiling follows the number of systems. */
const MOON_COORDINATE_FIELDS = MOON_FIELDS.filter((field) => field.prm === 'ownSystem' || field.prm === 'targetSystem');

class MoonApp {
  constructor() {
    this.calc = new MoonCalculator();
    // Text inputs that carry numeric values and share the blur-validation flow:
    // the table's int and float fields and every unit count.
    this.numericInputs = MOON_FIELDS.filter(isMoonTextField).map((field) => field.selector)
      .concat(MOON_UNITS.map((unit) => '#' + unit.id));
    // The debris-percent selects and the checkboxes recalculate on change.
    this.changeInputs = MOON_FIELDS.filter((field) => !isMoonTextField(field)).map((field) => field.selector);
  }

  init() {
    options.load();
    this.restoreFromState();
    this._applyConstraints();
    this._bindEvents();
    this._applyTheme();
    this.recalc();
  }

  /** Fill the form from options.prm (the profile binder calls it too). */
  restoreFromState() {
    MOON_FIELDS.forEach((field) => showMoonField(field, options.prm[field.prm]));
  }

  _applyConstraints() {
    // No field takes a negative number: allowNegative stays at its default.
    MOON_FIELDS.filter(isMoonTextField).forEach((field) => {
      const el = $(field.selector);
      if (el) el._constrains = { min: field.min, max: field.max, def: field.def, allowFloat: field.kind === 'float' };
    });
    MOON_UNITS.forEach((unit) => {
      const el = document.getElementById(unit.id);
      if (el) el._constrains = { min: 0, def: 0 };
    });
    // The coordinates' static bound, set above, gives way to the galaxy's size.
    this._applySystemLimits(options.prm.numberOfSystems);
  }

  /**
   * Keep the two coordinate fields inside the galaxy the player described. The
   * ceiling moves with the "number of systems" field, so it cannot live in the
   * static constraints above.
   */
  _applySystemLimits(numberOfSystems) {
    const max = clampNumber(Math.floor(numberOfSystems || 1), 1, UNIVERSE_MAX_SYSTEMS);
    MOON_COORDINATE_FIELDS.forEach((field) => {
      const el = $(field.selector);
      if (el) el._constrains = { min: field.min, max: max, def: field.def };
    });
  }

  _bindEvents() {
    // Numeric text inputs: validate characters while typing, clamp on blur.
    this.numericInputs.forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.recalc(); });
      addEvent(el, 'blur', (e) => { validateInputNumberOnBlurNative(e); this.recalc(); });
    });

    this.changeInputs.forEach((sel) => {
      addEvent(sel, 'change', () => this.recalc());
    });

    addEvent('#reset-ds', 'click', () => this._resetGroup('destroy'));
    addEvent('#reset-cr', 'click', () => this._resetGroup('create'));
    addEvent('#reset-ph', 'click', () => this._resetGroup('phalanx'));

    // Click a per-unit "max" label to copy that count into the adjacent input.
    // The renderer stashes the raw integer in data-max-count; a dash (no
    // dataset) means the unit cannot contribute, so those clicks are ignored.
    MOON_UNITS.forEach((unit) => {
      const maxLabel = document.getElementById(unit.id + '-max');
      if (!maxLabel) return;
      addEvent(maxLabel, 'click', () => {
        const raw = maxLabel.dataset.maxCount;
        if (raw === undefined) return;
        setVal('#' + unit.id, raw);
        this.recalc();
      });
    });

    // Theme toggle (rendered inside topbar).
    const lightCb = inputEl('#cb-light-theme');
    if (lightCb) {
      lightCb.addEventListener('click', () => {
        if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
      });
    }
  }

  _applyTheme() {
    const theme = { value: 'light', validate: (k, v) => v };
    loadFromCookie('theme', theme);
    if (typeof toggleLightBS === 'function') {
      toggleLightBS(theme.value === 'light');
    }
  }

  /**
   * Read the form, run the core computation, render the result and persist the
   * (non-transient) parameters.
   */
  recalc() {
    const p = MoonDataCollector.readParams();
    this._applySystemLimits(p.numberOfSystems);
    // Every field of the table is saved; the unit counts are not (see the top).
    MOON_FIELDS.forEach((field) => { options.prm[field.prm] = p[field.prm]; });
    MoonRenderer.render(this.calc.compute(p));
    options.save();
  }

  /**
   * One panel's reset button: its fields go back to their defaults, and the
   * creation panel's unit counts to zero with them.
   *
   * @param {MoonField['group']} group
   */
  _resetGroup(group) {
    MOON_FIELDS.filter((field) => field.group === group).forEach((field) => {
      options.prm[field.prm] = field.def;
      showMoonField(field, field.def);
    });
    if (group === 'create') MOON_UNITS.forEach((unit) => setVal('#' + unit.id, 0));
    this.recalc();
  }
}

let moonApp = null;

function initializeMoonCalculator() {
  moonApp = new MoonApp();
  moonApp.init();
  // Expose the live instance so E2E tests (and console debugging) can reach it.
  if (typeof globalThis !== 'undefined') globalThisRecord().moonApp = moonApp;
}

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initializeMoonCalculator = initializeMoonCalculator;
  globalThisRecord().MoonApp = MoonApp;
}
