import Decimal from 'break_eternity.js';
import { D, d0, d1 } from '$lib/decimal';
import {
	FISH_TYPES,
	FishType,
	RARE_FISH_TYPES,
	fishTypeBaseValue,
	fishTypeLabel
} from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { fishes, sourcesToFish } from '$lib/fishes';
import type { Fish } from '$lib/fishes/fish';
import { RandomIndex } from '$lib/random_picker';
import {
	DECKHAND_BASE_EFFICIENCY,
	DECKHAND_COST_GROWTH,
	MIN_CAST_SECONDS,
	PEARL_EXPONENT,
	PEARL_MULTIPLIER_EXPONENT,
	PEARL_MULTIPLIER_SCALE,
	PRESTIGE_THRESHOLD,
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS,
	SAVE_VERSION,
	SOURCE_CONFIG,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	type PrestigeUpgradeId,
	type UpgradeId
} from './config';
import type { GameState, Modifiers } from './types';

// ---------------------------------------------------------------------------
// Catch tables
// ---------------------------------------------------------------------------

export interface SpeciesChance {
	fish: Fish;
	probability: number;
}

export interface CatchTable {
	source: FishingSources;
	species: SpeciesChance[];
	/** Probability of each fish type, summed over its species. */
	typeProbability: Map<FishType, number>;
	/** Average coin value of one fish here, before the source multiplier. */
	averageValue: number;
	/** Average coin value of one fish here, including the source multiplier. */
	averageSourceValue: number;
	/** Weighted picker over the species, for real casts. */
	picker: RandomIndex<Fish>;
}

/**
 * Fish are drawn in two stages: first a *type* (using the source's rarity mix,
 * bent by the player's luck), then a *species* within that type (using the
 * per-fish `baseChance` from the catalogue). This flattens both stages into a
 * single species → probability table.
 */
export function buildCatchTable(source: FishingSources, luck: number): CatchTable {
	const config = SOURCE_CONFIG[source];
	const available = sourcesToFish[source];

	const speciesByType = new Map<FishType, Fish[]>();
	for (const fish of available) {
		const bucket = speciesByType.get(fish.category);
		if (bucket) bucket.push(fish);
		else speciesByType.set(fish.category, [fish]);
	}

	let totalWeight = 0;
	const typeWeights = new Map<FishType, number>();
	for (const type of FISH_TYPES) {
		const configured = config.typeWeights[type];
		if (configured === undefined || configured <= 0) continue;
		if (!speciesByType.has(type)) continue;

		const weight = RARE_FISH_TYPES.includes(type) ? configured * luck : configured;
		typeWeights.set(type, weight);
		totalWeight += weight;
	}

	const species: SpeciesChance[] = [];
	const typeProbability = new Map<FishType, number>();
	let averageValue = 0;

	for (const [type, weight] of typeWeights) {
		const typeProb = weight / totalWeight;
		typeProbability.set(type, typeProb);
		averageValue += typeProb * fishTypeBaseValue[type];

		const members = speciesByType.get(type) ?? [];
		const memberTotal = members.reduce((sum, fish) => sum + fish.baseChance, 0);
		for (const fish of members) {
			species.push({ fish, probability: typeProb * (fish.baseChance / memberTotal) });
		}
	}

	return {
		source,
		species,
		typeProbability,
		averageValue,
		averageSourceValue: averageValue * config.valueMultiplier,
		picker: new RandomIndex(species.map((s) => [s.fish, s.probability] as [Fish, number]))
	};
}

const catchTableCache = new Map<string, CatchTable>();

/** Catch tables only change when luck changes, so they are memoised. */
export function catchTable(source: FishingSources, luck: number): CatchTable {
	const key = `${source}|${luck.toPrecision(10)}`;
	let table = catchTableCache.get(key);
	if (!table) {
		table = buildCatchTable(source, luck);
		catchTableCache.set(key, table);

		// Bound the cache — luck only takes a few dozen distinct values per run.
		if (catchTableCache.size > 256) {
			const oldest = catchTableCache.keys().next().value;
			if (oldest !== undefined) catchTableCache.delete(oldest);
		}
	}
	return table;
}

export function clearCatchTableCache(): void {
	catchTableCache.clear();
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export function upgradeCost(id: UpgradeId, level: Decimal | number): Decimal {
	const config = UPGRADES[id];
	return D(config.baseCost).times(D(config.costGrowth).pow(level));
}

/**
 * Total cost of buying `count` further levels — a geometric series, so it stays
 * exact for very large bulk buys instead of looping.
 */
export function upgradeBulkCost(id: UpgradeId, level: Decimal, count: Decimal): Decimal {
	const config = UPGRADES[id];
	const growth = D(config.costGrowth);
	const first = upgradeCost(id, level);
	return first.times(growth.pow(count).minus(1)).div(growth.minus(1));
}

/** How many further levels the given coin pile can buy. */
export function affordableUpgradeLevels(id: UpgradeId, level: Decimal, coins: Decimal): Decimal {
	const config = UPGRADES[id];
	const first = upgradeCost(id, level);
	if (coins.lt(first)) return d0();

	const growth = D(config.costGrowth);
	// n = log_g( 1 + coins * (g - 1) / first )
	const ratio = coins.times(growth.minus(1)).div(first).plus(1);
	const count = Decimal.log10(ratio).div(Decimal.log10(growth)).floor();

	const remaining = D(config.maxLevel).minus(level);
	return Decimal.max(d0(), Decimal.min(count, remaining));
}

export function prestigeUpgradeCost(id: PrestigeUpgradeId, level: Decimal | number): Decimal {
	const config = PRESTIGE_UPGRADES[id];
	return D(config.baseCost).times(D(config.costGrowth).pow(level)).floor();
}

/**
 * Not floored. `deckhandBulkCost` sums the exact geometric series, so flooring
 * here would make buying ten at once cost more than buying ten one at a time.
 */
export function deckhandCost(source: FishingSources, owned: Decimal | number): Decimal {
	return D(SOURCE_CONFIG[source].deckhandBaseCost).times(D(DECKHAND_COST_GROWTH).pow(owned));
}

export function deckhandBulkCost(source: FishingSources, owned: Decimal, count: Decimal): Decimal {
	const growth = D(DECKHAND_COST_GROWTH);
	const first = deckhandCost(source, owned);
	return first.times(growth.pow(count).minus(1)).div(growth.minus(1));
}

export function affordableDeckhands(
	source: FishingSources,
	owned: Decimal,
	coins: Decimal
): Decimal {
	const first = deckhandCost(source, owned);
	if (coins.lt(first)) return d0();

	const growth = D(DECKHAND_COST_GROWTH);
	const ratio = coins.times(growth.minus(1)).div(first).plus(1);
	return Decimal.max(d0(), Decimal.log10(ratio).div(Decimal.log10(growth)).floor());
}

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

export function pearlMultiplier(pearls: Decimal): Decimal {
	if (pearls.lte(0)) return d1();
	return pearls.pow(PEARL_MULTIPLIER_EXPONENT).times(PEARL_MULTIPLIER_SCALE).plus(1);
}

export function computeModifiers(state: GameState): Modifiers {
	const rodLevel = state.upgrades.rod;
	const speedFromRod = D(UPGRADES.rod.effect).pow(rodLevel);
	const speedFromTides = D(PRESTIGE_UPGRADES.pearl_speed.effect).pow(
		state.prestigeUpgrades.pearl_speed
	);
	const speedFactor = Math.max(speedFromRod.times(speedFromTides).toNumber(), 1e-9);

	const luck =
		D(UPGRADES.lure.effect)
			.pow(state.upgrades.lure)
			.times(D(PRESTIGE_UPGRADES.pearl_luck.effect).pow(state.prestigeUpgrades.pearl_luck))
			.toNumber() || 1;

	const pearlBonus = pearlMultiplier(state.pearls);

	const fishPerCast = D(UPGRADES.net.effect).pow(state.upgrades.net).times(pearlBonus);

	const sellMultiplier = D(UPGRADES.market.effect)
		.pow(state.upgrades.market)
		.times(D(PRESTIGE_UPGRADES.pearl_yield.effect).pow(state.prestigeUpgrades.pearl_yield))
		.times(dexMultiplier(state))
		.times(pearlBonus);

	const crewFactor =
		D(UPGRADES.crew.effect)
			.pow(state.upgrades.crew)
			.times(D(PRESTIGE_UPGRADES.pearl_crew.effect).pow(state.prestigeUpgrades.pearl_crew))
			.toNumber() || 1;

	const castSeconds = {} as Record<FishingSources, number>;
	const deckhandCastsPerSecond = {} as Record<FishingSources, number>;

	for (const source of SOURCE_ORDER) {
		const seconds = Math.max(SOURCE_CONFIG[source].castSeconds * speedFactor, MIN_CAST_SECONDS);
		castSeconds[source] = seconds;
		deckhandCastsPerSecond[source] = (DECKHAND_BASE_EFFICIENCY * crewFactor) / seconds;
	}

	return {
		castSeconds,
		fishPerCast,
		luck,
		sellMultiplier,
		deckhandCastsPerSecond,
		pearlMultiplier: pearlBonus
	};
}

// ---------------------------------------------------------------------------
// Catching
// ---------------------------------------------------------------------------

/**
 * Casts per second contributed by every deckhand at a source.
 *
 * Returns a Decimal, not a number: a large enough crew overflows a double, and
 * an `Infinity` here used to poison the hold value, the coin balance and then
 * the save file — where `parseDecimal` rejects it and silently resets the
 * field to zero.
 */
export function autoCastsPerSecond(
	state: GameState,
	modifiers: Modifiers,
	source: FishingSources
): Decimal {
	if (!state.unlocked[source]) return d0();
	const crew = state.deckhands[source];
	if (crew.lte(0)) return d0();
	return crew.times(modifiers.deckhandCastsPerSecond[source]);
}

/** Coins per second the hold gains from a source, at present rates. */
export function sourceIncomePerSecond(
	state: GameState,
	modifiers: Modifiers,
	source: FishingSources
): Decimal {
	const casts = autoCastsPerSecond(state, modifiers, source);
	if (casts.lte(0)) return d0();

	const table = catchTable(source, modifiers.luck);
	return modifiers.fishPerCast
		.times(casts)
		.times(table.averageSourceValue)
		.times(modifiers.sellMultiplier);
}

export function totalIncomePerSecond(state: GameState, modifiers: Modifiers): Decimal {
	let total = d0();
	for (const source of SOURCE_ORDER) {
		total = total.plus(sourceIncomePerSecond(state, modifiers, source));
	}
	return total;
}

function recordCatch(state: GameState, fish: Fish, count: Decimal, value: Decimal): void {
	state.hold[fish.category] = state.hold[fish.category].plus(count);
	state.holdValue = state.holdValue.plus(value);
	state.dex[fish.name] = (state.dex[fish.name] ?? d0()).plus(count);
	state.totalFish = state.totalFish.plus(count);
}

/**
 * Above this many fish in one go, individual rolls stop being worth it and the
 * catch is split across the species by their expected share instead.
 */
const ROLL_LIMIT = 24;

/** Carry-bank keys. Casts and fish are banked per source, species per source. */
function castCarryKey(source: FishingSources): string {
	return `${source}#casts`;
}

function fishCarryKey(source: FishingSources): string {
	return `${source}#fish`;
}

function speciesCarryKey(source: FishingSources, name: string): string {
	return `${source}#${name}`;
}

/**
 * Take whole units out of a fractional amount, banking what is left over.
 *
 * This is what keeps every count in the game an integer while staying exactly
 * unbiased: 1.19 fish per cast pays 1, 1, 1, 1, 1, 2, 1, … and the long-run
 * average is 1.19 to the last digit. No rounding, no RNG, and eight hours of
 * offline progress resolves in one step rather than one step per cast.
 */
export function takeWhole(state: GameState, key: string, amount: Decimal): Decimal {
	if (amount.lte(0)) return d0();

	// Past 2^53 there is no representable fractional part left to bank.
	if (amount.gte(Number.MAX_SAFE_INTEGER)) return amount.floor();

	const banked = state.carry[key] ?? 0;
	const total = amount.toNumber() + banked;
	const whole = Math.floor(total);
	const remainder = total - whole;

	if (remainder > 1e-9) state.carry[key] = remainder;
	else delete state.carry[key];

	return D(whole);
}

/**
 * Turn a fractional number of fish into whole fish of specific species.
 *
 * Small hauls are rolled one fish at a time against the source's weighted
 * table, so a manual cast is a real draw and a rare fish is a real surprise.
 * Large hauls are split across the species by expected share, with the same
 * carry banking applied per species so the counts stay whole. Both paths pay
 * the same amount on average — the only difference is that one has variance
 * and the other does not.
 */
export function distributeCatch(
	state: GameState,
	source: FishingSources,
	fishAmount: Decimal,
	modifiers: Modifiers,
	random: () => number = Math.random
): { caught: Map<Fish, Decimal>; value: Decimal; fish: Decimal } {
	const caught = new Map<Fish, Decimal>();
	let value = d0();
	let landed = d0();

	const whole = takeWhole(state, fishCarryKey(source), fishAmount);
	if (whole.lte(0)) return { caught, value, fish: landed };

	const table = catchTable(source, modifiers.luck);
	const valueMultiplier = SOURCE_CONFIG[source].valueMultiplier;

	const add = (fish: Fish, count: Decimal) => {
		if (count.lte(0)) return;
		const worth = count.times(fishTypeBaseValue[fish.category]).times(valueMultiplier);
		caught.set(fish, (caught.get(fish) ?? d0()).plus(count));
		value = value.plus(worth);
		landed = landed.plus(count);
		recordCatch(state, fish, count, worth);
	};

	if (whole.lte(ROLL_LIMIT)) {
		const rolls = whole.toNumber();
		for (let i = 0; i < rolls; i++) add(table.picker.pick(random()), d1());
		return { caught, value, fish: landed };
	}

	for (const { fish, probability } of table.species) {
		add(fish, takeWhole(state, speciesCarryKey(source, fish.name), whole.times(probability)));
	}

	return { caught, value, fish: landed };
}

/** One manual cast — what the player gets for holding the rod. */
export function performCast(
	state: GameState,
	source: FishingSources,
	modifiers: Modifiers,
	random: () => number = Math.random
): { caught: Map<Fish, Decimal>; value: Decimal; fish: Decimal } {
	const result = distributeCatch(state, source, modifiers.fishPerCast, modifiers, random);
	state.totalCasts = state.totalCasts.plus(1);
	return result;
}

/**
 * Advance the deckhands by `seconds`.
 *
 * Nothing is ticked per entity: each source contributes
 * `casts = crew * castsPerSecond * seconds` in one step. Casts and fish are
 * both banked through `takeWhole`, so a crew landing 0.22 fish a tick produces
 * a whole fish roughly every fifth tick rather than a fifth of a fish every
 * tick.
 */
export function accumulate(
	state: GameState,
	modifiers: Modifiers,
	seconds: number,
	efficiency = 1,
	/** Extra casts per second on top of the crew — used to model the player. */
	extraCastsPerSecond?: Partial<Record<FishingSources, number>>,
	random: () => number = Math.random
): { fish: Decimal; value: Decimal } {
	let fishTotal = d0();
	let valueTotal = d0();

	if (seconds <= 0) return { fish: fishTotal, value: valueTotal };

	for (const source of SOURCE_ORDER) {
		const extra = state.unlocked[source] ? (extraCastsPerSecond?.[source] ?? 0) : 0;
		const castsPerSecond = autoCastsPerSecond(state, modifiers, source).plus(extra);
		if (castsPerSecond.lte(0)) continue;

		const casts = takeWhole(
			state,
			castCarryKey(source),
			castsPerSecond.times(seconds).times(efficiency)
		);
		if (casts.lte(0)) continue;

		const { value, fish } = distributeCatch(
			state,
			source,
			casts.times(modifiers.fishPerCast),
			modifiers,
			random
		);

		state.totalCasts = state.totalCasts.plus(casts);
		fishTotal = fishTotal.plus(fish);
		valueTotal = valueTotal.plus(value);
	}

	return { fish: fishTotal, value: valueTotal };
}

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

export function holdCount(state: GameState): Decimal {
	let total = d0();
	for (const type of FISH_TYPES) total = total.plus(state.hold[type]);
	return total;
}

export function sellHold(state: GameState, modifiers: Modifiers): Decimal {
	if (state.holdValue.lte(0)) {
		for (const type of FISH_TYPES) state.hold[type] = d0();
		return d0();
	}

	const earned = state.holdValue.times(modifiers.sellMultiplier);

	state.coins = state.coins.plus(earned);
	state.lifetimeCoins = state.lifetimeCoins.plus(earned);
	state.allTimeCoins = state.allTimeCoins.plus(earned);
	state.holdValue = d0();
	for (const type of FISH_TYPES) state.hold[type] = d0();

	return earned;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export function nextLockedSource(state: GameState): FishingSources | null {
	for (const source of SOURCE_ORDER) {
		if (!state.unlocked[source]) return source;
	}
	return null;
}

export function canUnlock(state: GameState, source: FishingSources): boolean {
	if (state.unlocked[source]) return false;
	if (nextLockedSource(state) !== source) return false;
	return state.coins.gte(SOURCE_CONFIG[source].unlockCost);
}

export function unlockSource(state: GameState, source: FishingSources): boolean {
	if (!canUnlock(state, source)) return false;
	state.coins = state.coins.minus(SOURCE_CONFIG[source].unlockCost);
	state.unlocked[source] = true;
	state.activeSource = source;
	return true;
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

export function buyUpgrade(state: GameState, id: UpgradeId, count: Decimal | number = 1): Decimal {
	const level = state.upgrades[id];
	const remaining = D(UPGRADES[id].maxLevel).minus(level);
	let amount = Decimal.min(D(count), remaining);
	if (amount.lte(0)) return d0();

	const affordable = affordableUpgradeLevels(id, level, state.coins);
	amount = Decimal.min(amount, affordable);
	if (amount.lte(0)) return d0();

	const cost = upgradeBulkCost(id, level, amount);
	state.coins = state.coins.minus(cost);
	state.upgrades[id] = level.plus(amount);
	return amount;
}

export function buyDeckhand(
	state: GameState,
	source: FishingSources,
	count: Decimal | number = 1
): Decimal {
	if (!state.unlocked[source]) return d0();

	const owned = state.deckhands[source];
	let amount = D(count);
	const affordable = affordableDeckhands(source, owned, state.coins);
	amount = Decimal.min(amount, affordable);
	if (amount.lte(0)) return d0();

	const cost = deckhandBulkCost(source, owned, amount);
	state.coins = state.coins.minus(cost);
	state.deckhands[source] = owned.plus(amount);
	return amount;
}

export function buyPrestigeUpgrade(state: GameState, id: PrestigeUpgradeId): boolean {
	const level = state.prestigeUpgrades[id];
	if (level.gte(PRESTIGE_UPGRADES[id].maxLevel)) return false;

	const cost = prestigeUpgradeCost(id, level);
	if (state.pearls.lt(cost)) return false;

	state.pearls = state.pearls.minus(cost);
	state.prestigeUpgrades[id] = level.plus(1);
	return true;
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

export function pearlsFor(lifetimeCoins: Decimal): Decimal {
	if (lifetimeCoins.lt(PRESTIGE_THRESHOLD)) return d0();
	return lifetimeCoins.div(PRESTIGE_THRESHOLD).pow(PEARL_EXPONENT).floor();
}

export function canPrestige(state: GameState): boolean {
	return state.unlocked[FishingSources.Ocean] && pearlsFor(state.lifetimeCoins).gte(1);
}

export function jellyCaught(state: GameState): Decimal {
	let total = d0();
	for (const fish of Object.values(fishes)) {
		if (fish.category !== FishType.Jelly) continue;
		total = total.plus(state.dex[fish.name] ?? d0());
	}
	return total;
}

export function eroticCaught(state: GameState): Decimal {
	let total = d0();
	for (const fish of Object.values(fishes)) {
		if (fish.category !== FishType.Erotic) continue;
		total = total.plus(state.dex[fish.name] ?? d0());
	}
	return total;
}

/** Species names in catalogue order, for the Fishdex. */
export const ALL_SPECIES: Fish[] = Object.values(fishes);

export const SPECIES_BY_TYPE: Record<FishType, Fish[]> = FISH_TYPES.reduce(
	(acc, type) => {
		acc[type] = ALL_SPECIES.filter((fish) => fish.category === type);
		return acc;
	},
	{} as Record<FishType, Fish[]>
);

export function discoveredCount(state: GameState): number {
	let found = 0;
	for (const fish of ALL_SPECIES) {
		if ((state.dex[fish.name] ?? d0()).gte(1)) found++;
	}
	return found;
}

/**
 * Every discovered species is worth a small permanent bonus to sale value.
 * A full Fishdex is roughly a ×2.4 multiplier.
 */
export const DEX_BONUS_PER_SPECIES = 0.0185;

export function dexMultiplier(state: GameState): Decimal {
	return d1().plus(D(discoveredCount(state)).times(DEX_BONUS_PER_SPECIES));
}

export { fishTypeLabel, UPGRADE_IDS, PRESTIGE_UPGRADE_IDS };

// ---------------------------------------------------------------------------
// Fresh state / prestige reset
// ---------------------------------------------------------------------------

function emptyHold(): Record<FishType, Decimal> {
	return FISH_TYPES.reduce(
		(acc, type) => {
			acc[type] = d0();
			return acc;
		},
		{} as Record<FishType, Decimal>
	);
}

function zeroUpgrades(): Record<UpgradeId, Decimal> {
	return UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = d0();
			return acc;
		},
		{} as Record<UpgradeId, Decimal>
	);
}

function zeroDeckhands(): Record<FishingSources, Decimal> {
	return SOURCE_ORDER.reduce(
		(acc, source) => {
			acc[source] = d0();
			return acc;
		},
		{} as Record<FishingSources, Decimal>
	);
}

function zeroPrestigeUpgrades(): Record<PrestigeUpgradeId, Decimal> {
	return PRESTIGE_UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = d0();
			return acc;
		},
		{} as Record<PrestigeUpgradeId, Decimal>
	);
}

/** How many sources a run opens with, given the Standing Charter level. */
export function startingSourceCount(headstartLevel: Decimal): number {
	return Math.min(SOURCE_ORDER.length, 1 + Math.floor(headstartLevel.toNumber()));
}

function unlockedFor(headstartLevel: Decimal): Record<FishingSources, boolean> {
	const count = startingSourceCount(headstartLevel);
	return SOURCE_ORDER.reduce(
		(acc, source, index) => {
			acc[source] = index < count;
			return acc;
		},
		{} as Record<FishingSources, boolean>
	);
}

export interface CarryOver {
	dex: Record<string, Decimal>;
	pearls: Decimal;
	allTimePearls: Decimal;
	allTimeCoins: Decimal;
	prestigeUpgrades: Record<PrestigeUpgradeId, Decimal>;
	prestigeCount: Decimal;
	achievements: string[];
	completed: boolean;
	jellyJokeSeen: boolean;
	eroticJokeSeen: boolean;
	startedAt: number;
	playTime: number;
	settings: GameState['settings'];
}

export function createInitialState(keep?: Partial<CarryOver>): GameState {
	const now = Date.now();
	const prestigeUpgrades = keep?.prestigeUpgrades ?? zeroPrestigeUpgrades();
	const unlocked = unlockedFor(prestigeUpgrades.pearl_headstart ?? d0());
	const activeSource =
		SOURCE_ORDER.filter((source) => unlocked[source]).pop() ?? FishingSources.Pond;

	return {
		version: SAVE_VERSION,
		coins: d0(),
		lifetimeCoins: d0(),
		allTimeCoins: keep?.allTimeCoins ?? d0(),

		hold: emptyHold(),
		holdValue: d0(),

		dex: keep?.dex ?? {},
		carry: {},
		totalCasts: d0(),
		totalFish: d0(),

		unlocked,
		activeSource,

		upgrades: zeroUpgrades(),
		deckhands: zeroDeckhands(),

		pearls: keep?.pearls ?? d0(),
		allTimePearls: keep?.allTimePearls ?? d0(),
		prestigeUpgrades,
		prestigeCount: keep?.prestigeCount ?? d0(),

		achievements: keep?.achievements ?? [],
		completed: keep?.completed ?? false,
		jellyJokeSeen: keep?.jellyJokeSeen ?? false,
		eroticJokeSeen: keep?.eroticJokeSeen ?? false,

		startedAt: keep?.startedAt ?? now,
		lastUpdate: now,
		playTime: keep?.playTime ?? 0,

		settings: keep?.settings ?? {
			offlineProgress: true,
			reduceMotion: false,
			scientificNotation: false
		}
	};
}

export interface PrestigeResult {
	gained: Decimal;
	firstTime: boolean;
	jellyFree: boolean;
}

/**
 * Cash the run in. Coins, upgrades, deckhands and source unlocks reset; the
 * Fishdex, Pearls, prestige upgrades and achievements survive.
 */
export function performPrestige(state: GameState): PrestigeResult | null {
	if (!canPrestige(state)) return null;

	const gained = pearlsFor(state.lifetimeCoins);
	const firstTime = !state.completed;
	const jellyFree = jellyCaught(state).lt(1);

	const fresh = createInitialState({
		dex: state.dex,
		pearls: state.pearls.plus(gained),
		allTimePearls: state.allTimePearls.plus(gained),
		allTimeCoins: state.allTimeCoins,
		prestigeUpgrades: state.prestigeUpgrades,
		prestigeCount: state.prestigeCount.plus(1),
		achievements: state.achievements,
		completed: true,
		jellyJokeSeen: state.jellyJokeSeen,
		eroticJokeSeen: state.eroticJokeSeen,
		startedAt: state.startedAt,
		playTime: state.playTime,
		settings: state.settings
	});

	Object.assign(state, fresh);
	clearCatchTableCache();

	return { gained, firstTime, jellyFree };
}
