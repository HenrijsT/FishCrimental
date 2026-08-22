import { describe, expect, it } from 'vitest';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { fishes, sourcesToFish } from '$lib/fishes';
import { SOURCE_CONFIG, SOURCE_ORDER } from './config';
import { ALL_SPECIES, catchTable } from './engine';

describe('what lives where', () => {
	it('gives every source a roster you could actually learn', () => {
		for (const source of SOURCE_ORDER) {
			const count = sourcesToFish[source].length;
			expect(count, `${source} has ${count} species`).toBeGreaterThanOrEqual(4);
			expect(count, `${source} has ${count} species`).toBeLessThanOrEqual(14);
		}
	});

	it('never lists every species of a category in one source', () => {
		const totals = new Map<FishType, number>();
		for (const fish of ALL_SPECIES) {
			totals.set(fish.category, (totals.get(fish.category) ?? 0) + 1);
		}

		for (const source of SOURCE_ORDER) {
			const here = new Map<FishType, number>();
			for (const fish of sourcesToFish[source]) {
				here.set(fish.category, (here.get(fish.category) ?? 0) + 1);
			}

			for (const [type, count] of here) {
				// Jelly and Erotic are deliberately tiny sets.
				if (type === FishType.Jelly || type === FishType.Erotic) continue;
				const total = totals.get(type) ?? 0;
				if (total < 4) continue;
				expect(count, `${source} has all ${total} ${type} species`).toBeLessThan(total);
			}
		}
	});

	it('every species lives somewhere', () => {
		for (const fish of ALL_SPECIES) {
			expect(fish.sources.length, `${fish.name} is unreachable`).toBeGreaterThan(0);
			const reachable = fish.sources.some((source) =>
				sourcesToFish[source].some((other) => other.name === fish.name)
			);
			expect(reachable, `${fish.name} is unreachable`).toBe(true);
		}
	});

	it('still stocks every type each source is configured to pay out', () => {
		for (const source of SOURCE_ORDER) {
			const stocked = new Set(sourcesToFish[source].map((fish) => fish.category));
			for (const type of Object.keys(SOURCE_CONFIG[source].typeWeights) as FishType[]) {
				expect(stocked.has(type), `${source} pays ${type} but stocks none`).toBe(true);
			}
		}
	});

	it('makes some species genuinely rarer than others within a category', () => {
		const byCategory = new Map<FishType, number[]>();
		for (const fish of Object.values(fishes)) {
			const list = byCategory.get(fish.category) ?? [];
			list.push(fish.baseChance);
			byCategory.set(fish.category, list);
		}

		for (const [category, chances] of byCategory) {
			if (chances.length < 3) continue;
			const spread = Math.max(...chances) / Math.min(...chances);
			expect(spread, `${category} rarity is flat`).toBeGreaterThan(3);
		}
	});

	it('spreads catch odds inside a single source instead of a flat split', () => {
		for (const source of SOURCE_ORDER) {
			const table = catchTable(source, 1);
			const small = table.species.filter((entry) => entry.fish.category === FishType.Small);
			if (small.length < 3) continue;

			const probabilities = small.map((entry) => entry.probability);
			const spread = Math.max(...probabilities) / Math.min(...probabilities);
			expect(spread, `${source} small fish are uniform`).toBeGreaterThan(1.8);
		}
	});

	it('keeps bull sharks in the river and whale sharks in the ocean', () => {
		expect(sourcesToFish[FishingSources.River].some((f) => f.name === 'Bull Shark')).toBe(true);
		expect(sourcesToFish[FishingSources.Ocean].some((f) => f.name === 'Whale Shark')).toBe(true);
		expect(sourcesToFish[FishingSources.Pond].some((f) => f.category === FishType.Shark)).toBe(
			false
		);
	});
});
