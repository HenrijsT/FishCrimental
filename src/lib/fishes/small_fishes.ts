import { FishType } from "$lib/fish_types";
import type { Fish } from "./fish";
import { FishingSources } from "$lib/fishing_sources";

export enum SmallFishes {
	Guppy = 'Guppy',
	Tetra = 'Tetra',
	Platy = 'Platy',
	Swordtail = 'Swordtail',
	Danio = 'Danio',
	WhiteCloudMountainMinnow = 'White Cloud Mountain Minnow',
	Rasbora = 'Rasbora',
	EndlersLivebearer = 'Endlers Livebearer',
	BettaFish = 'Betta Fish',
	CorydorasCatfish = 'Corydoras Catfish',
	KuhliLoach = 'Kuhli Loach',
	Gourami = 'Gourami',
	CherryBarb = 'Cherry Barb',
	ZebraBarb = 'Zebra Barb',
	RosyBarb = 'Rosy Barb'
}

export const smallFishes = {
	[SmallFishes.Guppy]: {
		name: SmallFishes.Guppy,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'The guppy is a small, colorful, and popular freshwater aquarium fish. They are known for their lively behavior and wide range of color varieties. Guppies are easy to care for and are suitable for beginners in the aquarium hobby.'
	},
	[SmallFishes.Tetra]: {
		name: SmallFishes.Tetra,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Tetras are a group of small freshwater fish known for their vibrant colors and peaceful nature. They are often found in rivers and streams, and they prefer to swim in schools. Tetras are a popular choice for community aquariums.'
	},
	[SmallFishes.Platy]: {
		name: SmallFishes.Platy,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Platies are colorful and easy-to-care-for freshwater fish. They are peaceful and get along well with other community fish. Platies are known for their active swimming behavior and are a great addition to community aquariums.'
	},
	[SmallFishes.Swordtail]: {
		name: SmallFishes.Swordtail,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Swordtails are beautiful and hardy freshwater fish. They are named for their distinctive sword-like tail fin, which is most prominent in males. Swordtails are peaceful fish and can coexist with other community fish.'
	},
	[SmallFishes.Danio]: {
		name: SmallFishes.Danio,
		category: FishType.Small,
		sources: [FishingSources.Lake, FishingSources.River, FishingSources.Stream, FishingSources.Sea],
		baseChance: 10,
		description:
			'Danios are active and social freshwater fish. They are known for their energetic swimming behavior, and they prefer to be in groups. Danios are relatively easy to care for and are a popular choice for community aquariums.'
	},
	[SmallFishes.WhiteCloudMountainMinnow]: {
		name: SmallFishes.WhiteCloudMountainMinnow,
		category: FishType.Small,
		sources: [FishingSources.Lake, FishingSources.River, FishingSources.Stream],
		baseChance: 10,
		description:
			'The White Cloud Mountain Minnow is a peaceful and hardy fish species. They are native to mountain streams in China and prefer cooler water temperatures. White Cloud Mountain Minnows are well-suited for nano aquariums and peaceful community setups.'
	},
	[SmallFishes.Rasbora]: {
		name: SmallFishes.Rasbora,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Rasboras are small and colorful freshwater fish. They are peaceful and prefer to be kept in groups. Rasboras are a great choice for planted aquariums and community setups.'
	},
	[SmallFishes.EndlersLivebearer]: {
		name: SmallFishes.EndlersLivebearer,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			"Endler's Livebearers are small and colorful fish that are closely related to guppies. They are known for their striking colors and active nature. Endler's Livebearers are easy to breed and are popular among aquarium hobbyists."
	},
	[SmallFishes.BettaFish]: {
		name: SmallFishes.BettaFish,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea
		],
		baseChance: 10,
		description:
			'Betta fish, also known as Siamese fighting fish, are known for their vibrant colors and elaborate fins. While beautiful, male bettas are territorial and should not be kept with other bettas. They are best kept alone in their own aquariums.'
	},
	[SmallFishes.CorydorasCatfish]: {
		name: SmallFishes.CorydorasCatfish,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea
		],
		baseChance: 10,
		description:
			"Corydoras catfish, often called 'cories', are small and peaceful bottom-dwelling fish. They are excellent cleaners and can help keep the aquarium substrate free of debris. Corydoras catfish are social and should be kept in groups."
	},
	[SmallFishes.KuhliLoach]: {
		name: SmallFishes.KuhliLoach,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea
		],
		baseChance: 10,
		description:
			'Kuhli Loaches are eel-like freshwater fish with a peaceful nature. They are primarily nocturnal and prefer to hide during the day. Kuhli Loaches are best kept in groups and require a well-decorated aquarium with hiding spots.'
	},
	[SmallFishes.Gourami]: {
		name: SmallFishes.Gourami,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Gouramis are a diverse group of freshwater fish known for their colorful bodies and feelers. They come in various sizes and colors and can be a stunning addition to community aquariums. Gouramis are generally peaceful, but males can be territorial.'
	},
	[SmallFishes.CherryBarb]: {
		name: SmallFishes.CherryBarb,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Cherry Barbs are small, peaceful, and brightly colored freshwater fish. They are well-suited for community aquariums and can coexist with other non-aggressive fish species. Cherry Barbs are hardy and relatively easy to care for.'
	},
	[SmallFishes.ZebraBarb]: {
		name: SmallFishes.ZebraBarb,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Zebra Barbs are lively and sociable freshwater fish. They are named for their distinctive zebra-like stripes. Zebra Barbs are active swimmers and enjoy the company of their own species. They are a great addition to community aquariums.'
	},
	[SmallFishes.RosyBarb]: {
		name: SmallFishes.RosyBarb,
		category: FishType.Small,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Stream,
			FishingSources.Sea,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Rosy Barbs are colorful and active freshwater fish. They are social and prefer to swim in groups. Rosy Barbs are hardy and adaptable, making them suitable for community aquariums. Males develop a bright red coloration during breeding season.'
	}
} satisfies Record<SmallFishes, Fish>;