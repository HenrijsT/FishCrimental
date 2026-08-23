import Decimal from 'break_eternity.js';
import { D, d0, d1 } from '$lib/decimal';
import {
	KNOWLEDGE_COEFF,
	KNOWLEDGE_SCALE,
	MARKET_DECAY_CUTOFF,
	MARKET_DEPTH_BASE,
	MARKET_DEPTH_GROWTH,
	MARKET_HALF_LIFE,
	MARKET_IMPACT
} from './config';
import type { GameState, SpeciesLedger } from './types';

/**
 * The fish market (R49, R50).
 *
 * Two opposed levers, both per species:
 *
 * - **Price impact.** Selling pushes a species' price down and it recovers over
 *   wall-clock time, so mono-farming one fish eats its own price.
 * - **Knowledge.** Catching a species makes you better at catching it, forever
 *   and across prestiges, which pulls the other way.
 *
 * Knowledge is carried by `dex`, which is in `CarryOver`. Market pressure is
 * **not** carried. That asymmetry is the mechanic: a mono player's knowledge
 * advantage shrinks logarithmically while their price penalty resets and is
 * immediately re-earned, so mono is worth +25% early, crosses over around 75 to
 * 90 minutes, and settles at about 0.70x — permanently worse, and never
 * blocked. Income is proportional to `R^0.75` at every scale.
 */

/**
 * Where the old aggregate `holdValue` from a pre-market save is parked.
 *
 * It is a bucket of coins with no species behind it, so both levers special-case
 * it to neutral: knowledge 1, price 1, and no pressure recorded. It sells once
 * and never comes back.
 */
export const LEGACY_SPECIES = '';

/** Is the market trading yet? It opens at the first paradigm shift (R59). */
export function marketOpen(state: GameState): boolean {
	return state.prestigeCount.gt(0);
}

/**
 * What knowing a species is worth: `1 + 0.28 * ln(1 + n/100)`.
 *
 * Logarithmic, so it never stops growing and never runs away — the same reason
 * the Pearl bonus is. `n` is the lifetime catch count in the Fishdex, which
 * survives a prestige.
 */
export function knowledge(state: GameState, species: string): Decimal {
	if (species === LEGACY_SPECIES) return d1();
	const caught = state.dex[species];
	if (!caught || caught.lte(0)) return d1();
	return caught.div(KNOWLEDGE_SCALE).plus(1).ln().times(KNOWLEDGE_COEFF).plus(1);
}

/**
 * How much selling it takes to move a price — the market's depth, `S`.
 *
 * Cold Storage buys depth, and it has to exist. Production grows about 250x in
 * the hour between t=60m and t=120m, so a fixed `S` would drop every price
 * roughly fourfold per mid-game hour and the market would stop being a choice
 * and start being a wall. Depth converts a falling unit price into a coin sink,
 * which is what every shipped mitigation of this mechanic actually is.
 */
export function marketDepth(state: GameState): Decimal {
	return D(MARKET_DEPTH_BASE).times(D(MARKET_DEPTH_GROWTH).pow(state.upgrades.storage));
}

/** Pressure standing against a species right now. */
export function pressureOn(state: GameState, species: string): Decimal {
	return state.marketPressure[species] ?? d0();
}

/** The going price of a species, as a multiplier on what it is otherwise worth. */
export function speciesPrice(state: GameState, species: string): Decimal {
	if (!marketOpen(state) || species === LEGACY_SPECIES) return d1();
	return pressureOn(state, species).div(marketDepth(state)).plus(1).pow(-MARKET_IMPACT);
}

/** Knowledge and price together: what one fish of this species is worth today. */
export function speciesMultiplier(state: GameState, species: string): Decimal {
	if (!marketOpen(state)) return d1();
	return knowledge(state, species).times(speciesPrice(state, species));
}

/**
 * The *average* price across a sale of `quantity`, by the integral.
 *
 * Pricing a whole sale at the price it started at would let a player defeat the
 * mechanic by batching: hold ten thousand fish, sell them all at the untouched
 * price, and the impact lands only on the next sale. Integrating
 * `(1 + p/S)^-a` over the quantity sold prices each fish at the price it
 * actually moved into, and the closed form means no loop:
 *
 * ```
 * proceeds(p0, q) = S/(1-a) * [ (1 + (p0+q)/S)^(1-a) - (1 + p0/S)^(1-a) ]
 * ```
 */
export function averagePrice(state: GameState, species: string, quantity: Decimal): Decimal {
	if (!marketOpen(state) || species === LEGACY_SPECIES) return d1();
	if (quantity.lte(0)) return speciesPrice(state, species);

	const depth = marketDepth(state);
	const before = pressureOn(state, species);
	const exponent = 1 - MARKET_IMPACT;

	// A small sale is priced at its midpoint instead of by the difference.
	//
	// `(1 + (p+q)/S)^0.75 - (1 + p/S)^0.75` is a difference of two nearly equal
	// numbers, and once `q/(S+p)` falls below about 1e-16 every significant
	// digit cancels and the whole thing rounds to **zero** — a sale that pays
	// nothing while the price board says the fish is worth 8.8e-4. At ordinary
	// scale the same instability ran the other way and priced a single fish at
	// 1.0000640, above the untouched price, which a strictly-decreasing curve
	// cannot do.
	//
	// The price at `p + q/2` agrees with the integral to second order in `q/S`,
	// and it is subtraction-free, so it is exact where the closed form is noise.
	const span = quantity.div(depth.plus(before));
	if (span.lt(1e-6)) {
		return before.plus(quantity.div(2)).div(depth).plus(1).pow(-MARKET_IMPACT);
	}

	const proceeds = depth
		.div(exponent)
		.times(
			before
				.plus(quantity)
				.div(depth)
				.plus(1)
				.pow(exponent)
				.minus(before.div(depth).plus(1).pow(exponent))
		);

	return proceeds.div(quantity);
}

/** Record a sale: the fish are gone and the price has moved. */
export function applyPressure(state: GameState, species: string, quantity: Decimal): void {
	if (!marketOpen(state) || species === LEGACY_SPECIES || quantity.lte(0)) return;
	state.marketPressure[species] = pressureOn(state, species).plus(quantity);
}

/**
 * Let every price recover by however long has passed.
 *
 * One shared multiply: the decay factor `2^(-dt/H)` does not depend on the
 * species, so one timestamp covers the whole book.
 *
 * Recovery is **not** clipped by the offline cap. Accumulation is capped at
 * eight hours because the crew are working; a price recovering is the market
 * forgetting, and it forgets whether or not anyone is fishing. Past
 * `MARKET_DECAY_CUTOFF` — twenty hours, more than twenty-eight half-lives —
 * the multiplier is below 1e-8 and the book is simply cleared.
 */
export function settleMarket(state: GameState, now = Date.now()): void {
	const last = state.marketUpdatedAt;

	// Never move the mark backwards.
	//
	// Clamping the *elapsed* time to zero blocks the immediate windfall but not
	// the one after it: writing `now` unconditionally meant a clock that jumped
	// back fifteen minutes handed that same fifteen minutes out again as the
	// clock caught up. A free half-life of price recovery, repeatable.
	state.marketUpdatedAt = Math.max(last, now);

	if (last <= 0) return;
	const seconds = Math.max(0, (now - last) / 1000);
	if (seconds <= 0) return;

	if (seconds >= MARKET_DECAY_CUTOFF) {
		state.marketPressure = {};
		return;
	}

	const factor = D(2).pow(-seconds / MARKET_HALF_LIFE);
	for (const species of Object.keys(state.marketPressure)) {
		const next = state.marketPressure[species].times(factor);
		// Anything under a whole fish is noise. Dropping it keeps the book from
		// growing a permanent entry for every species ever caught.
		if (next.lt(1)) delete state.marketPressure[species];
		else state.marketPressure[species] = next;
	}
}

/** An empty species side-ledger. */
export function emptyLedger(): SpeciesLedger {
	return { fish: {}, worth: {} };
}

/** Add a catch to a side-ledger. */
export function addToLedger(
	ledger: SpeciesLedger,
	species: string,
	count: Decimal,
	worth: Decimal
): void {
	ledger.fish[species] = (ledger.fish[species] ?? d0()).plus(count);
	ledger.worth[species] = (ledger.worth[species] ?? d0()).plus(worth);
}

/** Everything in a side-ledger, in coins, before the market has its say. */
export function ledgerWorth(ledger: SpeciesLedger): Decimal {
	let total = d0();
	for (const species of Object.keys(ledger.worth)) total = total.plus(ledger.worth[species]);
	return total;
}

/**
 * What a side-ledger fetches today, with knowledge and the market applied, and
 * what selling it would do to the prices.
 *
 * Pure: it reads the book but does not move it, so the UI can price a sale
 * before the player commits to one.
 */
export function ledgerValue(state: GameState, ledger: SpeciesLedger, aggregate?: Decimal): Decimal {
	let total = d0();

	if (marketOpen(state)) {
		for (const species of Object.keys(ledger.worth)) {
			const worth = ledger.worth[species];
			if (worth.lte(0)) continue;
			const quantity = ledger.fish[species] ?? d0();
			total = total.plus(
				worth.times(knowledge(state, species)).times(averagePrice(state, species, quantity))
			);
		}
	} else {
		total = ledgerWorth(ledger);
	}

	return total.plus(legacyShortfall(ledger, aggregate));
}

/**
 * Coins in the aggregate that no species accounts for.
 *
 * The aggregate (`holdValue`, `consignmentValue`) and the side-ledger are two
 * views of the same fish, and the ledger is the younger of the two. A save
 * written before the market existed has an aggregate and no ledger at all, and
 * so does any caller that puts value in the hold directly rather than through
 * `recordCatch`.
 *
 * Rather than trusting one and silently losing the other, the difference is
 * treated as `LEGACY_SPECIES`: money with no fish behind it, sold once at a
 * neutral price, recorded against nobody. The alternative — inventing a species
 * split for it — would be making the fish up.
 */
function legacyShortfall(ledger: SpeciesLedger, aggregate?: Decimal): Decimal {
	if (aggregate === undefined) return d0();
	const gap = aggregate.minus(ledgerWorth(ledger));
	return gap.gt(0) ? gap : d0();
}

/**
 * Sell a side-ledger: price it, move the prices, and empty it.
 *
 * Returns the coins before `sellMultiplier` and the buyer's rate are applied —
 * those are the caller's business, and applying them here would double-count.
 */
export function drainLedger(state: GameState, ledger: SpeciesLedger, aggregate?: Decimal): Decimal {
	const earned = ledgerValue(state, ledger, aggregate);

	for (const species of Object.keys(ledger.fish)) {
		// Only what was actually sold moves a price. `ledgerValue` skips a species
		// with no worth behind it and this has to skip the same ones, or the
		// jellies — `fishTypeBaseValue[Jelly]` is 0, and they are a third of the
		// Lagoon table — walk down a price nobody is ever paid, put themselves at
		// the top of the price board as the thing the player has "hurt" most, and
		// eat the Cold Storage depth that was bought to protect real fish.
		if ((ledger.worth[species] ?? d0()).lte(0)) continue;
		applyPressure(state, species, ledger.fish[species]);
	}

	ledger.fish = {};
	ledger.worth = {};
	return earned;
}

/**
 * Move `fraction` of one ledger into another, species by species.
 *
 * Used when listing part of the bucket for the merchant: the side-ledger has to
 * move with the fish or the two accounts drift and the market prices something
 * that is not there.
 *
 * Returns the coin worth that actually moved. The caller moves exactly that much
 * of the aggregate and no more — see `listForSale` — because whole fish and a
 * fraction of the money cannot both be honoured, and the ledger is the thing the
 * market prices.
 *
 * The move is **whole fish**, for the same reason `listForSale` moves whole
 * fish: `readSpeciesPile` floors every count on load, so a fraction left behind
 * is a fish deleted on the next reload.
 */
export function moveLedger(from: SpeciesLedger, to: SpeciesLedger, fraction: Decimal): Decimal {
	let moved = d0();
	if (fraction.lte(0)) return moved;
	const whole = fraction.gte(1);
	const names = Object.keys(from.fish);

	/** How many fish of each species are going. */
	const take: Record<string, Decimal> = {};

	if (!whole) {
		// Flooring each species on its own is not enough.
		//
		// It loses up to one fish per species, and at the small end it loses all
		// of them: five species holding one fish each, listing three, floors
		// `1 x 0.6` five times and moves nothing at all — while the bucket handed
		// three fish over. The aggregate then followed the ledger and no money
		// moved with them, so the quay held three fish worth nothing.
		//
		// So: the floored share first, then the shortfall handed to whoever still
		// has fish, exactly as `listForSale` does it for the six type buckets.
		let total = d0();
		for (const species of names) {
			const held = from.fish[species];
			if (held?.gt(0)) total = total.plus(held);
		}
		const target = total.times(fraction).floor();

		let count = d0();
		for (const species of names) {
			const held = from.fish[species];
			if (!held || held.lte(0)) continue;
			const share = Decimal.min(held, held.times(fraction).floor());
			if (share.lte(0)) continue;
			take[species] = share;
			count = count.plus(share);
		}

		for (const species of names) {
			if (count.gte(target)) break;
			const held = from.fish[species];
			if (!held || held.lte(0)) continue;
			const left = held.minus(take[species] ?? d0());
			if (left.lte(0)) continue;
			const extra = Decimal.min(left, target.minus(count));
			take[species] = (take[species] ?? d0()).plus(extra);
			count = count.plus(extra);
		}
	}

	for (const species of names) {
		const held = from.fish[species];
		const fish = whole || held.lte(0) ? held : (take[species] ?? d0());
		// A species with no fish left still has to be swept, or its stale worth
		// sits in the old ledger for ever and the market prices a bucket that is
		// not there.
		if (fish.lte(0) && held.gt(0)) continue;

		// Worth follows the fish that moved rather than the requested fraction —
		// flooring the count and not the money would drift the two apart.
		const stored = from.worth[species] ?? d0();
		const worth = whole || held.lte(0) ? stored : stored.times(fish.div(held));

		to.fish[species] = (to.fish[species] ?? d0()).plus(fish);
		to.worth[species] = (to.worth[species] ?? d0()).plus(worth);
		moved = moved.plus(worth);

		if (whole || fish.gte(held)) {
			delete from.fish[species];
			delete from.worth[species];
		} else {
			from.fish[species] = held.minus(fish);
			from.worth[species] = stored.minus(worth);
		}
	}

	return moved;
}

/**
 * Every species the market currently has an opinion about, worst price first.
 *
 * For the price board: what a player wants to see is what they have hurt.
 */
export function pricedSpecies(state: GameState): { species: string; price: Decimal }[] {
	return Object.keys(state.marketPressure)
		.map((species) => ({ species, price: speciesPrice(state, species) }))
		.sort((a, b) => (a.price.lt(b.price) ? -1 : a.price.gt(b.price) ? 1 : 0));
}
