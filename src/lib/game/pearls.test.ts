import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	MAX_OFFLINE_SECONDS,
	needsBoat,
	PEARL_MULTIPLIER_SCALE,
	PRESTIGE_UPGRADES,
	SOURCE_ORDER
} from './config';
import {
	computeModifiers,
	createInitialState,
	offlineSeconds,
	pearlMultiplier,
	startingSourceCount
} from './engine';

/**
 * The prestige chain used to collapse to 46-second runs and stay there. Three
 * mechanical causes were measured, and this file holds one test per cause plus
 * the shape of the fix.
 */
describe('the Pearl bonus is applied once, not squared', () => {
	it('does not touch fishPerCast', () => {
		const bare = createInitialState();
		const rich = createInitialState();
		rich.pearls = D('1e9');

		expect(computeModifiers(rich).fishPerCast.eq(computeModifiers(bare).fishPerCast)).toBe(true);
	});

	it('does touch sellMultiplier, which is where it survives', () => {
		const bare = createInitialState();
		const rich = createInitialState();
		rich.pearls = D('1e9');

		expect(computeModifiers(rich).sellMultiplier.gt(computeModifiers(bare).sellMultiplier)).toBe(
			true
		);
	});

	it('leaves the bucket and the Fishdex alone, which is why sellMultiplier won', () => {
		// `fishPerCast` fills the bucket and drives discovery. A bonus there
		// made both trivial on every run after the first.
		const rich = createInitialState();
		rich.pearls = D('1e30');
		expect(computeModifiers(rich).fishPerCast.toNumber()).toBe(1);
	});
});

describe('the Pearl bonus is logarithmic in the pile', () => {
	it('is 1 at nothing, and never below it', () => {
		expect(pearlMultiplier(D(0)).toNumber()).toBe(1);
		expect(pearlMultiplier(D(-5)).toNumber()).toBe(1);
	});

	it('grows without bound, so the pile never stops mattering', () => {
		const a = pearlMultiplier(D('1e6'));
		const b = pearlMultiplier(D('1e12'));
		const c = pearlMultiplier(D('1e24'));
		expect(b.gt(a)).toBe(true);
		expect(c.gt(b)).toBe(true);
	});

	it('takes a constant step per order of magnitude, which is the whole point', () => {
		// A power law here is what collapsed the chain: the pile grows
		// super-exponentially with run number, so any power of it does too.
		const step = PEARL_MULTIPLIER_SCALE * Math.log(10);
		const a = pearlMultiplier(D('1e10')).toNumber();
		const b = pearlMultiplier(D('1e11')).toNumber();
		expect(b - a).toBeCloseTo(step, 3);
	});

	it('survives a pile far past the double limit without becoming Infinity', () => {
		const huge = pearlMultiplier(D('1e400'));
		expect(huge.isFinite()).toBe(true);
		expect(huge.gt(1_000)).toBe(true);
		expect(huge.lt(10_000)).toBe(true);
	});
});

describe('the Standing Charter leaves a run to play', () => {
	it('stops well short of the whole ladder', () => {
		expect(PRESTIGE_UPGRADES.pearl_headstart.maxLevel).toBeLessThan(SOURCE_ORDER.length - 1);
	});

	it('never opens the Ocean, so a run can never prestige on the first tick', () => {
		const maxed = D(PRESTIGE_UPGRADES.pearl_headstart.maxLevel);
		const opened = startingSourceCount(maxed);

		expect(opened).toBeLessThan(SOURCE_ORDER.length);
		const state = createInitialState({
			prestigeUpgrades: { ...createInitialState().prestigeUpgrades, pearl_headstart: maxed }
		});
		expect(state.unlocked[FishingSources.Ocean]).toBe(false);
	});

	it('leaves the whole back half of the ladder to climb', () => {
		// Four of nine open, five still to buy — and all the water that needs a
		// boat is in the five. Whatever is banked, there is a run to play.
		const opened = startingSourceCount(D(PRESTIGE_UPGRADES.pearl_headstart.maxLevel));
		expect(SOURCE_ORDER.length - opened).toBeGreaterThanOrEqual(4);

		const state = createInitialState({
			prestigeUpgrades: {
				...createInitialState().prestigeUpgrades,
				pearl_headstart: D(PRESTIGE_UPGRADES.pearl_headstart.maxLevel)
			}
		});
		for (const source of SOURCE_ORDER.filter((s) => needsBoat(s))) {
			expect(state.unlocked[source]).toBe(false);
		}
	});
});

describe('the Night Watch buys the night (R54)', () => {
	it('is eight hours before anything is spent', () => {
		expect(offlineSeconds(createInitialState())).toBe(MAX_OFFLINE_SECONDS);
	});

	it('adds an hour a level', () => {
		const state = createInitialState();
		state.prestigeUpgrades.pearl_nightwatch = D(5);
		expect(offlineSeconds(state)).toBe(MAX_OFFLINE_SECONDS + 5 * 3600);
	});

	it('tops out at a full day, which is as long as a number still means anything', () => {
		const state = createInitialState();
		state.prestigeUpgrades.pearl_nightwatch = D(PRESTIGE_UPGRADES.pearl_nightwatch.maxLevel);
		expect(offlineSeconds(state)).toBe(24 * 3600);
	});
});
