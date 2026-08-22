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
			'A translucent saucer of pure inconvenience. It has no brain, no heart and no market value, and it still manages to look smug about it. Every dock has a bucket that is only for these.'
	},
	[OddityFishes.BarrelJelly]: {
		name: OddityFishes.BarrelJelly,
		category: FishType.Jelly,
		sources: [FishingSources.Lagoon, FishingSources.Sea, FishingSources.Offshore],
		baseChance: 7,
		description:
			'Roughly the size and weight of a wet duffel bag, and worth exactly as much. Hauling one aboard is a two-person job that pays nothing, which is the whole personality of a barrel jelly.'
	},
	[OddityFishes.LionsMane]: {
		name: OddityFishes.LionsMane,
		category: FishType.Jelly,
		sources: [FishingSources.Sea, FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 3,
		description:
			'Trails stinging threads longer than the boat. Buyers will not touch it, the crew will not touch it, and after one encounter neither will you. Zero coins, considerable regret.'
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
			'Puckers dramatically at anything that makes eye contact, including the net, the bucket and you. Collectors pay absurd money for one, mostly to stop it looking at them like that. Nobody has ever caught two.'
	}
} satisfies Record<OddityFishes, import('./fish').Fish>;
