import { test, expect } from './base';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Player profiles (ADR-0004) on the production calculator, the first one wired
// to them: importing an account export, editing a profile-owned field and
// restoring the game value, falling back to "no profile", converting an old
// saved set, the backup file and the per-tab active profile; then flight, the
// second: account fields, the locked universe, the departure body and its fleet;
// then the queue: a planet and a moon of the profile as the start levels.
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
    await page.goto('/production');
    await importExport(page);
    await chooseAction(page, '__manage');
    const download = page.waitForEvent('download');
    await page.locator('#pf-backup-download').click();
    const file = await (await download).path();

    // Delete the profile, then restore it from the file.
    await page.locator('#pf-manage-rows tr').first().locator('button').nth(1).click();
    // The confirm dialog is the one shown modal that is not ours.
    await page.locator('.modal.show:not([id^="pf-"]) .btn-primary').click();
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(0);
    await page.locator('#pf-backup-restore').setInputFiles(file);
    await expect(page.locator('#pf-manage-rows tr')).toHaveCount(1);
    await expect(page.locator('#pf-manage-rows')).toContainText('Tester');
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
    await expect(page.locator('#startlvl-2-1')).toHaveClass(/pf-bound/);

    await page.locator('#tabtag-3').click();
    await expect(page.locator('#pf-body-3 option')).toHaveCount(1);
    await expect(page.locator('#startlvl-3-41')).toHaveValue('7');
    await expect(page.locator('#startlvl-3-14')).toHaveValue('8');
    await expect(page.locator('#total-fields-3')).toHaveValue('24');

    await expect(page.locator('#reset')).toBeHidden();
    // Loading wrote nothing back.
    await expect(page.locator('#pf-overrides')).toBeHidden();
});

test('a queue start level becomes an override of the planet', async ({ page }) => {
    await page.goto('/queue');
    await importExport(page);

    await page.locator('#startlvl-2-1').fill('31');
    await page.locator('#startlvl-2-1').blur();
    await expect(page.locator('#startlvl-2-1')).toHaveClass(/pf-differs/);
    await expect(page.locator('#pf-overrides')).toHaveText('1');
    let profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30, override: 31 });

    await page.locator('#startlvl-2-1 + .pf-reset').click();
    await expect(page.locator('#startlvl-2-1')).toHaveValue('30');
    profile = await activeProfile(page);
    expect(profile.planets[0].values['building.1']).toEqual({ game: 30 });
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

    await importExport(page);
    await expect(page.locator('#hyper-tech-level')).toHaveValue('8');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('options_queue') || '{}'));
    expect(stored.hyperTechLevel).toBe(3);
    expect(stored.totFldPln).toBe(200);

    await page.locator('#pf-select').selectOption('');
    await expect(page.locator('#hyper-tech-level')).toHaveValue('3');
    await expect(page.locator('#total-fields-2')).toHaveValue('200');
    await expect(page.locator('#startlvl-2-1')).toHaveValue('0');
    await expect(page.locator('#pf-body-box-2')).toBeHidden();
    await expect(page.locator('.pf-bound')).toHaveCount(0);
    await expect(page.locator('#reset')).toBeVisible();
});

