import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import { FISH_TYPES, fishTypeBaseValue } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { Fish } from '$lib/fishes/fish';
import {
	AUTOSAVE_MS,
	MAX_OFFLINE_SECONDS,
	OFFLINE_CHUNKS,
	OFFLINE_EFFICIENCY,
	SAVE_KEY,
	SOURCE_CONFIG,
	TICK_MS,
	UPGRADES,
	type BoatUpgradeId,
	type LicenceId,
	type UpgradeId
} from './config';
import {
	accumulate,
	affordableDeckhands,
	buyBoat,
	buyBoatUpgrade,
	buyFuel,
	buyLicence,
	repairBoat,
	reachableSource,
	sourceBlocker,
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
	rarityAt,
	sellHold,
	totalIncomePerSecond,
	unlockSource,
	RARITY_ORDER,
	type PrestigeResult,
	type Rarity
} from './engine';
import { evaluateAchievements } from './achievements';
import { exportSave, importSave, loadFromStorage, saveToStorage } from './save';
import type { GameState, Modifiers, OfflineReport } from './types';

/**
 * A gap longer than this is settled as offline progress rather than replayed
 * by the tick loop.
 */
const RESUME_THRESHOLD_SECONDS = 120;

export interface SaveProblem {
	kind: 'future' | 'corrupt' | 'conflict';
	message: string;
}

export type BuyAmount = 1 | 10 | 25 | 'max';

export const BUY_AMOUNTS: BuyAmount[] = [1, 10, 25, 'max'];

export interface CastFeedback {
	id: number;
	fish: Fish;
	count: Decimal;
	value: Decimal;
	rarity: Rarity;
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
	/** Bumped on every landed cast, so the scene can play its splash. */
	catchPulse = $state(0);
	/** The best fish of the last cast, for the flash over the water. */
	lastCatch = $state<CastFeedback | null>(null);

	offlineReport = $state<OfflineReport | null>(null);
	prestigeResult = $state<PrestigeResult | null>(null);
	newlyUnlockedSpecies = $state<Fish[]>([]);
	newAchievements = $state<string[]>([]);
	/** The Lovestruck Lipfish reveal — fires once, ever. */
	lipfishReveal = $state(false);

	loaded = $state(false);
	saveProblem = $state<SaveProblem | null>(null);
	/** Set when the boat could not sail and the player was moved inshore. */
	strandedFrom = $state<FishingSources | null>(null);

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

		const outcome = loadFromStorage();

		if (outcome.kind === 'loaded') {
			this.state = outcome.state;
			// Settle through `this.state`, not the object that was passed in:
			// assigning to a `$state` field wraps the value in a proxy, and
			// mutating the raw object afterwards would bypass reactivity.
			this.offlineReport = this.#settleOffline(this.state);
		} else if (outcome.kind === 'future') {
			this.saveProblem = {
				kind: 'future',
				message: `This save was written by a newer version of FishCrimental (save format ${outcome.version}). It has been left untouched — update the game, or export it and start fresh.`
			};
		} else if (outcome.kind === 'corrupt') {
			this.saveProblem = {
				kind: 'corrupt',
				message:
					'The stored save could not be read, so a new game was started. The unreadable save is still in this browser and has not been overwritten.'
			};
		}

		this.state.lastUpdate = Date.now();
		this.loaded = true;
		this.#watchOtherTabs();
		this.start();
	}

	/**
	 * Two tabs on one save clobber each other: both autosave, and the last
	 * writer wins. When another tab writes, this one stops saving and says so
	 * rather than quietly overwriting whichever tab the player is actually
	 * using.
	 */
	#watchOtherTabs(): void {
		if (typeof window === 'undefined') return;

		window.addEventListener('storage', (event) => {
			if (event.key !== SAVE_KEY || event.newValue === null) return;
			if (this.saveProblem?.kind === 'conflict') return;

			this.saveProblem = {
				kind: 'conflict',
				message:
					'FishCrimental is open in another tab, which is now the one being saved. This tab has stopped saving so it cannot overwrite it. Reload to pick up where the other tab is.'
			};
		});
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
		const elapsed = Math.min((now - this.state.lastUpdate) / 1000, RESUME_THRESHOLD_SECONDS);
		this.state.lastUpdate = now;
		if (elapsed <= 0) return;

		this.state.playTime += elapsed;
		accumulate(this.state, this.modifiers, elapsed);
		this.#keepFishable();
		this.#checkJokes();
		this.#checkAchievements();
	}

	/**
	 * Called when the tab becomes visible again. A backgrounded tab has its
	 * timers throttled to roughly once a minute, and a sleeping laptop stops
	 * them entirely, so a long gap is settled the same way a fresh load is
	 * rather than being silently clamped away by `tick`.
	 */
	resume(): void {
		if (!this.loaded) return;

		const gap = (Date.now() - this.state.lastUpdate) / 1000;
		if (gap > RESUME_THRESHOLD_SECONDS) {
			const report = this.#settleOffline(this.state);
			if (report) this.offlineReport = report;
		}

		this.state.lastUpdate = Date.now();
	}

	save(): boolean {
		// Refusing to write is the whole point of the save-problem states: a
		// save this build could not read must not be replaced by one it made up.
		if (this.saveProblem) return false;

		this.state.lastUpdate = Date.now();
		return saveToStorage(this.state);
	}

	dismissSaveProblem(): void {
		this.saveProblem = null;
	}

	// -----------------------------------------------------------------------
	// Offline
	// -----------------------------------------------------------------------

	/**
	 * Settle time away in a handful of chunks rather than one step.
	 *
	 * One step would be closed form, but the standing fuel order pays for fuel
	 * out of coins, and coins only arrive when the catch is sold. Selling every
	 * chunk lets the boat keep itself fuelled for the whole window. Twenty-four
	 * chunks covers eight hours — it is not a per-cast simulation.
	 */
	#settleOffline(state: GameState): OfflineReport | null {
		const seconds = (Date.now() - state.lastUpdate) / 1000;
		if (!state.settings.offlineProgress || seconds < 30) return null;

		const capped = Math.min(seconds, MAX_OFFLINE_SECONDS);

		// Snapshot the hold: everything the crew landed while you were away is
		// sold on the dock rather than piling up in it.
		const holdBefore = FISH_TYPES.map((type) => [type, state.hold[type]] as const);
		const valueBefore = state.holdValue;
		const coinsBefore = state.coins;

		let fish = d0();
		let value = d0();
		let fellBack = false;
		let fuelSpent = d0();

		const chunks = Math.max(1, Math.min(OFFLINE_CHUNKS, Math.ceil(capped / 60)));
		const chunkSeconds = capped / chunks;

		for (let i = 0; i < chunks; i++) {
			const modifiers = computeModifiers(state);
			const coinsAtChunkStart = state.coins;

			const step = accumulate(state, modifiers, chunkSeconds, OFFLINE_EFFICIENCY);
			fish = fish.plus(step.fish);
			value = value.plus(step.value);
			fellBack = fellBack || step.fellBack;

			// runBoat may have spent coins on fuel through the standing order.
			const spent = coinsAtChunkStart.minus(state.coins);
			if (spent.gt(0)) fuelSpent = fuelSpent.plus(spent);

			sellHold(state, modifiers);
		}

		if (fish.lte(0) && fuelSpent.lte(0)) {
			for (const [type, amount] of holdBefore) state.hold[type] = amount;
			state.holdValue = valueBefore;
			return null;
		}

		// Put the hold back the way the player left it; the offline catch was sold.
		for (const [type, amount] of holdBefore) state.hold[type] = amount;
		state.holdValue = valueBefore;

		return {
			seconds,
			cappedSeconds: capped,
			fish,
			value,
			coins: state.coins.minus(coinsBefore),
			autoSold: true,
			fuelSpent,
			fellBack
		};
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
			feedback.push({
				id: this.#feedbackId++,
				fish,
				count,
				value,
				rarity: rarityAt(source, this.modifiers.luck, fish.name)
			});

			if (!known.has(fish.name) && this.state.dex[fish.name]?.gte(1)) fresh.push(fish);
		}

		if (feedback.length) {
			this.recentCatches = [...feedback, ...this.recentCatches].slice(0, 12);

			// The flash names the rarest thing that came up, not the last one.
			this.lastCatch = feedback.reduce((best, entry) =>
				RARITY_ORDER.indexOf(entry.rarity) > RARITY_ORDER.indexOf(best.rarity) ? entry : best
			);
			this.catchPulse += 1;
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
		if (sourceBlocker(this.state, source, this.modifiers)) return;
		this.endCast();
		this.state.activeSource = source;
	}

	// -----------------------------------------------------------------------
	// Paper and the boat
	// -----------------------------------------------------------------------

	takeLicence(id: LicenceId): boolean {
		const bought = buyLicence(this.state, id);
		if (bought) this.#checkAchievements();
		return bought;
	}

	purchaseBoat(): boolean {
		const bought = buyBoat(this.state);
		if (bought) this.#checkAchievements();
		return bought;
	}

	refuel(litres?: Decimal): Decimal {
		return buyFuel(this.state, this.modifiers, litres);
	}

	repair(): boolean {
		return repairBoat(this.state);
	}

	upgradeBoat(id: BoatUpgradeId): boolean {
		const bought = buyBoatUpgrade(this.state, id);
		if (bought) this.#checkAchievements();
		return bought;
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

	boatBlocker = $derived(sourceBlocker(this.state, this.state.activeSource, this.modifiers));

	prestige(): PrestigeResult | null {
		const result = performPrestige(this.state);
		if (result) {
			this.endCast();
			this.recentCatches = [];
			this.lastCatch = null;
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

	/**
	 * If the water the player is standing over stops being workable — the tank
	 * ran dry, mostly — move them to the deepest water they can still reach and
	 * say so. Never leave the rod pointing at somewhere it cannot fish.
	 */
	#keepFishable(): void {
		const stranded = this.strandedFrom;

		// Clear the notice only once the water it is about is workable again —
		// not on the next tick, which is what happens if you test the source the
		// player was just moved to.
		if (stranded && !sourceBlocker(this.state, stranded, this.modifiers)) {
			this.strandedFrom = null;
		}

		if (!sourceBlocker(this.state, this.state.activeSource, this.modifiers)) return;

		const fallback = reachableSource(this.state, this.modifiers);
		if (fallback === this.state.activeSource) return;

		this.strandedFrom = this.state.activeSource;
		this.endCast();
		this.state.activeSource = fallback;
	}

	dismissStranded(): void {
		this.strandedFrom = null;
	}

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
		this.saveProblem = null;
		this.state = imported;
		this.offlineReport = this.#settleOffline(this.state);
		this.state.lastUpdate = Date.now();
		this.recentCatches = [];
		this.save();
		return true;
	}

	hardReset(): void {
		this.endCast();
		this.saveProblem = null;
		this.state = createInitialState();
		this.recentCatches = [];
		this.offlineReport = null;
		this.prestigeResult = null;
		this.newAchievements = [];
		this.save();
	}
}

export const game = new Game();
