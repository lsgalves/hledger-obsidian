import { describe, expect, it } from 'vitest';
import {
	buildSuggestionIndex,
	distinctDescriptions,
	suggestForDescription,
} from '../src/suggest';
import { DEFAULT_PREFIXES } from '../src/compute';
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
			date: new Date(2026, 0, 1),
			description: 'Uber',
			status: 'unmarked',
			postings: [p('expenses:transport', 25), p('assets:card', -25)],
		},
		{
			date: new Date(2026, 0, 5),
			description: 'Uber',
			status: 'unmarked',
			postings: [p('expenses:transport', 30), p('assets:card', -30)],
		},
		{
			date: new Date(2026, 0, 9),
			description: 'Salary',
			status: 'unmarked',
			postings: [p('assets:bank', 5000), p('income:salary', -5000)],
		},
	],
};

describe('buildSuggestionIndex', () => {
	it('maps a description to its category and source', () => {
		const idx = buildSuggestionIndex(journal, DEFAULT_PREFIXES);
		expect(idx.get('uber')).toEqual({
			category: 'expenses:transport',
			source: 'assets:card',
			amount: '30', // latest amount of the most-frequent pairing
		});
		expect(idx.get('salary')).toEqual({
			category: 'income:salary',
			source: 'assets:bank',
			amount: '5000',
		});
	});
});

describe('suggestForDescription', () => {
	const idx = buildSuggestionIndex(journal, DEFAULT_PREFIXES);
	it('matches case-insensitively by prefix', () => {
		expect(suggestForDescription(idx, 'ub')?.category).toBe('expenses:transport');
		expect(suggestForDescription(idx, 'UBER')?.source).toBe('assets:card');
	});
	it('returns null for an empty or unknown query', () => {
		expect(suggestForDescription(idx, '')).toBeNull();
		expect(suggestForDescription(idx, 'zzz')).toBeNull();
	});
});

describe('distinctDescriptions', () => {
	it('lists descriptions most-frequent first', () => {
		expect(distinctDescriptions(journal)).toEqual(['Uber', 'Salary']);
	});
});
