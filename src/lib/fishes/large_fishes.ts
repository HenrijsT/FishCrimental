import { FishType } from "$lib/fish_types";
import type { Fish } from "./fish";
import { FishingSources } from "$lib/fishing_sources";

export enum LargeFishes {
	OscarFish = 'Oscar Fish',
	Arowana = 'Arowana',
	Arapaima = 'Arapaima',
	GiantGourami = 'Giant Gourami',
	RedtailCatfish = 'Redtail Catfish',
	ClownKnifefish = 'Clown Knifefish',
	AlligatorGar = 'Alligator Gar',
	FreshwaterStingray = 'Freshwater Stingray'
}

export const largeFishes = {
	[LargeFishes.OscarFish]: {
		name: LargeFishes.OscarFish,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Oscar Fish, also known as Astronotus ocellatus, are large and intelligent freshwater fish. They are known for their striking colors and engaging personalities. Oscars can be territorial and are best kept in spacious aquariums with suitable tankmates.'
	},
	[LargeFishes.Arowana]: {
		name: LargeFishes.Arowana,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon,
			FishingSources.Offshore
		],
		baseChance: 10,
		description:
			'Arowanas are majestic and sought-after freshwater fish known for their elongated bodies and large scales. They are strong jumpers and require well-covered aquariums. Arowanas can grow quite large, so they need ample space.'
	},
	[LargeFishes.Arapaima]: {
		name: LargeFishes.Arapaima,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Lake, FishingSources.Lagoon],
		baseChance: 10,
		description:
			'Arapaimas are massive and prehistoric-looking freshwater fish. They are native to the Amazon River and are one of the largest freshwater fish species in the world. Arapaimas require extremely large and well-maintained aquariums.'
	},
	[LargeFishes.GiantGourami]: {
		name: LargeFishes.GiantGourami,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Giant Gouramis are large and peaceful freshwater fish. They are known for their size and interesting behaviors. Giant Gouramis require ample space and are best suited for spacious aquariums or outdoor ponds.'
	},
	[LargeFishes.RedtailCatfish]: {
		name: LargeFishes.RedtailCatfish,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon,
			FishingSources.Offshore
		],
		baseChance: 10,
		description:
			'Redtail Catfish are large and striking freshwater catfish known for their red tails and barbels. They are predatory and can consume large amounts of food. Redtail Catfish require very large aquariums and proper tank maintenance.'
	},
	[LargeFishes.ClownKnifefish]: {
		name: LargeFishes.ClownKnifefish,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon
		],
		baseChance: 10,
		description:
			'Clown Knifefish are unique and intriguing freshwater fish known for their elongated bodies and knife-like shape. They are nocturnal and prefer dimly lit aquariums. Clown Knifefish require large aquariums with plenty of hiding spots.'
	},
	[LargeFishes.AlligatorGar]: {
		name: LargeFishes.AlligatorGar,
		category: FishType.Large,
		sources: [
			FishingSources.River,
			FishingSources.Lake,
			FishingSources.Lagoon,
			FishingSources.Offshore,
			FishingSources.Sea,
			FishingSources.Ocean
		],
		baseChance: 10,
		description:
			'Alligator Gar are ancient and predatory freshwater fish. They are named for their alligator-like appearance. Alligator Gar require very large aquariums or outdoor ponds with adequate filtration.'
	},
	[LargeFishes.FreshwaterStingray]: {
		name: LargeFishes.FreshwaterStingray,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Lagoon],
		baseChance: 10,
		description:
			'Freshwater Stingrays are fascinating and captivating fish known for their flattened bodies and venomous tail spines. They require specialized care and should only be kept by experienced aquarium hobbyists.'
	}
} satisfies Record<LargeFishes, Fish>;