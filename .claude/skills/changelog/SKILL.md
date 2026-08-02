---
name: changelog
description: Record a change in CHANGELOG.md and publish a release to the in-app changelog users see in the sidebar. Use when adding a changelog entry, deciding whether a change is user-visible, or cutting a release.
---

# Changelog in pfg.wmp

`CHANGELOG.md` is the single source of truth. The database tables `change_headers` and
`change_descriptions` hold only the subset users see in the sidebar, and `changelog.sql` is a
git-ignored artifact regenerated for every release — neither is a record you can read history
out of. The file is.

## 1. Add the bullet with the change

Every `feat` and `fix` commit adds a bullet under `## [Unreleased]` **in the same commit**.
`refactor`, `chore`, `docs`, `style` and `test` do not touch the file.

Groups are the Keep a Changelog ones, in this order: `Added`, `Changed`, `Deprecated`,
`Removed`, `Fixed`, `Security`. Write the bullet as `Area: what changed.` — the area being the
calculator (`Production`, `Flight`, `LF costs`) or the part of the site (`Sidebar`, `Feedback`).

## 2. Decide whether it goes to the site

Append `<!-- site -->` to the bullet when a player would notice the change:

| Goes to the site | Stays in the file |
|------------------|-------------------|
| A new calculator or page | Refactoring |
| A new field, option or setting | Tests |
| Importing game data (API 2, spy report) | Build, tooling, CI |
| A change to the calculations | Documentation |
| A visual change | Wording and translation fixes |
| A fix to a bug users could hit — wrong output, settings not saved, a broken import | Type-checking, Sonar findings |

When in doubt, ask the user rather than guessing — a bullet nobody can act on is noise in a
dialog that pops up unprompted on every visit.

## 3. Cut the release

Write the Russian announcement as the last line of `[Unreleased]`:

```markdown
> **RU:** В Калькулятор лун добавлен расчёт дальности Сенсорной Фаланги.
```

It summarizes the `<!-- site -->` bullets in one paragraph aimed at a player, not at a
developer. `<br>` separates topics. Keep it under 900 characters: the database column holds
1024 and the translations run longer than the Russian source — French is routinely 25% longer.

**If you drafted that text rather than the user writing it, show it and get their explicit
approval before going any further.** It is the one artifact here that reaches every visitor of
the site in twelve languages, and once `/translate-changelog` has run and the SQL is applied
there is no edit path short of a manual `update`. Quote the draft in full, say which bullets it
covers, and wait for a yes. An approval of the bullets is not an approval of the announcement,
and approval of an earlier draft does not carry over to one you reworded.

Then:

```
make changelog-release              # dated today
make changelog-release date=2026-08-05
```

This turns `[Unreleased]` into `## [YYYY-MM-DD] - site entry N`, opens a fresh empty
`[Unreleased]`, and rewrites `changelog.sql` with the next id and twelve rows all holding the
Russian text.

## 4. Translate and publish

1. Run `/translate-changelog`. It rewrites the eleven non-Russian rows in place.
2. Apply `changelog.sql` to the production database by hand. There is no deploy step for it —
   `changelog.sql` is git-ignored and never travels over the webhook that pulls the site.
3. Commit `CHANGELOG.md`. `changelog.sql` is ignored and stays out of the commit.

The sidebar shows an entry to a returning visitor when its id is greater than the `lastChange`
value in their local storage, so the id must keep increasing. `--release` allocates it from the
file and never reuses one.

## Rules the validator enforces

`make changelog-validate` runs inside `make check`, so a broken file blocks every commit:

- exactly one `## [Unreleased]`, and it comes first;
- release headings read `## [YYYY-MM-DD] - site entry N`, ids strictly decreasing;
- only the six canonical groups, in order, none empty, none repeated;
- `<!-- site -->` present ⟺ the heading carries `- site entry N` and the section carries a
  `> **RU:**` quote;
- the quote fits in 1024 characters, with a warning past 900.

Two things it deliberately tolerates, because the published history contains both:

- **gaps in the ids** — entry 36 does not exist;
- **inverted dates** — entry 32 is dated 2023-04-26 while entries 33 and 34 above it are dated
  February 2023. This warns; it does not fail. The sidebar orders by id, not by date.
