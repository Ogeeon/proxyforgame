// ============================================================================
// QUEUE CALCULATOR - ORCHESTRATION
// ============================================================================
// Top-level controller. Owns the planet/moon TabState, wires DOM events,
// drives recomputation on every change, and persists state to cookies.

'use strict';

const PLANET_TAB = 2;
const MOON_TAB = 3;
const ACTIVE_TAB_COOKIE = 'queue_active_tab';

class TabState {
  constructor(tabNum, queueProp) {
    this.tabNum = tabNum;            // 2 = planet, 3 = moon
    this.queueProp = queueProp;      // 'qp' or 'qm' on options.prm
    this.startLevels = [];           // [[techId, level], ...]
    this.startLevelsByTech = {};
    this.nextLevels = [];            // [[techId, nextLevel], ...]
    this.totals = [0, 0, 0, 0, 0];   // fields, metal, crystal, deut, time
    this.currFields = 0;
    this.maxFields = 0;
    this.robots = 0;
    this.nanites = 0;
  }

  get queue() { return options.prm[this.queueProp]; }
  set queue(v) { options.prm[this.queueProp] = v; }
}

class QueueCalculatorApp {
  constructor() {
    this.calc = new QueueCalculator(options.techCosts);
    this.planet = new TabState(PLANET_TAB, 'qp');
    this.moon = new TabState(MOON_TAB, 'qm');
    this._validationAttached = new WeakSet();
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  init() {
    options.load();
    this._restoreParamsFromState();
    this._restoreStartLevelsFromState();
    this._initInputmask();
    this._bindEvents();
    this._restoreActiveTab();
    this.refreshBoth();
    this._applyTheme();
  }

  _restoreParamsFromState() {
    setVal('#universe-speed', options.prm.universeSpeed);
    setVal('#ion-tech-level', options.prm.ionTechLevel);
    setVal('#hyper-tech-level', options.prm.hyperTechLevel);
    setVal('#total-fields-2', options.prm.totFldPln);
    setVal('#total-fields-3', options.prm.totFldMn);
    const classRadio = $(`#player-class-${options.prm.playerClass}`);
    if (classRadio) classRadio.checked = true;
    setVal('#sc-capacity-increase', options.prm.scCapacityIncrease);
    setVal('#lc-capacity-increase', options.prm.lcCapacityIncrease);
    if (options.prm.sDTP) {
      setVal('#start-2', getDateStr(options.prm.sDTP, options.datetimeFormat));
    }
    if (options.prm.sDTM) {
      setVal('#start-3', getDateStr(options.prm.sDTM, options.datetimeFormat));
    }
  }

  _restoreStartLevelsFromState() {
    if (Array.isArray(options.prm.slp)) {
      for (const [techId, level] of options.prm.slp) {
        setVal(`#startlvl-${PLANET_TAB}-${techId}`, level);
      }
    }
    if (Array.isArray(options.prm.slm)) {
      for (const [techId, level] of options.prm.slm) {
        setVal(`#startlvl-${MOON_TAB}-${techId}`, level);
      }
    }
  }

  _initInputmask() {}

  _restoreActiveTab() {
    const cookie = { value: '2', validate: (k, v) => v };
    loadFromCookie(ACTIVE_TAB_COOKIE, cookie);
    const target = `#tab-${cookie.value}`;
    const trigger = document.querySelector(`[data-bs-target="${target}"]`);
    if (trigger && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
      bootstrap.Tab.getOrCreateInstance(trigger).show();
    }
  }

  _applyTheme() {
    const theme = { value: 'light', validate: (k, v) => v };
    loadFromCookie('theme', theme);
    if (typeof toggleLightBS === 'function') {
      toggleLightBS(theme.value === 'light');
    } else if (typeof toggleLight === 'function') {
      toggleLight(theme.value === 'light');
    }
  }

  // -------------------------------------------------------------------------
  // Event binding
  // -------------------------------------------------------------------------

  _bindEvents() {
    // Tab persistence
    document.querySelectorAll('#mainTabs button[data-bs-toggle="tab"]').forEach((btn) => {
      btn.addEventListener('shown.bs.tab', () => {
        const target = btn.getAttribute('data-bs-target') || '';
        const m = target.match(/tab-(\d+)/);
        if (m) {
          const cookie = { value: m[1], validate: (k, v) => v };
          saveToCookie(ACTIVE_TAB_COOKIE, cookie);
        }
      });
    });

    // Build / destroy buttons in src tables
    document.querySelectorAll(`#tab-${PLANET_TAB} .button-build`).forEach((btn) => {
      this._attachConstrainsFromInput(btn);
      btn.addEventListener('click', (e) => this._onBuildClick(e, this.planet));
    });
    document.querySelectorAll(`#tab-${PLANET_TAB} .button-destroy`).forEach((btn) => {
      btn.addEventListener('click', (e) => this._onDestroyClick(e, this.planet));
    });
    document.querySelectorAll(`#tab-${MOON_TAB} .button-build`).forEach((btn) => {
      btn.addEventListener('click', (e) => this._onBuildClick(e, this.moon));
    });
    document.querySelectorAll(`#tab-${MOON_TAB} .button-destroy`).forEach((btn) => {
      btn.addEventListener('click', (e) => this._onDestroyClick(e, this.moon));
    });

    // Queue row controls — delegate on the dst table
    [PLANET_TAB, MOON_TAB].forEach((tabNum) => {
      const tbl = $(`#table-dst-${tabNum}`);
      if (!tbl) return;
      tbl.addEventListener('click', (e) => this._onDstTableClick(e, tabNum));
    });

    // Clear queue buttons
    addEvent(`#clear-${PLANET_TAB}`, 'click', () => this._clearQueue(this.planet));
    addEvent(`#clear-${MOON_TAB}`, 'click', () => this._clearQueue(this.moon));

    // Reset button
    addEvent('#reset', 'click', () => this._resetParams());

    // Inputs that affect all queues
    ['#universe-speed', '#ion-tech-level', '#hyper-tech-level', '#sc-capacity-increase', '#lc-capacity-increase'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      this._attachConstrains(el);
      addEvent(el, 'change', () => this.refreshBoth());
      addEvent(el, 'keyup', (e) => { validateInputNumber(e); this.refreshBoth(); });
      addEvent(el, 'blur', validateInputNumberOnBlurNative);
    });

    // Player class radios
    document.querySelectorAll('input[name="player-class"]').forEach((radio) => {
      radio.addEventListener('change', () => this.refreshBoth());
    });

    // Per-tab input recompute
    [PLANET_TAB, MOON_TAB].forEach((tabNum) => {
      const refresh = () => this._refreshTab(tabNum);
      document.querySelectorAll(`#tab-${tabNum} input[type=text]`).forEach((input) => {
        if (input.id && input.id.startsWith('start-')) return;
        this._attachConstrains(input);
        input.addEventListener('keyup', (e) => { validateInputNumber(e); refresh(); });
        input.addEventListener('blur', validateInputNumberOnBlurNative);
      });
    });

    // Start datetime inputs
    [PLANET_TAB, MOON_TAB].forEach((tabNum) => {
      const el = $(`#start-${tabNum}`);
      if (!el) return;
      el.addEventListener('keyup', () => this._updateCompletion(tabNum));
      el.addEventListener('blur', () => this._updateCompletion(tabNum));
    });

    // Start-now buttons
    addEvent(`#set-start-now-${PLANET_TAB}`, 'click', () => this._setStartNow(PLANET_TAB));
    addEvent(`#set-start-now-${MOON_TAB}`, 'click', () => this._setStartNow(MOON_TAB));

    // Theme toggle hook (toggle is rendered inside topbar_bs)
    const lightCb = $('#cb-light-theme');
    if (lightCb) {
      lightCb.addEventListener('click', () => {
        if (typeof toggleLightBS === 'function') toggleLightBS(lightCb.checked);
        this.refreshBoth();
      });
    }
  }

  _attachConstrains(input) {
    if (!input || this._validationAttached.has(input)) return;
    if (!input._constrains) input._constrains = { min: 0 };
    this._validationAttached.add(input);
  }

  _attachConstrainsFromInput() { /* placeholder for future use */ }

  // -------------------------------------------------------------------------
  // Queue operations
  // -------------------------------------------------------------------------

  refreshBoth() {
    this._refreshTab(PLANET_TAB);
    this._refreshTab(MOON_TAB);
  }

  _stateFor(tabNum) {
    return tabNum === PLANET_TAB ? this.planet : this.moon;
  }

  _readGlobals() {
    const g = QueueDataCollector.readGlobalParams();
    options.prm.universeSpeed = g.universeSpeed;
    options.prm.ionTechLevel = g.ionTechLevel;
    options.prm.hyperTechLevel = g.hyperTechLevel;
    options.prm.totFldPln = g.totFldPln;
    options.prm.totFldMn = g.totFldMn;
    options.prm.playerClass = g.playerClass;
    options.prm.scCapacityIncrease = g.scCapacityIncrease;
    options.prm.lcCapacityIncrease = g.lcCapacityIncrease;
    return g;
  }

  /**
   * Re-read inputs, validate the queue, recompute totals, and re-render the
   * dst table for one tab.
   */
  _refreshTab(tabNum) {
    const g = this._readGlobals();
    const state = this._stateFor(tabNum);
    state.totals = [0, 0, 0, 0, 0];
    state.maxFields = (tabNum === PLANET_TAB) ? g.totFldPln : g.totFldMn;
    state.robots = 0;
    state.nanites = 0;

    // Read start levels and seed nextLevels with (level+1) so the src table
    // shows the level the next build would produce.
    const { list, byTech } = QueueDataCollector.readStartLevels(tabNum);
    state.startLevels = list;
    state.startLevelsByTech = byTech;
    state.nextLevels = list.map(([techId, lvl]) => [techId, lvl + 1]);

    let currFields = 0;
    for (const [techId, lvl] of list) {
      QueueRenderer.setNextLevel(tabNum, techId, lvl + 1);
      currFields += lvl;
      if (techId === TECH_ROBOT_FACTORY) state.robots = lvl;
      if (tabNum === PLANET_TAB && techId === TECH_NANITE_FACTORY) state.nanites = lvl;
    }
    state.currFields = currFields;
    state.totals[0] = currFields;

    // Persist start levels in cookie state
    if (tabNum === PLANET_TAB) options.prm.slp = list;
    else options.prm.slm = list;

    // Drop demolitions that would push a building below 0
    const queue = state.queue || [];
    QueueCalculator.purgeInvalidDemolitions(queue, byTech);
    state.queue = queue;

    // Re-render queue rows from scratch
    QueueRenderer.clearQueueRows(tabNum);

    const techNames = QueueDataCollector.readTechNames(tabNum);
    let totalFlds = state.maxFields;
    let robots = state.robots;
    let nanites = state.nanites;
    let fontColor = QueueRenderer.rowFontColor(false);

    for (let qi = 0; qi < queue.length; qi++) {
      const [techIdRaw, isBuildRaw] = queue[qi];
      const techId = Number(techIdRaw);
      const isBuild = Number(isBuildRaw) === 1;
      const inc = isBuild ? 1 : -1;

      // Update next-levels mirror
      const nl = state.nextLevels.find((p) => Number(p[0]) === techId);
      if (!nl) continue;
      const resultLevel = isBuild ? nl[1] : nl[1] - 2;
      nl[1] += inc;
      QueueRenderer.setNextLevel(tabNum, techId, nl[1]);

      const costs = this.calc.getStepCost(
        techId, resultLevel, robots, nanites,
        g.universeSpeed, !isBuild, g.ionTechLevel
      );

      if (techId === TECH_ROBOT_FACTORY) robots += inc;
      if (techId === TECH_NANITE_FACTORY && tabNum === PLANET_TAB) nanites += inc;

      // Spacedock (36) doesn't occupy a planet field
      if (techId !== TECH_SHIPYARD) state.totals[0] += inc;

      // Validate against capacity *before* this row's own field bonus —
      // OGame requires a free field to queue any building, including
      // Terraformer/Lunar Base itself.
      fontColor = QueueRenderer.rowFontColor(state.totals[0] > totalFlds);

      // Terraformer (33) increases planet fields capacity
      if (techId === TECH_TERRAFORMER && tabNum === PLANET_TAB) {
        totalFlds += QueueCalculator.terraformerFieldsBonus(resultLevel);
        state.maxFields = totalFlds;
      }
      // Lunar base (41) increases moon fields capacity
      if (techId === TECH_LUNAR_BASE && tabNum === MOON_TAB) {
        totalFlds += QueueCalculator.lunarBaseFieldsBonus();
        state.maxFields = totalFlds;
      }

      state.totals[1] += costs[0];
      state.totals[2] += costs[1];
      state.totals[3] += costs[2];
      state.totals[4] += costs[3];

      const techName = techNames[techId] || String(techId);
      QueueRenderer.appendQueueRow(tabNum, qi, techName, resultLevel, costs, !isBuild, fontColor);
    }

    state.robots = robots;
    state.nanites = nanites;

    QueueRenderer.updateTotals(tabNum, state.totals, totalFlds, fontColor);
    QueueRenderer.updateTransports(tabNum, state.totals, g.hyperTechLevel, g.playerClass, g.scCapacityIncrease, g.lcCapacityIncrease);
    this._updateCompletion(tabNum);
    options.save();
  }

  _onBuildClick(event, state) {
    const btn = event.currentTarget;
    this._hideTooltip(btn);
    const techId = Number.parseInt(btn.getAttribute('data-tech'), 10);
    if (!techId) return;
    state.queue.push([techId, 1]);
    this._refreshTab(state.tabNum);
  }

  _onDestroyClick(event, state) {
    const btn = event.currentTarget;
    this._hideTooltip(btn);
    const techId = Number.parseInt(btn.getAttribute('data-tech'), 10);
    if (!techId || NON_DESTROYABLE_TECHS.has(techId)) return;
    // Don't enqueue a destroy that would push the building below 0
    const projectedLevel = this._projectedLevel(state, techId);
    if (projectedLevel <= 0) return;
    state.queue.push([techId, 0]);
    this._refreshTab(state.tabNum);
  }

  // Hide the Bootstrap tooltip on a freshly clicked button. Without this the
  // button keeps focus after the click and the tooltip (trigger "hover focus")
  // stays visible on top of the button.
  _hideTooltip(el) {
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
    const inst = bootstrap.Tooltip.getInstance(el);
    if (inst) inst.hide();
  }

  _projectedLevel(state, techId) {
    let lvl = state.startLevelsByTech[techId] || 0;
    for (const [t, isBuild] of state.queue) {
      if (Number(t) !== Number(techId)) continue;
      lvl += (Number(isBuild) === 1) ? 1 : -1;
    }
    return lvl;
  }

  _onDstTableClick(event, tabNum) {
    const btn = event.target.closest('button');
    if (!btn) return;
    const rowIdx = Number.parseInt(btn.getAttribute('data-row'), 10);
    if (Number.isNaN(rowIdx)) return;
    const state = this._stateFor(tabNum);
    if (btn.classList.contains('queue-row-up')) {
      this._moveUp(state, rowIdx);
    } else if (btn.classList.contains('queue-row-down')) {
      this._moveUp(state, rowIdx + 1);
    } else if (btn.classList.contains('queue-row-del')) {
      this._delRow(state, rowIdx);
    }
  }

  _moveUp(state, rowIdx) {
    const q = state.queue;
    if (rowIdx <= 0 || rowIdx >= q.length) return;
    // Swap; refresh will validate and redraw.
    const tmp = q[rowIdx - 1];
    q[rowIdx - 1] = q[rowIdx];
    q[rowIdx] = tmp;
    this._refreshTab(state.tabNum);
  }

  _delRow(state, rowIdx) {
    const q = state.queue;
    if (rowIdx < 0 || rowIdx >= q.length) return;
    q.splice(rowIdx, 1);
    this._refreshTab(state.tabNum);
  }

  _clearQueue(state) {
    state.queue = [];
    this._refreshTab(state.tabNum);
  }

  _resetParams() {
    options.prm.universeSpeed = 1;
    options.prm.ionTechLevel = 0;
    options.prm.hyperTechLevel = 0;
    options.prm.playerClass = 0;
    options.prm.scCapacityIncrease = 0;
    options.prm.lcCapacityIncrease = 0;
    options.prm.sDTP = 0;
    options.prm.sDTM = 0;
    options.prm.qp = [];
    options.prm.qm = [];

    setVal('#universe-speed', 1);
    setVal('#ion-tech-level', 0);
    setVal('#hyper-tech-level', 0);
    const classRadio0 = $('#player-class-0');
    if (classRadio0) classRadio0.checked = true;
    setVal('#sc-capacity-increase', 0);
    setVal('#lc-capacity-increase', 0);
    setVal('#total-fields-2', options.defPlfFlds);
    setVal('#total-fields-3', options.defMnFlds);
    setVal('#start-2', '');
    setVal('#start-3', '');

    // Clear all start-level inputs in both src tables
    [PLANET_TAB, MOON_TAB].forEach((tabNum) => {
      document.querySelectorAll(`#table-src-${tabNum} input[type=text]`).forEach((inp) => {
        inp.value = 0;
      });
    });

    this.refreshBoth();
  }

  // -------------------------------------------------------------------------
  // Start datetime / completion
  // -------------------------------------------------------------------------

  _setStartNow(tabNum) {
    const ts = Date.now();
    if (tabNum === PLANET_TAB) options.prm.sDTP = ts;
    else options.prm.sDTM = ts;
    setVal(`#start-${tabNum}`, getDateStr(ts, options.datetimeFormat));
    this._updateCompletion(tabNum);
  }

  _updateCompletion(tabNum) {
    const startEl = $(`#start-${tabNum}`);
    if (!startEl) return;
    const raw = QueueDataCollector.readStartDateTime(tabNum);
    const showResult = this._validateDateField(`start-${tabNum}`);
    const t = parseDate(raw, options.datetimeFormat);
    if (tabNum === PLANET_TAB) options.prm.sDTP = t;
    else options.prm.sDTM = t;

    const totals = this._stateFor(tabNum).totals;
    if (showResult && totals[4] > 0 && t > 0) {
      QueueRenderer.setFinishMoment(tabNum, getDateStr(t + totals[4] * 1000, options.datetimeFormat));
    } else {
      QueueRenderer.setFinishMoment(tabNum, '?');
    }
    options.save();
  }

  _validateDateField(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const val = el.value;
    const empty = val === '' || /^[\s_./:-]*$/.test(val);
    const parsed = parseDate(val, options.datetimeFormat);
    if (val.indexOf('_') >= 0 || parsed === 0) {
      if (empty) {
        el.classList.remove('is-invalid');
      } else {
        el.classList.add('is-invalid');
      }
      return false;
    }
    el.classList.remove('is-invalid');
    return true;
  }
}

let queueApp = null;

function initializeQueueCalculator() {
  if (!options || !options.techCosts) {
    console.error('initializeQueueCalculator: options.techCosts missing');
    return;
  }
  queueApp = new QueueCalculatorApp();
  queueApp.init();
}

if (typeof globalThis !== 'undefined') {
  globalThis.initializeQueueCalculator = initializeQueueCalculator;
  globalThis.QueueCalculatorApp = QueueCalculatorApp;
}
