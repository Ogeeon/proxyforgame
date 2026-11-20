import { test, expect, expectLoadsCleanly, openDialog, dialogBody } from './base';
import { expectMcpBoundsMatchPage } from './mcp-bounds';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Scrap Merchant calculator: the API 2 export fills the counts, the rate
// and the counts drive the return, and a player profile shows each planet's
// counts beside the fields. The formulas themselves are covered by
// unit-tests/scrap-core.test.js; this spec checks the page wiring.

const OWN_API = readFileSync(join(__dirname, '../fixtures/own_api.json'), 'utf-8');
const ACCOUNT_EXPORT = readFileSync(join(__dirname, '../fixtures/account-export-v1.json'), 'utf8');

test.beforeEach(async ({ context }) => {
    // Keep the changelog dialog from opening on top of the page.
    await context.addInitScript(() => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
    });
});

/** Type a value into a field and leave it, as a player would. */
async function type(page, selector, value) {
    await page.locator(selector).fill(value);
    await page.locator(selector).blur();
}

/** Open the Defense tab of What to sell, where the defense fields are. */
async function openDefenseTab(page) {
    await page.locator('#sell-defense-tab').click();
    await expect(page.locator('#sell-defense')).toBeVisible();
}

/** Open the transport accordion, where the cargo fields are. */
async function openTransport(page) {
    await page.locator('#transport-toggle').click();
    await expect(page.locator('#hyper-tech-level')).toBeVisible();
}

/** The cargo counts in the accordion's header, small then large. */
async function expectHeadCounts(page, small, large) {
    await expect(page.locator('#transport-small-head')).toHaveText(small);
    await expect(page.locator('#transport-large-head')).toHaveText(large);
}

/** The sell-or-wait settings of a fresh page, as options_scrap keeps them. */
const SELL_TIMING_DEFAULTS = {
    eventRate: 81, eventDays: 180, routeKind: 'galaxies', routeDelta: 1, fsSpeed: 10, fsTimes: 1, fsDays: 1,
    cmbDrive: 0, impDrive: 0, hypDrive: 0, fuelDiscount: 0, rateMetal: 1, rateCrystal: 1.5, rateDeut: 3,
};

/** Open the "sell now or wait" accordion. */
async function openSellTiming(page) {
    await page.locator('#sell-timing-toggle').click();
    await expect(page.locator('#event-rate')).toBeVisible();
}

/** The verdict counts in the sell-or-wait accordion's header, wait then sell. */
async function expectVerdictCounts(page, wait, sell) {
    await expect(page.locator('#sell-timing-wait-head')).toHaveText(wait);
    await expect(page.locator('#sell-timing-sell-head')).toHaveText(sell);
}

/** Paste the API 2 export and import it. */
async function importOwnApi(page, text = OWN_API) {
    await page.locator('#own-api-input').fill(text);
    await page.locator('#own-api-import').click();
}

test.describe('Scrap Merchant - the page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/scrap');
    });

    test('the page loads without a script error', async ({ page }) => {
        await expectLoadsCleanly(page, /Scrap Merchant/i);
    });

    test('lists every ship and defense, zeros everywhere', async ({ page }) => {
        await expect(page.locator('#fleet-table tbody tr')).toHaveCount(17);
        await expect(page.locator('#defense-table tbody tr')).toHaveCount(10);
        await expect(page.locator('#unit-216')).toHaveCount(0);
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#total-payback-metal')).toHaveText('0');
        await expect(page.locator('#points-lost')).toHaveText('0');
    });

    test('the fleet and the defense are tabs, the fleet open on load', async ({ page }) => {
        await expect(page.locator('#sell-fleet-tab')).toHaveText('Fleet');
        await expect(page.locator('#sell-defense-tab')).toHaveText('Defenses');
        await expect(page.locator('#fleet-table thead th').first()).toHaveText('Ship');
        await expect(page.locator('#defense-table thead th').first()).toHaveText('Building');
        await expect(page.locator('#unit-202')).toBeVisible();
        await expect(page.locator('#unit-401')).toBeHidden();

        await openDefenseTab(page);
        await expect(page.locator('#unit-401')).toBeVisible();
        await expect(page.locator('#unit-202')).toBeHidden();
        await page.locator('#full-numbers').check();
        await type(page, '#unit-401', '3');
        await expect(page.locator('#defense-payback-metal')).toHaveText('2.100');

        // Which tab is open is not saved.
        await page.reload();
        await expect(page.locator('#unit-202')).toBeVisible();
        await expect(page.locator('#unit-401')).toBeHidden();
    });

    test('the transport accordion is collapsed and its header carries the counts', async ({ page }) => {
        await expect(page.locator('#transport-body')).toBeHidden();
        await expect(page.locator('#transport-toggle')).toHaveText(/Cargo ships to haul the resources away: SC\s0 \/ LC\s0/);
        await importOwnApi(page);
        await expectHeadCounts(page, '13.447', '2.690');
        await expect(page.locator('#transport-body')).toBeHidden();

        await page.locator('#transport-toggle').click();
        await expect(page.locator('#transport-body')).toBeVisible();
        await expect(page.locator('#transport-small')).toHaveText('13.447');
        await expect(page.locator('#transport-large')).toHaveText('2.690');

        // The open state is not saved.
        await page.reload();
        await expect(page.locator('#transport-body')).toBeHidden();
    });

    test('importing the API 2 export fills the counts and prices them', async ({ page }) => {
        await importOwnApi(page);
        await expect(page.locator('#unit-202')).toHaveValue('8855');
        await expect(page.locator('#unit-212')).toHaveValue('400');
        await expect(page.locator('#unit-219')).toHaveValue('106');
        // The defense counts come from the defenses block, not from the zeros
        // the export lists under ships.
        await expect(page.locator('#unit-401')).toHaveValue('26100');
        await expect(page.locator('#unit-408')).toHaveValue('1');
        await expect(page.locator('#unit-503')).toHaveValue('0');

        await expect(page.locator('#total-cost-metal')).toHaveText('164.262M');
        await expect(page.locator('#total-payback-metal')).toHaveText('57.491M');
        await expect(page.locator('#total-cost-msu')).toHaveText('278.5M');
        await expect(page.locator('#total-payback-msu')).toHaveText('97.4M');
        await expect(page.locator('#points-lost')).toHaveText('278.540');
        // The export's player: hyperspace 9, a Discoverer, no cargo bonuses -
        // 7250 and 36250 a ship.
        await expect(page.locator('#hyper-tech-level')).toHaveValue('9');
        await expect(page.locator('#collector-class')).not.toBeChecked();
        await expect(page.locator('#lf-collector-class-bonus')).toHaveValue('0');
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#transport-small')).toHaveText('13.447');
        await expect(page.locator('#transport-large')).toHaveText('2.690');

        await page.locator('#full-numbers').check();
        await expect(page.locator('#fleet-payback-metal')).toHaveText('16.861.950');
        await expect(page.locator('#fleet-payback-crystal')).toHaveText('19.311.250');
        await expect(page.locator('#fleet-payback-deuterium')).toHaveText('366.800');
        await expect(page.locator('#defense-cost-metal')).toHaveText('116.085.000');
        await expect(page.locator('#defense-payback-deuterium')).toHaveText('4.970.000');
        await expect(page.locator('#total-payback-crystal')).toHaveText('34.660.500');
        await expect(page.locator('#unit-406-deuterium')).toHaveText('4.200.000');
    });

    test('a count typed by hand recalculates at once', async ({ page }) => {
        await page.locator('#full-numbers').check();
        await importOwnApi(page);
        // Typed key by key, not left: the result follows every keystroke.
        await page.locator('#unit-214').fill('');
        await page.locator('#unit-214').pressSequentially('1');
        await expect(page.locator('#unit-214-metal')).toHaveText('1.750.000');
        await expect(page.locator('#fleet-payback-metal')).toHaveText('18.611.950');
        // The other section is left alone.
        await expect(page.locator('#defense-payback-metal')).toHaveText('40.629.750');
    });

    test('the sections are independent', async ({ page }) => {
        await page.locator('#full-numbers').check();
        await type(page, '#unit-202', '10');
        await expect(page.locator('#fleet-payback-metal')).toHaveText('7.000');
        await expect(page.locator('#defense-payback-metal')).toHaveText('0');
        await openDefenseTab(page);
        await type(page, '#unit-401', '100');
        await expect(page.locator('#defense-payback-metal')).toHaveText('70.000');
        await expect(page.locator('#fleet-payback-metal')).toHaveText('7.000');
        await expect(page.locator('#total-payback-metal')).toHaveText('77.000');
    });

    test('a fractional rate drops the fraction per unit and resource', async ({ page }) => {
        await page.locator('#full-numbers').check();
        await openDefenseTab(page);
        await type(page, '#unit-503', '3');
        await type(page, '#scrap-rate', '37.3');
        // 37.3% of 12500 is 4662.5 a missile: 3 x 4662, not 13987.
        await expect(page.locator('#unit-503-metal')).toHaveText('13.986');
        await expect(page.locator('#unit-503-crystal')).toHaveText('2.796');
        await expect(page.locator('#unit-503-deuterium')).toHaveText('11.190');
    });

    test('the rate is held to 1-100 on blur', async ({ page }) => {
        await type(page, '#scrap-rate', '0');
        await expect(page.locator('#scrap-rate')).toHaveValue('1');
        await type(page, '#scrap-rate', '150');
        await expect(page.locator('#scrap-rate')).toHaveValue('100');
        await page.locator('#full-numbers').check();
        await type(page, '#unit-202', '1');
        await expect(page.locator('#total-payback-metal')).toHaveText('2.000');
    });

    test('the rate and the counts start over after a reload, the full numbers and the cargo stay', async ({ page }) => {
        await page.locator('#full-numbers').check();
        await type(page, '#scrap-rate', '50');
        await type(page, '#unit-202', '10');
        await openTransport(page);
        await type(page, '#hyper-tech-level', '7');
        await page.locator('#collector-class').check();
        await type(page, '#lf-collector-class-bonus', '1.5');
        await type(page, '#sc-capacity-increase', '3.5');
        await type(page, '#lc-capacity-increase', '4.25');
        await page.reload();
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#unit-202')).toHaveValue('0');
        await expect(page.locator('#full-numbers')).toBeChecked();
        await expect(page.locator('#hyper-tech-level')).toHaveValue('7');
        await expect(page.locator('#collector-class')).toBeChecked();
        await expect(page.locator('#lf-collector-class-bonus')).toHaveValue('1.5');
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('3.5');
        await expect(page.locator('#lc-capacity-increase')).toHaveValue('4.25');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(saved).toEqual({
            fullNumbers: true, hyperTechLevel: 7, isCollector: true, collectorClassBonus: 1.5, scCapacityIncrease: 3.5, lcCapacityIncrease: 4.25,
            ...SELL_TIMING_DEFAULTS,
        });

        // Unticked survives a reload too.
        await openTransport(page);
        await page.locator('#collector-class').uncheck();
        await page.reload();
        await expect(page.locator('#collector-class')).not.toBeChecked();
    });

    test('a comma typed on the Russian page is saved as a plain number', async ({ page }) => {
        await page.goto('/ru/scrap');
        await openTransport(page);
        await type(page, '#sc-capacity-increase', '3,5');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(saved.scCapacityIncrease).toBe(3.5);
        await page.reload();
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('3,5');
    });

    test('the cargo fields change the cargo counts', async ({ page }) => {
        // A Death Star returns 3.5M. A fresh page counts at the base holds, the
        // Collector box unticked: 5000 and 25000 a ship.
        await type(page, '#unit-214', '1');
        await expectHeadCounts(page, '700', '140');
        await openTransport(page);
        await expect(page.locator('#collector-class')).not.toBeChecked();
        await page.locator('#collector-class').check();
        await expectHeadCounts(page, '560', '112');
        await page.locator('#collector-class').uncheck();
        await expectHeadCounts(page, '700', '140');
        await type(page, '#hyper-tech-level', '10');
        await expectHeadCounts(page, '467', '94');
        // The enhancement raises the Collector's bonus: nothing while the box is unticked.
        await expect(page.locator('#lf-collector-class-bonus')).toBeEnabled();
        await type(page, '#lf-collector-class-bonus', '60');
        await expectHeadCounts(page, '467', '94');
        await page.locator('#collector-class').check();
        await expectHeadCounts(page, '369', '74');
        await type(page, '#sc-capacity-increase', '10');
        await type(page, '#lc-capacity-increase', '20');
        await expectHeadCounts(page, '350', '67');
        await expect(page.locator('#transport-small')).toHaveText('350');
    });

    test('the import fills the class booster and the cargo bonuses the export carries', async ({ page }) => {
        const data = JSON.parse(OWN_API);
        data.characterClassId = 1;
        data.bonuses.characterClassBooster['1'] = 0.6;
        data.ships['202'].cargo = 0.1;
        data.ships['203'].cargo = 0.2;
        await importOwnApi(page, JSON.stringify(data));
        await expect(page.locator('#collector-class')).toBeChecked();
        await expect(page.locator('#lf-collector-class-bonus')).toHaveValue('60');
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('10');
        await expect(page.locator('#lc-capacity-increase')).toHaveValue('20');
        // 7250 + 2000 + 500 and 36250 + 10000 + 5000 a ship.
        await expectHeadCounts(page, '9.999', '1.903');
    });

    test('the import ticks the box for a Collector only, and leaves it without a class', async ({ page }) => {
        const data = JSON.parse(OWN_API);
        data.characterClassId = 2;
        await openTransport(page);
        await page.locator('#collector-class').check();
        await importOwnApi(page, JSON.stringify(data));
        await expect(page.locator('#collector-class')).not.toBeChecked();
        data.characterClassId = 1;
        await importOwnApi(page, JSON.stringify(data));
        await expect(page.locator('#collector-class')).toBeChecked();
        delete data.characterClassId;
        await importOwnApi(page, JSON.stringify(data));
        await expect(page.locator('#collector-class')).toBeChecked();
    });

    test('the reset clears the counts and the rate, and the cargo fields too', async ({ page }) => {
        await importOwnApi(page);
        await type(page, '#scrap-rate', '42');
        await openTransport(page);
        await type(page, '#sc-capacity-increase', '5');
        await page.locator('#collector-class').check();
        await page.locator('#reset').click();
        await expect(page.locator('#unit-202')).toHaveValue('0');
        await expect(page.locator('#unit-401')).toHaveValue('0');
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#total-cost-metal')).toHaveText('0');
        await expect(page.locator('#hyper-tech-level')).toHaveValue('0');
        await expect(page.locator('#collector-class')).not.toBeChecked();
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('0');
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(saved.hyperTechLevel).toBe(0);
        expect(saved.isCollector).toBe(false);
    });

    for (const [what, text] of [
        ['malformed JSON', '{"ships": '],
        ['unrelated JSON', '{"foo": {"bar": 1}}'],
        ['a plain number', '111'],
    ]) {
        test(`${what} gets the error dialog and leaves the counts`, async ({ page }) => {
            await type(page, '#unit-202', '7');
            await importOwnApi(page, text);
            const dialog = openDialog(page);
            await expect(dialog).toBeVisible();
            await expect(dialogBody(dialog)).toContainText('API 2');
            await dialog.locator('.modal-footer button').click();
            await expect(dialog).toHaveCount(0);
            await expect(page.locator('#unit-202')).toHaveValue('7');
        });
    }

    test('the sell-or-wait accordion is collapsed, its header counts the verdicts', async ({ page }) => {
        await expect(page.locator('#sell-timing-body')).toBeHidden();
        await expectVerdictCounts(page, '0', '0');
        await openSellTiming(page);
        await expect(page.locator('#sell-timing-empty')).toBeVisible();
        await expect(page.locator('#event-rate')).toHaveValue('81');
        await expect(page.locator('#event-days')).toHaveValue('180');
        await expect(page.locator('#route-kind')).toHaveValue('galaxies');
        await expect(page.locator('#fs-speed')).toHaveValue('10');
        // Every 10% without a profile: the General's 5% steps need one.
        await expect(page.locator('#fs-speed option')).toHaveCount(10);
        await expect(page.locator('#fuel-discount-box')).toBeVisible();
        await expect(page.locator('#fuel-discount-profile')).toBeHidden();
        await page.reload();
        await expect(page.locator('#sell-timing-body')).toBeHidden();
    });

    test('a fleet gets a row per flying type and a verdict the event days and rate flip', async ({ page }) => {
        // 100 battleships saved to the next galaxy at 10% once a day burn 34.571
        // deuterium a day, 103.714 MSU: the event's 46% more on their 6.75M is worth
        // 29 days of it.
        await type(page, '#unit-207', '100');
        await type(page, '#unit-212', '50');
        await openSellTiming(page);
        const rows = page.locator('#sell-timing-rows tr:not(#sell-timing-empty)');
        await expect(rows).toHaveCount(1);
        await expect(page.locator('#sell-timing-empty')).toBeHidden();
        const cells = rows.first().locator('td');
        await expect(cells.nth(0)).toHaveText('Battleship');
        await expect(cells.nth(2)).toHaveText('29');
        await expect(cells.nth(4)).toHaveText('sell');
        await expectVerdictCounts(page, '0', '1');
        await expect(page.locator('#sell-timing-gain')).toHaveText('0');

        await type(page, '#event-days', '29');
        await expect(cells.nth(4)).toHaveText('wait');
        await expectVerdictCounts(page, '1', '0');
        await page.locator('#full-numbers').check();
        // 3.105.000 - 29 x 103.714,26
        await expect(page.locator('#sell-timing-gain')).toHaveText('97.287');

        // An event that pays what today pays is never worth waiting for.
        await type(page, '#event-rate', '35');
        await expect(cells.nth(2)).toHaveText('—');
        await expect(cells.nth(4)).toHaveText('sell');

        // Twice as often costs twice the fuel.
        await type(page, '#event-rate', '81');
        await type(page, '#fs-times', '2');
        await expect(cells.nth(2)).toHaveText('14');
    });

    test('the route kind holds the steps to its range', async ({ page }) => {
        await openSellTiming(page);
        await type(page, '#route-delta', '20');
        await page.locator('#route-kind').selectOption('system');
        await expect(page.locator('#route-delta')).toHaveValue('14');
    });

    test('the sell-or-wait settings survive a reload, and the reset puts them back', async ({ page }) => {
        await page.goto('/ru/scrap');
        await openSellTiming(page);
        await type(page, '#event-rate', '70,5');
        await type(page, '#event-days', '30');
        await page.locator('#route-kind').selectOption('systems');
        await type(page, '#route-delta', '5');
        await page.locator('#fs-speed').selectOption('20');
        await type(page, '#fs-times', '2');
        await type(page, '#fs-days', '3');
        await type(page, '#cmb-drive', '4');
        await type(page, '#imp-drive', '5');
        await type(page, '#hyp-drive', '6');
        await type(page, '#fuel-discount', '12,5');
        await type(page, '#exchange-rates-m', '2');
        await type(page, '#exchange-rates-c', '3');
        await type(page, '#exchange-rates-d', '4');
        const expected = {
            eventRate: 70.5, eventDays: 30, routeKind: 'systems', routeDelta: 5, fsSpeed: 20, fsTimes: 2, fsDays: 3,
            cmbDrive: 4, impDrive: 5, hypDrive: 6, fuelDiscount: 12.5, rateMetal: 2, rateCrystal: 3, rateDeut: 4,
        };
        const saved = async () => page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(await saved()).toMatchObject(expected);

        await page.reload();
        await openSellTiming(page);
        await expect(page.locator('#event-rate')).toHaveValue('70,5');
        await expect(page.locator('#route-kind')).toHaveValue('systems');
        await expect(page.locator('#route-delta')).toHaveValue('5');
        await expect(page.locator('#fs-speed')).toHaveValue('20');
        await expect(page.locator('#fs-days')).toHaveValue('3');
        await expect(page.locator('#hyp-drive')).toHaveValue('6');
        await expect(page.locator('#fuel-discount')).toHaveValue('12,5');
        await expect(page.locator('#exchange-rates-d')).toHaveValue('4');

        await page.locator('#reset').click();
        await expect(page.locator('#event-rate')).toHaveValue('81');
        await expect(page.locator('#cmb-drive')).toHaveValue('0');
        await expect(page.locator('#exchange-rates-c')).toHaveValue('1,5');
        expect(await saved()).toMatchObject(SELL_TIMING_DEFAULTS);
    });

    test('the API 2 import fills the drives of the fleet save', async ({ page }) => {
        const data = JSON.parse(OWN_API);
        data.researches['115'] = 11;
        data.researches['117'] = 9;
        data.researches['118'] = 7;
        await importOwnApi(page, JSON.stringify(data));
        await openSellTiming(page);
        await expect(page.locator('#cmb-drive')).toHaveValue('11');
        await expect(page.locator('#imp-drive')).toHaveValue('9');
        await expect(page.locator('#hyp-drive')).toHaveValue('7');
    });

    test('without a profile there is no planet select and no planet counts', async ({ page }) => {
        await expect(page.locator('#pf-planet-box')).toBeHidden();
        await expect(page.locator('#unit-202-planet')).toBeHidden();
        await expect(page.locator('#fleet-planet-hint')).toBeHidden();
        await expect(page.locator('#defense-planet-hint')).toBeHidden();
    });
});

test.describe('Scrap Merchant - MCP tool', () => {
    test('the tool takes the ranges the page does', async ({ page }) => {
        await page.goto('/en/scrap');
        const tool = 'ogame_scrap';
        await expectMcpBoundsMatchPage(page, [
            { tool, arg: 'rate', selector: '#scrap-rate' },
            { tool, arg: 'ships.small-cargo', selector: '#unit-202' },
            { tool, arg: 'solarSatellites.count', selector: '#unit-212' },
            { tool, arg: 'crawlers.count', selector: '#unit-217' },
            { tool, arg: 'defenses.plasma-turret', selector: '#unit-406' },
            { tool, arg: 'defenses.ipm', selector: '#unit-503' },
            { tool, arg: 'hyperspaceTechnology', selector: '#hyper-tech-level', prm: 'hyperTechLevel' },
            { tool, arg: 'lifeforms.collectorClassBonus', selector: '#lf-collector-class-bonus', prm: 'collectorClassBonus' },
            { tool, arg: 'lifeforms.shipBonuses.small-cargo.cargo', selector: '#sc-capacity-increase', prm: 'scCapacityIncrease' },
            { tool, arg: 'sellTiming.eventRate', selector: '#event-rate', prm: 'eventRate' },
            { tool, arg: 'sellTiming.daysToEvent', selector: '#event-days', prm: 'eventDays' },
            { tool, arg: 'sellTiming.speedPercent', selector: '#fs-speed' },
            { tool, arg: 'sellTiming.timesPerDays.times', selector: '#fs-times', prm: 'fsTimes' },
            { tool, arg: 'sellTiming.timesPerDays.days', selector: '#fs-days', prm: 'fsDays' },
            { tool, arg: 'sellTiming.drives.combustion', selector: '#cmb-drive', prm: 'cmbDrive' },
            { tool, arg: 'sellTiming.fuelDiscount', selector: '#fuel-discount', prm: 'fuelDiscount' },
            { tool, arg: 'sellTiming.exchangeRates.crystal', selector: '#exchange-rates-c', prm: 'rateCrystal' },
        ]);
    });
});

// ---------------------------------------------------------------------------
// Player profiles: the counts of the chosen planet beside the fields.
// ---------------------------------------------------------------------------

/**
 * The fixture account, changed: Alpha lists no large cargo at all (a unit the
 * export leaves out is a unit the planet does not have), Beta no ships at all
 * (a planet whose fleet nobody imported).
 */
function editedExport(characterClassId = 1) {
    const data = JSON.parse(ACCOUNT_EXPORT);
    delete data.planets['900001'].ships['203'];
    delete data.planets['900002'].ships;
    data.characterClassId = characterClassId;
    return JSON.stringify(data);
}

/** The class the active profile holds: {game, override?}. */
async function profileClass(page) {
    return page.evaluate(() => {
        const own = sessionStorage.getItem('pfg_active_profile');
        const id = JSON.parse(own ?? localStorage.getItem('pfg_active_profile') ?? '""');
        return id ? JSON.parse(localStorage.getItem('pfg_profile_' + id) || 'null')?.account.values.class : null;
    });
}

/** The class a stored {game, override?} pair stands for (1 Collector, 2 General, 3 Discoverer). */
function effectiveClass(cls) {
    return cls?.override ?? cls?.game;
}

/** Import an account export into a new profile, picking the first universe offered. */
async function importAccount(page, text) {
    await page.locator('#pf-select').selectOption('__import');
    await expect(page.locator('#pf-import-modal')).toBeVisible();
    await page.locator('#pf-import-text').fill(text);
    await page.locator('#pf-import-go').click();
    // Schema 1 carries no universe: the dialog asks for it.
    const box = page.locator('#pf-import-universe-box');
    if (await box.isVisible()) {
        const country = page.locator('#pf-import-country');
        const codes = await country.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        if (codes.length > 0) await country.selectOption(codes[0]);
        await page.locator('#pf-import-go').click();
    }
    await expect(page.locator('#pf-import-modal')).toBeHidden();
}

test.describe('Scrap Merchant - player profiles', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/scrap');
        await importAccount(page, editedExport());
    });

    test('the select lists the planets and no moon', async ({ page }) => {
        await expect(page.locator('#pf-planet-box')).toBeVisible();
        const labels = await page.locator('#pf-planet option').allTextContents();
        expect(labels).toEqual(['Alpha [2:148:8]', 'Beta [2:150:12]', 'Colony [3:20:4]']);
    });

    test('a click on a planet count puts it into the field', async ({ page }) => {
        await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
        await expect(page.locator('#fleet-planet-hint')).toBeVisible();
        await expect(page.locator('#unit-217-planet')).toHaveText('300');
        await page.locator('#unit-217-planet').click();
        await expect(page.locator('#unit-217')).toHaveValue('300');
        await page.locator('#full-numbers').check();
        await expect(page.locator('#unit-217-metal')).toHaveText('210.000');

        await openDefenseTab(page);
        await expect(page.locator('#unit-401-planet')).toHaveText('1.000');
        await page.locator('#unit-401-planet').click();
        await expect(page.locator('#unit-401')).toHaveValue('1000');
    });

    test('a unit the planet does not list shows 0, and a click puts 0', async ({ page }) => {
        await type(page, '#unit-203', '5');
        await expect(page.locator('#unit-203-planet')).toBeVisible();
        await expect(page.locator('#unit-203-planet')).toHaveText('0');
        await page.locator('#unit-203-planet').click();
        await expect(page.locator('#unit-203')).toHaveValue('0');
    });

    test('a planet with no fleet data hides the fleet counts, not the defense ones', async ({ page }) => {
        await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
        await expect(page.locator('#fleet-planet-hint')).toBeHidden();
        await expect(page.locator('#unit-212-planet')).toBeHidden();
        await openDefenseTab(page);
        await expect(page.locator('#defense-planet-hint')).toBeVisible();
        await expect(page.locator('#unit-401-planet')).toHaveText('500');
        await expect(page.locator('#unit-502-planet')).toHaveText('10');
    });

    test('another planet changes the counts beside the fields, not the fields', async ({ page }) => {
        await openDefenseTab(page);
        await page.locator('#unit-401-planet').click();
        await expect(page.locator('#unit-401')).toHaveValue('1000');
        await page.locator('#pf-planet').selectOption({ label: 'Colony [3:20:4]' });
        await expect(page.locator('#unit-401-planet')).toHaveText('0');
        await expect(page.locator('#unit-401')).toHaveValue('1000');
    });

    test('the profile fills the cargo fields from the account', async ({ page }) => {
        // Hyperspace 8, a Collector, enhancement 2.15%, cargo bonuses 1.23% and 2.5%:
        // 8338 and 42009 a ship, as the cost calculator holds them.
        await openTransport(page);
        await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
        await expect(page.locator('#collector-class')).toBeChecked();
        await expect(page.locator('#lf-collector-class-bonus')).toHaveValue('2.15');
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');
        await expect(page.locator('#lc-capacity-increase')).toHaveValue('2.5');
        await type(page, '#unit-214', '1');
        await expectHeadCounts(page, '420', '84');
        // Account values: another planet leaves them as they are.
        await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
        await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    });

    test('a cargo field edited under a profile goes into the profile, not into the own settings', async ({ page }) => {
        await openTransport(page);
        await type(page, '#hyper-tech-level', '12');
        // Unticking under a Collector's profile leaves it with no class.
        await page.locator('#collector-class').uncheck();
        await expect.poll(() => profileClass(page)).toEqual({ game: 1, override: 0 });
        await page.reload();
        await expect(page.locator('#hyper-tech-level')).toHaveValue('12');
        await expect(page.locator('#collector-class')).not.toBeChecked();
        // The cost calculator reads the same profile.
        await page.goto('/en/costs');
        await expect(page.locator('#hyper-tech-level')).toHaveValue('12');
        // Without the profile the page's own values come back.
        await page.goto('/en/scrap');
        await page.locator('#pf-select').selectOption('');
        await expect(page.locator('#hyper-tech-level')).toHaveValue('0');
        await expect(page.locator('#collector-class')).not.toBeChecked();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(saved.hyperTechLevel).toBe(0);
        expect(saved.isCollector).toBe(false);
    });

    test('ticking the box under a profile writes the Collector back', async ({ page }) => {
        await openTransport(page);
        await page.locator('#collector-class').uncheck();
        await expect.poll(() => profileClass(page)).toEqual({ game: 1, override: 0 });
        await page.locator('#collector-class').check();
        await expect.poll(async () => effectiveClass(await profileClass(page))).toBe(1);
    });

    test('the reset keeps the cargo fields the profile owns', async ({ page }) => {
        await expect(page.locator('#reset')).toBeVisible();
        await type(page, '#scrap-rate', '42');
        await type(page, '#unit-202', '10');
        await openTransport(page);
        await type(page, '#sc-capacity-increase', '5');
        await page.locator('#reset').click();
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#unit-202')).toHaveValue('0');
        await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
        await expect(page.locator('#collector-class')).toBeChecked();
        await expect(page.locator('#sc-capacity-increase')).toHaveValue('5');
    });

    test('the fleet save takes the drives and the discounts from the profile', async ({ page }) => {
        await openSellTiming(page);
        await expect(page.locator('#cmb-drive')).toHaveValue('16');
        await expect(page.locator('#imp-drive')).toHaveValue('12');
        await expect(page.locator('#hyp-drive')).toHaveValue('9');
        await expect(page.locator('#fuel-discount-box')).toBeHidden();
        await expect(page.locator('#fuel-discount-profile')).toBeVisible();
        // A drive edited here is the profile's: flight reads it.
        await type(page, '#hyp-drive', '11');
        await page.goto('/en/flight');
        await expect(page.locator('#hyp-drive')).toHaveValue('11');
        // Without the profile the page's own drives and the discount field come back.
        await page.goto('/en/scrap');
        await page.locator('#pf-select').selectOption('');
        await openSellTiming(page);
        await expect(page.locator('#hyp-drive')).toHaveValue('0');
        await expect(page.locator('#fuel-discount-box')).toBeVisible();
        await expect(page.locator('#fuel-discount-profile')).toBeHidden();
    });

    test('back to no profile hides the select and the counts', async ({ page }) => {
        await page.locator('#pf-select').selectOption('');
        await expect(page.locator('#pf-planet-box')).toBeHidden();
        await expect(page.locator('#unit-217-planet')).toBeHidden();
        await expect(page.locator('#fleet-planet-hint')).toBeHidden();
    });
});

test.describe('Scrap Merchant - a General\'s profile', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/en/scrap');
        await importAccount(page, editedExport(2));
    });

    test('shows the box unticked and keeps the class until the box is ticked', async ({ page }) => {
        await openTransport(page);
        await expect(page.locator('#collector-class')).not.toBeChecked();
        // An edit elsewhere leaves the General alone.
        await type(page, '#hyper-tech-level', '9');
        await expect.poll(async () => effectiveClass(await profileClass(page))).toBe(2);
        await page.locator('#collector-class').check();
        await expect.poll(() => profileClass(page)).toEqual({ game: 2, override: 1 });
        // Unticked again, a Collector becomes no class, not the General back.
        await page.locator('#collector-class').uncheck();
        await expect.poll(() => profileClass(page)).toEqual({ game: 2, override: 0 });
    });

    test('offers the General\'s 5% speed steps for the fleet save', async ({ page }) => {
        await openSellTiming(page);
        await expect(page.locator('#fs-speed option')).toHaveCount(20);
        await page.locator('#fs-speed').selectOption('15');
        await expect(page.locator('#fs-speed')).toHaveValue('15');
    });
});
