'use strict';

// Tests for the profile storage (profiles-store.js): the index, the per-tab
// active profile, the remembered planet, a browser that refuses to store, and
// the shared cache of the universe settings.

const { describe, it } = require('node:test');
const { load } = require('./load');
const { expect } = require('./expect');

const { ProfileStore, UniverseCache, createProfile } = load(
    ['ogame/calc/js/profiles-core.js', 'ogame/calc/js/profiles-store.js'],
    ['ProfileStore', 'UniverseCache', 'createProfile'],
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

const EN1 = { country: 'en', number: 1 };
const DAY = 24 * 3600 * 1000;
const ANSWER = { speed: '8', debrisFactor: '0.3', deuteriumInDebris: '1', topScore: '5', debrisFactorDef: '0', systems: '499', donutSystem: '1' };

/**
 * A universe cache over memory storage, a fetcher that counts its calls and
 * answers with `answer` (null: the server is unreachable), and a clock the
 * test moves.
 *
 * @param {?Record<string, string>} [answer]
 */
function freshCache(answer = ANSWER) {
    const local = memoryStorage();
    const clock = { now: 1000 };
    const fetcher = {
        calls: 0,
        fetch: async () => {
            fetcher.calls++;
            return answer;
        },
    };
    const cache = new UniverseCache(local, fetcher.fetch, () => clock.now);
    return { local, clock, fetcher, cache };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

describe('UniverseCache', () => {
    it('fetches a universe it does not know and stores every setting', async () => {
        const { cache, fetcher, local } = freshCache();
        const entry = await cache.refresh(EN1, 'speed');
        expect(fetcher.calls).toBe(1);
        expect(plain(entry)).toEqual({
            at: 1000, speed: 8, debrisFactor: 30, deuteriumInDebris: true, topScore: 40000,
            debrisFactorDef: 0, systems: 499, donutSystem: true,
        });
        expect(JSON.parse(local.getItem('pfg_universe_en_1'))).toEqual(plain(entry));
    });

    it('reuses an entry for a day, then fetches again', async () => {
        const { cache, fetcher, clock } = freshCache();
        await cache.refresh(EN1, 'speed');
        clock.now += DAY - 1;
        await cache.refresh(EN1, 'systems');
        expect(fetcher.calls).toBe(1);
        clock.now += 1;
        expect((await cache.refresh(EN1, 'speed')).at).toBe(clock.now);
        expect(fetcher.calls).toBe(2);
    });

    it('hands out a fresh entry at once, and nothing that has to be fetched', async () => {
        const { cache, clock, fetcher } = freshCache();
        expect(cache.fresh(EN1, 'speed')).toBeNull();
        await cache.refresh(EN1, 'speed');
        expect(cache.fresh(EN1, 'speed').speed).toBe(8);
        clock.now += DAY;
        expect(cache.fresh(EN1, 'speed')).toBeNull();
        expect(fetcher.calls).toBe(1);
    });

    it('fetches again for a setting the entry never held', async () => {
        const { cache, fetcher, local } = freshCache();
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 1000, speed: 8 }));
        await cache.refresh(EN1, 'speed');
        expect(fetcher.calls).toBe(0);
        await cache.refresh(EN1, 'donutSystem');
        expect(fetcher.calls).toBe(1);
    });

    it('asks once for two settings of a universe wanted at the same time', async () => {
        const { cache, fetcher } = freshCache();
        const [a, b] = await Promise.all([cache.refresh(EN1, 'speed'), cache.refresh(EN1, 'debrisFactor')]);
        expect(fetcher.calls).toBe(1);
        expect(a.speed).toBe(8);
        expect(b.debrisFactor).toBe(30);
    });

    it('keeps the choices written while the request was out', async () => {
        const { cache, local, clock } = freshCache();
        clock.now = 2 * DAY;
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 0, speed: 8 }));
        const pending = cache.refresh(EN1, 'speed');
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 0, speed: 8, overrides: { speed: 4 } }));
        expect(plain((await pending).overrides)).toEqual({ speed: 4 });
    });

    it('keeps a stale entry when the server cannot be reached', async () => {
        const { cache, local, fetcher, clock } = freshCache(null);
        clock.now = 2 * DAY;
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 1, speed: 8 }));
        expect(plain(await cache.refresh(EN1, 'speed'))).toEqual({ at: 1, speed: 8 });
        expect(fetcher.calls).toBe(1);
        expect(await freshCache(null).cache.refresh(EN1, 'speed')).toBeNull();
    });

    it('treats a failed request as an unreachable server', async () => {
        const cache = new UniverseCache(memoryStorage(), () => Promise.reject(new Error('offline')), () => 1);
        expect(await cache.refresh(EN1, 'speed')).toBeNull();
    });

    it("reads the speed's old lone choice", () => {
        const { cache, local } = freshCache();
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 1, speed: 8, override: 4 }));
        expect(plain(cache.get(EN1))).toEqual({ at: 1, speed: 8, overrides: { speed: 4 } });
        expect(JSON.parse(local.getItem('pfg_universe_en_1')).override).toBe(4);
    });

    it('ignores a broken entry', () => {
        const { cache, local } = freshCache();
        local.setItem('pfg_universe_en_1', '{oops');
        expect(cache.get(EN1)).toBeNull();
        local.setItem('pfg_universe_en_1', JSON.stringify({ speed: 8 }));
        expect(cache.get(EN1)).toBeNull();
    });

    it("remembers the player's choice and drops it once it is the game's again", async () => {
        const { cache } = freshCache();
        await cache.refresh(EN1, 'speed');
        expect(plain(cache.choose(EN1, 'speed', 4).overrides)).toEqual({ speed: 4 });
        expect(plain(cache.get(EN1).overrides)).toEqual({ speed: 4 });
        cache.choose(EN1, 'speed', 8);
        expect(plain(cache.get(EN1).overrides)).toEqual({});
    });

    it('drops the choices the reset dialog names', () => {
        const { cache, local } = freshCache();
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 1, speed: 8, systems: 499, overrides: { speed: 4, systems: 400 } }));
        expect(cache.reset(EN1, ['speed'])).toBe(1);
        expect(JSON.parse(local.getItem('pfg_universe_en_1')).overrides).toEqual({ systems: 400 });
        expect(cache.reset(EN1, ['speed'])).toBe(0);
        expect(cache.reset({ country: 'de', number: 9 }, ['speed'])).toBe(0);
    });

    it('keeps no choice while the game value is unknown', () => {
        const { cache, local } = freshCache();
        expect(cache.choose(EN1, 'speed', 4)).toBeNull();
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 1, speed: null }));
        expect(cache.choose(EN1, 'speed', 4)).toBeNull();
        expect('overrides' in cache.get(EN1)).toBe(false);
    });

    it("carries the profiles' universe choices through a backup", () => {
        const { cache, local } = freshCache();
        local.setItem('pfg_universe_en_1', JSON.stringify({ at: 5, speed: 8, overrides: { speed: 4 } }));
        local.setItem('pfg_universe_de_2', JSON.stringify({ at: 5, speed: 2 }));
        const profiles = [
            createProfile({ label: 'a', id: 'a', universe: EN1 }),
            createProfile({ label: 'b', id: 'b', universe: EN1 }),
            createProfile({ label: 'c', id: 'c', universe: { country: 'de', number: 2 } }),
            createProfile({ label: 'd', id: 'd' }),
        ];
        const choices = cache.choicesOf(profiles);
        expect(plain(choices)).toEqual([{ universe: EN1, overrides: { speed: 4 } }]);

        const other = freshCache();
        other.local.setItem('pfg_universe_en_1', JSON.stringify({ at: 9, speed: 8, overrides: { systems: 400 } }));
        choices.forEach((c) => other.cache.restoreChoices(c));
        other.cache.restoreChoices({ universe: { country: 'fr', number: 3 }, overrides: { speed: 2 } });
        expect(JSON.parse(other.local.getItem('pfg_universe_en_1'))).toEqual({ at: 9, speed: 8, overrides: { systems: 400, speed: 4 } });
        expect(JSON.parse(other.local.getItem('pfg_universe_fr_3'))).toEqual({ at: 0, overrides: { speed: 2 } });
    });

    it('does not throw when the browser refuses to store', async () => {
        const cache = new UniverseCache(fullStorage(), async () => ANSWER, () => 1);
        expect((await cache.refresh(EN1, 'speed')).speed).toBe(8);
        cache.restoreChoices({ universe: EN1, overrides: { speed: 4 } });
        expect(cache.get(EN1)).toBeNull();
    });

    it('works with no storage at all', async () => {
        const cache = new UniverseCache(null, async () => ANSWER, () => 1);
        expect((await cache.refresh(EN1, 'speed')).speed).toBe(8);
        expect(cache.choose(EN1, 'speed', 4)).toBeNull();
    });
});
