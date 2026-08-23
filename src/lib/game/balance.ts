import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import type { FishingSources } from '$lib/fishing_sources';
import {
	BOAT_COST,
	ASSISTANT_COST,
	AUTO_FISHER,
	BUCKET_MAX_LEVEL,
	AUTO_FISHER_OFFLINE_COST,
	BICYCLE_COST,
	BOAT_UPGRADE_IDS,
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS,
	needsBoat,
	SOURCE_ORDER,
	POND_MAX,
	POND_MAX_LEVEL,
	UPGRADE_IDS,
	type LicenceId,
	type PrestigeUpgradeId,
	type UpgradeId
} from './config';
import {
	EXAM_SECONDS_PER_STEP,
	advanceExamIdle,
	canSit,
	claimLicence,
	examComplete,
	startExam
} from './exams';
import { settleMarket } from './market';
import {
	accumulate,
	buyBoat,
	autoFisherCost,
	boatUpgradeCeiling,
	upgradeCeiling,
	bucketCost,
	buyAssistant,
	buyAutoFisher,
	buyBucket,
	buyAutoFisherOffline,
	buyBicycle,
	buyBoatUpgrade,
	inTown,
	digPond,
	listForSale,
	pondCost,
	pondFishValue,
	pondLevelCost,
	pondsOpen,
	stockPond,
	upgradePond,
	rideToTown,
	runTrader,
	buyDeckhand,
	buyFuel,
	boatUpgradeCost,
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

	// Wall-clock deadlines (the town trip, the trader) are absolute timestamps,
	// so the simulation needs a clock of its own rather than Date.now().
	const clockStart = state.lastUpdate || 0;
	const clock = () => clockStart + elapsed * 1000;

	// The market recovers on the simulation's clock too. Without this the sim's
	// prices only ever fall, and it models a harsher market than the game has.
	state.marketUpdatedAt = clockStart;

	let elapsed = 0;
	let secondsToPrestige: number | null = null;
	let idleCrossoverAt: number | null = null;
	let boatAt: number | null = null;
	const licencedAt: Partial<Record<LicenceId, number>> = {};

	while (elapsed < maxSeconds) {
		const modifiers = computeModifiers(state);

		// In town selling: manual casting stops, the crew do not.
		const inTownNow = inTown(state, clock());
		const manual = inTownNow ? 0 : 1 / modifiers.castSeconds[state.activeSource];

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
		settleMarket(state, clock());

		accumulate(
			state,
			modifiers,
			step,
			1,
			{ [state.activeSource]: manual * manualUptime },
			random,
			1 - manualUptime
		);
		// Who buys, and when.
		//
		// With an Assistant the catch is sold as it lands, at full price. With a
		// bicycle the player rides in whenever the last trip has finished.
		//
		// Otherwise they list it for the travelling merchant (R65) and he
		// settles it when he arrives — which is also what a bicycle owner does
		// while the trip is running, because a full bucket stops the crew and a
		// listed fish at 55% beats a fish never caught. The waiting is the whole
		// economic shape of the opening, so the simulation has to feel it.
		if (state.hasAssistant) {
			sellHold(state, modifiers);
		} else if (state.hasBicycle && !inTown(state, clock())) {
			rideToTown(state, modifiers, clock());
		} else {
			listForSale(state);
			runTrader(state, modifiers, clock());
		}

		elapsed += step;

		// Gates first: paper, then a hull, then the water itself.
		//
		// Paper is no longer bought (R42). The reference player sits the exam
		// the moment it is open to them and takes the card the moment it is
		// passed — which is what a player who wants the next water does. What it
		// costs them is time rather than coins, and the Cull and the Sounder
		// cost the seconds it takes to click through them.
		const licence = nextLicence(state);
		if (licence && !state.exam && canSit(state, licence)) {
			startExam(state, licence, random);
		}

		// The reference player is actually clicking, so they work through a Cull
		// or a Sounder at a call every couple of seconds rather than waiting for
		// the warden's twenty-second drip.
		if (state.exam) advanceExamIdle(state, step, EXAM_SECONDS_PER_STEP[state.exam.kind]);

		if (examComplete(state.exam)) {
			const taken = claimLicence(state);
			if (taken) licencedAt[taken] = elapsed;
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

/**
 * The most valuable fish the player has landed, which is what anyone would
 * stock a pond with.
 *
 * Not the most *numerous* — that is whatever is commonest, which is by
 * construction the cheapest thing they catch, and a reference player who fills
 * six ponds with minnows is not a reference for anything.
 */
function bestKnownSpecies(state: GameState): string | null {
	let best: string | null = null;
	let bestValue = d0();
	for (const name of Object.keys(state.dex)) {
		if (state.dex[name].lte(0)) continue;
		const value = pondFishValue(name);
		if (value.gt(bestValue)) {
			bestValue = value;
			best = name;
		}
	}
	return best;
}

function cheapestPurchase(state: GameState): Purchase | null {
	let best: Purchase | null = null;

	const consider = (cost: Decimal, buy: () => void) => {
		if (!best || cost.lt(best.cost)) best = { cost, buy };
	};

	for (const id of UPGRADE_IDS as UpgradeId[]) {
		const level = state.upgrades[id];
		// Against the shopkeeper's ceiling, not the track's maximum. Compare to
		// maxLevel and the greedy loop picks a gated track as "cheapest" every
		// step, buys nothing, and the whole reference strategy stalls — silently,
		// because buyUpgrade returns 0 rather than throwing.
		if (level.gte(upgradeCeiling(state, id))) continue;
		consider(upgradeCost(id, level), () => buyUpgrade(state, id, 1));
	}

	for (const source of SOURCE_ORDER) {
		if (!state.unlocked[source]) continue;
		consider(deckhandCost(source, state.deckhands[source]), () => buyDeckhand(state, source, 1));
	}

	if (state.boat.owned) {
		for (const id of BOAT_UPGRADE_IDS) {
			if (state.boat.upgrades[id].gte(boatUpgradeCeiling(state, id))) continue;
			consider(boatUpgradeCost(id, state.boat.upgrades[id]), () => buyBoatUpgrade(state, id));
		}
	}

	// The bucket only matters until the Assistant retires it, and a greedy
	// player upgrades it while it does.
	if (!state.hasAssistant && state.bucketLevel.lt(BUCKET_MAX_LEVEL)) {
		consider(bucketCost(state.bucketLevel), () => {
			buyBucket(state);
		});
	}

	if (!state.hasBicycle) {
		consider(D(BICYCLE_COST), () => {
			buyBicycle(state);
		});
	}

	if (!state.hasAssistant) {
		consider(D(ASSISTANT_COST), () => {
			buyAssistant(state);
		});
	}

	if (state.autoFisher.lt(AUTO_FISHER.maxLevel)) {
		consider(autoFisherCost(state.autoFisher), () => {
			buyAutoFisher(state);
		});
	}

	// Ponds. The reference player digs one when it is the cheapest thing on the
	// board, stocks it with whatever they know best, and levels it like anything
	// else. Stocking every pond with the same fish is deliberately what a greedy
	// player does — it is the behaviour the market exists to charge for, so the
	// pacing figures should feel it rather than be measured against a player who
	// happens to diversify.
	if (pondsOpen(state)) {
		if (state.ponds.length < POND_MAX) {
			consider(pondCost(state.ponds.length), () => {
				digPond(state);
			});
		}

		for (let index = 0; index < state.ponds.length; index++) {
			const pond = state.ponds[index];
			if (!pond.species) {
				const best = bestKnownSpecies(state);
				if (best) stockPond(state, index, best);
			}
			if (pond.level.gte(POND_MAX_LEVEL)) continue;
			consider(pondLevelCost(pond.level), () => {
				upgradePond(state, index);
			});
		}
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
