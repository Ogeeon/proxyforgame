// ============================================================================
// COSTS CALCULATOR - PLAYER PROFILE BINDING
// ============================================================================
// Connects the cost calculator to the active player profile (ADR-0004).
// The calculator reads its settings from the form; this file projects the
// profile into the form and writes the changes back:
//   - apply(): profile -> form - the account (researches, officers, classes,
//     the life-form bonuses, the research bonuses table) and one planet and
//     one moon of the profile, picked in #pf-planet and #pf-moon (their
//     factories, shipyard, research lab, temperature, position, Mineral
//     Research Centre); the profile's universe goes into the picker, locked;
//     The research network dialog lists the profile's planets with their
//     research labs; a lab edited there goes back to its planet. The start
//     planet and whether the network is used are remembered per profile; by
//     default the network is on when the account has researched it, and the
//     start is the planet with the best lab;
//   - sync(): GlobalParams -> profile, called where the calculator saves its
//     state, writing only what changed since the last apply or sync, so a
//     lossy mapping (a profile with no class shows as collector here) never
//     becomes an override.
// A planet or moon the profile does not have leaves those fields to the
// calculator. The build tables, the speeds, the boosters and the research
// event are the calculator's own and keep going to costs_calculator_state; the
// profile-owned values are stored there as they were before the profile, and
// the research bonuses table keeps its own key untouched, so "no profile"
// shows both as they were.

'use strict';

/**
 * A field of the cost calculator: read from its parameters, not from options.prm.
 *
 * @typedef {ProfileFieldBase & {
 *   state: ?string,
 *   input: () => ?HTMLElement,
 *   get: (p: GlobalParams) => *,
 *   show: (value: *) => void,
 * }} CostsField
 * state: key in the calculator's stored state, null for the research bonuses table; input: the field that
 * shows it; get: the profile value the parameters hold; show: put a profile value (or undefined) into the form.
 */

/**
 * A whole-number field.
 *
 * @param {string} key
 * @param {string} state
 * @param {string} selector
 * @returns {CostsField}
 */
function costsLevelField(key, state, selector) {
  return {
    key, state, input: () => $(selector),
    get: (p) => pfNum(/** @type {Record<string, any>} */ (p)[state]),
    show: (v) => setVal(selector, pfNum(v)),
  };
}

/**
 * A percentage field, shown with the locale's decimal separator.
 *
 * @param {string} key
 * @param {string} state
 * @param {string} selector
 * @returns {CostsField}
 */
function costsPercentField(key, state, selector) {
  return {
    key, state, input: () => $(selector),
    get: (p) => pfNum(/** @type {Record<string, any>} */ (p)[state]),
    show: (v) => setNumVal(selector, pfNum(v)),
  };
}

/** @type {CostsField[]} */
const COSTS_ACCOUNT_FIELDS = [
  costsLevelField('research.113', 'energyTechLevel', '#energy-tech-level'),
  costsLevelField('research.122', 'plasmaTechLevel', '#plasma-tech-level'),
  costsLevelField('research.121', 'ionTechLevel', '#ion-tech-level'),
  costsLevelField('research.114', 'hyperTechLevel', '#hyper-tech-level'),
  costsLevelField('research.123', 'irnLevel', '#irn-level'),
  ...['geologist', 'engineer', 'technocrat', 'admiral', 'commander'].map((name) => ({
    key: 'officer.' + name, state: name, input: () => $('#' + name),
    get: (/** @type {GlobalParams} */ p) => /** @type {Record<string, any>} */ (p)[name] === true,
    show: (/** @type {*} */ v) => setChecked('#' + name, v === true),
  })),
  {
    // The calculator has no "no class": a profile without one shows as collector.
    key: 'class', state: 'playerClass', input: () => $('#class-0'),
    get: (p) => pfNum(p.playerClass) + 1,
    show: (v) => setChecked('#class-' + Math.min(2, Math.max(0, pfNum(v) - 1)), true),
    display: (v) => pfLabelFor('class-' + (pfNum(v) - 1)),
  },
  {
    key: 'allianceClass', state: 'isTrader', input: () => $('#is-trader'),
    get: (p) => (p.isTrader ? PROFILE_ALLIANCE_CLASS.TRADER : PROFILE_ALLIANCE_CLASS.NONE),
    show: (v) => setChecked('#is-trader', pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER),
    display: (v) => (pfNum(v) === PROFILE_ALLIANCE_CLASS.TRADER ? '✓' : '—'),
  },
  costsPercentField('lf.classBooster.1', 'collectorClassBonus', '#lf-collector-class-bonus'),
  costsPercentField('lf.classBooster.3', 'discovererClassBonus', '#discoverer-class-bonus'),
  costsPercentField('lf.ship.202.cargo', 'scCapacityIncrease', '#sc-capacity-increase'),
  costsPercentField('lf.ship.203.cargo', 'lcCapacityIncrease', '#lc-capacity-increase'),
  // The game reports a cost reduction per technology; the calculator applies
  // one number to the Terraformer's cost and time, so it takes the cost one.
  costsPercentField('lf.cost.33.cost', 'lfTerraformerRdc', '#lf-terraformer-rdc'),
  {
    key: 'rates', state: 'rates', input: () => $('#exchange-rates-m'),
    get: (p) => (Array.isArray(p.rates) ? p.rates.map(Number) : DEFAULT_RATES.slice()),
    show: (v) => {
      const rates = Array.isArray(v) && v.length === 3 ? v.map(Number) : DEFAULT_RATES;
      setNumVal('#exchange-rates-m', rates[0]);
      setNumVal('#exchange-rates-c', rates[1]);
      setNumVal('#exchange-rates-d', rates[2]);
    },
  },
];

/** The fields of the planet picked in #pf-planet. */
const COSTS_PLANET_FIELDS = [
  costsLevelField('building.14', 'robotFactoryLevelPlanet', '#robot-factory-level'),
  costsLevelField('building.15', 'naniteFactoryLevel', '#nanite-factory-level'),
  costsLevelField('building.21', 'shipyardLevel', '#shipyard-level'),
  costsLevelField('building.31', 'researchLabLevel', '#research-lab-level'),
  costsLevelField('temperature.max', 'maxPlanetTemp', '#max-planet-temp'),
  costsLevelField('lf.building.' + lfBuildingGameId(2, 11), 'mineralResCntrLvl', '#mineral-res-cntr-lvl'),
];

/** The fields of the moon picked in #pf-moon. */
const COSTS_MOON_FIELDS = [
  costsLevelField('building.14', 'robotFactoryLevelMoon', '#robot-factory-level-moon'),
];

/** The most planets the research network dialog takes (its planet count spinner's limit). */
const COSTS_MAX_LAB_PLANETS = 99;

/** The universe picker and the speeds it fills in: the profile's when it has a universe. */
const COSTS_UNIVERSE_STATE = ['country', 'universe', 'universeSpeed', 'researchSpeed'];

/**
 * The fields of the research bonuses table: a cost and a time reduction per
 * research, read from the rows the page renders.
 *
 * @returns {CostsField[]}
 */
function costsResearchTableFields() {
  return Array.from($$('#lf-research-bonuses-tbody tr')).filter((row) => row instanceof HTMLTableRowElement).flatMap((row) => {
    const techId = Number.parseInt(row.dataset.techId ?? '', 10);
    if (!techId) return [];
    return /** @type {Array<['cost'|'time', string, 'lfResCostRdcMap'|'lfResTimeRdcMap']>} */ ([
      ['cost', '.lf-research-cost-input', 'lfResCostRdcMap'],
      ['time', '.lf-research-time-input', 'lfResTimeRdcMap'],
    ]).map(([kind, selector, map]) => {
      const input = () => /** @type {?HTMLInputElement} */ (row.querySelector(selector));
      return {
        key: 'lf.cost.' + techId + '.' + kind, state: null, input,
        get: (/** @type {GlobalParams} */ p) => pfNum(p[map][techId]),
        show: (/** @type {*} */ v) => {
          const el = input();
          if (el) el.value = localizeFloat(pfNum(v));
        },
      };
    });
  });
}

class CostsProfiles {
  /**
   * @param {ProfilesUi} pf
   * @param {CostsCalculator} app
   */
  constructor(pf, app) {
    this.pf = pf;
    this.app = app;
    /** @type {CostsField[]} The account fields, the research bonuses table included. */
    this.accountFields = [...COSTS_ACCOUNT_FIELDS, ...costsResearchTableFields()];
    /** @type {?string} The active profile's id while one is applied. */
    this.profileId = null;
    /** @type {?string} The planet shown; null leaves its fields to the calculator. */
    this.planetId = null;
    /** @type {?string} The moon shown. */
    this.moonId = null;
    /** True while the profile's universe is in the picker. */
    this.universeBound = false;
    /** @type {Record<string, *>} Values (by profile key, planet and moon ones prefixed) at the last apply or sync. */
    this.snapshot = {};
    /** @type {Record<string, *>} The calculator's stored state as it was before a profile. */
    this.ownState = {};
    /** @type {Array<{cost: number, time: number}>} The research bonuses table as it was before a profile. */
    this.ownTable = [];
    this.ownSaveState = app.saveState.bind(app);
    this.ownSaveTable = app.saveLfResearchTable.bind(app);
    this.applying = false;
  }

  init() {
    this.describeFields();
    this.app.saveState = () => this.save();
    // The table's own key stays as it was before the profile.
    this.app.saveLfResearchTable = (data) => {
      if (this.profileId === null) this.ownSaveTable(data);
    };
    addEvent('#pf-planet', 'change', () => this.bodyChosen('planet'));
    addEvent('#pf-moon', 'change', () => this.bodyChosen('moon'));
    this.pf.onChange((profile) => this.apply(profile));
    const active = this.pf.active();
    if (active) this.apply(active);
  }

  /** @returns {?Profile} */
  profile() {
    return this.profileId ? this.pf.store.get(this.profileId) : null;
  }

  /**
   * @param {?Profile} profile
   * @returns {{planet: ?ProfilePlanet, moon: ?ProfileMoon}}
   */
  bodies(profile) {
    return {
      planet: profile?.planets.find((p) => p.id === this.planetId) || null,
      moon: profile?.moons.find((m) => m.id === this.moonId) || null,
    };
  }

  /** The state keys the profile owns right now. */
  ownedStateKeys() {
    return [
      ...COSTS_ACCOUNT_FIELDS.map((f) => /** @type {string} */ (f.state)),
      'useIrn',
      ...(this.planetId === null ? [] : [...COSTS_PLANET_FIELDS.map((f) => /** @type {string} */ (f.state)), 'planetPos', 'labLevels', 'labChoice']),
      ...(this.moonId === null ? [] : COSTS_MOON_FIELDS.map((f) => /** @type {string} */ (f.state))),
      ...(this.universeBound ? COSTS_UNIVERSE_STATE : []),
    ];
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
        const own = this.app.exportState();
        this.ownState = own.state;
        this.ownTable = own.table;
      }
      this.profileId = profile.id;
      this.pf.clearMarks();
      this.accountFields.forEach((f) => f.show(getProfileValue(profile.account, f.key)));
      this.renderBodySelects(profile);
      this.showBodies(profile);
      this.showLabs(profile);
      setChecked('#use-irn', this.irnSwitch(profile));
      this.applyUniverse(profile);
      // The calculator's reset would write every default into the profile as an edit.
      pfShow('#reset', false);
      this.app.recalculateAll();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  /**
   * Fill the planet and moon selects and choose what they show: the body
   * picked last time in this profile, else - for the moon - the moon of the
   * planet shown, else the first one.
   *
   * @param {Profile} profile
   */
  renderBodySelects(profile) {
    /**
     * @param {string} selector
     * @param {ProfilePlanet[]} list
     * @param {?string} current
     * @param {string} lastKey
     * @param {ProfilePlanet|undefined} fallback
     * @returns {?string}
     */
    const fill = (selector, list, current, lastKey, fallback) => {
      const select = selectEl(selector);
      if (select) {
        select.innerHTML = '';
        list.forEach((b) => select.appendChild(new Option(pfBodyLabel(b), b.id)));
      }
      const last = this.pf.store.getLastPlanet(lastKey, profile.id);
      const chosen = list.find((b) => b.id === current) || list.find((b) => b.id === last) || fallback || list[0];
      const id = chosen ? chosen.id : null;
      if (select) select.value = id || '';
      return id;
    };
    this.planetId = fill('#pf-planet', profile.planets, this.planetId, 'costs', undefined);
    const planetMoon = profile.moons.find((m) => this.planetId !== null && m.planetId === this.planetId);
    this.moonId = fill('#pf-moon', profile.moons, this.moonId, 'costs-moon', planetMoon);
    pfShow('#pf-planet-box', profile.planets.length > 0);
    pfShow('#pf-moon-box', profile.moons.length > 0);
    pfShow('#pf-bodies-row', profile.planets.length + profile.moons.length > 0);
  }

  /**
   * Show the planet's and the moon's values. A body the profile does not have
   * shows the calculator's own values.
   *
   * @param {Profile} profile
   */
  showBodies(profile) {
    const { planet, moon } = this.bodies(profile);
    COSTS_PLANET_FIELDS.forEach((f) => f.show(planet ? getProfileValue(planet, f.key, 0) : this.ownState[/** @type {string} */ (f.state)]));
    const position = planet?.coords?.position;
    setVal('#planet-pos', planet ? position ?? 8 : pfNum(this.ownState.planetPos) || 8);
    COSTS_MOON_FIELDS.forEach((f) => f.show(moon ? getProfileValue(moon, f.key, 0) : this.ownState[/** @type {string} */ (f.state)]));
  }

  /**
   * Show the profile's universe in the picker, locked: the profile says where
   * it plays. Picking it fetches the universe's speeds, as the picker does.
   * A profile with no universe leaves the picker to the player.
   *
   * @param {Profile} profile
   */
  applyUniverse(profile) {
    const wanted = profile.universe;
    if (!wanted) {
      this.unlockUniverse();
      return;
    }
    this.universeBound = true;
    if (getVal('#country') !== wanted.country || getVal('#universe') !== String(wanted.number)) {
      setVal('#country', wanted.country);
      this.app.fillUniverseList(wanted.country, wanted.number);
      void this.app.fetchUniverseSpeeds();
    }
    [selectEl('#country'), selectEl('#universe')].forEach((el) => pfLockSelect(el, true, getOptionValue('universeFromProfile', '')));
  }

  /** Give the universe picker back, on the universe and speeds it had before the profile. */
  unlockUniverse() {
    [selectEl('#country'), selectEl('#universe')].forEach((el) => pfLockSelect(el, false));
    if (!this.universeBound) return;
    this.universeBound = false;
    const own = this.ownState;
    setVal('#country', own.country ?? '--');
    this.app.fillUniverseList(own.country ?? '--', own.universe ?? '');
    setVal('#universe-speed', own.universeSpeed ?? 1);
    setVal('#research-speed', own.researchSpeed ?? 1);
  }

  /** Back to the calculator's own settings. */
  leave() {
    if (this.profileId === null) return;
    this.applying = true;
    try {
      this.profileId = null;
      this.planetId = null;
      this.moonId = null;
      this.pf.clearMarks();
      pfShow('#reset', true);
      pfShow('#pf-bodies-row', false);
      this.unlockUniverse();
      const own = this.ownState;
      this.lockPlanetCount(false);
      this.fillLabTable(Array.isArray(own.labLevels) ? own.labLevels : [], pfNum(own.labChoice ?? -1), null);
      this.app.restoreOwnState({ state: own, table: this.ownTable });
    } finally {
      this.applying = false;
    }
    this.app.recalculateAll();
  }

  takeSnapshot() {
    const p = this.app.params();
    this.snapshot = {};
    this.accountFields.forEach((f) => { this.snapshot[f.key] = f.get(p); });
    COSTS_PLANET_FIELDS.forEach((f) => { this.snapshot['planet:' + f.key] = f.get(p); });
    this.snapshot['planet:position'] = pfNum(p.planetPos);
    COSTS_MOON_FIELDS.forEach((f) => { this.snapshot['moon:' + f.key] = f.get(p); });
    this.snapshot.labs = p.labLevels.map(pfNum);
    this.snapshot.labChoice = p.labChoice;
    this.snapshot.useIrn = p.useIrn;
  }

  // -------------------------------------------------------------------------
  // Calculator -> profile
  // -------------------------------------------------------------------------

  save() {
    if (this.profileId === null) {
      this.ownSaveState();
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
    const p = this.app.params();
    const { planet, moon } = this.bodies(profile);
    let changed = false;
    /**
     * @param {{values: LayeredValues}} entity
     * @param {CostsField} f
     * @param {string} snapKey
     */
    const syncField = (entity, f, snapKey) => {
      const value = f.get(p);
      if (sameValue(value, this.snapshot[snapKey])) return;
      this.snapshot[snapKey] = value;
      changed = setProfileValue(entity, f.key, value) || changed;
    };
    this.accountFields.forEach((f) => syncField(profile.account, f, f.key));
    if (planet) {
      COSTS_PLANET_FIELDS.forEach((f) => syncField(planet, f, 'planet:' + f.key));
      const position = pfNum(p.planetPos);
      if (position !== this.snapshot['planet:position']) {
        this.snapshot['planet:position'] = position;
        planet.coords = { galaxy: planet.coords?.galaxy ?? null, system: planet.coords?.system ?? null, position };
        changed = true;
      }
    }
    if (moon) COSTS_MOON_FIELDS.forEach((f) => syncField(moon, f, 'moon:' + f.key));
    const labs = this.syncLabs(profile, p);
    changed = labs.changed || changed;
    if (changed) {
      this.pf.save(profile);
      this.renderBodySelects(profile);
      // A lab level typed on the Buildings tab shows in the dialog too - but not
      // while the dialog is open: that would throw away what is typed there.
      if (!this.dialogOpen()) this.showLabs(profile);
      this.markAll();
    }
    if (labs.shownLab !== null) {
      // The shown planet's lab was edited in the dialog: its field follows.
      this.applying = true;
      try {
        setVal('#research-lab-level', labs.shownLab);
        this.app.recalculateAll();
        this.takeSnapshot();
      } finally {
        this.applying = false;
      }
      this.markAll();
    }
  }

  /** True while the research network dialog is open. */
  dialogOpen() {
    return !!document.getElementById('irn-calc')?.classList.contains('show');
  }

  /**
   * Carry the research network dialog into the profile: the lab levels - once
   * the dialog is closed, so its Cancel can still take them back - and the
   * start planet and the network switch, which are remembered per profile.
   *
   * @param {Profile} profile
   * @param {GlobalParams} p
   * @returns {{changed: boolean, shownLab: ?number}} `shownLab`: the new lab of the planet shown, when the dialog changed it.
   */
  syncLabs(profile, p) {
    const planets = profile.planets.slice(0, COSTS_MAX_LAB_PLANETS);
    let changed = false;
    /** @type {?number} */
    let shownLab = null;
    if (planets.length > 0 && !this.dialogOpen()) {
      const before = Array.isArray(this.snapshot.labs) ? this.snapshot.labs : [];
      planets.forEach((planet, i) => {
        const level = pfNum(p.labLevels[i]);
        if (level === before[i]) return;
        changed = setProfileValue(planet, 'building.31', level) || changed;
        if (planet.id === this.planetId) shownLab = level;
      });
      this.snapshot.labs = p.labLevels.map(pfNum);
    }
    // The start planet and the switch are choices, not account data: they go
    // with the other per-calculator choices of the store.
    if (planets.length > 0 && p.labChoice !== this.snapshot.labChoice) {
      this.snapshot.labChoice = p.labChoice;
      const start = planets[p.labChoice];
      if (start) this.pf.store.setLastPlanet('costs-irn-start', profile.id, start.id);
    }
    if (p.useIrn !== this.snapshot.useIrn) {
      this.snapshot.useIrn = p.useIrn;
      this.pf.store.setLastPlanet('costs-irn', profile.id, p.useIrn ? '1' : '0');
    }
    return { changed, shownLab };
  }

  /**
   * The stored state gets the calculator's own values as they are, and the
   * profile-owned ones as they were before the profile. A body the profile
   * does not have is the calculator's own, so its values are taken as they are.
   */
  saveOwn() {
    const state = this.app.buildState();
    const owned = new Set(this.ownedStateKeys());
    Object.keys(state).forEach((key) => {
      if (owned.has(key)) state[key] = cloneData(this.ownState[key]);
      else this.ownState[key] = cloneData(state[key]);
    });
    this.app.writeState(state);
  }

  /**
   * The player picked another planet or moon. Choosing a planet also shows
   * its moon, when it has one.
   *
   * @param {'planet'|'moon'} kind
   */
  bodyChosen(kind) {
    const profile = this.profile();
    if (!profile) return;
    // Whatever was typed for the body shown so far is saved first.
    this.save();
    if (kind === 'planet') {
      this.planetId = getVal('#pf-planet') || null;
      if (this.planetId) this.pf.store.setLastPlanet('costs', profile.id, this.planetId);
      const moon = profile.moons.find((m) => m.planetId === this.planetId);
      if (moon) {
        this.moonId = moon.id;
        setVal('#pf-moon', moon.id);
        this.pf.store.setLastPlanet('costs-moon', profile.id, moon.id);
      }
    } else {
      this.moonId = getVal('#pf-moon') || null;
      if (this.moonId) this.pf.store.setLastPlanet('costs-moon', profile.id, this.moonId);
    }
    this.applying = true;
    try {
      this.showBodies(profile);
      this.app.recalculateAll();
      this.takeSnapshot();
    } finally {
      this.applying = false;
    }
    this.markAll();
  }

  // -------------------------------------------------------------------------
  // The research network dialog
  // -------------------------------------------------------------------------

  /**
   * Whether the research network is switched on for a profile: the player's
   * last choice there, else on when the account has researched the network.
   *
   * @param {Profile} profile
   */
  irnSwitch(profile) {
    const chosen = this.pf.store.getLastPlanet('costs-irn', profile.id);
    if (chosen !== null) return chosen === '1';
    return pfNum(getProfileValue(profile.account, 'research.123', 0)) > 0;
  }

  /**
   * List the profile's planets in the research network dialog, each with its
   * research lab. The start is the planet picked there last time, while it
   * still has a lab, else the one with the best lab - on a tie the lowest game
   * id, the oldest planet. A profile with no planet leaves the dialog to the
   * calculator.
   *
   * @param {Profile} profile
   */
  showLabs(profile) {
    const planets = profile.planets.slice(0, COSTS_MAX_LAB_PLANETS);
    this.lockPlanetCount(planets.length > 0);
    if (planets.length === 0) return;
    const levels = planets.map((p) => pfNum(getProfileValue(p, 'building.31', 0)));
    const last = this.pf.store.getLastPlanet('costs-irn-start', profile.id);
    let start = planets.findIndex((p) => p.id === last);
    if (start < 0 || levels[start] === 0) {
      const gameId = (/** @type {ProfilePlanet} */ p) => p.gameId ?? Number.MAX_SAFE_INTEGER;
      start = levels.reduce((best, level, i) => {
        const better = level > levels[best] || (level === levels[best] && gameId(planets[i]) < gameId(planets[best]));
        return better ? i : best;
      }, 0);
    }
    this.fillLabTable(levels, levels[start] > 0 ? start : -1, planets.map((p) => pfBodyLabel(p)));
  }

  /**
   * With a profile the dialog lists its planets: the count is theirs.
   *
   * @param {boolean} locked
   */
  lockPlanetCount(locked) {
    ['planetsSpin-up', 'planetsSpin-down'].forEach((id) => {
      const button = document.getElementById(id);
      if (button instanceof HTMLButtonElement) button.disabled = locked;
    });
  }

  /**
   * Rebuild the dialog's lab table, and the page's copies of it, from a list
   * of levels - the dialog's own cancel does the same from its backup.
   *
   * @param {number[]} levels
   * @param {number} choice Index of the start planet, -1 for none.
   * @param {?string[]} names Row labels; null keeps the numbered ones.
   */
  fillLabTable(levels, choice, names) {
    const labLevels = levels.length > 0 ? levels.slice(0, COSTS_MAX_LAB_PLANETS).map(pfNum) : [0];
    options.prm.planetsSpin = labLevels.length;
    options.prm.labLevels = [...labLevels];
    options.prm.labChoice = choice;
    options.prm.labNames = names;
    options.currPlanetsCount = labLevels.length;
    setVal('#planetsSpin', labLevels.length);
    rebuildLabTable({ irnLevel: options.prm.irnLevel, labLevels, labChoice: choice });
    this.app.updateResultingLevel();
  }

  // -------------------------------------------------------------------------
  // The marks
  // -------------------------------------------------------------------------

  /** Name every value this page binds, in the page's own words. */
  describeFields() {
    [...this.accountFields, ...COSTS_PLANET_FIELDS].forEach((f) => this.pf.describeField(f.key, pfFieldLabel(f.input()), f.display));
  }

  /** Mark every field the profile owns, and the ones that differ from the game. */
  markAll() {
    const profile = this.profile();
    if (!profile) return;
    /**
     * Restore one game value on a fresh copy of the profile: the one marked
     * may be stale by the time the button is clicked.
     *
     * @param {'account'|'planet'|'moon'} kind
     * @param {?string} id
     * @param {string} key
     */
    const restoreTo = (kind, id, key) => () => {
      const fresh = this.pf.store.get(profile.id);
      if (!fresh) return;
      let target = null;
      if (kind === 'account') target = fresh.account;
      else if (kind === 'planet') target = fresh.planets.find((b) => b.id === id);
      else target = fresh.moons.find((b) => b.id === id);
      if (target && resetProfileValue(target, key)) this.pf.store.save(fresh);
    };
    this.accountFields.forEach((f) => {
      this.pf.markField(f.input(), profile, profile.account, f.key, restoreTo('account', null, f.key));
    });
    const { planet, moon } = this.bodies(profile);
    if (planet) {
      COSTS_PLANET_FIELDS.forEach((f) => this.pf.markField(f.input(), profile, planet, f.key, restoreTo('planet', planet.id, f.key)));
    }
    if (moon) {
      COSTS_MOON_FIELDS.forEach((f) => this.pf.markField(f.input(), profile, moon, f.key, restoreTo('moon', moon.id, f.key)));
    }
    profile.planets.slice(0, COSTS_MAX_LAB_PLANETS).forEach((p, i) => {
      this.pf.markField($('#lablevel_' + (i + 1)), profile, p, 'building.31', restoreTo('planet', p.id, 'building.31'));
    });
  }
}

/**
 * Connect the cost calculator to the profiles, when the page has the selector.
 *
 * @returns {?CostsProfiles}
 */
function initCostsProfiles() {
  if (!pfgProfiles || !calculatorApp) return null;
  costsProfiles = new CostsProfiles(pfgProfiles, calculatorApp);
  costsProfiles.init();
  return costsProfiles;
}

/** @type {?CostsProfiles} Set once the page is wired. */
let costsProfiles = null;

if (typeof globalThis !== 'undefined') {
  globalThisRecord().initCostsProfiles = initCostsProfiles;
}
