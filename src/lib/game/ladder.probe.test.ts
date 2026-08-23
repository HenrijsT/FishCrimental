import { describe, it } from 'vitest';
import { simulatePrestigeChain, simulateRun } from './balance';
import { SOURCE_ORDER } from './config';
import { marketDepth, pricedSpecies } from './market';

/**
 * A measuring stick, not an assertion. Nothing here is enforced — it prints the
 * pacing ladder so a human can look at it and judge, which is the only way the
 * ladder ever gets judged.
 *
 * Off by default: a full chain is a minute and a half of CPU, which has no
 * business in every `pnpm test`. Run it with `LADDER=1 pnpm vitest run
 * src/lib/game/ladder.probe.test.ts`.
 */
describe.runIf(process.env.LADDER === '1')('pacing ladder', () => {
	it('prints the first run', () => {
		const run = simulateRun({ maxSeconds: 60 * 60 * 12, stopOnPrestige: true, seed: 7 });
		const mmss = (s: number | null) =>
			s === null
				? 'never'
				: `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;
		console.log('first prestige   :', mmss(run.secondsToPrestige));
		console.log('idle crossover   :', mmss(run.idleCrossoverAt));
		console.log('boat             :', mmss(run.boatAt));
		console.log('lifetimeCoins    :', run.lifetimeCoins.toExponential(3));
		for (const s of SOURCE_ORDER) console.log('  source', s, mmss(run.unlockedAt[s] ?? null));
		for (const [id, t] of Object.entries(run.licencedAt))
			console.log('  licence', id, mmss(t as number));
	}, 600000);

	it('prints the prestige chain', () => {
		const chain = simulatePrestigeChain(6, { maxSeconds: 60 * 60 * 6, seed: 7 });
		for (const e of chain.history)
			console.log(JSON.stringify(e, (_k, v) => (v && v.toExponential ? v.toExponential(2) : v)));
	}, 900000);

	it('prints what a run does to the market', () => {
		// Mid-chain, not post-chain: `performPrestige` clears the book, so the
		// state a chain ends on has nothing in it by construction.
		const chain = simulatePrestigeChain(3, { maxSeconds: 60 * 60 * 6, seed: 7 });
		const run = simulateRun({
			maxSeconds: 60 * 60 * 2,
			stopOnPrestige: false,
			seed: 7,
			initialState: chain.state
		});

		const book = pricedSpecies(run.state);
		console.log('under pressure:', book.length, 'of', Object.keys(run.state.dex).length);
		for (const row of book.slice(0, 4))
			console.log('  worst', row.species, row.price.toNumber().toExponential(2));
		for (const row of book.slice(-2))
			console.log('  best ', row.species, row.price.toNumber().toExponential(2));
		console.log('  storage lv', run.state.upgrades.storage.toFixed(0));
		console.log('  depth', marketDepth(run.state).toExponential(2));
	}, 900000);
});
