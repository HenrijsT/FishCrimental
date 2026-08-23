import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { ALL_SPECIES, createInitialState } from './engine';
import { HELP_TOPICS, availableTopics, livedSetbacks } from './help';
import { SETBACKS } from './setbacks';
import { TIERS, lastTier, shiftName, tierFor } from './shifts';
import { TAB_IDS, nextTabIndex } from './guide';

describe('the shift tiers have names (R61)', () => {
	it('are Storms, then Bosses, then Megalodon', () => {
		expect(TIERS.map((tier) => tier.id)).toEqual(['storms', 'bosses', 'megalodon']);
	});

	it('name the next shift, not just its tier', () => {
		expect(shiftName(0)).toBe('Storm 1');
		expect(shiftName(1)).toBe('Storm 2');
		expect(shiftName(31)).toBe('Storm 32');
		expect(shiftName(32)).toBe('Boss 1');
		expect(shiftName(63)).toBe('Boss 32');
		expect(shiftName(64)).toBe('Megalodon 1');
	});

	it('never run out — Megalodon does not end', () => {
		expect(tierFor(10_000).id).toBe('megalodon');
		expect(shiftName(10_000)).toBe('Megalodon 9937');
	});

	it('know which one was just ridden out, and that there was none before the first', () => {
		expect(lastTier(0)).toBeNull();
		expect(lastTier(1)!.id).toBe('storms');
		expect(lastTier(33)!.id).toBe('bosses');
	});

	it('read the same from a Decimal as from a number, since the save holds one', () => {
		expect(shiftName(D(40))).toBe(shiftName(40));
		expect(tierFor(D(40)).id).toBe(tierFor(40).id);
	});
});

describe('Help covers what you have, and nothing else (R55)', () => {
	it('shows almost nothing to a player who has not cast yet', () => {
		const topics = availableTopics(createInitialState());
		expect(topics.map((topic) => topic.id)).toEqual(['casting']);
	});

	it('does not mention the market, ponds or Pearls before the first shift', () => {
		const state = createInitialState();
		state.totalCasts = D(1_000);
		state.lifetimeCoins = D('1e12');
		const ids = availableTopics(state).map((topic) => topic.id);

		expect(ids).not.toContain('market');
		expect(ids).not.toContain('ponds');
	});

	it('opens up as the player does', () => {
		const state = createInitialState();
		state.totalCasts = D(1_000);
		state.prestigeCount = D(1);
		state.ponds = [{ species: null, level: D(0) }];
		state.boat.owned = true;

		const ids = availableTopics(state).map((topic) => topic.id);
		expect(ids).toContain('market');
		expect(ids).toContain('ponds');
		expect(ids).toContain('boat');
	});

	it('documents a Setback only once it has been lived through (R62)', () => {
		const state = createInitialState();
		state.totalCasts = D(1_000);
		expect(availableTopics(state).map((topic) => topic.id)).not.toContain('setbacks');

		state.setbacksSeen = [SETBACKS[0].id];
		expect(availableTopics(state).map((topic) => topic.id)).toContain('setbacks');
		expect(livedSetbacks(state)).toHaveLength(1);
		expect(livedSetbacks(state)[0].name).toBe(SETBACKS[0].name);
	});

	it('never leaves a topic without a body', () => {
		for (const topic of HELP_TOPICS) {
			expect(topic.title.length).toBeGreaterThan(3);
			expect(topic.body.length).toBeGreaterThan(0);
			for (const paragraph of topic.body) expect(paragraph.length).toBeGreaterThan(40);
		}
	});

	it('is a tab, and the tab strip can be walked from the keyboard', () => {
		expect(TAB_IDS).toContain('help');
		// The prerequisite R55 names: without this Help ships unreachable.
		expect(nextTabIndex('ArrowRight', 0, TAB_IDS.length)).toBe(1);
		expect(nextTabIndex('ArrowLeft', 0, TAB_IDS.length)).toBe(TAB_IDS.length - 1);
		expect(nextTabIndex('End', 0, TAB_IDS.length)).toBe(TAB_IDS.length - 1);
	});
});

/**
 * The 47 Fishdex descriptions, rewritten in voice.
 *
 * The failure mode is sameness, not offence, so what is asserted here is
 * variety rather than taste: no aquarium framing, nobody addressed as "you",
 * and no phrase long enough to be a tic repeated across entries.
 */
describe('the Fishdex is written by someone who has been wet', () => {
	const descriptions = ALL_SPECIES.map((fish) => fish.description);

	it('covers every species at a readable length', () => {
		expect(descriptions).toHaveLength(47);
		for (const description of descriptions) {
			expect(description.length).toBeGreaterThan(180);
			expect(description.length).toBeLessThan(270);
		}
	});

	it('has no aquarium in it', () => {
		for (const fish of ALL_SPECIES) {
			expect(fish.description).not.toMatch(/aquarium|fishkeep|hobbyist|tank/i);
		}
	});

	it('never addresses the reader', () => {
		for (const fish of ALL_SPECIES) {
			expect(fish.description).not.toMatch(/\byou\b|\byour\b/i);
		}
	});

	it('repeats no five-word phrase across two entries', () => {
		const seen = new Map<string, string>();
		for (const fish of ALL_SPECIES) {
			const words = fish.description.toLowerCase().match(/[a-z']+/g) ?? [];
			for (let i = 0; i + 5 <= words.length; i++) {
				const phrase = words.slice(i, i + 5).join(' ');
				const owner = seen.get(phrase);
				expect(owner ?? fish.name).toBe(fish.name);
				seen.set(phrase, fish.name);
			}
		}
	});

	it('opens forty-seven entries without leaning on one construction', () => {
		const openers = new Map<string, number>();
		for (const fish of ALL_SPECIES) {
			const first = fish.description.split(' ')[0].toLowerCase();
			openers.set(first, (openers.get(first) ?? 0) + 1);
		}
		for (const [, count] of openers) expect(count).toBeLessThanOrEqual(5);
	});
});
