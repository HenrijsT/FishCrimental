import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { describePerCast, formatDuration, formatInteger, formatNumber, formatRate } from './format';
import { D } from './decimal';

describe('formatNumber', () => {
	it('formats small values', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(1)).toBe('1');
		expect(formatNumber(999)).toBe('999');
		expect(formatNumber(12.5)).toBe('12.5');
		expect(formatNumber(-42)).toBe('-42');
	});

	it('uses K/M/B/T up to 1e15', () => {
		expect(formatNumber(1000)).toBe('1.00K');
		expect(formatNumber(1234)).toBe('1.23K');
		expect(formatNumber(1e6)).toBe('1.00M');
		expect(formatNumber(5.5e9)).toBe('5.50B');
		expect(formatNumber(9.87e12)).toBe('9.87T');
		expect(formatNumber(999e12)).toBe('999.00T');
	});

	it('switches to scientific at 1e15', () => {
		expect(formatNumber(1e15)).toBe('1.00e15');
		expect(formatNumber(1.234e18)).toBe('1.23e18');
		expect(formatNumber(D('1e308'))).toBe('1.00e308');
	});

	it('handles values past the double limit', () => {
		expect(formatNumber(D('1e400'))).toBe('1.00e400');
		expect(formatNumber(D('1e1e10'))).toBe('1.00e1.00e10');
	});

	it('formats layered values with stacked es', () => {
		const layer2 = D('1e1e300');
		expect(layer2.layer).toBe(2);
		expect(formatNumber(layer2)).toBe('ee300');

		const deep = Decimal.pow(10, D('1e1e300'));
		expect(formatNumber(deep).startsWith('ee')).toBe(true);
	});

	it('uses (e^n) past five layers', () => {
		let value = D(10);
		for (let i = 0; i < 8; i++) value = Decimal.pow(10, value);
		expect(value.layer).toBeGreaterThan(5);
		expect(formatNumber(value)).toMatch(/^\(e\^\d+\)/);
	});

	it('never returns an empty or NaN-looking string across many magnitudes', () => {
		let value = D(1);
		for (let i = 0; i < 60; i++) {
			const text = formatNumber(value);
			expect(text.length).toBeGreaterThan(0);
			expect(text).not.toContain('NaN');
			expect(text).not.toContain('undefined');
			expect(text).not.toContain('Infinity');
			value = value.times(D(10).pow(7));
		}
	});

	it('changes as it crosses a suffix boundary', () => {
		// 999,999 is deliberately absent: at two decimal places it rounds to
		// 1.00M, which is the same string as 1,000,000 and is the honest answer.
		// It used to render "1000.00K" — a thousand thousand, written the long
		// way — which is the defect the carry below exists to prevent.
		const samples = [999, 1000, 999_000, 1_000_000, 1e14, 1e15, 1e16];
		const seen = new Set(samples.map((s) => formatNumber(s)));
		expect(seen.size).toBe(samples.length);
	});

	it('carries the mantissa into the next suffix rather than overflowing it', () => {
		expect(formatNumber(999_999)).toBe('1.00M');
		expect(formatNumber(999_999_999)).toBe('1.00B');
		// And in scientific notation, where the same rounding overflows the
		// mantissa past ten instead of past a thousand.
		expect(formatNumber(9.9999e20, { notation: 'scientific' })).toBe('1.00e21');
	});

	it('honours precision', () => {
		expect(formatNumber(1234, { precision: 0 })).toBe('1K');
		expect(formatNumber(1234, { precision: 3 })).toBe('1.234K');
	});
});

describe('formatInteger', () => {
	it('groups thousands', () => {
		expect(formatInteger(1234)).toBe('1,234');
		expect(formatInteger(7)).toBe('7');
	});

	it('falls back to the short formatter when large', () => {
		expect(formatInteger(D('1e20'))).toBe('1.00e20');
	});
});

describe('formatRate / formatDuration', () => {
	it('suffixes rates', () => {
		expect(formatRate(1500)).toBe('1.50K/s');
	});

	it('formats durations', () => {
		expect(formatDuration(0.5)).toBe('0.5s');
		expect(formatDuration(45)).toBe('45s');
		expect(formatDuration(90)).toBe('1m 30s');
		expect(formatDuration(3661)).toBe('1h 1m');
		expect(formatDuration(90000)).toBe('1d 1h');
		expect(formatDuration(-1)).toBe('—');
	});
});

describe('scientific notation mode', () => {
	it('skips the K/M/B/T suffixes', () => {
		expect(formatNumber(1234, { notation: 'scientific' })).toBe('1.23e3');
		expect(formatNumber(5.5e9, { notation: 'scientific' })).toBe('5.50e9');
		expect(formatNumber(9.87e12, { notation: 'scientific' })).toBe('9.87e12');
	});

	it('leaves small numbers and layered values alone', () => {
		expect(formatNumber(42, { notation: 'scientific' })).toBe('42');
		expect(formatNumber(D('1e1e300'), { notation: 'scientific' })).toBe('ee300');
	});

	it('agrees with short notation above 1e15', () => {
		expect(formatNumber(1.5e18, { notation: 'scientific' })).toBe(formatNumber(1.5e18));
	});
});

describe('small nonzero values', () => {
	it('never renders something the player has as a flat zero', () => {
		for (const value of [1e-9, 2.09e-7, 1e-6, 0.001, 0.004, 0.0099]) {
			expect(formatNumber(value)).toBe('<0.01');
		}
	});

	it('still renders a real zero as zero', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(D(0))).toBe('0');
	});

	it('shows values it can render honestly', () => {
		expect(formatNumber(0.01)).toBe('0.01');
		expect(formatNumber(0.04)).toBe('0.04');
		expect(formatNumber(0.5)).toBe('0.5');
	});

	it('keeps the sign on tiny negatives', () => {
		expect(formatNumber(-0.004)).toBe('-<0.01');
	});
});

describe('describePerCast', () => {
	it('says a whole rate plainly', () => {
		expect(describePerCast(1)).toBe('1 fish a cast');
		expect(describePerCast(4)).toBe('4 fish a cast');
	});

	it('explains a fractional rate instead of showing a fraction of a fish', () => {
		expect(describePerCast(1.19)).toBe('1.19 fish a cast — 1 most casts, 2 about 19% of the time');
		expect(describePerCast(2.5)).toBe('2.5 fish a cast — 2 most casts, 3 about 50% of the time');
	});

	it('stops explaining once the number is big enough not to need it', () => {
		expect(describePerCast(1500)).toBe('1.50K fish a cast');
		expect(describePerCast(D('1e40'))).toBe('1.00e40 fish a cast');
	});

	it('never claims a fraction of a fish', () => {
		for (const rate of [1, 1.01, 1.19, 1.5, 1.99, 2, 7.77, 999.9]) {
			expect(describePerCast(rate)).not.toMatch(/\d\.\d+ fish\b(?! a cast)/);
		}
	});
});
