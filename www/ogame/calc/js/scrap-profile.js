// ============================================================================
// SCRAP MERCHANT CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the scrap merchant calculator to the active player profile
// (ADR-0004). Two things come from the profile:
//   - the cargo fields of the transport accordion, bound to the account as
//     the cost calculator binds them: hyperspace technology, the Collector
//     Enhancement and the cargo bonuses of the small and the large cargo -
//     and the class, which is one checkbox here (only the Collector raises
//     these holds), handled the way moon-profile.js handles its two class
//     boxes rather than by the field list. The profile fills them, an edit
//     there is written back to it (writeBack(), through options.save()), and
//     the values from before the profile stay in options_scrap, so "no
//     profile" shows them again. They are account values: the planet select
//     does not change them;
//   - a planet select (#pf-planet, planets only: storages are not built on a
//     moon, so it is no place to sell for resources) and, beside every count
//     field, how many of that unit the chosen planet has (`ship.<id>` /
//     `defense.<id>`). A click on the number copies it into the field; the
//     count fields stay the calculator's, so picking another planet or
//     profile changes the numbers beside them and not what was typed.
//
// A planet decides per section whether it has numbers to show. With at least
// one `ship.*` (or `defense.*`) value, a unit it does not list stands at 0.
// With none at all - a planet entered by hand, never imported - that section's
// numbers are hidden rather than shown as zeros.

'use strict';

/**
 * The account fields the profile fills, under the keys and ids costs uses
 * (costs-profile.js). The calculator reads them back from the form, so they
 * write there; recalc() copies the form into options.prm, which they read.
 *
 * @type {ProfilePrmField[]}
 */
const SCRAP_ACCOUNT_FIELDS = [
  pfLevelField('research.114', 'hyperTechLevel', SCRAP_CARGO_FIELDS.hyperTechLevel),
  pfPercentField('lf.classBooster.1', 'collectorClassBonus', SCRAP_CARGO_FIELDS.collectorClassBonus),
  pfPercentField('lf.ship.202.cargo', 'scCapacityIncrease', SCRAP_CARGO_FIELDS.scCapacityIncrease),
  pfPercentField('lf.ship.203.cargo', 'lcCapacityIncrease', SCRAP_CARGO_FIELDS.lcCapacityIncrease),
];

/**
 * The profile's class for the Collector box. Ticked is the Collector;
 * unticked takes a Collector to no class and leaves any other class as the
 * profile had it, as the box cannot show it.
 *
 * @param {Record<string, any>} prm
 * @param {*} previous The profile's class at the last apply or write-back.
 * @returns {number}
 */
function scrapClassFromPrm(prm, previous) {
  if (pfBool(prm.isCollector)) return PROFILE_CLASS.COLLECTOR;
  const cls = pfNum(previous);
  return cls === PROFILE_CLASS.COLLECTOR ? PROFILE_CLASS.NONE : cls;
}

/**
 * The counts a planet has of one section's units, or null when the planet
 * carries none of them at all.
 *
 * @param {?ProfilePlanet} planet
 * @param {'ship.'|'defense.'} prefix
 * @param {readonly number[]} ids
 * @returns {?Record<string, number>}
 */
function scrapPlanetCounts(planet, prefix, ids) {
  if (!planet || !ids.some((id) => planet.values[prefix + id] !== undefined)) return null;
  return Object.fromEntries(ids.map((id) => [id, pfNum(getProfileValue(planet, prefix + id, 0))]));
}

/** @extends {ProfileBinder<ScrapApp>} */
class ScrapProfiles extends ProfileBinder {
  /**
   * @param {ProfilesUi} pf
   * @param {ScrapApp} app
   */
  constructor(pf, app) {
    super(pf, app);
    /** The calculator's own save, before the binder took options.save over. */
    this.ownSave = options.save;
    this.planetSelect = new PfBodySelect(pf, {
      select: '#pf-planet', box: '#pf-planet-box', bodies: (p) => p.planets, lastKey: 'scrap',
    });
  }

  init() {
    // The box reads "Class: Collector"; the class itself is named by what comes before the colon.
    const boxId = SCRAP_COLLECTOR_BOX.slice(1);
    this.pf.describeField('class', pfLabelFor(boxId).split(':')[0].trim(),
      (v) => (pfNum(v) === PROFILE_CLASS.COLLECTOR ? pfLabelFor(boxId) : '—'));
    super.init();
  }

  bindControls() {
    this.planetSelect.onChange(() => this.planetChosen());
  }

  /**
   * @returns {PfFieldGroup[]} The account: the cargo fields, and the Collector
   *   box, which writeBackExtra() writes rather than a field.
   */
  fieldGroups() {
    return [{
      scope: '', entity: (p) => p.account, fields: SCRAP_ACCOUNT_FIELDS, settings: () => options.prm, alsoOwns: ['isCollector'],
    }];
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {Profile} profile */
  showProfile(profile) {
    SCRAP_ACCOUNT_FIELDS.forEach((f) => f.write(options.prm, getProfileValue(profile.account, f.key)));
    // A General or a Discoverer shows the box unticked, as does no class.
    setChecked(SCRAP_COLLECTOR_BOX, pfNum(getProfileValue(profile.account, 'class', 0)) === PROFILE_CLASS.COLLECTOR);
    this.app.cargoOwnedByProfile = true;
    this.planetSelect.render(profile);
    this.showPlanetCounts(profile);
    // Copies the fields into options.prm, which the snapshot is taken from.
    this.app.recalc();
  }

  /**
   * The reset clears the counts and the rate, which the profile does not
   * own - it leaves the cargo fields alone while a profile is shown
   * (ScrapApp.cargoOwnedByProfile) - so it stays.
   *
   * @param {Profile} _profile
   */
  afterApply(_profile) {
    pfShow('#reset', true);
  }

  /** @param {Profile} profile */
  showPlanetCounts(profile) {
    const planet = this.planetSelect.entity(profile);
    ScrapRenderer.renderPlanetCounts(
      scrapPlanetCounts(planet, 'ship.', SCRAP_FLEET_IDS),
      scrapPlanetCounts(planet, 'defense.', SCRAP_DEFENSE_IDS),
    );
  }

  /** The player picked another planet: only the numbers beside the fields change. */
  planetChosen() {
    this.bodyPicked(this.planetSelect, (profile) => this.showPlanetCounts(profile));
  }

  /** The cargo fields as they were before the profile; leave() recalculates after. */
  restoreOwn() {
    this.planetSelect.hide();
    ScrapRenderer.renderPlanetCounts(null, null);
    super.restoreOwn();
    this.app.cargoOwnedByProfile = false;
    this.app.restoreFromState();
  }

  recalc() {
    this.app.recalc();
  }

  /** The class too: what the box means depends on the class remembered here. */
  takeSnapshot() {
    super.takeSnapshot();
    const profile = this.profile();
    this.snapshot.class = profile ? pfNum(getProfileValue(profile.account, 'class', 0)) : PROFILE_CLASS.NONE;
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile and storage
  // -------------------------------------------------------------------------

  /**
   * The class, into the profile the base is writing back.
   *
   * @param {Profile} profile
   * @returns {boolean} True when the profile changed.
   */
  writeBackExtra(profile) {
    return this.writeBackValue(profile.account, 'class', 'class', scrapClassFromPrm(options.prm, this.snapshot.class));
  }

  saveWithoutProfile() {
    this.ownSave();
  }

  /** @param {Record<string, any>} stored */
  storeOwn(stored) {
    saveToCookie('options_scrap', stored);
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /**
   * The Collector box is bound to the class: marked as differing only when
   * its tick differs from whether the game's class is the Collector, its "in
   * game" showing that tick.
   *
   * @param {Profile} profile
   */
  markExtra(profile) {
    const v = profile.account.values.class;
    const fromGame = hasGameLayer(profile) && !!v && 'game' in v;
    const inGame = fromGame && pfNum(v.game) === PROFILE_CLASS.COLLECTOR;
    const current = pfNum(getProfileValue(profile.account, 'class', 0)) === PROFILE_CLASS.COLLECTOR;
    const differs = fromGame && inGame !== current;
    this.pf.markInput($(SCRAP_COLLECTOR_BOX), fromGame, differs ? pfDisplayValue(inGame) : null, this.restoreAccount('class'));
  }
}

/**
 * Connect the scrap merchant calculator to the profiles, when the page has the selector.
 *
 * @returns {?ScrapProfiles}
 */
function initScrapProfiles() {
  scrapProfiles = pfBind(ScrapProfiles, scrapApp);
  return scrapProfiles;
}

/** @type {?ScrapProfiles} Set once the page is wired. */
let scrapProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initScrapProfiles = initScrapProfiles;
}
