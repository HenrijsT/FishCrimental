import { largeFishes } from './large_fishes';
import { mediumFishes } from './medium_fishes';
import { sharkFishes } from './shark_fishes';
import { FishingSources, sources } from '../fishing_sources';
import type { Fish } from './fish';
import { smallFishes } from './small_fishes';
import { oddityFishes } from './oddity_fishes';
import type { FishType } from '$lib/fish_types';

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

/*
 * Deleted here: a second, parallel probability model.
 *
 * `sourceToFishTypeChanceIndex`, `sourceToFishChanceIndex` and
 * `sourceToAllFishChanceIndex` built weighted indices from `fishTypeBaseChance`
 * and `fish.baseChance` — a complete answer to "how likely is this fish here"
 * that nothing in the game ever asked. The engine has its own answer,
 * `buildCatchTable`, which folds in luck and the source's own `typeWeights`,
 * and that is the one the game plays by.
 *
 * Two contradictory models with only the unused one under test is worse than
 * one, and it made this file code rather than data. What is left is data.
 */
