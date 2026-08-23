import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { D } from '$lib/decimal';
import { formatNumber } from '$lib/format';
import { FISH_TYPES, FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { SAVE_VERSION, SOURCE_ORDER, TOWN_RATE } from './config';
import {
	accumulate,
	autoCastsPerSecond,
	buyDeckhand,
	buyUpgrade,
	listForSale,
	computeModifiers,
	createInitialState,
	deckhandBulkCost,
	deckhandCost,
	performCast,
	runTrader,
	saleRate,
	sellHold
} from './engine';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

/**
 * Every test here is tied to a specific defect found in the round-two hunt.
 * They exist to stop it coming back, not to describe the design.
 */

describe('round two: the catch ticker showed the same species every cast', () => {
	// A single cast used to write one rolled fish plus a fractional sliver of
	// every other species in the source into the ticker, the hold and the dex.
	it('a cast touches only the species it actually landed', () => {
		const state = createInitialState();
		state.coins = D(1e9);
		buyUpgrade(state, 'net', 1); // fishPerCast 1.19 — the case that broke

		const modifiers = computeModifiers(state);
		expect(modifiers.fishPerCast.toNumber()).toBeCloseTo(1.19, 6);

		const { caught } = performCast(state, SOURCE_ORDER[0], modifiers, () => 0.5);
		expect(caught.size).toBeLessThanOrEqual(2);
		expect(Object.keys(state.dex).length).toBeLessThanOrEqual(2);
	});

	it('never books a fraction of a fish anywhere', () => {
		const state = createInitialState();
		state.coins = D(1e9);
		buyUpgrade(state, 'net', 4);
		const modifiers = computeModifiers(state);

		for (let i = 0; i < 200; i++) performCast(state, SOURCE_ORDER[0], modifiers, Math.random);

		for (const type of FISH_TYPES) {
			expect(state.hold[type].eq(state.hold[type].floor())).toBe(true);
		}
		for (const [name, count] of Object.entries(state.dex)) {
			expect(count.eq(count.floor()), `${name} is fractional`).toBe(true);
		}
	});
});

describe('round two: the Erotic count rendered as a red-flagged zero', () => {
	it('a species you have not caught is simply absent from the hold', () => {
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		performCast(state, SOURCE_ORDER[0], modifiers, () => 0.5);

		expect(state.hold[FishType.Erotic].eq(0)).toBe(true);
		expect(state.hold[FishType.Jelly].eq(0)).toBe(true);
	});

	it('formatNumber never renders a value the player has as "0"', () => {
		expect(formatNumber(2.09e-7)).toBe('<0.01');
		expect(formatNumber(0.004)).toBe('<0.01');
		expect(formatNumber(0)).toBe('0');
	});
});

describe('round two: deckhands landed every species of a category at once', () => {
	it('a small crew brings up a handful of species, not the whole roster', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(3);
		const modifiers = computeModifiers(state);

		accumulate(state, modifiers, 10, 1, undefined, () => 0.5);

		const discovered = Object.keys(state.dex).length;
		expect(discovered).toBeGreaterThan(0);
		expect(discovered).toBeLessThanOrEqual(3);
	});

	it('still reaches the whole roster given long enough', () => {
		const state = createInitialState();
		// The Pond, not the mud pool: the mud pool stocks five species and this
		// is about a crew eventually landing more than a handful.
		state.unlocked[FishingSources.Pond] = true;
		state.activeSource = FishingSources.Pond;
		state.deckhands[FishingSources.Pond] = D(50);
		// Species coverage, not bucket capacity: an Assistant keeps the hold
		// unlimited so 20,000 seconds of crew work actually lands.
		state.hasAssistant = true;
		const modifiers = computeModifiers(state);

		accumulate(state, modifiers, 20_000);

		expect(Object.keys(state.dex).length).toBeGreaterThanOrEqual(7);
	});
});

describe('round two: a huge crew overflowed a double and poisoned the save', () => {
	it('cast rates stay Decimal past the double limit', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D('1e320');
		const modifiers = computeModifiers(state);

		const rate = autoCastsPerSecond(state, modifiers, SOURCE_ORDER[0]);
		expect(rate instanceof Decimal).toBe(true);
		expect(rate.isFinite()).toBe(true);
		expect(rate.gt('1e300')).toBe(true);
	});

	it('an enormous haul never becomes Infinity, so the save survives it', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) {
			state.unlocked[source] = true;
			state.deckhands[source] = D('1e320');
		}

		const modifiers = computeModifiers(state);
		accumulate(state, modifiers, 60);
		const earned = sellHold(state, modifiers);

		expect(earned.isFinite()).toBe(true);
		expect(state.coins.isFinite()).toBe(true);

		// The real damage was here: Infinity does not survive a save round trip.
		const restored = fromRaw(JSON.parse(serialize(state)));
		expect(restored.coins.gt(0)).toBe(true);
		expect(restored.coins.eq(state.coins)).toBe(true);
	});
});

describe('round two: bulk-buying deckhands cost more than buying them singly', () => {
	it('ten at once costs exactly what ten one at a time costs', () => {
		for (const source of SOURCE_ORDER) {
			let singly = D(0);
			for (let i = 0; i < 10; i++) singly = singly.plus(deckhandCost(source, i));

			const bulk = deckhandBulkCost(source, D(0), D(10));
			expect(bulk.div(singly).toNumber()).toBeCloseTo(1, 9);
		}
	});

	it('and the player is charged the same either way', () => {
		const bulkState = createInitialState();
		bulkState.coins = D(1e9);
		buyDeckhand(bulkState, SOURCE_ORDER[0], 10);

		const singleState = createInitialState();
		singleState.coins = D(1e9);
		for (let i = 0; i < 10; i++) buyDeckhand(singleState, SOURCE_ORDER[0], 1);

		expect(bulkState.deckhands[SOURCE_ORDER[0]].eq(10)).toBe(true);
		expect(singleState.deckhands[SOURCE_ORDER[0]].eq(10)).toBe(true);
		expect(bulkState.coins.div(singleState.coins).toNumber()).toBeCloseTo(1, 9);
	});
});

describe('round two: hand-edited saves were trusted', () => {
	it('refuses negative currencies', () => {
		const loaded = fromRaw({ version: 2, coins: '-1e30', lifetimeCoins: '-5', holdValue: '-1' });
		expect(loaded.coins.eq(0)).toBe(true);
		expect(loaded.lifetimeCoins.eq(0)).toBe(true);
		expect(loaded.holdValue.eq(0)).toBe(true);
	});

	it('clamps upgrade levels to the ceiling the game defines', () => {
		const loaded = fromRaw({
			version: 2,
			upgrades: { rod: '1e30' },
			prestigeUpgrades: { pearl_yield: '1e30' }
		});
		expect(loaded.upgrades.rod.toNumber()).toBe(70);
		expect(loaded.prestigeUpgrades.pearl_yield.toNumber()).toBe(25);
	});

	it('throws away a remainder bank that is not made of remainders', () => {
		const loaded = fromRaw({
			version: 2,
			carry: { good: 0.5, tooBig: 4, negative: -0.2, notANumber: 'x', infinite: Infinity }
		});
		expect(loaded.carry).toEqual({ good: 0.5 });
	});
});

describe('round two: version 1 saves carried fractional fish', () => {
	it('rounds them down on the way in', () => {
		const loaded = fromRaw({
			version: 1,
			hold: { Small: '7.21', Medium: '1.29', Large: '0.02', Erotic: '2.09e-7' },
			dex: { Guppy: '3.7', Tetra: '0.4' }
		});

		expect(loaded.hold[FishType.Small].eq(7)).toBe(true);
		expect(loaded.hold[FishType.Medium].eq(1)).toBe(true);
		expect(loaded.hold[FishType.Large].eq(0)).toBe(true);
		expect(loaded.hold[FishType.Erotic].eq(0)).toBe(true);
		expect(loaded.dex.Guppy.eq(3)).toBe(true);
		expect(loaded.dex.Tetra).toBeUndefined();
		// Not a literal: this asserts the migration chain runs all the way to
		// the current format, whatever that is today.
		expect(loaded.version).toBe(SAVE_VERSION);
	});
});

/**
 * R63. Buying the Assistant is the most expensive thing in the opening act, and
 * it used to make the player 45% poorer per fish.
 *
 * `runTrader` was called unguarded from the live tick, so the trader kept
 * arriving every forty-five seconds and taking the whole hold at `TRADER_RATE`,
 * while `saleRate` told that same player they were on `TOWN_RATE`. Nothing in
 * the UI said otherwise. Offline already branched correctly; the tick did not.
 */
describe('the trader stops buying once there is an Assistant (R63)', () => {
	/** Ten fish listed on the quay, the merchant almost due. */
	function stocked(): GameState {
		const state = createInitialState();
		state.hold[FishType.Small] = D(10);
		state.holdValue = D(1_000);
		listForSale(state);
		state.nextTraderAt = 1_000;
		return state;
	}

	it('does not take the hold', () => {
		const state = stocked();
		state.hasAssistant = true;

		const result = runTrader(state, computeModifiers(state), 10_000);

		expect(result.visits).toBe(0);
		expect(result.earned.toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(1_000);
		expect(state.consignment[FishType.Small].toNumber()).toBe(10);
		expect(state.coins.toNumber()).toBe(0);
	});

	it('still takes it from a player who has not hired one', () => {
		const state = stocked();

		const result = runTrader(state, computeModifiers(state), 10_000);

		expect(result.visits).toBeGreaterThan(0);
		expect(state.consignmentValue.toNumber()).toBe(0);
	});

	it('does not bank a pile of arrivals to spring on someone who lets him go', () => {
		const state = stocked();
		state.hasAssistant = true;

		// A long absence with the Assistant on the books.
		runTrader(state, computeModifiers(state), 10_000_000);
		state.hasAssistant = false;

		// At most one visit is due immediately, not the two hundred that elapsed.
		const result = runTrader(state, computeModifiers(state), 10_000_000);
		expect(result.visits).toBeLessThanOrEqual(1);
	});

	it('pays the Assistant owner the full price they were promised', () => {
		const state = stocked();
		state.hasAssistant = true;
		expect(saleRate(state)).toBe(TOWN_RATE);
	});
});
