import { FishType } from '$lib/fish_types';
import type { Fish } from './fish';
import { FishingSources } from '$lib/fishing_sources';

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
		sources: [FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 2,
		description:
			'Word gets round when one is working the offshore ground, and the boats thin out for a week. It runs deep and steady, no acrobatics, only weight, and it will bend a rod down into the gunwale. Three hours alongside, and no buyer at the end.'
	},
	[SharkFishes.HammerheadShark]: {
		name: SharkFishes.HammerheadShark,
		category: FishType.Shark,
		sources: [FishingSources.Sea, FishingSources.Offshore],
		baseChance: 7,
		description:
			'The head shows before the body does, wide as an oar blade and sweeping the ground for anything that moves, and it will watch a bait land and circle twice before deciding. Fetches little at the quay, where the head is refused first.'
	},
	[SharkFishes.TigerShark]: {
		name: SharkFishes.TigerShark,
		category: FishType.Shark,
		sources: [FishingSources.Sea, FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 9,
		description:
			'Barred down the flank when young, and the bars fade as they grow. It eats whatever is in front of it; one opened on the beach had half a boat fender inside. Better cut loose at the rail than lifted aboard.'
	},
	[SharkFishes.BullShark]: {
		name: SharkFishes.BullShark,
		category: FishType.Shark,
		sources: [FishingSources.River, FishingSources.Sea],
		baseChance: 11,
		description:
			'Salt is optional for this one, and it will run the river past the second bridge to sit in water shallow enough to wade. Stocky, short-nosed and stubborn, it does not tire so much as change its mind.'
	},
	[SharkFishes.NurseShark]: {
		name: SharkFishes.NurseShark,
		category: FishType.Shark,
		sources: [FishingSources.Sea],
		baseChance: 16,
		description:
			'Sleeps the day out under a ledge and feeds after dark, so the ones caught are caught by accident. Two short barbels on the snout, and a fight like dragging a sack of wet sand off the bottom. Nobody at the quay wants one.'
	},
	[SharkFishes.WhaleShark]: {
		name: SharkFishes.WhaleShark,
		category: FishType.Shark,
		sources: [FishingSources.Ocean],
		baseChance: 1,
		description:
			'Bigger than the boat and eats nothing but the smallest things in the water, which is a joke somebody should explain. It does not fight. It simply leaves, and takes whatever it is attached to with it. Seen twice in thirty years.'
	},
	[SharkFishes.MakoShark]: {
		name: SharkFishes.MakoShark,
		category: FishType.Shark,
		sources: [FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 5,
		description:
			'Fastest thing in the water and unwilling to stay in it: a hooked mako clears the surface higher than the wheelhouse, twice, three times, and one has been known to land in the boat itself. Sleek and blue-backed, gone before the reel catches up.'
	},
	[SharkFishes.LemonShark]: {
		name: SharkFishes.LemonShark,
		category: FishType.Shark,
		sources: [FishingSources.Sea],
		baseChance: 13,
		description:
			'Yellow-brown, the exact shade of the sand it lies over, so it is not seen until it moves. The same fish work the same shallow flat spring after spring, which makes them easy to find and no easier to sell. Steady on the line and slow to give up.'
	}
} satisfies Record<SharkFishes, Fish>;
