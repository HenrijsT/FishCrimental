import type Decimal from 'break_eternity.js';
import { d0 } from '$lib/decimal';
import { FISH_TYPES } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { Fish } from '$lib/fishes/fish';
import { AUTOSAVE_MS, MAX_OFFLINE_SECONDS, OFFLINE_EFFICIENCY, TICK_MS } from './config';
import {
	accumulate,
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

	loaded = $state(false);

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
		const before = this.discovered;
		const { caught } = performCast(this.state, source, this.modifiers);

		const feedback: CastFeedback[] = [];
		for (const [fish, count] of caught) {
			feedback.push({ id: this.#feedbackId++, fish, count, value: d0() });
		}

		if (feedback.length) {
			this.recentCatches = [...feedback, ...this.recentCatches].slice(0, 12);
		}

		if (this.discovered > before) this.#collectNewSpecies();
		this.#checkAchievements();
	}

	#collectNewSpecies(): void {
		// The Fishdex page picks these up and shows the description card.
		const fresh: Fish[] = [];
		for (const entry of this.recentCatches) {
			if (this.state.dex[entry.fish.name]?.lt(2)) fresh.push(entry.fish);
		}
		if (fresh.length) this.newlyUnlockedSpecies = fresh;
	}

	dismissNewSpecies(): void {
		this.newlyUnlockedSpecies = [];
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

	buy(id: Parameters<typeof buyUpgrade>[1], count: Decimal | number = 1): Decimal {
		const bought = buyUpgrade(this.state, id, count);
		if (bought.gt(0)) this.#checkAchievements();
		return bought;
	}

	hire(source: FishingSources, count: Decimal | number = 1): Decimal {
		const hired = buyDeckhand(this.state, source, count);
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
