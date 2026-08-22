import { FishingSources } from '$lib/fishing_sources';
import {
	BOAT_COST,
	LICENCES,
	LICENCE_IDS,
	SOURCE_CONFIG,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	needsBoat
} from './config';
import {
	canBuyLicence,
	deckhandCost,
	discoveredCount,
	missingLicence,
	nextLockedSource,
	upgradeCost
} from './engine';
import type { GameState } from './types';

export interface TabDefinition {
	id: string;
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
		id: 'gear',
		label: 'Gear',
		blurb: 'Five pieces of kit. Every one of them multiplies, and they stack.',
		available: (state) => state.lifetimeCoins.gte(1)
	},
	{
		id: 'harbour',
		label: 'Harbour',
		blurb: 'Licences for better water, and the boat you need past the Sea.',
		available: (state) =>
			state.coins.gte(LICENCES.inland.cost * 0.5) ||
			LICENCE_IDS.some((id) => state.licences[id]) ||
			state.boat.owned
	},
	{
		id: 'crew',
		label: 'Crew',
		blurb: 'Deckhands fish for you, including while the game is closed.',
		available: (state) =>
			state.coins.gte(deckhandCost(FishingSources.Pond, 0).times(0.6)) ||
			SOURCE_ORDER.some((source) => state.deckhands[source].gt(0))
	},
	{
		id: 'dex',
		label: 'Fishdex',
		blurb: 'Every species you land is written up here, and pays a permanent bonus.',
		available: (state) => discoveredCount(state) >= 2
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
	tab?: string;
}

/**
 * The single next action, in one sentence. Deliberately never a list: the
 * point is to remove the question "what now?", not to replace it with six.
 */
export function nextStep(state: GameState): NextStep | null {
	if (state.totalCasts.lt(1)) {
		return { text: 'Hold the rod to cast a line. Let go to stop.' };
	}

	if (state.lifetimeCoins.lt(1)) {
		return { text: 'You have fish in the hold. Sell them for MarketCoins.' };
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

	const anyCrew = SOURCE_ORDER.some((source) => state.deckhands[source].gt(0));
	if (!anyCrew && state.coins.gte(deckhandCost(FishingSources.Pond, 0))) {
		return {
			text: 'You can afford a deckhand. They fish for you, even while the game is closed.',
			tab: 'crew'
		};
	}

	const next = nextLockedSource(state);

	if (next && missingLicence(state, next)) {
		const licence = missingLicence(state, next)!;
		const ready = canBuyLicence(state, licence);
		return {
			text: ready
				? `The ${next} needs the ${LICENCES[licence].name}. You can afford it.`
				: `The ${next} needs the ${LICENCES[licence].name}. Keep selling.`,
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

	if (state.boat.owned && state.boat.fuel.lte(0) && state.unlocked[SOURCE_ORDER[6]]) {
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

	if (next) {
		return {
			text: `Keep selling. The ${next} opens once you have enough put by.`,
			tab: 'water'
		};
	}

	return null;
}
