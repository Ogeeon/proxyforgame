// ============================================================================
// SCRAP MERCHANT CALCULATOR - RENDERER
// ============================================================================
// Writes a ScrapResult into the page: each row's return, each table's totals
// and the results panel under the tables - the summary, the points, the
// cargo counts in the transport accordion and the "sell now or wait" advice.

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
    return numToDisplay(n, getOptionValue('unitSuffix', 'KMGT'));
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
    return localizeFloat(millions.toFixed(1)) + String(getOptionValue('unitSuffix', 'KMGT')).charAt(1);
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
    setTextContent('#points-lost', numToLocal(r.total.points));
    // The cargo counts twice: in the accordion's header, readable while it is
    // collapsed, and in its body.
    ['#transport-small', '#transport-small-head'].forEach((sel) => setTextContent(sel, numToLocal(r.transport.small)));
    ['#transport-large', '#transport-large-head'].forEach((sel) => setTextContent(sel, numToLocal(r.transport.large)));
  }

  /**
   * The "sell now or wait" advice: a row per flying ship type with a count,
   * the counts of each verdict in the accordion's header and what following
   * the advice gains. Without such ships the table says where to enter them.
   *
   * @param {ScrapSellTimingResult} r
   */
  static renderSellTiming(r) {
    const body = $('#sell-timing-rows');
    const empty = $('#sell-timing-empty');
    if (body && empty) {
      body.replaceChildren(empty, ...r.rows.map((row) => ScrapRenderer.sellTimingRow(row)));
      empty.classList.toggle('d-none', r.rows.length > 0);
    }
    setTextContent('#sell-timing-wait-head', String(r.summary.wait));
    setTextContent('#sell-timing-sell-head', String(r.summary.sell));
    setTextContent('#sell-timing-gain', ScrapRenderer.formatSigned(r.summary.gain));
  }

  /**
   * One ship type's row: its name as the fleet table labels it, the
   * deuterium a day, the days waiting pays up to, the gain and the verdict.
   *
   * @param {ScrapSellTimingRow} row
   * @returns {HTMLTableRowElement}
   */
  static sellTimingRow(row) {
    const tr = document.createElement('tr');
    tr.dataset.id = String(row.id);
    const cell = (/** @type {string} */ text, /** @type {string} */ cls) => {
      const td = document.createElement('td');
      td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
      return td;
    };
    cell(getTextContent(`label[for="unit-${row.id}"]`), '');
    cell(ScrapRenderer.formatFuel(row.fuelPerDay), 'text-end');
    cell(ScrapRenderer.formatDays(row.threshold), 'text-end');
    cell(ScrapRenderer.formatSigned(row.gain), 'text-end');
    const verdict = cell(row.wait ? options.verdictWait : options.verdictSell, 'text-center fw-semibold');
    verdict.classList.add(row.wait ? 'text-success' : 'text-danger');
    return tr;
  }

  /**
   * Deuterium a day: whole units, or a tenth for the small share of a few ships.
   *
   * @param {number} n
   * @returns {string}
   */
  static formatFuel(n) {
    return n >= 10 ? ScrapRenderer.formatNumber(Math.round(n)) : localizeFloat(Math.round(n * 10) / 10);
  }

  /**
   * Days up to which waiting pays: whole days, "∞" when the ships burn
   * nothing, a dash when the event pays no more than today.
   *
   * @param {number} days
   * @returns {string}
   */
  static formatDays(days) {
    if (days === Infinity) return '∞';
    return days > 0 ? numToLocal(Math.floor(days)) : '—';
  }

  /**
   * An amount that can be negative, rounded to whole units, shortened as the
   * "full numbers" box says.
   *
   * @param {number} n
   * @returns {string}
   */
  static formatSigned(n) {
    const whole = Math.round(n);
    return (whole < 0 ? '-' : '') + ScrapRenderer.formatNumber(Math.abs(whole));
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
      label.textContent = numToLocal(count);
      // The raw integer, so a click copies the number without parsing the
      // thousands separators back out of the text.
      label.dataset.planetCount = String(count);
    });
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ScrapRenderer });
}
