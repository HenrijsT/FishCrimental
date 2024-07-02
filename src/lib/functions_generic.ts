import { linear } from 'svelte/easing';
import { tweened } from 'svelte/motion';
import { get } from 'svelte/store';
import { sourceToFishChanceIndex } from '$lib/fishes';
import { fishTypeCurrentCount } from './fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { RandomIndex } from './random_picker';
import type { Fish } from '$lib/fishes/fish';

export const progressBar = tweened(1000, {
	duration: 5000,
	easing: linear
});
let timer: number;

export const handleMouseDown = () => {
	progressBar.set(0, { duration: 0 });
	progressBar.set(1000);
	timer = setInterval(() => {
		progressBar.set(0, { duration: 0 });
		progressBar.set(1000);
		fishAction(FishingSources.Ocean);
	}, 5000);
};

export const handleMouseUp = () => {
	clearInterval(timer);
	progressBar.set(0);
};

// TODO: ADD catching per fishes individually and not types
export function fishAction(source: FishingSources) {
	const fishTypeIndices = sourceToFishChanceIndex[source];

	// Combine all fish indices into a single array
	const allFishIndices: Fish[] = Object.values(fishTypeIndices).flatMap(
		(randomIndex: RandomIndex<Fish>) => Object.values(randomIndex.map)
	);

	// Create a RandomIndex for all available fish in the source
	const allFishRandomIndex = new RandomIndex(
		allFishIndices.map((fish) => [fish, fish.baseChance] as [Fish, number])
	);

	// Pick a fish directly from the combined fish indices
	const caughtFish = allFishRandomIndex.pick();

	// Increase the count of the caught fish type
	const fishCountStore = fishTypeCurrentCount.get(caughtFish.category);
	if (fishCountStore) {
		fishCountStore.set(get(fishCountStore).plus(1));
	}

	// Print out the caught fish details
	console.log('Caught a fish: ', caughtFish.name);
	console.log('Details: ', caughtFish);
}
