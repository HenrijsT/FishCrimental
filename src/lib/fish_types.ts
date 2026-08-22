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
 * Fallback rarity weights. Every source overrides these in
 * `src/lib/game/config.ts`; this table is what a source falls back to when it
 * has no explicit mix.
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

export const fishTypeLabel: Record<FishType, string> = {
	[FishType.Small]: 'Small',
	[FishType.Medium]: 'Medium',
	[FishType.Large]: 'Large',
	[FishType.Shark]: 'Shark',
	[FishType.Erotic]: 'Erotic',
	[FishType.Jelly]: 'Jelly'
};
