import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { BUCKET_BASE_CAPACITY, PRESTIGE_THRESHOLD, TOWN_RATE, TRADER_RATE } from './config';
import {
	bucketCapacity,
	computeModifiers,
	consignmentCount,
	consignmentRoom,
	createInitialState,
	holdCount,
	holdRoom,
	listForSale,
	performPrestige,
	rideToTown,
	runTrader,
	sell,
	settleConsignment
} from './engine';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

/** A bucket with `count` small fish in it, worth `value` at full price. */
function withHold(count: number, value: number): GameState {
	const state = createInitialState();
	state.hold[FishType.Small] = D(count);
	state.holdValue = D(value);
	return state;
}

/**
 * R65. There is a Sell button, always. With an Assistant it sells; without one
 * it lists the catch for the travelling merchant, who settles it on arrival.
 */
describe('listing a catch for the merchant', () => {
	it('takes the fish out of the bucket at once, which is the point', () => {
		const state = withHold(10, 1_000);
		const roomBefore = holdRoom(state)!;

		const listed = listForSale(state);

		expect(listed.toNumber()).toBe(10);
		expect(holdCount(state).toNumber()).toBe(0);
		expect(consignmentCount(state).toNumber()).toBe(10);
		expect(holdRoom(state)!.gt(roomBefore)).toBe(true);
	});

	it('moves the value with the fish, so the two ledgers cannot drift', () => {
		const state = withHold(10, 1_000);
		listForSale(state);

		expect(state.holdValue.toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(1_000);
	});

	it('lists a part of the bucket in proportion when asked for one', () => {
		const state = withHold(10, 1_000);

		listForSale(state, D(4));

		expect(consignmentCount(state).toNumber()).toBeCloseTo(4, 6);
		expect(holdCount(state).toNumber()).toBeCloseTo(6, 6);
		expect(state.consignmentValue.toNumber()).toBeCloseTo(400, 6);
		expect(state.holdValue.toNumber()).toBeCloseTo(600, 6);
	});

	it('does not let the quay grow past the cart, or the bucket would be pointless', () => {
		const state = withHold(BUCKET_BASE_CAPACITY * 5, 5_000);

		listForSale(state);

		expect(consignmentCount(state).toNumber()).toBeCloseTo(BUCKET_BASE_CAPACITY, 6);
		expect(consignmentRoom(state)!.toNumber()).toBeCloseTo(0, 6);
		// The rest is still in the bucket, not deleted.
		expect(holdCount(state).toNumber()).toBeCloseTo(BUCKET_BASE_CAPACITY * 4, 6);
	});

	it('has no cart to fill once there is an Assistant', () => {
		const state = withHold(10, 1_000);
		state.hasAssistant = true;
		expect(consignmentRoom(state)).toBeNull();
	});

	it('does nothing at all with an empty bucket', () => {
		const state = createInitialState();
		expect(listForSale(state).toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(0);
	});
});

describe('the Sell button', () => {
	it('sells outright, at full price, once there is an Assistant', () => {
		const state = withHold(10, 1_000);
		state.hasAssistant = true;

		const result = sell(state, computeModifiers(state));

		expect(result.listed.toNumber()).toBe(0);
		expect(result.sold.toNumber()).toBeCloseTo(1_000 * TOWN_RATE, 6);
		expect(state.coins.toNumber()).toBeCloseTo(1_000, 6);
		expect(holdCount(state).toNumber()).toBe(0);
	});

	it('lists rather than sells without one — the coins come with the merchant', () => {
		const state = withHold(10, 1_000);

		const result = sell(state, computeModifiers(state));

		expect(result.sold.toNumber()).toBe(0);
		expect(result.listed.toNumber()).toBe(10);
		expect(state.coins.toNumber()).toBe(0);
	});
});

describe('settling', () => {
	it('is priced when he pays, not when the fish were listed', () => {
		const state = withHold(10, 1_000);
		listForSale(state);

		// The catch is worth twice as much by the time he turns up.
		const modifiers = computeModifiers(state);
		const doubled = { ...modifiers, sellMultiplier: modifiers.sellMultiplier.times(2) };
		const earned = settleConsignment(state, doubled, TRADER_RATE);

		expect(earned.toNumber()).toBeCloseTo(2_000 * TRADER_RATE, 6);
	});

	it('credits lifetime and all-time coins alongside the purse', () => {
		const state = withHold(10, 1_000);
		listForSale(state);

		settleConsignment(state, computeModifiers(state), TRADER_RATE);

		expect(state.lifetimeCoins.toNumber()).toBeCloseTo(1_000 * TRADER_RATE, 6);
		expect(state.allTimeCoins.toNumber()).toBeCloseTo(1_000 * TRADER_RATE, 6);
	});

	it('empties the quay even when what was on it turned out to be worthless', () => {
		const state = createInitialState();
		state.hold[FishType.Jelly] = D(6);
		state.holdValue = d0();
		listForSale(state);
		expect(consignmentCount(state).toNumber()).toBe(6);

		settleConsignment(state, computeModifiers(state), TRADER_RATE);
		expect(consignmentCount(state).toNumber()).toBe(0);
	});
});

describe('riding into town', () => {
	it('takes the bucket and the quay together, both at full price', () => {
		const state = withHold(20, 2_000);
		state.hasBicycle = true;
		listForSale(state, D(10));

		const result = rideToTown(state, computeModifiers(state), 0)!;

		expect(result.earned.toNumber()).toBeCloseTo(2_000 * TOWN_RATE, 6);
		expect(holdCount(state).toNumber()).toBe(0);
		expect(consignmentCount(state).toNumber()).toBe(0);
	});

	it('so listing is never a trap — it is a race against his next arrival', () => {
		const state = withHold(10, 1_000);
		state.hasBicycle = true;
		listForSale(state);
		state.nextTraderAt = 1_000_000;

		// Beat him to it, and the full price is still there for the taking.
		const earned = rideToTown(state, computeModifiers(state), 500_000)!.earned;
		expect(earned.toNumber()).toBeCloseTo(1_000, 6);

		// Lose the race, and he takes his cut.
		const other = withHold(10, 1_000);
		other.hasBicycle = true;
		listForSale(other);
		other.nextTraderAt = 1_000;
		const visit = runTrader(other, computeModifiers(other), 2_000);
		expect(visit.earned.toNumber()).toBeCloseTo(1_000 * TRADER_RATE, 6);
	});
});

describe('the quay survives a save', () => {
	it('round-trips through serialize and back', () => {
		const state = withHold(10, 1_000);
		listForSale(state, D(6));

		const back = fromRaw(JSON.parse(serialize(state)));

		expect(back.consignment[FishType.Small].toNumber()).toBeCloseTo(6, 0);
		expect(back.consignmentValue.toNumber()).toBeCloseTo(600, 6);
	});

	it('gives a version 5 save an empty quay rather than a broken one', () => {
		const state = withHold(10, 1_000);
		const raw = JSON.parse(serialize(state));
		delete raw.consignment;
		delete raw.consignmentValue;
		raw.version = 5;

		const back = fromRaw(raw);

		expect(back.version).toBe(6);
		for (const type of FISH_TYPES) expect(back.consignment[type].toNumber()).toBe(0);
		expect(back.consignmentValue.toNumber()).toBe(0);
	});

	it('does not count listed fish against the bucket after a reload', () => {
		const state = withHold(10, 1_000);
		listForSale(state);

		const back = fromRaw(JSON.parse(serialize(state)));

		expect(holdCount(back).toNumber()).toBe(0);
		expect(holdRoom(back)!.eq(bucketCapacity(back.bucketLevel))).toBe(true);
	});
});

describe('the quay and a prestige', () => {
	/**
	 * Listed fish are lost on a prestige, exactly as the bucket is.
	 *
	 * They belong to the operation you just sold. Carrying them would also mean
	 * carrying `consignmentValue` into a run whose whole point is that the coins
	 * start at zero, and the merchant would settle it on the new run's first
	 * arrival as a windfall the player did nothing for.
	 */
	it('is emptied by a prestige, like the bucket', () => {
		const state = withHold(10, 1_000);
		state.lifetimeCoins = D(PRESTIGE_THRESHOLD).times(10);
		state.unlocked[FishingSources.Ocean] = true;
		listForSale(state);

		const result = performPrestige(state);

		expect(result).not.toBeNull();
		expect(consignmentCount(state).toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(0);
	});
});
