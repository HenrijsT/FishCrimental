import type Decimal from 'break_eternity.js';
import { D } from '$lib/decimal';

/**
 * Paradigm shift tiers (R61): **Storms**, **Bosses**, **Megalodon**.
 *
 * A shift should never read as "a shift" but as *which* shift. Trading the
 * operation in early is riding out a storm; later it is something that was
 * hunting you; at the end there is one thing left and it has a name.
 *
 * ### The deviation, recorded plainly
 *
 * `design/SHIFTS-SPEC.md` describes a whole unbuilt layer — around thirty-two
 * shifts a tier, deterministic thresholds, no player-pressed button. **None of
 * that exists, and no stage of this brief builds it.** In this codebase the
 * run-ending reset *is* the paradigm shift, and it is called a prestige.
 *
 * So the tier is **derived from `prestigeCount`** rather than stored. Deriving
 * beats storing here: `prestigeCount` is already persisted, so the tier is
 * already in the save by construction, there is no second field to keep honest,
 * and no migration. When the real layer lands it will still be counting shifts,
 * and this function will still be the one place that turns a count into a name.
 */

export type ShiftTier = 'storms' | 'bosses' | 'megalodon';

export interface TierDefinition {
	id: ShiftTier;
	/** What one shift of this tier is called. */
	singular: string;
	/** What the whole tier is called. */
	plural: string;
	/** How many shifts of this tier there are before the next one begins. */
	length: number;
	blurb: string;
}

/**
 * Thirty-two a tier, per the spec's arithmetic. Megalodon does not end.
 */
export const TIERS: TierDefinition[] = [
	{
		id: 'storms',
		singular: 'Storm',
		plural: 'Storms',
		length: 32,
		blurb: 'Weather you can only sit through. It takes the season and leaves you the boat.'
	},
	{
		id: 'bosses',
		singular: 'Boss',
		plural: 'Bosses',
		length: 32,
		blurb: 'Not weather. Something in the water that was looking for you specifically.'
	},
	{
		id: 'megalodon',
		singular: 'Megalodon',
		plural: 'Megalodon',
		length: Number.POSITIVE_INFINITY,
		blurb: 'There is one left. Nobody kills it on the first try, or the tenth.'
	}
];

/**
 * Which tier a shift falls in, and how far into it — the one walk of `TIERS`.
 *
 * The last tier is unbounded, so a count that runs off the end belongs to it
 * with whatever is left over as the index; that is what makes "Megalodon 3"
 * keep counting rather than stopping at the end of the table.
 */
function locate(prestigeCount: Decimal | number): { tier: TierDefinition; index: number } {
	const count = D(prestigeCount).toNumber();
	let remaining = Math.max(0, Math.floor(count));

	for (const tier of TIERS) {
		if (remaining < tier.length) return { tier, index: remaining };
		remaining -= tier.length;
	}
	return { tier: TIERS[TIERS.length - 1], index: remaining };
}

/** Which tier the *next* shift belongs to, given how many have been ridden out. */
export function tierFor(prestigeCount: Decimal | number): TierDefinition {
	return locate(prestigeCount).tier;
}

/** Where in its tier the next shift sits — "Storm 7", "Megalodon 3". */
export function shiftName(prestigeCount: Decimal | number): string {
	const { tier, index } = locate(prestigeCount);
	return `${tier.singular} ${index + 1}`;
}

/** The tier of the shift most recently ridden out, or null before the first. */
export function lastTier(prestigeCount: Decimal | number): TierDefinition | null {
	const count = D(prestigeCount).toNumber();
	if (count < 1) return null;
	return tierFor(count - 1);
}
