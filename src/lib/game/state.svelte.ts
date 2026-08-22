import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, fishTypeBaseValue } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { Fish } from '$lib/fishes/fish';
import {
	AUTOSAVE_MS,
	MAX_OFFLINE_SECONDS,
	OFFLINE_EFFICIENCY,
	SOURCE_CONFIG,
	TICK_MS,
	UPGRADES,
	type UpgradeId
} from './config';
import {
	accumulate,
	affordableDeckhands,
	affordableUpgradeLevels,
	buyDeckhand,
	buyPrestigeUpgrade,
	buyUpgrade,
	canPrestige,
	computeModifiers,
	createInitialState,
	discoveredCount,
	eroticCaught,
	holdCount,
	jellyCaught,
	performCast,
	performPrestige,
	sellHold,
	totalIncomePerSecond,
	unlockSource,
	type PrestigeResult
} from './engine';
import { evaluateAchievements } from './achievements';
import { exportSave, importSave, loadFromStorage, saveToStorage } from './save';
import type { GameState, Modifiers, OfflineReport } from './types';

export type BuyAmount = 1 | 10 | 25 | 'max';

export const BUY_AMOUNTS: BuyAmount[] = [1, 10, 25, 'max'];

export interface CastFeedback {
	id: number;
	fish: Fish;
	count: Decimal;
	value: Decimal;
}

/**
 * The whole game lives behind this one object.
 *
 * Everything reactive hangs off `state`; `modifiers` is derived from it and
 * recomputed only when something it reads actually changes.
 */
class Game {
	state = $state<GameState>(createInitialState());

	/** 0 → 1 progress of the cast currently in the water. */
	castProgress = $state(0);
	casting = $state(false);

	/** The most recent catches, newest first — the catch ticker. */
	recentCatches = $state<CastFeedback[]>([]);

	offlineReport = $state<OfflineReport | null>(null);
	prestigeResult = $state<PrestigeResult | null>(null);
	newlyUnlockedSpecies = $state<Fish[]>([]);
	newAchievements = $state<string[]>([]);
	/** The Lovestruck Lipfish reveal — fires once, ever. */
	lipfishReveal = $state(false);

	loaded = $state(false);

	/** How many levels the buy buttons purchase at once. */
	buyAmount = $state<BuyAmount>(1);

	modifiers = $derived<Modifiers>(computeModifiers(this.state));
	incomePerSecond = $derived(totalIncomePerSecond(this.state, this.modifiers));
	holdSize = $derived(holdCount(this.state));
	discovered = $derived(discoveredCount(this.state));
	jelly = $derived(jellyCaught(this.state));
	erotic = $derived(eroticCaught(this.state));
	prestigeReady = $derived(canPrestige(this.state));
	activeCastSeconds = $derived(this.modifiers.castSeconds[this.state.activeSource]);

	#tickHandle: ReturnType<typeof setInterval> | undefined;
	#saveHandle: ReturnType<typeof setInterval> | undefined;
	#frameHandle: number | undefined;
	#castStartedAt = 0;
	#feedbackId = 0;

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	/** Load the save (if any), settle offline earnings, and start ticking. */
	init(): void {
		if (this.loaded) return;

		const saved = loadFromStorage();
		if (saved) {
			this.state = saved;
			this.offlineReport = this.#settleOffline(saved);
		}

		this.state.lastUpdate = Date.now();
		this.loaded = true;
		this.start();
	}

	start(): void {
		if (this.#tickHandle !== undefined) return;

		this.#tickHandle = setInterval(() => this.tick(), TICK_MS);
		this.#saveHandle = setInterval(() => this.save(), AUTOSAVE_MS);
	}

	stop(): void {
		if (this.#tickHandle !== undefined) clearInterval(this.#tickHandle);
		if (this.#saveHandle !== undefined) clearInterval(this.#saveHandle);
		if (this.#frameHandle !== undefined) cancelAnimationFrame(this.#frameHandle);
		this.#tickHandle = undefined;
		this.#saveHandle = undefined;
		this.#frameHandle = undefined;
	}

	tick(now = Date.now()): void {
		const elapsed = Math.min((now - this.state.lastUpdate) / 1000, 60);
		this.state.lastUpdate = now;
		if (elapsed <= 0) return;

		this.state.playTime += elapsed;
		accumulate(this.state, this.modifiers, elapsed);
		this.#checkJokes();
		this.#checkAchievements();
	}

	save(): boolean {
		this.state.lastUpdate = Date.now();
		return saveToStorage(this.state);
	}

	// -----------------------------------------------------------------------
	// Offline
	// -----------------------------------------------------------------------

	#settleOffline(state: GameState): OfflineReport | null {
		const seconds = (Date.now() - state.lastUpdate) / 1000;
		if (!state.settings.offlineProgress || seconds < 30) return null;

		const capped = Math.min(seconds, MAX_OFFLINE_SECONDS);
		const modifiers = computeModifiers(state);

		// Snapshot the hold — anything the crew landed while the tab was closed
		// is sold on the dock rather than piling up in it.
		const holdBefore = FISH_TYPES.map((type) => [type, state.hold[type]] as const);
		const valueBefore = state.holdValue;

		const { fish, value } = accumulate(state, modifiers, capped, OFFLINE_EFFICIENCY);
		if (fish.lte(0)) return null;

		for (const [type, amount] of holdBefore) state.hold[type] = amount;
		state.holdValue = valueBefore;

		const coins = value.times(modifiers.sellMultiplier);
		state.coins = state.coins.plus(coins);
		state.lifetimeCoins = state.lifetimeCoins.plus(coins);
		state.allTimeCoins = state.allTimeCoins.plus(coins);

		return { seconds, cappedSeconds: capped, fish, value, coins, autoSold: true };
	}

	dismissOfflineReport(): void {
		this.offlineReport = null;
	}

	// -----------------------------------------------------------------------
	// Casting
	// -----------------------------------------------------------------------

	beginCast(): void {
		if (this.casting) return;
		this.casting = true;
		this.#castStartedAt = performance.now();
		this.castProgress = 0;
		this.#frameHandle = requestAnimationFrame(this.#frame);
	}

	endCast(): void {
		if (!this.casting) return;
		this.casting = false;
		this.castProgress = 0;
		if (this.#frameHandle !== undefined) cancelAnimationFrame(this.#frameHandle);
		this.#frameHandle = undefined;
	}

	#frame = (now: number) => {
		if (!this.casting) return;

		const duration = this.activeCastSeconds * 1000;
		const elapsed = now - this.#castStartedAt;

		if (elapsed >= duration) {
			const completed = Math.min(Math.floor(elapsed / duration), 25);
			for (let i = 0; i < completed; i++) this.castOnce();
			this.#castStartedAt = now - (elapsed % duration);
		}

		this.castProgress = Math.min(1, (now - this.#castStartedAt) / duration);
		this.#frameHandle = requestAnimationFrame(this.#frame);
	};

	/** One manual cast, rolled for real. */
	castOnce(): void {
		const source = this.state.activeSource;
		const valueMultiplier = SOURCE_CONFIG[source].valueMultiplier;

		const known = new Set(
			Object.entries(this.state.dex)
				.filter(([, count]) => count.gte(1))
				.map(([name]) => name)
		);

		const { caught } = performCast(this.state, source, this.modifiers);

		const feedback: CastFeedback[] = [];
		const fresh: Fish[] = [];

		for (const [fish, count] of caught) {
			const value = count
				.times(fishTypeBaseValue[fish.category])
				.times(valueMultiplier)
				.times(this.modifiers.sellMultiplier);
			feedback.push({ id: this.#feedbackId++, fish, count, value });

			if (!known.has(fish.name) && this.state.dex[fish.name]?.gte(1)) fresh.push(fish);
		}

		if (feedback.length) {
			this.recentCatches = [...feedback, ...this.recentCatches].slice(0, 12);
		}

		if (fresh.length) {
			this.newlyUnlockedSpecies = [...this.newlyUnlockedSpecies, ...fresh].slice(-4);
		}

		this.#checkJokes();
		this.#checkAchievements();
	}

	dismissNewSpecies(): void {
		this.newlyUnlockedSpecies = [];
	}

	/**
	 * The Lovestruck Lipfish is rare enough that a player can land one from a
	 * deckhand's line without ever seeing it in the ticker, so the reveal is
	 * driven off the Fishdex count rather than off a manual cast.
	 */
	#checkJokes(): void {
		if (!this.state.eroticJokeSeen && this.erotic.gte(1)) {
			this.state.eroticJokeSeen = true;
			this.lipfishReveal = true;
		}
	}

	dismissLipfish(): void {
		this.lipfishReveal = false;
	}

	// -----------------------------------------------------------------------
	// Actions
	// -----------------------------------------------------------------------

	sell(): Decimal {
		const earned = sellHold(this.state, this.modifiers);
		this.#checkAchievements();
		return earned;
	}

	setSource(source: FishingSources): void {
		if (!this.state.unlocked[source]) return;
		this.endCast();
		this.state.activeSource = source;
	}

	unlock(source: FishingSources): boolean {
		const done = unlockSource(this.state, source);
		if (done) this.#checkAchievements();
		return done;
	}

	/** Levels a buy button would purchase right now, given the selected amount. */
	upgradeStep(id: UpgradeId): Decimal {
		const remaining = D(UPGRADES[id].maxLevel).minus(this.state.upgrades[id]);
		if (remaining.lte(0)) return d0();

		const wanted =
			this.buyAmount === 'max'
				? affordableUpgradeLevels(id, this.state.upgrades[id], this.state.coins)
				: D(this.buyAmount);

		return Decimal.max(d0(), Decimal.min(wanted, remaining));
	}

	deckhandStep(source: FishingSources): Decimal {
		if (this.buyAmount !== 'max') return D(this.buyAmount);
		return affordableDeckhands(source, this.state.deckhands[source], this.state.coins);
	}

	buy(id: UpgradeId, count?: Decimal | number): Decimal {
		const amount = count ?? (this.buyAmount === 'max' ? this.upgradeStep(id) : this.buyAmount);
		const bought = buyUpgrade(this.state, id, amount);
		if (bought.gt(0)) this.#checkAchievements();
		return bought;
	}

	hire(source: FishingSources, count?: Decimal | number): Decimal {
		const amount = count ?? (this.buyAmount === 'max' ? this.deckhandStep(source) : this.buyAmount);
		const hired = buyDeckhand(this.state, source, amount);
		if (hired.gt(0)) this.#checkAchievements();
		return hired;
	}

	buyPearlUpgrade(id: Parameters<typeof buyPrestigeUpgrade>[1]): boolean {
		return buyPrestigeUpgrade(this.state, id);
	}

	prestige(): PrestigeResult | null {
		const result = performPrestige(this.state);
		if (result) {
			this.endCast();
			this.recentCatches = [];
			this.prestigeResult = result;
			this.save();
		}
		return result;
	}

	dismissPrestigeResult(): void {
		if (this.prestigeResult) {
			this.state.jellyJokeSeen = true;
			this.prestigeResult = null;
		}
	}

	// -----------------------------------------------------------------------
	// Achievements
	// -----------------------------------------------------------------------

	#checkAchievements(): void {
		const unlocked = evaluateAchievements(this.state);
		if (unlocked.length) {
			this.newAchievements = [...this.newAchievements, ...unlocked].slice(-6);
		}
	}

	dismissAchievement(id: string): void {
		this.newAchievements = this.newAchievements.filter((entry) => entry !== id);
	}

	// -----------------------------------------------------------------------
	// Save management
	// -----------------------------------------------------------------------

	exportBlob(): string {
		this.state.lastUpdate = Date.now();
		return exportSave(this.state);
	}

	importBlob(blob: string): boolean {
		const imported = importSave(blob);
		if (!imported) return false;

		this.endCast();
		this.state = imported;
		this.offlineReport = this.#settleOffline(imported);
		this.state.lastUpdate = Date.now();
		this.recentCatches = [];
		this.save();
		return true;
	}

	hardReset(): void {
		this.endCast();
		this.state = createInitialState();
		this.recentCatches = [];
		this.offlineReport = null;
		this.prestigeResult = null;
		this.newAchievements = [];
		this.save();
	}
}

export const game = new Game();
