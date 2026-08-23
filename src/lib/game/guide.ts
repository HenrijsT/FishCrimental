import { FishingSources } from '$lib/fishing_sources';
import {
	AUTO_FISHER,
	BOAT_COST,
	LICENCES,
	LICENCE_IDS,
	SOURCE_CONFIG,
	BUCKET_MAX_LEVEL,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	needsBoat
} from './config';
import {
	bucketCost,
	consignmentCount,
	consignmentRoom,
	deckhandCost,
	discoveredCount,
	holdCount,
	holdRoom,
	missingLicence,
	nextLockedSource,
	traderInStock,
	upgradeCost
} from './engine';
import { EXAMS, canSit } from './exams';
import type { GameState } from './types';

/**
 * Every tab in the game, in the order they appear.
 *
 * The ids used to be bare strings written out independently in five files, so
 * a typo navigated nowhere and nothing caught it at build time. `TabId` is the
 * single source; anything that routes to a tab takes it.
 */
export const TAB_IDS = [
	'water',
	'shore',
	'gear',
	'harbour',
	'crew',
	'market',
	'dex',
	'pearls',
	'records',
	'help',
	'settings'
] as const;

export type TabId = (typeof TAB_IDS)[number];

export interface TabDefinition {
	id: TabId;
	label: string;
	/** Shown the first time the tab appears. */
	blurb: string;
	/** A tab stays hidden until the player has a reason to open it. */
	available: (state: GameState) => boolean;
}

/**
 * Tabs arrive as they become relevant. A new player sees one tab and one
 * button; by the time the Pearls tab exists they already know what a deckhand
 * is. This is the onboarding — no tutorial modal, no wall of text.
 */
export const TABS: TabDefinition[] = [
	{
		id: 'water',
		label: 'Water',
		blurb: 'Pick where to fish. Deeper water is slower to work and pays far better.',
		available: () => true
	},
	{
		id: 'shore',
		label: 'Shore',
		blurb:
			'Where the catch turns into coins. The trader pays badly; getting to town yourself pays properly.',
		available: (state) => state.totalCasts.gte(3)
	},
	{
		id: 'gear',
		label: 'Gear',
		blurb: 'Five pieces of kit. Every one of them multiplies, and they stack.',
		available: (state) => state.lifetimeCoins.gte(1)
	},
	{
		id: 'harbour',
		label: 'Harbour',
		blurb: 'Licences you sit an exam for, and the boat you need past the Sea.',
		// When there is something to do here, and not before.
		//
		// A cast count opened it two minutes in, seven minutes before the player
		// could sit anything — a tab full of licences with "Not yet" against
		// every one of them, and a boat priced in the billions. Licences have no
		// price any more (R42), so there is not even a price to be saving toward.
		available: (state) =>
			state.exam !== null ||
			LICENCE_IDS.some((id) => state.licences[id] || canSit(state, id)) ||
			state.boat.owned
	},
	{
		id: 'crew',
		label: 'Crew',
		blurb:
			'Deckhands fish for you, and ponds breed one chosen fish. Both work while the game is closed.',
		available: (state) =>
			state.coins.gte(deckhandCost(SOURCE_ORDER[0], 0).times(0.6)) ||
			SOURCE_ORDER.some((source) => state.deckhands[source].gt(0))
	},
	{
		id: 'market',
		label: 'Market',
		blurb: 'Every species has its own price, and your own selling is what moves it.',
		// Only once there is a market to look at. Before the first paradigm
		// shift every price is 1 and the board would be a table of ones.
		available: (state) => state.prestigeCount.gt(0)
	},
	{
		id: 'dex',
		label: 'Fishdex',
		blurb: 'Every species you land is written up here, and pays a permanent bonus.',
		// One, not two. The first catch raises a toast that says "tap to see it",
		// and at a threshold of two that toast navigated to a tab that was not
		// there yet.
		available: (state) => discoveredCount(state) >= 1
	},
	{
		id: 'pearls',
		label: 'Pearls',
		blurb: 'Trade the whole run in for a permanent multiplier and a second upgrade tree.',
		available: (state) =>
			state.prestigeCount.gt(0) ||
			state.unlocked[FishingSources.Sea] ||
			state.lifetimeCoins.gte(1e9)
	},
	{
		id: 'records',
		label: 'Records',
		blurb: 'Milestones, and the log of everything you have done.',
		available: (state) => state.achievements.length > 0
	},
	{
		id: 'help',
		label: 'Help',
		blurb: 'What everything you have already got actually does.',
		// Not from the first second: there is nothing to explain before the
		// first cast, and a Help tab on an empty game is a wall of nothing.
		available: (state) => state.totalCasts.gte(3)
	},
	{
		id: 'settings',
		label: 'Settings',
		blurb: 'Offline progress, motion, notation, and your save.',
		available: (state) => state.totalCasts.gte(12)
	}
];

export function availableTabs(state: GameState): TabDefinition[] {
	return TABS.filter((tab) => tab.available(state));
}

export interface NextStep {
	/** The one thing to do now. */
	text: string;
	/** Where to do it. */
	tab?: TabId;
}

/**
 * Where an arrow key moves along the tab strip.
 *
 * A roving tabindex shipped without the key handler it requires, which left
 * seven of the eight tabs unreachable by keyboard — Settings, and everything
 * in it, was not reachable at all. Kept out of the component so it can be
 * tested without a DOM.
 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
	if (count <= 0 || index < 0) return null;
	const last = count - 1;

	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return index === last ? 0 : index + 1;
		case 'ArrowLeft':
		case 'ArrowUp':
			return index === 0 ? last : index - 1;
		case 'Home':
			return 0;
		case 'End':
			return last;
		default:
			return null;
	}
}

/**
 * The single next action, in one sentence. Deliberately never a list: the
 * point is to remove the question "what now?", not to replace it with six.
 */
/** Is a bigger bucket both available and affordable right now? */
function bucketWorthBuying(state: GameState): boolean {
	if (state.bucketLevel.gte(BUCKET_MAX_LEVEL)) return false;
	if (!traderInStock(state, 'bucket')) return false;
	return state.coins.gte(bucketCost(state.bucketLevel));
}

export function nextStep(state: GameState): NextStep | null {
	if (state.totalCasts.lt(1)) {
		return { text: 'Hold the rod to cast a line. Let go to stop.' };
	}

	// How you sell is the first question a new player has, and the answer
	// changed: there is a Sell button, and without an Assistant it *lists* the
	// catch rather than selling it. Saying "sell them" and leaving them to find
	// out that nothing happened for forty-five seconds is not an answer.
	if (state.lifetimeCoins.lt(1)) {
		if (holdCount(state).lte(0)) {
			return { text: 'Keep casting. Something will come up.' };
		}
		if (consignmentCount(state).gt(0)) {
			return {
				text: 'Your catch is on the quay. The travelling merchant settles it when he arrives.',
				tab: 'shore'
			};
		}
		return {
			text: 'There are fish in the bucket. List them, and the merchant pays for them when he comes past.',
			tab: 'shore'
		};
	}

	// A full bucket stops the crew as well as the player, and it is the single
	// most common way an opening stalls.
	const room = holdRoom(state);
	if (room !== null && room.lte(0)) {
		const crewed = SOURCE_ORDER.some((source) => state.deckhands[source].gt(0));
		return consignmentRoom(state)?.gt(0)
			? {
					text: crewed
						? 'The bucket is full and the crew have stopped with it. List the catch.'
						: 'The bucket is full and nothing else will fit. List the catch.',
					tab: 'shore'
				}
			: {
					text: 'The bucket and the quay are both full. Nothing else fits until the merchant comes.',
					tab: 'shore'
				};
	}

	const cheapest = UPGRADE_IDS.map((id) => ({
		id,
		cost: upgradeCost(id, state.upgrades[id])
	})).sort((a, b) => (a.cost.lt(b.cost) ? -1 : 1))[0];

	if (UPGRADE_IDS.every((id) => state.upgrades[id].eq(0)) && state.coins.gte(cheapest.cost)) {
		return {
			text: `You can afford the ${UPGRADES[cheapest.id].name}. Gear compounds — buy early.`,
			tab: 'gear'
		};
	}

	if (state.autoFisher.eq(0) && state.coins.gte(AUTO_FISHER.baseCost)) {
		return {
			text: `You can afford the ${AUTO_FISHER.name}. It holds the rod for you while you do something else.`,
			tab: 'gear'
		};
	}

	const anyCrew = SOURCE_ORDER.some((source) => state.deckhands[source].gt(0));
	if (!anyCrew && state.coins.gte(deckhandCost(SOURCE_ORDER[0], 0))) {
		return {
			text: 'You can afford a deckhand. They fish for you, even while the game is closed.',
			tab: 'crew'
		};
	}

	const next = nextLockedSource(state);

	if (next && missingLicence(state, next)) {
		const licence = missingLicence(state, next)!;
		const sitting = state.exam?.licence === licence;
		return {
			text: sitting
				? `You are sitting ${EXAMS[licence].name} for the ${LICENCES[licence].name}. Finish it and the ${next} opens.`
				: `The ${next} needs the ${LICENCES[licence].name}. It costs nothing — you sit an exam for it.`,
			tab: 'harbour'
		};
	}

	if (next && needsBoat(next) && !state.boat.owned) {
		return {
			text: state.coins.gte(BOAT_COST)
				? 'You can afford a boat. Open water is out of reach without one.'
				: 'The next water is out of reach from the shore. You need a boat.',
			tab: 'harbour'
		};
	}

	if (state.boat.owned && state.boat.fuel.lte(0) && state.unlocked[FishingSources.Offshore]) {
		return { text: 'The tank is empty, so the crew are working inshore. Fuel up.', tab: 'harbour' };
	}

	if (next && state.coins.gte(SOURCE_CONFIG[next].unlockCost)) {
		return { text: `You can open the ${next}. Deeper water pays far more per fish.`, tab: 'water' };
	}

	if (state.prestigeCount.eq(0) && state.unlocked[FishingSources.Ocean]) {
		return {
			text: 'The Ocean is open. Earn 1e15 coins in this run to trade it all in for Pearls.',
			tab: 'pearls'
		};
	}

	// The long middle of the opening act, where the answer is "keep going". Name
	// something they can actually do with the coins they have rather than
	// repeating the same line for eight minutes.
	if (next) {
		if (state.coins.gte(cheapest.cost)) {
			return {
				text: `You can afford the ${UPGRADES[cheapest.id].name}. Everything you buy makes the ${next} closer.`,
				tab: 'gear'
			};
		}
		if (!state.hasAssistant && bucketWorthBuying(state)) {
			return {
				text: `A bigger bucket first — a full one stops the crew too, and the ${next} is a while off yet.`,
				tab: 'shore'
			};
		}
		return {
			text: `Keep selling. The ${next} opens once you have enough put by.`,
			tab: 'water'
		};
	}

	return null;
}
