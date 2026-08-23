import { FishType } from '$lib/fish_types';
import type { Fish } from './fish';
import { FishingSources } from '$lib/fishing_sources';

export enum MediumFishes {
	AngelFish = 'Angel Fish',
	DiscusFish = 'Discus Fish',
	RainbowFish = 'Rainbow Fish',
	BoesemaniRainbowfish = 'Boesemani Rainbowfish',
	Gouramis = 'Gouramis',
	PearlGourami = 'Pearl Gourami',
	KilliFish = 'Killi Fish',
	KribensisCichlid = 'Kribensis Cichlid',
	DwarfCichlids = 'Dwarf Cichlids',
	SilverDollarFish = 'Silver Dollar Fish',
	TigerBarb = 'Tiger Barb',
	BristlenosePleco = 'Bristlenose Pleco'
}

export const mediumFishes = {
	[MediumFishes.AngelFish]: {
		name: MediumFishes.AngelFish,
		category: FishType.Medium,
		sources: [FishingSources.Lake, FishingSources.Lagoon],
		baseChance: 4,
		description:
			'All fin and very little meat. It turns sideways to slip through the weed beds along the lake edge, so the net comes up empty more often than not. In the spawning months it will square up to a hook rather than run.'
	},
	[MediumFishes.DiscusFish]: {
		name: MediumFishes.DiscusFish,
		category: FishType.Medium,
		sources: [FishingSources.Lagoon],
		baseChance: 2,
		description:
			'Round and flat as a saucer, and it holds only in the warm still corners of the lagoon where nothing else bothers to feed. Stir that water and it sulks off into the reeds. Two a season, and the fishmonger pays properly for both.'
	},
	[MediumFishes.RainbowFish]: {
		name: MediumFishes.RainbowFish,
		category: FishType.Medium,
		sources: [FishingSources.Stream, FishingSources.Lagoon],
		baseChance: 14,
		description:
			"Common enough in the stream that a morning's work fills a pail. The scales throw colour back at the sun the moment the fish is lifted, then lose it within the hour, long before anyone in the market has seen it."
	},
	[MediumFishes.BoesemaniRainbowfish]: {
		name: MediumFishes.BoesemaniRainbowfish,
		category: FishType.Medium,
		sources: [FishingSources.River],
		baseChance: 6,
		description:
			'Blue at the head and orange at the tail, as though two fish were joined badly in the middle. It runs the river in numbers, so where one takes the hook there are forty more behind it, and none of them worth chasing alone.'
	},
	[MediumFishes.Gouramis]: {
		name: MediumFishes.Gouramis,
		category: FishType.Medium,
		sources: [FishingSources.Lake],
		baseChance: 7,
		description:
			'They rise to gulp air off the top of the lake, which gives their position away on a flat morning. Two long feelers trail beneath the body and tangle in a net worse than any weed. The males will not share a stretch of bank.'
	},
	[MediumFishes.PearlGourami]: {
		name: MediumFishes.PearlGourami,
		category: FishType.Medium,
		sources: [FishingSources.Lake, FishingSources.Lagoon],
		baseChance: 5,
		description:
			'Speckled all over as though someone had flicked white paint at it. Hardy, too: one will lie in a bucket half the day and still be moving at dusk, which keeps it fresh enough for the long walk into town.'
	},
	[MediumFishes.KilliFish]: {
		name: MediumFishes.KilliFish,
		category: FishType.Medium,
		sources: [FishingSources.Pond],
		baseChance: 18,
		description:
			'The pond throws these up all year, small and painted in colours nobody asked for. Their eggs sit in the dried mud through the summer and hatch when the rain returns, which is why the pond is never once empty of them.'
	},
	[MediumFishes.KribensisCichlid]: {
		name: MediumFishes.KribensisCichlid,
		category: FishType.Medium,
		sources: [FishingSources.Stream],
		baseChance: 10,
		description:
			'A hand-length fish that goes red along the belly when it is minded to breed, and then holds a hole under the stream bank as though it were land it owned. It bites a finger that comes near. Sells by the dozen, never singly.'
	},
	[MediumFishes.DwarfCichlids]: {
		name: MediumFishes.DwarfCichlids,
		category: FishType.Medium,
		sources: [FishingSources.Pond],
		baseChance: 9,
		description:
			'Small, and a good deal cleverer than small fish have any business being. They take cover under root and stone the moment a shadow crosses the pond, so the trick is to fish them at noon, when nothing casts one.'
	},
	[MediumFishes.SilverDollarFish]: {
		name: MediumFishes.SilverDollarFish,
		category: FishType.Medium,
		sources: [FishingSources.River, FishingSources.Lake],
		baseChance: 12,
		description:
			'Flat and round and near enough the size of a saucer. A shoal of them turning in the river looks like coin going over a table, which is the whole of the joke: a dozen fetch less than the price of one new hook.'
	},
	[MediumFishes.TigerBarb]: {
		name: MediumFishes.TigerBarb,
		category: FishType.Medium,
		sources: [FishingSources.Stream, FishingSources.River],
		baseChance: 16,
		description:
			'Striped black over gold and never still for a second. They arrive in a pack and strip a bait down to bare metal before a proper fish can get near it, which is the ruin of a quiet afternoon and the making of a poor one.'
	},
	[MediumFishes.BristlenosePleco]: {
		name: MediumFishes.BristlenosePleco,
		category: FishType.Medium,
		sources: [FishingSources.Pond, FishingSources.River],
		baseChance: 8,
		description:
			'Armoured, flat-headed, and fixed to a river stone by the mouth rather than swimming anywhere. Prising one loose takes both hands. Old males grow bristles across the snout like a wet brush, and grazed stone is all they eat.'
	}
} satisfies Record<MediumFishes, Fish>;
