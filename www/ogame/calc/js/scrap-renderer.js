// ============================================================================
// SCRAP MERCHANT CALCULATOR - RENDERER
// ============================================================================
// Writes a ScrapResult into the page: the summary above the tables, each
// row's return and each table's totals.

'use strict';

/** @type {(keyof ScrapResources)[]} */
const SCRAP_RESOURCES = ['metal', 'crystal', 'deuterium'];

class ScrapRenderer {
  /**
   * A resource amount, whole or shortened as the "full numbers" box says.
   *
   * @param {number} n
   * @returns {string}
   */
  static formatNumber(n) {
    return ogamizeNum(n, getOptionValue('unitSuffix', 'KMG'));
  }

  /**
   * Metal, crystal and deuterium one for one, in millions with one decimal
   * (rounded down, as the shortened numbers are).
   *
   * @param {number} sum
   * @returns {string}
   */
  static formatMsu(sum) {
    const millions = Math.floor(sum / 100000) / 10;
    return localizeFloat(millions.toFixed(1)) + String(getOptionValue('unitSuffix', 'KMG')).charAt(1);
  }

  /** @param {ScrapResult} r */
  static render(r) {
    ScrapRenderer.renderUnits(r);
    ScrapRenderer.renderSection('fleet', r.fleet);
    ScrapRenderer.renderSection('defense', r.defense);
    ScrapRenderer.renderSummary(r);
  }

  /**
   * Each row's return; a row with no count shows zeros.
   *
   * @param {ScrapResult} r
   */
  static renderUnits(r) {
    SCRAP_UNIT_IDS.forEach((id) => {
      const unit = r.units[id];
      SCRAP_RESOURCES.forEach((res) => {
        setTextContent(`#unit-${id}-${res}`, ScrapRenderer.formatNumber(unit ? unit.payback[res] : 0));
      });
    });
  }

  /**
   * A table's full cost and return, under it.
   *
   * @param {'fleet'|'defense'} section
   * @param {ScrapSection} s
   */
  static renderSection(section, s) {
    SCRAP_RESOURCES.forEach((res) => {
      setTextContent(`#${section}-cost-${res}`, ScrapRenderer.formatNumber(s.cost[res]));
      setTextContent(`#${section}-payback-${res}`, ScrapRenderer.formatNumber(s.payback[res]));
    });
  }

  /**
   * Fleet and defense together: what they cost, what they bring, the points
   * and the cargo ships.
   *
   * @param {ScrapResult} r
   */
  static renderSummary(r) {
    SCRAP_RESOURCES.forEach((res) => {
      setTextContent(`#total-cost-${res}`, ScrapRenderer.formatNumber(r.total.cost[res]));
      setTextContent(`#total-payback-${res}`, ScrapRenderer.formatNumber(r.total.payback[res]));
    });
    setTextContent('#total-cost-msu', ScrapRenderer.formatMsu(r.total.costSum));
    setTextContent('#total-payback-msu', ScrapRenderer.formatMsu(r.total.paybackSum));
    // Points and ship counts are written out in full: shortened, a count of
    // ships would read as an amount of resources.
    setTextContent('#points-lost', numToOGame(r.total.points));
    setTextContent('#transport-small', numToOGame(r.transport.small));
    setTextContent('#transport-large', numToOGame(r.transport.large));
  }

  /**
   * The count each unit has on the profile's planet, beside its field. A
   * section whose counts are null is hidden: the planet carries none of its
   * units (entered by hand, never imported), which is not the same as none
   * standing there.
   *
   * @param {?Record<string, number>} fleet Count by tech id, or null to hide the section's labels.
   * @param {?Record<string, number>} defense
   */
  static renderPlanetCounts(fleet, defense) {
    ScrapRenderer.renderPlanetSection('fleet', SCRAP_FLEET_IDS, fleet);
    ScrapRenderer.renderPlanetSection('defense', SCRAP_DEFENSE_IDS, defense);
  }

  /**
   * @param {'fleet'|'defense'} section
   * @param {readonly number[]} ids
   * @param {?Record<string, number>} counts
   */
  static renderPlanetSection(section, ids, counts) {
    toggleClass(`#${section}-planet-hint`, 'd-none', counts === null);
    ids.forEach((id) => {
      const label = $(`#unit-${id}-planet`);
      if (!label) return;
      if (counts === null) {
        label.classList.add('d-none');
        label.textContent = '';
        delete label.dataset.planetCount;
        return;
      }
      const count = counts[id] ?? 0;
      label.classList.remove('d-none');
      label.textContent = numToOGame(count);
      // The raw integer, so a click copies the number without parsing the
      // thousands separators back out of the text.
      label.dataset.planetCount = String(count);
    });
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ScrapRenderer });
}
