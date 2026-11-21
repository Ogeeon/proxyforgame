# 6. Numbers are displayed the way the site language writes them (CLDR separators)

Date: 2026-11-21

## Status

Accepted.

## Context

Until now every calculator grouped thousands with a dot in every language - "OGame style",
`numToOGame` in `www/js/utils.js` - while the decimal separator already came from the locale
file. Two problems followed:

- **The dot meant two things.** A number with a fraction rendered as `12.345.678`: the
  grouping dot and the decimal dot side by side, read as a nine-digit integer. The compact form
  (`1.5M`) used a dot decimal in comma locales, and scrap's MSU row already wrote `1,5M` - the
  code disagreed with itself.
- **It is not how the players read numbers.** An English reader expects `1,234,567`, a
  Russian or a Pole `1 234 567`; the game client is the only place they meet the dot. The
  calculators are used beside the game, but their output is copied into forums, chats and
  trade offers read by people of the same language.

## Decision

**Display follows the site language's real-life convention, per CLDR. Input does not change.**

- **Separator characters per CLDR**, transcribed by hand into a new `common` key,
  `thousands-separator`, next to `decimal-separator` in all 13 locale files: `,` for `en`/`us`;
  U+00A0 (no-break space) for `pl`/`pt`/`ru`/`sk`; U+202F (narrow no-break space) for `fr`;
  `.` for `de`/`es`/`it`/`nl`/`tr`/`bs`, which is their own norm and not a game imitation.
  `pt` is Portugal (the OGame PT server), so CLDR `pt-PT`, not the Brazilian root.
- **No `Intl.NumberFormat`.** One shared formatter, `numToLocal` (renamed from `numToOGame`),
  reads both separators from `options`; `numToDisplay` (from `ogamizeNum`) keeps the
  full/compact switch. The integer part is grouped on its own before the fraction is joined
  with the locale decimal, so in `de` the grouping dot and the decimal comma cannot be
  confused. Explicit keys keep the output identical in every browser and testable in Node, and
  leave the rest of the formatting (three-digit fraction cap, rounding, K/M/G suffixes) exactly
  as it was.
- **Grouping rule is not CLDR's.** Every locale groups three by three from the first thousand.
  CLDR's `minimumGroupingDigits = 2` (`1234` ungrouped in `pl`/`es`/`pt`) is deliberately not
  followed: one rule for all pages and all languages, and a column of numbers keeps one shape.
- **No "game format" toggle.** One behaviour; the only places that mirrored the game client
  (trade's rates) follow the site language too.
- **Input semantics are unchanged.** A grouping separator was never valid in a field and still
  is not: the keyup/blur filter keeps only digits, the sign and the locale decimal, so the new
  spaces are dropped like dots and commas always were, and a number copied off the page pastes
  back whole. `getInputNumber` strips U+00A0/U+202F itself for a value read before filtering.
  Text pasted out of the game keeps its own rule: its separators follow the game client, so a
  paste parser accepts both decimals.

## Consequences

- Visible in 7 locales (`en`, `us`, `fr`, `pl`, `pt`, `ru`, `sk`) for full numbers; the compact
  fraction changes in every comma-decimal locale (`1.5M` -> `1,5M`).
- Nothing persisted is locale-formatted (settings, profiles and URLs hold raw numbers), so no
  migration. The report dialog's e-mail block stays canonical dot-decimal.
- Two invisible characters live in the locale files, where the i18n gate checks only key
  parity; `unit-tests/locale-separators.test.js` pins every code point, and the templates emit
  the key through `json_encode` so it is readable in page source.
- A spec that reads a displayed number back must not strip one known separator; it uses
  `wholeNumber` from `playwright-tests/tests/base.js`.

## Addendum 2026-11-21: a T tier for the compact form

This supersedes "K/M/G suffixes exactly as it was" in *Decision*. The compact form of
`numberToShortenedString` (and so `numToDisplay`) used to stop at G, so a trillion came out as
`1,000G` and 1.234×10¹² as `1,234.567G` - the wrong letter, and a mantissa stretched into
extra digit groups.

- **A T tier from 10¹²**, shaped like M and G: mantissa `0.001 × floor(n / 10⁹)`, at most three
  fraction digits, cut and not rounded, trailing zeros dropped. The seam is `999.999G` ->
  `1T` at exactly 10¹² (not `1.000T`).
- **No P tier.** From 10¹⁵ the T mantissa grows past 999 and takes grouping: `1,234.567T` in
  `en`, `1.234,567T` in `de`, `1 234,567Т` in `ru`. That is the accepted ceiling - game values
  do not reach it, and exact integers end at 2⁵³ anyway.
- **Below 10⁶ nothing changes**: the full grouped number; the K letter stays unused.
- **The letter comes from the locale**, by position in `unit-suffix`, which grows from `KMG` to
  `KMGT` (`КМГТ` in `ru`, a Cyrillic Т). No new key. `numToLocal` and the "full numbers" mode
  are untouched, and there is no tooltip with the exact value - that checkbox is the way to it.

## Addendum 2026-11-21: the duration format

`timespanToShortenedString` wrote every span as weeks, days, hours, minutes and seconds with
the locale letters, so five years read `260w 5d` and a short build `45m ` (with a trailing
space). One format now serves all its call sites - costs, LF costs, queue, production,
graviton, terraformer and flight - in three regimes:

- **Under a day, a clock**: `hh:mm:ss`, zero-padded, seconds floored (`00:45:00`,
  `23:59:59`; zero is `00:00:00`). It is the same in every language - the locale letters are
  dropped on purpose - and the zero cells the server renders, and the ones a reset writes,
  show it too, so a cell does not change shape on the first recalculation.
- **From 1 to 364 days, unchanged**: `3d 4h 5m`, `52w`, with the `minimize` behaviour as it
  was (minutes and seconds dropped with weeks, seconds with days).
- **From 365 days, years, months and weeks only**: a year is 365 days and a month 30, each
  floored, zero units left out and a remainder under a week dropped (`1y`, `1y 1mo`,
  `1y 3mo 2w`, `5y`), minimized or not. The two new letters are the `common` keys
  `datetime-y` and `datetime-mo` in all 13 locales. Because 12 × 30 ≠ 365, 725-729 days read
  `1y 12mo` rather than rolling into `2y` - an accepted seam, not worth a calendar.

The result never ends with a space. The parameter order is largest unit first -
`(seconds, y, mo, w, d, h, m, s, minimize)` - applied at every call site at once.
