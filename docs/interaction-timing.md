# Field INP: the `interaction_timing` table

CrUX reports the site's 75th-percentile interaction latency (INP) but not which
calculator, control or phase is behind it. `www/js/interaction-timing.js`
measures it on every page load of the public site and sends one row per load to
the `interactionTiming` service (`www/api/interaction-timing.inc.php`), which
stores it in `interaction_timing` (`db/migrations/0003_create_interaction_timing.sql`).

It replaced the "INP slow" events `hawk.tpl` sent to Hawk on 2026-11-02. Those
were four fifths of Hawk's traffic within a day, landed as one group per element
id, and carried no denominator, so neither the share of slow visits nor a
percentile could be read out of them.

## What a row is

One page load on `proxyforgame.com` / `proxyforgame.net` (the script is loaded
by `analitics.tpl`, so not locally, in CI or under the e2e suite) that had at
least one interaction. Loads without one send nothing, as CrUX counts them.

| column | meaning |
|---|---|
| `load_id` | random per page load, stored nowhere in the browser; a later beacon of the same load replaces the row |
| `created_at`, `release_sha` | first beacon's time; the deployed commit, read by the server |
| `page`, `lang` | `location.pathname`, `<html lang>` |
| `pointer_type`, `cpu_cores` | `coarse`/`fine`/`none`, `navigator.hardwareConcurrency`; NULL when unknown |
| `interactions` | distinct interactions seen (16 ms threshold, plus first-input) |
| `inp_ms` | the page's INP: the slowest interaction, one outlier skipped per 50 (as web-vitals) |
| `input_delay_ms`, `processing_ms`, `presentation_ms` | its three phases |
| `start_ms`, `dcl_ms` | when it started, and DOMContentLoaded, both from navigation start |
| `event_type`, `target` | e.g. `click`, `button#tabtag-1` (tag + id, or tag + two classes; `(unknown)` once the element is gone) |

Thresholds: good ≤ 200 ms, needs improvement ≤ 500 ms, poor > 500 ms.

Reading the phases: a long **input delay** means the main thread was busy when
the user acted (start-up work, a long task elsewhere) - the handler is not to
blame. Long **processing** is the handler itself. Long **presentation** is the
style, layout and paint the handler caused - a large table re-rendered, say.
`start_ms < dcl_ms` marks an interaction that came while the page was still
starting up.

## Queries

Run them on the host against the site's database (credentials in the checkout's
`.env`). Both work on MariaDB 10.4 (CI) and 11.8 (the host). MariaDB does not
accept a named `WINDOW` for `PERCENTILE_CONT`, hence the repeated `OVER`.

Share of poor page loads and the p75 per calculator, last 7 days:

```sql
SELECT DISTINCT
  calc,
  COUNT(*) OVER (PARTITION BY calc) AS loads,
  ROUND(AVG(inp_ms > 500) OVER (PARTITION BY calc) * 100, 1) AS poor_pct,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY inp_ms) OVER (PARTITION BY calc) AS p75_inp,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY input_delay_ms) OVER (PARTITION BY calc) AS p75_delay,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY presentation_ms) OVER (PARTITION BY calc) AS p75_paint
FROM (SELECT SUBSTRING_INDEX(page, '/', -1) AS calc, inp_ms, input_delay_ms, presentation_ms
      FROM interaction_timing WHERE created_at > NOW() - INTERVAL 7 DAY) AS recent
ORDER BY loads DESC;
```

The controls behind poor INP, and how many of those came during start-up:

```sql
SELECT SUBSTRING_INDEX(page, '/', -1) AS calc, target, event_type,
       COUNT(*) AS n, ROUND(AVG(inp_ms)) AS avg_inp,
       ROUND(AVG(start_ms < dcl_ms) * 100) AS during_startup_pct
FROM interaction_timing
WHERE created_at > NOW() - INTERVAL 7 DAY AND inp_ms > 500
GROUP BY calc, target, event_type
ORDER BY n DESC
LIMIT 20;
```

Before/after a release: add `release_sha` to the partition, or filter on it.

## Limits

- Rows older than 90 days are deleted by the service, 100 per request.
- At most 1000 new rows an hour (`INTERACTION_TIMING_LIMIT_HOURLY` lowers it);
  the busiest day of the quarter before November 2026 had 1820 page views in total.
- Browsers without the Event Timing API (Safari, for one) send nothing, so the
  table describes Chromium-based and other supporting browsers only.
- Rows the e2e suite writes carry `page = '/e2e/interaction-timing'`.
