import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';

export interface SourceConfig {
	/** Unlock order — Pond first, Ocean last. */
	order: number;
	/** Coins needed to unlock. Pond is free. */
	unlockCost: number;
	/** Seconds a single unmodified cast takes. Deeper water is slower. */
	castSeconds: number;
	/** Everything landed here is worth this much more. */
	valueMultiplier: number;
	/** Coin cost of this source's first deckhand. */
	deckhandBaseCost: number;
	/** Rarity weights for this source. Only listed types can be caught here. */
	typeWeights: Partial<Record<FishType, number>>;
}

/**
 * Tuned against `simulateRun()` in `balance.test.ts` — the greedy-buy
 * simulation has to reach the first prestige near 1e15 lifetime coins.
 * Deliberately un-round so the curve does not read as hand-placed.
 */
export const SOURCE_CONFIG: Record<FishingSources, SourceConfig> = {
	[FishingSources.Pond]: {
		order: 0,
		unlockCost: 0,
		castSeconds: 1.15,
		valueMultiplier: 1,
		deckhandBaseCost: 265,
		typeWeights: {
			[FishType.Small]: 92,
			[FishType.Medium]: 7.4,
			[FishType.Large]: 0.6,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Stream]: {
		order: 1,
		unlockCost: 655,
		castSeconds: 1.55,
		valueMultiplier: 4.6,
		deckhandBaseCost: 1480,
		typeWeights: {
			[FishType.Small]: 88,
			[FishType.Medium]: 12,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.River]: {
		order: 2,
		unlockCost: 17400,
		castSeconds: 2.05,
		valueMultiplier: 13.4,
		deckhandBaseCost: 38500,
		typeWeights: {
			[FishType.Small]: 76,
			[FishType.Medium]: 19,
			[FishType.Large]: 4.6,
			[FishType.Shark]: 0.4,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Lake]: {
		order: 3,
		unlockCost: 448000,
		castSeconds: 2.7,
		valueMultiplier: 79,
		deckhandBaseCost: 995000,
		typeWeights: {
			[FishType.Small]: 68,
			[FishType.Medium]: 26,
			[FishType.Large]: 6,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Lagoon]: {
		order: 4,
		unlockCost: 11900000,
		castSeconds: 3.55,
		valueMultiplier: 308,
		deckhandBaseCost: 25800000,
		typeWeights: {
			[FishType.Small]: 52,
			[FishType.Medium]: 33,
			[FishType.Large]: 14.2,
			[FishType.Jelly]: 0.8,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Sea]: {
		order: 5,
		unlockCost: 304000000,
		castSeconds: 4.65,
		valueMultiplier: 84,
		deckhandBaseCost: 670000000,
		typeWeights: {
			[FishType.Small]: 41,
			[FishType.Large]: 27,
			[FishType.Shark]: 30,
			[FishType.Jelly]: 2,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Offshore]: {
		order: 6,
		unlockCost: 7900000000,
		castSeconds: 6.1,
		valueMultiplier: 237,
		deckhandBaseCost: 17400000000,
		typeWeights: {
			[FishType.Large]: 44,
			[FishType.Shark]: 53,
			[FishType.Jelly]: 3,
			[FishType.Erotic]: 0.00011
		}
	},
	[FishingSources.Ocean]: {
		order: 7,
		unlockCost: 206000000000,
		castSeconds: 8,
		valueMultiplier: 1010,
		deckhandBaseCost: 450000000000,
		typeWeights: {
			[FishType.Large]: 31,
			[FishType.Shark]: 65,
			[FishType.Jelly]: 4,
			[FishType.Erotic]: 0.00011
		}
	}
};

/** Pond → Stream → River → Lake → Lagoon → Sea → Offshore → Ocean. */
export const SOURCE_ORDER: FishingSources[] = (Object.keys(SOURCE_CONFIG) as FishingSources[]).sort(
	(a, b) => SOURCE_CONFIG[a].order - SOURCE_CONFIG[b].order
);

export const DEEPEST_SOURCE = SOURCE_ORDER[SOURCE_ORDER.length - 1];

export type UpgradeId = 'rod' | 'net' | 'lure' | 'market' | 'crew';

export interface UpgradeConfig {
	id: UpgradeId;
	name: string;
	description: string;
	/** Coin cost of level 1. */
	baseCost: number;
	/** Cost of level n is `baseCost * costGrowth^n`. */
	costGrowth: number;
	/** Per-level effect factor. */
	effect: number;
	maxLevel: number;
	/** Rendered summary of the level-n effect. */
	format: (level: number) => string;
}

export const UPGRADES: Record<UpgradeId, UpgradeConfig> = {
	rod: {
		id: 'rod',
		name: 'Graphite Rod',
		description: 'Every cast lands faster. Compounds with itself.',
		baseCost: 21,
		costGrowth: 3.58,
		effect: 0.917,
		maxLevel: 70,
		format: (level) => `cast time ×${Math.pow(0.917, level).toFixed(3)}`
	},
	net: {
		id: 'net',
		name: 'Wider Net',
		description: 'More fish come up on every single cast.',
		baseCost: 63,
		costGrowth: 4.04,
		effect: 1.19,
		maxLevel: 80,
		format: (level) => `${Math.pow(1.19, level).toFixed(2)} fish per cast`
	},
	lure: {
		id: 'lure',
		name: 'Glimmer Lure',
		description: 'Shifts the odds away from tiddlers and toward the good stuff.',
		baseCost: 340,
		costGrowth: 4.63,
		effect: 1.28,
		maxLevel: 45,
		format: (level) => `rare weight ×${Math.pow(1.28, level).toFixed(2)}`
	},
	market: {
		id: 'market',
		name: 'Market Contacts',
		description: 'Buyers who actually pay what the catch is worth.',
		baseCost: 128,
		costGrowth: 3.71,
		effect: 1.42,
		maxLevel: 80,
		format: (level) => `sale value ×${Math.pow(1.42, level).toFixed(2)}`
	},
	crew: {
		id: 'crew',
		name: 'Crew Quarters',
		description: 'Rested deckhands work every line harder.',
		baseCost: 5_400,
		costGrowth: 4.17,
		effect: 1.13,
		maxLevel: 60,
		format: (level) => `deckhand output ×${Math.pow(1.13, level).toFixed(2)}`
	}
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/** Cost of deckhand n+1 at a source is `deckhandBaseCost * DECKHAND_COST_GROWTH^n`. */
export const DECKHAND_COST_GROWTH = 1.79;

/** A deckhand casts this fraction as fast as the player holding the rod. */
export const DECKHAND_BASE_EFFICIENCY = 0.42;

/** A cast can never get faster than this, however much rod you buy. */
export const MIN_CAST_SECONDS = 0.05;

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

/** Lifetime coins needed before the Ocean will trade you a Pearl. */
export const PRESTIGE_THRESHOLD = 1e15;

/** `pearls = floor((lifetime / PRESTIGE_THRESHOLD) ^ PEARL_EXPONENT)`. */
export const PEARL_EXPONENT = 0.42;

/** Each pearl adds to a global catch-and-sell multiplier. */
export const PEARL_MULTIPLIER_SCALE = 0.5;
export const PEARL_MULTIPLIER_EXPONENT = 0.9;

export type PrestigeUpgradeId =
	'pearl_yield' | 'pearl_speed' | 'pearl_luck' | 'pearl_crew' | 'pearl_headstart';

export interface PrestigeUpgradeConfig {
	id: PrestigeUpgradeId;
	name: string;
	description: string;
	baseCost: number;
	costGrowth: number;
	effect: number;
	maxLevel: number;
	format: (level: number) => string;
}

export const PRESTIGE_UPGRADES: Record<PrestigeUpgradeId, PrestigeUpgradeConfig> = {
	pearl_yield: {
		id: 'pearl_yield',
		name: 'Pearl Brokerage',
		description: 'Every sale, forever, is worth more.',
		baseCost: 1,
		costGrowth: 2.6,
		effect: 2.15,
		maxLevel: 25,
		format: (level) => `sale value ×${Math.pow(2.15, level).toFixed(2)}`
	},
	pearl_speed: {
		id: 'pearl_speed',
		name: 'Tide Reader',
		description: 'You know when the fish are moving. Casts land quicker.',
		baseCost: 2,
		costGrowth: 2.9,
		effect: 0.86,
		maxLevel: 20,
		format: (level) => `cast time ×${Math.pow(0.86, level).toFixed(3)}`
	},
	pearl_luck: {
		id: 'pearl_luck',
		name: 'Pearl Diver’s Eye',
		description: 'You see the shapes under the boat before the line goes down.',
		baseCost: 3,
		costGrowth: 3.3,
		effect: 1.62,
		maxLevel: 18,
		format: (level) => `rare weight ×${Math.pow(1.62, level).toFixed(2)}`
	},
	pearl_crew: {
		id: 'pearl_crew',
		name: 'Legendary Crew',
		description: 'Deckhands who have heard of you before you hired them.',
		baseCost: 4,
		costGrowth: 3.1,
		effect: 1.55,
		maxLevel: 20,
		format: (level) => `deckhand output ×${Math.pow(1.55, level).toFixed(2)}`
	},
	pearl_headstart: {
		id: 'pearl_headstart',
		name: 'Standing Charter',
		description: 'Start each run with deeper water already open to you.',
		baseCost: 6,
		costGrowth: 5.4,
		effect: 1,
		maxLevel: 7,
		format: (level) => `start with ${level} extra source${level === 1 ? '' : 's'} unlocked`
	}
};

export const PRESTIGE_UPGRADE_IDS = Object.keys(PRESTIGE_UPGRADES) as PrestigeUpgradeId[];

// ---------------------------------------------------------------------------
// Loop / persistence
// ---------------------------------------------------------------------------

/** How often the simulation advances. The progress bar animates independently. */
export const TICK_MS = 200;

/** Offline earnings are capped at eight hours. */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

/** Offline deckhands are a little less productive than watched ones. */
export const OFFLINE_EFFICIENCY = 0.75;

export const SAVE_KEY = 'fishcrimental.save';
export const SAVE_VERSION = 1;
export const AUTOSAVE_MS = 10_000;
