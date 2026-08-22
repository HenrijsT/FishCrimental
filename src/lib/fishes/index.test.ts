import { describe, expect, it } from 'vitest';
import {
	fishes,
	sourceToAllFishChanceIndex,
	sourceToFishChanceIndex,
	sourceToFishTypeChanceIndex,
	sourcesToFish,
	sourcesToFishTypes
} from './index';
import { FishingSources } from '$lib/fishing_sources';

const allSources = Object.values(FishingSources);

describe('fish catalogue', () => {
	it('has fish and every fish lists at least one source', () => {
		const all = Object.values(fishes);
		expect(all.length).toBeGreaterThan(40);
		for (const fish of all) {
			expect(fish.sources.length).toBeGreaterThan(0);
			expect(fish.baseChance).toBeGreaterThan(0);
			expect(fish.description.length).toBeGreaterThan(20);
		}
	});

	it('gives every source at least one catchable fish', () => {
		for (const source of allSources) {
			expect(sourcesToFish[source].length).toBeGreaterThan(0);
			expect(sourcesToFishTypes[source].length).toBeGreaterThan(0);
		}
	});
});

describe('per-source catch distribution', () => {
	// Replaces the import-time console.log simulation that used to live in index.ts.
	it('only ever yields fish that belong to the source', () => {
		for (const source of allSources) {
			const index = sourceToAllFishChanceIndex[source];
			const allowed = new Set(sourcesToFish[source].map((f) => f.name));

			for (let i = 0; i < 500; i++) {
				const caught = index.pick((i + 0.5) / 500);
				expect(allowed.has(caught.name)).toBe(true);
			}
		}
	});

	it('only ever yields fish types that belong to the source', () => {
		for (const source of allSources) {
			const index = sourceToFishTypeChanceIndex[source];
			const allowed = new Set(sourcesToFishTypes[source]);

			for (let i = 0; i < 200; i++) {
				expect(allowed.has(index.pick((i + 0.5) / 200))).toBe(true);
			}
		}
	});

	it('keeps rarer fish types rarer than common ones in the Pond', () => {
		const index = sourceToFishTypeChanceIndex[FishingSources.Pond];
		const counts = new Map<string, number>();
		const samples = 20_000;

		for (let i = 0; i < samples; i++) {
			const type = index.pick((i + 0.5) / samples);
			counts.set(type, (counts.get(type) ?? 0) + 1);
		}

		const small = counts.get('Small') ?? 0;
		expect(small / samples).toBeGreaterThan(0.5);
	});

	it('builds a per-type index for every type the source offers', () => {
		for (const source of allSources) {
			for (const type of sourcesToFishTypes[source]) {
				const index = sourceToFishChanceIndex[source][type];
				expect(index).toBeDefined();
				expect(index.size).toBeGreaterThan(0);
			}
		}
	});
});
