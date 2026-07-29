Look at @changelog.sql file. The `ru` row holds the current message; it is the only source of truth.

Rewrite the `description` of every other language row for the same `id` so it is a translation of the current Russian text. Ignore whatever those rows contain right now — they are leftovers from a previous changelog entry, so do not treat a mismatch as a conflict, do not ask about it, and do not report it as a problem. Never leave a non-`ru` row describing anything other than the current Russian message.

Rules:
- Keep the exact set of languages already present in the file — do not add or drop any.
- Keep the one-line `insert into change_descriptions (id, lang, description) values (...);` format and the existing row order.
- Escape single quotes as `''` (SQL literal escaping).
- Use the official OGame terminology of each language for game entities (buildings, technologies, ships, Life Forms).
