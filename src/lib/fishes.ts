import { FishType } from './fish_types';
import { sources, FishingSources } from './fishing_sources';

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

export enum SharkFishes {
	GreatWhiteShark = 'Great White Shark',
	HammerheadShark = 'Hammerhead Shark',
	TigerShark = 'Tiger Shark',
	BullShark = 'Bull Shark',
	NurseShark = 'Nurse Shark',
	WhaleShark = 'Whale Shark',
	MakoShark = 'Mako Shark',
	LemonShark = 'Lemon Shark'
}

export type AllFishTypes = SmallFishes | MediumFishes | LargeFishes | SharkFishes;

interface Fish {
	name: string;
	category: FishType;
	sources: FishingSources[];
	description: string;
}

export const fishes = {
	//SMALL FISHES ------------------------------
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
		description:
			'Swordtails are beautiful and hardy freshwater fish. They are named for their distinctive sword-like tail fin, which is most prominent in males. Swordtails are peaceful fish and can coexist with other community fish.'
	},
	[SmallFishes.Danio]: {
		name: SmallFishes.Danio,
		category: FishType.Small,
		sources: [FishingSources.Lake, FishingSources.River, FishingSources.Stream, FishingSources.Sea],
		description:
			'Danios are active and social freshwater fish. They are known for their energetic swimming behavior, and they prefer to be in groups. Danios are relatively easy to care for and are a popular choice for community aquariums.'
	},
	[SmallFishes.WhiteCloudMountainMinnow]: {
		name: SmallFishes.WhiteCloudMountainMinnow,
		category: FishType.Small,
		sources: [FishingSources.Lake, FishingSources.River, FishingSources.Stream],
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
		description:
			'Rosy Barbs are colorful and active freshwater fish. They are social and prefer to swim in groups. Rosy Barbs are hardy and adaptable, making them suitable for community aquariums. Males develop a bright red coloration during breeding season.'
	},
	//MEDIUM FISHES --------------------------------
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
		description:
			'Bristlenose Plecos, also known as Bushynose Plecos, are small and peaceful catfish. They are named for their bristle-like appendages on their noses. Bristlenose Plecos are excellent algae eaters and help keep the aquarium clean.'
	},
	//LARGE FISHES --------------------------------
	[LargeFishes.OscarFish]: {
		name: LargeFishes.OscarFish,
		category: FishType.Large,
		sources: [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.River,
			FishingSources.Lagoon
		],
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
		description:
			'Arowanas are majestic and sought-after freshwater fish known for their elongated bodies and large scales. They are strong jumpers and require well-covered aquariums. Arowanas can grow quite large, so they need ample space.'
	},
	[LargeFishes.Arapaima]: {
		name: LargeFishes.Arapaima,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Lake, FishingSources.Lagoon],
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
		description:
			'Alligator Gar are ancient and predatory freshwater fish. They are named for their alligator-like appearance. Alligator Gar require very large aquariums or outdoor ponds with adequate filtration.'
	},
	[LargeFishes.FreshwaterStingray]: {
		name: LargeFishes.FreshwaterStingray,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Lagoon],
		description:
			'Freshwater Stingrays are fascinating and captivating fish known for their flattened bodies and venomous tail spines. They require specialized care and should only be kept by experienced aquarium hobbyists.'
	},
	//SHARK FISHES ---------------------------------
	[SharkFishes.GreatWhiteShark]: {
		name: SharkFishes.GreatWhiteShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'The Great White Shark is a large and powerful predatory shark known for its immense size and iconic appearance. It is one of the most well-known shark species and is found in various ocean habitats around the world.'
	},
	[SharkFishes.HammerheadShark]: {
		name: SharkFishes.HammerheadShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'Hammerhead Sharks are unique shark species characterized by their hammer-shaped heads. They are known for their excellent vision and unique hunting behaviors. Hammerhead Sharks inhabit tropical and temperate waters worldwide.'
	},
	[SharkFishes.TigerShark]: {
		name: SharkFishes.TigerShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'Tiger Sharks are large and powerful predators with unique vertical stripes on their bodies. They are known for their voracious appetite and are often found in warm ocean waters. Tiger Sharks are considered one of the most dangerous shark species to humans.'
	},
	[SharkFishes.BullShark]: {
		name: SharkFishes.BullShark,
		category: FishType.Shark,
		sources: [
			FishingSources.River,
			FishingSources.Offshore,
			FishingSources.Sea,
			FishingSources.Ocean
		],
		description:
			'Bull Sharks are a unique shark species known for their ability to tolerate freshwater environments. They are often found in rivers and estuaries, but they also inhabit coastal and oceanic waters. Bull Sharks are powerful and adaptable predators.'
	},
	[SharkFishes.NurseShark]: {
		name: SharkFishes.NurseShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'Nurse Sharks are bottom-dwelling sharks known for their docile nature and nocturnal habits. They are relatively slow-moving and are commonly found in shallow tropical waters. Nurse Sharks are harmless to humans.'
	},
	[SharkFishes.WhaleShark]: {
		name: SharkFishes.WhaleShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'The Whale Shark is the largest fish species in the world, known for its enormous size and filter-feeding habits. Despite their large size, Whale Sharks are gentle giants and are often found in warm, tropical oceans.'
	},
	[SharkFishes.MakoShark]: {
		name: SharkFishes.MakoShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'Mako Sharks are fast and agile predators known for their speed and acrobatic leaps out of the water. They are found in offshore and deep ocean waters and are known for their sleek, streamlined bodies.'
	},
	[SharkFishes.LemonShark]: {
		name: SharkFishes.LemonShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		description:
			'Lemon Sharks are named for their yellowish-brown coloration. They are found in coastal and shallow waters, often near coral reefs. Lemon Sharks are relatively docile and are not considered a significant threat to humans.'
	}
} satisfies Record<AllFishTypes, Fish>;

export const sourcesToFish = (Object.keys(sources) as Array<keyof typeof sources>).reduce(
	(final, source) => {
		final[source] = Object.values(fishes).filter(
			(fish) => (fish.sources as FishingSources[]).indexOf(source) >= 0
		);
		return final;
	},
	{} as Record<FishingSources, Fish[]>
);

console.log(sourcesToFish);
