import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	AUTO_FISHER,
	AUTO_FISHER_OFFLINE_COST,
	AUTO_FISHER_START,
	UPGRADES,
	SOURCE_ORDER
} from './config';
import {
	accumulate,
	autoFisherCastsPerSecond,
	autoFisherCost,
	autoFisherFraction,
	buyAutoFisher,
	buyAutoFisherOffline,
	computeModifiers,
	createInitialState
} from './engine';
import type { GameState } from './types';

function withRig(level: number): GameState {
	const state = createInitialState();
	state.autoFisher = D(level);
	// Not a bucket test: an Assistant is the in-game way to say the hold is
	// unlimited, so these assertions are about accumulation and nothing else.
	state.hasAssistant = true;
	return state;
}

/** Coins the hold gains over `seconds`, with the rig running for `share` of it. */
function earn(state: GameState, seconds: number, share: number): number {
	const modifiers = computeModifiers(state);
	const before = state.holdValue;
	accumulate(state, modifiers, seconds, 1, undefined, () => 0.5, share);
	return state.holdValue.minus(before).toNumber();
}

describe('the speed ladder', () => {
	it('does nothing at all until it is bought', () => {
		expect(autoFisherFraction(0)).toBe(0);
		expect(autoFisherFraction(-3)).toBe(0);
		expect(
			autoFisherCastsPerSecond(createInitialState(), computeModifiers(createInitialState())).eq(0)
		).toBe(true);
	});

	it('starts at the documented fraction of a human', () => {
		expect(autoFisherFraction(1)).toBeCloseTo(AUTO_FISHER_START, 12);
	});

	it('reaches exactly human speed at the top level, and never passes it', () => {
		// Exactly 1, not 0.9999 and not 1.0001 — the formula is x^0 at the top.
		expect(autoFisherFraction(AUTO_FISHER.maxLevel)).toBe(1);
		expect(autoFisherFraction(AUTO_FISHER.maxLevel + 50)).toBe(1);
	});

	it('climbs, and never falls back', () => {
		let previous = 0;
		for (let level = 1; level <= AUTO_FISHER.maxLevel; level++) {
			const fraction = autoFisherFraction(level);
			expect(fraction).toBeGreaterThan(previous);
			expect(fraction).toBeLessThanOrEqual(1);
			previous = fraction;
		}
	});

	it('starts slower than a human by a factor inside the brief 2x-10x band', () => {
		expect(1 / autoFisherFraction(1)).toBeGreaterThanOrEqual(2);
		expect(1 / autoFisherFraction(1)).toBeLessThanOrEqual(10);
	});

	it('matches the human cast rate at the top level, at every source', () => {
		for (const source of Object.values(FishingSources)) {
			const state = withRig(AUTO_FISHER.maxLevel);
			state.unlocked[source] = true;
			state.activeSource = source;
			const modifiers = computeModifiers(state);

			const human = 1 / modifiers.castSeconds[source];
			expect(autoFisherCastsPerSecond(state, modifiers).toNumber()).toBeCloseTo(human, 9);
		}
	});

	it('tracks the rod upgrade, because it holds the same rod', () => {
		const slow = withRig(AUTO_FISHER.maxLevel);
		const fast = withRig(AUTO_FISHER.maxLevel);
		fast.upgrades.rod = D(10);

		const slowRate = autoFisherCastsPerSecond(slow, computeModifiers(slow));
		const fastRate = autoFisherCastsPerSecond(fast, computeModifiers(fast));
		expect(fastRate.gt(slowRate)).toBe(true);
	});
});

describe('buying it', () => {
	it('refuses when the coins are not there', () => {
		const state = createInitialState();
		state.coins = autoFisherCost(0).minus(1);
		expect(buyAutoFisher(state)).toBe(false);
		expect(state.autoFisher.eq(0)).toBe(true);
	});

	it('takes the coins and gives the level', () => {
		const state = createInitialState();
		state.coins = autoFisherCost(0);
		expect(buyAutoFisher(state)).toBe(true);
		expect(state.autoFisher.eq(1)).toBe(true);
		expect(state.coins.eq(0)).toBe(true);
	});

	it('stops at the top level', () => {
		const state = withRig(AUTO_FISHER.maxLevel);
		state.coins = D('1e60');
		expect(buyAutoFisher(state)).toBe(false);
		expect(state.autoFisher.eq(AUTO_FISHER.maxLevel)).toBe(true);
	});

	it('prices on a curve inside the band the gear tracks use', () => {
		const gearGrowth = Object.values(UPGRADES).map((u) => u.costGrowth);
		expect(AUTO_FISHER.costGrowth).toBeGreaterThanOrEqual(Math.min(...gearGrowth));
		expect(AUTO_FISHER.costGrowth).toBeLessThanOrEqual(Math.max(...gearGrowth));
	});

	it('costs strictly more at every level', () => {
		for (let level = 0; level < AUTO_FISHER.maxLevel; level++) {
			expect(autoFisherCost(level + 1).gt(autoFisherCost(level))).toBe(true);
		}
	});
});

describe('the offline purchase', () => {
	it('cannot be bought before the rig itself', () => {
		const state = createInitialState();
		state.coins = D('1e30');
		expect(buyAutoFisherOffline(state)).toBe(false);
		expect(state.autoFisherOffline).toBe(false);
	});

	it('is bought once and only once', () => {
		const state = withRig(1);
		state.coins = D(AUTO_FISHER_OFFLINE_COST).times(3);
		expect(buyAutoFisherOffline(state)).toBe(true);
		expect(state.autoFisherOffline).toBe(true);
		expect(buyAutoFisherOffline(state)).toBe(false);
		// Charged exactly once.
		expect(state.coins.eq(D(AUTO_FISHER_OFFLINE_COST).times(2))).toBe(true);
	});

	it('is dear enough to be a real decision — dearer than opening the Ocean', () => {
		expect(AUTO_FISHER_OFFLINE_COST).toBeGreaterThan(1.64e11);
	});
});

describe('what it actually lands', () => {
	it('earns nothing while the player is holding the rod themselves', () => {
		const state = withRig(AUTO_FISHER.maxLevel);
		expect(earn(state, 600, 0)).toBeCloseTo(0, 12);
		expect(state.totalCasts.eq(0)).toBe(true);
	});

	it('earns while the player is not', () => {
		const state = withRig(AUTO_FISHER.maxLevel);
		expect(earn(state, 600, 1)).toBeGreaterThan(0);
	});

	it('pays a rig cast exactly what it pays a hand cast — R14 parity', () => {
		// Same rate, same water, same everything: the only difference is which
		// code path minted the casts. They must not differ.
		const byHand = withRig(0);
		const byRig = withRig(AUTO_FISHER.maxLevel);
		const modifiers = computeModifiers(byHand);
		const humanRate = 1 / modifiers.castSeconds[byHand.activeSource];

		accumulate(byHand, modifiers, 3600, 1, { [byHand.activeSource]: humanRate }, () => 0.5, 0);
		accumulate(byRig, computeModifiers(byRig), 3600, 1, undefined, () => 0.5, 1);

		const hand = byHand.holdValue.toNumber();
		const rig = byRig.holdValue.toNumber();
		expect(rig).toBeGreaterThan(0);
		// Within a single cast's worth — the two bank their remainders separately.
		expect(Math.abs(rig - hand) / hand).toBeLessThan(0.001);
	});

	it('scales linearly with the share of the interval it worked', () => {
		const full = earn(withRig(AUTO_FISHER.maxLevel), 3600, 1);
		const half = earn(withRig(AUTO_FISHER.maxLevel), 3600, 0.5);
		expect(half / full).toBeGreaterThan(0.49);
		expect(half / full).toBeLessThan(0.51);
	});

	it('banks its remainders under its own key, not the crew’s', () => {
		const state = withRig(1);
		state.deckhands[SOURCE_ORDER[0]] = D(3);
		accumulate(state, computeModifiers(state), 0.2, 1, undefined, () => 0.5, 1);

		expect(Object.keys(state.carry)).toContain('autofisher#casts');
		// And the crew's own cast bank is still separate.
		expect(Object.keys(state.carry).some((key) => key === `${SOURCE_ORDER[0]}#casts`)).toBe(true);
	});

	it('never mints a fraction of a fish', () => {
		const state = withRig(6);
		for (let i = 0; i < 500; i++) {
			accumulate(state, computeModifiers(state), 0.2, 1, undefined, () => 0.5, 1);
		}
		for (const amount of Object.values(state.hold)) {
			expect(amount.eq(amount.floor())).toBe(true);
		}
		expect(state.totalCasts.eq(state.totalCasts.floor())).toBe(true);
	});

	it('lands the same casts in one step as in many', () => {
		// Casts and fish are what the remainder bank guarantees. Value is not
		// comparable across the two paths here: a 3600-second step is one bulk
		// draw split by expected share, while 3600 one-second steps are rolled
		// individually, and a constant RNG makes every individual roll pick the
		// same species. That is a property of the test's RNG, not of the rig.
		const oneStep = withRig(8);
		const manySteps = withRig(8);

		accumulate(oneStep, computeModifiers(oneStep), 3600, 1, undefined, () => 0.5, 1);
		for (let i = 0; i < 3600; i++) {
			accumulate(manySteps, computeModifiers(manySteps), 1, 1, undefined, () => 0.5, 1);
		}

		expect(oneStep.totalCasts.minus(manySteps.totalCasts).abs().lte(1)).toBe(true);

		const a = oneStep.totalFish.toNumber();
		const b = manySteps.totalFish.toNumber();
		expect(a).toBeGreaterThan(0);
		expect(Math.abs(a - b) / a).toBeLessThan(0.01);
	});

	it('does not fish water the player has no licence for', () => {
		const state = withRig(AUTO_FISHER.maxLevel);
		state.unlocked[FishingSources.River] = true;
		state.activeSource = FishingSources.River;
		state.licences.inland = false;

		expect(earn(state, 600, 1)).toBeCloseTo(0, 12);
		expect(state.totalCasts.eq(0)).toBe(true);
	});

	it('falls back inshore when the boat cannot sail, exactly as a hand cast does', () => {
		const state = withRig(AUTO_FISHER.maxLevel);
		for (const source of Object.values(FishingSources)) state.unlocked[source] = true;
		for (const id of ['inland', 'lakes', 'coastal', 'deep'] as const) state.licences[id] = true;
		state.activeSource = FishingSources.Ocean;
		state.boat.owned = true;
		state.boat.fuel = d0();

		// Nothing is lost — the rig works the shore instead of stopping.
		expect(earn(state, 600, 1)).toBeGreaterThan(0);
	});
});

describe('resets', () => {
	it('is a coin purchase, so a prestige takes it', () => {
		const fresh = createInitialState({
			pearls: D(50),
			dex: {},
			allTimePearls: D(50),
			allTimeCoins: D('1e20'),
			prestigeCount: D(1),
			achievements: []
		});
		expect(fresh.autoFisher.eq(0)).toBe(true);
		expect(fresh.autoFisherOffline).toBe(false);
	});
});
