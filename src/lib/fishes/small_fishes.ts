import { FishType } from '$lib/fish_types';
import type { Fish } from './fish';
import { FishingSources } from '$lib/fishing_sources';

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
		sources: [FishingSources.MudPool, FishingSources.Pond, FishingSources.Lagoon],
		baseChance: 24,
		description:
			'Takes the hook before it has finished sinking, which is the best that can be said for it. Comes up flashing every colour there is, then goes in the bucket with forty others, and forty of them still weigh less than one decent fish.'
	},
	[SmallFishes.Tetra]: {
		name: SmallFishes.Tetra,
		category: FishType.Small,
		sources: [FishingSources.River, FishingSources.Lake],
		baseChance: 15,
		description:
			'A river fish that moves in a shoal so tight the whole lot turns at once, and one bad cast scatters the stretch for an hour. Bright along the flank. Sells by the scoop rather than by the fish, when it sells at all.'
	},
	[SmallFishes.Platy]: {
		name: SmallFishes.Platy,
		category: FishType.Small,
		sources: [FishingSources.MudPool, FishingSources.Pond, FishingSources.Lake],
		baseChance: 18,
		description:
			'Thrives in the mud pool where the water goes warm and thick and everything better has already left. Blunt, orange, endlessly busy. There is never just one of them, and a poor morning at the pond is usually a morning of platies.'
	},
	[SmallFishes.Swordtail]: {
		name: SmallFishes.Swordtail,
		category: FishType.Small,
		sources: [FishingSources.Lake, FishingSources.Sea],
		baseChance: 8,
		description:
			'The males carry a long spike off the underside of the tail, and it catches in the mesh so the net has to be worked loose by hand every time. A lake fish that turns up in the sea often enough to confuse anyone keeping count.'
	},
	[SmallFishes.Danio]: {
		name: SmallFishes.Danio,
		category: FishType.Small,
		sources: [FishingSources.Stream, FishingSources.River],
		baseChance: 20,
		description:
			'Has never once been seen holding still. It runs the top of the stream in short bursts and will chase a bait that is already moving away from it, which no other small fish here bothers to do. Twenty in a morning is a slow morning.'
	},
	[SmallFishes.WhiteCloudMountainMinnow]: {
		name: SmallFishes.WhiteCloudMountainMinnow,
		category: FishType.Small,
		sources: [FishingSources.Stream],
		baseChance: 9,
		description:
			'Holds in the coldest water, right up where the stream comes off the hill and the hands stop working after ten minutes. Silver, with a red tail. Nobody climbs that far for minnows, so they get caught on the way back down.'
	},
	[SmallFishes.Rasbora]: {
		name: SmallFishes.Rasbora,
		category: FishType.Small,
		sources: [FishingSources.River, FishingSources.Lagoon],
		baseChance: 16,
		description:
			'Carries a black wedge on the flank that shows through the water before the fish itself does, so a shoal can be counted from the bank. Works the river and drifts down into the lagoon. Gone the instant anything passes overhead.'
	},
	[SmallFishes.EndlersLivebearer]: {
		name: SmallFishes.EndlersLivebearer,
		category: FishType.Small,
		sources: [FishingSources.Lagoon, FishingSources.Sea],
		baseChance: 3,
		description:
			'Near enough a guppy that half of them go into the bucket unnoticed, and the ones that get looked at properly turn up perhaps three times a season. Lives along the weed edge of the lagoon, green down the back, black behind the gill.'
	},
	[SmallFishes.BettaFish]: {
		name: SmallFishes.BettaFish,
		category: FishType.Small,
		sources: [FishingSources.Lagoon, FishingSources.Sea],
		baseChance: 2,
		description:
			'Two of them in the same bucket and only one is worth anything by the time the bucket is opened again. Long fins, hard colour, and a temper out of all proportion to a fish that fits in a palm. Rare enough in the lagoon to be worth the walk.'
	},
	[SmallFishes.CorydorasCatfish]: {
		name: SmallFishes.CorydorasCatfish,
		category: FishType.Small,
		sources: [FishingSources.MudPool, FishingSources.Pond],
		baseChance: 5,
		description:
			'Works the bottom, so it only comes up when the bait has been left to sit a good while. It locks its fins out stiff on being lifted and the spines have drawn blood more than once. Best handled through a rag. Never one alone down there.'
	},
	[SmallFishes.KuhliLoach]: {
		name: SmallFishes.KuhliLoach,
		category: FishType.Small,
		sources: [FishingSources.MudPool, FishingSources.River],
		baseChance: 4,
		description:
			'An eel the length of a finger that only moves after dark, so it comes up on night lines or not at all. Buries itself in the silt the instant it is dropped, and has got out of the bucket twice by going through the drain hole.'
	},
	[SmallFishes.Gourami]: {
		name: SmallFishes.Gourami,
		category: FishType.Small,
		sources: [FishingSources.Lake],
		baseChance: 6,
		description:
			'Comes up to gulp air at the surface, and on a flat lake evening that ring is how it gets found at all. Trails two long feelers beneath it and touches the line with them before deciding. The males hold a patch of reed against all comers.'
	},
	[SmallFishes.CherryBarb]: {
		name: SmallFishes.CherryBarb,
		category: FishType.Small,
		sources: [FishingSources.Stream],
		baseChance: 11,
		description:
			'The males go a deep red for a few weeks in spring and fade back to the colour of wet sand by summer. Holds in the shade under the bank where the stream slows. Takes a scrap of worm smaller than a fingernail, and takes it gently.'
	},
	[SmallFishes.ZebraBarb]: {
		name: SmallFishes.ZebraBarb,
		category: FishType.Small,
		sources: [FishingSources.Stream, FishingSources.River],
		baseChance: 12,
		description:
			'Barred dark down the side like a row of tally marks, which makes it the one small fish that can be named from the bank without lifting it out. Holds where the stream runs into the river and takes a bait swung across the flow.'
	},
	[SmallFishes.RosyBarb]: {
		name: SmallFishes.RosyBarb,
		category: FishType.Small,
		sources: [FishingSources.MudPool, FishingSources.Pond, FishingSources.Lake],
		baseChance: 10,
		description:
			'Turns up in the mud pool, the pond and the lake without seeming to mind which, and is still alive in the bucket long after everything else has gone quiet. Copper along the side. Not worth much, but worth something while it is fresh.'
	}
} satisfies Record<SmallFishes, Fish>;
