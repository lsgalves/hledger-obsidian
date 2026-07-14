import { setIcon } from 'obsidian';
import type { Chart } from 'chart.js';
import {
	type CompareRow,
	type PeriodRange,
	compareCategories,
	computeByCategory,
	computeSummary,
	pctChange,
} from '../compute';
import { type ThemeColors, createCompareChart } from '../charts';
import type { AccountPrefixMap, Journal } from '../types';

export interface CompareContext {
	journal: Journal;
	commodity: string;
	prefixes: AccountPrefixMap;
	range: PeriodRange;
	prevRange: PeriodRange | null;
	theme: ThemeColors;
	currentLabel: string;
	previousLabel: string;
	fmt: (n: number) => string;
	registerChart: (chart: Chart) => void;
}

function card(parent: HTMLElement, icon: string, title: string, full: boolean): HTMLElement {
	const c = parent.createDiv({ cls: 'hledger-card' });
	if (full) c.addClass('is-full');
	const head = c.createDiv({ cls: 'hledger-card-head' });
	setIcon(head.createSpan({ cls: 'hledger-card-icon' }), icon);
	head.createSpan({ text: title });
	return c.createDiv({ cls: 'hledger-card-body' });
}

function deltaCell(tr: HTMLElement, current: number, previous: number, fmt: (n: number) => string, higherIsBetter: boolean): void {
	const diff = current - previous;
	const pct = pctChange(current, previous);
	const td = tr.createEl('td', { cls: 'hledger-amt' });
	const sign = diff > 0 ? '+' : '';
	const label = pct === null ? `${sign}${fmt(diff)}` : `${sign}${fmt(diff)} (${sign}${Math.round(pct)}%)`;
	td.setText(label);
	if (Math.abs(diff) < 1e-9) td.addClass('is-flat');
	else td.addClass((diff > 0) === higherIsBetter ? 'is-good' : 'is-bad');
}

export function renderCompareTab(root: HTMLElement, ctx: CompareContext): void {
	if (!ctx.prevRange) {
		root.createDiv({
			cls: 'hledger-empty-note',
			text: 'Select a bounded period (month, 12 months or year) to compare against the previous one.',
		});
		return;
	}

	const cur = computeSummary(ctx.journal, ctx.commodity, ctx.prefixes, ctx.range);
	const prev = computeSummary(ctx.journal, ctx.commodity, ctx.prefixes, ctx.prevRange);

	const grid = root.createDiv({ cls: 'hledger-grid' });

	// Summary comparison
	const sumBody = card(grid, 'scale', 'Summary', true);
	const sumTable = sumBody.createEl('table', { cls: 'hledger-tx hledger-compare' });
	const sh = sumTable.createEl('tr');
	for (const h of ['Metric', ctx.previousLabel, ctx.currentLabel, 'Change']) {
		const th = sh.createEl('th', { text: h });
		if (h !== 'Metric') th.addClass('hledger-amt');
	}
	const metrics: { label: string; cur: number; prev: number; higherIsBetter: boolean }[] = [
		{ label: 'Income', cur: cur.income, prev: prev.income, higherIsBetter: true },
		{ label: 'Expenses', cur: cur.expenses, prev: prev.expenses, higherIsBetter: false },
		{ label: 'Savings', cur: cur.savings, prev: prev.savings, higherIsBetter: true },
		{ label: 'Net worth', cur: cur.netWorth, prev: prev.netWorth, higherIsBetter: true },
	];
	for (const m of metrics) {
		const tr = sumTable.createEl('tr');
		tr.createEl('td', { text: m.label });
		tr.createEl('td', { cls: 'hledger-amt', text: ctx.fmt(m.prev) });
		tr.createEl('td', { cls: 'hledger-amt', text: ctx.fmt(m.cur) });
		deltaCell(tr, m.cur, m.prev, ctx.fmt, m.higherIsBetter);
	}

	renderClassCompare(grid, ctx, 'expense', 'Expenses by category', false);
	renderClassCompare(grid, ctx, 'income', 'Income by source', true);
}

function renderClassCompare(
	grid: HTMLElement,
	ctx: CompareContext,
	klass: 'expense' | 'income',
	title: string,
	higherIsBetter: boolean,
): void {
	const prevRange = ctx.prevRange!;
	const current = computeByCategory(ctx.journal, ctx.commodity, ctx.prefixes, ctx.range, klass);
	const previous = computeByCategory(ctx.journal, ctx.commodity, ctx.prefixes, prevRange, klass);
	const rows = compareCategories(current, previous);

	const chartBody = card(grid, 'bar-chart-3', title, false);
	if (rows.length === 0) {
		chartBody.createDiv({ cls: 'hledger-empty-note', text: 'No data to compare' });
	} else {
		const top = rows.slice(0, 8);
		ctx.registerChart(
			createCompareChart(
				chartBody.createEl('canvas'),
				top.map((r) => r.label),
				top.map((r) => r.current),
				top.map((r) => r.previous),
				ctx.theme,
				ctx.currentLabel,
				ctx.previousLabel,
			),
		);
	}

	const tableBody = card(grid, 'list', `${title} — detail`, false);
	renderCompareTable(tableBody, rows, ctx, higherIsBetter);
}

function renderCompareTable(
	parent: HTMLElement,
	rows: CompareRow[],
	ctx: CompareContext,
	higherIsBetter: boolean,
): void {
	if (rows.length === 0) {
		parent.createDiv({ cls: 'hledger-empty-note', text: 'No data to compare' });
		return;
	}
	const table = parent.createEl('table', { cls: 'hledger-tx hledger-compare' });
	const head = table.createEl('tr');
	for (const h of ['Category', ctx.previousLabel, ctx.currentLabel, 'Change']) {
		const th = head.createEl('th', { text: h });
		if (h !== 'Category') th.addClass('hledger-amt');
	}
	for (const r of rows) {
		const tr = table.createEl('tr');
		tr.createEl('td', { cls: 'hledger-cat', text: r.label });
		tr.createEl('td', { cls: 'hledger-amt', text: ctx.fmt(r.previous) });
		tr.createEl('td', { cls: 'hledger-amt', text: ctx.fmt(r.current) });
		deltaCell(tr, r.current, r.previous, ctx.fmt, higherIsBetter);
	}
}
