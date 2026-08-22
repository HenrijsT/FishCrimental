import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { describePerCast, formatDuration, formatNumber } from '$lib/format';
import { FishingSources } from '$lib/fishing_sources';
import { BOAT_UPGRADE_IDS, LICENCE_IDS, SAVE_VERSION, SOURCE_ORDER, UPGRADE_IDS } from './config';
import {
	accumulate,
	buyBoatUpgrade,
	buyDeckhand,
	buyFuel,
	buyUpgrade,
	computeModifiers,
	createInitialState,
	performCast,
	performPrestige,
	reachableSource,
	repairBoat,
	sellHold,
	sourceBlocker,
	unlockSource
} from './engine';
import { exportSave, fromRaw, importSave, serialize } from './save';

/** Round-two final pass: everything hostile, against the finished game. */

const HOSTILE: Record<string, unknown>[] = [
	{},
	{ version: SAVE_VERSION, licences: 'yes' },
	{ version: SAVE_VERSION, licences: { inland: 'true', nonsense: true } },
	{ version: SAVE_VERSION, boat: 'a boat' },
	{ version: SAVE_VERSION, boat: { owned: 'yes', fuel: 'banana', condition: 'fine', upgrades: 3 } },
	{
		version: SAVE_VERSION,
		boat: { owned: true, fuel: '1e400', condition: 1e9, upgrades: { tank: '1e30' } }
	},
	{ version: SAVE_VERSION, carry: { a: 1, b: -0.5, c: 0.5, d: 'x' } },
	{ version: 1, hold: { Small: '9.9' } },
	{
		version: 2,
		unlocked: {
			Pond: true,
			Stream: true,
			River: true,
			Lake: true,
			Lagoon: true,
			Sea: true,
			Offshore: true,
			Ocean: true
		}
	}
];

describe('every hostile save still yields a playable game', () => {
	it.each(HOSTILE.map((raw, i) => [i, raw] as const))('case %i', (_index, raw) => {
		const state = fromRaw({ ...raw });
		const modifiers = computeModifiers(state);

		for (const source of SOURCE_ORDER) {
			expect(Number.isFinite(modifiers.castSeconds[source])).toBe(true);
			expect(modifiers.castSeconds[source]).toBeGreaterThan(0);
		}
		expect(Number.isFinite(modifiers.boatEfficiency)).toBe(true);
		expect(modifiers.fuelPerCast.isFinite()).toBe(true);
		expect(modifiers.fuelCapacity.isFinite()).toBe(true);
		expect(state.coins.gte(0)).toBe(true);
		for (const value of Object.values(state.carry)) {
			expect(value).toBeGreaterThan(0);
			expect(value).toBeLessThan(1);
		}

		// And it can actually be played.
		accumulate(state, modifiers, 3600);
		performCast(state, state.activeSource, modifiers);
		expect(sellHold(state, modifiers).gte(0)).toBe(true);
		expect(sourceBlocker(state, state.activeSource, modifiers)).toBeNull();
	});
});

describe('spamming every action in every order', () => {
	it('never produces a negative, a NaN or an out-of-range dial', () => {
		const state = createInitialState();
		state.coins = D('1e24');
		for (const id of LICENCE_IDS) state.licences[id] = true;
		const modifiers = () => computeModifiers(state);

		for (let round = 0; round < 150; round++) {
			for (const id of UPGRADE_IDS) buyUpgrade(state, id, 1);
			for (const source of SOURCE_ORDER) buyDeckhand(state, source, 1);
			for (const id of BOAT_UPGRADE_IDS) buyBoatUpgrade(state, id);
			for (const source of SOURCE_ORDER) unlockSource(state, source);
			buyFuel(state, modifiers());
			repairBoat(state);
			sellHold(state, modifiers());
			performCast(state, state.activeSource, modifiers());
			accumulate(state, modifiers(), 1);
		}

		expect(state.coins.gte(0)).toBe(true);
		expect(state.boat.fuel.gte(0)).toBe(true);
		expect(state.boat.condition).toBeGreaterThanOrEqual(0);
		expect(state.boat.condition).toBeLessThanOrEqual(100);
		expect(Number.isFinite(state.boat.condition)).toBe(true);
		expect(Object.values(state.carry).every((v) => v > 0 && v < 1)).toBe(true);
		expect(SOURCE_ORDER.filter((s) => state.unlocked[s]).length).toBeGreaterThan(1);
	});
});

describe('prestige at every boundary', () => {
	function ready(lifetime: string) {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.lifetimeCoins = D(lifetime);
		return state;
	}

	it('refuses one coin under and accepts exactly at', () => {
		expect(performPrestige(ready('999999999999999'))).toBeNull();
		expect(performPrestige(ready('1000000000000000'))?.gained.eq(1)).toBe(true);
	});

	it('handles layered lifetimes without breaking', () => {
		const state = ready('ee20');
		const result = performPrestige(state);
		expect(result).not.toBeNull();
		expect(result!.gained.isFinite()).toBe(true);
		expect(formatNumber(result!.gained)).not.toContain('NaN');
		expect(sourceBlocker(state, state.activeSource, computeModifiers(state))).toBeNull();
	});
});

describe('the clock', () => {
	it('going backwards earns nothing rather than owing something', () => {
		const state = createInitialState();
		state.deckhands[FishingSources.Pond] = D(20);
		expect(accumulate(state, computeModifiers(state), -99999).fish.eq(0)).toBe(true);
		expect(accumulate(state, computeModifiers(state), 0).fish.eq(0)).toBe(true);
	});

	it('jumping a decade forward is finite and integral', () => {
		const state = createInitialState();
		state.deckhands[FishingSources.Pond] = D(20);
		const result = accumulate(state, computeModifiers(state), 10 * 365 * 24 * 3600);
		expect(result.fish.isFinite()).toBe(true);
		expect(result.fish.eq(result.fish.floor())).toBe(true);
	});
});

describe('formatters across ninety orders of magnitude at a time', () => {
	it('never render NaN, undefined or Infinity', () => {
		let value = D(1);
		for (let i = 0; i < 90; i++) {
			for (const text of [
				formatNumber(value),
				describePerCast(value),
				formatDuration(value.toNumber())
			]) {
				expect(text, `at ${value.toString().slice(0, 24)}`).not.toMatch(/NaN|undefined|Infinity/);
			}
			value = value.times(D(10).pow(9));
		}
	});
});

describe('the export blob', () => {
	function populated() {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.fuel = D('12345.6');
		state.boat.condition = 33.3;
		state.coins = D('1e120');
		return state;
	}

	it('round-trips the whole harbour', () => {
		const original = populated();
		const restored = importSave(exportSave(original));

		expect(restored).not.toBeNull();
		expect(restored!.coins.eq('1e120')).toBe(true);
		expect(restored!.boat.fuel.eq('12345.6')).toBe(true);
		expect(restored!.boat.condition).toBeCloseTo(33.3, 6);
		expect(restored!.licences.deep).toBe(true);
	});

	it('refuses every mutation of itself', () => {
		const blob = exportSave(populated());
		expect(importSave(blob)).not.toBeNull();
		expect(importSave(` ${blob} `)).not.toBeNull();
		expect(importSave(blob.replace('FISHC', 'FISHX'))).toBeNull();
		expect(importSave(blob.slice(0, -4))).toBeNull();
		expect(importSave(blob.slice(0, 6) + 'ZZZZ' + blob.slice(10))).toBeNull();
		expect(importSave('')).toBeNull();
	});
});

describe('a stranded, broke, wrecked player', () => {
	it('keeps earning and can always buy their way back out', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.fuel = D(0);
		state.boat.condition = 0;
		state.coins = D(0);
		state.activeSource = FishingSources.Ocean;
		state.deckhands[FishingSources.Sea] = D(1);

		const modifiers = computeModifiers(state);
		expect(sourceBlocker(state, FishingSources.Ocean, modifiers)).toBe('fuel');
		expect(reachableSource(state, modifiers)).toBe(FishingSources.Sea);

		accumulate(state, computeModifiers(state), 8 * 3600);
		sellHold(state, computeModifiers(state));
		expect(state.coins.gt(0)).toBe(true);

		buyFuel(state, computeModifiers(state));
		repairBoat(state);
		expect(sourceBlocker(state, FishingSources.Ocean, computeModifiers(state))).toBeNull();
	});
});

describe('save stability', () => {
	it('does not drift over ten serialise/load cycles', () => {
		let state = createInitialState();
		state.coins = D('1e77');
		state.boat.owned = true;
		state.boat.fuel = D('987.654');
		state.boat.condition = 71.25;
		state.carry['Pond#fish'] = 0.375;

		let text = serialize(state);
		const first = serialize(fromRaw(JSON.parse(text)));

		for (let i = 0; i < 10; i++) {
			state = fromRaw(JSON.parse(text));
			text = serialize(state);
		}

		expect(text).toBe(first);
		expect(state.coins.eq('1e77')).toBe(true);
		expect(state.carry['Pond#fish']).toBe(0.375);
	});
});
