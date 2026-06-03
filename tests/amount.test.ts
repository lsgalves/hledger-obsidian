import { describe, expect, it } from 'vitest';
import { parseAmount } from '../src/amount';

describe('parseAmount', () => {
	it('parses plain decimal with dot', () => {
		expect(parseAmount('7700.00')).toBe(7700);
	});

	it('parses Brazilian decimal comma', () => {
		expect(parseAmount('240,50')).toBe(240.5);
	});

	it('parses US thousands + dot decimal', () => {
		expect(parseAmount('1,234.56')).toBe(1234.56);
	});

	it('parses European thousands + comma decimal', () => {
		expect(parseAmount('1.234,56')).toBe(1234.56);
	});

	it('parses comma thousands without decimals', () => {
		expect(parseAmount('1,234')).toBe(1234);
		expect(parseAmount('1,234,567')).toBe(1234567);
	});

	it('applies the separate negative sign', () => {
		expect(parseAmount('1,234.56', '-')).toBe(-1234.56);
	});

	it('returns 0 for unparseable input', () => {
		expect(parseAmount('abc')).toBe(0);
	});
});
