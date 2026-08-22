import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS,
	SOURCE_CONFIG,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS
} from './config';
import {
	affordableDeckhands,
	buyUpgrade,
	computeModifiers,
	createInitialState,
	deckhandBulkCost,
	prestigeUpgradeCost,
	totalIncomePerSecond,
	upgradeCost
} from './engine';

describe('the upgrade tree', () => {
	it('describes every level without producing junk text', () => {
		for (const id of UPGRADE_IDS) {
			for (const level of [0, 1, 7, UPGRADES[id].maxLevel]) {
				const text = UPGRADES[id].format(level);
				expect(text).not.toContain('NaN');
				expect(text).not.toContain('Infinity');
				expect(text.length).toBeGreaterThan(3);
			}
		}
	});

	it('points every effect in the direction it claims', () => {
		expect(UPGRADES.rod.effect).toBeLessThan(1); // faster casts
		expect(UPGRADES.net.effect).toBeGreaterThan(1);
		expect(UPGRADES.lure.effect).toBeGreaterThan(1);
		expect(UPGRADES.market.effect).toBeGreaterThan(1);
		expect(UPGRADES.crew.effect).toBeGreaterThan(1);
		expect(PRESTIGE_UPGRADES.pearl_speed.effect).toBeLessThan(1);
	});

	it('needs Decimal — costs leave exact integers behind almost immediately', () => {
		for (const id of UPGRADE_IDS) {
			const top = upgradeCost(id, UPGRADES[id].maxLevel);
			expect(top.gt(Number.MAX_SAFE_INTEGER)).toBe(true);
			expect(top.toJSON().length).toBeGreaterThan(0);
		}

		// And a well-fed late prestige run walks straight past the double limit.
		const state = createInitialState();
		state.pearls = D('1e400');
		state.prestigeUpgrades.pearl_yield = D(PRESTIGE_UPGRADES.pearl_yield.maxLevel);
		expect(computeModifiers(state).sellMultiplier.gt('1e308')).toBe(true);
	});

	it('never lets a cast drop below the floor, however much rod is bought', () => {
		const state = createInitialState();
		state.coins = D('1e300');
		buyUpgrade(state, 'rod', UPGRADES.rod.maxLevel);
		state.prestigeUpgrades.pearl_speed = D(PRESTIGE_UPGRADES.pearl_speed.maxLevel);

		const modifiers = computeModifiers(state);
		for (const source of SOURCE_ORDER) {
			expect(modifiers.castSeconds[source]).toBeGreaterThanOrEqual(0.05);
			expect(Number.isFinite(modifiers.castSeconds[source])).toBe(true);
		}
	});

	it('keeps every modifier finite at the very top of the tree', () => {
		const state = createInitialState();
		state.coins = D('1e3000');
		for (const id of UPGRADE_IDS) buyUpgrade(state, id, UPGRADES[id].maxLevel);
		for (const id of PRESTIGE_UPGRADE_IDS) {
			state.prestigeUpgrades[id] = D(PRESTIGE_UPGRADES[id].maxLevel);
		}
		state.pearls = D('1e40');

		const modifiers = computeModifiers(state);
		expect(modifiers.fishPerCast.isFinite()).toBe(true);
		expect(modifiers.sellMultiplier.isFinite()).toBe(true);
		expect(Number.isFinite(modifiers.luck)).toBe(true);
		expect(modifiers.luck).toBeGreaterThan(1);
	});
});

describe('deckhands', () => {
	it('never sells more than the coins cover', () => {
		for (const source of SOURCE_ORDER) {
			for (const coins of ['0', '1e3', '1e9', '1e40']) {
				const owned = D(4);
				const count = affordableDeckhands(source, owned, D(coins));
				if (count.lte(0)) continue;

				expect(deckhandBulkCost(source, owned, count).lte(coins)).toBe(true);
				expect(deckhandBulkCost(source, owned, count.plus(1)).gt(coins)).toBe(true);
			}
		}
	});

	it('cost more the deeper the water', () => {
		for (let i = 1; i < SOURCE_ORDER.length; i++) {
			expect(SOURCE_CONFIG[SOURCE_ORDER[i]].deckhandBaseCost).toBeGreaterThan(
				SOURCE_CONFIG[SOURCE_ORDER[i - 1]].deckhandBaseCost
			);
		}
	});

	it('add income linearly at a single source', () => {
		const state = createInitialState();
		state.deckhands[FishingSources.Pond] = D(1);
		const one = totalIncomePerSecond(state, computeModifiers(state));

		state.deckhands[FishingSources.Pond] = D(10);
		const ten = totalIncomePerSecond(state, computeModifiers(state));

		expect(ten.div(one).toNumber()).toBeCloseTo(10, 6);
	});
});

describe('prestige upgrade costs', () => {
	it('are whole Pearls and strictly increasing', () => {
		for (const id of PRESTIGE_UPGRADE_IDS) {
			let previous = prestigeUpgradeCost(id, 0);
			expect(previous.eq(previous.floor())).toBe(true);

			for (let level = 1; level < PRESTIGE_UPGRADES[id].maxLevel; level++) {
				const cost = prestigeUpgradeCost(id, level);
				expect(cost.eq(cost.floor())).toBe(true);
				expect(cost.gt(previous)).toBe(true);
				previous = cost;
			}
		}
	});
});
