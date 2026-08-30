# Database migrations

Versioned, forward-only SQL migrations. `deploy/pfg-migrate` applies the pending
ones to a host's database and records each in `schema_migrations`; `deploy/pfg-sync`
runs it on every deploy that moves `HEAD`, on **both** hosts (issue #12).

Before this existed, every DDL change was applied by hand over SSH on each host.
The worked example of the old way is the 2026-07-26 `population_data` ALTER in
`docs/vps-deploy-notes.md`.

## File format

```
db/migrations/NNNN_short_description.sql
```

- `NNNN` — zero-padded integer, **contiguous from `0001`**. A gap makes
  `pfg-migrate` refuse to run (it means two branches added a migration and one
  renumbering was missed). Keep the description ASCII and quote-free.
- Forward-only. There are no down-migrations — the project rolls back by rolling
  forward (`deploy/README.md`, *Rolling back*).
- **One logical change per file.** MariaDB auto-commits each DDL statement, so a
  multi-statement file that fails half way leaves the schema partly changed and
  *not* recorded as applied — the next deploy retries the whole file.
- The primary idempotency guard is `schema_migrations`: `pfg-migrate` never
  re-runs a file whose version is already recorded, on any engine. `IF NOT
  EXISTS` on the DDL itself is the second layer, for the rare partial-apply
  retry. `CREATE TABLE IF NOT EXISTS` is portable; `ALTER TABLE ... ADD COLUMN
  IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are **MariaDB-only** and the
  hosts are MariaDB — but CI still runs `mysql:8.0`, which rejects that syntax.
  Until CI moves to MariaDB, keep migration DDL to what both accept (plain
  `ADD COLUMN`, relying on the version-skip for idempotency).
- Start the file with an English comment: what changes and why.

## The expand-only rule

A migration lands seconds before the code that needs it (a green push is live
almost immediately). So a migration **must be backward compatible with the code
already deployed**: add columns, tables and indexes; do not drop or rename a
column the running code still reads, and do not add a `NOT NULL` column without a
default. Drop/rename happens a full release *after* the code stopped using the
thing — the classic expand/contract split.

## Writing and testing one locally

1. Add `db/migrations/000N_your_change.sql`.
2. `make db-migrate` — applies it against your local DB and records the row.
   Run it again: it should print nothing and change nothing.
3. `make db-validate` (or `node scripts/validate-database-schema.js`) — the
   live-column comparison should still be clean.
4. **Regenerate `schema.sql`** so a fresh seed stays current. Dump structure in
   the file's existing shape, e.g.:
   ```
   mysqldump -h127.0.0.1 -upfg_usr -psecret --no-data --skip-comments \
     --skip-add-drop-table proxyforgame > schema.sql
   ```
   then re-add the hand-maintained data blocks (`universes` rows, the
   `population_data` comments) — diff against the previous `schema.sql` and keep
   the diff to your change plus the new `schema_migrations` row.
5. Commit the migration file and the regenerated `schema.sql` together. A `feat`
   that needs the schema change references it; the schema commit goes first.

## How the deploy applies it

`pfg-sync`, after `git reset` and before the smoke test, calls
`deploy/pfg-migrate <checkout>`. On failure the deploy is rolled back and mailed —
unlike the changelog step, a missing schema is fatal. The runner reads
`DB_HOST`/`DB_NAME` from the checkout's `.env`, and the DDL user from
`DB_DDL_USER`/`DB_DDL_PASS` when set (the standby, whose app user has no ALTER)
else `DB_USER`/`DB_PASS` (production).

`deploy/pfg-migrate <checkout> --check` lists what is pending and exits non-zero
if anything is — handy from a shell, not part of the gate.
