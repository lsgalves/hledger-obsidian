import type {
	AccountClass,
	AccountPrefixMap,
	Journal,
	PeriodKey,
	StatusFilter,
	Transaction,
} from './types';
import { dayKey } from './daterange';

/** A view of the journal restricted to transactions of a given status (or all). */
export function filterByStatus(journal: Journal, status: StatusFilter): Journal {
	if (status === 'all') return journal;
	return {
		...journal,
		transactions: journal.transactions.filter((t) => t.status === status),
	};
}

export const DEFAULT_PREFIXES: AccountPrefixMap = {
	assets: 'asset',
	asset: 'asset',
	ativos: 'asset',
	ativo: 'asset',
	liabilities: 'liability',
	liability: 'liability',
	passivos: 'liability',
	passivo: 'liability',
	equity: 'equity',
	patrimonio: 'equity',
	income: 'income',
	revenues: 'income',
	revenue: 'income',
	receitas: 'income',
	receita: 'income',
	expenses: 'expense',
	expense: 'expense',
	despesas: 'expense',
	despesa: 'expense',
};

export function classifyAccount(
	parts: string[],
	prefixes: AccountPrefixMap,
): AccountClass {
	const top = (parts[0] ?? '').toLowerCase();
	return prefixes[top] ?? 'other';
}

/** True when `account` is the filter account or one of its subaccounts. Empty filter = all. */
export function matchesAccount(account: string, filter: string): boolean {
	if (!filter) return true;
	return account === filter || account.startsWith(filter + ':');
}

export function monthKey(date: Date): string {
	const m = `${date.getMonth() + 1}`.padStart(2, '0');
	return `${date.getFullYear()}-${m}`;
}

export interface PeriodRange {
	start: Date | null;
	end: Date | null; // exclusive
}

export function periodRange(period: PeriodKey, now: Date): PeriodRange {
	const y = now.getFullYear();
	const m = now.getMonth();
	switch (period) {
		case 'month':
			return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
		case '12months':
			return { start: new Date(y, m - 11, 1), end: new Date(y, m + 1, 1) };
		case 'year':
			return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
		case 'all':
			return { start: null, end: null };
	}
}

export function inRange(date: Date, range: PeriodRange): boolean {
	return (
		(range.start === null || date >= range.start) &&
		(range.end === null || date < range.end)
	);
}

const VALID_CLASSES: AccountClass[] = [
	'asset',
	'liability',
	'equity',
	'income',
	'expense',
	'other',
];

export function prefixesToText(prefixes: AccountPrefixMap): string {
	return Object.entries(prefixes)
		.map(([prefix, cls]) => `${prefix} = ${cls}`)
		.join('\n');
}

export function textToPrefixes(text: string): AccountPrefixMap {
	const out: AccountPrefixMap = {};
	for (const line of text.split('\n')) {
		const m = line.match(/^\s*([^=]+?)\s*=\s*(\w+)\s*$/);
		if (!m || m[1] === undefined || m[2] === undefined) continue;
		const cls = m[2].toLowerCase() as AccountClass;
		if (VALID_CLASSES.includes(cls)) out[m[1].toLowerCase()] = cls;
	}
	return out;
}

export interface Series {
	labels: string[];
	values: number[];
}

export interface DualSeries {
	labels: string[];
	income: number[];
	expenses: number[];
}

/** First day of the month *after* the given 'YYYY-MM' key. */
function firstOfNextMonth(key: string): Date {
	const [y, m] = key.split('-').map(Number);
	return new Date(y ?? 1970, m ?? 1, 1); // m is 1-based → month index m == next month
}

/** Ascending list of 'YYYY-MM' month keys spanning the visible window. */
export function monthsInWindow(journal: Journal, range: PeriodRange): string[] {
	const txns = journal.transactions;
	if (txns.length === 0) return [];
	const first = range.start ?? txns[0]!.date;
	const lastTxn = txns[txns.length - 1]!.date;
	const last = range.end
		? new Date(range.end.getFullYear(), range.end.getMonth(), 0)
		: lastTxn;
	const out: string[] = [];
	let y = first.getFullYear();
	let m = first.getMonth();
	const endY = last.getFullYear();
	const endM = last.getMonth();
	while (y < endY || (y === endY && m <= endM)) {
		out.push(`${y}-${`${m + 1}`.padStart(2, '0')}`);
		m++;
		if (m > 11) {
			m = 0;
			y++;
		}
	}
	return out;
}

/** Cumulative asset+liability balance at the end of each visible month. */
export function computeNetWorthSeries(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
): Series {
	const labels = monthsInWindow(journal, range);
	const values = labels.map((key) => {
		const cutoff = firstOfNextMonth(key);
		let total = 0;
		for (const txn of journal.transactions) {
			if (txn.date >= cutoff) break; // transactions are sorted ascending
			for (const post of txn.postings) {
				if (post.commodity !== commodity) continue;
				const cls = classifyAccount(post.parts, prefixes);
				if (cls === 'asset' || cls === 'liability') total += post.amount;
			}
		}
		return total;
	});
	return { labels, values };
}

/** Per-month income (sign-flipped) and expense totals within the period. */
export function computeIncomeExpenseSeries(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
): DualSeries {
	const labels = monthsInWindow(journal, range);
	const income = new Map<string, number>();
	const expenses = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		const key = monthKey(txn.date);
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			const cls = classifyAccount(post.parts, prefixes);
			if (cls === 'income') income.set(key, (income.get(key) ?? 0) - post.amount);
			else if (cls === 'expense')
				expenses.set(key, (expenses.get(key) ?? 0) + post.amount);
		}
	}
	return {
		labels,
		income: labels.map((k) => income.get(k) ?? 0),
		expenses: labels.map((k) => expenses.get(k) ?? 0),
	};
}

export interface Summary {
	netWorth: number;
	income: number;
	expenses: number;
	savings: number;
}

export interface Category {
	label: string;
	value: number;
}

export interface Balance {
	account: string;
	balance: number;
}

export interface RecentTxn {
	date: Date;
	description: string;
	amount: number;
	txn: Transaction;
}

export function computeSummary(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
): Summary {
	let netWorth = 0;
	let income = 0;
	let expenses = 0;
	for (const txn of journal.transactions) {
		const within = inRange(txn.date, range);
		const beforeEnd = range.end === null || txn.date < range.end;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			const cls = classifyAccount(post.parts, prefixes);
			if ((cls === 'asset' || cls === 'liability') && beforeEnd) {
				netWorth += post.amount;
			}
			if (within) {
				if (cls === 'income') income -= post.amount;
				else if (cls === 'expense') expenses += post.amount;
			}
		}
	}
	return { netWorth, income, expenses, savings: income - expenses };
}

export interface LedgerRow {
	date: Date;
	description: string;
	category: string;
	amount: number;
	txn: Transaction;
}

/** Signed display amount: expenses are positive debits; income are credits (stored
 * negative) shown as positive. */
function classAmount(amount: number, klass: AccountClass): number {
	return klass === 'income' ? -amount : amount;
}

/** Postings of `klass` grouped by depth-`depth` account, signed positive, descending. */
export function computeByCategory(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	klass: AccountClass,
	accountFilter = '',
	depth = 2,
): Category[] {
	const byCat = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) !== klass) continue;
			if (!matchesAccount(post.account, accountFilter)) continue;
			const label = post.parts.slice(0, depth).join(':');
			byCat.set(label, (byCat.get(label) ?? 0) + classAmount(post.amount, klass));
		}
	}
	return [...byCat.entries()]
		.map(([label, value]) => ({ label, value }))
		.filter((c) => Math.abs(c.value) > 1e-9)
		.sort((a, b) => b.value - a.value);
}

/**
 * Asset+liability balances as of the period end, grouped at depth 2, by magnitude.
 * `accountFilter` (empty = all) restricts to a posting account and its subaccounts.
 */
export function computeAccountBalances(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	accountFilter = '',
): Balance[] {
	const byAcct = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (range.end !== null && txn.date >= range.end) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			const cls = classifyAccount(post.parts, prefixes);
			if (cls !== 'asset' && cls !== 'liability') continue;
			if (!matchesAccount(post.account, accountFilter)) continue;
			const account = post.parts.slice(0, 2).join(':');
			byAcct.set(account, (byAcct.get(account) ?? 0) + post.amount);
		}
	}
	return [...byAcct.entries()]
		.map(([account, balance]) => ({ account, balance }))
		.filter((b) => Math.abs(b.balance) > 1e-9)
		.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

/**
 * Most-recent-first transactions, limited. With no `accountFilter`, the amount is the
 * net asset cash delta. With a filter, only transactions touching that account (or its
 * subaccounts) are kept, and the amount is the net change to the filtered account.
 */
export function computeRecentTransactions(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	limit: number,
	accountFilter = '',
): RecentTxn[] {
	const rows: RecentTxn[] = [];
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		let amount = 0;
		let touched = false;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (accountFilter) {
				if (matchesAccount(post.account, accountFilter)) {
					amount += post.amount;
					touched = true;
				}
			} else if (classifyAccount(post.parts, prefixes) === 'asset') {
				amount += post.amount;
			}
		}
		if (accountFilter && !touched) continue;
		rows.push({ date: txn.date, description: txn.description, amount, txn });
	}
	return rows.reverse().slice(0, limit);
}

/** Sum of expense postings per local day (YYYY-MM-DD) within range, matching the filter. */
export function computeDailyExpenses(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	accountFilter = '',
): Map<string, number> {
	const byDay = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) !== 'expense') continue;
			if (!matchesAccount(post.account, accountFilter)) continue;
			const key = dayKey(txn.date);
			byDay.set(key, (byDay.get(key) ?? 0) + post.amount);
		}
	}
	return byDay;
}

/** One row per `klass` posting in range, signed positive, most-recent-first. */
export function computeClassRows(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	klass: AccountClass,
	accountFilter = '',
): LedgerRow[] {
	const rows: LedgerRow[] = [];
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) !== klass) continue;
			if (!matchesAccount(post.account, accountFilter)) continue;
			rows.push({
				date: txn.date,
				description: txn.description,
				category: post.account,
				amount: classAmount(post.amount, klass),
				txn,
			});
		}
	}
	return rows.reverse();
}

/** Distinct `klass` category prefixes (depth >= minDepth up to full account), sorted. */
export function classCategories(
	journal: Journal,
	prefixes: AccountPrefixMap,
	klass: AccountClass,
	minDepth = 2,
): string[] {
	const set = new Set<string>();
	for (const txn of journal.transactions) {
		for (const post of txn.postings) {
			if (classifyAccount(post.parts, prefixes) !== klass) continue;
			for (let d = minDepth; d <= post.parts.length; d++) {
				set.add(post.parts.slice(0, d).join(':'));
			}
		}
	}
	return [...set].sort();
}

/** The equal-duration window immediately before `range`, or null if `range` is unbounded. */
export function previousRange(range: PeriodRange): PeriodRange | null {
	if (range.start === null || range.end === null) return null;
	const dur = range.end.getTime() - range.start.getTime();
	return {
		start: new Date(range.start.getTime() - dur),
		end: new Date(range.start.getTime()),
	};
}

/** Percent change of `current` vs `previous`, or null when `previous` is zero. */
export function pctChange(current: number, previous: number): number | null {
	if (previous === 0) return null;
	return ((current - previous) / Math.abs(previous)) * 100;
}

export interface CategorySeries {
	labels: string[];
	series: { category: string; values: number[] }[];
}

/**
 * Monthly expense totals per depth-2 category over the visible window. The `topN`
 * categories by grand total are kept; the rest are folded into a trailing "Other" series.
 */
export function computeCategoryTimeSeries(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	depth = 2,
	topN = 6,
): CategorySeries {
	const labels = monthsInWindow(journal, range);
	const monthIndex = new Map<string, number>();
	labels.forEach((label, i) => monthIndex.set(label, i));

	const byCat = new Map<string, number[]>();
	const totals = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		const mi = monthIndex.get(monthKey(txn.date));
		if (mi === undefined) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) !== 'expense') continue;
			const cat = post.parts.slice(0, depth).join(':');
			let arr = byCat.get(cat);
			if (!arr) {
				arr = new Array<number>(labels.length).fill(0);
				byCat.set(cat, arr);
			}
			arr[mi] = (arr[mi] ?? 0) + post.amount;
			totals.set(cat, (totals.get(cat) ?? 0) + post.amount);
		}
	}

	const ranked = [...totals.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([cat]) => cat);
	const top = ranked.slice(0, topN);
	const rest = ranked.slice(topN);

	const series = top.map((category) => ({
		category,
		values: byCat.get(category) ?? new Array<number>(labels.length).fill(0),
	}));
	if (rest.length > 0) {
		const other = new Array<number>(labels.length).fill(0);
		for (const cat of rest) {
			const arr = byCat.get(cat);
			if (!arr) continue;
			for (let i = 0; i < other.length; i++) other[i] = (other[i] ?? 0) + (arr[i] ?? 0);
		}
		series.push({ category: 'Other', values: other });
	}
	return { labels, series };
}

/** The largest `klass` rows in range (signed positive), by amount descending. */
export function computeTopByClass(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	klass: AccountClass,
	accountFilter = '',
	limit = 5,
): LedgerRow[] {
	return computeClassRows(journal, commodity, prefixes, range, klass, accountFilter)
		.slice()
		.sort((a, b) => b.amount - a.amount)
		.slice(0, limit);
}

export interface WaterfallStep {
	label: string;
	delta: number; // signed contribution: income positive, expense negative; totals 0
	start: number; // cumulative level before this step
	end: number; // cumulative level after this step
	kind: 'total' | 'income' | 'expense';
}

/**
 * Cash-flow waterfall for the period: opening balance → +income → −each expense category →
 * closing balance. The opening balance is the asset+liability total before the range; the
 * `topN` largest expense categories are kept and the rest folded into a trailing "Other".
 */
export function computeWaterfall(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	topN = 8,
): WaterfallStep[] {
	let opening = 0;
	if (range.start !== null) {
		for (const txn of journal.transactions) {
			if (txn.date >= range.start) break;
			for (const post of txn.postings) {
				if (post.commodity !== commodity) continue;
				const cls = classifyAccount(post.parts, prefixes);
				if (cls === 'asset' || cls === 'liability') opening += post.amount;
			}
		}
	}

	let income = 0;
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) === 'income') income -= post.amount;
		}
	}

	const cats = computeByCategory(journal, commodity, prefixes, range, 'expense');
	const top = cats.slice(0, topN);
	const restTotal = cats.slice(topN).reduce((s, c) => s + c.value, 0);

	const steps: WaterfallStep[] = [];
	let cum = opening;
	steps.push({ label: 'Opening', delta: 0, start: 0, end: opening, kind: 'total' });
	if (income !== 0) {
		steps.push({ label: 'Income', delta: income, start: cum, end: cum + income, kind: 'income' });
		cum += income;
	}
	for (const c of top) {
		steps.push({ label: c.label, delta: -c.value, start: cum, end: cum - c.value, kind: 'expense' });
		cum -= c.value;
	}
	if (restTotal > 1e-9) {
		steps.push({ label: 'Other', delta: -restTotal, start: cum, end: cum - restTotal, kind: 'expense' });
		cum -= restTotal;
	}
	steps.push({ label: 'Closing', delta: 0, start: 0, end: cum, kind: 'total' });
	return steps;
}

export interface CompareRow {
	label: string;
	current: number;
	previous: number;
}

/** Merge two category breakdowns into aligned current/previous rows, by descending current. */
export function compareCategories(
	current: Category[],
	previous: Category[],
): CompareRow[] {
	const prev = new Map(previous.map((c) => [c.label, c.value]));
	const seen = new Set<string>();
	const rows: CompareRow[] = [];
	for (const c of current) {
		seen.add(c.label);
		rows.push({ label: c.label, current: c.value, previous: prev.get(c.label) ?? 0 });
	}
	for (const c of previous) {
		if (seen.has(c.label)) continue;
		rows.push({ label: c.label, current: 0, previous: c.value });
	}
	return rows.sort((a, b) => b.current - a.current || b.previous - a.previous);
}

/** Per-month totals for the class over the visible window (signed positive). */
export function computeMonthlySeries(
	journal: Journal,
	commodity: string,
	prefixes: AccountPrefixMap,
	range: PeriodRange,
	klass: AccountClass,
): Series {
	const labels = monthsInWindow(journal, range);
	const byMonth = new Map<string, number>();
	for (const txn of journal.transactions) {
		if (!inRange(txn.date, range)) continue;
		const key = monthKey(txn.date);
		for (const post of txn.postings) {
			if (post.commodity !== commodity) continue;
			if (classifyAccount(post.parts, prefixes) !== klass) continue;
			byMonth.set(key, (byMonth.get(key) ?? 0) + classAmount(post.amount, klass));
		}
	}
	return { labels, values: labels.map((l) => byMonth.get(l) ?? 0) };
}
