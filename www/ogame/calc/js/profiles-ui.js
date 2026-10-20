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
   * @param {UniverseCache} [universes] The shared cache of the universe settings.
   */
  constructor(store, text, universes = new UniverseCache()) {
    this.store = store;
    this.text = text;
    this.universes = universes;
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
    const state = pfMarkState(entity.values[key], hasGameLayer(profile));
    const gameText = state.differs ? this.displayValue(key, state.game) : null;
    this.markInput(input, state.bound, gameText, () => restore(state.game));
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
    const count = profile ? this.overridesOf(profile).length : 0;
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

  /**
   * Every value that differs from the game: the profile's own - only when it
   * has a game layer, as for the marks - then the settings the player picked
   * for its universe, which are marked whether or not it has one.
   *
   * @param {Profile} profile
   * @returns {ProfileOverride[]}
   */
  overridesOf(profile) {
    const own = hasGameLayer(profile) ? listOverrides(profile) : [];
    return profile.universe ? own.concat(listUniverseOverrides(this.universes.get(profile.universe))) : own;
  }

  /** List every value that differs from the game, each with a tick to restore it. */
  openReset() {
    const profile = this.active();
    const body = document.getElementById('pf-reset-rows');
    if (!profile || !body) return;
    this.resetRows = this.overridesOf(profile);
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
    if (item.kind === 'universe') return this.text.universe;
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
      const universeKeys = chosen.filter((item) => item.kind === 'universe').map((item) => item.key);
      const fromUniverse = current.universe && universeKeys.length > 0 ? this.universes.reset(current.universe, universeKeys) : 0;
      if (resetOverrides(current, chosen.filter((item) => item.kind !== 'universe')) > 0) {
        // Saving calls the calculator back, which shows the universe's values too.
        if (!this.store.save(current)) showToast(this.text.saveFailed, 'danger');
      } else if (fromUniverse > 0) {
        // The universe cache is not the profile: nothing calls back on its own.
        this.renderOverrides();
        this.emit();
      }
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
    const plan = planCompanionSync(payload, this.store.list(), (id) => this.store.get(id));
    if (!plan) return;
    plan.updates.forEach((profile) => this.save(profile));
    this.companionCandidates = plan.candidates;
    this.renderSelect();
    // save() keeps a page's own edits from coming back to it, but a Sync is not
    // the calculator's edit: it has to show the active profile's new game layer.
    // At load no calculator listens yet, and it reads the saved profile itself.
    const activeId = this.store.getActiveId();
    if (plan.updates.some((profile) => profile.id === activeId)) this.emit();
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
    const asked = this.pendingExport !== null;
    const universe = resolveImportUniverse(data, this.store.list(), { asked, picked: asked ? this.readUniversePicker('pf-import') : null });
    if (!universe) {
      this.pendingExport = data;
      this.fillUniversePicker('pf-import', null);
      pfShow('#pf-import-universe-box', true);
      this.showError('#pf-import-error', getVal('#pf-import-country') ? this.text.pickUniverse : '');
      return;
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
    pfDownload(serializeProfilesFile(profiles, undefined, this.universes.choicesOf(profiles)), 'pfg-profiles-' + stamp + '.json');
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
      .forEach((u) => this.universes.restoreChoices(u));
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

/**
 * A field as a field group takes it: what it reads, where it is shown and
 * how its game value reads (ProfileField has all of it).
 *
 * @typedef {ProfileFieldBase & {
 *   input: string|(() => ?HTMLElement),
 *   read: (settings: Record<string, any>) => *,
 *   markIf?: (entity: {values: LayeredValues}) => boolean,
 * }} PfGroupField
 */

/**
 * The profile-owned fields one entity of the profile fills (CONTEXT.md: Field
 * group). A binder declares its groups in fieldGroups(); the snapshot, the
 * write-back, the marks, the reset dialog's names and the restore buttons
 * follow from them.
 *
 * @typedef {object} PfFieldGroup
 * @property {string} scope Prefix of the group's snapshot keys (pfSnapKey): '' for the account, 'planet', 'moon'...
 * @property {(profile: Profile) => ?{values: LayeredValues}} entity The entity that holds the values: the account, the body shown; null while there is none - the group is then neither written back nor marked, but still taken into the snapshot.
 * @property {PfGroupField[]} fields
 * @property {() => Record<string, any>} settings What the fields read from.
 * @property {boolean} [describe] False keeps the fields out of describeFields() (a key another group names already); true by default.
 */

/**
 * What every calculator's profile binder shares: the profile it shows, the
 * guard that keeps its own writes from coming back as edits, and the entry
 * points - init(), apply(), save() and leave() - whose sequence is the same
 * everywhere. A binder fills in the steps that differ: describeFields(),
 * takeOverSave() and bindControls() for init(); captureOwn(), showProfile(),
 * takeSnapshot() and afterApply() for apply(); writeBack() and saveOwn() (or
 * saveWithProfile()); restoreOwn() and recalc(); markAll(). A binder that
 * declares its fieldGroups() gets describeFields(), takeSnapshot(),
 * writeBack() and markAll() from them, and adds what the groups do not cover
 * in writeBackExtra() and markExtra(). A binder that declares its
 * ownedGroups() gets captureOwn(), saveOwn() and restoreOwn() from them
 * (ADR-0004: what the profile owns is stored as it was before the profile),
 * and says where the own values live in ownSettings() and storeOwn().
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
    /** @type {Record<string, *>} Values (by profile key, body ones prefixed) at the last apply or write-back. */
    this.snapshot = {};
    /** @type {?PfCoordsSelect} The coordinates select that follows the form after every save, if the page has one. */
    this.coordsSelect = null;
    /** @type {Record<string, *>} The calculator's own values of what the profile owns (ownedGroups()), kept while a profile is shown. */
    this.ownPrm = {};
  }

  /** Connect to the page; called once, with the calculator ready. */
  init() {
    this.describeFields();
    this.takeOverSave();
    this.bindControls();
    this.pf.onChange((profile) => this.apply(profile));
    this.applyInitial(this.pf.active());
  }

  /**
   * The groups of profile-owned fields the page shows (none by default).
   *
   * @returns {PfFieldGroup[]}
   */
  fieldGroups() {
    return [];
  }

  /** Name every value this page binds, in the page's own words; called from init(). */
  describeFields() {
    this.describeFieldList(this.fieldGroups().filter((g) => g.describe !== false).flatMap((g) => g.fields));
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
    this.ownPrm = pfPickOwn(this.ownSettings(), this.ownedGroups(this.profile()).flatMap((g) => g.keys));
  }

  /**
   * The keys of the calculator's settings the profile owns, grouped by what
   * fills them: a group whose entity the profile does not have is the
   * calculator's own while that lasts, both in the form and in its storage.
   * None by default.
   *
   * @param {?Profile} _profile The profile shown; null before one is.
   * @returns {PfOwnedGroup[]}
   */
  ownedGroups(_profile) {
    return [];
  }

  /**
   * The settings the own values are taken from and given back to.
   *
   * @returns {Record<string, any>}
   */
  ownSettings() {
    return options.prm;
  }

  /**
   * The calculator's own values of what the profile does not fill now - a
   * body it does not have - to show in their place.
   *
   * @param {?Profile} profile
   * @returns {Record<string, any>}
   */
  ownInPlace(profile) {
    const groups = this.ownedGroups(profile).filter((g) => g.show !== false);
    return pfPickOwn(this.ownPrm, pfSplitOwned(groups).own);
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
    this.snapshot = snapshotReadings(this.readGroups(null));
  }

  /**
   * Remember the values of some groups only, the rest of the snapshot kept:
   * after a body was picked, only its fields changed.
   *
   * @param {PfFieldGroup[]} groups
   */
  snapshotGroups(groups) {
    Object.assign(this.snapshot, snapshotReadings(this.readGroups(null, groups)));
  }

  /**
   * The values the groups' fields show now.
   *
   * @param {?Profile} profile Where the entities are looked up; null leaves every entity null (enough for a snapshot).
   * @param {PfFieldGroup[]} [groups]
   * @param {Record<string, any>} [settings] Read every group from these, instead of each group's settings().
   * @returns {FieldReading[]}
   */
  readGroups(profile, groups = this.fieldGroups(), settings = undefined) {
    return groups.flatMap((g) => {
      const from = settings ?? g.settings();
      const entity = profile ? g.entity(profile) : null;
      return g.fields.map((f) => ({ entity, key: f.key, snapKey: pfSnapKey(g.scope, f.key), value: f.read(from) }));
    });
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
    const profile = this.profile();
    if (!profile) return;
    this.fieldGroups().forEach((g) => {
      const entity = g.entity(profile);
      if (!entity) return;
      g.fields.forEach((f) => {
        if (f.markIf && !f.markIf(entity)) return;
        this.pf.markField(pfFieldInput(f), profile, entity, f.key, this.restoreField(g, f.key));
      });
    });
    this.markExtra(profile);
  }

  /**
   * Mark what a binder binds beyond its field groups.
   *
   * @param {Profile} _profile
   */
  markExtra(_profile) {
    // A binder marks the rest of its fields here.
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
    this.writeBack();
    this.saveOwn();
    const profile = this.coordsSelect ? this.profile() : null;
    if (profile) this.coordsSelect?.follow(profile);
  }

  /** Write what changed since the last snapshot into the profile, save it once and mark it. */
  writeBack() {
    const profile = this.profile();
    if (!profile) return;
    let changed = this.writeBackGroups(profile);
    changed = this.writeBackExtra(profile) || changed;
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * Write the groups' values that changed since the snapshot into the profile
   * (not saved yet), and remember them.
   *
   * @param {Profile} profile
   * @param {Record<string, any>} [settings] Read every group from these, instead of each group's settings().
   * @returns {boolean} True when the profile changed.
   */
  writeBackGroups(profile, settings = undefined) {
    const { writes, snapshot } = diffReadings(this.readGroups(profile, this.fieldGroups(), settings), this.snapshot);
    this.snapshot = snapshot;
    let changed = false;
    writes.forEach((w) => { changed = setProfileValue(w.entity, w.key, w.value) || changed; });
    return changed;
  }

  /**
   * Write what a binder binds beyond its field groups into the profile being
   * written back, which is then saved once with the rest.
   *
   * @param {Profile} _profile
   * @returns {boolean} True when the profile changed.
   */
  writeBackExtra(_profile) {
    return false;
  }

  /**
   * Store the calculator's settings as its own: what the profile fills now
   * with the values from before the profile, the rest as it is - and that
   * rest, where the profile owns it but does not fill it now, becomes the
   * own value.
   */
  saveOwn() {
    const { profile: ownedNow, own } = pfSplitOwned(this.ownedGroups(this.profile()));
    const current = this.ownCurrent();
    const kept = pfKeepOwn({ current, own: this.ownPrm, owned: this.ownCopyKeys(current, [...ownedNow, ...own]), ownedNow });
    this.ownPrm = kept.own;
    this.storeOwn(kept.stored);
  }

  /**
   * The settings about to be stored as the calculator's own.
   *
   * @returns {Record<string, any>}
   */
  ownCurrent() {
    return this.ownSettings();
  }

  /**
   * The keys the copy of the own values keeps up to date: the owned ones by default.
   *
   * @param {Record<string, any>} _current
   * @param {string[]} owned
   * @returns {string[]}
   */
  ownCopyKeys(_current, owned) {
    return owned;
  }

  /**
   * Write the calculator's own values into its storage.
   *
   * @param {Record<string, any>} _stored
   */
  storeOwn(_stored) {
    // A binder saves them under its own key here.
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

  /**
   * Put the calculator's own values back; the profile is already left. A
   * binder shows them in its form after this.
   */
  restoreOwn() {
    Object.assign(this.ownSettings(), cloneData(this.ownPrm));
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
   * The action of the restore button of a group's field: the value goes back
   * on the group's entity in a fresh copy of the profile.
   *
   * @param {PfFieldGroup} group
   * @param {string} key
   * @returns {() => void}
   */
  restoreField(group, key) {
    return this.restoreValue((fresh) => group.entity(fresh), key);
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
  writeBackValue(entity, key, snapKey, value) {
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
 * @property {string[]} extraOwnedKeys Keys the account fills without a field of its own, such as the officers' bonus.
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
 * afterShowPlanet() and ownedGroups() - a value it fills in from a body that
 * may be missing is a group of its own, present while the body is there.
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
    this.ownSave = config.ownSave ?? options.save;
    /** @type {PfUniverseSetting[]} The universe's settings, set in init(). */
    this.universeSettings = [];
  }

  /** @returns {PfFieldGroup[]} The account, and the planet picked in #pf-planet. */
  fieldGroups() {
    const settings = () => options.prm;
    return [
      { scope: '', entity: (p) => p.account, fields: this.config.accountFields, settings },
      { scope: 'planet', entity: (p) => this.planet(p), fields: this.config.planetFields, settings },
    ];
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

  /**
   * The options.prm keys the profile owns: the account's always, the
   * planet's while it has the planet, and the universe's while it has a
   * universe - shown by the universe settings, not given back by the binder.
   *
   * @param {?Profile} profile
   * @returns {PfOwnedGroup[]}
   */
  ownedGroups(profile) {
    const { accountFields, planetFields, extraOwnedKeys, universe } = this.config;
    return [
      { keys: [...accountFields.map((f) => f.prm), ...extraOwnedKeys], present: true },
      { keys: planetFields.map((f) => f.prm), present: this.planet(profile) !== null },
      { keys: universe.map((u) => u.prm), present: !!profile?.universe, show: false },
    ];
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

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
    if (planet) this.config.planetFields.forEach((f) => f.write(prm, getProfileValue(planet, f.key)));
    this.afterShowPlanet();
    // What the profile has no entity for is the calculator's own (ownedGroups).
    Object.assign(prm, this.ownInPlace(profile));
    this.app.restoreFromState();
    this.app.recalc();
  }

  /**
   * Called with the planet's fields in options.prm (this.planetId is the planet
   * shown, null for none), before the form is shown. A subclass writes what
   * the profile fills here; the own values of what it does not fill
   * (ownedGroups) are put in after.
   */
  afterShowPlanet() {
    // A subclass fills in what depends on the planet and has no field of its own.
  }

  restoreOwn() {
    this.planetId = null;
    this.universeSettings.forEach((setting) => setting.detach());
    this.planetSelect.hide();
    super.restoreOwn();
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /** @param {Record<string, any>} stored */
  storeOwn(stored) {
    saveToCookie(this.config.cookie, stored);
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

  /** @param {Profile} _profile */
  markExtra(_profile) {
    this.universeSettings.forEach((setting) => setting.mark());
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
    this.ownSave = config.ownSave ?? options.save;
    /** @type {?PfLockedUniverse} The universe picker the profile locks, if the page has one. */
    this.universe = null;
  }

  /** @returns {PfFieldGroup[]} The account, the only entity the page shows. */
  fieldGroups() {
    return [{ scope: '', entity: (p) => p.account, fields: this.config.fields, settings: this.config.settings }];
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

  /**
   * The keys the profile may own, all filled by the account; a universe the
   * profile dictates is kept apart, by PfLockedUniverse.
   *
   * @param {?Profile} _profile
   * @returns {PfOwnedGroup[]}
   */
  ownedGroups(_profile) {
    return [{ keys: this.config.ownedKeys, present: true }];
  }

  /** @returns {Record<string, any>} */
  ownSettings() {
    return this.config.settings();
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

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
    super.restoreOwn();
    this.showOwn();
  }

  /** Show the calculator's own values again, and give the universe picker back. */
  showOwn() {
    // A subclass shows the restored settings in its form here.
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /**
   * A universe the profile dictates is stored as the one the player picked
   * before the profile, after the owned keys got their own values back.
   *
   * @param {Record<string, any>} stored
   */
  storeOwn(stored) {
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
  pfgProfiles, ProfilesUi, ProfileBinder, PlanetPrmBinder, FlatSettingsBinder, pfBind, readSavedSet,
});
