// ============================================================================
// TERRAFORMER CALCULATOR - RENDERER
// ============================================================================
// Writes the computed result to the DOM: the per-source energy breakdown, the
// produced / required energy, the added fields, and the terraformer / satellite
// / total cost figures.

'use strict';

class TerraformerRenderer {
  static formatNumber(value) {
    return numToOGame(value);
  }

  /**
   * Format a duration in seconds using the locale-aware suffixes from `options`.
   * Kept at full precision (no minimize) to preserve the legacy output.
   */
  static formatTime(seconds) {
    return timespanToShortenedString(
      seconds,
      options.datetimeW,
      options.datetimeD,
      options.datetimeH,
      options.datetimeM,
      options.datetimeS,
      false
    );
  }

  /**
   * Render the always-present figures: the per-source energy breakdown, the
   * added fields, the produced energy and the energy requirement.
   */
  static renderEnergy(r) {
    setTextContent('#solar-plant-energy', TerraformerRenderer.formatNumber(r.solarPlantEnergy));
    setTextContent('#fusion-plant-energy', TerraformerRenderer.formatNumber(r.fusionPlantEnergy));
    setTextContent('#solar-satellites-energy', TerraformerRenderer.formatNumber(r.solarSatsEnergy));

    setTextContent('#officers-bonus-energy', TerraformerRenderer.formatNumber(r.officerBonus));
    setTextContent('#class-bonus-energy', TerraformerRenderer.formatNumber(r.classEnergyBonus));
    setTextContent('#alliance-bonus-energy', TerraformerRenderer.formatNumber(r.allianceEnergyBonus));
    setTextContent('#boost-bonus-energy', TerraformerRenderer.formatNumber(r.boostEnergyBonus));
    setTextContent('#disr-chamber-bonus-energy', TerraformerRenderer.formatNumber(r.disChEnergyBonus));
    setTextContent('#lf-tech-bonus-energy', TerraformerRenderer.formatNumber(r.lfTechBonus));

    setTextContent('#added-fields', TerraformerRenderer.formatNumber(r.addedFields));
    setTextContent('#energy-produced', TerraformerRenderer.formatNumber(r.availableEnergy));
    setTextContent('#energy-needed', TerraformerRenderer.formatNumber(r.energyRequirement));
  }

  /**
   * Render the satellite count and the terraformer / satellite / total cost
   * blocks. When the configuration can never cover the shortfall (no energy per
   * satellite) the numeric fields are blanked with dashes and the satellite
   * count reads "Infinity".
   */
  static renderCosts(r) {
    if (!r.feasible) {
      setTextContent('#solar-satellites-needed', 'Infinity');
      const dashes = [
        '#crystal-required-tf', '#deuterium-required-tf', '#time-required-tf',
        '#crystal-required-ss', '#deuterium-required-ss', '#time-required-ss',
        '#crystal-required-total', '#deuterium-required-total',
        '#crystal-to-deliver', '#deuterium-to-deliver', '#cargoes',
      ];
      dashes.forEach((sel) => setTextContent(sel, '-'));
      return;
    }

    setTextContent('#solar-satellites-needed', TerraformerRenderer.formatNumber(r.neededSats));

    setTextContent('#crystal-required-tf', TerraformerRenderer.formatNumber(r.crysTF));
    setTextContent('#deuterium-required-tf', TerraformerRenderer.formatNumber(r.deutTF));
    setTextContent('#time-required-tf', TerraformerRenderer.formatTime(r.secsTF));

    setTextContent('#crystal-required-ss', TerraformerRenderer.formatNumber(r.crysSS));
    setTextContent('#deuterium-required-ss', TerraformerRenderer.formatNumber(r.deutSS));
    setTextContent('#time-required-ss', TerraformerRenderer.formatTime(r.secsSS));

    setTextContent('#crystal-required-total', TerraformerRenderer.formatNumber(r.crysTotal));
    setTextContent('#deuterium-required-total', TerraformerRenderer.formatNumber(r.deutTotal));

    setTextContent('#crystal-to-deliver', TerraformerRenderer.formatNumber(r.crysToDeliver));
    setTextContent('#deuterium-to-deliver', TerraformerRenderer.formatNumber(r.deutToDeliver));

    setTextContent('#cargoes', TerraformerRenderer.transportsText(r.scNeeded, r.lcNeeded));
  }

  /**
   * "<sc> SC / <lc> LC" transport line, using the localized short ship names.
   */
  static transportsText(scCount, lcCount) {
    return TerraformerRenderer.formatNumber(scCount) + ' ' + options.scShort +
      ' / ' + TerraformerRenderer.formatNumber(lcCount) + ' ' + options.lcShort;
  }

  static render(r) {
    TerraformerRenderer.renderEnergy(r);
    TerraformerRenderer.renderCosts(r);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, { TerraformerRenderer });
}
