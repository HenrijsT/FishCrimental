import Decimal from 'break_eternity.js';
import { d0 } from '$lib/decimal';
import type { FishType } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import {
	FUEL_PRICE,
	POACH_BUSTED_SECONDS,
	POACH_FINE_STEPS,
	POACH_FUEL_FLOOR_TANKS,
	POACH_GRACE_SECONDS,
	needsBoat
} from './config';
import {
	SPECIES_BY_NAME,
	chartedSources,
	missingLicence,
	shoreSource,
	sourceBlocker
} from './engine';
import { emptyLedger } from './market';
import type { GameState, Modifiers, SpeciesLedger } from './types';

/**
 * Poaching, and what it costs (R48).
 *
 * Fishing water you have no paper for works, and pays, for exactly
 * `POACH_GRACE_SECONDS`. Then a warden arrives, takes the poached catch, fines
 * you a share of the purse, and puts you off the water for a minute.
 *
 * **Nothing here is a roll.** The grace is a fixed period and the fine is a
 * fixed schedule, so the same choice always costs the same thing and a player
 * can actually learn the mechanic rather than develop a superstition about it.
 *
 * Three properties are load-bearing and each has a test:
 *
 * - **The confiscation is bounded by construction** — it can only take what was
 *   landed on the poach, which is tracked as it lands.
 * - **The fine is a percentage**, so coins approach zero and never reach it.
 * - **A boat owner is never left unable to buy fuel.** The floor is checked
 *   before the fine, not clamped after it.
 *
 * The `ideas.txt` clause "I cannot buy anything new until I pay the fine" is
 * deliberately **not** implemented. With negative coins `buyFuel` returns zero,
 * `repairBoat` returns false and `fuelForTrip` silently skips — every button in
 * the game dies at once and not one of them says why.
 */

export interface Bust {
	source: FishingSources;
	/** Coin worth of catch taken. */
	confiscated: Decimal;
	/** Coins taken. */
	fine: Decimal;
	/** How many times this water has caught you out, after this one. */
	offence: number;
	/** Where you were put ashore. */
	movedTo: FishingSources;
}

/** Is the player currently kept off the water by a warden? */
export function busted(state: GameState, now = Date.now()): boolean {
	return state.bustedUntil > now;
}

export function bustedSecondsLeft(state: GameState, now = Date.now()): number {
	return Math.max(0, (state.bustedUntil - now) / 1000);
}

/** Seconds of poaching left before someone notices. */
export function graceLeft(state: GameState): number {
	if (!state.poaching) return POACH_GRACE_SECONDS;
	return Math.max(0, POACH_GRACE_SECONDS - state.poachElapsed);
}

/**
 * Can this water be poached?
 *
 * **Water you have no right to be on** — either you have not bought it or you
 * have no paper for it. Not, as this first shipped, "unlocked but unlicensed":
 * `canUnlock` refuses any source whose licence is missing, and `licencesFor`
 * grants the licence for any source that is unlocked, so `unlocked` implies
 * `licensed` and that condition was **never true in legitimate play.** The
 * whole subsystem — the grace, the fines, the confiscation, the button — could
 * not fire once.
 *
 * What it still requires is that the player could physically be there: the
 * water has to be on the chart, and open water needs a hull.
 */
export function canPoach(state: GameState, source: FishingSources): boolean {
	if (state.poaching === source) return true;
	if (!trespass(state, source)) return false;
	if (!chartedSources(state).includes(source)) return false;
	if (needsBoat(source) && !state.boat.owned) return false;
	return true;
}

/**
 * Is being on this water trespass at all?
 *
 * Separate from `canPoach` because `canPoach` answers "may the player start
 * poaching here", and short-circuits for the poach already in progress. This
 * answers "is the poach in progress still a poach", which is the question
 * `stopPoaching` and `settlePoachOnLoad` are actually asking — and reusing
 * `canPoach` for it silently answered *yes, always*.
 */
export function trespass(state: GameState, source: FishingSources): boolean {
	return !state.unlocked[source] || missingLicence(state, source) !== null;
}

/**
 * Start poaching. An explicit act, and the only way `state.poaching` is ever
 * set — `setSource` still refuses blocked water.
 */
export function poachSource(state: GameState, source: FishingSources): boolean {
	if (!canPoach(state, source)) return false;
	if (busted(state)) return false;

	// Switching to a *different* water starts a fresh clock. Returning to one
	// you were already working does not — see `stopPoaching`.
	if (state.poaching !== null && state.poaching !== source) {
		state.poachElapsed = 0;
		state.poached = emptyLedger();
	}
	state.poaching = source;
	state.activeSource = source;
	return true;
}

/**
 * Stop, of your own accord, before anyone turns up.
 *
 * The catch is yours, and that is the reward for judging it. **The clock does
 * not reset**: it belongs to the water, not to the visit. Resetting it made the
 * grace period farmable without limit — poach for eighty-nine seconds, pack up,
 * start again, forever, and fifty consecutive cycles cost nothing at all.
 * Someone who saw you yesterday has not forgotten by this afternoon.
 *
 * `poachElapsed` is cleared by a bust, by moving to different water, and by a
 * prestige. Not by walking away.
 */
export function stopPoaching(state: GameState): void {
	if (!state.poaching) return;
	state.poaching = null;
	// The catch is yours, so the debt against it goes with the visit.
	//
	// It used to survive, and `confiscate` settles the standing debt out of
	// whatever happens to be in the bucket at the next bust — so packing up,
	// selling, fishing legally and coming back to the same water had the warden
	// take the *legal* fish for a catch the player had already been told was
	// theirs. The clock still belongs to the water; the fish do not.
	state.poached = emptyLedger();
	if (sourceBlocker(state, state.activeSource)) state.activeSource = shoreSource(state);
}

/** The share of the purse a bust at `source` would take. */
export function fineFraction(state: GameState, source: FishingSources): number {
	const previous = state.poachOffences[source] ?? 0;
	return POACH_FINE_STEPS[Math.min(previous, POACH_FINE_STEPS.length - 1)];
}

/** The lowest a fine may leave a boat owner: one full tank of fuel. */
export function coinFloor(state: GameState, modifiers: Modifiers): Decimal {
	if (!state.boat.owned) return d0();
	return modifiers.fuelCapacity.times(FUEL_PRICE).times(POACH_FUEL_FLOOR_TANKS);
}

/**
 * The warden arrives.
 *
 * Confiscates the poached catch from the hold, fines a share of the purse, puts
 * the player ashore on the deepest legal water, and starts the timeout.
 */
export function bust(state: GameState, modifiers: Modifiers, now = Date.now()): Bust | null {
	const source = state.poaching;
	if (!source) return null;

	const confiscated = confiscate(state);

	const fraction = fineFraction(state, source);
	const floor = coinFloor(state, modifiers);
	let fine = d0();
	if (fraction > 0 && state.coins.gt(floor)) {
		const wanted = state.coins.times(fraction);
		// The floor is checked before the fine, not clamped after it, so the
		// fine is never quietly larger than what is taken.
		fine = Decimal.min(wanted, state.coins.minus(floor));
		state.coins = state.coins.minus(fine);
	}

	const offence = (state.poachOffences[source] ?? 0) + 1;
	state.poachOffences[source] = offence;

	state.poaching = null;
	state.poachElapsed = 0;
	state.poached = emptyLedger();
	state.bustedUntil = now + POACH_BUSTED_SECONDS * 1000;

	const movedTo = shoreSource(state);
	state.activeSource = movedTo;

	return { source, confiscated, fine, offence, movedTo };
}

/**
 * Take the poached catch — the poached catch, and nothing else.
 *
 * Species by species, out of the bucket **and** off the quay. Both, because
 * listing used to launder a poach outright: the stolen fish moved to the
 * consignment, `poached` was never touched, and the standing debt was then
 * settled out of whatever legal fish happened to land next. A player was seen
 * losing ninety of a hundred legal guppies so that one stolen pike could sit
 * safely on the quay.
 *
 * Bounded by construction in the honest sense: it can take at most what was
 * landed on this poach, and at most what is still there to take. A fish already
 * sold is a fish he cannot confiscate — the fine is what answers that.
 */
function confiscate(state: GameState): Decimal {
	let taken = d0();

	for (const species of Object.keys(state.poached.fish)) {
		const owed = state.poached.fish[species];
		if (owed.lte(0)) continue;

		taken = taken.plus(seize(state, state.holdSpecies, state.hold, species, owed));
	}

	// Second pass over the quay for whatever the bucket could not cover.
	for (const species of Object.keys(state.poached.fish)) {
		const owed = state.poached.fish[species];
		if (owed.lte(0)) continue;
		taken = taken.plus(
			seize(state, state.consignmentSpecies, state.consignment, species, owed, true)
		);
	}

	state.poached = emptyLedger();
	return taken;
}

/**
 * Remove up to `wanted` fish of one species from a container, and return what
 * they were worth.
 *
 * The aggregate `hold`/`consignment` buckets carry no species, so they are
 * reduced by the same *count* that left the ledger — which is the only honest
 * mapping available and keeps `holdCount` in step with the ledger.
 */
function seize(
	state: GameState,
	ledger: SpeciesLedger,
	buckets: Record<FishType, Decimal>,
	species: string,
	wanted: Decimal,
	quay = false
): Decimal {
	const held = ledger.fish[species] ?? d0();
	if (held.lte(0)) return d0();

	const taking = Decimal.min(held, wanted);
	const worth = (ledger.worth[species] ?? d0()).times(taking.div(held));

	ledger.fish[species] = held.minus(taking);
	ledger.worth[species] = (ledger.worth[species] ?? d0()).minus(worth);
	state.poached.fish[species] = wanted.minus(taking);

	const fish = SPECIES_BY_NAME.get(species);
	if (fish) {
		buckets[fish.category] = Decimal.max(d0(), buckets[fish.category].minus(taking));
	}

	if (quay) {
		state.consignmentValue = Decimal.max(d0(), state.consignmentValue.minus(worth));
	} else {
		state.holdValue = Decimal.max(d0(), state.holdValue.minus(worth));
	}

	return worth;
}

/**
 * Advance the poach clock, and bust if the grace has run out.
 *
 * Called from `tick()` and once from the offline settle. Never from
 * `accumulate` — a confiscation inside the catch loop would take fish that had
 * not been landed yet.
 */
export function runPolice(
	state: GameState,
	modifiers: Modifiers,
	seconds: number,
	now = Date.now()
): Bust | null {
	if (!state.poaching || seconds <= 0) return null;

	state.poachElapsed += seconds;
	if (state.poachElapsed < POACH_GRACE_SECONDS) return null;

	return bust(state, modifiers, now);
}

/**
 * Clean up a poach that a reload has invalidated.
 *
 * The licence may have been taken since, or the source may not be unlocked at
 * all in this run. Either way the flag is meaningless and leaving it set would
 * mean a bust for water the player is perfectly entitled to fish.
 */
export function settlePoachOnLoad(state: GameState): void {
	if (!state.poaching) return;
	if (!trespass(state, state.poaching)) {
		state.poaching = null;
		state.poachElapsed = 0;
		state.poached = emptyLedger();
	}
}

/** For the UI: what the next bust at this water would cost, as a percentage. */
export function finePercent(state: GameState, source: FishingSources): number {
	return Math.round(fineFraction(state, source) * 100);
}

/** Grace as a 0–1 fraction spent, for a bar. */
export function graceProgress(state: GameState): number {
	if (!state.poaching) return 0;
	return Math.min(1, Math.max(0, state.poachElapsed / POACH_GRACE_SECONDS));
}
