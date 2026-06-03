import { parseLedgerToCooked } from 'hledger-parser';
import { parseAmount } from './amount';
import type { Journal, Posting, Transaction } from './types';

/** Parse hledger source into a normalized, sorted domain Journal. */
export function buildModel(source: string): Journal {
	const result = parseLedgerToCooked(source);
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
