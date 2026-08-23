import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import {
	POND_BASE_RATE,
	POND_MAX,
	POND_MAX_LEVEL,
	POND_RATE_GROWTH,
	POND_VALUE_MULTIPLIER,
	SOURCE_ORDER
} from './config';
import {
	accumulate,
	computeModifiers,
	createInitialState,
	digPond,
	holdCount,
	pondCost,
	pondFishValue,
	pondRate,
	pondsOpen,
	sellHold,
	stockPond,
	upgradePond
} from './engine';
import { speciesPrice } from './market';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

/** A player one shift in, with money and a Guppy in the Fishdex. */
function stocked(coins = '1e30'): GameState {
	const state = createInitialState();
	state.prestigeCount = D(1);
	state.marketUpdatedAt = 1;
	state.coins = D(coins);
	state.dex.Guppy = D(1_000);
	state.dex.Tetra = D(1_000);
	return state;
}

describe('digging a pond', () => {
	it('is impossible before the first paradigm shift', () => {
		const state = createInitialState();
		state.coins = D('1e30');
		expect(pondsOpen(state)).toBe(false);
		expect(digPond(state)).toBe(false);
		expect(state.ponds).toHaveLength(0);
	});

	it('opens on the same gate as the market', () => {
		const state = stocked();
		expect(pondsOpen(state)).toBe(true);
		expect(digPond(state)).toBe(true);
		expect(state.ponds).toHaveLength(1);
	});

	it('costs more every time, and stops at the land you have', () => {
		const state = stocked();
		expect(pondCost(1).gt(pondCost(0))).toBe(true);

		for (let i = 0; i < POND_MAX; i++) expect(digPond(state)).toBe(true);
		expect(digPond(state)).toBe(false);
		expect(state.ponds).toHaveLength(POND_MAX);
	});

	it('will not dig one you cannot pay for', () => {
		const state = stocked('1');
		expect(digPond(state)).toBe(false);
	});

	it('arrives empty, breeding nothing', () => {
		const state = stocked();
		digPond(state);
		expect(state.ponds[0].species).toBeNull();
		expect(pondRate(state.ponds[0]).toNumber()).toBe(0);
	});
});

describe('stocking a pond', () => {
	it('takes any fish already in the Fishdex', () => {
		const state = stocked();
		digPond(state);
		expect(stockPond(state, 0, 'Guppy')).toBe(true);
		expect(state.ponds[0].species).toBe('Guppy');
	});

	it('refuses a fish that has never been landed — you cannot breed a rumour', () => {
		const state = stocked();
		digPond(state);
		expect(stockPond(state, 0, 'Megalodon')).toBe(false);
		expect(state.ponds[0].species).toBeNull();
	});

	it('refuses a species that does not exist at all', () => {
		const state = stocked();
		digPond(state);
		expect(stockPond(state, 0, 'Haddock Supreme')).toBe(false);
	});

	it('is free and changeable, so a crushed price is never a trap', () => {
		const state = stocked();
		digPond(state);
		stockPond(state, 0, 'Guppy');
		const before = state.coins;

		expect(stockPond(state, 0, 'Tetra')).toBe(true);
		expect(state.ponds[0].species).toBe('Tetra');
		expect(state.coins.eq(before)).toBe(true);
	});

	it('can be emptied again', () => {
		const state = stocked();
		digPond(state);
		stockPond(state, 0, 'Guppy');
		expect(stockPond(state, 0, null)).toBe(true);
		expect(state.ponds[0].species).toBeNull();
	});
});

describe('a pond breeding', () => {
	function oneWorkingPond(): GameState {
		const state = stocked();
		state.hasAssistant = true; // no bucket in the way
		digPond(state);
		stockPond(state, 0, 'Guppy');
		return state;
	}

	it('lands exactly the species it was stocked with, and nothing else', () => {
		const state = oneWorkingPond();
		const before = state.dex.Guppy;

		accumulate(state, computeModifiers(state), 600);

		expect(state.dex.Guppy.gt(before)).toBe(true);
		expect(state.holdSpecies.fish.Guppy.gt(0)).toBe(true);
		// The only species in the hold is the one being farmed.
		expect(Object.keys(state.holdSpecies.fish)).toEqual(['Guppy']);
	});

	it('breeds at the advertised rate', () => {
		const state = oneWorkingPond();
		accumulate(state, computeModifiers(state), 1_000);
		// Within one whole fish, which is what the remainder bank holds back.
		expect(holdCount(state).toNumber()).toBeCloseTo(POND_BASE_RATE * 1_000, 0);
	});

	it('breeds faster with every level', () => {
		const state = oneWorkingPond();
		const before = pondRate(state.ponds[0]);
		upgradePond(state, 0);
		expect(pondRate(state.ponds[0]).div(before).toNumber()).toBeCloseTo(POND_RATE_GROWTH, 6);
	});

	it('stops at the top of its track', () => {
		const state = oneWorkingPond();
		state.ponds[0].level = D(POND_MAX_LEVEL);
		expect(upgradePond(state, 0)).toBe(false);
	});

	it('respects the bucket, exactly as the crew do', () => {
		const state = stocked();
		digPond(state);
		stockPond(state, 0, 'Guppy');
		state.ponds[0].level = D(20);

		accumulate(state, computeModifiers(state), 100_000);

		expect(holdCount(state).lte(30)).toBe(true);
	});

	it('banks its own remainders, so no pond spends another pond fraction', () => {
		const state = stocked();
		state.hasAssistant = true;
		digPond(state);
		digPond(state);
		stockPond(state, 0, 'Guppy');

		// Only the first pond is stocked, so only the first pond has a bank.
		for (let i = 0; i < 5; i++) accumulate(state, computeModifiers(state), 1);
		expect(state.carry['pond:0']).toBeDefined();
		expect(state.carry['pond:1']).toBeUndefined();

		// Stock the second at a different rate and the two banks diverge rather
		// than tracking each other, which is what a shared key would look like.
		stockPond(state, 1, 'Tetra');
		state.ponds[1].level = D(3);
		for (let i = 0; i < 3; i++) accumulate(state, computeModifiers(state), 1);

		expect(state.carry['pond:1']).toBeDefined();
		expect(state.carry['pond:0']).not.toBe(state.carry['pond:1']);
	});

	it('is worth the flat farmed rate, not any source rate', () => {
		// A Guppy is Small, so two coins of base value — and a pond pays the
		// same for it wherever the player happens to be fishing.
		expect(pondFishValue('Guppy').toNumber()).toBe(2 * POND_VALUE_MULTIPLIER);
	});
});

/**
 * The interaction the brief called out as most likely to break: a pond is a
 * machine for concentrating production onto one species, and the market charges
 * for exactly that.
 */
describe('ponds against the market', () => {
	function sixPonds(species: string[]): GameState {
		const state = stocked();
		state.hasAssistant = true;
		for (let i = 0; i < 6; i++) {
			digPond(state);
			state.ponds[i].level = D(18);
			stockPond(state, i, species[i % species.length]);
		}
		for (const name of species) state.dex[name] = D(1_000);
		// Start from an empty purse. A pile big enough to dig six ponds is big
		// enough that an hour's takings vanish into its fifteenth digit, and the
		// test would then be measuring Decimal's precision rather than the market.
		state.coins = d0();
		return state;
	}

	it('lets a mono-pond player crush their own price, on purpose', () => {
		const state = sixPonds(['Guppy']);
		accumulate(state, computeModifiers(state), 3_600);
		sellHold(state, computeModifiers(state));

		expect(speciesPrice(state, 'Guppy').lt(0.95)).toBe(true);
	});

	it('but never to nothing — income stays proportional to volume', () => {
		const state = sixPonds(['Guppy']);
		// A full day of nothing but Guppies.
		for (let hour = 0; hour < 24; hour++) {
			accumulate(state, computeModifiers(state), 3_600);
			sellHold(state, computeModifiers(state));
		}

		const price = speciesPrice(state, 'Guppy').toNumber();
		expect(price).toBeGreaterThan(0);
		expect(price).toBeLessThan(1);

		// And the next hour still pays. Cratered is not blocked.
		const before = state.coins;
		accumulate(state, computeModifiers(state), 3_600);
		sellHold(state, computeModifiers(state));
		expect(state.coins.gt(before)).toBe(true);
	});

	it('and spreading the same production across species hurts far less', () => {
		const mono = sixPonds(['Guppy']);
		const spread = sixPonds(['Guppy', 'Tetra']);
		spread.dex.Tetra = D(1_000);

		for (const state of [mono, spread]) {
			for (let hour = 0; hour < 6; hour++) {
				accumulate(state, computeModifiers(state), 3_600);
				sellHold(state, computeModifiers(state));
			}
		}

		expect(speciesPrice(spread, 'Guppy').gt(speciesPrice(mono, 'Guppy'))).toBe(true);
	});
});

describe('ponds and the rest of the game', () => {
	it('never appear in SOURCE_ORDER — the first source is untouched', () => {
		expect((SOURCE_ORDER as string[]).some((s) => s.toLowerCase().includes('pond:'))).toBe(false);
		const state = createInitialState();
		expect(state.unlocked[SOURCE_ORDER[0]]).toBe(true);
		expect(state.ponds).toHaveLength(0);
	});

	it('round-trip through a save', () => {
		const state = stocked();
		digPond(state);
		digPond(state);
		stockPond(state, 0, 'Guppy');
		state.ponds[0].level = D(4);

		const back = fromRaw(JSON.parse(serialize(state)));

		expect(back.ponds).toHaveLength(2);
		expect(back.ponds[0].species).toBe('Guppy');
		expect(back.ponds[0].level.toNumber()).toBe(4);
		expect(back.ponds[1].species).toBeNull();
	});

	it('load a version 5 save without ponds rather than without a game', () => {
		const state = stocked();
		const raw = JSON.parse(serialize(state));
		delete raw.ponds;
		raw.version = 5;

		expect(fromRaw(raw).ponds).toEqual([]);
	});

	it('are dug with coins, so a prestige takes them', () => {
		const state = stocked();
		digPond(state);
		stockPond(state, 0, 'Guppy');

		// Straight through `createInitialState`, which is what a prestige does.
		const fresh = createInitialState({ dex: state.dex, prestigeCount: D(1) });
		expect(fresh.ponds).toEqual([]);
	});
});
