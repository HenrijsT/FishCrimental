import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { OFFLINE_EFFICIENCY, SOURCE_ORDER, UPGRADES } from './config';
import { simulateRun } from './balance';
import {
	accumulate,
	buyUpgrade,
	catchTable,
	clearCatchTableCache,
	computeModifiers,
	createInitialState,
	performCast,
	sourceIncomePerSecond,
	totalIncomePerSecond
} from './engine';

describe('deckhands', () => {
	it('do nothing until one is hired', () => {
		const state = createInitialState();
		const modifiers = computeModifiers(state);

		expect(totalIncomePerSecond(state, modifiers).eq(0)).toBe(true);
		expect(accumulate(state, modifiers, 8 * 3600).fish.eq(0)).toBe(true);
	});

	it('work every unlocked source at once', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Stream] = true;
		state.licences.inland = true;
		state.deckhands[SOURCE_ORDER[0]] = D(3);
		state.deckhands[FishingSources.Stream] = D(3);

		const modifiers = computeModifiers(state);
		const pond = sourceIncomePerSecond(state, modifiers, SOURCE_ORDER[0]);
		const stream = sourceIncomePerSecond(state, modifiers, FishingSources.Stream);

		expect(pond.gt(0)).toBe(true);
		expect(stream.gt(pond)).toBe(true);
		expect(totalIncomePerSecond(state, modifiers).eq(pond.plus(stream))).toBe(true);
	});

	it('get better with Crew Quarters', () => {
		const state = createInitialState();
		// Six levels of Crew Quarters is more than the mud pool's shopkeeper
		// stocks, and this is about the multiplier, not about the shopkeeper.
		for (const source of SOURCE_ORDER) {
			state.unlocked[source] = true;
			if (source === FishingSources.River) break;
		}
		state.deckhands[SOURCE_ORDER[0]] = D(5);
		const before = totalIncomePerSecond(state, computeModifiers(state));

		state.coins = D(1e12);
		buyUpgrade(state, 'crew', 6);
		const after = totalIncomePerSecond(state, computeModifiers(state));

		expect(after.div(before).toNumber()).toBeCloseTo(Math.pow(UPGRADES.crew.effect, 6), 4);
	});

	it('also speed up from the rod, since they cast the same line', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(5);
		const before = totalIncomePerSecond(state, computeModifiers(state));

		state.coins = D(1e12);
		buyUpgrade(state, 'rod', 8);
		expect(totalIncomePerSecond(state, computeModifiers(state)).gt(before)).toBe(true);
	});

	it('earn less per second offline than watched', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(9);
		const modifiers = computeModifiers(state);

		// Long windows so whole-fish quantisation averages out.
		const online = accumulate(createStateWithCrew(), modifiers, 200_000, 1);
		const offline = accumulate(createStateWithCrew(), modifiers, 200_000, OFFLINE_EFFICIENCY);

		expect(offline.value.div(online.value).toNumber()).toBeCloseTo(OFFLINE_EFFICIENCY, 2);
	});

	function createStateWithCrew() {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(9);
		// Not a bucket test — see routing.test.ts.
		state.hasAssistant = true;
		return state;
	}
});

describe('the manual to idle transition', () => {
	it('starts with the player massively out-earning an empty crew', () => {
		clearCatchTableCache();
		const state = createInitialState();
		const modifiers = computeModifiers(state);

		const table = catchTable(SOURCE_ORDER[0], modifiers.luck);
		const manual = modifiers.fishPerCast
			.times(table.averageSourceValue)
			.div(modifiers.castSeconds[SOURCE_ORDER[0]]);

		expect(manual.gt(0)).toBe(true);
		expect(totalIncomePerSecond(state, modifiers).eq(0)).toBe(true);
	});

	it('hands over to the crew partway through the first run, not at the very end', () => {
		const run = simulateRun({ maxSeconds: 12 * 60 * 60 });

		expect(run.idleCrossoverAt).not.toBeNull();
		expect(run.idleCrossoverAt!).toBeGreaterThan(30);
		expect(run.idleCrossoverAt!).toBeLessThan(run.secondsToPrestige! * 0.6);
	});

	it('leaves a crewed game earning while nobody is holding the rod', () => {
		const state = createInitialState();
		state.coins = D(1e9);
		state.deckhands[SOURCE_ORDER[0]] = D(40);

		const modifiers = computeModifiers(state);
		const before = state.holdValue;
		accumulate(state, modifiers, 3600);

		expect(state.holdValue.gt(before)).toBe(true);
		expect(state.totalCasts.gt(1000)).toBe(true);
	});

	it('still lets the player cast by hand at any point', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(500);
		const modifiers = computeModifiers(state);

		const before = state.totalCasts;
		performCast(state, SOURCE_ORDER[0], modifiers, () => 0.5);
		expect(state.totalCasts.eq(before.plus(1))).toBe(true);
	});

	it('gives every source its own crew to hire', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) {
			expect(state.deckhands[source]).toBeDefined();
			expect(state.deckhands[source].eq(0)).toBe(true);
		}
	});
});
