import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, FishType } from '$lib/fish_types';
import { OFFLINE_HOLD_MULTIPLIER, SAVE_KEY, SOURCE_ORDER } from './config';
import { bucketCapacity, holdCount } from './engine';
import { Game } from './state.svelte';

/**
 * The first tests in the repo to drive the `Game` class itself.
 *
 * Everything below the class was already covered; the class was not, and the
 * audit found every one of its defects living in exactly that gap. These are
 * the lifecycle paths: offline settlement, the multi-tab guard, and the two
 * ways a save could be lost without the player being told.
 */

class MemoryStorage {
	#items = new Map<string, string>();
	/** Set to make every write throw, the way a full quota does. */
	failWrites = false;

	get length(): number {
		return this.#items.size;
	}
	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}
	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
		this.#items.set(key, value);
	}
	removeItem(key: string): void {
		this.#items.delete(key);
	}
	clear(): void {
		this.#items.clear();
	}
}

type StorageListener = (event: { key: string | null; newValue: string | null }) => void;

let store: MemoryStorage;
let storageListeners: StorageListener[];
let games: Game[];

beforeEach(() => {
	store = new MemoryStorage();
	storageListeners = [];
	games = [];

	Object.defineProperty(globalThis, 'localStorage', {
		value: store,
		configurable: true,
		writable: true
	});

	Object.defineProperty(globalThis, 'window', {
		value: {
			addEventListener: (type: string, fn: StorageListener) => {
				if (type === 'storage') storageListeners.push(fn);
			},
			removeEventListener: () => {}
		},
		configurable: true,
		writable: true
	});
});

afterEach(() => {
	for (const game of games) game.stop();
	Reflect.deleteProperty(globalThis, 'localStorage');
	Reflect.deleteProperty(globalThis, 'window');
});

/** A started game, registered so its intervals are cleared afterwards. */
function boot(): Game {
	const game = new Game();
	games.push(game);
	game.init();
	return game;
}

/** Fire a `storage` event as another tab writing the same save. */
function otherTabWrote(value = '{"version":3}'): void {
	for (const fn of storageListeners) fn({ key: SAVE_KEY, newValue: value });
}

/** Put fish in the hold worth `value`, without going near the catch tables. */
function stockHold(game: Game, count: number, value: number): void {
	game.state.hold[FishType.Small] = D(count);
	game.state.holdValue = D(value);
}

describe('offline settlement', () => {
	it('does not pay the player for the hold they already had', () => {
		const game = boot();
		stockHold(game, 1000, 1_000_000);
		game.state.coins = d0();

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		expect(game.state.coins.toNumber()).toBe(0);
		expect(game.state.holdValue.toNumber()).toBe(1_000_000);
		expect(game.state.hold[FishType.Small].toNumber()).toBe(1000);
	});

	it('does not duplicate coins across repeated resumes', () => {
		const game = boot();
		stockHold(game, 1000, 1_000_000);

		for (let i = 0; i < 3; i++) {
			game.state.lastUpdate = Date.now() - 3_600_000;
			game.resume();
		}

		expect(game.state.coins.toNumber()).toBe(0);
	});

	it('does not inflate lifetimeCoins, which mints Pearls', () => {
		const game = boot();
		stockHold(game, 1000, 1_000_000);
		const before = game.state.lifetimeCoins;

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		expect(game.state.lifetimeCoins.toNumber()).toBe(before.toNumber());
	});

	it('pays nothing at all — offline is passive, and the night is fish (R51)', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(5);
		stockHold(game, 10, 1_000);
		const coinsBefore = game.state.coins;

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		const report = game.offlineReport;
		expect(report).not.toBeNull();
		expect(report!.fish.gt(0)).toBe(true);

		// Nobody sold anything. No trader, no dock, no coins.
		expect(game.state.coins.toNumber()).toBe(coinsBefore.toNumber());
		// The night is in the hold, on top of what the player left there.
		expect(report!.holdAfter.gt(10)).toBe(true);
		expect(game.state.hold[FishType.Small].gte(10)).toBe(true);
	});

	it('leaves the hold untouched when nothing happened while away', () => {
		const game = boot();
		stockHold(game, 7, 42);

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		expect(game.offlineReport).toBeNull();
		expect(game.state.hold[FishType.Small].toNumber()).toBe(7);
		expect(game.state.holdValue.toNumber()).toBe(42);
		for (const type of FISH_TYPES) {
			if (type !== FishType.Small) expect(game.state.hold[type].toNumber()).toBe(0);
		}
	});
});

describe('multi-tab guard', () => {
	it('keeps saving the tab the player is using', () => {
		const game = boot();
		otherTabWrote();

		game.state.coins = D(1234);
		expect(game.save()).toBe(true);
		expect(store.getItem(SAVE_KEY)).toContain('1234');
	});

	it('still warns that another tab is open', () => {
		const game = boot();
		otherTabWrote();
		expect(game.saveProblem?.kind).toBe('conflict');
	});

	it('offers a backup blob the player can actually keep', () => {
		const game = boot();
		game.state.coins = D(999);
		otherTabWrote();

		expect(game.exportBlob()).toMatch(/^FISHC\d+\./);
	});
});

describe('write failures', () => {
	it('tells the player when a save is refused', () => {
		const game = boot();
		store.failWrites = true;

		expect(game.save()).toBe(false);
		expect(game.saveProblem?.kind).toBe('write-failed');
	});

	it('clears the warning once a write goes through again', () => {
		const game = boot();
		store.failWrites = true;
		game.save();
		store.failWrites = false;

		expect(game.save()).toBe(true);
		expect(game.saveProblem).toBeNull();
	});

	it('does not block saving over a write failure', () => {
		const game = boot();
		store.failWrites = true;
		game.save();
		store.failWrites = false;
		game.state.coins = D(4321);

		expect(game.save()).toBe(true);
		expect(store.getItem(SAVE_KEY)).toContain('4321');
	});
});

describe('a save this build cannot read', () => {
	const FUTURE = '{"version":9999,"coins":"1e30","mystery":true}';

	function bootWithFutureSave(): Game {
		store.setItem(SAVE_KEY, FUTURE);
		return boot();
	}

	it('refuses to overwrite it', () => {
		const game = bootWithFutureSave();
		expect(game.saveProblem?.kind).toBe('future');
		expect(game.save()).toBe(false);
		expect(store.getItem(SAVE_KEY)).toBe(FUTURE);
	});

	it('exports the preserved save, not the blank game that replaced it', () => {
		const game = bootWithFutureSave();
		const blob = game.exportBlob();
		const payload = atob(blob.slice(blob.indexOf('.') + 1));

		expect(payload).toBe(FUTURE);
	});

	it('keeps a copy when the player dismisses the banner', () => {
		const game = bootWithFutureSave();
		game.dismissSaveProblem();

		expect(store.getItem(`${SAVE_KEY}.bak`)).toBe(FUTURE);
		// And the live save is now free to be written, which is the point of Dismiss.
		expect(game.save()).toBe(true);
	});

	it('does the same for an unreadable save', () => {
		store.setItem(SAVE_KEY, 'not json at all');
		const game = boot();

		expect(game.saveProblem?.kind).toBe('corrupt');
		game.dismissSaveProblem();
		expect(store.getItem(`${SAVE_KEY}.bak`)).toBe('not json at all');
	});
});

/**
 * The night's catch has to survive the settle.
 *
 * `#settleOffline` takes the hold out of play before settling and puts it back
 * afterwards. It used to put it back by *assignment*, which was only ever
 * correct because `sellHold` emptied the hold on every chunk — so by the end of
 * the loop there was nothing of the night's to overwrite. Take offline selling
 * away (R51) and that assignment silently deletes everything the crew landed.
 */
describe('the offline catch and the hold the player left', () => {
	/** Push the trader's appointment past the whole window, so he never lands. */
	function noTraderTonight(game: Game): void {
		game.state.nextTraderAt = Date.now() + 24 * 60 * 60 * 1000;
	}

	it('adds the night to the hold instead of overwriting it', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(5);
		// Room to spare: five fish against a starting bucket of thirty.
		stockHold(game, 5, 500);
		noTraderTonight(game);

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		const report = game.offlineReport;
		expect(report).not.toBeNull();
		expect(report!.fish.gt(0)).toBe(true);

		// The five the player left are still there, and so is the night's work.
		expect(holdCount(game.state).gt(5)).toBe(true);
		expect(game.state.holdValue.gt(500)).toBe(true);
	});

	it('never lets the merged hold exceed the bucket', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(200);
		// Twenty-five of a thirty-fish bucket already spoken for.
		stockHold(game, 25, 2_500);
		noTraderTonight(game);

		game.state.lastUpdate = Date.now() - 8 * 3_600_000;
		game.resume();

		// A night away is worth `OFFLINE_HOLD_MULTIPLIER` bucketfuls, no more.
		const cap = bucketCapacity(game.state.bucketLevel).times(OFFLINE_HOLD_MULTIPLIER);
		expect(holdCount(game.state).lte(cap)).toBe(true);
		expect(game.offlineReport?.holdFull).toBe(true);
		// And what the player already had was not thrown away to make room.
		expect(game.state.hold[FishType.Small].gte(25)).toBe(true);
	});
});
