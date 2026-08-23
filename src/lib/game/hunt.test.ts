import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	POACH_BUSTED_SECONDS,
	POACH_GRACE_SECONDS,
	SAVE_KEY,
	SOURCE_ORDER,
	TRADER_PERIOD_SECONDS,
	TRADER_RATE,
	UPGRADE_IDS
} from './config';
import {
	accumulate,
	bucketCapacity,
	catchTable,
	computeModifiers,
	createInitialState,
	handIncomePerSecond,
	holdCount,
	listForSale,
	runTrader,
	saleRate,
	sellHold,
	totalIncomePerSecond,
	upgradeDoesNothing
} from './engine';
import { averagePrice, marketDepth, settleMarket, speciesPrice } from './market';
import { canPoach, poachSource, runPolice } from './police';
import { advanceExamIdle, cullCall, sounderCall, startExam } from './exams';
import { deserialize, fromRaw, readImport, serialize } from './save';
import { Game } from './state.svelte';
import type { GameState } from './types';

/**
 * The adversarial hunt.
 *
 * One test per defect a multi-agent bug hunt found and a second agent
 * confirmed. Each is written to fail against the code as it was, so that if any
 * of them is ever reverted this file says which one and why.
 */

class MemoryStorage {
	#items = new Map<string, string>();
	failWrites = false;
	get length() {
		return this.#items.size;
	}
	key(i: number) {
		return [...this.#items.keys()][i] ?? null;
	}
	getItem(k: string) {
		return this.#items.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
		this.#items.set(k, v);
	}
	removeItem(k: string) {
		this.#items.delete(k);
	}
	clear() {
		this.#items.clear();
	}
}

let store: MemoryStorage;
const games: Game[] = [];

beforeEach(() => {
	store = new MemoryStorage();
	Object.defineProperty(globalThis, 'localStorage', {
		value: store,
		configurable: true,
		writable: true
	});
	Object.defineProperty(globalThis, 'window', {
		value: { addEventListener: () => {}, removeEventListener: () => {} },
		configurable: true,
		writable: true
	});
});

afterEach(() => {
	for (const game of games.splice(0)) game.stop();
	Reflect.deleteProperty(globalThis, 'localStorage');
	Reflect.deleteProperty(globalThis, 'window');
});

function boot(): Game {
	const game = new Game();
	games.push(game);
	game.init();
	return game;
}

/**
 * `tick()` clamped a long gap to two minutes and then wrote `lastUpdate = now`
 * anyway, throwing the rest away with no settle and no report — and `resume()`
 * reads the same `lastUpdate` the tick had just erased. On a laptop that sleeps
 * with the tab still visible, `visibilitychange` never fires, so the pending
 * interval callback was guaranteed to win.
 */
describe('a night is never swallowed by the tick that comes back first', () => {
	it('settles the gap instead of clamping it away', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(5);
		game.state.hasAssistant = true;

		const now = Date.now();
		game.state.lastUpdate = now - 3 * 3_600_000;
		game.tick(now);

		expect(game.offlineReport).not.toBeNull();
		expect(game.offlineReport!.fish.gt(100)).toBe(true);
	});

	it('and a settled gap is not then settled again', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(5);
		game.state.hasAssistant = true;

		const now = Date.now();
		game.state.lastUpdate = now - 3 * 3_600_000;
		game.tick(now);
		const first = game.offlineReport!.fish;

		game.offlineReport = null;
		game.tick(now + 200);
		expect(game.offlineReport).toBeNull();
		expect(first.gt(0)).toBe(true);
	});
});

/**
 * The catch-up loop is not inside the settle, so passive-only *looked* safe —
 * but it resolved `floor(gap / 45s)` arrivals on the first tick back, each one
 * settling a consignment and crediting `lifetimeCoins`, which mints Pearls.
 */
describe('the merchant sleeps through an absence', () => {
	function listed(): GameState {
		const state = createInitialState();
		state.hold[FishType.Small] = D(10);
		state.holdValue = D(1_000);
		listForSale(state);
		state.nextTraderAt = 1_000;
		return state;
	}

	it('pays nothing for eight hours he was not there for', () => {
		const state = listed();
		const lifetime = state.lifetimeCoins;

		runTrader(state, computeModifiers(state), 1_000 + 8 * 3_600_000);

		expect(state.coins.toNumber()).toBe(0);
		expect(state.lifetimeCoins.eq(lifetime)).toBe(true);
		expect(state.traderVisits).toBe(0);
	});

	it('and does not walk his appointment forward a million times', () => {
		const state = listed();
		state.nextTraderAt = 1_000;

		const started = Date.now();
		runTrader(state, computeModifiers(state), 1_000 + 6 * 365 * 24 * 3_600_000);
		expect(Date.now() - started).toBeLessThan(200);
	});

	it('but still catches up on a throttled background tab', () => {
		const state = listed();
		const result = runTrader(
			state,
			computeModifiers(state),
			1_000 + 2 * TRADER_PERIOD_SECONDS * 1000
		);
		expect(result.visits).toBeGreaterThan(0);
	});
});

describe('the market survives a clock that goes backwards', () => {
	it('does not hand out the same recovery window twice', () => {
		const state = createInitialState();
		state.prestigeCount = D(1);
		state.marketPressure.Guppy = D(1_000);
		state.marketUpdatedAt = 10_000_000;

		settleMarket(state, 10_000_000 - 900_000);
		settleMarket(state, 10_000_000);

		expect(state.marketPressure.Guppy.toNumber()).toBeCloseTo(1_000, 6);
	});
});

/**
 * `(1 + (p+q)/S)^0.75 - (1 + p/S)^0.75` is a difference of two nearly equal
 * numbers. Past about `q/(S+p) ≈ 1e-16` every digit cancels and the sale paid
 * nothing at all, while the price board showed a healthy price.
 */
describe('a small sale in a deep market still pays', () => {
	function trading(): GameState {
		const state = createInitialState();
		state.prestigeCount = D(1);
		state.marketUpdatedAt = 1;
		return state;
	}

	it('never prices a sale at zero', () => {
		const state = trading();
		state.marketPressure.Guppy = D('1e18');
		expect(averagePrice(state, 'Guppy', D(100)).gt(0)).toBe(true);
		expect(speciesPrice(state, 'Guppy').gt(0)).toBe(true);
	});

	it('pays coins for a hold that the board says is worth something', () => {
		const state = trading();
		state.marketPressure.Guppy = D('1e18');
		state.hold[FishType.Small] = D(100);
		state.holdValue = D(1_000_000);
		state.holdSpecies.fish.Guppy = D(100);
		state.holdSpecies.worth.Guppy = D(1_000_000);

		expect(sellHold(state, computeModifiers(state)).gt(0)).toBe(true);
	});

	it('never prices one fish above the untouched price', () => {
		const state = trading();
		state.upgrades.storage = D(11);
		state.marketPressure.Guppy = D(1.3e6);

		const spot = speciesPrice(state, 'Guppy');
		expect(averagePrice(state, 'Guppy', D(1)).lte(spot)).toBe(true);
		expect(averagePrice(state, 'Guppy', D(1)).gt(spot.times(0.999))).toBe(true);
	});

	it('and the depth it is priced against is the one Cold Storage bought', () => {
		const state = trading();
		state.upgrades.storage = D(3);
		expect(marketDepth(state).gt(marketDepth(trading()))).toBe(true);
	});
});

describe('the income readout is what the player banks', () => {
	it('takes the buyer’s cut off, before the bicycle', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(20);
		// A bucket big enough that the bucket is not what is being measured. An
		// Assistant would do it too, but an Assistant is also transport, and
		// transport is exactly the variable here.
		state.bucketLevel = D(10);
		expect(saleRate(state)).toBe(TRADER_RATE);

		const readout = totalIncomePerSecond(state, computeModifiers(state));
		const table = catchTable(SOURCE_ORDER[0], computeModifiers(state).luck);
		const gross = table.averageSourceValue;
		expect(gross).toBeGreaterThan(0);

		// Selling a minute of it must land within a few percent of the readout.
		const before = state.coins;
		accumulate(state, computeModifiers(state), 60);
		sellHold(state, computeModifiers(state), saleRate(state));
		const banked = state.coins.minus(before).div(60);

		expect(banked.div(readout).toNumber()).toBeGreaterThan(0.7);
		expect(banked.div(readout).toNumber()).toBeLessThan(1.4);
	});

	it('prices the hands where the casts actually land, not where the player stands', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of Object.keys(state.licences)) {
			state.licences[id as keyof typeof state.licences] = true;
		}
		state.boat.owned = true;
		state.boat.fuel = d0();
		state.coins = d0();
		state.activeSource = FishingSources.Ocean;

		const stranded = handIncomePerSecond(state, computeModifiers(state));

		state.boat.fuel = D(1e9);
		const fuelled = handIncomePerSecond(state, computeModifiers(state));

		expect(fuelled.gt(stranded.times(5))).toBe(true);
	});
});

/**
 * `routeCasts(spend = true)` buys fuel and wears the hull for every cast handed
 * to it, and the catch was only clamped afterwards — so a bucket-limited crew
 * was billed for a whole interval and landed a bucketful. Offline that interval
 * is the whole night.
 */
describe('nothing is spent on fish there is nowhere to put', () => {
	it('mints only the casts the bucket can take', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(60);

		accumulate(state, computeModifiers(state), 7_200);

		expect(holdCount(state).lte(bucketCapacity(state.bucketLevel))).toBe(true);
		expect(state.totalCasts.lt(200)).toBe(true);
	});
});

describe('poaching is reachable at all', () => {
	it('is offered on water the player has not bought', () => {
		const state = createInitialState();
		state.mapLevel = D(3);

		const poachable = SOURCE_ORDER.filter((source) => canPoach(state, source));
		expect(poachable.length).toBeGreaterThan(0);
	});

	it('and the clock is not reset by walking away', () => {
		const state = createInitialState();
		state.mapLevel = D(3);
		const target = SOURCE_ORDER.find((source) => canPoach(state, source))!;

		poachSource(state, target);
		runPolice(state, computeModifiers(state), POACH_GRACE_SECONDS - 1);
		state.poaching = null;
		poachSource(state, target);

		expect(runPolice(state, computeModifiers(state), 2)).not.toBeNull();
	});
});

describe('an exam can always be finished', () => {
	/** Every source up to and including `upTo` open, with the paper for them. */
	function openTo(upTo: FishingSources): GameState {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) {
			state.unlocked[source] = true;
			if (source === upTo) break;
		}
		state.licences.inland = true;
		return state;
	}

	it('names a fish that actually turns up', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Pond] = true;
		// A veteran's Fishdex: the joke fish is in it, at one in a million.
		state.dex['Lovestruck Lipfish'] = D(3);
		state.dex.Guppy = D(500);

		for (let i = 0; i < 20; i++) {
			const attempt = createInitialState();
			attempt.unlocked[FishingSources.Pond] = true;
			attempt.dex = state.dex;
			startExam(attempt, 'inland', () => i / 20);
			expect(attempt.exam!.species).not.toBe('Lovestruck Lipfish');
		}
	});

	it('a wrong Cull call after it is passed does not un-pass it', () => {
		const state = openTo(FishingSources.River);
		expect(startExam(state, 'lakes', () => 0)).toBe(true);
		state.exam!.progress = state.exam!.target;
		const target = state.exam!.target;

		state.exam!.offer = '1';
		cullCall(state, true, () => 0);

		expect(state.exam!.target).toBe(target);
		expect(state.exam!.progress).toBe(target);
	});

	it('an emptied depth box does not poison the sounder range', () => {
		const state = openTo(FishingSources.Lagoon);
		state.licences.lakes = true;
		expect(startExam(state, 'coastal', () => 0)).toBe(true);

		sounderCall(state, Number.NaN);

		expect(Number.isFinite(state.exam!.low!)).toBe(true);
		expect(Number.isFinite(state.exam!.high!)).toBe(true);
	});

	it('and the drip still finishes one nobody touches', () => {
		const state = openTo(FishingSources.River);
		startExam(state, 'lakes', () => 0);

		for (let i = 0; i < 100_000; i++) advanceExamIdle(state, 1);
		expect(state.exam!.progress).toBeGreaterThanOrEqual(state.exam!.target);
	});

	it('and no exam is sat while the game is shut', () => {
		const game = boot();
		game.state.unlocked[FishingSources.Pond] = true;
		game.state.deckhands[SOURCE_ORDER[0]] = D(50);
		game.state.hasAssistant = true;
		game.state.dex.Guppy = D(100);
		startExam(game.state, 'inland', () => 0);

		game.state.lastUpdate = Date.now() - 8 * 3_600_000;
		game.resume();

		expect(game.state.exam!.progress).toBe(0);
	});
});

describe('the save layer keeps what it promised', () => {
	it('serves the whole police ban after a reload', () => {
		const state = createInitialState();
		state.bustedUntil = Date.now() + POACH_BUSTED_SECONDS * 1000;

		const back = fromRaw(JSON.parse(serialize(state)));
		const left = (back.bustedUntil - Date.now()) / 1000;

		expect(left).toBeGreaterThan(POACH_BUSTED_SECONDS - 5);
	});

	it('refuses a save whose version cannot be read, rather than guessing zero', () => {
		const state = createInitialState();
		state.licences.inland = true;
		state.boat.owned = true;
		const raw = JSON.parse(serialize(state));
		raw.version = '6';

		expect(() => deserialize(JSON.stringify(raw))).toThrow();
	});

	it('never boots blank because reading storage threw', () => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				getItem() {
					throw new DOMException('blocked', 'SecurityError');
				},
				setItem() {},
				removeItem() {},
				clear() {},
				key: () => null,
				length: 0
			},
			configurable: true,
			writable: true
		});

		const game = new Game();
		games.push(game);
		expect(() => game.init()).not.toThrow();
		expect(game.loaded).toBe(true);
	});

	it('exports the session, not an old blob kept for a different problem', () => {
		store.setItem(SAVE_KEY, '{{{ not json');

		const game = boot();
		expect(game.saveProblem?.kind).toBe('corrupt');
		game.dismissSaveProblem();

		game.state.coins = D('1e20');
		game.saveProblem = { kind: 'write-failed', message: 'quota' };

		const blob = game.exportBlob();
		expect(readImport(blob).state?.coins.toNumber()).toBeCloseTo(1e20, -10);
	});

	it('copies a save aside before a hard reset destroys it', () => {
		store.setItem(SAVE_KEY, JSON.stringify({ version: 99, coins: '5' }));

		const game = boot();
		expect(game.saveProblem?.kind).toBe('future');

		game.hardReset();
		expect(game.rescued).toBe(true);
		expect(game.rescuedBlob()).not.toBeNull();
	});

	it('says a newer export is newer, not that it is not a save', () => {
		const outcome = readImport('FISHC99.eyJ2ZXJzaW9uIjo5OX0=');
		expect(outcome.failure).toBe('future');
		expect(outcome.version).toBe(99);
	});
});

describe('a rod past the clamp does not pretend to be worth buying', () => {
	it('is flagged inert once every cast is at the floor', () => {
		const state = createInitialState();
		state.prestigeUpgrades.pearl_speed = D(20);
		state.upgrades.rod = D(40);

		expect(upgradeDoesNothing(state, 'rod', state.upgrades.rod)).toBe(true);
		for (const id of UPGRADE_IDS) {
			if (id !== 'rod') expect(upgradeDoesNothing(state, id, D(40))).toBe(false);
		}
	});

	it('and is not flagged before it', () => {
		const state = createInitialState();
		expect(upgradeDoesNothing(state, 'rod', d0())).toBe(false);
	});
});
