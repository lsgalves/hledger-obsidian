import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import type {
	CategorySeries,
	Category,
	DualSeries,
	Series,
	WaterfallStep,
} from './compute';
import { withAlpha } from './color';

Chart.register(...registerables);

export interface ThemeColors {
	text: string;
	muted: string;
	border: string;
	accent: string;
	green: string;
	red: string;
	palette: string[];
}

/** Read Obsidian theme colors from CSS variables resolved on `el`. */
export function readThemeColors(el: HTMLElement): ThemeColors {
	const s = getComputedStyle(el);
	const v = (name: string, fallback: string): string =>
		s.getPropertyValue(name).trim() || fallback;
	const accent = v('--interactive-accent', '#a882ff');
	const green = v('--color-green', '#4caf82');
	const red = v('--color-red', '#e05561');
	return {
		text: v('--text-normal', '#dcddde'),
		muted: v('--text-muted', '#888888'),
		border: v('--background-modifier-border', '#363636'),
		accent,
		green,
		red,
		palette: [
			accent,
			v('--color-blue', '#6c8cff'),
			green,
			v('--color-orange', '#e0a458'),
			red,
			v('--color-purple', '#b48ead'),
			v('--color-cyan', '#56b6c2'),
			v('--color-yellow', '#c9a14a'),
		],
	};
}

function baseOptions(theme: ThemeColors): ChartConfiguration['options'] {
	return {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { labels: { color: theme.muted } },
		},
		scales: {
			x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
			y: { ticks: { color: theme.muted }, grid: { color: theme.border } },
		},
	};
}

export function createNetWorthChart(
	canvas: HTMLCanvasElement,
	series: Series,
	theme: ThemeColors,
): Chart {
	return new Chart(canvas, {
		type: 'line',
		data: {
			labels: series.labels,
			datasets: [
				{
					label: 'Net worth',
					data: series.values,
					borderColor: theme.accent,
					backgroundColor: withAlpha(theme.accent, 0.18),
					fill: true,
					tension: 0.3,
					pointRadius: 2,
				},
			],
		},
		options: baseOptions(theme),
	});
}

export function createIncomeExpenseChart(
	canvas: HTMLCanvasElement,
	series: DualSeries,
	theme: ThemeColors,
): Chart {
	return new Chart(canvas, {
		type: 'bar',
		data: {
			labels: series.labels,
			datasets: [
				{ label: 'Income', data: series.income, backgroundColor: theme.green },
				{ label: 'Expenses', data: series.expenses, backgroundColor: theme.red },
			],
		},
		options: baseOptions(theme),
	});
}

export function createCategoryChart(
	canvas: HTMLCanvasElement,
	categories: Category[],
	theme: ThemeColors,
	onSelect?: (label: string) => void,
): Chart {
	return new Chart(canvas, {
		type: 'doughnut',
		data: {
			labels: categories.map((c) => c.label),
			datasets: [
				{
					data: categories.map((c) => c.value),
					backgroundColor: categories.map(
						(_, i) => theme.palette[i % theme.palette.length] ?? theme.accent,
					),
					borderWidth: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { position: 'right', labels: { color: theme.muted } } },
			onClick: onSelect
				? (_evt, elements): void => {
						const first = elements[0];
						if (!first) return;
						const label = categories[first.index]?.label;
						if (label) onSelect(label);
					}
				: undefined,
		},
	});
}

export function createWaterfallChart(
	canvas: HTMLCanvasElement,
	steps: WaterfallStep[],
	theme: ThemeColors,
	fmt: (n: number) => string,
): Chart {
	const color = (s: WaterfallStep): string =>
		s.kind === 'total' ? theme.accent : s.kind === 'income' ? theme.green : theme.red;
	return new Chart(canvas, {
		type: 'bar',
		data: {
			labels: steps.map((s) => s.label),
			datasets: [
				{
					label: 'Cash flow',
					data: steps.map((s) => [s.start, s.end] as [number, number]),
					backgroundColor: steps.map((s) => color(s)),
					borderWidth: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (item): string => {
							const s = steps[item.dataIndex];
							if (!s) return '';
							return s.kind === 'total' ? fmt(s.end) : fmt(s.delta);
						},
					},
				},
			},
			scales: {
				x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
				y: { ticks: { color: theme.muted }, grid: { color: theme.border } },
			},
		},
	});
}

export function createCompareChart(
	canvas: HTMLCanvasElement,
	labels: string[],
	current: number[],
	previous: number[],
	theme: ThemeColors,
	currentLabel: string,
	previousLabel: string,
): Chart {
	return new Chart(canvas, {
		type: 'bar',
		data: {
			labels,
			datasets: [
				{ label: previousLabel, data: previous, backgroundColor: theme.muted },
				{ label: currentLabel, data: current, backgroundColor: theme.accent },
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			indexAxis: 'y',
			plugins: { legend: { labels: { color: theme.muted } } },
			scales: {
				x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
				y: { ticks: { color: theme.muted }, grid: { color: theme.border } },
			},
		},
	});
}

export function createStackedCategoryChart(
	canvas: HTMLCanvasElement,
	data: CategorySeries,
	theme: ThemeColors,
): Chart {
	return new Chart(canvas, {
		type: 'bar',
		data: {
			labels: data.labels,
			datasets: data.series.map((s, i) => ({
				label: s.category,
				data: s.values,
				backgroundColor: theme.palette[i % theme.palette.length] ?? theme.accent,
			})),
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { labels: { color: theme.muted } } },
			scales: {
				x: { stacked: true, ticks: { color: theme.muted }, grid: { color: theme.border } },
				y: { stacked: true, ticks: { color: theme.muted }, grid: { color: theme.border } },
			},
		},
	});
}

export function createMonthlySeriesChart(
	canvas: HTMLCanvasElement,
	series: Series,
	theme: ThemeColors,
	color: string,
	label: string,
): Chart {
	return new Chart(canvas, {
		type: 'bar',
		data: {
			labels: series.labels,
			datasets: [{ label, data: series.values, backgroundColor: color }],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { labels: { color: theme.muted } } },
			scales: {
				x: { ticks: { color: theme.muted }, grid: { color: theme.border } },
				y: { ticks: { color: theme.muted }, grid: { color: theme.border } },
			},
		},
	});
}
