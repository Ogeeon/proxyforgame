'use strict';

// Tests for the player profile model (profiles-core.js, ADR-0004): reading an
// account export, the game and override layers, re-importing, merging, the
// profile file and the conversion of the old saved sets. The fixture is a
// synthetic export with the structure origin-exporter produces.

const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { load } = require('./load');
const { expect } = require('./expect');

const core = load(['ogame/calc/js/profiles-core.js'], [
    'createProfile', 'createPlanet', 'getProfileValue', 'setProfileValue', 'differsFromGame',
    'resetProfileValue', 'resetProfileToGame', 'countOverrides', 'listOverrides', 'resetOverrides', 'hasGameLayer',
    'parseAccountExport', 'findProfileForExport', 'importAccountExport', 'mergeProfiles',
    'serializeProfilesFile', 'parseProfilesFile', 'planProfilesRestore', 'universeCacheKey',
    'ratesToTrade', 'ratesFromTrade', 'profileFromProductionSet', 'profileFromFlightSet',
    'lfBuildingGameId', 'pfNum', 'pfBool', 'pfBodyLabel', 'expeditionHighTop',
]);

const plain = (value) => JSON.parse(JSON.stringify(value));
const FIXTURE = readFileSync(join(__dirname, '..', 'playwright-tests', 'fixtures', 'account-export-v1.json'), 'utf8');
const EN1 = { country: 'en', number: 1 };

/** Deterministic ids, so a test can name the planet it means. */
function idSource() {
    let n = 0;
    return () => 'id' + (++n);
}

/** The fixture as an object a test may change before parsing. */
function fixture() {
    return JSON.parse(FIXTURE);
}

/** Parse an export object, failing the test when it is refused. */
function parsed(obj) {
    const result = core.parseAccountExport(JSON.stringify(obj));
    if (!result.ok) throw new Error('export refused: ' + result.reason);
    return result.data;
}

function imported(obj = fixture()) {
    return core.importAccountExport(null, parsed(obj), { universe: EN1, newId: idSource() });
}

const planetNamed = (profile, name) => profile.planets.find((p) => p.name === name);

describe('parseAccountExport', () => {
    it('refuses text that is not JSON', () => {
        expect(plain(core.parseAccountExport('{oops'))).toEqual({ ok: false, reason: 'json' });
    });

    it('refuses JSON that is not an account export', () => {
        expect(core.parseAccountExport('{"coords":"1:2:3"}').reason).toBe('shape');
        expect(core.parseAccountExport('[1,2]').reason).toBe('shape');
    });

    it('refuses a schema version it does not know', () => {
        const obj = fixture();
        obj.schemaVersion = 3;
        expect(core.parseAccountExport(JSON.stringify(obj)).reason).toBe('schema');
    });

    it('reads the account values with game ids', () => {
        const data = parsed(fixture());
        expect(data.playerId).toBe(100001);
        expect(data.account.class).toBe(1);
        expect(data.account.allianceClass).toBe(2);
        expect(data.account['officer.geologist']).toBe(true);
        expect(data.account['officer.engineer']).toBe(false);
        expect(data.account['research.122']).toBe(15);
        expect(data.account['species.701.level']).toBe(18);
    });

    // Seen on a real export: a member of a warrior alliance, allianceClassId null.
    it('leaves a null class out instead of reading it as none', () => {
        const obj = fixture();
        obj.allianceClassId = null;
        obj.characterClassId = null;
        const data = parsed(obj);
        expect('allianceClass' in data.account).toBe(false);
        expect('class' in data.account).toBe(false);
    });

    it('keeps a hand-set alliance class through an import that does not know it', () => {
        const first = core.importAccountExport(null, parsed(fixture()), { universe: { country: 'en', number: 1 } }).profile;
        core.setProfileValue(first.account, 'allianceClass', 1);
        const obj = fixture();
        obj.allianceClassId = null;
        const again = core.importAccountExport(first, parsed(obj)).profile;
        expect(again.account.values.allianceClass).toEqual({ override: 1 });
        expect(core.differsFromGame(again.account, 'allianceClass')).toBe(false);
    });

    it('turns the life-form fractions into percentages', () => {
        const a = parsed(fixture()).account;
        expect(a['lf.prod.metal']).toBe(3.02);
        expect(a['lf.prod.energy']).toBe(0.5);
        expect(a['lf.ship.219.speed']).toBe(0.3066);
        expect(a['lf.ship.202.fuel']).toBe(0.06324);
        expect(a['lf.cost.122.cost']).toBe(0.4635);
        expect(a['lf.classBooster.1']).toBe(2.15);
        expect(a['lf.expedition.resources']).toBe(4);
        expect(a['lf.discovery']).toBe(15.605);
    });

    it('reads a bonus type bonusByType dropped as zero, not as missing', () => {
        const a = parsed(fixture()).account;
        expect(a['lf.crawler']).toBe(0);
        expect(a['lf.phalanxRange']).toBe(0);
    });

    describe('the Expedition Resource Booster item', () => {
        // uuids of the 25% and 40% items of the game's shop
        const ITEM_25 = '0049d2538081bea1dc5264a2899a194fe79107f1';
        const ITEM_40 = '3876b353a7f99b28520a82df01cd86c31b4cbfe0';
        /** @param {string} itemUuid @param {?number} [effectEnd] */
        const buff = (itemUuid, effectEnd = null) => ({ rarity: 'common', itemUuid, name: 'x', buffStart: 1, buffEnd: effectEnd, effectStart: 1, effectEnd });

        it('is 0 when no body carries it', () => {
            expect(parsed(fixture()).account['item.expeditionResources']).toBe(0);
        });

        it('reads the percentage of the item by its uuid, not its name', () => {
            const obj = fixture();
            obj.planets['900001'].buffs.push(buff(ITEM_25));
            expect(parsed(obj).account['item.expeditionResources']).toBe(25);
        });

        it('finds the item on a moon and takes the highest of several', () => {
            const obj = fixture();
            obj.planets['900001'].buffs.push(buff(ITEM_25));
            Object.values(obj.moons)[0].buffs = [buff(ITEM_40)];
            expect(parsed(obj).account['item.expeditionResources']).toBe(40);
        });

        it('ignores an item whose effect ended before the export', () => {
            const obj = fixture();
            obj.exportedAt = '2026-10-13T00:00:00.000Z';
            obj.planets['900001'].buffs.push(buff(ITEM_40, Date.parse('2026-10-12T00:00:00Z') / 1000));
            expect(parsed(obj).account['item.expeditionResources']).toBe(0);
        });

        it('ignores items it does not know', () => {
            const obj = fixture();
            obj.planets['900001'].buffs.push(buff('9336b9f29d36e3f69b0619c9523d8bec5e09ab8e'));
            expect(parsed(obj).account['item.expeditionResources']).toBe(0);
        });
    });

    it('has no universe on schema 1', () => {
        expect(parsed(fixture()).universe).toBeNull();
    });

    it('reads the universe block of schema 2', () => {
        const obj = fixture();
        obj.schemaVersion = 2;
        obj.universe = { number: 1, language: 'en', host: 's1-en.ogame.gameforge.com' };
        expect(plain(parsed(obj).universe)).toEqual(EN1);
    });

    it('reads planets and moons, with temperature on planets only', () => {
        const data = parsed(fixture());
        const alpha = data.planets.find((p) => p.name === 'Alpha');
        expect(plain(alpha.coords)).toEqual({ galaxy: 2, system: 148, position: 8 });
        expect(alpha.values['temperature.max']).toBe(41);
        expect(alpha.values['building.22']).toBe(14);
        expect(alpha.values['ship.217']).toBe(300);
        expect(alpha.values['lf.building.11106']).toBe(6);
        expect(alpha.values['lf.race']).toBe(1);
        const moon = data.moons[0];
        expect(moon.planetGameId).toBe(900001);
        expect(moon.values['temperature.max']).toBe(undefined);
        expect(moon.values['building.42']).toBe(5);
    });

    it('gives a planet with no species race 0', () => {
        expect(parsed(fixture()).planets.find((p) => p.name === 'Colony').values['lf.race']).toBe(0);
    });
});

describe('importAccountExport - a new profile', () => {
    it('creates an imported profile named after the player', () => {
        const { profile, summary } = imported();
        expect(summary.created).toBe(true);
        expect(profile.label).toBe('Tester');
        expect(profile.playerId).toBe(100001);
        expect(core.hasGameLayer(profile)).toBe(true);
        expect(plain(summary.planets)).toEqual({ added: 3, updated: 0, removed: 0 });
        expect(plain(summary.moons)).toEqual({ added: 1, updated: 0, removed: 0 });
    });

    it('takes the universe the player picked, unlocked, when the export has none', () => {
        const { profile } = imported();
        expect(plain(profile.universe)).toEqual(EN1);
        expect(profile.universeLocked).toBe(false);
    });

    it('locks a universe that came from the export', () => {
        const obj = fixture();
        obj.schemaVersion = 2;
        obj.universe = { number: 7, language: 'de', host: 's7-de.ogame.gameforge.com' };
        const { profile } = core.importAccountExport(null, parsed(obj), { universe: EN1, newId: idSource() });
        expect(plain(profile.universe)).toEqual({ country: 'de', number: 7 });
        expect(profile.universeLocked).toBe(true);
    });

    it('links the moon to its planet by our own id', () => {
        const { profile } = imported();
        expect(profile.moons[0].planetId).toBe(planetNamed(profile, 'Alpha').id);
    });

    it('sorts the planets by coordinates', () => {
        expect(imported().profile.planets.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Colony']);
    });
});

describe('the two layers', () => {
    it('reads the game value when there is no override', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        expect(core.getProfileValue(alpha, 'building.1')).toBe(30);
    });

    it('returns the fallback for a key neither layer holds', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        expect(core.getProfileValue(alpha, 'production.1', 100)).toBe(100);
    });

    it('puts an edit in the override layer and marks it as different', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        expect(core.setProfileValue(alpha, 'building.1', 40)).toBe(true);
        expect(core.getProfileValue(alpha, 'building.1')).toBe(40);
        expect(core.differsFromGame(alpha, 'building.1')).toBe(true);
    });

    it('drops an override set back to the game value', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        core.setProfileValue(alpha, 'building.1', 40);
        core.setProfileValue(alpha, 'building.1', 30);
        expect(plain(alpha.values['building.1'])).toEqual({ game: 30 });
    });

    it('reports no change for an edit equal to the current value', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        expect(core.setProfileValue(alpha, 'building.1', 30)).toBe(false);
    });

    it('reads the production factors the companion adds to an export', () => {
        const obj = fixture();
        obj.pfgCompanion = { productionFactors: { 900001: { 1: 80, 217: 150, 4: 50 } } };
        const alpha = planetNamed(imported(obj).profile, 'Alpha');
        expect(core.getProfileValue(alpha, 'production.1')).toBe(80);
        expect(core.getProfileValue(alpha, 'production.217')).toBe(150);
        expect(core.getProfileValue(alpha, 'production.4', 100)).toBe(100);
        expect(core.getProfileValue(planetNamed(imported(obj).profile, 'Beta'), 'production.1', 100)).toBe(100);
    });

    it('never marks a value the game never reported', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        core.setProfileValue(alpha, 'production.1', 80);
        expect(core.differsFromGame(alpha, 'production.1')).toBe(false);
    });

    it('resets one value to the game, but never erases a hand-only value', () => {
        const alpha = planetNamed(imported().profile, 'Alpha');
        core.setProfileValue(alpha, 'building.1', 40);
        core.setProfileValue(alpha, 'production.1', 80);
        expect(core.resetProfileValue(alpha, 'building.1')).toBe(true);
        expect(core.getProfileValue(alpha, 'building.1')).toBe(30);
        expect(core.resetProfileValue(alpha, 'production.1')).toBe(false);
        expect(core.getProfileValue(alpha, 'production.1')).toBe(80);
    });

    it('counts and resets every difference in the profile', () => {
        const { profile } = imported();
        core.setProfileValue(profile.account, 'research.122', 20);
        core.setProfileValue(planetNamed(profile, 'Beta'), 'building.2', 30);
        expect(core.countOverrides(profile)).toBe(2);
        expect(core.resetProfileToGame(profile)).toBe(2);
        expect(core.countOverrides(profile)).toBe(0);
    });

    it('lists the differences, account first, with both values', () => {
        const { profile } = imported();
        const beta = planetNamed(profile, 'Beta');
        core.setProfileValue(beta, 'building.2', 30);
        core.setProfileValue(profile.account, 'research.122', 20);
        core.setProfileValue(beta, 'production.1', 80);
        const gamePlasma = profile.account.values['research.122'].game;
        const gameCrystal = beta.values['building.2'].game;
        expect(plain(core.listOverrides(profile))).toEqual([
            { kind: 'account', entityId: null, key: 'research.122', game: gamePlasma, override: 20 },
            { kind: 'planet', entityId: beta.id, key: 'building.2', game: gameCrystal, override: 30 },
        ]);
    });

    it('resets only the chosen differences', () => {
        const { profile } = imported();
        const beta = planetNamed(profile, 'Beta');
        core.setProfileValue(profile.account, 'research.122', 20);
        core.setProfileValue(beta, 'building.2', 30);
        expect(core.resetOverrides(profile, [{ entityId: beta.id, key: 'building.2' }])).toBe(1);
        expect(core.getProfileValue(profile.account, 'research.122')).toBe(20);
        expect(core.differsFromGame(beta, 'building.2')).toBe(false);
    });

    it('stores a copy of an array value, not the caller array', () => {
        const profile = core.createProfile({ label: 'x' });
        const rates = [1, 2, 3];
        core.setProfileValue(profile.account, 'rates', rates);
        rates[0] = 9;
        expect(plain(core.getProfileValue(profile.account, 'rates'))).toEqual([1, 2, 3]);
    });
});

describe('importAccountExport - re-importing', () => {
    it('finds the profile by universe and player id', () => {
        const { profile } = imported();
        const index = [{ id: 'other', universe: EN1, playerId: 5 }, { id: profile.id, universe: EN1, playerId: 100001 }];
        expect(core.findProfileForExport(index, 100001, EN1)).toBe(profile.id);
        expect(core.findProfileForExport(index, 100001, { country: 'de', number: 1 })).toBeNull();
    });

    it('replaces the game layer and clears the overrides the export supplies', () => {
        const first = imported().profile;
        core.setProfileValue(planetNamed(first, 'Alpha'), 'building.1', 40);
        const obj = fixture();
        obj.planets['900001'].buildings['1'] = 31;
        const { profile, summary } = core.importAccountExport(first, parsed(obj), { newId: idSource() });
        expect(summary.created).toBe(false);
        expect(plain(planetNamed(profile, 'Alpha').values['building.1'])).toEqual({ game: 31 });
    });

    it('keeps the overrides of values the export never carries', () => {
        const first = imported().profile;
        core.setProfileValue(planetNamed(first, 'Alpha'), 'production.1', 80);
        core.setProfileValue(first.account, 'rates', [1, 2, 4]);
        const { profile } = core.importAccountExport(first, parsed(fixture()), { newId: idSource() });
        expect(core.getProfileValue(planetNamed(profile, 'Alpha'), 'production.1')).toBe(80);
        expect(plain(core.getProfileValue(profile.account, 'rates'))).toEqual([1, 2, 4]);
    });

    it('does not change the profile it was given', () => {
        const first = imported().profile;
        const before = JSON.stringify(first);
        const obj = fixture();
        obj.researches['122'] = 16;
        core.importAccountExport(first, parsed(obj), { newId: idSource() });
        expect(JSON.stringify(first)).toBe(before);
    });

    it('keeps the planet id across a relocation, matched by game id', () => {
        const first = imported().profile;
        const betaId = planetNamed(first, 'Beta').id;
        const obj = fixture();
        obj.planets['900002'].system = 300;
        const { profile, summary } = core.importAccountExport(first, parsed(obj), { newId: idSource() });
        expect(planetNamed(profile, 'Beta').id).toBe(betaId);
        expect(planetNamed(profile, 'Beta').coords.system).toBe(300);
        expect(summary.planets.updated).toBe(3);
    });

    it('removes a planet missing from the export and reports it', () => {
        const first = imported().profile;
        const obj = fixture();
        delete obj.planets['900003'];
        const { profile, summary } = core.importAccountExport(first, parsed(obj), { newId: idSource() });
        expect(planetNamed(profile, 'Colony')).toBe(undefined);
        expect(plain(summary.planets)).toEqual({ added: 0, updated: 2, removed: 1 });
    });

    it('adopts a hand-entered planet with the same coordinates', () => {
        const manual = core.createProfile({ label: 'mine', id: 'p' });
        const planet = core.createPlanet({ id: 'hand', name: 'Home', coords: { galaxy: 2, system: 148, position: 8 } });
        core.setProfileValue(planet, 'production.1', 90);
        manual.planets.push(planet);
        const { profile, summary } = core.importAccountExport(manual, parsed(fixture()), { universe: EN1, newId: idSource() });
        const alpha = planetNamed(profile, 'Alpha');
        expect(alpha.id).toBe('hand');
        expect(alpha.gameId).toBe(900001);
        expect(core.getProfileValue(alpha, 'production.1')).toBe(90);
        expect(summary.planets.updated).toBe(1);
    });

    it('adopts a hand-entered planet known only by a unique position', () => {
        const manual = core.createProfile({ label: 'mine', id: 'p' });
        manual.planets.push(core.createPlanet({ id: 'hand', name: 'Home', coords: { galaxy: null, system: null, position: 12 } }));
        const { profile } = core.importAccountExport(manual, parsed(fixture()), { universe: EN1, newId: idSource() });
        expect(planetNamed(profile, 'Beta').id).toBe('hand');
        expect(profile.planets).toHaveLength(3);
    });

    it('does not adopt a position-only planet when two exported planets share it', () => {
        const obj = fixture();
        obj.planets['900003'].position = 12;
        const manual = core.createProfile({ label: 'mine', id: 'p' });
        manual.planets.push(core.createPlanet({ id: 'hand', name: 'Home', coords: { galaxy: null, system: null, position: 12 } }));
        const { profile, summary } = core.importAccountExport(manual, parsed(obj), { universe: EN1, newId: idSource() });
        expect(planetNamed(profile, 'Home').gameId).toBeNull();
        expect(plain(summary.planets)).toEqual({ added: 3, updated: 0, removed: 0 });
    });

    it('keeps a hand-entered planet that matches nothing', () => {
        const manual = core.createProfile({ label: 'mine', id: 'p' });
        manual.planets.push(core.createPlanet({ id: 'hand', name: 'Elsewhere', coords: { galaxy: 9, system: 9, position: 9 } }));
        const { profile, summary } = core.importAccountExport(manual, parsed(fixture()), { universe: EN1, newId: idSource() });
        expect(planetNamed(profile, 'Elsewhere').id).toBe('hand');
        expect(summary.planets.removed).toBe(0);
    });

    it('keeps the overrides of exported values when asked to', () => {
        const first = imported().profile;
        core.setProfileValue(planetNamed(first, 'Alpha'), 'building.1', 40);
        const obj = fixture();
        obj.planets['900001'].buildings['1'] = 31;
        const { profile } = core.importAccountExport(first, parsed(obj), { newId: idSource(), keepOverrides: true });
        expect(plain(planetNamed(profile, 'Alpha').values['building.1'])).toEqual({ game: 31, override: 40 });
    });

    it('keeps the universe of an existing profile when the export has none', () => {
        const manual = core.createProfile({ label: 'mine', universe: { country: 'ru', number: 166 } });
        const { profile } = core.importAccountExport(manual, parsed(fixture()), { universe: EN1, newId: idSource() });
        expect(plain(profile.universe)).toEqual({ country: 'ru', number: 166 });
    });
});

describe('mergeProfiles', () => {
    it('keeps the primary values and takes only what it lacks', () => {
        const primary = imported().profile;
        const secondary = core.createProfile({ label: 'old', universe: { country: 'xx', number: 2 } });
        secondary.account.values['research.122'] = { override: 3 };
        secondary.account.values.rates = { override: [1, 2, 4] };
        const merged = core.mergeProfiles(primary, secondary);
        expect(core.getProfileValue(merged.account, 'research.122')).toBe(15);
        expect(plain(core.getProfileValue(merged.account, 'rates'))).toEqual([1, 2, 4]);
        expect(plain(merged.universe)).toEqual(EN1);
        expect(merged.id).toBe(primary.id);
    });

    it('matches a production planet by position and system-less coordinates', () => {
        const primary = imported().profile;
        const secondary = core.createProfile({ label: 'old' });
        const p = core.createPlanet({ id: 's1', name: 'Planet 1', coords: { galaxy: null, system: null, position: 12 } });
        p.values['production.1'] = { override: 70 };
        secondary.planets.push(p);
        const merged = core.mergeProfiles(primary, secondary);
        expect(merged.planets).toHaveLength(3);
        expect(core.getProfileValue(planetNamed(merged, 'Beta'), 'production.1')).toBe(70);
    });

    it('does not match a position two primary planets share', () => {
        const primary = imported().profile;
        primary.planets.push(core.createPlanet({ id: 'p8', name: 'Other', coords: { galaxy: 5, system: 300, position: 8 } }));
        const secondary = core.createProfile({ label: 'old' });
        const p = core.createPlanet({ id: 's1', name: 'Planet 1', coords: { galaxy: null, system: null, position: 8 } });
        p.values['production.1'] = { override: 70 };
        secondary.planets.push(p);
        const merged = core.mergeProfiles(primary, secondary);
        expect(merged.planets).toHaveLength(5);
        expect(core.getProfileValue(planetNamed(merged, 'Alpha'), 'production.1')).toBe(undefined);
        expect(core.getProfileValue(planetNamed(merged, 'Planet 1'), 'production.1')).toBe(70);
    });

    it('does not match a position two secondary planets share', () => {
        const primary = imported().profile;
        const secondary = core.createProfile({ label: 'old' });
        ['s1', 's2'].forEach((id) => {
            const p = core.createPlanet({ id, name: id, coords: { galaxy: null, system: null, position: 12 } });
            p.values['production.1'] = { override: 70 };
            secondary.planets.push(p);
        });
        const merged = core.mergeProfiles(primary, secondary);
        expect(merged.planets).toHaveLength(5);
        expect(core.getProfileValue(planetNamed(merged, 'Beta'), 'production.1')).toBe(undefined);
    });

    it('falls back to a unique name', () => {
        const primary = imported().profile;
        const secondary = core.createProfile({ label: 'old' });
        const p = core.createPlanet({ id: 's1', name: 'alpha', coords: null });
        p.values.energyBooster = { override: 4 };
        secondary.planets.push(p);
        const merged = core.mergeProfiles(primary, secondary);
        expect(core.getProfileValue(planetNamed(merged, 'Alpha'), 'energyBooster')).toBe(4);
    });

    it('adds the planets nothing matches', () => {
        const primary = imported().profile;
        const secondary = core.createProfile({ label: 'old' });
        secondary.planets.push(core.createPlanet({ id: 's1', name: 'Far', coords: { galaxy: 9, system: 1, position: 1 } }));
        expect(core.mergeProfiles(primary, secondary).planets).toHaveLength(4);
    });
});

describe('the profile file', () => {
    it('round-trips the profiles', () => {
        const { profile } = imported();
        const text = core.serializeProfilesFile([profile], '2026-10-11T00:00:00.000Z');
        const result = core.parseProfilesFile(text);
        expect(result.ok).toBe(true);
        expect(plain(result.profiles)).toEqual(plain([profile]));
    });

    it('carries the universe settings the player picked', () => {
        const universes = [{ universe: { country: 'en', number: 270 }, overrides: { speed: 7, deuteriumInDebris: false } }];
        const text = core.serializeProfilesFile([], '2026-10-12T00:00:00.000Z', universes);
        expect(plain(core.parseProfilesFile(text).universes)).toEqual(universes);
    });

    it('reads a file written before the universe settings were kept', () => {
        const result = core.parseProfilesFile('{"pfgProfiles":1,"profiles":[]}');
        expect(result.ok).toBe(true);
        expect(plain(result.universes)).toEqual([]);
    });

    it('drops a broken universe entry, not the file', () => {
        const text = JSON.stringify({
            pfgProfiles: 1, profiles: [], universes: [
                { universe: { country: 'en.evil', number: 1 }, overrides: { speed: 7 } },
                { universe: { country: 'de', number: 0 }, overrides: { speed: 7 } },
                { universe: { country: 'de', number: 1 }, overrides: { speed: 'fast' } },
                { universe: { country: 'ru', number: 2 }, overrides: { speed: 3, note: 'x' } },
                'nope',
            ],
        });
        const result = core.parseProfilesFile(text);
        expect(result.ok).toBe(true);
        expect(plain(result.universes)).toEqual([{ universe: { country: 'ru', number: 2 }, overrides: { speed: 3 } }]);
    });

    it('names the universe cache entry', () => {
        expect(core.universeCacheKey({ country: 'en', number: 270 })).toBe('pfg_universe_en_270');
    });

    it('refuses a file of an unknown version', () => {
        expect(core.parseProfilesFile('{"pfgProfiles":2,"profiles":[]}').reason).toBe('version');
    });

    it('refuses a file that is not a profile file', () => {
        expect(core.parseProfilesFile(FIXTURE).reason).toBe('shape');
        expect(core.parseProfilesFile('nope').reason).toBe('json');
    });

    it('tells new profiles from colliding ones', () => {
        const a = core.createProfile({ label: 'a', id: 'a' });
        const b = core.createProfile({ label: 'b', id: 'b' });
        const plan = core.planProfilesRestore(['a'], [a, b]);
        expect(plan.added.map((p) => p.id)).toEqual(['b']);
        expect(plan.conflicts.map((p) => p.id)).toEqual(['a']);
    });
});

describe('exchange rates', () => {
    it('converts to trade per-deuterium rates and back', () => {
        expect(plain(core.ratesToTrade([1, 1.5, 3]))).toEqual({ md: 3, cd: 2 });
        expect(plain(core.ratesFromTrade({ md: 3, cd: 2 }))).toEqual([1, 1.5, 3]);
    });
});

describe('saved sets', () => {
    function productionSet() {
        const planet = [41, 8, 2];
        const rows = [[30, 100, 1], [26, 90, 0], [28, 80, 2], [25, 100, 0], [12, 70, 0], [250, 100, 0], [300, 150, 0]];
        rows.forEach(([level, pct, boost], i) => { planet[(i + 1) * 3] = level; planet[(i + 1) * 3 + 1] = pct; planet[(i + 1) * 3 + 2] = boost; });
        planet[24] = 1;
        for (let k = 0; k < 12; k++) planet[25 + k] = k + 1;
        return {
            energyTechLevel: 14, plasmaTechLevel: 15, geologist: true, engineer: false, technocrat: false,
            admiral: false, commander: true, playerClass: 0, isTrader: true,
            lfMetProdBonus: 3.02, lfCrysProdBonus: 1.51, lfDeutProdBonus: 2.07, lfEnergyProdBonus: 0.5,
            lfCollectorBonus: 2.15, lfCrawlerBonus: 1, lfPlasmaCostReduction: 0.46,
            rates: [3, 2, 1], ratesFmt: 1,
            currPlanetsCount: 1, aPS: [planet], aPNames: ['Home'],
        };
    }

    it('turns a production set into a manual profile with its planets', () => {
        const profile = core.profileFromProductionSet(productionSet(), { label: 'main', newId: idSource() });
        expect(core.hasGameLayer(profile)).toBe(false);
        expect(core.getProfileValue(profile.account, 'class')).toBe(1);
        expect(core.getProfileValue(profile.account, 'allianceClass')).toBe(2);
        expect(core.getProfileValue(profile.account, 'research.122')).toBe(15);
        expect(core.getProfileValue(profile.account, 'officer.commander')).toBe(true);
        expect(plain(core.getProfileValue(profile.account, 'rates'))).toEqual([1, 1.5, 3]);
        const home = profile.planets[0];
        expect(home.name).toBe('Home');
        expect(plain(home.coords)).toEqual({ galaxy: null, system: null, position: 8 });
        expect(core.getProfileValue(home, 'temperature.max')).toBe(41);
        expect(core.getProfileValue(home, 'building.2')).toBe(26);
        expect(core.getProfileValue(home, 'production.2')).toBe(90);
        expect(core.getProfileValue(home, 'booster.3')).toBe(2);
        expect(core.getProfileValue(home, 'ship.212')).toBe(250);
        expect(core.getProfileValue(home, 'ship.217')).toBe(300);
        expect(core.getProfileValue(home, 'production.217')).toBe(150);
        expect(core.getProfileValue(home, 'energyBooster')).toBe(2);
        expect(core.getProfileValue(home, 'lf.race')).toBe(1);
        expect(core.getProfileValue(home, 'lf.building.11106')).toBe(6);
    });

    it('keeps rates already stored in metal units', () => {
        const set = productionSet();
        set.rates = [1, 2, 4];
        set.ratesFmt = 2;
        const profile = core.profileFromProductionSet(set, { label: 'x' });
        expect(plain(core.getProfileValue(profile.account, 'rates'))).toEqual([1, 2, 4]);
    });

    it('turns a flight set into a manual profile with its universe and account data', () => {
        const ships = Array.from({ length: 15 }, () => [0, 0, 0]);
        ships[14] = [0.3, 0.1, 0.06];
        const profile = core.profileFromFlightSet({
            country: 'ru', universe: 166, driveLevels: [16, 12, 9], hyperTechLvl: 8, playerClass: 1,
            traderBonus: false, warriorBonus: true, lfMechanGE: 4, lfRocktalCE: 0, lfShipsBonuses: ships,
            departure: [1, 2, 3],
        }, { label: 'fleet' });
        expect(plain(profile.universe)).toEqual({ country: 'ru', number: 166 });
        expect(profile.universeLocked).toBe(false);
        expect(core.getProfileValue(profile.account, 'research.117')).toBe(12);
        expect(core.getProfileValue(profile.account, 'research.114')).toBe(8);
        expect(core.getProfileValue(profile.account, 'class')).toBe(2);
        expect(core.getProfileValue(profile.account, 'allianceClass')).toBe(1);
        expect(core.getProfileValue(profile.account, 'lf.classBooster.2')).toBe(4);
        expect(core.getProfileValue(profile.account, 'lf.ship.219.speed')).toBe(0.3);
        expect(core.getProfileValue(profile.account, 'lf.ship.219.fuel')).toBe(0.06);
        expect(profile.planets).toHaveLength(0);
    });

    it('leaves the universe empty for a flight set with no country', () => {
        const profile = core.profileFromFlightSet({ country: '--', universe: 101 }, { label: 'x' });
        expect(profile.universe).toBeNull();
    });

    it('numbers life-form buildings the way the game does', () => {
        expect(core.lfBuildingGameId(4, 12)).toBe(14112);
    });
});

describe('the helpers the calculators share', () => {
    it('reads a stored number, and 0 for anything else', () => {
        expect(core.pfNum('12')).toBe(12);
        expect(core.pfNum(3.5)).toBe(3.5);
        expect(core.pfNum(undefined)).toBe(0);
        expect(core.pfNum('abc')).toBe(0);
    });

    it('reads a stored flag, which may be the string "true"', () => {
        expect(core.pfBool(true)).toBe(true);
        expect(core.pfBool('true')).toBe(true);
        expect(core.pfBool('false')).toBe(false);
        expect(core.pfBool(1)).toBe(false);
    });

    it('labels a body with its name and known coordinates', () => {
        expect(core.pfBodyLabel({ name: 'Home', coords: { galaxy: 1, system: 2, position: 3 } })).toBe('Home [1:2:3]');
        expect(core.pfBodyLabel({ name: 'Home', coords: { galaxy: null, system: null, position: 3 } })).toBe('Home');
        expect(core.pfBodyLabel({ name: '', coords: null })).toBe('—');
        expect(core.pfBodyLabel({ name: '', coords: null }, '')).toBe('');
    });
});

// expeditions.php picks the "strongest player" entry with its own $thresholds
// (10000, 100000, 1000000, ...: the limits the option labels show, the first
// one the floored score does not exceed); the profile's universe has to pick
// the same one.
describe('expeditionHighTop', () => {
    it('takes the first entry whose limit the score does not exceed', () => {
        expect(core.expeditionHighTop(0)).toBe(40000);
        expect(core.expeditionHighTop(10000)).toBe(40000);
        expect(core.expeditionHighTop(10001)).toBe(500000);
        expect(core.expeditionHighTop(100000)).toBe(500000);
        expect(core.expeditionHighTop(100001)).toBe(1200000);
        expect(core.expeditionHighTop(1000000)).toBe(1200000);
        expect(core.expeditionHighTop(1000001)).toBe(1800000);
        expect(core.expeditionHighTop(5000000)).toBe(1800000);
        expect(core.expeditionHighTop(20000000)).toBe(2400000);
        expect(core.expeditionHighTop(100000000)).toBe(4200000);
    });

    it('takes the last entry beyond every limit', () => {
        expect(core.expeditionHighTop(100000001)).toBe(5000000);
        expect(core.expeditionHighTop(9e15)).toBe(5000000);
    });

    it('reads the score as the XML gives it: a string, floored like PHP does', () => {
        expect(core.expeditionHighTop('10000')).toBe(40000);
        expect(core.expeditionHighTop('10000.9')).toBe(40000);
        expect(core.expeditionHighTop('10001.1')).toBe(500000);
    });

    it('has no entry for what is not a number', () => {
        expect(core.expeditionHighTop('')).toBe(null);
        expect(core.expeditionHighTop(null)).toBe(null);
        expect(core.expeditionHighTop(undefined)).toBe(null);
        expect(core.expeditionHighTop('abc')).toBe(null);
        expect(core.expeditionHighTop(Number.POSITIVE_INFINITY)).toBe(null);
    });
});
