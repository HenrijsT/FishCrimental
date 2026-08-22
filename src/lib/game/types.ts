import type Decimal from 'break_eternity.js';
import type { FishType } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { PrestigeUpgradeId, UpgradeId } from './config';

export interface GameSettings {
	/** Accumulate earnings while the tab is closed. */
	offlineProgress: boolean;
	/** Skip the cast-bar animation and other movement. */
	reduceMotion: boolean;
	/** Show the raw exponent instead of K/M/B/T. */
	scientificNotation: boolean;
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

	// Progress
	/** Lifetime catches per species name — the Fishdex. */
	dex: Record<string, Decimal>;
	totalCasts: Decimal;
	totalFish: Decimal;

	unlocked: Record<FishingSources, boolean>;
	activeSource: FishingSources;

	upgrades: Record<UpgradeId, Decimal>;
	deckhands: Record<FishingSources, Decimal>;

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
	/** The permanent Pearl bonus, applied to both catch size and sale value. */
	pearlMultiplier: Decimal;
}

export interface CatchOutcome {
	fish: import('$lib/fishes/fish').Fish;
	count: Decimal;
	value: Decimal;
}

export interface OfflineReport {
	seconds: number;
	cappedSeconds: number;
	fish: Decimal;
	value: Decimal;
	coins: Decimal;
	autoSold: boolean;
}
