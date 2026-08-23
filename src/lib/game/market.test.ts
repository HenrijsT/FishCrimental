import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	MARKET_DECAY_CUTOFF,
	MARKET_DEPTH_BASE,
	MARKET_DEPTH_GROWTH,
	MARKET_HALF_LIFE,
	MARKET_IMPACT,
	PRESTIGE_THRESHOLD
} from './config';
import {
	LEGACY_SPECIES,
	averagePrice,
	applyPressure,
	knowledge,
	marketDepth,
	marketOpen,
	settleMarket,
	speciesPrice
} from './market';
import {
	computeModifiers,
	createInitialState,
	holdMarketValue,
	listForSale,
	performPrestige,
	sellHold,
	settleConsignment
} from './engine';
import type { GameState } from './types';

/** A state with the market trading. */
function trading(): GameState {
	const state = createInitialState();
	state.prestigeCount = D(1);
	// A real timestamp, not 0 — `settleMarket` reads 0 as "no book yet".
	state.marketUpdatedAt = 1;
	return state;
}

describe('when the market opens', () => {
	it('is shut for the whole of run one', () => {
		expect(marketOpen(createInitialState())).toBe(false);
	});

	it('opens at the first paradigm shift (R59)', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D(PRESTIGE_THRESHOLD).times(100);

		expect(performPrestige(state)).not.toBeNull();
		expect(marketOpen(state)).toBe(true);
	});

	it('prices everything at 1 while it is shut, whatever has been sold', () => {
		const state = createInitialState();
		state.marketPressure.Guppy = D('1e9');
		expect(speciesPrice(state, 'Guppy').toNumber()).toBe(1);
	});

	it('does not carry pressure across a shift — dex is carried, this is not', () => {
		const state = trading();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D(PRESTIGE_THRESHOLD).times(100);
		state.dex.Guppy = D(5_000);
		state.marketPressure.Guppy = D('1e6');

		performPrestige(state);

		expect(state.marketPressure.Guppy).toBeUndefined();
		// And the knowledge that opposes it survives, which is the mechanic.
		expect(state.dex.Guppy.toNumber()).toBe(5_000);
	});
});

describe('price impact', () => {
	it('is 1 against an untouched species', () => {
		expect(speciesPrice(trading(), 'Guppy').toNumber()).toBe(1);
	});

	it('falls as a species is sold, and never reaches zero', () => {
		const state = trading();
		let last = 1;
		for (const pressure of ['1e5', '1e6', '1e8', '1e12', '1e30']) {
			state.marketPressure.Guppy = D(pressure);
			const price = speciesPrice(state, 'Guppy').toNumber();
			expect(price).toBeLessThan(last);
			expect(price).toBeGreaterThan(0);
			last = price;
		}
	});

	it('follows (1 + p/S)^-0.25 exactly', () => {
		const state = trading();
		state.marketPressure.Guppy = D(MARKET_DEPTH_BASE);
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeCloseTo(Math.pow(2, -MARKET_IMPACT), 9);
	});

	it('leaves income proportional to R^0.75 at any scale, so nothing is ever blocked', () => {
		const state = trading();
		const at = (r: number) => {
			state.marketPressure.Guppy = D(r);
			return speciesPrice(state, 'Guppy').times(r).toNumber();
		};
		// Ten times the volume is 10^0.75 = 5.62 times the money, forever.
		expect(at(1e10) / at(1e9)).toBeCloseTo(Math.pow(10, 0.75), 2);
		expect(at(1e30) / at(1e29)).toBeCloseTo(Math.pow(10, 0.75), 2);
	});
});

describe('a sale is priced by the integral, not the price it started at', () => {
	it('pays less than the pre-sale price for a sale that moves the market', () => {
		const state = trading();
		const before = speciesPrice(state, 'Guppy');
		const average = averagePrice(state, 'Guppy', D(MARKET_DEPTH_BASE).times(10));

		expect(average.lt(before)).toBe(true);
	});

	it('so batching cannot beat selling as you go, which is the point', () => {
		const batched = trading();
		const asYouGo = trading();
		const chunk = D(MARKET_DEPTH_BASE);

		const oneGo = averagePrice(batched, 'Guppy', chunk.times(4)).times(chunk.times(4));

		let piecemeal = d0();
		for (let i = 0; i < 4; i++) {
			piecemeal = piecemeal.plus(averagePrice(asYouGo, 'Guppy', chunk).times(chunk));
			applyPressure(asYouGo, 'Guppy', chunk);
		}

		expect(oneGo.toNumber()).toBeCloseTo(piecemeal.toNumber(), 4);
	});

	it('is the pre-sale price in the limit of an infinitesimal sale', () => {
		const state = trading();
		state.marketPressure.Guppy = D('1e6');
		expect(averagePrice(state, 'Guppy', D(1)).toNumber()).toBeCloseTo(
			speciesPrice(state, 'Guppy').toNumber(),
			6
		);
	});
});

describe('recovery', () => {
	it('halves the pressure every half-life', () => {
		const state = trading();
		state.marketPressure.Guppy = D(1_000_000);
		state.marketUpdatedAt = 1;

		settleMarket(state, MARKET_HALF_LIFE * 1000);
		expect(state.marketPressure.Guppy.toNumber() / 500_000).toBeCloseTo(1, 5);
	});

	it('brings a saturated price back near 1 over six hours, as the design asks', () => {
		const state = trading();
		state.marketPressure.Guppy = D(MARKET_DEPTH_BASE).times(1_295);
		state.marketUpdatedAt = 1;
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeCloseTo(0.167, 2);

		settleMarket(state, 6 * 3600 * 1000);
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeGreaterThan(0.9);
	});

	it('is not clipped by the offline cap — a market forgets whether or not you fish', () => {
		const state = trading();
		state.marketPressure.Guppy = D(1e12);
		state.marketUpdatedAt = 1;

		// Well past the eight-hour accumulation cap: twenty-four half-lives of
		// recovery that a cap on *accumulation* has no business clipping.
		const atEightHours = (() => {
			const clone = trading();
			clone.marketPressure.Guppy = D(1e12);
			clone.marketUpdatedAt = 1;
			settleMarket(clone, 8 * 3600 * 1000);
			return speciesPrice(clone, 'Guppy').toNumber();
		})();

		settleMarket(state, 12 * 3600 * 1000);
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeGreaterThan(atEightHours);
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeGreaterThan(0.97);
	});

	it('clears the book outright past the cutoff', () => {
		const state = trading();
		state.marketPressure.Guppy = D('1e30');
		state.marketUpdatedAt = 1;

		settleMarket(state, (MARKET_DECAY_CUTOFF + 1) * 1000);
		expect(Object.keys(state.marketPressure)).toHaveLength(0);
	});

	it('treats a clock that went backwards as no time at all', () => {
		const state = trading();
		state.marketPressure.Guppy = D(1_000_000);
		state.marketUpdatedAt = 10_000_000;

		settleMarket(state, 5_000_000);
		expect(state.marketPressure.Guppy.toNumber()).toBe(1_000_000);
	});
});

describe('knowledge', () => {
	it('is 1 for a species never caught', () => {
		expect(knowledge(trading(), 'Guppy').toNumber()).toBe(1);
	});

	it('follows 1 + 0.28 ln(1 + n/100)', () => {
		const state = trading();
		state.dex.Guppy = D(100);
		expect(knowledge(state, 'Guppy').toNumber()).toBeCloseTo(1 + 0.28 * Math.log(2), 9);
	});

	it('grows for ever, and slowly, so it can never win outright', () => {
		const state = trading();
		state.dex.Guppy = D('1e6');
		const millionth = knowledge(state, 'Guppy').toNumber();
		state.dex.Guppy = D('1e12');
		const trillionth = knowledge(state, 'Guppy').toNumber();

		expect(trillionth).toBeGreaterThan(millionth);
		// Six more orders of magnitude of fishing is worth barely twice as much.
		expect(trillionth).toBeLessThan(millionth * 2.2);
	});
});

describe('Cold Storage', () => {
	it('multiplies the depth, so a bigger operation moves the price less', () => {
		const state = trading();
		expect(marketDepth(state).toNumber()).toBeCloseTo(MARKET_DEPTH_BASE, 3);

		state.upgrades.storage = D(3);
		expect(marketDepth(state).toNumber()).toBeCloseTo(
			MARKET_DEPTH_BASE * Math.pow(MARKET_DEPTH_GROWTH, 3),
			0
		);
	});

	it('lifts the price of a species already under pressure', () => {
		const state = trading();
		state.marketPressure.Guppy = D('1e7');
		const cramped = speciesPrice(state, 'Guppy').toNumber();

		state.upgrades.storage = D(4);
		expect(speciesPrice(state, 'Guppy').toNumber()).toBeGreaterThan(cramped);
	});
});

describe('the market and the hold', () => {
	it('pays less for a species the player has been flooding', () => {
		const clean = trading();
		const flooded = trading();
		for (const state of [clean, flooded]) {
			state.hold[FishType.Small] = D(1_000);
			state.holdValue = D(10_000);
			state.holdSpecies.fish.Guppy = D(1_000);
			state.holdSpecies.worth.Guppy = D(10_000);
		}
		flooded.marketPressure.Guppy = D('1e8');

		const cleanEarned = sellHold(clean, computeModifiers(clean));
		const floodedEarned = sellHold(flooded, computeModifiers(flooded));

		expect(floodedEarned.lt(cleanEarned)).toBe(true);
	});

	it('records the sale against the species, so the next one is worse', () => {
		const state = trading();
		state.hold[FishType.Small] = D(1_000);
		state.holdValue = D(10_000);
		state.holdSpecies.fish.Guppy = D(1_000);
		state.holdSpecies.worth.Guppy = D(10_000);

		sellHold(state, computeModifiers(state));

		expect(state.marketPressure.Guppy.toNumber()).toBe(1_000);
	});

	it('empties the side-ledger at both exits, or the market resells paid-for fish', () => {
		const state = trading();
		// The worthless-hold early return.
		state.hold[FishType.Jelly] = D(9);
		state.holdValue = d0();
		state.holdSpecies.fish.Moon = D(9);
		state.holdSpecies.worth.Moon = d0();

		sellHold(state, computeModifiers(state));

		expect(Object.keys(state.holdSpecies.fish)).toHaveLength(0);
		expect(Object.keys(state.holdSpecies.worth)).toHaveLength(0);
	});

	it('carries the side-ledger onto the quay when fish are listed', () => {
		const state = trading();
		// A cart big enough that the quay's own cap is not what is being tested.
		state.bucketLevel = D(4);
		state.hold[FishType.Small] = D(100);
		state.holdValue = D(1_000);
		state.holdSpecies.fish.Guppy = D(100);
		state.holdSpecies.worth.Guppy = D(1_000);

		listForSale(state, D(40));

		expect(state.consignmentSpecies.fish.Guppy.toNumber()).toBeCloseTo(40, 6);
		expect(state.holdSpecies.fish.Guppy.toNumber()).toBeCloseTo(60, 6);
		expect(state.consignmentSpecies.worth.Guppy.toNumber()).toBeCloseTo(400, 6);
	});

	it('prices a consignment when the merchant pays, not when it was listed', () => {
		const state = trading();
		state.hold[FishType.Small] = D(100);
		state.holdValue = D(1_000);
		state.holdSpecies.fish.Guppy = D(100);
		state.holdSpecies.worth.Guppy = D(1_000);
		listForSale(state);

		// Somebody else floods the Guppy market before he turns up.
		state.marketPressure.Guppy = D('1e9');
		const earned = settleConsignment(state, computeModifiers(state));

		expect(earned.lt(1_000)).toBe(true);
	});
});

describe('a save from before the market', () => {
	it('sells its aggregate hold once, at a neutral price, against nobody', () => {
		const state = trading();
		// No species ledger at all — exactly what a version 5 save has.
		state.hold[FishType.Small] = D(50);
		state.holdValue = D(5_000);

		expect(holdMarketValue(state).toNumber()).toBe(5_000);
		expect(sellHold(state, computeModifiers(state)).toNumber()).toBe(5_000);
		// And no species was blamed for it.
		expect(Object.keys(state.marketPressure)).toHaveLength(0);
	});

	it('never lets the legacy bucket move a price', () => {
		const state = trading();
		applyPressure(state, LEGACY_SPECIES, D('1e9'));
		expect(state.marketPressure[LEGACY_SPECIES]).toBeUndefined();
	});
});
