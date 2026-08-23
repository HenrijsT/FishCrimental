import Decimal from 'break_eternity.js';
import { d0 } from '$lib/decimal';
import { FISH_TYPES } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import {
	FUEL_PRICE,
	POACH_BUSTED_SECONDS,
	POACH_FINE_STEPS,
	POACH_FUEL_FLOOR_TANKS,
	POACH_GRACE_SECONDS
} from './config';
import { missingLicence, shoreSource } from './engine';
import { moveLedger } from './market';
import type { GameState, Modifiers } from './types';

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

/** Can this water be poached? Only water that is open but unlicensed. */
export function canPoach(state: GameState, source: FishingSources): boolean {
	return state.unlocked[source] && missingLicence(state, source) !== null;
}

/**
 * Start poaching. An explicit act, and the only way `state.poaching` is ever
 * set — `setSource` still refuses blocked water.
 */
export function poachSource(state: GameState, source: FishingSources): boolean {
	if (!canPoach(state, source)) return false;
	if (busted(state)) return false;

	// Switching between poached waters starts a fresh clock but keeps whatever
	// was landed, which is still stolen fish.
	if (state.poaching !== source) state.poachElapsed = 0;
	state.poaching = source;
	state.activeSource = source;
	return true;
}

/**
 * Stop, of your own accord, before anyone turns up.
 *
 * The clock resets and the catch is yours. That is the reward for judging it:
 * ninety seconds of water you have not paid for, taken and left.
 */
export function stopPoaching(state: GameState): void {
	if (!state.poaching) return;
	state.poaching = null;
	state.poachElapsed = 0;
	state.poachedValue = d0();
	if (missingLicence(state, state.activeSource)) state.activeSource = shoreSource(state);
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
	state.poachedValue = d0();
	state.bustedUntil = now + POACH_BUSTED_SECONDS * 1000;

	const movedTo = shoreSource(state);
	state.activeSource = movedTo;

	return { source, confiscated, fine, offence, movedTo };
}

/**
 * Take the poached catch out of the hold.
 *
 * Bounded by construction: it can only ever remove what was landed on this
 * poach, and never more than is actually still in the hold — the player may
 * have sold some of it already, and a warden cannot confiscate a fish that has
 * been eaten.
 */
function confiscate(state: GameState): Decimal {
	const owed = Decimal.min(state.poachedValue, state.holdValue);
	if (owed.lte(0)) return d0();

	const share = owed.div(state.holdValue);

	for (const type of FISH_TYPES) {
		state.hold[type] = Decimal.max(d0(), state.hold[type].minus(state.hold[type].times(share)));
	}
	state.holdValue = Decimal.max(d0(), state.holdValue.minus(owed));

	// The species side-ledger goes with them, into nothing.
	const bin = { fish: {}, worth: {} };
	moveLedger(state.holdSpecies, bin, share);

	return owed;
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
	if (!canPoach(state, state.poaching)) {
		state.poaching = null;
		state.poachElapsed = 0;
		state.poachedValue = d0();
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
