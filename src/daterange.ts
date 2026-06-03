/** True when two dates fall on the same calendar day (time ignored). */
export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * Calendar cells for `month` (0-based) of `year`, padded to six Sunday-first weeks
 * (42 cells). Leading/trailing cells are real dates from the adjacent months.
 */
export function buildMonthGrid(year: number, month: number): Date[] {
	const startOffset = new Date(year, month, 1).getDay(); // 0 = Sunday
	const cells: Date[] = [];
	for (let i = 0; i < 42; i++) {
		cells.push(new Date(year, month, 1 - startOffset + i));
	}
	return cells;
}

/** Order two clicked days so start <= endInclusive, both normalized to 00:00. */
export function normalizeRange(
	a: Date,
	b: Date,
): { start: Date; endInclusive: Date } {
	const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
	const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
	return da.getTime() <= db.getTime()
		? { start: da, endInclusive: db }
		: { start: db, endInclusive: da };
}

/** Start of the day after `endInclusive` — the exclusive upper bound for `inRange`. */
export function toExclusiveEnd(endInclusive: Date): Date {
	return new Date(
		endInclusive.getFullYear(),
		endInclusive.getMonth(),
		endInclusive.getDate() + 1,
	);
}

/** Inclusive membership test, used for highlighting. */
export function isInRange(day: Date, start: Date, endInclusive: Date): boolean {
	const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
	const s = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate(),
	).getTime();
	const e = new Date(
		endInclusive.getFullYear(),
		endInclusive.getMonth(),
		endInclusive.getDate(),
	).getTime();
	return d >= s && d <= e;
}

/** Local calendar day as 'YYYY-MM-DD'. */
export function dayKey(date: Date): string {
	const m = `${date.getMonth() + 1}`.padStart(2, '0');
	const d = `${date.getDate()}`.padStart(2, '0');
	return `${date.getFullYear()}-${m}-${d}`;
}

/** Label like "05/01 – 12/03" from a start and an EXCLUSIVE end. */
export function formatRangeLabel(start: Date, endExclusive: Date): string {
	const lastDay = new Date(
		endExclusive.getFullYear(),
		endExclusive.getMonth(),
		endExclusive.getDate() - 1,
	);
	const fmt = (d: Date): string =>
		`${`${d.getDate()}`.padStart(2, '0')}/${`${d.getMonth() + 1}`.padStart(2, '0')}`;
	return `${fmt(start)} – ${fmt(lastDay)}`;
}
