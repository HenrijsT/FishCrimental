import { largeFishes } from './large_fishes';
import { mediumFishes } from './medium_fishes';
import { sharkFishes } from './shark_fishes';
import { FishingSources, sources } from '../fishing_sources';
import type { Fish } from './fish';
import { RandomIndex } from '$lib/random_picker';
import { smallFishes } from './small_fishes';
import { oddityFishes } from './oddity_fishes';
import { type FishType, fishTypeBaseChance } from '$lib/fish_types';

export const fishes = {
	...smallFishes,
	...mediumFishes,
	...largeFishes,
	...sharkFishes,
	...oddityFishes
};

// Map all sources to the fish they can catch
export const sourcesToFish = (Object.keys(sources) as Array<keyof typeof sources>).reduce(
	(final, source) => {
		final[source] = Object.values(fishes).filter(
			(fish) => (fish.sources as FishingSources[]).indexOf(source) >= 0
		);
		return final;
	},
	{} as Record<FishingSources, Fish[]>
);

// Map sources to the fish types they can catch
export const sourcesToFishTypes = (Object.keys(sources) as Array<keyof typeof sources>).reduce(
	(final, source) => {
		final[source] = Object.values(sourcesToFish[source]).reduce(
			(list, fish) => (list.indexOf(fish.category) >= 0 ? list : [...list, fish.category]),
			[] as FishType[]
		);
		return final;
	},
	{} as Record<FishingSources, FishType[]>
);

// Construct a random index for fish types per source
export const sourceToFishTypeChanceIndex = (
	Object.keys(sources) as Array<keyof typeof sources>
).reduce(
	(final, source) => {
		final[source] = new RandomIndex(
			[...fishTypeBaseChance.entries()].filter(([k]) => sourcesToFishTypes[source].indexOf(k) >= 0)
		);
		return final;
	},
	{} as Record<FishingSources, RandomIndex<FishType>>
);

// Construct a random index for fish per type per source
export const sourceToFishChanceIndex: Record<
	FishingSources,
	Record<FishType, RandomIndex<Fish>>
> = {} as Record<FishingSources, Record<FishType, RandomIndex<Fish>>>;

(Object.keys(sources) as Array<keyof typeof sources>).forEach((source) => {
	// Initialize the nested object for each source
	sourceToFishChanceIndex[source] = {} as Record<FishType, RandomIndex<Fish>>;

	const availableFishTypes = sourcesToFishTypes[source];

	availableFishTypes.forEach((type) => {
		const fishesForTypeAndSource = sourcesToFish[source].filter((fish) => fish.category === type);

		if (fishesForTypeAndSource.length > 0) {
			sourceToFishChanceIndex[source][type] = new RandomIndex(
				fishesForTypeAndSource.map((fish) => [fish, fish.baseChance])
			);
		}
	});
});

// Flat per-source index over every fish that source can yield
export const sourceToAllFishChanceIndex = (
	Object.keys(sources) as Array<keyof typeof sources>
).reduce(
	(final, source) => {
		final[source] = new RandomIndex(
			sourcesToFish[source].map((fish) => [fish, fish.baseChance] as [Fish, number])
		);
		return final;
	},
	{} as Record<FishingSources, RandomIndex<Fish>>
);
