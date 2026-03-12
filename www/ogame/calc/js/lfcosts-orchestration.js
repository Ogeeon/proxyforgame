// ============================================================================
// ORCHESTRATOR — owns all state, wires events, delegates to layers
// ============================================================================

class LfCostsOrchestrator {
    constructor(opts) {
        this.opts       = opts;          // the global options object (TPL writes into it)
        this.calculator = new LfCalculator(opts.techCosts);
        this.collector  = new LfDataCollector();
        this.renderer   = new LfRenderer(opts);
        this.techData   = opts.techData; // shared reference — keeps cookie save working
    }

    // -------------------------------------------------------------------------
    // init — replaces initializeLfCostsCalculator body
    // -------------------------------------------------------------------------

    init() {
        // Tab-state persistence
        document.getElementById('mainTabs').addEventListener('shown.bs.tab', () => this.storeTabsState());
        const innerTabs0 = document.getElementById('innerTabs0');
        const innerTabs1 = document.getElementById('innerTabs1');
        if (innerTabs0) innerTabs0.addEventListener('shown.bs.tab', () => this.storeTabsState());
        if (innerTabs1) innerTabs1.addEventListener('shown.bs.tab', () => this.storeTabsState());

        this.opts.load();
        this._restoreInputsFromPrm();

        // Table inputs (outer tabs 0 and 1)
        ['tab-0', 'tab-1'].forEach(tabId => {
            document.querySelectorAll(`#${tabId} input[type=text]`).forEach(inp => {
                inp.addEventListener('input', function (e) {
                    validateInputNumber({ currentTarget: this, data: 'updateRow' });
                });
            });
        });

        // Tab 3 inputs
        document.querySelectorAll('#tab-2 input[type=text]').forEach(inp => {
            inp.addEventListener('input', function (e) {
                validateInputNumber({ currentTarget: this, data: 'updateOneMultTab' });
            });
            inp.addEventListener('blur', function (e) {
                validateInputNumberOnBlur({ currentTarget: this, data: 'updateOneMultTab' });
            });
        });

        // General settings
        document.querySelectorAll('#general-settings input[type=text]').forEach(inp =>
            inp.addEventListener('input', function (e) {
                validateInputNumber({ currentTarget: this, data: 'updateParams' });
            }));
        document.querySelectorAll('#general-settings select').forEach(sel => {
            sel.addEventListener('keyup', updateParams);
            sel.addEventListener('change', updateParams);
        });
        document.querySelectorAll('#general-settings input[type=radio]').forEach(r =>
            r.addEventListener('click', updateParams));
        document.getElementById('full-numbers').addEventListener('click', updateParams);
        document.getElementById('reset').addEventListener('click', resetParams);
        document.getElementById('tech-types-select').addEventListener('change', updateOneMultTab);
        document.getElementById('race-selector').addEventListener('change', () => this.handleRaceChange());

        // Available-resource inputs — spread across all tabs
        for (let outer = 0; outer < 3; outer++) {
            for (let inner = 1; inner < 3; inner++) {
                ['metal', 'crystal', 'deut'].forEach(res => {
                    const el = document.getElementById(`${res}-available-${outer}-${inner}`);
                    if (el) {
                        el.addEventListener('input', function (e) {
                            validateInputNumber({ currentTarget: this, data: 'spreadValue' });
                        });
                    }
                });
            }
        }

        // Input constraints
        document.getElementById('sc-capacity-increase')._constrains  = { min: 0, max: 1000, def: 0, allowFloat: true,  allowNegative: false };
        document.getElementById('lc-capacity-increase')._constrains  = { min: 0, max: 1000, def: 0, allowFloat: true,  allowNegative: false };
        document.getElementById('megalith-level')._constrains        = { min: 0, max: 100,  def: 0, allowFloat: false, allowNegative: false };
        document.getElementById('mrc-level')._constrains             = { min: 0, max: 100,  def: 0, allowFloat: false, allowNegative: false };
        document.getElementById('research-cost-reduction')._constrains = { min: 0, max: 25, def: 0, allowFloat: true,  allowNegative: false };
        document.getElementById('research-time-reduction')._constrains = { min: 0, max: 99, def: 0, allowFloat: true,  allowNegative: false };

        let theme = { value: 'light', validate: function (key, val) { return val; } };
        loadFromCookie('theme', theme);
        toggleLightBS(theme.value === 'light');
        const cbLight = document.getElementById('cb-light-theme');
        if (cbLight) cbLight.addEventListener('click', function () { toggleLightBS(this.checked); });

        this.restoreTabsState();
        this.renderer.renderHideNShow(Number(document.getElementById('race-selector').value));
        this.updateTotals();
        this.updateTab3();
    }

    // -------------------------------------------------------------------------
    // handleRowChange — replaces updateRow (called via eval with this=input)
    // -------------------------------------------------------------------------

    handleRowChange(inputEl) {
        const row = inputEl.parentNode.parentNode;
        const techID = Number(row.children[0].innerHTML);
        if (!(techID > 0)) return;

        const tblID = row.parentNode.parentNode.id;
        const parts = tblID.split(/-/);
        if (parts.length < 3) return;

        const outerTab = Number(parts[1]);
        const innerTab = Number(parts[2]);
        const rowKey   = techID + '-' + outerTab + '-' + innerTab;

        let levelFrom, levelTo;
        if (outerTab === 1) {
            levelFrom = 1 * row.children[2].children[0].value;
            levelTo   = 1 * row.children[3].children[0].value;
        } else {
            levelTo   = 1 * row.children[2].children[0].value;
            levelFrom = levelTo === 0 ? 0 : levelTo - 1;
        }

        const params      = this.collector.collectParams();
        const rsrCostRdc  = params.researchCostReduction;
        const ionTechLevel = (levelTo > levelFrom) ? 0 : params.ionTechLevel;
        const bldCostRdc  = this.calculator.computeBldCostRdc(techID, params.race, params.megalithLvl, params.mineralResCntrLvl);

        // Для зданий возможен снос, по остальным техам — новый уровень должен быть строго больше старого
        const isBuilding = techID % 1000 < 100;
        if ((levelTo > levelFrom || isBuilding) && levelTo >= 0) {
            const result = this.calculator.calculate(techID, levelFrom, levelTo, ionTechLevel, rsrCostRdc, bldCostRdc, params);
            if (result.time > 0) {
                this.renderer.renderRow(row, outerTab, techID, result);
                this.techData[rowKey] = [result.metal, result.crystal, result.deut, result.energy, result.time, result.points];
            } else {
                this.renderer.clearRow(row, outerTab);
                this.techData[rowKey] = null;
            }
        } else {
            const fdc = outerTab === 1 ? 4 : 3;
            row.children[fdc    ].innerHTML = '0';
            row.children[fdc + 1].innerHTML = '0';
            row.children[fdc + 2].innerHTML = '0';
            row.children[fdc + 3].innerHTML = '0' + this.opts.datetimeS;
            row.children[fdc + 4].innerHTML = '0';
            if (outerTab === 0) row.children[fdc + 5].innerHTML = '0';
            this.techData[rowKey] = null;
        }

        this.updateTotals();
    }

    // -------------------------------------------------------------------------
    // handleParamChange — replaces updateParams
    // -------------------------------------------------------------------------

    handleParamChange() {
        const params = this.collector.collectParams();
        // Write back to opts.prm so cookie save picks up latest values
        Object.assign(this.opts.prm, params);

        const techTypes   = new Set([1, 2]);
        const needUpd     = { 0: false, 1: false };
        const rsrCostRdc  = params.researchCostReduction;
        const ionTechLevel = params.ionTechLevel;

        Object.entries(this.techData).forEach(([key, value]) => {
            if (value == null) return;
            const keyParts = key.split(/-/);
            if (!techTypes.has(1 * keyParts[2])) return;

            const outerTab = keyParts[1] * 1;
            const innerTab = keyParts[2] * 1;
            const rows     = getTableRows(`#table-${outerTab}-${innerTab}`);

            for (let idx = 1; idx < rows.length; idx++) {
                const rowID = rows[idx].children[0].innerHTML;
                if (rowID !== keyParts[0]) continue;

                let levelFrom, levelTo;
                if (outerTab === 1) {
                    levelFrom = 1 * rows[idx].children[2].children[0].value;
                    levelTo   = 1 * rows[idx].children[3].children[0].value;
                } else {
                    levelTo   = 1 * rows[idx].children[2].children[0].value;
                    levelFrom = levelTo === 0 ? 0 : levelTo - 1;
                }

                const techID     = Number(rowID);
                const bldCostRdc = this.calculator.computeBldCostRdc(techID, params.race, params.megalithLvl, params.mineralResCntrLvl);
                const result     = this.calculator.calculate(techID, levelFrom, levelTo, ionTechLevel, rsrCostRdc, bldCostRdc, params);

                if (result.time > 0) {
                    this.techData[key][0] = result.metal;
                    this.techData[key][1] = result.crystal;
                    this.techData[key][2] = result.deut;
                    this.techData[key][3] = result.energy;
                    this.techData[key][4] = result.time;
                    this.techData[key][5] = result.points;
                    this.renderer.renderRow(rows[idx], outerTab, techID, result);
                } else {
                    this.renderer.clearRow(rows[idx], outerTab);
                    this.techData[key] = null;
                }
                needUpd[outerTab] = true;
            }
        });

        this.updateTotals(needUpd);
        this.updateTab3();
    }

    // -------------------------------------------------------------------------
    // updateTotals — replaces updateTotals
    // -------------------------------------------------------------------------

    updateTotals(needUpd) {
        const params = this.collector.collectParams();
        Object.assign(this.opts.prm, params);

        for (let outer = 0; outer < 2; outer++) {
            if (needUpd?.[outer] === false) continue;

            const innerNums  = [1, 2];
            const grandTotals = { metal: 0, crystal: 0, deut: 0, time: 0, points: 0 };

            for (const inner of innerNums) {
                const rows   = getTableRows(`#table-${outer}-${inner}`);
                const totals = { metal: 0, crystal: 0, deut: 0, time: 0, points: 0 };

                for (let row = 1; row < rows.length - FOOTER_ROWS; row++) {
                    const techID = rows[row].children[0].innerHTML;
                    const rowKey = techID + '-' + outer + '-' + inner;
                    const cached = this.techData[rowKey];
                    if (cached) {
                        totals.metal   += cached[0];
                        totals.crystal += cached[1];
                        totals.deut    += cached[2];
                        totals.time    += cached[4];
                        totals.points  += cached[5];
                    }
                }

                this.renderer.renderSubtotals(outer, inner, totals);

                grandTotals.metal   += totals.metal;
                grandTotals.crystal += totals.crystal;
                grandTotals.deut    += totals.deut;
                grandTotals.time    += totals.time;
                grandTotals.points  += totals.points;
            }

            // Grand totals are the same for both inner tabs, but available resources differ
            for (const inner of innerNums) {
                const availRes = this.collector.collectAvailableResources(outer, inner);
                const totalRes = Math.max(0, grandTotals.metal - availRes.metal)
                               + Math.max(0, grandTotals.crystal - availRes.crystal)
                               + Math.max(0, grandTotals.deut - availRes.deut);
                const { needSC, needLC } = this.calculator.calculateShipCount(totalRes, params);
                this.renderer.renderGrandTotals(outer, inner, grandTotals, availRes, needSC, needLC);
            }
        }

        this.opts.save();
        this.renderer.initTooltips();
    }

    // -------------------------------------------------------------------------
    // updateTab3 — replaces updateOneMultTab
    // -------------------------------------------------------------------------

    updateTab3() {
        const params = this.collector.collectParams();
        Object.assign(this.opts.prm, params);

        const { techID, levelFrom, levelTo } = this.collector.collectTab3Request();
        const tbl = document.getElementById('commons-table');

        if (techID == 0) {
            this.renderer.renderTab3Empty(tbl);
            this.renderer.initTooltips();
            return;
        }

        // Capture focused resource input before DOM rebuild
        const inputs = ['metal', 'crystal', 'deut'];
        let focusedInputId = null;
        inputs.forEach(input => {
            const el = document.getElementById(`${input}-available-2-1`);
            if (el && el === document.activeElement) focusedInputId = `${input}-available-2-1`;
        });

        const rsrCostRdc  = params.researchCostReduction;
        const ionTechLevel = (levelTo > levelFrom) ? 0 : params.ionTechLevel;
        const bldCostRdc  = this.calculator.computeBldCostRdc(techID, params.race, params.megalithLvl, params.mineralResCntrLvl);

        const rowResults = [];
        const totals = { metal: 0, crystal: 0, deut: 0, time: 0, points: 0 };

        for (let i = levelFrom; i < levelTo; i++) {
            const result = this.calculator.calculate(techID, i, i + 1, ionTechLevel, rsrCostRdc, bldCostRdc, params);
            rowResults.push({ level: i + 1, result });
            totals.metal   += result.metal;
            totals.crystal += result.crystal;
            totals.deut    += result.deut;
            totals.time    += result.time;
            totals.points  += result.points;
        }

        this.renderer.renderTab3Rows(tbl, rowResults, focusedInputId);

        const availRes = this.collector.collectAvailableResources(2, 1);
        const totalRes = totals.metal + totals.crystal + totals.deut;
        const { needSC, needLC } = this.calculator.calculateShipCount(totalRes, params);
        this.renderer.renderTab3Totals(tbl, totals, availRes, needSC, needLC);

        this.opts.save();
        this.renderer.initTooltips();
    }

    // -------------------------------------------------------------------------
    // handleRaceChange — replaces hideNShowItems
    // -------------------------------------------------------------------------

    handleRaceChange() {
        const race = Number(document.getElementById('race-selector').value);
        this.renderer.renderHideNShow(race);
        this.updateTab3();
    }

    // -------------------------------------------------------------------------
    // handleResourceInput — replaces spreadValue (called via eval with this=input)
    // -------------------------------------------------------------------------

    handleResourceInput(inputEl) {
        const type  = inputEl.id.match(/metal|crystal|deut/)[0];
        const value = getInputNumber(document.getElementById(inputEl.id));
        for (let outer = 0; outer < 3; outer++) {
            for (let inner = 1; inner < 3; inner++) {
                const el = document.getElementById(`${type}-available-${outer}-${inner}`);
                if (el) el.value = value;
            }
        }
        this.handleParamChange();
    }

    // -------------------------------------------------------------------------
    // resetParams — replaces resetParams
    // -------------------------------------------------------------------------

    resetParams() {
        const prm = this.opts.prm;
        prm.robotFactoryLevel    = 0;
        prm.naniteFactoryLevel   = 0;
        prm.universeSpeed        = 0;
        prm.ionTechLevel         = 0;
        prm.hyperTechLevel       = 0;
        prm.playerClass          = 0;
        prm.fullNumbers          = false;
        prm.capIncrSC            = 0;
        prm.capIncrLC            = 0;
        prm.megalithLvl          = 0;
        prm.mineralResCntrLvl   = 0;
        prm.researchCostReduction = 0;
        prm.researchTimeReduction = 0;

        setVal('#robot-factory-level', prm.robotFactoryLevel);
        setVal('#nanite-factory-level', prm.naniteFactoryLevel);
        setVal('#universe-speed', prm.universeSpeed);
        setVal('#ion-tech-level', prm.ionTechLevel);
        setVal('#hyper-tech-level', prm.hyperTechLevel);
        setVal('#sc-capacity-increase', prm.capIncrSC);
        setVal('#lc-capacity-increase', prm.capIncrLC);
        setVal('#megalith-level', prm.megalithLvl);
        setVal('#mrc-level', prm.mineralResCntrLvl);
        setVal('#research-cost-reduction', prm.researchCostReduction);
        setVal('#research-time-reduction', prm.researchTimeReduction);

        for (let outer = 0; outer < 2; outer++) {
            for (const inner of [1, 2]) {
                const rows = getTableRows(`#table-${outer}-${inner}`);
                for (let row = 1; row < rows.length - FOOTER_ROWS; row++) {
                    this.renderer.clearRow(rows[row], outer);
                }
            }
        }
        Object.keys(this.techData).forEach(key => { this.techData[key] = null; });

        setVal('#tech-types-select', 1);
        setVal('#tab2-from-level', 0);
        setVal('#tab2-to-level', 0);
        setChecked(`#class-${prm.playerClass}`, true);
        setChecked('#full-numbers', false);
        this._clearAvailableResourceInputs();

        this.updateTotals();
        this.updateTab3();
    }

    // -------------------------------------------------------------------------
    // Tab state persistence
    // -------------------------------------------------------------------------

    storeTabsState() {
        const activeMain   = document.querySelector('#mainTabs .nav-link.active');
        const activeInner0 = document.querySelector('#innerTabs0 .nav-link.active');
        const activeInner1 = document.querySelector('#innerTabs1 .nav-link.active');
        this.opts.prm.tabsState = [
            activeMain   ? activeMain.dataset.bsTarget   : '',
            activeInner0 ? activeInner0.dataset.bsTarget : '',
            activeInner1 ? activeInner1.dataset.bsTarget : ''
        ].join('^');
        this.opts.save();
    }

    restoreTabsState() {
        if (!this.opts.prm.tabsState) return;
        const [t0, t1, t2] = this.opts.prm.tabsState.split('^');
        if (t0) {
            const btn = document.querySelector(`#mainTabs [data-bs-target="${t0}"]`);
            if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
        }
        if (t1) {
            const btn = document.querySelector(`#innerTabs0 [data-bs-target="${t1}"]`);
            if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
        }
        if (t2) {
            const btn = document.querySelector(`#innerTabs1 [data-bs-target="${t2}"]`);
            if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    _restoreInputsFromPrm() {
        const prm = this.opts.prm;
        setVal('#robot-factory-level', prm.robotFactoryLevel);
        setVal('#nanite-factory-level', prm.naniteFactoryLevel);
        setVal('#universe-speed', prm.universeSpeed);
        setVal('#ion-tech-level', prm.ionTechLevel);
        setVal('#hyper-tech-level', prm.hyperTechLevel);
        setVal('#tech-types-select', 1);
        setVal('#tab2-from-level', 0);
        setVal('#tab2-to-level', 0);
        setChecked(`#class-${prm.playerClass}`, true);
        setChecked('#full-numbers', prm.fullNumbers);
        setVal('#sc-capacity-increase', prm.capIncrSC);
        setVal('#lc-capacity-increase', prm.capIncrLC);
        setVal('#megalith-level', prm.megalithLvl);
        setVal('#mrc-level', prm.mineralResCntrLvl);
        setVal('#research-cost-reduction', prm.researchCostReduction);
        setVal('#research-time-reduction', prm.researchTimeReduction);
    }

    _clearAvailableResourceInputs() {
        for (let outer = 0; outer < 3; outer++) {
            for (let inner = 1; inner < 3; inner++) {
                ['metal', 'crystal', 'deut'].forEach(res => {
                    const el = document.getElementById(`${res}-available-${outer}-${inner}`);
                    if (el) el.value = 0;
                });
            }
        }
    }
}
