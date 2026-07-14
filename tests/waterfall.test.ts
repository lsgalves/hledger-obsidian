import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	compareCategories,
	computeWaterfall,
	filterByStatus,
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
			date: new Date(2025, 11, 31), // before window: opening balance
			description: 'Opening',
			status: 'cleared',
			postings: [p('assets:bank', 1000), p('equity:open', -1000)],
		},
		{
			date: new Date(2026, 0, 5),
			description: 'Salary',
			status: 'cleared',
			postings: [p('assets:bank', 5000), p('income:salary', -5000)],
		},
		{
			date: new Date(2026, 0, 10),
			description: 'Rent',
			status: 'pending',
			postings: [p('expenses:rent', 1500), p('assets:bank', -1500)],
		},
		{
			date: new Date(2026, 0, 15),
			description: 'Food',
			status: 'unmarked',
			postings: [p('expenses:food', 500), p('assets:bank', -500)],
		},
	],
};

describe('computeWaterfall', () => {
	const range = periodRange('month', new Date(2026, 0, 15));
	const steps = computeWaterfall(journal, 'BRL', DEFAULT_PREFIXES, range);

	it('opens with the prior balance and closes with the period end balance', () => {
		expect(steps[0]).toMatchObject({ label: 'Opening', end: 1000 });
		const closing = steps[steps.length - 1]!;
		expect(closing.label).toBe('Closing');
		// 1000 opening + 5000 income - 1500 rent - 500 food
		expect(closing.end).toBe(4000);
	});

	it('adds income then subtracts each expense category', () => {
		const labels = steps.map((s) => s.label);
		expect(labels).toContain('Income');
		expect(labels).toContain('expenses:rent');
		expect(labels).toContain('expenses:food');
	});
});

describe('filterByStatus', () => {
	it('keeps only transactions of the given status', () => {
		expect(filterByStatus(journal, 'all').transactions).toHaveLength(4);
		expect(filterByStatus(journal, 'pending').transactions).toHaveLength(1);
		expect(filterByStatus(journal, 'cleared').transactions).toHaveLength(2);
		expect(filterByStatus(journal, 'unmarked').transactions).toHaveLength(1);
	});
});

describe('compareCategories', () => {
	it('aligns current and previous, filling gaps with zero', () => {
		const rows = compareCategories(
			[
				{ label: 'a', value: 10 },
				{ label: 'b', value: 5 },
			],
			[
				{ label: 'a', value: 8 },
				{ label: 'c', value: 3 },
			],
		);
		expect(rows).toEqual([
			{ label: 'a', current: 10, previous: 8 },
			{ label: 'b', current: 5, previous: 0 },
			{ label: 'c', current: 0, previous: 3 },
		]);
	});
});
