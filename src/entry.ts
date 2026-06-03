import { parseAmount } from './amount';

export interface EntryData {
	date: string; // YYYY-MM-DD
	description: string;
	category: string;
	amount: string; // raw user input
	commodity: string;
	source: string;
}

/**
 * Format an amount for writing: comma decimal with 2 places, with the commodity placed so
 * the parser can re-read it — a symbol commodity (contains a non-letter, e.g. "R$", "$")
 * prefixes with no space; a letter-only code (e.g. "BRL") is suffixed with a space.
 */
export function formatEntryAmount(input: string, commodity: string): string {
	const num = parseAmount(input).toFixed(2).replace('.', ',');
	return /^[A-Za-z]+$/.test(commodity) ? `${num} ${commodity}` : `${commodity}${num}`;
}

/** Build a 3-line hledger transaction: date+description, category posting (with amount),
 * and a source posting with the amount elided so hledger balances it. Ends with a newline. */
export function buildEntry(data: EntryData): string {
	const amount = formatEntryAmount(data.amount, data.commodity);
	const left = `    ${data.category}`;
	const pad = left.length >= 34 ? '  ' : ' '.repeat(36 - left.length);
	return `${data.date} ${data.description}\n${left}${pad}${amount}\n    ${data.source}\n`;
}
