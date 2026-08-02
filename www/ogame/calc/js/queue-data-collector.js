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
    // Every user-entered number goes through getInputNumber: it honours the
    // locale decimal separator, which a bare parseFloat would swallow (RU "5,4"
    // would read as 5). The universe speed is a <select> whose option values are
    // authored with a canonical dot, so it is read straight off the element.
    const num = (selector) => getInputNumber($(selector));
    const universeSpeed = Number.parseFloat(getVal('#universe-speed')) || 1;
    const ionTechLevel = Math.trunc(num('#ion-tech-level'));
    const hyperTechLevel = Math.trunc(num('#hyper-tech-level'));
    const totFldPln = Math.trunc(num('#total-fields-2'));
    const totFldMn = Math.trunc(num('#total-fields-3'));
    const checkedClass = checkedRadio('player-class');
    const playerClass = checkedClass ? Number.parseInt(checkedClass.value, 10) : 0;
    const scCapacityIncrease = num('#sc-capacity-increase');
    const lcCapacityIncrease = num('#lc-capacity-increase');
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
      // Levels are whole numbers, but the value still passes through the
      // locale-aware reader so a pasted "1,5" cannot be read as 15.
      const level = input ? Math.trunc(getInputNumber(input)) : 0;
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
   * Read the datetime string from a start-N input. The field is masked by
   * attachInputMask (dom-utils), which keeps the value in the display format,
   * so the raw value is what parseDate expects.
   */
  static readStartDateTime(tabNum) {
    const el = inputEl(`#start-${tabNum}`);
    return el ? el.value : '';
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { QueueDataCollector });
}
