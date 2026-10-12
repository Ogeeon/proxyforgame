// ============================================================================
// QUEUE CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the queue calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into the form and writes the changes back:
//   - apply(): profile -> form (ion and hyperspace technology, class, the
//     cargo bonuses of the transports) and, per tab, one planet or moon of the
//     profile: its building levels as the start levels and its fields;
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// A tab whose kind of body the profile does not have (a profile with no moon)
// stays the calculator's own. The queues and their start times are working
// state and keep going to options_queue; the profile-owned keys are written
// there with the values they had before the profile, so "no profile" shows
// them untouched. The economy speed comes from the profile's universe.

'use strict';

/**
 * @typedef {Object} QueueAccountField
 * @property {string} key Profile value key.
 * @property {string} prm Key in options.prm.
 * @property {string} input Selector of the field that shows it.
 * @property {(prm: Record<string, any>) => *} get The profile value the prm holds.
 * @property {(value: *) => void} show Put a profile value (or undefined) into the form.
 * @property {(value: *) => string} [display] The game value as shown in the mark.
 */

/**
 * @typedef {Object} QueueTab
 * @property {number} tab PLANET_TAB or MOON_TAB.
 * @property {'planets'|'moons'} bodies Where the profile keeps this kind of body.
 * @property {string} levels options.prm key of the start levels.
 * @property {string} fields options.prm key of the total fields.
 * @property {() => number} defaultFields
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 */

const queueNum = (/** @type {*} */ v) => Number(v) || 0;

/**
 * The text of the label for an id, or a dash.
 *
 * @param {string} id
 */
function queueLabelText(id) {
  const label = document.querySelector('label[for="' + id + '"]');
  return label ? (label.textContent || '').trim() : '—';
}

/** @type {QueueAccountField[]} */
const QUEUE_ACCOUNT_FIELDS = [
  ...[['research.121', 'ionTechLevel', '#ion-tech-level'], ['research.114', 'hyperTechLevel', '#hyper-tech-level']]
    .map(([key, prm, input]) => ({
      key, prm, input,
      get: (/** @type {Record<string, any>} */ p) => queueNum(p[prm]),
      show: (/** @type {*} */ v) => setVal(input, queueNum(v)),
    })),
  {
    // The queue has no "no class": a profile without one shows as collector.
    key: 'class', prm: 'playerClass', input: '#player-class-0',
    get: (p) => queueNum(p.playerClass) + 1,
    show: (v) => setChecked('#player-class-' + Math.min(2, Math.max(0, queueNum(v) - 1)), true),
    display: (v) => queueLabelText('player-class-' + (queueNum(v) - 1)),
  },
  ...[['lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'], ['lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase']]
    .map(([key, prm, input]) => ({
      key, prm, input,
      get: (/** @type {Record<string, any>} */ p) => queueNum(p[prm]),
      show: (/** @type {*} */ v) => setNumVal(input, queueNum(v)),
    })),
];

/** @type {QueueTab[]} */
const QUEUE_TABS = [
  { tab: PLANET_TAB, bodies: 'planets', levels: 'slp', fields: 'totFldPln', defaultFields: () => options.defPlfFlds, lastKey: 'queue' },
  { tab: MOON_TAB, bodies: 'moons', levels: 'slm', fields: 'totFldMn', defaultFields: () => options.defMnFlds, lastKey: 'queue-moon' },
];

/**
 * A body's label in the select: its name and, when known, its coordinates.
 *
 * @param {ProfilePlanet} body
 */
function queueBodyLabel(body) {
  const c = body.coords;
  const where = c && c.galaxy !== null && c.system !== null ? ' [' + c.galaxy + ':' + c.system + ':' + c.position + ']' : '';
  return (body.name || '—') + where;
}

class QueueProfiles {
  /**
   * @param {ProfilesUi} pf
   * @param {QueueCalculatorApp} app
   */
  constructor(pf, app) {
    this.pf = pf;
    this.app = app;
    /** @type {?string} The active profile's id while one is applied. */
    this.profileId = null;
    /** @type {Record<number, ?string>} Per tab, the profile body it shows; null leaves the tab to the calculator. */
    this.bodyIds = { [PLANET_TAB]: null, [MOON_TAB]: null };
    /** @type {Record<string, *>} Account values (by profile key) at the last apply or sync. */
    this.snapshot = {};
    /** @type {Record<number, {levels: Record<string, number>, fields: number}>} Per tab, the body values at the last apply or sync. */
    this.bodySnapshot = {};
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
    this.applying = false;
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.refreshBoth());
    QUEUE_TABS.forEach((t) => addEvent('#pf-body-' + t.tab, 'change', () => this.bodyChosen(t)));
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
  }

  /** @returns {?Profile} */
  profile() {
    return this.profileId ? this.pf.store.get(this.profileId) : null;
  }

  /** The options.prm keys the profile may own. */
  static ownedKeys() {
    return [...QUEUE_ACCOUNT_FIELDS.map((f) => f.prm), ...QUEUE_TABS.flatMap((t) => [t.levels, t.fields])];
  }

  /**
   * @param {QueueTab} t
   * @param {?Profile} profile
   * @returns {?ProfilePlanet}
   */
  body(t, profile) {
    const id = this.bodyIds[t.tab];
    return profile && id ? profile[t.bodies].find((b) => b.id === id) || null : null;
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {?Profile} profile */
  apply(profile) {
    if (!profile) {
      this.leave();
      return;
    }
    this.applying = true;
    try {
      if (this.profileId === null) {
        this.ownPrm = {};
        QueueProfiles.ownedKeys().forEach((key) => { this.ownPrm[key] = cloneData(options.prm[key]); });
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      QUEUE_ACCOUNT_FIELDS.forEach((f) => f.show(getProfileValue(profile.account, f.key)));
      // The queue's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      QUEUE_TABS.forEach((t) => {
        this.renderBodySelect(t, profile);
        this.showBody(t, profile);
      });
      this.app.refreshBoth();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    void this.speed?.attach(profile);
    this.markAll();
  }

  /**
   * Fill a tab's body select and choose the body: the one picked last time in
   * this profile, else - on the moon tab - the moon of the planet shown, else
   * the first one.
   *
   * @param {QueueTab} t
   * @param {Profile} profile
   */
  renderBodySelect(t, profile) {
    const bodies = profile[t.bodies];
    const select = selectEl('#pf-body-' + t.tab);
    if (select) {
      select.innerHTML = '';
      bodies.forEach((b) => select.appendChild(new Option(queueBodyLabel(b), b.id)));
    }
    pfShow('#pf-body-box-' + t.tab, bodies.length > 0);
    const last = this.pf.store.getLastPlanet(t.lastKey, profile.id);
    const current = this.bodyIds[t.tab];
    const planetId = this.bodyIds[PLANET_TAB];
    const chosen = bodies.find((b) => b.id === current)
      || bodies.find((b) => b.id === last)
      || (t.tab === MOON_TAB ? profile.moons.find((m) => planetId !== null && m.planetId === planetId) : undefined)
      || bodies[0];
    this.bodyIds[t.tab] = chosen ? chosen.id : null;
    if (select) select.value = this.bodyIds[t.tab] || '';
  }

  /**
   * Show a tab's body in the form: its building levels and fields. A tab with
   * no body shows the calculator's own values.
   *
   * @param {QueueTab} t
   * @param {Profile} profile
   */
  showBody(t, profile) {
    const body = this.body(t, profile);
    const levels = QueueDataCollector.readStartLevels(t.tab).list;
    if (body) {
      levels.forEach(([techId]) => setVal('#startlvl-' + t.tab + '-' + techId, queueNum(getProfileValue(body, 'building.' + techId, 0))));
      setVal('#total-fields-' + t.tab, queueNum(getProfileValue(body, 'fields.total', t.defaultFields())) || t.defaultFields());
      return;
    }
    /** @type {Record<string, number>} */
    const own = {};
    (Array.isArray(this.ownPrm[t.levels]) ? this.ownPrm[t.levels] : []).forEach((/** @type {number[]} */ [techId, level]) => { own[techId] = level; });
    levels.forEach(([techId]) => setVal('#startlvl-' + t.tab + '-' + techId, queueNum(own[techId])));
    setVal('#total-fields-' + t.tab, queueNum(this.ownPrm[t.fields]) || t.defaultFields());
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.profileId = null;
    this.bodyIds = { [PLANET_TAB]: null, [MOON_TAB]: null };
    this.pf.clearMarks();
    this.speed?.detach();
    pfShow('#reset', true);
    QUEUE_TABS.forEach((t) => pfShow('#pf-body-box-' + t.tab, false));
    const prm = options.prm;
    Object.assign(prm, cloneData(this.ownPrm));
    setVal('#ion-tech-level', prm.ionTechLevel);
    setVal('#hyper-tech-level', prm.hyperTechLevel);
    setChecked('#player-class-' + prm.playerClass, true);
    setNumVal('#sc-capacity-increase', prm.scCapacityIncrease);
    setNumVal('#lc-capacity-increase', prm.lcCapacityIncrease);
    QUEUE_TABS.forEach((t) => {
      const levels = Array.isArray(prm[t.levels]) ? prm[t.levels] : [];
      levels.forEach((/** @type {number[]} */ [techId, level]) => setVal('#startlvl-' + t.tab + '-' + techId, level));
      setVal('#total-fields-' + t.tab, prm[t.fields]);
    });
    this.app.refreshBoth();
  }

  takeSnapshot() {
    const prm = options.prm;
    this.snapshot = {};
    QUEUE_ACCOUNT_FIELDS.forEach((f) => { this.snapshot[f.key] = f.get(prm); });
    QUEUE_TABS.forEach((t) => this.takeBodySnapshot(t));
  }

  /** @param {QueueTab} t */
  takeBodySnapshot(t) {
    const prm = options.prm;
    /** @type {Record<string, number>} */
    const levels = {};
    (Array.isArray(prm[t.levels]) ? prm[t.levels] : []).forEach((/** @type {number[]} */ [techId, level]) => { levels[techId] = level; });
    this.bodySnapshot[t.tab] = { levels, fields: queueNum(prm[t.fields]) };
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  save() {
    if (this.profileId === null) {
      this.ownSave();
      return;
    }
    if (this.applying) return;
    this.sync();
    this.saveOwn();
  }

  /** Write what changed since the last snapshot into the profile. */
  sync() {
    const profile = this.profile();
    if (!profile) return;
    const prm = options.prm;
    let changed = false;
    QUEUE_ACCOUNT_FIELDS.forEach((f) => {
      const value = f.get(prm);
      if (!sameValue(value, this.snapshot[f.key])) {
        changed = setProfileValue(profile.account, f.key, value) || changed;
        this.snapshot[f.key] = value;
      }
    });
    QUEUE_TABS.forEach((t) => {
      const body = this.body(t, profile);
      const before = this.bodySnapshot[t.tab];
      if (!body || !before) return;
      (Array.isArray(prm[t.levels]) ? prm[t.levels] : []).forEach((/** @type {number[]} */ [techId, level]) => {
        if (level !== before.levels[techId]) changed = setProfileValue(body, 'building.' + techId, level) || changed;
      });
      if (queueNum(prm[t.fields]) !== before.fields) changed = setProfileValue(body, 'fields.total', queueNum(prm[t.fields])) || changed;
      this.takeBodySnapshot(t);
    });
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_queue gets the calculator's own fields as they are, and the
   * profile-owned ones as they were before the profile. A tab with no body
   * is the calculator's own, so its values are taken as they are.
   */
  saveOwn() {
    const prm = options.prm;
    QUEUE_TABS.forEach((t) => {
      if (this.bodyIds[t.tab] !== null) return;
      this.ownPrm[t.levels] = cloneData(prm[t.levels]);
      this.ownPrm[t.fields] = prm[t.fields];
    });
    saveToCookie('options_queue', { ...prm, ...cloneData(this.ownPrm) });
  }

  /**
   * The player picked another planet or moon. Choosing a planet also shows
   * its moon, when it has one.
   *
   * @param {QueueTab} t
   */
  bodyChosen(t) {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the body shown so far is saved first.
    this.save();
    const id = getVal('#pf-body-' + t.tab) || null;
    this.bodyIds[t.tab] = id;
    if (id) this.pf.store.setLastPlanet(t.lastKey, profile.id, id);
    /** @type {QueueTab[]} */
    const shown = [t];
    const moonTab = QUEUE_TABS[1];
    const moon = t.tab === PLANET_TAB ? profile.moons.find((m) => m.planetId === id) : undefined;
    if (moon && moon.id !== this.bodyIds[MOON_TAB]) {
      this.bodyIds[MOON_TAB] = moon.id;
      setVal('#pf-body-' + MOON_TAB, moon.id);
      this.pf.store.setLastPlanet(moonTab.lastKey, profile.id, moon.id);
      shown.push(moonTab);
    }
    this.applying = true;
    try {
      shown.forEach((s) => this.showBody(s, profile));
      this.app.refreshBoth();
      shown.forEach((s) => this.takeBodySnapshot(s));
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    QUEUE_ACCOUNT_FIELDS.forEach((f) => this.pf.describeField(f.key, pfFieldLabel($(f.input)), f.display));
    QUEUE_TABS.forEach((t) => {
      Object.entries(QueueDataCollector.readTechNames(t.tab)).forEach(([techId, name]) => this.pf.describeField('building.' + techId, name));
    });
    this.pf.describeField('fields.total', pfFieldLabel($('#total-fields-' + PLANET_TAB)));
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    /**
     * Restore one game value on a fresh copy of the profile: the one marked
     * may be stale by the time the button is clicked.
     *
     * @param {?{t: QueueTab, id: string}} where Null for the account.
     * @param {string} key
     */
    const restoreTo = (where, key) => () => {
      const fresh = this.pf.store.get(profile.id);
      if (!fresh) return;
      const target = where ? fresh[where.t.bodies].find((b) => b.id === where.id) : fresh.account;
      if (target && resetProfileValue(target, key)) this.pf.store.save(fresh);
    };
    QUEUE_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, restoreTo(null, f.key));
    });
    this.speed?.mark();
    QUEUE_TABS.forEach((t) => {
      const body = this.body(t, profile);
      if (!body) return;
      const where = { t, id: body.id };
      QueueDataCollector.readStartLevels(t.tab).list.forEach(([techId]) => {
        const key = 'building.' + techId;
        this.pf.markField($('#startlvl-' + t.tab + '-' + techId), profile, body, key, restoreTo(where, key));
      });
      this.pf.markField($('#total-fields-' + t.tab), profile, body, 'fields.total', restoreTo(where, 'fields.total'));
    });
  }
}

/**
 * Connect the queue to the profiles, when the page has the selector.
 *
 * @returns {?QueueProfiles}
 */
function initQueueProfiles() {
  if (!pfgProfiles || !queueApp) return null;
  queueProfiles = new QueueProfiles(pfgProfiles, queueApp);
  queueProfiles.init();
  return queueProfiles;
}

/** @type {?QueueProfiles} Set once the page is wired. */
let queueProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initQueueProfiles = initQueueProfiles;
}
