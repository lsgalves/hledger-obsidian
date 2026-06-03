import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	computeIncomeExpenseSeries,
	computeNetWorthSeries,
	monthsInWindow,
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
			description: 'Jan salary',
			status: 'unmarked',
			postings: [p('assets:bank', 1000), p('income:salary', -1000)],
		},
		{
			date: new Date(2026, 1, 10),
			description: 'Feb groceries',
			status: 'unmarked',
			postings: [p('expenses:food', 300), p('assets:bank', -300)],
		},
	],
};

describe('monthsInWindow', () => {
	it('lists every month from first to last', () => {
		const r = periodRange('all', new Date(2026, 1, 15));
		expect(monthsInWindow(journal, r)).toEqual(['2026-01', '2026-02']);
	});
});

describe('computeNetWorthSeries', () => {
	it('returns cumulative asset+liability balance at each month end', () => {
		const r = periodRange('all', new Date(2026, 1, 15));
		const s = computeNetWorthSeries(journal, 'BRL', DEFAULT_PREFIXES, r);
		expect(s.labels).toEqual(['2026-01', '2026-02']);
		expect(s.values).toEqual([1000, 700]); // 1000 after Jan, 1000-300 after Feb
	});
});

describe('computeIncomeExpenseSeries', () => {
	it('returns per-month income and expense totals', () => {
		const r = periodRange('all', new Date(2026, 1, 15));
		const s = computeIncomeExpenseSeries(journal, 'BRL', DEFAULT_PREFIXES, r);
		expect(s.labels).toEqual(['2026-01', '2026-02']);
		expect(s.income).toEqual([1000, 0]);
		expect(s.expenses).toEqual([0, 300]);
	});
});
