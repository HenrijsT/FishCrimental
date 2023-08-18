import { FishType } from "$lib/fish_types";
import type { Fish } from "./fish";
import { FishingSources } from "$lib/fishing_sources";

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
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Angelfish are elegant and graceful freshwater fish known for their distinctive shape and long, flowing fins. They are peaceful but may become territorial during breeding. Angelfish are a popular choice for community aquariums.'
	},
	[MediumFishes.DiscusFish]: {
		name: MediumFishes.DiscusFish,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Discus fish are vibrant and captivating freshwater fish. They are known for their circular body shape and striking colors. Discus fish are more demanding to keep compared to other freshwater fish and require stable water conditions.'
	},
	[MediumFishes.RainbowFish]: {
		name: MediumFishes.RainbowFish,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Rainbowfish are colorful and peaceful freshwater fish. They are named for their iridescent scales that shimmer like a rainbow under the light. Rainbowfish are a great addition to community aquariums.'
	},
	[MediumFishes.BoesemaniRainbowfish]: {
		name: MediumFishes.BoesemaniRainbowfish,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Boesemani Rainbowfish are a specific species of rainbowfish known for their vibrant colors, including shades of blue, yellow, and orange. They are peaceful and prefer to be kept in schools. Boesemani Rainbowfish can brighten up any aquarium.'
	},
	[MediumFishes.Gouramis]: {
		name: MediumFishes.Gouramis,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Gouramis are a diverse group of freshwater fish known for their colorful bodies and feelers. They come in various sizes and colors and can be a stunning addition to community aquariums. Gouramis are generally peaceful, but males can be territorial.'
	},
	[MediumFishes.PearlGourami]: {
		name: MediumFishes.PearlGourami,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Pearl Gouramis are a variety of gourami known for their pearly white and iridescent scales. They are peaceful and well-suited for community aquariums. Pearl Gouramis are generally hardy and easy to care for.'
	},
	[MediumFishes.KilliFish]: {
		name: MediumFishes.KilliFish,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Killifish, or simply Killies, are a diverse group of small, colorful freshwater fish. They are known for their stunning colors and complex breeding behaviors. Killifish can be challenging to keep and are more suitable for experienced hobbyists.'
	},
	[MediumFishes.KribensisCichlid]: {
		name: MediumFishes.KribensisCichlid,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Kribensis Cichlids, also known as Kribs, are small and peaceful cichlids. They are known for their bright colors and interesting behaviors, especially during breeding. Kribensis Cichlids are well-suited for community aquariums.'
	},
	[MediumFishes.DwarfCichlids]: {
		name: MediumFishes.DwarfCichlids,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Dwarf Cichlids are small and colorful cichlids that are suitable for community aquariums. They have vibrant colors and interesting behaviors. Dwarf Cichlids prefer well-planted tanks with plenty of hiding spots.'
	},
	[MediumFishes.SilverDollarFish]: {
		name: MediumFishes.SilverDollarFish,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Silver Dollar Fish are large and silver-colored freshwater fish. They are named for their circular, disk-like shape. Silver Dollar Fish are peaceful and prefer to be kept in groups. They require a spacious aquarium due to their size.'
	},
	[MediumFishes.TigerBarb]: {
		name: MediumFishes.TigerBarb,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			"Tiger Barbs are active and colorful freshwater fish known for their black stripes resembling a tiger's pattern. They are social but can be nippy, so it's best to keep them in groups. Tiger Barbs are a popular choice for community aquariums."
	},
	[MediumFishes.BristlenosePleco]: {
		name: MediumFishes.BristlenosePleco,
		category: FishType.Medium,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Bristlenose Plecos, also known as Bushynose Plecos, are small and peaceful catfish. They are named for their bristle-like appendages on their noses. Bristlenose Plecos are excellent algae eaters and help keep the aquarium clean.'
	}
} satisfies Record<MediumFishes, Fish>;