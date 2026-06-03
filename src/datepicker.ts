import { setIcon } from 'obsidian';
import {
	buildMonthGrid,
	isInRange,
	isSameDay,
	normalizeRange,
	toExclusiveEnd,
} from './daterange';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

export interface RangeResult {
	start: Date;
	endExclusive: Date;
}

let activeClose: (() => void) | null = null;

/**
 * Open a themed range-calendar popover anchored below `anchor`. Two day clicks select a
 * range; the second click calls `onApply` with the inclusive start and exclusive end, then
 * closes. Clicking outside or pressing Escape closes without applying. Only one popover is
 * ever open at a time.
 */
export function openRangeCalendar(
	anchor: HTMLElement,
	initial: RangeResult | null,
	onApply: (range: RangeResult) => void,
): void {
	if (activeClose) activeClose();

	const initialStart = initial ? initial.start : new Date();
	let viewYear = initialStart.getFullYear();
	let viewMonth = initialStart.getMonth();

	let pendingStart: Date | null = null;
	let selStart: Date | null = initial ? initial.start : null;
	let selEndInclusive: Date | null = initial
		? new Date(
				initial.endExclusive.getFullYear(),
				initial.endExclusive.getMonth(),
				initial.endExclusive.getDate() - 1,
			)
		: null;
	// Day cells of the currently rendered month, repainted in place on hover/selection.
	let dayCells: { el: HTMLElement; day: Date }[] = [];

	const pop = activeDocument.body.createDiv({ cls: 'hledger-datepicker' });
	const rect = anchor.getBoundingClientRect();
	pop.style.top = `${rect.bottom + 4}px`;
	pop.style.left = `${rect.left}px`;

	function close(): void {
		activeDocument.removeEventListener('mousedown', onDocMouseDown, true);
		activeDocument.removeEventListener('keydown', onKeyDown, true);
		pop.remove();
		if (activeClose === close) activeClose = null;
	}

	function onDocMouseDown(evt: MouseEvent): void {
		const target = evt.target as Node;
		if (!pop.contains(target) && target !== anchor && !anchor.contains(target)) {
			close();
		}
	}

	function onKeyDown(evt: KeyboardEvent): void {
		if (evt.key === 'Escape') close();
	}

	// Repaint highlight classes on the existing cells. Never rebuilds the grid, so the
	// element under the pointer stays stable and clicks fire reliably.
	function paint(): void {
		for (const { el, day } of dayCells) {
			const inRange = !!(
				selStart &&
				selEndInclusive &&
				isInRange(day, selStart, selEndInclusive)
			);
			const endpoint = !!(
				(selStart && isSameDay(day, selStart)) ||
				(selEndInclusive && isSameDay(day, selEndInclusive))
			);
			el.classList.toggle('is-in-range', inRange);
			el.classList.toggle('is-endpoint', endpoint);
		}
	}

	function selectDay(day: Date): void {
		if (pendingStart === null) {
			pendingStart = day;
			selStart = day;
			selEndInclusive = day;
			paint();
		} else {
			const { start, endInclusive } = normalizeRange(pendingStart, day);
			onApply({ start, endExclusive: toExclusiveEnd(endInclusive) });
			close();
		}
	}

	function render(): void {
		pop.empty();

		const header = pop.createDiv({ cls: 'hledger-cal-header' });
		const prev = header.createDiv({ cls: 'clickable-icon hledger-cal-nav' });
		setIcon(prev, 'chevron-left');
		prev.addEventListener('click', () => {
			viewMonth--;
			if (viewMonth < 0) {
				viewMonth = 11;
				viewYear--;
			}
			render();
		});
		header.createSpan({
			cls: 'hledger-cal-title',
			text: `${MONTHS[viewMonth] ?? ''} ${viewYear}`,
		});
		const next = header.createDiv({ cls: 'clickable-icon hledger-cal-nav' });
		setIcon(next, 'chevron-right');
		next.addEventListener('click', () => {
			viewMonth++;
			if (viewMonth > 11) {
				viewMonth = 0;
				viewYear++;
			}
			render();
		});

		const grid = pop.createDiv({ cls: 'hledger-cal-grid' });
		for (const w of WEEKDAYS) {
			grid.createSpan({ cls: 'hledger-cal-weekday', text: w });
		}

		dayCells = [];
		for (const day of buildMonthGrid(viewYear, viewMonth)) {
			const cell = grid.createSpan({
				cls: 'hledger-cal-day',
				text: `${day.getDate()}`,
			});
			if (day.getMonth() !== viewMonth) cell.addClass('is-outside');
			cell.addEventListener('click', () => selectDay(day));
			cell.addEventListener('mouseenter', () => {
				if (pendingStart) {
					const r = normalizeRange(pendingStart, day);
					selStart = r.start;
					selEndInclusive = r.endInclusive;
					paint();
				}
			});
			dayCells.push({ el: cell, day });
		}

		paint();
	}

	render();
	activeDocument.addEventListener('mousedown', onDocMouseDown, true);
	activeDocument.addEventListener('keydown', onKeyDown, true);
	activeClose = close;
}
