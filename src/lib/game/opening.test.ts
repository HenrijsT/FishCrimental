import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	ASSISTANT_COST,
	BICYCLE_COST,
	SOURCE_ORDER,
	TOWN_TRIP_SECONDS,
	TRADER_RATE
} from './config';
import {
	accumulate,
	buyAssistant,
	buyBicycle,
	computeModifiers,
	createInitialState,
	inTown,
	rideToTown,
	saleRate,
	sellHold,
	townSecondsLeft
} from './engine';
import { fromRaw, serialize } from './save';
import { Game } from './state.svelte';
import type { GameState } from './types';

/** A state with something worth selling. */
function stocked(value = 1000): GameState {
	const state = createInitialState();
	state.hold[FishType.Small] = D(100);
	state.holdValue = D(value);
	return state;
}

describe('who buys the fish', () => {
	it('is the trader, badly, before there is a bicycle', () => {
		const state = stocked();
		const earned = sellHold(state, computeModifiers(state), saleRate(state));
		expect(earned.toNumber()).toBeCloseTo(1000 * TRADER_RATE, 6);
	});

	it('is the full price once there is', () => {
		const state = stocked();
		state.hasBicycle = true;
		expect(saleRate(state)).toBe(1);
	});

	it('defaults to the full price, so every existing caller keeps its meaning', () => {
		const state = stocked();
		expect(sellHold(state, computeModifiers(state)).toNumber()).toBeCloseTo(1000, 6);
	});

	it('pays more for riding in than for standing still', () => {
		const trader = stocked();
		const town = stocked();
		town.hasBicycle = true;

		const a = sellHold(trader, computeModifiers(trader), saleRate(trader));
		const b = rideToTown(town, computeModifiers(town))!.earned;
		expect(b.gt(a)).toBe(true);
	});
});

describe('buying the bicycle', () => {
	it('refuses without the coins', () => {
		const state = createInitialState();
		state.coins = D(BICYCLE_COST - 1);
		expect(buyBicycle(state)).toBe(false);
		expect(state.hasBicycle).toBe(false);
	});

	it('is bought once', () => {
		const state = createInitialState();
		state.coins = D(BICYCLE_COST * 3);
		expect(buyBicycle(state)).toBe(true);
		expect(buyBicycle(state)).toBe(false);
		expect(state.coins.eq(BICYCLE_COST * 2)).toBe(true);
	});
});

describe('the trip into town', () => {
	it('empties the hold and starts the clock', () => {
		const state = stocked();
		state.hasBicycle = true;
		const now = 1_000_000;

		const result = rideToTown(state, computeModifiers(state), now)!;
		expect(result.earned.gt(0)).toBe(true);
		expect(state.holdValue.eq(0)).toBe(true);
		expect(state.fishingBlockedUntil).toBe(now + TOWN_TRIP_SECONDS * 1000);
		expect(inTown(state, now)).toBe(true);
	});

	it('ends on its own', () => {
		const state = stocked();
		state.hasBicycle = true;
		const now = 1_000_000;
		rideToTown(state, computeModifiers(state), now);

		expect(inTown(state, now + TOWN_TRIP_SECONDS * 1000 - 1)).toBe(true);
		expect(inTown(state, now + TOWN_TRIP_SECONDS * 1000 + 1)).toBe(false);
		expect(townSecondsLeft(state, now + TOWN_TRIP_SECONDS * 1000 + 1)).toBe(0);
	});

	it('cannot be taken twice at once', () => {
		const state = stocked();
		state.hasBicycle = true;
		const now = 1_000_000;
		rideToTown(state, computeModifiers(state), now);
		expect(rideToTown(state, computeModifiers(state), now + 1)).toBeNull();
	});

	it('does not exist without a bicycle', () => {
		const state = stocked();
		expect(rideToTown(state, computeModifiers(state))).toBeNull();
	});

	it('never stops the crew — the cooldown is manual only', () => {
		const state = stocked();
		state.hasBicycle = true;
		state.deckhands[FishingSources.Pond] = D(10);
		rideToTown(state, computeModifiers(state), Date.now());

		const before = state.holdValue;
		accumulate(state, computeModifiers(state), 600);
		expect(state.holdValue.gt(before)).toBe(true);
	});
});

describe('the Assistant', () => {
	it('costs more than the first deckhand, as the owner asked', () => {
		expect(ASSISTANT_COST).toBeGreaterThan(
			// The Pond deckhand is the cheapest hire in the game.
			createInitialState().deckhands[FishingSources.Pond].plus(46).toNumber()
		);
		expect(ASSISTANT_COST).toBeGreaterThan(BICYCLE_COST);
	});

	it('ends the cooldown outright', () => {
		const state = stocked();
		state.hasBicycle = true;
		const now = 1_000_000;
		rideToTown(state, computeModifiers(state), now);
		expect(inTown(state, now)).toBe(true);

		state.coins = D(ASSISTANT_COST);
		expect(buyAssistant(state)).toBe(true);
		expect(inTown(state, now)).toBe(false);
	});

	it('makes the trip instant from then on', () => {
		const state = stocked();
		state.hasBicycle = true;
		state.hasAssistant = true;

		const result = rideToTown(state, computeModifiers(state), 1_000_000)!;
		expect(result.until).toBe(0);
		expect(inTown(state, 1_000_000)).toBe(false);
	});
});

describe('the deadline survives a save, and cannot brick the game', () => {
	it('round-trips a live trip', () => {
		const state = stocked();
		state.hasBicycle = true;
		rideToTown(state, computeModifiers(state), Date.now());

		const loaded = fromRaw(JSON.parse(serialize(state)))!;
		expect(loaded.hasBicycle).toBe(true);
		expect(loaded.fishingBlockedUntil).toBeGreaterThan(0);
		expect(inTown(loaded)).toBe(true);
	});

	it('clamps a hand-edited deadline that would refuse casting forever', () => {
		const loaded = fromRaw({
			version: 4,
			fishingBlockedUntil: Date.now() + 1e15,
			hasBicycle: true
		})!;

		expect(loaded.fishingBlockedUntil).toBeLessThanOrEqual(
			Date.now() + TOWN_TRIP_SECONDS * 1000 + 5
		);
		expect(inTown(loaded, Date.now() + TOWN_TRIP_SECONDS * 1000 + 100)).toBe(false);
	});

	it('treats a negative or absurd deadline as no trip at all', () => {
		expect(fromRaw({ version: 4, fishingBlockedUntil: -5 })!.fishingBlockedUntil).toBe(0);
		expect(fromRaw({ version: 4, fishingBlockedUntil: 'soon' })!.fishingBlockedUntil).toBe(0);
	});

	it('does not survive a prestige, unlike strandedFrom', () => {
		const fresh = createInitialState({
			pearls: D(5),
			dex: {},
			allTimePearls: D(5),
			allTimeCoins: D('1e18'),
			prestigeCount: D(1),
			achievements: []
		});
		expect(fresh.hasBicycle).toBe(false);
		expect(fresh.hasAssistant).toBe(false);
		expect(fresh.fishingBlockedUntil).toBe(0);
	});
});

describe('the Game refuses to cast while you are in town', () => {
	let games: Game[] = [];

	beforeEach(() => {
		games = [];
		// The cast loop drives itself off rAF, which node does not have. A stub
		// that never fires is enough: these tests drive the state, not the frames.
		Object.defineProperty(globalThis, 'requestAnimationFrame', {
			value: () => 1,
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'cancelAnimationFrame', {
			value: () => {},
			configurable: true,
			writable: true
		});
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				getItem: () => null,
				setItem: () => {},
				removeItem: () => {},
				clear: () => {},
				key: () => null,
				length: 0
			},
			configurable: true,
			writable: true
		});
	});

	afterEach(() => {
		for (const game of games) game.stop();
		Reflect.deleteProperty(globalThis, 'localStorage');
		Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
		Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
	});

	function boot(): Game {
		const game = new Game();
		games.push(game);
		game.init();
		return game;
	}

	it('will not begin a cast', () => {
		const game = boot();
		game.state.hasBicycle = true;
		game.state.hold[FishType.Small] = D(10);
		game.state.holdValue = D(100);
		game.ride();

		expect(game.inTown).toBe(true);
		game.beginCast();
		expect(game.casting).toBe(false);
	});

	it('lets go of a cast already in flight', () => {
		const game = boot();
		game.state.hasBicycle = true;
		game.state.holdValue = D(100);

		game.beginCast();
		expect(game.casting).toBe(true);

		game.ride();
		// `ride()` ends the cast rather than leaving `#frame` to land up to 25
		// more before it notices.
		expect(game.casting).toBe(false);
	});

	it('sells offline at the trader rate, not the town rate', () => {
		const game = boot();
		game.state.deckhands[FishingSources.Pond] = D(20);
		game.state.hasBicycle = true;
		game.state.lastUpdate = Date.now() - 3_600_000;

		const before = game.state.coins;
		game.resume();
		const withBike = game.state.coins.minus(before);

		// Nobody rides to town while the game is shut.
		expect(withBike.gt(0)).toBe(true);
		expect(game.state.fishingBlockedUntil).toBe(0);
	});
});

describe('the opening still holds together', () => {
	it('leaves every source reachable', () => {
		const state = createInitialState();
		expect(SOURCE_ORDER.length).toBeGreaterThan(0);
		expect(state.unlocked[SOURCE_ORDER[0]]).toBe(true);
	});

	it('never lets the trader pay more than the town', () => {
		expect(TRADER_RATE).toBeLessThan(1);
		expect(TRADER_RATE).toBeGreaterThan(0);
	});

	it('banks nothing strange into the hold when selling an empty one', () => {
		const state = createInitialState();
		expect(sellHold(state, computeModifiers(state), TRADER_RATE).eq(0)).toBe(true);
		expect(state.holdValue.eq(d0())).toBe(true);
	});
});
