import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	computeDailyExpenses,
	computeClassRows,
	computeTopByClass,
	classCategories,
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
		{
			date: new Date(2026, 0, 5),
			description: 'Salary',
			status: 'unmarked',
			postings: [p('income:salary', -1000), p('assets:bank', 1000)],
		},
		{
			date: new Date(2026, 0, 10),
			description: 'Groceries',
			status: 'unmarked',
			postings: [p('expenses:food:groceries', 200), p('assets:bank', -200)],
		},
		{
			date: new Date(2026, 0, 10),
			description: 'Bus',
			status: 'unmarked',
			postings: [p('expenses:transport', 50), p('assets:cash', -50)],
		},
		{
			date: new Date(2026, 1, 3),
			description: 'Restaurant',
			status: 'unmarked',
			postings: [p('expenses:food:dining', 80), p('assets:cash', -80)],
		},
	],
};

const all = periodRange('all', new Date(2026, 1, 28));

describe('computeDailyExpenses', () => {
	it('sums expense postings per day', () => {
		const m = computeDailyExpenses(journal, 'BRL', DEFAULT_PREFIXES, all);
		expect(m.get('2026-01-10')).toBe(250); // 200 + 50
		expect(m.get('2026-02-03')).toBe(80);
		expect(m.has('2026-01-05')).toBe(false); // income, not expense
	});

	it('honors the category filter', () => {
		const m = computeDailyExpenses(journal, 'BRL', DEFAULT_PREFIXES, all, 'expenses:food');
		expect(m.get('2026-01-10')).toBe(200); // only food
		expect(m.get('2026-02-03')).toBe(80);
	});
});

describe('computeClassRows', () => {
	it('returns one row per expense posting, most-recent-first', () => {
		const rows = computeClassRows(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense');
		expect(rows).toHaveLength(3);
		expect(rows[0]!.category).toBe('expenses:food:dining');
		expect(rows[0]!.amount).toBe(80);
		expect(rows[2]!.category).toBe('expenses:food:groceries');
	});

	it('honors the category filter', () => {
		const rows = computeClassRows(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense', 'expenses:transport');
		expect(rows).toHaveLength(1);
		expect(rows[0]!.description).toBe('Bus');
	});
});

describe('classCategories', () => {
	it('lists every expense category level (depth >= 2), distinct and sorted', () => {
		expect(classCategories(journal, DEFAULT_PREFIXES, 'expense')).toEqual([
			'expenses:food',
			'expenses:food:dining',
			'expenses:food:groceries',
			'expenses:transport',
		]);
	});
});

describe('computeTopByClass', () => {
	it('returns the largest expenses descending, limited', () => {
		const t = computeTopByClass(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense', '', 2);
		expect(t).toHaveLength(2);
		expect(t[0]!.amount).toBe(200);
		expect(t[1]!.amount).toBe(80);
	});
});
