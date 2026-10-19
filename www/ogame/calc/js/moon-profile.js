// ============================================================================
// MOON CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the moon calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> form - the account (hyperspace technology, the
//     character class, the life-form bonuses to the recycler's cargo, to the
//     phalanx range and of the discoverer class), one planet of the profile,
//     picked in #pf-planet (its Supra Refractor) and one moon, picked in
//     #pf-moon (its sensor phalanx);
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync, so a lossy mapping (a
//     collector shows as neither class here) never becomes an override.
// The class is two checkboxes for one profile value, so it is handled here
// rather than by the field list of the base binder.
// A profile with no planet or no moon leaves their fields to the calculator.
// The moon's system is put into "your system" for convenience only: it is not
// bound, so an edit there is not written back to the profile.
// The size of the moon to destroy, the Deathstar count, the promotional moon,
// the target system and every unit count are the calculator's own and keep
// going to options_moon; the profile-owned keys are written there with the
// values they had before the profile, so "no profile" shows them untouched.
// The shares of a fleet and of defenses that go to the debris field, whether
// deuterium goes there too, the number of systems and whether they form a ring
// come from the profile's universe; a profile with no universe leaves them to
// the calculator.

'use strict';

/** @type {ProfilePrmField[]} */
const MOON_ACCOUNT_FIELDS = [
  pfConvNumField('research.114', 'hyperTechLevel', '#hypertech-lvl'),
  pfConvNumField('lf.ship.209.cargo', 'rcCapacityIncrease', '#rc-capacity-increase'),
  // The Interplanetary Analysis Network.
  pfConvNumField('lf.phalanxRange', 'phalanxRangeBonus', '#phalanx-range-bonus'),
  pfConvNumField('lf.classBooster.3', 'discovererBonus', '#discoverer-bonus'),
];

/** The fields of the planet picked in #pf-planet. */
const MOON_PLANET_FIELDS = [
  // A Kaelesh building: a planet of another life form has none.
  pfConvNumField('lf.building.' + lfBuildingGameId(4, 12), 'supraRefractorLevel', '#supra-refractor'),
];

/** The fields of the moon picked in #pf-moon. */
const MOON_MOON_FIELDS = [
  // The field takes no level below 1, so a moon with no phalanx shows 1.
  pfConvNumField('building.42', 'phalanxLevel', '#phalanx-lvl', 1, 1),
];

/** @type {PfUniverseField[]} The settings that come from the profile's universe. */
const MOON_UNIVERSE_FIELDS = [
  { kind: PF_UNIVERSE_DEBRIS, input: '#debris-percent', prm: 'debrisPercent' },
  { kind: PF_UNIVERSE_DEUT_IN_DEBRIS, input: '#deut-to-debris', prm: 'deutToDebris' },
  { kind: PF_UNIVERSE_DEF_DEBRIS, input: '#defense-debris-percent', prm: 'defenseDebrisPercent' },
  { kind: PF_UNIVERSE_SYSTEMS, input: '#systems-num', prm: 'numberOfSystems' },
  { kind: PF_UNIVERSE_DONUT_SYSTEM, input: '#circular-systems', prm: 'circularSystems' },
];

/** The class checkboxes: the calculator knows the general and the discoverer, any other class is neither. */
const MOON_CLASS_CHECKBOXES = [
  { selector: '#general-class', cls: PROFILE_CLASS.GENERAL },
  { selector: '#discoverer-class', cls: PROFILE_CLASS.DISCOVERER },
];

/**
 * The two class checkboxes of a profile's class.
 *
 * @param {*} v A profile class.
 * @returns {{isGeneral: boolean, isDiscoverer: boolean}}
 */
function moonClassToPrm(v) {
  const cls = pfNum(v);
  return { isGeneral: cls === PROFILE_CLASS.GENERAL, isDiscoverer: cls === PROFILE_CLASS.DISCOVERER };
}

/**
 * The profile's class for the two checkboxes. A class the checkboxes cannot
 * show (a collector, none) stays what the profile had; both ticked means the
 * one ticked last, which is the one the profile did not have.
 *
 * @param {Record<string, any>} prm
 * @param {*} previous The profile's class at the last apply or sync.
 * @returns {number}
 */
function moonClassFromPrm(prm, previous) {
  const general = pfBool(prm.isGeneral);
  const discoverer = pfBool(prm.isDiscoverer);
  if (general && discoverer) return previous === PROFILE_CLASS.GENERAL ? PROFILE_CLASS.DISCOVERER : PROFILE_CLASS.GENERAL;
  if (general) return PROFILE_CLASS.GENERAL;
  if (discoverer) return PROFILE_CLASS.DISCOVERER;
  const cls = pfNum(previous);
  return cls === PROFILE_CLASS.GENERAL || cls === PROFILE_CLASS.DISCOVERER ? PROFILE_CLASS.NONE : cls;
}

/** @extends {PlanetPrmBinder<MoonApp>} */
class MoonProfiles extends PlanetPrmBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {MoonApp} app
   */
  constructor(pf, app) {
    super(pf, app, {
      accountFields: MOON_ACCOUNT_FIELDS,
      planetFields: MOON_PLANET_FIELDS,
      cookie: 'options_moon',
      lastKey: 'moon',
      universe: MOON_UNIVERSE_FIELDS,
      // The class is two checkboxes, the phalanx level is the moon's, and "your system" is filled in from the moon.
      extraOwnedKeys: ['isGeneral', 'isDiscoverer', 'phalanxLevel', 'ownSystem'],
    });
    /** @type {?string} The moon shown; null leaves its fields to the calculator. */
    this.moonId = null;
    // A moon not picked yet is the one of the planet shown.
    this.moonSelect = new PfBodySelect(pf, {
      select: '#pf-moon', box: '#pf-moon-box', bodies: (p) => p.moons, lastKey: 'moon-moon',
      planetOf: () => this.planetId,
    });
  }

  init() {
    // Both checkboxes read "Class: <name>"; the class itself is named by what comes before the colon.
    const classLabel = pfLabelFor('general-class').split(':')[0].trim();
    this.pf.describeField('class', classLabel, (v) => {
      const cls = pfNum(v);
      if (cls === PROFILE_CLASS.GENERAL) return pfLabelFor('general-class');
      return cls === PROFILE_CLASS.DISCOVERER ? pfLabelFor('discoverer-class') : '—';
    });
    this.describeFieldList(MOON_MOON_FIELDS);
    this.moonSelect.onChange(() => this.moonChosen());
    // A character has one class: ticking one box clears the other while a profile is active.
    MOON_CLASS_CHECKBOXES.forEach(({ selector }, i) => {
      addEvent(selector, 'change', () => this.classTicked(selector, MOON_CLASS_CHECKBOXES[1 - i].selector));
    });
    super.init();
  }

  /**
   * @param {?Profile} profile
   * @returns {?ProfileMoon}
   */
  moon(profile) {
    return profile?.moons.find((m) => m.id === this.moonId) || null;
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {?Profile} profile */
  apply(profile) {
    super.apply(profile);
    // The resets of the two blocks the profile fills would write their defaults into it as edits.
    if (profile) {
      pfShow('#reset-cr', false);
      pfShow('#reset-ph', false);
    }
  }

  /**
   * The class, the moon's phalanx and the system it stands in, in options.prm
   * before the form is shown; the moon select is drawn first, as the planet
   * is known by now.
   */
  afterShowPlanet() {
    const profile = this.profile();
    if (!profile) return;
    this.moonId = this.moonSelect.render(profile, this.moonId);
    /** @type {Record<string, any>} */
    const prm = options.prm;
    Object.assign(prm, moonClassToPrm(getProfileValue(profile.account, 'class', 0)));
    const moon = this.moon(profile);
    MOON_MOON_FIELDS.forEach((f) => {
      if (moon) f.write(prm, getProfileValue(moon, f.key));
      else prm[f.prm] = cloneData(this.ownPrm[f.prm]);
    });
    prm.ownSystem = moon?.coords?.system || cloneData(this.ownPrm.ownSystem);
  }

  restoreOwn() {
    this.moonId = null;
    this.moonSelect.hide();
    pfShow('#reset-cr', true);
    pfShow('#reset-ph', true);
    super.restoreOwn();
  }

  takeSnapshot() {
    super.takeSnapshot();
    const profile = this.profile();
    /** @type {Record<string, any>} */
    const prm = options.prm;
    this.snapshot.class = profile ? pfNum(getProfileValue(profile.account, 'class', 0)) : PROFILE_CLASS.NONE;
    MOON_MOON_FIELDS.forEach((f) => { this.snapshot['moon:' + f.key] = f.read(prm); });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  /**
   * The class and the moon's fields, into the profile the base is syncing.
   *
   * @param {Profile} profile
   * @returns {boolean} True when the profile changed.
   */
  syncExtra(profile) {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const moon = this.moon(profile);
    let changed = this.syncValue(profile.account, 'class', 'class', moonClassFromPrm(prm, this.snapshot.class));
    if (moon) {
      MOON_MOON_FIELDS.forEach((f) => {
        changed = this.syncValue(moon, f.key, 'moon:' + f.key, f.read(prm)) || changed;
      });
    }
    return changed;
  }

  /**
   * The phalanx level and "your system" are the calculator's own while the
   * profile has no moon to fill them in from.
   */
  afterSaveOwn() {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const moon = this.moon(this.profile());
    if (!moon) this.ownPrm.phalanxLevel = prm.phalanxLevel;
    if (!moon?.coords?.system) this.ownPrm.ownSystem = prm.ownSystem;
  }

  /**
   * The player ticked a class: the other box is cleared. The first recalculation
   * has seen both, which the class conversion resolves; this one writes the pair.
   *
   * @param {string} ticked
   * @param {string} other
   */
  classTicked(ticked, other) {
    if (!this.profile() || !getChecked(ticked) || !getChecked(other)) return;
    setChecked(other, false);
    this.app.recalc();
  }

  /** The player picked another planet; its moon is shown with it, when it has one. */
  planetChosen() {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the planet shown so far is saved first.
    this.save();
    this.planetId = this.planetSelect.chosen(profile);
    this.moonId = this.moonSelect.follow(profile) ?? this.moonId;
    this.show(profile);
  }

  /** The player picked another moon. */
  moonChosen() {
    const profile = this.profile();
    if (!profile) return;
    this.save();
    this.moonId = this.moonSelect.chosen(profile);
    this.show(profile);
  }

  /** @param {Profile} profile */
  show(profile) {
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
    super.markAll();
    const profile = this.profile();
    if (!profile) return;
    this.markClass(profile);
    const moon = this.moon(profile);
    if (!moon) return;
    MOON_MOON_FIELDS.forEach((f) => {
      this.pf.markField(pfFieldInput(f), profile, moon, f.key, this.restoreBody('moons', moon.id, f.key));
    });
  }

  /**
   * Both boxes stand for the one class and both are bound, but each is marked
   * as differing only when its own tick differs from the game's class - a
   * discoverer unticked marks the discoverer box, not the general one - and its
   * "in game" shows that box's tick. Either restore button brings the class back.
   *
   * @param {Profile} profile
   */
  markClass(profile) {
    const v = profile.account.values.class;
    const fromGame = hasGameLayer(profile) && !!v && 'game' in v;
    const game = fromGame ? pfNum(v.game) : null;
    const current = pfNum(getProfileValue(profile.account, 'class', 0));
    MOON_CLASS_CHECKBOXES.forEach(({ selector, cls }) => {
      const inGame = game === cls;
      const differs = fromGame && inGame !== (current === cls);
      this.pf.markInput($(selector), fromGame, differs ? pfDisplayValue(inGame) : null, this.restoreAccount('class'));
    });
  }
}

/**
 * Connect the moon calculator to the profiles, when the page has the selector.
 *
 * @returns {?MoonProfiles}
 */
function initMoonProfiles() {
  moonProfiles = pfBind(MoonProfiles, moonApp);
  return moonProfiles;
}

/** @type {?MoonProfiles} Set once the page is wired. */
let moonProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initMoonProfiles = initMoonProfiles;
}
