import { describe, expect, it } from 'vitest';
import {
	buildMonthGrid,
	dayKey,
	formatRangeLabel,
	isInRange,
	isSameDay,
	normalizeRange,
	toExclusiveEnd,
} from '../src/daterange';

describe('isSameDay', () => {
	it('ignores time of day', () => {
		expect(isSameDay(new Date(2026, 0, 5, 10, 30), new Date(2026, 0, 5))).toBe(true);
		expect(isSameDay(new Date(2026, 0, 5), new Date(2026, 0, 6))).toBe(false);
	});
});

describe('buildMonthGrid', () => {
	it('returns 42 Sunday-first cells with leading padding', () => {
		const grid = buildMonthGrid(2026, 0); // January 2026 (Jan 1 is a Thursday)
		expect(grid).toHaveLength(42);
		expect(isSameDay(grid[0]!, new Date(2025, 11, 28))).toBe(true); // Sunday before
		expect(isSameDay(grid[4]!, new Date(2026, 0, 1))).toBe(true); // the 1st
	});
});

describe('normalizeRange', () => {
	it('orders the two days ascending', () => {
		const r = normalizeRange(new Date(2026, 2, 12), new Date(2026, 0, 5));
		expect(isSameDay(r.start, new Date(2026, 0, 5))).toBe(true);
		expect(isSameDay(r.endInclusive, new Date(2026, 2, 12))).toBe(true);
	});
});

describe('toExclusiveEnd', () => {
	it('returns the next day, crossing month boundaries', () => {
		expect(isSameDay(toExclusiveEnd(new Date(2026, 0, 31)), new Date(2026, 1, 1))).toBe(
			true,
		);
	});
});

describe('isInRange', () => {
	const start = new Date(2026, 0, 5);
	const end = new Date(2026, 2, 12);
	it('includes endpoints and excludes outside days', () => {
		expect(isInRange(new Date(2026, 0, 10), start, end)).toBe(true);
		expect(isInRange(start, start, end)).toBe(true);
		expect(isInRange(end, start, end)).toBe(true);
		expect(isInRange(new Date(2026, 0, 4), start, end)).toBe(false);
		expect(isInRange(new Date(2026, 2, 13), start, end)).toBe(false);
	});
});

describe('formatRangeLabel', () => {
	it('formats dd/mm using the inclusive last day', () => {
		expect(formatRangeLabel(new Date(2026, 0, 5), new Date(2026, 2, 13))).toBe(
			'05/01 – 12/03',
		);
	});
});

describe('dayKey', () => {
	it('formats YYYY-MM-DD zero-padded', () => {
		expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
		expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
	});
});
