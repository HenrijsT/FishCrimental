import { describe, it } from 'vitest';
import { FishingSources } from '$lib/fishing_sources';
import { catchTable } from './engine';

describe.runIf(process.env.LADDER === '1')('luck ceiling', () => {
	it('prints average value against luck', () => {
		for (const source of [
			FishingSources.Pond,
			FishingSources.Lake,
			FishingSources.Offshore,
			FishingSources.Ocean
		]) {
			const base = catchTable(source, 1).averageValue;
			const line = [1, 10, 100, 1e4, 1e8].map((luck) =>
				(catchTable(source, luck).averageValue / base).toFixed(3)
			);
			console.log(source.padEnd(10), line.join('  '));
		}
	});
});
