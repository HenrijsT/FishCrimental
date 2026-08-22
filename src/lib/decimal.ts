import Decimal from 'break_eternity.js';

export type DecimalSource = Decimal | number | string;

/**
 * Short constructor. Always returns a **fresh** Decimal.
 *
 * break_eternity Decimals are mutable in place (`fromNumber`, `fromValue`,
 * `normalize`), so shared constants are a trap — never export `const ZERO`,
 * call `d0()` instead.
 */
export function D(value: DecimalSource = 0): Decimal {
	return new Decimal(value);
}

/** A fresh zero. */
export function d0(): Decimal {
	return new Decimal(0);
}

/** A fresh one. */
export function d1(): Decimal {
	return new Decimal(1);
}

/**
 * The exact grammar `Decimal.prototype.toString()` emits:
 *
 * - layer 0/1: `-?123`, `-?1.5`, `-?1e-7`, `-?1.23e4000`
 * - layer 2-5: `-?ee300`, `-?eeee17.13`
 * - layer 6+:  `-?(e^123)4.56`
 *
 * `new Decimal('banana')` returns 0 and `new Decimal('1e')` returns 1 rather
 * than throwing, so every string that comes off disk has to be matched against
 * this before it is parsed. `NaN` and `Infinity` are deliberately rejected.
 */
const DECIMAL_PATTERN = /^-?(?:e{1,5}|\(e\^\d+(?:\.\d+)?\))?-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/;

export function isDecimalString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && DECIMAL_PATTERN.test(value);
}

/**
 * Parse a Decimal that came from untrusted input (a save file, an import blob).
 * Returns `null` when the string is not something break_eternity actually
 * serialises — a `try`/`catch` would not help, because the failure mode is a
 * wrong answer rather than an exception.
 */
export function parseDecimal(value: unknown): Decimal | null {
	if (value instanceof Decimal) return new Decimal(value);
	if (typeof value === 'number') {
		return Number.isFinite(value) ? new Decimal(value) : null;
	}
	if (!isDecimalString(value)) return null;

	const parsed = new Decimal(value);
	if (parsed.isNan() || !parsed.isFinite()) return null;
	return parsed;
}

/** Parse with a fallback, for save fields that may legitimately be absent. */
export function parseDecimalOr(value: unknown, fallback: DecimalSource): Decimal {
	return parseDecimal(value) ?? new Decimal(fallback);
}

/** Clamp a Decimal into `[min, max]`. */
export function clampDecimal(value: Decimal, min: DecimalSource, max: DecimalSource): Decimal {
	return Decimal.min(Decimal.max(value, min), max);
}
