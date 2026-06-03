import { ButtonComponent, ItemView, type WorkspaceLeaf, setIcon } from 'obsidian';
import { Chart } from 'chart.js';
import type HledgerPlugin from './main';
import {
	type PeriodRange,
	computeAccountBalances,
	computeCategoryTimeSeries,
	computeByCategory,
	computeIncomeExpenseSeries,
	computeNetWorthSeries,
	computeRecentTransactions,
	computeSummary,
	classCategories,
	pctChange,
	periodRange,
	previousRange,
} from './compute';
import {
	EXPENSE_CONFIG,
	INCOME_CONFIG,
	type LedgerConfig,
	type LedgerContext,
	renderLedgerBody,
	renderLedgerFilter,
} from './tabs/ledger-tab';
import {
	createCategoryChart,
	createIncomeExpenseChart,
	createNetWorthChart,
	createStackedCategoryChart,
	readThemeColors,
} from './charts';
import type { Journal, PeriodKey } from './types';
import { openRangeCalendar } from './datepicker';
import { formatRangeLabel } from './daterange';
import { EntryModal } from './entry-modal';
import { buildEntry } from './entry';

export const VIEW_TYPE_HLEDGER = 'hledger-dashboard';

const PERIODS: { key: PeriodKey; label: string }[] = [
	{ key: 'month', label: 'Month' },
	{ key: '12months', label: '12 months' },
	{ key: 'year', label: 'Year' },
	{ key: 'all', label: 'All' },
];

export class HledgerView extends ItemView {
	private plugin: HledgerPlugin;
	private period: PeriodKey;
	private commodity = '';
	private accountFilter = '';
	private customRange: { start: Date; end: Date } | null = null;
	private activeTab: 'overview' | 'expenses' | 'income' = 'overview';
	private expenseCategoryFilter = '';
	private expenseSearch = '';
	private expenseDayFilter = '';
	private incomeCategoryFilter = '';
	private incomeSearch = '';
	private charts: Chart[] = [];
	private refreshToken = 0;

	constructor(leaf: WorkspaceLeaf, plugin: HledgerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.period = plugin.settings.defaultPeriod;
		this.commodity = plugin.settings.defaultCommodity;
	}

	getViewType(): string {
		return VIEW_TYPE_HLEDGER;
	}

	getDisplayText(): string {
		return 'Hledger';
	}

	getIcon(): string {
		return 'wallet';
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.destroyCharts();
	}

	private destroyCharts(): void {
		for (const c of this.charts) c.destroy();
		this.charts = [];
	}

	/** Reload the model from disk and re-render. */
	async refresh(): Promise<void> {
		const token = ++this.refreshToken;
		const result = await this.plugin.loadModel();
		// A newer refresh was started while we awaited; let it win.
		if (token !== this.refreshToken) return;
		this.destroyCharts();
		const root = this.contentEl;
		root.empty();
		root.addClass('hledger-view');

		if ('error' in result) {
			this.renderError(root, result);
			return;
		}

		const { journal, missingIncludes } = result;
		if (!this.commodity || !journal.commodities.includes(this.commodity)) {
			this.commodity = journal.commodities[0] ?? '';
		}
		if (this.accountFilter && !journal.accounts.includes(this.accountFilter)) {
			this.accountFilter = '';
		}
		const prefixesForReset = this.plugin.settings.accountPrefixes;
		const expCats = classCategories(journal, prefixesForReset, 'expense');
		if (this.expenseCategoryFilter && !expCats.includes(this.expenseCategoryFilter)) {
			this.expenseCategoryFilter = '';
		}
		const incCats = classCategories(journal, prefixesForReset, 'income');
		if (this.incomeCategoryFilter && !incCats.includes(this.incomeCategoryFilter)) {
			this.incomeCategoryFilter = '';
		}

		this.renderTabBar(root);

		const bar = root.createDiv({ cls: 'hledger-controls' });
		this.renderPeriodControls(bar);
		this.renderCommodityControl(bar, journal);
		if (this.activeTab === 'overview') {
			this.renderAccountFilter(bar, journal);
			this.renderActions(bar, journal);
			this.maybeWarnings(root, journal, missingIncludes);
			this.renderBody(root, journal);
		} else {
			const config = this.activeTab === 'income' ? INCOME_CONFIG : EXPENSE_CONFIG;
			const ctx = this.ledgerContext(journal, config);
			renderLedgerFilter(bar, ctx, config);
			this.renderActions(bar, journal);
			this.maybeWarnings(root, journal, missingIncludes);
			renderLedgerBody(root, ctx, config);
		}
	}

	private maybeWarnings(
		root: HTMLElement,
		journal: Journal,
		missing: string[],
	): void {
		if (journal.errors.length > 0 || missing.length > 0) {
			this.renderWarnings(root, journal.errors, missing);
		}
	}

	private renderTabBar(root: HTMLElement): void {
		const tabs = root.createDiv({ cls: 'hledger-tabs' });
		const mk = (key: 'overview' | 'expenses' | 'income', label: string): void => {
			const tab = tabs.createDiv({ cls: 'hledger-tab', text: label });
			if (this.activeTab === key) tab.addClass('is-active');
			tab.addEventListener('click', () => {
				if (this.activeTab === key) return;
				this.activeTab = key;
				void this.refresh();
			});
		};
		mk('overview', 'Overview');
		mk('expenses', 'Expenses');
		mk('income', 'Income');
	}

	private ledgerContext(journal: Journal, config: LedgerConfig): LedgerContext {
		const isIncome = config.klass === 'income';
		return {
			journal,
			commodity: this.commodity,
			prefixes: this.plugin.settings.accountPrefixes,
			range: this.customRange ?? periodRange(this.period, new Date()),
			theme: readThemeColors(this.contentEl),
			categoryFilter: isIncome ? this.incomeCategoryFilter : this.expenseCategoryFilter,
			search: isIncome ? this.incomeSearch : this.expenseSearch,
			dayFilter: isIncome ? '' : this.expenseDayFilter,
			fmt: (n: number): string => this.formatMoney(n),
			onCategoryChange: (value: string): void => {
				if (isIncome) this.incomeCategoryFilter = value;
				else this.expenseCategoryFilter = value;
				void this.refresh();
			},
			setSearch: (value: string): void => {
				if (isIncome) this.incomeSearch = value;
				else this.expenseSearch = value;
			},
			onDayFilter: (key: string): void => {
				if (isIncome) return;
				this.expenseDayFilter = this.expenseDayFilter === key ? '' : key;
				void this.refresh();
			},
			registerChart: (chart: Chart): void => {
				this.charts.push(chart);
			},
		};
	}

	private formatMoney(n: number): string {
		const c = this.commodity ? this.commodity + ' ' : '';
		return `${c}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
	}

	/** The comparison range for trend indicators: previous calendar period, or the
	 * equal-duration window for a custom range; null for the "All" period. */
	private previousRangeForTrend(range: PeriodRange): PeriodRange | null {
		if (this.customRange) return previousRange(range);
		const now = new Date();
		switch (this.period) {
			case 'month':
				return periodRange('month', new Date(now.getFullYear(), now.getMonth() - 1, 1));
			case 'year':
				return periodRange('year', new Date(now.getFullYear() - 1, 0, 1));
			case '12months':
				return periodRange('12months', new Date(now.getFullYear(), now.getMonth() - 12, 1));
			case 'all':
				return null;
		}
	}

	private renderError(
		root: HTMLElement,
		result: { error: 'no-path' | 'missing-file'; path?: string },
	): void {
		const box = root.createDiv({ cls: 'hledger-empty' });
		setIcon(box.createSpan({ cls: 'hledger-empty-icon' }), 'wallet');
		box.createEl('p', {
			text:
				result.error === 'no-path'
					? 'No journal file configured yet.'
					: `Journal file not found: ${result.path ?? ''}`,
		});
		new ButtonComponent(box)
			.setButtonText('Open settings')
			.setCta()
			.onClick(() => {
				const setting = (
					this.app as unknown as {
						setting: { open(): void; openTabById(id: string): void };
					}
				).setting;
				setting.open();
				setting.openTabById(this.plugin.manifest.id);
			});
	}

	private renderWarnings(
		root: HTMLElement,
		errors: string[],
		missing: string[],
	): void {
		const box = root.createDiv({ cls: 'hledger-warning' });
		setIcon(box.createSpan({ cls: 'hledger-warning-icon' }), 'alert-triangle');
		const list = box.createEl('ul');
		for (const m of missing)
			list.createEl('li', { text: `Missing include: ${m}` });
		for (const e of errors.slice(0, 10)) list.createEl('li', { text: e });
	}

	private renderPeriodControls(bar: HTMLElement): void {
		const periodWrap = bar.createDiv({ cls: 'hledger-period' });
		setIcon(periodWrap.createSpan({ cls: 'hledger-ctl-icon' }), 'calendar');
		for (const opt of PERIODS) {
			const btn = new ButtonComponent(periodWrap)
				.setButtonText(opt.label)
				.onClick(() => {
					this.period = opt.key;
					this.customRange = null;
					void this.refresh();
				});
			if (!this.customRange && opt.key === this.period) btn.setCta();
		}

		const customBtn = new ButtonComponent(periodWrap).setButtonText(
			this.customRange
				? formatRangeLabel(this.customRange.start, this.customRange.end)
				: 'Custom',
		);
		customBtn.onClick(() => {
			openRangeCalendar(
				customBtn.buttonEl,
				this.customRange
					? { start: this.customRange.start, endExclusive: this.customRange.end }
					: null,
				(r) => {
					this.customRange = { start: r.start, end: r.endExclusive };
					void this.refresh();
				},
			);
		});
		if (this.customRange) customBtn.setCta();
	}

	private renderCommodityControl(bar: HTMLElement, journal: Journal): void {
		if (journal.commodities.length <= 1) return;
		const commWrap = bar.createDiv({ cls: 'hledger-ctl' });
		setIcon(commWrap.createSpan({ cls: 'hledger-ctl-icon' }), 'coins');
		const select = commWrap.createEl('select', { cls: 'dropdown' });
		for (const c of journal.commodities) {
			const o = select.createEl('option', { text: c || '(none)', value: c });
			if (c === this.commodity) o.selected = true;
		}
		select.addEventListener('change', () => {
			this.commodity = select.value;
			void this.refresh();
		});
	}

	private renderAccountFilter(bar: HTMLElement, journal: Journal): void {
		const acctWrap = bar.createDiv({ cls: 'hledger-ctl' });
		setIcon(acctWrap.createSpan({ cls: 'hledger-ctl-icon' }), 'landmark');
		const acctSelect = acctWrap.createEl('select', { cls: 'dropdown' });
		acctSelect.createEl('option', { text: 'All accounts', value: '' });
		for (const a of journal.accounts) {
			const o = acctSelect.createEl('option', { text: a, value: a });
			if (a === this.accountFilter) o.selected = true;
		}
		acctSelect.addEventListener('change', () => {
			this.accountFilter = acctSelect.value;
			void this.refresh();
		});
	}

	private renderActions(bar: HTMLElement, journal: Journal): void {
		const actions = bar.createDiv({ cls: 'hledger-actions' });
		new ButtonComponent(actions)
			.setIcon('plus')
			.setTooltip('New entry')
			.onClick(() => {
				new EntryModal(this.app, journal.accounts, this.commodity, (data) => {
					void this.plugin.appendEntry(buildEntry(data));
				}).open();
			});
		new ButtonComponent(actions)
			.setIcon('refresh-cw')
			.setTooltip('Reload')
			.onClick(() => {
				void this.refresh();
			});
	}

	private renderBody(root: HTMLElement, journal: Journal): void {
		const range: PeriodRange =
			this.customRange ?? periodRange(this.period, new Date());
		const prefixes = this.plugin.settings.accountPrefixes;
		const commodity = this.commodity;
		const fmt = (n: number): string => this.formatMoney(n);

		// Summary cards (with trend vs the previous comparable period)
		const summary = computeSummary(journal, commodity, prefixes, range);
		const prevRange = this.previousRangeForTrend(range);
		const prev = prevRange
			? computeSummary(journal, commodity, prefixes, prevRange)
			: null;
		const stats = root.createDiv({ cls: 'hledger-stats' });
		this.statCard(stats, 'wallet', 'Net worth', fmt(summary.netWorth), {
			current: summary.netWorth,
			previous: prev ? prev.netWorth : null,
			higherIsBetter: true,
		});
		this.statCard(stats, 'trending-up', 'Income', fmt(summary.income), {
			current: summary.income,
			previous: prev ? prev.income : null,
			higherIsBetter: true,
		});
		this.statCard(stats, 'trending-down', 'Expenses', fmt(summary.expenses), {
			current: summary.expenses,
			previous: prev ? prev.expenses : null,
			higherIsBetter: false,
		});
		this.statCard(stats, 'piggy-bank', 'Savings', fmt(summary.savings), {
			current: summary.savings,
			previous: prev ? prev.savings : null,
			higherIsBetter: true,
		});

		const grid = root.createDiv({ cls: 'hledger-grid' });
		const theme = readThemeColors(root);

		// Net worth over time (full width)
		const nwCard = this.card(grid, 'line-chart', 'Net worth over time', true);
		const nwCanvas = nwCard.createEl('canvas');
		this.charts.push(
			createNetWorthChart(
				nwCanvas,
				computeNetWorthSeries(journal, commodity, prefixes, range),
				theme,
			),
		);

		// Income vs expenses
		const ieCard = this.card(grid, 'bar-chart-3', 'Income vs expenses', false);
		const ieCanvas = ieCard.createEl('canvas');
		this.charts.push(
			createIncomeExpenseChart(
				ieCanvas,
				computeIncomeExpenseSeries(journal, commodity, prefixes, range),
				theme,
			),
		);

		// Expenses by category
		const catCard = this.card(grid, 'pie-chart', 'Expenses by category', false);
		const catCanvas = catCard.createEl('canvas');
		this.charts.push(
			createCategoryChart(
				catCanvas,
				computeByCategory(
					journal,
					commodity,
					prefixes,
					range,
					'expense',
					this.accountFilter,
				),
				theme,
			),
		);

		// Expenses by category over time (full width)
		const evoCard = this.card(grid, 'layers', 'Expenses by category over time', true);
		const evoCanvas = evoCard.createEl('canvas');
		this.charts.push(
			createStackedCategoryChart(
				evoCanvas,
				computeCategoryTimeSeries(journal, commodity, prefixes, range),
				theme,
			),
		);

		// Account balances
		const balCard = this.card(grid, 'landmark', 'Account balances', false);
		const balances = computeAccountBalances(
			journal,
			commodity,
			prefixes,
			range,
			this.accountFilter,
		);
		const max = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
		const balList = balCard.createDiv({ cls: 'hledger-bars' });
		for (const b of balances) {
			const row = balList.createDiv({ cls: 'hledger-bar-row' });
			row.createSpan({ cls: 'hledger-bar-name', text: b.account });
			const track = row.createDiv({ cls: 'hledger-bar-track' });
			const bar = track.createDiv({ cls: 'hledger-bar' });
			bar.style.width = `${(Math.abs(b.balance) / max) * 100}%`;
			if (b.balance < 0) bar.addClass('is-negative');
			row.createSpan({ cls: 'hledger-bar-val', text: fmt(b.balance) });
		}

		// Recent transactions
		const recentCard = this.card(grid, 'list', 'Recent transactions', false);
		const recent = computeRecentTransactions(
			journal,
			commodity,
			prefixes,
			range,
			this.plugin.settings.recentTransactionsCount,
			this.accountFilter,
		);
		const table = recentCard.createEl('table', { cls: 'hledger-tx' });
		for (const r of recent) {
			const tr = table.createEl('tr');
			tr.createEl('td', {
				text: `${`${r.date.getDate()}`.padStart(2, '0')}/${`${
					r.date.getMonth() + 1
				}`.padStart(2, '0')}`,
			});
			tr.createEl('td', { text: r.description });
			const td = tr.createEl('td', { cls: 'hledger-amt', text: fmt(r.amount) });
			td.addClass(r.amount < 0 ? 'is-negative' : 'is-positive');
		}
	}

	private statCard(
		parent: HTMLElement,
		icon: string,
		label: string,
		value: string,
		trend?: { current: number; previous: number | null; higherIsBetter: boolean },
	): void {
		const card = parent.createDiv({ cls: 'hledger-stat' });
		const head = card.createDiv({ cls: 'hledger-stat-head' });
		setIcon(head.createSpan({ cls: 'hledger-stat-icon' }), icon);
		head.createSpan({ cls: 'hledger-stat-label', text: label });
		if (trend && trend.previous !== null) {
			const pct = pctChange(trend.current, trend.previous);
			if (pct !== null) {
				const el = head.createSpan({ cls: 'hledger-stat-trend' });
				if (Math.round(pct) === 0) {
					el.addClass('is-flat');
					el.createSpan({ text: '0%' });
				} else {
					const up = pct > 0;
					setIcon(
						el.createSpan({ cls: 'hledger-stat-trend-icon' }),
						up ? 'arrow-up' : 'arrow-down',
					);
					el.createSpan({ text: `${Math.abs(Math.round(pct))}%` });
					el.addClass(up === trend.higherIsBetter ? 'is-good' : 'is-bad');
				}
			}
		}
		card.createDiv({ cls: 'hledger-stat-value', text: value });
	}

	private card(
		parent: HTMLElement,
		icon: string,
		title: string,
		full: boolean,
	): HTMLElement {
		const card = parent.createDiv({ cls: 'hledger-card' });
		if (full) card.addClass('is-full');
		const head = card.createDiv({ cls: 'hledger-card-head' });
		setIcon(head.createSpan({ cls: 'hledger-card-icon' }), icon);
		head.createSpan({ text: title });
		return card.createDiv({ cls: 'hledger-card-body' });
	}
}
