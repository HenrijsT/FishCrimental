import { FishingSources } from '$lib/fishing_sources';
import {
	MARKET_HALF_LIFE,
	OFFLINE_FUEL_SHARE,
	OFFLINE_HOLD_MULTIPLIER,
	POACH_BUSTED_SECONDS,
	POACH_GRACE_SECONDS,
	POND_MAX,
	SOURCE_ORDER,
	TOWN_TRIP_SECONDS,
	TRADER_RATE
} from './config';
import { SETBACKS_BY_ID } from './setbacks';
import type { GameState } from './types';

/**
 * The Help surface (R55).
 *
 * **It covers only what the player has already unlocked**, and that is the
 * whole design. It is deliberately not `guide.ts`, which answers a different
 * question: `guide.ts` says *what to do next*, one line at a time, and vanishes
 * as soon as you do it. This says *what the thing you already have actually
 * does*, and stays.
 *
 * A wiki tells you about systems you have not met, which is how a wiki spoils a
 * game. Nothing here appears before the player has met it, so reading the whole
 * of Help at any moment is a complete and accurate account of the game they are
 * currently playing — and nothing more.
 *
 * Setbacks appear here once lived through (R62), which is the only record of
 * them a player gets besides the achievement.
 */

export interface HelpTopic {
	id: string;
	title: string;
	/** One paragraph per entry. Kept short — this is a reference, not an essay. */
	body: string[];
	available: (state: GameState) => boolean;
}

const anyCrew = (state: GameState) => SOURCE_ORDER.some((source) => state.deckhands[source].gt(0));

export const HELP_TOPICS: HelpTopic[] = [
	{
		id: 'casting',
		title: 'Holding the rod',
		body: [
			'Press and hold to cast. The bar fills, the line lands, and whatever was down there comes up. Faster gear means a shorter bar, not a bigger fish.',
			'Where you are standing decides what you catch and what it is worth. Deeper water is slower to work and pays hundreds of times better.'
		],
		available: () => true
	},
	{
		id: 'bucket',
		title: 'The bucket',
		body: [
			'You carry what you can carry. When the bucket is full nothing else fits, and the crew stop too — a full bucket stops the whole operation, not just you.',
			'A bigger bucket is bought from the travelling merchant. An Assistant does away with the limit entirely, which is what makes one worth hiring.'
		],
		available: (state) => state.totalCasts.gte(3)
	},
	{
		id: 'selling',
		title: 'Selling, and who buys',
		body: [
			`There is always a Sell button. Without an Assistant it does not sell — it *lists* the catch on the quay for the travelling merchant, who pays ${Math.round(TRADER_RATE * 100)}% of what it is worth when he next comes past.`,
			'Listing takes the fish out of the bucket immediately, which is the point: you get the room back now and the coins later. The quay holds one bucketful.',
			`With a bicycle you can take it in yourself for the full price, bucket and quay together, at the cost of ${TOWN_TRIP_SECONDS} seconds off the water. Listing starts the merchant's clock, so that is a race.`,
			'Nothing is sold while the game is shut. The catch sits and waits for you.'
		],
		available: (state) => state.totalCasts.gte(3)
	},
	{
		id: 'offline',
		title: 'While you are away',
		body: [
			'The crew fish and the ponds fill. Nothing else happens: nobody sells, no merchant calls, and no decision is taken for you.',
			`What you come back to is fish, not coins. The keepnet holds ${OFFLINE_HOLD_MULTIPLIER} bucketfuls, so a bigger bucket is a bigger night.`
		],
		available: (state) => anyCrew(state)
	},
	{
		id: 'crew',
		title: 'Deckhands',
		body: [
			'A deckhand works one source, on their own, whether or not you are watching. They are the reason this game plays itself eventually.',
			'They are bought per source and they are not transferable. A deckhand at the Pond is a Pond deckhand for ever.'
		],
		available: (state) => anyCrew(state) || state.lifetimeCoins.gte(40)
	},
	{
		id: 'licences',
		title: 'Licences',
		body: [
			'Moving water and salt water need paper, and paper cannot be bought. You sit an examination for it, and there is no fee of any kind.',
			'Every examination is free to attempt, free to abandon, and impossible to fail — the worst that can happen is that it takes longer. Playing well finishes it sooner; ignoring it finishes it eventually.',
			'You may only sit for the licence the water in front of you actually needs.'
		],
		available: (state) => state.exam !== null || Object.values(state.licences).some(Boolean)
	},
	{
		id: 'poaching',
		title: 'Fishing without paper',
		body: [
			`It works, and it pays, for exactly ${POACH_GRACE_SECONDS} seconds. Then a warden arrives. It is not a gamble — the clock is the same every time and it is on screen.`,
			// Not "the first time is a warning": `POACH_FINE_STEPS[0]` is 0.1, and
			// `config.ts` says in as many words that the first offence is not free.
			// Help is the one surface that has to describe the game the player is
			// actually playing.
			`He takes everything you landed there, fines a share of your coins, and puts you ashore for ${POACH_BUSTED_SECONDS} seconds. Your legal fish are not touched, but there is no free first offence.`,
			'The fine is a percentage, and it goes up each time at the same water. It can never take your last coin, and it can never leave a boat owner short of a tank of fuel.'
		],
		available: (state) => state.poaching !== null || Object.keys(state.poachOffences).length > 0
	},
	{
		id: 'boat',
		title: 'The boat',
		body: [
			'Past the Sea there is no bank to stand on. The boat burns fuel per cast and wears out, and a worn hull slows every cast in open water — for the crew as well as for you.',
			`A standing order buys fuel automatically out of coins, including while you are away. While you are away it may spend at most ${Math.round(OFFLINE_FUEL_SHARE * 100)}% of what you left in the purse.`,
			'A dry tank never strands the crew: the casts the boat cannot cover are worked from the shore instead, at shore money.'
		],
		available: (state) => state.boat.owned
	},
	{
		id: 'ponds',
		title: 'Ponds',
		body: [
			`A pond breeds one species — whichever one you stock it with, from anything you have already caught. Restocking is free and takes effect at once. There is room for ${POND_MAX}.`,
			'A pond is a machine for producing one fish, and the market charges for exactly that. Six ponds on one species will walk its price down all run. Spread them, or leave one fallow while the price recovers.'
		],
		available: (state) => state.ponds.length > 0
	},
	{
		id: 'market',
		title: 'The market',
		body: [
			`Every species has its own price, and your own selling is what moves it. Sell a lot of one fish and that fish is worth less; leave it alone and the price comes back — half of the damage undone every ${MARKET_HALF_LIFE / 60} minutes.`,
			'Everything you have ever caught also makes you permanently better at catching it, and that part is never lost, not even to a paradigm shift. The price penalty resets every shift and has to be earned back. That asymmetry is the whole mechanic.',
			'Selling as you go and selling in one lump are worth exactly the same. A sale is priced fish by fish as it moves the price, so sitting on a full bucket waiting for a number to rise costs you the fishing and gains you nothing.',
			'Cold Storage buys depth — how much selling it takes to move a price at all. It is the answer to a growing operation walking down its own prices.'
		],
		available: (state) => state.prestigeCount.gt(0)
	},
	{
		id: 'pearls',
		title: 'Pearls and paradigm shifts',
		body: [
			'Reach the Ocean, earn enough across one run, and you can trade the whole operation in. You keep the Fishdex, the Pearls, and everything bought with Pearls. The coins, the gear, the crew, the boat and the ponds go.',
			'Held Pearls are worth a permanent multiplier on every sale, whether you spend them or not — but the bonus grows with the logarithm of the pile, so the pile has to get ten times bigger to move it a fixed step. Spending them is where the real gains are.',
			'Shifts come in three tiers: Storms first, then Bosses, then Megalodon. Each is deeper water than the last.'
		],
		available: (state) => state.prestigeCount.gt(0) || state.unlocked[FishingSources.Sea]
	},
	{
		id: 'setbacks',
		title: 'Setbacks',
		body: [
			'A Setback is a bad day that happens once and never again. It is not a punishment and it is not a fail state — nothing you can do makes one more or less likely, and none of them is random.',
			'Each one starts when you reach a milestone and lands when you reach the next. The longer you take between the two, the harder it lands, and you are always told when the clock has started.',
			'What it takes is a fixed number of seconds of your income. It takes some upgrade levels for effect and hands back in coins anything those levels were worth beyond the damage.'
		],
		available: (state) => state.setbacksSeen.length > 0
	}
];

/** Everything the player has met, in the order it is written. */
export function availableTopics(state: GameState): HelpTopic[] {
	return HELP_TOPICS.filter((topic) => topic.available(state));
}

/**
 * The Setbacks this player has lived through, written up.
 *
 * Generated from `setbacksSeen` rather than listed, so a Setback documents
 * itself and there is no second list to forget (R62).
 */
export function livedSetbacks(state: GameState): { name: string; blow: string }[] {
	return state.setbacksSeen
		.map((id) => SETBACKS_BY_ID.get(id))
		.filter((setback) => setback !== undefined)
		.map((setback) => ({ name: setback.name, blow: setback.blow }));
}
