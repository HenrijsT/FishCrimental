import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	SETBACK_BASE_SECONDS,
	SETBACK_LEVELS,
	SETBACK_MAX_SECONDS,
	SETBACK_RAMP_SECONDS,
	UPGRADES,
	type UpgradeId
} from './config';
import {
	handIncomePerSecond,
	refundUpgrade,
	totalIncomePerSecond,
	upgradeBulkCost
} from './engine';
import type { GameState, Modifiers } from './types';

/**
 * Setbacks (R52, R58, R62, R67).
 *
 * **Called Setbacks everywhere the player can read**, because that is what they
 * are: a bad day, survived, once. Not a punishment, not a fail state, and not
 * something that can happen to you twice.
 *
 * ### They ambush on events. There is no roll anywhere in this file.
 *
 * A Setback **arms** when the player reaches one milestone and **fires** when
 * they reach the next one. No timer, no hazard rate, no random draw — the same
 * play always produces the same Setback at the same moment.
 *
 * This is what removes the design's largest risk. The genre research found *no
 * shipped incremental* that fires an involuntary progression loss on an
 * uncontrolled roll, which would have made this game the experiment. An event
 * trigger is not a roll, so it does not have to be.
 *
 * ### The escalation
 *
 * How hard it lands is how long you took to get from the arming milestone to
 * the firing one, measured in `playTime`.
 *
 * `playTime` and not the wall clock: it advances only in `tick()`, is clamped
 * to two minutes a step, and the offline settle never touches it. It pauses
 * exactly when the player is away, which is the passive-only rule expressed as
 * a clock. A wall clock would mean a fortnight's holiday returned you to
 * maximum damage, which contradicts the whole of R51.
 *
 * ### The damage is seconds of income, and the difference is refunded
 *
 * Upgrade levels are the wrong unit by four orders of magnitude — two levels of
 * rod is 4,413 coins at rod 5 and 3.103e17 at rod 30. So the levels are
 * theatre: the Setback takes `SETBACK_LEVELS` of a track, works out what those
 * levels cost, caps the real loss at a number of seconds of the player's
 * current income, and **refunds the difference in coins**.
 *
 * Late in a run that refund is nearly the whole rebuy cost. Early it is nearly
 * nothing. Either way the Setback costs about the same *amount of game*.
 */

/** The purse at which the hill finally wins, if the bicycle is still yours. */
export const SETBACK_CRASH_COINS = 5e7;

export type SetbackId = 'bait_thief' | 'torn_net' | 'harbour_cut' | 'the_crash';

export interface SetbackDefinition {
	id: SetbackId;
	/** What the player is told it was. */
	name: string;
	/** Shown when it arms — the warning you can outrun. */
	notice: string;
	/** Shown when it lands. */
	blow: string;
	/** Which track loses the theatrical levels. */
	track: UpgradeId;
	/** The milestone that starts the clock. */
	arms: (state: GameState) => boolean;
	/** The milestone that ends it. */
	fires: (state: GameState) => boolean;
}

/**
 * Four Setbacks, each armed by one milestone and fired by the next.
 *
 * Every one of them arms on something the player did on purpose and fires on
 * something else the player did on purpose, so a Setback is always the answer
 * to "what did I just do", never to "why did the game do that".
 */
export const SETBACKS: SetbackDefinition[] = [
	{
		id: 'bait_thief',
		name: 'The Bait Thief',
		notice:
			'Word around the water is that someone has been helping themselves to other people’s bait. Nobody has seen him.',
		blow: 'He got to yours. Half a season of good bait, gone overnight, and the net you were saving for went with it.',
		track: 'lure',
		arms: (state) => Object.values(state.deckhands).some((count) => count.gt(0)),
		fires: (state) => state.unlocked[FishingSources.River]
	},
	{
		id: 'torn_net',
		name: 'The Snag',
		notice:
			'There is something down there the charts do not have. The older hands work around it and do not talk about it.',
		blow: 'You found it. The net came up in three pieces and most of a morning went into the water with it.',
		track: 'net',
		arms: (state) => state.boat.owned,
		fires: (state) => state.unlocked[FishingSources.Offshore]
	},
	{
		id: 'harbour_cut',
		name: 'The Harbourmaster’s Cut',
		notice:
			'The harbourmaster has started asking how the season is going. He asks everyone. He remembers the answers.',
		blow: 'The berth fee has been reassessed, backdated, and is not negotiable. Your buyer heard about it before you did.',
		track: 'market',
		arms: (state) => state.licences.lakes === true,
		fires: (state) => state.licences.deep === true
	},
	{
		id: 'the_crash',
		name: 'The Crash',
		notice:
			'That bicycle has been making a noise on the hill for a week now. It is probably nothing.',
		blow: 'It was not nothing. The frame is bent past straightening, the load went across the road, and you walked the rest of the way.',
		track: 'rod',
		arms: (state) => state.hasBicycle,
		// Once, at a threshold, and only while the bicycle is still what you
		// depend on. Hire the Assistant first and it never happens (R67).
		fires: (state) => !state.hasAssistant && state.lifetimeCoins.gte(SETBACK_CRASH_COINS)
	}
];

export const SETBACKS_BY_ID = new Map(SETBACKS.map((setback) => [setback.id, setback]));

export interface SetbackHit {
	id: SetbackId;
	name: string;
	blow: string;
	track: UpgradeId;
	/** Seconds of income it actually cost. */
	seconds: number;
	/** Coins lost. */
	lost: Decimal;
	/** Coins handed back because the levels were worth more than the damage. */
	refunded: Decimal;
	/** Levels taken off the track. */
	levels: number;
}

/** Has this one already happened, or already been outrun? */
function done(state: GameState, id: SetbackId): boolean {
	return state.setbacksSeen.includes(id);
}

/**
 * How much of the escalation has been earned, 0 to 1.
 *
 * Linear in `playTime` between arming and firing, saturating at
 * `SETBACK_RAMP_SECONDS`. Reach the next milestone quickly and it is a scratch;
 * take your time and it is five times that.
 */
export function escalation(state: GameState, id: SetbackId): number {
	const armedAt = state.setbacksArmedAt[id];
	if (armedAt === undefined) return 0;
	const waited = Math.max(0, state.playTime - armedAt);
	return Math.min(1, waited / SETBACK_RAMP_SECONDS);
}

/**
 * Fire one Setback and return what it cost.
 *
 * The damage is `min(what the levels cost to rebuy, seconds x income)`, and
 * everything the levels were worth beyond that comes straight back as coins.
 */
export function strike(
	state: GameState,
	modifiers: Modifiers,
	definition: SetbackDefinition
): SetbackHit {
	const frac = escalation(state, definition.id);
	const seconds = SETBACK_BASE_SECONDS + (SETBACK_MAX_SECONDS - SETBACK_BASE_SECONDS) * frac;

	// The crew's income once there is a crew, the player's hands before that —
	// `totalIncomePerSecond` is exactly zero until the first deckhand, and a
	// Setback sized against zero is not a Setback.
	const income = Decimal.max(
		totalIncomePerSecond(state, modifiers),
		handIncomePerSecond(state, modifiers)
	);

	const level = state.upgrades[definition.track];
	const levels = Decimal.min(D(SETBACK_LEVELS), level);
	const gross = levels.gt(0)
		? upgradeBulkCost(definition.track, level.minus(levels), levels)
		: d0();

	const lost = Decimal.min(gross, income.times(seconds));
	const refunded = Decimal.max(d0(), gross.minus(lost));

	refundUpgrade(state, definition.track, levels, refunded);

	state.setbacksSeen = [...state.setbacksSeen, definition.id];
	delete state.setbacksArmedAt[definition.id];

	return {
		id: definition.id,
		name: definition.name,
		blow: definition.blow,
		track: definition.track,
		seconds,
		lost,
		refunded,
		levels: levels.toNumber()
	};
}

export interface SetbackTick {
	/** Setbacks that have just armed, and the warning that goes with them. */
	armed: SetbackDefinition[];
	/** Setbacks that have just landed. */
	hits: SetbackHit[];
}

/**
 * Evaluate every Setback.
 *
 * Called from `tick()` and **only** from `tick()`. Never from the offline
 * settle and never from `resume()`: a Setback is something that happens to you
 * while you are there, and one that fires while the tab is shut is a number
 * that changed for no reason anyone saw.
 */
export function evaluateSetbacks(state: GameState, modifiers: Modifiers): SetbackTick {
	const armed: SetbackDefinition[] = [];
	const hits: SetbackHit[] = [];

	for (const definition of SETBACKS) {
		if (done(state, definition.id)) continue;

		const isArmed = state.setbacksArmedAt[definition.id] !== undefined;

		if (!isArmed) {
			if (definition.arms(state)) {
				state.setbacksArmedAt[definition.id] = state.playTime;
				armed.push(definition);
			}
			continue;
		}

		if (definition.fires(state)) hits.push(strike(state, modifiers, definition));
	}

	return { armed, hits };
}

/** What a Setback took, in words the panel can use. */
export function describeTrack(track: UpgradeId): string {
	return UPGRADES[track].name;
}
