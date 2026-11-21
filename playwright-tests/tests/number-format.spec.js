import { test, expect } from './base';

// Numbers are written the way the site language writes them
// (docs/adr/0006-locale-number-formatting.md): the grouping character and the
// decimal separator come from the locale. The other specs run in English; this
// one opens the same pages in four languages and asserts the exact characters -
// the two space separators are invisible, so they are built from their code
// points rather than typed. The language comes through the context locale, not
// a "/ru/" prefix: the prefix needs an Apache rewrite the PHP built-in server in
// CI does not have.

const NO_BREAK_SPACE = String.fromCodePoint(0xA0);
const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x202F);

const LOCALES = [
    { lang: 'en', locale: 'en-GB', group: ',', dec: '.' },
    { lang: 'de', locale: 'de-DE', group: '.', dec: ',' },
    { lang: 'ru', locale: 'ru-RU', group: NO_BREAK_SPACE, dec: ',' },
    { lang: 'fr', locale: 'fr-FR', group: NARROW_NO_BREAK_SPACE, dec: ',' },
];

/** "1<group>234" from the digit groups of a whole number. */
const grouped = (group, ...parts) => parts.join(group);

/** The planet buildings of the costs calculator's "one level" table, the scanner left out. */
const PLANET_KEYS = [
    'metal-mine', 'crystal-mine', 'deut-synth', 'solar-plant', 'fusion-reactor',
    'robot-factory', 'nanite-factory', 'shipyard', 'metal-storage', 'crystal-storage',
    'deuterium-tank', 'research-lab', 'terraformer', 'alliance-depot', 'spacedock',
    'missile-silo',
];

for (const { lang, locale, group, dec } of LOCALES) {
    test.describe(`number format - ${lang}`, () => {
        test.use({ locale });

        test.beforeEach(async ({ context }) => {
            // Keep the changelog popup and the costs disclaimer out of the way.
            await context.addInitScript(() => {
                localStorage.setItem('lastChange', 'key-value;true,value;99999');
                document.cookie = 'costs_rn_disclaimer_shown=1; path=/';
            });
        });

        test('the page is served in that language', async ({ page }) => {
            await page.goto('/trade');
            await expect(page.locator('html')).toHaveAttribute('lang', lang === 'en' ? 'en-GB' : lang);
        });

        test('production: the scanner dialog groups its figures', async ({ page }) => {
            await page.goto('/production');
            await page.locator('#ias-settings').click();
            await expect(page.locator('#ias-modal')).toBeVisible();
            await page.locator('#ias-level').fill('11');
            await page.locator('#ias-level').press('Tab');
            await page.locator('#ias-workload').selectOption('50');
            await expect(page.locator('#ias-lithium')).toHaveText(grouped(group, '2', '410'));
            await expect(page.locator('#ias-cost')).toHaveText(grouped(group, '7', '230'));
        });

        test('costs: the compact and the full totals', async ({ page }) => {
            // costs.tpl inlines msg-cant-research into a quoted literal without
            // json_encode, and the apostrophe of the French text ("n'est") is a
            // syntax error that stops the page script - the French costs page
            // calculates nothing. A bug of its own, not of the number format.
            test.fixme(lang === 'fr', 'the French costs page script does not run (costs.tpl, msg-cant-research)');
            await page.goto('/costs');
            await page.locator('#tabtag-0').click();
            await page.locator('#tabtag-0-2').click();
            for (const key of PLANET_KEYS) {
                const input = page.locator(`#table-0-2 tr[data-report-key="${key}"] .level-input`).first();
                await input.fill('1');
                await input.press('Enter');
            }
            const metal = page.locator('#table-0-2 tr[data-row-key="total"] td:nth-child(5)');
            // The compact mantissa takes the locale decimal separator; the suffix letter is the locale's own.
            await expect(metal).toHaveText(new RegExp(`^1\\${dec}045\\S$`));
            await page.locator('#param-common-tab').click();
            await page.locator('#full-numbers').click();
            await expect(metal).toHaveText(grouped(group, '1', '045', '508'));
        });

        test('trade: the result fields, the rates and the slider limits', async ({ page }) => {
            await page.goto('/trade');
            await page.locator('#rate-btn-6').click();
            await page.locator('#res-src-5').click();
            for (const [field, amount] of [['c', '100000'], ['d', '50000']]) {
                await page.locator('#res-src-' + field).fill(amount);
                await page.locator('#res-src-' + field).press('Enter');
            }
            await expect(page.locator('#res-dst-m')).toHaveValue(grouped(group, '280', '000'));
            // The preset writes its rates in the locale's decimal form.
            await expect(page.locator('#rate-md')).toHaveValue(`2${dec}4`);
            await expect(page.locator('#rate-cd')).toHaveValue(`1${dec}5`);
            await expect(page.locator('#rate-mc')).toHaveText(`1${dec}600`);
            await expect(page.locator('#rate-md-min')).toHaveText(`1${dec}8`);
            await expect(page.locator('#rate-cd-max')).toHaveText(`2${dec}0`);
        });
    });
}
