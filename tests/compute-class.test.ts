import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	classCategories,
	computeByCategory,
	computeClassRows,
	computeMonthlySeries,
	computeTopByClass,
	periodRange,
} from '../src/compute';
import type { Journal } from '../src/types';

function p(account: string, amount: number) {
	return { account, parts: account.split(':'), commodity: 'BRL', amount };
}

const journal: Journal = {
	commodities: ['BRL'],
	accounts: [],
	errors: [],
	transactions: [
		{ date: new Date(2026, 0, 5), description: 'Salary', status: 'unmarked', postings: [p('income:salary', -1000), p('assets:bank', 1000)] },
		{ date: new Date(2026, 1, 5), description: 'Freelance', status: 'unmarked', postings: [p('income:freelance', -300), p('assets:bank', 300)] },
		{ date: new Date(2026, 1, 10), description: 'Groceries', status: 'unmarked', postings: [p('expenses:food', 200), p('assets:bank', -200)] },
	],
};
const all = periodRange('all', new Date(2026, 1, 28));

describe('computeByCategory', () => {
	it('expense class uses positive amounts', () => {
		expect(computeByCategory(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense')).toEqual([
			{ label: 'expenses:food', value: 200 },
		]);
	});
	it('income class flips the sign to positive', () => {
		expect(computeByCategory(journal, 'BRL', DEFAULT_PREFIXES, all, 'income')).toEqual([
			{ label: 'income:salary', value: 1000 },
			{ label: 'income:freelance', value: 300 },
		]);
	});
	it('respects the account filter', () => {
		expect(
			computeByCategory(journal, 'BRL', DEFAULT_PREFIXES, all, 'income', 'income:salary'),
		).toEqual([{ label: 'income:salary', value: 1000 }]);
	});
});

describe('computeClassRows', () => {
	it('returns income rows positive, most-recent-first', () => {
		const rows = computeClassRows(journal, 'BRL', DEFAULT_PREFIXES, all, 'income');
		expect(rows).toHaveLength(2);
		expect(rows[0]!.description).toBe('Freelance');
		expect(rows[0]!.amount).toBe(300);
		expect(rows[1]!.amount).toBe(1000);
	});
});

describe('computeTopByClass', () => {
	it('returns the largest income, limited', () => {
		const t = computeTopByClass(journal, 'BRL', DEFAULT_PREFIXES, all, 'income', '', 1);
		expect(t).toHaveLength(1);
		expect(t[0]!.amount).toBe(1000);
	});
});

describe('classCategories', () => {
	it('lists income categories only, sorted', () => {
		expect(classCategories(journal, DEFAULT_PREFIXES, 'income')).toEqual([
			'income:freelance',
			'income:salary',
		]);
	});
});

describe('computeMonthlySeries', () => {
	it('sums per month for the class', () => {
		const inc = computeMonthlySeries(journal, 'BRL', DEFAULT_PREFIXES, all, 'income');
		expect(inc.labels).toEqual(['2026-01', '2026-02']);
		expect(inc.values).toEqual([1000, 300]);
		const exp = computeMonthlySeries(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense');
		expect(exp.values).toEqual([0, 200]);
	});
});
