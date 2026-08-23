import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';

export enum OddityFishes {
	MoonJelly = 'Moon Jelly',
	BarrelJelly = 'Barrel Jelly',
	LionsMane = "Lion's Mane",
	LovestruckLipfish = 'Lovestruck Lipfish'
}

/**
 * The two joke categories. `FishType.Jelly` and `FishType.Erotic` were in the
 * enum from the start but had no species behind them, so nothing could ever be
 * caught for either. These fill that gap.
 */
export const oddityFishes = {
	[OddityFishes.MoonJelly]: {
		name: OddityFishes.MoonJelly,
		category: FishType.Jelly,
		sources: [FishingSources.Lagoon, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 14,
		description:
			'A translucent saucer of pure inconvenience, no brain and no heart and no price on it, and somehow smug about the whole arrangement. Every dock keeps one bucket that is only for these, and it is never empty.'
	},
	[OddityFishes.BarrelJelly]: {
		name: OddityFishes.BarrelJelly,
		category: FishType.Jelly,
		sources: [FishingSources.Lagoon, FishingSources.Sea, FishingSources.Offshore],
		baseChance: 7,
		description:
			'The size and weight of a wet duffel bag, and worth about the same. Getting one over the gunwale is a two-man job that pays nothing at all. Two men, one jelly, no coins, and the deck ruined for an hour.'
	},
	[OddityFishes.LionsMane]: {
		name: OddityFishes.LionsMane,
		category: FishType.Jelly,
		sources: [FishingSources.Sea, FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 3,
		description:
			'Drags stinging threads out behind it longer than the boat is long. Buyers will not touch it and the crew will not touch it, so it goes back over the side on the end of a gaff. Zero coins, considerable regret.'
	},
	[OddityFishes.LovestruckLipfish]: {
		name: OddityFishes.LovestruckLipfish,
		category: FishType.Erotic,
		sources: [
			FishingSources.Pond,
			FishingSources.Stream,
			FishingSources.River,
			FishingSources.Lake,
			FishingSources.Lagoon,
			FishingSources.Sea,
			FishingSources.Offshore,
			FishingSources.Ocean
		],
		baseChance: 10,
		description:
			'Puckers dramatically at anything that makes eye contact: the net, the bucket, the dog on the quay. Collectors pay absurd money for one, mostly to stop it looking at them like that. Nobody has ever caught two.'
	}
} satisfies Record<OddityFishes, import('./fish').Fish>;
