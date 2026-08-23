import { describe, it } from 'vitest';
import { D } from '$lib/decimal';
import { MARKET_HALF_LIFE } from './config';
import { createInitialState } from './engine';
import { averagePrice, applyPressure, knowledge, settleMarket, speciesPrice } from './market';
import type { GameState } from './types';

/**
 * Mono-farming one species against rotating five, at the real production rates
 * the game reaches, run against the built market rather than a spreadsheet.
 *
 * Off unless `LADDER=1`. See `ladder.probe.test.ts`.
 */
describe.runIf(process.env.LADDER === '1')('mono versus rotate', () => {
	function trading(): GameState {
		const state = createInitialState();
		state.prestigeCount = D(1);
		state.marketUpdatedAt = 1;
		return state;
	}

	/**
	 * Fish at `rate` fish/second for `seconds`, selling every tick, and report
	 * the money. `species` is how many species the catch is spread across.
	 */
	function income(rate: number, seconds: number, species: number): number {
		const state = trading();
		const names = ['Guppy', 'Perch', 'Bream', 'Roach', 'Tench'].slice(0, species);
		const step = 10;
		let total = 0;
		let now = 1;

		for (let t = 0; t < seconds; t += step) {
			now += step * 1000;
			settleMarket(state, now);
			const each = D((rate * step) / names.length);
			for (const name of names) {
				state.dex[name] = (state.dex[name] ?? D(0)).plus(each);
				total += averagePrice(state, name, each)
					.times(knowledge(state, name))
					.times(each)
					.toNumber();
				applyPressure(state, name, each);
			}
		}
		return total / seconds;
	}

	it('prints the ratio across the production curve', () => {
		// Long enough for prices to equilibrate: about three half-lives.
		const window = MARKET_HALF_LIFE * 3;
		console.log('rate(fish/s)  mono/rotate5   monoPrice  rotPrice');
		for (const rate of [1, 39, 1e3, 1e4, 4.1e5, 1e9, 1e12]) {
			const mono = income(rate, window, 1);
			const rot = income(rate, window, 5);
			const m = trading();
			m.marketPressure.Guppy = D(rate * MARKET_HALF_LIFE * 1.44);
			const r = trading();
			r.marketPressure.Guppy = D((rate / 5) * MARKET_HALF_LIFE * 1.44);
			console.log(
				rate.toExponential(1).padEnd(13),
				(mono / rot).toFixed(3).padEnd(14),
				speciesPrice(m, 'Guppy').toNumber().toFixed(4).padEnd(10),
				speciesPrice(r, 'Guppy').toNumber().toFixed(4)
			);
		}
	}, 600000);

	it('prints recovery from a saturated market', () => {
		for (const hours of [1, 2, 4, 6, 8]) {
			const state = trading();
			state.marketPressure.Guppy = D(6.0e5 * 1295);
			state.marketUpdatedAt = 1;
			settleMarket(state, hours * 3600 * 1000);
			console.log(`${hours}h ->`, speciesPrice(state, 'Guppy').toNumber().toFixed(3));
		}
	});
});
