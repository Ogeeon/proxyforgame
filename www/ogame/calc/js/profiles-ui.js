// ============================================================================
// PLAYER PROFILES - the selector, its dialogs and the field marks
// ============================================================================
// Wires profiles.tpl: the profile select in the top bar (with the import,
// create and manage actions at the bottom of its list), the four dialogs, the
// one-time offer to convert the old saved sets, and the marks a calculator
// puts on profile-owned fields. A calculator talks to it through `pfgProfiles`,
// which is null on a page without the selector. The fields, the widgets and the
// binders a calculator builds on live in profiles-fields.js,
// profiles-widgets.js and profiles-binders.js, loaded before this file: it
// creates `pfgProfiles` as it runs, so it comes last.

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
 * @property {string} key Its saveToCookie key (localStorage or the cookie fallback).
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
  setTooltipText(el, title);
}

/**
 * Release the tooltips of an element and of everything inside it. Must run
 * before the element leaves the DOM, or its bubble stays behind in <body>.
 *
 * @param {ParentNode & Element} root
 */
function pfDropTooltips(root) {
  disposeTooltips(root, '[data-bs-title]');
}

/**
 * @param {string} id
 * @returns {ReturnType<typeof modalFor>}
 */
function pfModal(id) {
  return modalFor(document.getElementById(id));
}

/**
 * @param {string} id
 * @returns {boolean} True while the modal is shown.
 */
function pfModalOpen(id) {
  return document.getElementById(id)?.classList.contains('show') ?? false;
}

/**
 * How the page names a universe: "s<number>-<country>".
 *
 * @param {ProfileUniverse} universe
 * @returns {string}
 */
function pfUniverseLabel(universe) {
  return 's' + universe.number + '-' + universe.country;
}

/**
 * How the page names a Companion account: its player name, or its id when the
 * export carried none.
 *
 * @param {{playerId: number, playerName: string}} account
 * @returns {string}
 */
function pfAccountName(account) {
  return account.playerName || String(account.playerId);
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
    /** @type {?CompanionPayload} The last Companion payload, planned again when the profiles or the ignore list change. */
    this.companionPayload = null;
    /** @type {?string} The accounts and the ignore list the candidates were last planned against (companionPlanBasis). */
    this.companionPlannedFor = null;
    /** @type {AccountExport[]} Exports of ignored accounts, to create their profiles from the manager. */
    this.companionIgnoredExports = [];
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
      // A profile created, deleted or merged - here, in another tab or by a
      // restore - or an account (un)ignored changes what the badge offers.
      this.replanCompanion();
      if (pfModalOpen('pf-manage-modal')) this.renderIgnored();
      if (!this.saving && this.concernsActive(key)) this.emit();
    });
    this.store.listenToOtherTabs(window);
    this.renderOverrides();
    this.renderCompanionBadge();
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
   * Whether a change may touch the profile this tab shows: any profile change
   * made in this tab, and in another tab anything but the save of another
   * profile. The Companion ignore list is no profile's.
   *
   * @param {?string} [key] The storage key another tab wrote; undefined for a change made here.
   * @returns {boolean}
   */
  concernsActive(key) {
    if (key === PROFILE_STORAGE_KEYS.companionIgnored) return false;
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
    const profiles = this.store.list().map((e) => [e.id, e.label + (e.universe ? ' · ' + pfUniverseLabel(e.universe) : '')]);
    const shown = JSON.stringify(profiles);
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

  /**
   * The badge by the select: how many accounts Companion offers that have no
   * profile yet (ADR-0004). It is a state, not a notification - it stays until
   * each account got its profile or was ignored.
   */
  renderCompanionBadge() {
    const badge = document.getElementById('pf-companion-new');
    if (!badge) return;
    const count = this.store.available ? this.companionCandidates.length : 0;
    badge.classList.toggle('d-none', count === 0);
    badge.innerHTML = count === 0 ? '' : '<i class="bi bi-person-plus" aria-hidden="true"></i> ' + count;
    pfTooltip(badge, formatString(this.text.companionBadge, count));
    badge.setAttribute('role', 'button');
    badge.onclick = () => this.openNewProfiles();
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
    const plan = this.planCompanion(payload);
    if (!plan) return;
    this.companionPayload = payload;
    // Taken before the updates are saved: they change no account, so the
    // replans their saves set off find nothing to plan again.
    this.takeCompanionPlan(plan);
    plan.updates.forEach((profile) => this.save(profile));
    // save() keeps a page's own edits from coming back to it, but a Sync is not
    // the calculator's edit: it has to show the active profile's new game layer.
    // At load no calculator listens yet, and it reads the saved profile itself.
    const activeId = this.store.getActiveId();
    if (plan.updates.some((profile) => profile.id === activeId)) this.emit();
  }

  /**
   * Plan a payload against the stored profiles and the ignore list.
   *
   * @param {*} payload
   * @returns {?CompanionSyncPlan}
   */
  planCompanion(payload) {
    return planCompanionSync(payload, this.store.list(), (id) => this.store.get(id), this.store.listCompanionIgnored());
  }

  /**
   * What the candidates depend on besides the payload: which accounts have a
   * profile, and the ignore list. A value edit changes neither, so the many
   * saves a calculator makes do not plan the payload again.
   *
   * @returns {string}
   */
  companionPlanBasis() {
    return JSON.stringify([this.store.list().map((e) => [e.playerId, e.universe]), this.store.listCompanionIgnored()]);
  }

  /**
   * Show a plan's candidates: the badge, and the badge's dialog while it is
   * open - closed once nothing is left to offer.
   *
   * @param {CompanionSyncPlan} plan
   */
  takeCompanionPlan(plan) {
    this.companionPlannedFor = this.companionPlanBasis();
    this.companionCandidates = plan.candidates;
    this.companionIgnoredExports = plan.ignored;
    this.renderCompanionBadge();
    if (!pfModalOpen('pf-new-profiles-modal')) return;
    if (this.companionCandidates.length === 0) pfModal('pf-new-profiles-modal')?.hide();
    else this.renderNewProfiles();
  }

  /**
   * Plan the payload this page loaded again when a profile was created,
   * deleted or merged, or an account (un)ignored, without touching the
   * profiles: an account that got its profile leaves the badge, one whose
   * profile is gone or that was taken off the ignore list comes back.
   */
  replanCompanion() {
    if (this.companionPayload === null || this.companionPlanBasis() === this.companionPlannedFor) return;
    const plan = this.planCompanion(this.companionPayload);
    if (plan) this.takeCompanionPlan(plan);
  }

  /** The badge's dialog: one row per account Companion offers. */
  openNewProfiles() {
    this.renderNewProfiles();
    pfModal('pf-new-profiles-modal')?.show();
  }

  renderNewProfiles() {
    const body = document.getElementById('pf-new-profiles-rows');
    if (!body) return;
    pfDropTooltips(body);
    body.innerHTML = '';
    this.companionCandidates.forEach((data) => {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const label = document.createElement('div');
      label.textContent = pfAccountName(data);
      name.appendChild(label);
      const at = Date.parse(data.exportedAt || '');
      if (!Number.isNaN(at)) {
        const when = document.createElement('div');
        when.className = 'small text-body-secondary';
        when.textContent = pfPageDateTime(at);
        name.appendChild(when);
      }
      const universe = document.createElement('td');
      universe.textContent = data.universe ? pfUniverseLabel(data.universe) : this.text.noUniverse;
      const actions = document.createElement('td');
      actions.className = 'text-end text-nowrap';
      actions.appendChild(this.textButton('btn-primary', this.text.companionCreate, () => this.createCompanionProfile(data)));
      actions.appendChild(this.textButton('btn-outline-secondary', this.text.companionIgnore, () => this.ignoreCompanionCandidate(data)));
      row.append(name, universe, actions);
      body.appendChild(row);
    });
  }

  /**
   * Create a profile from a candidate's export - or, when a profile of that
   * account appeared since the payload was planned, update it like an import
   * would, keeping the overrides. The active profile is not switched: creating
   * one is not choosing it.
   *
   * @param {AccountExport} data
   */
  createCompanionProfile(data) {
    const existingId = findProfileForExport(this.store.list(), data.playerId, data.universe);
    const existing = existingId ? this.store.get(existingId) : null;
    const { profile, summary } = importAccountExport(existing, data, { keepOverrides: existing !== null });
    if (!this.store.save(profile)) {
      showToast(this.text.saveFailed, 'danger');
      return;
    }
    this.store.requestPersistence();
    // A profile the account now has makes its ignore entry moot. The badge,
    // its dialog and the manager follow the store (replanCompanion).
    this.store.unignoreCompanionAccount(data);
    showToast(formatString(this.text.importDone, profile.label, summary.planets.added, summary.planets.updated, summary.planets.removed), 'success');
  }

  /**
   * Never offer the account again, unless the player takes it off the ignore
   * list in the manager - so the choice asks for a confirmation.
   *
   * @param {AccountExport} data
   */
  async ignoreCompanionCandidate(data) {
    // A candidate always names its universe - the plan skips schema-1 exports.
    if (!data.universe) return;
    if (!await showConfirmModal(formatString(this.text.companionIgnoreConfirm, pfAccountName(data)), this.text.confirm, this.text.cancel, this.text.attention)) return;
    const ok = this.store.ignoreCompanionAccount({
      playerId: data.playerId,
      universe: { ...data.universe },
      playerName: data.playerName,
      ignoredAt: new Date().toISOString(),
    });
    if (!ok) showToast(this.text.saveFailed, 'danger');
  }

  /**
   * @param {string} style
   * @param {string} label
   * @param {() => void} onClick
   */
  textButton(style, label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm ms-1 ' + style;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
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
    addEvent('#pf-props-modal', BS_EVENT.modalHidden, () => {
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
      const universe = p.universe ? pfUniverseLabel(p.universe) : this.text.noUniverse;
      const source = hasGameLayer(p) && p.importedAt ? pfPageDateTime(Date.parse(p.importedAt)) : '—';
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
    this.renderIgnored();
    pfShow('#pf-migrate-open', this.findSavedSets().length > 0);
  }

  /**
   * The manager's section of the accounts the player refused (ADR-0004): each
   * can be offered again, and - while its export is still the payload this page
   * loaded - get its profile right from here.
   */
  renderIgnored() {
    const box = document.getElementById('pf-ignored-box');
    const body = document.getElementById('pf-ignored-rows');
    if (!box || !body) return;
    pfDropTooltips(body);
    body.innerHTML = '';
    const entries = this.store.listCompanionIgnored();
    box.classList.toggle('d-none', entries.length === 0);
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'd-flex flex-wrap gap-2 align-items-center mb-1';
      const name = document.createElement('span');
      name.className = 'text-nowrap';
      name.textContent = pfAccountName(entry) + ' · ' + pfUniverseLabel(entry.universe);
      const actions = document.createElement('span');
      actions.className = 'ms-auto text-nowrap';
      // The manager and the badge follow the store, so the buttons only act.
      const data = this.companionIgnoredExports.find((e) => sameCompanionAccount(e, entry));
      if (data) {
        actions.appendChild(this.textButton('btn-outline-secondary', this.text.companionCreate, () => this.createCompanionProfile(data)));
      }
      actions.appendChild(this.textButton('btn-outline-secondary', this.text.manageUnignore, () => this.store.unignoreCompanionAccount(entry)));
      row.append(name, actions);
      body.appendChild(row);
    });
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
    pfDownload(
      serializeProfilesFile(profiles, undefined, this.universes.choicesOf(profiles), this.store.listCompanionIgnored()),
      'pfg-profiles-' + stamp + '.json',
    );
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
        // The file carries no resource readings: the stored profile's stay.
        const replacement = keepBodyResources(p, this.store.get(p.id));
        if (this.store.save(replacement)) restored.push(replacement);
      }
    }
    // The universe choices come back with a profile of their universe.
    (result.universes || [])
      .filter((u) => restored.some((p) => p.universe && sameUniverse(p.universe, u.universe)))
      .forEach((u) => this.universes.restoreChoices(u));
    // The ignore list comes back beside the entries already there, so a
    // restored device is not asked about accounts it has refused either way.
    // The badge follows the store (replanCompanion).
    this.store.saveCompanionIgnored(mergeCompanionIgnored(this.store.listCompanionIgnored(), result.companionIgnored || []));
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
    Object.entries(SAVED_SET_KINDS).forEach(([prefix, kind]) => {
      listSavedKeys(prefix).forEach((key) => sets.push({ key, name: key.slice(prefix.length), kind }));
    });
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
 * The page's profile controller, or null on a page without the selector.
 * Created when the deferred script runs - the DOM is parsed by then - so a
 * calculator can use it from its own DOMContentLoaded handler.
 *
 * Also null when Bootstrap or its facade (bootstrap-access.js) failed to load:
 * init() builds tooltips right away, and this runs outside the page's inline
 * guard, so it would throw a ReferenceError on top of the pfgScriptsFailed()
 * banner the guard shows.
 *
 * @returns {?ProfilesUi}
 */
function createProfilesUi() {
  if (typeof bootstrapAvailable !== 'function' || !bootstrapAvailable()) return null;
  const selector = document.getElementById('pf-selector');
  if (!selector || typeof pfgProfileText === 'undefined') return null;
  const store = new ProfileStore();
  // The stored profiles of the imports that ran before the zeros: brought up
  // to date before the first reader - init(), the binders - sees them.
  migrateLfGameLevels(store);
  const ui = new ProfilesUi(store, pfgProfileText);
  ui.init();
  return ui;
}

const pfgProfiles = createProfilesUi();

Object.assign(window, {
  pfgProfiles, ProfilesUi, readSavedSet,
});
