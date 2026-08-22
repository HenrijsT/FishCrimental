import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { MAP_BASE_ERROR, MAP_MAX_LEVEL, SOURCE_ORDER } from './config';
import {
	buyMapUpgrade,
	chartedSources,
	createInitialState,
	mapAccuracy,
	mapCost,
	mapError,
	mapOffset,
	mapSight
} from './engine';
import { SCENES } from './scenes';
import type { GameState } from './types';

function openTo(upTo: FishingSources): GameState {
	const state = createInitialState();
	for (const source of SOURCE_ORDER) {
		state.unlocked[source] = true;
		if (source === upTo) break;
	}
	return state;
}

describe('the chart has a place for everywhere', () => {
	it('gives every source a position', () => {
		for (const source of SOURCE_ORDER) {
			const at = SCENES[source].at;
			expect(at.x).toBeGreaterThanOrEqual(0);
			expect(at.x).toBeLessThanOrEqual(1);
			expect(at.y).toBeGreaterThanOrEqual(0);
			expect(at.y).toBeLessThanOrEqual(1);
		}
	});

	it('puts no two places on top of each other', () => {
		for (let i = 0; i < SOURCE_ORDER.length; i++) {
			for (let j = i + 1; j < SOURCE_ORDER.length; j++) {
				const a = SCENES[SOURCE_ORDER[i]].at;
				const b = SCENES[SOURCE_ORDER[j]].at;
				expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.08);
			}
		}
	});

	it('walks generally outward, so the journey reads left to right', () => {
		const first = SCENES[SOURCE_ORDER[0]].at;
		const last = SCENES[SOURCE_ORDER[SOURCE_ORDER.length - 1]].at;
		expect(last.x).toBeGreaterThan(first.x);
	});
});

describe('a worse chart is wrong, not empty', () => {
	it('is least accurate at level 0 and exact at the top', () => {
		expect(mapAccuracy(0)).toBe(0);
		expect(mapAccuracy(MAP_MAX_LEVEL)).toBe(1);
		expect(mapError(0)).toBeCloseTo(MAP_BASE_ERROR, 9);
		expect(mapError(MAP_MAX_LEVEL)).toBe(0);
	});

	it('draws places away from where they are, and less so as it improves', () => {
		const state = createInitialState();
		let previous = Infinity;
		for (let level = 0; level <= MAP_MAX_LEVEL; level++) {
			const { dx, dy } = mapOffset(FishingSources.Pond, state.startedAt, level);
			const distance = Math.hypot(dx, dy);
			expect(distance).toBeLessThanOrEqual(previous + 1e-9);
			previous = distance;
		}
		expect(previous).toBe(0);
	});

	it('is wrong in the same way every time you look — a map you can learn', () => {
		const state = createInitialState();
		const a = mapOffset(FishingSources.Lake, state.startedAt, 1);
		const b = mapOffset(FishingSources.Lake, state.startedAt, 1);
		expect(a).toEqual(b);
	});

	it('is wrong differently for different saves', () => {
		const one = mapOffset(FishingSources.Lake, 1_000_000_000, 1);
		const two = mapOffset(FishingSources.Lake, 2_500_000_000, 1);
		expect(one).not.toEqual(two);
	});

	it('never displaces a place further than the paper allows', () => {
		for (const source of SOURCE_ORDER) {
			const { dx, dy } = mapOffset(source, 1_700_000_000_000, 0);
			expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(MAP_BASE_ERROR + 1e-9);
		}
	});
});

describe('what the chart shows', () => {
	it('never hides a place the player already owns', () => {
		// The map is a route to setSource. Hiding somewhere they own strands them.
		const state = openTo(FishingSources.Ocean);
		const charted = chartedSources(state);
		for (const source of SOURCE_ORDER) expect(charted).toContain(source);
	});

	it('shows a rumour of what is next, and no more, on the worst chart', () => {
		const state = createInitialState();
		expect(mapSight(0)).toBe(1);
		expect(chartedSources(state)).toEqual([SOURCE_ORDER[0], SOURCE_ORDER[1]]);
	});

	it('reaches further as the chart improves', () => {
		const state = createInitialState();
		const before = chartedSources(state).length;
		state.mapLevel = D(3);
		expect(chartedSources(state).length).toBeGreaterThan(before);
	});

	it('never runs past the end of the world', () => {
		const state = createInitialState();
		state.mapLevel = D(MAP_MAX_LEVEL);
		expect(chartedSources(state).length).toBeLessThanOrEqual(SOURCE_ORDER.length);
	});
});

describe('buying a better chart', () => {
	it('costs more each time and stops at the top', () => {
		for (let level = 0; level < MAP_MAX_LEVEL; level++) {
			expect(mapCost(level + 1).gt(mapCost(level))).toBe(true);
		}
		const state = createInitialState();
		state.mapLevel = D(MAP_MAX_LEVEL);
		state.coins = D('1e30');
		expect(buyMapUpgrade(state)).toBe(false);
	});

	it('takes the coins', () => {
		const state = createInitialState();
		state.coins = mapCost(0);
		expect(buyMapUpgrade(state)).toBe(true);
		expect(state.mapLevel.eq(1)).toBe(true);
		expect(state.coins.eq(0)).toBe(true);
	});

	it('is a coin purchase, so a prestige takes it', () => {
		const fresh = createInitialState({
			pearls: D(5),
			dex: {},
			allTimePearls: D(5),
			allTimeCoins: D('1e18'),
			prestigeCount: D(1),
			achievements: []
		});
		expect(fresh.mapLevel.eq(0)).toBe(true);
	});
});
