import { get, writable } from 'svelte/store';
import Decimal from 'break_eternity.js';
import { fishTypeBaseValue, fishTypeCurrentCount } from '$lib/fish_types';

export const marketCoinCount = writable(new Decimal('0'));

export function sellFish() {
	const before = get(marketCoinCount);

	let earned = new Decimal(0);
	fishTypeCurrentCount.forEach((store, type) => {
		const sold = get(store);
		if (sold.lte(0)) return;

		earned = earned.plus(sold.times(fishTypeBaseValue[type]));
		store.set(new Decimal(0));
	});

	marketCoinCount.set(before.plus(earned));

	return earned;
}
