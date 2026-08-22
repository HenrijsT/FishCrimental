import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { simulatePrestigeChain, simulateRun } from './balance';
import {
	LICENCE_IDS,
	PRESTIGE_THRESHOLD,
	SOURCE_CONFIG,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS
} from './config';
import { FishingSources } from '$lib/fishing_sources';
import { affordableUpgradeLevels, deckhandCost, upgradeBulkCost, upgradeCost } from './engine';
import { D } from '$lib/decimal';

const HOUR = 60 * 60;

describe('cost curves', () => {
	it('are geometric and strictly increasing', () => {
		for (const id of UPGRADE_IDS) {
			const config = UPGRADES[id];
			let previous = upgradeCost(id, 0);
			expect(previous.toNumber()).toBeCloseTo(config.baseCost, 6);

			for (let level = 1; level <= 25; level++) {
				const cost = upgradeCost(id, level);
				expect(cost.gt(previous)).toBe(true);
				expect(cost.div(previous).toNumber()).toBeCloseTo(config.costGrowth, 6);
				previous = cost;
			}
		}
	});

	it('grow faster than the combined per-round income multiplier', () => {
		// Buying one level of everything multiplies income by this much. If any
		// single cost curve grew slower than that, the game would never pace.
		const perRound =
			(1 / UPGRADES.rod.effect) *
			UPGRADES.net.effect *
			UPGRADES.market.effect *
			UPGRADES.crew.effect;

		for (const id of UPGRADE_IDS) {
			expect(UPGRADES[id].costGrowth).toBeGreaterThan(perRound);
		}
	});

	it('bulk cost matches summing the levels one at a time', () => {
		for (const id of UPGRADE_IDS) {
			let manual = D(0);
			for (let level = 0; level < 12; level++) manual = manual.plus(upgradeCost(id, level));

			const bulk = upgradeBulkCost(id, D(0), D(12));
			expect(bulk.div(manual).toNumber()).toBeCloseTo(1, 6);
		}
	});

	it('affordability never overshoots what the coins can pay for', () => {
		for (const id of UPGRADE_IDS) {
			for (const coins of [0, 1, 100, 1e6, 1e18]) {
				const level = D(3);
				const count = affordableUpgradeLevels(id, level, D(coins));
				if (count.lte(0)) continue;

				expect(upgradeBulkCost(id, level, count).lte(coins)).toBe(true);
				if (count.lt(UPGRADES[id].maxLevel - 3)) {
					expect(upgradeBulkCost(id, level, count.plus(1)).gt(coins)).toBe(true);
				}
			}
		}
	});

	it('deckhands get steadily more expensive', () => {
		for (const source of SOURCE_ORDER) {
			let previous = deckhandCost(source, 0);
			for (let owned = 1; owned < 20; owned++) {
				const cost = deckhandCost(source, owned);
				expect(cost.gte(previous)).toBe(true);
				previous = cost;
			}
		}
	});

	it('unlock costs rise monotonically with depth', () => {
		for (let i = 1; i < SOURCE_ORDER.length; i++) {
			expect(SOURCE_CONFIG[SOURCE_ORDER[i]].unlockCost).toBeGreaterThan(
				SOURCE_CONFIG[SOURCE_ORDER[i - 1]].unlockCost
			);
		}
	});

	it('deeper water is slower to fish', () => {
		for (let i = 1; i < SOURCE_ORDER.length; i++) {
			expect(SOURCE_CONFIG[SOURCE_ORDER[i]].castSeconds).toBeGreaterThan(
				SOURCE_CONFIG[SOURCE_ORDER[i - 1]].castSeconds
			);
		}
	});
});

describe('first run pacing', () => {
	const run = simulateRun({ maxSeconds: 12 * HOUR });

	it('reaches the first prestige, and has to work for it', () => {
		expect(run.secondsToPrestige).not.toBeNull();
		expect(run.secondsToPrestige!).toBeGreaterThan(45 * 60);
		expect(run.secondsToPrestige!).toBeLessThan(5 * HOUR);
	});

	it('lands the first prestige near 1e15 lifetime coins', () => {
		expect(run.lifetimeCoins.gte(PRESTIGE_THRESHOLD)).toBe(true);
		expect(run.lifetimeCoins.lt(new Decimal(PRESTIGE_THRESHOLD).times(10))).toBe(true);
	});

	it('takes every licence and buys a boat along the way', () => {
		for (const id of LICENCE_IDS) {
			expect(run.licencedAt[id], `${id} was never taken`).toBeDefined();
		}
		expect(run.boatAt, 'the boat was never bought').not.toBeNull();

		// Paper before the water it covers, and a hull before open water.
		expect(run.licencedAt.inland!).toBeLessThan(run.unlockedAt[FishingSources.Stream]!);
		expect(run.licencedAt.coastal!).toBeLessThan(run.unlockedAt[FishingSources.Sea]!);
		expect(run.boatAt!).toBeLessThan(run.unlockedAt[FishingSources.Offshore]!);
	});

	it('finishes with a boat that is fuelled and in one piece', () => {
		expect(run.state.boat.owned).toBe(true);
		expect(run.state.boat.condition).toBeGreaterThan(40);
		expect(run.state.boat.fuel.gte(0)).toBe(true);
	});

	it('opens the sources one after another, spread across the run', () => {
		let previous = -1;
		for (const source of SOURCE_ORDER) {
			const at = run.unlockedAt[source];
			expect(at, `${source} never unlocked`).toBeDefined();
			expect(at!).toBeGreaterThan(previous);
			previous = at!;
		}

		// The Ocean should open well before the run ends, not on the last tick.
		const ocean = run.unlockedAt[SOURCE_ORDER[SOURCE_ORDER.length - 1]]!;
		expect(ocean).toBeLessThan(run.secondsToPrestige! * 0.85);
		expect(ocean).toBeGreaterThan(run.secondsToPrestige! * 0.2);
	});

	it('is still finishable by a mostly-idle player, just slower', () => {
		const idle = simulateRun({ maxSeconds: 12 * HOUR, manualUptime: 0.15 });
		expect(idle.secondsToPrestige).not.toBeNull();
		expect(idle.secondsToPrestige!).toBeGreaterThan(run.secondsToPrestige!);
	});
});

describe('prestige scaling', () => {
	const chain = simulatePrestigeChain(6, { maxSeconds: 3 * HOUR });

	it('completes six runs', () => {
		expect(chain.history).toHaveLength(6);
	});

	it('gets dramatically faster with Pearls banked', () => {
		expect(chain.history[3].seconds!).toBeLessThan(chain.history[0].seconds! / 4);
	});

	it('reaches far larger exponents on later runs', () => {
		const first = chain.history[0].lifetimeCoins;
		const last = chain.history[chain.history.length - 1].lifetimeCoins;
		expect(last.div(first).gte(1e10)).toBe(true);
	});

	it('accumulates Pearls superlinearly', () => {
		for (let i = 1; i < chain.history.length; i++) {
			expect(chain.history[i].pearlsAfter.gte(chain.history[i - 1].pearlsAfter)).toBe(true);
		}
		expect(chain.history[chain.history.length - 1].pearlsAfter.gte(1000)).toBe(true);
	});
});
