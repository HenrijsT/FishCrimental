import { beforeEach, describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, FishType, fishTypeBaseValue } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { SOURCE_CONFIG, SOURCE_ORDER } from './config';
import {
	ALL_SPECIES,
	accumulate,
	buyDeckhand,
	buyUpgrade,
	canPrestige,
	catchTable,
	clearCatchTableCache,
	computeModifiers,
	createInitialState,
	dexMultiplier,
	discoveredCount,
	eroticCaught,
	holdCount,
	jellyCaught,
	pearlsFor,
	performCast,
	performPrestige,
	sellHold,
	unlockSource
} from './engine';
import type { GameState } from './types';

function fresh(): GameState {
	clearCatchTableCache();
	return createInitialState();
}

describe('catch tables', () => {
	it('sum to a probability of one for every source', () => {
		for (const source of SOURCE_ORDER) {
			const table = catchTable(source, 1);
			const total = table.species.reduce((sum, entry) => sum + entry.probability, 0);
			expect(total).toBeCloseTo(1, 10);
		}
	});

	it('only contain species that live in the source', () => {
		for (const source of SOURCE_ORDER) {
			for (const { fish } of catchTable(source, 1).species) {
				expect(fish.sources).toContain(source);
			}
		}
	});

	it('never offer a type the source has no weight for', () => {
		for (const source of SOURCE_ORDER) {
			const allowed = Object.keys(SOURCE_CONFIG[source].typeWeights);
			for (const type of catchTable(source, 1).typeProbability.keys()) {
				expect(allowed).toContain(type);
			}
		}
	});

	it('shifts weight toward rare types as luck rises', () => {
		const plain = catchTable(FishingSources.Ocean, 1);
		const lucky = catchTable(FishingSources.Ocean, 8);

		const sharkPlain = plain.typeProbability.get(FishType.Shark) ?? 0;
		const sharkLucky = lucky.typeProbability.get(FishType.Shark) ?? 0;
		expect(sharkLucky).toBeGreaterThan(sharkPlain);

		const jellyPlain = plain.typeProbability.get(FishType.Jelly) ?? 0;
		const jellyLucky = lucky.typeProbability.get(FishType.Jelly) ?? 0;
		expect(jellyLucky).toBeLessThan(jellyPlain);

		expect(lucky.averageValue).toBeGreaterThan(plain.averageValue);
	});

	it('makes the Lovestruck Lipfish absurdly rare everywhere', () => {
		for (const source of SOURCE_ORDER) {
			const table = catchTable(source, 1);
			const lipfish = table.species.find((entry) => entry.fish.category === FishType.Erotic);
			expect(lipfish).toBeDefined();
			expect(lipfish!.probability).toBeLessThan(1e-5);
			expect(lipfish!.probability).toBeGreaterThan(0);
		}
	});

	it('pays nothing at all for jellyfish', () => {
		expect(fishTypeBaseValue[FishType.Jelly]).toBe(0);
	});

	it('gets deeper water paying far better per cast', () => {
		const pond = catchTable(FishingSources.Pond, 1).averageSourceValue;
		const ocean = catchTable(FishingSources.Ocean, 1).averageSourceValue;
		expect(ocean / pond).toBeGreaterThan(1000);
	});
});

describe('casting', () => {
	let state: GameState;
	beforeEach(() => {
		state = fresh();
	});

	it('lands fish, fills the hold and credits the Fishdex', () => {
		const modifiers = computeModifiers(state);
		performCast(state, FishingSources.Pond, modifiers, () => 0.5);

		expect(state.totalCasts.eq(1)).toBe(true);
		expect(state.totalFish.gte(1)).toBe(true);
		expect(holdCount(state).gte(1)).toBe(true);
		expect(state.holdValue.gt(0)).toBe(true);
		expect(Object.keys(state.dex).length).toBeGreaterThan(0);
	});

	it('is deterministic for a fixed roll', () => {
		const modifiers = computeModifiers(state);
		const a = performCast(state, FishingSources.Pond, modifiers, () => 0.25);
		const b = performCast(fresh(), FishingSources.Pond, modifiers, () => 0.25);
		expect([...a.caught.keys()][0].name).toBe([...b.caught.keys()][0].name);
	});
});

describe('accumulation', () => {
	let state: GameState;
	beforeEach(() => {
		state = fresh();
		state.deckhands[FishingSources.Pond] = D(10);
	});

	it('produces nothing without a crew', () => {
		const empty = fresh();
		const result = accumulate(empty, computeModifiers(empty), 3600);
		expect(result.fish.eq(0)).toBe(true);
	});

	it('scales linearly with elapsed time', () => {
		// Catches are whole fish, so a single short window is quantised. Over a
		// long window the quantisation error is bounded by one fish per species.
		const modifiers = computeModifiers(state);
		const short = accumulate(state, modifiers, 6000);
		const long = accumulate(state, modifiers, 60000);

		expect(long.fish.div(short.fish).toNumber()).toBeCloseTo(10, 1);
		expect(long.value.div(short.value).toNumber()).toBeCloseTo(10, 1);
	});

	it('matches one long step against many short ones', () => {
		// The carry bank is what makes this true: whatever a short step cannot
		// pay out in whole fish is banked and paid by a later one.
		const modifiers = computeModifiers(state);
		const oneStep = accumulate(state, modifiers, 1000);

		const stepwise = fresh();
		stepwise.deckhands[FishingSources.Pond] = D(10);
		let total = d0();
		for (let i = 0; i < 1000; i++) {
			total = total.plus(accumulate(stepwise, modifiers, 1).fish);
		}

		expect(total.div(oneStep.fish).toNumber()).toBeCloseTo(1, 2);
	});

	it('never puts a fraction of a fish anywhere', () => {
		const modifiers = computeModifiers(state);
		accumulate(state, modifiers, 137.4);

		for (const type of FISH_TYPES) {
			expect(state.hold[type].eq(state.hold[type].floor())).toBe(true);
		}
		for (const count of Object.values(state.dex)) {
			expect(count.eq(count.floor())).toBe(true);
		}
		expect(state.totalFish.eq(state.totalFish.floor())).toBe(true);
		expect(state.totalCasts.eq(state.totalCasts.floor())).toBe(true);
	});

	it('honours the offline efficiency factor', () => {
		const modifiers = computeModifiers(state);
		const full = accumulate(state, modifiers, 100, 1);
		const reduced = accumulate(fresh(), modifiers, 100, 0.5);
		expect(reduced.fish.lt(full.fish)).toBe(true);
	});

	it('only counts sources that are actually unlocked', () => {
		state.deckhands[FishingSources.Ocean] = D(1000);
		const modifiers = computeModifiers(state);
		const before = state.totalFish;
		accumulate(state, modifiers, 10);
		const withLockedOcean = state.totalFish.minus(before);

		const unlocked = fresh();
		unlocked.deckhands[FishingSources.Pond] = D(10);
		unlocked.deckhands[FishingSources.Ocean] = D(1000);
		unlocked.unlocked[FishingSources.Ocean] = true;
		accumulate(unlocked, computeModifiers(unlocked), 10);

		expect(unlocked.totalFish.gt(withLockedOcean)).toBe(true);
	});
});

describe('selling', () => {
	it('converts the hold into coins and empties it', () => {
		const state = fresh();
		state.deckhands[FishingSources.Pond] = D(5);
		const modifiers = computeModifiers(state);
		accumulate(state, modifiers, 120);

		const expected = state.holdValue.times(modifiers.sellMultiplier);
		const earned = sellHold(state, modifiers);

		expect(earned.eq(expected)).toBe(true);
		expect(state.coins.eq(earned)).toBe(true);
		expect(state.lifetimeCoins.eq(earned)).toBe(true);
		expect(state.holdValue.eq(0)).toBe(true);
		for (const type of FISH_TYPES) expect(state.hold[type].eq(0)).toBe(true);
	});

	it('is a no-op on an empty hold', () => {
		const state = fresh();
		expect(sellHold(state, computeModifiers(state)).eq(0)).toBe(true);
		expect(state.coins.eq(0)).toBe(true);
	});
});

describe('buying', () => {
	it('refuses what the player cannot afford', () => {
		const state = fresh();
		expect(buyUpgrade(state, 'rod', 1).eq(0)).toBe(true);
		expect(state.upgrades.rod.eq(0)).toBe(true);
	});

	it('buys levels and charges for them', () => {
		const state = fresh();
		state.coins = D(1e9);
		const before = state.coins;
		const bought = buyUpgrade(state, 'rod', 5);

		expect(bought.eq(5)).toBe(true);
		expect(state.upgrades.rod.eq(5)).toBe(true);
		expect(state.coins.lt(before)).toBe(true);
	});

	it('caps at the upgrade max level', () => {
		const state = fresh();
		state.coins = D('1e300');
		buyUpgrade(state, 'rod', 10_000);
		expect(state.upgrades.rod.toNumber()).toBeLessThanOrEqual(70);
	});

	it('will not hire crew for locked water', () => {
		const state = fresh();
		state.coins = D('1e30');
		expect(buyDeckhand(state, FishingSources.Ocean, 1).eq(0)).toBe(true);
	});

	it('makes casts faster and catches bigger', () => {
		const state = fresh();
		state.coins = D(1e12);
		const before = computeModifiers(state);

		buyUpgrade(state, 'rod', 10);
		buyUpgrade(state, 'net', 10);
		const after = computeModifiers(state);

		expect(after.castSeconds[FishingSources.Pond]).toBeLessThan(
			before.castSeconds[FishingSources.Pond]
		);
		expect(after.fishPerCast.gt(before.fishPerCast)).toBe(true);
	});
});

describe('sources', () => {
	it('unlock strictly in order', () => {
		const state = fresh();
		state.coins = D('1e30');
		expect(unlockSource(state, FishingSources.River)).toBe(false);
		expect(unlockSource(state, FishingSources.Stream)).toBe(true);
		expect(unlockSource(state, FishingSources.River)).toBe(true);
	});
});

describe('the Fishdex', () => {
	it('counts a species once it has been landed', () => {
		const state = fresh();
		expect(discoveredCount(state)).toBe(0);

		state.dex[ALL_SPECIES[0].name] = D(1);
		expect(discoveredCount(state)).toBe(1);

		state.dex[ALL_SPECIES[1].name] = D(0.4);
		expect(discoveredCount(state)).toBe(1);
	});

	it('pays a permanent bonus that grows with discoveries', () => {
		const state = fresh();
		const base = dexMultiplier(state);
		for (const fish of ALL_SPECIES) state.dex[fish.name] = D(1);
		expect(dexMultiplier(state).gt(base)).toBe(true);
		expect(dexMultiplier(state).toNumber()).toBeGreaterThan(1.5);
	});

	it('separates the two joke categories out of the dex counts', () => {
		const state = fresh();
		expect(jellyCaught(state).eq(0)).toBe(true);
		expect(eroticCaught(state).eq(0)).toBe(true);

		for (const fish of ALL_SPECIES) {
			if (fish.category === FishType.Jelly) state.dex[fish.name] = D(7);
			if (fish.category === FishType.Erotic) state.dex[fish.name] = D(1);
		}

		expect(jellyCaught(state).gte(7)).toBe(true);
		expect(eroticCaught(state).eq(1)).toBe(true);
	});
});

describe('prestige', () => {
	it('needs the Ocean and a big enough lifetime', () => {
		const state = fresh();
		state.lifetimeCoins = D('1e20');
		expect(canPrestige(state)).toBe(false);

		state.unlocked[FishingSources.Ocean] = true;
		expect(canPrestige(state)).toBe(true);

		state.lifetimeCoins = D('1e14');
		expect(canPrestige(state)).toBe(false);
	});

	it('prices Pearls off lifetime earnings', () => {
		expect(pearlsFor(D('1e14')).eq(0)).toBe(true);
		expect(pearlsFor(D('1e15')).eq(1)).toBe(true);
		expect(pearlsFor(D('1e18')).gt(pearlsFor(D('1e16')))).toBe(true);
		expect(pearlsFor(D('1e30')).gt(1000)).toBe(true);
	});

	it('resets the run but keeps the Fishdex, Pearls and achievements', () => {
		const state = fresh();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e18');
		state.coins = D('1e17');
		state.upgrades.rod = D(30);
		state.deckhands[FishingSources.Pond] = D(50);
		state.dex[ALL_SPECIES[0].name] = D(12);
		state.achievements = ['first_cast'];

		const result = performPrestige(state);

		expect(result).not.toBeNull();
		expect(result!.firstTime).toBe(true);
		expect(state.coins.eq(0)).toBe(true);
		expect(state.lifetimeCoins.eq(0)).toBe(true);
		expect(state.upgrades.rod.eq(0)).toBe(true);
		expect(state.deckhands[FishingSources.Pond].eq(0)).toBe(true);
		expect(state.unlocked[FishingSources.Ocean]).toBe(false);
		expect(state.dex[ALL_SPECIES[0].name].eq(12)).toBe(true);
		expect(state.pearls.gt(0)).toBe(true);
		expect(state.achievements).toContain('first_cast');
		expect(state.completed).toBe(true);
	});

	it('reports a jelly-free run', () => {
		const state = fresh();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		expect(performPrestige(state)!.jellyFree).toBe(true);

		const jellied = fresh();
		jellied.unlocked[FishingSources.Ocean] = true;
		jellied.lifetimeCoins = D('1e16');
		for (const fish of ALL_SPECIES) {
			if (fish.category === FishType.Jelly) jellied.dex[fish.name] = D(3);
		}
		expect(performPrestige(jellied)!.jellyFree).toBe(false);
	});

	it('makes everything permanently better afterwards', () => {
		const before = fresh();
		const after = fresh();
		after.pearls = D(400);

		expect(computeModifiers(after).sellMultiplier.gt(computeModifiers(before).sellMultiplier)).toBe(
			true
		);
		expect(computeModifiers(after).fishPerCast.gt(computeModifiers(before).fishPerCast)).toBe(true);
	});

	it('opens extra water with the Standing Charter', () => {
		const state = fresh();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		state.prestigeUpgrades.pearl_headstart = D(2);

		performPrestige(state);

		expect(state.unlocked[SOURCE_ORDER[1]]).toBe(true);
		expect(state.unlocked[SOURCE_ORDER[2]]).toBe(true);
		expect(state.unlocked[SOURCE_ORDER[3]]).toBe(false);
	});
});
