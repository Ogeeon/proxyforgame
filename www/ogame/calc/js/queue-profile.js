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
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a profile
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
  // The queue has no "no class": a profile without one shows as collector.
  pfInForm(pfCollectorClassField('playerClass', 'player-class-'), (v) => setChecked('#player-class-' + v, true)),
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
        planetOf: t.tab === MOON_TAB ? () => this.bodyIds[PLANET_TAB] : undefined,
      });
    });
    this.ownSave = options.save;
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  bindControls() {
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => this.app.refreshBoth(), 'universeSpeed');
    this.universeSettings = [this.speed];
    QUEUE_TABS.forEach((t) => this.bodySelects[t.tab].onChange(() => this.bodyChosen(t)));
  }

  /** @returns {PfFieldGroup[]} The account, and the body of each tab. */
  fieldGroups() {
    return [
      { scope: '', entity: (p) => p.account, fields: QUEUE_ACCOUNT_FIELDS, settings: () => options.prm },
      ...QUEUE_TABS.map((t) => this.tabGroup(t)),
    ];
  }

  /**
   * The fields of a tab's body: its total fields, and the start levels filled
   * in from it - the profile owns both while it has that body; a tab with none
   * is the calculator's own. Both tabs show the same key, so only the planet's
   * names it.
   *
   * @param {QueueTab} t
   * @returns {PfFieldGroup}
   */
  tabGroup(t) {
    return {
      scope: t.bodies,
      entity: (p) => this.body(t, p),
      fields: [{ key: 'fields.total', input: '#total-fields-' + t.tab, owns: [t.fields], read: (prm) => pfNum(prm[t.fields]) }],
      settings: () => options.prm,
      describe: t.tab === PLANET_TAB,
      alsoOwns: [t.levels],
    };
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

  /** @param {Profile} profile */
  showProfile(profile) {
    QUEUE_ACCOUNT_FIELDS.forEach((f) => f.write(options.prm, getProfileValue(profile.account, f.key)));
    QUEUE_TABS.forEach((t) => {
      this.bodyIds[t.tab] = this.bodySelects[t.tab].render(profile, this.bodyIds[t.tab]);
      this.showBody(t, profile);
    });
    this.app.refreshBoth();
  }

  /** @param {Profile} profile */
  afterApply(profile) {
    void this.speed?.attach(profile);
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
    super.restoreOwn();
    const prm = options.prm;
    setVal('#universe-speed', prm.universeSpeed);
    QUEUE_ACCOUNT_FIELDS.forEach((f) => f.write(prm, f.read(prm)));
    QUEUE_TABS.forEach((t) => {
      const levels = Array.isArray(prm[t.levels]) ? prm[t.levels] : [];
      levels.forEach((/** @type {number[]} */ [techId, level]) => setVal('#startlvl-' + t.tab + '-' + techId, level));
      setVal('#total-fields-' + t.tab, prm[t.fields]);
    });
  }

  recalc() {
    this.app.refreshBoth();
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /**
   * options_queue gets the start levels as they were before the profile
   * (ownedGroups), so a level filled in from a body never replaces the player's.
   *
   * @param {Record<string, any>} stored
   */
  storeOwn(stored) {
    saveToCookie('options_queue', stored);
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
    const moon = t.tab === PLANET_TAB ? this.bodySelects[MOON_TAB].moonOfPlanet(profile) : undefined;
    if (moon && moon.id !== this.bodyIds[MOON_TAB]) {
      this.bodyIds[MOON_TAB] = moon.id;
      this.bodySelects[MOON_TAB].choose(profile, moon.id);
      shown.push(moonTab);
    }
    this.whileApplying(() => {
      shown.forEach((s) => this.showBody(s, profile));
      this.app.refreshBoth();
      this.snapshotGroups(shown.map((s) => this.tabGroup(s)));
    });
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** @param {Profile} _profile */
  markExtra(_profile) {
    this.speed?.mark();
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
