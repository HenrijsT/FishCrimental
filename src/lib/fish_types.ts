export enum FishType {
	Small = 'Small',
	Medium = 'Medium',
	Large = 'Large',
	Shark = 'Shark',
	Erotic = 'Erotic',
	Jelly = 'Jelly'
}

export const FISH_TYPES = Object.values(FishType);

/** Coins a single fish of this type is worth before any multiplier. */
export const fishTypeBaseValue: Record<FishType, number> = {
	[FishType.Small]: 2,
	[FishType.Medium]: 5,
	[FishType.Large]: 10,
	[FishType.Shark]: 250,
	[FishType.Erotic]: 999,
	[FishType.Jelly]: 0
};

/**
 * Fallback rarity weights.
 *
 * Nothing reads this any more: every source in `src/lib/game/config.ts` gives
 * its own `typeWeights`, and `buildCatchTable` uses those. It is kept as the
 * documented shape of a mix — the numbers a source would fall back to if one
 * ever shipped without one — and deliberately not deleted along with the
 * probability model that used to consume it, because it is the only place the
 * intended relative rarity of the six types is written down.
 */
export const fishTypeBaseChance = new Map<FishType, number>([
	[FishType.Small, 90],
	[FishType.Medium, 7],
	[FishType.Large, 2],
	[FishType.Shark, 1],
	[FishType.Jelly, 4],
	[FishType.Erotic, 0.00011]
]);

/** Types that count as a "rare" catch — the luck stat pushes weight into these. */
export const RARE_FISH_TYPES: readonly FishType[] = [
	FishType.Medium,
	FishType.Large,
	FishType.Shark,
	FishType.Erotic
];

/**
 * The rare types luck sorts *between*, shallowest first.
 *
 * Erotic is deliberately absent. It is the joke, weighted 0.00011 and worth 999
 * — sorting toward it would make the punchline the dominant catch at every
 * source late in a run, which is the opposite of a punchline. It keeps luck's
 * plain rare-share benefit and nothing more.
 */
export const LUCK_TIER_ORDER: readonly FishType[] = [
	FishType.Medium,
	FishType.Large,
	FishType.Shark
];

export const fishTypeLabel: Record<FishType, string> = {
	[FishType.Small]: 'Small',
	[FishType.Medium]: 'Medium',
	[FishType.Large]: 'Large',
	[FishType.Shark]: 'Shark',
	[FishType.Erotic]: 'Erotic',
	[FishType.Jelly]: 'Jelly'
};
