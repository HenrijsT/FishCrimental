import { FishType } from "$lib/fish_types";
import type { Fish } from "./fish";
import { FishingSources } from "$lib/fishing_sources";

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

export const sharkFishes = {
	[SharkFishes.GreatWhiteShark]: {
		name: SharkFishes.GreatWhiteShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
        baseChance: 10,
		description:
			'The Great White Shark is a large and powerful predatory shark known for its immense size and iconic appearance. It is one of the most well-known shark species and is found in various ocean habitats around the world.'
	},
	[SharkFishes.HammerheadShark]: {
		name: SharkFishes.HammerheadShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
        baseChance: 10,
		description:
			'Hammerhead Sharks are unique shark species characterized by their hammer-shaped heads. They are known for their excellent vision and unique hunting behaviors. Hammerhead Sharks inhabit tropical and temperate waters worldwide.'
	},
	[SharkFishes.TigerShark]: {
		name: SharkFishes.TigerShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 10,
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
		baseChance: 10,
		description:
			'Bull Sharks are a unique shark species known for their ability to tolerate freshwater environments. They are often found in rivers and estuaries, but they also inhabit coastal and oceanic waters. Bull Sharks are powerful and adaptable predators.'
	},
	[SharkFishes.NurseShark]: {
		name: SharkFishes.NurseShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 10,
		description:
			'Nurse Sharks are bottom-dwelling sharks known for their docile nature and nocturnal habits. They are relatively slow-moving and are commonly found in shallow tropical waters. Nurse Sharks are harmless to humans.'
	},
	[SharkFishes.WhaleShark]: {
		name: SharkFishes.WhaleShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 10,
		description:
			'The Whale Shark is the largest fish species in the world, known for its enormous size and filter-feeding habits. Despite their large size, Whale Sharks are gentle giants and are often found in warm, tropical oceans.'
	},
	[SharkFishes.MakoShark]: {
		name: SharkFishes.MakoShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 10,
		description:
			'Mako Sharks are fast and agile predators known for their speed and acrobatic leaps out of the water. They are found in offshore and deep ocean waters and are known for their sleek, streamlined bodies.'
	},
	[SharkFishes.LemonShark]: {
		name: SharkFishes.LemonShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Sea, FishingSources.Ocean],
		baseChance: 10,
		description:
			'Lemon Sharks are named for their yellowish-brown coloration. They are found in coastal and shallow waters, often near coral reefs. Lemon Sharks are relatively docile and are not considered a significant threat to humans.'
	}
} satisfies Record<SharkFishes, Fish>;