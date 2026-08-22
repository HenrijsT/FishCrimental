import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { D, isDecimalString, parseDecimal, parseDecimalOr } from './decimal';

describe('parseDecimal', () => {
	it('rejects the strings break_eternity silently mis-parses', () => {
		// new Decimal('banana') is 0, new Decimal('1e') is 1 — neither throws.
		expect(new Decimal('banana').toNumber()).toBe(0);
		expect(new Decimal('1e').toNumber()).toBe(1);

		expect(parseDecimal('banana')).toBeNull();
		expect(parseDecimal('1e')).toBeNull();
		expect(parseDecimal('')).toBeNull();
		expect(parseDecimal('  12  ')).toBeNull();
		expect(parseDecimal('12abc')).toBeNull();
		expect(parseDecimal('NaN')).toBeNull();
		expect(parseDecimal('Infinity')).toBeNull();
		expect(parseDecimal(null)).toBeNull();
		expect(parseDecimal(undefined)).toBeNull();
		expect(parseDecimal({})).toBeNull();
		expect(parseDecimal(Number.NaN)).toBeNull();
		expect(parseDecimal(Number.POSITIVE_INFINITY)).toBeNull();
	});

	it('accepts every form Decimal.toString() emits', () => {
		let value = D(1.5);
		for (let i = 0; i < 40; i++) {
			const serialised = value.toJSON();
			expect(isDecimalString(serialised)).toBe(true);

			const parsed = parseDecimal(serialised);
			expect(parsed).not.toBeNull();
			expect(parsed?.toJSON()).toBe(serialised);

			value = Decimal.pow(10, value.div(3).plus(2));
		}
	});

	it('round-trips ordinary values', () => {
		for (const raw of ['0', '-1', '1.5', '1e-7', '1e308', '1e400', 'ee300']) {
			const parsed = parseDecimal(raw);
			expect(parsed).not.toBeNull();
			expect(parsed?.toJSON()).toBe(new Decimal(raw).toJSON());
		}
	});

	it('falls back when asked to', () => {
		expect(parseDecimalOr('banana', 7).toNumber()).toBe(7);
		expect(parseDecimalOr('12', 7).toNumber()).toBe(12);
	});
});

describe('D', () => {
	it('always returns a fresh instance', () => {
		const source = D(5);
		const copy = D(source);
		expect(copy).not.toBe(source);
		expect(copy.eq(source)).toBe(true);
	});
});
