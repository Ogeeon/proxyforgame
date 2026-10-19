// ============================================================================
// QUEUE CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the queue calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into the form and writes the changes back:
//   - apply(): profile -> form (ion and hyperspace technology, class, the
//     cargo bonuses of the transports) and, per tab, one planet or moon of the
//     profile: its fields, and its building levels filled in as the start
//     levels;
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a profile
//     with no class shows as collector here) never becomes an override.
// The start levels are filled in for convenience only: they are not bound, so
// an edit there is not written back to the profile - it plans a queue, it does
// not say what the game has. A tab whose kind of body the profile does not
// have (a profile with no moon) stays the calculator's own. The queues and
// their start times are working
// state and keep going to options_queue; the profile-owned keys are written
// there with the values they had before the profile, so "no profile" shows
// them untouched. The economy speed comes from the profile's universe.

'use strict';

/**
 * @typedef {Object} QueueTab
 * @property {number} tab PLANET_TAB or MOON_TAB.
 * @property {'planets'|'moons'} bodies Where the profile keeps this kind of body.
 * @property {string} levels options.prm key of the start levels.
 * @property {string} fields options.prm key of the total fields.
 * @property {() => number} defaultFields
 * @property {string} lastKey Calculator name under which the last choice is remembered.
 */

/** @type {ProfilePrmField[]} */
const QUEUE_ACCOUNT_FIELDS = [
  pfLevelField('research.121', 'ionTechLevel', '#ion-tech-level'),
  pfLevelField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  {
    // The queue has no "no class": a profile without one shows as collector.
    key: 'class', prm: 'playerClass', input: '#player-class-0',
    get: (p) => pfNum(p.playerClass) + 1,
    show: (v) => setChecked('#player-class-' + Math.min(2, Math.max(0, pfNum(v) - 1)), true),
    display: (v) => pfLabelFor('player-class-' + (pfNum(v) - 1)),
  },
  pfPercentField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  pfPercentField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
];

/** @type {QueueTab[]} */
const QUEUE_TABS = [
  { tab: PLANET_TAB, bodies: 'planets', levels: 'slp', fields: 'totFldPln', defaultFields: () => options.defPlfFlds, lastKey: 'queue' },
  { tab: MOON_TAB, bodies: 'moons', levels: 'slm', fields: 'totFldMn', defaultFields: () => options.defMnFlds, lastKey: 'queue-moon' },
];

/** @extends {ProfileBinder<QueueCalculatorApp>} */
class QueueProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {QueueCalculatorApp} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** @type {Record<number, ?string>} Per tab, the profile body it shows; null leaves the tab to the calculator. */
    this.bodyIds = { [PLANET_TAB]: null, [MOON_TAB]: null };
    /** @type {Record<number, PfBodySelect>} Per tab, the select that picks its body. */
    this.bodySelects = {};
    QUEUE_TABS.forEach((t) => {
      this.bodySelects[t.tab] = new PfBodySelect(pf, {
        select: '#pf-body-' + t.tab, box: '#pf-body-box-' + t.tab, bodies: (p) => p[t.bodies], lastKey: t.lastKey,
        // A moon not picked yet is the one of the planet shown.
        fallback: t.tab === MOON_TAB
          ? (p) => p.moons.find((m) => this.bodyIds[PLANET_TAB] !== null && m.planetId === this.bodyIds[PLANET_TAB])
          : undefined,
      });
    });
    /** @type {Record<number, number>} Per tab, the body's fields at the last apply or sync. */
    this.bodySnapshot = {};
    /** @type {Record<string, *>} The profile-owned prm keys as the calculator has them. */
    this.ownPrm = {};
    this.ownSave = options.save;
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  init() {
    this.describeFields();
    options.save = () => this.save();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.refreshBoth());
    QUEUE_TABS.forEach((t) => this.bodySelects[t.tab].onChange(() => this.bodyChosen(t)));
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
  }

  /** The options.prm keys the profile may own, the start levels it fills in included. */
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
        this.bodyIds[t.tab] = this.bodySelects[t.tab].render(profile, this.bodyIds[t.tab]);
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
   * Show a tab's body in the form: its fields, and its building levels as the
   * start levels. A tab with no body shows the calculator's own values.
   *
   * @param {QueueTab} t
   * @param {Profile} profile
   */
  showBody(t, profile) {
    const body = this.body(t, profile);
    const levels = QueueDataCollector.readStartLevels(t.tab).list;
    if (body) {
      levels.forEach(([techId]) => setVal('#startlvl-' + t.tab + '-' + techId, pfNum(getProfileValue(body, 'building.' + techId, 0))));
      setVal('#total-fields-' + t.tab, pfNum(getProfileValue(body, 'fields.total', t.defaultFields())) || t.defaultFields());
      return;
    }
    /** @type {Record<string, number>} */
    const own = {};
    (Array.isArray(this.ownPrm[t.levels]) ? this.ownPrm[t.levels] : []).forEach((/** @type {number[]} */ [techId, level]) => { own[techId] = level; });
    levels.forEach(([techId]) => setVal('#startlvl-' + t.tab + '-' + techId, pfNum(own[techId])));
    setVal('#total-fields-' + t.tab, pfNum(this.ownPrm[t.fields]) || t.defaultFields());
  }

  restoreOwn() {
    this.bodyIds = { [PLANET_TAB]: null, [MOON_TAB]: null };
    this.speed?.detach();
    QUEUE_TABS.forEach((t) => this.bodySelects[t.tab].hide());
    const prm = options.prm;
    Object.assign(prm, cloneData(this.ownPrm));
    QUEUE_ACCOUNT_FIELDS.forEach((f) => f.show(f.get(prm)));
    QUEUE_TABS.forEach((t) => {
      const levels = Array.isArray(prm[t.levels]) ? prm[t.levels] : [];
      levels.forEach((/** @type {number[]} */ [techId, level]) => setVal('#startlvl-' + t.tab + '-' + techId, level));
      setVal('#total-fields-' + t.tab, prm[t.fields]);
    });
  }

  recalc() {
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
    this.bodySnapshot[t.tab] = pfNum(options.prm[t.fields]);
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
    const prm = options.prm;
    let changed = false;
    QUEUE_ACCOUNT_FIELDS.forEach((f) => {
      changed = this.syncValue(profile.account, f.key, f.key, f.get(prm)) || changed;
    });
    QUEUE_TABS.forEach((t) => {
      const body = this.body(t, profile);
      const before = this.bodySnapshot[t.tab];
      if (!body || before === undefined) return;
      if (pfNum(prm[t.fields]) !== before) changed = setProfileValue(body, 'fields.total', pfNum(prm[t.fields])) || changed;
      this.takeBodySnapshot(t);
    });
    if (changed) {
      this.pf.save(profile);
      this.markAll();
    }
  }

  /**
   * options_queue gets the calculator's own fields as they are, and the
   * profile-owned ones and the start levels as they were before the profile,
   * so a level filled in from a body never replaces the player's. A tab with no body
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
    const id = this.bodySelects[t.tab].chosen(profile);
    this.bodyIds[t.tab] = id;
    /** @type {QueueTab[]} */
    const shown = [t];
    const moonTab = QUEUE_TABS[1];
    const moon = t.tab === PLANET_TAB ? profile.moons.find((m) => m.planetId === id) : undefined;
    if (moon && moon.id !== this.bodyIds[MOON_TAB]) {
      this.bodyIds[MOON_TAB] = moon.id;
      this.bodySelects[MOON_TAB].choose(profile, moon.id);
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
    this.describeFieldList(QUEUE_ACCOUNT_FIELDS);
    this.pf.describeField('fields.total', pfFieldLabel($('#total-fields-' + PLANET_TAB)));
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    QUEUE_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.speed?.mark();
    QUEUE_TABS.forEach((t) => {
      const body = this.body(t, profile);
      if (!body) return;
      this.pf.markField($('#total-fields-' + t.tab), profile, body, 'fields.total', this.restoreBody(t.bodies, body.id, 'fields.total'));
    });
  }
}

/**
 * Connect the queue to the profiles, when the page has the selector.
 *
 * @returns {?QueueProfiles}
 */
function initQueueProfiles() {
  queueProfiles = pfBind(QueueProfiles, queueApp);
  return queueProfiles;
}

/** @type {?QueueProfiles} Set once the page is wired. */
let queueProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initQueueProfiles = initQueueProfiles;
}
