import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PREFIXES,
	classifyAccount,
	inRange,
	matchesAccount,
	monthKey,
	periodRange,
	prefixesToText,
	textToPrefixes,
} from '../src/compute';

describe('classifyAccount', () => {
	it('classifies standard English prefixes', () => {
		expect(classifyAccount(['assets', 'bank'], DEFAULT_PREFIXES)).toBe('asset');
		expect(classifyAccount(['Expenses', 'food'], DEFAULT_PREFIXES)).toBe('expense');
	});

	it('classifies Portuguese prefixes', () => {
		expect(classifyAccount(['despesas', 'casa'], DEFAULT_PREFIXES)).toBe('expense');
		expect(classifyAccount(['receitas'], DEFAULT_PREFIXES)).toBe('income');
	});

	it('falls back to other', () => {
		expect(classifyAccount(['foobar'], DEFAULT_PREFIXES)).toBe('other');
	});
});

describe('matchesAccount', () => {
	it('matches the account itself and its subaccounts', () => {
		expect(matchesAccount('expenses:food', 'expenses:food')).toBe(true);
		expect(matchesAccount('expenses:food:groceries', 'expenses:food')).toBe(true);
		expect(matchesAccount('expenses:foodish', 'expenses:food')).toBe(false);
		expect(matchesAccount('income:salary', 'expenses')).toBe(false);
	});

	it('treats an empty filter as match-all', () => {
		expect(matchesAccount('anything', '')).toBe(true);
	});
});

describe('monthKey', () => {
	it('formats YYYY-MM zero-padded', () => {
		expect(monthKey(new Date(2026, 0, 9))).toBe('2026-01');
		expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
	});
});

describe('periodRange / inRange', () => {
	const now = new Date(2026, 5, 15); // 2026-06-15

	it('month spans the current calendar month', () => {
		const r = periodRange('month', now);
		expect(inRange(new Date(2026, 5, 1), r)).toBe(true);
		expect(inRange(new Date(2026, 4, 30), r)).toBe(false);
		expect(inRange(new Date(2026, 6, 1), r)).toBe(false);
	});

	it('12months spans the trailing 12 calendar months', () => {
		const r = periodRange('12months', now);
		expect(inRange(new Date(2025, 6, 1), r)).toBe(true);
		expect(inRange(new Date(2025, 5, 30), r)).toBe(false);
	});

	it('all includes everything', () => {
		const r = periodRange('all', now);
		expect(inRange(new Date(1990, 0, 1), r)).toBe(true);
	});
});

describe('prefix config round-trip', () => {
	it('serializes and parses prefix maps', () => {
		const text = prefixesToText({ assets: 'asset', despesas: 'expense' });
		expect(text).toContain('assets = asset');
		const parsed = textToPrefixes('assets = asset\ndespesas = expense\nbad line\n');
		expect(parsed['assets']).toBe('asset');
		expect(parsed['despesas']).toBe('expense');
	});
});
