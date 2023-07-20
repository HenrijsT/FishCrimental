export class RandomIndex<T> {
	map: Record<number, T> = {};
	count = 0;

	constructor(data: [T, number][]) {
		this.build(data);
	}

	build(data: [T, number][]) {
		this.map = {};

		let total = 0;
		data.forEach(([key, val]) => {
			for (let i = total; i < val + total; i++) {
				this.map[i] = key;
			}
			total += val;
		});

		this.count = total;
	}

	pick(): T {
		return this.map[Math.floor(Math.random() * this.count)];
	}
}
