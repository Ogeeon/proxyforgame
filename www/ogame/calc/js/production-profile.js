// ============================================================================
// PRODUCTION CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the production calculator to the active player profile (ADR-0004).
// The calculator keeps working on options.prm; this file projects the profile
// into it and writes the changes back:
//   - apply(): profile -> options.prm (account fields and the planet list);
//   - sync(): options.prm -> profile, called from options.save(), writing only
//     what changed since the last apply or sync. Diffing against that snapshot,
//     not against the profile, keeps a lossy mapping (a profile with no class
//     shows as collector here) from turning into an override nobody made.
// With a profile active, the one-planet tab shows one of the profile's planets,
// picked in #pf-planet, and edits there go straight to that planet. The
// calculator fields (PRODUCTION_LOCAL_KEYS) are kept under their own key, so
// options_production - what "no profile" shows - is never touched meanwhile.

'use strict';

/** The fields of options.prm that stay the calculator's own (ADR-0004: calculator fields). */
const PRODUCTION_LOCAL_KEYS = ['universeSpeed', 'maxTempEntered', 'onePlnExtView', 'showAddInf', 'inclSats'];

/** Where the calculator fields go while a profile is active. */
const PRODUCTION_PROFILE_OPTIONS_KEY = 'options_production_profile';

/** @type {ProfileConvField[]} */
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
 * A production planet array (`aPS[i]` layout, see productionPlanetValues) from
 * a profile planet. Missing values take production's own defaults.
 *
 * @param {ProfilePlanet} planet
 * @returns {number[]}
 */
function planetToProductionState(planet) {
  /**
   * @param {string} key
   * @param {number} def
   */
  const get = (key, def) => pfNum(getProfileValue(planet, key, def));
  const s = createEmptyPlanet();
  s[PLANET_TEMP] = get('temperature.max', 0);
  s[PLANET_POS] = planet.coords && planet.coords.position !== null ? planet.coords.position : 8;
  s[PLANET_ENERGY_BOOST] = get('energyBooster', 0);
  PRODUCTION_ROW_TECHS.forEach((tech, i) => {
    const j = i + 1;
    s[mineSlot(j)] = get(productionRowKey(tech), 0);
    s[mineSlot(j) + 1] = get('production.' + tech, 100);
    s[mineSlot(j) + 2] = j <= 3 ? get('booster.' + tech, 0) : 0;
  });
  const race = get('lf.race', 0);
  s[PLANET_RACE] = race;
  for (let k = 0; k < LF_BUILDINGS_PER_RACE; k++) {
    s[PLANET_LF_LEVELS + k] = race >= 1 && race <= 4 ? get('lf.building.' + lfBuildingGameId(race, k + 1), 0) : 0;
  }
  return s;
}

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
    /** @type {Record<string, *>} Account prm values at the last apply or sync. */
    this.accountSnapshot = {};
    /** @type {Map<string, {state: number[], name: string}>} Planet values at the last apply or sync. */
    this.planetSnapshot = new Map();
    /** @type {?string} The planet the one-planet tab shows. */
    this.onePlanetId = null;
    /** @type {number[]} The one-planet inputs as last loaded or synced. */
    this.onePlanetSnapshot = [];
    /** @type {Record<string, number>} The storage levels as last loaded or synced. */
    this.storageSnapshot = {};
    this.ownSave = options.save;
    /** @type {Record<string, *>} The calculator's own settings, as they were before a profile. */
    this.ownPrm = cloneData(options.prm);
    /** @type {?PfUniverseSetting} Set in init(). */
    this.speed = null;
  }

  init() {
    this.insertPlanetSelect();
    this.describeFields();
    options.save = () => this.save();
    this.speed = new PfUniverseSetting(this.pf, PF_UNIVERSE_SPEED, '#universe-speed', () => updateParams());
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
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
      if (this.profileId === null) this.ownPrm = cloneData(options.prm);
      this.profileId = profile.id;
      // Marks of the profile shown before; markAll() only visits what this one has.
      this.pf.clearMarks();
      const prm = options.prm;
      this.loadLocal();
      PRODUCTION_ACCOUNT_FIELDS.forEach((f) => { prm[f.prm] = f.toPrm(getProfileValue(profile.account, f.key)); });
      prm.ratesFmt = 2;

      /** @type {TaggedState[]} */
      const states = profile.planets.map((planet) => {
        /** @type {TaggedState} */
        const s = planetToProductionState(planet);
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
      const shown = states.find((s) => s.pfId === last) || states[0];
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
    Object.assign(options.prm, cloneData(this.ownPrm));
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
    this.save();
    this.showOnePlanet(state.pfId || null, profile);
    if (this.onePlanetId) this.pf.store.setLastPlanet('production', profile.id, this.onePlanetId);
    showMainTab('#one-planet-panel');
    updateOnePlnTab();
    this.markAll();
    return true;
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
    const index = Math.max(0, states.findIndex((s) => s.pfId === planetId));
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
    this.syncOnePlanet();
    this.sync();
    this.saveLocal();
  }

  /**
   * Carry an edit made in the one-planet tab into the planet's array and its
   * row of the all-planets table - production's updateAllPlnTab() reads the
   * table back into the arrays, and would otherwise undo the edit.
   */
  syncOnePlanet() {
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
  sync() {
    const profile = this.profile();
    if (!profile) return;
    const prm = options.prm;
    let changed = false;

    PRODUCTION_ACCOUNT_FIELDS.forEach((f) => {
      if (!sameValue(prm[f.prm], this.accountSnapshot[f.prm])) {
        changed = setProfileValue(profile.account, f.key, f.fromPrm(prm[f.prm])) || changed;
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
        changed = this.syncPlanet(planet, s, prm.aPNames[i]) || changed;
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
  syncPlanet(planet, state, name) {
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

  /** The calculator fields, kept apart from options_production while a profile is active. */
  saveLocal() {
    /** @type {Record<string, *>} */
    const stored = {};
    PRODUCTION_LOCAL_KEYS.forEach((key) => { stored[key] = options.prm[key]; });
    saveToCookie(PRODUCTION_PROFILE_OPTIONS_KEY, stored);
  }

  /** The calculator fields last used with a profile, if there are any. */
  loadLocal() {
    /** @type {Record<string, *>} */
    const target = { validate: options.prm.validate };
    PRODUCTION_LOCAL_KEYS.forEach((key) => { target[key] = options.prm[key]; });
    loadFromCookie(PRODUCTION_PROFILE_OPTIONS_KEY, target);
    PRODUCTION_LOCAL_KEYS.forEach((key) => { options.prm[key] = target[key]; });
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
      if (!profile) return;
      // Whatever was typed into the planet shown so far is saved first.
      this.save();
      this.showOnePlanet(getVal('#pf-planet') || null, profile);
      if (this.onePlanetId) this.pf.store.setLastPlanet('production', profile.id, this.onePlanetId);
      updateOnePlnTab();
      this.markAll();
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
      this.pf.markField($(f.input), profile, profile.account, f.key, this.restoreAccount(f.key));
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
