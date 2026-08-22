import Decimal from 'break_eternity.js';
import { D, type DecimalSource } from './decimal';

const SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T'];

export interface FormatOptions {
	/** Digits after the decimal point in the mantissa. Default 2. */
	precision?: number;
	/** Digits used below 1000. Default 0 for integers, `precision` otherwise. */
	smallPrecision?: number;
}

function trimTrailingZeros(text: string): string {
	if (!text.includes('.')) return text;
	return text.replace(/\.?0+$/, '');
}

/**
 * Exponents are rendered as plain digits while they stay readable, then in
 * scientific notation themselves — `1.00e1.00e10`, never `1.00e10.00B`.
 */
function formatPlainExponent(exponent: number, precision: number): string {
	if (Math.abs(exponent) < 1e6) return String(Math.round(exponent));

	const inner = Math.floor(Math.log10(Math.abs(exponent)));
	const mantissa = exponent / Math.pow(10, inner);
	return `${mantissa.toFixed(precision)}e${inner}`;
}

/**
 * The single formatter every displayed number goes through.
 *
 * `1.23K` / `4.56M` / `7.89B` / `1.00T` up to 1e15, then scientific
 * (`3.21e18`), then e-stacked layered notation (`ee1.50e6`, `(e^12)3.40`).
 */
export function formatNumber(value: DecimalSource, options: FormatOptions = {}): string {
	const precision = options.precision ?? 2;
	const d = value instanceof Decimal ? value : D(value);

	if (d.isNan()) return 'NaN';
	if (!d.isFinite()) return d.sign < 0 ? '-Infinity' : 'Infinity';
	if (d.sign < 0) return `-${formatNumber(d.neg(), options)}`;
	if (d.sign === 0) return '0';

	// Layer 2+ — e-stacked notation.
	if (d.layer >= 2) {
		const prefix = d.layer <= 5 ? 'e'.repeat(d.layer) : `(e^${d.layer})`;
		return prefix + formatNumber(d.mag, { precision });
	}

	// Layer 1 — mag *is* the base-10 exponent.
	if (d.layer === 1) {
		const exponent = Math.floor(d.mag);
		const mantissa = Math.pow(10, d.mag - exponent);
		return `${mantissa.toFixed(precision)}e${formatPlainExponent(exponent, precision)}`;
	}

	const magnitude = d.mag;

	if (magnitude < 1e-6) return `${magnitude.toExponential(precision)}`;

	if (magnitude < 1000) {
		const smallPrecision =
			options.smallPrecision ?? (Number.isInteger(magnitude) ? 0 : Math.max(precision, 1));
		return trimTrailingZeros(magnitude.toFixed(smallPrecision));
	}

	const exponent = Math.floor(Math.log10(magnitude));

	if (exponent < 15) {
		const tier = Math.floor(exponent / 3);
		const mantissa = magnitude / Math.pow(1000, tier);
		return `${mantissa.toFixed(precision)}${SHORT_SUFFIXES[tier]}`;
	}

	const mantissa = magnitude / Math.pow(10, exponent);
	return `${mantissa.toFixed(precision)}e${exponent}`;
}

/** Whole numbers with thousands separators, for small counts. */
export function formatInteger(value: DecimalSource): string {
	const d = value instanceof Decimal ? value : D(value);
	if (d.layer === 0 && Math.abs(d.mag) < 1e6) {
		return Math.floor(d.toNumber()).toLocaleString('en-US');
	}
	return formatNumber(d);
}

/** `1.4/s`, `230K/s`. */
export function formatRate(value: DecimalSource): string {
	return `${formatNumber(value)}/s`;
}

/** `2h 13m`, `45s`, `1.2s`. */
export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	if (seconds < 10) return `${trimTrailingZeros(seconds.toFixed(1))}s`;

	const total = Math.floor(seconds);
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;

	const parts: string[] = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);
	if (!days && !hours && secs) parts.push(`${secs}s`);

	return parts.join(' ') || '0s';
}

/** `+12.5%`, `×3.40`. */
export function formatMultiplier(value: DecimalSource): string {
	return `×${formatNumber(value)}`;
}

export function formatPercent(fraction: number, precision = 0): string {
	return `${(fraction * 100).toFixed(precision)}%`;
}
