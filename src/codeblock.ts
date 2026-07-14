import { Chart } from 'chart.js';
import { MarkdownRenderChild, setIcon } from 'obsidian';
import type HledgerPlugin from './main';
import {
	type PeriodRange,
	computeAccountBalances,
	computeByCategory,
	computeIncomeExpenseSeries,
	computeNetWorthSeries,
	computeSummary,
	filterByStatus,
	periodRange,
} from './compute';
import {
	createCategoryChart,
	createIncomeExpenseChart,
	createNetWorthChart,
	readThemeColors,
} from './charts';
import type { AccountPrefixMap, Journal, PeriodKey, StatusFilter } from './types';

type ReportType =
	| 'summary'
	| 'expenses'
	| 'income'
	| 'balances'
	| 'networth'
	| 'monthly';

interface BlockConfig {
	type: ReportType;
	period: PeriodKey;
	commodity: string;
	account: string;
	status: StatusFilter;
	title: string;
}

const REPORT_TYPES: ReportType[] = [
	'summary',
	'expenses',
	'income',
	'balances',
	'networth',
	'monthly',
];

const PERIOD_KEYS: PeriodKey[] = ['month', '12months', 'year', 'all'];
const STATUS_KEYS: StatusFilter[] = ['all', 'cleared', 'pending', 'unmarked'];

/** Parse the `key: value` lines inside an ```hledger code block. */
function parseConfig(source: string, fallbackCommodity: string): BlockConfig {
	const cfg: BlockConfig = {
		type: 'summary',
		period: '12months',
		commodity: fallbackCommodity,
		account: '',
		status: 'all',
		title: '',
	};
	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();
		switch (key) {
			case 'type':
				if ((REPORT_TYPES as string[]).includes(value)) cfg.type = value as ReportType;
				break;
			case 'period':
				if ((PERIOD_KEYS as string[]).includes(value)) cfg.period = value as PeriodKey;
				break;
			case 'commodity':
				cfg.commodity = value;
				break;
			case 'account':
				cfg.account = value;
				break;
			case 'status':
				if ((STATUS_KEYS as string[]).includes(value)) cfg.status = value as StatusFilter;
				break;
			case 'title':
				cfg.title = value;
				break;
		}
	}
	return cfg;
}

/** A render child that owns its charts so they are destroyed when the note re-renders. */
class HledgerBlock extends MarkdownRenderChild {
	private charts: Chart[] = [];
	constructor(
		el: HTMLElement,
		private readonly render: (track: (c: Chart) => void) => void,
	) {
		super(el);
	}
	onload(): void {
		this.render((c) => this.charts.push(c));
	}
	onunload(): void {
		for (const c of this.charts) c.destroy();
		this.charts = [];
	}
}

export function registerHledgerCodeBlock(plugin: HledgerPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('hledger', async (source, el, ctx) => {
		const result = await plugin.loadModel();
		if ('error' in result) {
			el.createDiv({
				cls: 'hledger-cb-error',
				text:
					result.error === 'no-path'
						? 'Hledger: no journal file configured.'
						: result.error === 'mobile-external'
							? 'Hledger: journal files outside the vault are desktop-only.'
							: `Hledger: journal file not found — ${result.path ?? ''}`,
			});
			return;
		}
		const cfg = parseConfig(source, plugin.settings.defaultCommodity);
		const journal = filterByStatus(result.journal, cfg.status);
		const commodity =
			cfg.commodity && journal.commodities.includes(cfg.commodity)
				? cfg.commodity
				: (journal.commodities[0] ?? '');
		const range = periodRange(cfg.period, new Date());
		const prefixes = plugin.settings.accountPrefixes;
		const theme = readThemeColors(el);
		const fmt = (n: number): string =>
			`${commodity ? commodity + ' ' : ''}${n.toLocaleString(undefined, {
				maximumFractionDigits: 2,
			})}`;

		const child = new HledgerBlock(el, (track) => {
			renderBlock(el, cfg, journal, commodity, prefixes, range, theme, fmt, track);
		});
		ctx.addChild(child);
	});
}

function renderBlock(
	el: HTMLElement,
	cfg: BlockConfig,
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	theme: ReturnType<typeof readThemeColors>,
	fmt: (n: number) => string,
	track: (c: Chart) => void,
): void {
	const wrap = el.createDiv({ cls: 'hledger-cb' });
	const title = cfg.title || defaultTitle(cfg.type);
	const head = wrap.createDiv({ cls: 'hledger-cb-head' });
	setIcon(head.createSpan({ cls: 'hledger-card-icon' }), iconFor(cfg.type));
	head.createSpan({ text: title });
	const body = wrap.createDiv({ cls: 'hledger-cb-body' });

	switch (cfg.type) {
		case 'summary': {
			const s = computeSummary(journal, commodity, prefixes, range);
			const grid = body.createDiv({ cls: 'hledger-cb-summary' });
			stat(grid, 'Net worth', fmt(s.netWorth));
			stat(grid, 'Income', fmt(s.income));
			stat(grid, 'Expenses', fmt(s.expenses));
			stat(grid, 'Savings', fmt(s.savings));
			break;
		}
		case 'expenses':
		case 'income': {
			const cats = computeByCategory(
				journal,
				commodity,
				prefixes,
				range,
				cfg.type === 'income' ? 'income' : 'expense',
				cfg.account,
			);
			if (cats.length === 0) {
				body.createDiv({ cls: 'hledger-empty-note', text: 'No data in this period' });
				break;
			}
			body.addClass('is-chart');
			track(createCategoryChart(body.createEl('canvas'), cats, theme));
			break;
		}
		case 'networth': {
			body.addClass('is-chart');
			track(
				createNetWorthChart(
					body.createEl('canvas'),
					computeNetWorthSeries(journal, commodity, prefixes, range),
					theme,
				),
			);
			break;
		}
		case 'monthly': {
			body.addClass('is-chart');
			track(
				createIncomeExpenseChart(
					body.createEl('canvas'),
					computeIncomeExpenseSeries(journal, commodity, prefixes, range),
					theme,
				),
			);
			break;
		}
		case 'balances': {
			const balances = computeAccountBalances(
				journal,
				commodity,
				prefixes,
				range,
				cfg.account,
			);
			if (balances.length === 0) {
				body.createDiv({ cls: 'hledger-empty-note', text: 'No balances in this period' });
				break;
			}
			const max = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
			const list = body.createDiv({ cls: 'hledger-bars' });
			for (const b of balances) {
				const row = list.createDiv({ cls: 'hledger-bar-row' });
				row.createSpan({ cls: 'hledger-bar-name', text: b.account });
				const track2 = row.createDiv({ cls: 'hledger-bar-track' });
				const bar = track2.createDiv({ cls: 'hledger-bar' });
				bar.style.width = `${(Math.abs(b.balance) / max) * 100}%`;
				if (b.balance < 0) bar.addClass('is-negative');
				row.createSpan({ cls: 'hledger-bar-val', text: fmt(b.balance) });
			}
			break;
		}
	}
}

function stat(parent: HTMLElement, label: string, value: string): void {
	const card = parent.createDiv({ cls: 'hledger-stat' });
	card.createDiv({ cls: 'hledger-stat-label', text: label });
	card.createDiv({ cls: 'hledger-stat-value', text: value });
}

function defaultTitle(type: ReportType): string {
	switch (type) {
		case 'summary':
			return 'Summary';
		case 'expenses':
			return 'Expenses by category';
		case 'income':
			return 'Income by source';
		case 'balances':
			return 'Account balances';
		case 'networth':
			return 'Net worth over time';
		case 'monthly':
			return 'Income vs expenses';
	}
}

function iconFor(type: ReportType): string {
	switch (type) {
		case 'summary':
			return 'wallet';
		case 'expenses':
			return 'pie-chart';
		case 'income':
			return 'pie-chart';
		case 'balances':
			return 'landmark';
		case 'networth':
			return 'line-chart';
		case 'monthly':
			return 'bar-chart-3';
	}
}
