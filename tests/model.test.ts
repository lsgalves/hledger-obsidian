import { describe, expect, it } from 'vitest';
import { buildModel, normalizeCommodityFormats } from '../src/model';

const SAMPLE = `2026-01-05 Salário
    assets:bank          7700.00 BRL
    income:salary

2026/01/10 * Mercado
    expenses:food:groceries    240,50 BRL
    assets:bank
`;

describe('buildModel', () => {
	it('parses transactions sorted by date', () => {
		const j = buildModel(SAMPLE);
		expect(j.errors).toEqual([]);
		expect(j.transactions).toHaveLength(2);
		expect(j.transactions[0]!.date).toEqual(new Date(2026, 0, 5));
		expect(j.transactions[0]!.description).toBe('Salário');
		expect(j.transactions[1]!.status).toBe('cleared');
	});

	it('infers the elided posting amount per commodity', () => {
		const j = buildModel(SAMPLE);
		// Salário: income:salary is elided → -(7700) BRL
		const salary = j.transactions[0]!.postings.find(
			(p) => p.account === 'income:salary',
		);
		expect(salary).toBeDefined();
		expect(salary!.amount).toBe(-7700);
		expect(salary!.commodity).toBe('BRL');
		// Mercado: assets:bank elided → -(240.5) BRL
		const bank = j.transactions[1]!.postings.find(
			(p) => p.account === 'assets:bank',
		);
		expect(bank!.amount).toBe(-240.5);
	});

	it('collects distinct commodities and accounts', () => {
		const j = buildModel(SAMPLE);
		expect(j.commodities).toEqual(['BRL']);
		expect(j.accounts).toContain('expenses:food:groceries');
		expect(j.accounts).toContain('income:salary');
	});

	it('surfaces parser errors without throwing', () => {
		const j = buildModel('this is not @ valid journal $$$');
		expect(Array.isArray(j.errors)).toBe(true);
	});

	it('parses a number-first commodity directive format sample', () => {
		const j = buildModel(`commodity 1,000.00 EGP

2026-01-01 Test
    assets:cash     EGP 100.00
    equity:u        EGP -100.00
`);
		expect(j.errors).toEqual([]);
		expect(j.transactions).toHaveLength(1);
		expect(j.commodities).toEqual(['EGP']);
	});

	it('parses number-first D directives and format subdirectives', () => {
		const j = buildModel(`D 1,000.00 BRL

commodity EGP
  format 1,000.00 EGP  ; display sample

2026-01-01 Test
    assets:cash     EGP 100.00
    equity:u
`);
		expect(j.errors).toEqual([]);
		expect(j.transactions).toHaveLength(1);
	});

	it('reports an error instead of throwing when the parser crashes', () => {
		// Space-grouped digits in a number-first sample still crash
		// hledger-parser; the model must degrade to a warning.
		const j = buildModel('commodity 1 000,00 EGP\n');
		expect(j.transactions).toEqual([]);
		expect(j.errors).toHaveLength(1);
		expect(j.errors[0]).toContain('journal could not be parsed');
	});
});

describe('normalizeCommodityFormats', () => {
	it('swaps number-first samples to the symbol-first form', () => {
		expect(normalizeCommodityFormats('commodity 1,000.00 EGP')).toBe(
			'commodity EGP 1,000.00',
		);
		expect(normalizeCommodityFormats('D 1.000,00 BRL')).toBe('D BRL 1.000,00');
		expect(normalizeCommodityFormats('  format 1,000.00 EGP ; c')).toBe(
			'  format EGP 1,000.00 ; c',
		);
	});

	it('leaves symbol-first, bare, and quoted forms untouched', () => {
		for (const line of [
			'commodity EGP 1,000.00',
			'commodity $1,000.00',
			'commodity EGP',
			'commodity 1,000.00 "ABC DEF"',
			'2026-01-01 Test',
			'    assets:cash     EGP 100.00',
			'    assets:cash     100.00 EGP',
		]) {
			expect(normalizeCommodityFormats(line)).toBe(line);
		}
	});
});
