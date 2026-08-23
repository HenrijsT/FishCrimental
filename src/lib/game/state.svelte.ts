import Decimal from 'break_eternity.js';
import { D, d0 } from '$lib/decimal';
import { fishTypeBaseValue } from '$lib/fish_types';
import type { FishingSources } from '$lib/fishing_sources';
import type { Fish } from '$lib/fishes/fish';
import {
	AUTOSAVE_MS,
	MAX_OFFLINE_SECONDS,
	OFFLINE_FUEL_SHARE,
	OFFLINE_HOLD_MULTIPLIER,
	OFFLINE_EFFICIENCY,
	SAVE_KEY,
	SOURCE_CONFIG,
	TICK_MS,
	TRADER_RATE,
	BOAT_UPGRADE_IDS,
	UPGRADE_IDS,
	type BoatUpgradeId,
	type LicenceId,
	type UpgradeId
} from './config';
import {
	accumulate,
	affordableDeckhands,
	autoFisherCastsPerSecond,
	autoFisherFraction,
	bucketCapacity,
	bucketCost,
	buyAssistant,
	buyAutoFisher,
	buyAutoFisherOffline,
	buyBicycle,
	buyBucket,
	buyMapUpgrade,
	mapCost,
	holdRoom,
	inTown,
	runTrader,
	traderProgress,
	traderSecondsLeft,
	traderStock,
	rideToTown,
	saleRate,
	sell,
	townSecondsLeft,
	buyBoat,
	buyBoatUpgrade,
	buyFuel,
	buyLicence,
	repairBoat,
	reachableSource,
	sourceBlocker,
	affordableUpgradeLevels,
	boatUpgradeCeiling,
	upgradeCeiling,
	upgradeStockedAt,
	buyDeckhand,
	buyPrestigeUpgrade,
	buyUpgrade,
	canPrestige,
	computeModifiers,
	createInitialState,
	discoveredCount,
	eroticCaught,
	consignmentCount,
	consignmentRoom,
	holdCount,
	jellyCaught,
	performCast,
	performPrestige,
	rarityAt,
	totalIncomePerSecond,
	unlockSource,
	RARITY_ORDER,
	type PrestigeResult,
	type Rarity
} from './engine';
import { evaluateAchievements } from './achievements';
import {
	backupRawSave,
	exportRawSave,
	exportSave,
	importSave,
	loadFromStorage,
	readRawSave,
	saveToStorage
} from './save';
import type { GameState, Modifiers, OfflineReport } from './types';

/**
 * A gap longer than this is settled as offline progress rather than replayed
 * by the tick loop.
 */
const RESUME_THRESHOLD_SECONDS = 120;

export interface SaveProblem {
	kind: 'future' | 'corrupt' | 'conflict' | 'write-failed';
	message: string;
}

/**
 * Problems that must stop the game writing over what is on disk.
 *
 * A conflict is deliberately not one of them. Muting the tab that *receives*
 * a foreign write mutes the tab the player is looking at — a plain tab switch
 * is enough to trigger it — and it threw away everything they then did. Saying
 * so and carrying on is last-writer-wins, which is where the game already was.
 */
const BLOCKING_SAVE_PROBLEMS: ReadonlySet<SaveProblem['kind']> = new Set(['future', 'corrupt']);

/**
 * The modals the game can raise, in the order they get the screen.
 *
 * Offline comes first because it is the only one carrying information the
 * player cannot get back: it reports up to eight hours of crew work and is
 * gone once dismissed. The joke reveals can wait their turn.
 */
export const MODAL_ORDER = ['offline', 'prestige', 'lipfish'] as const;

export type ModalId = (typeof MODAL_ORDER)[number];

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
 *
 * Exported as a class as well as a singleton so the lifecycle — offline
 * settlement, the multi-tab guard, save orchestration — can be tested on a
 * throwaway instance instead of only in a browser.
 */
export class Game {
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

	/**
	 * Wall clock, refreshed every tick. Deadlines are absolute timestamps, so
	 * anything counting down to one needs a reactive `now` to re-read.
	 */
	now = $state(Date.now());

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
	/** The unparsed save this build refused to read, kept so it can be rescued. */
	#preservedSave: string | null = null;

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
			this.#preservedSave = readRawSave();
			this.saveProblem = {
				kind: 'future',
				message: `This save was written by a newer version of FishCrimental (save format ${outcome.version}). It has been left untouched — update the game, or export it and start fresh.`
			};
		} else if (outcome.kind === 'corrupt') {
			this.#preservedSave = readRawSave();
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
	 * writer wins. Warn about it — and keep saving.
	 *
	 * The `storage` event fires in the tab that did *not* write, so reacting to
	 * it by muting saves silences the wrong tab. Switching tabs is enough to
	 * trigger it, because the tab being left saves on `visibilitychange`; a
	 * throttled background tab does it unaided. The tab the player is actually
	 * using would then discard its whole session.
	 */
	#watchOtherTabs(): void {
		if (typeof window === 'undefined') return;

		window.addEventListener('storage', (event) => {
			if (event.key !== SAVE_KEY || event.newValue === null) return;
			if (this.saveProblem) return;

			this.saveProblem = {
				kind: 'conflict',
				message:
					'FishCrimental is open in another tab. Both tabs save to the same browser storage, so whichever writes last wins and the other one loses whatever it did. Close one of them — and take a backup first if you are not sure which is ahead.'
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
		this.now = now;
		const elapsed = Math.min((now - this.state.lastUpdate) / 1000, RESUME_THRESHOLD_SECONDS);
		this.state.lastUpdate = now;
		if (elapsed <= 0) return;

		// The trader keeps his own appointment; the tick just notices he is due.
		const visit = runTrader(this.state, this.modifiers, now);
		if (visit.visits > 0) this.lastTraderEarned = visit.earned;

		this.state.playTime += elapsed;
		// The rig holds the rod *for* you. While you are holding it yourself it
		// stands down, so a maxed rig matches a human exactly and can never
		// stack with one into something faster than playing.
		accumulate(
			this.state,
			this.modifiers,
			elapsed,
			1,
			undefined,
			Math.random,
			this.casting ? 0 : 1
		);
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
		// Refusing to write is the whole point of the blocking states: a save
		// this build could not read must not be replaced by one it made up.
		if (this.saveProblem && BLOCKING_SAVE_PROBLEMS.has(this.saveProblem.kind)) return false;

		this.state.lastUpdate = Date.now();
		const written = saveToStorage(this.state);

		// A refused write used to be swallowed by every caller alike — the
		// autosave, the pagehide handler and the Save now button — while the
		// panel underneath went on claiming the game saves every ten seconds.
		if (!written) {
			if (this.saveProblem?.kind !== 'write-failed') {
				this.saveProblem = {
					kind: 'write-failed',
					message:
						'This browser refused to store the save — usually a full quota, or storage blocked for this site. The game is still running, but nothing since the last successful save would survive a reload. Export a backup from Settings.'
				};
			}
			return false;
		}

		if (this.saveProblem?.kind === 'write-failed') this.saveProblem = null;
		return true;
	}

	dismissSaveProblem(): void {
		const problem = this.saveProblem;
		if (!problem) return;

		// Dismissing re-arms the ten-second autosave, which is about to write
		// the fresh game over the save the banner exists to protect. Copy it
		// aside first, so Dismiss stops being a one-click total loss.
		if (BLOCKING_SAVE_PROBLEMS.has(problem.kind) && this.#preservedSave !== null) {
			backupRawSave(this.#preservedSave);
		}

		this.saveProblem = null;
	}

	// -----------------------------------------------------------------------
	// Offline
	// -----------------------------------------------------------------------

	/**
	 * Settle time away.
	 *
	 * **Offline is passive (R51).** The crew fish and the ponds fill. Nobody
	 * sells, no trader calls, and no decision is taken on the player's behalf.
	 * The whole night is what the crew landed, sitting in the keepnet waiting
	 * to be sold.
	 *
	 * With no order-dependent call left there is nothing to chunk: one
	 * `accumulate` over the whole window is the same answer as twenty-four,
	 * which is why `OFFLINE_CHUNKS` is gone. The night's ceiling it used to set
	 * lives on as `OFFLINE_HOLD_MULTIPLIER`.
	 *
	 * The hold is *not* taken out of play first. It stays exactly where it is,
	 * so the keepnet's room is measured against what is genuinely in it and the
	 * bucket is enforced by `accumulate` on the way in, rather than by trimming
	 * afterwards.
	 */
	#settleOffline(state: GameState): OfflineReport | null {
		const seconds = (Date.now() - state.lastUpdate) / 1000;
		if (!state.settings.offlineProgress || seconds < 30) return null;

		const capped = Math.min(seconds, MAX_OFFLINE_SECONDS);

		const coinsBefore = state.coins;

		// The standing fuel order can only ever draw on coins banked before
		// leaving, because under R51 none arrive while away. Cap what it may
		// take: `runBoat` reads `state.coins` directly, so handing it a smaller
		// purse for the duration is the whole enforcement, and no engine code
		// has to know that this is a night rather than a tick.
		const budget = Decimal.max(d0(), coinsBefore.times(OFFLINE_FUEL_SHARE));
		state.coins = budget;

		const modifiers = computeModifiers(state);
		const step = accumulate(
			state,
			modifiers,
			capped,
			OFFLINE_EFFICIENCY,
			undefined,
			Math.random,
			state.autoFisherOffline ? 1 : 0,
			OFFLINE_HOLD_MULTIPLIER
		);

		const fuelSpent = Decimal.max(d0(), budget.minus(state.coins));
		// Restore rather than subtract when nothing was spent: `0 - 0` is `-0`,
		// and a negative zero in the purse is a thing nobody should have to read.
		state.coins = fuelSpent.gt(0) ? coinsBefore.minus(fuelSpent) : coinsBefore;

		if (step.fish.lte(0) && fuelSpent.lte(0)) return null;

		return {
			seconds,
			cappedSeconds: capped,
			fish: step.fish,
			value: step.value,
			fuelSpent,
			fellBack: step.fellBack,
			// What is waiting to be sold, all of it, not just tonight's.
			holdAfter: holdCount(state),
			// True when the keepnet filled and the rest went back in the water.
			holdFull: step.bucketBound
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
		// In town selling. The crew are unaffected — `accumulate` never reads this.
		if (inTown(this.state)) return;
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

		// The trip can start mid-hold. Bailing out of the frame is not enough:
		// the catch-up loop below lands up to 25 casts at a time, so the cast
		// has to actually be ended.
		if (inTown(this.state)) {
			this.endCast();
			return;
		}

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

		// Which species were already in the dex before this cast, so a first
		// sighting can be told apart from the thousandth. A plain record rather
		// than a Set: this is a frozen lookup, not reactive state.
		const known: Record<string, true> = {};
		for (const [name, count] of Object.entries(this.state.dex)) {
			if (count.gte(1)) known[name] = true;
		}

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

			if (!known[fish.name] && this.state.dex[fish.name]?.gte(1)) fresh.push(fish);
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

	/**
	 * Sell on demand. There is always a Sell button (R65).
	 *
	 * With an Assistant it is a sale and the coins are immediate. Without one it
	 * is a *listing*: the fish go onto the quay for the travelling merchant,
	 * leaving the bucket at once, and the coins arrive with him. Either way the
	 * player decides what leaves the bucket and when, which is what the trader
	 * silently taking the whole hold used to decide for them.
	 */
	sell(): { sold: Decimal; listed: Decimal } {
		const result = sell(this.state, this.modifiers);
		if (result.sold.gt(0)) this.#checkAchievements();
		return result;
	}

	/** Full price, at the cost of staying off the water while you are gone. */
	ride(): Decimal {
		const result = rideToTown(this.state, this.modifiers);
		if (!result) return d0();

		this.endCast();
		this.#checkAchievements();
		return result.earned;
	}

	purchaseBicycle(): boolean {
		const bought = buyBicycle(this.state);
		if (bought) this.#checkAchievements();
		return bought;
	}

	buyMap(): boolean {
		const bought = buyMapUpgrade(this.state);
		if (bought) this.#checkAchievements();
		return bought;
	}

	upgradeBucket(): boolean {
		const bought = buyBucket(this.state);
		if (bought) this.#checkAchievements();
		return bought;
	}

	purchaseAssistant(): boolean {
		const bought = buyAssistant(this.state);
		if (bought) this.#checkAchievements();
		return bought;
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
		const ceiling = upgradeCeiling(this.state, id);
		const remaining = D(ceiling).minus(this.state.upgrades[id]);
		if (remaining.lte(0)) return d0();

		const wanted =
			this.buyAmount === 'max'
				? affordableUpgradeLevels(id, this.state.upgrades[id], this.state.coins, ceiling)
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

	mapPrice = $derived(mapCost(this.state.mapLevel));

	/** Highest level of each track anyone the player can reach will sell. */
	ceilings = $derived(
		Object.fromEntries(UPGRADE_IDS.map((id) => [id, upgradeCeiling(this.state, id)])) as Record<
			UpgradeId,
			number
		>
	);
	stockedAt = $derived(
		Object.fromEntries(UPGRADE_IDS.map((id) => [id, upgradeStockedAt(this.state, id)])) as Record<
			UpgradeId,
			FishingSources | null
		>
	);
	boatCeilings = $derived(
		Object.fromEntries(
			BOAT_UPGRADE_IDS.map((id) => [id, boatUpgradeCeiling(this.state, id)])
		) as Record<BoatUpgradeId, number>
	);

	/** What the last trader paid, for a one-line note on the Shore. */
	lastTraderEarned = $state<Decimal | null>(null);

	traderStock = $derived(traderStock(this.state));
	traderLeft = $derived(traderSecondsLeft(this.state, this.now));
	traderFill = $derived(traderProgress(this.state, this.now));

	/** Null once an Assistant is minding the catch — nothing limits the hold. */
	holdRoom = $derived(holdRoom(this.state));
	/** Fish on the quay waiting for the merchant, and what they are worth. */
	listedSize = $derived(consignmentCount(this.state));
	listedRoom = $derived(consignmentRoom(this.state));
	listedWorth = $derived(this.state.consignmentValue.times(this.modifiers.sellMultiplier));
	/** What the travelling merchant pays per coin of catch. Never the town price. */
	merchantRate = TRADER_RATE;
	bucketSize = $derived(bucketCapacity(this.state.bucketLevel));
	bucketPrice = $derived(bucketCost(this.state.bucketLevel));

	/** Manual casting is refused while the trip is running. */
	inTown = $derived(inTown(this.state, this.now));
	townLeft = $derived(townSecondsLeft(this.state, this.now));
	saleRate = $derived(saleRate(this.state));

	/** 0 to 1 — how close the rig is to a human hand. */
	autoFisherSpeed = $derived(autoFisherFraction(this.state.autoFisher));
	autoFisherRate = $derived(autoFisherCastsPerSecond(this.state, this.modifiers));

	buyRig(): boolean {
		const bought = buyAutoFisher(this.state);
		if (bought) this.#checkAchievements();
		return bought;
	}

	buyRigOffline(): boolean {
		return buyAutoFisherOffline(this.state);
	}

	/**
	 * The one modal that is allowed on screen right now.
	 *
	 * The three modals used to be siblings, each mounting its own Escape
	 * handler, so one Escape closed all of them and a natural save — an offline
	 * report landing at the same moment as the lipfish reveal — lost the payment
	 * report entirely. Rendering at most one is what makes a single Escape
	 * handler correct.
	 */
	activeModal = $derived<ModalId | null>(
		this.offlineReport !== null
			? 'offline'
			: this.prestigeResult !== null
				? 'prestige'
				: this.lipfishReveal
					? 'lipfish'
					: null
	);

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
		// While a blocking save problem stands, `this.state` is the blank game
		// that was started in the save's place. Exporting that is exactly the
		// wrong thing: the banner tells the player to export and start fresh,
		// and the only copy worth keeping is the one on disk.
		if (this.#preservedSave !== null && this.saveProblem) {
			return exportRawSave(this.#preservedSave);
		}

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
