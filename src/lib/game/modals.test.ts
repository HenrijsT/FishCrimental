import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { Game, MODAL_ORDER } from './state.svelte';

/**
 * The three modals used to be siblings in the page, each mounting its own
 * Escape handler, so one Escape closed all of them and a natural save could
 * lose the offline payment report entirely. `activeModal` is what makes
 * rendering exactly one — and therefore a single Escape handler — correct.
 */

let games: Game[];

beforeEach(() => {
	games = [];
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
});

function boot(): Game {
	const game = new Game();
	games.push(game);
	game.init();
	return game;
}

/** Put an offline report on the game without going near the clock. */
function withOfflineReport(game: Game): void {
	game.state.deckhands[FishingSources.Pond] = D(5);
	game.state.lastUpdate = Date.now() - 3_600_000;
	game.resume();
}

describe('activeModal', () => {
	it('is null on a quiet game', () => {
		expect(boot().activeModal).toBeNull();
	});

	it('names the offline report when one is pending', () => {
		const game = boot();
		withOfflineReport(game);
		expect(game.offlineReport).not.toBeNull();
		expect(game.activeModal).toBe('offline');
	});

	it('shows only one thing even when three are pending', () => {
		const game = boot();
		game.lipfishReveal = true;
		game.prestigeResult = {
			gained: D(3),
			firstTime: true,
			jellyFree: false
		} as NonNullable<Game['prestigeResult']>;
		withOfflineReport(game);

		// All three are outstanding; exactly one is on screen.
		expect(game.offlineReport).not.toBeNull();
		expect(game.prestigeResult).not.toBeNull();
		expect(game.lipfishReveal).toBe(true);
		expect(game.activeModal).toBe('offline');
	});

	it('queues rather than stacks — dismissing reveals the next', () => {
		const game = boot();
		game.lipfishReveal = true;
		game.prestigeResult = {
			gained: D(3),
			firstTime: false,
			jellyFree: false
		} as NonNullable<Game['prestigeResult']>;
		withOfflineReport(game);

		expect(game.activeModal).toBe('offline');
		game.dismissOfflineReport();
		expect(game.activeModal).toBe('prestige');
		game.dismissPrestigeResult();
		expect(game.activeModal).toBe('lipfish');
		game.dismissLipfish();
		expect(game.activeModal).toBeNull();
	});

	it('puts the offline report first, because it is the one that cannot be recovered', () => {
		const game = boot();
		game.lipfishReveal = true;
		withOfflineReport(game);

		// This is the exact collision the audit reproduced: a 9h gap with a crew
		// and no lipfish in the dex raises both at once, and one Escape used to
		// take the payment report with it.
		expect(game.activeModal).toBe('offline');
	});

	it('follows the declared order for every pair', () => {
		for (let i = 0; i < MODAL_ORDER.length; i++) {
			for (let j = i + 1; j < MODAL_ORDER.length; j++) {
				const game = boot();
				const raise = (id: (typeof MODAL_ORDER)[number]) => {
					if (id === 'offline') withOfflineReport(game);
					if (id === 'prestige') {
						game.prestigeResult = {
							gained: D(1),
							firstTime: false,
							jellyFree: false
						} as NonNullable<Game['prestigeResult']>;
					}
					if (id === 'lipfish') game.lipfishReveal = true;
				};
				// Raise the later one first, so order cannot come from timing.
				raise(MODAL_ORDER[j]);
				raise(MODAL_ORDER[i]);
				expect(game.activeModal).toBe(MODAL_ORDER[i]);
			}
		}
	});
});
