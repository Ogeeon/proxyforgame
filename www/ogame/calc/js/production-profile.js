// ============================================================================
// PRODUCTION CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the production calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> options.prm (account fields and the planet list);
//   - writeBack(): options.prm -> profile, called from options.save(), writing
//     only what changed since the last apply or write-back. Diffing against that snapshot,
//     not against the profile, keeps a lossy mapping (a profile with no class
//     shows as collector here) from turning into an override nobody made.
// With a profile active, the one-planet tab shows one of the profile's planets,
// picked in #pf-planet, and edits there go straight to that planet. The
// calculator fields (PRODUCTION_LOCAL_KEYS) keep going to options_production as
// they are; everything else in it - the account, the planets, the one-planet
// tab - is the profile's and is stored with the values it had before the
// profile, so "no profile" shows them untouched. The economy speed comes from
// the profile's universe; a profile with no universe leaves it to the calculator.

'use strict';

/**
 * The fields of options.prm that are the calculator's own (ADR-0004:
 * calculator fields). The economy speed is among them only while the profile
 * has no universe.
 */
const PRODUCTION_LOCAL_KEYS = ['universeSpeed', 'maxTempEntered', 'onePlnExtView', 'showAddInf', 'inclSats'];

/**
 * Where the calculator fields went while a profile was active, before they
 * were shared with "no profile": read once, then removed.
 */
const PRODUCTION_LEGACY_PROFILE_OPTIONS_KEY = 'options_production_profile';

/** @type {ProfilePrmField[]} */
const PRODUCTION_ACCOUNT_FIELDS = [
  pfConvNumField('research.113', 'energyTechLevel', '#energy-tech-level'),
  pfConvNumField('research.122', 'plasmaTechLevel', '#plasma-tech-level'),
  ...pfOfficerFields(['engineer', 'geologist', 'technocrat', 'admiral', 'commander']),
  pfCollectorClassField('playerClass', 'class-'),
  pfTraderField('isTrader', '#is-trader'),
  pfConvNumField('lf.prod.metal', 'lfMetProdBonus', '#lf-metal-prod-bonus'),
  pfConvNumField('lf.prod.crystal', 'lfCrysProdBonus', '#lf-crystal-prod-bonus'),
  pfConvNumField('lf.prod.deuterium', 'lfDeutProdBonus', '#lf-deut-prod-bonus'),
  pfConvNumField('lf.prod.energy', 'lfEnergyProdBonus', '#lf-energy-prod-bonus'),
  pfConvNumField('lf.classBooster.1', 'lfCollectorBonus', '#lf-collector-bonus'),
  pfConvNumField('lf.crawler', 'lfCrawlerBonus', '#lf-crawler-bonus'),
  pfConvNumField('lf.cost.122.cost', 'lfPlasmaCostReduction', '#lf-plasma-cost-reduction'),
  pfRatesField('rates', '#exchange-rates-m'),
];

/** Storage capacity levels of the one-planet tab, and the building each is. */
const PRODUCTION_STORAGE_FIELDS = [
  { prm: 'metStorageLvl', key: 'building.22', input: '#storage-met' },
  { prm: 'crysStorageLvl', key: 'building.23', input: '#storage-crys' },
  { prm: 'deutStorageLvl', key: 'building.24', input: '#storage-deut' },
];

/**
 * A planet array tagged with the profile planet it shows. The tag is an
 * expando: it travels with the array through production's own splice and swap,
 * and JSON drops it, so it never reaches options_production.
 *
 * @typedef {number[] & {pfId?: string}} TaggedState
 */

/** @extends {ProfileBinder<undefined>} */
class ProductionProfiles extends ProfileBinder {
  /** @param {ProfilesUi} pf */
  constructor(pf) {
    super(pf, undefined);
    /** @type {Record<string, *>} Account prm values at the last apply or write-back. */
    this.accountSnapshot = {};
    /** @type {Map<string, {state: number[], name: string}>} Planet values at the last apply or write-back. */
    this.planetSnapshot = new Map();
    /** @type {?string} The planet the one-planet tab shows. */
    this.onePlanetId = null;
    /** @type {number[]} The one-planet inputs as last loaded or written back. */
    this.onePlanetSnapshot = [];
    /** @type {Record<string, number>} The storage levels as last loaded or written back. */
    this.storageSnapshot = {};
    this.ownSave = options.save;
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  bindControls() {
    this.insertPlanetSelect();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => updateParams());
  }

  /**
   * The options.prm keys the profile owns: every one but the calculator
   * fields - the planets as a whole included, which a profile always shows,
   * even with none of its own - and the economy speed while the profile has
   * a universe.
   *
   * @param {?Profile} profile
   * @returns {PfOwnedGroup[]}
   */
  ownedGroups(profile) {
    /** @type {Record<string, any>} */
    const prm = options.prm;
    const local = new Set(PRODUCTION_LOCAL_KEYS);
    const owned = Object.keys(prm).filter((key) => typeof prm[key] !== 'function' && !local.has(key));
    return [
      { keys: owned, present: true },
      { keys: ['universeSpeed'], present: !!profile?.universe, show: false },
    ];
  }

  // -------------------------------------------------------------------------
  // Profile -> calculator
  // -------------------------------------------------------------------------

  /**
   * Not the template apply: the snapshot is taken from options.prm before the
   * form is drawn from it, and the recalculation runs after the guard is off.
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
      const first = this.profileId === null;
      if (first) this.captureOwn();
      this.profileId = profile.id;
      if (first) this.takeLegacyLocal();
      // Marks of the profile shown before; markAll() only visits what this one has.
      this.pf.clearMarks();
      const prm = options.prm;
      PRODUCTION_ACCOUNT_FIELDS.forEach((f) => f.write(prm, getProfileValue(profile.account, f.key)));
      prm.ratesFmt = 2;

      /** @type {TaggedState[]} */
      const states = profile.planets.map((planet) => {
        /** @type {TaggedState} */
        const s = productionPlanetState(planet);
        s.pfId = planet.id;
        return s;
      });
      if (states.length === 0) states.push(createEmptyPlanet());
      prm.aPS = states;
      prm.aPNames = states.map((s) => {
        const planet = profile.planets.find((p) => p.id === s.pfId);
        return planet ? planet.name : options.planetNumStr + '1';
      });
      prm.currPlanetsCount = states.length;
      this.takeSnapshot();

      populateParams();
      setChecked('#all-pln-addtnl-info', prm.showAddInf);
      setOnePlanetView(prm.onePlnExtView);
      setVal('#planetsSpin', prm.currPlanetsCount);
      prepAllPlanetsTable();
      hide('#planet-save-div');
      // Production's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.renderPlanetSelect(profile);
      const last = this.pf.store.getLastPlanet('production', profile.id);
      const shown = states.find((s) => last !== null && s.pfId === last) || states[0];
      this.showOnePlanet(shown.pfId || null, profile);
      pfShow('#pf-planet-row', true);
    } finally {
      this.applying = false;
    }
    updateParams();
    void this.speed?.attach(profile);
    this.markAll();
  }

  restoreOwn() {
    this.onePlanetId = null;
    pfShow('#pf-planet-row', false);
    this.speed?.detach();
    // The profile's values are still in options.prm, and options.load() only
    // overwrites the keys options_production holds: start from the own copy.
    super.restoreOwn();
    options.load('options_production');
  }

  recalc() {
    updateParams();
  }

  /**
   * Production's pencil button on a planet row: with a profile, it just shows
   * that planet in the one-planet tab.
   *
   * @param {number} index
   * @returns {boolean} True when handled.
   */
  showPlanetAt(index) {
    const profile = this.profile();
    const state = /** @type {TaggedState[]} */ (options.prm.aPS)[index];
    if (!profile || !state) return false;
    this.pickPlanet(profile, state.pfId || null, true);
    return true;
  }

  /**
   * Show another planet in the one-planet tab: what was typed for the one shown
   * so far is saved first, and the choice is remembered.
   *
   * @param {Profile} profile
   * @param {?string} planetId
   * @param {boolean} openTab Switch to the one-planet tab too.
   */
  pickPlanet(profile, planetId, openTab) {
    this.save();
    this.showOnePlanet(planetId, profile);
    if (this.onePlanetId) this.pf.store.setLastPlanet('production', profile.id, this.onePlanetId);
    if (openTab) showMainTab('#one-planet-panel');
    updateOnePlnTab();
    this.markAll();
  }

  /**
   * Fill the one-planet tab with a profile planet: production's own editRow(),
   * minus the switch to that tab and the save panel - edits go straight back.
   *
   * @param {?string} planetId
   * @param {Profile} profile
   */
  showOnePlanet(planetId, profile) {
    const states = /** @type {TaggedState[]} */ (options.prm.aPS);
    const index = Math.max(0, states.findIndex((s) => planetId !== null && s.pfId === planetId));
    this.onePlanetId = states[index] ? states[index].pfId || null : null;
    fillOnePlanetForm(states[index]);
    const planet = profile.planets.find((p) => p.id === this.onePlanetId);
    PRODUCTION_STORAGE_FIELDS.forEach((f) => {
      const level = planet ? pfNum(getProfileValue(planet, f.key, 0)) : 0;
      setVal(f.input, level);
      options.prm[f.prm] = level;
      this.storageSnapshot[f.prm] = level;
    });
    this.onePlanetSnapshot = readOnePlanetForm();
    setVal('#pf-planet', this.onePlanetId || '');
  }

  takeSnapshot() {
    const prm = options.prm;
    this.accountSnapshot = {};
    PRODUCTION_ACCOUNT_FIELDS.forEach((f) => { this.accountSnapshot[f.prm] = cloneData(prm[f.prm]); });
    this.planetSnapshot = new Map();
    /** @type {TaggedState[]} */ (prm.aPS).forEach((s, i) => {
      if (s.pfId) this.planetSnapshot.set(s.pfId, { state: s.slice(), name: prm.aPNames[i] });
    });
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  saveWithoutProfile() {
    this.ownSave();
  }

  saveWithProfile() {
    this.writeBackOnePlanet();
    this.writeBack();
    this.saveOwn();
  }

  /** @param {Record<string, any>} stored */
  storeOwn(stored) {
    saveToCookie('options_production', stored);
  }

  /**
   * Carry an edit made in the one-planet tab into the planet's array and its
   * row of the all-planets table - production's updateAllPlnTab() reads the
   * table back into the arrays, and would otherwise undo the edit.
   */
  writeBackOnePlanet() {
    const states = /** @type {TaggedState[]} */ (options.prm.aPS);
    const index = states.findIndex((s) => this.onePlanetId !== null && s.pfId === this.onePlanetId);
    // An empty profile shows one untagged planet until it is edited.
    const untagged = states.length === 1 && !states[0].pfId ? states[0] : null;
    const target = index >= 0 ? states[index] : untagged;
    if (!target) return;
    const current = readOnePlanetForm();
    let changed = false;
    current.forEach((v, i) => {
      if (v !== this.onePlanetSnapshot[i]) {
        target[i] = v;
        changed = true;
      }
    });
    this.onePlanetSnapshot = current;
    if (changed) writePlanetRowInputs(states.indexOf(target), target);
  }

  /** Write what changed since the last snapshot into the profile. */
  writeBack() {
    const profile = this.profile();
    if (!profile) return;
    const prm = options.prm;
    let changed = false;

    PRODUCTION_ACCOUNT_FIELDS.forEach((f) => {
      if (!sameValue(prm[f.prm], this.accountSnapshot[f.prm])) {
        changed = setProfileValue(profile.account, f.key, f.read(prm)) || changed;
      }
    });

    const states = /** @type {TaggedState[]} */ (prm.aPS);
    /** @type {ProfilePlanet[]} */
    const ordered = [];
    states.forEach((s, i) => {
      let planet = s.pfId ? profile.planets.find((p) => p.id === s.pfId) : undefined;
      // An empty profile shows one blank planet; it joins the profile once edited.
      if (!planet && profile.planets.length === 0 && states.length === 1 && sameValue(s.slice(), createEmptyPlanet())) return;
      if (!planet) {
        planet = createPlanet({ name: prm.aPNames[i], coords: { galaxy: null, system: null, position: s[1] } });
        s.pfId = planet.id;
        // The blank planet of an empty profile is the one the one-planet tab shows.
        if (this.onePlanetId === null && states.length === 1) this.onePlanetId = planet.id;
        Object.entries(productionPlanetValues(s)).forEach(([key, value]) => setProfileValue(/** @type {ProfilePlanet} */ (planet), key, value));
        changed = true;
      } else {
        changed = this.writeBackPlanet(planet, s, prm.aPNames[i]) || changed;
      }
      ordered.push(planet);
    });
    // Planets dropped from the table leave the profile; their moons stay.
    if (ordered.length !== profile.planets.length || ordered.some((p, i) => p !== profile.planets[i])) changed = true;
    profile.planets = ordered;

    const selected = profile.planets.find((p) => p.id === this.onePlanetId);
    if (selected) {
      PRODUCTION_STORAGE_FIELDS.forEach((f) => {
        const level = pfNum(prm[f.prm]);
        if (level !== this.storageSnapshot[f.prm]) {
          changed = setProfileValue(selected, f.key, level) || changed;
          this.storageSnapshot[f.prm] = level;
        }
      });
    }

    this.takeSnapshot();
    if (changed) {
      this.pf.save(profile);
      this.renderPlanetSelect(profile);
      this.markAll();
    }
  }

  /**
   * @param {ProfilePlanet} planet
   * @param {number[]} state
   * @param {string} name
   * @returns {boolean} True when the planet changed.
   */
  writeBackPlanet(planet, state, name) {
    const before = this.planetSnapshot.get(planet.id);
    if (!before) return false;
    let changed = false;
    const was = productionPlanetValues(before.state);
    Object.entries(productionPlanetValues(state)).forEach(([key, value]) => {
      if (!sameValue(was[key], value)) changed = setProfileValue(planet, key, value) || changed;
    });
    if (state[1] !== before.state[1]) {
      planet.coords = { galaxy: planet.coords ? planet.coords.galaxy : null, system: planet.coords ? planet.coords.system : null, position: state[1] };
      changed = true;
    }
    if (name !== before.name) {
      planet.name = name;
      changed = true;
    }
    // An edit in the all-planets table of the planet the one-planet tab shows.
    if (changed && planet.id === this.onePlanetId && state.some((v, i) => v !== before.state[i])) {
      fillOnePlanetForm(state);
      this.onePlanetSnapshot = readOnePlanetForm();
    }
    return changed;
  }

  /**
   * The calculator fields last used with a profile, from the key they were
   * kept under before they were shared with "no profile": taken once, when
   * a profile is first shown, and stored at once as the calculator's own, so
   * they outlive the key, which is removed. Called with the profile set.
   */
  takeLegacyLocal() {
    if (readSavedData(PRODUCTION_LEGACY_PROFILE_OPTIONS_KEY) === null) return;
    /** @type {Record<string, *>} */
    const target = { validate: options.prm.validate };
    PRODUCTION_LOCAL_KEYS.forEach((key) => { target[key] = options.prm[key]; });
    loadFromCookie(PRODUCTION_LEGACY_PROFILE_OPTIONS_KEY, target);
    PRODUCTION_LOCAL_KEYS.forEach((key) => { options.prm[key] = target[key]; });
    this.saveOwn();
    removeSavedData(PRODUCTION_LEGACY_PROFILE_OPTIONS_KEY);
  }

  // -------------------------------------------------------------------------
  // The planet select and the marks
  // -------------------------------------------------------------------------

  insertPlanetSelect() {
    const panel = document.getElementById('one-planet-panel');
    if (!panel || document.getElementById('pf-planet-row')) return;
    panel.insertAdjacentHTML('afterbegin',
      '<div id="pf-planet-row" class="d-flex align-items-center gap-1 mb-1 d-none">'
      + '<label for="pf-planet">' + options.planetLabel + '</label>'
      + '<select id="pf-planet" class="form-select form-select-sm w-auto"></select></div>');
    pfShow('#pf-planet-row', false);
    addEvent('#pf-planet', 'change', () => {
      const profile = this.profile();
      if (profile) this.pickPlanet(profile, getVal('#pf-planet') || null, false);
    });
  }

  /** @param {Profile} profile */
  renderPlanetSelect(profile) {
    const select = selectEl('#pf-planet');
    if (!select) return;
    select.innerHTML = '';
    profile.planets.forEach((p) => select.appendChild(new Option(pfBodyLabel(p, options.planetNumStr), p.id)));
    select.value = this.onePlanetId || '';
  }

  /**
   * Name every value this page binds, in the page's own words, for the "in
   * game" marks and the reset dialog. The LF buildings of every species are
   * named, not only the shown one: another planet may be of another species.
   */
  describeFields() {
    this.describeFieldList(PRODUCTION_ACCOUNT_FIELDS);
    const describeSelect = (/** @type {string} */ key, /** @type {?HTMLSelectElement} */ select) => {
      this.pf.describeField(key, pfFieldLabel(select), pfOptionText(select));
    };
    this.pf.describeField('temperature.max', pfFieldLabel($('#max-planet-temp')));
    describeSelect('energyBooster', selectEl('#energy-boost'));
    describeSelect('lf.race', selectEl('#one-pln-race'));
    const rows = $$('#one-planet-prod tr:not(.lf-row)');
    PRODUCTION_ROW_TECHS.forEach((tech, i) => {
      const row = rows[i + 2];
      if (!row) return;
      const name = (row.children[0].textContent || '').trim();
      this.pf.describeField(productionRowKey(tech), name);
      const booster = selectEl('#boosted-prod' + (i + 1));
      if (i < 3 && booster) describeSelect('booster.' + tech, booster);
    });
    PRODUCTION_STORAGE_FIELDS.forEach((f) => this.pf.describeField(f.key, pfFieldLabel($(f.input))));
    for (let race = 1; race <= 4; race++) {
      inputsAll('#one-planet-prod .lf-row-' + race + ' input[type=text]').forEach((el) => {
        const row = el.closest('tr');
        const name = row ? (row.children[0].textContent || '').trim() : '';
        this.pf.describeField('lf.building.' + lfBuildingGameId(race, lfRowIndex(el) + 1), name);
      });
    }
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    PRODUCTION_ACCOUNT_FIELDS.forEach((f) => {
      this.pf.markField(pfFieldInput(f), profile, profile.account, f.key, this.restoreAccount(f.key));
    });
    this.speed?.mark();

    const planet = profile.planets.find((p) => p.id === this.onePlanetId);
    if (planet) {
      const rows = $$('#one-planet-prod tr:not(.lf-row)');
      /**
       * @param {?HTMLElement} el
       * @param {string} key
       */
      const mark = (el, key) => this.pf.markField(el, profile, planet, key, this.restoreBody('planets', planet.id, key));
      mark($('#max-planet-temp'), 'temperature.max');
      mark(selectEl('#energy-boost'), 'energyBooster');
      mark(selectEl('#one-pln-race'), 'lf.race');
      PRODUCTION_ROW_TECHS.forEach((tech, i) => {
        const row = rows[i + 2];
        if (!row) return;
        mark(cellInput(row, 2), productionRowKey(tech));
        mark(cellSelect(row, 7), 'production.' + tech);
        if (i < 3) mark(selectEl('#boosted-prod' + (i + 1)), 'booster.' + tech);
      });
      const race = pfNum(getProfileValue(planet, 'lf.race', 0));
      inputsAll('#one-planet-prod .lf-row-' + race + ' input[type=text]').forEach((el) => {
        const key = 'lf.building.' + lfBuildingGameId(race, lfRowIndex(el) + 1);
        this.pf.markField(el, profile, planet, key, this.restoreBody('planets', planet.id, key));
      });
      PRODUCTION_STORAGE_FIELDS.forEach((f) => this.pf.markField($(f.input), profile, planet, f.key, this.restoreBody('planets', planet.id, f.key)));
    }

    const tableRows = $$('#all-planets-prod tr');
    /** @type {TaggedState[]} */ (options.prm.aPS).forEach((s, i) => {
      const p = profile.planets.find((x) => x.id === s.pfId);
      const row = tableRows[i * 2 + 1];
      if (!p || !row) return;
      const temperature = row.children[2] ? row.children[2].querySelector('input') : null;
      this.pf.markField(temperature, profile, p, 'temperature.max', this.restoreBody('planets', p.id, 'temperature.max'));
      PRODUCTION_ROW_TECHS.forEach((tech, j) => {
        const key = productionRowKey(tech);
        const cell = row.children[LEVEL_COLUMNS[j]];
        this.pf.markField(cell ? cell.querySelector('input') : null, profile, p, key, this.restoreBody('planets', p.id, key));
      });
    });
  }
}

/**
 * Write a planet array into its row of the all-planets table.
 *
 * @param {number} index
 * @param {number[]} s
 */
function writePlanetRowInputs(index, s) {
  const row = $$('#all-planets-prod tr')[index * 2 + 1];
  if (!row) return;
  const temperature = row.children[2] ? row.children[2].querySelector('input') : null;
  const position = row.children[3] ? row.children[3].querySelector('input') : null;
  if (temperature) temperature.value = String(s[0]);
  if (position) position.value = String(s[1]);
  for (let j = 1; j < 8; j++) {
    const cell = row.children[LEVEL_COLUMNS[j - 1]];
    const input = cell ? cell.querySelector('input') : null;
    if (input) input.value = String(s[mineSlot(j)]);
  }
}

/**
 * Connect production to the profiles, when the page has the selector.
 *
 * @returns {?ProductionProfiles}
 */
function initProductionProfiles() {
  if (!pfgProfiles) return null;
  productionProfiles = new ProductionProfiles(pfgProfiles);
  productionProfiles.init();
  return productionProfiles;
}

/** @type {?ProductionProfiles} Set once the page is wired. */
let productionProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initProductionProfiles = initProductionProfiles;
}
