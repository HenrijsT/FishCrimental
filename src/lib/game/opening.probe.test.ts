import { describe, it } from 'vitest';
import { D } from '$lib/decimal';
import { TRADER_PERIOD_SECONDS } from './config';
import {
	buyAssistant,
	buyBicycle,
	buyBucket,
	buyDeckhand,
	buyUpgrade,
	canUnlock,
	computeModifiers,
	createInitialState,
	holdCount,
	listForSale,
	nextLockedSource,
	performCast,
	runTrader,
	traderStock,
	unlockSource,
	upgradeCost
} from './engine';
import { availableTabs, nextStep } from './guide';
import { availableTopics } from './help';

/**
 * The first ten minutes, as a new player meets them.
 *
 * Not a simulation of an optimal player — a transcript of what the game
 * *says* to somebody who has never seen it, minute by minute: what the guide
 * tells them to do, which tabs exist, what Help would explain, and what they
 * can actually afford. Off unless `LADDER=1`.
 */
describe.runIf(process.env.LADDER === '1')('the first ten minutes', () => {
	it('prints the transcript', () => {
		const state = createInitialState();
		const modifiers = () => computeModifiers(state);
		let elapsed = 0;
		let lastReport = -1;

		const report = (why: string) => {
			const tabs = availableTabs(state)
				.map((t) => t.id)
				.join(' ');
			const step = nextStep(state);
			console.log(
				`\n[${Math.floor(elapsed / 60)}m${String(Math.floor(elapsed % 60)).padStart(2, '0')}s] ${why}`
			);
			console.log(`  coins ${state.coins.toFixed(0)} · hold ${holdCount(state).toFixed(0)}`);
			console.log(`  tabs: ${tabs}`);
			console.log(
				`  help: ${availableTopics(state)
					.map((t) => t.id)
					.join(' ')}`
			);
			console.log(`  next: ${step ? `${step.text} [${step.tab ?? '-'}]` : '(nothing)'}`);
			lastReport = elapsed;
		};

		report('opens the game');

		// One cast at a time, at the real cast rate, selling the way a new player
		// would: list it, and let the merchant come.
		const seconds = 10 * 60;
		while (elapsed < seconds) {
			const castSeconds = modifiers().castSeconds[state.activeSource];
			performCast(state, state.activeSource, modifiers());
			elapsed += castSeconds;
			state.playTime = elapsed;

			if (holdCount(state).gte(1)) listForSale(state);
			runTrader(state, modifiers(), elapsed * 1000);
			state.nextTraderAt = Math.max(state.nextTraderAt, 1);

			// Buy the cheapest sensible thing, the way the guide tells them to.
			const next = nextLockedSource(state);
			if (next && canUnlock(state, next)) {
				unlockSource(state, next);
				report(`unlocks the ${next}`);
				continue;
			}
			for (const id of ['rod', 'net'] as const) {
				if (state.coins.gte(upgradeCost(id, state.upgrades[id]))) {
					buyUpgrade(state, id, 1);
					if (elapsed - lastReport > 60) report(`buys ${id} ${state.upgrades[id].toFixed(0)}`);
				}
			}
			if (traderStock(state).includes('bucket') && buyBucket(state)) {
				report(`buys a bucket, level ${state.bucketLevel.toFixed(0)}`);
			}
			if (traderStock(state).includes('bicycle') && buyBicycle(state)) report('buys the bicycle');
			if (traderStock(state).includes('assistant') && buyAssistant(state)) {
				report('hires the Assistant');
			}
			if (buyDeckhand(state, state.activeSource, D(1)).gt(0)) {
				if (elapsed - lastReport > 60) report('hires a deckhand');
			}
		}

		report('ten minutes in');
		console.log(
			`\n  merchant period ${TRADER_PERIOD_SECONDS}s · visits so far ${state.traderVisits}`
		);
	}, 600000);
});
