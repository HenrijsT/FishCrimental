import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import {
	BOAT_COST,
	BOAT_SOURCES,
	BOAT_UPGRADES,
	FUEL_PRICE,
	LICENCES,
	LICENCE_IDS,
	SOURCE_LICENCE,
	SOURCE_ORDER,
	needsBoat
} from './config';
import {
	accumulate,
	boatEfficiency,
	boatUpgradeCost,
	buyBoat,
	buyBoatUpgrade,
	buyFuel,
	buyLicence,
	canBuyLicence,
	canUnlock,
	computeModifiers,
	createInitialState,
	missingLicence,
	performCast,
	reachableSource,
	performPrestige,
	repairBoat,
	repairCost,
	runBoat,
	sourceBlocker,
	unlockSource
} from './engine';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

function openTo(state: GameState, upTo: FishingSources) {
	for (const source of SOURCE_ORDER) {
		state.unlocked[source] = true;
		if (source === upTo) break;
	}
	for (const id of LICENCE_IDS) state.licences[id] = true;
}

describe('licences', () => {
	it('are a chain — you cannot buy the fourth first', () => {
		const state = createInitialState();
		state.coins = D('1e12');

		expect(canBuyLicence(state, 'deep')).toBe(false);
		expect(canBuyLicence(state, 'coastal')).toBe(false);
		expect(canBuyLicence(state, 'inland')).toBe(true);

		buyLicence(state, 'inland');
		expect(canBuyLicence(state, 'lakes')).toBe(true);
		expect(canBuyLicence(state, 'deep')).toBe(false);
	});

	it('cost coins, once', () => {
		const state = createInitialState();
		state.coins = D(LICENCES.inland.cost);

		expect(buyLicence(state, 'inland')).toBe(true);
		expect(state.coins.eq(0)).toBe(true);
		expect(buyLicence(state, 'inland')).toBe(false);
	});

	it('gate the water they cover, and nothing else', () => {
		const state = createInitialState();
		expect(missingLicence(state, FishingSources.Pond)).toBeNull();

		for (const source of SOURCE_ORDER) {
			const required = SOURCE_LICENCE[source];
			expect(missingLicence(state, source)).toBe(required ?? null);
		}
	});

	it('stop a source being unlocked however much money is on the table', () => {
		const state = createInitialState();
		state.coins = D('1e30');
		expect(canUnlock(state, FishingSources.Stream)).toBe(false);

		buyLicence(state, 'inland');
		expect(canUnlock(state, FishingSources.Stream)).toBe(true);
	});

	it('rise in price with the water they open', () => {
		for (let i = 1; i < LICENCE_IDS.length; i++) {
			expect(LICENCES[LICENCE_IDS[i]].cost).toBeGreaterThan(LICENCES[LICENCE_IDS[i - 1]].cost);
		}
	});

	it('cover every source except the Pond exactly once', () => {
		const covered = LICENCE_IDS.flatMap((id) => LICENCES[id].covers);
		expect(new Set(covered).size).toBe(covered.length);
		expect(covered).toHaveLength(SOURCE_ORDER.length - 1);
		expect(covered).not.toContain(FishingSources.Pond);
	});
});

describe('the boat', () => {
	it('is required for open water and nothing shallower', () => {
		for (const source of SOURCE_ORDER) {
			expect(needsBoat(source)).toBe(BOAT_SOURCES.includes(source));
		}
		expect(needsBoat(FishingSources.Sea)).toBe(false);
		expect(needsBoat(FishingSources.Ocean)).toBe(true);
	});

	it('cannot be skipped with money alone', () => {
		const state = createInitialState();
		openTo(state, FishingSources.Sea);
		state.coins = D('1e30');

		expect(canUnlock(state, FishingSources.Offshore)).toBe(false);
		buyBoat(state);
		expect(canUnlock(state, FishingSources.Offshore)).toBe(true);
	});

	it('burns fuel and wears down as it works', () => {
		const state = createInitialState();
		openTo(state, FishingSources.Ocean);
		state.coins = D(BOAT_COST).plus(1e9);
		buyBoat(state);

		const modifiers = computeModifiers(state);
		buyFuel(state, modifiers);

		const fuelBefore = state.boat.fuel;
		const conditionBefore = state.boat.condition;

		runBoat(state, modifiers, D(120));

		expect(state.boat.fuel.lt(fuelBefore)).toBe(true);
		expect(state.boat.condition).toBeLessThan(conditionBefore);
	});

	it('is slow at zero condition, never stopped', () => {
		expect(boatEfficiency(100)).toBe(1);
		expect(boatEfficiency(0)).toBe(0.4);
		expect(boatEfficiency(-50)).toBe(0.4);
		expect(boatEfficiency(50)).toBeCloseTo(0.7, 6);
	});

	it('repairs partially when the player cannot pay in full', () => {
		const state = createInitialState();
		state.boat.owned = true;
		state.boat.condition = 20;

		state.coins = repairCost(state).div(4);
		expect(repairBoat(state)).toBe(true);
		expect(state.boat.condition).toBeGreaterThan(20);
		expect(state.boat.condition).toBeLessThan(100);
		expect(state.coins.eq(0)).toBe(true);
	});

	it('never sells more fuel than the tank or the wallet holds', () => {
		const state = createInitialState();
		state.boat.owned = true;
		const modifiers = computeModifiers(state);

		state.coins = D(FUEL_PRICE * 3);
		expect(buyFuel(state, modifiers).toNumber()).toBeCloseTo(3, 6);
		expect(state.coins.eq(0)).toBe(true);

		state.coins = D('1e30');
		buyFuel(state, modifiers);
		expect(state.boat.fuel.lte(modifiers.fuelCapacity)).toBe(true);
	});

	it('gets cheaper to run and bigger to fill as it is fitted out', () => {
		const state = createInitialState();
		state.boat.owned = true;
		state.coins = D('1e30');

		const before = computeModifiers(state);
		buyBoatUpgrade(state, 'engine');
		buyBoatUpgrade(state, 'tank');
		buyBoatUpgrade(state, 'hull');
		const after = computeModifiers(state);

		expect(after.fuelPerCast.lt(before.fuelPerCast)).toBe(true);
		expect(after.fuelCapacity.gt(before.fuelCapacity)).toBe(true);
		expect(after.wearPerCast).toBeLessThan(before.wearPerCast);
	});

	it('prices the fit-out above the boat itself', () => {
		for (const id of ['hull', 'engine', 'tank', 'order'] as const) {
			expect(boatUpgradeCost(id, 0).gt(BOAT_COST)).toBe(true);
			expect(BOAT_UPGRADES[id].maxLevel).toBeGreaterThan(0);
		}
	});
});

/**
 * The hard constraint from the brief: an idle game must never punish the player
 * for being away. Fuel and condition are sinks, not fail states.
 */
describe('running dry is never a fail state', () => {
	function stranded(): GameState {
		const state = createInitialState();
		openTo(state, FishingSources.Ocean);
		state.boat.owned = true;
		state.boat.fuel = D(0);
		state.boat.condition = 0;
		state.activeSource = FishingSources.Ocean;
		for (const source of SOURCE_ORDER) state.deckhands[source] = D(10);
		return state;
	}

	it('falls back to the deepest water still reachable', () => {
		const state = stranded();
		expect(reachableSource(state, computeModifiers(state))).toBe(FishingSources.Sea);
	});

	it('keeps the crew earning with an empty tank', () => {
		const state = stranded();
		const modifiers = computeModifiers(state);

		const result = accumulate(state, modifiers, 3600);

		expect(result.fish.gt(0)).toBe(true);
		expect(result.value.gt(0)).toBe(true);
		expect(result.fellBack).toBe(true);
	});

	it('keeps a manual cast working with an empty tank', () => {
		const state = stranded();
		const modifiers = computeModifiers(state);

		const result = performCast(state, FishingSources.Ocean, modifiers, () => 0.5);

		expect(result.source).toBe(FishingSources.Sea);
		expect(result.fish.gte(1)).toBe(true);
	});

	it('never destroys anything the player already had', () => {
		const state = stranded();
		state.coins = D('1e12');
		state.pearls = D(40);
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;

		accumulate(state, computeModifiers(state), 8 * 3600);

		expect(state.coins.eq('1e12')).toBe(true);
		expect(state.pearls.eq(40)).toBe(true);
		expect(state.unlocked[FishingSources.Ocean]).toBe(true);
		expect(state.boat.owned).toBe(true);
		expect(state.boat.condition).toBeGreaterThanOrEqual(0);
	});

	it('is always recoverable — one tank of fuel puts it back to sea', () => {
		const state = stranded();
		state.coins = D('1e12');

		const modifiers = computeModifiers(state);
		buyFuel(state, modifiers);

		expect(sourceBlocker(state, FishingSources.Ocean)).toBeNull();
		expect(reachableSource(state, computeModifiers(state))).toBe(FishingSources.Ocean);
	});

	it('reports the fallback rather than hiding it', () => {
		const state = stranded();
		expect(sourceBlocker(state, FishingSources.Ocean)).toBe('fuel');
		expect(sourceBlocker(state, FishingSources.Sea)).toBeNull();
	});

	it('survives eight hours away with no fuel and no standing order', () => {
		const state = stranded();
		const before = state.coins;
		const result = accumulate(state, computeModifiers(state), 8 * 3600);

		expect(result.value.gt(0)).toBe(true);
		expect(state.coins.gte(before)).toBe(true);
		expect(state.boat.fuel.gte(0)).toBe(true);
	});
});

describe('save round trip with the new systems', () => {
	it('keeps licences, the boat and its fit-out', () => {
		const state = createInitialState();
		openTo(state, FishingSources.Ocean);
		state.coins = D('1e30');
		buyBoat(state);
		buyBoatUpgrade(state, 'engine');
		buyBoatUpgrade(state, 'order');
		buyFuel(state, computeModifiers(state));
		state.boat.condition = 62.5;

		const restored = fromRaw(JSON.parse(serialize(state)));

		expect(restored.licences.deep).toBe(true);
		expect(restored.boat.owned).toBe(true);
		expect(restored.boat.upgrades.engine.eq(1)).toBe(true);
		expect(restored.boat.upgrades.order.eq(1)).toBe(true);
		expect(restored.boat.fuel.eq(state.boat.fuel)).toBe(true);
		expect(restored.boat.condition).toBeCloseTo(62.5, 6);
	});

	it('grandfathers a version 2 save so nobody loses water they had opened', () => {
		const restored = fromRaw({
			version: 2,
			unlocked: { Pond: true, Stream: true, River: true, Lake: true, Lagoon: true, Sea: true },
			coins: '1e9'
		});

		expect(restored.licences.inland).toBe(true);
		expect(restored.licences.lakes).toBe(true);
		expect(restored.licences.coastal).toBe(true);
		expect(restored.licences.deep).toBe(false);
		expect(restored.boat.owned).toBe(false);
		expect(restored.unlocked[FishingSources.Sea]).toBe(true);
	});

	it('hands a boat to a version 2 save that had already reached open water', () => {
		const restored = fromRaw({
			version: 2,
			unlocked: {
				Pond: true,
				Stream: true,
				River: true,
				Lake: true,
				Lagoon: true,
				Sea: true,
				Offshore: true,
				Ocean: true
			}
		});

		expect(restored.boat.owned).toBe(true);
		expect(restored.licences.deep).toBe(true);
	});

	it('clamps a hand-edited condition dial', () => {
		expect(fromRaw({ version: 3, boat: { condition: 5000 } }).boat.condition).toBe(100);
		expect(fromRaw({ version: 3, boat: { condition: -20 } }).boat.condition).toBe(0);
		expect(fromRaw({ version: 3, boat: { fuel: '-40' } }).boat.fuel.eq(0)).toBe(true);
	});
});

describe('unlocking still respects the order', () => {
	it('needs licence, boat and coins together', () => {
		const state = createInitialState();
		state.coins = D('1e30');
		for (const id of LICENCE_IDS) state.licences[id] = true;

		for (const source of SOURCE_ORDER.slice(1)) {
			if (needsBoat(source) && !state.boat.owned) {
				expect(unlockSource(state, source)).toBe(false);
				buyBoat(state);
			}
			expect(unlockSource(state, source)).toBe(true);
		}

		expect(SOURCE_ORDER.every((source) => state.unlocked[source])).toBe(true);
	});
});

describe('the standing fuel order', () => {
	function crewedBoat(order: boolean) {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.fuel = D(0);
		state.boat.condition = 100;
		state.deckhands[FishingSources.Ocean] = D(40);
		state.coins = D('1e12');
		if (order) state.boat.upgrades.order = D(1);
		return state;
	}

	it('keeps a big crew at sea where a tank alone could not', () => {
		const without = crewedBoat(false);
		const withOrder = crewedBoat(true);

		const a = accumulate(without, computeModifiers(without), 3600);
		const b = accumulate(withOrder, computeModifiers(withOrder), 3600);

		expect(a.fellBack).toBe(true);
		expect(b.fellBack).toBe(false);
		expect(b.value.gt(a.value)).toBe(true);
	});

	it('bills the player for what it delivers', () => {
		const state = crewedBoat(true);
		const before = state.coins;

		accumulate(state, computeModifiers(state), 600);

		expect(state.coins.lt(before)).toBe(true);
		expect(state.coins.gte(0)).toBe(true);
	});

	it('never spends coins the player does not have', () => {
		const state = crewedBoat(true);
		state.coins = D(0);

		const result = accumulate(state, computeModifiers(state), 3600);

		expect(state.coins.gte(0)).toBe(true);
		// Broke and dry still earns — inshore.
		expect(result.value.gt(0)).toBe(true);
		expect(result.fellBack).toBe(true);
	});
});

describe('an empty tank with a standing order is not stranded', () => {
	it('counts as able to sail while the coins are there', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.fuel = D(0);
		state.boat.upgrades.order = D(1);
		state.coins = D('1e9');

		const modifiers = computeModifiers(state);
		expect(sourceBlocker(state, FishingSources.Ocean, modifiers)).toBeNull();
		expect(reachableSource(state, modifiers)).toBe(FishingSources.Ocean);

		// And broke, it falls back rather than stalling.
		state.coins = D(0);
		const broke = computeModifiers(state);
		expect(sourceBlocker(state, FishingSources.Ocean, broke)).toBe('fuel');
		expect(reachableSource(state, broke)).toBe(FishingSources.Sea);
	});

	it('does not strand the last cast of a trip to rounding', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.upgrades.order = D(1);
		state.coins = D('1e12');

		const modifiers = computeModifiers(state);
		for (const casts of [1, 7, 137, 1_000, 22_681]) {
			state.boat.fuel = D(0);
			const run = runBoat(state, modifiers, D(casts));
			expect(run.shortfall.eq(0), `${casts} casts stranded ${run.shortfall}`).toBe(true);
			expect(run.sailed.eq(casts)).toBe(true);
		}
	});
});

describe('prestige and the new gates', () => {
	it('resets licences with the run', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.boat.owned = true;
		state.boat.upgrades.engine = D(4);
		state.lifetimeCoins = D('1e16');

		performPrestige(state);

		expect(state.licences.lakes).toBe(false);
		expect(state.licences.deep).toBe(false);
		expect(state.boat.owned).toBe(false);
		expect(state.boat.upgrades.engine.eq(0)).toBe(true);
	});

	it('never hands the Standing Charter water it has no licence for', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.lifetimeCoins = D('1e16');
		state.prestigeUpgrades.pearl_headstart = D(5);

		performPrestige(state);

		for (const source of SOURCE_ORDER) {
			if (!state.unlocked[source]) continue;
			expect(missingLicence(state, source), `${source} unlocked but unlicensed`).toBeNull();
		}
	});

	it('never starts a run standing over water with no boat under it', () => {
		for (let headstart = 0; headstart <= 7; headstart++) {
			const state = createInitialState();
			for (const source of SOURCE_ORDER) state.unlocked[source] = true;
			for (const id of LICENCE_IDS) state.licences[id] = true;
			state.lifetimeCoins = D('1e16');
			state.prestigeUpgrades.pearl_headstart = D(headstart);

			performPrestige(state);

			expect(needsBoat(state.activeSource), `headstart ${headstart}`).toBe(false);
			expect(
				sourceBlocker(state, state.activeSource, computeModifiers(state)),
				`headstart ${headstart}`
			).toBeNull();
		}
	});

	it('earns from the first tick of a headstart run', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = true;
		for (const id of LICENCE_IDS) state.licences[id] = true;
		state.lifetimeCoins = D('1e16');
		state.prestigeUpgrades.pearl_headstart = D(4);
		performPrestige(state);

		state.deckhands[state.activeSource] = D(5);
		const result = accumulate(state, computeModifiers(state), 120);
		expect(result.value.gt(0)).toBe(true);
	});
});

describe('unlicensed water pays nothing', () => {
	it('however it came to be unlocked', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Stream] = true;
		state.deckhands[FishingSources.Stream] = D(50);

		expect(accumulate(state, computeModifiers(state), 600).fish.eq(0)).toBe(true);

		state.licences.inland = true;
		expect(accumulate(state, computeModifiers(state), 600).fish.gt(0)).toBe(true);
	});
});
