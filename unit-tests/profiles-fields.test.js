'use strict';

// Tests for the profile fields (profiles-fields.js): the conversions between a
// profile value and a calculator's settings. Several of them are lossy on
// purpose - a calculator without a discoverer, a trader switch for the
// alliance class - so the expectations pin down what the code does today.
// display() is left out: it reads labels from the page.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const f = load(
    ['ogame/calc/js/profiles-core.js', 'ogame/calc/js/profiles-fields.js'],
    [
        'pfPrmField', 'pfInForm', 'pfConvNumField', 'pfCollectorClassField', 'pfRatesField',
        'pfClassField', 'pfTraderField', 'pfOfficerFields', 'pfFieldInput', 'pfDisplayValue',
        'pfOptionText', 'PF_ENERGY_ACCOUNT_FIELDS', 'PF_ENERGY_PLANET_FIELDS',
        'PROFILE_CLASS', 'PROFILE_ALLIANCE_CLASS', 'PROFILE_OFFICERS', 'DEFAULT_RATES',
    ],
);

/**
 * The settings value a field writes for a profile value.
 *
 * @param {any} field
 * @param {*} value
 */
function written(field, value) {
    const settings = {};
    field.write(settings, value);
    return settings[field.prm];
}

/**
 * The profile value a field reads from a settings value.
 *
 * @param {any} field
 * @param {*} value
 */
function read(field, value) {
    return field.read({ [field.prm]: value });
}

describe('pfPrmField', () => {
    it('keeps the value under its settings key, converted both ways', () => {
        const field = f.pfPrmField('research.113', 'energy', '#energy', (v) => v * 2, (v) => v / 2);
        expect(field.key).toBe('research.113');
        expect(field.prm).toBe('energy');
        expect(field.input).toBe('#energy');
        expect(written(field, 3)).toBe(6);
        expect(read(field, 6)).toBe(3);
    });

    it('takes display and markIf from extra', () => {
        const display = () => 'x';
        const markIf = () => false;
        const field = f.pfPrmField('k', 'p', '#p', (v) => v, (v) => v, { display, markIf });
        expect(field.display).toBe(display);
        expect(field.markIf).toBe(markIf);
    });

    it('writes only its own key', () => {
        const field = f.pfPrmField('k', 'p', '#p', (v) => v, (v) => v);
        const settings = { other: 1 };
        field.write(settings, 5);
        expect(settings).toEqual({ other: 1, p: 5 });
    });
});

describe('pfInForm', () => {
    it('shows the converted settings value instead of writing the settings', () => {
        const shown = [];
        const field = f.pfInForm(f.pfConvNumField('k', 'p', '#p', 0, 1), (v) => shown.push(v));
        const settings = {};
        field.write(settings, -4);
        expect(shown).toEqual([1]);
        expect(settings).toEqual({});
        expect(read(field, '7')).toBe(7);
    });
});

describe('pfConvNumField', () => {
    it('writes a number, 0 for anything that is not one', () => {
        const field = f.pfConvNumField('k', 'p', '#p');
        expect(written(field, '5')).toBe(5);
        expect(written(field, 'abc')).toBe(0);
        expect(written(field, undefined)).toBe(0);
        expect(written(field, null)).toBe(0);
    });

    it('writes the default for a missing value only', () => {
        const field = f.pfConvNumField('k', 'p', '#p', 100);
        expect(written(field, undefined)).toBe(100);
        expect(written(field, null)).toBe(100);
        expect(written(field, 0)).toBe(0);
    });

    it('raises a value below the minimum, the default too', () => {
        const field = f.pfConvNumField('k', 'p', '#p', 0, 1);
        expect(written(field, -5)).toBe(1);
        expect(written(field, 0)).toBe(1);
        expect(written(field, undefined)).toBe(1);
        expect(written(field, 3)).toBe(3);
    });

    it('reads a number, 0 for anything that is not one', () => {
        const field = f.pfConvNumField('k', 'p', '#p', 100, 1);
        expect(read(field, '12')).toBe(12);
        expect(read(field, undefined)).toBe(0);
    });
});

describe('pfCollectorClassField', () => {
    const field = f.pfCollectorClassField('playerClass', 'class-');

    it('is the class, shown in the radios that count from the collector', () => {
        expect(field.key).toBe('class');
        expect(field.prm).toBe('playerClass');
        expect(field.input).toBe('#class-0');
    });

    it('shows no class as the collector and keeps the radio in 0..2', () => {
        expect(written(field, undefined)).toBe(0);
        expect(written(field, f.PROFILE_CLASS.NONE)).toBe(0);
        expect(written(field, f.PROFILE_CLASS.COLLECTOR)).toBe(0);
        expect(written(field, f.PROFILE_CLASS.GENERAL)).toBe(1);
        expect(written(field, f.PROFILE_CLASS.DISCOVERER)).toBe(2);
        expect(written(field, 7)).toBe(2);
    });

    it('reads the radio back as the profile class', () => {
        expect(read(field, 0)).toBe(f.PROFILE_CLASS.COLLECTOR);
        expect(read(field, 1)).toBe(f.PROFILE_CLASS.GENERAL);
        expect(read(field, 2)).toBe(f.PROFILE_CLASS.DISCOVERER);
        expect(read(field, undefined)).toBe(f.PROFILE_CLASS.COLLECTOR);
    });
});

describe('pfClassField', () => {
    it('keeps the collector and the general, anything else is the calculator\'s no class', () => {
        const field = f.pfClassField('playerClass', 'player-class-', 9);
        expect(field.input).toBe('#player-class-0');
        expect(written(field, f.PROFILE_CLASS.COLLECTOR)).toBe(f.PROFILE_CLASS.COLLECTOR);
        expect(written(field, f.PROFILE_CLASS.GENERAL)).toBe(f.PROFILE_CLASS.GENERAL);
        expect(written(field, f.PROFILE_CLASS.DISCOVERER)).toBe(9);
        expect(written(field, f.PROFILE_CLASS.NONE)).toBe(9);
        expect(written(field, undefined)).toBe(9);
    });

    it('reads the radio value as it is', () => {
        const field = f.pfClassField('playerClass', 'player-class-', f.PROFILE_CLASS.NONE);
        expect(read(field, 2)).toBe(2);
        expect(read(field, '1')).toBe(1);
        expect(read(field, undefined)).toBe(0);
    });
});

describe('pfTraderField', () => {
    const field = f.pfTraderField('isTrader', '#trader-bonus');
    const A = f.PROFILE_ALLIANCE_CLASS;

    it('is the alliance class', () => {
        expect(field.key).toBe('allianceClass');
        expect(field.prm).toBe('isTrader');
    });

    it('switches on for the trader only', () => {
        expect(written(field, A.TRADER)).toBe(true);
        expect(written(field, String(A.TRADER))).toBe(true);
        expect(written(field, A.WARRIOR)).toBe(false);
        expect(written(field, A.RESEARCHER)).toBe(false);
        expect(written(field, A.NONE)).toBe(false);
        expect(written(field, undefined)).toBe(false);
    });

    it('reads the switch as the trader or no alliance class', () => {
        expect(read(field, true)).toBe(A.TRADER);
        expect(read(field, 'true')).toBe(A.TRADER);
        expect(read(field, false)).toBe(A.NONE);
        expect(read(field, 'false')).toBe(A.NONE);
        expect(read(field, undefined)).toBe(A.NONE);
    });

    it('displays a tick for the trader, a dash otherwise', () => {
        expect(field.display(A.TRADER)).toBe('✓');
        expect(field.display(A.WARRIOR)).toBe('—');
    });
});

describe('pfRatesField', () => {
    const field = f.pfRatesField('rates', '#rates');

    it('writes three numbers, the default rates otherwise', () => {
        expect(written(field, ['2', '3', '4'])).toEqual([2, 3, 4]);
        expect(written(field, [1, 2])).toEqual([1, 1.5, 3]);
        expect(written(field, [1, 2, 3, 4])).toEqual([1, 1.5, 3]);
        expect(written(field, undefined)).toEqual([1, 1.5, 3]);
        expect(written(field, '1:2:3')).toEqual([1, 1.5, 3]);
    });

    it('reads any list as numbers, without checking its length', () => {
        expect(read(field, ['1', '2'])).toEqual([1, 2]);
        expect(read(field, null)).toEqual([1, 1.5, 3]);
    });

    it('hands out a copy of the default rates', () => {
        const rates = written(field, undefined);
        rates[0] = 99;
        const back = read(field, undefined);
        back[1] = 99;
        expect(f.DEFAULT_RATES).toEqual([1, 1.5, 3]);
    });
});

describe('pfOfficerFields', () => {
    it('makes one switch per officer, named alike in the settings and the ids', () => {
        const fields = f.pfOfficerFields(['geologist', 'admiral']);
        expect(fields.map((x) => [x.key, x.prm, x.input])).toEqual([
            ['officer.geologist', 'geologist', '#geologist'],
            ['officer.admiral', 'admiral', '#admiral'],
        ]);
        expect(written(fields[0], 'true')).toBe(true);
        expect(written(fields[0], 1)).toBe(false);
        expect(read(fields[0], true)).toBe(true);
        expect(read(fields[0], undefined)).toBe(false);
    });
});

describe('the energy fields graviton and terraformer share', () => {
    it('cover the account: technologies, officers, class, trader and the life-form energy bonus', () => {
        expect(f.PF_ENERGY_ACCOUNT_FIELDS.map((x) => x.key)).toEqual([
            'research.113', 'research.114',
            ...f.PROFILE_OFFICERS.map((o) => 'officer.' + o),
            'class', 'allianceClass', 'lf.prod.energy',
        ]);
    });

    it('show a discoverer as no class', () => {
        const cls = f.PF_ENERGY_ACCOUNT_FIELDS.find((x) => x.key === 'class');
        expect(written(cls, f.PROFILE_CLASS.DISCOVERER)).toBe(f.PROFILE_CLASS.NONE);
    });

    it('cover the planet, with full production when the profile has none', () => {
        expect(f.PF_ENERGY_PLANET_FIELDS.map((x) => x.key)).toEqual([
            'temperature.max', 'energyBooster', 'building.4', 'production.4', 'building.12',
            'production.12', 'ship.212', 'production.212', 'lf.building.12107',
        ]);
        const percent = f.PF_ENERGY_PLANET_FIELDS.filter((x) => x.key.startsWith('production.'));
        expect(percent.map((x) => written(x, undefined))).toEqual([100, 100, 100]);
    });
});

describe('pfFieldInput', () => {
    it('asks a lookup for the control', () => {
        const control = { id: 'x' };
        expect(f.pfFieldInput({ input: () => control })).toBe(control);
    });
});

describe('pfDisplayValue', () => {
    it('shows flags as a tick or a dash and lists joined with colons', () => {
        expect(f.pfDisplayValue(true)).toBe('✓');
        expect(f.pfDisplayValue(false)).toBe('—');
        expect(f.pfDisplayValue(null)).toBe('—');
        expect(f.pfDisplayValue(undefined)).toBe('—');
        expect(f.pfDisplayValue([1, 1.5, 3])).toBe('1 : 1.5 : 3');
        expect(f.pfDisplayValue(42)).toBe('42');
    });
});

describe('pfOptionText', () => {
    it('shows the text of the matching option, else the value itself', () => {
        const select = { options: [{ value: '1', text: 'One' }, { value: '2', text: 'Two' }] };
        expect(f.pfOptionText(select)(2)).toBe('Two');
        expect(f.pfOptionText(select)(3)).toBe('3');
        expect(f.pfOptionText(null)(true)).toBe('✓');
    });
});
