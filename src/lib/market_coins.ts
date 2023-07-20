import { get, writable } from 'svelte/store';
import Big from 'big.js';
import { fishTypeBaseValue, FishType, fishTypeCurrentCount } from '$lib/fish_types';

export const marketCoinCount = writable(new Big('0'));

export function sellFish() {
	let profit = new Big(0);
	const currentMarketcoinCount = get(marketCoinCount);

	// TODO: REMOVE
	console.log('');

	fishTypeCurrentCount.forEach((value, key) => {
		marketCoinCount.set(get(marketCoinCount).plus(get(value).times(fishTypeBaseValue[key])));
		value.set(new Big(0));
		console.log('Total', FishType[key], 'count:', get(value).toFixed(0));
	});

	profit = get(marketCoinCount).minus(currentMarketcoinCount);

	console.log('Fishes sold! Total profit:', profit.toFixed(0));
}

// data.forEach(([key, val]) => {
//     for (let i = total; i < val + total; i++) {
//       this.map[i] = key;
//     }
//     total += val;
//   });
