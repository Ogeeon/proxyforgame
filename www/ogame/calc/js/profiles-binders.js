// ============================================================================
// PLAYER PROFILES - the profile binders
// ============================================================================
// What ties a calculator to the active profile: the base every calculator's
// binder extends (ProfileBinder), the two shapes most calculators fit
// (PlanetPrmBinder, FlatSettingsBinder), pfBind() that connects one to the
// page, and the helpers that prefill the "from" levels of build tables.

'use strict';

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

Object.assign(window, {
  ProfileBinder, PlanetPrmBinder, FlatSettingsBinder, pfBind,
});
