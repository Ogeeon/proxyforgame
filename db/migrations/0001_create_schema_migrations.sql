-- Bootstrap: the table pfg-migrate reads to know which migrations a database
-- already has. From here on it is dumped into schema.sql like any other table,
-- so a fresh install (CI, a new dev box) starts with its rows already present
-- and pfg-migrate is a no-op until a genuinely new file lands.
--
-- IF NOT EXISTS: the live hosts predate this mechanism and run 0001 for real on
-- the first deploy that carries it; a fresh DB seeded from schema.sql already
-- has the table and only records the row.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INT UNSIGNED NOT NULL PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL,
  applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
