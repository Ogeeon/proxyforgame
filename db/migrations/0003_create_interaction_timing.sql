-- One row per page load on the public site that had at least one interaction:
-- the page's INP (the interaction that defines it, as Chrome's web-vitals
-- picks it) with its three phases, the element and event behind it, and when
-- it happened relative to the page's own start-up. Written by the
-- interactionTiming service (www/api/interaction-timing.inc.php) from a beacon
-- www/js/interaction-timing.js sends; read by hand, with SQL.
--
-- It replaces the 'INP slow' events hawk.tpl sent to Hawk: an error tracker
-- groups by title and keeps no denominator, so neither the share of slow visits
-- nor a percentile could be read out of it.
--
-- load_id is a random value minted per page load and never stored in the
-- browser; it only lets a later beacon of the same page load replace the
-- earlier one instead of counting the visit twice. No IP, no user agent.
-- Rows older than 90 days are deleted by the service on the way.

CREATE TABLE IF NOT EXISTS interaction_timing (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  load_id             CHAR(32) NOT NULL,
  created_at          DATETIME NOT NULL,
  release_sha         CHAR(40) NULL,
  page                VARCHAR(64) NOT NULL,
  lang                VARCHAR(8) NOT NULL,
  pointer_type        VARCHAR(8) NULL,
  cpu_cores           SMALLINT UNSIGNED NULL,
  interactions        SMALLINT UNSIGNED NOT NULL,
  dcl_ms              INT UNSIGNED NULL,
  inp_ms              INT UNSIGNED NOT NULL,
  input_delay_ms      INT UNSIGNED NOT NULL,
  processing_ms       INT UNSIGNED NOT NULL,
  presentation_ms     INT UNSIGNED NOT NULL,
  start_ms            INT UNSIGNED NOT NULL,
  event_type          VARCHAR(16) NOT NULL,
  target              VARCHAR(96) NOT NULL,
  UNIQUE KEY load_id (load_id),
  KEY created (created_at),
  KEY page_time (page, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
