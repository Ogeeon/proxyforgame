// ============================================================================
// PLAYER PROFILES - the selector, its dialogs and the field marks
// ============================================================================
// Wires profiles_bs.tpl: the profile select in the top bar (with the import,
// create and manage actions at the bottom of its list), the four dialogs, the
// one-time offer to convert the old saved sets, and the marks a calculator
// puts on profile-owned fields. A calculator talks to it through `pfgProfiles`,
// which is null on a page without the selector.

'use strict';

/** Old saved-set key prefixes, and the calculator each came from. */
const SAVED_SET_PREFIXES = { prod_uni_: 'production', flight_uni_: 'flight' };

/** Set once the player has answered the conversion offer, either way. */
const SAVED_SETS_ANSWERED_KEY = 'pfg_saved_sets_answered';

/** The select's action entries, after the profiles. */
const PF_ACTION = { import: '__import', create: '__create', manage: '__manage' };

/**
 * @typedef {Object} SavedSet
 * @property {string} key Its localStorage key.
 * @property {string} name The name the player gave it.
 * @property {string} calc 'production' or 'flight'.
 */

/**
 * @param {string} template
 * @param {...*} args
 */
function pfFormat(template, ...args) {
  return template.replaceAll(/\{(\d+)\}/g, (m, i) => (args[Number(i)] === undefined ? m : String(args[Number(i)])));
}

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
    const header = cell.closest('table')?.querySelector('thead tr')?.children[cell.cellIndex];
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
   * @param {string} calc The calculator this page is.
   * @param {Record<string, string>} text Localized strings (pfgProfileText).
   */
  constructor(store, calc, text) {
    this.store = store;
    this.calc = calc;
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
  }

  init() {
    this.renderSelect();
    this.bindSelect();
    this.bindImport();
    this.bindProps();
    this.bindManage();
    this.bindMigration();
    this.bindReset();
    this.store.subscribe(() => {
      this.renderSelect();
      this.renderOverrides();
      if (!this.saving) this.emit();
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
    const title = pfFormat(this.text.inGame, gameText) + ' - ' + this.text.resetValue;
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

  renderSelect() {
    const select = selectEl('#pf-select');
    if (!select) return;
    const activeId = this.store.getActiveId();
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
    this.store.list().forEach((e) => add(e.id, e.label + (e.universe ? ' · s' + e.universe.number + '-' + e.universe.country : '')));
    add('', '──────────').disabled = true;
    add(PF_ACTION.import, this.text.actImport);
    add(PF_ACTION.create, this.text.actCreate);
    add(PF_ACTION.manage, this.text.actManage);
    select.value = activeId || '';
  }

  bindSelect() {
    addEvent('#pf-select', 'change', () => {
      const select = selectEl('#pf-select');
      if (!select) return;
      const value = select.value;
      if (value === PF_ACTION.import) this.openImport();
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
    const title = pfFormat(this.text.overrides, count) + ' - ' + this.text.resetAll;
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
    const c = body.coords;
    const where = c && c.galaxy !== null && c.system !== null ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
    return (body.name || '') + where;
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
    showToast(pfFormat(this.text.importDone, profile.label, summary.planets.added, summary.planets.updated, summary.planets.removed), 'success');
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
        if (!await showConfirmModal(pfFormat(this.text.deleteConfirm, p.label), this.text.confirm, this.text.cancel, this.text.attention)) return;
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
      if (!await showConfirmModal(pfFormat(this.text.mergeConfirm, from.label, into.label), this.text.confirm, this.text.cancel, this.text.attention)) return;
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
      if (await showConfirmModal(pfFormat(this.text.restoreConflict, p.label), this.text.replace, this.text.skip, this.text.attention)) {
        if (this.store.save(p)) restored.push(p);
      }
    }
    // The universe choices come back with a profile of their universe.
    (result.universes || [])
      .filter((u) => restored.some((p) => p.universe && sameUniverse(p.universe, u.universe)))
      .forEach((u) => PfUniverseSetting.restoreChoices(u));
    this.store.requestPersistence();
    this.renderManage();
    showToast(pfFormat(this.text.restoreDone, restored.length), 'success');
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
        Object.entries(SAVED_SET_PREFIXES).forEach(([prefix, calc]) => {
          if (key.startsWith(prefix)) sets.push({ key, name: key.slice(prefix.length), calc });
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
    const sets = this.findSavedSets();
    let answered = false;
    try {
      answered = localStorage.getItem(SAVED_SETS_ANSWERED_KEY) !== null;
    } catch {
      answered = true;
    }
    if (sets.length === 0 || (!asked && answered)) return;
    setTextContent('#pf-migrate-body', pfFormat(this.text.migrateText, sets.length));
    const list = document.getElementById('pf-migrate-list');
    if (list) {
      list.innerHTML = '';
      sets.forEach((s) => {
        const item = document.createElement('li');
        item.textContent = s.name + ' (' + s.calc + ')';
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
      setTextContent('#pf-migrate-result-text', converted > 0 ? pfFormat(this.text.migrateDone, converted) : this.text.migrateNone);
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
      const profile = set.calc === 'production'
        ? profileFromProductionSet(prm, { label: set.name })
        : profileFromFlightSet(prm, { label: set.name });
      if (this.store.save(profile)) count++;
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

/** Every setting a fetch stores, whichever of them asked for it. */
const PF_UNIVERSE_SETTINGS = [PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS];

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
   */
  constructor(pf, kind, selector, recalc) {
    this.pf = pf;
    this.kind = kind;
    this.selector = selector;
    this.recalc = recalc;
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
    this.mark();
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
    this.mark();
  }

  /** Mark the field as the game's, with a restore button when the player changed it. */
  mark() {
    const key = this.cacheKey();
    const game = this.gameValue(key ? PfUniverseSetting.read(key) : null);
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
 * The page's profile controller, or null on a page without the selector.
 * Created when the deferred script runs - the DOM is parsed by then - so a
 * calculator can use it from its own DOMContentLoaded handler.
 *
 * @returns {?ProfilesUi}
 */
function createProfilesUi() {
  const selector = document.getElementById('pf-selector');
  if (!selector || typeof pfgProfileText === 'undefined') return null;
  const ui = new ProfilesUi(new ProfileStore(), selector.dataset.calc || '', pfgProfileText);
  ui.init();
  return ui;
}

const pfgProfiles = createProfilesUi();

Object.assign(window, {
  pfgProfiles, ProfilesUi, PfUniverseSetting, PF_UNIVERSE_SPEED, PF_UNIVERSE_DEBRIS, PF_UNIVERSE_DEUT_IN_DEBRIS, readSavedSet,
});
