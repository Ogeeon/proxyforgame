'use strict';

// Tests for the lifecycle every profile binder shares (ProfileBinder in
// profiles-binders.js): apply, write-back, the calculator's own values and
// leave. A small binder with one account field, one planet field and one
// calculator field stands in for a calculator; the page it would touch is
// replaced in the sandbox - `options`, `pfShow` - and the ProfilesUi by a fake
// over a real ProfileStore. The calculators' own binders, and how they wire
// their forms, stay with the Playwright suite (profiles.spec.js).

const { describe, it, beforeEach } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const s = load(
    ['ogame/calc/js/profiles-core.js', 'ogame/calc/js/profiles-store.js', 'ogame/calc/js/profiles-fields.js',
        'ogame/calc/js/profiles-binders.js'],
    ['ProfileBinder', 'ProfileStore', 'createProfile', 'createPlanet', 'pfConvNumField', 'getProfileValue'],
);
const { ProfileStore } = s;
// describeFieldList() asks whether a control is a select; the fake page has none.
s.HTMLSelectElement = function HTMLSelectElement() {};

/** A Storage stand-in backed by a Map. */
function memoryStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
    };
}

/**
 * A field of the test binder: no control on the page, so markField() gets null.
 *
 * @param {string} key
 * @param {string} prm
 */
function field(key, prm) {
    return { ...s.pfConvNumField(key, prm, '#' + prm), input: () => null, display: String };
}

const HYPER = field('research.114', 'hyper');
const ROBOTS = field('building.14', 'robots');

/** What the page around the binder saw, in order. */
let events;

/** A ProfilesUi over a real store, recording what the binder asks of it. */
function fakeUi() {
    const store = new ProfileStore(memoryStorage(), memoryStorage());
    return {
        store,
        /** @type {Array<(profile: any) => void>} */
        listeners: [],
        saves: 0,
        active: () => store.getActive(),
        onChange(listener) { this.listeners.push(listener); },
        /** Switch the tab to another profile, as the selector does. */
        choose(id) {
            store.setActive(id);
            const profile = id ? store.get(id) : null;
            this.listeners.forEach((l) => l(profile));
        },
        save(profile) {
            this.saves++;
            store.save(profile);
        },
        clearMarks: () => events.push('clearMarks'),
        markField: (_input, _profile, _entity, key) => events.push('mark ' + key + (binder.applying ? ' (applying)' : '')),
        describeField: () => undefined,
    };
}

/** @type {any} The sandbox's class: the checker cannot see its constructor from here. */
const ProfileBinder = s.ProfileBinder;

/**
 * The calculator the binder drives: its settings are options.prm, and it
 * saves from its recalculation, as the real ones do.
 */
class TestBinder extends ProfileBinder {
    /**
     * Declared for the checker only, which takes the base as `any` and would
     * otherwise give this class a constructor with no parameters.
     *
     * @param {ReturnType<typeof fakeUi>} pf
     * @param {object} app
     */
    constructor(pf, app) {
        super(pf, app);
    }

    fieldGroups() {
        return [
            { scope: '', entity: (p) => p.account, fields: [HYPER], settings: () => s.options.prm },
            { scope: 'planet', entity: (p) => p.planets[0] ?? null, fields: [ROBOTS], settings: () => s.options.prm },
        ];
    }

    showProfile(profile) {
        const prm = s.options.prm;
        HYPER.write(prm, s.getProfileValue(profile.account, HYPER.key));
        const planet = profile.planets[0];
        if (planet) ROBOTS.write(prm, s.getProfileValue(planet, ROBOTS.key));
        else Object.assign(prm, this.ownInPlace(profile));
        this.recalc();
    }

    recalc() {
        events.push('recalc' + (this.applying ? ' (applying)' : ''));
        s.options.save();
    }

    saveWithoutProfile() {
        events.push('own save');
    }

    storeOwn(stored) {
        this.stored = structuredClone(stored);
    }
}

/** @type {TestBinder} */
let binder;
/** @type {ReturnType<typeof fakeUi>} */
let ui;

/** A profile with a game layer: hyperspace 10 on the account, robotics 7 on its one planet. */
function imported(id, { planet = true, hyper = 10 } = {}) {
    const p = s.createProfile({ label: id, id });
    p.importedAt = '2026-10-31T00:00:00Z';
    p.account.values['research.114'] = { game: hyper };
    if (planet) {
        const body = s.createPlanet({ name: 'Home', id: id + '-p1' });
        body.values['building.14'] = { game: 7 };
        p.planets.push(body);
    }
    ui.store.save(p);
    return p;
}

/** The value the stored profile holds now, both layers. */
function stored(id, entity, key) {
    const p = ui.store.get(id);
    return (entity === 'account' ? p.account : p.planets[0]).values[key];
}

beforeEach(() => {
    events = [];
    s.options = { prm: { hyper: 3, robots: 5, mode: 'a' }, save: () => undefined };
    s.pfShow = (selector, visible) => events.push(selector + (visible ? ' shown' : ' hidden'));
    ui = fakeUi();
    binder = new TestBinder(ui, {});
});

describe('ProfileBinder: apply', () => {
    it('keeps the own values from before the first profile, not from the next one', () => {
        imported('a');
        imported('b', { hyper: 12 });
        binder.init();
        ui.choose('a');
        expect(s.options.prm.hyper).toBe(10);
        ui.choose('b');
        expect(s.options.prm.hyper).toBe(12);
        expect(binder.ownPrm).toEqual({ hyper: 3, robots: 5 });
    });

    it('applies the profile that is active when the page loads', () => {
        imported('a');
        ui.store.setActive('a');
        binder.init();
        expect(binder.profileId).toBe('a');
        expect(s.options.prm.robots).toBe(7);
    });

    it('writes nothing back from the saves its own filling raises', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        expect(events).toContain('recalc (applying)');
        expect(ui.saves).toBe(0);
        expect(binder.stored).toBe(undefined);
        expect(stored('a', 'account', 'research.114')).toEqual({ game: 10 });
    });

    it('marks only after the guard is off, and only the groups whose entity is shown', () => {
        imported('a', { planet: false });
        binder.init();
        ui.choose('a');
        const marks = events.filter((e) => e.startsWith('mark'));
        expect(marks).toEqual(['mark research.114']);
    });

    it('hides the reset button while a profile is shown, and shows it again on leave', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        ui.choose(null);
        expect(events.filter((e) => e.startsWith('#reset'))).toEqual(['#reset hidden', '#reset shown']);
    });
});

describe('ProfileBinder: write-back', () => {
    it('writes only what changed since the apply, in one save', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        s.options.prm.hyper = 11;
        s.options.save();
        expect(ui.saves).toBe(1);
        expect(stored('a', 'account', 'research.114')).toEqual({ game: 10, override: 11 });
        expect(stored('a', 'planet', 'building.14')).toEqual({ game: 7 });
    });

    it('does not save the profile again when nothing changed', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        s.options.prm.hyper = 11;
        s.options.save();
        s.options.save();
        expect(ui.saves).toBe(1);
    });

    it('drops the override when the value is set back to the game', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        s.options.prm.hyper = 11;
        s.options.save();
        s.options.prm.hyper = 10;
        s.options.save();
        expect(stored('a', 'account', 'research.114')).toEqual({ game: 10 });
    });

    it('saves as the calculator always did with no profile', () => {
        binder.init();
        s.options.save();
        expect(events).toEqual(['own save']);
        expect(ui.saves).toBe(0);
    });
});

describe('ProfileBinder: own values', () => {
    it('stores what the profile owns as it was before the profile, the rest as it is', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        s.options.prm.hyper = 11;
        s.options.prm.mode = 'b';
        s.options.save();
        expect(binder.stored).toEqual({ hyper: 3, robots: 5, mode: 'b' });
    });

    it('leaves a body the profile does not have to the calculator, in the form and in storage', () => {
        imported('a', { planet: false });
        binder.init();
        ui.choose('a');
        expect(s.options.prm.robots).toBe(5);
        s.options.prm.robots = 9;
        s.options.save();
        expect(binder.stored.robots).toBe(9);
        expect(ui.store.get('a').planets).toEqual([]);
        ui.choose(null);
        expect(s.options.prm.robots).toBe(9);
    });

    it('gives the own values back on leave, and recalculates after the guard is off', () => {
        imported('a');
        binder.init();
        ui.choose('a');
        events = [];
        ui.choose(null);
        expect(binder.profileId).toBe(null);
        expect(s.options.prm).toEqual({ hyper: 3, robots: 5, mode: 'a' });
        expect(events).toContain('recalc');
        expect(events.includes('recalc (applying)')).toBe(false);
    });
});
