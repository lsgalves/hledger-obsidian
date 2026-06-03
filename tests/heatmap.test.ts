import { describe, expect, it } from 'vitest';
import { buildHeatmapWeeks, monthLabels } from '../src/heatmap';
import type { PeriodRange } from '../src/compute';

// Jan 5 2026 is a Monday; exclusive end Jan 19 → inclusive last day Jan 18.
const range: PeriodRange = { start: new Date(2026, 0, 5), end: new Date(2026, 0, 19) };
const daily = new Map<string, number>([
	['2026-01-06', 100],
	['2026-01-12', 50],
]);

describe('buildHeatmapWeeks', () => {
	it('builds whole Sunday-first weeks covering the range', () => {
		const weeks = buildHeatmapWeeks(range, daily);
		expect(weeks).toHaveLength(3);
		expect(weeks[0]!.cells).toHaveLength(7);
		// Jan 4 (Sun) is padding before the range start
		expect(weeks[0]!.cells[0]!.inRange).toBe(false);
		// Jan 5 (Mon) in range, no spend
		expect(weeks[0]!.cells[1]!.inRange).toBe(true);
		expect(weeks[0]!.cells[1]!.level).toBe(0);
		// Jan 6 (Tue) is the max → level 4
		expect(weeks[0]!.cells[2]!.amount).toBe(100);
		expect(weeks[0]!.cells[2]!.level).toBe(4);
		// Jan 12 = 50 → 50/100 = 0.5 → level 2
		expect(weeks[1]!.cells[1]!.amount).toBe(50);
		expect(weeks[1]!.cells[1]!.level).toBe(2);
		// trailing padding after Jan 18
		expect(weeks[2]!.cells[1]!.inRange).toBe(false);
	});

	it('returns [] when there is no data and no bounds', () => {
		expect(buildHeatmapWeeks({ start: null, end: null }, new Map())).toEqual([]);
	});
});

describe('monthLabels', () => {
	it('labels the first column of each month', () => {
		const weeks = buildHeatmapWeeks(range, daily);
		expect(monthLabels(weeks)).toEqual([{ index: 0, label: 'Jan' }]);
	});

	it('drops a one-week partial month so adjacent labels do not overlap', () => {
		// Jun 29 2026 is a Monday → the first week (Sun Jun 28) is the only June week;
		// the rest are July. The 1-week June label must be dropped.
		const r: PeriodRange = { start: new Date(2026, 5, 29), end: new Date(2026, 7, 1) };
		const weeks = buildHeatmapWeeks(r, new Map());
		expect(monthLabels(weeks)).toEqual([{ index: 1, label: 'Jul' }]);
	});
});
