import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { SCENES } from './scenes';
import { SOURCE_ORDER } from './config';
import { availableTabs, nextStep, nextTabIndex, TABS, TAB_IDS } from './guide';
import { ALL_SPECIES, createInitialState, rarityOf, rarityAt, RARITY_ORDER } from './engine';

describe('scenes', () => {
	it('describes all eight sources', () => {
		for (const source of SOURCE_ORDER) {
			expect(SCENES[source]).toBeDefined();
			expect(SCENES[source].mood.length).toBeGreaterThan(20);
		}
	});

	it('gives every source a palette nothing else uses', () => {
		const palettes = SOURCE_ORDER.map((source) =>
			[...SCENES[source].sky, ...SCENES[source].water].join('|')
		);
		expect(new Set(palettes).size).toBe(SOURCE_ORDER.length);
	});

	it('gives every source a silhouette nothing else uses', () => {
		const shapes = SOURCE_ORDER.map((source) => SCENES[source].features.slice().sort().join('|'));
		expect(new Set(shapes).size).toBe(SOURCE_ORDER.length);
	});

	it('gets deeper and rougher the further out you go', () => {
		for (let i = 1; i < SOURCE_ORDER.length; i++) {
			expect(SCENES[SOURCE_ORDER[i]].depth).toBeGreaterThan(SCENES[SOURCE_ORDER[i - 1]].depth);
		}
		expect(SCENES[FishingSources.Ocean].swell).toBeGreaterThan(SCENES[SOURCE_ORDER[0]].swell);
	});

	it('uses only colours, never an asset path', () => {
		for (const source of SOURCE_ORDER) {
			const scene = SCENES[source];
			for (const colour of [...scene.sky, ...scene.water, scene.shore, scene.accent]) {
				expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
			}
		}
	});
});

describe('rarity', () => {
	it('bands probabilities in order', () => {
		expect(rarityOf(0.5)).toBe('common');
		expect(rarityOf(0.06)).toBe('uncommon');
		expect(rarityOf(0.02)).toBe('rare');
		expect(rarityOf(0.002)).toBe('exotic');
		expect(rarityOf(1e-6)).toBe('mythic');
	});

	it('is monotonic', () => {
		let previous = 0;
		for (const p of [1e-9, 1e-4, 0.005, 0.02, 0.08, 0.4]) {
			const index = RARITY_ORDER.indexOf(rarityOf(p));
			expect(index).toBeLessThanOrEqual(previous === 0 ? 99 : previous);
			previous = index;
		}
	});

	it('calls the Lipfish one in a million wherever it turns up', () => {
		const lipfish = ALL_SPECIES.find((fish) => fish.category === 'Erotic')!;
		for (const source of SOURCE_ORDER) {
			expect(rarityAt(source, 1, lipfish.name)).toBe('mythic');
		}
	});

	it('calls a pond guppy common', () => {
		expect(rarityAt(SOURCE_ORDER[0], 1, 'Guppy')).toBe('common');
	});
});

describe('onboarding', () => {
	it('shows exactly one tab to a brand new player', () => {
		const state = createInitialState();
		const tabs = availableTabs(state);
		expect(tabs).toHaveLength(1);
		expect(tabs[0].id).toBe('water');
	});

	it('opens the gear tab once the player has sold something', () => {
		const state = createInitialState();
		state.lifetimeCoins = D(30);
		expect(availableTabs(state).map((tab) => tab.id)).toContain('gear');
	});

	it('opens the crew tab when a deckhand is within reach', () => {
		const state = createInitialState();
		state.lifetimeCoins = D(400);
		state.coins = D(400);
		expect(availableTabs(state).map((tab) => tab.id)).toContain('crew');
	});

	/**
	 * One species, not two.
	 *
	 * The first catch raises a toast that says "tap to see it", and at a
	 * threshold of two that toast navigated to a tab that did not exist yet.
	 * The first thing the game invites a new player to do cannot be a dead end.
	 */
	it('opens the Fishdex on the very first species', () => {
		const state = createInitialState();
		expect(availableTabs(state).map((tab) => tab.id)).not.toContain('dex');
		state.dex[ALL_SPECIES[0].name] = D(1);
		expect(availableTabs(state).map((tab) => tab.id)).toContain('dex');
	});

	it('ends up showing everything to a player who has done everything', () => {
		const state = createInitialState();
		state.lifetimeCoins = D('1e12');
		state.coins = D('1e12');
		state.totalCasts = D(500);
		state.prestigeCount = D(1);
		state.achievements = ['first_cast'];
		for (const fish of ALL_SPECIES) state.dex[fish.name] = D(1);

		expect(availableTabs(state)).toHaveLength(TABS.length);
	});

	it('gives a brand new player one instruction and no more', () => {
		const step = nextStep(createInitialState());
		expect(step).not.toBeNull();
		expect(step!.text).toMatch(/hold the rod/i);
		expect(step!.text.split('.').filter(Boolean).length).toBeLessThanOrEqual(2);
	});

	it('moves the instruction on as the player progresses', () => {
		const state = createInitialState();
		state.totalCasts = D(3);
		expect(nextStep(state)!.text).toMatch(/sell/i);

		state.lifetimeCoins = D(500);
		state.coins = D(500);
		expect(nextStep(state)!.text).toMatch(/afford/i);
	});

	it('always points somewhere real', () => {
		const state = createInitialState();
		const ids = new Set(TABS.map((tab) => tab.id));

		for (const mutate of [
			() => {},
			() => (state.totalCasts = D(5)),
			() => (state.lifetimeCoins = D(1000)),
			() => (state.coins = D(1000)),
			() => (state.deckhands[SOURCE_ORDER[0]] = D(4)),
			() => SOURCE_ORDER.forEach((s) => (state.unlocked[s] = true))
		]) {
			mutate();
			const step = nextStep(state);
			if (step?.tab) expect(ids.has(step.tab)).toBe(true);
		}
	});
});

describe('tab ids', () => {
	it('TAB_IDS and TABS describe the same set, in the same order', () => {
		expect(TABS.map((tab) => tab.id)).toEqual([...TAB_IDS]);
	});

	it('every nextStep destination is a real tab', () => {
		// The ids used to be bare strings in five files; this is the type made
		// executable, for the states the union alone cannot see.
		const state = createInitialState();
		const seen = new Set<string>();

		for (const coins of ['0', '1', '1e3', '1e6', '1e9', '1e12', '1e15', '1e20']) {
			state.coins = D(coins);
			state.lifetimeCoins = D(coins);
			const step = nextStep(state);
			if (step?.tab) seen.add(step.tab);
		}

		for (const tab of seen) expect(TAB_IDS).toContain(tab);
	});
});

describe('nextTabIndex', () => {
	const count = 8;

	it('walks right and wraps', () => {
		expect(nextTabIndex('ArrowRight', 0, count)).toBe(1);
		expect(nextTabIndex('ArrowRight', 7, count)).toBe(0);
	});

	it('walks left and wraps', () => {
		expect(nextTabIndex('ArrowLeft', 3, count)).toBe(2);
		expect(nextTabIndex('ArrowLeft', 0, count)).toBe(7);
	});

	it('treats the vertical arrows the same way', () => {
		expect(nextTabIndex('ArrowDown', 2, count)).toBe(nextTabIndex('ArrowRight', 2, count));
		expect(nextTabIndex('ArrowUp', 2, count)).toBe(nextTabIndex('ArrowLeft', 2, count));
	});

	it('jumps to the ends', () => {
		expect(nextTabIndex('Home', 5, count)).toBe(0);
		expect(nextTabIndex('End', 5, count)).toBe(7);
	});

	it('ignores every other key, so typing still works', () => {
		for (const key of ['Enter', ' ', 'Tab', 'a', 'Escape', 'PageDown']) {
			expect(nextTabIndex(key, 3, count)).toBeNull();
		}
	});

	it('stays in range for one tab and for none', () => {
		expect(nextTabIndex('ArrowRight', 0, 1)).toBe(0);
		expect(nextTabIndex('End', 0, 1)).toBe(0);
		expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
		expect(nextTabIndex('ArrowRight', -1, count)).toBeNull();
	});

	it('never returns an index outside the strip', () => {
		for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
			for (let i = 0; i < count; i++) {
				const next = nextTabIndex(key, i, count)!;
				expect(next).toBeGreaterThanOrEqual(0);
				expect(next).toBeLessThan(count);
			}
		}
	});
});
