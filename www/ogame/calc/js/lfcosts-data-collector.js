// ============================================================================
// DATA COLLECTOR — DOM → data models
// ============================================================================

class LfDataCollector {
    /**
     * Read all calculator parameters from the DOM.
     * Returns a plain params object; also resolves playerClass from radio buttons.
     */
    collectParams() {
        const playerClass = document.getElementById('class-2').checked ? 2 :
                            document.getElementById('class-1').checked ? 1 : 0;
        return {
            robotFactoryLevel:    getInputNumber(document.getElementById('robot-factory-level')),
            naniteFactoryLevel:   getInputNumber(document.getElementById('nanite-factory-level')),
            universeSpeed:        document.getElementById('universe-speed').value,
            ionTechLevel:         getInputNumber(document.getElementById('ion-tech-level')),
            hyperTechLevel:       getInputNumber(document.getElementById('hyper-tech-level')),
            fullNumbers:          document.getElementById('full-numbers').checked,
            capIncrSC:            getInputNumber(document.getElementById('sc-capacity-increase')),
            capIncrLC:            getInputNumber(document.getElementById('lc-capacity-increase')),
            megalithLvl:          getInputNumber(document.getElementById('megalith-level')),
            mineralResCntrLvl:    getInputNumber(document.getElementById('mrc-level')),
            researchCostReduction:getInputNumber(document.getElementById('research-cost-reduction')),
            researchTimeReduction:getInputNumber(document.getElementById('research-time-reduction')),
            race:                 Number(document.getElementById('race-selector').value),
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
        const sel = document.getElementById(`research-race-dd-${outerTab}`);
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
            techID:    Number(document.getElementById('tech-types-select').value),
            levelFrom: getInputNumber(document.getElementById('tab2-from-level')),
            levelTo:   getInputNumber(document.getElementById('tab2-to-level')),
        };
    }
}
