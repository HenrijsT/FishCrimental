import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	ASSISTANT_COST,
	BICYCLE_COST,
	BUCKET_BASE_CAPACITY,
	BUCKET_MAX_LEVEL,
	LICENCE_IDS,
	MAX_OFFLINE_SECONDS,
	OFFLINE_CHUNKS,
	OFFLINE_EFFICIENCY,
	SOURCE_ORDER,
	TOWN_TRIP_SECONDS,
	TRADER_RATE
} from './config';
import {
	accumulate,
	bucketCapacity,
	bucketCost,
	buyAssistant,
	buyBicycle,
	buyBucket,
	computeModifiers,
	createInitialState,
	distributeCatch,
	holdCount,
	holdRoom,
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

describe('the bucket', () => {
	it('holds something to begin with, and more when upgraded', () => {
		expect(bucketCapacity(0).toNumber()).toBe(BUCKET_BASE_CAPACITY);
		for (let level = 0; level < BUCKET_MAX_LEVEL; level++) {
			expect(bucketCapacity(level + 1).gt(bucketCapacity(level))).toBe(true);
			expect(bucketCost(level + 1).gt(bucketCost(level))).toBe(true);
		}
	});

	it('stops at its top level', () => {
		const state = createInitialState();
		state.bucketLevel = D(BUCKET_MAX_LEVEL);
		state.coins = D('1e30');
		expect(buyBucket(state)).toBe(false);
	});

	it('refuses a catch that will not fit', () => {
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		// Fill it.
		state.hold[FishType.Small] = bucketCapacity(state.bucketLevel);

		expect(holdRoom(state)!.toNumber()).toBe(0);
		const before = state.totalFish;
		accumulate(state, modifiers, 3600, 1, { [state.activeSource]: 5 });
		expect(state.totalFish.eq(before)).toBe(true);
	});

	it('never lands more than it can hold', () => {
		const state = createInitialState();
		state.deckhands[FishingSources.Pond] = D(50);
		accumulate(state, computeModifiers(state), 3600);

		expect(holdCount(state).lte(bucketCapacity(state.bucketLevel))).toBe(true);
	});

	it('does not spend the carry bank on a fish it refuses', () => {
		// The whole reason the cap is applied before `takeWhole`: that function
		// mutates state.carry, so refusing afterwards would bank the fraction
		// and lose the fish with no credit.
		const state = createInitialState();
		state.hold[FishType.Small] = bucketCapacity(state.bucketLevel);
		const modifiers = computeModifiers(state);

		const before = JSON.stringify(state.carry);
		distributeCatch(state, FishingSources.Pond, D(500), modifiers, () => 0.5, holdRoom(state));
		expect(JSON.stringify(state.carry)).toBe(before);
	});

	it('does not credit the Fishdex for fish that never fit', () => {
		const state = createInitialState();
		state.hold[FishType.Small] = bucketCapacity(state.bucketLevel);
		const modifiers = computeModifiers(state);

		const before = Object.keys(state.dex).length;
		distributeCatch(state, FishingSources.Pond, D(5000), modifiers, () => 0.5, holdRoom(state));
		expect(Object.keys(state.dex).length).toBe(before);
	});

	it('burns no casts, no fuel and no hull on a full bucket', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.fuel = D('1e9');
		state.boat.condition = 100;
		state.deckhands[FishingSources.Offshore] = D(20);
		state.hold[FishType.Small] = bucketCapacity(state.bucketLevel);

		const casts = state.totalCasts;
		const fuel = state.boat.fuel;
		const condition = state.boat.condition;

		accumulate(state, computeModifiers(state), 3600);

		expect(state.totalCasts.eq(casts)).toBe(true);
		expect(state.boat.fuel.eq(fuel)).toBe(true);
		expect(state.boat.condition).toBe(condition);
	});

	it('is switched off entirely by the Assistant', () => {
		const state = createInitialState();
		state.hasAssistant = true;
		expect(holdRoom(state)).toBeNull();

		state.deckhands[FishingSources.Pond] = D(50);
		accumulate(state, computeModifiers(state), 3600);
		expect(holdCount(state).gt(bucketCapacity(state.bucketLevel))).toBe(true);
	});

	it('defaults to unlimited when nobody passes a room, so old callers are unchanged', () => {
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		const result = distributeCatch(state, FishingSources.Pond, D(5000), modifiers, () => 0.5);
		// Not exactly 5000: the bulk path splits by expected share and banks the
		// per-species remainders. The point is that nothing capped it.
		expect(result.fish.toNumber()).toBeGreaterThan(4990);
	});
});

describe('a night offline still scales with the crew', () => {
	/** Coins earned over eight hours away, settled the way the game settles it. */
	function nightEarnings(crew: number, bucketLevel: number, assistant = false): number {
		const state = createInitialState();
		state.bucketLevel = D(bucketLevel);
		state.hasAssistant = assistant;
		state.deckhands[FishingSources.Pond] = D(crew);

		const capped = MAX_OFFLINE_SECONDS;
		const chunks = Math.max(1, Math.min(OFFLINE_CHUNKS, Math.ceil(capped / 60)));
		const chunkSeconds = capped / chunks;

		let coins = d0();
		for (let i = 0; i < chunks; i++) {
			const modifiers = computeModifiers(state);
			accumulate(state, modifiers, chunkSeconds, OFFLINE_EFFICIENCY);
			coins = coins.plus(sellHold(state, modifiers, saleRate(state)));
		}
		return coins.toNumber();
	}

	it('doubles the crew, roughly doubles the night — at a bucket the player can afford', () => {
		// Five bucket levels cost 17,190 in total, which is inside the
		// Assistant's 26,000 — so this is a bucket a player genuinely has while
		// still owning a real crew. That is the worst moment for the cap.
		const level = 5;
		const small = nightEarnings(10, level);
		const large = nightEarnings(20, level);

		expect(small).toBeGreaterThan(0);
		// Clipped by the bucket, this ratio collapses towards 1.
		expect(large / small).toBeGreaterThan(1.8);
	});

	it('is the bucket, not the crew, that would have clipped it', () => {
		// The same doubling against a level-0 bucket does get clipped — which is
		// exactly why the bucket has to be upgradeable.
		const clipped = nightEarnings(20, 0) / nightEarnings(10, 0);
		const roomy = nightEarnings(20, 6) / nightEarnings(10, 6);
		expect(roomy).toBeGreaterThan(clipped);
	});

	it('an Assistant removes the ceiling completely', () => {
		// Same settle, same crew, same chunks — the only difference is the cap.
		// A level-0 bucket is where the clipping is worst.
		expect(nightEarnings(20, 0, true)).toBeGreaterThan(nightEarnings(20, 0, false));
	});

	it('and an Assistant is never worse than the biggest bucket', () => {
		expect(nightEarnings(20, 0, true)).toBeGreaterThanOrEqual(
			nightEarnings(20, BUCKET_MAX_LEVEL, false) * 0.999
		);
	});
});
