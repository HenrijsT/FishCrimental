import { describe, expect, it } from 'vitest';
import { RandomIndex } from './random_picker';

describe('RandomIndex', () => {
	it('keeps the constructor + pick() API', () => {
		const index = new RandomIndex<string>([['only', 1]]);
		expect(index.pick()).toBe('only');
	});

	it('drops zero, negative and non-finite weights', () => {
		const index = new RandomIndex<string>([
			['zero', 0],
			['negative', -5],
			['nan', Number.NaN],
			['infinite', Number.POSITIVE_INFINITY],
			['kept', 3]
		]);

		expect([...index.entries]).toEqual(['kept']);
		expect(index.total).toBe(3);
	});

	it('throws instead of returning undefined when empty', () => {
		const index = new RandomIndex<string>([['zero', 0]]);
		expect(() => index.pick()).toThrow();
	});

	it('handles fractional weights', () => {
		const index = new RandomIndex<string>([
			['a', 0.25],
			['b', 0.75]
		]);

		expect(index.total).toBeCloseTo(1);
		expect(index.pick(0.1)).toBe('a');
		expect(index.pick(0.24)).toBe('a');
		expect(index.pick(0.26)).toBe('b');
		expect(index.pick(0.999)).toBe('b');
	});

	it('handles very large weights without allocating per unit', () => {
		const index = new RandomIndex<string>([
			['huge', 1e12],
			['tiny', 1]
		]);

		expect(index.total).toBe(1e12 + 1);
		expect(index.size).toBe(2);
		expect(index.pick(0)).toBe('huge');
		expect(index.pick(1 - Number.EPSILON)).toBe('tiny');
	});

	it('maps rolls onto the right cumulative bucket', () => {
		const index = new RandomIndex<string>([
			['a', 1],
			['b', 2],
			['c', 7]
		]);

		expect(index.pick(0)).toBe('a');
		expect(index.pick(0.09)).toBe('a');
		expect(index.pick(0.1)).toBe('b');
		expect(index.pick(0.29)).toBe('b');
		expect(index.pick(0.3)).toBe('c');
		expect(index.pick(0.999)).toBe('c');
	});

	it('produces a distribution matching the weights', () => {
		const index = new RandomIndex<string>([
			['common', 90],
			['uncommon', 9],
			['rare', 1]
		]);

		const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0 };
		const samples = 200_000;
		for (let i = 0; i < samples; i++) {
			counts[index.pick((i + 0.5) / samples)]++;
		}

		expect(counts.common / samples).toBeCloseTo(0.9, 2);
		expect(counts.uncommon / samples).toBeCloseTo(0.09, 2);
		expect(counts.rare / samples).toBeCloseTo(0.01, 2);
	});
});
