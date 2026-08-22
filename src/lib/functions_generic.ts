import { linear } from 'svelte/easing';
import { tweened } from 'svelte/motion';
import { get } from 'svelte/store';
import { sourceToAllFishChanceIndex } from '$lib/fishes';
import { fishTypeCurrentCount } from './fish_types';
import type { FishingSources } from '$lib/fishing_sources';

export const CAST_DURATION_MS = 5000;

export const progressBar = tweened(0, {
	duration: CAST_DURATION_MS,
	easing: linear
});

let timer: ReturnType<typeof setInterval> | undefined;

export const handleMouseDown = (source: FishingSources) => {
	handleMouseUp();

	progressBar.set(0, { duration: 0 });
	progressBar.set(100);

	timer = setInterval(() => {
		progressBar.set(0, { duration: 0 });
		progressBar.set(100);
		fishAction(source);
	}, CAST_DURATION_MS);
};

export const handleMouseUp = () => {
	if (timer !== undefined) {
		clearInterval(timer);
		timer = undefined;
	}
	progressBar.set(0);
};

export function fishAction(source: FishingSources) {
	const caughtFish = sourceToAllFishChanceIndex[source].pick();

	const fishCountStore = fishTypeCurrentCount.get(caughtFish.category);
	if (fishCountStore) {
		fishCountStore.set(get(fishCountStore).plus(1));
	}

	return caughtFish;
}
