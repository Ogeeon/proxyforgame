import { test, expect, expectLoadsCleanly } from './base';
import { expectMcpBoundsMatchPage } from './mcp-bounds';
import { catchReport, reportCell, sendReport } from './report-dialog';

test.describe('Lifeforms costs Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/lfcosts');
    });

    // Helper function to fill table rows
    async function fillTableRows(page, tableId, startRow, endRow, col3Value, col4Value = null) {
        for (let row = startRow; row <= endRow; row++) {
            await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(3) input`).fill(col3Value.toString());
            if (col4Value !== null) {
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(4) input`).fill(col4Value.toString());
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(4) input`).press('Enter');
            } else {
                await page.locator(`${tableId} tr:nth-child(${row}) td:nth-child(3) input`).press('Enter');
            }
        }
    }

    // Helper: add every research for the given race via the dynamic UX
    async function addAllResearchesForRace(page, outerTab, raceValue) {
        await page.locator(`#research-race-dd-${outerTab}`).selectOption(raceValue);
        const optCount = await page.locator(`#research-select-${outerTab} option`).count();
        for (let i = 0; i < optCount; i++) {
            await page.locator(`#research-select-${outerTab}`).selectOption({ index: i });
            await page.locator(`#research-add-btn-${outerTab}`).click();
        }
    }

    test('the page loads without a script error', async ({ page }) => {
        await expectLoadsCleanly(page, /Costs calculator for LifeForms/);
    });

    // options.prm.rates is an array; it and the scalar params must all come back
    // after a reload (.claude/plans/settings-serialization.md).
    test('parameters and exchange rates survive a reload', async ({ page }) => {
        await page.locator('#param-buildings-tab').click();
        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await page.locator('#param-common-tab').click();
        await page.locator('#exchange-rates-c').fill('2.5');
        await page.locator('#exchange-rates-c').press('Enter');

        await page.reload();

        await page.locator('#param-common-tab').click();
        await expect(page.locator('#exchange-rates-c')).toHaveValue('2.5');
        await page.locator('#param-buildings-tab').click();
        await expect(page.locator('#robot-factory-level')).toHaveValue('10');
    });

    // The stored race is shown from the first paint, before the calculator's
    // scripts run: with them blocked, only the page's inline script and the
    // stylesheet decide which rows and inputs are visible.
    test('the stored race is shown before the calculator loads', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#race-selector').selectOption('3');

        await page.route('**/lfcosts-orchestration.js*', (route) => route.abort());
        await page.reload();

        await expect(page.locator('html')).toHaveAttribute('data-lf-race', '3');
        await expect(page.locator('#race-selector')).toHaveValue('3');
        await expect(page.locator('#rbt-res-centre-level-wrap')).toBeVisible();
        await expect(page.locator('#research-centre-level-wrap')).toBeHidden();
        await expect(page.locator('#table-0-1 tr[data-race="3"]').first()).toBeAttached();
        const visibleRaces = await page.locator('#table-0-1 tr[data-race]').evaluateAll(
            (rows) => [...new Set(rows.filter((r) => getComputedStyle(r).display !== 'none').map((r) => r.dataset.race))]);
        expect(visibleRaces).toEqual(['3']);
    });

    // By default we end up with Humans selected
    test('[all items - one level / buildings / human] calculations are correct', async ({ page }) => {
        test.setTimeout(60000);
        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-1').click();
        await fillTableRows(page, '#table-0-1', 2, 13, 2);
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(4)')).toContainText('1.785M');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(5)')).toContainText('836.528');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(6)')).toContainText('825.960');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(7)')).toContainText('5.517M');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('2w 2d 22h');
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').check();
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(4)')).toContainText('1.785.028');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(7)')).toContainText('5.517.700');
        await page.locator('#metal-available-0-1').fill('700000');
        await page.locator('#metal-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(3)')).toContainText('1.085.028');
        await page.locator('#crystal-available-0-1').fill('800000');
        await page.locator('#crystal-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(4)')).toContainText('36.528');
        await page.locator('#deut-available-0-1').fill('1000000');
        await page.locator('#deut-available-0-1').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(54) td:nth-child(5)')).toContainText('0');

        await page.locator('#param-buildings-tab').click();
        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('1d 12h 59m');
        await page.locator('#nanite-factory-level').fill('10');
        await page.locator('#nanite-factory-level').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('2m 9s');

        await page.locator('#param-common-tab').click();
        await page.locator('#universe-speed').selectOption('3');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(8)')).toContainText('43s');
    });

    test('[exchange rates] MSU column reflects user-entered rates', async ({ page }) => {
        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-1').click();
        await fillTableRows(page, '#table-0-1', 2, 13, 2);
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').check();
        // Default rates 1:1.5:3 → MSU = m + 1.5c + 3d = 5.517.700
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(7)')).toContainText('5.517.700');
        // Flip rates so multipliers become 1, 2, 2 → MSU = m + 2c + 2d = 5.110.004
        await page.locator('#exchange-rates-m').fill('1');
        await page.locator('#exchange-rates-m').press('Enter');
        await page.locator('#exchange-rates-c').fill('2');
        await page.locator('#exchange-rates-c').press('Enter');
        await page.locator('#exchange-rates-d').fill('2');
        await page.locator('#exchange-rates-d').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(7)')).toContainText('5.110.004');
        // Doubling metal rate halves crystal/deut multipliers → MSU = m + c + d = 3.447.516
        await page.locator('#exchange-rates-m').fill('2');
        await page.locator('#exchange-rates-m').press('Enter');
        await expect(page.locator('#table-0-1 tr:nth-child(50) td:nth-child(7)')).toContainText('3.447.516');
    });

    test('[all items - one level / researches / human] calculations are correct', async ({ page }) => {
        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-2').click();
        await addAllResearchesForRace(page, 0, '1');
        await fillTableRows(page, '#table-0-2', 2, 19, 2);
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('7.797M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('5.076M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('2.684M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(8)')).toContainText('5d 2h 8m');
        await page.locator('#research-cost-reduction').fill('10');
        await page.locator('#research-cost-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('7.017M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('4.568M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('2.416M');
        await page.locator('#research-time-reduction').fill('10');
        await page.locator('#research-time-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(8)')).toContainText('4d 13h 55m');
    });

    // The transports needed for the whole tab, read from the form: the range inputs
    // of both tables, the race, Hyperspace Technology and the two capacity bonuses.
    // The arithmetic - and the same counts for the other three races - is pinned
    // in unit-tests/lfcosts-core.test.js; this is the wiring.
    test('[all items - multiple levels / human] SC/LC counts follow the tables and the cargo settings', async ({ page }) => {
        test.setTimeout(60000);

        /** The SC and LC counts of a table's "transports needed" row. */
        async function transports(tableId) {
            const row = page.locator(`${tableId} tr`).filter({ hasText: 'SC' })
                .and(page.locator(`${tableId} tr`).filter({ hasText: 'LC' })).first();
            const sc = await row.locator('td:nth-child(3)').textContent();
            const lc = await row.locator('td:nth-child(4)').textContent();
            return { sc: Number.parseInt(sc.replace(/\D/g, ''), 10), lc: Number.parseInt(lc.replace(/\D/g, ''), 10) };
        }

        /** Every visible row of the table goes from level 1 to level 2. */
        async function fillOneToTwo(tableId) {
            const from = page.locator(`${tableId} tr td:nth-child(3) input`);
            const to = page.locator(`${tableId} tr td:nth-child(4) input`);
            const count = await from.count();
            for (let i = 0; i < count; i++) {
                if (await from.nth(i).isVisible()) {
                    await from.nth(i).fill('1');
                    await from.nth(i).press('Enter');
                    await to.nth(i).fill('2');
                    await to.nth(i).press('Enter');
                }
            }
        }

        async function setCargo(hyper, capIncr) {
            await page.locator('#param-researches-tab').click();
            await page.locator('#hyper-tech-level').fill(String(hyper));
            await page.locator('#hyper-tech-level').press('Enter');
            await page.locator('#param-lifeforms-tab').click();
            await page.locator('#sc-capacity-increase').fill(String(capIncr));
            await page.locator('#sc-capacity-increase').press('Enter');
            await page.locator('#lc-capacity-increase').fill(String(capIncr));
            await page.locator('#lc-capacity-increase').press('Enter');
        }

        await page.locator('#race-selector').selectOption('1');

        // Buildings alone
        await page.locator('#tabtag-1').click();
        await expect(page.locator('#tab-1')).toBeVisible();
        await fillOneToTwo('#table-1-1');
        await expect.poll(() => transports('#table-1-1')).toEqual({ sc: 552, lc: 111 });
        await setCargo(10, 0);
        await expect.poll(() => transports('#table-1-1')).toEqual({ sc: 395, lc: 79 });
        await setCargo(10, 10);
        await expect.poll(() => transports('#table-1-1')).toEqual({ sc: 373, lc: 75 });

        // The researches join the buildings: the count is for the whole tab.
        await setCargo(0, 0);
        await page.locator('#tabtag-1-2').click();
        await expect(page.locator('#tab-1-2')).toBeVisible();
        await addAllResearchesForRace(page, 1, '1');
        await fillOneToTwo('#table-1-2');
        await expect.poll(() => transports('#table-1-2')).toEqual({ sc: 3041, lc: 609 });
        await setCargo(10, 0);
        await expect.poll(() => transports('#table-1-2')).toEqual({ sc: 2173, lc: 435 });
        await setCargo(10, 10);
        await expect.poll(() => transports('#table-1-2')).toEqual({ sc: 2055, lc: 411 });
    });

    test('[researches / human / research-centre bonus] reduces costs and time', async ({ page }) => {
        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-2').click();
        await addAllResearchesForRace(page, 0, '1');
        await fillTableRows(page, '#table-0-2', 2, 19, 2);

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#research-centre-level').fill('10');
        await page.locator('#research-centre-level').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('7.602M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('4.949M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('2.617M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(8)')).toContainText('4d 1h 42m');

        // Stacks additively with manual research-cost-reduction
        await page.locator('#research-cost-reduction').fill('10');
        await page.locator('#research-cost-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('6.822M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('4.441M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('2.349M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(8)')).toContainText('4d 1h 42m');

        // Stacks with manual research-time-reduction
        await page.locator('#research-time-reduction').fill('10');
        await page.locator('#research-time-reduction').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(8)')).toContainText('3d 13h 29m');
    });

    test('[researches / rocktal / rune-tech bonus] reduces research costs', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#race-selector').selectOption('2');

        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-2').click();
        await addAllResearchesForRace(page, 0, '2');
        await fillTableRows(page, '#table-0-2', 2, 19, 2);

        // Baseline
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('7.100M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('4.359M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('3.243M');

        await page.locator('#param-lifeforms-tab').click();
        await page.locator('#rune-tech-level').fill('10');
        await page.locator('#rune-tech-level').press('Enter');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(4)')).toContainText('6.922M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(5)')).toContainText('4.25M');
        await expect(page.locator('#table-0-2 tr:nth-child(20) td:nth-child(6)')).toContainText('3.162M');
    });

    test('[research reduction fields] clamp entered value to max on blur', async ({ page }) => {
        await page.locator('#param-lifeforms-tab').click();

        // Cost reduction is capped at 50%
        await page.locator('#research-cost-reduction').fill('150');
        await page.locator('#research-cost-reduction').blur();
        await expect(page.locator('#research-cost-reduction')).toHaveValue('50');

        // Time reduction is capped at 99%
        await page.locator('#research-time-reduction').fill('150');
        await page.locator('#research-time-reduction').blur();
        await expect(page.locator('#research-time-reduction')).toHaveValue('99');

        // Values within range are left untouched
        await page.locator('#research-cost-reduction').fill('30');
        await page.locator('#research-cost-reduction').blur();
        await expect(page.locator('#research-cost-reduction')).toHaveValue('30');

        await page.locator('#research-time-reduction').fill('80');
        await page.locator('#research-time-reduction').blur();
        await expect(page.locator('#research-time-reduction')).toHaveValue('80');
    });

    test('[research reduction caps] effective reduction stays within 50% cost / 99% time', async ({ page }) => {
        // Reads the totals row of the researches table
        async function readTotals() {
            const row = page.locator('#table-0-2 tr:nth-child(20)');
            return {
                metal: (await row.locator('td:nth-child(4)').textContent()).trim(),
                crystal: (await row.locator('td:nth-child(5)').textContent()).trim(),
                deut: (await row.locator('td:nth-child(6)').textContent()).trim(),
                time: (await row.locator('td:nth-child(8)').textContent()).trim(),
            };
        }

        async function setParam(id, value) {
            await page.locator(id).fill(value);
            await page.locator(id).press('Enter');
        }

        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-2').click();
        await addAllResearchesForRace(page, 0, '1');
        await fillTableRows(page, '#table-0-2', 2, 19, 2);
        const baseline = await readTotals();

        // Research centre 100 alone: cost -25% (0.25/lvl), raw time reduction 200% (2/lvl)
        await page.locator('#param-lifeforms-tab').click();
        await setParam('#research-centre-level', '100');
        const centreOnly = await readTotals();

        // Raw 200% would make the duration negative, which getBuildTimeLF floors to 1s.
        // Clamping to 99% keeps 1/100 of the baseline instead.
        expect(centreOnly.time).toBe('1h 13m 8s');
        expect(centreOnly.metal).toBe('5.847M');
        expect(baseline.time).toBe('5d 2h 8m');

        // Adding the manual time reduction on top changes nothing - already at the 99% cap
        await setParam('#research-time-reduction', '99');
        const centrePlusTime = await readTotals();
        expect(centrePlusTime.time).toBe(centreOnly.time);

        // Manual cost reduction on top: 50 + 25 raw, clamped to 50%
        await setParam('#research-cost-reduction', '50');
        const centrePlusBoth = await readTotals();
        expect(centrePlusBoth.metal).not.toBe(centreOnly.metal);

        // Same 50% cap without the research centre - both configurations must match
        await setParam('#research-centre-level', '0');
        const manualOnly = await readTotals();
        expect(manualOnly.metal).toBe(centrePlusBoth.metal);
        expect(manualOnly.crystal).toBe(centrePlusBoth.crystal);
        expect(manualOnly.deut).toBe(centrePlusBoth.deut);
        expect(manualOnly.time).toBe(centrePlusBoth.time);
    });

    // todo: hyperspace, class bonus and lf bonuses to cargo cap
});

// ---------------------------------------------------------------------------
// The multi-level table ("commons") totals writer indexes rows by counting
// backwards from the table end, and Hawk caught it throwing on tables that
// lost that shape ("Cannot read properties of undefined (reading 'children')",
// 2026-10-25) - the cross-version page mixes of that week could serve a stale
// table with the new renderer. The renderer now skips a table without its
// footer shape. The empty level range (from == to) is the closest state a
// healthy page can reach: no data rows, footer only - it must render clean.
// ---------------------------------------------------------------------------
test.describe('Multi-level table with an empty level range', () => {
    test('the totals writer does not throw', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));

        await page.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/lfcosts');

        // Reveal the pane holding the multi-level controls, outer tabs first.
        const paneChain = await page.evaluate(() => {
            const panes = [];
            let el = document.getElementById('tab2-from-level');
            while (el && el !== document.body) {
                if (el.classList && el.classList.contains('tab-pane')) panes.unshift(el.id);
                el = el.parentElement;
            }
            return panes;
        });
        for (const paneId of paneChain) {
            await page.locator(`[data-bs-target="#${paneId}"]`).click();
        }

        await page.locator('#tab2-from-level').fill('5');
        await page.locator('#tab2-from-level').press('Enter');
        await page.locator('#tab2-to-level').fill('5');
        await page.locator('#tab2-to-level').press('Enter');
        await page.waitForTimeout(250);

        expect(
            errors.filter((e) => /reading 'children'|reading 'innerHTML'/.test(e)),
            'no uncaught error from the totals writer',
        ).toEqual([]);
    });
});

// The calculation-error report attaches the calculator's own snapshot
// (reportSnapshot in lfcosts-data-collector.js): the tabs the number was read
// on, the cell it came from, and only the fields that differ from their
// factory defaults - never the resources available, nor the full-numbers
// switch, which only changes how the numbers are written.
test.describe('LF Costs Calculator - calculation-error report', () => {
    test('names the mode, the selected cell and the changed fields', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/lfcosts');
        const sent = await catchReport(page);

        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-1').click();
        const level = page.locator('#table-0-1 tr[data-report-key="resid-sector"] input');
        await level.fill('5');
        await level.press('Enter');
        await page.locator('#param-buildings-tab').click();
        await page.locator('#robot-factory-level').fill('10');
        await page.locator('#robot-factory-level').press('Enter');
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').check();
        await page.locator('#metal-available-0-1').fill('5000');
        await page.locator('#metal-available-0-1').press('Enter');
        const cell = page.locator('#table-0-1 [data-report-cell="grand-total.metal"]');
        await expect(cell).toHaveText('72');

        await reportCell(page, cell);
        await expect(page.locator('#report-calc-values li')).toHaveText([
            'Mode: All items - one level › Buildings',
            'Selected: Grand total, Metal',
            'Buildings',
            'Residential Sector — Level: 5',
            'Parameters — Buildings',
            'Robotics factory: 10',
        ]);

        await sendReport(page, sent, '73');
        expect(sent()?.get('context')).toBe([
            'mode: tabtag-0 / tabtag-0-1',
            'selected: grand-total.metal = "72"',
            'resid-sector.level = 5',
            'robot-factory-level = 10',
        ].join('\n'));
    });
});

// Every calculator has a reportSnapshot() hook now, but sidebar.js still walks
// the visible fields when a page has none - or when the hook throws. Without
// the hook, a table input is named by its aria-label, a checkbox reads
// yes/no, and what still stands at its default - or is empty - is not listed,
// nor is a field marked data-report-skip.
test.describe('Calculation-error report without a calculator hook', () => {
    test('lists the changed fields by their aria-label and leaves out defaults and empty values', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/lfcosts');
        await page.evaluate(() => {
            delete globalThis.reportSnapshot;
            delete globalThis.describeCell;
        });

        await page.locator('#tabtag-0').click();
        await page.locator('#tabtag-0-1').click();
        const level = page.locator('#table-0-1 tr:nth-child(2) td:nth-child(3) input');
        await level.fill('2');
        await level.press('Enter');
        const caption = await level.getAttribute('aria-label');
        // A resources-available field is marked data-report-skip: typed in,
        // it still stays out of the report.
        const available = page.locator('#metal-available-0-1');
        await available.fill('5000');
        await available.press('Enter');
        const availableCaption = await available.getAttribute('aria-label');
        await page.locator('#param-common-tab').click();
        await page.locator('#full-numbers').check();

        await page.locator('#table-0-1 tr:nth-child(2) td:nth-child(4)').evaluate((td) => {
            const range = document.createRange();
            range.selectNodeContents(td);
            const selection = getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            findSelection();
        });
        await expect(page.locator('#reportModal')).toBeVisible();

        const lines = await page.locator('#report-calc-values li').allTextContents();
        expect(lines).toContain(`${caption}: 2`);
        expect(lines).toContain('Full numbers: yes');
        for (const line of lines) {
            expect(line).not.toMatch(/^\s*:|:\s*$|\b(on|off)\b/);
        }
        // The parameters left alone are not listed.
        expect(lines.some((line) => line.startsWith('Exchange rates'))).toBe(false);
        expect(availableCaption).toBeTruthy();
        expect(lines.some((line) => line.startsWith(`${availableCaption}:`))).toBe(false);
        expect(lines.some((line) => line.includes('5000') || line.includes('5.000'))).toBe(false);
    });
});

test.describe('LF Costs Calculator - MCP tools', () => {
    test('the tool takes the ranges the page does', async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/lfcosts');

        const tool = 'ogame_lifeform_cost';
        // The tool's one research building stands for whichever the race has.
        const researchBuildings = [
            ['#research-centre-level', 'resCentreLvl'],
            ['#rune-tech-level', 'runeTechLvl'],
            ['#rbt-res-centre-level', 'rbtResCentreLvl'],
            ['#vortex-chamber-level', 'vortexChamberLvl'],
        ];
        await expectMcpBoundsMatchPage(page, [
            { tool, arg: 'fromLevel', selector: '#tab2-from-level' },
            { tool, arg: 'toLevel', selector: '#tab2-to-level' },
            { tool, arg: 'lifeforms.megalith', selector: '#megalith-level', prm: 'megalithLvl' },
            { tool, arg: 'lifeforms.mineralResearchCentre', selector: '#mrc-level', prm: 'mineralResCntrLvl' },
            ...researchBuildings.map(([selector, prm]) => ({ tool, arg: 'lifeforms.researchBuilding', selector, prm })),
            { tool, arg: 'lifeforms.researchCostReduction', selector: '#research-cost-reduction', prm: 'researchCostReduction' },
            { tool, arg: 'lifeforms.researchTimeReduction', selector: '#research-time-reduction', prm: 'researchTimeReduction' },
            { tool, arg: 'lifeforms.shipBonuses.small-cargo.cargo', selector: '#sc-capacity-increase', prm: 'capIncrSC' },
            { tool, arg: 'lifeforms.shipBonuses.large-cargo.cargo', selector: '#lc-capacity-increase', prm: 'capIncrLC' },
            { tool, arg: 'facilities.roboticsFactory', selector: '#robot-factory-level', prm: 'robotFactoryLevel' },
            { tool, arg: 'facilities.naniteFactory', selector: '#nanite-factory-level', prm: 'naniteFactoryLevel' },
            { tool, arg: 'universeSpeed', selector: '#universe-speed', prm: 'universeSpeed' },
            { tool, arg: 'ionTechnology', selector: '#ion-tech-level', prm: 'ionTechLevel' },
            { tool, arg: 'hyperspaceTechnology', selector: '#hyper-tech-level', prm: 'hyperTechLevel' },
        ]);
    });
});
