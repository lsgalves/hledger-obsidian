import { ButtonComponent, setIcon } from 'obsidian';
import type { Chart } from 'chart.js';
import {
	type LedgerRow,
	type PeriodRange,
	classCategories,
	computeByCategory,
	computeClassRows,
	computeDailyExpenses,
	computeMonthlySeries,
	computeTopByClass,
} from '../compute';
import {
	type ThemeColors,
	createCategoryChart,
	createMonthlySeriesChart,
} from '../charts';
import { buildHeatmapWeeks, monthLabels } from '../heatmap';
import { dayKey } from '../daterange';
import { buildLedgerCsv } from '../csv';
import type { AccountClass, AccountPrefixMap, Journal } from '../types';

const PAGE_SIZE = 20;

export interface LedgerConfig {
	klass: AccountClass;
	timePanel: 'heatmap' | 'monthly';
	pieTitle: string;
	topTitle: string;
	timeTitle: string;
	filterAllLabel: string;
	emptyLabel: string;
}

export const EXPENSE_CONFIG: LedgerConfig = {
	klass: 'expense',
	timePanel: 'heatmap',
	pieTitle: 'By category',
	topTitle: 'Top expenses',
	timeTitle: 'Daily expenses',
	filterAllLabel: 'All categories',
	emptyLabel: 'No expenses in this period',
};

export const INCOME_CONFIG: LedgerConfig = {
	klass: 'income',
	timePanel: 'monthly',
	pieTitle: 'By source',
	topTitle: 'Top income',
	timeTitle: 'Monthly income',
	filterAllLabel: 'All sources',
	emptyLabel: 'No income in this period',
};

export interface LedgerContext {
	journal: Journal;
	commodity: string;
	prefixes: AccountPrefixMap;
	range: PeriodRange;
	theme: ThemeColors;
	categoryFilter: string;
	search: string;
	dayFilter: string;
	fmt: (n: number) => string;
	onCategoryChange: (value: string) => void;
	setSearch: (value: string) => void;
	onDayFilter: (key: string) => void;
	registerChart: (chart: Chart) => void;
}

function fmtDay(d: Date): string {
	return `${`${d.getDate()}`.padStart(2, '0')}/${`${d.getMonth() + 1}`.padStart(2, '0')}`;
}

function dayLabel(key: string): string {
	const [y, m, d] = key.split('-');
	return `${d ?? ''}/${m ?? ''}/${y ?? ''}`;
}

function card(
	parent: HTMLElement,
	icon: string,
	title: string,
	full: boolean,
): HTMLElement {
	const c = parent.createDiv({ cls: 'hledger-card' });
	if (full) c.addClass('is-full');
	const head = c.createDiv({ cls: 'hledger-card-head' });
	setIcon(head.createSpan({ cls: 'hledger-card-icon' }), icon);
	head.createSpan({ text: title });
	return c.createDiv({ cls: 'hledger-card-body' });
}

function emptyMsg(parent: HTMLElement, text: string): void {
	parent.createDiv({ cls: 'hledger-empty-note', text });
}

function downloadCsv(csv: string, filename: string): void {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = activeDocument.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Render the class-specific category dropdown into the shared controls bar. */
export function renderLedgerFilter(
	bar: HTMLElement,
	ctx: LedgerContext,
	config: LedgerConfig,
): void {
	const wrap = bar.createDiv({ cls: 'hledger-ctl' });
	setIcon(wrap.createSpan({ cls: 'hledger-ctl-icon' }), 'tag');
	const select = wrap.createEl('select', { cls: 'dropdown' });
	select.createEl('option', { text: config.filterAllLabel, value: '' });
	for (const cat of classCategories(ctx.journal, ctx.prefixes, config.klass)) {
		const o = select.createEl('option', { text: cat, value: cat });
		if (cat === ctx.categoryFilter) o.selected = true;
	}
	select.addEventListener('change', () => ctx.onCategoryChange(select.value));
}

/** Render the tab body: pie, time panel (heatmap or monthly), top-N, table. */
export function renderLedgerBody(
	root: HTMLElement,
	ctx: LedgerContext,
	config: LedgerConfig,
): void {
	const amtClass = config.klass === 'income' ? 'is-positive' : 'is-negative';
	const grid = root.createDiv({ cls: 'hledger-egrid' });

	const pieBody = card(grid, 'pie-chart', config.pieTitle, false);
	const categories = computeByCategory(
		ctx.journal,
		ctx.commodity,
		ctx.prefixes,
		ctx.range,
		config.klass,
		ctx.categoryFilter,
	);
	if (categories.length === 0) {
		emptyMsg(pieBody, config.emptyLabel);
	} else {
		const canvas = pieBody.createEl('canvas');
		ctx.registerChart(createCategoryChart(canvas, categories, ctx.theme));
	}

	if (config.timePanel === 'heatmap') {
		const heatBody = card(grid, 'calendar', config.timeTitle, false);
		const daily = computeDailyExpenses(
			ctx.journal,
			ctx.commodity,
			ctx.prefixes,
			ctx.range,
			ctx.categoryFilter,
		);
		renderHeatmap(heatBody, ctx, config, daily);
	} else {
		const monthBody = card(grid, 'bar-chart-3', config.timeTitle, false);
		const series = computeMonthlySeries(
			ctx.journal,
			ctx.commodity,
			ctx.prefixes,
			ctx.range,
			config.klass,
		);
		if (series.values.every((v) => v === 0)) {
			emptyMsg(monthBody, config.emptyLabel);
		} else {
			const canvas = monthBody.createEl('canvas');
			ctx.registerChart(
				createMonthlySeriesChart(canvas, series, ctx.theme, ctx.theme.green, config.timeTitle),
			);
		}
	}

	renderTop(grid, ctx, config, amtClass);

	const tableBody = card(grid, 'list', 'Transactions', true);
	renderTable(tableBody, ctx, config, amtClass);
}

function renderHeatmap(
	parent: HTMLElement,
	ctx: LedgerContext,
	config: LedgerConfig,
	daily: Map<string, number>,
): void {
	const weeks = buildHeatmapWeeks(ctx.range, daily);
	if (weeks.length === 0) {
		emptyMsg(parent, config.emptyLabel);
		return;
	}
	const grid = parent.createDiv({ cls: 'hledger-heat' });
	grid.style.gridTemplateColumns = `repeat(${weeks.length}, 13px)`;

	for (const { index, label } of monthLabels(weeks)) {
		const span = grid.createSpan({ cls: 'hledger-heat-month', text: label });
		span.style.gridColumn = `${index + 1}`;
		span.style.gridRow = `1`;
	}

	weeks.forEach((week, i) => {
		week.cells.forEach((cell, d) => {
			const c = grid.createDiv({ cls: `hledger-heat-cell level-${cell.level}` });
			c.style.gridColumn = `${i + 1}`;
			c.style.gridRow = `${d + 2}`;
			if (!cell.inRange) {
				c.addClass('is-pad');
				return;
			}
			const key = dayKey(cell.date);
			c.setAttribute(
				'title',
				`${fmtDay(cell.date)}/${cell.date.getFullYear()}: ${ctx.fmt(cell.amount)}`,
			);
			c.addClass('is-clickable');
			if (key === ctx.dayFilter) c.addClass('is-selected');
			c.addEventListener('click', () => ctx.onDayFilter(key));
		});
	});
}

function renderTop(
	grid: HTMLElement,
	ctx: LedgerContext,
	config: LedgerConfig,
	amtClass: string,
): void {
	const body = card(grid, 'trophy', config.topTitle, true);
	const top = computeTopByClass(
		ctx.journal,
		ctx.commodity,
		ctx.prefixes,
		ctx.range,
		config.klass,
		ctx.categoryFilter,
		5,
	);
	if (top.length === 0) {
		emptyMsg(body, config.emptyLabel);
		return;
	}
	const list = body.createDiv({ cls: 'hledger-top' });
	for (const r of top) {
		const row = list.createDiv({ cls: 'hledger-top-row' });
		row.createSpan({ cls: 'hledger-top-desc', text: r.description });
		row.createSpan({ cls: 'hledger-top-cat', text: r.category });
		row.createSpan({ cls: `hledger-top-amt ${amtClass}`, text: ctx.fmt(r.amount) });
	}
}

function renderTable(
	parent: HTMLElement,
	ctx: LedgerContext,
	config: LedgerConfig,
	amtClass: string,
): void {
	const allRows = computeClassRows(
		ctx.journal,
		ctx.commodity,
		ctx.prefixes,
		ctx.range,
		config.klass,
		ctx.categoryFilter,
	);
	if (allRows.length === 0) {
		emptyMsg(parent, config.emptyLabel);
		return;
	}

	const toolbar = parent.createDiv({ cls: 'hledger-tx-toolbar' });
	const searchWrap = toolbar.createDiv({ cls: 'hledger-search' });
	setIcon(searchWrap.createSpan({ cls: 'hledger-ctl-icon' }), 'search');
	const searchInput = searchWrap.createEl('input', {
		type: 'text',
		cls: 'hledger-search-input',
	});
	searchInput.placeholder = 'Search description…';
	searchInput.value = ctx.search;

	if (ctx.dayFilter) {
		const chip = toolbar.createDiv({ cls: 'hledger-chip' });
		chip.createSpan({ text: `Showing ${dayLabel(ctx.dayFilter)}` });
		const x = chip.createSpan({ cls: 'hledger-chip-x' });
		setIcon(x, 'x');
		x.addEventListener('click', () => ctx.onDayFilter(ctx.dayFilter));
	}

	const csvBtn = new ButtonComponent(toolbar)
		.setButtonText('Export')
		.setIcon('download')
		.setTooltip('Export visible rows as CSV');
	csvBtn.buttonEl.addClass('hledger-csv-btn');

	const tableContainer = parent.createDiv();
	let page = 0;

	const visibleRows = (): LedgerRow[] => {
		const q = searchInput.value.trim().toLowerCase();
		return allRows.filter((r) => {
			if (ctx.dayFilter && dayKey(r.date) !== ctx.dayFilter) return false;
			if (q && !r.description.toLowerCase().includes(q)) return false;
			return true;
		});
	};

	const paint = (): void => {
		tableContainer.empty();
		const rows = visibleRows();
		if (rows.length === 0) {
			emptyMsg(tableContainer, 'No matching transactions');
			return;
		}
		const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
		page = Math.min(Math.max(0, page), pageCount - 1);
		const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

		const table = tableContainer.createEl('table', { cls: 'hledger-tx' });
		const head = table.createEl('tr');
		for (const h of ['Date', 'Description', 'Category', 'Amount']) {
			const th = head.createEl('th', { text: h });
			if (h === 'Amount') th.addClass('hledger-amt');
		}
		for (const r of slice) {
			const tr = table.createEl('tr');
			tr.createEl('td', { text: fmtDay(r.date) });
			tr.createEl('td', { text: r.description });
			tr.createEl('td', { cls: 'hledger-cat', text: r.category });
			tr.createEl('td', { cls: `hledger-amt ${amtClass}`, text: ctx.fmt(r.amount) });
		}

		const pager = tableContainer.createDiv({ cls: 'hledger-pager' });
		new ButtonComponent(pager)
			.setButtonText('Prev')
			.setDisabled(page <= 0)
			.onClick(() => {
				page--;
				paint();
			});
		pager.createSpan({ cls: 'hledger-pager-info', text: `${page + 1} / ${pageCount}` });
		new ButtonComponent(pager)
			.setButtonText('Next')
			.setDisabled(page >= pageCount - 1)
			.onClick(() => {
				page++;
				paint();
			});
	};

	searchInput.addEventListener('input', () => {
		ctx.setSearch(searchInput.value);
		page = 0;
		paint();
	});
	csvBtn.onClick(() => downloadCsv(buildLedgerCsv(visibleRows()), `${config.klass}.csv`));

	paint();
}
