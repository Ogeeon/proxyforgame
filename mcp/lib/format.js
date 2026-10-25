'use strict';

/**
 * A duration as the game prints it: `1d 02:03:04`, the day part only when
 * there is one. The site's own getFlightTimeStr always pads a day count, which
 * suits a table column but reads oddly in a sentence.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const days = Math.floor(total / 86400);
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const clock = `${pad(Math.floor(total % 86400 / 3600))}:${pad(Math.floor(total % 3600 / 60))}:${pad(total % 60)}`;
    return days > 0 ? `${days}d ${clock}` : clock;
}

module.exports = { formatDuration };
