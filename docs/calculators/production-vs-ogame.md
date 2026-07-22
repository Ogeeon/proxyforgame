# Production calculator vs. OGame — known numeric differences

Findings from comparing the Production calculator (one-planet tab) against a live
OGame resource-settings page, 2026-07-21 (Human) and 2026-07-22 (Rock'tal).

## Reference case A — Human

Human life form, planet position 10, max temperature 41, universe speed 8,
Discoverer, alliance class "Traders", energy tech 15, plasma tech 9.

Buildings: Metal Mine 26, Crystal Mine 28, Deuterium Synthesizer 31, Solar Plant 30,
Fusion Reactor 15, 304 solar satellites, 0 crawlers.
Life form: level 2.19; Research Centre 13, Academy of Sciences 12,
Neuro-Calibration Centre 10, High Energy Smelting 3, Food Silo 18,
Fusion-Powered Production 6, Skyscraper 16, Biotech Lab 6, Metropolis 5,
Planetary Shield 1.
Life form research bonuses entered: metal 4.17 %, crystal 3.35 %, deuterium 4.59 %,
energy 1.02 %, crawlers 0 %.

Mine output matched exactly (87 012 / 64 606 / 60 740), so every difference below is
in a bonus row, not in the base production formula.

## Reference case B — Rock'tal

Same account, different planet: Rock'tal life form, level 0, universe speed 8,
Discoverer, alliance class "Traders", energy tech 15, plasma tech 9.

Buildings: Metal Mine 26, Crystal Mine 26, Deuterium Synthesizer 29, Solar Plant 30,
Fusion Reactor 15, 343 solar satellites, 0 crawlers.
Life form: Rune Technologium 6, Rune Forge 12, Oriktorium 7, Magma Forge 4,
Disruption Chamber 8, Megalith 6, Crystal Refinery 6, Deuterium Synthesiser 3,
Mineral Research Centre 5, Advanced Recycling Plant 1.
Life form research bonuses entered: metal 4.18 %, crystal 3.35 %, deuterium 4.59 %,
energy 1.02 %.

Mine output again matched exactly (91 474 / 49 579 / 48 873). This case is what
surfaced section 4 below.

## Reference cases C and D — Mechas and Kaelesh

Same account, two more planets, captured 2026-07-22. Both are notable because their
12th life form building is at **level 2**, which is what settled section 3.

* **Mechas**, position 10, universe speed 8, energy tech 15, plasma tech 9.
  Metal Mine 26, Crystal Mine 27, Deuterium Synthesizer 29, Solar Plant 27,
  Fusion Reactor 15, 194 satellites. Life form: Robotics Research Centre 5,
  Update Network 12, Quantum Computer Centre 9, Automatised Assembly Centre 3,
  High-Performance Transformer 4, Microchip Assembly Line 13,
  Production Assembly Hall 9, High-Performance Synthesiser 3,
  Chip Mass Production 5, Nano Repair Bots 2.
* **Kaelesh**, position 8, universe speed 8, energy tech 15, plasma tech 9.
  Metal Mine 26, Crystal Mine 26, Deuterium Synthesizer 30, Solar Plant 29,
  Fusion Reactor 13, 315 satellites. Life form: Vortex Chamber 5,
  Halls of Realisation 12, Forum of Transcendence 6, Antimatter Convector 10,
  Cloning Laboratory 7, Chrysalis Accelerator 12, Bio Modifier 6,
  Psionic Modulator 3, Ship Manufacturing Hall 5, Supra Refractor 2.

All 20 life form buildings matched `floor(base × level × coeff^level)` exactly, and the
summed consumption matched OGame's own total to the unit (21 572 and 23 835).

## 1. Life form tech bonus was counted twice — FIXED

| Resource | OGame | Calculator (before fix) |
|---|---|---|
| Metal | 3 634 | 3 799 |
| Crystal | 2 164 | 2 266 |
| Deuterium | 2 791 | 2 919 |
| Energy | 271 | 283 |

All four rows were off by the same factor, 1.0469, which is exactly the calculator's
`lfTechMult`:

* life form level 2.19 → +2.19 %
* Metropolis level 5 → `lfBonus[1011].tech = [0.5, 1, 1]` → 0.5 × 5 = +2.5 %

`calculateProduction` multiplied the percentages entered on the LifeForms panel by
that factor. Dividing OGame's own numbers by the mine output shows the entered
percentages are already the final ones:

| | entered | OGame effective |
|---|---|---|
| Metal | 4.17 % | 3634 / 87012 = 4.176 % |
| Crystal | 3.35 % | 2164 / 64606 = 3.3495 % |
| Deuterium | 4.59 % | 2791 / 60740 = 4.595 % |
| Energy | 1.02 % | 271 / 26522 = 1.0218 % |

The percentages OGame shows on the life form research panel already include the
technology bonus, so applying `lfTechMult` on top double-counted it.

**Fix:** the research percentages are used as entered (`production-core.js`). The
technology bonus is still collected in `lfBuildingEffects` — it is what OGame's own
panel applies to the displayed percentages — but the calculator no longer re-applies
it.

Side effect: the technology bonus no longer changes production at all. The *Lifeform
level* input existed only to feed it, so the field was removed from the UI along with
its stored value (planet slot 37 of `aPS`), its validation case and its tests — the
version had not shipped yet, so no storage migration was needed. Metropolis, Chip Mass
Production and High-Performance Transformer keep their rows and their energy draw; only
their `tech` contribution is inert. `lfBuildingEffects` still totals it under `tech` for
reference, and nothing reads it.

Two Playwright tests that asserted the old amplification were inverted to assert the
bonus stays put; the three tests covering the removed field were dropped.

Residual difference in the reference case: metal 3 628 vs. 3 634 and deuterium 2 788 vs.
2 791, purely because the entered percentages were truncated to two decimals (4.17
instead of 4.176, 4.59 instead of 4.595). Crystal and energy match exactly.

**Confirmed by case C.** Case A had a technology bonus of only 4.69 %, all but 2.19 of
it from a single Metropolis. The Mechas planet has two technology-bonus buildings —
High-Performance Transformer 4 (+1.2 %) and Chip Mass Production 5 (+2.0 %), i.e.
+3.2 % — and OGame's metal row is 3 637, exactly 4.18 % of the 87 012 mine output. With
the multiplier it would have been 3 753. The implied percentages are stable across all
four planets (4.180 / 3.352 / 4.599 / 1.0220), as expected for account-wide research.

## 2. OGame floors bonus rows, the calculator rounds them — OPEN

Every remaining ±1 difference is a floor-vs-round mismatch:

| Row | OGame | Calculator | Exact value |
|---|---|---|---|
| High Energy Smelting (metal) | 3 915 | 3 916 | 87012 × 4.5 % = 3915.54 |
| Fusion-Powered Production (crystal) | 5 814 | 5 815 | 64606 × 9 % = 5814.54 |
| Plasma technology (crystal) | 3 837 | 3 838 | 64606 × 5.94 % = 3837.6 |
| Plasma technology (deuterium) | 1 803 | 1 804 | 60740 × 2.97 % = 1803.98 |
| Alliance class (metal) | 4 350 | 4 351 | 87012 × 5 % = 4350.6 |

Case B shows the same pattern: Magma Forge metal 7 317 vs. 7 318 (91474 × 8 % =
7317.92), plasma 8 232 / 2 944 / 1 451 vs. 8 233 / 2 945 / 1 452, alliance class
4 573 / 2 478 / 2 443 vs. 4 574 / 2 479 / 2 444, Disruption Chamber energy gain
3 240 vs. 3 241.

Cases C and D add twelve more plasma / alliance-class data points. Eight of them are
values where `floor` and `round` disagree, and OGame matched `floor` in all eight.

Sources of the rounding:

* `js/common.js` — `getProductionRateSplit`, rows 2/3/4/6/7/8 (plasma, booster,
  geologist, all officers, player class, alliance class) use `Math.round`.
* `js/production-core.js` — life form tech bonus and per-building bonus rows use
  `Math.round`.

Not changed yet: `common.js` is shared by every calculator and the Playwright
expectations encode the current numbers, so switching to `Math.floor` needs a
coordinated pass over the tests.

## 3. Level-1 buildings draw base energy, without the growth coefficient — OPEN

The energy formula `floor(base × level × coeff^level)` (`lfBuildingEnergy`) matches
OGame for every building at level 2 or above:

| Building | Level | Formula | OGame |
|---|---|---|---|
| Research Centre | 13 | 10 × 13 × 1.08^13 = 353.5 | 353 |
| Academy of Sciences | 12 | 15 × 12 × 1.25^12 = 2619.3 | 2619 |
| Neuro-Calibration Centre | 10 | 30 × 10 × 1.25^10 = 2794.0 | 2793 |
| High Energy Smelting | 3 | 40 × 3 × 1.1^3 = 159.7 | 159 |
| Fusion-Powered Production | 6 | 80 × 6 × 1.1^6 = 850.3 | 850 |
| Skyscraper | 16 | 50 × 16 × 1.02^16 = 1098.2 | 1098 |
| Biotech Lab | 6 | 60 × 6 × 1.03^6 = 429.9 | 429 |
| Metropolis | 5 | 90 × 5 × 1.05^5 = 574.3 | 574 |
| Rune Technologium | 6 | 15 × 6 × 1.1^6 = 159.4 | 159 |
| Rune Forge | 12 | 20 × 12 × 1.35^12 = 8794.6 | 8794 |
| Oriktorium | 7 | 60 × 7 × 1.3^7 = 2635.5 | 2635 |
| Magma Forge | 4 | 40 × 4 × 1.1^4 = 234.2 | 234 |
| Megalith | 6 | 80 × 6 × 1.3^6 = 2316.9 | 2316 |
| Crystal Refinery | 6 | 90 × 6 × 1.1^6 = 956.6 | 956 |
| Deuterium Synthesiser | 3 | 90 × 3 × 1.1^3 = 359.4 | 359 |
| Mineral Research Centre | 5 | 120 × 5 × 1.3^5 = 2227.8 | 2227 |
| Planetary Shield | **3** | 100 × 3 × 1.02^3 = 318.4 | 318 |
| Robotics Research Centre | 5 | 13 × 5 × 1.08^5 = 95.5 | 95 |
| Update Network | 12 | 10 × 12 × 1.2^12 = 1069.9 | 1069 |
| Quantum Computer Centre | 9 | 40 × 9 × 1.2^9 = 1857.5 | 1857 |
| Automatised Assembly Centre | 3 | no energy | 0 |
| High-Performance Transformer | 4 | 40 × 4 × 1.05^4 = 194.5 | 194 |
| Microchip Assembly Line | 13 | 40 × 13 × 1.01^13 = 591.8 | 591 |
| Production Assembly Hall | 9 | 80 × 9 × 1.04^9 = 1024.8 | 1024 |
| High-Performance Synthesiser | 3 | 60 × 3 × 1.1^3 = 239.6 | 239 |
| Chip Mass Production | 5 | 70 × 5 × 1.05^5 = 446.7 | 446 |
| **Nano Repair Bots** | **2** | 100 × 2 × 1.05^2 = 220.5 | **220** |
| Vortex Chamber | 5 | 10 × 5 × 1.08^5 = 73.5 | 73 |
| Halls of Realisation | 12 | 15 × 12 × 1.3^12 = 4193.7 | 4193 |
| Forum of Transcendence | 6 | 30 × 6 × 1.3^6 = 868.8 | 868 |
| Antimatter Convector | 10 | no energy | 0 |
| Cloning Laboratory | 7 | no energy | 0 |
| Chrysalis Accelerator | 12 | 30 × 12 × 1.03^12 = 513.3 | 513 |
| Bio Modifier | 6 | 40 × 6 × 1.02^6 = 270.3 | 270 |
| Psionic Modulator | 3 | 140 × 3 × 1.05^3 = 486.2 | 486 |
| Ship Manufacturing Hall | 5 | 90 × 5 × 1.04^5 = 547.5 | 547 |
| **Supra Refractor** | **2** | 100 × 2 × 1.05^2 = 220.5 | **220** |

(The Rock'tal figures are the pre-reduction values; see section 4 — OGame displays
them multiplied by 0.96.)

The formula is also confirmed by
[sidian.app/s/ogame-wiki/lifeforms/formulas](https://sidian.app/s/ogame-wiki/lifeforms/formulas).

Both level-1 observations we have, however, come out at exactly the base energy, with
no growth coefficient applied:

| Building | Level | Formula | OGame |
|---|---|---|---|
| **Planetary Shield** | **1** | 100 × 1 × 1.02 = 102 | **100** |
| **Advanced Recycling Plant** | **1** | 100 × 1 × 1.1 = 110 | **100** (96 after −4 %) |

The two buildings have the same base (100) but different coefficients (1.02 and 1.1),
and both land on 100 — a 2 % and a 10 % miss respectively, so this is not rounding
noise. It looks like OGame simply does not apply the coefficient at level 1:

```
f(1) = base
f(L) = floor(base × L × coeff^L)   for L >= 2
```

**Retracted:** an earlier revision of this document concluded that the energy
coefficient of the *12th building of each race* was wrong and should be `1.0`. That is
dead twice over:

| Observation | formula | coeff = 1.0 | exponent L−1 | OGame |
|---|---|---|---|---|
| Planetary Shield 3 | **318** | 300 | 312 | **318** |
| Nano Repair Bots 2 | **220** | 200 | 210 | **220** |
| Supra Refractor 2 | **220** | 200 | 210 | **220** |

The same building slot obeys the standard formula at levels 2 and 3, so
`lf-techdata.inc.php` is correct — do not change it. What is special is the *level*, not
the building.

Still OPEN because the level-1 rule rests on two observations of buildings that happen
to share a base of 100 — no level-1 building appears in cases C or D. The cheapest
decisive test is a level-1 building with a large coefficient — e.g. Rune Forge
(base 20, coeff 1.35): the formula predicts 27, the level-1 rule predicts 20.

The practical impact is small (a level-1 building over-draws by `base × (coeff − 1)`
energy), so the special case has not been added to `lfBuildingEnergy` yet.

## 4. Disruption Chamber energy-consumption reduction was not shown per row — FIXED

Disruption Chamber (`production.php:52`) has two effects: `enP` +1.5 %/level on energy
production and `enR` −0.5 %/level on energy consumption. At level 8 that is +12 % and
−4 %.

The production part is displayed correctly — the building's own row shows 3 241
(OGame 3 240) = 12 % of the 27 006 base output (Solar Plant 10 469 + Fusion Reactor
6 933 + 343 satellites 9 604).

The consumption part used to be applied to the total only — `production-core.js`
multiplied `totalEnergyUsed` after the rows were already built — so every consumer row
in the table showed its unreduced draw. OGame reduces each row instead:

| Row | Calculator | × 0.96 | OGame |
|---|---|---|---|
| Metal Mine 26 | 3 098 | 2974.08 | 2 974 |
| Crystal Mine 26 | 3 098 | 2974.08 | 2 974 |
| Deuterium Synthesizer 29 | 9 200 | 8832.00 | 8 832 |
| Rune Technologium 6 | 159 | 152.64 | 152 |
| Rune Forge 12 | 8 794 | 8442.24 | 8 442 |
| Oriktorium 7 | 2 635 | 2529.60 | 2 529 |
| Magma Forge 4 | 234 | 224.64 | 224 |
| Megalith 6 | 2 316 | 2223.36 | 2 223 |
| Crystal Refinery 6 | 956 | 917.76 | 917 |
| Deuterium Synthesiser 3 | 359 | 344.64 | 344 |
| Mineral Research Centre 5 | 2 227 | 2137.92 | 2 137 |
| Advanced Recycling Plant 1 | 110 | 105.60 | 96 (see section 3) |

Ten of eleven match exactly under `floor` — the maths was already right, only the
presentation differed. The eleventh is the section 3 level-1 case.

**Fix:** when `enR > 0`, `calculateProduction` now also floors each consumer row by the
same factor — the three mine rows, the crawler row and every life form building row.
`totalEnergyUsed` keeps being derived from the unreduced sum, so the production
coefficient and the totals are untouched, and the rows can add up to slightly less than
the total. That mismatch is not a defect: OGame does exactly the same (its rows sum to
31 844 against a stated total of 31 849).

Energy totals confirm both readings:

* Calculator: produced 31 872, used floor(33 186 × 0.96) = 31 858 → balance **14**,
  which is what the total row shows.
* OGame: 31 849 used / 31 873 produced → balance **24**.
* The 10-unit gap is entirely the Advanced Recycling Plant (10 × 0.96 ≈ 9.6). With
  section 3 fixed the calculator lands on floor(33 176 × 0.96) = 31 848 and the same
  balance of 24.

## 5. Where a building's energy-production bonus is displayed — OPEN (cosmetic)

The calculator always shows a life form building's `enP` gain in the building's own
row, net of that building's own draw. OGame only does that when the building draws no
energy at all:

| Case | Building | Its own row in OGame | OGame's "Lifeform Tech Bonus" energy |
|---|---|---|---|
| B (Rock'tal) | Disruption Chamber 8 (`enP` +12 %, draws 0) | **3 240** = 12 % of 27 006 | 276 = 1.022 % of 27 006 |
| C (Mechas) | High-Performance Transformer 4 (`enP` +4 %, draws 194) | **194** (its draw) | 986 = **(1.022 + 4) %** of 19 638 |

So when a building both produces and consumes, OGame shows the consumption in its row
and folds the production bonus into the Lifeform Tech Bonus row. Case D (Kaelesh) has
no `enP` building and its Lifeform Tech Bonus energy is 230 = 1.022 % of 22 507, which
pins the research percentage independently.

Totals are unaffected — this is purely which row the number lands in.

## Note on OGame's own totals

OGame floors every displayed row but sums the *unrounded* values, so its total can
exceed the sum of the rows it shows. Example from case C: the metal rows read
280 + 87 012 + 7 831 + 4 350 + 3 637 = 103 110, while the total row says 103 111.
Do not treat a 1-unit gap between a total and its rows as a defect.

Note also that the calculator's total energy column shows the balance while OGame shows
`used / produced`. That is a display convention, not a defect.
