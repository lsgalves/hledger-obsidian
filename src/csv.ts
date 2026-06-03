import type { LedgerRow } from './compute';

export function csvField(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

export function buildLedgerCsv(rows: LedgerRow[]): string {
	const header = 'Date,Description,Category,Amount';
	const lines = rows.map((r) => {
		const date = `${`${r.date.getDate()}`.padStart(2, '0')}/${`${
			r.date.getMonth() + 1
		}`.padStart(2, '0')}/${r.date.getFullYear()}`;
		return [
			csvField(date),
			csvField(r.description),
			csvField(r.category),
			csvField(`${r.amount}`),
		].join(',');
	});
	return [header, ...lines].join('\n');
}
