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

/*
 * The intended relative rarity of the six types, for reference only:
 *
 *     Small 90 · Medium 7 · Large 2 · Shark 1 · Jelly 4 · Erotic 0.00011
 *
 * This was a `fishTypeBaseChance` map until nothing read it: every source in
 * `src/lib/game/config.ts` carries its own `typeWeights` and `buildCatchTable`
 * uses those. It stayed behind as documentation, which is what it now is — a
 * live binding nobody imports reads as a second, competing rarity table, and a
 * reader looking for the real weights would find this one first.
 */

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
