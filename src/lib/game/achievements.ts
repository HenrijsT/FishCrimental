import { FishingSources } from '$lib/fishing_sources';
import { SOURCE_ORDER, UPGRADES, UPGRADE_IDS } from './config';
import { ALL_SPECIES, discoveredCount, eroticCaught, jellyCaught } from './engine';
import type { GameState } from './types';

export interface Achievement {
	id: string;
	name: string;
	description: string;
	/** Hidden until earned. */
	secret?: boolean;
	earned: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
	{
		id: 'first_cast',
		name: 'Wet Line',
		description: 'Make your first cast.',
		earned: (s) => s.totalCasts.gte(1)
	},
	{
		id: 'first_sale',
		name: 'Open for Business',
		description: 'Sell a hold of fish.',
		earned: (s) => s.lifetimeCoins.gte(1)
	},
	{
		id: 'hundred_fish',
		name: 'Bucket Filled',
		description: 'Land 100 fish in a single run.',
		earned: (s) => s.totalFish.gte(100)
	},
	{
		id: 'first_hand',
		name: 'All Hands',
		description: 'Hire your first deckhand.',
		earned: (s) => SOURCE_ORDER.some((source) => s.deckhands[source].gte(1))
	},
	{
		id: 'idle_crew',
		name: 'Hands Off',
		description: 'Have twenty-five deckhands working at once.',
		earned: (s) =>
			SOURCE_ORDER.reduce((total, source) => total + s.deckhands[source].toNumber(), 0) >= 25
	},
	{
		id: 'reach_sea',
		name: 'Salt in the Air',
		description: 'Unlock the Sea.',
		earned: (s) => s.unlocked[FishingSources.Sea]
	},
	{
		id: 'reach_ocean',
		name: 'Blue Water',
		description: 'Unlock the Ocean.',
		earned: (s) => s.unlocked[FishingSources.Ocean]
	},
	{
		id: 'millionaire',
		name: 'Seven Figures',
		description: 'Hold a million MarketCoins at once.',
		earned: (s) => s.coins.gte(1e6)
	},
	{
		id: 'billionaire',
		name: 'Fleet Owner',
		description: 'Hold a billion MarketCoins at once.',
		earned: (s) => s.coins.gte(1e9)
	},
	{
		id: 'maxed_rod',
		name: 'Nothing Left to Sharpen',
		description: `Take the ${UPGRADES.rod.name} to its last level.`,
		earned: (s) => s.upgrades.rod.gte(UPGRADES.rod.maxLevel)
	},
	{
		id: 'all_upgrades',
		name: 'Fully Kitted',
		description: 'Buy at least one level of every upgrade.',
		earned: (s) => UPGRADE_IDS.every((id) => s.upgrades[id].gte(1))
	},
	{
		id: 'half_dex',
		name: 'Half Known',
		description: 'Discover half of the Fishdex.',
		earned: (s) => discoveredCount(s) >= Math.ceil(ALL_SPECIES.length / 2)
	},
	{
		id: 'full_dex',
		name: 'Compleat Angler',
		description: 'Discover every species.',
		earned: (s) => discoveredCount(s) >= ALL_SPECIES.length
	},
	{
		id: 'first_pearl',
		name: 'Grit and Nacre',
		description: 'Prestige for the first time.',
		earned: (s) => s.prestigeCount.gte(1)
	},
	{
		id: 'pearl_diver',
		name: 'Pearl Diver',
		description: 'Bank a hundred Pearls across all runs.',
		earned: (s) => s.allTimePearls.gte(100)
	},
	{
		id: 'jelly_haul',
		name: 'Nuisance Catch',
		description: 'Land a thousand jellyfish. They are still worth nothing.',
		earned: (s) => jellyCaught(s).gte(1000)
	},
	{
		id: 'lipfish',
		name: 'It Winked',
		description: 'Land the Lovestruck Lipfish. Nobody has ever caught two.',
		secret: true,
		earned: (s) => eroticCaught(s).gte(1)
	}
];

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((entry) => [entry.id, entry]));

/**
 * Award anything newly earned and return the ids, so the UI can toast them.
 * Mutates `state.achievements`.
 */
export function evaluateAchievements(state: GameState): string[] {
	const earned = new Set(state.achievements);
	const fresh: string[] = [];

	for (const achievement of ACHIEVEMENTS) {
		if (earned.has(achievement.id)) continue;
		if (!achievement.earned(state)) continue;
		fresh.push(achievement.id);
		earned.add(achievement.id);
	}

	if (fresh.length) state.achievements = [...state.achievements, ...fresh];
	return fresh;
}
