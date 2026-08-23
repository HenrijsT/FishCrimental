import { FishType } from '$lib/fish_types';
import type { Fish } from './fish';
import { FishingSources } from '$lib/fishing_sources';

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
		sources: [FishingSources.Lake],
		baseChance: 13,
		description:
			'Holds one weedbed on the lake and drives off everything else that comes near it, so where one sits there is nothing else worth working. Dark green with orange blotching, and it watches the boat the whole way in.'
	},
	[LargeFishes.Arowana]: {
		name: LargeFishes.Arowana,
		category: FishType.Large,
		sources: [FishingSources.Lake, FishingSources.Lagoon],
		baseChance: 5,
		description:
			'A long silver thing that fights upward instead of out, and it will clear the gunwale in one jump if the net is slow. Scales the size of a thumbnail, loose enough to thumb off. The only fish a buyer asks for by name.'
	},
	[LargeFishes.Arapaima]: {
		name: LargeFishes.Arapaima,
		category: FishType.Large,
		sources: [FishingSources.Sea, FishingSources.Offshore, FishingSources.Ocean],
		baseChance: 2,
		description:
			'It has to surface for air every twenty minutes, which is the only warning anybody gets. Prehistoric plating along the back, a tail that soaks a man to the waist, and enough meat on it to pay for the trip out.'
	},
	[LargeFishes.GiantGourami]: {
		name: LargeFishes.GiantGourami,
		category: FishType.Large,
		sources: [FishingSources.Pond],
		baseChance: 8,
		description:
			'Too big for the pond it lives in and seems to know it, sulking in the reeds and eating weed until something drops past. Puts up almost no fight. Comes in heavy and flat-sided and feeds four, which is rare here.'
	},
	[LargeFishes.RedtailCatfish]: {
		name: LargeFishes.RedtailCatfish,
		category: FishType.Large,
		sources: [FishingSources.River],
		baseChance: 15,
		description:
			'Lies on the river bottom doing nothing, then takes the bait and runs downstream like it has somewhere to be. Red tail, whiskers, and an appetite that empties a stretch of water. Costs a line most times. Worth it when it does not.'
	},
	[LargeFishes.ClownKnifefish]: {
		name: LargeFishes.ClownKnifefish,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Lagoon],
		baseChance: 10,
		description:
			'Nothing moves it in daylight. After dark it works the shallows on its edge, thin as a blade and spotted along the back, and it swims backwards as fast as forwards the moment the hook sets. Most nights it wins.'
	},
	[LargeFishes.AlligatorGar]: {
		name: LargeFishes.AlligatorGar,
		category: FishType.Large,
		sources: [FishingSources.River, FishingSources.Offshore],
		baseChance: 7,
		description:
			'Its mouth is all bone, so the hook slides free four times out of five and the only method is to wait and hope it swallows. Scales that turn a knife, teeth that ruin a net past mending, and older than the river itself.'
	},
	[LargeFishes.FreshwaterStingray]: {
		name: LargeFishes.FreshwaterStingray,
		category: FishType.Large,
		sources: [FishingSources.Lake, FishingSources.Lagoon],
		baseChance: 3,
		description:
			'Lies buried in the silt with nothing showing but its eyes, flat as a dinner plate, until something puts a foot wrong. The barb on its tail goes through a boot and takes a week of standing with it. No buyer within thirty miles.'
	}
} satisfies Record<LargeFishes, Fish>;
