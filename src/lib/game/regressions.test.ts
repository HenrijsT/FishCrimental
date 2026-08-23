import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { D } from '$lib/decimal';
import { formatNumber } from '$lib/format';
import { FISH_TYPES, FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import {
	ASSISTANT_COST,
	OFFLINE_EFFICIENCY,
	OFFLINE_HOLD_MULTIPLIER,
	POACH_GRACE_SECONDS,
	SAVE_VERSION,
	SOURCE_ORDER,
	TOWN_RATE,
	UPGRADES
} from './config';
import {
	accumulate,
	autoCastsPerSecond,
	bucketCapacity,
	buyAssistant,
	buyDeckhand,
	buyUpgrade,
	consignmentCount,
	listForSale,
	traderInStock,
	computeModifiers,
	createInitialState,
	deckhandBulkCost,
	deckhandCost,
	holdCount,
	performCast,
	rodClampLevel,
	runTrader,
	saleRate,
	sellHold,
	settleConsignment,
	upgradeCeiling,
	upgradeStockedAt
} from './engine';
import { addToLedger, ledgerWorth } from './market';
import { nextStep } from './guide';
import { poachSource, runPolice, stopPoaching } from './police';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';

/**
 * Every test here is tied to a specific defect found in the round-two hunt.
 * They exist to stop it coming back, not to describe the design.
 */

describe('round two: the catch ticker showed the same species every cast', () => {
	// A single cast used to write one rolled fish plus a fractional sliver of
	// every other species in the source into the ticker, the hold and the dex.
	it('a cast touches only the species it actually landed', () => {
		const state = createInitialState();
		state.coins = D(1e9);
		buyUpgrade(state, 'net', 1); // fishPerCast 1.19 — the case that broke

		const modifiers = computeModifiers(state);
		expect(modifiers.fishPerCast.toNumber()).toBeCloseTo(1.19, 6);

		const { caught } = performCast(state, SOURCE_ORDER[0], modifiers, () => 0.5);
		expect(caught.size).toBeLessThanOrEqual(2);
		expect(Object.keys(state.dex).length).toBeLessThanOrEqual(2);
	});

	it('never books a fraction of a fish anywhere', () => {
		const state = createInitialState();
		state.coins = D(1e9);
		buyUpgrade(state, 'net', 4);
		const modifiers = computeModifiers(state);

		for (let i = 0; i < 200; i++) performCast(state, SOURCE_ORDER[0], modifiers, Math.random);

		for (const type of FISH_TYPES) {
			expect(state.hold[type].eq(state.hold[type].floor())).toBe(true);
		}
		for (const [name, count] of Object.entries(state.dex)) {
			expect(count.eq(count.floor()), `${name} is fractional`).toBe(true);
		}
	});
});

describe('round two: the Erotic count rendered as a red-flagged zero', () => {
	it('a species you have not caught is simply absent from the hold', () => {
		const state = createInitialState();
		const modifiers = computeModifiers(state);
		performCast(state, SOURCE_ORDER[0], modifiers, () => 0.5);

		expect(state.hold[FishType.Erotic].eq(0)).toBe(true);
		expect(state.hold[FishType.Jelly].eq(0)).toBe(true);
	});

	it('formatNumber never renders a value the player has as "0"', () => {
		expect(formatNumber(2.09e-7)).toBe('<0.01');
		expect(formatNumber(0.004)).toBe('<0.01');
		expect(formatNumber(0)).toBe('0');
	});
});

describe('round two: deckhands landed every species of a category at once', () => {
	it('a small crew brings up a handful of species, not the whole roster', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D(3);
		const modifiers = computeModifiers(state);

		accumulate(state, modifiers, 10, 1, undefined, () => 0.5);

		const discovered = Object.keys(state.dex).length;
		expect(discovered).toBeGreaterThan(0);
		expect(discovered).toBeLessThanOrEqual(3);
	});

	it('still reaches the whole roster given long enough', () => {
		const state = createInitialState();
		// The Pond, not the mud pool: the mud pool stocks five species and this
		// is about a crew eventually landing more than a handful.
		state.unlocked[FishingSources.Pond] = true;
		state.activeSource = FishingSources.Pond;
		state.deckhands[FishingSources.Pond] = D(50);
		// Species coverage, not bucket capacity: an Assistant keeps the hold
		// unlimited so 20,000 seconds of crew work actually lands.
		state.hasAssistant = true;
		const modifiers = computeModifiers(state);

		accumulate(state, modifiers, 20_000);

		expect(Object.keys(state.dex).length).toBeGreaterThanOrEqual(7);
	});
});

describe('round two: a huge crew overflowed a double and poisoned the save', () => {
	it('cast rates stay Decimal past the double limit', () => {
		const state = createInitialState();
		state.deckhands[SOURCE_ORDER[0]] = D('1e320');
		const modifiers = computeModifiers(state);

		const rate = autoCastsPerSecond(state, modifiers, SOURCE_ORDER[0]);
		expect(rate instanceof Decimal).toBe(true);
		expect(rate.isFinite()).toBe(true);
		expect(rate.gt('1e300')).toBe(true);
	});

	it('an enormous haul never becomes Infinity, so the save survives it', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) {
			state.unlocked[source] = true;
			state.deckhands[source] = D('1e320');
		}

		const modifiers = computeModifiers(state);
		accumulate(state, modifiers, 60);
		const earned = sellHold(state, modifiers);

		expect(earned.isFinite()).toBe(true);
		expect(state.coins.isFinite()).toBe(true);

		// The real damage was here: Infinity does not survive a save round trip.
		const restored = fromRaw(JSON.parse(serialize(state)));
		expect(restored.coins.gt(0)).toBe(true);
		expect(restored.coins.eq(state.coins)).toBe(true);
	});
});

describe('round two: bulk-buying deckhands cost more than buying them singly', () => {
	it('ten at once costs exactly what ten one at a time costs', () => {
		for (const source of SOURCE_ORDER) {
			let singly = D(0);
			for (let i = 0; i < 10; i++) singly = singly.plus(deckhandCost(source, i));

			const bulk = deckhandBulkCost(source, D(0), D(10));
			expect(bulk.div(singly).toNumber()).toBeCloseTo(1, 9);
		}
	});

	it('and the player is charged the same either way', () => {
		const bulkState = createInitialState();
		bulkState.coins = D(1e9);
		buyDeckhand(bulkState, SOURCE_ORDER[0], 10);

		const singleState = createInitialState();
		singleState.coins = D(1e9);
		for (let i = 0; i < 10; i++) buyDeckhand(singleState, SOURCE_ORDER[0], 1);

		expect(bulkState.deckhands[SOURCE_ORDER[0]].eq(10)).toBe(true);
		expect(singleState.deckhands[SOURCE_ORDER[0]].eq(10)).toBe(true);
		expect(bulkState.coins.div(singleState.coins).toNumber()).toBeCloseTo(1, 9);
	});
});

describe('round two: hand-edited saves were trusted', () => {
	it('refuses negative currencies', () => {
		const loaded = fromRaw({ version: 2, coins: '-1e30', lifetimeCoins: '-5', holdValue: '-1' });
		expect(loaded.coins.eq(0)).toBe(true);
		expect(loaded.lifetimeCoins.eq(0)).toBe(true);
		expect(loaded.holdValue.eq(0)).toBe(true);
	});

	it('clamps upgrade levels to the ceiling the game defines', () => {
		const loaded = fromRaw({
			version: 2,
			upgrades: { rod: '1e30' },
			prestigeUpgrades: { pearl_yield: '1e30' }
		});
		expect(loaded.upgrades.rod.toNumber()).toBe(70);
		expect(loaded.prestigeUpgrades.pearl_yield.toNumber()).toBe(25);
	});

	it('throws away a remainder bank that is not made of remainders', () => {
		const loaded = fromRaw({
			version: 2,
			carry: { good: 0.5, tooBig: 4, negative: -0.2, notANumber: 'x', infinite: Infinity }
		});
		expect(loaded.carry).toEqual({ good: 0.5 });
	});
});

describe('round two: version 1 saves carried fractional fish', () => {
	it('rounds them down on the way in', () => {
		const loaded = fromRaw({
			version: 1,
			hold: { Small: '7.21', Medium: '1.29', Large: '0.02', Erotic: '2.09e-7' },
			dex: { Guppy: '3.7', Tetra: '0.4' }
		});

		expect(loaded.hold[FishType.Small].eq(7)).toBe(true);
		expect(loaded.hold[FishType.Medium].eq(1)).toBe(true);
		expect(loaded.hold[FishType.Large].eq(0)).toBe(true);
		expect(loaded.hold[FishType.Erotic].eq(0)).toBe(true);
		expect(loaded.dex.Guppy.eq(3)).toBe(true);
		expect(loaded.dex.Tetra).toBeUndefined();
		// Not a literal: this asserts the migration chain runs all the way to
		// the current format, whatever that is today.
		expect(loaded.version).toBe(SAVE_VERSION);
	});
});

/**
 * R63. Buying the Assistant is the most expensive thing in the opening act, and
 * it used to make the player 45% poorer per fish.
 *
 * `runTrader` was called unguarded from the live tick, so the trader kept
 * arriving every forty-five seconds and taking the whole hold at `TRADER_RATE`,
 * while `saleRate` told that same player they were on `TOWN_RATE`. Nothing in
 * the UI said otherwise. Offline already branched correctly; the tick did not.
 */
describe('the trader stops buying once there is an Assistant (R63)', () => {
	/** Ten fish listed on the quay, the merchant almost due. */
	function stocked(): GameState {
		const state = createInitialState();
		state.hold[FishType.Small] = D(10);
		state.holdValue = D(1_000);
		listForSale(state);
		state.nextTraderAt = 1_000;
		return state;
	}

	it('does not take the hold', () => {
		const state = stocked();
		state.hasAssistant = true;

		const result = runTrader(state, computeModifiers(state), 10_000);

		expect(result.visits).toBe(0);
		expect(result.earned.toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(1_000);
		expect(state.consignment[FishType.Small].toNumber()).toBe(10);
		expect(state.coins.toNumber()).toBe(0);
	});

	it('still takes it from a player who has not hired one', () => {
		const state = stocked();

		const result = runTrader(state, computeModifiers(state), 10_000);

		expect(result.visits).toBeGreaterThan(0);
		expect(state.consignmentValue.toNumber()).toBe(0);
	});

	it('does not bank a pile of arrivals to spring on someone who lets him go', () => {
		const state = stocked();
		state.hasAssistant = true;

		// A long absence with the Assistant on the books.
		runTrader(state, computeModifiers(state), 10_000_000);
		state.hasAssistant = false;

		// At most one visit is due immediately, not the two hundred that elapsed.
		const result = runTrader(state, computeModifiers(state), 10_000_000);
		expect(result.visits).toBeLessThanOrEqual(1);
	});

	it('pays the Assistant owner the full price they were promised', () => {
		const state = stocked();
		state.hasAssistant = true;
		expect(saleRate(state)).toBe(TOWN_RATE);
	});
});

/**
 * The review pass over the fifth pass. Same rule as above: one test per defect
 * actually found, tied to the thing that was wrong rather than to the design.
 */

describe('review: the rig was billed for a night the bucket could not hold', () => {
	// The crew loop trims its casts to the keepnet before minting them, because
	// `routeCasts(spend = true)` buys fuel and wears the hull for every cast it
	// is handed. The rig block was left on the old shape: it bailed out only at
	// *exactly* zero room, so partial room let a whole interval through — and
	// offline, with the night shift bought, that interval is the entire night.
	it('trims the rig to the keepnet before the casts are minted', () => {
		const state = createInitialState();
		state.coins = D(1e30);
		state.autoFisher = D(5);
		state.autoFisherOffline = true;
		state.activeSource = FishingSources.MudPool;

		const modifiers = computeModifiers(state);
		const result = accumulate(
			state,
			modifiers,
			8 * 3600,
			OFFLINE_EFFICIENCY,
			undefined,
			Math.random,
			1,
			OFFLINE_HOLD_MULTIPLIER
		);

		expect(result.bucketBound).toBe(true);
		// Casts minted, not fish landed: the old bug spent fuel on eight hours of
		// them and threw the catch away.
		const affordable = holdCount(state).div(modifiers.fishPerCast).plus(2);
		expect(state.totalCasts.lte(affordable)).toBe(true);
	});
});

describe('review: the warden collected a debt out of legal fish', () => {
	/**
	 * Someone working water they have no paper for. The rig, not the crew — a
	 * deckhand is hired at a source and there is no hiring one at water you do
	 * not own, so the crew never poach.
	 */
	function poacher(): GameState {
		const state = createInitialState();
		state.mapLevel = D(3);
		state.coins = D(1e9);
		state.hasAssistant = true;
		state.autoFisher = D(20);

		poachSource(state, POACHED_WATER);
		accumulate(state, computeModifiers(state), 30);
		return state;
	}

	const POACHED_WATER = FishingSources.Stream;

	// `state.poached` is a standing debt against species, and `confiscate`
	// settles it out of whatever is in the bucket at the time of the bust. It
	// used to survive a sale, so a poacher who sold on the way and kept fishing
	// carried the old debt to the bust and paid it with whatever the crew had
	// landed legally in the meantime.
	it('cannot confiscate a fish that has already been sold', () => {
		const state = poacher();
		expect(Object.keys(state.poached.fish).length).toBeGreaterThan(0);

		sellHold(state, computeModifiers(state));

		expect(Object.keys(state.poached.fish)).toHaveLength(0);
	});

	// `stopPoaching` promises the catch is yours. The debt outlived the visit,
	// and because the clock belongs to the water, coming back to the same spot
	// and being busted settled the old debt out of the new bucket.
	it('lets go of the catch when you pack up and walk away', () => {
		const state = poacher();
		stopPoaching(state);
		expect(Object.keys(state.poached.fish)).toHaveLength(0);
	});
});

describe('review: the guide named an upgrade nobody could buy', () => {
	// Cold Storage is a flat 250,000 and `upgradeCeiling` returns 0 for it until
	// the market opens, which makes it the cheapest thing on the board for most
	// of run 1 — and the Gear tab renders it disabled as "Not sold here".
	it('never points at a track above its shopkeeper ceiling', () => {
		const state = createInitialState();
		state.totalCasts = D(500);
		state.lifetimeCoins = D(1e6);
		state.autoFisher = D(1);
		state.licences.inland = true;
		state.licences.lakes = true;
		for (const source of [FishingSources.Pond, FishingSources.Stream, FishingSources.River]) {
			state.unlocked[source] = true;
		}
		state.deckhands[FishingSources.MudPool] = D(1);

		// Deep enough that every track the shopkeepers actually stock costs more
		// than Cold Storage's flat 250,000, which is the whole of the trap.
		state.upgrades.rod = D(8);
		state.upgrades.net = D(6);
		state.upgrades.lure = D(5);
		state.upgrades.market = D(6);
		state.upgrades.crew = D(3);

		// Enough to buy something, not enough to open the Lake.
		state.coins = D(300_000);

		expect(upgradeCeiling(state, 'storage')).toBe(0);
		expect(nextStep(state)?.text ?? '').not.toContain(UPGRADES.storage.name);
	});
});

describe('review: a thousand written the long way', () => {
	// The tier carry was skipped when there was no next suffix to carry into,
	// and then fell out of the branch and printed the uncarried string anyway.
	it('does not print a mantissa its own suffix cannot hold', () => {
		expect(formatNumber(999_999_000_000_000)).toBe('1.00e15');
		expect(formatNumber(999_999_999_999.9)).toBe('1.00T');
	});
});

// ---------------------------------------------------------------------------
// Round three: the full-branch review
// ---------------------------------------------------------------------------

describe('review: the poach clock walked onto water it had never been near', () => {
	// The clock belongs to the water, so packing up deliberately does not reset
	// it. It was keyed off `state.poaching`, which packing up *does* clear, so a
	// near-expired clock followed the player to a source they had just arrived
	// at — and `#keepFishable` and `claimLicence` pack up on the player's behalf.
	function unlicensed(): GameState {
		const state = createInitialState();
		state.mapLevel = D(3);
		state.coins = D(1_000_000);
		return state;
	}

	it('starts fresh at different water, even after packing up', () => {
		const state = unlicensed();
		poachSource(state, FishingSources.Stream);
		runPolice(state, computeModifiers(state), POACH_GRACE_SECONDS - 5);
		stopPoaching(state);

		poachSource(state, FishingSources.River);
		expect(state.poachElapsed).toBe(0);
		expect(runPolice(state, computeModifiers(state), 1)).toBeNull();
	});

	it('still refuses to forget the water you left, so the grace cannot be farmed', () => {
		const state = unlicensed();
		poachSource(state, FishingSources.Stream);
		runPolice(state, computeModifiers(state), POACH_GRACE_SECONDS - 5);
		stopPoaching(state);

		poachSource(state, FishingSources.Stream);
		expect(state.poachElapsed).toBeCloseTo(POACH_GRACE_SECONDS - 5, 6);
		expect(runPolice(state, computeModifiers(state), 6)).not.toBeNull();
	});

	it('carries the owner of the clock across a save', () => {
		const state = unlicensed();
		poachSource(state, FishingSources.Stream);
		runPolice(state, computeModifiers(state), 10);
		stopPoaching(state);

		const reloaded = fromRaw(JSON.parse(serialize(state)));
		expect(reloaded.poachClockAt).toBe(FishingSources.Stream);
	});
});

describe('review: a partial listing drowned the remainder', () => {
	// `fraction` was applied straight to each `FishType` bucket, and `readHold`
	// floors every bucket on load — so listing 3 of 5 fish and reloading lost 2.
	// Coming back from a night away the hold is `OFFLINE_HOLD_MULTIPLIER`
	// bucketfuls against one bucketful of quay, so every listing is a partial one.
	it('moves whole fish, and the count survives a reload', () => {
		const state = createInitialState();
		const cap = bucketCapacity(state.bucketLevel);
		state.hold[FishType.Small] = D(3);
		state.hold[FishType.Medium] = D(2);
		state.holdValue = D(500);
		state.consignment[FishType.Small] = cap.minus(3);

		const before = holdCount(state).plus(consignmentCount(state));
		listForSale(state);

		for (const type of FISH_TYPES) {
			expect(state.hold[type].eq(state.hold[type].floor())).toBe(true);
			expect(state.consignment[type].eq(state.consignment[type].floor())).toBe(true);
		}

		const reloaded = fromRaw(JSON.parse(serialize(state)));
		expect(holdCount(reloaded).plus(consignmentCount(reloaded)).toNumber()).toBe(before.toNumber());
	});
});

describe('review: hiring the Assistant stranded the quay', () => {
	// The merchant never calls again once there is an Assistant, `sell()` drains
	// only the hold, and `HoldPanel` hides the quay block outright — so listed
	// fish became unsellable *and* invisible in the same click.
	it('puts anything already listed back in the bucket', () => {
		const state = createInitialState();
		state.hold[FishType.Small] = D(20);
		state.holdValue = D(400);
		listForSale(state);
		expect(consignmentCount(state).toNumber()).toBe(20);

		state.coins = D(ASSISTANT_COST).times(2);
		// Rotate the cart until he is carrying one, without letting him call —
		// a visit would settle the consignment and hide the defect.
		while (!traderInStock(state, 'assistant')) state.traderVisits += 1;

		expect(buyAssistant(state)).toBe(true);
		expect(consignmentCount(state).toNumber()).toBe(0);
		expect(state.consignmentValue.toNumber()).toBe(0);
		expect(holdCount(state).toNumber()).toBe(20);
		expect(state.holdValue.toNumber()).toBe(400);
	});
});

describe('review: a manual cast on a full bucket bought fuel for nothing', () => {
	// Both `accumulate` loops were hardened against `routeCasts(spend = true)`
	// spending before the catch was clamped. `performCast` was the caller the
	// fix missed.
	it('does not burn fuel or wear the hull when there is nowhere to put a fish', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Ocean] = true;
		state.licences = { inland: true, lakes: true, coastal: true, deep: true };
		state.activeSource = FishingSources.Ocean;
		state.boat.owned = true;
		const modifiers = computeModifiers(state);
		state.boat.fuel = modifiers.fuelCapacity;
		state.boat.condition = 100;

		// Fill the bucket to the brim.
		state.hold[FishType.Small] = bucketCapacity(state.bucketLevel);

		const fuelBefore = state.boat.fuel;
		for (let i = 0; i < 50; i++) performCast(state, FishingSources.Ocean, modifiers);

		expect(state.boat.fuel.eq(fuelBefore)).toBe(true);
		expect(state.boat.condition).toBe(100);
	});
});

describe('review: the rod was declared finished while the hull was dragging', () => {
	// `computeModifiers` divides open-water cast times by `boatEfficiency`;
	// `rodClampLevel` did not, so it clamped at the level a pristine boat would
	// reach and refused to sell rods that genuinely still helped.
	it('a worn boat leaves rod levels worth buying', () => {
		const pristine = createInitialState();
		pristine.unlocked[FishingSources.Ocean] = true;
		pristine.licences = { inland: true, lakes: true, coastal: true, deep: true };
		pristine.boat.owned = true;
		pristine.boat.condition = 100;

		const worn = { ...pristine, boat: { ...pristine.boat, condition: 0 } };

		const clean = rodClampLevel(pristine);
		const dragging = rodClampLevel(worn);
		expect(clean).not.toBeNull();
		expect(dragging === null || dragging > (clean as number)).toBe(true);
	});
});

describe('review: Cold Storage claimed to be stocked one source deeper', () => {
	// `upgradeCeiling` gained a market gate for `storage`; `upgradeStockedAt` did
	// not, so the panel spent the whole first run naming a source that would not
	// sell it either.
	it('names nowhere while the market is shut', () => {
		const state = createInitialState();
		expect(upgradeCeiling(state, 'storage')).toBe(0);
		expect(upgradeStockedAt(state, 'storage')).toBeNull();
	});
});

describe('review: the guide answered "keep casting" to a full quay', () => {
	// Listing is what empties the bucket, so the empty-hold branch always fired
	// first and the quay line was unreachable.
	it('points at the quay once the catch is on it', () => {
		const state = createInitialState();
		state.totalCasts = D(5);
		state.hold[FishType.Small] = D(5);
		state.holdValue = D(50);
		listForSale(state);

		expect(holdCount(state).toNumber()).toBe(0);
		expect(nextStep(state)?.text ?? '').toContain('quay');
	});
});

describe('review: a market mark from the future froze every price', () => {
	// `settleMarket` refuses to move the mark backwards, so a stamp written by a
	// fast device clock stopped all recovery until real time caught up.
	it('clamps a stored mark to now', () => {
		const state = createInitialState();
		const raw = JSON.parse(serialize(state));
		raw.marketUpdatedAt = Date.now() + 24 * 60 * 60 * 1000;

		expect(fromRaw(raw).marketUpdatedAt).toBeLessThanOrEqual(Date.now());
	});
});

describe('review: listing part of the bucket paid for it twice', () => {
	/**
	 * `listForSale` moved `listed / held` of `holdValue` while `moveLedger` moved
	 * *whole* fish per species — so anything with fewer than `1/fraction` fish in
	 * it stayed entirely in the bucket while its share of the money left. The
	 * species ledger was then worth more than `holdValue`, and `holdMarketValue`
	 * prices the ledger and treats the difference as nothing: the bucket sold for
	 * the full catch and the quay was paid on top.
	 *
	 * R51 makes every listing a partial one — the night's hold is up to
	 * `OFFLINE_HOLD_MULTIPLIER` bucketfuls and the quay holds one.
	 */
	function singletons(): GameState {
		const state = createInitialState();
		const names = ['Guppy', 'Platy', 'Rosy Barb', 'Corydoras Catfish', 'Kuhli Loach'];
		for (const name of names) addToLedger(state.holdSpecies, name, D(1), D(2));
		state.hold[FishType.Small] = D(names.length);
		state.holdValue = D(names.length * 2);
		return state;
	}

	it('never leaves the bucket worth more than the coins say it is', () => {
		const state = singletons();

		listForSale(state, D(3));

		expect(ledgerWorth(state.holdSpecies).toNumber()).toBeLessThanOrEqual(
			state.holdValue.toNumber() + 1e-9
		);
	});

	it('pays the catch out exactly once across the bucket and the quay', () => {
		const state = singletons();
		const modifiers = computeModifiers(state);
		const before = state.holdValue;

		listForSale(state, D(3));
		const earned = sellHold(state, modifiers, TOWN_RATE).plus(
			settleConsignment(state, modifiers, TOWN_RATE)
		);

		expect(earned.toNumber()).toBeCloseTo(before.toNumber(), 6);
	});

	it('sends the money with the fish rather than stranding it either side', () => {
		const state = singletons();

		listForSale(state, D(3));

		expect(consignmentCount(state).toNumber()).toBe(3);
		expect(state.consignmentValue.toNumber()).toBeCloseTo(6, 6);
		expect(holdCount(state).toNumber()).toBe(2);
		expect(state.holdValue.toNumber()).toBeCloseTo(4, 6);
	});
});

describe('review: worthless fish moved a price nobody is ever paid', () => {
	// `fishTypeBaseValue[Jelly]` is 0, so `ledgerValue` skips a jelly while
	// `drainLedger` pressed its price anyway — putting it top of the price board
	// as the thing the player had "hurt" most, and spending the Cold Storage
	// depth bought to protect real fish.
	it('leaves the book alone when a sale realises nothing', () => {
		const state = createInitialState();
		state.prestigeCount = D(1);
		addToLedger(state.holdSpecies, 'Moon Jelly', D(5_000_000), D(0));
		addToLedger(state.holdSpecies, 'Guppy', D(1_000), D(2_000));
		state.hold[FishType.Jelly] = D(5_000_000);
		state.hold[FishType.Small] = D(1_000);
		state.holdValue = D(2_000);

		sellHold(state, computeModifiers(state), TOWN_RATE);

		expect(state.marketPressure['Moon Jelly']).toBeUndefined();
		expect(state.marketPressure['Guppy']?.toNumber()).toBe(1_000);
	});
});
