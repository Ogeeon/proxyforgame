// ============================================================================
// MOON CALCULATOR - RENDERER
// ============================================================================
// Writes the computed result to the DOM: the destruction chances, the moon
// creation chance, the build cost, the debris field and the recycling figures,
// plus the per-unit "units for the maximum chance" labels.

'use strict';

class MoonRenderer {
  static formatNumber(value) {
    return numToOGame(value);
  }

  /**
   * Format a percentage that is already expressed in whole percent (0..100),
   * keeping at most 2 decimals.
   */
  static formatPercent(value) {
    return dropFraction(0.01 * Math.round(100 * value), 2) + '%';
  }

  /**
   * Render the moon destruction sub-calculator.
   */
  static renderDestroy(r) {
    setTextContent('#moon-destroy-chance', MoonRenderer.formatPercent(r.destroyChance));
    setTextContent('#ds-blow-chance', MoonRenderer.formatPercent(r.blowChance));
  }

  /**
   * Render the moon creation sub-calculator: chance, build cost, debris field
   * and recycling.
   */
  static renderCreate(r) {
    // createChance is a fraction (0..0.40), unlike the destruction chances.
    setTextContent('#moon-create-chance', MoonRenderer.formatPercent(100 * r.createChance));

    setTextContent('#metal-required', MoonRenderer.formatNumber(r.metalRequired));
    setTextContent('#crystal-required', MoonRenderer.formatNumber(r.crystalRequired));
    setTextContent('#deuterium-required', MoonRenderer.formatNumber(r.deuteriumRequired));

    setTextContent('#metal-recyclable', MoonRenderer.formatNumber(r.recyclableMetal));
    setTextContent('#crystal-recyclable', MoonRenderer.formatNumber(r.recyclableCrystal));
    setTextContent('#deuterium-recyclable', MoonRenderer.formatNumber(r.recyclableDeut));
    setTextContent('#debris-total', MoonRenderer.formatNumber(r.debrisTotal));
    setTextContent('#recyclers', MoonRenderer.formatNumber(r.recyclers));
  }

  /**
   * Render the "how many of this unit reach the maximum chance" label next to
   * every count input. A dash means the unit cannot contribute at all.
   */
  static renderMaxCounts(r) {
    MOON_UNITS.forEach((unit) => {
      const max = r.maxCounts[unit.id];
      setTextContent('#' + unit.id + '-max', max === null ? '-' : MoonRenderer.formatNumber(max));
    });
  }

  static render(r) {
    MoonRenderer.renderDestroy(r);
    MoonRenderer.renderCreate(r);
    MoonRenderer.renderMaxCounts(r);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { MoonRenderer });
}
