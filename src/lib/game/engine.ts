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
	BOAT_BASE_FUEL_CAPACITY,
	BOAT_BASE_FUEL_PER_CAST,
	BOAT_BASE_WEAR_PER_CAST,
	BOAT_COST,
	BOAT_MIN_EFFICIENCY,
	BOAT_UPGRADES,
	BOAT_UPGRADE_IDS,
	DECKHAND_BASE_EFFICIENCY,
	DECKHAND_COST_GROWTH,
	FUEL_PRICE,
	LICENCES,
	LICENCE_IDS,
	REPAIR_COST_PER_POINT,
	SOURCE_LICENCE,
	needsBoat,
	ASSISTANT_COST,
	AUTO_FISHER,
	BUCKET_BASE_CAPACITY,
	BUCKET_BASE_COST,
	BUCKET_COST_GROWTH,
	BUCKET_GROWTH,
	BUCKET_MAX_LEVEL,
	AUTO_FISHER_OFFLINE_COST,
	BICYCLE_COST,
	TOWN_RATE,
	TOWN_TRIP_SECONDS,
	TRADER_CATALOGUE,
	TRADER_PERIOD_SECONDS,
	TRADER_RATE,
	TRADER_STOCK_SIZE,
	type TraderOfferId,
	AUTO_FISHER_START,
	MIN_CAST_SECONDS,
	PEARL_EXPONENT,
	PEARL_MULTIPLIER_SCALE,
	PRESTIGE_THRESHOLD,
	PRESTIGE_UPGRADES,
	MAP_BASE_COST,
	MAP_BASE_ERROR,
	MAP_BASE_SIGHT,
	MAP_COST_GROWTH,
	MAP_MAX_LEVEL,
	MAX_OFFLINE_SECONDS,
	SHOPKEEPER_REACH,
	PRESTIGE_UPGRADE_IDS,
	SAVE_VERSION,
	SOURCE_CONFIG,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	type BoatUpgradeId,
	type LicenceId,
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

/**
 * The deepest place the player has opened, as an index into `SOURCE_ORDER`.
 *
 * Which shopkeepers they can reach, in other words.
 */
export function deepestOpenIndex(state: GameState): number {
	let best = 0;
	for (let i = 0; i < SOURCE_ORDER.length; i++) {
		if (state.unlocked[SOURCE_ORDER[i]]) best = i;
	}
	return best;
}

/**
 * The highest level of a track anyone the player can reach will sell.
 *
 * Never gates fuel or repairs — `buyFuel` and `repairBoat` do not consult this,
 * deliberately: the standing order buys fuel out of coins inside the offline
 * settle, and a gate there would strand the boat while the player slept.
 */
export function upgradeCeiling(state: GameState, id: UpgradeId): number {
	const reach = SHOPKEEPER_REACH[Math.min(deepestOpenIndex(state), SHOPKEEPER_REACH.length - 1)];
	return Math.floor(UPGRADES[id].maxLevel * reach);
}

/** Where the next tier of a track is sold, or null if it is all available. */
export function upgradeStockedAt(state: GameState, id: UpgradeId): FishingSources | null {
	const ceiling = upgradeCeiling(state, id);
	if (UPGRADES[id].maxLevel <= ceiling) return null;

	for (let i = deepestOpenIndex(state) + 1; i < SOURCE_ORDER.length; i++) {
		if (Math.floor(UPGRADES[id].maxLevel * SHOPKEEPER_REACH[i]) > ceiling) return SOURCE_ORDER[i];
	}
	return null;
}

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
export function affordableUpgradeLevels(
	id: UpgradeId,
	level: Decimal,
	coins: Decimal,
	/** Highest level anyone will sell. Defaults to the track's own maximum. */
	ceiling?: number
): Decimal {
	const config = UPGRADES[id];
	const first = upgradeCost(id, level);
	if (coins.lt(first)) return d0();

	const growth = D(config.costGrowth);
	// n = log_g( 1 + coins * (g - 1) / first )
	const ratio = coins.times(growth.minus(1)).div(first).plus(1);
	const count = Decimal.log10(ratio).div(Decimal.log10(growth)).floor();

	const remaining = D(ceiling ?? config.maxLevel).minus(level);
	return Decimal.max(d0(), Decimal.min(count, remaining));
}

export function autoFisherCost(level: Decimal | number): Decimal {
	return D(AUTO_FISHER.baseCost).times(D(AUTO_FISHER.costGrowth).pow(level));
}

/**
 * What fraction of a human's hold speed the rig manages at this level.
 *
 * Level 1 is `AUTO_FISHER_START`; the top level is exactly 1, by construction
 * rather than by a multiplier that happens to land near it — `x^0` is 1 with
 * no floating-point slack, so "matches a human exactly, never more" is a
 * property of the formula and not of the tuning.
 */
export function autoFisherFraction(level: Decimal | number): number {
	const top = AUTO_FISHER.maxLevel;
	const n = typeof level === 'number' ? level : level.toNumber();
	if (!(n > 0)) return 0;
	if (n >= top) return 1;
	return Math.pow(AUTO_FISHER_START, 1 - (n - 1) / (top - 1));
}

/** Casts a second the rig lands at the water the player is pointing at. */
export function autoFisherCastsPerSecond(state: GameState, modifiers: Modifiers): Decimal {
	const fraction = autoFisherFraction(state.autoFisher);
	if (fraction <= 0) return d0();

	const seconds = modifiers.castSeconds[state.activeSource];
	if (!Number.isFinite(seconds) || seconds <= 0) return d0();

	// A human holding the rod lands one cast every `seconds`. The rig lands the
	// same cast, slower, and at the top level at exactly the same rate.
	return D(fraction / seconds);
}

export function buyAutoFisher(state: GameState): boolean {
	const level = state.autoFisher;
	if (level.gte(AUTO_FISHER.maxLevel)) return false;

	const cost = autoFisherCost(level);
	if (state.coins.lt(cost)) return false;

	state.coins = state.coins.minus(cost);
	state.autoFisher = level.plus(1);
	return true;
}

export function buyAutoFisherOffline(state: GameState): boolean {
	if (state.autoFisherOffline) return false;
	if (state.autoFisher.lte(0)) return false;
	if (state.coins.lt(AUTO_FISHER_OFFLINE_COST)) return false;

	state.coins = state.coins.minus(AUTO_FISHER_OFFLINE_COST);
	state.autoFisherOffline = true;
	return true;
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

/**
 * The passive bonus a banked pile of Pearls is worth: `1 + SCALE * ln(1 + p)`.
 *
 * Logarithmic, deliberately. See `PEARL_MULTIPLIER_SCALE` for what a power law
 * did to the prestige chain.
 */
export function pearlMultiplier(pearls: Decimal): Decimal {
	if (pearls.lte(0)) return d1();
	return pearls.plus(1).ln().times(PEARL_MULTIPLIER_SCALE).plus(1);
}

/**
 * How long the crew keep working after the game is shut, for this player.
 *
 * Eight hours, plus an hour per Night Watch level (R54).
 */
export function offlineSeconds(state: GameState): number {
	return MAX_OFFLINE_SECONDS + state.prestigeUpgrades.pearl_nightwatch.toNumber() * 3600;
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

	// The Pearl bonus applies **once**, on `sellMultiplier`. It used to apply
	// here as well, and income is fish times value, so it was carried squared.
	//
	// `sellMultiplier` is the survivor rather than this one because
	// `fishPerCast` is not only income: it fills the bucket, it feeds
	// `totalFish`, and it drives Fishdex discovery. A pearl bonus here made the
	// bucket meaningless and the Fishdex trivial on every run after the first,
	// neither of which is what the bonus is for.
	const fishPerCast = D(UPGRADES.net.effect).pow(state.upgrades.net);

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

	// A worn boat slows every cast in open water — for the crew and for you.
	const condition = boatEfficiency(state.boat.condition);

	for (const source of SOURCE_ORDER) {
		const drag = needsBoat(source) ? 1 / condition : 1;
		const seconds = Math.max(
			SOURCE_CONFIG[source].castSeconds * speedFactor * drag,
			MIN_CAST_SECONDS
		);
		castSeconds[source] = seconds;
		deckhandCastsPerSecond[source] = (DECKHAND_BASE_EFFICIENCY * crewFactor) / seconds;
	}

	const boat = state.boat;
	const fuelPerCast = D(BOAT_BASE_FUEL_PER_CAST).times(
		D(BOAT_UPGRADES.engine.effect).pow(boat.upgrades.engine)
	);
	const wearPerCast =
		BOAT_BASE_WEAR_PER_CAST * Math.pow(BOAT_UPGRADES.hull.effect, boat.upgrades.hull.toNumber());
	const fuelCapacity = D(BOAT_BASE_FUEL_CAPACITY).times(
		D(BOAT_UPGRADES.tank.effect).pow(boat.upgrades.tank)
	);

	return {
		castSeconds,
		fishPerCast,
		luck,
		sellMultiplier,
		deckhandCastsPerSecond,
		pearlMultiplier: pearlBonus,
		fuelPerCast,
		wearPerCast,
		fuelCapacity,
		boatEfficiency: boatEfficiency(boat.condition)
	};
}

// ---------------------------------------------------------------------------
// Licences and the boat
// ---------------------------------------------------------------------------

/** A neglected boat is slow, never dead. */
export function boatEfficiency(condition: number): number {
	// Everything downstream divides by this, so a NaN here would blank the
	// whole game. Treat anything that is not a number as a wrecked boat.
	if (!Number.isFinite(condition)) return BOAT_MIN_EFFICIENCY;

	const health = Math.max(0, Math.min(100, condition)) / 100;
	return BOAT_MIN_EFFICIENCY + (1 - BOAT_MIN_EFFICIENCY) * health;
}

export function hasLicence(state: GameState, id: LicenceId): boolean {
	return state.licences[id] === true;
}

export function canBuyLicence(state: GameState, id: LicenceId): boolean {
	if (hasLicence(state, id)) return false;
	const required = LICENCES[id].requires;
	if (required && !hasLicence(state, required)) return false;
	return state.coins.gte(LICENCES[id].cost);
}

export function buyLicence(state: GameState, id: LicenceId): boolean {
	if (!canBuyLicence(state, id)) return false;
	state.coins = state.coins.minus(LICENCES[id].cost);
	state.licences[id] = true;
	return true;
}

/** The licence a source needs, if it has not been bought yet. */
export function missingLicence(state: GameState, source: FishingSources): LicenceId | null {
	const required = SOURCE_LICENCE[source];
	if (!required) return null;
	return hasLicence(state, required) ? null : required;
}

export function nextLicence(state: GameState): LicenceId | null {
	for (const id of LICENCE_IDS) {
		if (!hasLicence(state, id)) return id;
	}
	return null;
}

export function buyBoat(state: GameState): boolean {
	if (state.boat.owned || state.coins.lt(BOAT_COST)) return false;
	state.coins = state.coins.minus(BOAT_COST);
	state.boat.owned = true;
	state.boat.condition = 100;
	state.boat.fuel = d0();
	return true;
}

/** The best fit-out the yards the player can reach will sell. */
export function boatUpgradeCeiling(state: GameState, id: BoatUpgradeId): number {
	const reach = SHOPKEEPER_REACH[Math.min(deepestOpenIndex(state), SHOPKEEPER_REACH.length - 1)];
	return Math.floor(BOAT_UPGRADES[id].maxLevel * reach);
}

export function buyBoatUpgrade(state: GameState, id: BoatUpgradeId): boolean {
	if (!state.boat.owned) return false;
	const level = state.boat.upgrades[id];
	if (level.gte(boatUpgradeCeiling(state, id))) return false;

	const cost = boatUpgradeCost(id, level);
	if (state.coins.lt(cost)) return false;

	state.coins = state.coins.minus(cost);
	state.boat.upgrades[id] = level.plus(1);
	return true;
}

export function boatUpgradeCost(id: BoatUpgradeId, level: Decimal | number): Decimal {
	const config = BOAT_UPGRADES[id];
	return D(config.baseCost).times(D(config.costGrowth).pow(level));
}

/** Litres the tank can still take. */
export function fuelRoom(state: GameState, modifiers: Modifiers): Decimal {
	return Decimal.max(d0(), modifiers.fuelCapacity.minus(state.boat.fuel));
}

/** Buy fuel, capped by the tank and by what the player can pay for. */
export function buyFuel(state: GameState, modifiers: Modifiers, litres?: Decimal): Decimal {
	if (!state.boat.owned) return d0();

	const room = fuelRoom(state, modifiers);
	const affordable = state.coins.div(FUEL_PRICE);
	const amount = Decimal.min(litres ?? room, Decimal.min(room, affordable));
	if (amount.lte(0)) return d0();

	state.coins = state.coins.minus(amount.times(FUEL_PRICE));
	state.boat.fuel = state.boat.fuel.plus(amount);
	return amount;
}

export function repairCost(state: GameState): Decimal {
	return D(Math.max(0, 100 - state.boat.condition)).times(REPAIR_COST_PER_POINT);
}

export function repairBoat(state: GameState): boolean {
	if (!state.boat.owned) return false;

	const cost = repairCost(state);
	if (cost.lte(0)) return false;

	if (state.coins.gte(cost)) {
		state.coins = state.coins.minus(cost);
		state.boat.condition = 100;
		return true;
	}

	// Partial repairs, so a short player is never stuck with a broken boat.
	const points = state.coins.div(REPAIR_COST_PER_POINT).toNumber();
	if (points <= 0) return false;
	state.coins = d0();
	state.boat.condition = Math.min(100, state.boat.condition + points);
	return true;
}

export function hasStandingOrder(state: GameState): boolean {
	return state.boat.upgrades.order.gte(1);
}

/**
 * The deepest water the player can actually work right now: unlocked, licensed,
 * and either shore-accessible or reachable with fuel in the tank. This is the
 * fallback whenever the boat cannot sail — the game never simply stops earning.
 */
export function canSail(state: GameState, modifiers: Modifiers): boolean {
	if (!state.boat.owned) return false;
	if (state.boat.fuel.gte(modifiers.fuelPerCast)) return true;

	// With a standing order the tank sitting empty between trips is normal —
	// the yard delivers on demand. What matters is whether it can be paid for.
	return hasStandingOrder(state) && state.coins.gte(modifiers.fuelPerCast.times(FUEL_PRICE));
}

/**
 * The deepest water that can be worked from the shore, boat or no boat.
 *
 * Where casts the boat could not cover go. It deliberately does not consult
 * the tank: `reachableSource` answers "can I sail right now", which changes
 * the moment fuel is burned, so estimating with it before the trip and
 * settling with it after gave two different answers for the same trip.
 */
export function shoreSource(state: GameState): FishingSources {
	for (let i = SOURCE_ORDER.length - 1; i >= 0; i--) {
		const source = SOURCE_ORDER[i];
		if (!state.unlocked[source]) continue;
		if (missingLicence(state, source)) continue;
		if (needsBoat(source)) continue;
		return source;
	}

	// `SOURCE_ORDER[0]` and not a named source: the first source is guaranteed
	// unlocked, licence-free and boat-free, and that invariant is what makes
	// this fallback safe. Spelling it with a literal breaks silently the moment
	// something is prepended.
	return SOURCE_ORDER[0];
}

export function reachableSource(state: GameState, modifiers: Modifiers): FishingSources {
	const sailable = canSail(state, modifiers);

	for (let i = SOURCE_ORDER.length - 1; i >= 0; i--) {
		const source = SOURCE_ORDER[i];
		if (!state.unlocked[source]) continue;
		if (missingLicence(state, source)) continue;
		if (needsBoat(source) && !sailable) continue;
		return source;
	}

	// `SOURCE_ORDER[0]` and not a named source: the first source is guaranteed
	// unlocked, licence-free and boat-free, and that invariant is what makes
	// this fallback safe. Spelling it with a literal breaks silently the moment
	// something is prepended.
	return SOURCE_ORDER[0];
}

/** Whether a source can be worked right now, with the reason if it cannot. */
export function sourceBlocker(
	state: GameState,
	source: FishingSources,
	modifiers?: Modifiers
): 'locked' | 'licence' | 'boat' | 'fuel' | null {
	if (!state.unlocked[source]) return 'locked';
	if (missingLicence(state, source)) return 'licence';
	if (needsBoat(source)) {
		if (!state.boat.owned) return 'boat';
		if (!canSail(state, modifiers ?? computeModifiers(state))) return 'fuel';
	}
	return null;
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
	if (!state.unlocked[source] || missingLicence(state, source)) return d0();
	const crew = state.deckhands[source];
	if (crew.lte(0)) return d0();
	return crew.times(modifiers.deckhandCastsPerSecond[source]);
}

/** Coins per second `casts` at a source are worth, before anything gates them. */
function castIncome(modifiers: Modifiers, source: FishingSources, casts: Decimal): Decimal {
	const table = catchTable(source, modifiers.luck);
	return modifiers.fishPerCast
		.times(casts)
		.times(table.averageSourceValue)
		.times(modifiers.sellMultiplier);
}

/**
 * Coins per second the hold gains from a source, at present rates.
 *
 * Priced through `routeCasts`, so a crew the boat cannot carry is costed where
 * they will actually be working rather than where they were hired.
 */
export function sourceIncomePerSecond(
	state: GameState,
	modifiers: Modifiers,
	source: FishingSources
): Decimal {
	const casts = autoCastsPerSecond(state, modifiers, source);
	if (casts.lte(0)) return d0();

	const route = routeCasts(state, modifiers, source, casts);

	let total = route.sailed.gt(0) ? castIncome(modifiers, source, route.sailed) : d0();
	if (route.stranded.gt(0) && route.fallback !== null) {
		total = total.plus(castIncome(modifiers, route.fallback, route.stranded));
	}
	return total;
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
 * The rig banks its own remainders. Sharing the crew's key would pool two
 * producers running at different rates into one bank, so neither would be
 * separately accountable — and the whole point of the banking model is that
 * every producer's fractional casts are owed to that producer.
 */
const AUTO_FISHER_CARRY_KEY = 'autofisher#casts';

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
	random: () => number = Math.random,
	/**
	 * Fish the hold can still take. `undefined` means unlimited, which is what
	 * every caller that does not care about the bucket passes.
	 */
	room?: Decimal | null
): { caught: Map<Fish, Decimal>; value: Decimal; fish: Decimal } {
	const caught = new Map<Fish, Decimal>();
	let value = d0();
	let landed = d0();

	// Clamp BEFORE `takeWhole`, never trim after it.
	//
	// `takeWhole` mutates `state.carry` — it banks the incoming fraction and
	// hands back the whole part. Letting it run and then discarding the result
	// spends the banked fraction and loses the fish with no credit anywhere.
	// Clamping the input keeps the bank honest: what is not caught is not
	// banked either.
	const wanted = room === undefined || room === null ? fishAmount : Decimal.min(fishAmount, room);
	if (wanted.lte(0)) return { caught, value, fish: landed };

	const whole = takeWhole(state, fishCarryKey(source), wanted);
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

/**
 * Spend fuel and condition for `casts` in open water, and report how many of
 * them the boat could actually make.
 *
 * A short tank does not stop the game: the casts it cannot cover come back as
 * a shortfall, and the caller works them inshore instead.
 */
export function runBoat(
	state: GameState,
	modifiers: Modifiers,
	casts: Decimal
): { sailed: Decimal; shortfall: Decimal } {
	if (!state.boat.owned) return { sailed: d0(), shortfall: casts };

	const available = fuelForTrip(state, modifiers, casts);
	const buying = available.minus(state.boat.fuel);
	if (buying.gt(0)) {
		state.coins = state.coins.minus(buying.times(FUEL_PRICE));
		state.boat.fuel = available;
	}

	const sailed = Decimal.min(casts, castsFromFuel(state.boat.fuel, modifiers));
	if (sailed.lte(0)) return { sailed: d0(), shortfall: casts };

	state.boat.fuel = Decimal.max(d0(), state.boat.fuel.minus(sailed.times(modifiers.fuelPerCast)));
	state.boat.condition = Math.max(
		0,
		state.boat.condition - sailed.times(modifiers.wearPerCast).toNumber()
	);

	return { sailed, shortfall: casts.minus(sailed) };
}

/**
 * Fuel the boat would have in the tank for a trip of `casts`, buying on the
 * standing order if it has one.
 *
 * Split out of `runBoat` so the estimator can ask the same question without
 * spending anything. A standing order is a delivery, not a tank top-up: the
 * yard supplies what the trip needs and bills for it. Capping it at tank
 * capacity would leave a large crew running dry every few minutes despite the
 * most expensive fit-out in the game already being paid for. The hair of
 * margin is load-bearing — without it, dividing the exact amount back out and
 * flooring strands the last cast of every trip.
 */
function fuelForTrip(state: GameState, modifiers: Modifiers, casts: Decimal): Decimal {
	if (!hasStandingOrder(state)) return state.boat.fuel;

	const needed = casts.times(modifiers.fuelPerCast).times(1.0001).plus(1).minus(state.boat.fuel);
	if (needed.lte(0)) return state.boat.fuel;

	const buying = Decimal.min(needed, state.coins.div(FUEL_PRICE));
	return buying.gt(0) ? state.boat.fuel.plus(buying) : state.boat.fuel;
}

/** Whole casts a tank of `fuel` covers. */
function castsFromFuel(fuel: Decimal, modifiers: Modifiers): Decimal {
	if (modifiers.fuelPerCast.lte(0)) return fuel;
	return fuel.div(modifiers.fuelPerCast).floor();
}

/** Where a source's casts actually get worked. */
export interface CastRouting {
	/** Casts worked at the source that was asked for. */
	sailed: Decimal;
	/** Casts the boat could not cover. */
	stranded: Decimal;
	/** Where the stranded casts go instead, or null if there is nowhere. */
	fallback: FishingSources | null;
}

/**
 * The one place that decides where a source's casts are worked.
 *
 * `accumulate` burns the fuel and works the shortfall inshore;
 * `sourceIncomePerSecond` has to reach the same answer without spending
 * anything. They used to decide it separately, and the estimator never checked
 * the boat at all — advertising up to 25x what an unfuelled open-water crew
 * were actually landing, in the state you are in the moment you buy the boat.
 * Both go through here now, so they cannot drift apart again.
 */
export function routeCasts(
	state: GameState,
	modifiers: Modifiers,
	source: FishingSources,
	casts: Decimal,
	/** Burn the fuel and wear the hull. Estimates leave this false. */
	spend = false
): CastRouting {
	if (!needsBoat(source) || casts.lte(0)) {
		return { sailed: casts, stranded: d0(), fallback: null };
	}

	let sailed: Decimal;
	if (spend) {
		sailed = runBoat(state, modifiers, casts).sailed;
	} else if (!state.boat.owned) {
		sailed = d0();
	} else {
		sailed = Decimal.max(
			d0(),
			Decimal.min(casts, castsFromFuel(fuelForTrip(state, modifiers, casts), modifiers))
		);
	}

	const stranded = casts.minus(sailed);
	if (stranded.lte(0)) return { sailed, stranded: d0(), fallback: null };

	return { sailed, stranded, fallback: shoreSource(state) };
}

/** One manual cast — what the player gets for holding the rod. */
export function performCast(
	state: GameState,
	source: FishingSources,
	modifiers: Modifiers,
	random: () => number = Math.random
): { caught: Map<Fish, Decimal>; value: Decimal; fish: Decimal; source: FishingSources } {
	const route = routeCasts(state, modifiers, source, d1(), true);
	const working = route.sailed.gt(0) ? source : (route.fallback ?? source);

	const result = distributeCatch(
		state,
		working,
		modifiers.fishPerCast,
		modifiers,
		random,
		holdRoom(state)
	);
	state.totalCasts = state.totalCasts.plus(1);
	return { ...result, source: working };
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
	random: () => number = Math.random,
	/**
	 * How much of this interval the auto-fisher was working, 0 to 1. It stands
	 * down while the player holds the rod themselves (0), runs the whole
	 * interval when they are not (1), and offline it is whatever the offline
	 * purchase allows.
	 */
	autoFisherShare = 1,
	/**
	 * How many bucketfuls the hold may take for this interval. Always 1 while
	 * the player is watching; `OFFLINE_HOLD_MULTIPLIER` for a night away, where
	 * the keepnet goes in the water and nobody is emptying it (R51).
	 */
	holdMultiplier: Decimal | number = 1
): { fish: Decimal; value: Decimal; fellBack: boolean; bucketBound: boolean } {
	let fishTotal = d0();
	let valueTotal = d0();
	let fellBack = false;
	/** True once the bucket, rather than the crew, decided the catch. */
	let bucketBound = false;

	if (seconds <= 0) return { fish: fishTotal, value: valueTotal, fellBack, bucketBound };

	/**
	 * Room for `want` fish, noting when there was not enough of it.
	 *
	 * Every clamp in this function goes through here, so "the bucket stopped
	 * you" is decided by the same arithmetic that does the stopping rather than
	 * by inspecting the leftovers afterwards — the bulk catch path banks
	 * per-species remainders, so a bucket that is genuinely full still reads a
	 * few fish short of its capacity.
	 */
	const roomFor = (want: Decimal): Decimal | null => {
		const room = holdRoom(state, holdMultiplier);
		if (room !== null && room.lt(want)) bucketBound = true;
		return room;
	};

	// Which water gets the room when there is not enough of it.
	//
	// `SOURCE_ORDER` runs cheapest first, so a bucket-limited crew filled the
	// bucket with mud pool fish and the open-water crew landed nothing — the
	// deeper the water you had bought your way into, the less of it you came
	// back to. When the bucket binds, the best water is worked first and the
	// shallows get whatever is left, which is what a fisherman with one bucket
	// does. With an Assistant there is no bucket and the order cannot matter.
	const order =
		holdRoom(state, holdMultiplier) === null ? SOURCE_ORDER : [...SOURCE_ORDER].reverse();

	for (const source of order) {
		// A full bucket stops the work before it starts. This has to be checked
		// here, at the top, rather than at the catch: below this line the loop
		// mints casts through `takeWhole` and `runBoat` burns fuel and hull
		// condition, all of which would be spent on a fish there is nowhere to
		// put.
		const room = holdRoom(state, holdMultiplier);
		if (room !== null && room.lte(0)) {
			bucketBound = true;
			break;
		}

		// Unlicensed water pays nothing, however it came to be unlocked. Without
		// this, `accumulate` and `reachableSource` disagree about where the crew
		// are allowed to work.
		if (missingLicence(state, source)) continue;

		const extra = state.unlocked[source] ? (extraCastsPerSecond?.[source] ?? 0) : 0;
		const castsPerSecond = autoCastsPerSecond(state, modifiers, source).plus(extra);
		if (castsPerSecond.lte(0)) continue;

		const casts = takeWhole(
			state,
			castCarryKey(source),
			castsPerSecond.times(seconds).times(efficiency)
		);
		if (casts.lte(0)) continue;

		const route = routeCasts(state, modifiers, source, casts, true);

		if (route.sailed.gt(0)) {
			const { value, fish } = distributeCatch(
				state,
				source,
				route.sailed.times(modifiers.fishPerCast),
				modifiers,
				random,
				roomFor(route.sailed.times(modifiers.fishPerCast))
			);
			fishTotal = fishTotal.plus(fish);
			valueTotal = valueTotal.plus(value);
		}

		// Whatever the boat could not cover is worked from the shore instead.
		if (route.stranded.gt(0) && route.fallback !== null) {
			const { value, fish } = distributeCatch(
				state,
				route.fallback,
				route.stranded.times(modifiers.fishPerCast),
				modifiers,
				random,
				roomFor(route.stranded.times(modifiers.fishPerCast))
			);
			fishTotal = fishTotal.plus(fish);
			valueTotal = valueTotal.plus(value);
			fellBack = true;
		}

		state.totalCasts = state.totalCasts.plus(casts);
	}

	// The rig works the water the player is pointing at, not a source of its
	// own, and it is routed and priced through exactly the same path a manual
	// cast takes — so a rig cast and a hand cast at the same rate pay the same.
	if (autoFisherShare > 0) {
		const source = state.activeSource;
		const perSecond = autoFisherCastsPerSecond(state, modifiers);
		const rigRoom = holdRoom(state, holdMultiplier);

		if (
			perSecond.gt(0) &&
			state.unlocked[source] &&
			!missingLicence(state, source) &&
			(rigRoom === null || rigRoom.gt(0))
		) {
			const casts = takeWhole(
				state,
				AUTO_FISHER_CARRY_KEY,
				perSecond.times(seconds).times(efficiency).times(autoFisherShare)
			);

			if (casts.gt(0)) {
				const route = routeCasts(state, modifiers, source, casts, true);

				if (route.sailed.gt(0)) {
					const { value, fish } = distributeCatch(
						state,
						source,
						route.sailed.times(modifiers.fishPerCast),
						modifiers,
						random,
						roomFor(route.sailed.times(modifiers.fishPerCast))
					);
					fishTotal = fishTotal.plus(fish);
					valueTotal = valueTotal.plus(value);
				}

				if (route.stranded.gt(0) && route.fallback !== null) {
					const { value, fish } = distributeCatch(
						state,
						route.fallback,
						route.stranded.times(modifiers.fishPerCast),
						modifiers,
						random,
						roomFor(route.stranded.times(modifiers.fishPerCast))
					);
					fishTotal = fishTotal.plus(fish);
					valueTotal = valueTotal.plus(value);
					fellBack = true;
				}

				state.totalCasts = state.totalCasts.plus(casts);
			}
		}
	}

	return { fish: fishTotal, value: valueTotal, fellBack, bucketBound };
}

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

export function holdCount(state: GameState): Decimal {
	let total = d0();
	for (const type of FISH_TYPES) total = total.plus(state.hold[type]);
	return total;
}

/**
 * Empty the hold for coins.
 *
 * `rate` is who is buying: `TRADER_RATE` for a passing trader, `TOWN_RATE` for
 * riding in and selling it yourself. It defaults to the full price so every
 * existing caller — and every existing test — keeps its old meaning.
 */
export function sellHold(state: GameState, modifiers: Modifiers, rate = TOWN_RATE): Decimal {
	if (state.holdValue.lte(0)) {
		for (const type of FISH_TYPES) state.hold[type] = d0();
		return d0();
	}

	const earned = state.holdValue.times(modifiers.sellMultiplier).times(rate);

	state.coins = state.coins.plus(earned);
	state.lifetimeCoins = state.lifetimeCoins.plus(earned);
	state.allTimeCoins = state.allTimeCoins.plus(earned);
	state.holdValue = d0();
	for (const type of FISH_TYPES) state.hold[type] = d0();

	return earned;
}

/**
 * How many fish are set aside on the quay for the merchant.
 *
 * Deliberately not part of `holdCount`: listed fish have left the bucket, and
 * counting them again would give the room back with one hand and take it away
 * with the other.
 */
export function consignmentCount(state: GameState): Decimal {
	let total = d0();
	for (const type of FISH_TYPES) total = total.plus(state.consignment[type]);
	return total;
}

/**
 * Room left on the quay, or `null` when nothing limits it.
 *
 * The merchant's cart is the same size as your bucket, and the two grow
 * together. Without a limit, listing would defeat the bucket outright — you
 * would list every fish as it landed, the bucket would never fill, and the
 * trader, the bicycle and the Assistant would all lose the thing they exist to
 * solve. With one, listing genuinely doubles what you can hold at once, which
 * is a reward for engaging with the merchant rather than a way around him.
 *
 * An Assistant sells on the spot, so there is never a consignment to limit.
 */
export function consignmentRoom(state: GameState): Decimal | null {
	if (state.hasAssistant) return null;
	return Decimal.max(d0(), bucketCapacity(state.bucketLevel).minus(consignmentCount(state)));
}

/**
 * Move fish out of the bucket and onto the quay for the merchant (R65).
 *
 * Value moves with them, in proportion, so the two ledgers can never drift.
 * Returns how many fish were actually listed — the cart may be fuller than the
 * caller thinks.
 */
export function listForSale(state: GameState, count?: Decimal): Decimal {
	const held = holdCount(state);
	if (held.lte(0)) return d0();

	const room = consignmentRoom(state);
	let wanted = count === undefined ? held : Decimal.min(count, held);
	if (room !== null) wanted = Decimal.min(wanted, room);
	if (wanted.lte(0)) return d0();

	const fraction = wanted.div(held);
	let listed = d0();

	for (const type of FISH_TYPES) {
		const moving = state.hold[type].times(fraction);
		if (moving.lte(0)) continue;
		state.hold[type] = Decimal.max(d0(), state.hold[type].minus(moving));
		state.consignment[type] = state.consignment[type].plus(moving);
		listed = listed.plus(moving);
	}

	const movingValue = state.holdValue.times(fraction);
	state.holdValue = Decimal.max(d0(), state.holdValue.minus(movingValue));
	state.consignmentValue = state.consignmentValue.plus(movingValue);

	return listed;
}

/**
 * Pay out the consignment.
 *
 * **Priced here, not at listing.** A consignment is settled at whatever the
 * catch is worth when the money changes hands, which is what makes the
 * merchant's arrival a wait with a consequence rather than a locked-in receipt.
 */
export function settleConsignment(
	state: GameState,
	modifiers: Modifiers,
	rate = TOWN_RATE
): Decimal {
	if (state.consignmentValue.lte(0)) {
		for (const type of FISH_TYPES) state.consignment[type] = d0();
		return d0();
	}

	const earned = state.consignmentValue.times(modifiers.sellMultiplier).times(rate);

	state.coins = state.coins.plus(earned);
	state.lifetimeCoins = state.lifetimeCoins.plus(earned);
	state.allTimeCoins = state.allTimeCoins.plus(earned);
	state.consignmentValue = d0();
	for (const type of FISH_TYPES) state.consignment[type] = d0();

	return earned;
}

/**
 * The Sell button. There is always one (R65).
 *
 * With an Assistant it is a sale: everything goes at once, at full price,
 * without leaving the water. Without one it is a *listing* — the fish go onto
 * the quay for the travelling merchant, out of the bucket immediately, and the
 * coins arrive when he does. What the player decides is now *what* to list and
 * *when*; the merchant is the delay rather than the decision.
 */
export function sell(state: GameState, modifiers: Modifiers): { sold: Decimal; listed: Decimal } {
	if (state.hasAssistant) {
		return { sold: sellHold(state, modifiers, saleRate(state)), listed: d0() };
	}
	return { sold: d0(), listed: listForSale(state) };
}

export function bucketCapacity(level: Decimal | number): Decimal {
	return D(BUCKET_BASE_CAPACITY).times(D(BUCKET_GROWTH).pow(level));
}

export function bucketCost(level: Decimal | number): Decimal {
	return D(BUCKET_BASE_COST).times(D(BUCKET_COST_GROWTH).pow(level));
}

/**
 * How many more fish will fit, or `null` when nothing limits it.
 *
 * `null` rather than a very large number so the limit can be switched off
 * outright: an Assistant minds the catch, so there is no bucket to fill.
 */
export function holdRoom(state: GameState, multiplier: Decimal | number = 1): Decimal | null {
	if (state.hasAssistant) return null;
	const cap = bucketCapacity(state.bucketLevel).times(multiplier);
	return Decimal.max(d0(), cap.minus(holdCount(state)));
}

export function buyBucket(state: GameState): boolean {
	const level = state.bucketLevel;
	if (level.gte(BUCKET_MAX_LEVEL)) return false;
	if (!traderInStock(state, 'bucket')) return false;

	const cost = bucketCost(level);
	if (state.coins.lt(cost)) return false;

	state.coins = state.coins.minus(cost);
	state.bucketLevel = level.plus(1);
	return true;
}

/**
 * What the player gets per coin of catch right now.
 *
 * The Assistant counts as transport on its own. It is sold as "no trip, no
 * cooldown, full price", and with the trader now guarded behind it (R63) a
 * player who bought the Assistant before the bicycle would otherwise have no
 * buyer at all — the trader stops coming and `rideToTown` refuses.
 */
export function saleRate(state: GameState): number {
	return state.hasBicycle || state.hasAssistant ? TOWN_RATE : TRADER_RATE;
}

/** Is there anyone at all who will buy the catch right now? */
export function canSell(state: GameState): boolean {
	return state.hasBicycle || state.hasAssistant;
}

/** Is manual casting currently refused because you are in town? */
export function inTown(state: GameState, now = Date.now()): boolean {
	return !state.hasAssistant && state.fishingBlockedUntil > now;
}

/** Seconds left of the trip, for the UI. */
export function townSecondsLeft(state: GameState, now = Date.now()): number {
	if (!inTown(state, now)) return 0;
	return (state.fishingBlockedUntil - now) / 1000;
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

export function mapCost(level: Decimal | number): Decimal {
	return D(MAP_BASE_COST).times(D(MAP_COST_GROWTH).pow(level));
}

/** 0 on the worst chart, 1 on the best. */
export function mapAccuracy(level: Decimal | number): number {
	const n = typeof level === 'number' ? level : level.toNumber();
	return Math.min(1, Math.max(0, n / MAP_MAX_LEVEL));
}

/** How far a place can be drawn from where it really is. */
export function mapError(level: Decimal | number): number {
	return MAP_BASE_ERROR * (1 - mapAccuracy(level));
}

/** How many locked places are drawn beyond the deepest one open. */
export function mapSight(level: Decimal | number): number {
	const n = typeof level === 'number' ? level : level.toNumber();
	return MAP_BASE_SIGHT + Math.floor(n);
}

/**
 * How far this place is drawn from where it actually is.
 *
 * Derived from `startedAt`, which survives prestige, so a chart is wrong in the
 * same way every time you look at it instead of reshuffling on every render.
 * A map you cannot learn is not a map.
 */
export function mapOffset(
	source: FishingSources,
	startedAt: number,
	level: Decimal | number
): { dx: number; dy: number } {
	const error = mapError(level);
	if (error <= 0) return { dx: 0, dy: 0 };

	// A cheap deterministic hash of the save's birthday and the place's name.
	let hash = Math.floor(startedAt / 1000) >>> 0;
	for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;

	const angle = ((hash % 1000) / 1000) * Math.PI * 2;
	const radius = (((hash >>> 10) % 1000) / 1000) * error;
	return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

/**
 * Which places the chart draws.
 *
 * Everything already unlocked, always — hiding somewhere the player owns would
 * strand them if the map is their only way to move — plus the next few locked
 * ones, as far as the paper reaches.
 */
export function chartedSources(state: GameState): FishingSources[] {
	const deepest = deepestOpenIndex(state);
	const sight = mapSight(state.mapLevel);

	return SOURCE_ORDER.filter((source, index) => state.unlocked[source] || index <= deepest + sight);
}

export function buyMapUpgrade(state: GameState): boolean {
	const level = state.mapLevel;
	if (level.gte(MAP_MAX_LEVEL)) return false;

	const cost = mapCost(level);
	if (state.coins.lt(cost)) return false;

	state.coins = state.coins.minus(cost);
	state.mapLevel = level.plus(1);
	return true;
}

// ---------------------------------------------------------------------------
// The trader
// ---------------------------------------------------------------------------

/** Is this offer still worth showing? */
export function traderOfferOpen(state: GameState, id: TraderOfferId): boolean {
	if (id === 'bicycle') return !state.hasBicycle;
	if (id === 'assistant') return !state.hasAssistant;
	return !state.hasAssistant && state.bucketLevel.lt(BUCKET_MAX_LEVEL);
}

/**
 * What the current trader is carrying.
 *
 * Rotates with the visit count, so an offer you want may be a visit or two
 * away. That is the one thing a vendor adds over a price tag — a wait you
 * cannot buy through — and it is bounded by the arrival period rather than by
 * luck. When two or fewer offers are still open they are all in stock, so the
 * opening can never stall waiting for the bicycle.
 */
export function traderStock(state: GameState): TraderOfferId[] {
	const open = TRADER_CATALOGUE.filter((id) => traderOfferOpen(state, id));
	if (open.length <= TRADER_STOCK_SIZE) return open;

	const start = ((state.traderVisits % open.length) + open.length) % open.length;
	return Array.from({ length: TRADER_STOCK_SIZE }, (_, i) => open[(start + i) % open.length]);
}

export function traderInStock(state: GameState, id: TraderOfferId): boolean {
	return traderStock(state).includes(id);
}

/** Seconds until the next trader, for the progress bar. */
export function traderSecondsLeft(state: GameState, now = Date.now()): number {
	if (state.nextTraderAt <= 0) return TRADER_PERIOD_SECONDS;
	return Math.max(0, (state.nextTraderAt - now) / 1000);
}

/** 0 to 1 across one arrival period. */
export function traderProgress(state: GameState, now = Date.now()): number {
	const left = traderSecondsLeft(state, now);
	return Math.min(1, Math.max(0, 1 - left / TRADER_PERIOD_SECONDS));
}

/**
 * Resolve every trader arrival due by `now`.
 *
 * Each arrival buys the whole hold at the trader's rate and rotates the stock.
 * Catching up on a long absence is `floor(gap / period)` arrivals, resolved by
 * walking the deadline forward rather than by sampling the clock — so a
 * settle that happens in twenty-four chunks and one that happens in a single
 * step both resolve the same number of visits.
 */
export function runTrader(
	state: GameState,
	modifiers: Modifiers,
	now = Date.now()
): { visits: number; earned: Decimal } {
	let earned = d0();
	let visits = 0;

	// Once there is an Assistant the trader stops buying (R63).
	//
	// He kept arriving every forty-five seconds and taking the whole hold at
	// `TRADER_RATE`, while `saleRate` told that same player they were getting
	// `TOWN_RATE` — so the most expensive purchase of the opening act made the
	// player 45% poorer per fish and nothing said so. The guard lives here, in
	// the one place the visit is resolved, so no caller can forget it.
	if (state.hasAssistant) {
		// Keep the appointment moving so shelving the Assistant is not a windfall.
		if (state.nextTraderAt > 0) {
			const period = TRADER_PERIOD_SECONDS * 1000;
			while (state.nextTraderAt <= now) state.nextTraderAt += period;
		}
		return { visits, earned };
	}

	// A fresh save has no appointment yet; make one and let it come round.
	if (state.nextTraderAt <= 0) {
		state.nextTraderAt = now + TRADER_PERIOD_SECONDS * 1000;
		return { visits, earned };
	}

	const period = TRADER_PERIOD_SECONDS * 1000;
	while (state.nextTraderAt <= now) {
		// He settles what was *listed* for him, and nothing else (R65). Taking
		// the whole hold on arrival was the game making the decision; now the
		// player makes it, and he is only the wait.
		earned = earned.plus(settleConsignment(state, modifiers, TRADER_RATE));
		state.traderVisits += 1;
		state.nextTraderAt += period;
		visits += 1;
	}

	return { visits, earned };
}

export function buyBicycle(state: GameState): boolean {
	if (state.hasBicycle) return false;
	if (!traderInStock(state, 'bicycle')) return false;
	if (state.coins.lt(BICYCLE_COST)) return false;

	state.coins = state.coins.minus(BICYCLE_COST);
	state.hasBicycle = true;
	return true;
}

export function buyAssistant(state: GameState): boolean {
	if (state.hasAssistant) return false;
	if (!traderInStock(state, 'assistant')) return false;
	if (state.coins.lt(ASSISTANT_COST)) return false;

	state.coins = state.coins.minus(ASSISTANT_COST);
	state.hasAssistant = true;
	// Whatever trip was in progress is over — that is what hiring help buys.
	state.fishingBlockedUntil = 0;
	return true;
}

/**
 * Ride into town, sell the whole hold at full price, and stay off the water
 * until you are back.
 *
 * The crew keep working throughout: the cooldown is manual-only, and
 * `accumulate` never consults it.
 */
export function rideToTown(
	state: GameState,
	modifiers: Modifiers,
	now = Date.now()
): { earned: Decimal; until: number } | null {
	if (!canSell(state)) return null;
	if (inTown(state, now)) return null;

	// You load the cart with everything you have — the bucket and whatever is
	// already sitting on the quay. Listing is therefore never a trap: if the
	// merchant has not been yet, you can still take it in yourself for the full
	// price. What listing costs you is the race against his next arrival.
	const earned = sellHold(state, modifiers, TOWN_RATE).plus(
		settleConsignment(state, modifiers, TOWN_RATE)
	);

	// The Assistant does the trip for you, so there is nothing to wait for.
	const until = state.hasAssistant ? 0 : now + TOWN_TRIP_SECONDS * 1000;
	state.fishingBlockedUntil = until;

	return { earned, until };
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
	if (missingLicence(state, source)) return false;
	if (needsBoat(source) && !state.boat.owned) return false;
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
	// The gate lives here, in the engine, and not in the panel. Put it in the
	// component and `affordableUpgradeLevels` goes on offering "buy 14" for
	// something the purchase then refuses.
	const ceiling = upgradeCeiling(state, id);
	const remaining = D(ceiling).minus(level);
	let amount = Decimal.min(D(count), remaining);
	if (amount.lte(0)) return d0();

	const affordable = affordableUpgradeLevels(id, level, state.coins, ceiling);
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

function freshBoat(): GameState['boat'] {
	return {
		owned: false,
		fuel: d0(),
		condition: 100,
		upgrades: BOAT_UPGRADE_IDS.reduce(
			(acc, id) => {
				acc[id] = d0();
				return acc;
			},
			{} as Record<BoatUpgradeId, Decimal>
		)
	};
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

/**
 * Licences reset with the run — they belonged to the operation you sold. But
 * the Standing Charter cannot hand you water you are not allowed to fish, so
 * anything it opens comes with the paperwork already done.
 */
function licencesFor(unlocked: Record<FishingSources, boolean>): Record<LicenceId, boolean> {
	return LICENCE_IDS.reduce(
		(acc, id) => {
			acc[id] = LICENCES[id].covers.some((source) => unlocked[source]);
			return acc;
		},
		{} as Record<LicenceId, boolean>
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

	// A fresh run has no boat, so never start the player standing over water
	// they cannot work.
	const activeSource =
		SOURCE_ORDER.filter((source) => unlocked[source] && !needsBoat(source)).pop() ??
		SOURCE_ORDER[0];

	return {
		version: SAVE_VERSION,
		coins: d0(),
		lifetimeCoins: d0(),
		allTimeCoins: keep?.allTimeCoins ?? d0(),

		hold: emptyHold(),
		holdValue: d0(),
		consignment: emptyHold(),
		consignmentValue: d0(),

		dex: keep?.dex ?? {},
		carry: {},
		totalCasts: d0(),
		totalFish: d0(),

		unlocked,
		activeSource,

		licences: licencesFor(unlocked),
		boat: freshBoat(),

		upgrades: zeroUpgrades(),
		deckhands: zeroDeckhands(),
		// Everything below is bought with coins, so it goes the way every coin
		// purchase goes on a reset.
		nextTraderAt: 0,
		traderVisits: 0,
		mapLevel: d0(),
		bucketLevel: d0(),
		hasBicycle: false,
		fishingBlockedUntil: 0,
		hasAssistant: false,
		autoFisher: d0(),
		autoFisherOffline: false,

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

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'exotic' | 'mythic';

/** Ordered commonest first, so the UI can compare two catches. */
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'exotic', 'mythic'];

export const RARITY_LABEL: Record<Rarity, string> = {
	common: 'Common',
	uncommon: 'Uncommon',
	rare: 'Rare',
	exotic: 'Exotic',
	mythic: 'One in a million'
};

/**
 * How special a catch is, from how likely it was *in the water it came from*.
 * A Guppy is common in the Pond; a Whale Shark is not common anywhere.
 */
export function rarityOf(probability: number): Rarity {
	if (probability >= 0.12) return 'common';
	if (probability >= 0.045) return 'uncommon';
	if (probability >= 0.012) return 'rare';
	if (probability >= 0.0008) return 'exotic';
	return 'mythic';
}

export function speciesProbability(source: FishingSources, luck: number, name: string): number {
	const table = catchTable(source, luck);
	return table.species.find((entry) => entry.fish.name === name)?.probability ?? 0;
}

export function rarityAt(source: FishingSources, luck: number, name: string): Rarity {
	return rarityOf(speciesProbability(source, luck, name));
}
