import type Decimal from 'break_eternity.js';
import type { FishType } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { BoatUpgradeId, LicenceId, PrestigeUpgradeId, UpgradeId } from './config';
import type { Bust } from './police';
import type { SetbackId } from './setbacks';

export interface BoatState {
	owned: boolean;
	/** Litres in the tank. */
	fuel: Decimal;
	/**
	 * 0–100. A UI dial rather than a game quantity, so a plain number is right:
	 * it is bounded, it never compounds, and it is never spent.
	 */
	condition: number;
	upgrades: Record<BoatUpgradeId, Decimal>;
}

export interface GameSettings {
	/** Accumulate earnings while the tab is closed. */
	offlineProgress: boolean;
	/** Skip the cast-bar animation and other movement. */
	reduceMotion: boolean;
	/** Show the raw exponent instead of K/M/B/T. */
	scientificNotation: boolean;
	/**
	 * Show a short guide when something new opens up (R55).
	 *
	 * On by default and opt-**out**, because the players who need it are exactly
	 * the ones who will not go looking for a setting. It is a pointer at Help,
	 * never a wall of text, and Help is always there whether this is on or not.
	 */
	unlockGuides: boolean;
}

/**
 * Fish in a container, by species, alongside what they were worth when caught.
 *
 * The market prices a *species*, and species identity does not survive the
 * catch anywhere else: `hold` is six `FishType` buckets and `holdValue` is one
 * scalar. Both of those stay exactly as they are — this runs beside them.
 *
 * `worth` is separate from `fish` rather than derived from it because the same
 * species is worth different money in different water: `valueMultiplier` spans
 * up to 1232x for one species across the sources it appears in.
 */
export interface SpeciesLedger {
	/** Species name to count. */
	fish: Record<string, Decimal>;
	/** Species name to coin worth, before the market has its say. */
	worth: Record<string, Decimal>;
}

/**
 * A breeding pond (R68).
 *
 * One species, chosen by the player from what they have already caught, bred
 * passively. `species` is `null` for a pond that has been dug but not stocked.
 *
 * The pond's position in `ponds` is its id — ponds are only ever added, never
 * removed, so the index is stable and is what keys its remainder bank.
 */
export interface PondState {
	species: string | null;
	level: Decimal;
}

/**
 * A licence examination in progress (R42).
 *
 * Deliberately **not persisted**. An attempt is free, retryable and short, and
 * a half-finished minigame is state that would have to be validated, migrated
 * and defended against hand-editing for no benefit a player would notice. A
 * reload costs you the attempt and nothing else, and the panel says so.
 */
export interface ExamState {
	licence: LicenceId;
	kind: 'quota' | 'cull' | 'sounder' | 'longline';
	progress: number;
	target: number;
	/** Calls made — how well it is going, not whether it can be failed. */
	attempts: number;
	/** Quota: the species the warden named. */
	species?: string;
	/** Cull: the size of the fish currently in your hands. */
	offer?: string;
	/** Sounder: what is still possible, and what the bottom actually is. */
	low?: number;
	high?: number;
	secret?: number;
	/** Seconds of not being touched, banked toward the next automatic step. */
	banked?: number;
}

export interface GameState {
	version: number;

	// Currency
	coins: Decimal;
	/** Coins earned since the last prestige — what Pearls are priced off. */
	lifetimeCoins: Decimal;
	/** Coins earned across every run. */
	allTimeCoins: Decimal;

	// The hold
	hold: Record<FishType, Decimal>;
	/** Coin value of everything currently in the hold. */
	holdValue: Decimal;

	/**
	 * Fish set aside on the quay for the travelling merchant (R65).
	 *
	 * Listing takes them out of the bucket immediately, which is the point —
	 * you get the room back now and the coins when he arrives. They are *not*
	 * part of `hold`, so `holdCount` and the bucket never see them, and they are
	 * priced when he pays rather than when they were listed.
	 */
	consignment: Record<FishType, Decimal>;
	/** Coin value of the consignment, at full price. */
	consignmentValue: Decimal;

	/** The same fish as `hold`, by species, for the market to price. */
	holdSpecies: SpeciesLedger;
	/** The same fish as `consignment`, by species. */
	consignmentSpecies: SpeciesLedger;

	/**
	 * Selling pressure standing against each species.
	 *
	 * **`Decimal`, not `number`.** Sales at depth run to arbitrary magnitudes,
	 * and an `Infinity` here would flow straight into `holdValue`, coins and the
	 * save file — which has happened in this codebase before.
	 *
	 * Deliberately **not** in `CarryOver`: `dex` is carried and this is not, and
	 * that asymmetry is the mechanic.
	 */
	marketPressure: Record<string, Decimal>;
	/** One timestamp for the whole book — the decay factor is species-independent. */
	marketUpdatedAt: number;

	/** Breeding ponds, in the order they were dug. The index is the pond's id. */
	ponds: PondState[];

	/** The licence exam being sat, if any. Never saved — see `ExamState`. */
	exam: ExamState | null;

	/**
	 * Water being fished without the paper for it, if any (R48).
	 *
	 * An explicit, deliberate act — `setSource` still refuses blocked water, and
	 * only `poachSource` sets this. Nothing drifts into poaching by accident.
	 */
	poaching: FishingSources | null;
	/** Seconds fished on the current poach. Cleared by a bust or by leaving. */
	poachElapsed: number;
	/**
	 * What has been landed on this poach, by species.
	 *
	 * A ledger and not a scalar, so a bust can take the poached fish and leave
	 * the legal ones. With one number the warden seized "nine hundred coins'
	 * worth" out of a mixed bucket by value share, which meant ninety legal
	 * guppies went back in the water so that one stolen pike could stay.
	 */
	poached: SpeciesLedger;
	/** Busts per source, this run. The fine escalates on this. */
	poachOffences: Partial<Record<FishingSources, number>>;
	/**
	 * Absolute deadline, in ms, until which the police keep you off the water.
	 *
	 * Its own field and not `fishingBlockedUntil`, which the Assistant is
	 * allowed to bypass. An Assistant runs your catch into town; it does not
	 * argue with a warden.
	 */
	bustedUntil: number;

	/**
	 * Setbacks that have already happened — or been outrun, which counts as
	 * having happened (R52). Mirrors `achievements`, and is carried across a
	 * prestige: a Setback happens once, in a life, not once a run.
	 */
	setbacksSeen: SetbackId[];
	/**
	 * `playTime` at which each armed Setback armed. **Not** carried across a
	 * prestige — the progression that armed it is wiped, so it re-arms fresh.
	 */
	setbacksArmedAt: Partial<Record<SetbackId, number>>;

	// Progress
	/** Lifetime catches per species name — the Fishdex. */
	dex: Record<string, Decimal>;
	/**
	 * Sub-unit remainders banked by `takeWhole`, keyed by `source#thing`. Every
	 * value is a plain number in `[0, 1)` — these are fractions of a unit, not
	 * counts, so they never need Decimal and never mix with one.
	 */
	carry: Record<string, number>;
	totalCasts: Decimal;
	totalFish: Decimal;

	unlocked: Record<FishingSources, boolean>;
	activeSource: FishingSources;

	/** Paper. Bought once, kept for the run. */
	licences: Record<LicenceId, boolean>;
	boat: BoatState;

	upgrades: Record<UpgradeId, Decimal>;
	deckhands: Record<FishingSources, Decimal>;

	/**
	 * Absolute wall-clock deadline, in ms, of the next trader's arrival.
	 *
	 * A deadline and not a countdown, for the same reason as the town trip: a
	 * hidden tab throttles timers and the offline settle never calls `tick()`,
	 * so a counted-down trader would simply never arrive while you were away.
	 */
	nextTraderAt: number;
	/** How many traders have been past. Rotates what they carry. */
	traderVisits: number;

	/** How good the chart is. Level 0 is the one that came with the property. */
	mapLevel: Decimal;
	/** How big the bucket is. Level 0 is the one you started with. */
	bucketLevel: Decimal;
	/** Bought or fished up. Unlocks riding to town for the full price. */
	hasBicycle: boolean;
	/**
	 * Absolute wall-clock deadline, in ms, before which manual casting is
	 * refused because you are in town selling.
	 *
	 * A deadline rather than a countdown: a hidden tab throttles timers to
	 * roughly once a minute and `#settleOffline` never calls `tick()` at all, so
	 * anything counted down never expires while the player is away.
	 */
	fishingBlockedUntil: number;
	/** The Assistant: full price with no trip, and no bucket cap. */
	hasAssistant: boolean;

	/** Level of the Clockwork Rig. 0 means it has not been bought. */
	autoFisher: Decimal;
	/** Whether the rig has been paid to keep working while the game is shut. */
	autoFisherOffline: boolean;

	// Prestige
	pearls: Decimal;
	allTimePearls: Decimal;
	prestigeUpgrades: Record<PrestigeUpgradeId, Decimal>;
	prestigeCount: Decimal;

	achievements: string[];
	/** Set the first time the player prestiges — the run is "finished". */
	completed: boolean;
	/** Whether the end-of-game jellyfish gag has already been shown. */
	jellyJokeSeen: boolean;
	/** Whether the Lovestruck Lipfish reveal has already been shown. */
	eroticJokeSeen: boolean;

	startedAt: number;
	lastUpdate: number;
	/** Seconds of active play. */
	playTime: number;

	settings: GameSettings;
}

export interface Modifiers {
	/** Seconds per cast, per source, after every speed effect. */
	castSeconds: Record<FishingSources, number>;
	/** Fish landed per completed cast. */
	fishPerCast: Decimal;
	/** Multiplier applied to the weight of every rare fish type. */
	luck: number;
	/** Multiplier on the coin value of a sale. */
	sellMultiplier: Decimal;
	/** Casts per second contributed by a single deckhand, per source. */
	deckhandCastsPerSecond: Record<FishingSources, number>;
	/** Litres burned per cast in open water. */
	fuelPerCast: Decimal;
	/** Condition points lost per cast in open water. */
	wearPerCast: number;
	/** Tank size in litres. */
	fuelCapacity: Decimal;
	/** 0.4–1: how hard the boat is willing to work at its current condition. */
	boatEfficiency: number;
	/** The permanent Pearl bonus, applied to both catch size and sale value. */
	pearlMultiplier: Decimal;
}

export interface CatchOutcome {
	fish: import('$lib/fishes/fish').Fish;
	count: Decimal;
	value: Decimal;
}

/**
 * What the crew did while the game was shut.
 *
 * There is no `coins` line and no trader: offline is passive (R51), so nothing
 * was sold and the night is fish, not money. The only coins that move are the
 * fuel the standing order bought out of what was banked before leaving.
 */
export interface OfflineReport {
	seconds: number;
	cappedSeconds: number;
	/** Fish landed while away. */
	fish: Decimal;
	/** What they are worth at full price, before whoever buys them takes a cut. */
	value: Decimal;
	/** Coins spent on fuel by the standing order while you were away. */
	fuelSpent: Decimal;
	/** This player's offline window, in seconds — eight hours plus Night Watch. */
	offlineCap: number;
	/** True if the boat ran dry and the crew worked inshore instead. */
	fellBack: boolean;
	/** Everything in the hold now, tonight's catch included. */
	holdAfter: Decimal;
	/** True if the keepnet filled and the rest went back in the water. */
	holdFull: boolean;
	/** The warden, if he came. Never null and silent — see `#settleOffline`. */
	evicted: Bust | null;
}
