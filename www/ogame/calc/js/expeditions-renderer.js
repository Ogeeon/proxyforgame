// ============================================================================
// EXPEDITIONS CALCULATOR - RENDERER
// ============================================================================
// Writes the computed result to the DOM: the maximum expedition points, the
// storage capacity, the resource and Dark Matter finds and the per-ship
// "can it be found / how many" columns.

'use strict';

class ExpeditionsRenderer {
  static formatNumber(value) {
    return numToOGame(value);
  }

  /** Highlight a value that is worth reading (a non-zero find). */
  static setEmphasis(selector, on) {
    const el = $(selector);
    if (el) el.classList.toggle('fw-bold', on);
  }

  /**
   * Maximum expedition points, followed by the number of large cargoes needed
   * to bring such a find home.
   */
  static renderMaxPoints(r) {
    const abbrev = getOptionValue('largeCargoAbbrev', 'LC');
    setTextContent('#max-points',
      ExpeditionsRenderer.formatNumber(r.maxPoints) + ' (' + r.minLC + ' ' + abbrev + ')');
  }

  /**
   * Fleet capacity and the resource find. The capacity is italicised when the
   * find would be larger than what the fleet can carry.
   */
  static renderResources(r) {
    setTextContent('#storage-capacity', ExpeditionsRenderer.formatNumber(r.capacity));
    const capacityEl = $('#storage-capacity');
    if (capacityEl) capacityEl.style.fontStyle = r.capacityExceeded ? 'italic' : 'normal';

    setTextContent('#max-find-met', ExpeditionsRenderer.formatNumber(r.maxFindMetal));
    setTextContent('#max-find-cry', ExpeditionsRenderer.formatNumber(r.maxFindCrystal));
    setTextContent('#max-find-deu', ExpeditionsRenderer.formatNumber(r.maxFindDeuterium));
    setTextContent('#dark-matter-find', ExpeditionsRenderer.formatNumber(r.darkMatter));
  }

  /** The "can be found" / "how many are found" columns of the fleet table. */
  static renderFinds(r) {
    const yes = getOptionValue('locaYes', 'Yes');
    const no = getOptionValue('locaNo', 'No');

    EXPEDITION_FINDABLE.forEach((ship, tier) => {
      const canBeFound = r.canFind[ship.abbrev];
      setTextContent('#can' + ship.abbrev, canBeFound ? yes : no);
      ExpeditionsRenderer.setEmphasis('#can' + ship.abbrev, canBeFound);

      // The first tiers are never found, so they have no count cell at all.
      if (tier < EXPEDITION_FIRST_FINDABLE) return;

      const found = r.findCounts[ship.abbrev];
      setTextContent('#find' + ship.abbrev, ExpeditionsRenderer.formatNumber(found));
      ExpeditionsRenderer.setEmphasis('#find' + ship.abbrev, found > 0);
    });
  }

  static render(r) {
    ExpeditionsRenderer.renderMaxPoints(r);
    ExpeditionsRenderer.renderResources(r);
    ExpeditionsRenderer.renderFinds(r);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ExpeditionsRenderer });
}
