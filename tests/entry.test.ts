import { describe, expect, it } from 'vitest';
import { buildEntry, formatEntryAmount } from '../src/entry';

describe('formatEntryAmount', () => {
	it('prefixes a symbol commodity, comma decimal, 2 places', () => {
		expect(formatEntryAmount('32,03', 'R$')).toBe('R$32,03');
		expect(formatEntryAmount('1.234,56', '$')).toBe('$1234,56');
	});
	it('suffixes a letter-code commodity with a space', () => {
		expect(formatEntryAmount('1000', 'BRL')).toBe('1000,00 BRL');
	});
});

describe('buildEntry', () => {
	it('builds the date line and two indented postings, source elided', () => {
		const text = buildEntry({
			date: '2026-06-01',
			description: 'Clash of Clans Pass',
			category: 'expenses:games',
			amount: '32,03',
			commodity: 'R$',
			source: 'assets:bank:santander',
		});
		const lines = text.split('\n');
		expect(lines[0]).toBe('2026-06-01 Clash of Clans Pass');
		expect(/^ {4}expenses:games {2,}R\$32,03$/.test(lines[1]!)).toBe(true);
		expect(lines[2]).toBe('    assets:bank:santander');
		expect(text.endsWith('\n')).toBe(true);
	});
});
