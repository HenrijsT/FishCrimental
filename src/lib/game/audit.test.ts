import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	MIN_CAST_SECONDS,
	POACH_GRACE_SECONDS,
	SAVE_KEY,
	SOURCE_CONFIG,
	SOURCE_ORDER
} from './config';
import { createInitialState, rodClampLevel, upgradeDoesNothing } from './engine';
import { canPoach, poachSource } from './police';
import { Game } from './state.svelte';

/**
 * Regression tests for the findings of the independent audit of the fifth pass
 * (`design/VERIFICATION-5.md`). Each one is written to fail against the code as
 * it was, which is the only way to know a fix landed.
 */

class MemoryStorage {
	#items = new Map<string, string>();
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
		this.#items.set(key, value);
	}
	removeItem(key: string): void {
		this.#items.delete(key);
	}
	clear(): void {
		this.#items.clear();
	}
}

let games: Game[];

beforeEach(() => {
	games = [];
	Object.defineProperty(globalThis, 'localStorage', {
		value: new MemoryStorage(),
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
	for (const game of games) game.stop();
	Reflect.deleteProperty(globalThis, 'localStorage');
	Reflect.deleteProperty(globalThis, 'window');
});

function boot(): Game {
	const game = new Game();
	games.push(game);
	game.init();
	return game;
}

describe('resume() does not delete a short absence', () => {
	it('leaves a sub-threshold gap on the clock for tick() to accumulate', () => {
		const game = boot();
		const now = Date.now();

		// Ninety seconds: under the two-minute resume threshold, so nothing is
		// settled — but the time is real and the crew worked it. This used to
		// stamp `lastUpdate = now` regardless, so the gap was simply erased. A
		// phone that suspends the tab takes this path on every wake.
		game.state.lastUpdate = now - 90_000;
		game.resume(now);

		expect(game.state.lastUpdate).toBe(now - 90_000);
	});

	it('and still consumes a gap it actually settled', () => {
		const game = boot();
		const now = Date.now();

		game.state.lastUpdate = now - 10 * 60_000;
		game.resume(now);

		expect(game.state.lastUpdate).toBe(now);
	});
});

describe('the offline settle spends the grace period before busting', () => {
	/** A saved game that was poaching when the tab closed, `awaySeconds` ago. */
	function savedMidPoach(awaySeconds: number): Game {
		const first = boot();
		first.state.mapLevel = D(3);
		const target = SOURCE_ORDER.find((source) => canPoach(first.state, source));
		expect(target).toBeDefined();
		poachSource(first.state, target as FishingSources);
		first.save();
		first.stop();

		// `save()` stamps `lastUpdate` itself, so the absence is back-dated in the
		// stored blob rather than in memory.
		const raw = localStorage.getItem(SAVE_KEY) as string;
		const prefix = raw.slice(0, raw.indexOf('{'));
		const blob = JSON.parse(raw.slice(prefix.length));
		blob.lastUpdate = Date.now() - awaySeconds * 1000;
		localStorage.setItem(SAVE_KEY, prefix + JSON.stringify(blob));

		// A second Game reads that save and settles the gap, which is the path a
		// reload takes. `resume()` cannot reach this case at all: it only settles
		// past two minutes, and the grace is ninety seconds.
		return boot();
	}

	it('does not bust a poacher who was away for less than the grace', () => {
		const game = savedMidPoach(31);

		// The warden had no cause yet. This used to fine, record a permanent
		// offence and lock the player out with fifty-nine seconds still on the
		// clock, because the settle never read `poachElapsed` at all.
		expect(game.state.poaching).not.toBeNull();
		expect(game.state.bustedUntil).toBe(0);
		expect(game.state.poachElapsed).toBeGreaterThanOrEqual(31);
		expect(game.state.poachElapsed).toBeLessThan(POACH_GRACE_SECONDS);
	});

	it('but does bust one who was away for longer', () => {
		const game = savedMidPoach(POACH_GRACE_SECONDS + 60);

		expect(game.state.poaching).toBeNull();
		expect(game.state.bustedUntil).toBeGreaterThan(0);
	});
});

describe('the rod is judged against the water that pays', () => {
	it('is not called inert while the deepest open water is far above the floor', () => {
		const state = createInitialState();
		state.prestigeUpgrades.pearl_speed = D(20);
		state.upgrades.rod = d0();

		// Open water to the Ocean. The old clamp measured `Math.min` over every
		// source — the Mud Pool at 0.95s — so at Tide Reader 20 it declared the
		// rod finished at **level zero**, while the Ocean was still casting eight
		// times slower than the floor and a level was worth several times income.
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;

		const clamp = rodClampLevel(state);
		expect(clamp).toBe(24);
		expect(upgradeDoesNothing(state, 'rod', state.upgrades.rod)).toBe(false);
		expect(upgradeDoesNothing(state, 'rod', D(23))).toBe(false);
		expect(upgradeDoesNothing(state, 'rod', D(24))).toBe(true);
	});

	it('and the clamp really is the floor for that water', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;

		const clamp = rodClampLevel(state) as number;
		const slowest = Math.max(...SOURCE_ORDER.map((source) => SOURCE_CONFIG[source].castSeconds));
		const atClamp = slowest * Math.pow(0.917, clamp);
		const before = slowest * Math.pow(0.917, clamp - 1);

		expect(atClamp).toBeLessThanOrEqual(MIN_CAST_SECONDS + 1e-9);
		expect(before).toBeGreaterThan(MIN_CAST_SECONDS);
	});

	it('still clamps a player who has only ever fished the first water', () => {
		const state = createInitialState();
		state.prestigeUpgrades.pearl_speed = D(20);
		expect(rodClampLevel(state)).toBe(0);
	});

	it('is not flagged at level zero', () => {
		const state = createInitialState();
		expect(upgradeDoesNothing(state, 'rod', d0())).toBe(false);
	});
});
