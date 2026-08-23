import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	FUEL_PRICE,
	POACH_BUSTED_SECONDS,
	POACH_FINE_STEPS,
	POACH_GRACE_SECONDS,
	SETBACK_BASE_SECONDS,
	SETBACK_LEVELS,
	SETBACK_MAX_SECONDS,
	SETBACK_RAMP_SECONDS,
	SOURCE_ORDER
} from './config';
import {
	accumulate,
	computeModifiers,
	createInitialState,
	handIncomePerSecond,
	holdCount,
	refundUpgrade,
	sourceBlocker,
	upgradeBulkCost
} from './engine';
import {
	bust,
	busted,
	canPoach,
	coinFloor,
	fineFraction,
	graceLeft,
	poachSource,
	runPolice,
	settlePoachOnLoad,
	stopPoaching
} from './police';
import { SETBACKS, SETBACKS_BY_ID, escalation, evaluateSetbacks, strike } from './setbacks';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

/** Open water the player has no paper for. */
function unlicensed(): GameState {
	const state = createInitialState();
	for (const source of SOURCE_ORDER) state.unlocked[source] = true;
	state.coins = D(1_000_000);
	return state;
}

const POACHED = FishingSources.Stream;

describe('poaching is a deliberate act', () => {
	it('is only ever offered on water that is open and unlicensed', () => {
		const state = unlicensed();
		expect(canPoach(state, POACHED)).toBe(true);
		expect(canPoach(state, SOURCE_ORDER[0])).toBe(false);

		const locked = createInitialState();
		expect(canPoach(locked, POACHED)).toBe(false);
	});

	it('unblocks the water it is aimed at, and only that water', () => {
		const state = unlicensed();
		expect(sourceBlocker(state, POACHED)).toBe('licence');

		poachSource(state, POACHED);
		expect(sourceBlocker(state, POACHED)).toBeNull();
		expect(sourceBlocker(state, FishingSources.River)).toBe('licence');
	});

	it('actually pays — the crew work it', () => {
		const state = unlicensed();
		state.hasAssistant = true;
		state.deckhands[POACHED] = D(10);

		const before = accumulate(state, computeModifiers(state), 30).value;
		poachSource(state, POACHED);
		const after = accumulate(state, computeModifiers(state), 30).value;

		expect(before.toNumber()).toBe(0);
		expect(after.gt(0)).toBe(true);
	});

	it('is free if you leave before anyone notices', () => {
		const state = unlicensed();
		state.hasAssistant = true;
		state.deckhands[POACHED] = D(10);
		poachSource(state, POACHED);

		accumulate(state, computeModifiers(state), 30);
		runPolice(state, computeModifiers(state), 30);
		const kept = holdCount(state);
		expect(kept.gt(0)).toBe(true);

		stopPoaching(state);
		expect(state.poaching).toBeNull();
		expect(holdCount(state).eq(kept)).toBe(true);
	});
});

describe('the warden', () => {
	function poaching(): GameState {
		const state = unlicensed();
		state.hasAssistant = true;
		state.deckhands[POACHED] = D(20);
		poachSource(state, POACHED);
		return state;
	}

	it('arrives on a fixed clock, not a roll', () => {
		for (let i = 0; i < 5; i++) {
			const state = poaching();
			const modifiers = computeModifiers(state);
			expect(runPolice(state, modifiers, POACH_GRACE_SECONDS - 1)).toBeNull();
			expect(runPolice(state, modifiers, 2)).not.toBeNull();
		}
	});

	it('counts down where the player can see it', () => {
		const state = poaching();
		expect(graceLeft(state)).toBe(POACH_GRACE_SECONDS);
		runPolice(state, computeModifiers(state), 30);
		expect(graceLeft(state)).toBe(POACH_GRACE_SECONDS - 30);
	});

	it('takes the poached catch and leaves the legal fish alone', () => {
		const state = poaching();
		// Fish already in the bucket, landed honestly.
		state.hold[FishType.Small] = D(100);
		state.holdValue = D(10_000);

		accumulate(state, computeModifiers(state), 60);
		const poachedWorth = state.poachedValue;
		expect(poachedWorth.gt(0)).toBe(true);

		const total = state.holdValue;
		bust(state, computeModifiers(state));

		expect(state.holdValue.toNumber()).toBeCloseTo(total.minus(poachedWorth).toNumber(), 3);
		expect(state.holdValue.toNumber()).toBeCloseTo(10_000, 3);
	});

	it('cannot confiscate more than is still in the bucket', () => {
		const state = poaching();
		accumulate(state, computeModifiers(state), 60);
		// Sold it all before he got there.
		state.holdValue = d0();
		for (const type of Object.values(FishType)) state.hold[type] = d0();

		const caught = bust(state, computeModifiers(state))!;
		expect(caught.confiscated.toNumber()).toBe(0);
		expect(state.holdValue.toNumber()).toBe(0);
	});

	it('lets the first one go with a warning', () => {
		const state = poaching();
		const coins = state.coins;
		expect(fineFraction(state, POACHED)).toBe(POACH_FINE_STEPS[0]);

		const caught = bust(state, computeModifiers(state))!;
		expect(caught.fine.toNumber()).toBe(0);
		expect(state.coins.eq(coins)).toBe(true);
	});

	it('fines a percentage, so coins approach zero and never reach it', () => {
		const state = poaching();
		state.coins = D(1_000_000);

		for (let i = 0; i < 12; i++) {
			// Serve the minute on the bank between attempts, or `poachSource`
			// refuses and there is only ever one bust to measure.
			state.bustedUntil = 0;
			poachSource(state, POACHED);
			bust(state, computeModifiers(state));
		}

		expect(state.coins.gt(0)).toBe(true);
		expect(state.coins.lt(30_000)).toBe(true);
	});

	it('never leaves a boat owner short of a tank of fuel', () => {
		const state = poaching();
		state.boat.owned = true;
		const modifiers = computeModifiers(state);
		const floor = coinFloor(state, modifiers);
		expect(floor.toNumber()).toBeCloseTo(modifiers.fuelCapacity.times(FUEL_PRICE).toNumber(), 3);

		state.coins = floor.times(1.05);
		state.poachOffences[POACHED] = 3; // the steepest fine there is

		bust(state, modifiers);
		expect(state.coins.gte(floor)).toBe(true);
	});

	it('takes nothing at all from a boat owner already under the floor', () => {
		const state = poaching();
		state.boat.owned = true;
		const modifiers = computeModifiers(state);
		state.coins = coinFloor(state, modifiers).div(2);
		state.poachOffences[POACHED] = 3;
		const before = state.coins;

		bust(state, modifiers);
		expect(state.coins.eq(before)).toBe(true);
	});

	it('never puts the player into debt, which would kill every button at once', () => {
		const state = poaching();
		state.coins = D(5);
		state.poachOffences[POACHED] = 3;

		bust(state, computeModifiers(state));
		expect(state.coins.gte(0)).toBe(true);
	});

	it('puts you ashore on legal water and off the water for a minute', () => {
		const state = poaching();
		const now = 1_000_000;

		const caught = bust(state, computeModifiers(state), now)!;
		expect(state.poaching).toBeNull();
		expect(state.activeSource).toBe(caught.movedTo);
		expect(sourceBlocker(state, caught.movedTo)).toBeNull();
		expect(state.bustedUntil).toBe(now + POACH_BUSTED_SECONDS * 1000);
		expect(busted(state, now)).toBe(true);
		expect(busted(state, now + POACH_BUSTED_SECONDS * 1000 + 1)).toBe(false);
	});

	it('escalates per source, and forgets on a new run', () => {
		const state = poaching();
		bust(state, computeModifiers(state));
		expect(state.poachOffences[POACHED]).toBe(1);
		expect(fineFraction(state, POACHED)).toBe(POACH_FINE_STEPS[1]);
		// A different water has its own record.
		expect(fineFraction(state, FishingSources.River)).toBe(POACH_FINE_STEPS[0]);

		expect(createInitialState().poachOffences).toEqual({});
	});
});

describe('a poach across a reload', () => {
	it('survives, clock and all', () => {
		const state = unlicensed();
		poachSource(state, POACHED);
		state.poachElapsed = 42;

		const back = fromRaw(JSON.parse(serialize(state)));
		expect(back.poaching).toBe(POACHED);
		expect(back.poachElapsed).toBe(42);
	});

	it('is dropped if the licence has since been taken', () => {
		const state = unlicensed();
		poachSource(state, POACHED);
		state.licences.inland = true;

		settlePoachOnLoad(state);
		expect(state.poaching).toBeNull();
	});
});

describe('Setbacks ambush on events, never on a roll', () => {
	function armed(id = SETBACKS[0].id): GameState {
		const state = createInitialState();
		state.setbacksArmedAt[id] = 0;
		state.upgrades.rod = D(6);
		state.upgrades.net = D(6);
		state.upgrades.lure = D(6);
		state.upgrades.market = D(6);
		state.coins = D(100_000);
		return state;
	}

	it('there are at least three of them, each with its own trigger', () => {
		expect(SETBACKS.length).toBeGreaterThanOrEqual(3);
		const arms = new Set(SETBACKS.map((setback) => setback.arms.toString()));
		expect(arms.size).toBe(SETBACKS.length);
	});

	it('arms on a milestone and fires on the next one, with nothing in between', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(1);

		const first = evaluateSetbacks(state, computeModifiers(state));
		expect(first.armed.map((s) => s.id)).toContain('bait_thief');
		expect(first.hits).toHaveLength(0);

		// A hundred ticks of nothing happening. Nothing happens.
		for (let i = 0; i < 100; i++) {
			state.playTime += 1;
			expect(evaluateSetbacks(state, computeModifiers(state)).hits).toHaveLength(0);
		}

		state.unlocked[FishingSources.River] = true;
		expect(evaluateSetbacks(state, computeModifiers(state)).hits).toHaveLength(1);
	});

	it('happens once, and never again', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(1);
		evaluateSetbacks(state, computeModifiers(state));
		state.unlocked[FishingSources.River] = true;
		evaluateSetbacks(state, computeModifiers(state));

		expect(state.setbacksSeen).toContain('bait_thief');
		expect(evaluateSetbacks(state, computeModifiers(state)).hits).toHaveLength(0);
	});

	it('escalates with playTime spent armed, and saturates', () => {
		const state = armed();
		expect(escalation(state, SETBACKS[0].id)).toBe(0);

		state.playTime = SETBACK_RAMP_SECONDS / 2;
		expect(escalation(state, SETBACKS[0].id)).toBeCloseTo(0.5, 6);

		state.playTime = SETBACK_RAMP_SECONDS * 10;
		expect(escalation(state, SETBACKS[0].id)).toBe(1);
	});

	it('hits five times harder at the top of the ramp than at the bottom', () => {
		const quick = armed();
		const slow = armed();
		slow.playTime = SETBACK_RAMP_SECONDS;

		const a = strike(quick, computeModifiers(quick), SETBACKS_BY_ID.get(SETBACKS[0].id)!);
		const b = strike(slow, computeModifiers(slow), SETBACKS_BY_ID.get(SETBACKS[0].id)!);

		expect(a.seconds).toBeCloseTo(SETBACK_BASE_SECONDS, 6);
		expect(b.seconds).toBeCloseTo(SETBACK_MAX_SECONDS, 6);
	});

	it('takes levels for show and seconds of income for real', () => {
		const state = armed();
		const definition = SETBACKS_BY_ID.get(SETBACKS[0].id)!;
		const level = state.upgrades[definition.track];
		const gross = upgradeBulkCost(definition.track, level.minus(SETBACK_LEVELS), D(SETBACK_LEVELS));

		const hit = strike(state, computeModifiers(state), definition);

		expect(hit.levels).toBe(SETBACK_LEVELS);
		expect(state.upgrades[definition.track].toNumber()).toBe(level.toNumber() - SETBACK_LEVELS);
		// Everything the levels were worth beyond the damage comes back.
		expect(hit.lost.plus(hit.refunded).toNumber()).toBeCloseTo(gross.toNumber(), 3);
	});

	it('sizes itself against the hands when there is no crew yet', () => {
		const state = armed();
		const modifiers = computeModifiers(state);
		expect(handIncomePerSecond(state, modifiers).gt(0)).toBe(true);

		const hit = strike(state, computeModifiers(state), SETBACKS_BY_ID.get(SETBACKS[0].id)!);
		expect(hit.lost.gt(0)).toBe(true);
	});

	it('never takes a track below zero', () => {
		const state = armed();
		state.upgrades.lure = d0();
		const hit = strike(state, computeModifiers(state), SETBACKS_BY_ID.get('bait_thief')!);
		expect(state.upgrades.lure.gte(0)).toBe(true);
		expect(hit.levels).toBe(0);
	});
});

/**
 * `pearlsFor` reads `lifetimeCoins` directly as
 * `floor((lifetime / 1e15) ^ 0.42)`. A refund credited there would silently
 * mint a whole prestige for a player standing near the boundary — a Setback
 * that gave you a Pearl.
 */
describe('refundUpgrade touches coins and nothing else', () => {
	it('leaves lifetimeCoins and allTimeCoins byte-identical', () => {
		const state = createInitialState();
		state.upgrades.rod = D(8);
		state.coins = D(1_000);
		state.lifetimeCoins = D('999999999999999');
		state.allTimeCoins = D('123456789012345');

		const lifetime = state.lifetimeCoins.toJSON();
		const allTime = state.allTimeCoins.toJSON();

		refundUpgrade(state, 'rod', D(2), D(500));

		expect(state.coins.toNumber()).toBe(1_500);
		expect(state.lifetimeCoins.toJSON()).toBe(lifetime);
		expect(state.allTimeCoins.toJSON()).toBe(allTime);
	});
});

describe('Setbacks and a save', () => {
	it('are carried across a prestige — once in a life, not once a run', () => {
		const state = createInitialState({ setbacksSeen: ['bait_thief'] });
		expect(state.setbacksSeen).toEqual(['bait_thief']);
		// But what armed them is not, so an unfired one re-arms fresh.
		expect(state.setbacksArmedAt).toEqual({});
	});

	it('grandfather every save that predates them', () => {
		const state = createInitialState();
		const raw = JSON.parse(serialize(state));
		delete raw.setbacksSeen;
		raw.version = 5;

		const back = fromRaw(raw);
		expect(back.setbacksSeen).toHaveLength(SETBACKS.length);
	});

	it('and a new game gets all of them ahead of it', () => {
		expect(createInitialState().setbacksSeen).toEqual([]);
	});
});
