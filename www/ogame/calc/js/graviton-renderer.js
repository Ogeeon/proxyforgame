// ============================================================================
// GRAVITON CALCULATOR - RENDERER
// ============================================================================
// Writes the computed result to the DOM: the per-source energy breakdown, the
// produced / required energy, the satellite cost, and the recycling figures.

'use strict';

class GravitonRenderer {
  static formatNumber(value) {
    return numToOGame(value);
  }

  /**
   * Format a duration in seconds using the locale-aware suffixes from `options`.
   */
  static formatTime(seconds) {
    return timespanToShortenedString(
      seconds,
      options.datetimeW,
      options.datetimeD,
      options.datetimeH,
      options.datetimeM,
      options.datetimeS,
      true
    );
  }

  /**
   * Render the always-present figures: the per-source energy breakdown, the
   * produced energy and the energy requirement.
   */
  static renderEnergy(r) {
    setTextContent('#solar-plant-energy', GravitonRenderer.formatNumber(r.solarPlantEnergy));
    setTextContent('#fusion-plant-energy', GravitonRenderer.formatNumber(r.fusionPlantEnergy));
    setTextContent('#solar-satellites-energy', GravitonRenderer.formatNumber(r.solarSatsEnergy));

    setTextContent('#officers-bonus-energy', GravitonRenderer.formatNumber(r.officerBonus));
    setTextContent('#class-bonus-energy', GravitonRenderer.formatNumber(r.classEnergyBonus));
    setTextContent('#alliance-bonus-energy', GravitonRenderer.formatNumber(r.allianceEnergyBonus));
    setTextContent('#boost-bonus-energy', GravitonRenderer.formatNumber(r.boostEnergyBonus));
    setTextContent('#disr-chamber-bonus-energy', GravitonRenderer.formatNumber(r.disChEnergyBonus));
    setTextContent('#lf-tech-bonus-energy', GravitonRenderer.formatNumber(r.lfTechBonus));

    setTextContent('#energy-produced', GravitonRenderer.formatNumber(r.availableEnergy));
    setTextContent('#energy-requirement', options.energyReqConjunction + ' ' + GravitonRenderer.formatNumber(r.energyRequirement));
  }

  /**
   * Render the satellite cost / recycling block. When the configuration can
   * never cover the shortfall (no energy per satellite) the numeric fields are
   * blanked with dashes and the satellite count reads "Infinity".
   */
  static renderCosts(r) {
    if (!r.feasible) {
      setTextContent('#solar-satellites-needed', 'Infinity');
      setTextContent('#crystal-required', '-');
      setTextContent('#deuterium-required', '-');
      setTextContent('#crystal-to-deliver', '-');
      setTextContent('#deuterium-to-deliver', '-');
      setTextContent('#cargoes', '-');
      setTextContent('#recyclers', '-');
      setTextContent('#time-required', '-');
      setTextContent('#crystal-recyclable', '-');
      setTextContent('#deuterium-recyclable', '-');
      setTextContent('#net-crystal-required', '-');
      setTextContent('#net-deuterium-required', '-');
      setTextContent('#cargoes-for-df', '-');
      return;
    }

    setTextContent('#solar-satellites-needed', GravitonRenderer.formatNumber(r.neededSats));
    setTextContent('#crystal-required', GravitonRenderer.formatNumber(r.crysNeeded));
    setTextContent('#deuterium-required', GravitonRenderer.formatNumber(r.deutNeeded));
    setTextContent('#crystal-to-deliver', GravitonRenderer.formatNumber(r.crysToDeliver));
    setTextContent('#deuterium-to-deliver', GravitonRenderer.formatNumber(r.deutToDeliver));
    setTextContent('#cargoes', GravitonRenderer.transportsText(r.scNeeded, r.lcNeeded));
    setTextContent('#time-required', GravitonRenderer.formatTime(r.secsTotal));

    setTextContent('#crystal-recyclable', GravitonRenderer.formatNumber(r.dfCrystal));
    setTextContent('#deuterium-recyclable', GravitonRenderer.formatNumber(r.dfDeuterium));
    setTextContent('#net-crystal-required', GravitonRenderer.formatNumber(r.netCrysNeeded));
    setTextContent('#net-deuterium-required', GravitonRenderer.formatNumber(r.netDeutNeeded));
    setTextContent('#recyclers', GravitonRenderer.formatNumber(r.rcNeeded));
    setTextContent('#cargoes-for-df', GravitonRenderer.transportsText(r.scNeededForDF, r.lcNeededForDF));
  }

  /**
   * "<sc> SC / <lc> LC" transport line, using the localized short ship names.
   */
  static transportsText(scCount, lcCount) {
    return GravitonRenderer.formatNumber(scCount) + ' ' + options.scShort +
      ' / ' + GravitonRenderer.formatNumber(lcCount) + ' ' + options.lcShort;
  }

  static render(r) {
    GravitonRenderer.renderEnergy(r);
    GravitonRenderer.renderCosts(r);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { GravitonRenderer });
}
