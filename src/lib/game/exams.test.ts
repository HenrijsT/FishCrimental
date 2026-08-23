import { describe, expect, it } from 'vitest';
import { D } from '$lib/decimal';
import { FishingSources } from '$lib/fishing_sources';
import { LICENCE_IDS, SOURCE_LICENCE, SOURCE_ORDER } from './config';
import {
	CULL_KEEP_FROM,
	EXAMS,
	EXAM_IDLE_SECONDS,
	SOUNDER_MAX,
	abandonExam,
	advanceExamIdle,
	canSit,
	claimLicence,
	cullCall,
	examComplete,
	examProgress,
	sounderCall,
	startExam
} from './exams';
import { accumulate, computeModifiers, createInitialState } from './engine';
import { fromRaw, serialize } from './save';
import type { GameState } from './types';
import type { LicenceId } from './config';

/** Open every source up to, but not including, the first one `id` gates. */
function upTo(state: GameState, id: LicenceId): void {
	for (const source of SOURCE_ORDER) {
		if (SOURCE_LICENCE[source] === id) break;
		state.unlocked[source] = true;
	}
}

function sitting(id: LicenceId = 'inland', random = () => 0): GameState {
	const state = createInitialState();
	upTo(state, id);
	// The chain below this licence is already held — sitting one exam is not
	// what this helper is testing.
	for (const other of LICENCE_IDS) {
		if (other === id) break;
		state.licences[other] = true;
	}
	startExam(state, id, random);
	return state;
}

describe('what a licence costs', () => {
	it('is nothing, and there is no coin path left to find', () => {
		const state = sitting();
		const before = state.coins;

		state.exam!.progress = state.exam!.target;
		expect(claimLicence(state)).toBe('inland');
		expect(state.coins.eq(before)).toBe(true);
		expect(state.licences.inland).toBe(true);
	});

	it('is one exam per licence, and no two the same', () => {
		const kinds = LICENCE_IDS.map((id) => EXAMS[id].kind);
		expect(new Set(kinds).size).toBe(LICENCE_IDS.length);
	});
});

describe('an attempt is never lost', () => {
	it('can be walked away from for nothing', () => {
		const state = sitting();
		state.exam!.progress = 3;

		abandonExam(state);
		expect(state.exam).toBeNull();

		// And sat again immediately.
		expect(startExam(state, 'inland')).toBe(true);
		expect(state.exam!.progress).toBe(0);
	});

	it('does not survive a save, and does not need to', () => {
		const state = sitting();
		state.exam!.progress = 5;

		expect(fromRaw(JSON.parse(serialize(state))).exam).toBeNull();
	});

	it('never moves backwards, whatever the player does', () => {
		const state = sitting('lakes');
		upTo(state, 'lakes');
		state.exam!.offer = '5'; // a keeper

		cullCall(state, true, () => 0);
		const after = state.exam!.progress;
		expect(after).toBe(1);

		// A wrong call from here adds to the pile rather than taking any away.
		state.exam!.offer = '1';
		cullCall(state, true, () => 0);
		expect(state.exam!.progress).toBe(after);
		expect(state.exam!.target).toBe(EXAMS.lakes.target + 1);
	});
});

describe('the Quota', () => {
	it('counts anything that lands, including the crew', () => {
		const state = createInitialState();
		state.dex.Guppy = D(5);
		upTo(state, 'inland');
		state.deckhands[SOURCE_ORDER[0]] = D(50);
		startExam(state, 'inland', () => 0);
		const named = state.exam!.species;

		accumulate(state, computeModifiers(state), 600);

		// Either the named species landed, or none did — never a crash, and
		// never progress from a fish that was not asked for.
		if (named && state.dex[named].gt(5)) expect(state.exam!.progress).toBeGreaterThan(0);
	});

	/**
	 * The Fishdex survives a prestige and the water does not.
	 *
	 * Naming from the Fishdex alone let the warden ask a run-two player for an
	 * Ocean fish they had no licence, no boat and no water for. The exam never
	 * advanced, and because an open exam blocks the next one, the whole licence
	 * chain deadlocked behind it — which is how the six-run simulation stopped
	 * at two.
	 */
	it('never names a fish the player has no water for', () => {
		const state = createInitialState();
		// A veteran's Fishdex on a fresh run's water.
		state.dex.Megalodon = D(500);
		state.dex.Guppy = D(500);
		upTo(state, 'inland');

		startExam(state, 'inland', () => 0);
		expect(state.exam!.species).not.toBe('Megalodon');
	});

	it('counts anything at all when nothing has been landed yet', () => {
		const state = createInitialState();
		upTo(state, 'inland');
		startExam(state, 'inland', () => 0);
		expect(state.exam!.species).toBeUndefined();
	});
});

describe('the Cull', () => {
	it('rewards the right call and only lengthens the wrong one', () => {
		const state = sitting('lakes');
		const target = state.exam!.target;

		state.exam!.offer = String(CULL_KEEP_FROM);
		cullCall(state, true, () => 0);
		expect(state.exam!.progress).toBe(1);
		expect(state.exam!.target).toBe(target);

		state.exam!.offer = String(CULL_KEEP_FROM - 1);
		cullCall(state, true, () => 0);
		expect(state.exam!.progress).toBe(1);
		expect(state.exam!.target).toBe(target + 1);
	});

	it('always puts another fish in your hands', () => {
		const state = sitting('lakes');
		state.exam!.offer = '5';
		cullCall(state, false, () => 0.99);
		expect(state.exam!.offer).toBeDefined();
	});
});

describe('the Sounder', () => {
	it('tells you which way to go', () => {
		const state = sitting('coastal');
		state.exam!.secret = 50;

		expect(sounderCall(state, 10)).toBe('deeper');
		expect(sounderCall(state, 90)).toBe('shallower');
		expect(sounderCall(state, 50)).toBe('found');
	});

	it('narrows what is still possible, so bisecting works', () => {
		const state = sitting('coastal');
		state.exam!.secret = 50;

		sounderCall(state, 10);
		expect(state.exam!.low).toBe(11);
		sounderCall(state, 90);
		expect(state.exam!.high).toBe(89);
	});

	it('opens fresh ground after each sounding until the last', () => {
		const state = sitting('coastal');
		state.exam!.secret = 50;

		sounderCall(state, 50);
		expect(state.exam!.progress).toBe(1);
		expect(state.exam!.low).toBe(1);
		expect(state.exam!.high).toBe(SOUNDER_MAX);
		expect(examComplete(state.exam)).toBe(false);
	});

	it('finishes in about seven calls a sounding if you halve the range', () => {
		const state = sitting('coastal');
		state.exam!.secret = 73;

		let low = 1;
		let high = SOUNDER_MAX;
		let calls = 0;
		while (calls < 20) {
			const guess = Math.floor((low + high) / 2);
			const said = sounderCall(state, guess);
			calls += 1;
			if (said === 'found') break;
			if (said === 'deeper') low = guess + 1;
			else high = guess - 1;
		}

		expect(calls).toBeLessThanOrEqual(7);
	});
});

describe('nobody is ever stuck', () => {
	it('the warden works through a Cull on his own, slowly', () => {
		const state = sitting('lakes');
		const target = state.exam!.target;

		advanceExamIdle(state, EXAM_IDLE_SECONDS * target);
		expect(examComplete(state.exam)).toBe(true);
	});

	/**
	 * A tick is a fifth of a second and a simulated step is one. Flooring
	 * either against a twenty-second step advances nothing, ever — which is
	 * exactly how the licence chain first stalled.
	 */
	it('banks fractions of a step rather than flooring them away', () => {
		const state = sitting('lakes');
		for (let i = 0; i < EXAM_IDLE_SECONDS * 5; i++) advanceExamIdle(state, 1);
		expect(state.exam!.progress).toBe(5);
	});

	it('leaves the catch-driven exams to the fish', () => {
		const state = sitting('inland');
		advanceExamIdle(state, 100_000);
		expect(state.exam!.progress).toBe(0);
	});
});

describe('when an exam may be sat', () => {
	it('not before the water in front of you needs it', () => {
		const state = createInitialState();
		expect(canSit(state, 'inland')).toBe(false);
		upTo(state, 'inland');
		expect(canSit(state, 'inland')).toBe(true);
	});

	it('not out of order', () => {
		const state = createInitialState();
		for (const source of SOURCE_ORDER) state.unlocked[source] = source !== FishingSources.Ocean;
		// Every source but the Ocean is open, so only the deep charter is next —
		// and it still needs the coastal licence first.
		expect(canSit(state, 'deep')).toBe(false);
	});

	it('not one already held', () => {
		const state = sitting();
		state.exam!.progress = state.exam!.target;
		claimLicence(state);
		expect(canSit(state, 'inland')).toBe(false);
	});

	it('reports progress as a fraction, for a bar', () => {
		const state = sitting();
		expect(examProgress(state.exam)).toBe(0);
		state.exam!.progress = state.exam!.target;
		expect(examProgress(state.exam)).toBe(1);
	});
});
