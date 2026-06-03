import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	computeAccountBalances,
	computeByCategory,
	computeRecentTransactions,
	computeSummary,
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
			date: new Date(2026, 0, 31),
			description: 'Salary',
			status: 'unmarked',
			postings: [p('assets:bank', 1000), p('income:salary', -1000)],
		},
		{
			date: new Date(2026, 1, 10),
			description: 'Groceries',
			status: 'unmarked',
			postings: [p('expenses:food', 300), p('assets:bank', -300)],
		},
		{
			date: new Date(2026, 1, 12),
			description: 'Bus',
			status: 'unmarked',
			postings: [p('expenses:transport', 50), p('assets:cash', -50)],
		},
	],
};

const all = periodRange('all', new Date(2026, 1, 28));

describe('computeSummary', () => {
	it('totals net worth, income, expenses, savings', () => {
		const s = computeSummary(journal, 'BRL', DEFAULT_PREFIXES, all);
		expect(s.netWorth).toBe(650); // 1000 - 300 - 50
		expect(s.income).toBe(1000);
		expect(s.expenses).toBe(350);
		expect(s.savings).toBe(650);
	});
});

describe('computeByCategory', () => {
	it('groups expenses by category, descending', () => {
		const c = computeByCategory(journal, 'BRL', DEFAULT_PREFIXES, all, 'expense');
		expect(c).toEqual([
			{ label: 'expenses:food', value: 300 },
			{ label: 'expenses:transport', value: 50 },
		]);
	});
});

describe('computeAccountBalances', () => {
	it('returns asset/liability balances sorted by magnitude', () => {
		const b = computeAccountBalances(journal, 'BRL', DEFAULT_PREFIXES, all);
		expect(b[0]).toEqual({ account: 'assets:bank', balance: 700 });
		expect(b).toContainEqual({ account: 'assets:cash', balance: -50 });
	});
});

describe('computeRecentTransactions', () => {
	it('returns most-recent-first asset cash deltas, limited', () => {
		const r = computeRecentTransactions(journal, 'BRL', DEFAULT_PREFIXES, all, 2);
		expect(r).toHaveLength(2);
		expect(r[0]!.description).toBe('Bus');
		expect(r[0]!.amount).toBe(-50);
		expect(r[1]!.description).toBe('Groceries');
	});
});

describe('account filter', () => {
	it('restricts categories to the selected account subtree', () => {
		const c = computeByCategory(
			journal,
			'BRL',
			DEFAULT_PREFIXES,
			all,
			'expense',
			'expenses:food',
		);
		expect(c).toEqual([{ label: 'expenses:food', value: 300 }]);
	});

	it('restricts balances to the selected account subtree', () => {
		const b = computeAccountBalances(
			journal,
			'BRL',
			DEFAULT_PREFIXES,
			all,
			'assets:bank',
		);
		expect(b).toEqual([{ account: 'assets:bank', balance: 700 }]);
	});

	it('keeps only transactions touching the filtered account, using its delta', () => {
		const r = computeRecentTransactions(
			journal,
			'BRL',
			DEFAULT_PREFIXES,
			all,
			10,
			'expenses:food',
		);
		expect(r).toHaveLength(1);
		expect(r[0]!.description).toBe('Groceries');
		expect(r[0]!.amount).toBe(300);
	});
});
