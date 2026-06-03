import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFIXES, computeCategoryTimeSeries, periodRange } from '../src/compute';
import type { Journal } from '../src/types';

function p(account: string, amount: number) {
	return { account, parts: account.split(':'), commodity: 'BRL', amount };
}

const journal: Journal = {
	commodities: ['BRL'],
	accounts: [],
	errors: [],
	transactions: [
		{ date: new Date(2026, 0, 10), description: 'a', status: 'unmarked', postings: [p('expenses:food:x', 100)] },
		{ date: new Date(2026, 1, 5), description: 'b', status: 'unmarked', postings: [p('expenses:food:y', 50)] },
		{ date: new Date(2026, 1, 6), description: 'c', status: 'unmarked', postings: [p('expenses:transport', 30)] },
	],
};

const all = periodRange('all', new Date(2026, 1, 28));

describe('computeCategoryTimeSeries', () => {
	it('sums expenses per depth-2 category per month', () => {
		const r = computeCategoryTimeSeries(journal, 'BRL', DEFAULT_PREFIXES, all);
		expect(r.labels).toEqual(['2026-01', '2026-02']);
		expect(r.series.find((s) => s.category === 'expenses:food')!.values).toEqual([100, 50]);
		expect(r.series.find((s) => s.category === 'expenses:transport')!.values).toEqual([0, 30]);
	});

	it('folds categories beyond topN into an Other bucket', () => {
		const r = computeCategoryTimeSeries(journal, 'BRL', DEFAULT_PREFIXES, all, 2, 1);
		expect(r.series.map((s) => s.category)).toEqual(['expenses:food', 'Other']);
		expect(r.series[1]!.values).toEqual([0, 30]);
	});
});
