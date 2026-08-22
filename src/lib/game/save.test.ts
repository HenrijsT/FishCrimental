import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { SAVE_KEY, SAVE_VERSION, SOURCE_ORDER } from './config';
import { ALL_SPECIES, createInitialState } from './engine';
import {
	clearStorage,
	deserialize,
	exportSave,
	fromRaw,
	importSave,
	loadFromStorage,
	migrate,
	saveToStorage,
	serialize
} from './save';
import type { GameState } from './types';

function populated(): GameState {
	const state = createInitialState();
	state.coins = D('1.2345e42');
	state.lifetimeCoins = D('9.87e60');
	state.allTimeCoins = D('1e1e10');
	state.hold[FishType.Shark] = D('4.5e12');
	state.holdValue = D('6.78e15');
	state.dex[ALL_SPECIES[0].name] = D(137);
	state.dex[ALL_SPECIES[5].name] = D('1e30');
	state.totalCasts = D(9421);
	state.totalFish = D('3.3e9');
	state.unlocked[FishingSources.Stream] = true;
	state.unlocked[FishingSources.River] = true;
	state.activeSource = FishingSources.River;
	state.upgrades.rod = D(17);
	state.upgrades.market = D(9);
	state.deckhands[FishingSources.Stream] = D(58);
	state.pearls = D(412);
	state.allTimePearls = D(1290);
	state.prestigeUpgrades.pearl_yield = D(4);
	state.prestigeCount = D(6);
	state.achievements = ['first_cast', 'reach_sea'];
	state.completed = true;
	state.playTime = 12345.6;
	state.settings.reduceMotion = true;
	return state;
}

describe('serialise / deserialise', () => {
	it('round-trips every field exactly', () => {
		const original = populated();
		const restored = deserialize(serialize(original));

		expect(restored).not.toBeNull();
		const loaded = restored!;

		expect(loaded.coins.toJSON()).toBe(original.coins.toJSON());
		expect(loaded.lifetimeCoins.toJSON()).toBe(original.lifetimeCoins.toJSON());
		expect(loaded.allTimeCoins.toJSON()).toBe(original.allTimeCoins.toJSON());
		expect(loaded.hold[FishType.Shark].toJSON()).toBe(original.hold[FishType.Shark].toJSON());
		expect(loaded.holdValue.toJSON()).toBe(original.holdValue.toJSON());
		expect(loaded.dex[ALL_SPECIES[5].name].toJSON()).toBe(
			original.dex[ALL_SPECIES[5].name].toJSON()
		);
		expect(loaded.totalCasts.eq(original.totalCasts)).toBe(true);
		expect(loaded.activeSource).toBe(FishingSources.River);
		expect(loaded.upgrades.rod.eq(17)).toBe(true);
		expect(loaded.deckhands[FishingSources.Stream].eq(58)).toBe(true);
		expect(loaded.pearls.eq(412)).toBe(true);
		expect(loaded.prestigeUpgrades.pearl_yield.eq(4)).toBe(true);
		expect(loaded.achievements).toEqual(original.achievements);
		expect(loaded.completed).toBe(true);
		expect(loaded.playTime).toBeCloseTo(12345.6, 6);
		expect(loaded.settings.reduceMotion).toBe(true);
		expect(loaded.version).toBe(SAVE_VERSION);
	});

	it('survives a full round-trip twice without drift', () => {
		const once = deserialize(serialize(populated()))!;
		const twice = deserialize(serialize(once))!;
		expect(serialize(twice)).toBe(serialize(once));
	});

	it('rejects json that is not an object', () => {
		expect(deserialize('null')).toBeNull();
		expect(deserialize('[]')).toBeNull();
		expect(deserialize('7')).toBeNull();
		expect(deserialize('not json at all')).toBeNull();
	});
});

describe('hostile input', () => {
	it('falls back rather than trusting a poisoned Decimal string', () => {
		const loaded = fromRaw({
			version: SAVE_VERSION,
			coins: 'banana',
			lifetimeCoins: '1e',
			holdValue: { evil: true },
			totalCasts: [],
			pearls: 'Infinity'
		});

		expect(loaded.coins.eq(0)).toBe(true);
		expect(loaded.lifetimeCoins.eq(0)).toBe(true);
		expect(loaded.holdValue.eq(0)).toBe(true);
		expect(loaded.totalCasts.eq(0)).toBe(true);
		expect(loaded.pearls.eq(0)).toBe(true);
	});

	it('drops species that are not in the catalogue', () => {
		const loaded = fromRaw({
			version: SAVE_VERSION,
			dex: { [ALL_SPECIES[0].name]: '5', Kraken: '1e100', __proto__: 'nope' }
		});

		expect(loaded.dex[ALL_SPECIES[0].name].eq(5)).toBe(true);
		expect(loaded.dex.Kraken).toBeUndefined();
	});

	it('keeps the Pond open even if the save says otherwise', () => {
		const loaded = fromRaw({ version: SAVE_VERSION, unlocked: { Pond: false } });
		expect(loaded.unlocked[SOURCE_ORDER[0]]).toBe(true);
	});

	it('refuses to make a locked source active', () => {
		const loaded = fromRaw({ version: SAVE_VERSION, activeSource: FishingSources.Ocean });
		expect(loaded.activeSource).toBe(SOURCE_ORDER[0]);
	});

	it('ignores nonsense in the achievement list', () => {
		const loaded = fromRaw({ version: SAVE_VERSION, achievements: ['ok', 5, null, { a: 1 }] });
		expect(loaded.achievements).toEqual(['ok']);
	});

	it('never produces negative levels', () => {
		const loaded = fromRaw({
			version: SAVE_VERSION,
			upgrades: { rod: '-50' },
			deckhands: { Pond: '-9' },
			playTime: -100
		});
		expect(loaded.upgrades.rod.eq(0)).toBe(true);
		expect(loaded.deckhands[SOURCE_ORDER[0]].eq(0)).toBe(true);
		expect(loaded.playTime).toBe(0);
	});

	it('loads a completely empty object into a playable game', () => {
		const loaded = fromRaw({});
		expect(loaded.unlocked[SOURCE_ORDER[0]]).toBe(true);
		expect(loaded.coins.eq(0)).toBe(true);
		expect(loaded.version).toBe(SAVE_VERSION);
	});
});

describe('migrations', () => {
	it('lifts a version-less save to the current version', () => {
		const migrated = migrate({ coins: '500' });
		expect(migrated.version).toBe(SAVE_VERSION);
		expect(migrated.dex).toEqual({});
	});

	it('leaves a current-version save alone', () => {
		const input = { version: SAVE_VERSION, coins: '500' };
		expect(migrate({ ...input })).toEqual(input);
	});

	it('loads a pre-versioning save end to end', () => {
		const loaded = fromRaw({ coins: '1e9', upgrades: { rod: '3' } });
		expect(loaded.version).toBe(SAVE_VERSION);
		expect(loaded.coins.eq(1e9)).toBe(true);
		expect(loaded.upgrades.rod.eq(3)).toBe(true);
	});
});

describe('export / import blob', () => {
	it('round-trips through the text blob', () => {
		const original = populated();
		const blob = exportSave(original);

		expect(blob.startsWith(`FISHC${SAVE_VERSION}.`)).toBe(true);
		expect(blob).not.toContain('\n');

		const imported = importSave(blob);
		expect(imported).not.toBeNull();
		expect(imported!.coins.toJSON()).toBe(original.coins.toJSON());
		expect(imported!.pearls.eq(412)).toBe(true);
	});

	it('tolerates surrounding whitespace', () => {
		const blob = exportSave(populated());
		expect(importSave(`\n  ${blob}  \n`)).not.toBeNull();
	});

	it('rejects anything that is not one of our blobs', () => {
		expect(importSave('')).toBeNull();
		expect(importSave('hello')).toBeNull();
		expect(importSave('FISHC1.not-base64!!')).toBeNull();
		expect(importSave('FISHC1')).toBeNull();
		expect(importSave('NOPE1.aGVsbG8=')).toBeNull();
	});
});

describe('localStorage', () => {
	beforeEach(() => {
		const data = new Map<string, string>();
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => data.get(key) ?? null,
				setItem: (key: string, value: string) => void data.set(key, value),
				removeItem: (key: string) => void data.delete(key),
				clear: () => data.clear(),
				key: () => null,
				length: 0
			}
		});
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'localStorage');
	});

	it('saves and loads under the expected key', () => {
		const original = populated();
		expect(saveToStorage(original)).toBe(true);
		expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();

		const loaded = loadFromStorage();
		expect(loaded.kind).toBe('loaded');
		if (loaded.kind !== 'loaded') return;
		expect(loaded.state.coins.toJSON()).toBe(original.coins.toJSON());
	});

	it('reports an empty slot rather than failing', () => {
		clearStorage();
		expect(loadFromStorage().kind).toBe('empty');
	});

	it('reports a corrupt blob rather than throwing', () => {
		localStorage.setItem(SAVE_KEY, '{{{');
		expect(loadFromStorage().kind).toBe('corrupt');
	});

	it('refuses a save written by a newer build instead of truncating it', () => {
		const original = populated();
		const raw = JSON.parse(serialize(original));
		raw.version = SAVE_VERSION + 3;
		raw.somethingThisBuildHasNeverHeardOf = 42;
		localStorage.setItem(SAVE_KEY, JSON.stringify(raw));

		const loaded = loadFromStorage();
		expect(loaded.kind).toBe('future');
		if (loaded.kind !== 'future') return;
		expect(loaded.version).toBe(SAVE_VERSION + 3);

		// And the file on disk is untouched.
		expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).somethingThisBuildHasNeverHeardOf).toBe(42);
	});
});
