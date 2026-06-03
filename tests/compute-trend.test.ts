import { describe, expect, it } from 'vitest';
import { pctChange, previousRange } from '../src/compute';

describe('previousRange', () => {
	it('returns the equal-duration window immediately before a range', () => {
		const r = previousRange({ start: new Date(2026, 0, 10), end: new Date(2026, 0, 20) });
		expect(r).not.toBeNull();
		expect(r!.end).toEqual(new Date(2026, 0, 10));
		expect(r!.start).toEqual(new Date(2025, 11, 31)); // Jan 10 minus 10 days
	});

	it('returns null when the range is unbounded', () => {
		expect(previousRange({ start: null, end: null })).toBeNull();
		expect(previousRange({ start: new Date(2026, 0, 1), end: null })).toBeNull();
	});
});

describe('pctChange', () => {
	it('computes percent change against the previous magnitude', () => {
		expect(pctChange(110, 100)).toBeCloseTo(10);
		expect(pctChange(80, 100)).toBeCloseTo(-20);
	});

	it('returns null when previous is zero', () => {
		expect(pctChange(50, 0)).toBeNull();
	});
});
