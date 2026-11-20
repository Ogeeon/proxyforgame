// ============================================================================
// SCRAP MERCHANT CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the scrap merchant calculator to the active player profile
// (ADR-0004). Unlike the other calculators' binders it binds nothing: the
// profile owns no setting of this page, and nothing is written back to it.
// What it adds is a planet select (#pf-planet, planets only: storages are not
// built on a moon, so it is no place to sell for resources)
// and, beside every count field, how many of that unit the chosen planet has
// (`ship.<id>` / `defense.<id>`). A click on the number copies it into the
// field; the fields themselves stay the calculator's, so picking another
// planet or profile changes the numbers beside them and not what was typed.
//
// A planet decides per section whether it has numbers to show. With at least
// one `ship.*` (or `defense.*`) value, a unit it does not list stands at 0.
// With none at all - a planet entered by hand, never imported - that section's
// numbers are hidden rather than shown as zeros.

'use strict';

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

  bindControls() {
    this.planetSelect.onChange(() => this.planetChosen());
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /** @param {Profile} profile */
  showProfile(profile) {
    this.planetSelect.render(profile);
    this.showPlanetCounts(profile);
  }

  /**
   * The reset only clears the counts and the rate, none of which the profile
   * owns, so it stays while a profile is shown.
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

  restoreOwn() {
    this.planetSelect.hide();
    ScrapRenderer.renderPlanetCounts(null, null);
    super.restoreOwn();
  }

  recalc() {
    this.app.recalc();
  }

  // -------------------------------------------------------------------------
  // Calculator -> storage
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  /** @param {Record<string, any>} stored */
  storeOwn(stored) {
    saveToCookie('options_scrap', stored);
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
