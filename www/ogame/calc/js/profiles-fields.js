// ============================================================================
// PLAYER PROFILES - the profile fields
// ============================================================================
// The one shape every binder takes a profile value in (ProfileField), the
// factories that tie a profile value to a key of a calculator's settings and
// convert it on the way (class, alliance class, rates, officers, numbers),
// the account and planet fields graviton and terraformer share, and how a
// field's name and value read in the marks and the reset dialog. Nothing
// here touches the page on load, so unit-tests/profiles-fields.test.js loads
// it in Node; the DOM is reached only when a field is shown or described.

'use strict';

/**
 * Show or hide an element through Bootstrap's d-none: the elements here carry
 * d-flex or start out d-none, and both beat an inline display style.
 *
 * @param {string} selector
 * @param {boolean} visible
 */
function pfShow(selector, visible) {
  toggleClass(selector, 'd-none', !visible);
}

/**
 * The text of the label for an id, or a dash.
 *
 * @param {string} id
 * @returns {string}
 */
function pfLabelFor(id) {
  const label = document.querySelector('label[for="' + id + '"]');
  return label ? (label.textContent || '').trim() : '—';
}

/**
 * A profile value as a calculator shows it: the one field shape every binder
 * takes.
 *
 * @typedef {ProfileFieldBase & {
 *   input: string|(() => ?HTMLElement),
 *   read: (settings: Record<string, any>) => *,
 *   write: (settings: Record<string, any>, value: *) => void,
 *   prm?: string,
 *   owns: string[],
 *   markIf?: (entity: {values: LayeredValues}) => boolean,
 * }} ProfileField
 * input: the control that shows it - a selector, or a lookup for a control with no stable selector;
 * read: the profile value the calculator's settings hold; write: show a profile value (or undefined) -
 * into the settings, or, for a calculator that reads its settings back from the form, into the form;
 * prm: the settings key it lives under, when it is one key; owns: every settings key it writes, which
 * the profile owns (empty for a field kept outside the settings); markIf: the field is marked only for
 * an entity (a body) it returns true for (default: always).
 */

/** @typedef {ProfileField & {prm: string}} ProfilePrmField A field kept under one key of the settings. */

/**
 * The control a field is shown in.
 *
 * @param {{input: string|(() => ?HTMLElement)}} field
 * @returns {?HTMLElement}
 */
function pfFieldInput(field) {
  return typeof field.input === 'function' ? field.input() : $(field.input);
}

/**
 * A field kept under one key of the calculator's settings, converted on the
 * way in and out.
 *
 * @param {string} key Profile value key.
 * @param {string} prm
 * @param {string} input Selector.
 * @param {(v: *) => *} toPrm Profile value (or undefined) to the settings value.
 * @param {(v: *) => *} fromPrm Settings value to the profile value.
 * @param {{display?: (value: *) => string, markIf?: (entity: {values: LayeredValues}) => boolean}} [extra]
 * @returns {ProfilePrmField}
 */
function pfPrmField(key, prm, input, toPrm, fromPrm, extra = {}) {
  return {
    key, prm, input, owns: [prm],
    read: (settings) => fromPrm(settings[prm]),
    write: (settings, value) => { settings[prm] = toPrm(value); },
    ...extra,
  };
}

/**
 * The same field for a calculator that reads its settings back from the form:
 * the value is converted as the settings would take it, then shown in the form.
 *
 * @param {ProfilePrmField} field
 * @param {(value: *) => void} show Show a settings value in the form.
 * @returns {ProfilePrmField}
 */
function pfInForm(field, show) {
  return {
    ...field,
    write: (_settings, value) => {
      /** @type {Record<string, any>} */
      const converted = {};
      field.write(converted, value);
      show(converted[field.prm]);
    },
  };
}

/**
 * A whole-number field of a calculator that reads its settings from the form.
 *
 * @param {string} key Profile value key.
 * @param {string} prm
 * @param {string} input Selector.
 * @returns {ProfilePrmField}
 */
function pfLevelField(key, prm, input) {
  return pfInForm(pfConvNumField(key, prm, input), (v) => setVal(input, v));
}

/**
 * A percentage field of a calculator that reads its settings from the form,
 * shown with the locale's decimal separator.
 *
 * @param {string} key Profile value key.
 * @param {string} prm
 * @param {string} input Selector.
 * @returns {ProfilePrmField}
 */
function pfPercentField(key, prm, input) {
  return pfInForm(pfConvNumField(key, prm, input), (v) => setNumVal(input, v));
}

/**
 * A number field: a level, a count, a temperature or a percentage.
 *
 * @param {string} key Profile value key.
 * @param {string} prm
 * @param {string} input Selector.
 * @param {number} [def] The value when the profile has none.
 * @param {number} [min] The lowest value the calculator accepts.
 * @returns {ProfilePrmField}
 */
function pfConvNumField(key, prm, input, def = 0, min = -Infinity) {
  return pfPrmField(key, prm, input, (v) => Math.max(min, v === undefined || v === null ? def : pfNum(v)), pfNum);
}

/**
 * The player class of a calculator without a "no class" radio, whose radios
 * count from the collector: a profile without a class shows as collector.
 *
 * @param {string} prm
 * @param {string} prefix The id of the class radios up to their number, such as `class-`.
 * @returns {ProfilePrmField}
 */
function pfCollectorClassField(prm, prefix) {
  return pfPrmField('class', prm, '#' + prefix + '0',
    (v) => Math.min(2, Math.max(0, pfNum(v) - 1)),
    (v) => pfNum(v) + 1,
    { display: (v) => pfLabelFor(prefix + (pfNum(v) - 1)) });
}

/**
 * The exchange rates, kept by the calculator as a list of three numbers.
 *
 * @param {string} prm
 * @param {string} input Selector.
 * @returns {ProfilePrmField}
 */
function pfRatesField(prm, input) {
  return pfPrmField('rates', prm, input,
    (v) => (Array.isArray(v) && v.length === 3 ? v.map(Number) : DEFAULT_RATES.slice()),
    (v) => (Array.isArray(v) ? v.map(Number) : DEFAULT_RATES.slice()));
}

/**
 * The player class of a calculator with a "no class" radio, which a profile's
 * discoverer shows as: only the collector and the general are kept.
 *
 * @param {string} prm
 * @param {string} prefix The id of the class radios up to their number, such as `player-class-`.
 * @param {number} none The calculator's value for no class.
 * @returns {ProfilePrmField}
 */
function pfClassField(prm, prefix, none) {
  return pfPrmField('class', prm, '#' + prefix + '0',
    (v) => {
      const cls = pfNum(v);
      return cls === PROFILE_CLASS.COLLECTOR || cls === PROFILE_CLASS.GENERAL ? cls : none;
    },
    pfNum,
    { display: (v) => pfLabelFor(prefix + pfNum(v)) });
}

/**
 * The alliance class as a trader switch.
 *
 * @param {string} prm
 * @param {string} input Selector.
 * @returns {ProfilePrmField}
 */
function pfTraderField(prm, input) {
  return pfPrmField('allianceClass', prm, input,
    (v) => pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER,
    (v) => (pfBool(v) ? PROFILE_ALLIANCE_CLASS.TRADER : PROFILE_ALLIANCE_CLASS.NONE),
    { display: (v) => (pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER ? '✓' : '—') });
}

/**
 * One switch per officer, named alike in the options and in the page's ids.
 *
 * @param {string[]} names
 * @returns {ProfilePrmField[]}
 */
function pfOfficerFields(names) {
  return names.map((name) => pfPrmField('officer.' + name, name, '#' + name, pfBool, pfBool));
}

/**
 * The account fields the two calculators that work out a planet's energy -
 * graviton and terraformer - share, under the same keys and ids in both. Their
 * class radios have no discoverer and number "no class" 0, as the profile does.
 *
 * @type {ProfilePrmField[]}
 */
const PF_ENERGY_ACCOUNT_FIELDS = [
  pfConvNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  pfConvNumField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  ...pfOfficerFields(PROFILE_OFFICERS),
  // A discoverer shows as no class.
  pfClassField('playerClass', 'player-class-', PROFILE_CLASS.NONE),
  pfTraderField('isTrader', '#trader-bonus'),
  pfConvNumField('lf.prod.energy', 'totalLFEnrgBonus', '#total-lf-energy-bonus'),
];

/**
 * The planet fields graviton and terraformer share: its temperature, energy
 * booster, power plants and solar satellites with their production
 * percentages, and its Disruption Chamber.
 *
 * @type {ProfilePrmField[]}
 */
const PF_ENERGY_PLANET_FIELDS = [
  pfConvNumField('temperature.max', 'maxPlanetTemp', '#max-planet-temp'),
  pfConvNumField('energyBooster', 'energyBoost', '#energy-boost'),
  pfConvNumField('building.4', 'solarPlantLevel', '#solar-plant-level'),
  pfConvNumField('production.4', 'solarPlantPercent', '#solar-plant-percent', 100),
  pfConvNumField('building.12', 'fusionPlantLevel', '#fusion-plant-level'),
  pfConvNumField('production.12', 'fusionPlantPercent', '#fusion-plant-percent', 100),
  pfConvNumField('ship.212', 'solarSatellitesCount', '#solar-satellites-count'),
  pfConvNumField('production.212', 'solarSatellitesPercent', '#solar-satellites-percent', 100),
  // A Rocktal building: a planet of another life form has none.
  pfConvNumField('lf.building.' + lfBuildingGameId(2, 7), 'disChLevel', '#disr-chamber-level'),
];

/**
 * A profile value as text, for a key no calculator described: a flag as a
 * tick or a dash, a list (exchange rates) joined with colons.
 *
 * @param {*} value
 * @returns {string}
 */
function pfDisplayValue(value) {
  if (value === true) return '✓';
  if (value === false || value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(' : ');
  return String(value);
}

/**
 * What the page calls a field, read from its markup: the legend of its
 * fieldset (a radio group), else its own label or aria-label - prefixed with
 * the heading of the bordered box it sits in, so "Metal" in a bonus box reads
 * as which metal it is - else, in a table, the column header and the row name.
 *
 * @param {?Element} el
 * @returns {string}
 */
function pfFieldLabel(el) {
  if (!el) return '';
  const clean = (/** @type {?string|undefined} */ text) => {
    const t = (text || '').trim();
    return t.endsWith(':') ? t.slice(0, -1).trimEnd() : t;
  };
  const legend = el.closest('fieldset')?.querySelector('legend');
  if (legend) return clean(legend.textContent);
  const cell = el.closest('td');
  if (cell instanceof HTMLTableCellElement && cell.parentElement instanceof HTMLTableRowElement) {
    // The column header: the <thead>'s row, or - in a table without one - its first row.
    const table = cell.closest('table');
    const headRow = table instanceof HTMLTableElement ? table.tHead?.rows[0] ?? table.rows[0] : undefined;
    const header = headRow && headRow !== cell.parentElement ? headRow.cells[cell.cellIndex] : undefined;
    const rowName = clean(cell.parentElement.cells[0]?.textContent);
    return header ? clean(header.textContent) + ': ' + rowName : rowName;
  }
  const own = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
  const text = clean(own ? own.textContent : el.getAttribute('aria-label'));
  const heading = el.closest('.border.rounded')?.querySelector(':scope > .fw-semibold');
  return heading ? clean(heading.textContent) + ': ' + text : text;
}

/**
 * Show a select's value the way the select does: the text of its option.
 *
 * @param {?HTMLSelectElement} select
 * @returns {(value: *) => string}
 */
function pfOptionText(select) {
  return (value) => {
    const option = select ? Array.from(select.options).find((o) => o.value === String(value)) : undefined;
    return option ? option.text : pfDisplayValue(value);
  };
}
