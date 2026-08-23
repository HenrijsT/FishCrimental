import { describe, expect, it } from 'vitest';
import { fishes, sourcesToFish, sourcesToFishTypes } from './index';
import { FishingSources } from '$lib/fishing_sources';

const allSources = Object.values(FishingSources);

/**
 * This file used to test a second probability model that lived beside the
 * catalogue and that nothing in the game ever consulted — the engine builds its
 * own tables in `buildCatchTable`, folding in luck and each source's
 * `typeWeights`. Two contradictory answers to "how likely is this fish here",
 * with only the unused one under test, is worse than one. Both are gone.
 *
 * What is left is the catalogue itself, which is data, and the invariants that
 * data has to satisfy for the engine to be able to build anything from it.
 */
describe('fish catalogue', () => {
	it('has fish, and every fish is catchable somewhere', () => {
		const all = Object.values(fishes);
		expect(all.length).toBeGreaterThan(40);
		for (const fish of all) {
			expect(fish.sources.length).toBeGreaterThan(0);
			expect(fish.baseChance).toBeGreaterThan(0);
		}
	});

	it('describes every fish at a length worth stopping to read', () => {
		for (const fish of Object.values(fishes)) {
			expect(fish.description.length).toBeGreaterThan(20);
		}
	});

	it('names every fish exactly once', () => {
		const names = Object.values(fishes).map((fish) => fish.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('gives every source at least one catchable fish, and a type to catch it as', () => {
		for (const source of allSources) {
			expect(sourcesToFish[source].length).toBeGreaterThan(0);
			expect(sourcesToFishTypes[source].length).toBeGreaterThan(0);
		}
	});

	it('lists a source on a fish exactly when that source lists the fish', () => {
		for (const source of allSources) {
			for (const fish of sourcesToFish[source]) {
				expect(fish.sources).toContain(source);
			}
		}
	});
});
