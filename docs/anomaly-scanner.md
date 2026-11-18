# The Interstellar Anomaly Scanner (Project Orion) in the calculators

> **Status:** the scanner (costs, queue, MCP) and its seven Control Centre components (costs)
> are implemented on `feat/anomaly-scanner`, and so is the lithium conversion in the
> production calculator — see *Production: lithium conversion* at the end.
> Decisions agreed in design sessions on 2026-11-14 and 2026-11-18.
> Source data: `D:\temp\Interstellar Anomaly Scanner.xlsx` (levels 1–10, recorded from the game by the site author).

## Context

The Interstellar Anomaly Scanner (IAS) is a new Facilities building from OGame's
Project Orion expansion (in beta on the test servers as of Nov 2026). Cost scaling was
rebalanced in beta 13 (2026-10-08): growth factor raised from 1.4 to 1.5, and the base
cost players measure now is 90/45/15 (older PTS measurements of 84/42/14 predate that build).

This plan adds the building to the shared tech table so it appears in the **costs**
calculator and the **queue** calculator automatically.

## Data analysis (from the xlsx)

Cost — confirmed against every level of the sheet, exact to the unit:

```
cost(L) = floor(base * 1.5^(L-1)),  base = [90 metal, 45 crystal, 15 deuterium]
```

Build time — the sheet's time column matches the site's existing building formula
(`getBuildingTime_C` in `www/ogame/calc/js/ogame-costs.js`) exactly, at universe
speed 100, robotics 0, nanites 0, including the early-level reduction:

```
t(L) = (M+C) * 3600 / (2500 * speed * max(4 - L/2, 1) * (robots+1) * 2^nanites)
```

| Level | Metal | Crystal | Deut | Time (speed 100, truncated) |
|------:|------:|--------:|-----:|----------------------------:|
| 1  | 90   | 45   | 15  | 1s  |
| 2  | 135  | 67   | 22  | 1s  |
| 3  | 202  | 101  | 33  | 1s  |
| 4  | 303  | 151  | 50  | 3s  |
| 5  | 455  | 227  | 75  | 6s  |
| 6  | 683  | 341  | 113 | 14s |
| 7  | 1025 | 512  | 170 | 22s |
| 8  | 1537 | 768  | 256 | 33s |
| 9  | 2306 | 1153 | 384 | 49s |
| 10 | 3459 | 1729 | 576 | 74s |

The times are **truncated, not rounded**. `getBuildTime_C` returns fractional seconds at
speed 100 (it floors before dividing by the universe speed, then clamps to at least 1):
1, 1, 1.74, 3.26, 6.54, 14.74, 22.13, 33.19, 49.8, 74.7. The sheet (and the site, whose
`timespanToShortenedString` drops the fraction) shows 1, 1, 1, 3, 6, 14, 22, 33, 49, 74.
Rounding would give 2, 7, 15, 50, 75 at levels 3, 5, 6, 9, 10.

The early-level reduction is confirmed by the sheet: without it levels 3 and 4 would take
4 s and 6 s instead of 1 s and 3 s.

So the scanner obeys the standard building formulas — no special-casing anywhere.

## Decisions

| Topic | Decision |
|---|---|
| Fields | Occupies planet fields, 1 per level — a regular building, **no** special code in the queue (no Space-Dock-style exclusion in `queue-core.js`) |
| Game id | `45` (next after Missile Silo 44; oBot keys the scanner as "technology 45"). **Unverified against the game itself** — confirm from the PTS page markup (`data-technology="45"`) before pushing: the id becomes the permanent key `building.45` in saved profiles, the account export and the MCP import, so a later change would need a profile migration |
| Profiles | `building.45` needs no site change: the account-export import (`copyLevels(raw.buildings, 'building.')` in `profiles-core.js`) copies any numeric id. It only arrives if the export itself (the companion extension) emits id 45 — an external dependency, tracked outside this repo. The **API 2** import is unrelated: it carries ships and cargo bonuses only (flight, expeditions) |
| Beta on the live site | A push to `main` is a release, so the scanner shows up in costs, queue and the MCP tools for every universe, though only PTS servers have it. Accepted: no "(beta)" suffix in the name; the draft locale names are replaced when Orion goes live |
| Type | `2` — planet only (Facilities building, not buildable on moons) |
| Cost | `cost: [90, 45, 15]`, `growth: 1.5`, floor per level (standard `calcBuildCost_C`) |
| Build time | Standard formula with the early-level reduction (id is **not** added to `noReduction`) |
| Demolition | Allowed (id < 100; not added to `NON_DESTROYABLE_TECHS` or the `queue.tpl` hide-list) |
| Max level | None, like other classic buildings — bounded by planet fields |
| Requirements (Astrophysics 5, Shipyard 5, Combustion 1) | Not enforced — the site checks requirements only for research |
| Energy | None — no case in `getBuildEnergyCost_C`, no producer/consumer lists |
| Lithium economy | Lithium production and the anomaly side stay out of scope; the resource cost of the conversion goes into the production calculator (see the end of this file) |
| Control Centre components | Done later as their own costs tab (type 7, site ids 46-52, game ids 4001-4007): seven fieldless components, ×1.5 per level, 0.2% effect per level, the Catalytic Converter a 0.05% conversion discount per level |
| Locale | Key `anomaly-scanner`; draft names now, replace with official Gameforge terms when Orion leaves beta |

## Implementation steps

1. **`www/ogame/calc/data/costs-techs.json`** — one entry after `"44"`:

   ```json
   "45": { "key": "anomaly-scanner", "type": 2, "cost": [90, 45, 15], "growth": 1.5 }
   ```

   This alone wires it into: costs tabs ("All items" ×2, "One item"), the queue
   Planet tab, MCP tools (`build-cost.js`, `build-queue.js`, `import-account.js`),
   and the dynamic MCP-bounds test in `playwright-tests/tests/queue.spec.js`.
   `production.php` also reads the file but keeps only the mines, ships and defence,
   so it is unaffected. Saved page state is keyed by tech id, not row position, so the
   new row shifts nothing.

2. **Localization** — add `"anomaly-scanner"` to the `common` block of all 13
   `www/locale/*.json` files (same commit; `make i18n-fix`, then real values,
   `make i18n-validate`). The draft names are in the locale files themselves, which the
   spell checker skips; a copy here would only drift from them.

3. **Regression test** — pin the sheet against the **real** JSON, not a hand-copied
   mirror (a mirror would pass even with a typo such as growth 1.4 in the JSON).
   Add a `describe('data/costs-techs.json: anomaly scanner')` block in
   `unit-tests/costs-core.test.js`, next to the existing `data/costs-techs.json: ship ids`
   block (same `readFileSync` pattern), loading `ogame-costs.js` and converting the
   entry to the `[metal, crystal, deut, growth]` shape the functions take:
   - key `anomaly-scanner`, type 2, cost `[90, 45, 15]`, growth 1.5;
   - `calcBuildCost_C` for levels 1–10 equals the sheet table above;
   - `Math.floor(getBuildTime_C({...}))` at `uniSpeed` 100, robotics 0, nanites 0, for
     each step L-1 → L, equals 1, 1, 1, 3, 6, 14, 22, 33, 49, 74 (truncated — see
     *Data analysis*; do not round).

   Optionally, a queue test that the scanner takes a field: add `45: [90, 45, 15, 1.5]`
   to the `TECH_COSTS` mirror in `unit-tests/queue-core.test.js` and assert `usedFields`
   grows by 1 per build step.

4. **Gate** — full `make check` (shared files touched: `costs-techs.json`, locales,
   tests).

5. **CHANGELOG** — a `feat` bullet under `## [Unreleased]` marked `<!-- site -->`, in
   the same commit. Do **not** cut a release or draft the in-app announcement: that needs
   the user's explicit approval.

6. **Commit** — only when asked. The change includes a `.js` test file, so the SonarQube
   question from `CLAUDE.md` applies before committing.

## Lithium production (measured 2026-11-18, server s808-en)

Out of scope for the costs/queue work above, recorded here for the future lithium calculator.
Source: the "?" modal of the scanner card (Techinfo tab, "Lithium/hour" table) on the three
planets of one account (scanner levels 20, 18, 19), plus the Lithium Production tab
(`component=orion&tab=lithiumproduction`).

### Production per level

```
lithium/hour(L) = floor( 153.6 * L * 1.1^L )
```

`P(L) / L` grows by exactly 1.1000 per level, which gives the form `c * L * 1.1^L`; c = 153.6.
The game **floors** (rounding matches only 6 of 15 rows, floor all 15). Matches every
displayed row for L = 16..32, identical on all three planets, so production depends on the
scanner level only.

| L | game | formula |
|--:|-----:|--------:|
| 16 | 11,292 | 11292.606 |
| 17 | 13,198 | 13198.233 |
| 18 | 15,372 | 15372.059 |
| 20 | 20,666 | 20666.880 |
| 25 | 41,605 | 41605.271 |
| 30 | 80,406 | 80406.846 |
| 32 | 103,778 | 103778.435 |

**Level 1 is extrapolated, not observed**: 153.6 * 1.1 = 168.96, so 168 lithium/hour. The
modal shows only a window of about +-2 levels below and +-12 above the current level, and the
lowest level on the account is 18. Confirm on a planet with a scanner at level 1-3 before
relying on it. The anomaly level in the same table equals the scanner level.

### Workload and conversion cost (Lithium Production tab)

Measured on the level-20 planet with one Control Centre component built, for all four
resources at workload 10..100% in steps of 10 (40 pairs, all reproduced):

```
B       = 153.6 * L * 1.1^L          // 20666.88 at L = 20
lithium = floor( B * w )             // w = workload / 100
cost    = round( lithium * k * (1 - 0.001 * N) )
```

- `k` = 3 metal, 2 crystal, 1 deuterium, 100 food per lithium.
- `0.001 * N` is the conversion discount: the Catalytic Converter's 0.05% per level, **summed
  over every planet of the account**. Verified 2026-11-18: converter level 2 on one planet
  (0.1%) plus level 1 on another (0.05%) gave 0.15%, and the costs at 100/50/10% workload on
  all three resources matched exactly (a level-18 scanner). The production calculator takes the
  total discount in percent rather than a component level.
- The Lithium Electrolysis Lab (+0.2% lithium per level) is **not** in the formula: it was
  not measured whether it raises `lithium`, and with it the cost, or only the lithium credited.
- The cost is computed from the **already floored** lithium, not from `B * w`. This is why a
  hand calculation agrees at 100% and drifts below it: at 10% food, `floor(2066.69) = 2066`,
  `2066 * 100 * 0.999 = 206393` (game), while `B * 0.1 * 100 * 0.999` would give 206453.
- The cost is rounded (not floored): crystal at 100% is `20666 * 1.998 = 41290.67`, shown as 41,291.
- Lithium at 100% to 10%: 20666, 18600, 16533, 14466, 12400, 10333, 8266, 6200, 4133, 2066.
- The "Duration" column depends on the planet's stock of the resource, not on this formula.

### The conversion on the game's resource settings page

The resource settings page (`page=resourceSettings`) lists the conversion as a row of its own,
`Conversion` (`data-techid="45"`), between "Items" and the officers: the hourly cost as a
negative number in the column of the resource being converted, zero elsewhere. The page's
"Total per hour" already includes it, so a planet can show a negative net income.

A saved page (s808-en, 2026-11-18) shows −7,230 metal per hour. That fits the formula above
with L = 11, workload 50%, no discount: `floor(153.6 * 11 * 1.1^11 * 0.5) = 2410` lithium,
`2410 * 3 = 7230`. The page does not show the scanner level, so L = 11 is inferred, not read.

## Production: lithium conversion (agreed and implemented 2026-11-18)

The production calculator charges the resource cost of the conversion to the planet. Lithium
itself is shown for reference only; the calculator has no lithium or food column.

| Topic | Decision |
|---|---|
| Scope | The "One planet" tab only. The settings are stored with the saved planet data, so "All planets" can take them up later without migrating anything |
| Controls | A checkbox "IAS" (locale key `ias-short` in `common`: "IAS" everywhere but RU, where the scanner is "Межпланетный сканер аномалий" and so "МСА"; tooltip with the full name, key `anomaly-scanner`) in the second row next to the race select, plus a gear button that opens a modal through `openModal()` |
| Modal fields | Scanner level; total conversion discount, % (two decimals - the game shows 0.15% for one converter level; locale-aware decimal helper, blur validation, 0-100); resource to convert — metal, crystal or deuterium (no food); workload — a select of 10-100% in steps of 10 (0 is the checkbox off). A read-only line "Lithium/hour: N" |
| Table | A row "Conversion" (`data-report-key="ias-conversion"`, report cells like the other rows) before the totals, after `lifeform-tech`, with the hourly cost as a negative number in the chosen resource's column. Shown only while the checkbox is on, in both the normal and the extended view; the hourly, daily and weekly totals include it |
| Formula | `lithiumConversion({ level, workloadPct, discountPct, resource })` in `production-core.js`, returning `{ lithium, cost: [m, c, d] }` per hour: `lithium = floor(153.6 * L * 1.1^L * w)`, `cost = round(lithium * k * (1 - discount))`, `k` = 3 / 2 / 1 |
| Universe speed | **Not applied** — the numbers are taken as measured on s808-en; whether lithium and the conversion scale with economy speed is unverified |
| Planet array | Slots 37-41 after the life form levels (`PLANET_IAS_*`): on, level, discount in hundredths of a percent (the array holds integers), resource, workload. A planet saved before reads as the defaults. The one-planet tab keeps them in `options.prm.ias*` as well, like its other fields |
| Profile | Every setting is per planet. The scanner level is `building.45`, the value the game reports, marked like the mine levels; on, discount (percent), resource and workload are kept as the profile planet's own values `ias.on`, `ias.discount`, `ias.resource`, `ias.workload` (`PRODUCTION_IAS_KEYS` in `profiles-core.js`), which the export never carries |
| Resource accumulation | "What will accumulate" uses the net total including the conversion, metal and crystal floored at 0 like deuterium (assumption: the game stops converting when the resource runs out). "When" shows `res-will-not-accumulate-ias` when a target needs the converted resource and its net total is not positive. The fleet and defence counts use the net total too |
| Totals row | Found by `data-report-key="prod-per-hour"`, no longer by index, so the conversion row above it shifts nothing |
| Amortization | Unchanged — the conversion does not affect what a mine upgrade adds |
| MCP | Not in this change; the `ogame_production` tool gets an optional `ias` argument later, once level 1 is confirmed |
| Tests | Unit tests in `unit-tests/production-core.test.js` on the measured lithium at every workload, the rounded crystal cost and the resource-settings point (L 11, 50%, no discount → 7230 metal), the profile round trip in `profiles-core.test.js`; Playwright for the dialog, the row, the totals, the accumulation, a reload, a saved planet and a profile |

## Beta caveat

Orion numbers changed in almost every test build (factor 1.4 → 1.5, lithium base
20 → 15.36). If they change again, the fix is a one-line edit of the JSON entry
(and the pinned test values). Since a push to `main` is the release, re-verify the
level-1 cost and the game id 45 in game **before pushing**.
