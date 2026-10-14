-- One row per feedback message (the report and email services) that passed
-- validation and the bot traps, keyed by a hash of the sender's IP. The
-- services count these rows to cap how many messages one address can send;
-- rows older than a day are deleted on the way, so the table stays small and
-- no address is kept longer than the longest window needs.
--
-- The IP itself is never stored, only its SHA-256.

CREATE TABLE IF NOT EXISTS mail_rate_limit (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip_hash     CHAR(64) NOT NULL,
  created_at  DATETIME NOT NULL,
  KEY ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
