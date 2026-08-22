import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FISH_TYPES } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { SOURCE_CONFIG, SOURCE_ORDER } from './config';
import {
	accumulate,
	buyDeckhand,
	buyUpgrade,
	canUnlock,
	clearCatchTableCache,
	computeModifiers,
	createInitialState,
	holdCount,
	nextLockedSource,
	performCast,
	sellHold,
	totalIncomePerSecond,
	unlockSource
} from './engine';

/** cast → hold → sell → spend → unlock, the loop the player actually plays. */
describe('the core loop', () => {
	it('starts with the Pond open and nothing else', () => {
		const state = createInitialState();
		expect(state.unlocked[FishingSources.Pond]).toBe(true);
		for (const source of SOURCE_ORDER.slice(1)) {
			expect(state.unlocked[source]).toBe(false);
		}
		expect(state.activeSource).toBe(FishingSources.Pond);
		expect(state.coins.eq(0)).toBe(true);
	});

	it('turns casts into coins and coins into the next source', () => {
		clearCatchTableCache();
		const state = createInitialState();
		let roll = 0;
		const rng = () => ((roll = (roll + 0.37) % 1), roll);

		// Fish the Pond until the Stream is affordable.
		for (let cast = 0; cast < 4000; cast++) {
			performCast(state, FishingSources.Pond, computeModifiers(state), rng);
			if (cast % 25 === 0) sellHold(state, computeModifiers(state));
			if (state.coins.gte(SOURCE_CONFIG[FishingSources.Stream].unlockCost)) break;
		}
		sellHold(state, computeModifiers(state));

		expect(state.totalCasts.gt(0)).toBe(true);
		expect(state.coins.gte(SOURCE_CONFIG[FishingSources.Stream].unlockCost)).toBe(true);
		expect(holdCount(state).eq(0)).toBe(true);

		expect(nextLockedSource(state)).toBe(FishingSources.Stream);
		expect(canUnlock(state, FishingSources.Stream)).toBe(true);
		expect(unlockSource(state, FishingSources.Stream)).toBe(true);
		expect(state.activeSource).toBe(FishingSources.Stream);
	});

	it('pays better per cast in deeper water', () => {
		clearCatchTableCache();
		const shallow = createInitialState();
		const deep = createInitialState();
		deep.unlocked[FishingSources.Ocean] = true;

		const rng = () => 0.5;
		for (let i = 0; i < 50; i++) {
			performCast(shallow, FishingSources.Pond, computeModifiers(shallow), rng);
			performCast(deep, FishingSources.Ocean, computeModifiers(deep), rng);
		}

		expect(deep.holdValue.div(shallow.holdValue).toNumber()).toBeGreaterThan(100);
	});

	it('has no crew income until a deckhand is hired', () => {
		const state = createInitialState();
		expect(totalIncomePerSecond(state, computeModifiers(state)).eq(0)).toBe(true);

		state.coins = D(1e6);
		expect(buyDeckhand(state, FishingSources.Pond, 3).eq(3)).toBe(true);
		expect(totalIncomePerSecond(state, computeModifiers(state)).gt(0)).toBe(true);
	});

	it('keeps the hold and its coin value in step', () => {
		clearCatchTableCache();
		const state = createInitialState();
		state.coins = D(1e7);
		buyDeckhand(state, FishingSources.Pond, 4);

		accumulate(state, computeModifiers(state), 300);

		const counted = FISH_TYPES.reduce((sum, type) => sum.plus(state.hold[type]), D(0));
		expect(counted.eq(holdCount(state))).toBe(true);
		expect(counted.gt(0)).toBe(true);
		expect(state.holdValue.gt(0)).toBe(true);

		const modifiers = computeModifiers(state);
		const expected = state.holdValue.times(modifiers.sellMultiplier);
		expect(sellHold(state, modifiers).eq(expected)).toBe(true);
	});

	it('makes upgrades measurably improve income', () => {
		clearCatchTableCache();
		const state = createInitialState();
		state.coins = D(1e12);
		buyDeckhand(state, FishingSources.Pond, 5);

		const before = totalIncomePerSecond(state, computeModifiers(state));
		buyUpgrade(state, 'net', 5);
		buyUpgrade(state, 'market', 5);
		buyUpgrade(state, 'rod', 5);
		const after = totalIncomePerSecond(state, computeModifiers(state));

		expect(after.div(before).toNumber()).toBeGreaterThan(3);
	});
});
