// ============================================================================
// THIN SHIM
//
// This file keeps the global contract expected by lfcosts.tpl:
//   - var options  (TPL writes techCosts, display strings, etc. into it)
//   - function initializeLfCostsCalculator()  (TPL calls this at DOMContentLoaded)
//
// All logic has moved to the layered files loaded before this one:
//   lfcosts-core.js → lfcosts-data-collector.js → lfcosts-renderer.js → lfcosts-orchestration.js
//
// Global wrapper functions (updateRow, updateParams, etc.) exist here because
// utils.js uses eval(event.data).apply(input) to call them by name.
// ============================================================================

var options = {
    defConstraints: {
        min: -Infinity,
        max: Infinity,
        def: 0,
        allowFloat: false,
        allowNegative: false
    },
    prm: {
        robotFactoryLevel: 0,
        naniteFactoryLevel: 0,
        universeSpeed: 1,
        ionTechLevel: 0,
        hyperTechLevel: 0,
        playerClass: 0,
        fullNumbers: false,
        tabsState: "",
        capIncrSC: 0,
        capIncrLC: 0,
        megalithLvl: 0,
        mineralResCntrLvl: 0,
        researchCostReduction: 0,
        researchTimeReduction: 0,

        validate: function (field, value) {
            switch (field) {
                case 'robotFactoryLevel':     return validateNumber(Number.parseFloat(value), 0, 100, 0);
                case 'naniteFactoryLevel':    return validateNumber(Number.parseFloat(value), 0, 100, 0);
                case 'universeSpeed':         return validateNumber(Number.parseFloat(value), 1, 10,  1);
                case 'ionTechLevel':          return validateNumber(Number.parseFloat(value), 0, 50,  0);
                case 'hyperTechLevel':        return validateNumber(Number.parseFloat(value), 0, 50,  0);
                case 'playerClass':           return validateNumber(Number.parseFloat(value), 0, 2,   0);
                case 'fullNumbers':           return value === 'true';
                case 'capIncrSC':             return validateNumber(Number.parseFloat(value), 0, 1000, 0);
                case 'capIncrLC':             return validateNumber(Number.parseFloat(value), 0, 1000, 0);
                case 'megalithLvl':           return validateNumber(Number.parseFloat(value), 0, 100, 0);
                case 'mineralResCntrLvl':     return validateNumber(Number.parseFloat(value), 0, 100, 0);
                case 'researchCostReduction': return validateNumber(Number.parseFloat(value), 0, 25,  0);
                case 'researchTimeReduction': return validateNumber(Number.parseFloat(value), 0, 99,  0);
                default: return value;
            }
        }
    },

    load: function () {
        try {
            loadFromCookie('options_lfcosts', options.prm);
        } catch (e) {
            alert(e);
        }
    },

    save: function () {
        saveToCookie('options_lfcosts', options.prm);
    },

    techData: {},
};

// ============================================================================
// Orchestrator singleton — created in initializeLfCostsCalculator
// ============================================================================

var _lfOrchestrator = null;

// ============================================================================
// Global wrapper functions required by utils.js eval() callbacks
// ============================================================================

function updateRow()       { _lfOrchestrator.handleRowChange(this); }
function updateParams()    { _lfOrchestrator.handleParamChange(); }
function spreadValue()     { _lfOrchestrator.handleResourceInput(this); }
function updateOneMultTab() { _lfOrchestrator.updateTab3(); }
function resetParams()     { _lfOrchestrator.resetParams(); }

// ============================================================================
// Entry point called by lfcosts.tpl at DOMContentLoaded
// ============================================================================

function initializeLfCostsCalculator() {
    _lfOrchestrator = new LfCostsOrchestrator(options);
    _lfOrchestrator.init();
}
