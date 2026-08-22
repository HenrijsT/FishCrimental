import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, fishTypeBaseValue } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { SOURCE_CONFIG, SOURCE_ORDER } from './config';
import { seededRandom } from './balance';
import {
	accumulate,
	buyUpgrade,
	catchTable,
	clearCatchTableCache,
	computeModifiers,
	createInitialState,
	distributeCatch,
	performCast,
	takeWhole
} from './engine';
import type { GameState } from './types';

/**
 * The catch model, and the property that justifies it.
 *
 * Every count in the game is a whole number. Fractional rates are resolved by
 * banking the remainder rather than by rounding or by rolling dice, which makes
 * the payout exactly unbiased, identical for manual and automatic fishing, and
 * computable in one step for eight hours of absence.
 */

describe('takeWhole is exactly unbiased', () => {
	it('pays out the true total, to within the un-banked remainder', () => {
		for (const rate of [0.1, 0.19, 0.5, 1.19, 1.5, 2.718, 7.77]) {
			const state = createInitialState();
			let paid = d0();
			const draws = 100_000;

			for (let i = 0; i < draws; i++) {
				paid = paid.plus(takeWhole(state, 'test', D(rate)));
			}

			// The exact invariant: everything owed has either been paid out or is
			// still sitting in the bank. Nothing is created and nothing is lost.
			const banked = state.carry.test ?? 0;
			expect(paid.toNumber() + banked).toBeCloseTo(rate * draws, 3);
			expect(banked).toBeGreaterThanOrEqual(0);
			expect(banked).toBeLessThan(1);
		}
	});

	it('has no drift at all — the error does not grow with sample size', () => {
		const state = createInitialState();
		let paid = d0();
		const errors: number[] = [];

		for (let i = 1; i <= 200_000; i++) {
			paid = paid.plus(takeWhole(state, 'drift', D(1.19)));
			if (i % 20_000 === 0) {
				errors.push(Math.abs(paid.toNumber() + (state.carry.drift ?? 0) - 1.19 * i));
			}
		}

		// The error is bounded and flat, not growing with the sample.
		for (const error of errors) expect(error).toBeLessThan(0.001);
		expect(errors[errors.length - 1]).toBeLessThanOrEqual(errors[0] + 0.001);
	});

	it('produces exactly the promised mix — 1.19 is nine 1s and one 2, near enough', () => {
		const state = createInitialState();
		const counts = new Map<number, number>();

		for (let i = 0; i < 10_000; i++) {
			const n = takeWhole(state, 'mix', D(1.19)).toNumber();
			counts.set(n, (counts.get(n) ?? 0) + 1);
		}

		expect([...counts.keys()].sort()).toEqual([1, 2]);
		expect((counts.get(2) ?? 0) / 10_000).toBeCloseTo(0.19, 2);
	});

	it('only ever returns whole numbers', () => {
		const state = createInitialState();
		for (const rate of [0.03, 0.97, 1.0001, 12.5]) {
			for (let i = 0; i < 500; i++) {
				const n = takeWhole(state, `w-${rate}`, D(rate));
				expect(n.eq(n.floor())).toBe(true);
				expect(n.gte(0)).toBe(true);
			}
		}
	});

	it('keeps the bank a bank — every entry is a fraction', () => {
		const state = createInitialState();
		for (let i = 0; i < 1000; i++) takeWhole(state, `k-${i % 7}`, D(0.37));

		for (const value of Object.values(state.carry)) {
			expect(value).toBeGreaterThan(0);
			expect(value).toBeLessThan(1);
		}
	});

	it('stops banking once the fractional part stops being representable', () => {
		const state = createInitialState();
		const huge = D('1e30');
		expect(takeWhole(state, 'huge', huge).eq(huge)).toBe(true);
		expect(state.carry.huge).toBeUndefined();
	});
});

describe('species come out in the right proportion', () => {
	it('matches the catch table over a large sample, on the rolled path', () => {
		clearCatchTableCache();
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		const table = catchTable(FishingSources.Pond, modifiers.luck);
		const random = seededRandom(20260822);

		const casts = 120_000;
		for (let i = 0; i < casts; i++) {
			distributeCatch(state, FishingSources.Pond, D(1), modifiers, random);
		}

		for (const { fish, probability } of table.species) {
			if (probability < 0.005) continue;
			const observed = (state.dex[fish.name] ?? d0()).toNumber() / casts;
			expect(Math.abs(observed - probability), `${fish.name}`).toBeLessThan(0.006);
		}
	});

	it('matches the catch table on the bulk path too', () => {
		clearCatchTableCache();
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		const table = catchTable(FishingSources.Pond, modifiers.luck);

		const fish = 500_000;
		distributeCatch(state, FishingSources.Pond, D(fish), modifiers, () => 0.5);

		for (const { fish: species, probability } of table.species) {
			if (probability < 0.005) continue;
			const observed = (state.dex[species.name] ?? d0()).toNumber() / fish;
			expect(Math.abs(observed - probability), `${species.name}`).toBeLessThan(0.002);
		}
	});

	it('lands the one-in-a-million fish at about one in a million', () => {
		clearCatchTableCache();
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		const table = catchTable(FishingSources.Pond, modifiers.luck);
		const lipfish = table.species.find((entry) => entry.fish.category === 'Erotic')!;

		distributeCatch(state, FishingSources.Pond, D(50_000_000), modifiers, () => 0.5);

		const observed = state.dex[lipfish.fish.name].toNumber() / 50_000_000;
		expect(observed).toBeGreaterThan(lipfish.probability * 0.9);
		expect(observed).toBeLessThan(lipfish.probability * 1.1);
	});
});

describe('manual and automatic fishing pay the same', () => {
	function withNet(levels: number): GameState {
		const state = createInitialState();
		state.coins = D('1e12');
		buyUpgrade(state, 'net', levels);
		state.coins = d0();
		// Not a bucket test — the hold is unlimited so the maths is visible.
		state.hasAssistant = true;
		return state;
	}

	it('to within a fish, over ten thousand casts', () => {
		clearCatchTableCache();

		const manual = withNet(4);
		const manualModifiers = computeModifiers(manual);
		const random = seededRandom(99);
		for (let i = 0; i < 10_000; i++) {
			performCast(manual, FishingSources.Pond, manualModifiers, random);
		}

		// The same number of casts, delivered by a crew in one accumulate call.
		const auto = withNet(4);
		auto.deckhands[FishingSources.Pond] = D(1);
		const autoModifiers = computeModifiers(auto);
		const castsPerSecond = autoModifiers.deckhandCastsPerSecond[FishingSources.Pond];
		accumulate(auto, autoModifiers, 10_000 / castsPerSecond, 1, undefined, seededRandom(99));

		const expected = manualModifiers.fishPerCast.times(10_000);
		expect(manual.totalFish.div(expected).toNumber()).toBeCloseTo(1, 3);
		expect(auto.totalFish.div(expected).toNumber()).toBeCloseTo(1, 3);
		expect(auto.totalFish.div(manual.totalFish).toNumber()).toBeCloseTo(1, 3);
	});

	it('and pay the same coins per cast', () => {
		clearCatchTableCache();

		const manual = withNet(2);
		const manualModifiers = computeModifiers(manual);
		const random = seededRandom(7);
		for (let i = 0; i < 20_000; i++) {
			performCast(manual, FishingSources.Pond, manualModifiers, random);
		}
		const manualPerCast = manual.holdValue.div(manual.totalCasts).toNumber();

		const auto = withNet(2);
		auto.deckhands[FishingSources.Pond] = D(20);
		const autoModifiers = computeModifiers(auto);
		accumulate(auto, autoModifiers, 20_000, 1, undefined, seededRandom(7));
		const autoPerCast = auto.holdValue.div(auto.totalCasts).toNumber();

		// Manual fishing rolls real fish, so it carries sampling noise that the
		// bulk path does not. The means agree; the variance is the point of
		// rolling in the first place.
		expect(Math.abs(autoPerCast / manualPerCast - 1)).toBeLessThan(0.03);
	});

	it('uses one code path for both, so they cannot drift apart', () => {
		// performCast and accumulate both go through distributeCatch. If that
		// ever stops being true this test is the one that should be deleted
		// deliberately rather than quietly.
		expect(performCast.toString()).toContain('distributeCatch');
		expect(accumulate.toString()).toContain('distributeCatch');
	});
});

describe('eight hours away resolves in one step', () => {
	it('does not loop per cast — a trillion casts still returns instantly', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) {
			state.unlocked[source] = true;
			state.deckhands[source] = D('1e9');
		}
		state.licences.inland = true;
		state.licences.lakes = true;
		state.licences.coastal = true;
		state.licences.deep = true;
		state.boat.owned = true;
		state.boat.fuel = D('1e30');
		// Not a bucket test — a billion fish need somewhere to go.
		state.hasAssistant = true;

		const modifiers = computeModifiers(state);
		const started = performance.now();
		const result = accumulate(state, modifiers, 8 * 3600);
		const elapsed = performance.now() - started;

		expect(result.fish.gt('1e9')).toBe(true);
		expect(elapsed).toBeLessThan(250);
	});

	it('gives the same answer as the same time in small pieces', () => {
		const build = () => {
			const state = createInitialState();
			state.deckhands[FishingSources.Pond] = D(25);
			return state;
		};

		const oneStep = build();
		accumulate(oneStep, computeModifiers(oneStep), 8 * 3600, 1, undefined, () => 0.5);

		const pieces = build();
		const modifiers = computeModifiers(pieces);
		for (let i = 0; i < 8 * 60; i++) {
			accumulate(pieces, modifiers, 60, 1, undefined, () => 0.5);
		}

		expect(pieces.totalFish.div(oneStep.totalFish).toNumber()).toBeCloseTo(1, 2);
	});
});

describe('nothing anywhere is a fraction of a fish', () => {
	it('after a long mixed session', () => {
		clearCatchTableCache();
		const state = createInitialState();
		state.coins = D('1e12');
		buyUpgrade(state, 'net', 6);
		state.deckhands[FishingSources.Pond] = D(7);

		const modifiers = computeModifiers(state);
		const random = seededRandom(4242);

		for (let i = 0; i < 400; i++) {
			performCast(state, FishingSources.Pond, modifiers, random);
			accumulate(state, modifiers, 0.2, 1, undefined, random);
		}

		for (const type of FISH_TYPES) {
			expect(state.hold[type].eq(state.hold[type].floor()), type).toBe(true);
		}
		for (const [name, count] of Object.entries(state.dex)) {
			expect(count.eq(count.floor()), name).toBe(true);
		}
		expect(state.totalFish.eq(state.totalFish.floor())).toBe(true);
		expect(state.totalCasts.eq(state.totalCasts.floor())).toBe(true);
	});

	it('and the hold value is exactly what the hold is worth', () => {
		clearCatchTableCache();
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		const random = seededRandom(11);

		for (let i = 0; i < 300; i++) performCast(state, FishingSources.Pond, modifiers, random);

		const priced = FISH_TYPES.reduce(
			(sum, type) =>
				sum.plus(
					state.hold[type]
						.times(fishTypeBaseValue[type])
						.times(SOURCE_CONFIG[FishingSources.Pond].valueMultiplier)
				),
			d0()
		);

		expect(state.holdValue.eq(priced)).toBe(true);
	});
});

describe('the numbers a player sees', () => {
	it('quotes a fish-per-cast rate that matches what they actually get', () => {
		clearCatchTableCache();
		const state = createInitialState();
		state.coins = D('1e12');
		buyUpgrade(state, 'net', 3);
		// The quoted rate is per cast; 5000 casts must not hit a bucket.
		state.hasAssistant = true;

		const modifiers = computeModifiers(state);
		const quoted = modifiers.fishPerCast;
		expect(quoted.toNumber()).toBeCloseTo(Math.pow(1.19, 3), 6);

		const random = seededRandom(3);
		for (let i = 0; i < 5000; i++) performCast(state, FishingSources.Pond, modifiers, random);

		expect(state.totalFish.div(5000).toNumber()).toBeCloseTo(quoted.toNumber(), 2);
	});

	it('is never asked to display a fraction of a fish in the hold', () => {
		clearCatchTableCache();
		const state = createInitialState();
		state.coins = D('1e12');
		buyUpgrade(state, 'net', 1);

		const modifiers = computeModifiers(state);
		performCast(state, FishingSources.Pond, modifiers, () => 0.5);

		for (const type of FISH_TYPES) {
			const held = state.hold[type];
			expect(held.eq(0) || held.gte(1)).toBe(true);
		}
	});
});

describe('the carry bank survives a save', () => {
	it('so the remainder is not quietly pocketed on every reload', async () => {
		const { fromRaw, serialize } = await import('./save');

		const state = createInitialState();
		takeWhole(state, `${FishingSources.Pond}#fish`, D(0.6));
		expect(Object.keys(state.carry).length).toBe(1);

		const restored = fromRaw(JSON.parse(serialize(state)));
		expect(restored.carry).toEqual(state.carry);
	});
});
