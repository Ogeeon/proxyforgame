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
        await expect(page.locator('#transport-small-head')).toHaveText('19.498');
        await expect(page.locator('#transport-large-head')).toHaveText('3.900');
        await expect(page.locator('#transport-body')).toBeHidden();

        await page.locator('#transport-toggle').click();
        await expect(page.locator('#transport-body')).toBeVisible();
        await expect(page.locator('#transport-small')).toHaveText('19.498');
        await expect(page.locator('#transport-large')).toHaveText('3.900');

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
        await expect(page.locator('#transport-small')).toHaveText('19.498');
        await expect(page.locator('#transport-large')).toHaveText('3.900');

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

    test('the rate and the counts start over after a reload, the full numbers stay', async ({ page }) => {
        await page.locator('#full-numbers').check();
        await type(page, '#scrap-rate', '50');
        await type(page, '#unit-202', '10');
        await page.reload();
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#unit-202')).toHaveValue('0');
        await expect(page.locator('#full-numbers')).toBeChecked();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('options_scrap') ?? '{}'));
        expect(saved).toEqual({ fullNumbers: true });
    });

    test('the reset clears the counts and the rate', async ({ page }) => {
        await importOwnApi(page);
        await type(page, '#scrap-rate', '42');
        await page.locator('#reset').click();
        await expect(page.locator('#unit-202')).toHaveValue('0');
        await expect(page.locator('#unit-401')).toHaveValue('0');
        await expect(page.locator('#scrap-rate')).toHaveValue('35');
        await expect(page.locator('#total-cost-metal')).toHaveText('0');
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
function editedExport() {
    const data = JSON.parse(ACCOUNT_EXPORT);
    delete data.planets['900001'].ships['203'];
    delete data.planets['900002'].ships;
    return JSON.stringify(data);
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

    test('back to no profile hides the select and the counts', async ({ page }) => {
        await page.locator('#pf-select').selectOption('');
        await expect(page.locator('#pf-planet-box')).toBeHidden();
        await expect(page.locator('#unit-217-planet')).toBeHidden();
        await expect(page.locator('#fleet-planet-hint')).toBeHidden();
    });
});
