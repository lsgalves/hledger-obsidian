import { parseLedgerToCooked } from 'hledger-parser';
import { parseAmount } from './amount';
import type { Journal, Posting, Transaction } from './types';

// hledger-parser cannot lex a number-first format sample with an unquoted
// commodity ("commodity 1,000.00 EGP") in commodity/D/format lines, even
// though hledger accepts it. The equivalent symbol-first form parses fine,
// and this plugin never consumes the sample itself, so swap the order.
const NUMBER_FIRST_FORMAT_RE =
	/^(commodity[ \t]+|D[ \t]+|[ \t]+format[ \t]+)([-+]?\d[\d,.]*)[ \t]+([^\s\d.,;+@"-]+)([ \t]*(?:;.*)?)$/;

export function normalizeCommodityFormats(source: string): string {
	return source
		.split('\n')
		.map((line) => line.replace(NUMBER_FIRST_FORMAT_RE, '$1$3 $2$4'))
		.join('\n');
}

/** Parse hledger source into a normalized, sorted domain Journal. */
export function buildModel(source: string): Journal {
	let result: ReturnType<typeof parseLedgerToCooked>;
	try {
		result = parseLedgerToCooked(normalizeCommodityFormats(source));
	} catch (err) {
		// The parser throws (instead of reporting) on some inputs it cannot
		// lex; degrade to a warning instead of failing the whole dashboard.
		return {
			transactions: [],
			commodities: [],
			accounts: [],
			errors: [`journal could not be parsed: ${String(err)}`],
		};
	}
	const errors: string[] = [
		...result.lexErrors.map((e) => e.message),
		...result.parseErrors.map((e) => e.message),
	];

	const transactions: Transaction[] = [];
	const commodities = new Set<string>();
	const accounts = new Set<string>();

	for (const txn of result.cookedJournal.transactions) {
		const date = new Date(txn.date.year, txn.date.month - 1, txn.date.day);
		const description =
			typeof txn.description === 'string'
				? txn.description
				: [txn.description.payee, txn.description.memo]
						.filter((s) => s)
						.join(' | ');

		const explicit: Posting[] = [];
		const elided: { account: string; parts: string[] }[] = [];

		for (const p of txn.postings) {
			const parts = p.account.name;
			const account = parts.join(':');
			accounts.add(account);
			if (p.amount) {
				const commodity = p.amount.commodity ?? '';
				commodities.add(commodity);
				explicit.push({
					account,
					parts,
					commodity,
					amount: parseAmount(p.amount.number, p.amount.sign),
				});
			} else {
				elided.push({ account, parts });
			}
		}

		const postings: Posting[] = [...explicit];
		if (elided.length > 0) {
			const sums = new Map<string, number>();
			for (const p of explicit) {
				sums.set(p.commodity, (sums.get(p.commodity) ?? 0) + p.amount);
			}
			for (const e of elided) {
				for (const [commodity, sum] of sums) {
					if (sum === 0) continue;
					postings.push({
						account: e.account,
						parts: e.parts,
						commodity,
						amount: -sum,
					});
				}
			}
		}

		transactions.push({ date, description, status: txn.status, postings });
	}

	transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

	return {
		transactions,
		commodities: [...commodities].sort(),
		accounts: [...accounts].sort(),
		errors,
	};
}
