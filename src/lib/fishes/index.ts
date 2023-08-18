import { largeFishes } from './large_fishes';
import { mediumFishes } from './medium_fishes';
import { sharkFishes } from './shark_fishes';
import { sources, FishingSources } from '../fishing_sources';
import type { Fish } from './fish';
import { RandomIndex } from '$lib/random_picker';
import { fishTypeBaseChance, type FishType } from '$lib/fish_types';
import { smallFishes } from './small_fishes';

export const fishes = {
	...smallFishes,
	...mediumFishes,
	...largeFishes,
	...sharkFishes
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

console.log(sourcesToFish);

// Map sources to the fish types they can catch
export const sourcesToFishTypes = (Object.keys(sources) as Array<keyof typeof sources>).reduce(
	(final, source) => {
		final[source] = Object.values(sourcesToFish[source]).reduce(
			(list, fish) => list.indexOf(fish.category) >= 0 ? list : [...list, fish.category], [] as FishType[]
		);
		return final;
	},
	{} as Record<FishingSources, FishType[]>
);

console.log(sourcesToFishTypes);

// Construct a random index for fish types per source
const sourceToFishTypeChanceIndex = (Object.keys(sources) as Array<keyof typeof sources>).reduce(
	(final, source) => {
		final[source] = new RandomIndex([...fishTypeBaseChance.entries()].filter(([k]) => sourcesToFishTypes[source].indexOf(k) >= 0));
		return final;
	},
	{} as Record<FishingSources, RandomIndex<FishType>>
);

console.log(sourceToFishTypeChanceIndex);

// Simulate 100 catches per source
for (const [k, v] of Object.entries(sourceToFishTypeChanceIndex)) {
	const caught = {} as Record<FishType, number>;
	for (let i = 0; i < 100; i++) {
		const chosen = v.pick();
		if (!(chosen in caught)) {
			caught[chosen] = 0;
		}
		caught[chosen]++;
	}
	console.log(k, caught);
}

// Construct a random index for fish per type per source

// const sourceToFishChanceIndex: Record<FishingSources, Record<FishType, RandomIndex<Fish>>> = {};

// now you need to figure out how to make and fill this object ^^^^^^