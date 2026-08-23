import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	BOAT_UPGRADES,
	BOAT_UPGRADE_IDS,
	SHOPKEEPER_REACH,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS
} from './config';
import {
	affordableUpgradeLevels,
	boatUpgradeCeiling,
	buyBoatUpgrade,
	buyFuel,
	buyUpgrade,
	computeModifiers,
	createInitialState,
	deepestOpenIndex,
	repairBoat,
	upgradeCeiling,
	upgradeStockedAt
} from './engine';
import type { GameState } from './types';

/**
 * Everything up to and including `upTo` is open.
 *
 * One prestige is banked, so the market is trading. Cold Storage is the one
 * track whose ceiling is not only the shopkeeper ladder — it is unavailable
 * outright until the market opens — and these tests are about the ladder.
 * Its gate has a test of its own below.
 */
function openTo(upTo: FishingSources): GameState {
	const state = createInitialState();
	for (const source of SOURCE_ORDER) {
		state.unlocked[source] = true;
		if (source === upTo) break;
	}
	state.coins = D('1e40');
	state.prestigeCount = D(1);
	return state;
}

describe('the reach ladder', () => {
	it('has an entry for every place', () => {
		expect(SHOPKEEPER_REACH).toHaveLength(SOURCE_ORDER.length);
	});

	it('only ever improves', () => {
		for (let i = 1; i < SHOPKEEPER_REACH.length; i++) {
			expect(SHOPKEEPER_REACH[i]).toBeGreaterThan(SHOPKEEPER_REACH[i - 1]);
		}
	});

	it('ends at everything, or a track could never be finished', () => {
		expect(SHOPKEEPER_REACH[SHOPKEEPER_REACH.length - 1]).toBe(1);
		const deepest = openTo(SOURCE_ORDER[SOURCE_ORDER.length - 1]);
		for (const id of UPGRADE_IDS) {
			expect(upgradeCeiling(deepest, id)).toBe(UPGRADES[id].maxLevel);
		}
	});

	it('knows how deep the player has got', () => {
		expect(deepestOpenIndex(createInitialState())).toBe(0);
		expect(deepestOpenIndex(openTo(FishingSources.River))).toBe(3);
	});
});

describe('what a shopkeeper will sell', () => {
	it('is less at the mud pool than at the ocean, for every track', () => {
		const start = openTo(SOURCE_ORDER[0]);
		const end = openTo(SOURCE_ORDER[SOURCE_ORDER.length - 1]);
		for (const id of UPGRADE_IDS) {
			expect(upgradeCeiling(start, id)).toBeLessThan(upgradeCeiling(end, id));
		}
	});

	it('improves every time a new place opens', () => {
		for (const id of UPGRADE_IDS) {
			let previous = -1;
			for (const source of SOURCE_ORDER) {
				const ceiling = upgradeCeiling(openTo(source), id);
				expect(ceiling).toBeGreaterThan(previous);
				previous = ceiling;
			}
		}
	});

	/**
	 * Cold Storage buys depth in a market that is not trading yet.
	 *
	 * Without this the greedy reference player in `balance.ts` buys it during
	 * run 1, where it does nothing at all, and every run-1 pacing figure moves
	 * for no gameplay reason.
	 */
	it('will not sell Cold Storage before the market opens', () => {
		const beforeShift = createInitialState();
		beforeShift.unlocked[FishingSources.Ocean] = true;
		expect(upgradeCeiling(beforeShift, 'storage')).toBe(0);

		beforeShift.prestigeCount = D(1);
		expect(upgradeCeiling(beforeShift, 'storage')).toBeGreaterThan(0);
	});

	it('names where the next tier is stocked', () => {
		const state = createInitialState();
		expect(upgradeStockedAt(state, 'rod')).toBe(SOURCE_ORDER[1]);

		const deepest = openTo(SOURCE_ORDER[SOURCE_ORDER.length - 1]);
		expect(upgradeStockedAt(deepest, 'rod')).toBeNull();
	});
});

describe('the gate is in the engine, not the panel', () => {
	it('refuses to sell past the ceiling however much money is on the table', () => {
		const state = createInitialState();
		state.coins = D('1e40');
		const ceiling = upgradeCeiling(state, 'rod');

		expect(buyUpgrade(state, 'rod', 500).toNumber()).toBe(ceiling);
		expect(state.upgrades.rod.toNumber()).toBe(ceiling);
		expect(buyUpgrade(state, 'rod', 1).toNumber()).toBe(0);
	});

	it('does not offer levels the buy would refuse', () => {
		const state = createInitialState();
		state.coins = D('1e40');
		const ceiling = upgradeCeiling(state, 'rod');

		// This is the whole reason the gate cannot live in the component: the
		// max button reads this, and it used to promise the track's maximum.
		expect(
			affordableUpgradeLevels('rod', state.upgrades.rod, state.coins, ceiling).toNumber()
		).toBe(ceiling);
	});

	it('opens up again the moment a new place does', () => {
		const state = createInitialState();
		state.coins = D('1e40');
		buyUpgrade(state, 'rod', 500);
		const before = state.upgrades.rod.toNumber();

		state.unlocked[FishingSources.Pond] = true;
		expect(buyUpgrade(state, 'rod', 500).toNumber()).toBeGreaterThan(0);
		expect(state.upgrades.rod.toNumber()).toBeGreaterThan(before);
	});

	it('gates the boat yards the same way', () => {
		const state = openTo(FishingSources.Sea);
		state.boat.owned = true;
		for (const id of BOAT_UPGRADE_IDS) {
			const ceiling = boatUpgradeCeiling(state, id);
			expect(ceiling).toBeLessThanOrEqual(BOAT_UPGRADES[id].maxLevel);

			for (let i = 0; i < ceiling; i++) expect(buyBoatUpgrade(state, id)).toBe(true);
			expect(buyBoatUpgrade(state, id)).toBe(false);
		}
	});

	it('NEVER gates fuel or repairs', () => {
		// runBoat buys fuel out of coins inside the offline settle. A gate here
		// would strand the boat while the player slept, which is the one thing
		// this game has repeatedly refused to do.
		const state = createInitialState();
		state.boat.owned = true;
		state.boat.condition = 10;
		state.coins = D('1e12');

		expect(buyFuel(state, computeModifiers(state), D(5)).gt(0)).toBe(true);
		expect(repairBoat(state)).toBe(true);
	});
});

describe('the gate shapes without stalling', () => {
	it('does not bind on a player who keeps moving — price gates harder', () => {
		// Measured: the greedy reference player in balance.ts finishes a run at
		// rod 23 / net 20 / lure 17 / market 21 / crew 16, and reaches every
		// ceiling long after it has already opened the place that lifts it. The
		// first prestige is identical to the second with and without this gate.
		const atStream = openTo(FishingSources.Stream);
		expect(upgradeCeiling(atStream, 'rod')).toBeGreaterThanOrEqual(18);
		expect(upgradeCeiling(atStream, 'market')).toBeGreaterThanOrEqual(20);
	});

	it('does bind on a player who camps in shallow water', () => {
		// Which is the point: it stops you maxing a track in the mud pool and
		// walking into the Ocean already finished.
		const camper = createInitialState();
		camper.coins = D('1e40');
		for (const id of UPGRADE_IDS) {
			buyUpgrade(camper, id, 1000);
			expect(camper.upgrades[id].toNumber()).toBeLessThan(UPGRADES[id].maxLevel);
			expect(camper.upgrades[id].toNumber()).toBe(upgradeCeiling(camper, id));
		}
	});
});
