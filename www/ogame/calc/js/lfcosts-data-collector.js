// ============================================================================
// DATA COLLECTOR — DOM → data models
// ============================================================================

class LfDataCollector {
    /**
     * Read all calculator parameters from the DOM.
     * Returns a plain params object; also resolves playerClass from radio buttons.
     */
    collectParams() {
        let playerClass = 0;
        if (inputEl('#class-2').checked) {
            playerClass = 2;
        } else if (inputEl('#class-1').checked) {
            playerClass = 1;
        }
        return {
            robotFactoryLevel:    getInputNumber(document.getElementById('robot-factory-level')),
            naniteFactoryLevel:   getInputNumber(document.getElementById('nanite-factory-level')),
            universeSpeed:        selectEl('#universe-speed').value,
            ionTechLevel:         getInputNumber(document.getElementById('ion-tech-level')),
            hyperTechLevel:       getInputNumber(document.getElementById('hyper-tech-level')),
            fullNumbers:          inputEl('#full-numbers').checked,
            capIncrSC:            getInputNumber(document.getElementById('sc-capacity-increase')),
            capIncrLC:            getInputNumber(document.getElementById('lc-capacity-increase')),
            megalithLvl:          getInputNumber(document.getElementById('megalith-level')),
            mineralResCntrLvl:    getInputNumber(document.getElementById('mrc-level')),
            resCentreLvl:         getInputNumber(document.getElementById('research-centre-level')),
            runeTechLvl:          getInputNumber(document.getElementById('rune-tech-level')),
            rbtResCentreLvl:      getInputNumber(document.getElementById('rbt-res-centre-level')),
            vortexChamberLvl:     getInputNumber(document.getElementById('vortex-chamber-level')),
            researchCostReduction:getInputNumber(document.getElementById('research-cost-reduction')),
            researchTimeReduction:getInputNumber(document.getElementById('research-time-reduction')),
            race:                 Number(selectEl('#race-selector').value),
            researchRaceOneLevel: this.collectResearchRace(0),
            researchRaceMultLevel:this.collectResearchRace(1),
            playerClass,
            rates: [
                getInputNumber(document.getElementById('exchange-rates-m')) || 1,
                getInputNumber(document.getElementById('exchange-rates-c')) || 1.5,
                getInputNumber(document.getElementById('exchange-rates-d')) || 3,
            ],
        };
    }

    collectResearchRace(outerTab) {
        const sel = selectEl(`#research-race-dd-${outerTab}`);
        return sel ? Number(sel.value) : 1;
    }

    /**
     * Read available resource inputs for a given outer+inner tab combination.
     */
    collectAvailableResources(outerTab, innerTab) {
        return {
            metal:   getInputNumber(document.getElementById(`metal-available-${outerTab}-${innerTab}`)),
            crystal: getInputNumber(document.getElementById(`crystal-available-${outerTab}-${innerTab}`)),
            deut:    getInputNumber(document.getElementById(`deut-available-${outerTab}-${innerTab}`)),
        };
    }

    /**
     * Read the tech-select + level range inputs for Tab 3.
     */
    collectTab3Request() {
        return {
            techID:    Number(selectEl('#tech-types-select').value),
            levelFrom: getInputNumber(document.getElementById('tab2-from-level')),
            levelTo:   getInputNumber(document.getElementById('tab2-to-level')),
        };
    }
}
