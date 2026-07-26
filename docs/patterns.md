# UI patterns of the Bootstrap 5 calculators

The canonical implementation of every pattern below is the **flight** calculator
(`flight.tpl`, `css/flight_bs.css`, `js/flight-*.js`) — the most heavily refined of the
migrated set. Where flight has no instance of a pattern, the source is named explicitly.

Scope: the nine migrated calculators — costs, expeditions, flight, graviton, lfcosts,
moon, production, queue, terraformer. `trade` is deliberately **out of scope**: it runs on
Bootstrap 5 but never went through the migration (monolithic `trade.js`, its own
`trade.css` with no BS custom properties, no `dom-utils.js`).

---

## (a) Bootstrap tooltip skinning

Two halves: the CSS skin and the JS initialisation.

**Skin** — lives once in `www/css/common_bs.css`, which every calculator already loads.
Do **not** restate it in a per-calculator `*_bs.css`.

```css
/* Tooltip skin shared by every calculator: the Bootstrap default is an opaque
   black bubble that ignores the theme, so repaint it off the theme variables. */
.tooltip-inner {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  border: 1px solid var(--bs-border-color);
  max-width: 250px;
  text-align: left;
}

.tooltip.bs-tooltip-top .tooltip-arrow::before    { border-top-color: var(--bs-border-color); }
.tooltip.bs-tooltip-bottom .tooltip-arrow::before { border-bottom-color: var(--bs-border-color); }
.tooltip.bs-tooltip-start .tooltip-arrow::before  { border-left-color: var(--bs-border-color); }
.tooltip.bs-tooltip-end .tooltip-arrow::before    { border-right-color: var(--bs-border-color); }
```

**Initialisation** — in the template's `DOMContentLoaded` block, always via
`getOrCreateInstance` (SonarQube S1848 flags the bare `new bootstrap.Tooltip(el)` as an
object created for its side effect, and it double-binds an element that is re-initialised):

```js
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
    bootstrap.Tooltip.getOrCreateInstance(el);
  });
  initializeFlightCalculator();
});
```

Rows built at run time carry their own call after insertion — see
`queue-renderer.js:97`, `lfcosts-renderer.js:134` and
`flight-orchestration.js` (`_initRowTooltips`). A row that is removed must dispose its
tooltips **before** the markup is replaced, or the instance leaks and the bubble outlives
its anchor. Disposing after an `innerHTML` write is a no-op — it walks the *new* nodes.
`flight-orchestration.js` (`_disposeRowTooltips`) is the reference for the pair.

### Which elements get a Bootstrap tooltip

This is the part that is easy to get wrong in both directions, so it is stated as a rule
rather than left to taste:

| Element | Treatment |
|---|---|
| `<i class="bi bi-question-circle">` next to a field | Bootstrap tooltip |
| `<abbr>` wrapping a term that needs explaining | Bootstrap tooltip |
| **Icon-only buttons** (reset, save/load/delete, add-row, remove-row, take-to-calc, …) | Bootstrap tooltip |
| **Masked date / duration / tolerance inputs** | **native `title=`** — a bubble anchored to the field sits over the digits being overtyped |
| A button whose `title` merely repeats its own visible label | leave it; a bubble that echoes the button is noise (`production.tpl:616-617`) |

**Deviation to look for**: a `.tooltip-inner` block still sitting in a per-calculator CSS
file; `new bootstrap.Tooltip(...)`; an icon-only button still on a bare native `title=`;
a dynamically built row that inits tooltips but never disposes them.

---

## (b) Locale-aware decimal input and parsing

RU and several other locales use `,` as the decimal separator. The separator reaches JS
from the locale file through the template:

```php
options.decimalSeparator = '<?= $l['decimal-separator'] ?>';
```

**Reading** a user-entered fractional value — always `getInputNumber(el)` (`utils.js`),
never `parseFloat(el.value)`:

```js
const bonus = getInputNumber(document.getElementById('lf-crawler-bonus'));
```

**Writing** a computed number back into a field — two helpers, and they are *not*
interchangeable. Both are canonical; pick by role:

| Helper | Signature | Use when |
|--------|-----------|----------|
| `setNumVal` (`dom-utils.js`) | `setNumVal(selector, value)` | Writing a plain number into a field by selector. The common case. |
| `localizeFloat` (`utils.js`) | `localizeFloat(value[, decimalDigits])` | You need the *string*, not the assignment — e.g. to truncate to N decimals, or to feed a value into markup you are building. |

The two are **exactly equivalent** when no digit count is given: `dom-utils.js:59-61` defines
`setNumVal(sel, v)` as `setVal(sel, String(v).replace('.', separator))`, i.e. precisely
`setVal(sel, localizeFloat(v))`. So this is a readability rule, not a correctness one —
`setVal(sel, localizeFloat(v))` is not a bug, just the long way round. What *is* a bug is
reaching an element by reference rather than by selector and then writing a raw float:
`setNumVal` only takes a selector, so those sites need `localizeFloat` and nothing else.

```js
// Plain write by selector.
setNumVal('#lf-crawler-bonus', bonus);

// Formatting: 4 decimals, then written through a class-based setter.
this._setClassVal(`${id}-speed`, localizeFloat(frac(v.speed, 6) * 100, 4));
```

**Never** apply the locale separator to imported OGame API data — that payload always
uses `.` (CLAUDE.md). Likewise, never persist a locale separator into a comma-delimited
cookie: serialise with a canonical dot.

**Deviation to look for**: `parseFloat(input.value)` / `Number(input.value)` on a
user-entered field; `el.value = someFloat` without either helper; a locale separator
applied to an API-imported number.

---

## (c) Blur-based validation with clamping

Constraints live on the element as a `_constrains` object, read back by `getConstraint`.
Validation runs on `keyup` (character filtering only) and on `blur` (filtering **plus**
min/max clamping and the warning banner). Values are never live-clamped while typing.

**Declare the constraints:**

```js
_setInputConstraints() {
    document.querySelectorAll('#lf-ships-bonuses input[type=text]').forEach((el) => {
        el._constrains = { min: 0, max: Infinity, def: 0, allowFloat: true, allowNegative: false };
    });
    const coord = (id, max) => {
        const el = document.getElementById(id);
        if (el) {
            el._constrains = { min: 1, def: 0, max };
        }
    };
    coord('departure-g', 12); coord('destination-g', 12);
}
```

**Wire the events** — `validateInputNumberOnBlurNative` (`dom-utils.js`) is the
jQuery-free variant and the one every migrated calculator must use;
`validateInputNumberOnBlur` (`utils.js`) still needs jQuery and is legacy:

```js
_bindInputs() {
    // Skip the name/api fields and every date/time field: the numeric
    // validator would strip the separators out of a date or duration.
    const skipIds = ['universe-name', 'fleet-name', 'api-code'];
    const skipClasses = ['startdate-input', 'tolerance-time-input', 'flight-time-input'];
    const isNumeric = (el) => !skipIds.includes(el.id)
        && !skipClasses.some((cls) => el.classList.contains(cls));
    document.querySelectorAll('#flight input[type=text]').forEach((el) => {
        if (!isNumeric(el)) {
            return;
        }
        el.addEventListener('keyup', function (e) {
            validateInputNumber({ currentTarget: this });
        });
        el.addEventListener('keyup', () => this.recalc());
        el.addEventListener('blur', function (e) {
            validateInputNumberOnBlurNative({ currentTarget: this });
        });
        el.addEventListener('blur', () => this.recalc());
    });
}
```

Two rules the exclusion list encodes, both learned the hard way:

- **Date, duration and tolerance fields must never get the numeric validator** — it strips
  `.` and `:` as illegal characters. They get an overtype mask instead
  (`attachInputMask`, `dom-utils.js`), and their own parser.
- The warning banner is addressed through `options.warnindDivId` /
  `options.warnindMsgDivId` (note the existing spelling) plus the
  `msgMinConstraintViolated` / `msgMaxConstraintViolated` locale strings. A calculator that
  clamps without setting these clamps silently.

**The deviation is a wrong *effective* constraint, not a missing `_constrains`.**
`getConstraint` (`utils.js:243-257`) falls back to `options.defConstraints` by design, and
flight leaves ~22 fields on that fallback deliberately. What matters is whether a bounded
quantity ends up unbounded. The tell is a field whose real range is already written down in
`options.prm.validate` (the cookie validator) but not on the element: the form then accepts
a value, persists it, and `validate` silently snaps it to `def` on the next load — with no
warning to the user. That exact mismatch was live in graviton (10 fields), terraformer (12),
lfcosts (~30), costs (dozens) and production (2). When you fix one, mirror the ranges from
`options.prm.validate` so the two agree.

**Deviation to look for**: clamping inside a `keyup`/`input` handler; a bounded field left
on the unbounded default while `options.prm.validate` knows its real range;
`validateInputNumberOnBlur` (the jQuery one) in a migrated calculator — it calls `$(…)` and
throws the moment a constraint fires, since none of these pages load jQuery; a date/time
field caught by the numeric selector; a field that clamps but has no `alt`, so the warning
banner cannot name it.

---

## (d) Input-group sizing

> **Source: `production.tpl` / `common_bs.css`, not flight** — flight contains no
> `input-group` at all, so it cannot supply this pattern. That is a deliberate choice, not
> an oversight: flight carries the unit **in the label** (`"General's character class bonus
> (%)"`) or in the option text of a `<select>`, which is a legitimate alternative to an
> addon and the reason flight needs no escape rule. Do not "fix" a percent field by adding
> an input-group to it.

Bootstrap sets `.input-group > .form-control { flex: 1 1 auto; width: 1% }`, which beats
any width class that is not id-scoped and blows a fixed-width numeric field up to roughly
177px. A field placed in an input-group therefore needs an explicit escape rule.

**Markup** — the group carries `input-group-sm` and `w-auto`, the field carries `m-0`:

```html
<div class="d-flex align-items-center gap-1">
  <label for="lf-crawler-bonus"><?= $l['lf-crawlers-boost'] ?></label>
  <div class="input-group input-group-sm w-auto">
    <input id="lf-crawler-bonus" type="text" name="lf-crawler-bonus" class="form-control level-input m-0" value="0"/>
    <span class="input-group-text">%</span>
  </div>
</div>
```

**The escape rule** — for classes shared across calculators it lives in `common_bs.css`:

```css
/* Keep value inputs compact when wrapped in a Bootstrap input-group with a unit
   addon: Bootstrap forces `.input-group > .form-control { flex: 1 1 auto; width: 1% }`,
   which would otherwise blow these fixed-width numeric fields up to the browser's
   default text-input width. */
.input-group > .form-control.level-input,
.input-group > .form-control.fleet-input,
.input-group > .form-control.rate-input {
  flex: 0 0 auto;
  width: 3.5rem;
}
```

A calculator-private class keeps its rule in its own `*_bs.css` — the shape is identical,
only the width differs (`expeditions_bs.css:130`):

```css
.input-group > .form-control.percent-input {
  flex: 0 0 auto;
  width: 60px;
  text-align: center;
}
```

Where the whole group must hit a fixed size instead (a spinner with buttons rather than a
unit addon), size the *group* and let the field flex inside it — `production.tpl:787`:

```html
<div class="input-group input-group-sm" style="width: 100px;">
  <input id="planetsSpin" type="text" class="form-control centered" value="8" />
  <button class="btn btn-outline-secondary" type="button" id="planetsSpin-up">…</button>
</div>
```

**Deviation to look for**: a fixed-width field inside an `input-group` whose width class is
not covered by any `.input-group > .form-control.<class>` rule — it will render at ~177px.
Measure it; do not trust the class list alone.

---

## (e) Non-editable fields, visually distinguishable

Three kinds of non-editable field, and they must all land on the *same* fill so a computed
readout and a switched-off input look alike:

1. A genuinely disabled input — `el.disabled = true` (flight's speed override).
2. A `readonly` input — `costs.tpl:695`, the planets spinner driven by its own buttons.
3. A computed value rendered as a `<div>`, which can carry neither attribute — it gets the
   marker class `ui-state-disabled`.

```html
<!-- Computed, never typed into: `ui-state-disabled´ is the same
     marker the trade calculator puts on its derived rate field. -->
<div id="arrival-moment" class="form-control form-control-sm startdate-input text-center ui-state-disabled">?</div>
```

```css
/* Read-only fields carry `ui-state-disabled´ — the marker the trade calculator
   uses — but here it wears the Bootstrap disabled-field skin instead of the
   legacy 50% fade: the arrival moment is the answer the panel exists to give,
   so it has to stay fully readable while still reading as not-editable. This is
   the same fill :disabled paints, so the computed <div>, which can carry no such
   attribute, ends up matching the switched-off speed override exactly. */
.ui-state-disabled {
  background-color: var(--bs-secondary-bg);
  cursor: default;
}
```

The light theme completes the pair from `common_bs.css`: editable controls are lifted one
step above the panel, and all three non-editable kinds are excluded so they keep the panel
tone.

```css
[data-bs-theme="light"] .form-control:not([readonly]):not(:disabled):not(.ui-state-disabled),
[data-bs-theme="light"] .form-select:not([readonly]):not(:disabled):not(.ui-state-disabled) {
  background-color: color-mix(in srgb, #fff 100%, black);
}
```

On a real `:disabled` input the marker class is **redundant** — Bootstrap's
`.form-control:disabled` already paints the same `--bs-secondary-bg`. flight's speed-override
toggle sets both (`toggleSpeedOverride`) while `_initSpeedOverride` sets only `disabled`;
both render identically. Belt-and-braces, not a bug.

### Why this rule is *not* hoisted into `common_bs.css`

It is duplicated verbatim in five `*_bs.css` files, and hoisting it the way the tooltip skin
was hoisted looks obvious. It was tried and rejected on measurement. `trade` is out of scope
but loads `common_bs.css` **before** its own `trade.css`, which defines the same class name
differently (`opacity: .5; pointer-events: none`, no fill). Of trade's seven
`.ui-state-disabled` elements, the `<input>`s already resolve to `--bs-secondary-bg` via
Bootstrap's higher-specificity `.form-control:disabled`, so they would not move — but three
are **transparent layout wrapper `<div>`s**, and a hoisted fill would paint grey blocks into
a calculator nobody is auditing. Keep the rule per calculator until trade is migrated.

Note the legacy jQuery-UI stylesheets also define `.ui-state-disabled` (a 35% opacity
fade). The BS5 pages do not load them, but do not reuse the class name for anything else.

**Deviation to look for**: a computed `<div class="form-control">` with no
`ui-state-disabled`; a `readonly` field that reads as editable because a calculator-local
rule repaints `.form-control` unconditionally; `ui-state-disabled` defined per calculator
with a *different* fill than the one above; a computed readout given a one-off utility
fill (`bg-body-tertiary`) instead of the marker — it lands on a different colour from every
other non-editable field.

### Choosing between `readonly`, `disabled`, and div + `ui-state-disabled`

All three render with the same `--bs-secondary-bg` fill and must be treated consistently,
but they differ in semantic meaning and interaction model:

| Type | Markup | Use when | Interactions |
|------|--------|----------|--------------|
| `disabled="disabled"` | `<input type="text" disabled />` | Input is functionally off (speed override toggle, conditional feature). Must not submit in a form. | Read-only; no text selection. |
| `readonly` | `<input type="text" readonly />` | Input's value is derived from other controls (spinner buttons drive it). May submit in a form if needed. | Selectable text; can be copied; scroll gestures may focus it. |
| `<div class="ui-state-disabled">` | `<div id="arrival-moment" class="form-control form-control-sm ui-state-disabled">?</div>` | Value is computed, never typed. Not a form control — no name attribute. Output-only readout. | Read-only; no text selection by default. |

**Common mistake**: a `readonly` input that reads as editable (e.g., `production.tpl:788`'s
`planetsSpin` and `costs.tpl:695`'s `planetsSpin`). The field has `form-control` styling
but no visual distinction from an editable input. **Remedies:**

1. **If the field has spin buttons**: Consider replacing it with a `<div class="ui-state-disabled">`
   and updating the buttons to write to it instead. The `<div>` is already styled correctly
   and never tempts users to type into it.

2. **If it must stay as `<input readonly>`**: Add the class `text-muted` to the input for
   additional visual cue:
   ```html
   <input id="planetsSpin" type="text" class="form-control text-center text-muted" value="8" readonly />
   ```
   Alternatively, add a read-only badge or icon next to it:
   ```html
   <div class="input-group input-group-sm" style="width: 120px;">
     <input id="planetsSpin" type="text" class="form-control centered" value="8" readonly />
     <span class="input-group-text"><i class="bi bi-lock-fill" style="font-size: 0.75rem;"></i></span>
   </div>
   ```

3. **For maximum clarity across all read-only fields**: Ensure they all use the same `ui-state-disabled`
   class and `.ui-state-disabled` CSS rule — computed divs, disabled inputs, and readonly inputs
   should all render identically. This makes the read-only state obvious at a glance.
