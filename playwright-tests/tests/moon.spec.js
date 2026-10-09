import { test, expect } from './base';

test.describe('Moon Calculator Page', () => {
    test.beforeEach(async ({ context, page }) => {
        // Avoid changelog popup
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('page loads successfully', async ({ page }) => {
        await expect(page).toHaveTitle(/Moon/i);
    });

    test('calculator options are available', async ({ page }) => {
        // Check if the options object exists
        const optionsExists = await page.evaluate(() => typeof options !== 'undefined');
        expect(optionsExists).toBe(true);
    });

    test('the migrated modules are wired up', async ({ page }) => {
        const wired = await page.evaluate(() => ({
            core: typeof MoonCalculator,
            collector: typeof MoonDataCollector,
            renderer: typeof MoonRenderer,
            app: typeof MoonApp,
            instance: !!window.moonApp,
        }));
        expect(wired).toEqual({
            core: 'function',
            collector: 'function',
            renderer: 'function',
            app: 'function',
            instance: true,
        });
    });
});

// ---------------------------------------------------------------------------
// DOM integration: form inputs drive the rendered results.
// ---------------------------------------------------------------------------

async function openFleetTab(page) {
    await page.locator('#param-fleet-tab').click();
    await expect(page.locator('#light-fighter')).toBeVisible();
}

async function openDefensesTab(page) {
    await page.locator('#param-defenses-tab').click();
    await expect(page.locator('#plasma-turret')).toBeVisible();
}

test.describe('Moon Calculator - DOM integration', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            // Clear any persisted state so defaults are deterministic. Init
            // scripts also run on reload, so only wipe it on the first load -
            // otherwise the persistence test could never observe a saved value.
            if (!localStorage.getItem('pfg-state-cleared')) {
                localStorage.removeItem('options_moon');
                localStorage.setItem('pfg-state-cleared', '1');
            }
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('creation parameters are organized into Common, Fleet and Defenses tabs', async ({ page }) => {
        // The Common tab is active by default; fields on the other tabs are hidden.
        await expect(page.locator('#debris-percent')).toBeVisible();
        await expect(page.locator('#promo-moon')).toBeVisible();
        await expect(page.locator('#light-fighter')).toBeHidden();
        await expect(page.locator('#plasma-turret')).toBeHidden();

        await openFleetTab(page);
        await expect(page.locator('#death-star')).toBeVisible();
        await expect(page.locator('#solar-sat')).toBeHidden();

        await openDefensesTab(page);
        await expect(page.locator('#rocket-launcher')).toBeVisible();
        await expect(page.locator('#large-shield')).toBeVisible();
        // The solar satellite is listed with the defenses, as in the game.
        await expect(page.locator('#solar-sat')).toBeVisible();
        // Switching away from Common hides its controls.
        await expect(page.locator('#debris-percent')).toBeHidden();
    });

    test('the destruction chances react to the moon diameter', async ({ page }) => {
        await page.locator('#moon-size').fill('2500');
        await page.locator('#moon-size').blur();
        await expect(page.locator('#moon-destroy-chance')).toHaveText('50');
        await expect(page.locator('#ds-blow-chance')).toHaveText('25');
    });

    test('entering a fleet updates the chance, cost and recycling readouts', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();

        await expect(page.locator('#moon-create-chance')).toHaveText('1.2');
        await expect(page.locator('#metal-required')).toHaveText('300.000');
        await expect(page.locator('#metal-recyclable')).toHaveText('90.000');
        await expect(page.locator('#debris-total')).toHaveText('120.000');
        await expect(page.locator('#recyclers')).toHaveText('6');
    });

    test('clicking a max-count label fills the adjacent count input', async ({ page }) => {
        await openFleetTab(page);
        // The light-fighter max label shows how many reach the 20% cap at 30% DF.
        const maxLabel = page.locator('#light-fighter-max');
        await expect(maxLabel).not.toHaveText('-');
        const expected = await maxLabel.getAttribute('data-max-count');

        await maxLabel.click();

        await expect(page.locator('#light-fighter')).toHaveValue(expected);
        // 100% of the cap -> the maximum chance.
        await expect(page.locator('#moon-create-chance')).toHaveText('20');
    });

    test('clicking a dash max-count label does nothing', async ({ page }) => {
        await openDefensesTab(page);
        // Defenses do not feed the debris field by default, so their max is '-'.
        await expect(page.locator('#plasma-turret-max')).toHaveText('-');
        await expect(page.locator('#plasma-turret-max')).not.toHaveAttribute('data-max-count');

        await page.locator('#plasma-turret-max').click();

        await expect(page.locator('#plasma-turret')).toHaveValue('0');
    });

    test('the defenses checkbox switches the defense contribution on', async ({ page }) => {
        await openDefensesTab(page);
        await page.locator('#plasma-turret').fill('10');
        await page.locator('#plasma-turret').blur();
        // Defenses stay out of the field by default...
        await expect(page.locator('#debris-total')).toHaveText('0');
        // ...but the resources were still spent.
        await expect(page.locator('#metal-required')).toHaveText('500.000');
        await expect(page.locator('#plasma-turret-max')).toHaveText('-');

        await page.locator('#param-common-tab').click();
        await page.locator('#defense-to-debris').check();
        await expect(page.locator('#debris-total')).toHaveText('300.000');
        await expect(page.locator('#moon-create-chance')).toHaveText('3');
    });

    test('the deuterium checkbox adds deuterium to the recycling block', async ({ page }) => {
        await openDefensesTab(page);
        await page.locator('#solar-sat').fill('1000');
        await page.locator('#solar-sat').blur();
        await expect(page.locator('#deuterium-recyclable')).toHaveText('0');

        await page.locator('#param-common-tab').click();
        await page.locator('#deut-to-debris').check();
        await expect(page.locator('#deuterium-recyclable')).toHaveText('150.000');
    });

    test('the general class lowers the recyclers needed', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();
        await page.locator('#param-common-tab').click();
        await expect(page.locator('#recyclers')).toHaveText('6');

        await page.locator('#general-class').check(); // General -> hold 24000
        await expect(page.locator('#recyclers')).toHaveText('5');
    });

    test('the recycler capacity increase lowers the recyclers needed', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();
        await page.locator('#param-common-tab').click();

        await page.locator('#rc-capacity-increase').fill('50'); // hold 30000
        await page.locator('#rc-capacity-increase').blur();
        await expect(page.locator('#recyclers')).toHaveText('4');
    });

    test('the promo checkbox lifts the chance above 20%', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#death-star').fill('1');
        await page.locator('#death-star').blur();
        await expect(page.locator('#moon-create-chance')).toHaveText('20');

        await page.locator('#param-common-tab').click();
        await page.locator('#promo-moon').check();
        await expect(page.locator('#moon-create-chance')).toHaveText('27');
    });

    test('the debris field drives the diameter range and its variants', async ({ page }) => {
        // With no battle entered there is no moon, hence no size at all.
        await expect(page.locator('#moon-size-range')).toHaveText('-');
        await expect(page.locator('#moon-size-variants .size-badge')).toHaveCount(0);

        await openFleetTab(page);
        await page.locator('#death-star').fill('1'); // 2.7M of debris, past the cap
        await page.locator('#death-star').blur();

        await expect(page.locator('#moon-size-range')).toHaveText('8.366 – 8.944');
        const badges = page.locator('#moon-size-variants .size-badge');
        await expect(badges).toHaveCount(11);
        await expect(badges.first()).toHaveText('8.366');
        await expect(badges.last()).toHaveText('8.944');
        // Eleven equally likely rolls.
        await expect(page.locator('#moon-size-roll-chance')).toHaveText('9.09');
    });

    test('the Supra Refractor level lifts both the chance and the diameter', async ({ page }) => {
        await openFleetTab(page);
        await page.locator('#death-star').fill('1');
        await page.locator('#death-star').blur();
        await page.locator('#param-common-tab').click();

        await page.locator('#supra-refractor').fill('20');
        await page.locator('#supra-refractor').blur();

        // 20 levels add 10%: the chance cap becomes 22% and the diameter is
        // scaled until it hits the 9400 km hard cap.
        await expect(page.locator('#moon-create-chance')).toHaveText('22');
        await expect(page.locator('#moon-size-range')).toHaveText('9.203 – 9.400');
    });

    test('the destruction reset restores its own fields only', async ({ page }) => {
        await page.locator('#moon-size').fill('2500');
        await page.locator('#ds-count').fill('7');
        await page.locator('#hypertech-lvl').fill('12');
        await page.locator('#hypertech-lvl').blur();

        await page.locator('#reset-ds').click();

        await expect(page.locator('#moon-size')).toHaveValue('1');
        await expect(page.locator('#ds-count')).toHaveValue('1');
        // The creation section is untouched.
        await expect(page.locator('#hypertech-lvl')).toHaveValue('12');
    });

    test('the creation reset clears the units, selects and checkboxes', async ({ page }) => {
        await page.locator('#hypertech-lvl').fill('12');
        await page.locator('#debris-percent').selectOption('60');
        await page.locator('#general-class').check();
        await page.locator('#rc-capacity-increase').fill('80');
        await page.locator('#rc-capacity-increase').blur();
        await page.locator('#defense-to-debris').check();
        await page.locator('#deut-to-debris').check();
        await page.locator('#promo-moon').check();
        await page.locator('#supra-refractor').fill('15');
        await page.locator('#supra-refractor').blur();
        await openFleetTab(page);
        await page.locator('#light-fighter').fill('100');
        await page.locator('#light-fighter').blur();

        await page.locator('#reset-cr').click();

        await expect(page.locator('#light-fighter')).toHaveValue('0');
        await page.locator('#param-common-tab').click();
        await expect(page.locator('#hypertech-lvl')).toHaveValue('0');
        await expect(page.locator('#debris-percent')).toHaveValue('30');
        await expect(page.locator('#general-class')).not.toBeChecked();
        await expect(page.locator('#rc-capacity-increase')).toHaveValue('0');
        await expect(page.locator('#defense-to-debris')).not.toBeChecked();
        await expect(page.locator('#deut-to-debris')).not.toBeChecked();
        await expect(page.locator('#promo-moon')).not.toBeChecked();
        await expect(page.locator('#supra-refractor')).toHaveValue('0');
        await expect(page.locator('#moon-create-chance')).toHaveText('0');
        await expect(page.locator('#moon-size-range')).toHaveText('-');
    });

    // Russian uses a comma as the decimal separator (options.decimalSeparator).
    // Select the language via the context locale rather than a "/ru/" URL prefix:
    // the prefix relies on an Apache rewrite that is absent under the PHP
    // built-in server used in CI, and the outer beforeEach already loaded the page.
    test.describe('Russian locale', () => {
        test.use({ locale: 'ru-RU' });

        test('the percentage readouts use the language decimal separator', async ({ page }) => {
            await openFleetTab(page);
            await page.locator('#light-fighter').fill('100');
            await page.locator('#light-fighter').blur();
            await expect(page.locator('#moon-create-chance')).toHaveText('1,2');

            await page.locator('#light-fighter').fill('0');
            await page.locator('#death-star').fill('1'); // eleven equally likely rolls
            await page.locator('#death-star').blur();
            await expect(page.locator('#moon-size-roll-chance')).toHaveText('9,09');
        });

        test('the diameter unit addon is translated', async ({ page }) => {
            await expect(page.locator('#moon-size-range + .input-group-text')).toHaveText('км');
        });
    });

    test('the checkbox settings survive a reload', async ({ page }) => {
        await page.locator('#promo-moon').check();
        await page.locator('#debris-percent').selectOption('70');
        await page.locator('#supra-refractor').fill('8');
        await page.locator('#supra-refractor').blur();
        await page.reload();
        await expect(page.locator('#promo-moon')).toBeChecked();
        await expect(page.locator('#debris-percent')).toHaveValue('70');
        await expect(page.locator('#supra-refractor')).toHaveValue('8');
    });
});

// ---------------------------------------------------------------------------
// Sensor phalanx panel.
// ---------------------------------------------------------------------------

test.describe('Moon Calculator - Sensor phalanx', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('lastChange', 'key-value;true,value;99999');
            if (!localStorage.getItem('pfg-phalanx-cleared')) {
                localStorage.removeItem('options_moon');
                localStorage.setItem('pfg-phalanx-cleared', '1');
            }
        });
        await page.goto('/ogame/calc/moon.php');
    });

    test('the panel starts on a level 1 phalanx that sees its own system only', async ({ page }) => {
        await expect(page.locator('#phalanx-lvl')).toHaveValue('1');
        await expect(page.locator('#circular-systems')).toBeChecked();
        await expect(page.locator('#systems-num')).toHaveValue('499');
        await expect(page.locator('#phalanx-range')).toHaveText('0');
        await expect(page.locator('#visible-systems')).toHaveText('1');
        await expect(page.locator('#systems-in-range')).toHaveText('1');
    });

    test('the level drives the range and the covered systems', async ({ page }) => {
        await page.locator('#own-system').fill('100');
        await page.locator('#own-system').blur();
        await page.locator('#phalanx-lvl').fill('5');
        await page.locator('#phalanx-lvl').blur();

        await expect(page.locator('#phalanx-range')).toHaveText('24');
        await expect(page.locator('#visible-systems')).toHaveText('76 – 124');
        await expect(page.locator('#systems-in-range')).toHaveText('49');
    });

    test('a circular galaxy wraps the covered systems into two segments', async ({ page }) => {
        await page.locator('#own-system').fill('5');
        await page.locator('#own-system').blur();
        await page.locator('#phalanx-lvl').fill('5');
        await page.locator('#phalanx-lvl').blur();

        await expect(page.locator('#visible-systems')).toHaveText('480 – 499, 1 – 29');
        await expect(page.locator('#systems-in-range')).toHaveText('49');
    });

    test('unchecking the circular setting clips the coverage at the galaxy edge', async ({ page }) => {
        await page.locator('#own-system').fill('5');
        await page.locator('#own-system').blur();
        await page.locator('#phalanx-lvl').fill('5');
        await page.locator('#phalanx-lvl').blur();
        await page.locator('#circular-systems').uncheck();

        await expect(page.locator('#visible-systems')).toHaveText('1 – 29');
        await expect(page.locator('#systems-in-range')).toHaveText('29');
    });

    test('the Discoverer class and its bonus widen the range', async ({ page }) => {
        await page.locator('#phalanx-lvl').fill('5');
        await page.locator('#phalanx-lvl').blur();
        await expect(page.locator('#phalanx-range')).toHaveText('24');

        await page.locator('#discoverer-class').check();
        await expect(page.locator('#phalanx-range')).toHaveText('28');

        // 0.20 * (1 + 0.50) = 0.30, so 24 * 1.30 = 31.2
        await page.locator('#discoverer-bonus').fill('50');
        await page.locator('#discoverer-bonus').blur();
        await expect(page.locator('#phalanx-range')).toHaveText('31');
    });

    test('the class bonus is inert while the class is unchecked', async ({ page }) => {
        await page.locator('#phalanx-lvl').fill('5');
        await page.locator('#phalanx-lvl').blur();
        await page.locator('#discoverer-bonus').fill('500');
        await page.locator('#discoverer-bonus').blur();
        await expect(page.locator('#phalanx-range')).toHaveText('24');
    });

    test('the target system yields a distance and the level it takes', async ({ page }) => {
        await page.locator('#own-system').fill('5');
        await page.locator('#own-system').blur();
        await page.locator('#target-system').fill('495');
        await page.locator('#target-system').blur();

        // The short way round a circular galaxy is 9 systems, which level 4 covers.
        await expect(page.locator('#phalanx-distance')).toHaveText('9');
        await expect(page.locator('#phalanx-lvl-required')).toHaveText('4');

        await page.locator('#circular-systems').uncheck();
        await expect(page.locator('#phalanx-distance')).toHaveText('490');
        await expect(page.locator('#phalanx-lvl-required')).toHaveText('23');
    });

    test('a range bonus can bring the required level down', async ({ page }) => {
        await page.locator('#own-system').fill('5');
        await page.locator('#own-system').blur();
        await page.locator('#target-system').fill('495');
        await page.locator('#target-system').blur();
        await expect(page.locator('#phalanx-lvl-required')).toHaveText('4');

        // Level 3 spans 8 systems; 8 * 1.20 = 9.6 -> 9, enough for a distance of 9.
        await page.locator('#phalanx-range-bonus').fill('20');
        await page.locator('#phalanx-range-bonus').blur();
        await expect(page.locator('#phalanx-lvl-required')).toHaveText('3');
    });

    test('the coordinate fields are clamped to the galaxy size on blur', async ({ page }) => {
        await page.locator('#systems-num').fill('100');
        await page.locator('#systems-num').blur();

        await page.locator('#own-system').fill('900');
        await page.locator('#own-system').blur();
        await expect(page.locator('#own-system')).toHaveValue('100');

        await page.locator('#target-system').fill('900');
        await page.locator('#target-system').blur();
        await expect(page.locator('#target-system')).toHaveValue('100');
    });

    test('a reach that closes the ring collapses to the whole galaxy', async ({ page }) => {
        await page.locator('#systems-num').fill('100');
        await page.locator('#systems-num').blur();
        await page.locator('#own-system').fill('5');
        await page.locator('#own-system').blur();
        await page.locator('#phalanx-lvl').fill('10');
        await page.locator('#phalanx-lvl').blur();

        await expect(page.locator('#visible-systems')).toHaveText('1 – 100');
        await expect(page.locator('#systems-in-range')).toHaveText('100');
    });

    test('the phalanx settings survive a reload', async ({ page }) => {
        await page.locator('#phalanx-lvl').fill('7');
        await page.locator('#phalanx-lvl').blur();
        await page.locator('#discoverer-class').check();
        await page.locator('#discoverer-bonus').fill('12');
        await page.locator('#discoverer-bonus').blur();
        await page.locator('#own-system').fill('42');
        await page.locator('#own-system').blur();
        await page.locator('#target-system').fill('64');
        await page.locator('#target-system').blur();
        await page.locator('#circular-systems').uncheck();
        await page.locator('#systems-num').fill('400');
        await page.locator('#systems-num').blur();

        await page.reload();

        await expect(page.locator('#phalanx-lvl')).toHaveValue('7');
        await expect(page.locator('#discoverer-class')).toBeChecked();
        await expect(page.locator('#discoverer-bonus')).toHaveValue('12');
        await expect(page.locator('#own-system')).toHaveValue('42');
        await expect(page.locator('#target-system')).toHaveValue('64');
        await expect(page.locator('#circular-systems')).not.toBeChecked();
        await expect(page.locator('#systems-num')).toHaveValue('400');
    });

    test('reset restores every phalanx field', async ({ page }) => {
        await page.locator('#phalanx-lvl').fill('7');
        await page.locator('#phalanx-lvl').blur();
        await page.locator('#phalanx-range-bonus').fill('15');
        await page.locator('#phalanx-range-bonus').blur();
        await page.locator('#discoverer-class').check();
        await page.locator('#discoverer-bonus').fill('12');
        await page.locator('#discoverer-bonus').blur();
        await page.locator('#own-system').fill('42');
        await page.locator('#own-system').blur();
        await page.locator('#target-system').fill('64');
        await page.locator('#target-system').blur();
        await page.locator('#circular-systems').uncheck();
        await page.locator('#systems-num').fill('400');
        await page.locator('#systems-num').blur();

        await page.locator('#reset-ph').click();

        await expect(page.locator('#phalanx-lvl')).toHaveValue('1');
        await expect(page.locator('#phalanx-range-bonus')).toHaveValue('0');
        await expect(page.locator('#discoverer-class')).not.toBeChecked();
        await expect(page.locator('#discoverer-bonus')).toHaveValue('0');
        await expect(page.locator('#own-system')).toHaveValue('1');
        await expect(page.locator('#target-system')).toHaveValue('1');
        await expect(page.locator('#circular-systems')).toBeChecked();
        await expect(page.locator('#systems-num')).toHaveValue('499');
        await expect(page.locator('#phalanx-range')).toHaveText('0');
        await expect(page.locator('#visible-systems')).toHaveText('1');
    });
});
