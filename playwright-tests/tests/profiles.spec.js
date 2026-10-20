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
async function importExport(page, text = EXPORT) {
    await chooseAction(page, '__import');
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
    // The boosters come from the planet's buffs: none active there is a game value of 0.
    await expect(page.locator('#energy-boost')).toHaveValue('0');
    await expect(page.locator('#energy-boost')).toHaveClass(/pf-bound/);

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

test('a changed universe setting counts in the overrides badge and is restored there', async ({ page }) => {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ speed: '5' }),
    }));
    await page.goto('/production');
    await importExport(page);
    const speed = page.locator('#universe-speed');
    await expect(speed).toHaveValue('5');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await speed.selectOption('7');
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    await page.reload();
    await expect(page.locator('#pf-overrides')).toHaveText('1');

    await page.locator('#pf-overrides').click();
    const rows = page.locator('#pf-reset-rows tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).locator('td').nth(1)).toHaveText('Universe');
    await expect(rows.nth(0).locator('td').nth(3)).toHaveText('5');
    await expect(rows.nth(0).locator('td').nth(4)).toHaveText('7');
    await page.locator('#pf-reset-go').click();

    await expect(page.locator('#pf-reset-modal')).toBeHidden();
    await expect(speed).toHaveValue('5');
    await expect(speed).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
    await page.reload();
    await expect(speed).toHaveValue('5');
    await expect(page.locator('#pf-overrides')).toBeHidden();
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

/** What production keeps in options_production. */
function storedProduction(page) {
    return page.evaluate(() => JSON.parse(localStorage.getItem('options_production') || '{}'));
}

test('a production calculator field changed with a profile active is kept with "no profile"', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await page.locator('#tabtag2').click();
    await page.locator('#all-pln-addtnl-info').check();
    await expect.poll(async () => (await storedProduction(page)).showAddInf).toBe(true);
    // The profile's values stay out of the calculator's own settings.
    expect((await storedProduction(page)).energyTechLevel).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('options_production_profile'))).toBeNull();

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#all-pln-addtnl-info')).toBeChecked();
    await expect(page.locator('#energy-tech-level')).toHaveValue('0');
});

test('production takes the calculator fields once from the key they had with a profile', async ({ page }) => {
    await page.goto('/production');
    await importExport(page);
    await expect(page.locator('#all-pln-addtnl-info')).not.toBeChecked();
    // What an earlier version kept apart while a profile was active.
    await page.evaluate(() => localStorage.setItem('options_production_profile', JSON.stringify({
        universeSpeed: 1, maxTempEntered: false, onePlnExtView: false, showAddInf: true, inclSats: 0,
    })));

    await page.reload();
    await expect(page.locator('#all-pln-addtnl-info')).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('options_production_profile'))).toBeNull();
    expect((await storedProduction(page)).showAddInf).toBe(true);

    // Taken over, not lost with the old key: a reload and "no profile" still show it.
    await page.reload();
    await expect(page.locator('#all-pln-addtnl-info')).toBeChecked();
    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#all-pln-addtnl-info')).toBeChecked();
    await expect(page.locator('#energy-tech-level')).toHaveValue('0');
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

// Sync (CONTEXT.md): PfG Companion hands account exports to the site, waiting in
// localStorage when a page loads or as an event after it, and the site applies
// the ones newer than a profile's game layer by itself.
const COMPANION_KEY = 'pfg_companion_pending_export';
const COMPANION_EVENT = 'pfg-companion:sync';
const NEWER_AT = '2026-10-12T00:00:00.000Z';

/** The fixture as Companion sends it, for en/1, changed by `edit`. */
function companionExport(edit = () => {}) {
    const raw = JSON.parse(EXPORT);
    raw.universe = { language: 'en', number: 1 };
    edit(raw);
    return raw;
}

/** The fixture exported again at `exportedAt`, with energy 17 and plasma 16. */
function laterExport(exportedAt = NEWER_AT) {
    return companionExport((raw) => {
        raw.exportedAt = exportedAt;
        raw.researches['113'] = 17;
        raw.researches['122'] = 16;
    });
}

const companionPayload = (...exports) => ({ version: 1, exports });

/** Leave a payload where Companion leaves it for the next page load. */
async function leaveCompanionPayload(page, payload) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [COMPANION_KEY, JSON.stringify(payload)]);
}

/** Import the fixture as en/1 on production and override plasma technology with 20. */
async function importForCompanion(page) {
    await page.goto('/production');
    await importExport(page, JSON.stringify(companionExport()));
    await page.locator('#param-researches-tab').click();
    await page.locator('#plasma-tech-level').fill('20');
    await page.locator('#plasma-tech-level').blur();
    await expect.poll(async () => (await activeProfile(page)).account.values['research.122']).toEqual({ game: 15, override: 20 });
}

test('a newer Companion export waiting at load updates the game layer and keeps the overrides', async ({ page }) => {
    await importForCompanion(page);
    await leaveCompanionPayload(page, companionPayload(laterExport()));
    await page.reload();

    const profile = await activeProfile(page);
    expect(profile.importedAt).toBe(NEWER_AT);
    expect(profile.account.values['research.113']).toEqual({ game: 17 });
    expect(profile.account.values['research.122']).toEqual({ game: 16, override: 20 });
    await expect(page.locator('#energy-tech-level')).toHaveValue('17');
    await expect(page.locator('#plasma-tech-level')).toHaveValue('20');
});

test('a Companion export no newer than the game layer is ignored', async ({ page }) => {
    await importForCompanion(page);
    const before = await activeProfile(page);
    const sameTime = JSON.parse(EXPORT).exportedAt;
    for (const exportedAt of [sameTime, '2026-10-01T00:00:00.000Z']) {
        await leaveCompanionPayload(page, companionPayload(laterExport(exportedAt)));
        await page.reload();
        expect(await activeProfile(page)).toEqual(before);
        await expect(page.locator('#energy-tech-level')).toHaveValue('14');
    }
});

test('a Companion export of an account with no profile is offered for import', async ({ page }) => {
    await page.goto('/production');
    await leaveCompanionPayload(page, companionPayload(companionExport((raw) => {
        raw.playerId = 100002;
        raw.playerName = 'Other';
    })));
    await page.reload();

    const offer = page.locator('#pf-select option[value="__companion_0"]');
    await expect(offer).toHaveCount(1);
    await expect(offer).toContainText('Other');
    await chooseAction(page, '__companion_0');
    await expect(page.locator('#pf-import-modal')).toBeVisible();
    expect(JSON.parse(await page.locator('#pf-import-text').inputValue()).playerId).toBe(100002);
});

test('a newer Companion export arriving after load updates the profile and the calculator', async ({ page }) => {
    await importForCompanion(page);
    await page.evaluate(([name, detail]) => document.dispatchEvent(new CustomEvent(name, { detail })),
        [COMPANION_EVENT, companionPayload(laterExport())]);

    await expect.poll(async () => (await activeProfile(page)).importedAt).toBe(NEWER_AT);
    const profile = await activeProfile(page);
    expect(profile.account.values['research.113']).toEqual({ game: 17 });
    expect(profile.account.values['research.122']).toEqual({ game: 16, override: 20 });
    // The page shows the new game layer without a reload.
    await expect(page.locator('#energy-tech-level')).toHaveValue('17');
    await expect(page.locator('#plasma-tech-level')).toHaveValue('20');
    await expect(page.locator('#plasma-tech-level')).toHaveClass(/pf-differs/);
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

test('a queue fields edit is named in the reset dialog and restored on its planet', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);
    await blurFill(page, '#total-fields-2', '250');

    await page.locator('#total-fields-2 + .pf-reset').click();
    await expect(page.locator('#total-fields-2')).toHaveValue('246');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.planets[0].values['fields.total']).toEqual({ game: 246 });

    await blurFill(page, '#total-fields-2', '250');
    await page.locator('#pf-overrides').click();
    const label = page.locator('#pf-reset-rows tr').nth(0).locator('td').nth(2);
    // Named in the page's words, not by its key.
    await expect(label).not.toHaveText('fields.total');
    await expect(label).not.toHaveText('');
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

test('a queue tab whose body the profile does not have stays the calculator\'s own', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);
    await editProfile(page, 'profile.moons = [];');
    await page.locator('#tabtag-3').click();
    await expect(page.locator('#pf-body-box-3')).toBeHidden();

    await blurFill(page, '#startlvl-3-41', '3');
    await blurFill(page, '#total-fields-3', '5');
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('options_queue') || '{}'))).totFldMn).toBe(5);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_queue') || '{}'));
    expect(stored.slm).toContainEqual([41, 3]);
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#startlvl-3-41')).toHaveValue('3');
    await expect(page.locator('#total-fields-3')).toHaveValue('5');
});

test('a queue built with a profile active is still there with "no profile"', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);
    await page.locator('#build-2-1').click();
    await expect(page.locator('#table-dst-2 tr')).toHaveCount(4);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#table-dst-2 tr')).toHaveCount(4);
    await page.reload();
    await expect(page.locator('#pf-select')).toHaveValue('');
    await expect(page.locator('#table-dst-2 tr')).toHaveCount(4);
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

test('a costs profile with no moon leaves the moon\'s field to the calculator', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);
    await editProfile(page, 'profile.moons = [];');
    await expect(page.locator('#pf-moon-box')).toBeHidden();

    await blurFill(page, '#robot-factory-level-moon', '3');
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('costs_calculator_state') || '{}'))).robotFactoryLevelMoon).toBe(3);
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#robot-factory-level-moon')).toHaveValue('3');
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

    // A row not filled in yet starts idle at the known level.
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

    // Another planet brings its own levels to the rows left alone.
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    expect(await rowLevels(page, 'table-1-2', 2)).toEqual(['24', '24']);
});

test('costs rows left alone follow another planet, rows planned by hand stay', async ({ page }) => {
    await mockServerData(page);
    await page.goto('/costs');
    await importExport(page);

    await page.locator('#tabtag-1').click();
    const crystalTo = page.locator('#table-1-2 tr').nth(2).locator('input').nth(1);
    await crystalTo.fill('30');
    await crystalTo.blur();

    // Beta's levels are lower: the idle metal row goes down with them.
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    expect(await rowLevels(page, 'table-1-2', 1)).toEqual(['28', '28']);
    expect(await rowLevels(page, 'table-1-2', 2)).toEqual(['26', '30']);
    // The planned row is recalculated for Beta's factories, not cleared.
    await expect(page.locator('#table-1-2 tr').nth(2).locator('td').nth(4)).not.toHaveText('0');

    await page.locator('#tabtag-2').click();
    await expect(page.locator('#tab2-from-level')).toHaveValue('28');
    await expect(page.locator('#tab2-to-level')).toHaveValue('29');
    await page.locator('#tab2-to-level').fill('35');
    await page.locator('#tab2-to-level').blur();
    await page.locator('#pf-planet').selectOption({ label: 'Alpha [2:148:8]' });
    await expect(page.locator('#tab2-from-level')).toHaveValue('28');
    await expect(page.locator('#tab2-to-level')).toHaveValue('35');
    expect(await rowLevels(page, 'table-1-2', 1)).toEqual(['30', '30']);
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

test('LF costs fill in the planet levels as the start levels, unbound', async ({ page }) => {
    await page.goto('/lfcosts');
    await importExport(page);

    // Alpha is human: 11101 is the Residential Sector, 1001 here.
    expect(await rowLevels(page, 'table-1-1', 1001)).toEqual(['40', '40']);
    expect(await rowLevels(page, 'table-1-1', 1003)).toEqual(['10', '10']);
    await page.locator('#tabtag-2').click();
    await page.locator('#tech-types-select').selectOption('1001');
    await expect(page.locator('#tab2-from-level')).toHaveValue('40');
    await expect(page.locator('#tab2-to-level')).toHaveValue('41');

    // A research added to the multi-level table starts from the planet's level.
    await page.locator('#tabtag-1').click();
    await page.locator('#tabtag-1-2').click();
    await page.locator('#research-race-dd-1').selectOption('1');
    await page.locator('#research-select-1').selectOption('1101');
    await page.locator('#research-add-btn-1').click();
    expect(await rowLevels(page, 'table-1-2', 1101)).toEqual(['8', '8']);

    const from = page.locator('#table-1-1 tr').nth(1).locator('input').first();
    await page.locator('#tabtag-1-1').click();
    await from.fill('30');
    await from.blur();
    await expect(from).not.toHaveClass(/pf-bound/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.planets[0].values['lf.building.11101']).toEqual({ game: 40 });

    await page.locator('#tabtag-2').click();
    await page.locator('#tech-types-select').selectOption('1101');
    await expect(page.locator('#tab2-from-level')).toHaveValue('8');
});

test('LF costs rows left alone follow another planet, rows planned by hand stay', async ({ page }) => {
    await page.goto('/lfcosts');
    await importExport(page);

    await page.locator('#tabtag-1').click();
    const to = page.locator('#table-1-1 tr').nth(3).locator('input').nth(1);
    expect(await rowLevels(page, 'table-1-1', 1003)).toEqual(['10', '10']);
    await to.fill('15');
    await to.blur();
    await page.locator('#tabtag-2').click();
    await page.locator('#tech-types-select').selectOption('1001');
    await page.locator('#tab2-to-level').fill('45');
    await page.locator('#tab2-to-level').blur();

    // The colony has no life form: its levels are all 0.
    await page.locator('#pf-planet').selectOption({ label: 'Colony [3:20:4]' });
    expect(await rowLevels(page, 'table-1-1', 1001)).toEqual(['0', '0']);
    expect(await rowLevels(page, 'table-1-1', 1003)).toEqual(['10', '15']);
    await expect(page.locator('#tab2-from-level')).toHaveValue('40');
    await expect(page.locator('#tab2-to-level')).toHaveValue('45');
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
    // The choice is the universe's, not the profile's, but it still differs from the game.
    await expect(page.locator('#pf-overrides')).toHaveText('1');

    await page.locator('#debris-percent + .pf-reset').click();
    await expect(debris).toHaveValue('75');
    await expect(debris).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
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

test('a terraformer profile with no planet leaves the planet and the universe to the calculator', async ({ page }) => {
    await page.goto('/terraformer');
    await chooseAction(page, '__create');
    await page.locator('#pf-props-name').fill('Empty');
    await page.locator('#pf-props-go').click();
    await expect(page.locator('#pf-select option:checked')).toHaveText('Empty');
    await expect(page.locator('#pf-planet-box')).toBeHidden();

    await blurFill(page, '#solar-plant-level', '9');
    await blurFill(page, '#tf-level-from', '4');
    await page.locator('#universe-speed').selectOption('3');
    // The account is the profile's, planet or not.
    await page.locator('#engineer').check();
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('options_terraformer') || '{}'));
    await expect.poll(async () => (await stored()).universeSpeed).toBe(3);
    expect((await stored()).solarPlantLevel).toBe(9);
    expect((await stored()).tfLevelFrom).toBe(4);
    expect((await stored()).engineer).toBe(false);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#solar-plant-level')).toHaveValue('9');
    await expect(page.locator('#tf-level-from')).toHaveValue('4');
    await expect(page.locator('#universe-speed')).toHaveValue('3');
    await expect(page.locator('#engineer')).not.toBeChecked();
});

test('terraformer gives its own values back after a reload with a profile active', async ({ page }) => {
    await page.goto('/terraformer');
    await blurFill(page, '#solar-plant-level', '7');
    await page.locator('#engineer').check();
    await importExport(page);
    await page.reload();
    await expect(page.locator('#solar-plant-level')).toHaveValue('25');
    await expect(page.locator('#engineer')).not.toBeChecked();

    // The copy of the own values is taken again on the reload, from what options_terraformer kept.
    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#solar-plant-level')).toHaveValue('7');
    await expect(page.locator('#engineer')).toBeChecked();
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
    // The choice is the universe's, not the profile's, but it still differs from the game.
    await expect(page.locator('#pf-overrides')).toHaveText('1');

    await page.locator('#universe-speed + .pf-reset').click();
    await expect(speed).toHaveValue('5');
    await expect(speed).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

// Trade: the account, the shared exchange rates, the locked universe, and a
// coordinates select that copies a body's position without binding it.

/** Type into a trade field; the page reads its fields on keyup. */
async function typeTrade(page, selector, value) {
    await page.locator(selector).fill(value);
    await page.locator(selector).press('Enter');
}

test('trade takes the account from the profile and locks its universe', async ({ page }) => {
    await page.goto('/trade');
    await importExport(page);

    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#player-class-0')).toBeChecked();
    await expect(page.locator('#sc-capacity-increase')).toHaveValue('1.23');
    await expect(page.locator('#lc-capacity-increase')).toHaveValue('2.5');
    await expect(page.locator('#hypertech-lvl')).toHaveClass(/pf-bound/);
    await expect(page.locator('fieldset:has(#player-class-0)')).toHaveClass(/pf-bound/);

    const profile = await activeProfile(page);
    await expect(page.locator('#country')).toHaveValue(profile.universe.country);
    await expect(page.locator('#country')).toBeDisabled();
    await expect(page.locator('#universe')).toBeDisabled();
    await expect(page.locator('#reset')).toBeHidden();

    // The dash, three planets and the moon; the coordinates move to the first planet.
    await expect(page.locator('#pf-body option')).toHaveCount(5);
    await expect(page.locator('#pf-body')).toHaveValue(profile.planets[0].id);
    await expect(page.locator('#coord-g')).toHaveValue('2');
    await expect(page.locator('#coord-s')).toHaveValue('148');
    await expect(page.locator('#coord-p')).toHaveValue('8');
    await expect(page.locator('#moon')).not.toBeChecked();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a trade edit becomes an override that can be restored', async ({ page }) => {
    await page.goto('/trade');
    await importExport(page);

    await typeTrade(page, '#hypertech-lvl', '9');
    await expect(page.locator('#hypertech-lvl')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.account.values['research.114']).toEqual({ game: 8, override: 9 });

    await page.locator('#hypertech-lvl + .pf-reset').click();
    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    profile = await activeProfile(page);
    expect(profile.account.values['research.114']).toEqual({ game: 8 });
});

test('trade rates go to the profile and production reads them', async ({ page }) => {
    await page.goto('/trade');
    await importExport(page);
    // The profile has no rates yet: trade shows the defaults, 3 : 2 : 1.
    await expect(page.locator('#rate-md')).toHaveValue('3');
    await expect(page.locator('#rate-cd')).toHaveValue('2');

    await page.locator('#rate-btn-1').click();
    const profile = await activeProfile(page);
    expect(profile.account.values.rates).toEqual({ override: [1, 2, 4] });
    // Rates have no game layer: bound, but never marked.
    await expect(page.locator('#rate-md')).not.toHaveClass(/pf-bound/);

    await page.goto('/production');
    await expect(page.locator('#exchange-rates-m')).toHaveValue('1');
    await expect(page.locator('#exchange-rates-c')).toHaveValue('2');
    await expect(page.locator('#exchange-rates-d')).toHaveValue('4');

    // 2.4 : 1.5 does not come back as 1.4999999999999998.
    await page.goto('/trade');
    await page.locator('#rate-btn-6').click();
    await page.reload();
    await expect(page.locator('#rate-md')).toHaveValue('2.4');
    await expect(page.locator('#rate-cd')).toHaveValue('1.5');
});

test('trade copies a moon\'s coordinates', async ({ page }) => {
    await page.goto('/trade');
    await importExport(page);
    const profile = await activeProfile(page);
    const moon = profile.moons[0];

    await page.locator('#pf-body').selectOption(moon.id);
    await expect(page.locator('#coord-g')).toHaveValue(String(moon.coords.galaxy));
    await expect(page.locator('#coord-s')).toHaveValue(String(moon.coords.system));
    await expect(page.locator('#coord-p')).toHaveValue(String(moon.coords.position));
    await expect(page.locator('#moon')).toBeChecked();

    // Coordinates typed by hand that match no body clear the select.
    await typeTrade(page, '#coord-p', '9');
    await expect(page.locator('#pf-body')).toHaveValue('');
    // The coordinates are the calculator's own: nothing went into the profile.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('"no profile" gives trade its own values and universe back', async ({ page }) => {
    await page.goto('/trade');
    await typeTrade(page, '#hypertech-lvl', '5');
    await page.locator('#rate-btn-1').click();
    const ownCountry = await page.locator('#country').inputValue();

    await importExport(page);
    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    // The trade's own settings keep the values from before the profile.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_trade') || '{}'));
    expect(stored.hyperTech).toBe(5);
    expect(stored.rates.md).toBe(4);
    expect(stored.country).toBe(ownCountry);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#hypertech-lvl')).toHaveValue('5');
    await expect(page.locator('#rate-md')).toHaveValue('4');
    await expect(page.locator('#rate-cd')).toHaveValue('2');
    await expect(page.locator('#country')).toHaveValue(ownCountry);
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#country')).toBeEnabled();
    await expect(page.locator('#pf-body-box')).toBeHidden();
    await expect(page.locator('#reset')).toBeVisible();
});

test('a trade link wins over the profile on load', async ({ page }) => {
    await page.goto('/trade');
    await importExport(page);
    const profile = await activeProfile(page);
    const other = await page.evaluate((own) => {
        const country = Object.keys(unis).find((c) => c !== own && unis[c].length > 0);
        return { country, uni: unis[country][0][0] };
    }, profile.universe.country);

    await page.goto('/trade#rmd=2.5&rcd=1.5&st=0&dt=0&m=1000&l=' + other.country + ':' + other.uni + '&lc=3:200:5&lm=0');
    await page.reload();

    await expect(page.locator('#rate-md')).toHaveValue('2.5');
    await expect(page.locator('#rate-cd')).toHaveValue('1.5');
    // The link's universe is not the profile's: the picker stays free for this view.
    await expect(page.locator('#country')).toHaveValue(other.country);
    await expect(page.locator('#country')).toBeEnabled();
    await expect(page.locator('#universe')).toBeEnabled();
    await expect(page.locator('#coord-g')).toHaveValue('3');
    await expect(page.locator('#coord-s')).toHaveValue('200');
    await expect(page.locator('#coord-p')).toHaveValue('5');
    await expect(page.locator('#pf-body')).toHaveValue('');
    // The account still comes from the profile, and nothing of the link went into it.
    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    expect((await activeProfile(page)).account.values.rates).toBeUndefined();

    // An edit made afterwards does.
    await page.locator('#rate-btn-1').click();
    expect((await activeProfile(page)).account.values.rates).toEqual({ override: [1, 2, 4] });
});

// Expeditions: the account (class, hyperspace technology, the life-form
// bonuses, the cargo bonus of every ship in the table) and the universe's
// economy speed and strongest player. The fleet and the discovery bonuses stay
// the calculator's own.

/** Answer the universe settings request with a speed and a top score. */
async function mockExpeditionsUniverse(page, topScore) {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ speed: '5', topScore }),
    }));
}

/** Fill a field and leave it: expeditions validates and recalculates on blur. */
async function blurFill(page, selector, value) {
    await page.locator(selector).fill(value);
    await page.locator(selector).blur();
}

test('expeditions takes the account from the profile', async ({ page }) => {
    await page.goto('/expeditions');
    // The 20% Expedition Resource Booster item, as a buff of the first planet.
    const withItem = JSON.parse(EXPORT);
    Object.values(withItem.planets)[0].buffs.push({
        rarity: 'common', itemUuid: '03ece11ef535f5ef49b203ff50a0466fda5a76e2', name: 'Expedition Resource Booster (20%) Bronze',
        buffStart: 1, buffEnd: null, effectStart: 1, effectEnd: null,
    });
    await importExport(page, JSON.stringify(withItem));

    await expect(page.locator('#player-class')).toHaveValue('1');
    await expect(page.locator('#player-class option:checked')).toHaveText('Collector');
    await expect(page.locator('#resource-discovery-booster')).toHaveValue('20');
    await expect(page.locator('#tech-hyper-level')).toHaveValue('8');
    await expect(page.locator('#percent-resources')).toHaveValue('4');
    await expect(page.locator('#percent-ships')).toHaveValue('2');
    await expect(page.locator('#class-bonus-collector')).toHaveValue('2.15');
    await expect(page.locator('#class-bonus-discoverer')).toHaveValue('0');
    await expect(page.locator('#lf-cargo-202')).toHaveValue('1.23');
    await expect(page.locator('#lf-cargo-203')).toHaveValue('2.5');
    await expect(page.locator('#lf-cargo-219')).toHaveValue('0');
    await expect(page.locator('#lf-cargo-209')).toHaveValue('0');

    for (const bound of ['#player-class', '#tech-hyper-level', '#percent-resources', '#percent-ships',
        '#class-bonus-collector', '#class-bonus-discoverer', '#resource-discovery-booster',
        '#lf-cargo-202', '#lf-cargo-203', '#lf-cargo-219']) {
        await expect(page.locator(bound)).toHaveClass(/pf-bound/);
    }
    // The calculator's own: the dark matter discovery bonus and the fleet.
    for (const own of ['#dark-matter-discovery-bonus', '#numSC']) {
        await expect(page.locator(own)).not.toHaveClass(/pf-bound/);
    }

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('an expeditions edit becomes an override that can be restored', async ({ page }) => {
    await page.goto('/expeditions');
    await importExport(page);
    await blurFill(page, '#numLC', '100');
    const capacity = await page.locator('#storage-capacity').textContent();

    await blurFill(page, '#tech-hyper-level', '9');
    await page.locator('#param-lf-tab').click();
    await blurFill(page, '#lf-cargo-203', '3');
    await expect(page.locator('#tech-hyper-level')).toHaveClass(/pf-differs/);
    await expect(page.locator('#lf-cargo-203')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('2');
    let profile = await activeProfile(page);
    expect(profile.account.values['research.114']).toEqual({ game: 8, override: 9 });
    expect(profile.account.values['lf.ship.203.cargo']).toEqual({ game: 2.5, override: 3 });
    await expect(page.locator('#storage-capacity')).not.toHaveText(capacity);

    await page.locator('#lf-cargo-203 + .pf-reset').click();
    await expect(page.locator('#lf-cargo-203')).toHaveValue('2.5');
    await page.locator('#param-common-tab').click();
    await page.locator('#tech-hyper-level + .pf-reset').click();
    await expect(page.locator('#tech-hyper-level')).toHaveValue('8');
    await expect(page.locator('#pf-overrides')).toBeHidden();
    // The restored bonus reached the calculation, not only the field.
    await expect(page.locator('#storage-capacity')).toHaveText(capacity);
    profile = await activeProfile(page);
    expect(profile.account.values['lf.ship.203.cargo']).toEqual({ game: 2.5 });
    expect(profile.account.values['research.114']).toEqual({ game: 8 });
});

test('the reset dialog names an expeditions cargo bonus in the page\'s words', async ({ page }) => {
    await page.goto('/expeditions');
    await importExport(page);
    await page.locator('#param-lf-tab').click();
    await blurFill(page, '#lf-cargo-203', '3');

    await page.locator('#pf-overrides').click();
    const label = page.locator('#pf-reset-rows tr').nth(0).locator('td').nth(2);
    await expect(label).not.toHaveText('lf.ship.203.cargo');
    await expect(label).not.toHaveText('');
});

test('the cargo bonuses reader makes overrides of what it reads', async ({ page }) => {
    await page.goto('/expeditions');
    await importExport(page);

    await page.locator('#param-lf-tab').click();
    await page.locator('#open-lfbr').click();
    await page.locator('#own-api-input').fill(JSON.stringify({ ships: { 203: { cargo: 0.05 } } }));
    await page.locator('#lf-bonuses-read-btn').click();
    await expect(page.locator('#lf-cargo-203')).toHaveValue('5');
    // The export names a ship the player can build; one it leaves out has no bonus.
    await expect(page.locator('#lf-cargo-202')).toHaveValue('0');
    await expect(page.locator('#lf-cargo-203')).toHaveClass(/pf-differs/);
    const profile = await activeProfile(page);
    expect(profile.account.values['lf.ship.203.cargo']).toEqual({ game: 2.5, override: 5 });
    expect(profile.account.values['lf.ship.202.cargo']).toEqual({ game: 1.23, override: 0 });
});

test('expeditions takes the speed and the top score from the universe, and keeps a changed one', async ({ page }) => {
    // 20 million points fall into the "< 25.000.000" entry.
    await mockExpeditionsUniverse(page, '20000000');
    await page.goto('/expeditions');
    await importExport(page);

    const speed = page.locator('#universe-speed');
    const top = page.locator('#highTop');
    await expect(speed).toHaveValue('5');
    await expect(top).toHaveValue('2400000');
    await expect(speed).toHaveClass(/pf-bound/);
    await expect(top).toHaveClass(/pf-bound/);

    await top.selectOption('1200000');
    await speed.selectOption('2');
    await expect(top).toHaveClass(/pf-differs/);
    await expect(speed).toHaveClass(/pf-differs/);
    await page.reload();
    await expect(speed).toHaveValue('2');
    await expect(top).toHaveValue('1200000');
    await expect(top).toHaveClass(/pf-differs/);
    // The choices are the universe's, not the profile's, but they still differ from the game.
    await expect(page.locator('#pf-overrides')).toHaveText('2');

    await page.locator('#highTop + .pf-reset').click();
    await expect(top).toHaveValue('2400000');
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    await page.locator('#universe-speed + .pf-reset').click();
    await expect(speed).toHaveValue('5');
    await expect(top).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('"no profile" gives expeditions its own values back', async ({ page }) => {
    await mockExpeditionsUniverse(page, '20000000');
    await page.goto('/expeditions');
    await blurFill(page, '#tech-hyper-level', '5');
    await page.locator('#universe-speed').selectOption('3');
    await page.locator('#highTop').selectOption('3000000');
    await page.locator('#param-lf-tab').click();
    await blurFill(page, '#lf-cargo-203', '7');
    await blurFill(page, '#numLC', '50');

    await importExport(page);
    await expect(page.locator('#tech-hyper-level')).toHaveValue('8');
    await expect(page.locator('#lf-cargo-203')).toHaveValue('2.5');
    await expect(page.locator('#universe-speed')).toHaveValue('5');
    // The fleet is the calculator's, whoever is active.
    await expect(page.locator('#numLC')).toHaveValue('50');
    await blurFill(page, '#numSC', '20');
    // The calculator's own settings keep the values from before the profile.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_expeditions') || '{}'));
    expect(stored.hyperTechLevel).toBe(5);
    expect(stored.lfShipsBonuses[1]).toBe(7);
    expect(stored.universeSpeed).toBe(3);
    expect(stored.highTop).toBe(3000000);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#tech-hyper-level')).toHaveValue('5');
    await expect(page.locator('#lf-cargo-203')).toHaveValue('7');
    await expect(page.locator('#universe-speed')).toHaveValue('3');
    await expect(page.locator('#highTop')).toHaveValue('3000000');
    await expect(page.locator('#numLC')).toHaveValue('50');
    await expect(page.locator('#numSC')).toHaveValue('20');
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

test('an expeditions API link wins over the profile on load', async ({ page }) => {
    await mockExpeditionsUniverse(page, '20000000');
    await page.goto('/expeditions');
    await importExport(page);

    await page.goto('/expeditions?h=7&pr=10&us=3');
    // The top score is not in the link: it comes from the profile's universe.
    await expect(page.locator('#highTop')).toHaveValue('2400000');
    await expect(page.locator('#tech-hyper-level')).toHaveValue('7');
    await expect(page.locator('#percent-resources')).toHaveValue('10');
    // The speed is, and the universe does not take it back.
    await expect(page.locator('#universe-speed')).toHaveValue('3');
    await expect(page.locator('#universe-speed')).not.toHaveClass(/pf-bound/);
    // What the link did not name comes from the profile.
    await expect(page.locator('#percent-ships')).toHaveValue('2');
    await expect(page.locator('#lf-cargo-203')).toHaveValue('2.5');
    await expect(page.locator('#player-class')).toHaveValue('1');
    // Nothing of the link went into the profile.
    await expect(page.locator('#pf-overrides')).toBeHidden();
    let profile = await activeProfile(page);
    expect(profile.account.values['research.114']).toEqual({ game: 8 });
    expect(profile.account.values['lf.expedition.resources']).toEqual({ game: 4 });

    // An edit made afterwards does.
    await blurFill(page, '#percent-ships', '3');
    profile = await activeProfile(page);
    expect(profile.account.values['lf.expedition.ships']).toEqual({ game: 2, override: 3 });
    expect(profile.account.values['research.114']).toEqual({ game: 8 });
});

// Moon: the account (hyperspace technology, the class, the life-form bonuses),
// a planet (its Supra Refractor), a moon (its sensor phalanx, and the system it
// stands in as a convenience) and the universe's debris and galaxy settings.
// The size of the moon to destroy, the Deathstars, the target system and the
// unit counts stay the calculator's own.

/** Answer the universe settings request; by default with nothing the moon page takes. */
async function mockMoonUniverse(page, body = { speed: '1' }) {
    await page.route('**/ajax.php?*service=serverdata*', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(body),
    }));
}

/**
 * What the export leaves out for the moon page: the life-form bonuses, the
 * Supra Refractor of two planets (a Kaelesh building) and a second moon whose
 * game phalanx is 0. Moon A orbits Alpha at system 148, Moon B orbits Beta at 150.
 */
const MOON_PROFILE_EDIT = `
    profile.account.values['lf.phalanxRange'] = { game: 12.5 };
    profile.account.values['lf.classBooster.3'] = { game: 7.5 };
    profile.account.values['lf.ship.209.cargo'] = { game: 3.5 };
    profile.planets[0].values['lf.building.14112'] = { game: 30 };
    profile.planets[1].values['lf.building.14112'] = { game: 11 };
    const second = JSON.parse(JSON.stringify(profile.moons[0]));
    Object.assign(second, { id: 'moon-b', gameId: 900099, name: 'Moon B', planetId: profile.planets[1].id, coords: { galaxy: 2, system: 150, position: 12 } });
    second.values['building.42'] = { game: 0 };
    profile.moons.push(second);
`;

/** Import the fixture on the moon page and add what MOON_PROFILE_EDIT (and `extra`) say. */
async function openMoonWithProfile(page, extra = '') {
    await mockMoonUniverse(page);
    await page.goto('/moon');
    await importExport(page);
    await editProfile(page, MOON_PROFILE_EDIT + extra);
}

test('moon takes the account, a planet and a moon from the profile', async ({ page }) => {
    // A general, so the class shows in a checkbox.
    await openMoonWithProfile(page, "profile.account.values['class'] = { game: 2 };");

    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#general-class')).toBeChecked();
    await expect(page.locator('#discoverer-class')).not.toBeChecked();
    await expect(page.locator('#rc-capacity-increase')).toHaveValue('3.5');
    await expect(page.locator('#phalanx-range-bonus')).toHaveValue('12.5');
    await expect(page.locator('#discoverer-bonus')).toHaveValue('7.5');

    await expect(page.locator('#pf-planet option')).toHaveCount(3);
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#supra-refractor')).toHaveValue('30');
    await expect(page.locator('#pf-moon option')).toHaveCount(2);
    await expect(page.locator('#pf-moon option:checked')).toHaveText('Moon [2:148:8]');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('5');
    // The moon's system is put into "your system" without being bound.
    await expect(page.locator('#own-system')).toHaveValue('148');

    for (const bound of ['#hypertech-lvl', '#general-class', '#discoverer-class', '#rc-capacity-increase',
        '#phalanx-range-bonus', '#discoverer-bonus', '#supra-refractor', '#phalanx-lvl']) {
        await expect(page.locator(bound)).toHaveClass(/pf-bound/);
    }
    // The calculator's own.
    for (const own of ['#moon-size', '#ds-count', '#promo-moon', '#target-system', '#own-system', '#small-cargo']) {
        await expect(page.locator(own)).not.toHaveClass(/pf-bound/);
    }

    // The two resets that would write defaults into the profile are gone; the destruction one stays.
    await expect(page.locator('#reset-cr')).toBeHidden();
    await expect(page.locator('#reset-ph')).toBeHidden();
    await expect(page.locator('#reset-ds')).toBeVisible();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a discoverer shows in its own checkbox in moon', async ({ page }) => {
    await openMoonWithProfile(page, "profile.account.values['class'] = { game: 3 };");
    await expect(page.locator('#discoverer-class')).toBeChecked();
    await expect(page.locator('#general-class')).not.toBeChecked();
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('another planet in moon brings its Supra Refractor and its moon, and both are remembered', async ({ page }) => {
    await openMoonWithProfile(page);

    // Choosing a planet also shows its moon.
    await page.locator('#pf-planet').selectOption({ label: 'Beta [2:150:12]' });
    await expect(page.locator('#supra-refractor')).toHaveValue('11');
    await expect(page.locator('#pf-moon option:checked')).toHaveText('Moon B [2:150:12]');
    await expect(page.locator('#own-system')).toHaveValue('150');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    // The planet with no life form has no Supra Refractor.
    await page.locator('#pf-planet').selectOption({ label: 'Colony [3:20:4]' });
    await expect(page.locator('#supra-refractor')).toHaveValue('0');

    await page.locator('#pf-planet').selectOption({ label: 'Alpha [2:148:8]' });
    await page.locator('#pf-moon').selectOption({ label: 'Moon B [2:150:12]' });
    await expect(page.locator('#supra-refractor')).toHaveValue('30');
    await expect(page.locator('#own-system')).toHaveValue('150');

    await page.reload();
    await expect(page.locator('#pf-planet option:checked')).toHaveText('Alpha [2:148:8]');
    await expect(page.locator('#pf-moon option:checked')).toHaveText('Moon B [2:150:12]');
    await expect(page.locator('#supra-refractor')).toHaveValue('30');
});

test('a moon with no phalanx shows level 1 in moon without an override', async ({ page }) => {
    await openMoonWithProfile(page);

    await page.locator('#pf-moon').selectOption({ label: 'Moon B [2:150:12]' });
    await expect(page.locator('#phalanx-lvl')).toHaveValue('1');
    await expect(page.locator('#pf-overrides')).toBeHidden();

    // Leaving the field must not turn the clamped 1 into an edit of the game's 0.
    await page.locator('#phalanx-lvl').focus();
    await page.locator('#phalanx-lvl').blur();
    await expect(page.locator('#pf-overrides')).toBeHidden();
    const profile = await activeProfile(page);
    expect(profile.moons[1].values['building.42']).toEqual({ game: 0 });
});

test('moon edits become overrides of the account, the planet and the moon', async ({ page }) => {
    await openMoonWithProfile(page);

    await blurFill(page, '#hypertech-lvl', '9');
    await page.locator('#param-lifeforms-tab').click();
    await blurFill(page, '#supra-refractor', '40');
    await blurFill(page, '#phalanx-lvl', '9');
    await expect(page.locator('#hypertech-lvl')).toHaveClass(/pf-differs/);
    await expect(page.locator('#supra-refractor')).toHaveClass(/pf-differs/);
    await expect(page.locator('#phalanx-lvl')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('3');
    let profile = await activeProfile(page);
    expect(profile.account.values['research.114']).toEqual({ game: 8, override: 9 });
    expect(profile.planets[0].values['lf.building.14112']).toEqual({ game: 30, override: 40 });
    expect(profile.moons[0].values['building.42']).toEqual({ game: 5, override: 9 });

    // "Your system" is filled in, not bound: an edit stays the calculator's.
    await blurFill(page, '#own-system', '200');
    await expect(page.locator('#own-system')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('3');

    await page.locator('#phalanx-lvl + .pf-reset').click();
    await expect(page.locator('#phalanx-lvl')).toHaveValue('5');
    await page.locator('#supra-refractor + .pf-reset').click();
    await expect(page.locator('#supra-refractor')).toHaveValue('30');
    profile = await activeProfile(page);
    expect(profile.moons[0].values['building.42']).toEqual({ game: 5 });
    expect(profile.planets[0].values['lf.building.14112']).toEqual({ game: 30 });
    expect(profile.account.values['research.114']).toEqual({ game: 8, override: 9 });
});

test('the reset dialog names the moon\'s phalanx in the page\'s words', async ({ page }) => {
    await openMoonWithProfile(page);
    await page.locator('#param-lifeforms-tab').click();
    await blurFill(page, '#phalanx-lvl', '9');

    await page.locator('#pf-overrides').click();
    const label = page.locator('#pf-reset-rows tr').nth(0).locator('td').nth(2);
    await expect(label).not.toHaveText('building.42');
    await expect(label).not.toHaveText('');
});

test('the class checkboxes of moon write the class, and a collector is no override', async ({ page }) => {
    await mockMoonUniverse(page);
    await page.goto('/moon');
    await importExport(page);

    // The export's collector shows as neither box, and is not an edit.
    await expect(page.locator('#general-class')).not.toBeChecked();
    await expect(page.locator('#discoverer-class')).not.toBeChecked();
    await expect(page.locator('#general-class')).toHaveClass(/pf-bound/);
    await blurFill(page, '#hypertech-lvl', '9');
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.account.values.class).toEqual({ game: 1 });

    await page.locator('#general-class').check();
    await expect(page.locator('#general-class')).toHaveClass(/pf-differs/);
    // The discoverer box is unticked, as in the game: bound, but not marked as differing.
    await expect(page.locator('#discoverer-class')).toHaveClass(/pf-bound/);
    await expect(page.locator('#discoverer-class')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#discoverer-class + .pf-reset')).toHaveCount(0);
    profile = await activeProfile(page);
    expect(profile.account.values.class).toEqual({ game: 1, override: 2 });

    // A character has one class: the other box is cleared.
    await page.locator('#discoverer-class').check();
    await expect(page.locator('#general-class')).not.toBeChecked();
    await expect(page.locator('#discoverer-class')).toBeChecked();
    profile = await activeProfile(page);
    expect(profile.account.values.class).toEqual({ game: 1, override: 3 });

    await page.locator('#discoverer-class + .pf-reset').click();
    await expect(page.locator('#discoverer-class')).not.toBeChecked();
    await expect(page.locator('#general-class')).not.toBeChecked();
    profile = await activeProfile(page);
    expect(profile.account.values.class).toEqual({ game: 1 });
    await expect(page.locator('#pf-overrides')).toHaveText('1');
});

test('unticking the class of a general in moon writes no class', async ({ page }) => {
    await openMoonWithProfile(page, "profile.account.values['class'] = { game: 2 };");
    await page.locator('#general-class').uncheck();
    await expect(page.locator('#general-class')).toHaveClass(/pf-differs/);
    const profile = await activeProfile(page);
    expect(profile.account.values.class).toEqual({ game: 2, override: 0 });

    await page.locator('#general-class + .pf-reset').click();
    await expect(page.locator('#general-class')).toBeChecked();
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('unticking the class of a discoverer in moon marks the discoverer box alone', async ({ page }) => {
    await openMoonWithProfile(page, "profile.account.values['class'] = { game: 3 };");
    await page.locator('#discoverer-class').uncheck();
    await expect(page.locator('#discoverer-class')).toHaveClass(/pf-differs/);
    await expect(page.locator('#discoverer-class + .pf-reset')).toHaveAttribute('aria-label', /✓/);
    await expect(page.locator('#general-class')).toHaveClass(/pf-bound/);
    await expect(page.locator('#general-class')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#general-class + .pf-reset')).toHaveCount(0);
});

test('moon takes the debris and galaxy settings from the universe, and keeps a changed one', async ({ page }) => {
    await mockMoonUniverse(page, {
        speed: '1', debrisFactor: '0.6', deuteriumInDebris: '1', debrisFactorDef: '0.35', systems: '300', donutSystem: '0',
    });
    await page.goto('/moon');
    await importExport(page);

    await expect(page.locator('#debris-percent')).toHaveValue('60');
    await expect(page.locator('#deut-to-debris')).toBeChecked();
    // A share no preset offers is added to the select.
    await expect(page.locator('#defense-debris-percent')).toHaveValue('35');
    await expect(page.locator('#systems-num')).toHaveValue('300');
    // The calculator starts on a circular galaxy; this universe is not.
    await expect(page.locator('#circular-systems')).not.toBeChecked();
    for (const bound of ['#debris-percent', '#deut-to-debris', '#defense-debris-percent', '#systems-num', '#circular-systems']) {
        await expect(page.locator(bound)).toHaveClass(/pf-bound/);
    }
    // The coordinate fields follow the galaxy's size.
    expect(await page.evaluate(() => document.getElementById('own-system')._constrains.max)).toBe(300);

    await blurFill(page, '#systems-num', '350');
    await page.locator('#defense-debris-percent').selectOption('10');
    await expect(page.locator('#systems-num')).toHaveClass(/pf-differs/);
    await expect(page.locator('#defense-debris-percent')).toHaveClass(/pf-differs/);
    await page.reload();
    await expect(page.locator('#systems-num')).toHaveValue('350');
    await expect(page.locator('#defense-debris-percent')).toHaveValue('10');
    await expect(page.locator('#systems-num')).toHaveClass(/pf-differs/);
    expect(await page.evaluate(() => document.getElementById('own-system')._constrains.max)).toBe(350);
    // The choices are the universe's, not the profile's, but they still differ from the game.
    await expect(page.locator('#pf-overrides')).toHaveText('2');

    await page.locator('#systems-num + .pf-reset').click();
    await expect(page.locator('#systems-num')).toHaveValue('300');
    await page.locator('#defense-debris-percent + .pf-reset').click();
    await expect(page.locator('#defense-debris-percent')).toHaveValue('35');
    await expect(page.locator('#systems-num')).not.toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('"no profile" gives moon its own values back', async ({ page }) => {
    await mockMoonUniverse(page, { speed: '1', debrisFactor: '0.6', systems: '300', donutSystem: '0' });
    await page.goto('/moon');
    await blurFill(page, '#moon-size', '2500');
    await blurFill(page, '#hypertech-lvl', '2');
    await page.locator('#debris-percent').selectOption('40');
    await page.locator('#defense-debris-percent').selectOption('20');
    await page.locator('#param-lifeforms-tab').click();
    await blurFill(page, '#supra-refractor', '7');
    await blurFill(page, '#phalanx-lvl', '3');
    await blurFill(page, '#own-system', '20');
    await blurFill(page, '#systems-num', '400');
    await page.locator('#discoverer-class').check();

    await importExport(page);
    await expect(page.locator('#hypertech-lvl')).toHaveValue('8');
    await expect(page.locator('#supra-refractor')).toHaveValue('0');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('5');
    await expect(page.locator('#own-system')).toHaveValue('148');
    await expect(page.locator('#discoverer-class')).not.toBeChecked();
    await expect(page.locator('#systems-num')).toHaveValue('300');
    await expect(page.locator('#debris-percent')).toHaveValue('60');
    // The destruction block is the calculator's, whoever is active.
    await expect(page.locator('#moon-size')).toHaveValue('2500');

    // The calculator's own settings keep the values from before the profile.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_moon') || '{}'));
    expect(stored.hyperTechLevel).toBe(2);
    expect(stored.supraRefractorLevel).toBe(7);
    expect(stored.phalanxLevel).toBe(3);
    expect(stored.ownSystem).toBe(20);
    expect(stored.isDiscoverer).toBe(true);
    expect(stored.isGeneral).toBe(false);
    expect(stored.numberOfSystems).toBe(400);
    expect(stored.circularSystems).toBe(true);
    expect(stored.debrisPercent).toBe(40);
    expect(stored.defenseDebrisPercent).toBe(20);
    expect(stored.moonSize).toBe(2500);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#hypertech-lvl')).toHaveValue('2');
    await expect(page.locator('#supra-refractor')).toHaveValue('7');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('3');
    await expect(page.locator('#own-system')).toHaveValue('20');
    await expect(page.locator('#discoverer-class')).toBeChecked();
    await expect(page.locator('#general-class')).not.toBeChecked();
    await expect(page.locator('#systems-num')).toHaveValue('400');
    await expect(page.locator('#circular-systems')).toBeChecked();
    await expect(page.locator('#debris-percent')).toHaveValue('40');
    await expect(page.locator('#defense-debris-percent')).toHaveValue('20');
    await expect(page.locator('#moon-size')).toHaveValue('2500');
    await expect(page.locator('#pf-planet-box')).toBeHidden();
    await expect(page.locator('#pf-moon-box')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset-cr')).toBeVisible();
    await expect(page.locator('#reset-ph')).toBeVisible();
    await expect(page.locator('#reset-ds')).toBeVisible();
});

/** What the moon page keeps in options_moon. */
function storedMoon(page) {
    return page.evaluate(() => JSON.parse(localStorage.getItem('options_moon') || '{}'));
}

test('a moon profile with no moon leaves the phalanx and "your system" to the calculator', async ({ page }) => {
    await openMoonWithProfile(page, 'profile.moons = [];');
    await expect(page.locator('#pf-moon-box')).toBeHidden();

    await blurFill(page, '#phalanx-lvl', '4');
    await blurFill(page, '#own-system', '77');
    await expect.poll(async () => (await storedMoon(page)).ownSystem).toBe(77);
    expect((await storedMoon(page)).phalanxLevel).toBe(4);
    await expect(page.locator('#pf-overrides')).toBeHidden();

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('4');
    await expect(page.locator('#own-system')).toHaveValue('77');
});

test('a moon with no known system leaves "your system" to the calculator, the phalanx not', async ({ page }) => {
    await fillOwnMoonValues(page);
    await openMoonWithProfile(page, 'profile.moons.forEach((m) => { m.coords = null; });');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('5');
    await expect(page.locator('#own-system')).toHaveValue('30');

    await blurFill(page, '#own-system', '77');
    await blurFill(page, '#phalanx-lvl', '6');
    await expect.poll(async () => (await storedMoon(page)).ownSystem).toBe(77);
    // The phalanx is the moon's: options_moon keeps the level from before the profile.
    expect((await storedMoon(page)).phalanxLevel).toBe(2);
    const profile = await activeProfile(page);
    expect(profile.moons[0].values['building.42']).toEqual({ game: 5, override: 6 });

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#own-system')).toHaveValue('77');
    await expect(page.locator('#phalanx-lvl')).toHaveValue('2');
});

/** Give the moon page its own phalanx (2) and "your system" (30) before any profile. */
async function fillOwnMoonValues(page) {
    await mockMoonUniverse(page);
    await page.goto('/moon');
    await blurFill(page, '#phalanx-lvl', '2');
    await blurFill(page, '#own-system', '30');
}

test('the size of the moon changed with a profile active is kept with "no profile"', async ({ page }) => {
    await openMoonWithProfile(page);
    await blurFill(page, '#moon-size', '3000');
    await expect.poll(async () => (await storedMoon(page)).moonSize).toBe(3000);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#moon-size')).toHaveValue('3000');
});
