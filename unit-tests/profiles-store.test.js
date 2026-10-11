'use strict';

// Tests for the profile storage (profiles-store.js): the index, the per-tab
// active profile, the remembered planet and a browser that refuses to store.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { ProfileStore, createProfile } = load(
    ['ogame/calc/js/profiles-core.js', 'ogame/calc/js/profiles-store.js'],
    ['ProfileStore', 'createProfile'],
);

/** A Storage stand-in backed by a Map. */
function memoryStorage() {
    const map = new Map();
    return {
        map,
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
    };
}

/** A storage that refuses every write, like a full quota. */
function fullStorage() {
    return { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => undefined };
}

function freshStore() {
    const local = memoryStorage();
    return { local, store: new ProfileStore(local, memoryStorage()) };
}

describe('ProfileStore', () => {
    it('saves a profile and lists it in the index', () => {
        const { store } = freshStore();
        const p = createProfile({ label: 'Main', id: 'a', universe: { country: 'en', number: 1 } });
        expect(store.save(p)).toBe(true);
        expect(JSON.parse(JSON.stringify(store.list()))).toEqual([
            { id: 'a', label: 'Main', universe: { country: 'en', number: 1 }, playerId: null },
        ]);
        expect(store.get('a').label).toBe('Main');
    });

    it('keeps one index entry per profile across saves', () => {
        const { store } = freshStore();
        const p = createProfile({ label: 'Main', id: 'a' });
        store.save(p);
        p.label = 'Renamed';
        store.save(p);
        expect(store.list().map((e) => e.label)).toEqual(['Renamed']);
    });

    it('sorts the index by label', () => {
        const { store } = freshStore();
        store.save(createProfile({ label: 'b', id: '1' }));
        store.save(createProfile({ label: 'a', id: '2' }));
        expect(store.list().map((e) => e.id)).toEqual(['2', '1']);
    });

    it('removes a profile, its entry and its active choice', () => {
        const { store, local } = freshStore();
        store.save(createProfile({ label: 'Main', id: 'a' }));
        store.setActive('a');
        store.setLastPlanet('production', 'a', 'p1');
        store.remove('a');
        expect(store.list()).toHaveLength(0);
        expect(store.get('a')).toBeNull();
        expect(store.getActiveId()).toBeNull();
        expect(local.getItem('pfg_profile_a')).toBeNull();
        expect(store.getLastPlanet('production', 'a')).toBeNull();
    });

    it('keeps the active profile per tab, falling back to the last choice', () => {
        const local = memoryStorage();
        const tab1 = new ProfileStore(local, memoryStorage());
        tab1.save(createProfile({ label: 'A', id: 'a' }));
        tab1.save(createProfile({ label: 'B', id: 'b' }));
        tab1.setActive('a');
        const tab2 = new ProfileStore(local, memoryStorage());
        expect(tab2.getActiveId()).toBe('a');
        tab2.setActive('b');
        expect(tab1.getActiveId()).toBe('a');
        expect(new ProfileStore(local, memoryStorage()).getActiveId()).toBe('b');
    });

    it('remembers "no profile" in a tab instead of falling back', () => {
        const local = memoryStorage();
        const tab1 = new ProfileStore(local, memoryStorage());
        tab1.save(createProfile({ label: 'A', id: 'a' }));
        tab1.setActive('a');
        const tab2 = new ProfileStore(local, memoryStorage());
        tab2.setActive(null);
        tab1.setActive('a');
        expect(tab2.getActiveId()).toBeNull();
    });

    it('treats an active id whose profile is gone as none', () => {
        const { store, local } = freshStore();
        local.setItem('pfg_active_profile', JSON.stringify('ghost'));
        expect(store.getActiveId()).toBeNull();
    });

    it('remembers the last planet per calculator and profile', () => {
        const { store } = freshStore();
        store.setLastPlanet('production', 'a', 'p1');
        store.setLastPlanet('costs', 'a', 'm1');
        expect(store.getLastPlanet('production', 'a')).toBe('p1');
        expect(store.getLastPlanet('costs', 'a')).toBe('m1');
        expect(store.getLastPlanet('production', 'b')).toBeNull();
    });

    it('notifies its listeners on a change', () => {
        const { store } = freshStore();
        let calls = 0;
        store.subscribe(() => { calls++; });
        store.save(createProfile({ label: 'A', id: 'a' }));
        store.setActive('a');
        expect(calls).toBe(2);
    });

    it('ignores a stored profile of a format it does not know', () => {
        const { store, local } = freshStore();
        store.save(createProfile({ label: 'A', id: 'a' }));
        local.setItem('pfg_profile_a', JSON.stringify({ formatVersion: 99, id: 'a' }));
        expect(store.get('a')).toBeNull();
        expect(store.getAll()).toHaveLength(0);
    });

    it('reports a refused write instead of throwing', () => {
        const store = new ProfileStore(fullStorage(), fullStorage());
        expect(store.save(createProfile({ label: 'A', id: 'a' }))).toBe(false);
        expect(store.list()).toHaveLength(0);
    });

    it('works with no storage at all', () => {
        const store = new ProfileStore(null, null);
        expect(store.available).toBe(false);
        expect(store.getActiveId()).toBeNull();
        expect(store.save(createProfile({ label: 'A', id: 'a' }))).toBe(false);
    });
});
