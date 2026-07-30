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
   * keeping at most 2 decimals. The '%' itself is not part of the value: every
   * percentage readout wears it as an input-group addon, the way the editable
   * percentage fields do.
   *
   * The fraction is localized, because numToOGame groups thousands with a dot in
   * every language - a raw "9.09" would read as nine thousand next to the
   * "8.366" diameters right below it.
   */
  static formatPercent(value) {
    return localizeFloat(dropFraction(0.01 * Math.round(100 * value), 2));
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

    MoonRenderer.renderMoonSizes(r);
  }

  /**
   * Render the diameter the debris field can produce: the range, and every
   * single one of the equally likely rolls as its own badge. An empty result
   * (no debris at all, hence no moon) shows a dash and no badges.
   */
  static renderMoonSizes(r) {
    const sizes = r.moonSizes || [];
    setTextContent('#moon-size-range', sizes.length > 0
      ? MoonRenderer.formatNumber(r.moonSizeMin) + ' – ' + MoonRenderer.formatNumber(r.moonSizeMax)
      : '-');

    // Every roll is equally likely, so a single percentage covers them all and
    // is shown once next to the list instead of on each badge.
    setTextContent('#moon-size-roll-chance', sizes.length > 0
      ? MoonRenderer.formatPercent(100 / sizes.length)
      : '-');

    const list = $('#moon-size-variants');
    if (!list) return;
    list.replaceChildren();
    sizes.forEach((size) => {
      const badge = document.createElement('span');
      badge.className = 'badge size-badge';
      badge.textContent = MoonRenderer.formatNumber(size);
      list.append(badge);
    });
  }

  /**
   * Render the "how many of this unit reach the maximum chance" label next to
   * every count input. A dash means the unit cannot contribute at all.
   *
   * The raw integer is also stashed in `data-max-count` so the click-to-fill
   * handler in the orchestrator can copy it straight into the count input
   * without re-parsing the locale-formatted display text (whose thousands
   * separator would otherwise be misread as a decimal point in some locales).
   */
  static renderMaxCounts(r) {
    MOON_UNITS.forEach((unit) => {
      const max = r.maxCounts[unit.id];
      const label = $('#' + unit.id + '-max');
      if (!label) return;
      if (max === null) {
        label.textContent = '-';
        delete label.dataset.maxCount;
      } else {
        label.textContent = MoonRenderer.formatNumber(max);
        label.dataset.maxCount = String(max);
      }
    });
  }

  /**
   * Render the sensor phalanx panel: how far the phalanx reaches, which systems
   * that covers, and what it would take to reach the target system.
   *
   * The system numbers are written out raw instead of through formatNumber:
   * that helper groups thousands with a dot, which would read as a decimal
   * point in the languages that group with a comma.
   */
  static renderPhalanx(r) {
    setTextContent('#phalanx-range', String(r.phalanxRange));
    setTextContent('#systems-in-range', String(r.phalanxSystemsInRange));
    setTextContent('#visible-systems', MoonRenderer.formatSegments(r.phalanxSegments));
    setTextContent('#phalanx-distance', String(r.phalanxDistance));
    setTextContent('#phalanx-lvl-required',
      r.phalanxLevelRequired === null ? '-' : String(r.phalanxLevelRequired));
  }

  /**
   * The covered systems as "480 – 499, 1 – 29": one entry per contiguous run,
   * with a run of a single system written as the bare number.
   *
   * @param {number[][]} segments Ascending [from, to] pairs.
   * @returns {string}
   */
  static formatSegments(segments) {
    if (!segments || segments.length === 0) return '-';
    return segments
      .map((pair) => (pair[0] === pair[1] ? String(pair[0]) : pair[0] + ' – ' + pair[1]))
      .join(', ');
  }

  static render(r) {
    MoonRenderer.renderDestroy(r);
    MoonRenderer.renderCreate(r);
    MoonRenderer.renderMaxCounts(r);
    MoonRenderer.renderPhalanx(r);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { MoonRenderer });
}
