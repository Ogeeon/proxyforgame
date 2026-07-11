// ============================================================================
// QUEUE CALCULATOR - DATA COLLECTOR
// ============================================================================
// Reads form/input state from the DOM into plain objects consumable by the
// orchestrator. No DOM mutation here.

'use strict';

class QueueDataCollector {
  /**
   * Read top-level globals (universe speed, ion/hyper tech, total-fields per tab).
   */
  static readGlobalParams() {
    const universeSpeed = Number.parseFloat(getVal('#universe-speed')) || 1;
    const ionTechLevel = Number.parseFloat(getVal('#ion-tech-level')) || 0;
    const hyperTechLevel = Number.parseFloat(getVal('#hyper-tech-level')) || 0;
    const totFldPln = Number.parseInt(getVal('#total-fields-2'), 10) || 0;
    const totFldMn = Number.parseInt(getVal('#total-fields-3'), 10) || 0;
    const checkedClass = document.querySelector('input[name="player-class"]:checked');
    const playerClass = checkedClass ? Number.parseInt(checkedClass.value, 10) : 0;
    const scCapacityIncrease = Number.parseFloat(getVal('#sc-capacity-increase')) || 0;
    const lcCapacityIncrease = Number.parseFloat(getVal('#lc-capacity-increase')) || 0;
    return { universeSpeed, ionTechLevel, hyperTechLevel, totFldPln, totFldMn, playerClass, scCapacityIncrease, lcCapacityIncrease };
  }

  /**
   * Read all start-level inputs from a src table, in display order.
   * Returns an array of [techId, level] tuples plus a tech->level map.
   */
  static readStartLevels(tabNum) {
    const rows = getTableRows(`#table-src-${tabNum}`);
    const list = [];
    const byTech = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const idCell = row.cells[0];
      const inputCell = row.cells[2];
      if (!idCell || !inputCell) continue;
      const techId = Number.parseInt(idCell.textContent, 10);
      const input = inputCell.querySelector('input');
      const level = input ? (Number.parseInt(input.value, 10) || 0) : 0;
      list.push([techId, level]);
      byTech[techId] = level;
    }
    return { list, byTech };
  }

  /**
   * Read the localized name of a tech as it appears in the src table (used
   * when appending rows to the dst table).
   */
  static readTechNames(tabNum) {
    const rows = getTableRows(`#table-src-${tabNum}`);
    const names = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const idCell = row.cells[0];
      const nameCell = row.cells[1];
      if (!idCell || !nameCell) continue;
      const techId = Number.parseInt(idCell.textContent, 10);
      names[techId] = nameCell.textContent.trim();
    }
    return names;
  }

  /**
   * Read the unmasked datetime string from a start-N input (Inputmask v5).
   * Falls back to the raw value when Inputmask isn't attached.
   */
  static readStartDateTime(tabNum) {
    const el = $(`#start-${tabNum}`);
    if (!el) return '';
    if (el.inputmask && typeof el.inputmask.unmaskedvalue === 'function') {
      return el.inputmask.unmaskedvalue();
    }
    return el.value || '';
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { QueueDataCollector });
}
