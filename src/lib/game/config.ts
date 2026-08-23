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
	[FishingSources.MudPool]: {
		order: 0,
		unlockCost: 0,
		// Quick and worthless: a cast takes no time because there is no depth to
		// it, and nothing in there is worth anything. Small fish only.
		castSeconds: 0.95,
		// Exactly a quarter of a Pond fish — and exactly representable in binary,
		// which matters: `holdValue` accumulates per catch while the hold is
		// priced in one multiplication, and a multiplier like 0.3 makes those two
		// drift apart in the twelfth decimal place.
		valueMultiplier: 0.25,
		deckhandBaseCost: 70,
		typeWeights: {
			[FishType.Small]: 100
		}
	},
	[FishingSources.Pond]: {
		order: 1,
		// No longer free — it is the first thing the mud pool pays for.
		unlockCost: 75,
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
		order: 2,
		unlockCost: 530,
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
		order: 3,
		unlockCost: 13900,
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
		order: 4,
		unlockCost: 356000,
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
		order: 5,
		unlockCost: 9450000,
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
		order: 6,
		unlockCost: 244000000,
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
		order: 7,
		unlockCost: 6310000000,
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
		order: 8,
		unlockCost: 164000000000,
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
		costGrowth: 3.62,
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

// ---------------------------------------------------------------------------
// Shopkeepers
// ---------------------------------------------------------------------------

/**
 * How much of a track the shopkeeper in each place will sell you, as a
 * fraction of its maximum level, indexed by that place's position in
 * `SOURCE_ORDER`.
 *
 * This is the whole shopkeeper mechanic: *"you cannot purchase the best parts
 * without purchasing previous ones — you have to progress to new places to
 * unlock better shopkeepers."* The man at the mud pool sells the cheap end of
 * everything and nothing else; getting the best rod means reaching the place
 * that stocks it.
 *
 * Expressed as one array rather than a per-track table so the ladder cannot
 * drift between tracks, and so adding a source cannot silently leave a track
 * ungated. A test asserts the length matches `SOURCE_ORDER`, that it rises,
 * and that it ends at 1 — the last place must sell everything, or a track
 * would be unfinishable.
 */
export const SHOPKEEPER_REACH = [0.08, 0.16, 0.26, 0.4, 0.55, 0.7, 0.82, 0.92, 1] as const;

/** Cost of deckhand n+1 at a source is `deckhandBaseCost * DECKHAND_COST_GROWTH^n`. */
export const DECKHAND_COST_GROWTH = 1.79;

/** A deckhand casts this fraction as fast as the player holding the rod. */
export const DECKHAND_BASE_EFFICIENCY = 0.42;

/** A cast can never get faster than this, however much rod you buy. */
export const MIN_CAST_SECONDS = 0.05;

// ---------------------------------------------------------------------------
// Selling: the trader, the bicycle, the Assistant
// ---------------------------------------------------------------------------

/**
 * What a passing trader pays, as a fraction of what the catch is worth.
 *
 * The trader is the only buyer a fisherman with no transport has, and he knows
 * it. Everything before the bicycle sells at this rate.
 */
export const TRADER_RATE = 0.55;

/** Riding into town yourself gets the full price. That is the whole point. */
export const TOWN_RATE = 1;

/** Coins for the bicycle, bought from the trader. */
export const BICYCLE_COST = 900;

/**
 * How long a trip into town keeps you off the water.
 *
 * 75 seconds was most of two trader periods spent looking at a disabled cast
 * button, and the ride is a *reward* — it is the full price. R66 cuts it to 40,
 * which is still long enough that the merchant is a real alternative and short
 * enough that taking the better price does not feel like a punishment.
 */
export const TOWN_TRIP_SECONDS = 40;

/**
 * The Assistant minds the shop: no trip, no cooldown, full price — and no
 * bucket, because someone is there to empty it.
 *
 * Priced above the first Pond deckhand (`deckhandBaseCost` 46) by a wide
 * margin, per the owner: "costs more than first deckhand, not too early but
 * also not too far in the game."
 */
export const ASSISTANT_COST = 26_000;

/** How often a trader comes past. */
/**
 * Short enough that the opening is not spent waiting. A starting bucket fills
 * in roughly half this, so the rhythm is fish-a-while, wait-a-little.
 */
export const TRADER_PERIOD_SECONDS = 45;

/** How many offers he carries at a time. */
export const TRADER_STOCK_SIZE = 2;

/** Everything a trader will ever sell. Two of these are in stock per visit. */
export type TraderOfferId = 'bicycle' | 'bucket' | 'assistant';

export const TRADER_CATALOGUE: TraderOfferId[] = ['bicycle', 'bucket', 'assistant'];

/**
 * The bucket.
 *
 * A poor fisherman carries what he can carry. The bucket filling is the whole
 * reason the trader matters, and the reason the Assistant is worth hiring.
 *
 * It is upgradeable for a reason that is not flavour: `#settleOffline` sells
 * between chunks, so offline throughput is `chunks x capacity` — at most
 * `OFFLINE_CHUNKS` bucketfuls a night, whatever the crew size. A fixed cap
 * would turn an implementation detail into the game's offline income ceiling,
 * so capacity has to outrun the crew until the Assistant retires it.
 */
export const BUCKET_BASE_CAPACITY = 30;
/**
 * Capacity has to climb faster than the cost, or the bucket falls behind the
 * crew and the cap becomes the offline ceiling.
 *
 * Measured: 20 Pond deckhands land 6,574 fish per offline chunk. At the first
 * tuning (capacity x2.6, cost x3.15) the level that covered that cost 78,697
 * cumulative — three times the Assistant — so the player would always retire
 * the bucket before ever upgrading it, and doubling the crew produced only
 * 1.41x the night instead of 2x. At x3.4 against x2.9, level 5 holds 6,817 for
 * 17,190 cumulative, which is inside the Assistant's price. The two now
 * genuinely compete.
 */
export const BUCKET_GROWTH = 3.4;
export const BUCKET_BASE_COST = 55;
export const BUCKET_COST_GROWTH = 2.9;
export const BUCKET_MAX_LEVEL = 12;

// ---------------------------------------------------------------------------
// The auto-fisher
// ---------------------------------------------------------------------------

/**
 * A rig that holds the rod for you. Distinct from a deckhand: a deckhand works
 * one source on their own, the auto-fisher works whichever water *you* are
 * pointing at, exactly as your own hand would.
 *
 * Level 1 casts at `AUTO_FISHER_START` of human speed and the top level casts
 * at exactly 1.0 — it removes the tedium of holding a button, it never beats
 * playing. It also stands down entirely while you are holding the rod
 * yourself, so the two can never stack.
 *
 * Why 0.2 (5x slower) rather than a rounder 2x or 10x: the anchor is
 * `DECKHAND_BASE_EFFICIENCY`, 0.42. A first-level auto-fisher has to be worth
 * buying without dominating the crew track it competes with for the same
 * coins. At 0.42 or above it would strictly beat a deckhand *and* need no
 * per-source purchase, so nobody would hire anyone. Much below 0.2 and its
 * first level buys less than half a deckhand for several times the price, so
 * nobody would buy it. 0.2 is just under half a deckhand: a real alternative
 * at the moment it unlocks, and never the obvious one.
 */
export const AUTO_FISHER_START = 0.2;

export interface AutoFisherConfig {
	name: string;
	description: string;
	baseCost: number;
	costGrowth: number;
	maxLevel: number;
}

export const AUTO_FISHER: AutoFisherConfig = {
	name: 'Clockwork Rig',
	description: 'A sprung arm that works the rod for you, wherever you have pointed it.',
	// Level 1 lands around the ten-minute mark, which is where holding the
	// button stops being novel and starts being a chore. Growth sits inside the
	// 3.58-4.63 band the gear tracks use, at the expensive end, because a fully
	// upgraded rig is a second pair of hands.
	baseCost: 2_400,
	costGrowth: 4.45,
	maxLevel: 12
};

/**
 * Making the rig work while the game is closed. One purchase, no levels.
 *
 * Priced above the Ocean unlock (1.64e11) on purpose: in the run where it
 * first becomes reachable it is a genuine choice against opening the last
 * source, not a box to tick on the way past.
 */
export const AUTO_FISHER_OFFLINE_COST = 5e11;

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

/**
 * How many bucketfuls a night is worth.
 *
 * Offline is passive (R51): the crew fish, and nothing else happens. Nobody
 * sells, so the hold is the only place the night can go, and a bucket that
 * held thirty fish would make an eight-hour night worth about forty-five
 * seconds of watched play.
 *
 * This number is not new. The settle used to run in `OFFLINE_CHUNKS = 24`
 * chunks and sell between each, so the night's ceiling was already
 * `24 x capacity`. Keeping 24 keeps that ceiling exactly and changes only what
 * you come back to: fish in the keepnet rather than coins in the purse, which
 * you now sell yourself. It also keeps the bucket's reason to exist — it is
 * still what sizes a night, x24.
 */
export const OFFLINE_HOLD_MULTIPLIER = 24;

/**
 * The most of your banked coins the standing fuel order may spend while you
 * are away.
 *
 * `runBoat` buys fuel out of `state.coins` and under R51 no coins arrive
 * offline, so the order can only ever draw on what was banked before leaving.
 * Left uncapped it would draw on *all* of it, and coming back to an empty
 * purse because the boat sailed all night is a worse outcome than the boat
 * stopping and the crew working inshore — which is a state the game already
 * handles and reports.
 */
export const OFFLINE_FUEL_SHARE = 0.5;

export const SAVE_KEY = 'fishcrimental.save';
/**
 * Where a save this build refuses to overwrite is copied before the player
 * dismisses the banner protecting it.
 */
export const SAVE_BACKUP_KEY = `${SAVE_KEY}.bak`;
/**
 * 6: the fifth pass.
 *
 * **One bump for the whole pass**, and one `MIGRATIONS[5]`. Several stages
 * wanted a bump of their own; they share this one. What it carries is the
 * merchant's consignment (R65) — a second fish ledger that an older build would
 * silently drop, taking fish the player had already listed with it.
 */
export const SAVE_VERSION = 6;
export const AUTOSAVE_MS = 10_000;

// ---------------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------------

export type LicenceId = 'inland' | 'lakes' | 'coastal' | 'deep';

export interface LicenceConfig {
	id: LicenceId;
	name: string;
	/** Sources this licence makes legal to fish. */
	covers: FishingSources[];
	cost: number;
	/** Licences are a chain: each one is only issued to holders of the last. */
	requires: LicenceId | null;
	flavour: string;
}

/**
 * A licence is bought once and is separate from the coin cost of the water
 * itself, so opening a new source has two beats: qualify for it, then afford
 * it. Chained rather than independent — a deep sea charter is not something
 * you buy before you have ever held a rod.
 */
export const LICENCES: Record<LicenceId, LicenceConfig> = {
	inland: {
		id: 'inland',
		name: 'Inland Angling Licence',
		covers: [FishingSources.Stream, FishingSources.River],
		cost: 360,
		requires: null,
		flavour:
			'A stamped card and a set of rules about what you may keep. Everyone who fishes moving water has one.'
	},
	lakes: {
		id: 'lakes',
		name: 'Lake & Lagoon Permit',
		covers: [FishingSources.Lake, FishingSources.Lagoon],
		cost: 14_000,
		requires: 'inland',
		flavour:
			'Standing water is managed water. The permit pays the wardens and buys you the right to a boat launch you do not yet own.'
	},
	coastal: {
		id: 'coastal',
		name: 'Coastal Waters Licence',
		covers: [FishingSources.Sea, FishingSources.Offshore],
		cost: 640_000,
		requires: 'lakes',
		flavour:
			'Salt water is federal. This is the first piece of paper that took a fortnight and a signature that was not yours.'
	},
	deep: {
		id: 'deep',
		name: 'Deep Sea Charter',
		covers: [FishingSources.Ocean],
		cost: 38_000_000,
		requires: 'coastal',
		flavour:
			'A charter, not a licence — it names your vessel and the water it may work. Framed, usually, by people who hold one.'
	}
};

export const LICENCE_IDS = Object.keys(LICENCES) as LicenceId[];

/** Which licence, if any, a source needs. The Pond needs none. */
export const SOURCE_LICENCE: Partial<Record<FishingSources, LicenceId>> = LICENCE_IDS.reduce(
	(acc, id) => {
		for (const source of LICENCES[id].covers) acc[source] = id;
		return acc;
	},
	{} as Partial<Record<FishingSources, LicenceId>>
);

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

/**
 * The map you fish from.
 *
 * The first one is wrong. Not missing detail — actively wrong: places sit off
 * where they really are, and the paper runs out before the water does. Buying a
 * better chart does two things and neither of them is "show more fish": places
 * settle closer to their true positions, and the edge of the paper moves out so
 * rumours of somewhere further along become visible.
 *
 * Upgrading a map changes the odds and the clarity, never the contents. It is
 * also never allowed to lie about what anything is *worth* — position is fair
 * game, value is not, because a shadow catch table read by half the UI is a
 * permanent "which table am I looking at" hazard.
 */
export const MAP_BASE_COST = 240;
export const MAP_COST_GROWTH = 4.2;
export const MAP_MAX_LEVEL = 6;

/** How far off a place can be drawn on the worst chart, in 0-1 of the paper. */
export const MAP_BASE_ERROR = 0.085;

/** Locked places visible beyond the deepest one open, at level 0. */
export const MAP_BASE_SIGHT = 1;

// ---------------------------------------------------------------------------
// The boat
// ---------------------------------------------------------------------------

/**
 * Open water needs a vessel. The Sea is the last water you can work from the
 * shore and a pier; past that you need a hull under you.
 */
export const BOAT_SOURCES: FishingSources[] = [FishingSources.Offshore, FishingSources.Ocean];

export function needsBoat(source: FishingSources): boolean {
	return BOAT_SOURCES.includes(source);
}

export const BOAT_COST = 1_950_000;

/** Litres. */
export const BOAT_BASE_FUEL_CAPACITY = 400;
export const BOAT_BASE_FUEL_PER_CAST = 0.85;
export const FUEL_PRICE = 5_400;

/** Condition points, 0–100. */
export const BOAT_BASE_WEAR_PER_CAST = 0.006;
/** Coins to restore one point of condition. */
export const REPAIR_COST_PER_POINT = 74_000;
/**
 * A neglected boat is slow, never dead. At zero condition it still works at
 * this fraction of full speed — the brief is explicit that neither fuel nor
 * condition may become a fail state.
 */
export const BOAT_MIN_EFFICIENCY = 0.4;

export type BoatUpgradeId = 'hull' | 'engine' | 'tank' | 'order';

export interface BoatUpgradeConfig {
	id: BoatUpgradeId;
	name: string;
	description: string;
	baseCost: number;
	costGrowth: number;
	effect: number;
	maxLevel: number;
	format: (level: number) => string;
}

export const BOAT_UPGRADES: Record<BoatUpgradeId, BoatUpgradeConfig> = {
	hull: {
		id: 'hull',
		name: 'Reinforced Hull',
		description: 'The sea takes less out of the boat on every trip.',
		baseCost: 3_100_000,
		costGrowth: 3.3,
		effect: 0.72,
		maxLevel: 15,
		format: (level) => `wear ×${Math.pow(0.72, level).toFixed(3)}`
	},
	engine: {
		id: 'engine',
		name: 'Efficient Engine',
		description: 'Same trip, less fuel burned getting there.',
		baseCost: 4_600_000,
		costGrowth: 3.5,
		effect: 0.74,
		maxLevel: 15,
		format: (level) => `fuel use ×${Math.pow(0.74, level).toFixed(3)}`
	},
	tank: {
		id: 'tank',
		name: 'Larger Tank',
		description: 'Stay out longer between fuel stops.',
		baseCost: 2_700_000,
		costGrowth: 3.0,
		effect: 1.85,
		maxLevel: 18,
		format: (level) => `${Math.round(BOAT_BASE_FUEL_CAPACITY * Math.pow(1.85, level))} litres`
	},
	order: {
		id: 'order',
		name: 'Standing Fuel Order',
		description:
			'The yard delivers whatever the trip needs and bills you for it, including while the game is closed. The tank stops being something you think about.',
		baseCost: 9_800_000,
		costGrowth: 1,
		effect: 1,
		maxLevel: 1,
		format: (level) => (level > 0 ? 'the tank looks after itself' : 'not arranged')
	}
};

export const BOAT_UPGRADE_IDS = Object.keys(BOAT_UPGRADES) as BoatUpgradeId[];
