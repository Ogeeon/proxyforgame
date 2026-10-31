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
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back, so a lossy mapping (a
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
 * @param {*} previous The profile's class at the last apply or write-back.
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
      // The class is two checkboxes, written by writeBackExtra() rather than by a field.
      accountAlsoOwns: ['isGeneral', 'isDiscoverer'],
    });
    /** @type {?string} The moon shown; null leaves its fields to the calculator. */
    this.moonId = null;
    // A moon not picked yet is the one of the planet shown.
    this.moonSelect = new PfBodySelect(pf, {
      select: '#pf-moon', box: '#pf-moon-box', bodies: (p) => p.moons, lastKey: 'moon-moon',
      planetOf: () => this.planetId,
    });
  }

  /** @returns {PfFieldGroup[]} The account and the planet, and the moon picked in #pf-moon. */
  fieldGroups() {
    return [...super.fieldGroups(), { scope: 'moon', entity: (p) => this.moon(p), fields: MOON_MOON_FIELDS, settings: () => options.prm }];
  }

  /**
   * What the field groups own, and "your system", filled in from the moon,
   * while the moon's system is known.
   *
   * @param {?Profile} profile
   * @returns {PfOwnedGroup[]}
   */
  ownedGroups(profile) {
    return [...super.ownedGroups(profile), { keys: ['ownSystem'], present: !!this.moon(profile)?.coords?.system }];
  }

  init() {
    // Both checkboxes read "Class: <name>"; the class itself is named by what comes before the colon.
    const classLabel = pfLabelFor('general-class').split(':')[0].trim();
    this.pf.describeField('class', classLabel, (v) => {
      const cls = pfNum(v);
      if (cls === PROFILE_CLASS.GENERAL) return pfLabelFor('general-class');
      return cls === PROFILE_CLASS.DISCOVERER ? pfLabelFor('discoverer-class') : '—';
    });
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
    if (moon) MOON_MOON_FIELDS.forEach((f) => f.write(prm, getProfileValue(moon, f.key)));
    if (moon?.coords?.system) prm.ownSystem = moon.coords.system;
  }

  restoreOwn() {
    this.moonId = null;
    this.moonSelect.hide();
    pfShow('#reset-cr', true);
    pfShow('#reset-ph', true);
    super.restoreOwn();
  }

  /** The class too: what the checkboxes mean depends on the class remembered here. */
  takeSnapshot() {
    super.takeSnapshot();
    const profile = this.profile();
    this.snapshot.class = profile ? pfNum(getProfileValue(profile.account, 'class', 0)) : PROFILE_CLASS.NONE;
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  /**
   * The class, into the profile the base is writing back.
   *
   * @param {Profile} profile
   * @returns {boolean} True when the profile changed.
   */
  writeBackExtra(profile) {
    return this.writeBackValue(profile.account, 'class', 'class', moonClassFromPrm(options.prm, this.snapshot.class));
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

  /** @param {Profile} profile */
  markExtra(profile) {
    super.markExtra(profile);
    this.markClass(profile);
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
