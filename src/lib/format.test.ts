import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { formatDuration, formatInteger, formatNumber, formatRate } from './format';
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

	it('stays monotonic across the suffix boundaries', () => {
		const samples = [999, 1000, 999_999, 1_000_000, 1e14, 1e15, 1e16];
		const seen = new Set(samples.map((s) => formatNumber(s)));
		expect(seen.size).toBe(samples.length);
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
