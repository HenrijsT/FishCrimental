import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { FUEL_PRICE, LICENCE_IDS, SOURCE_ORDER } from './config';
import {
	accumulate,
	computeModifiers,
	createInitialState,
	shoreSource,
	routeCasts,
	sourceIncomePerSecond,
	totalIncomePerSecond
} from './engine';
import type { GameState } from './types';

/**
 * The headline coins/s and what the crew actually land must agree.
 *
 * `accumulate` diverts an open-water crew inshore when the boat cannot sail;
 * the estimator did not, and advertised up to 25x what the crew were earning —
 * in the state you are in the moment you buy the boat, and the default state
 * after a headstart prestige.
 */

/** Every source open and licensed, a boat owned, and a dry tank. */
function drydocked(): GameState {
	const state = createInitialState();
	for (const source of SOURCE_ORDER) state.unlocked[source] = true;
	for (const id of LICENCE_IDS) state.licences[id] = true;
	state.boat.owned = true;
	state.boat.fuel = d0();
	state.coins = d0();
	state.deckhands[FishingSources.Offshore] = D(10);
	// Not a bucket test: an Assistant is the in-game way to say the hold is
	// unlimited, so these assertions are about accumulation and nothing else.
	state.hasAssistant = true;
	return state;
}

/** Coins per second actually earned, measured by running the clock. */
function measure(state: GameState, seconds = 600): number {
	const modifiers = computeModifiers(state);
	const before = state.holdValue;
	accumulate(state, modifiers, seconds);
	return state.holdValue.minus(before).times(modifiers.sellMultiplier).div(seconds).toNumber();
}

describe('the advertised rate and the earned rate', () => {
	it('agree when the boat cannot sail at all', () => {
		const state = drydocked();
		const advertised = totalIncomePerSecond(state, computeModifiers(state)).toNumber();
		const earned = measure(state);

		expect(advertised).toBeGreaterThan(0);
		expect(advertised / earned).toBeGreaterThan(0.9);
		expect(advertised / earned).toBeLessThan(1.1);
	});

	it('agree when the tank is full', () => {
		const state = drydocked();
		state.boat.fuel = D('1e12');

		const advertised = totalIncomePerSecond(state, computeModifiers(state)).toNumber();
		const earned = measure(state);

		expect(advertised / earned).toBeGreaterThan(0.9);
		expect(advertised / earned).toBeLessThan(1.1);
	});

	it('agree when the tank covers only part of the work', () => {
		const state = drydocked();
		// A crew big enough that a single second is thousands of casts, so the
		// split is measurable rather than lost to the carry bank.
		state.deckhands[FishingSources.Offshore] = D('1e6');
		const modifiers = computeModifiers(state);

		// Enough fuel for roughly a third of one second of casting.
		const perSecond = state.deckhands[FishingSources.Offshore].times(
			modifiers.deckhandCastsPerSecond[FishingSources.Offshore]
		);
		state.boat.fuel = perSecond.times(modifiers.fuelPerCast).times(0.3);

		const advertised = totalIncomePerSecond(state, modifiers).toNumber();
		const earned = measure(state, 1);

		expect(earned).toBeGreaterThan(0);
		expect(advertised / earned).toBeGreaterThan(0.9);
		expect(advertised / earned).toBeLessThan(1.1);
	});

	it('agree when a standing order is paying for the fuel', () => {
		const state = drydocked();
		state.boat.upgrades.order = D(1);
		state.coins = D('1e30');

		const advertised = totalIncomePerSecond(state, computeModifiers(state)).toNumber();
		const earned = measure(state);

		expect(advertised / earned).toBeGreaterThan(0.9);
		expect(advertised / earned).toBeLessThan(1.1);
	});

	it('prices a crew with no boat at all as working inshore', () => {
		const state = drydocked();
		state.boat.owned = false;

		const advertised = sourceIncomePerSecond(
			state,
			computeModifiers(state),
			FishingSources.Offshore
		).toNumber();
		const earned = measure(state);

		expect(advertised / earned).toBeGreaterThan(0.9);
		expect(advertised / earned).toBeLessThan(1.1);
	});

	it('does not advertise a deeper deckhand as out-earning a shallower one when it cannot', () => {
		const offshore = drydocked();
		const sea = drydocked();
		sea.deckhands[FishingSources.Offshore] = d0();
		sea.deckhands[FishingSources.Sea] = D(10);

		const modifiers = computeModifiers(offshore);
		const offshoreRate = sourceIncomePerSecond(
			offshore,
			modifiers,
			FishingSources.Offshore
		).toNumber();
		const seaRate = sourceIncomePerSecond(sea, modifiers, FishingSources.Sea).toNumber();

		// Stranded Offshore crew work the Sea, and there are fewer casts in an
		// Offshore hour than a Sea one, so they cannot come out ahead.
		expect(offshoreRate).toBeLessThanOrEqual(seaRate * 1.0001);
	});
});

describe('routeCasts', () => {
	it('sends shore work straight through', () => {
		const state = drydocked();
		const route = routeCasts(state, computeModifiers(state), FishingSources.Pond, D(100));

		expect(route.sailed.toNumber()).toBe(100);
		expect(route.stranded.toNumber()).toBe(0);
		expect(route.fallback).toBeNull();
	});

	it('strands every open-water cast when the tank is dry', () => {
		const state = drydocked();
		const modifiers = computeModifiers(state);
		const route = routeCasts(state, modifiers, FishingSources.Offshore, D(100));

		expect(route.sailed.toNumber()).toBe(0);
		expect(route.stranded.toNumber()).toBe(100);
		expect(route.fallback).toBe(shoreSource(state));
	});

	it('splits the trip when the tank runs out part way', () => {
		const state = drydocked();
		const modifiers = computeModifiers(state);
		state.boat.fuel = modifiers.fuelPerCast.times(40);

		const route = routeCasts(state, modifiers, FishingSources.Offshore, D(100));

		expect(route.sailed.toNumber()).toBe(40);
		expect(route.stranded.toNumber()).toBe(60);
	});

	it('does not spend anything unless asked to', () => {
		const state = drydocked();
		const modifiers = computeModifiers(state);
		state.boat.fuel = modifiers.fuelPerCast.times(40);
		const fuelBefore = state.boat.fuel;
		const conditionBefore = state.boat.condition;

		routeCasts(state, modifiers, FishingSources.Offshore, D(100));

		expect(state.boat.fuel.toNumber()).toBe(fuelBefore.toNumber());
		expect(state.boat.condition).toBe(conditionBefore);
	});

	it('spends fuel and wears the hull when it is asked to', () => {
		const state = drydocked();
		const modifiers = computeModifiers(state);
		state.boat.fuel = modifiers.fuelPerCast.times(40);

		const route = routeCasts(state, modifiers, FishingSources.Offshore, D(100), true);

		expect(route.sailed.toNumber()).toBe(40);
		expect(state.boat.fuel.toNumber()).toBeCloseTo(0, 9);
		expect(state.boat.condition).toBeLessThan(100);
	});

	it('predicts exactly what spending it would do', () => {
		const state = drydocked();
		const modifiers = computeModifiers(state);
		state.boat.upgrades.order = D(1);
		state.coins = D(FUEL_PRICE).times(25);

		const predicted = routeCasts(state, modifiers, FishingSources.Offshore, D(1000));
		const spent = routeCasts(state, modifiers, FishingSources.Offshore, D(1000), true);

		expect(predicted.sailed.toNumber()).toBe(spent.sailed.toNumber());
		expect(predicted.stranded.toNumber()).toBe(spent.stranded.toNumber());
	});
});
