// ============================================================================
// PLAYER PROFILES - the selector, its dialogs and the field marks
// ============================================================================
// Wires profiles_bs.tpl: the profile select in the top bar (with the import,
// create and manage actions at the bottom of its list), the four dialogs, the
// one-time offer to convert the old saved sets, and the marks a calculator
// puts on profile-owned fields. A calculator talks to it through `pfgProfiles`,
// which is null on a page without the selector.

'use strict';

/**
 * A kind of old saved set: the calculator it came from, and how it becomes a profile.
 *
 * @typedef {Object} SavedSetKind
 * @property {string} calc
 * @property {(prm: Record<string, any>, init: {label: string}) => Profile} convert
 */

/** @type {Record<string, SavedSetKind>} Old saved sets, by the prefix of their keys. */
const SAVED_SET_KINDS = {
  prod_uni_: { calc: 'production', convert: profileFromProductionSet },
  flight_uni_: { calc: 'flight', convert: profileFromFlightSet },
};

/** Set once the player has answered the conversion offer, either way. */
const SAVED_SETS_ANSWERED_KEY = 'pfg_saved_sets_answered';

/** The select's action entries, after the profiles. */
const PF_ACTION = { import: '__import', create: '__create', manage: '__manage' };
const PFG_COMPANION_PENDING_KEY = 'pfg_companion_pending_export';
const PFG_COMPANION_SYNC_EVENT = 'pfg-companion:sync';

/**
 * @typedef {Object} SavedSet
 * @property {string} key Its localStorage key.
 * @property {string} name The name the player gave it.
 * @property {SavedSetKind} kind
 */

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
 * Give an element a Bootstrap tooltip (and the same text as its accessible
 * name), or change the text of the one it has.
 *
 * @param {HTMLElement} el
 * @param {string} title
 */
function pfTooltip(el, title) {
  el.setAttribute('aria-label', title);
  el.dataset.bsTitle = title;
  bootstrap.Tooltip.getOrCreateInstance(el).setContent({ '.tooltip-inner': title });
}

/**
 * Release the tooltips of an element and of everything inside it. Must run
 * before the element leaves the DOM, or its bubble stays behind in <body>.
 *
 * @param {ParentNode & Element} root
 */
function pfDropTooltips(root) {
  bootstrap.Tooltip.getInstance(root)?.dispose();
  root.querySelectorAll('[data-bs-title]').forEach((el) => bootstrap.Tooltip.getInstance(el)?.dispose());
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
 * Lock a select the profile decides (its universe), or give it back.
 *
 * The reason is a native title, not a Bootstrap tooltip, on purpose: a
 * disabled <select> gets no mouse events, so a tooltip would never show on it.
 *
 * @param {?HTMLSelectElement} el
 * @param {boolean} locked
 * @param {string} [title] Why it is locked.
 */
function pfLockSelect(el, locked, title = '') {
  if (!el) return;
  el.disabled = locked;
  if (locked) el.title = title;
  else el.removeAttribute('title');
}

/**
 * Move a build row's "from" and "to" fields to a body's level, unless the
 * player set the row up by hand (pfStartRange).
 *
 * @param {?HTMLInputElement} from
 * @param {?HTMLInputElement} to
 * @param {number} level
 * @param {0|1} gap
 * @returns {boolean} Whether a field changed.
 */
function pfFollowStart(from, to, level, gap) {
  if (!from || !to) return false;
  const range = pfStartRange(pfNum(Number.parseInt(from.value, 10)), pfNum(Number.parseInt(to.value, 10)), level, gap);
  if (!range || (String(range.from) === from.value && String(range.to) === to.value)) return false;
  from.value = String(range.from);
  to.value = String(range.to);
  return true;
}

/**
 * Fill in the levels a profile knows as the "from" levels of multi-level build
 * tables - each row's id in its first cell, "from" and "to" in its third and
 * fourth. A row the player left alone follows the level; one whose "to" was
 * changed by hand keeps both its levels (pfStartRange). Prefill only: the rows
 * stay the calculator's.
 *
 * @param {string[]} tables Selectors of the tables.
 * @param {(rowId: number, table: number) => ?number} levelOf The known level of a row's technology,
 *   null when the profile does not know it; `table` is the table's index in `tables`.
 * @returns {HTMLInputElement[]} The "from" fields that changed.
 */
function pfFillStartRows(tables, levelOf) {
  /** @type {HTMLInputElement[]} */
  const changed = [];
  tables.forEach((table, i) => {
    getTableRows(table).forEach((row) => {
      if (!(row instanceof HTMLTableRowElement)) return;
      const rowId = Number.parseInt(row.cells[0]?.textContent ?? '', 10);
      const from = row.cells[2]?.querySelector('input');
      const to = row.cells[3]?.querySelector('input');
      if (!rowId || !from || !to) return;
      const level = levelOf(rowId, i);
      if (level !== null && pfFollowStart(from, to, level, 0)) changed.push(from);
    });
  });
  return changed;
}

/**
 * Another technology was picked on the range tab: its "from" becomes the
 * level the profile knows, and "to" is raised to the next level when it is not
 * above it. Whatever the player typed was for the old technology.
 *
 * @param {?number} level Null leaves the fields alone.
 */
function pfFillRangeStart(level) {
  if (level === null) return;
  setVal('#tab2-from-level', level);
  if ((Number.parseInt(getVal('#tab2-to-level'), 10) || 0) <= level) setVal('#tab2-to-level', level + 1);
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
 *   markIf?: (body: ProfilePlanet) => boolean,
 * }} ProfileField
 * input: the control that shows it - a selector, or a lookup for a control with no stable selector;
 * read: the profile value the calculator's settings hold; write: show a profile value (or undefined) -
 * into the settings, or, for a calculator that reads its settings back from the form, into the form;
 * prm: the settings key it lives under, when it is one key; markIf: the field is marked only for a
 * body it returns true for (default: always).
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
 * @param {{display?: (value: *) => string, markIf?: (body: ProfilePlanet) => boolean}} [extra]
 * @returns {ProfilePrmField}
 */
function pfPrmField(key, prm, input, toPrm, fromPrm, extra = {}) {
  return {
    key, prm, input,
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

/**
 * @param {string} id
 * @returns {?bootstrap.Modal}
 */
function pfModal(id) {
  const el = document.getElementById(id);
  return el ? bootstrap.Modal.getOrCreateInstance(el) : null;
}

/**
 * @param {string} text
 * @param {string} fileName
 */
function pfDownload(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {HTMLInputElement} input
 * @returns {Promise<?string>}
 */
async function pfReadFile(input) {
  const file = input.files?.[0];
  input.value = '';
  return file ? file.text() : null;
}

class ProfilesUi {
  /**
   * @param {ProfileStore} store
   * @param {Record<string, string>} text Localized strings (pfgProfileText).
   */
  constructor(store, text) {
    this.store = store;
    this.text = text;
    /** @type {Array<(profile: ?Profile) => void>} */
    this.listeners = [];
    /** Set while this page saves, so its own write does not come back as a change. */
    this.saving = false;
    /** @type {?string} Profile being edited in the properties dialog; null = creating. */
    this.editingId = null;
    /** @type {?AccountExport} An export waiting for its universe. */
    this.pendingExport = null;
    /** @type {Map<string, {label: string, display: (value: *) => string}>} What the calculator calls each value key. */
    this.fields = new Map();
    /** @type {ProfileOverride[]} The rows of the reset dialog, in table order. */
    this.resetRows = [];
    /** @type {AccountExport[]} Exports of accounts that do not have a profile yet. */
    this.companionCandidates = [];
    /** @type {?string} What the select's options say, as last drawn. */
    this.selectShown = null;
  }

  init() {
    this.renderSelect();
    this.bindSelect();
    this.bindImport();
    this.bindProps();
    this.bindManage();
    this.bindMigration();
    this.bindReset();
    this.bindCompanionSync();
    this.store.subscribe((key) => {
      this.renderSelect();
      this.renderOverrides();
      if (!this.saving && this.concernsActive(key)) this.emit();
    });
    this.store.listenToOtherTabs(window);
    this.renderOverrides();
    if (!this.store.available) {
      const select = selectEl('#pf-select');
      if (select) select.disabled = true;
      setAttr('#pf-selector', 'title', this.text.storageUnavailable);
      return;
    }
    this.offerMigration(false);
  }

  // -------------------------------------------------------------------------
  // What a calculator uses
  // -------------------------------------------------------------------------

  /** @returns {?Profile} A fresh copy of the active profile. */
  active() {
    return this.store.getActive();
  }

  /**
   * Call back with the active profile whenever it switches, or changes in
   * another tab or dialog. Not called for this page's own saves.
   *
   * @param {(profile: ?Profile) => void} listener
   */
  onChange(listener) {
    this.listeners.push(listener);
  }

  /**
   * Whether a change may touch the profile this tab shows: any change made in
   * this tab, and in another tab anything but the save of another profile.
   *
   * @param {?string} [key] The storage key another tab wrote; undefined for a change made here.
   * @returns {boolean}
   */
  concernsActive(key) {
    if (typeof key !== 'string' || !key.startsWith(PROFILE_STORAGE_KEYS.prefix)) return true;
    return key === PROFILE_STORAGE_KEYS.prefix + (this.store.getActiveId() || '');
  }

  emit() {
    const profile = this.active();
    this.listeners.forEach((listener) => listener(profile));
  }

  /**
   * Save the active profile after the calculator changed it, without calling
   * the calculator back.
   *
   * @param {Profile} profile
   */
  save(profile) {
    this.saving = true;
    try {
      if (!this.store.save(profile)) showToast(this.text.saveFailed, 'danger');
    } finally {
      this.saving = false;
    }
  }

  /**
   * Name a value key and say how to show its values, for the "in game" mark
   * and the reset dialog. The calculator that shows the key describes it; a
   * key nobody described appears in the dialog under its own name.
   *
   * @param {string} key
   * @param {string} label
   * @param {(value: *) => string} [display]
   */
  describeField(key, label, display = pfDisplayValue) {
    this.fields.set(key, { label, display });
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  displayValue(key, value) {
    const field = this.fields.get(key);
    return field ? field.display(value) : pfDisplayValue(value);
  }

  /**
   * Mark a field as owned by the profile, and - when its value differs from
   * the game - add a button that shows the game value and restores it.
   *
   * @param {?HTMLElement} input
   * @param {Profile} profile
   * @param {{values: LayeredValues}} entity
   * @param {string} key
   * @param {(gameValue: *) => void} restore Writes the game value back into the field and recalculates.
   */
  markField(input, profile, entity, key, restore) {
    // Only a value the game reported has a "true" value to compare with: one
    // only the player sets (production percentages, boosters, exchange rates)
    // and every value of a manual profile stay unmarked.
    const v = entity.values[key];
    const fromGame = hasGameLayer(profile) && !!v && 'game' in v;
    const gameText = fromGame && differsFromGame(entity, key) ? this.displayValue(key, v.game) : null;
    this.markInput(input, fromGame, gameText, () => restore(v.game));
  }

  /**
   * The marks themselves, for a value that comes from the game but does not
   * live in the profile (a universe setting).
   *
   * @param {?HTMLElement} input
   * @param {boolean} fromGame False drops every mark.
   * @param {?string} gameText The game value as shown, when the field differs from it; null when it does not.
   * @param {() => void} restore
   */
  markInput(input, fromGame, gameText, restore) {
    if (!input) return;
    // A field inside an input group or a radio fieldset is marked as a whole,
    // so the restore button lands after the group, not between its parts. A
    // radio is not marked itself: the one passed in is not necessarily the
    // checked one, so its outline would point at the wrong choice.
    const group = input.closest('.input-group, fieldset');
    const anchor = group instanceof HTMLElement ? group : input;
    const differs = fromGame && gameText !== null;
    [input, anchor].forEach((el) => {
      const marked = fromGame && (el === anchor || anchor.tagName !== 'FIELDSET');
      el.classList.toggle('pf-bound', marked);
      el.classList.toggle('pf-differs', marked && differs);
    });
    const next = anchor.nextElementSibling;
    const existing = next instanceof HTMLButtonElement && next.classList.contains('pf-reset') ? next : null;
    if (!differs) {
      if (existing) {
        pfDropTooltips(existing);
        existing.remove();
      }
      return;
    }
    const title = formatString(this.text.inGame, gameText) + ' - ' + this.text.resetValue;
    const button = existing || document.createElement('button');
    if (!existing) {
      button.type = 'button';
      button.className = 'pf-reset btn btn-link btn-sm p-0 ms-1';
      button.innerHTML = '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>';
      anchor.after(button);
    }
    pfTooltip(button, title);
    // Restoring redraws the marks and removes this button, so its bubble goes first.
    button.onclick = () => {
      pfDropTooltips(button);
      restore();
    };
  }

  /**
   * Drop every mark this page put on its fields - for "no profile".
   *
   * @param {ParentNode} [root]
   */
  clearMarks(root = document) {
    root.querySelectorAll('.pf-reset').forEach((b) => {
      pfDropTooltips(b);
      b.remove();
    });
    root.querySelectorAll('.pf-bound').forEach((el) => el.classList.remove('pf-bound', 'pf-differs'));
  }

  // -------------------------------------------------------------------------
  // The select
  // -------------------------------------------------------------------------

  /**
   * Fill the select: the profiles, then the actions. Most changes are value
   * edits that leave the list as it was, so the options are rebuilt only when
   * what they say changed; the choice is set every time.
   */
  renderSelect() {
    const select = selectEl('#pf-select');
    if (!select) return;
    const activeId = this.store.getActiveId();
    /** @type {Array<[string, string]>} */
    const profiles = this.store.list().map((e) => [e.id, e.label + (e.universe ? ' · s' + e.universe.number + '-' + e.universe.country : '')]);
    /** @type {Array<[string, string]>} */
    const candidates = this.companionCandidates.map((data, index) => ['__companion_' + index, this.text.actImport + ' ' + (data.playerName || String(data.playerId))]);
    const shown = JSON.stringify([profiles, candidates]);
    if (shown !== this.selectShown || select.options.length === 0) {
      this.selectShown = shown;
      select.innerHTML = '';
      /**
       * @param {string} value
       * @param {string} label
       */
      const add = (value, label) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
        return option;
      };
      add('', this.text.noProfile);
      profiles.forEach(([id, label]) => add(id, label));
      add('', '──────────').disabled = true;
      add(PF_ACTION.import, this.text.actImport);
      candidates.forEach(([value, label]) => add(value, label));
      add(PF_ACTION.create, this.text.actCreate);
      add(PF_ACTION.manage, this.text.actManage);
    }
    select.value = activeId || '';
  }

  bindSelect() {
    addEvent('#pf-select', 'change', () => {
      const select = selectEl('#pf-select');
      if (!select) return;
      const value = select.value;
      if (value === PF_ACTION.import) this.openImport();
      else if (value.startsWith('__companion_')) this.openCompanionImport(Number.parseInt(value.slice('__companion_'.length), 10));
      else if (value === PF_ACTION.create) this.openProps(null);
      else if (value === PF_ACTION.manage) this.openManage();
      else {
        this.store.setActive(value || null);
        return;
      }
      // An action is not a choice: put the select back on the active profile.
      select.value = this.store.getActiveId() || '';
    });
  }

  renderOverrides() {
    const badge = document.getElementById('pf-overrides');
    if (!badge) return;
    const profile = this.active();
    const count = profile && hasGameLayer(profile) ? countOverrides(profile) : 0;
    badge.classList.toggle('d-none', count === 0);
    badge.textContent = String(count);
    const title = formatString(this.text.overrides, count) + ' - ' + this.text.resetAll;
    pfTooltip(badge, title);
    badge.setAttribute('role', 'button');
    badge.onclick = () => this.openReset();
  }

  // -------------------------------------------------------------------------
  // Restoring game values
  // -------------------------------------------------------------------------

  /** List every value that differs from the game, each with a tick to restore it. */
  openReset() {
    const profile = this.active();
    const body = document.getElementById('pf-reset-rows');
    if (!profile || !body) return;
    this.resetRows = listOverrides(profile);
    body.innerHTML = '';
    this.resetRows.forEach((item, i) => {
      const row = document.createElement('tr');
      const tickCell = document.createElement('td');
      const tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.className = 'form-check-input pf-reset-tick';
      tick.checked = true;
      tick.dataset.index = String(i);
      const label = this.fields.get(item.key)?.label || item.key;
      tick.setAttribute('aria-label', label);
      tickCell.appendChild(tick);
      row.appendChild(tickCell);
      [
        [this.entityLabel(profile, item), ''],
        [label, ''],
        [this.displayValue(item.key, item.game), 'text-end'],
        [this.displayValue(item.key, item.override), 'text-end'],
      ].forEach(([text, className]) => {
        const cell = document.createElement('td');
        cell.textContent = text;
        cell.className = className;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    const all = inputEl('#pf-reset-all');
    if (all) {
      all.checked = true;
      all.indeterminate = false;
    }
    this.syncResetButton();
    pfModal('pf-reset-modal')?.show();
  }

  /**
   * @param {Profile} profile
   * @param {ProfileOverride} item
   */
  entityLabel(profile, item) {
    if (item.kind === 'account') return this.text.account;
    const body = item.kind === 'planet'
      ? profile.planets.find((p) => p.id === item.entityId)
      : profile.moons.find((m) => m.id === item.entityId);
    if (!body) return '';
    return pfBodyLabel(body, '');
  }

  /** @returns {HTMLInputElement[]} */
  resetTicks() {
    return Array.from(document.querySelectorAll('#pf-reset-rows .pf-reset-tick')).filter((el) => el instanceof HTMLInputElement);
  }

  /** Keep the header tick and the restore button in step with the row ticks. */
  syncResetButton() {
    const ticks = this.resetTicks();
    const checked = ticks.filter((t) => t.checked).length;
    const all = inputEl('#pf-reset-all');
    if (all) {
      all.checked = checked === ticks.length && checked > 0;
      all.indeterminate = checked > 0 && checked < ticks.length;
    }
    const go = document.getElementById('pf-reset-go');
    if (go instanceof HTMLButtonElement) go.disabled = checked === 0;
  }

  bindReset() {
    addEvent('#pf-reset-all', 'change', () => {
      const all = inputEl('#pf-reset-all');
      this.resetTicks().forEach((t) => { t.checked = !!all?.checked; });
      this.syncResetButton();
    });
    addEvent('#pf-reset-rows', 'change', () => this.syncResetButton());
    addEvent('#pf-reset-go', 'click', () => {
      const current = this.active();
      if (!current) return;
      const chosen = this.resetTicks()
        .filter((t) => t.checked)
        .map((t) => this.resetRows[Number(t.dataset.index)])
        .filter(Boolean);
      if (resetOverrides(current, chosen) > 0 && !this.store.save(current)) showToast(this.text.saveFailed, 'danger');
      pfModal('pf-reset-modal')?.hide();
    });
  }

  // -------------------------------------------------------------------------
  // Universe pickers
  // -------------------------------------------------------------------------

  /**
   * @param {string} prefix 'pf-import' or 'pf-props'
   * @param {?ProfileUniverse} universe
   */
  fillUniversePicker(prefix, universe) {
    const country = selectEl('#' + prefix + '-country');
    if (!country) return;
    country.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = ' ';
    country.appendChild(blank);
    pfgCountries.forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      country.appendChild(option);
    });
    country.value = universe ? universe.country : '';
    this.fillUniverses(prefix, universe ? universe.number : null);
    country.onchange = () => this.fillUniverses(prefix, null);
  }

  /**
   * @param {string} prefix
   * @param {?number} number
   */
  fillUniverses(prefix, number) {
    const country = getVal('#' + prefix + '-country');
    const select = selectEl('#' + prefix + '-universe');
    if (!select) return;
    select.innerHTML = '';
    ((country && pfgUniverses[country]) || []).forEach(([n, name]) => {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = name;
      select.appendChild(option);
    });
    if (number !== null) select.value = String(number);
  }

  /**
   * @param {string} prefix
   * @returns {?ProfileUniverse}
   */
  readUniversePicker(prefix) {
    const country = getVal('#' + prefix + '-country');
    const number = Number.parseInt(getVal('#' + prefix + '-universe'), 10);
    return country && Number.isFinite(number) ? { country, number } : null;
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  openImport() {
    setVal('#pf-import-text', '');
    this.pendingExport = null;
    pfShow('#pf-import-universe-box', false);
    this.showError('#pf-import-error', '');
    pfModal('pf-import-modal')?.show();
  }

  bindImport() {
    addEvent('#pf-import-file', 'change', async () => {
      const input = inputEl('#pf-import-file');
      const text = input ? await pfReadFile(input) : null;
      if (text !== null) setVal('#pf-import-text', text);
    });
    addEvent('#pf-import-go', 'click', () => this.runImport());
  }

  // -------------------------------------------------------------------------
  // PfG Companion sync
  // -------------------------------------------------------------------------

  bindCompanionSync() {
    this.readCompanionPayload(localStorage.getItem(PFG_COMPANION_PENDING_KEY) || '');
    document.addEventListener(PFG_COMPANION_SYNC_EVENT, (event) => {
      const detail = /** @type {CustomEvent} */ (event).detail;
      this.applyCompanionPayload(detail);
    });
  }

  /** @param {string} text */
  readCompanionPayload(text) {
    if (!text) return;
    try {
      this.applyCompanionPayload(JSON.parse(text));
    } catch {
      // A userscript-owned hand-off that is not JSON is ignored.
    }
  }

  /** @param {*} payload */
  applyCompanionPayload(payload) {
    if (payload?.version !== 1 || !Array.isArray(payload.exports)) return;
    /** @type {AccountExport[]} */
    const candidates = [];
    payload.exports.forEach((raw) => {
      const parsed = parseAccountExport(JSON.stringify(raw));
      const data = parsed.data;
      if (!parsed.ok || !data?.universe) return;
      const existingId = findProfileForExport(this.store.list(), data.playerId, data.universe);
      const existing = existingId ? this.store.get(existingId) : null;
      if (!existing) {
        candidates.push(data);
        return;
      }
      const importedAt = existing.importedAt === null ? '' : existing.importedAt;
      const exportedAt = typeof data.exportedAt === 'string' ? data.exportedAt : '';
      if (Date.parse(exportedAt) <= Date.parse(importedAt)) return;
      const { profile } = importAccountExport(existing, data, { keepOverrides: true });
      this.save(profile);
    });
    this.companionCandidates = candidates;
    this.renderSelect();
  }

  /** @param {number} index */
  openCompanionImport(index) {
    const data = this.companionCandidates[index];
    if (!data) return;
    setVal('#pf-import-text', JSON.stringify(data));
    this.pendingExport = null;
    pfShow('#pf-import-universe-box', false);
    this.showError('#pf-import-error', '');
    pfModal('pf-import-modal')?.show();
  }

  runImport() {
    let data = this.pendingExport;
    if (!data) {
      const result = parseAccountExport(getVal('#pf-import-text'));
      if (!result.ok || !result.data) {
        const reasons = { json: this.text.errJson, shape: this.text.errShape, schema: this.text.errSchema };
        this.showError('#pf-import-error', reasons[result.reason || 'shape']);
        return;
      }
      data = result.data;
    }
    let universe = data.universe;
    if (!universe) {
      const known = this.store.list().filter((e) => e.playerId === data.playerId && e.universe);
      if (this.pendingExport) {
        universe = this.readUniversePicker('pf-import');
      } else if (known.length === 1) {
        universe = known[0].universe;
      }
      if (!universe) {
        this.pendingExport = data;
        this.fillUniversePicker('pf-import', null);
        pfShow('#pf-import-universe-box', true);
        this.showError('#pf-import-error', this.pendingExport && getVal('#pf-import-country') ? this.text.pickUniverse : '');
        return;
      }
    }
    const existingId = findProfileForExport(this.store.list(), data.playerId, universe);
    const existing = existingId ? this.store.get(existingId) : null;
    const { profile, summary } = importAccountExport(existing, data, { universe });
    if (!this.store.save(profile)) {
      this.showError('#pf-import-error', this.text.saveFailed);
      return;
    }
    this.store.requestPersistence();
    this.pendingExport = null;
    pfModal('pf-import-modal')?.hide();
    this.store.setActive(profile.id);
    showToast(formatString(this.text.importDone, profile.label, summary.planets.added, summary.planets.updated, summary.planets.removed), 'success');
  }

  /**
   * @param {string} selector
   * @param {string} message Empty hides the box.
   */
  showError(selector, message) {
    setTextContent(selector, message);
    pfShow(selector, !!message);
  }

  // -------------------------------------------------------------------------
  // Create / properties
  // -------------------------------------------------------------------------

  /** @param {?string} id Null creates a new profile. */
  openProps(id) {
    this.editingId = id;
    const profile = id ? this.store.get(id) : null;
    setVal('#pf-props-name', profile ? profile.label : '');
    this.fillUniversePicker('pf-props', profile ? profile.universe : null);
    const locked = !!profile && profile.universeLocked;
    ['#pf-props-country', '#pf-props-universe'].forEach((s) => { const el = selectEl(s); if (el) el.disabled = locked; });
    pfShow('#pf-props-locked', locked);
    this.showError('#pf-props-error', '');
    pfModal('pf-props-modal')?.show();
  }

  bindProps() {
    addEvent('#pf-props-go', 'click', () => {
      const label = getVal('#pf-props-name').trim();
      if (!label) {
        this.showError('#pf-props-error', this.text.nameRequired);
        return;
      }
      const universe = this.readUniversePicker('pf-props');
      const profile = this.editingId ? this.store.get(this.editingId) : createProfile({ label, universe });
      if (!profile) return;
      profile.label = label;
      if (!profile.universeLocked) profile.universe = universe;
      if (!this.store.save(profile)) {
        this.showError('#pf-props-error', this.text.saveFailed);
        return;
      }
      this.store.requestPersistence();
      pfModal('pf-props-modal')?.hide();
      if (!this.editingId) this.store.setActive(profile.id);
    });
    // Editing is reached from the manage dialog, which had to close first:
    // Bootstrap keeps one modal open at a time, and the first one's focus trap
    // would take the keyboard away from the name field. Saving or cancelling
    // the edit returns to it.
    addEvent('#pf-props-modal', 'hidden.bs.modal', () => {
      if (this.editingId) this.openManage();
    });
  }

  // -------------------------------------------------------------------------
  // Manage
  // -------------------------------------------------------------------------

  openManage() {
    this.renderManage();
    pfModal('pf-manage-modal')?.show();
  }

  renderManage() {
    const body = document.getElementById('pf-manage-rows');
    if (!body) return;
    pfDropTooltips(body);
    body.innerHTML = '';
    const profiles = this.store.getAll();
    profiles.forEach((p) => {
      const row = document.createElement('tr');
      const universe = p.universe ? 's' + p.universe.number + '-' + p.universe.country : this.text.noUniverse;
      const source = hasGameLayer(p) && p.importedAt ? new Date(p.importedAt).toLocaleString() : '—';
      [p.label, universe, source].forEach((text) => {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.appendChild(cell);
      });
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      actions.appendChild(this.iconButton('bi-pencil', this.text.edit, () => {
        pfModal('pf-manage-modal')?.hide();
        this.openProps(p.id);
      }));
      actions.appendChild(this.iconButton('bi-trash', this.text.delete, async () => {
        if (!await showConfirmModal(formatString(this.text.deleteConfirm, p.label), this.text.confirm, this.text.cancel, this.text.attention)) return;
        this.store.remove(p.id);
        this.renderManage();
      }));
      row.appendChild(actions);
      body.appendChild(row);
    });
    ['#pf-merge-from', '#pf-merge-into'].forEach((selector) => {
      const select = selectEl(selector);
      if (!select) return;
      select.innerHTML = '';
      profiles.forEach((p) => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.label;
        select.appendChild(option);
      });
    });
    const into = selectEl('#pf-merge-into');
    if (into && profiles.length > 1) into.selectedIndex = 1;
    pfShow('#pf-migrate-open', this.findSavedSets().length > 0);
  }

  /**
   * @param {string} icon
   * @param {string} title
   * @param {() => void} onClick
   */
  iconButton(icon, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm ms-1';
    button.innerHTML = '<i class="bi ' + icon + '" aria-hidden="true"></i>';
    pfTooltip(button, title);
    button.addEventListener('click', () => {
      pfDropTooltips(button);
      onClick();
    });
    return button;
  }

  bindManage() {
    addEvent('#pf-merge-go', 'click', async () => {
      const fromId = getVal('#pf-merge-from');
      const intoId = getVal('#pf-merge-into');
      const from = this.store.get(fromId);
      const into = this.store.get(intoId);
      if (!from || !into) return;
      if (fromId === intoId) {
        await showAlertModal(this.text.mergeSame, this.text.ok, this.text.attention);
        return;
      }
      if (!await showConfirmModal(formatString(this.text.mergeConfirm, from.label, into.label), this.text.confirm, this.text.cancel, this.text.attention)) return;
      if (!this.store.save(mergeProfiles(into, from))) {
        showToast(this.text.saveFailed, 'danger');
        return;
      }
      const wasActive = this.store.getActiveId() === fromId;
      this.store.remove(fromId);
      if (wasActive) this.store.setActive(intoId);
      this.renderManage();
    });
    addEvent('#pf-backup-download', 'click', () => this.downloadBackup());
    addEvent('#pf-backup-restore', 'change', async () => {
      const input = inputEl('#pf-backup-restore');
      const text = input ? await pfReadFile(input) : null;
      if (text !== null) await this.restoreBackup(text);
    });
    addEvent('#pf-migrate-open', 'click', () => {
      pfModal('pf-manage-modal')?.hide();
      this.offerMigration(true);
    });
  }

  downloadBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    const profiles = this.store.getAll();
    pfDownload(serializeProfilesFile(profiles, undefined, PfUniverseSetting.choicesOf(profiles)), 'pfg-profiles-' + stamp + '.json');
  }

  /** @param {string} text */
  async restoreBackup(text) {
    const result = parseProfilesFile(text);
    if (!result.ok || !result.profiles) {
      await showAlertModal(this.text.fileErr, this.text.ok, this.text.attention);
      return;
    }
    const plan = planProfilesRestore(this.store.list().map((e) => e.id), result.profiles);
    /** @type {Profile[]} */
    const restored = [];
    plan.added.forEach((p) => { if (this.store.save(p)) restored.push(p); });
    for (const p of plan.conflicts) {
      if (await showConfirmModal(formatString(this.text.restoreConflict, p.label), this.text.replace, this.text.skip, this.text.attention)) {
        if (this.store.save(p)) restored.push(p);
      }
    }
    // The universe choices come back with a profile of their universe.
    (result.universes || [])
      .filter((u) => restored.some((p) => p.universe && sameUniverse(p.universe, u.universe)))
      .forEach((u) => PfUniverseSetting.restoreChoices(u));
    this.store.requestPersistence();
    this.renderManage();
    showToast(formatString(this.text.restoreDone, restored.length), 'success');
  }

  // -------------------------------------------------------------------------
  // Saved sets
  // -------------------------------------------------------------------------

  /** @returns {SavedSet[]} */
  findSavedSets() {
    /** @type {SavedSet[]} */
    const sets = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        Object.entries(SAVED_SET_KINDS).forEach(([prefix, kind]) => {
          if (key.startsWith(prefix)) sets.push({ key, name: key.slice(prefix.length), kind });
        });
      }
    } catch {
      return [];
    }
    return sets.sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Show the conversion offer - on its own only once, from the manage dialog
   * whenever the player asks.
   *
   * @param {boolean} asked
   */
  offerMigration(asked) {
    let answered = false;
    try {
      answered = localStorage.getItem(SAVED_SETS_ANSWERED_KEY) !== null;
    } catch {
      answered = true;
    }
    // Checked before the scan of every stored key, which most page loads skip.
    if (!asked && answered) return;
    const sets = this.findSavedSets();
    if (sets.length === 0) return;
    setTextContent('#pf-migrate-body', formatString(this.text.migrateText, sets.length));
    const list = document.getElementById('pf-migrate-list');
    if (list) {
      list.innerHTML = '';
      sets.forEach((s) => {
        const item = document.createElement('li');
        item.textContent = s.name + ' (' + s.kind.calc + ')';
        list.appendChild(item);
      });
    }
    pfShow('#pf-migrate-list', true);
    pfShow('#pf-migrate-go', true);
    pfShow('#pf-migrate-result', false);
    setTextContent('#pf-migrate-later', this.text.later);
    pfModal('pf-migrate-modal')?.show();
  }

  bindMigration() {
    addEvent('#pf-migrate-go', 'click', () => {
      const converted = this.convertSavedSets();
      this.markMigrationAnswered();
      pfShow('#pf-migrate-go', false);
      pfShow('#pf-migrate-list', false);
      setTextContent('#pf-migrate-body', '');
      setTextContent('#pf-migrate-result-text', converted > 0 ? formatString(this.text.migrateDone, converted) : this.text.migrateNone);
      pfShow('#pf-migrate-result', true);
      // Nothing is left to postpone: the only way on is closing the dialog.
      setTextContent('#pf-migrate-later', this.text.done);
    });
    addEvent('#pf-migrate-later', 'click', () => this.markMigrationAnswered());
    addEvent('#pf-migrate-backup', 'click', () => {
      this.downloadBackup();
      pfModal('pf-migrate-modal')?.hide();
    });
  }

  markMigrationAnswered() {
    try {
      localStorage.setItem(SAVED_SETS_ANSWERED_KEY, new Date().toISOString());
    } catch {
      // Without storage the offer simply comes back next time.
    }
  }

  /**
   * Turn every saved set into a manual profile. The sets themselves are kept,
   * as a backup, for a few months (ADR-0004).
   *
   * @returns {number} How many profiles were created.
   */
  convertSavedSets() {
    let count = 0;
    this.findSavedSets().forEach((set) => {
      const prm = readSavedSet(set);
      if (!prm) return;
      if (this.store.save(set.kind.convert(prm, { label: set.name }))) count++;
    });
    if (count > 0) this.store.requestPersistence();
    return count;
  }
}

/**
 * Read a saved set in either storage format through loadFromCookie, which
 * still understands the pre-JSON one. The template lists the keys to read;
 * validation passes values through - the converters coerce them themselves.
 *
 * @param {SavedSet} set
 * @returns {?Record<string, any>}
 */
function readSavedSet(set) {
  /** @type {Record<string, any>} */
  const template = {
    validate: (/** @type {string} */ _key, /** @type {*} */ value) => value,
    // production
    energyTechLevel: 0, plasmaTechLevel: 0, geologist: false, engineer: false, technocrat: false,
    admiral: false, commander: false, playerClass: 0, isTrader: false,
    lfMetProdBonus: 0, lfCrysProdBonus: 0, lfDeutProdBonus: 0, lfEnergyProdBonus: 0,
    lfCollectorBonus: 0, lfCrawlerBonus: 0, lfPlasmaCostReduction: 0,
    rates: [], ratesFmt: 1, currPlanetsCount: 0, aPS: [], aPNames: [], aPPP: [],
    // flight
    country: '--', universe: null, driveLevels: [], hyperTechLvl: 0, traderBonus: false,
    warriorBonus: false, lfMechanGE: 0, lfRocktalCE: 0, lfShipsBonuses: [],
  };
  try {
    loadFromCookie(set.key, template);
  } catch {
    return null;
  }
  return template;
}

/** How long a universe's settings are reused before they are fetched again. */
const UNIVERSE_SETTINGS_TTL_MS = 24 * 3600 * 1000;

/**
 * @typedef {Object} PfUniverseSettingKind
 * @property {string} key The setting's name in the cache entry.
 * @property {(data: Record<string, any>) => *} parse The setting from a `serverdata` answer; null when the answer has none.
 * @property {(selector: string) => *} get The value the field shows.
 * @property {(selector: string, value: *) => void} set Show a value in the field.
 * @property {(value: *) => string} display The game value as shown in the mark.
 */

/**
 * A select whose option values are numbers. A value the select does not
 * offer - a debris share no preset matches - is added as an option first.
 *
 * @param {(v: number) => string} label The text of an added option.
 * @returns {Pick<PfUniverseSettingKind, 'get'|'set'>}
 */
function pfNumberSelect(label) {
  return {
    get: (selector) => Number(getVal(selector)),
    set: (selector, value) => {
      const select = selectEl(selector);
      if (select && !Array.from(select.options).some((o) => o.value === String(value))) {
        const after = Array.from(select.options).find((o) => Number(o.value) > value);
        select.insertBefore(new Option(label(value), String(value)), after || null);
      }
      setVal(selector, value);
    },
  };
}

/** @type {PfUniverseSettingKind} The economy speed. */
const PF_UNIVERSE_SPEED = {
  key: 'speed',
  parse: (data) => {
    const speed = Number.parseInt(data.speed, 10);
    return speed > 0 ? speed : null;
  },
  ...pfNumberSelect(String),
  display: String,
};

/** @type {PfUniverseSettingKind} The share of a destroyed fleet that goes to the debris field, in percent. */
const PF_UNIVERSE_DEBRIS = {
  key: 'debrisFactor',
  parse: (data) => {
    const factor = Number.parseFloat(data.debrisFactor);
    return Number.isFinite(factor) && factor >= 0 ? Math.round(factor * 100) : null;
  },
  ...pfNumberSelect((v) => v + '%'),
  display: (v) => v + '%',
};

/** @type {PfUniverseSettingKind} Whether deuterium goes to the debris field too. */
const PF_UNIVERSE_DEUT_IN_DEBRIS = {
  key: 'deuteriumInDebris',
  // The game sends "1" or an empty element, so only a missing key is unknown.
  parse: (data) => (typeof data.deuteriumInDebris === 'string' ? data.deuteriumInDebris === '1' : null),
  get: (selector) => getChecked(selector),
  set: (selector, value) => setChecked(selector, value === true),
  display: (v) => pfDisplayValue(v === true),
};

/**
 * @type {PfUniverseSettingKind} The expeditions' "strongest player" class, kept as the value of the
 * #highTop option the universe's top score falls into (not as the score itself).
 */
const PF_UNIVERSE_TOP_SCORE = {
  key: 'topScore',
  parse: (data) => expeditionHighTop(data.topScore),
  get: (selector) => Number(getVal(selector)),
  // The value always comes from the select's own list, so no option is added.
  set: (selector, value) => setVal(selector, value),
  display: (v) => pfOptionText(selectEl('#highTop'))(v),
};

/** @type {PfUniverseSettingKind} The share of destroyed defenses that goes to the debris field, in percent. */
const PF_UNIVERSE_DEF_DEBRIS = {
  key: 'debrisFactorDef',
  parse: (data) => {
    const factor = Number.parseFloat(data.debrisFactorDef);
    return Number.isFinite(factor) && factor >= 0 ? Math.round(factor * 100) : null;
  },
  ...pfNumberSelect((v) => v + '%'),
  display: (v) => v + '%',
};

/** @type {PfUniverseSettingKind} The number of systems per galaxy. */
const PF_UNIVERSE_SYSTEMS = {
  key: 'systems',
  parse: (data) => {
    const systems = Number.parseInt(data.systems, 10);
    return systems > 0 ? systems : null;
  },
  get: (selector) => getInputNumber($(selector)),
  set: (selector, value) => setVal(selector, value),
  display: String,
};

/** @type {PfUniverseSettingKind} Whether the systems of a galaxy form a ring (the last one borders the first). */
const PF_UNIVERSE_DONUT_SYSTEM = {
  key: 'donutSystem',
  // The game sends "1" or "0" - flight compares it with 1 the same way.
  parse: (data) => (typeof data.donutSystem === 'string' ? data.donutSystem === '1' : null),
  get: (selector) => getChecked(selector),
  set: (selector, value) => setChecked(selector, value === true),
  display: (v) => pfDisplayValue(v === true),
};

/** Every setting a fetch stores, whichever of them asked for it. */
const PF_UNIVERSE_SETTINGS = [
  PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS, PF_UNIVERSE_TOP_SCORE,
  PF_UNIVERSE_DEF_DEBRIS, PF_UNIVERSE_SYSTEMS, PF_UNIVERSE_DONUT_SYSTEM,
];

/** @typedef {{at: number, overrides?: Record<string, *>, override?: *, [setting: string]: *}} PfUniverseEntry */

/** @type {Map<string, Promise<?Record<string, any>>>} The `serverdata` request of each universe still out. */
const pfUniverseRequests = new Map();

/**
 * One setting of the active profile's universe, for a calculator that has
 * the field but no universe picker: the economy speed of production, queue,
 * LF costs and graviton, and graviton's debris share. The entry in the shared
 * universe cache `pfg_universe_<country>_<number>` (ADR-0004) holds `at`, when
 * the settings were fetched, the game's value of each setting under its key,
 * and in `overrides` the value the player picked instead, if any. A universe
 * setting is not part of a profile, so the player's choice lives in the cache
 * too, shared by every profile of that universe. The settings of a universe
 * come in one request, whichever field asks first.
 */
class PfUniverseSetting {
  /**
   * @param {ProfilesUi} pf
   * @param {PfUniverseSettingKind} kind
   * @param {string} selector The field that shows the setting.
   * @param {() => void} recalc Recalculates the page after the setting was set.
   * @param {string} [prm] The key the calculator keeps the setting under, where a binder needs it.
   */
  constructor(pf, kind, selector, recalc, prm = '') {
    this.pf = pf;
    this.kind = kind;
    this.selector = selector;
    this.recalc = recalc;
    this.prm = prm;
    /** @type {?ProfileUniverse} The universe of the profile shown, if it has one. */
    this.universe = null;
    addEvent(selector, 'change', () => this.changed());
  }

  /** @returns {?string} */
  cacheKey() {
    return this.universe ? universeCacheKey(this.universe) : null;
  }

  /**
   * @param {string} key
   * @returns {?PfUniverseEntry}
   */
  static read(key) {
    let entry = null;
    try {
      entry = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      entry = null;
    }
    if (!entry || typeof entry.at !== 'number') return null;
    // The speed's choice was once kept on its own, before there were others.
    if ('override' in entry) {
      entry.overrides = { speed: entry.override, ...entry.overrides };
      delete entry.override;
    }
    return entry;
  }

  /**
   * @param {string} key
   * @param {PfUniverseEntry} entry
   */
  static write(key, entry) {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Without storage the settings are simply fetched again next time.
    }
  }

  /**
   * The settings the player picked for the universes of these profiles, for
   * the backup file.
   *
   * @param {Profile[]} profiles
   * @returns {UniverseChoices[]}
   */
  static choicesOf(profiles) {
    /** @type {UniverseChoices[]} */
    const choices = [];
    profiles.forEach((p) => {
      const universe = p.universe;
      if (!universe || choices.some((c) => sameUniverse(c.universe, universe))) return;
      const overrides = PfUniverseSetting.read(universeCacheKey(universe))?.overrides;
      if (overrides && Object.keys(overrides).length > 0) choices.push({ universe: { ...universe }, overrides: { ...overrides } });
    });
    return choices;
  }

  /**
   * Put a backup's choices back into the universe cache, over the ones there.
   * A universe never fetched on this device gets an entry that is already
   * stale, so its game values are fetched the first time it is shown.
   *
   * @param {UniverseChoices} choices
   */
  static restoreChoices(choices) {
    const key = universeCacheKey(choices.universe);
    const entry = PfUniverseSetting.read(key) || { at: 0 };
    entry.overrides = { ...entry.overrides, ...choices.overrides };
    PfUniverseSetting.write(key, entry);
  }

  /**
   * The game's value in an entry, or null when it is not known.
   *
   * @param {?PfUniverseEntry} entry
   */
  gameValue(entry) {
    const value = entry ? entry[this.kind.key] : null;
    return value ?? null;
  }

  /**
   * The universe's settings from `serverdata`, one request per universe at a
   * time; null when it cannot be reached.
   *
   * @param {ProfileUniverse} universe
   * @param {string} key
   * @returns {Promise<?Record<string, any>>}
   */
  static fetchSettings(universe, key) {
    let request = pfUniverseRequests.get(key);
    if (!request) {
      request = apiGet('serverdata', { country: universe.country, universe: universe.number })
        .catch(() => null)
        .finally(() => pfUniverseRequests.delete(key));
      pfUniverseRequests.set(key, request);
    }
    return request;
  }

  /**
   * Take the setting from the profile's universe - the player's own choice if
   * they made one - fetching the settings again once a day, or when this one
   * was never fetched. It handles its own failures; nothing waits for the
   * network.
   *
   * @param {Profile} profile
   */
  async attach(profile) {
    this.universe = profile.universe ? { ...profile.universe } : null;
    const key = this.cacheKey();
    this.mark();
    if (!key || !profile.universe) return;
    let entry = PfUniverseSetting.read(key);
    if (!entry || Date.now() - entry.at >= UNIVERSE_SETTINGS_TTL_MS || !(this.kind.key in entry)) {
      const data = await PfUniverseSetting.fetchSettings(profile.universe, key);
      // The universe is unreachable: a stale value is still the best guess.
      if (data) {
        // Read again: another field of the page may have written the entry meanwhile.
        /** @type {PfUniverseEntry} */
        const fresh = { ...PfUniverseSetting.read(key), at: Date.now() };
        PF_UNIVERSE_SETTINGS.forEach((kind) => { fresh[kind.key] = kind.parse(data); });
        PfUniverseSetting.write(key, fresh);
        entry = fresh;
      }
    }
    // Another profile may have been shown while the request was out.
    if (!entry || this.cacheKey() !== key) return;
    const overrides = entry.overrides || {};
    const value = this.kind.key in overrides ? overrides[this.kind.key] : this.gameValue(entry);
    if (value === null) return;
    if (!sameValue(this.kind.get(this.selector), value)) {
      this.kind.set(this.selector, value);
      this.recalc();
    }
    this.mark(entry);
  }

  /** No profile: the setting is the calculator's own again. */
  detach() {
    this.universe = null;
    this.mark();
  }

  /** The player changed the field: remember it as theirs, or drop it when it is the game's again. */
  changed() {
    const key = this.cacheKey();
    const entry = key ? PfUniverseSetting.read(key) : null;
    const game = this.gameValue(entry);
    if (!key || !entry || game === null) return;
    const overrides = { ...entry.overrides };
    const chosen = this.kind.get(this.selector);
    if (sameValue(chosen, game)) delete overrides[this.kind.key];
    else overrides[this.kind.key] = chosen;
    entry.overrides = overrides;
    PfUniverseSetting.write(key, entry);
    this.mark(entry);
  }

  /**
   * Mark the field as the game's, with a restore button when the player changed it.
   *
   * @param {?PfUniverseEntry} [entry] The universe's cache entry, when the caller has just read or written it.
   */
  mark(entry) {
    const key = this.cacheKey();
    /** @type {?PfUniverseEntry} */
    let known = null;
    if (key) known = entry === undefined ? PfUniverseSetting.read(key) : entry;
    const game = this.gameValue(known);
    const input = $(this.selector);
    if (game === null) {
      this.pf.markInput(input, false, null, () => {});
      return;
    }
    const differs = !sameValue(this.kind.get(this.selector), game);
    this.pf.markInput(input, true, differs ? this.kind.display(game) : null, () => {
      this.kind.set(this.selector, game);
      this.changed();
      this.recalc();
    });
  }
}

/**
 * @typedef {object} PfBodySelectConfig
 * @property {string} select Selector of the <select>.
 * @property {string} box Selector of the element that holds it, hidden while there is nothing to pick.
 * @property {(profile: Profile) => ProfilePlanet[]} bodies The planets or moons it lists.
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 * @property {() => ?string} [planetOf] For a select of moons: the planet shown with it. Its moon is
 *   shown when neither the current moon nor the last pick is there, and follow() picks it.
 */

/**
 * The select that picks a planet or a moon of the active profile: its
 * options, the choice made last time in each profile, and the box around it.
 * A binder holds one per kind of body and keeps the chosen id itself.
 */
class PfBodySelect {
  /**
   * @param {ProfilesUi} pf
   * @param {PfBodySelectConfig} config
   */
  constructor(pf, config) {
    this.pf = pf;
    this.config = config;
  }

  /**
   * Fill the select and choose a body: the current one, else the one picked
   * last time in this profile, else the moon of the planet shown, else the first one.
   *
   * @param {Profile} profile
   * @param {?string} currentId
   * @returns {?string} The id of the body shown.
   */
  render(profile, currentId) {
    const { select: selector, box, bodies, lastKey } = this.config;
    const list = bodies(profile);
    const select = selectEl(selector);
    if (select) {
      select.innerHTML = '';
      list.forEach((b) => select.appendChild(new Option(pfBodyLabel(b), b.id)));
    }
    pfShow(box, list.length > 0);
    const last = this.pf.store.getLastPlanet(lastKey, profile.id);
    const chosen = list.find((b) => b.id === currentId)
      || list.find((b) => b.id === last)
      || this.moonOfPlanet(profile)
      || list[0];
    const id = chosen ? chosen.id : null;
    if (select) select.value = id || '';
    return id;
  }

  /**
   * The moon of the planet this select follows (planetOf), if it has one.
   *
   * @param {Profile} profile
   * @returns {ProfileMoon|undefined}
   */
  moonOfPlanet(profile) {
    const planetId = this.config.planetOf?.() ?? null;
    return planetId === null ? undefined : profile.moons.find((m) => m.planetId === planetId);
  }

  /**
   * The planet it follows was picked: pick its moon too, when it has one.
   *
   * @param {Profile} profile
   * @returns {?string} The id of the moon picked; null when the planet has none.
   */
  follow(profile) {
    const moon = this.moonOfPlanet(profile);
    if (!moon) return null;
    this.choose(profile, moon.id);
    return moon.id;
  }

  /**
   * The player picked a body: remember it.
   *
   * @param {Profile} profile
   * @returns {?string} The id picked.
   */
  chosen(profile) {
    const id = getVal(this.config.select) || null;
    if (id) this.pf.store.setLastPlanet(this.config.lastKey, profile.id, id);
    return id;
  }

  /**
   * Pick a body from code, and remember it.
   *
   * @param {Profile} profile
   * @param {string} id
   */
  choose(profile, id) {
    setVal(this.config.select, id);
    this.pf.store.setLastPlanet(this.config.lastKey, profile.id, id);
  }

  /** Call a handler when the player picks another body. */
  onChange(/** @type {() => void} */ handler) {
    addEvent(this.config.select, 'change', handler);
  }

  hide() {
    pfShow(this.config.box, false);
  }
}

/**
 * The universe a calculator shows, and whatever else it gives back with it (the cost
 * calculator's speeds).
 *
 * @typedef {{country: string, universe: *, [setting: string]: *}} PfShownUniverse
 */

/**
 * @typedef {object} PfLockedUniverseConfig
 * @property {() => PfShownUniverse} read The universe the calculator shows now.
 * @property {(country: string, universe: *) => void} write Show a universe: in the model and in the form.
 * @property {(own: PfShownUniverse) => void} [restore] Show the player's own universe again when the
 *   profile lets it go; write() by default.
 */

/**
 * The universe picker a profile decides: the profile's universe is shown and
 * the #country and #universe selects are locked, and the universe the player
 * had picked before is kept to give back. A profile with no universe leaves
 * the picker to the player. How a universe is read and shown is the page's.
 */
class PfLockedUniverse {
  /** @param {PfLockedUniverseConfig} config */
  constructor(config) {
    this.config = config;
    /** @type {?PfShownUniverse} The universe picked before a profile set its own. */
    this.own = null;
  }

  /**
   * Whether the calculator shows this universe.
   *
   * @param {string} country
   * @param {*} number
   * @returns {boolean}
   */
  matches(country, number) {
    const now = this.config.read();
    return now.country === country && String(now.universe) === String(number);
  }

  /**
   * Show the profile's universe, locked.
   *
   * @param {Profile} profile
   */
  apply(profile) {
    const wanted = profile.universe;
    if (!wanted) {
      this.release();
      return;
    }
    this.own ??= this.config.read();
    this.config.write(wanted.country, wanted.number);
    this.lock(true);
  }

  /** Give the picker back, on the universe it showed before the profile. */
  release() {
    this.lock(false);
    const own = this.own;
    this.own = null;
    if (!own) return;
    if (this.config.restore) this.config.restore(own);
    else this.config.write(own.country, own.universe);
  }

  /** @param {boolean} locked */
  lock(locked) {
    [selectEl('#country'), selectEl('#universe')].forEach((el) => pfLockSelect(el, locked, locked ? getOptionValue('universeFromProfile', '') : ''));
  }

  /**
   * Put the universe the player picked, not the profile's, into the values a
   * calculator stores as its own - with whatever else read() gave back with it.
   *
   * @param {Record<string, any>} stored
   */
  overlay(stored) {
    if (this.own) Object.assign(stored, this.own);
  }
}

/**
 * A planet or moon of a profile that has full coordinates, as PfCoordsSelect lists it.
 *
 * @typedef {object} PfCoordsBody
 * @property {ProfilePlanet} body
 * @property {number[]} coords Galaxy, system, position.
 * @property {boolean} isMoon
 * @property {string} label
 */

/**
 * @typedef {object} PfCoordsSelectConfig
 * @property {string} select Selector of the <select>.
 * @property {string[]} boxes Selectors of what is shown while there is a body to pick.
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 * @property {string} nameFallback The name of a body that has none.
 * @property {(b: PfCoordsBody) => boolean} isAt Whether the calculator's coordinates are at the body.
 * @property {(b: PfCoordsBody) => void} move Put the body's coordinates into the calculator.
 * @property {() => void} recalc Recalculate after the player picked a body.
 * @property {() => void} [changed] Called when what the select shows may have changed.
 */

/**
 * The select that copies the coordinates of a planet or moon of the active
 * profile into the calculator. The coordinates stay the calculator's own: the
 * select follows them, and moves them only to give them a body to start from.
 */
class PfCoordsSelect {
  /**
   * @param {ProfilesUi} pf
   * @param {PfCoordsSelectConfig} config
   */
  constructor(pf, config) {
    this.pf = pf;
    this.config = config;
  }

  /**
   * Every planet and moon with full coordinates, planets first.
   *
   * @param {Profile} profile
   * @returns {PfCoordsBody[]}
   */
  bodies(profile) {
    /** @type {PfCoordsBody[]} */
    const list = [];
    /**
     * @param {ProfilePlanet} body
     * @param {boolean} isMoon
     */
    const add = (body, isMoon) => {
      const c = body.coords;
      if (typeof c?.galaxy !== 'number' || typeof c.system !== 'number' || typeof c.position !== 'number') return;
      const coords = [c.galaxy, c.system, c.position];
      const name = (body.name || this.config.nameFallback) + (isMoon ? ' (' + getOptionValue('moonLabel', '') + ')' : '');
      list.push({ body, coords, isMoon, label: name + ' [' + coords.join(':') + ']' });
    };
    profile.planets.forEach((p) => add(p, false));
    profile.moons.forEach((m) => add(m, true));
    return list;
  }

  /**
   * Fill the select. The coordinates move to a body only when they match none:
   * to the one picked last time in this profile, else to the first planet -
   * unless the caller keeps them.
   *
   * @param {Profile} profile
   * @param {boolean} [keepCoords]
   */
  render(profile, keepCoords = false) {
    const { select: selector, boxes, lastKey, isAt, move } = this.config;
    const select = selectEl(selector);
    if (!select) return;
    const bodies = this.bodies(profile);
    select.innerHTML = '';
    select.appendChild(new Option('—', ''));
    bodies.forEach((b) => select.appendChild(new Option(b.label, b.body.id)));
    boxes.forEach((box) => pfShow(box, bodies.length > 0));
    const last = this.pf.store.getLastPlanet(lastKey, profile.id);
    const matching = bodies.filter(isAt);
    let chosen = matching.find((b) => b.body.id === last) || matching[0];
    if (!chosen && !keepCoords && bodies.length > 0) {
      chosen = bodies.find((b) => b.body.id === last) || bodies[0];
      move(chosen);
    }
    select.value = chosen ? chosen.body.id : '';
    this.config.changed?.();
  }

  /**
   * The player picked a body: move the coordinates to it, remember it and
   * recalculate. The dash leaves the coordinates where they are.
   *
   * @param {Profile} profile
   */
  chosen(profile) {
    const id = getVal(this.config.select);
    const body = this.bodies(profile).find((b) => b.body.id === id);
    if (body) {
      this.config.move(body);
      this.pf.store.setLastPlanet(this.config.lastKey, profile.id, body.body.id);
      this.config.recalc();
    }
    this.config.changed?.();
  }

  /**
   * Keep the select on the body the coordinates are at, or on the dash.
   *
   * @param {Profile} profile
   */
  sync(profile) {
    const select = selectEl(this.config.select);
    if (!select) return;
    const bodies = this.bodies(profile);
    const current = bodies.find((b) => b.body.id === select.value);
    if (current && this.config.isAt(current)) return;
    const match = bodies.find(this.config.isAt);
    select.value = match ? match.body.id : '';
    this.config.changed?.();
  }

  onChange(/** @type {() => void} */ handler) {
    addEvent(this.config.select, 'change', handler);
  }

  hide() {
    this.config.boxes.forEach((box) => pfShow(box, false));
  }
}

/**
 * What every calculator's profile binder shares: the profile it shows, the
 * guard that keeps its own writes from coming back as edits, and the entry
 * points - init(), apply(), save() and leave() - whose sequence is the same
 * everywhere. A binder fills in the steps that differ: describeFields(),
 * takeOverSave() and bindControls() for init(); captureOwn(), showProfile(),
 * takeSnapshot() and afterApply() for apply(); sync() and saveOwn() (or
 * saveWithProfile()); restoreOwn() and recalc(); markAll().
 *
 * @template [App=*]
 */
class ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {App} app The calculator the binder drives.
   */
  constructor(pf, app) {
    this.pf = pf;
    this.app = app;
    /** @type {?string} The active profile's id while one is applied. */
    this.profileId = null;
    /** True while the binder writes into the form, so that is not taken for an edit. */
    this.applying = false;
    /** @type {Record<string, *>} Values (by profile key, body ones prefixed) at the last apply or sync. */
    this.snapshot = {};
    /** @type {?PfCoordsSelect} The coordinates select that follows the form after every save, if the page has one. */
    this.coordsSelect = null;
  }

  /** Connect to the page; called once, with the calculator ready. */
  init() {
    this.describeFields();
    this.takeOverSave();
    this.bindControls();
    this.pf.onChange((profile) => this.apply(profile));
    this.applyInitial(this.pf.active());
  }

  /** Name every value this page binds, in the page's own words; called from init(). */
  describeFields() {
    // A binder describes its fields here.
  }

  /** Route the calculator's save through save(); called from init(). */
  takeOverSave() {
    options.save = () => this.save();
  }

  /** Wire the page's own controls; called from init(). */
  bindControls() {
    // A binder wires its listeners here.
  }

  /**
   * Apply the profile that is active when the page loads.
   *
   * @param {?Profile} active
   */
  applyInitial(active) {
    if (active) this.apply(active);
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /**
   * Show a profile, or - with none - the calculator's own settings again.
   *
   * @param {?Profile} profile
   */
  apply(profile) {
    if (!profile) {
      this.leave();
      return;
    }
    this.applying = true;
    try {
      if (this.profileId === null) this.captureOwn();
      this.profileId = profile.id;
      this.pf.clearMarks();
      // The calculator's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.showProfile(profile);
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    this.afterApply(profile);
    this.markAll();
  }

  /** Keep the calculator's own values of what the profile owns, before a profile is first shown. */
  captureOwn() {
    // A binder copies its own values here.
  }

  /**
   * Fill the page from the profile and recalculate it; edits are not taken while this runs.
   *
   * @param {Profile} _profile
   */
  showProfile(_profile) {
    // A binder fills its form from the profile here.
  }

  /** Remember the values the page shows now, so the next save writes only what changed. */
  takeSnapshot() {
    // A binder records its values here.
  }

  /**
   * Called once the profile is shown and edits are taken again, before the marks.
   *
   * @param {Profile} _profile
   */
  afterApply(_profile) {
    // A binder attaches what follows the profile on its own here, such as the universe settings.
  }

  /**
   * Fill the form without its writes being taken for edits, then mark it.
   *
   * @param {() => void} fill
   */
  whileApplying(fill) {
    this.applying = true;
    try {
      fill();
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    // A binder marks its fields here.
  }

  /** @returns {?Profile} */
  profile() {
    return this.profileId ? this.pf.store.get(this.profileId) : null;
  }

  /** The calculator's save hook: with no profile it saves as it always did. */
  save() {
    if (this.profileId === null) {
      this.saveWithoutProfile();
      return;
    }
    if (this.applying) return;
    this.saveWithProfile();
  }

  /** The calculator's own save, as before options.save was taken over. */
  saveWithoutProfile() {
    // A binder calls the save it took over here.
  }

  /** Write what the player changed into the profile, and the rest into the calculator's own storage. */
  saveWithProfile() {
    this.sync();
    this.saveOwn();
    const profile = this.coordsSelect ? this.profile() : null;
    if (profile) this.coordsSelect?.sync(profile);
  }

  sync() {
    // A binder copies what changed in the form into the profile here.
  }

  saveOwn() {
    // A binder stores the calculator's own values here.
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.applying = true;
    try {
      this.profileId = null;
      this.pf.clearMarks();
      pfShow('#reset', true);
      this.restoreOwn();
    } finally {
      this.applying = false;
    }
    this.recalc();
  }

  /** Put the calculator's own values back into its form; the profile is already left. */
  restoreOwn() {
    // A binder puts the calculator's own values back here.
  }

  /** Recalculate the page after the form was filled from outside. */
  recalc() {
    // A binder recalculates its page here.
  }

  /**
   * The action of a restore button: put one game value back on a fresh copy
   * of the profile, as the one marked may be stale by the time the button is
   * clicked.
   *
   * @param {(fresh: Profile) => ?{values: LayeredValues}|undefined} locate The entity of the fresh copy that holds the value.
   * @param {string} key
   * @returns {() => void}
   */
  restoreValue(locate, key) {
    const id = this.profileId;
    return () => {
      const fresh = id ? this.pf.store.get(id) : null;
      if (!fresh) return;
      const target = locate(fresh);
      if (target && resetProfileValue(target, key)) this.pf.store.save(fresh);
    };
  }

  /**
   * @param {string} key
   * @returns {() => void}
   */
  restoreAccount(key) {
    return this.restoreValue((fresh) => fresh.account, key);
  }

  /**
   * @param {'planets'|'moons'} kind
   * @param {string} id
   * @param {string} key
   * @returns {() => void}
   */
  restoreBody(kind, id, key) {
    return this.restoreValue((fresh) => fresh[kind].find((b) => b.id === id), key);
  }

  /**
   * Write a value into the profile when it differs from the snapshot, and
   * remember it there.
   *
   * @param {{values: LayeredValues}} entity
   * @param {string} key Profile value key.
   * @param {string} snapKey Where the snapshot keeps the value.
   * @param {*} value
   * @returns {boolean} True when the profile changed.
   */
  syncValue(entity, key, snapKey, value) {
    if (sameValue(value, this.snapshot[snapKey])) return false;
    this.snapshot[snapKey] = value;
    return setProfileValue(entity, key, value);
  }

  /**
   * Name the fields of a list in the page's own words: the label comes from
   * the markup around the input, the display from the field or, for a select,
   * from its options.
   *
   * @param {{key: string, input: string|(() => ?HTMLElement), display?: (value: *) => string}[]} fields
   */
  describeFieldList(fields) {
    fields.forEach((f) => {
      const el = pfFieldInput(f);
      const display = f.display || (el instanceof HTMLSelectElement ? pfOptionText(el) : undefined);
      this.pf.describeField(f.key, pfFieldLabel(el), display);
    });
  }
}

/**
 * What a calculator bound by PlanetPrmBinder offers: it works on options.prm,
 * and shows the form again from it.
 *
 * @typedef {object} PlanetPrmApp
 * @property {() => void} restoreFromState Fill the form from options.prm.
 * @property {() => void} recalc
 */

/**
 * @typedef {object} PlanetPrmConfig
 * @property {ProfilePrmField[]} accountFields The fields the account fills.
 * @property {ProfilePrmField[]} planetFields The fields the planet picked in #pf-planet fills.
 * @property {string} cookie Where saveOwn() writes the calculator's own values.
 * @property {string} lastKey Calculator name under which the last planet is remembered.
 * @property {PfUniverseField[]} universe The settings that come from the profile's universe.
 * @property {string[]} extraOwnedKeys Keys the profile owns without a field of its own, such as the officers' bonus.
 * @property {() => void} [ownSave] The calculator's own save, before the binder took options.save over; options.save by default.
 */

/**
 * A setting of the profile's universe as a calculator shows it.
 *
 * @typedef {object} PfUniverseField
 * @property {PfUniverseSettingKind} kind
 * @property {string} input Selector of the field that shows it.
 * @property {string} prm The options.prm key the calculator keeps it under.
 */

/**
 * A binder for a calculator that shows the account and one planet of the
 * profile, and keeps everything in options.prm: the profile is projected into
 * options.prm and the form is shown again from it, and the changes come back
 * through options.save(). What the profile owns is stored with the values it
 * had before the profile, so "no profile" shows the calculator's own again.
 * A subclass gives the configuration and, where it differs, the hooks
 * afterShowPlanet() and afterSaveOwn().
 *
 * @template {PlanetPrmApp} App
 * @extends {ProfileBinder<App>}
 */
class PlanetPrmBinder extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {App} app
   * @param {PlanetPrmConfig} config
   */
  constructor(pf, app, config) {
    super(pf, app);
    this.config = config;
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    this.planetSelect = new PfBodySelect(pf, {
      select: '#pf-planet', box: '#pf-planet-box', bodies: (p) => p.planets, lastKey: config.lastKey,
    });
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = config.ownSave ?? options.save;
    /** @type {PfUniverseSetting[]} The universe's settings, set in init(). */
    this.universeSettings = [];
  }

  describeFields() {
    this.describeFieldList([...this.config.accountFields, ...this.config.planetFields]);
  }

  bindControls() {
    this.universeSettings = this.config.universe.map((u) => new PfUniverseSetting(this.pf, u.kind, u.input, () => this.app.recalc(), u.prm));
    this.planetSelect.onChange(() => this.planetChosen());
  }

  /**
   * @param {?Profile} profile
   * @returns {?ProfilePlanet}
   */
  planet(profile) {
    return profile?.planets.find((p) => p.id === this.planetId) || null;
  }

  /** The options.prm keys the profile may own. */
  ownedKeys() {
    const { accountFields, planetFields, extraOwnedKeys, universe } = this.config;
    return [...accountFields, ...planetFields].map((f) => f.prm).concat(extraOwnedKeys, universe.map((u) => u.prm));
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  captureOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.ownPrm = {};
    this.ownedKeys().forEach((key) => { this.ownPrm[key] = cloneData(prm[key]); });
  }

  /** @param {Profile} profile */
  showProfile(profile) {
    this.config.accountFields.forEach((f) => f.write(options.prm, getProfileValue(profile.account, f.key)));
    this.planetId = this.planetSelect.render(profile, this.planetId);
    this.showPlanet(profile);
  }

  /** @param {Profile} profile */
  afterApply(profile) {
    this.universeSettings.forEach((setting) => { void setting.attach(profile); });
  }

  /**
   * Put the planet's values - or, with no planet, the calculator's own - into
   * options.prm, show the whole form and recalculate. The caller takes the snapshot.
   *
   * @param {Profile} profile
   */
  showPlanet(profile) {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    this.config.planetFields.forEach((f) => {
      if (planet) f.write(prm, getProfileValue(planet, f.key));
      else prm[f.prm] = cloneData(this.ownPrm[f.prm]);
    });
    this.afterShowPlanet();
    this.app.restoreFromState();
    this.app.recalc();
  }

  /**
   * Called with the planet's fields in options.prm (this.planetId is the planet
   * shown, null for none), before the form is shown.
   */
  afterShowPlanet() {
    // A subclass fills in what depends on the planet and has no field of its own.
  }

  restoreOwn() {
    this.planetId = null;
    this.universeSettings.forEach((setting) => setting.detach());
    this.planetSelect.hide();
    Object.assign(options.prm, cloneData(this.ownPrm));
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  takeSnapshot() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot = {};
    this.config.accountFields.forEach((f) => { this.snapshot[f.key] = f.read(prm); });
    this.config.planetFields.forEach((f) => { this.snapshot['planet:' + f.key] = f.read(prm); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const planet = this.planet(profile);
    let changed = false;
    this.config.accountFields.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.read(prm)) || changed;
    });
    if (planet) {
      this.config.planetFields.forEach((f) => {
        changed = this.syncValue(planet, f.key, 'planet:' + f.key, f.read(prm)) || changed;
      });
    }
    changed = this.syncExtra(profile) || changed;
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * Write what a subclass binds beyond the field lists into the profile being
   * synced, which is then saved once with the rest.
   *
   * @param {Profile} _profile
   * @returns {boolean} True when the profile changed.
   */
  syncExtra(_profile) {
    return false;
  }

  /**
   * The calculator's own storage gets its own fields as they are, and the
   * profile-owned ones as they were before the profile. With no planet the
   * planet's fields are the calculator's own, so they are taken as they are,
   * and so are the universe settings of a profile with no universe.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    if (this.planetId === null) {
      this.config.planetFields.forEach((f) => { this.ownPrm[f.prm] = prm[f.prm]; });
    }
    this.afterSaveOwn();
    if (!this.profile()?.universe) {
      this.config.universe.forEach((u) => { this.ownPrm[u.prm] = prm[u.prm]; });
    }
    saveToCookie(this.config.cookie, { ...prm, ...cloneData(this.ownPrm) });
  }

  /**
   * Called before the own values are stored, to take over values that are the
   * calculator's own only while the profile has no planet.
   */
  afterSaveOwn() {
    // A subclass takes over the values it fills in from the planet here.
  }

  /** The player picked another planet. */
  planetChosen() {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the planet shown so far is saved first.
    this.save();
    this.planetId = this.planetSelect.chosen(profile);
    this.whileApplying(() => {
      this.showPlanet(profile);
      this.takeSnapshot();
    });
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    this.config.accountFields.forEach((f) => {
      this.pf.markField(pfFieldInput(f), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.universeSettings.forEach((setting) => setting.mark());
    const planet = this.planet(profile);
    if (!planet) return;
    this.config.planetFields.forEach((f) => {
      if (f.markIf && !f.markIf(planet)) return;
      this.pf.markField(pfFieldInput(f), profile, planet, f.key, this.restoreBody('planets', planet.id, f.key));
    });
  }
}

/**
 * @template {ProfileField} F
 * @typedef {object} FlatSettingsConfig
 * @property {F[]} fields The fields the account fills.
 * @property {() => Record<string, any>} settings The object the calculator keeps the fields in.
 * @property {string[]} ownedKeys The keys of that object the profile may own.
 * @property {string} cookie Where saveOwn() writes the calculator's own values.
 * @property {() => void} [ownSave] The calculator's own save, before the binder took options.save over; options.save by default.
 */

/**
 * A binder for a calculator that shows the account of the profile and nothing
 * else of it, in one settings object: the profile is projected into the
 * settings and the form is shown again from them, and the changes come back
 * through options.save(). What the profile owns is stored with the values it
 * had before the profile, so "no profile" shows the calculator's own again.
 * A subclass gives the configuration and the steps that differ:
 * showSettings() and showOwn() (the form from the settings, the universe, the
 * coordinates select), plus bindControls(), prepareSettings() and
 * storable() where the page needs them. Set `universe` and `coordsSelect`
 * in the constructor if the page has them.
 *
 * @template {ProfileField} F
 * @template [App=*]
 * @extends {ProfileBinder<App>}
 */
class FlatSettingsBinder extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {App} app
   * @param {FlatSettingsConfig<F>} config
   */
  constructor(pf, app, config) {
    super(pf, app);
    this.config = config;
    /** @type {Record<string, *>} The profile-owned keys as they were before a profile. */
    this.ownPrm = {};
    this.ownSave = config.ownSave ?? options.save;
    /** @type {?PfLockedUniverse} The universe picker the profile locks, if the page has one. */
    this.universe = null;
  }

  /** Wire the coordinates select; a subclass adds its own controls after it. */
  bindControls() {
    this.coordsSelect?.onChange(() => this.coordsChosen());
  }

  /** The player picked a body in the coordinates select. */
  coordsChosen() {
    const profile = this.profile();
    if (profile) this.coordsSelect?.chosen(profile);
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  captureOwn() {
    const { settings, ownedKeys } = this.config;
    this.ownPrm = {};
    ownedKeys.forEach((key) => { this.ownPrm[key] = cloneData(settings()[key]); });
  }

  /** @param {Profile} profile */
  showProfile(profile) {
    this.prepareSettings();
    this.config.fields.forEach((f) => this.writeField(f, getProfileValue(profile.account, f.key)));
    this.showSettings(profile);
    // The recalculation reads the fields back: the snapshot then holds the
    // values exactly as the form gives them, and the next edit compares like with like.
    this.recalc();
  }

  /** Called before the profile is written into the settings, to make them ready to take it. */
  prepareSettings() {
    // A subclass shapes settings that the fields write into here.
  }

  /**
   * Put a profile value into the settings. A subclass may skip a field here
   * (a link that carries its own value).
   *
   * @param {F} field
   * @param {*} value
   */
  writeField(field, value) {
    field.write(this.config.settings(), value);
  }

  /**
   * Called with the profile in the settings: show the universe and the
   * coordinates select, and the form again. The page is recalculated after.
   * A subclass adds the form, and the order it needs.
   *
   * @param {Profile} profile
   */
  showSettings(profile) {
    this.universe?.apply(profile);
    this.coordsSelect?.render(profile);
  }

  restoreOwn() {
    this.coordsSelect?.hide();
    Object.assign(this.config.settings(), cloneData(this.ownPrm));
    this.showOwn();
  }

  /** Show the calculator's own values again, and give the universe picker back. */
  showOwn() {
    // A subclass shows the restored settings in its form here.
  }

  takeSnapshot() {
    const { fields, settings } = this.config;
    this.snapshot = {};
    fields.forEach((f) => { this.snapshot[f.key] = f.read(settings()); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    const { fields, settings } = this.config;
    let changed = false;
    fields.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.read(settings())) || changed;
    });
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * The calculator's own storage gets its own fields as they are, and the
   * profile-owned ones - and a universe the profile dictates - as they were
   * before the profile.
   */
  saveOwn() {
    /** @type {Record<string, any>} */
    const stored = { ...this.config.settings(), ...cloneData(this.ownPrm) };
    this.universe?.overlay(stored);
    saveToCookie(this.config.cookie, this.storable(stored));
  }

  /**
   * The values about to be stored as the calculator's own; a subclass drops
   * what the cookie must not keep.
   *
   * @param {Record<string, any>} stored
   * @returns {Record<string, any>}
   */
  storable(stored) {
    return stored;
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    this.describeFieldList(this.config.fields);
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    this.config.fields.forEach((f) => {
      this.pf.markField(pfFieldInput(f), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
  }
}

/**
 * Connect a binder to the page, when it has the profile selector and the calculator.
 *
 * @template {ProfileBinder} B
 * @param {new (pf: ProfilesUi, app: *) => B} Binder
 * @param {*} app The calculator; nothing is bound until it exists.
 * @returns {?B}
 */
function pfBind(Binder, app) {
  if (!pfgProfiles || !app) return null;
  const binder = new Binder(pfgProfiles, app);
  binder.init();
  return binder;
}

/**
 * The page's profile controller, or null on a page without the selector.
 * Created when the deferred script runs - the DOM is parsed by then - so a
 * calculator can use it from its own DOMContentLoaded handler.
 *
 * @returns {?ProfilesUi}
 */
function createProfilesUi() {
  const selector = document.getElementById('pf-selector');
  if (!selector || typeof pfgProfileText === 'undefined') return null;
  const ui = new ProfilesUi(new ProfileStore(), pfgProfileText);
  ui.init();
  return ui;
}

const pfgProfiles = createProfilesUi();

Object.assign(window, {
  pfgProfiles, ProfilesUi, PfUniverseSetting, PfBodySelect, PfLockedUniverse, PfCoordsSelect, ProfileBinder, PlanetPrmBinder, FlatSettingsBinder, pfBind, PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS, PF_UNIVERSE_TOP_SCORE, readSavedSet,
  PF_UNIVERSE_DEF_DEBRIS, PF_UNIVERSE_SYSTEMS, PF_UNIVERSE_DONUT_SYSTEM,
});
