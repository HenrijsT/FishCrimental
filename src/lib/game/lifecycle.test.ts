import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, FishType } from '$lib/fish_types';
import { SAVE_KEY, SOURCE_ORDER } from './config';
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

	it('still pays for what the crew landed while away, and only that', () => {
		const game = boot();
		game.state.deckhands[SOURCE_ORDER[0]] = D(5);
		stockHold(game, 1000, 1_000_000);

		game.state.lastUpdate = Date.now() - 3_600_000;
		game.resume();

		const report = game.offlineReport;
		expect(report).not.toBeNull();

		// The modal's coin figure and the balance must agree: the report used to
		// say 11,171 next to a balance of 62,757.
		expect(game.state.coins.toNumber()).toBeCloseTo(report!.coins.toNumber(), 6);
		// And the hold is exactly as the player left it.
		expect(game.state.holdValue.toNumber()).toBe(1_000_000);
		expect(game.state.hold[FishType.Small].toNumber()).toBe(1000);
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
