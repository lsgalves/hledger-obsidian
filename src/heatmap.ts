import { dayKey } from './daterange';
import type { PeriodRange } from './compute';

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
	date: Date;
	amount: number;
	level: HeatLevel;
	inRange: boolean;
}

export interface HeatWeek {
	cells: HeatCell[]; // 7, Sunday → Saturday
}

const MONTHS_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

function parseKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function levelFor(amount: number, max: number): HeatLevel {
	if (amount <= 0 || max <= 0) return 0;
	const r = amount / max;
	if (r <= 0.25) return 1;
	if (r <= 0.5) return 2;
	if (r <= 0.75) return 3;
	return 4;
}

/**
 * Build Sunday-first week columns covering the range (or the data span when range bounds
 * are null). Cells outside the inclusive [firstDay, lastDay] window are padding.
 */
export function buildHeatmapWeeks(
	range: PeriodRange,
	daily: Map<string, number>,
): HeatWeek[] {
	const dates = [...daily.keys()].map(parseKey).sort((a, b) => a.getTime() - b.getTime());
	const firstDay = range.start
		? new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate())
		: (dates[0] ?? null);
	const lastDay = range.end
		? new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1)
		: (dates[dates.length - 1] ?? null);
	if (!firstDay || !lastDay) return [];

	const max = Math.max(0, ...daily.values());
	const firstT = firstDay.getTime();
	const lastT = lastDay.getTime();
	const gridStart = new Date(
		firstDay.getFullYear(),
		firstDay.getMonth(),
		firstDay.getDate() - firstDay.getDay(),
	);

	const weeks: HeatWeek[] = [];
	let weekStart = gridStart;
	while (weekStart.getTime() <= lastT) {
		const cells: HeatCell[] = [];
		for (let d = 0; d < 7; d++) {
			const day = new Date(
				weekStart.getFullYear(),
				weekStart.getMonth(),
				weekStart.getDate() + d,
			);
			const t = day.getTime();
			const inRange = t >= firstT && t <= lastT;
			const amount = inRange ? (daily.get(dayKey(day)) ?? 0) : 0;
			cells.push({ date: day, amount, level: levelFor(amount, max), inRange });
		}
		weeks.push({ cells });
		weekStart = new Date(
			weekStart.getFullYear(),
			weekStart.getMonth(),
			weekStart.getDate() + 7,
		);
	}
	return weeks;
}

/** Minimum week-columns a month must span to get a label (avoids overlapping captions). */
const MIN_LABEL_SPAN = 2;

/**
 * Column index + short month label for each month, placed at its first week column.
 * Months spanning fewer than MIN_LABEL_SPAN columns (e.g. a one-week partial month at the
 * start of the range) are dropped so adjacent labels don't overlap.
 */
export function monthLabels(weeks: HeatWeek[]): { index: number; label: string }[] {
	const runs: { index: number; month: number; span: number }[] = [];
	weeks.forEach((w, i) => {
		const first = w.cells[0]?.date;
		if (!first) return;
		const month = first.getMonth();
		const last = runs[runs.length - 1];
		if (last && last.month === month) {
			last.span++;
		} else {
			runs.push({ index: i, month, span: 1 });
		}
	});
	return runs
		.filter((r) => r.span >= MIN_LABEL_SPAN)
		.map((r) => ({ index: r.index, label: MONTHS_SHORT[r.month] ?? '' }));
}
