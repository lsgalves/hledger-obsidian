import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/model';

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
});
