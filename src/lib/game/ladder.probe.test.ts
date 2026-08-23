import { describe, it } from 'vitest';
import { simulatePrestigeChain, simulateRun } from './balance';
import { SOURCE_ORDER } from './config';

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
});
