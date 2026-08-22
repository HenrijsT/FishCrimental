/**
 * Weighted random picker.
 *
 * Stores one cumulative-weight entry per item and resolves a pick with a
 * binary search, so fractional and very large weights are both fine.
 */
export class RandomIndex<T> {
	private items: T[] = [];
	private cumulative: number[] = [];

	/** Sum of all accepted weights. */
	total = 0;

	constructor(data: [T, number][]) {
		this.build(data);
	}

	build(data: [T, number][]) {
		this.items = [];
		this.cumulative = [];

		let running = 0;
		for (const [item, weight] of data) {
			if (!Number.isFinite(weight) || weight <= 0) continue;
			running += weight;
			this.items.push(item);
			this.cumulative.push(running);
		}

		this.total = running;
	}

	/** Every item that carries a non-zero weight, in insertion order. */
	get entries(): readonly T[] {
		return this.items;
	}

	get size(): number {
		return this.items.length;
	}

	/** Probability of `pick()` returning the item at `index`. */
	weightOf(index: number): number {
		if (index < 0 || index >= this.items.length) return 0;
		const lower = index === 0 ? 0 : this.cumulative[index - 1];
		return this.cumulative[index] - lower;
	}

	/**
	 * Pick an item. `roll` is a number in [0, 1) — injectable so tests can be
	 * deterministic.
	 */
	pick(roll: number = Math.random()): T {
		if (this.items.length === 0) {
			throw new Error('RandomIndex.pick() called on an empty index');
		}

		const target = roll * this.total;

		// Binary search for the first cumulative bound strictly greater than target.
		let low = 0;
		let high = this.cumulative.length - 1;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (this.cumulative[mid] > target) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}

		return this.items[low];
	}
}
