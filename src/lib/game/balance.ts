import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import type { FishingSources } from '$lib/fishing_sources';
import {
	BOAT_COST,
	BOAT_UPGRADES,
	AUTO_FISHER,
	AUTO_FISHER_OFFLINE_COST,
	BOAT_UPGRADE_IDS,
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS,
	needsBoat,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	type LicenceId,
	type PrestigeUpgradeId,
	type UpgradeId
} from './config';
import {
	accumulate,
	buyBoat,
	autoFisherCost,
	buyAutoFisher,
	buyAutoFisherOffline,
	buyBoatUpgrade,
	buyDeckhand,
	buyFuel,
	buyLicence,
	boatUpgradeCost,
	canBuyLicence,
	canUnlock,
	hasStandingOrder,
	nextLicence,
	repairBoat,
	repairCost,
	canPrestige,
	computeModifiers,
	createInitialState,
	deckhandCost,
	catchTable,
	nextLockedSource,
	performPrestige,
	buyPrestigeUpgrade,
	buyUpgrade,
	prestigeUpgradeCost,
	sellHold,
	totalIncomePerSecond,
	unlockSource,
	upgradeCost
} from './engine';
import type { GameState, Modifiers } from './types';

export interface SimulationResult {
	/** Seconds of simulated play before the first prestige became available. */
	secondsToPrestige: number | null;
	lifetimeCoins: Decimal;
	state: GameState;
	/** Wall-clock second at which each source was unlocked. */
	unlockedAt: Partial<Record<FishingSources, number>>;
	/** Second at which the crew started out-earning the player holding the rod. */
	idleCrossoverAt: number | null;
	/** Second the boat was bought, if it was. */
	boatAt: number | null;
	/** Second each licence was taken. */
	licencedAt: Partial<Record<LicenceId, number>>;
}

/**
 * What a competent player does without thinking: fuel up, arrange a standing
 * order once it pays for itself, and repair before the boat gets slow.
 */
function keepBoatWorking(state: GameState, modifiers: Modifiers): void {
	if (!state.boat.owned) return;

	if (!hasStandingOrder(state) && state.coins.gte(boatUpgradeCost('order', 0).times(2.5))) {
		buyBoatUpgrade(state, 'order');
	}

	if (state.boat.fuel.lt(modifiers.fuelCapacity.times(0.35))) {
		buyFuel(state, modifiers);
	}

	if (state.boat.condition < 65 && state.coins.gte(repairCost(state).times(2.5))) {
		repairBoat(state);
	}
}

export interface SimulationOptions {
	/** Give up after this many simulated seconds. */
	maxSeconds?: number;
	/** Simulation step. Larger is faster and slightly generous. */
	stepSeconds?: number;
	/** Fraction of the session the player is actually holding the rod. */
	manualUptime?: number;
	/** Spend when a purchase costs at most this fraction of the coin pile. */
	spendRatio?: number;
	/** Continue an existing run instead of starting a fresh one. */
	initialState?: GameState;
	/** Stop the moment prestige becomes available. Off means play the clock out. */
	stopOnPrestige?: boolean;
	/** Seed for the deterministic RNG, so runs are reproducible. */
	seed?: number;
}

/**
 * A small deterministic PRNG (mulberry32). Catches are rolled for real now, so
 * the simulation needs a reproducible stream or the balance assertions would
 * be flaky.
 */
export function seededRandom(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface Purchase {
	cost: Decimal;
	buy: () => void;
}

/**
 * A greedy stand-in for a real player: hold the rod at the deepest open water,
 * sell constantly, unlock the next source the moment it is affordable, and
 * otherwise always buy the cheapest thing on the board.
 *
 * Used by `balance.test.ts` to keep the curves honest — the first prestige has
 * to be reachable, and it has to take a plausible amount of time.
 */
export function simulateRun(options: SimulationOptions = {}): SimulationResult {
	const maxSeconds = options.maxSeconds ?? 60 * 60 * 6;
	const step = options.stepSeconds ?? 1;
	const manualUptime = options.manualUptime ?? 1;
	const spendRatio = options.spendRatio ?? 0.5;

	const random = seededRandom(options.seed ?? 0x5eed_f15e);
	const state = options.initialState ?? createInitialState();
	const unlockedAt: Partial<Record<FishingSources, number>> = { [state.activeSource]: 0 };

	let elapsed = 0;
	let secondsToPrestige: number | null = null;
	let idleCrossoverAt: number | null = null;
	let boatAt: number | null = null;
	const licencedAt: Partial<Record<LicenceId, number>> = {};

	while (elapsed < maxSeconds) {
		const modifiers = computeModifiers(state);

		const manual = 1 / modifiers.castSeconds[state.activeSource];

		if (idleCrossoverAt === null) {
			const table = catchTable(state.activeSource, modifiers.luck);
			const manualIncome = modifiers.fishPerCast
				.times(manual)
				.times(table.averageSourceValue)
				.times(modifiers.sellMultiplier);
			if (totalIncomePerSecond(state, modifiers).gt(manualIncome)) idleCrossoverAt = elapsed;
		}

		// The rig covers whatever share of the interval the player is not
		// holding the rod themselves — the same complement the live game applies
		// per tick, expressed here as an average over the step.
		accumulate(
			state,
			modifiers,
			step,
			1,
			{ [state.activeSource]: manual * manualUptime },
			random,
			1 - manualUptime
		);
		sellHold(state, modifiers);

		elapsed += step;

		// Gates first: paper, then a hull, then the water itself.
		const licence = nextLicence(state);
		if (licence && canBuyLicence(state, licence)) {
			buyLicence(state, licence);
			licencedAt[licence] = elapsed;
		}

		const next = nextLockedSource(state);

		if (next && needsBoat(next) && !state.boat.owned && state.coins.gte(BOAT_COST)) {
			buyBoat(state);
			boatAt = elapsed;
		}

		keepBoatWorking(state, modifiers);

		if (next && canUnlock(state, next)) {
			unlockSource(state, next);
			unlockedAt[next] = elapsed;
		}

		for (let attempt = 0; attempt < 12; attempt++) {
			const cheapest = cheapestPurchase(state);
			if (!cheapest) break;
			if (cheapest.cost.gt(state.coins.times(spendRatio))) break;
			cheapest.buy();
		}

		if (secondsToPrestige === null && canPrestige(state)) {
			secondsToPrestige = elapsed;
			if (options.stopOnPrestige !== false) break;
		}
	}

	return {
		secondsToPrestige,
		lifetimeCoins: state.lifetimeCoins,
		state,
		unlockedAt,
		idleCrossoverAt,
		boatAt,
		licencedAt
	};
}

function cheapestPurchase(state: GameState): Purchase | null {
	let best: Purchase | null = null;

	const consider = (cost: Decimal, buy: () => void) => {
		if (!best || cost.lt(best.cost)) best = { cost, buy };
	};

	for (const id of UPGRADE_IDS as UpgradeId[]) {
		const level = state.upgrades[id];
		if (level.gte(UPGRADES[id].maxLevel)) continue;
		consider(upgradeCost(id, level), () => buyUpgrade(state, id, 1));
	}

	for (const source of SOURCE_ORDER) {
		if (!state.unlocked[source]) continue;
		consider(deckhandCost(source, state.deckhands[source]), () => buyDeckhand(state, source, 1));
	}

	if (state.boat.owned) {
		for (const id of BOAT_UPGRADE_IDS) {
			if (state.boat.upgrades[id].gte(BOAT_UPGRADES[id].maxLevel)) continue;
			consider(boatUpgradeCost(id, state.boat.upgrades[id]), () => buyBoatUpgrade(state, id));
		}
	}

	if (state.autoFisher.lt(AUTO_FISHER.maxLevel)) {
		consider(autoFisherCost(state.autoFisher), () => {
			buyAutoFisher(state);
		});
	}

	if (!state.autoFisherOffline && state.autoFisher.gt(0)) {
		consider(D(AUTO_FISHER_OFFLINE_COST), () => {
			buyAutoFisherOffline(state);
		});
	}

	return best;
}

/** Coins per second at the end of a simulated run, for reporting. */
export function incomeSnapshot(state: GameState): Decimal {
	const modifiers = computeModifiers(state);
	let total = d0();
	for (const source of SOURCE_ORDER) {
		if (!state.unlocked[source]) continue;
		const crew = state.deckhands[source];
		if (crew.lte(0)) continue;
		total = total.plus(crew.times(modifiers.deckhandCastsPerSecond[source]));
	}
	return total;
}

export interface PrestigeChainEntry {
	run: number;
	seconds: number | null;
	lifetimeCoins: Decimal;
	pearlsAfter: Decimal;
}

/**
 * Play several runs back to back, prestiging and re-investing Pearls each time.
 * Later runs should be dramatically faster and reach much bigger exponents.
 */
export function simulatePrestigeChain(runs: number, options: SimulationOptions = {}) {
	const history: PrestigeChainEntry[] = [];
	let state = createInitialState();

	for (let run = 1; run <= runs; run++) {
		const result = simulateRun({ stopOnPrestige: false, ...options, initialState: state });
		state = result.state;

		const outcome = performPrestige(state);
		if (outcome) spendPearls(state);

		history.push({
			run,
			seconds: result.secondsToPrestige,
			lifetimeCoins: result.lifetimeCoins,
			pearlsAfter: state.allTimePearls
		});

		if (!outcome) break;
	}

	return { history, state };
}

/** Buy whatever prestige upgrade is cheapest until the Pearls run out. */
export function spendPearls(state: GameState): void {
	for (let attempt = 0; attempt < 200; attempt++) {
		let bestId: PrestigeUpgradeId | null = null;
		let bestCost: Decimal | null = null;

		for (const id of PRESTIGE_UPGRADE_IDS) {
			if (state.prestigeUpgrades[id].gte(PRESTIGE_UPGRADES[id].maxLevel)) continue;
			const cost = prestigeUpgradeCost(id, state.prestigeUpgrades[id]);
			if (!bestCost || cost.lt(bestCost)) {
				bestCost = cost;
				bestId = id;
			}
		}

		if (!bestId || !bestCost || state.pearls.lt(bestCost)) return;
		buyPrestigeUpgrade(state, bestId);
	}
}
