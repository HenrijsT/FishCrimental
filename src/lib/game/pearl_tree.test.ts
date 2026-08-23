import { describe, expect, it } from 'vitest';
import { D, d0 } from '$lib/decimal';
import {
	PEARL_BONUS_PIVOT,
	PEARL_COST_PIVOT,
	PEARL_YIELD_SCALE,
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS
} from './config';
import {
	buyPrestigeUpgrade,
	createInitialState,
	pearlCostScale,
	pearlMultiplier,
	pearlsFor,
	prestigeUpgradeCost,
	prestigeUpgradeUnlocked
} from './engine';

/**
 * The Pearl tree.
 *
 * A shift used to pay one Pearl, and the shop's only question — hold the pile
 * for its passive bonus, or spend it — was therefore all-or-nothing. The
 * arithmetic made it a trap: holding one Pearl was worth ×2.3863 and spending it
 * on the only affordable node was worth ×2.1500, so the first purchase the game
 * offered was ten per cent worse than not buying, permanently, with no refund.
 */

describe('a shift pays enough Pearls for spending to be a decision', () => {
	it('pays about a hundred at the threshold, not one', () => {
		expect(pearlsFor(D('1e15')).eq(PEARL_YIELD_SCALE)).toBe(true);
		expect(pearlsFor(D('3.18e15')).gt(50)).toBe(true);
	});

	it('and the pile is worth exactly what it was worth before', () => {
		// Re-denominating the currency must not re-price it: a pivot's worth of
		// new Pearls buys what one Pearl used to, 1 + 2*ln(2).
		expect(pearlMultiplier(D(PEARL_BONUS_PIVOT)).toNumber()).toBeCloseTo(1 + 2 * Math.log(2), 6);
	});
});

describe('the tree fans out from four roots', () => {
	it('has four roots and every other node behind one of them', () => {
		const roots = PRESTIGE_UPGRADE_IDS.filter((id) => !PRESTIGE_UPGRADES[id].requires);
		expect(roots.length).toBe(4);
		expect(PRESTIGE_UPGRADE_IDS.length).toBeGreaterThan(roots.length);
	});

	it('never gates a node behind something that cannot be reached', () => {
		// Every prerequisite must name a real node, at a level that node can
		// actually reach, and no cycles.
		for (const id of PRESTIGE_UPGRADE_IDS) {
			const seen = new Set<string>([id]);
			let gate = PRESTIGE_UPGRADES[id].requires;
			while (gate) {
				expect(PRESTIGE_UPGRADES[gate.id]).toBeDefined();
				expect(gate.level).toBeLessThanOrEqual(PRESTIGE_UPGRADES[gate.id].maxLevel);
				expect(seen.has(gate.id)).toBe(false);
				seen.add(gate.id);
				gate = PRESTIGE_UPGRADES[gate.id].requires;
			}
		}
	});

	it('refuses a locked node however many Pearls are on the table', () => {
		const state = createInitialState();
		state.pearls = D('1e12');
		state.allTimePearls = D('1e12');

		const gated = PRESTIGE_UPGRADE_IDS.find((id) => PRESTIGE_UPGRADES[id].requires)!;
		expect(prestigeUpgradeUnlocked(state, gated)).toBe(false);
		expect(buyPrestigeUpgrade(state, gated)).toBe(false);
		expect(state.prestigeUpgrades[gated].eq(0)).toBe(true);
	});

	it('and opens it the moment the route is walked', () => {
		const state = createInitialState();
		state.pearls = D('1e12');
		state.allTimePearls = D('1e12');

		const gated = PRESTIGE_UPGRADE_IDS.find((id) => PRESTIGE_UPGRADES[id].requires)!;
		const gate = PRESTIGE_UPGRADES[gated].requires!;
		state.prestigeUpgrades[gate.id] = D(gate.level);

		expect(prestigeUpgradeUnlocked(state, gated)).toBe(true);
		expect(buyPrestigeUpgrade(state, gated)).toBe(true);
	});
});

describe('prices follow the pile, so the tree stays a budget', () => {
	it('scales with lifetime Pearls once past the pivot', () => {
		expect(pearlCostScale(d0()).eq(1)).toBe(true);
		expect(pearlCostScale(D(PEARL_COST_PIVOT)).eq(1)).toBe(true);
		expect(pearlCostScale(D(PEARL_COST_PIVOT * 1000)).eq(1000)).toBe(true);
	});

	it('charges a fixed share of the pile for a node, at any scale', () => {
		// This is the invariant the scaling actually buys. Before it, the tree was
		// priced absolutely: unaffordable for one prestige, then irrelevant for
		// every prestige after — `spendPearls` left 99.997% of the pile untouched.
		// Now a node always costs the same slice of what the player has.
		const want = PRESTIGE_UPGRADES.pearl_yield.baseCost / PEARL_COST_PIVOT;
		for (const pile of [1e6, 1e9, 1e12]) {
			const scale = pearlCostScale(D(pile));
			const share = prestigeUpgradeCost('pearl_yield', 0, scale).div(pile).toNumber();
			expect(share).toBeCloseTo(want, 6);
		}
	});

	it('does not pretend the bonus loss is also constant — it is not', () => {
		// Honest limit, asserted so nobody claims otherwise later. `pearlMultiplier`
		// is logarithmic, so spending half the pile costs ~20% of the bonus at a
		// thousand Pearls and ~3% at a trillion. Scaling the *prices* stops the
		// tree becoming irrelevant; it cannot flatten a logarithm.
		const share = (pile: number) =>
			pearlMultiplier(D(pile).div(2))
				.div(pearlMultiplier(D(pile)))
				.toNumber();

		expect(share(1e3)).toBeLessThan(0.85);
		expect(share(1e12)).toBeGreaterThan(0.95);
		// It always costs something, though, which is what makes it a decision.
		for (const pile of [1e3, 1e6, 1e9, 1e12]) expect(share(pile)).toBeLessThan(1);
	});

	it('still charges more for each level of the same track', () => {
		const scale = pearlCostScale(D('1e6'));
		for (const id of PRESTIGE_UPGRADE_IDS) {
			let previous = prestigeUpgradeCost(id, 0, scale);
			for (let level = 1; level < Math.min(6, PRESTIGE_UPGRADES[id].maxLevel); level++) {
				const cost = prestigeUpgradeCost(id, level, scale);
				expect(cost.gt(previous)).toBe(true);
				previous = cost;
			}
		}
	});
});

describe('Seed Money pays the run, not the record', () => {
	it('starts a run with coins without minting Pearls', () => {
		const bare = createInitialState();
		expect(bare.coins.eq(0)).toBe(true);

		const seeded = createInitialState({
			...bare,
			prestigeUpgrades: { ...bare.prestigeUpgrades, pearl_seed: D(3) }
		} as never);

		expect(seeded.coins.gt(0)).toBe(true);
		// `pearlsFor` reads lifetimeCoins, so seeding it would turn a Pearl
		// upgrade into a Pearl printer.
		expect(seeded.lifetimeCoins.eq(0)).toBe(true);
		expect(seeded.allTimeCoins.eq(0)).toBe(true);
	});
});
