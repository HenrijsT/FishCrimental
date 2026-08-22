import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID, evaluateAchievements } from './achievements';
import { ALL_SPECIES, createInitialState, performPrestige } from './engine';
import { UPGRADES, UPGRADE_IDS } from './config';

describe('achievements', () => {
	it('have unique ids and no empty copy', () => {
		const ids = ACHIEVEMENTS.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);

		for (const achievement of ACHIEVEMENTS) {
			expect(achievement.name.length).toBeGreaterThan(2);
			expect(achievement.description.length).toBeGreaterThan(8);
		}
	});

	it('start with none earned', () => {
		const state = createInitialState();
		expect(evaluateAchievements(state)).toEqual([]);
		expect(state.achievements).toEqual([]);
	});

	it('award once and never again', () => {
		const state = createInitialState();
		state.totalCasts = D(1);

		expect(evaluateAchievements(state)).toContain('first_cast');
		expect(evaluateAchievements(state)).not.toContain('first_cast');
		expect(state.achievements.filter((id) => id === 'first_cast')).toHaveLength(1);
	});

	it('award several at once when several conditions land together', () => {
		const state = createInitialState();
		state.totalCasts = D(500);
		state.totalFish = D(5000);
		state.lifetimeCoins = D(1e7);
		state.coins = D(1e7);

		const fresh = evaluateAchievements(state);
		expect(fresh).toEqual(expect.arrayContaining(['first_cast', 'hundred_fish', 'millionaire']));
	});

	it('track the crew, the depth and the gear', () => {
		const state = createInitialState();
		state.deckhands[FishingSources.Pond] = D(30);
		state.unlocked[FishingSources.Sea] = true;
		state.upgrades.rod = D(UPGRADES.rod.maxLevel);
		for (const id of UPGRADE_IDS) state.upgrades[id] = D(1);
		state.upgrades.rod = D(UPGRADES.rod.maxLevel);

		const fresh = evaluateAchievements(state);
		expect(fresh).toEqual(
			expect.arrayContaining(['first_hand', 'idle_crew', 'reach_sea', 'maxed_rod', 'all_upgrades'])
		);
	});

	it('track the Fishdex', () => {
		const state = createInitialState();
		for (const fish of ALL_SPECIES) state.dex[fish.name] = D(1);

		const fresh = evaluateAchievements(state);
		expect(fresh).toContain('half_dex');
		expect(fresh).toContain('full_dex');
	});

	it('hide the Lipfish record until it happens', () => {
		expect(ACHIEVEMENTS_BY_ID.get('lipfish')?.secret).toBe(true);

		const state = createInitialState();
		expect(evaluateAchievements(state)).not.toContain('lipfish');

		for (const fish of ALL_SPECIES) {
			if (fish.category === FishType.Erotic) state.dex[fish.name] = D(1);
		}
		expect(evaluateAchievements(state)).toContain('lipfish');
	});

	it('survive a prestige', () => {
		const state = createInitialState();
		state.totalCasts = D(1);
		evaluateAchievements(state);

		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		performPrestige(state);

		expect(state.achievements).toContain('first_cast');
		expect(evaluateAchievements(state)).toContain('first_pearl');
	});
});

describe('the jellyfish gag', () => {
	it('fires only when the run reached the Ocean with no jellyfish at all', () => {
		const clean = createInitialState();
		clean.unlocked[FishingSources.Ocean] = true;
		clean.lifetimeCoins = D('1e16');
		expect(performPrestige(clean)?.jellyFree).toBe(true);

		const tainted = createInitialState();
		tainted.unlocked[FishingSources.Ocean] = true;
		tainted.lifetimeCoins = D('1e16');
		const jelly = ALL_SPECIES.find((fish) => fish.category === FishType.Jelly)!;
		tainted.dex[jelly.name] = D(1);
		expect(performPrestige(tainted)?.jellyFree).toBe(false);
	});

	it('counts a fractional jellyfish from the crew as a jellyfish caught', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		const jelly = ALL_SPECIES.find((fish) => fish.category === FishType.Jelly)!;
		state.dex[jelly.name] = D(1.5);
		expect(performPrestige(state)?.jellyFree).toBe(false);
	});

	it('is only offered once — the second prestige is not a first time', () => {
		const state = createInitialState();
		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		expect(performPrestige(state)?.firstTime).toBe(true);

		state.unlocked[FishingSources.Ocean] = true;
		state.lifetimeCoins = D('1e16');
		expect(performPrestige(state)?.firstTime).toBe(false);
	});

	it('leaves jellyfish genuinely worthless', () => {
		const jellies = ALL_SPECIES.filter((fish) => fish.category === FishType.Jelly);
		expect(jellies.length).toBeGreaterThan(0);
		for (const jelly of jellies) {
			expect(jelly.sources.length).toBeGreaterThan(0);
		}
	});
});
