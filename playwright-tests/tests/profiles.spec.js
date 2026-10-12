import { test, expect } from './base';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Player profiles (ADR-0004) on the production calculator, the first one wired
// to them: importing an account export, editing a profile-owned field and
// restoring the game value, falling back to "no profile", converting an old
// saved set, the backup file and the per-tab active profile; then flight, the
// second: account fields, the locked universe, the departure body and its fleet;
// then the queue and costs: a planet and a moon of the profile as the start
// levels, or as the factories, the lab and the temperature; then the LF costs,
// one planet with its life form and life-form buildings; then graviton, one
// planet with its power plants and satellites.
// The model itself is covered by unit-tests/profiles-core.test.js.

const EXPORT = readFileSync(join(__dirname, '../fixtures/account-export-v1.json'), 'utf8');

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
        localStorage.setItem('lastChange', 'key-value;true,value;99999');
    });
});

/** Pick an action from the profile select (import, create, manage). */
async function chooseAction(page, value) {
    await page.locator('#pf-select').selectOption(value);
}

/** Import the fixture export, picking the first country and universe offered. */
async function importExport(page) {
    await chooseAction(page, '__import');
    await expect(page.locator('#pf-import-modal')).toBeVisible();
    await page.locator('#pf-import-text').fill(EXPORT);
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

/** The stored profile currently active in this tab. */
async function activeProfile(page) {
    return page.evaluate(() => {
        const id = JSON.parse(sessionStorage.getItem('pfg_active_profile') || '""');
        return id ? JSON.parse(localStorage.getItem('pfg_profile_' + id) || 'null') : null;
    });
}

function metalMineInput(page) {
    return page.locator('#one-planet-prod tr:not(.lf-row)').nth(2).locator('input');
}

test('the selector starts on "no profile" with the actions listed', async ({ page }) => {
    await page.goto('/production');
    await expect(page.locator('#pf-select')).toHaveValue('');
    await expect(page.locator('#pf-select option[value="__import"]')).toHaveCount(1);
    await expect(page.locator('#pf-planet-row')).toBeHidden();
});

test('importing an export fills the calculator from the profile', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);

    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    await expect(page.locator('#plasma-tech-level')).toHaveValue('15');
    await expect(page.locator('#geologist')).toBeChecked();
    await expect(page.locator('#is-trader')).toBeChecked();
    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#max-planet-temp')).toHaveValue('41');
    await expect(metalMineInput(page)).toHaveValue('30');
    await expect(page.locator('#planetsSpin')).toHaveValue('3');
    // Production's own reset would turn every default into an edit of the profile.
    await expect(page.locator('#reset')).toBeHidden();
});

test('an edit becomes an override that can be restored', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);

    await metalMineInput(page).fill('31');
    await metalMineInput(page).blur();
    await expect(metalMineInput(page)).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30, override: 31 });
    // The edit shows in the all-planets table too.
    await expect(page.locator('#all-planets-prod tr').nth(1).locator('td').nth(4).locator('input')).toHaveValue('31');

    await page.locator('#one-planet-prod .pf-reset').first().click();
    await expect(metalMineInput(page)).toHaveValue('30');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30 });
});

test('the restore button has a Bootstrap tooltip that goes with it', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await metalMineInput(page).fill('31');
    await metalMineInput(page).blur();

    const reset = page.locator('#one-planet-prod .pf-reset').first();
    await reset.hover();
    await expect(page.locator('.tooltip')).toContainText('In game: 30');
    await reset.click();
    await expect(page.locator('.tooltip')).toHaveCount(0);
});

test('the buttons of the manage dialog have a tooltip that goes with the row', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await chooseAction(page, '__manage');

    const del = page.locator('#pf-manage-rows tr').first().locator('button').nth(1);
    await del.hover();
    await expect(page.locator('.tooltip')).toContainText('Delete');
    await del.click();
    await expect(page.locator('.tooltip')).toHaveCount(0);
    await page.locator('.modal.show:not([id^="pf-"]) .btn-primary').click();
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(0);
    await expect(page.locator('.tooltip')).toHaveCount(0);
});

test('the overrides badge restores only the ticked values', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await page.locator('#param-researches-tab').click();
    await page.locator('#plasma-tech-level').fill('20');
    await page.locator('#plasma-tech-level').blur();
    await metalMineInput(page).fill('31');
    await metalMineInput(page).blur();
    await expect(page.locator('#pf-overrides')).toHaveText('2');

    await page.locator('#pf-overrides').click();
    const rows = page.locator('#pf-reset-rows tr');
    await expect(rows).toHaveCount(2);
    // The account comes first, named and valued as the page shows them.
    await expect(rows.nth(0)).toContainText('Account');
    await expect(rows.nth(0).locator('td').nth(3)).toHaveText('15');
    await expect(rows.nth(0).locator('td').nth(4)).toHaveText('20');
    await expect(rows.nth(1).locator('td').nth(2)).toHaveText('Metal mine');
    await rows.nth(0).locator('input').uncheck();
    await expect(page.locator('#pf-reset-all')).toHaveJSProperty('indeterminate', true);
    await page.locator('#pf-reset-go').click();

    await expect(page.locator('#pf-reset-modal')).toBeHidden();
    await expect(metalMineInput(page)).toHaveValue('30');
    await expect(page.locator('#plasma-tech-level')).toHaveValue('20');
    await expect(page.locator('#pf-overrides')).toHaveText('1');
});

test('a select from the game is marked, and a radio group as a whole', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await expect(page.locator('#one-pln-race')).toHaveClass(/pf-bound/);
    await expect(page.locator('#class-0').locator('xpath=ancestor::fieldset')).toHaveClass(/pf-bound/);
    // The first radio is not necessarily the chosen one: it carries no mark.
    await expect(page.locator('#class-0')).not.toHaveClass(/pf-bound/);
});

test('the economy speed is the game\'s, and a changed one survives a reload', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ speed: '5' }),
    }));
    await page.goto('/production');
    await importExport(page);
    const speed = page.locator('#universe-speed');
    await expect(speed).toHaveValue('5');
    await expect(speed).toHaveClass(/pf-bound/);
    // Values only the player sets have nothing to differ from: no mark.
    await expect(page.locator('#exchange-rates-m')).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#energy-boost')).not.toHaveClass(/pf-bound/);

    await speed.selectOption('7');
    await expect(speed).toHaveClass(/pf-differs/);
    await page.reload();
    await expect(speed).toHaveValue('7');
    await expect(speed).toHaveClass(/pf-differs/);

    await page.locator('#universe-speed + .pf-reset').click();
    await expect(speed).toHaveValue('5');
    await expect(speed).not.toHaveClass(/pf-differs/);
    await page.reload();
    await expect(speed).toHaveValue('5');
});

test('loading a profile writes no override by itself', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await page.reload();
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    const profile = await activeProfile(page);
    const overrides = [profile.account, ...profile.planets]
        .flatMap((e) => Object.values(e.values))
        .filter((v) => 'override' in v);
    expect(overrides).toHaveLength(0);
});

test('"no profile" shows the calculator\'s own settings, untouched', async ({ page }) => {
    await page.goto('/production');
    await page.locator('#param-researches-tab').click();
    await page.locator('#energy-tech-level').fill('3');
    await page.locator('#energy-tech-level').blur();
    await importExport(page);
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#energy-tech-level')).toHaveValue('3');
    await expect(page.locator('#pf-planet-row')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    const own = await page.evaluate(() => JSON.parse(localStorage.getItem('options_production')).energyTechLevel);
    expect(own).toBe(3);
});

test('another planet is picked in the one-planet tab and remembered', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#max-planet-temp')).toHaveValue('-50');
    await expect(page.locator('#one-pln-race')).toHaveValue('2');
    await expect(page.locator('#storage-met')).toHaveValue('12');
    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Beta [2:150:12]');
});

test('a new empty profile gains a planet only once it is edited', async ({ page }) => {
    await page.goto('/production');
    await chooseAction(page, '__create');
    await page.locator('#pf-props-name').fill('Alt');
    await page.locator('#pf-props-go').click();
    await expect(page.locator('#pf-select option:checked')).toHaveText('Alt');
    expect((await activeProfile(page)).planets).toHaveLength(0);

    await metalMineInput(page).fill('5');
    await metalMineInput(page).blur();
    await expect.poll(async () => (await activeProfile(page)).planets.length).toBe(1);
    // A manual profile has no game layer: no field has a game value to mark.
    await expect(page.locator('.pf-bound')).toHaveCount(0);
});

test('an old production saved set is offered for conversion', async ({ page, context }) => {
    await context.addInitScript(() => {
        if (localStorage.getItem('prod_uni_main')) return;
        const planet = [20, 7, 0];
        for (let j = 1; j < 8; j++) planet.push(j === 1 ? 25 : 0, j === 7 ? 150 : 100, 0);
        planet.push(0, ...new Array(12).fill(0));
        localStorage.setItem('prod_uni_main', JSON.stringify({
            energyTechLevel: 12, plasmaTechLevel: 10, geologist: true, playerClass: 0, rates: [1, 1.5, 3], ratesFmt: 2,
            currPlanetsCount: 1, aPS: [planet], aPNames: ['Homeworld'],
        }));
    });
    await page.goto('/production');
    await expect(page.locator('#pf-migrate-modal')).toBeVisible();
    await expect(page.locator('#pf-migrate-list')).toContainText('main');
    await page.locator('#pf-migrate-go').click();
    await expect(page.locator('#pf-migrate-result')).toBeVisible();
    // Converted: "Not now" has nothing left to postpone, and saving the backup
    // is the last step, so it closes the dialog.
    await expect(page.locator('#pf-migrate-later')).toHaveText('Done');
    const download = page.waitForEvent('download');
    await page.locator('#pf-migrate-backup').click();
    await download;
    await expect(page.locator('#pf-migrate-modal')).toBeHidden();

    await page.locator('#pf-select').selectOption({ label: 'main' });
    await expect(page.locator('#energy-tech-level')).toHaveValue('12');
    await expect(page.locator('#pf-planet option')).toHaveText(['Homeworld']);
    await expect(metalMineInput(page)).toHaveValue('25');
    // The original set is kept, and the offer does not come back on its own.
    expect(await page.evaluate(() => localStorage.getItem('prod_uni_main') !== null)).toBe(true);
    await page.reload();
    await expect(page.locator('#pf-migrate-modal')).toBeHidden();
});

test('the backup file restores the profiles', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ speed: '5' }),
    }));
    await page.goto('/production');
    await importExport(page);
    // A universe setting picked by hand lives beside the profiles, not in them.
    await expect(page.locator('#universe-speed')).toHaveValue('5');
    await page.locator('#universe-speed').selectOption('7');
    const universeKey = await page.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('pfg_universe_')));
    expect(universeKey).toBeTruthy();
    await chooseAction(page, '__manage');
    const download = page.waitForEvent('download');
    await page.locator('#pf-backup-download').click();
    const file = await (await download).path();

    // Delete the profile, then restore it from the file.
    await page.locator('#pf-manage-rows tr').first().locator('button').nth(1).click();
    // The confirm dialog is the one shown modal that is not ours.
    await page.locator('.modal.show:not([id^="pf-"]) .btn-primary').click();
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(0);
    // As on another device: the universe was never seen here.
    await page.evaluate((key) => localStorage.removeItem(key), universeKey);
    await page.locator('#pf-backup-restore').setInputFiles(file);
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(1);
    await expect(page.locator('#pf-manage-rows')).toContainText('Tester');
    const entry = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), universeKey);
    expect(entry.overrides).toEqual({ speed: 7 });
    // The game's values are fetched again, the choice stays on top of them.
    await page.reload();
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('pfg_profiles') || '[]')[0].id);
    await page.locator('#pf-select').selectOption(id);
    await expect(page.locator('#universe-speed')).toHaveValue('7');
    await expect(page.locator('#universe-speed')).toHaveClass(/pf-differs/);
});

test('the delete confirmation is headed in the page language', async ({ page }) => {
    // The queue sets no dialogAttentionLabel of its own, so the heading has to
    // come with the profile dialogs.
    await page.goto('/ru/queue');
    await importExport(page);
    await chooseAction(page, '__manage');
    await page.locator('#pf-manage-rows tr').first().locator('button').nth(1).click();
    const dialog = page.locator('.dyn-dialog.show');
    await expect(dialog.locator('.modal-header')).toHaveText('Внимание');
    await dialog.locator('.btn-secondary').click();
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(1);
});

test('editing a profile returns to the manage dialog', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await chooseAction(page, '__manage');
    const edit = page.locator('#pf-manage-rows tr').first().locator('button').first();

    await edit.click();
    await expect(page.locator('#pf-props-modal')).toBeVisible();
    await page.locator('#pf-props-modal .modal-footer .btn-secondary').click();
    await expect(page.locator('#pf-props-modal')).toBeHidden();
    await expect(page.locator('#pf-manage-modal')).toBeVisible();

    await edit.click();
    await expect(page.locator('#pf-props-go')).toHaveText('Save');
    await page.locator('#pf-props-name').fill('Renamed');
    await page.locator('#pf-props-go').click();
    await expect(page.locator('#pf-manage-modal')).toBeVisible();
    await expect(page.locator('#pf-manage-rows')).toContainText('Renamed');
});

test('each tab keeps its own active profile', async ({ page, context }) => {
    await page.goto('/production');
    await importExport(page);
    const second = await context.newPage();
    await second.goto('/production');
    // A new tab starts on the last choice...
    await expect(second.locator('#energy-tech-level')).toHaveValue('14');
    await second.locator('#pf-select').selectOption('');
    await expect(second.locator('#energy-tech-level')).toHaveValue('0');
    // ...and its own choice does not switch the first tab.
    await page.reload();
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
});

// ---------------------------------------------------------------------------
// Flight
// ---------------------------------------------------------------------------

async function openFlightParams(page) {
    const section = page.locator('#accordion-prm');
    if (!(await section.evaluate((el) => el.classList.contains('show')))) {
        await page.locator('[data-bs-target="#accordion-prm"]').click();
    }
    await expect(page.locator('#cmb-drive')).toBeVisible();
}

test('flight takes the account from the profile and locks its universe', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    await openFlightParams(page);

    await expect(page.locator('#cmb-drive')).toHaveValue('16');
    await expect(page.locator('#imp-drive')).toHaveValue('12');
    await expect(page.locator('#hyp-drive')).toHaveValue('9');
    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#class-0')).toBeChecked();
    await expect(page.locator('#trader-bonus')).toBeChecked();
    await expect(page.locator('#lf-rocktal-collector-enh')).toHaveValue('2.15');
    await expect(page.locator('[class~="202-speed"]')).toHaveValue('0.45');
    await expect(page.locator('[class~="202-cargo"]')).toHaveValue('1.23');
    await expect(page.locator('#cmb-drive')).toHaveClass(/pf-bound/);

    const profile = await activeProfile(page);
    await expect(page.locator('#country')).toHaveValue(profile.universe.country);
    await expect(page.locator('#country')).toBeDisabled();
    await expect(page.locator('#universe')).toBeDisabled();
    await expect(page.locator('#reset')).toBeHidden();

    // Three planets and the moon, after the dash; the departure moves to the first planet.
    await expect(page.locator('#pf-departure option')).toHaveCount(5);
    await expect(page.locator('#pf-departure')).toHaveValue(profile.planets[0].id);
    await expect(page.locator('#departure-g')).toHaveValue('2');
    await expect(page.locator('#departure-s')).toHaveValue('148');
    await expect(page.locator('#departure-p')).toHaveValue('8');
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a flight edit becomes an override that can be restored', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    await openFlightParams(page);

    await page.locator('#cmb-drive').fill('17');
    await page.locator('#cmb-drive').blur();
    await expect(page.locator('#cmb-drive')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.account.values['research.115']).toEqual({ game: 16, override: 17 });

    await page.locator('#cmb-drive + .pf-reset').click();
    await expect(page.locator('#cmb-drive')).toHaveValue('16');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    profile = await activeProfile(page);
    expect(profile.account.values['research.115']).toEqual({ game: 16 });
});

test('flight copies a moon\'s coordinates and its fleet', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    await openFlightParams(page);
    const profile = await activeProfile(page);

    await page.locator('#pf-departure').selectOption(profile.moons[0].id);
    await expect(page.locator('#departure-s')).toHaveValue('148');
    // The ships section is the accordion's other half: opening it closes the parameters.
    await page.locator('[data-bs-target="#accordion-ships"]').click();
    await expect(page.locator('#pf-take-fleet')).toBeVisible();
    await page.locator('#pf-take-fleet').click();
    await expect(page.locator('#small-cargo')).toHaveValue('1000');
    await expect(page.locator('#large-cargo')).toHaveValue('2000');
    await expect(page.locator('#recycler')).toHaveValue('150');
    await expect(page.locator('#pathfinder')).toHaveValue('3');
    // Ship counts are the flight's own: nothing went into the profile.
    await expect(page.locator('#pf-overrides')).toBeHidden();

    // A departure typed by hand that matches no body clears the select.
    await openFlightParams(page);
    await page.locator('#departure-p').fill('9');
    await page.locator('#departure-p').blur();
    await expect(page.locator('#pf-departure')).toHaveValue('');
    await expect(page.locator('#pf-take-fleet')).toBeDisabled();
});

test('"no profile" gives flight its own account values and universe back', async ({ page }) => {
    await page.goto('/flight');
    await openFlightParams(page);
    await page.locator('#cmb-drive').fill('5');
    await page.locator('#cmb-drive').blur();

    await importExport(page);
    await expect(page.locator('#cmb-drive')).toHaveValue('16');
    // The flight's own settings keep the value from before the profile.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_flight') || '{}'));
    expect(stored.driveLevels[0]).toBe(5);

    await page.reload();
    await openFlightParams(page);
    await expect(page.locator('#cmb-drive')).toHaveValue('16');

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#cmb-drive')).toHaveValue('5');
    await expect(page.locator('#cmb-drive')).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#country')).toBeEnabled();
    await expect(page.locator('#pf-departure')).toBeHidden();
    await expect(page.locator('#reset')).toBeVisible();
});

// A spy report describes the spied player, so with a profile active the import
// asks where it goes instead of writing that player into the profile.
const SR_FIXTURE = readFileSync(join(__dirname, '../fixtures/sr_fs003df9447df01744296d867509e0ae7e60.json'), 'utf8');

/** Answer the report service with the fixture and start an import. */
async function startReportImport(page) {
    await page.route(/\/ajax\.php\?.*service=ogameAPI/, (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: SR_FIXTURE,
    }));
    await openFlightParams(page);
    await page.locator('#api-code').fill('fs003df9447df01744296d867509e0ae7e60');
    await page.locator('#api-get').click();
    await expect(page.locator('#flight-sr-profile-modal')).toBeVisible();
}

test('a spy report can go to "no profile", leaving the profile alone', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    const before = await activeProfile(page);
    await startReportImport(page);
    await expect(page.locator('#flight-sr-profile-name')).toHaveValue('coshoni');

    await page.locator('#flight-sr-profile-go').click();
    await expect(page.locator('#flight-sr-profile-modal')).toBeHidden();
    await expect(page.locator('#pf-select')).toHaveValue('');
    await expect(page.locator('#cmb-drive')).toHaveValue('22');
    await expect(page.locator('#country')).toBeEnabled();
    const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem('pfg_profile_' + id) || 'null'), before.id);
    expect(stored.account).toEqual(before.account);
});

test('a spy report can go to a new profile of its own', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    const before = await activeProfile(page);
    await startReportImport(page);

    await page.locator('#flight-sr-profile-name').fill('');
    await page.locator('#flight-sr-profile-go').click();
    await expect(page.locator('#flight-sr-profile-error')).toBeVisible();
    await page.locator('#flight-sr-profile-name').fill('Pirate');
    await expect(page.locator('#flight-sr-profile-new')).toBeChecked();
    await page.locator('#flight-sr-profile-go').click();
    await expect(page.locator('#flight-sr-profile-modal')).toBeHidden();

    await expect(page.locator('#cmb-drive')).toHaveValue('22');
    await expect(page.locator('#trader-bonus')).toBeChecked();
    const created = await activeProfile(page);
    expect(created.id).not.toBe(before.id);
    expect(created.label).toBe('Pirate');
    expect(created.universe).toEqual({ country: 'en', number: 1 });
    expect(created.planets.map((p) => [p.name, p.coords])).toEqual([['swimbo', { galaxy: 4, system: 123, position: 7 }]]);
    expect(created.account.values['research.115']).toEqual({ override: 22 });
    await expect(page.locator('#pf-departure')).toHaveValue(created.planets[0].id);
    // The profile that was active keeps its own account.
    const old = await page.evaluate((id) => JSON.parse(localStorage.getItem('pfg_profile_' + id) || 'null'), before.id);
    expect(old.account).toEqual(before.account);
});

test('cancelling the spy report choice imports nothing', async ({ page }) => {
    await page.goto('/flight');
    await importExport(page);
    const before = await activeProfile(page);
    await startReportImport(page);

    await page.locator('#flight-sr-profile-modal .btn-secondary').click();
    await expect(page.locator('#flight-sr-profile-modal')).toBeHidden();
    await expect(page.locator('#pf-select')).toHaveValue(before.id);
    await expect(page.locator('#cmb-drive')).toHaveValue('16');
    await expect(page.locator('#departure-g')).toHaveValue('2');
});

// The queue: the account fields, and per tab one planet or moon of the profile
// whose building levels are the start levels.

test('the queue takes the account, a planet and its moon from the profile', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);

    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    await expect(page.locator('#player-class-0')).toBeChecked();
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');
    await expect(page.locator('#lc-capacity-increase')).toHaveValue('2.5');
    await expect(page.locator('#hyper-tech-level')).toHaveClass(/pf-bound/);
    await expect(page.locator('#player-class-0').locator('xpath=ancestor::fieldset')).toHaveClass(/pf-bound/);

    await expect(page.locator('#pf-body-2 option')).toHaveCount(3);
    await expect(page.locator('#pf-body-2 option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#startlvl-2-1')).toHaveValue('30');
    await expect(page.locator('#startlvl-2-33')).toHaveValue('5');
    await expect(page.locator('#total-fields-2')).toHaveValue('246');
    await expect(page.locator('#total-fields-2')).toHaveClass(/pf-bound/);
    // The start levels are filled in, not bound.
    await expect(page.locator('#startlvl-2-1')).not.toHaveClass(/pf-bound/);

    await page.locator('#tabtag-3').click();
    await expect(page.locator('#pf-body-3 option')).toHaveCount(1);
    await expect(page.locator('#startlvl-3-41')).toHaveValue('7');
    await expect(page.locator('#startlvl-3-14')).toHaveValue('8');
    await expect(page.locator('#total-fields-3')).toHaveValue('24');

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a queue start level is not written back to the profile', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);

    await page.locator('#startlvl-2-1').fill('31');
    await page.locator('#startlvl-2-1').blur();
    await expect(page.locator('#startlvl-2-1')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#startlvl-2-1 + .pf-reset')).toHaveCount(0);
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30 });

    // The fields stay bound.
    await page.locator('#total-fields-2').fill('250');
    await page.locator('#total-fields-2').blur();
    await expect(page.locator('#total-fields-2')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');

    // A reload fills the start levels in from the planet again.
    await page.reload();
    await expect(page.locator('#startlvl-2-1')).toHaveValue('30');
});

test('another planet is picked in the queue and remembered, the queue kept', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);
    await page.locator('#build-2-1').click();
    await expect(page.locator('#table-dst-2 tr')).toHaveCount(4);

    await page.locator('#pf-body-2').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#total-fields-2')).toHaveValue('270');
    await expect(page.locator('#startlvl-2-33')).toHaveValue('0');
    // The queue is the calculator's: it now starts from Beta's levels.
    await expect(page.locator('#table-dst-2 tr')).toHaveCount(4);
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.reload();
    await expect(page.locator('#pf-body-2 option:checked')).toHaveText('Beta [2:150:12]');
    await expect(page.locator('#total-fields-2')).toHaveValue('270');
});

test('"no profile" gives the queue its own values back', async ({ page }) => {
    await page.goto('/queue');
    await page.locator('#hyper-tech-level').fill('3');
    await page.locator('#hyper-tech-level').blur();
    await page.locator('#total-fields-2').fill('200');
    await page.locator('#total-fields-2').blur();
    await page.locator('#startlvl-2-1').fill('4');
    await page.locator('#startlvl-2-1').blur();

    await importExport(page);
    await expect(page.locator('#startlvl-2-1')).toHaveValue('30');
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_queue') || '{}'));
    expect(stored.hyperTechLevel).toBe(3);
    expect(stored.totFldPln).toBe(200);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#hyper-tech-level')).toHaveValue('3');
    await expect(page.locator('#total-fields-2')).toHaveValue('200');
    await expect(page.locator('#startlvl-2-1')).toHaveValue('4');
    await expect(page.locator('#pf-body-box-2')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

// The cost calculator: the account, the research bonuses table, one planet and
// one moon of the profile, and the profile's universe in the picker.

/** Answer the universe settings request, so the picker's fetch is predictable. */
async function mockServerData(page) {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ speed: '4', researchDurationDivisor: '2' }),
    }));
}

test('costs takes the account, a planet and its moon from the profile', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#robot-factory-level')).toHaveValue('10');
    await expect(page.locator('#nanite-factory-level')).toHaveValue('6');
    await expect(page.locator('#shipyard-level')).toHaveValue('12');
    await expect(page.locator('#research-lab-level')).toHaveValue('12');
    await expect(page.locator('#robot-factory-level-moon')).toHaveValue('8');
    await expect(page.locator('#robot-factory-level')).toHaveClass(/pf-bound/);

    await page.locator('#param-researches-tab').click();
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    await page.locator('#param-common-tab').click();
    await expect(page.locator('#class-0')).toBeChecked();
    await expect(page.locator('#is-trader')).toBeChecked();
    const profile = await activeProfile(page);
    await expect(page.locator('#country')).toHaveValue(profile.universe.country);
    await expect(page.locator('#country')).toBeDisabled();
    await expect(page.locator('#universe-speed')).toHaveValue('4');
    await expect(page.locator('#research-speed')).toHaveValue('8');
    await page.locator('#param-lifeforms-tab').click();
    await expect(page.locator('#lf-collector-class-bonus')).toHaveValue('2.15');
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');

    // The research bonuses table is the account's too.
    const plasma = page.locator('#lf-research-bonuses-tbody tr[data-tech-id="122"]');
    await expect(plasma.locator('.lf-research-cost-input')).toHaveValue('0.4635');
    await expect(plasma.locator('.lf-research-time-input')).toHaveValue('1.2361');

    await page.locator('#param-common-tab').click();
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a costs edit becomes an override of the planet or the moon', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    await page.locator('#robot-factory-level').fill('11');
    await page.locator('#robot-factory-level').blur();
    await page.locator('#robot-factory-level-moon').fill('9');
    await page.locator('#robot-factory-level-moon').blur();
    await expect(page.locator('#robot-factory-level')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('2');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['building.14']).toEqual({ game: 10, override: 11 });
    expect(profile.moons[0].values['building.14']).toEqual({ game: 8, override: 9 });

    await page.locator('#robot-factory-level + .pf-reset').click();
    await expect(page.locator('#robot-factory-level')).toHaveValue('10');
    await expect(page.locator('#robot-factory-level-moon')).toHaveValue('9');
    profile = await activeProfile(page);
    expect(profile.planets[0].values['building.14']).toEqual({ game: 10 });
});

test('another planet is picked in costs and remembered', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#nanite-factory-level')).toHaveValue('5');
    await expect(page.locator('#shipyard-level')).toHaveValue('10');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Beta [2:150:12]');
    await expect(page.locator('#nanite-factory-level')).toHaveValue('5');
});

test('"no profile" gives costs its own values and table back', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await page.locator('#nanite-factory-level').fill('2');
    await page.locator('#nanite-factory-level').blur();
    await page.locator('#param-researches-tab').click();
    await page.locator('#ion-tech-level').fill('3');
    await page.locator('#ion-tech-level').blur();

    await importExport(page);
    await expect(page.locator('#nanite-factory-level')).toHaveValue('6');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('costs_calculator_state') || '{}'));
    expect(stored.naniteFactoryLevel).toBe(2);
    expect(stored.ionTechLevel).toBe(3);
    expect(await page.evaluate(() => localStorage.getItem('costs_lf_research_table'))).toBeNull();

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#nanite-factory-level')).toHaveValue('2');
    await expect(page.locator('#ion-tech-level')).toHaveValue('3');
    await expect(page.locator('#lf-research-bonuses-tbody tr[data-tech-id="122"] .lf-research-cost-input')).toHaveValue('0');
    await expect(page.locator('#country')).toBeEnabled();
    await expect(page.locator('#pf-bodies-row')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

/** Edit the stored active profile, then reload so the page reads it. */
async function editProfile(page, edit) {
    await page.evaluate((body) => {
        const id = JSON.parse(sessionStorage.getItem('pfg_active_profile'));
        const profile = JSON.parse(localStorage.getItem('pfg_profile_' + id));
        new Function('profile', body)(profile);
        localStorage.setItem('pfg_profile_' + id, JSON.stringify(profile));
    }, edit);
    await page.reload();
}

test('the research network dialog lists the profile\'s planets and their labs', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    const rows = page.locator('#lab-levels-table tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#planetsSpin')).toHaveValue('3');
    await expect(page.locator('#planetsSpin-up')).toBeDisabled();
    await expect(rows.nth(0).locator('td').first()).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#lablevel_1')).toHaveValue('12');
    await expect(page.locator('#lablevel_2')).toHaveValue('10');
    await expect(page.locator('#lablevel_3')).toHaveValue('0');
    await expect(page.locator('#lablevel_1')).toHaveClass(/pf-bound/);
    // The start is the best lab, whatever planet the Buildings tab shows.
    await expect(page.locator('#labchoice_1')).toBeChecked();
    await expect(page.locator('#labchoice_3')).toBeDisabled();
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#labchoice_1')).toBeChecked();
    // The account has not researched the network: it starts switched off.
    await expect(page.locator('#use-irn')).not.toBeChecked();

    // "No profile" brings the calculator's own table back.
    await page.locator('#pf-select').selectOption('');
    await expect(rows).toHaveCount(8);
    await expect(rows.nth(0).locator('td').first()).not.toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#planetsSpin-up')).toBeEnabled();
});

test('the default start is the best lab, the oldest planet on a tie', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);
    await editProfile(page, "profile.planets[1].values['building.31'] = { game: 14 };");
    await expect(page.locator('#labchoice_2')).toBeChecked();
    await editProfile(page, "profile.planets[1].values['building.31'] = { game: 12 }; profile.planets[0].gameId = 900005;");
    await expect(page.locator('#labchoice_2')).toBeChecked();
    // A researched network switches itself on.
    await editProfile(page, "profile.account.values['research.123'] = { game: 2 };");
    await expect(page.locator('#use-irn')).toBeChecked();
    await expect(page.locator('#irn-result')).toHaveText('24');
});

test('labs edited in the research network dialog go to their planets', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    await page.locator('#use-irn').check();
    await page.locator('#open-llc-dialog').click();
    await page.locator('#lablevel_1').fill('13');
    await page.locator('#lablevel_1').press('Enter');
    await page.locator('#lablevel_2').fill('11');
    await page.locator('#lablevel_2').press('Enter');
    await page.locator('#labchoice_2').click();
    await page.locator('#irn-done-btn').click();
    await expect(page.locator('#irn-calc')).toBeHidden();

    // Done applies on hidden.bs.modal, after the backdrop fades - later than
    // the dialog itself hides - so wait for its effect on the page first.
    // Alpha is the planet shown: its lab field follows the dialog.
    await expect(page.locator('#research-lab-level')).toHaveValue('13');
    await expect(page.locator('#use-irn')).toBeChecked();
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['building.31']).toEqual({ game: 12, override: 13 });
    expect(profile.planets[1].values['building.31']).toEqual({ game: 10, override: 11 });

    // The start and the switch are remembered for the profile.
    await page.reload();
    await expect(page.locator('#labchoice_2')).toBeChecked();
    await expect(page.locator('#use-irn')).toBeChecked();

    // And the other way: the lab field shows in the dialog.
    await page.locator('#research-lab-level').fill('15');
    await page.locator('#research-lab-level').blur();
    await expect(page.locator('#lablevel_1')).toHaveValue('15');
    profile = await activeProfile(page);
    expect(profile.planets[0].values['building.31']).toEqual({ game: 12, override: 15 });
});

test('cancelling the research network dialog writes nothing', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);
    await page.locator('#use-irn').check();
    await page.locator('#open-llc-dialog').click();
    await page.locator('#lablevel_2').fill('11');
    await page.locator('#lablevel_2').press('Enter');
    await page.locator('#labchoice_2').click();
    await page.locator('#irn-calc .btn-secondary').click();
    await expect(page.locator('#irn-calc')).toBeHidden();
    await expect(page.locator('#lablevel_2')).toHaveValue('10');
    await expect(page.locator('#lab-levels-table tbody tr').nth(1).locator('td').first()).toHaveText('Beta [2:150:12]');
    const profile = await activeProfile(page);
    expect(profile.planets[1].values['building.31']).toEqual({ game: 10 });
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('the Mineral Research Centre follows the planet picked in costs', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);
    // The fixture has no Rock'tal planet: give Beta a Mineral Research Centre.
    await page.evaluate(() => {
        const id = JSON.parse(sessionStorage.getItem('pfg_active_profile'));
        const profile = JSON.parse(localStorage.getItem('pfg_profile_' + id));
        profile.planets[1].values['lf.building.12111'] = { game: 5 };
        localStorage.setItem('pfg_profile_' + id, JSON.stringify(profile));
    });
    await page.reload();
    await expect(page.locator('#mineral-res-cntr-lvl')).toHaveValue('0');

    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#mineral-res-cntr-lvl')).toHaveValue('5');
    await expect(page.locator('#mineral-res-cntr-lvl')).toHaveClass(/pf-bound/);
    await page.locator('#pf-planet').selectOption({ label: 'Alpha [2:148:8]' });
    await expect(page.locator('#mineral-res-cntr-lvl')).toHaveValue('0');
});

/**
 * The level inputs of a build table's row: [from, to] on a multi-level table.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} table
 * @param {number} techId The row's hidden id.
 */
async function rowLevels(page, table, techId) {
    return page.evaluate(([t, id]) => {
        const row = Array.from(document.querySelectorAll('#' + t + ' tr')).find((r) => r.cells[0]?.textContent?.trim() === String(id));
        return row ? Array.from(row.querySelectorAll('input')).slice(0, 2).map((i) => i.value) : [];
    }, [table, techId]);
}

test('costs fills in the known levels as the start levels, unbound', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    // A "to" below the known level is raised to it, so the row stays idle.
    expect(await rowLevels(page, 'table-1-2', 1)).toEqual(['30', '30']);
    expect(await rowLevels(page, 'table-1-3', 10014)).toEqual(['8', '8']);
    expect(await rowLevels(page, 'table-1-4', 113)).toEqual(['14', '14']);

    await page.locator('#tabtag-1').click();
    const metalFrom = page.locator('#table-1-2 tr').nth(1).locator('input').first();
    await metalFrom.fill('20');
    await metalFrom.blur();
    await expect(metalFrom).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30 });

    // The range tab starts from the level of the technology picked there.
    await page.locator('#tabtag-2').click();
    await expect(page.locator('#tab2-from-level')).toHaveValue('30');
    await expect(page.locator('#tab2-to-level')).toHaveValue('31');
    await page.locator('#tech-types-select').selectOption('113');
    await expect(page.locator('#tab2-from-level')).toHaveValue('14');
    await expect(page.locator('#tab2-to-level')).toHaveValue('31');
    // The moon's robotics factory, not the planet's.
    await page.locator('#tech-types-select').selectOption({ index: await page.evaluate(() => {
        const select = /** @type {HTMLSelectElement} */ (document.getElementById('tech-types-select'));
        return Array.from(select.options).findIndex((o) => o.value === '14' && o.parentElement === select.querySelectorAll('optgroup')[1]);
    }) });
    await expect(page.locator('#tab2-from-level')).toHaveValue('8');

    // Another planet brings its own levels.
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    expect(await rowLevels(page, 'table-1-2', 1)).toEqual(['28', '30']);
});

// The LF costs: the account fields, and one planet of the profile whose
// factories, life form and life-form buildings feed the calculation.

test('LF costs take the account and a planet from the profile', async ({ page }) => {
    await page.goto('/lfcosts');
    await importExport(page);

    await page.locator('#param-researches-tab').click();
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    await expect(page.locator('#hyper-tech-level')).toHaveClass(/pf-bound/);
    await page.locator('#param-common-tab').click();
    await expect(page.locator('#class-0')).toBeChecked();
    await expect(page.locator('#class-0').locator('xpath=ancestor::fieldset')).toHaveClass(/pf-bound/);

    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await page.locator('#param-buildings-tab').click();
    await expect(page.locator('#robot-factory-level')).toHaveValue('10');
    await expect(page.locator('#nanite-factory-level')).toHaveValue('6');
    await page.locator('#param-lifeforms-tab').click();
    await expect(page.locator('#race-selector')).toHaveValue('1');
    await expect(page.locator('#research-centre-level')).toHaveValue('10');
    await expect(page.locator('#research-centre-level')).toBeVisible();
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');
    // The global life-form research reductions: the game's entry 11201.
    await expect(page.locator('#research-time-reduction')).toHaveValue('0.3091');
    await expect(page.locator('#research-cost-reduction')).toHaveValue('0');
    await expect(page.locator('#research-time-reduction').locator('xpath=ancestor::div[contains(@class,"input-group")]')).toHaveClass(/pf-bound/);

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('another planet brings its life form and buildings, and is remembered', async ({ page }) => {
    await page.goto('/lfcosts');
    await importExport(page);

    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#race-selector')).toHaveValue('2');
    await expect(page.locator('#megalith-level')).toHaveValue('3');
    await expect(page.locator('#megalith-level')).toBeVisible();
    await expect(page.locator('#mrc-level')).toHaveValue('2');
    await expect(page.locator('#rune-tech-level')).toHaveValue('7');
    await expect(page.locator('#research-centre-level')).toBeHidden();
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Beta [2:150:12]');
    await expect(page.locator('#megalith-level')).toHaveValue('3');
});

test('an LF building level becomes an override of the planet', async ({ page }) => {
    await page.goto('/lfcosts');
    await importExport(page);

    await page.locator('#research-centre-level').fill('12');
    await page.locator('#research-centre-level').blur();
    await expect(page.locator('#research-centre-level')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['lf.building.11103']).toEqual({ game: 10, override: 12 });

    await page.locator('#research-centre-level + .pf-reset').click();
    await expect(page.locator('#research-centre-level')).toHaveValue('10');
    profile = await activeProfile(page);
    expect(profile.planets[0].values['lf.building.11103']).toEqual({ game: 10 });
});

test('"no profile" gives the LF costs their own values back', async ({ page }) => {
    await page.goto('/lfcosts');
    await page.locator('#param-researches-tab').click();
    await page.locator('#hyper-tech-level').fill('3');
    await page.locator('#hyper-tech-level').blur();
    await page.locator('#param-buildings-tab').click();
    await page.locator('#robot-factory-level').fill('4');
    await page.locator('#robot-factory-level').blur();

    await importExport(page);
    await expect(page.locator('#robot-factory-level')).toHaveValue('10');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_lfcosts') || '{}'));
    expect(stored.hyperTechLevel).toBe(3);
    expect(stored.robotFactoryLevel).toBe(4);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#robot-factory-level')).toHaveValue('4');
    await page.locator('#param-researches-tab').click();
    await expect(page.locator('#hyper-tech-level')).toHaveValue('3');
    await expect(page.locator('#pf-planet-box')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

test('graviton takes the account and a planet from the profile', async ({ page }) => {
    await page.goto('/graviton');
    await importExport(page);

    // Commander and geologist only: no engineer, so no officers' energy bonus.
    await expect(page.locator('#commander')).toBeChecked();
    await expect(page.locator('#geologist')).toBeChecked();
    await expect(page.locator('#engineer')).not.toBeChecked();
    await expect(page.locator('#engineer')).toHaveClass(/pf-bound/);
    await expect(page.locator('#player-class-1')).toBeChecked();
    await expect(page.locator('#player-class-1').locator('xpath=ancestor::fieldset')).toHaveClass(/pf-bound/);
    await expect(page.locator('#trader-bonus')).toBeChecked();
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    await expect(page.locator('#total-lf-energy-bonus')).toHaveValue('0.5');
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');

    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#shipyard-level')).toHaveValue('12');
    await expect(page.locator('#nanites-factory-level')).toHaveValue('6');
    await expect(page.locator('#max-planet-temp')).toHaveValue('41');
    await expect(page.locator('#solar-plant-level')).toHaveValue('25');
    await expect(page.locator('#fusion-plant-level')).toHaveValue('12');
    await expect(page.locator('#solar-satellites-count')).toHaveValue('250');
    await expect(page.locator('#solar-satellites-count')).toHaveClass(/pf-bound/);
    // Percentages are the player's alone: bound, but never marked.
    await expect(page.locator('#solar-plant-percent')).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#disr-chamber-level')).toHaveValue('0');

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('another planet in graviton brings its plants and Disruption Chamber, and is remembered', async ({ page }) => {
    await page.goto('/graviton');
    await importExport(page);

    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#max-planet-temp')).toHaveValue('-50');
    await expect(page.locator('#solar-satellites-count')).toHaveValue('300');
    await expect(page.locator('#disr-chamber-level')).toHaveValue('4');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Beta [2:150:12]');
    await expect(page.locator('#disr-chamber-level')).toHaveValue('4');
});

test('graviton edits become overrides of the account and the planet', async ({ page }) => {
    await page.goto('/graviton');
    await importExport(page);

    await page.locator('#solar-satellites-count').fill('400');
    await page.locator('#solar-satellites-count').blur();
    await page.locator('#engineer').check();
    await expect(page.locator('#solar-satellites-count')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('2');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['ship.212']).toEqual({ game: 250, override: 400 });
    expect(profile.account.values['officer.engineer']).toEqual({ game: false, override: true });

    await page.locator('#solar-satellites-count + .pf-reset').click();
    await expect(page.locator('#solar-satellites-count')).toHaveValue('250');
    profile = await activeProfile(page);
    expect(profile.planets[0].values['ship.212']).toEqual({ game: 250 });
});

test('"no profile" gives graviton its own values back', async ({ page }) => {
    await page.goto('/graviton');
    await page.locator('#solar-plant-level').fill('7');
    await page.locator('#solar-plant-level').blur();
    await page.locator('#engineer').check();

    await importExport(page);
    await expect(page.locator('#solar-plant-level')).toHaveValue('25');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_graviton') || '{}'));
    expect(stored.solarPlantLevel).toBe(7);
    expect(stored.engineer).toBe(true);
    expect(stored.energyBonus).toBe(1);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#solar-plant-level')).toHaveValue('7');
    await expect(page.locator('#engineer')).toBeChecked();
    await expect(page.locator('#commander')).not.toBeChecked();
    await expect(page.locator('#pf-planet-box')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

test('graviton takes the debris settings from the universe, and keeps a changed one', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ speed: '5', debrisFactor: '0.75', deuteriumInDebris: '1' }),
    }));
    await page.goto('/graviton');
    await importExport(page);

    const debris = page.locator('#debris-percent');
    const deut = page.locator('#deut-in-debris');
    await expect(page.locator('#universe-speed')).toHaveValue('5');
    // A share no preset offers is added to the select.
    await expect(debris).toHaveValue('75');
    await expect(debris.locator('option:checked')).toHaveText('75%');
    await expect(debris).toHaveClass(/pf-bound/);
    await expect(deut).toBeChecked();
    await expect(deut).toHaveClass(/pf-bound/);
    await expect(page.locator('#deuterium-recyclable')).not.toHaveText('0');

    await debris.selectOption('30');
    await expect(debris).toHaveClass(/pf-differs/);
    await page.reload();
    await expect(debris).toHaveValue('30');
    await expect(debris).toHaveClass(/pf-differs/);
    // A universe setting is not in the profile.
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.locator('#debris-percent + .pf-reset').click();
    await expect(debris).toHaveValue('75');
    await expect(debris).not.toHaveClass(/pf-differs/);
});

test('"no profile" gives graviton its own debris settings back', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ speed: '5', debrisFactor: '0.5', deuteriumInDebris: '1' }),
    }));
    await page.goto('/graviton');
    await page.locator('#debris-percent').selectOption('40');

    await importExport(page);
    await expect(page.locator('#debris-percent')).toHaveValue('50');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_graviton') || '{}'));
    expect(stored.debrisPercent).toBe(40);
    expect(stored.deutInDebris).toBe(false);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#debris-percent')).toHaveValue('40');
    await expect(page.locator('#deut-in-debris')).not.toBeChecked();
    await expect(page.locator('#universe-speed')).toHaveValue('1');
});

test('terraformer takes the account and a planet from the profile', async ({ page }) => {
    await page.goto('/terraformer');
    await importExport(page);

    // Commander and geologist only: no engineer, so no officers' energy bonus.
    await expect(page.locator('#commander')).toBeChecked();
    await expect(page.locator('#geologist')).toBeChecked();
    await expect(page.locator('#engineer')).not.toBeChecked();
    await expect(page.locator('#engineer')).toHaveClass(/pf-bound/);
    await expect(page.locator('#player-class-1')).toBeChecked();
    await expect(page.locator('#player-class-1').locator('xpath=ancestor::fieldset')).toHaveClass(/pf-bound/);
    await expect(page.locator('#trader-bonus')).toBeChecked();
    await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    await expect(page.locator('#total-lf-energy-bonus')).toHaveValue('0.5');
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');
    await expect(page.locator('#lc-capacity-increase')).toHaveValue('2.5');
    await expect(page.locator('#lf-terraformer-rdc')).toHaveValue('4');
    await expect(page.locator('#lf-terraformer-rdc')).toHaveClass(/pf-bound/);

    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#robots-factory-level')).toHaveValue('10');
    await expect(page.locator('#shipyard-level')).toHaveValue('12');
    await expect(page.locator('#nanites-factory-level')).toHaveValue('6');
    await expect(page.locator('#max-planet-temp')).toHaveValue('41');
    await expect(page.locator('#solar-plant-level')).toHaveValue('25');
    await expect(page.locator('#fusion-plant-level')).toHaveValue('12');
    await expect(page.locator('#solar-satellites-count')).toHaveValue('250');
    await expect(page.locator('#solar-satellites-count')).toHaveClass(/pf-bound/);
    // The terraformer's current level is filled in where the range starts,
    // not bound, and the range ends at least one level above it.
    await expect(page.locator('#tf-level-from')).toHaveValue('5');
    await expect(page.locator('#tf-level-from')).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#tf-level-to')).toHaveValue('6');
    await expect(page.locator('#added-fields')).toHaveText('5');
    await expect(page.locator('#disr-chamber-level')).toHaveValue('0');
    // Percentages are the player's alone: bound, but never marked.
    await expect(page.locator('#solar-plant-percent')).not.toHaveClass(/pf-bound/);

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('another planet in terraformer brings its levels and Disruption Chamber, and is remembered', async ({ page }) => {
    await page.goto('/terraformer');
    await importExport(page);

    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#max-planet-temp')).toHaveValue('-50');
    await expect(page.locator('#solar-satellites-count')).toHaveValue('300');
    await expect(page.locator('#disr-chamber-level')).toHaveValue('4');
    await expect(page.locator('#tf-level-from')).toHaveValue('0');
    // "To" was already above Beta's level, so it is kept.
    await expect(page.locator('#tf-level-to')).toHaveValue('6');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Beta [2:150:12]');
    await expect(page.locator('#disr-chamber-level')).toHaveValue('4');
});

test('a planet with no shipyard shows level 1 in terraformer without an override', async ({ page }) => {
    await page.goto('/terraformer');
    await importExport(page);

    await page.locator('#pf-planet').selectOption({ label: 'Colony [3:20:4]' });
    await expect(page.locator('#shipyard-level')).toHaveValue('1');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    // Leaving the field must not turn the clamped 1 into an edit of the game's 0.
    await page.locator('#shipyard-level').focus();
    await page.locator('#shipyard-level').blur();
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.planets[2].values['building.21']).toEqual({ game: 0 });
});

test('terraformer edits become overrides of the account and the planet', async ({ page }) => {
    await page.goto('/terraformer');
    await importExport(page);

    await page.locator('#solar-satellites-count').fill('400');
    await page.locator('#solar-satellites-count').blur();
    await page.locator('#engineer').check();
    await page.locator('#param-lifeforms-tab').click();
    await page.locator('#lf-terraformer-rdc').fill('10');
    await page.locator('#lf-terraformer-rdc').blur();
    await expect(page.locator('#solar-satellites-count')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('3');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['ship.212']).toEqual({ game: 250, override: 400 });
    expect(profile.account.values['officer.engineer']).toEqual({ game: false, override: true });
    expect(profile.account.values['lf.cost.33.cost']).toEqual({ game: 4, override: 10 });

    // The "from" level is filled in, not bound: an edit stays the calculator's.
    await page.locator('#tf-level-from').fill('7');
    await page.locator('#tf-level-from').blur();
    await expect(page.locator('#tf-level-from')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('3');

    // In an input group the restore button follows the group.
    await page.locator('.input-group:has(#lf-terraformer-rdc) + .pf-reset').click();
    await expect(page.locator('#lf-terraformer-rdc')).toHaveValue('4');
    profile = await activeProfile(page);
    expect(profile.account.values['lf.cost.33.cost']).toEqual({ game: 4 });
    expect(profile.planets[0].values['building.33']).toEqual({ game: 5 });
});

test('"no profile" gives terraformer its own values back', async ({ page }) => {
    await page.goto('/terraformer');
    await page.locator('#solar-plant-level').fill('7');
    await page.locator('#solar-plant-level').blur();
    await page.locator('#tf-level-from').fill('3');
    await page.locator('#tf-level-from').blur();
    await page.locator('#engineer').check();

    await importExport(page);
    await expect(page.locator('#solar-plant-level')).toHaveValue('25');
    await expect(page.locator('#tf-level-from')).toHaveValue('5');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_terraformer') || '{}'));
    expect(stored.solarPlantLevel).toBe(7);
    expect(stored.tfLevelFrom).toBe(3);
    expect(stored.engineer).toBe(true);
    expect(stored.energyBonus).toBe(1);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#solar-plant-level')).toHaveValue('7');
    await expect(page.locator('#tf-level-from')).toHaveValue('3');
    await expect(page.locator('#engineer')).toBeChecked();
    await expect(page.locator('#commander')).not.toBeChecked();
    await expect(page.locator('#pf-planet-box')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

test('terraformer takes the economy speed from the universe, and keeps a changed one', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ speed: '5', debrisFactor: '0.5', deuteriumInDebris: '0' }),
    }));
    await page.goto('/terraformer');
    await importExport(page);

    const speed = page.locator('#universe-speed');
    await expect(speed).toHaveValue('5');
    await expect(speed).toHaveClass(/pf-bound/);

    await speed.selectOption('2');
    await expect(speed).toHaveClass(/pf-differs/);
    await page.reload();
    await expect(speed).toHaveValue('2');
    await expect(speed).toHaveClass(/pf-differs/);
    // A universe setting is not in the profile.
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.locator('#universe-speed + .pf-reset').click();
    await expect(speed).toHaveValue('5');
    await expect(speed).not.toHaveClass(/pf-differs/);
});
