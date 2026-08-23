import Decimal from 'break_eternity.js';
import { LICENCES, type LicenceId } from './config';
import { catchTable, missingLicence, nextLockedSource } from './engine';
import { stopPoaching, trespass } from './police';
import { SOURCE_ORDER } from './config';
import type { ExamState, GameState } from './types';

/**
 * Licence examinations (R42, `design/IDEAS.md` N1).
 *
 * **A licence has no coin price at all.** The double gate — pay *and* pass —
 * was explicitly rejected: paying is the thing this game already does
 * everywhere, and a minigame you also have to buy your way into is a toll booth
 * with a puzzle on it.
 *
 * Four rules bind every exam here, and they are what keep mandatory active
 * content from being the genre's second-loudest complaint:
 *
 * 1. **Retryable and unlosable.** There is no fail state. An attempt either
 *    completes or is abandoned, and abandoning costs nothing but the attempt.
 * 2. **Short.** Minutes, not sessions.
 * 3. **Never a window you have to be present for.** Nothing expires on a
 *    wall-clock deadline, so putting the game down mid-exam is free.
 * 4. **The better you play, the faster you finish** — and never *only* by
 *    playing. Every exam here also completes if you simply leave the crew to
 *    it, slowly. That is what stops a skill wall from hard-stopping anyone, and
 *    it is the AFK track the design has wanted since N1, obtained for free
 *    rather than designed separately.
 *
 * Accessibility: no exam requires holding a button, a reaction time, or a
 * pointer. Every one of them is a small number of discrete choices, reachable
 * by keyboard.
 */

export type ExamKind = 'quota' | 'cull' | 'sounder' | 'longline';

export interface ExamDefinition {
	kind: ExamKind;
	name: string;
	/** What the examiner asks for. */
	brief: string;
	/** How many steps of progress it takes. */
	target: number;
}

/**
 * One exam per licence, and each one a different verb.
 *
 * The quota comes first because it needs no new mechanics at all — it reuses
 * casting, luck and the catch tables exactly as they are.
 */
export const EXAMS: Record<LicenceId, ExamDefinition> = {
	inland: {
		kind: 'quota',
		name: 'The Quota',
		brief:
			'The warden names a fish and a number. Land that many and the card is yours. Anything that lands counts — your rod, your crew, your ponds — so the only thing playing well buys you is finishing sooner.',
		target: 40
	},
	lakes: {
		kind: 'cull',
		name: 'The Cull',
		brief:
			'Standing water is managed water, and management means putting things back. Fish come up one at a time and you say keep or return. Get one wrong and the warden adds another to the pile — that is the whole penalty.',
		target: 14
	},
	coastal: {
		kind: 'sounder',
		name: 'The Sounder',
		brief:
			'Find the bottom, three times over. Call a depth and you are told deeper or shallower. Anyone gets there eventually; halving the range each time gets there in seven.',
		target: 3
	},
	deep: {
		kind: 'longline',
		name: 'The Long Line',
		brief:
			'Nobody charters a deep sea boat on a bucket of minnows. Land twenty-five fish that are actually worth the fuel — rare or better. Luck is what buys this one down.',
		target: 25
	}
};

/**
 * How often a fish has to turn up before the warden is allowed to name it.
 *
 * One in fifty. Below that a Quota stops being a task and becomes a wall — and
 * the Quota is one of the two exams that does not drip, so a wall there is a
 * wall for good.
 */
export const QUOTA_MIN_PROBABILITY = 0.02;

/** The deepest a sounder can be, and the range the first call sees. */
export const SOUNDER_MAX = 100;

/** What the warden wants kept in a Cull: everything at or above this. */
export const CULL_KEEP_FROM = 3;

/**
 * A Cull offer, as a bare number so it needs no fish data and no randomness at
 * read time. 1–5 is a size; the rule is "keep 3 and over".
 */
export const CULL_SIZES = [1, 2, 3, 4, 5] as const;

export function examFor(licence: LicenceId): ExamDefinition {
	return EXAMS[licence];
}

/**
 * Is this licence the one the player is allowed to sit for next?
 *
 * Two conditions, and the second is what stops the whole chain being cleared in
 * the first quarter of an hour. Without a price, nothing else held the exams
 * back: all four were sat and passed inside fourteen minutes, three of them
 * before the tenth, which is precisely the stretch of this game that can least
 * afford four minigames stacked on top of learning to fish.
 *
 * So: **you sit the exam when the water in front of you needs it.** The next
 * locked source has to be one this licence covers. That restores the paper gate
 * to where it always was, in time rather than in coins, and it means the exam
 * always arrives with a reason attached.
 */
export function canSit(state: GameState, licence: LicenceId): boolean {
	if (state.licences[licence]) return false;

	const required = LICENCES[licence].requires;
	if (required && state.licences[required] !== true) return false;

	const next = nextLockedSource(state);
	return next !== null && missingLicence(state, next) === licence;
}

/**
 * Open an attempt.
 *
 * `random` is injected so the examiner's choices are reproducible under test
 * and under the simulation.
 */
export function startExam(
	state: GameState,
	licence: LicenceId,
	random: () => number = Math.random
): boolean {
	if (!canSit(state, licence)) return false;

	const definition = examFor(licence);
	const exam: ExamState = {
		licence,
		kind: definition.kind,
		progress: 0,
		target: definition.target,
		attempts: 0
	};

	if (definition.kind === 'quota') exam.species = pickQuotaSpecies(state, random);
	if (definition.kind === 'cull') exam.offer = nextCullOffer(random);
	if (definition.kind === 'sounder') {
		exam.low = 1;
		exam.high = SOUNDER_MAX;
		exam.secret = 1 + Math.floor(random() * SOUNDER_MAX);
	}

	state.exam = exam;
	return true;
}

/** Walk away. Costs nothing — that is the point of the whole design. */
export function abandonExam(state: GameState): void {
	state.exam = null;
}

/**
 * The species the warden names for a quota.
 *
 * It has to be a fish the player can catch **right now** — not merely one they
 * have caught before. The Fishdex survives a prestige, so naming from it alone
 * let the warden ask a run-two player for an Ocean fish they had no licence,
 * no boat and no water for. The exam then never advanced, and because an exam
 * blocks the next one, the entire licence chain deadlocked behind it. That is
 * how the six-run simulation stopped at two.
 *
 * So the name comes from the catch tables of the water that is actually open
 * and legal, and only from species already in the Fishdex, so it is never a
 * hunt for something never seen. If that set is empty — the very first minutes,
 * before anything has been landed — the quota counts anything at all rather
 * than naming nothing and waiting forever.
 */
function pickQuotaSpecies(state: GameState, random: () => number): string | undefined {
	// Species name to the best chance it has at any water that is open and legal.
	const reachable = new Map<string, number>();

	for (const source of SOURCE_ORDER) {
		if (!state.unlocked[source]) continue;
		if (missingLicence(state, source)) continue;
		for (const entry of catchTable(source, 1).species) {
			const best = reachable.get(entry.fish.name) ?? 0;
			if (entry.probability > best) reachable.set(entry.fish.name, entry.probability);
		}
	}

	const known = [...reachable.entries()]
		.filter(([name]) => state.dex[name]?.gt(0))
		.sort((a, b) => (a[0] < b[0] ? -1 : 1));
	if (known.length === 0) return undefined;

	// And it has to be a fish that actually turns up.
	//
	// Picking uniformly over everything reachable meant a one-in-ten chance the
	// very first licence asked for forty Lovestruck Lipfish — probability
	// 1.1e-6, or about thirty-six million casts — and the Quota does not drip,
	// so the only escape was abandoning an attempt the panel never suggests
	// abandoning. The floor makes the ask a chore at worst.
	const common = known.filter(([, probability]) => probability >= QUOTA_MIN_PROBABILITY);
	const pool = common.length > 0 ? common : [known.reduce((a, b) => (a[1] >= b[1] ? a : b))];

	return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))][0];
}

function nextCullOffer(random: () => number): string {
	return String(CULL_SIZES[Math.floor(random() * CULL_SIZES.length)]);
}

/**
 * A fish landed while an exam is open.
 *
 * Called from `recordCatch`, which is the one place in the codebase that adds
 * to the hold — so every route a fish can arrive by is covered, and none of
 * them has to know an exam exists.
 */
export function examSawCatch(
	state: GameState,
	species: string,
	count: Decimal,
	rare: boolean
): void {
	const exam = state.exam;
	if (!exam || exam.progress >= exam.target) return;

	if (exam.kind === 'quota') {
		if (exam.species !== undefined && exam.species !== species) return;
	} else if (exam.kind === 'longline') {
		if (!rare) return;
	} else {
		return;
	}

	exam.progress = Math.min(exam.target, exam.progress + Math.floor(count.toNumber()));
}

/** Keep or return the fish in your hands. */
export function cullCall(
	state: GameState,
	keep: boolean,
	random: () => number = Math.random
): void {
	const exam = state.exam;
	if (!exam || exam.kind !== 'cull' || exam.offer === undefined) return;
	// A wrong call after the exam is already passed used to add to the target
	// and un-pass it, which is the one thing "never a step backwards" forbids.
	if (exam.progress >= exam.target) return;

	const size = Number(exam.offer);
	const shouldKeep = size >= CULL_KEEP_FROM;

	exam.attempts += 1;
	if (keep === shouldKeep) {
		exam.progress = Math.min(exam.target, exam.progress + 1);
	} else {
		// The whole penalty: one more fish in the pile. Never a step backwards,
		// because a wrong call that undid a right one would be a fail state
		// wearing a progress bar.
		exam.target += 1;
	}

	exam.offer = nextCullOffer(random);
}

/** Call a depth. Returns what the sounder says back. */
export function sounderCall(state: GameState, guess: number): 'deeper' | 'shallower' | 'found' {
	const exam = state.exam;
	if (!exam || exam.kind !== 'sounder' || exam.secret === undefined) return 'found';
	if (exam.progress >= exam.target) return 'found';
	// An emptied number field binds to `undefined`, and `Math.min(high, NaN)`
	// is `NaN` for the rest of the attempt — the range then reads "between 1 and
	// NaN" and the exam becomes unplayable by hand.
	if (!Number.isFinite(guess)) return guess === exam.secret ? 'found' : 'deeper';

	exam.attempts += 1;

	if (guess === exam.secret) {
		exam.progress = Math.min(exam.target, exam.progress + 1);
		// A new sounding, on fresh ground, unless that was the last one.
		if (exam.progress < exam.target) {
			exam.low = 1;
			exam.high = SOUNDER_MAX;
			exam.secret = 1 + Math.floor(Math.random() * SOUNDER_MAX);
		}
		return 'found';
	}

	if (guess < exam.secret) {
		exam.low = Math.max(exam.low ?? 1, guess + 1);
		return 'deeper';
	}

	exam.high = Math.min(exam.high ?? SOUNDER_MAX, guess - 1);
	return 'shallower';
}

export function examComplete(exam: ExamState | null): boolean {
	return exam !== null && exam.progress >= exam.target;
}

/**
 * Take the licence an exam was sat for.
 *
 * There is no coin cost anywhere in this path. The exam **is** the price.
 */
export function claimLicence(state: GameState): LicenceId | null {
	const exam = state.exam;
	if (!examComplete(exam) || !exam) return null;

	state.licences[exam.licence] = true;
	state.exam = null;

	// Paper in hand is not poaching any more.
	//
	// `state.poaching` outlived the licence that legalised it, so the warden
	// went on counting and eventually fined a player for water they now held a
	// card for. `settlePoachOnLoad` caught it on a reload, which is why "poach,
	// take the licence, reload" looked fine and "poach, take the licence, keep
	// playing" did not.
	if (state.poaching && !trespass(state, state.poaching)) stopPoaching(state);

	return exam.licence;
}

/**
 * How long the warden takes to work through the pile on their own.
 *
 * The Quota and the Long Line already complete without you — anything that
 * lands counts, including the crew's and the ponds'. The Cull and the Sounder
 * are pure decisions and would otherwise be the one place in the game where
 * *not* playing stops you dead, which is the thing this design refuses to be.
 *
 * So they drip. Twenty seconds a step is slow enough that clicking is plainly
 * better and fast enough that nobody is ever stuck: a ten-step Cull is three
 * minutes ignored against about fifteen seconds played. That is the whole rule
 * — *the better you play, the faster you finish* — expressed as a number.
 */
export const EXAM_IDLE_SECONDS = 20;

/**
 * What a step costs a player who is actually playing, per exam, for the
 * simulation.
 *
 * A Cull step is one call. A Sounder step is a whole sounding — about seven
 * calls if you bisect — so it costs seven times as much. The Quota and the Long
 * Line cost nothing here because they advance through `recordCatch` like every
 * other fish in the game.
 */
export const EXAM_SECONDS_PER_STEP: Record<ExamKind, number> = {
	quota: 0,
	longline: 0,
	cull: 2.5,
	sounder: 15
};

/**
 * Advance a hands-on exam by `seconds` of not being touched.
 *
 * Fractional seconds are banked on the exam rather than floored away. A tick is
 * a fifth of a second and a simulated step is one second; flooring either
 * against a twenty-second step means the exam never advances at all, which is
 * how this first shipped and how the whole licence chain stalled.
 */
export function advanceExamIdle(state: GameState, seconds: number, perCall?: number): void {
	const exam = state.exam;
	if (!exam || exam.progress >= exam.target) return;
	if (exam.kind !== 'cull' && exam.kind !== 'sounder') return;

	const step = perCall ?? EXAM_IDLE_SECONDS;
	if (seconds <= 0 || step <= 0) return;

	const banked = (exam.banked ?? 0) + seconds;
	const calls = Math.floor(banked / step);
	exam.banked = banked - calls * step;

	if (calls <= 0) return;
	exam.progress = Math.min(exam.target, exam.progress + calls);
	exam.attempts += calls;
}

/** An exam's progress, 0 to 1, for a bar. */
export function examProgress(exam: ExamState | null): number {
	if (!exam || exam.target <= 0) return 0;
	return Math.min(1, exam.progress / exam.target);
}
